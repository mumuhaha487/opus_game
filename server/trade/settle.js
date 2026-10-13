// 现货委托的惰性结算，按下单后的真实成交与完整 K 线判断。
// 规格 6.5：首尾不完整分钟用逐笔；历史分 1m / 1h / 1d。
// 预算耗尽保留精确进度，下一次 state 接着处理，避免漏结算。
import { parse, mul } from './decimal.js';
import { applyFill, completeOrder } from './spot.js';
const MINUTE = 60000, HOUR = 3600000, DAY = 86400000;
export function settlementPlan(from, now) {
  const plan = [];
  let cursor = from;
  const fullEnd = Math.floor(now / MINUTE) * MINUTE;
  const headEnd = Math.min(now, Math.ceil(from / MINUTE) * MINUTE);
  if (headEnd > cursor) { plan.push({ kind: 'trades', from: cursor, to: headEnd }); cursor = headEnd; }
  // 规格 6.5.2：最后 900 分钟用 1m，超 1000 小时的最早部分用 1d。
  const minuteStart = now - from <= 1000 * MINUTE ? cursor : Math.floor((now - 900 * MINUTE) / HOUR) * HOUR;
  const dayEnd = Math.floor((now - 1000 * HOUR) / DAY) * DAY;
  while (cursor < fullEnd) {
    let step = MINUTE, interval = '1m', boundary = fullEnd;
    if (cursor < minuteStart && cursor % HOUR === 0) {
      step = HOUR; interval = '1h'; boundary = minuteStart;
      if (cursor < dayEnd && cursor % DAY === 0) { step = DAY; interval = '1d'; boundary = dayEnd; }
      else if (cursor < dayEnd) boundary = Math.min(boundary, Math.ceil((cursor + 1) / DAY) * DAY);
    } else if (cursor < minuteStart) boundary = Math.min(minuteStart, Math.ceil((cursor + 1) / HOUR) * HOUR);
    const end = Math.min(fullEnd, boundary, cursor + step * 1000);
    plan.push({ kind: 'candles', interval, from: cursor, to: end }); cursor = end;
  }
  if (cursor < now) plan.push({ kind: 'trades', from: cursor, to: now });
  return plan;
}
async function loadSegment(gate, symbol, segment) {
  const from = Math.floor(segment.from / 1000), to = Math.ceil(segment.to / 1000) - 1;
  if (segment.kind === 'candles') return gate.candles(symbol, segment.interval, from, to);
  const rows = [];
  for (let page = 1; ; page++) {
    const batch = await gate.trades(symbol, from, to, page);
    rows.push(...batch);
    if (batch.length < 1000) return rows;
  }
}
function eventsFor(segment, rows) {
  if (segment.kind === 'trades') return rows.map(trade => ({
    t: Number(trade.create_time_ms || Number(trade.create_time) * 1000),
    low: parse(trade.price), high: parse(trade.price), candle: false,
  })).filter(event => event.t >= segment.from && event.t < segment.to).sort((left, right) => left.t - right.t);
  return rows.map(candle => ({ t: Number(candle[0]) * 1000, low: parse(candle[4]), high: parse(candle[3]), candle: true }))
    .filter(event => event.t >= segment.from && event.t < segment.to).sort((left, right) => left.t - right.t);
}
function fillRemainder(state, order, price, role, time, notices) {
  // 规格 6.4：挂单命中后按限价全部成交；规格 6.6：可成交止盈止损按触发价成交。
  const remaining = parse(order.qty) - parse(order.filled);
  applyFill(state, order, remaining, mul(price, remaining, 'floor'), role, time);
  completeOrder(state, order, 'filled', time);
  notices.push({ t: time, kind: 'filled', text: '已成交 ' + order.filled + ' ' + order.symbol.split('_')[0]
    + '，均价 ' + order.avgPrice });
}
export function processEvent(state, order, event, notices) {
  if (!event.candle && event.t <= order.checkFrom) return;
  if (event.candle && event.t < order.checkFrom) return;
  if (order.type === 'stop_limit' && order.status === 'new') {
    const trigger = parse(order.stopPrice);
    if (order.stopDir === 'up' ? event.high < trigger : event.low > trigger) return;
    // 规格 6.5.3、6.6：先触发；限价可成交时立即用触发价按 Taker 成交。
    order.status = 'triggered'; order.triggeredAt = event.t; order.updatedAt = event.t;
    const limitPrice = parse(order.price);
    if (order.side === 'buy' ? limitPrice >= trigger : limitPrice <= trigger) {
      fillRemainder(state, order, trigger, 'taker', event.t, notices);
    } else {
      // 规格 6.5.5：触发后的挂单从下一根 K 线起判断。
      order.checkFrom = event.t + (event.candle ? 1 : 0);
      notices.push({ t: event.t, kind: 'triggered', text: '委托已提交' });
    }
    return;
  }
  const limitPrice = parse(order.price);
  if (order.side === 'buy' ? event.low <= limitPrice : event.high >= limitPrice) {
    // 规格 6.5.4：使用命中的 K 线开盘时间或逐笔成交时间，不使用请求时间。
    fillRemainder(state, order, limitPrice, 'maker', event.t, notices);
  }
}
async function settleOrder(state, order, gate, now, notices) {
  const segments = settlementPlan(order.checkFrom, now);
  // 规格 5.3：同一交易对的不同时间序列并发拉取，随后严格按时间顺序处理。
  const results = await Promise.allSettled(segments.map(segment => loadSegment(gate, order.symbol, segment)));
  for (let i = 0; i < segments.length; i++) {
    const result = results[i], segment = segments[i];
    if (result.status === 'rejected') {
      if (result.reason?.code === 'upstream_budget') return true;
      throw result.reason;
    }
    for (const event of eventsFor(segment, result.value)) {
      processEvent(state, order, event, notices);
      if (order.status === 'filled') return false;
    }
    order.checkFrom = segment.to;
  }
  return false;
}
export async function settle(state, gate, now, force = false) {
  const notices = [];
  // 本轮验收修正规格 6.5：无当前委托、无仓位时完全保留 state，避免轮询重写 R2。
  if (!state.orders.length && !Object.keys(state.futures.positions).length) return { partial: false, notices };
  if (!force && now - (state.lastSettlement || 0) < 2000) return { partial: false, notices };
  let partial = false;
  const symbols = new Set(state.orders.filter(order => order.market === 'spot').map(order => order.symbol));
  for (const symbol of symbols) {
    const orders = state.orders.filter(order => order.market === 'spot' && order.symbol === symbol);
    for (const order of orders) partial = await settleOrder(state, order, gate, now, notices) || partial;
    const pending = state.orders.filter(order => order.symbol === symbol && order.market === 'spot');
    // 规格 6.5.6、5.3：完整结算记 now，部分结算只记录确实处理到的游标。
    state.settledAt['spot:' + symbol] = pending.length ? Math.min(...pending.map(order => order.checkFrom)) : now;
  }
  state.lastSettlement = partial ? 0 : now;
  return { partial, notices };
}
