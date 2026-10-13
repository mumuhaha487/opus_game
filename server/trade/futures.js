// U 本位永续合约：逐仓、单向持仓的校验、撮合和记账。
// 规格 7.1–7.9：数量按合约乘数，行情和规格只从 Gate.io 取得。
// 合约钱包、订单冻结和逐仓保证金分开，金额以 BigInt18 运算、八位记账。
import { parse, toStr, mul, div, min, max, credit, debit } from './decimal.js';
import { marketFor } from './markets.js';
import { ledger } from './state.js';
export const MAKER = parse('0.0002'), TAKER = parse('0.0005');
const fail = (code, extra = {}) => { throw { status: 400, code, ...extra }; };
export const signed = value => value.startsWith('-') ? -parse(value.slice(1)) : parse(value);
// 规格 7.2、7.3：最大杠杆取运行时上限与 125 的较小值，默认不超过 20。
export function maxLeverage(spec) { return Math.min(125, Number(spec.leverage_max)); }
export function leverageFor(state, symbol, spec) {
  return state.futures.leverage[symbol] || Math.min(20, maxLeverage(spec));
}
export function liquidation(position) {
  const notional = mul(parse(position.entry), parse(position.qty), 'floor'), margin = signed(position.margin);
  const denominator = mul(parse(position.qty), parse('1')
    + (position.side === 'long' ? -parse(position.mmr) : parse(position.mmr)), 'floor');
  return max(0n, div(notional + (position.side === 'long' ? -margin : margin), denominator, 'half'));
}
export function pnl(position, mark) {
  return mul((mark - parse(position.entry)) * (position.side === 'long' ? 1n : -1n), parse(position.qty), 'floor');
}
export function removable(position, mark) {
  // 规格 7.7：浮亏计入可减额度，浮盈不允许移出，保留当前标记价对应的初始保证金。
  return max(0n, credit(parse(position.margin) + min(pnl(position, mark), 0n)
    - div(mul(mark, parse(position.qty), 'ceil'), parse(String(position.leverage)), 'ceil')));
}
export function priceValue(value, spec, code = 'bad_price') {
  // 规格 7.2：价格必须是 order_price_round 的正整数倍。
  let amount;
  try { amount = parse(value); } catch { fail(code); }
  if (amount <= 0n || amount % parse(spec.order_price_round)) fail(code);
  return amount;
}
function quantityValue(value, spec) {
  // 规格 7.2：数量单位为币，必须是 quanto_multiplier 的正整数倍，最少一张。
  let amount;
  try { amount = parse(value); } catch { fail('bad_qty'); }
  if (amount <= 0n || amount % parse(spec.quanto_multiplier)) fail('bad_qty');
  return amount;
}
export function validateTPSL(side, tp, sl, mark, spec) {
  // 规格 7.9：止盈止损价按服务端标记价格校验，多空方向相反，null 表示清除。
  for (const [name, value] of [['tp', tp], ['sl', sl]]) {
    if (value === null || value === undefined) continue;
    const trigger = priceValue(value, spec, 'bad_tpsl');
    const above = side === 'buy' ? name === 'tp' : name === 'sl';
    if (above ? trigger <= mark : trigger >= mark) fail('bad_tpsl');
  }
}
function walletChange(state, delta) {
  const next = signed(state.futures.wallet) + delta;
  if (next < 0n) fail('insufficient_balance');
  state.futures.wallet = toStr(next);
}
function lockChange(state, order, amount) {
  const delta = amount - parse(order.lock.amount);
  walletChange(state, -delta);
  state.futures.locked = toStr(parse(state.futures.locked) + delta); order.lock.amount = toStr(amount);
}
export function finishFuturesOrder(state, order, status, now) {
  // 规格 7.5：剩余冻结全部回钱包，只减仓委托始终没有冻结。
  lockChange(state, order, 0n); order.status = status; order.updatedAt = now;
  state.orders = state.orders.filter(entry => entry.id !== order.id);
  state.history.orders.unshift(structuredClone(order));
}
export function futuresMatch(book, side, qty, multiplier, limit = 0n) {
  const levels = [...(side === 'buy' ? book.asks : book.bids) || []].map(level => Array.isArray(level)
    ? [String(level[0]), String(level[1])] : [level.p, String(Math.abs(Number(level.s)))]);
  levels.sort((left, right) => Number(left[0]) - Number(right[0])); if (side === 'sell') levels.reverse();
  let filled = 0n, quote = 0n;
  // 规格 7.2、7.9：盘口张数转为币，逐档吃单，限价只吃限价内的档位。
  for (const [value, size] of levels) {
    const price = parse(value);
    if (limit && (side === 'buy' ? price > limit : price < limit)) break;
    const available = mul(parse(size), multiplier, 'floor');
    const take = min(qty - filled, available) / multiplier * multiplier;
    if (take <= 0n) continue;
    filled += take; quote += mul(price, take, 'floor');
    if (filled === qty) break;
  }
  return { filled, quote, average: filled ? div(quote, filled, 'half') : 0n };
}
function positionAfterFill(state, order, filled, price, now, spec) {
  let position = state.futures.positions[order.symbol], remaining = filled, realizedPnl = 0n;
  const direction = order.side === 'buy' ? 'long' : 'short';
  if (position && position.side !== direction) {
    // 规格 7.6：反向先平旧仓，按比例释放保证金并将已实现盈亏记回钱包。
    const oldQty = parse(position.qty), closed = min(oldQty, filled);
    const released = closed === oldQty ? parse(position.margin)
      : credit(div(mul(parse(position.margin), closed, 'floor'), oldQty, 'floor'));
    const difference = (price - parse(position.entry)) * (position.side === 'long' ? 1n : -1n);
    const realized = credit(mul(difference, closed, 'floor'));
    realizedPnl = realized;
    walletChange(state, released + realized); ledger(state, 'realized_pnl', 'USDT', realized, '已实现盈亏', now, 'futures');
    position.margin = toStr(parse(position.margin) - released); position.qty = toStr(oldQty - closed); remaining -= closed;
    if (closed === oldQty) { delete state.futures.positions[order.symbol]; position = null; }
  }
  if (remaining) {
    const totalQty = (position ? parse(position.qty) : 0n) + remaining;
    // 规格 7.2：单仓持仓价值不得超过运行时 risk_limit_base。
    if (mul(price, totalQty, 'ceil') > parse(spec.risk_limit_base)) fail('max_position', { maximum: spec.risk_limit_base });
    const addedMargin = debit(div(mul(price, remaining, 'ceil'), parse(String(order.leverage)), 'ceil'));
    walletChange(state, -addedMargin);
    if (position) {
      // 规格 7.6：同向加仓按成交数量加权均价，逐仓保证金累加。
      position.entry = toStr(div(mul(parse(position.entry), parse(position.qty), 'floor')
        + mul(price, remaining, 'floor'), totalQty, 'half'));
      position.qty = toStr(totalQty); position.margin = toStr(parse(position.margin) + addedMargin);
    } else position = { side: direction, qty: toStr(remaining), entry: toStr(price), margin: toStr(addedMargin),
      leverage: order.leverage, mmr: spec.maintenance_rate, tp: null, sl: null, openedAt: now, checkFrom: now };
    state.futures.positions[order.symbol] = position;
    if (order.tp !== null) position.tp = order.tp; if (order.sl !== null) position.sl = order.sl;
  }
  if (position) { position.checkFrom = now; position.updatedAt = now; position.liq = toStr(liquidation(position)); }
  return realizedPnl;
}
export function fillFutures(state, order, quantity, quote, role, now, spec) {
  const position = state.futures.positions[order.symbol];
  // 规格 7.5、7.6：只减仓成交截断到实际仓位，方向不符则取消，绝不反手开仓。
  if (order.reduceOnly) {
    if (!position || (position.side === 'long') === (order.side === 'buy')) {
      finishFuturesOrder(state, order, 'canceled', now); return;
    }
    const reduced = min(quantity, parse(position.qty));
    quote = mul(div(quote, quantity, 'half'), reduced, 'floor'); quantity = reduced;
  }
  const oldRemaining = parse(order.qty) - parse(order.filled), oldLock = parse(order.lock.amount);
  const release = quantity === oldRemaining ? oldLock : credit(div(mul(oldLock, quantity, 'floor'), oldRemaining, 'floor'));
  lockChange(state, order, oldLock - release);
  const average = div(quote, quantity, 'half');
  const realizedPnl = positionAfterFill(state, order, quantity, average, now, spec);
  // 规格 7.4、5.2：Maker 0.02%、Taker 0.05%，手续费 ceil8，从钱包扣。
  const fee = debit(mul(quote, role === 'maker' ? MAKER : TAKER, 'ceil')); walletChange(state, -fee);
  const filled = parse(order.filled) + quantity, totalQuote = parse(order.executedQuote) + quote;
  order.filled = toStr(filled); order.executedQuote = toStr(totalQuote); order.avgPrice = toStr(div(totalQuote, filled, 'half'));
  order.fee = toStr(parse(order.fee) + fee); order.updatedAt = now;
  state.history.trades.unshift({ id: order.id + '-' + now + '-' + state.seq, orderId: order.id, market: 'futures',
    symbol: order.symbol, side: order.side, qty: toStr(quantity), price: toStr(average), quote: toStr(quote),
    fee: toStr(fee), feeAsset: 'USDT', role, realizedPnl: toStr(realizedPnl), t: now });
  ledger(state, 'fee', 'USDT', -fee, '手续费', now, 'futures');
  if (filled === parse(order.qty)) finishFuturesOrder(state, order, 'filled', now);
  else if (order.reduceOnly && !state.futures.positions[order.symbol]) finishFuturesOrder(state, order, 'partial_canceled', now);
}
export function makeFuturesOrder(state, data, leverage, now) {
  return { id: 'F' + ++state.seq, clientId: data.clientId, market: 'futures', symbol: data.symbol,
    side: data.side, type: data.type, price: data.price || null, stopPrice: data.stopPrice || null, stopDir: null,
    qty: data.qty, quoteQty: null, filled: '0', executedQuote: '0', avgPrice: '0', fee: '0', feeAsset: 'USDT', status: 'new',
    reduceOnly: data.reduceOnly || false, tp: data.tp ?? null, sl: data.sl ?? null, leverage,
    lock: { asset: 'USDT', amount: '0' }, createdAt: now, triggeredAt: null, updatedAt: now, checkFrom: now };
}
async function orderValues(state, data, gate) {
  marketFor(data.symbol);
  if (typeof data.clientId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(data.clientId)) fail('bad_request');
  if (!['buy', 'sell'].includes(data.side) || !['limit', 'market', 'stop_market'].includes(data.type)) fail('bad_request');
  if (data.reduceOnly !== undefined && typeof data.reduceOnly !== 'boolean') fail('bad_request');
  const spec = await gate.contract(data.symbol), qty = quantityValue(data.qty, spec);
  const price = data.type === 'limit' ? priceValue(data.price, spec) : data.type === 'stop_market'
    ? priceValue(data.stopPrice, spec) : 0n;
  const position = state.futures.positions[data.symbol];
  if (data.reduceOnly && (!position || (position.side === 'long') === (data.side === 'buy'))) fail('reduce_only');
  const ticker = await gate.futuresTicker(data.symbol);
  validateTPSL(data.side, data.tp, data.sl, parse(ticker[0]?.mark_price), spec);
  return { spec, qty, price, ticker: ticker[0] };
}
export async function placeFuturesOrder(state, data, gate, now) {
  const previous = state.clientIds.find(entry => entry.clientId === data.clientId);
  if (previous) return structuredClone(previous.result);
  const { spec, qty, price, ticker } = await orderValues(state, data, gate);
  if (state.orders.length >= 50) fail('too_many_orders');
  const order = makeFuturesOrder(state, data, leverageFor(state, data.symbol, spec), now);
  const match = data.type === 'stop_market' ? null : futuresMatch(await gate.futuresBook(data.symbol), data.side,
    qty, parse(spec.quanto_multiplier), price);
  if (data.type === 'market' && !match.filled) fail('no_liquidity');
  const estimate = data.type === 'market' ? match.average : price;
  const notional = mul(estimate, qty, 'ceil');
  if (!data.reduceOnly && notional > parse(spec.risk_limit_base)) fail('max_position', { maximum: spec.risk_limit_base });
  // 规格 7.5：整笔委托冻结名义/杠杆加 Taker 费，市价按盘口估算价。
  if (!order.reduceOnly) lockChange(state, order, debit(div(notional, parse(String(order.leverage)), 'ceil')
    + mul(notional, TAKER, 'ceil')));
  state.orders.push(order);
  if (data.type === 'stop_market') order.stopDir = price > parse(ticker.last) ? 'up' : 'down';
  else if (match.filled) fillFutures(state, order, match.filled, match.quote, 'taker', now, spec);
  if (data.type === 'market' && state.orders.includes(order)) finishFuturesOrder(state, order, 'partial_canceled', now);
  const result = structuredClone(order); state.clientIds.unshift({ clientId: data.clientId, result }); return result;
}
export function cancelFuturesOrder(state, id, now) {
  const order = state.orders.find(entry => entry.market === 'futures' && entry.id === id);
  if (!order) throw { status: 404, code: 'order_not_found' };
  finishFuturesOrder(state, order, 'canceled', now);
}
export async function changeLeverage(state, data, gate) {
  marketFor(data.symbol); const spec = await gate.contract(data.symbol);
  if (!Number.isInteger(data.leverage) || data.leverage < 1 || data.leverage > maxLeverage(spec)) fail('bad_request');
  // 规格 7.3：有该合约仓位或委托时锁定杠杆。
  if (state.futures.positions[data.symbol] || state.orders.some(order => order.market === 'futures' && order.symbol === data.symbol)) {
    fail('leverage_locked');
  }
  state.futures.leverage[data.symbol] = data.leverage;
}
function positionFor(state, symbol) {
  marketFor(symbol); const position = state.futures.positions[symbol];
  if (!position) throw { status: 404, code: 'position_not_found' }; return position;
}
export async function closeFutures(state, data, gate, now) {
  const position = positionFor(state, data.symbol);
  if (!['market', 'limit'].includes(data.type)) fail('bad_request');
  return placeFuturesOrder(state, { symbol: data.symbol, clientId: data.clientId || crypto.randomUUID(),
    side: position.side === 'long' ? 'sell' : 'buy', type: data.type, price: data.price,
    qty: data.qty ?? position.qty, reduceOnly: true }, gate, now);
}
export async function changeTPSL(state, data, gate, now) {
  const position = positionFor(state, data.symbol), spec = await gate.contract(data.symbol);
  if (data.tp === undefined || data.sl === undefined) fail('bad_request');
  const ticker = await gate.futuresTicker(data.symbol);
  validateTPSL(position.side === 'long' ? 'buy' : 'sell', data.tp, data.sl, parse(ticker[0]?.mark_price), spec);
  position.tp = data.tp; position.sl = data.sl; position.updatedAt = now;
}
export async function changeMargin(state, data, gate, now) {
  const position = positionFor(state, data.symbol), amount = parse(data.amount);
  if (!['add', 'remove'].includes(data.action) || amount <= 0n || credit(amount) !== amount) fail('bad_request');
  const ticker = await gate.futuresTicker(data.symbol), mark = parse(ticker[0]?.mark_price);
  if (data.action === 'remove' && amount > removable(position, mark)) fail('margin_limit');
  const delta = data.action === 'add' ? amount : -amount;
  walletChange(state, -delta); position.margin = toStr(parse(position.margin) + delta);
  position.liq = toStr(liquidation(position));
  position.updatedAt = now;
  ledger(state, data.action === 'add' ? 'margin_add' : 'margin_remove', 'USDT', delta,
    data.action === 'add' ? '增加保证金' : '减少保证金', now, 'futures');
}
