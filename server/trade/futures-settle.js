// 合约历史结算与当前标记价点检，使用共享 GateClient 请求预算。
// 规格 7.8：资金费 → 强平 → 止损 → 止盈 → 触发单 → 限价成交。
// 每个完整区间处理成功才推进游标，首个不完整分钟只检查最新成交价。
import { parse, toStr, mul, credit, debit } from './decimal.js';
import { ledger } from './state.js';
import { signed, liquidation, fillFutures, makeFuturesOrder } from './futures.js';
const STEP = { '1m': 60000, '1h': 3600000, '1d': 86400000 };
export function applyFunding(state, symbol, rate, mark, time, notices = []) {
  const position = state.futures.positions[symbol];
  if (!position || position.openedAt > time || (position.fundedAt ?? position.openedAt - 1) >= time) return;
  // 规格 7.8：只对结算时持仓收费；正费率多付空收，金额使用该时刻标记 K 线开盘价。
  const direction = position.side === 'long' ? -1n : 1n;
  const payment = mul(mul(parse(position.qty), mark, 'floor'), signed(rate) * direction, 'floor');
  const change = payment >= 0n ? credit(payment) : -debit(-payment);
  position.margin = toStr(signed(position.margin) + change); position.fundedAt = time;
  position.updatedAt = time;
  ledger(state, 'funding', 'USDT', change, '资金费', time, 'futures');
  notices.push({ t: time, kind: 'funding', text: symbol.replace('_', '') + ' 资金费 ' + toStr(change) + ' USDT' });
}
export function liquidate(state, symbol, time, notices) {
  const position = state.futures.positions[symbol], loss = -signed(position.margin);
  // 规格 7.7：整份逐仓保证金归零，强平不另收手续费，钱包与其他仓位不扣款。
  const price = liquidation(position);
  state.history.trades.unshift({ id: 'L' + ++state.seq, market: 'futures', symbol,
    side: position.side === 'long' ? 'sell' : 'buy', price: toStr(price), qty: position.qty,
    quote: toStr(mul(price, parse(position.qty), 'floor')), fee: '0', feeAsset: 'USDT', role: 'liquidation', t: time });
  ledger(state, 'liquidation', 'USDT', loss, '强制平仓', time, 'futures');
  notices.push({ t: time, kind: 'liquidated', text: symbol.replace('_', '')
    + (position.side === 'long' ? ' 多仓' : ' 空仓') + '已被强制平仓' });
  delete state.futures.positions[symbol];
}
function triggeredClose(state, symbol, trigger, time, end, spec, notices) {
  const position = state.futures.positions[symbol];
  // 规格 7.8：仓位止盈止损按触发价全部平仓，收 Taker 费。
  const order = makeFuturesOrder(state, { symbol, side: position.side === 'long' ? 'sell' : 'buy',
    type: 'market', qty: position.qty, reduceOnly: true }, position.leverage, time);
  fillFutures(state, order, parse(order.qty), mul(trigger, parse(order.qty), 'floor'), 'taker', time, spec);
  notices.push({ t: time, kind: 'tpsl', text: '止盈止损已成交，均价 ' + toStr(trigger) });
}
function markEvent(state, symbol, event, spec, notices) {
  const position = state.futures.positions[symbol];
  if (!position) return;
  // 规格 7.8：同根 K 线先资金费；收费后立即重算强平价，再检查强平。
  const fundingTime = event.rateTime ?? event.t;
  if (event.rate !== undefined && fundingTime >= position.checkFrom) {
    applyFunding(state, symbol, event.rate, event.open, fundingTime, notices);
  }
  if (event.fundingOnly || event.t < (event.point ? position.checkFrom : Math.max(position.checkFrom, position.nextCheck || 0))) return;
  const liq = liquidation(position), long = position.side === 'long';
  if ((signed(position.margin) <= 0n) || (liq > 0n && (long ? event.low <= liq : event.high >= liq))) {
    liquidate(state, symbol, event.t, notices); return;
  }
  position.liq = toStr(liq);
  // 规格 7.8：强平之后检查止损，再检查止盈；同根同时命中时止损优先。
  for (const name of ['sl', 'tp']) {
    if (!position[name]) continue;
    const trigger = parse(position[name]), below = long ? name === 'sl' : name === 'tp';
    if (below ? event.low <= trigger : event.high >= trigger) {
      triggeredClose(state, symbol, trigger, event.t, event.end, spec, notices); return;
    }
  }
}
export function processFuturesEvent(state, symbol, event, spec, notices) {
  if (event.mark) markEvent(state, symbol, event.mark, spec, notices);
  if (!event.latest) return;
  const latest = event.latest;
  const orders = state.orders.filter(order => order.market === 'futures' && order.symbol === symbol);
  // 规格 7.8：先止盈止损委托，再限价委托；每笔成交后仓位和强平价立即更新。
  orders.sort((left, right) => Number(right.type === 'stop_market') - Number(left.type === 'stop_market'));
  for (const order of orders) {
    if (latest.candle ? latest.t < order.checkFrom : latest.t <= order.checkFrom) continue;
    const trigger = parse(order.type === 'stop_market' ? order.stopPrice : order.price);
    const hit = order.type === 'stop_market' ? (order.stopDir === 'up' ? latest.high >= trigger : latest.low <= trigger)
      : order.side === 'buy' ? latest.low <= trigger : latest.high >= trigger;
    if (!hit) continue;
    if (order.type === 'stop_market') { order.triggeredAt = latest.t; order.status = 'triggered'; }
    const remaining = parse(order.qty) - parse(order.filled), role = order.type === 'stop_market' ? 'taker' : 'maker';
    fillFutures(state, order, remaining, mul(trigger, remaining, 'floor'), role, latest.t, spec);
    const position = state.futures.positions[symbol];
    // 规格 7.8：仓位变化后的标记价检查从下一根开始，首分钟的旧高低点不能强平新仓。
    if (position) position.nextCheck = latest.end;
    notices.push({ t: latest.t, kind: 'filled', text: '合约委托已成交，均价 ' + order.avgPrice });
  }
}
async function loadTrades(gate, symbol, segment) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const batch = await gate.futuresTrades(symbol, Math.floor(segment.from / 1000), Math.ceil(segment.to / 1000) - 1, offset);
    rows.push(...batch); if (batch.length < 1000) return rows;
  }
}
async function loadFunding(gate, symbol, from, to) {
  const rows = [];
  while (from <= to) {
    const batch = await gate.funding(symbol, from, to);
    rows.push(...batch);
    if (batch.length < 1000) break;
    // 规格 5.3、7.8：资金费分页只缩小已取得的时间上界，预算耗尽不会推进账户游标。
    const oldest = Math.min(...batch.map(row => Number(row.t)));
    if (oldest >= to) throw { status: 503, code: 'market_unavailable' };
    to = oldest - 1;
  }
  return rows;
}
async function segmentEvents(gate, symbol, segment, hasPosition) {
  if (segment.kind === 'trades') {
    return tradeEvents(gate, symbol, segment, hasPosition);
  }
  const from = Math.floor(segment.from / 1000), to = Math.ceil(segment.to / 1000) - 1;
  const results = await Promise.allSettled([gate.futuresCandles(symbol, segment.interval, from, to),
    gate.futuresCandles(symbol, segment.interval, from, to, true), loadFunding(gate, symbol, from, to)]);
  // 规格 5.3、5.5：真实失败优先于预算耗尽，GET 才能完整回退结算副本。
  const failures = results.filter(result => result.status === 'rejected');
  if (failures.length) throw (failures.find(result => result.reason?.code !== 'upstream_budget') || failures[0]).reason;
  const [latest, marks, funding] = results.map(result => result.value), events = new Map();
  const step = STEP[segment.interval];
  for (const [kind, rows] of [['latest', latest], ['mark', marks]]) for (const row of rows) {
    const t = Number(row.t) * 1000;
    if (t < segment.from || t >= segment.to) continue;
    const event = events.get(t) || {}; event[kind] = { t, end: t + step, candle: true,
      open: parse(row.o), high: parse(row.h), low: parse(row.l) }; events.set(t, event);
  }
  await fundingEvents(gate, symbol, segment, events, funding);
  return [...events.entries()].sort(([left], [right]) => left - right).map(([, event]) => event);
}
export function futuresTradeTime(row) {
  // 规格 7.8：Gate REST 的合约 create_time_ms 实测单位为秒，WS/固定测试也可能用毫秒。
  const value = Number(row.create_time_ms || row.create_time); return value < 1e12 ? value * 1000 : value;
}
async function tradeEvents(gate, symbol, segment, hasPosition) {
  const rows = await loadTrades(gate, symbol, segment), events = new Map();
  // 规格 7.8：没有仓位且没有逐笔成交时不会持仓，省去该段资金费查询。
  const funding = hasPosition || rows.length ? await loadFunding(gate, symbol,
    Math.floor(segment.from / 1000), Math.ceil(segment.to / 1000) - 1) : [];
  for (const row of rows) {
    const t = futuresTradeTime(row); if (t < segment.from || t >= segment.to) continue;
    const event = events.get(t) || { latest: { t, low: parse(row.price), high: parse(row.price),
      candle: false, end: Math.floor(t / 60000) * 60000 + 60000 } };
    event.latest.low = event.latest.low < parse(row.price) ? event.latest.low : parse(row.price);
    event.latest.high = event.latest.high > parse(row.price) ? event.latest.high : parse(row.price); events.set(t, event);
  }
  // 规格 7.8：首分钟跳过 mark 价格事件，资金费仍按实际持仓时刻处理，最后再点检。
  await fundingEvents(gate, symbol, segment, events, funding, true);
  return [...events.entries()].sort(([left], [right]) => left - right).map(([, event]) => event);
}
async function fundingEvents(gate, symbol, segment, events, funding, fundingOnly = false) {
  for (const rate of funding) {
    const time = Number(rate.t) * 1000; if (time < segment.from || time >= segment.to) continue;
    // 规格 7.8 实测适配：旧记录 t 可能晚 1 秒，取包含 t 的那根 1m 标记 K 线开盘价。
    const minute = Math.floor(time / 60000) * 60000, key = fundingOnly ? time : minute;
    const event = events.get(key) || {};
    if (!event.mark) {
      const rows = await gate.futuresCandles(symbol, '1m', minute / 1000, minute / 1000 + 59, true);
      const candle = rows.find(row => Number(row.t) * 1000 === minute);
      if (!candle) throw { status: 503, code: 'market_unavailable' };
      event.mark = { t: key, end: minute + 60000, open: parse(candle.o), high: parse(candle.o), low: parse(candle.o) };
    }
    Object.assign(event.mark, { rate: rate.r, rateTime: time, fundingOnly }); events.set(key, event);
  }
}
export async function settleFutures(state, gate, now, notices, plan) {
  const symbols = new Set([...Object.keys(state.futures.positions),
    ...state.orders.filter(order => order.market === 'futures').map(order => order.symbol)]);
  const queues = [...symbols].map(symbol => {
    const cursors = state.orders.filter(order => order.market === 'futures' && order.symbol === symbol).map(order => order.checkFrom);
    if (state.futures.positions[symbol]) cursors.push(state.futures.positions[symbol].checkFrom);
    const from = Math.min(...cursors);
    return { symbol, from, segments: plan(from, now), spec: null, checked: false };
  }).sort((left, right) => left.from - right.from);
  // 规格 5.3、7.8：优先最旧游标，避免多个市场持续轮询时旧积压被新尾段饿死。
  let partial = false;
  while (queues.some(queue => !queue.checked)) {
    for (const queue of queues.filter(entry => !entry.checked)) {
      try {
        queue.spec ||= await gate.contract(queue.symbol);
        if (queue.segments.length) {
          const segment = queue.segments[0], events = await segmentEvents(gate, queue.symbol, segment,
            !!state.futures.positions[queue.symbol]);
          for (const event of events) processFuturesEvent(state, queue.symbol, event, queue.spec, notices);
          const position = state.futures.positions[queue.symbol];
          if (position) position.checkFrom = Math.max(position.checkFrom, segment.to);
          for (const order of state.orders.filter(order => order.market === 'futures' && order.symbol === queue.symbol)) {
            order.checkFrom = Math.max(order.checkFrom, segment.to);
          }
          state.settledAt['perp:' + queue.symbol] = segment.to; queue.segments.shift();
        } else {
          // 规格 7.8：首个不完整分钟不使用 mark 高低价，历史补完后用当前 ticker 点检一次。
          if (state.futures.positions[queue.symbol]) {
            const ticker = await gate.futuresTicker(queue.symbol, true), mark = parse(ticker[0]?.mark_price);
            markEvent(state, queue.symbol, { t: now, end: now + 1, open: mark, high: mark, low: mark, point: true },
              queue.spec, notices);
          }
          queue.checked = true;
        }
      } catch (error) {
        if (error?.code !== 'upstream_budget') throw error;
        partial = true; queue.checked = true;
      }
    }
  }
  return partial;
}
