// 美股委托：整股、T+0、不能卖空、无涨跌停（限价 ±50% 防手误带）、佣金 0、卖出收 SEC 费与 FINRA TAF。
// 市价单只在常规时段按实时成交价（新浪；腾讯备用须同样新鲜）成交；限价单当日有效，盘外委托排入下一交易时段。
// 金额 BigInt 定点：USD 入账 floor2，出账与费用 ceil2。
import { parse, toStr, mul, div, roundTo, min } from './decimal.js';
import { ledger } from './state.js';
import { usStock } from './us-data.js';
import { usMarketStatus, nyParts, nyTime } from './us-calendar.js';
const fail = (code, status = 400) => { throw { status, code }; };
export const usdCredit = value => roundTo(value, 2, 'floor');
export const usdDebit = value => roundTo(value, 2, 'ceil');
export const SEC_RATE = parse('0.0000278'), TAF_PER_SHARE = parse('0.000166'), TAF_MAX = parse('8.30');
export function usFees(proceeds, shares, side) {
  if (side !== 'sell' || proceeds <= 0n) return { sec: 0n, taf: 0n, total: 0n };
  const sec = usdDebit(mul(proceeds, SEC_RATE, 'ceil')), taf = min(TAF_MAX, usdDebit(mul(shares, TAF_PER_SHARE, 'ceil')));
  return { sec, taf, total: sec + taf };
}
const feeView = fees => ({ sec: toStr(fees.sec), taf: toStr(fees.taf), total: toStr(fees.total) });
function cashChange(state, field, delta) {
  const value = parse(state.usstock.cash[field]) + delta;
  if (value < 0n) fail('insufficient_balance');
  state.usstock.cash[field] = toStr(value);
}
function resizeLock(state, order, amount) {
  const delta = amount - parse(order.lock.amount);
  if (!delta) return;
  if (order.side === 'buy') { cashChange(state, 'free', -delta); cashChange(state, 'locked', delta); }
  else {
    const holding = state.usstock.holdings[order.ticker];
    if (!holding || parse(holding.available) < delta) fail('insufficient_position');
    holding.available = toStr(parse(holding.available) - delta);
  }
  order.lock.amount = toStr(amount);
}
// 成交价新鲜度：新浪数据时间 ≤ 30s，且最后成交时刻（分钟精度）≤ 3 分钟；腾讯备用为成交时间 ≤ 30s。
export function freshTrade(quote, now) {
  if (!quote || parse(quote.last) <= 0n) return false;
  if (quote.source === 'tencent') return Math.abs(now - quote.time) <= 30000;
  if (Math.abs(now - quote.time) > 30000) return false;
  const tradeMinute = sinaTradeTime(quote.regularTime, now);
  return tradeMinute != null && now - tradeMinute <= 180000 && tradeMinute <= now + 60000;
}
// 新浪“最后成交”字段，如 "Oct 14 10:15AM EDT"（美东、分钟精度、无年份）→ UTC 毫秒。
export function sinaTradeTime(text, now) {
  const match = /^([A-Z][a-z]{2}) (\d{1,2}) (\d{1,2}):(\d{2})(AM|PM) E[SD]T$/.exec(text || '');
  if (!match) return null;
  const month = 'JanFebMarAprMayJunJulAugSepOctNovDec'.indexOf(match[1]) / 3 + 1;
  if (!Number.isInteger(month) || month < 1) return null;
  const year = +nyParts(now).date.slice(0, 4), hour = (+match[3] % 12) + (match[5] === 'PM' ? 12 : 0);
  const date = `${year}-${String(month).padStart(2, '0')}-${String(match[2]).padStart(2, '0')}`;
  return nyTime(date, hour, +match[4]);
}
// 成交参考价：先新浪实时，过期/失败则腾讯（同样要新鲜）；都不可用时返回 null（市价单 503）。
export async function tradePrice(client, ticker, now) {
  try { const live = await client.realtime(ticker); if (freshTrade(live, now)) return live; }
  catch (error) { if (error?.code === 'upstream_budget') throw error; }
  try { const quote = (await client.quotes([ticker], true))[ticker]; if (freshTrade(quote, now)) return quote; }
  catch (error) { if (error?.code === 'upstream_budget') throw error; }
  return null;
}
export function validateUs(data, holding, reference) {
  const stock = usStock(data.ticker);
  if (typeof data.clientId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(data.clientId)
    || !['buy', 'sell'].includes(data.side) || !['limit', 'market'].includes(data.type)) fail('bad_request');
  if (typeof data.qty !== 'string' || !/^[1-9]\d{0,6}$/.test(data.qty)) fail('bad_qty');
  const qty = parse(data.qty);
  if (data.side === 'sell' && qty > parse(holding?.available || '0')) fail('insufficient_position');
  let price = 0n;
  if (data.type === 'limit') {
    if (typeof data.price !== 'string' || !/^\d{1,7}(\.\d{1,4})?$/.test(data.price)) fail('bad_price');
    price = parse(data.price);
    const decimals = data.price.split('.')[1]?.length || 0;
    if (price <= 0n || (price >= parse('1') && decimals > 2)) fail('bad_price');
    // 无涨跌停，但限价偏离参考价超过 ±50% 视为手误。
    if (reference > 0n && (price > mul(reference, parse('1.5'), 'ceil') || price < mul(reference, parse('0.5'), 'floor'))) {
      fail('price_out_of_band');
    }
  }
  return { stock, qty, price };
}
export function fillUs(state, order, qty, price, now) {
  const quote = mul(price, qty, 'floor'), previousQuote = parse(order.executedQuote), totalQuote = previousQuote + quote;
  const totalFees = usFees(usdCredit(totalQuote), parse(order.filled) + qty, order.side), fee = totalFees.total - parse(order.fee);
  const holding = state.usstock.holdings[order.ticker];
  if (order.side === 'buy') {
    const spent = usdDebit(quote);
    if (spent > parse(order.lock.amount)) fail('insufficient_balance');
    cashChange(state, 'locked', -spent); order.lock.amount = toStr(parse(order.lock.amount) - spent);
    const current = holding || { name: order.name, qty: '0', available: '0', cost: '0' };
    const totalQty = parse(current.qty) + qty;
    current.cost = toStr(div(mul(parse(current.cost), parse(current.qty), 'floor') + spent, totalQty, 'half'));
    current.qty = toStr(totalQty); current.available = toStr(parse(current.available) + qty);   // T+0
    state.usstock.holdings[order.ticker] = current;
  } else {
    order.lock.amount = toStr(parse(order.lock.amount) - qty);
    holding.qty = toStr(parse(holding.qty) - qty);
    cashChange(state, 'free', usdCredit(quote) - fee);
    if (holding.qty === '0') delete state.usstock.holdings[order.ticker];
  }
  order.filled = toStr(parse(order.filled) + qty); order.executedQuote = toStr(totalQuote);
  order.avgPrice = toStr(div(totalQuote, parse(order.filled), 'half')); order.fee = toStr(totalFees.total);
  order.fees = feeView(totalFees); order.updatedAt = now;
  state.history.trades.unshift({ id: order.id + '-' + now + '-' + state.history.trades.length, orderId: order.id,
    market: 'usstock', symbol: order.ticker, ticker: order.ticker, name: order.name, side: order.side, qty: toStr(qty),
    quote: toStr(quote), price: toStr(price), fee: toStr(fee), feeAsset: 'USD', t: now });
  if (fee) ledger(state, 'fee', 'USD', -fee, '美股监管费', now, 'usstock');
}
export function finishUsOrder(state, order, status, now) {
  resizeLock(state, order, 0n); order.status = status; order.updatedAt = now;
  state.orders = state.orders.filter(entry => entry.id !== order.id);
  state.history.orders.unshift(structuredClone(order));
}
export async function placeUsOrder(state, data, client, now) {
  const previous = state.clientIds.find(entry => entry.clientId === data.clientId);
  if (previous) return structuredClone(previous.result);
  usStock(data.ticker);
  if (state.orders.length >= 50) fail('too_many_orders');
  const market = usMarketStatus(now), open = market.status === 'open';
  if (data.type === 'market' && !open) fail('market_closed');
  const live = open ? await tradePrice(client, data.ticker, now) : null;
  if (data.type === 'market' && !live) fail('market_stale', 503);
  // 参考价：盘中用实时成交价；盘外用腾讯最新价（只用于 ±50% 防手误，不用于成交）。
  const reference = live ? parse(live.last) : parse((await client.quotes([data.ticker]))[data.ticker].last);
  const values = validateUs(data, state.usstock.holdings[data.ticker], reference);
  const checkFrom = open ? now : market.nextOpen, expiresAt = open ? market.closeAt : market.closeAt;
  const order = { id: 'U' + ++state.seq, clientId: data.clientId, market: 'usstock', ticker: data.ticker, symbol: data.ticker,
    name: values.stock.name, side: data.side, type: data.type, price: data.type === 'limit' ? data.price : null, qty: data.qty,
    filled: '0', executedQuote: '0', avgPrice: '0', fee: '0', feeAsset: 'USD', status: 'new',
    lock: { asset: data.side === 'buy' ? 'USD' : data.ticker, amount: '0' }, createdAt: now, updatedAt: now,
    checkFrom, expiresAt, preplaced: !open };
  // 市价或可立即成交的限价：按实时成交价全额成交（限价单获得价格改善）。
  const last = live ? parse(live.last) : 0n;
  const crosses = live && (data.type === 'market' || (data.side === 'buy' ? last <= values.price : last >= values.price));
  const lock = data.side === 'sell' ? values.qty
    : usdDebit(mul(data.type === 'market' ? last : values.price, values.qty, 'ceil'));
  if (data.side === 'buy' && lock > parse(state.usstock.cash.free)) fail('insufficient_balance');
  resizeLock(state, order, lock); state.orders.push(order);
  if (crosses) {
    fillUs(state, order, values.qty, last, now);
    finishUsOrder(state, order, 'filled', now);
  }
  const result = structuredClone(order); state.clientIds.unshift({ clientId: data.clientId, result }); return result;
}
export function cancelUsOrder(state, id, now) {
  const order = state.orders.find(entry => entry.id === id && entry.market === 'usstock');
  if (!order) throw { status: 404, code: 'order_not_found' };
  finishUsOrder(state, order, 'canceled', now);
}
