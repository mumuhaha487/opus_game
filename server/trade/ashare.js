// ASHARE §2–§4：A 股委托冻结、五档吃单、成交费用和持仓记账。
// 买入形成按交易日标记的 T+1 批次，卖出只冻结可卖数量。
// 手续费按整笔委托累计计算，部分成交不会重复收最低佣金。
import { parse, toStr, mul, div, min } from './decimal.js';
import { ledger } from './state.js';
import { dayKey } from '../likes.js';
import { marketStatus, validateAshare, feesFor, feeView, cnyCredit, cnyDebit, dayTime, unlockHoldings } from './ashare-rules.js';
const fail = code => { throw { status: 400, code }; };
function cashChange(state, field, delta) {
  const value = parse(state.ashare.cash[field]) + delta;
  if (value < 0n) fail('insufficient_balance');
  state.ashare.cash[field] = toStr(value);
}
function resizeLock(state, order, amount) {
  const delta = amount - parse(order.lock.amount);
  if (!delta) return;
  if (order.side === 'buy') {
    cashChange(state, 'free', -delta); cashChange(state, 'locked', delta);
  } else {
    const holding = state.ashare.holdings[order.code];
    if (!holding || parse(holding.available) < delta) fail('t_plus_one');
    holding.available = toStr(parse(holding.available) - delta);
  }
  order.lock.amount = toStr(amount);
}
export function finishAshareOrder(state, order, status, now) {
  // ASHARE §2、§3.3：撤销、收盘过期及终态均解冻剩余现金或可卖股票。
  resizeLock(state, order, 0n); order.status = status; order.updatedAt = now;
  state.orders = state.orders.filter(entry => entry.id !== order.id);
  state.history.orders.unshift(structuredClone(order));
}
export function matchAshare(quote, side, qty, limit = 0n, budget = null) {
  const levels = [...(side === 'buy' ? quote.asks : quote.bids)];
  levels.sort((left, right) => Number(left[0]) - Number(right[0]));
  if (side === 'sell') levels.reverse();
  let filled = 0n, executedQuote = 0n;
  // ASHARE §3.1：五档手数乘 100 变成股数，限价只吃委托价格范围内的档位。
  for (const [priceText, sizeText] of levels) {
    const price = parse(priceText), available = mul(parse(sizeText), parse('100'), 'floor');
    if (!price || !available) continue;
    if (limit && (side === 'buy' ? price > limit : price < limit)) break;
    let take = min(qty - filled, available) / parse('1') * parse('1');
    if (budget !== null) {
      // ASHARE §3.1：买入资金不足时，按已吃到的数量减量，现金始终含费用且不透支。
      let lower = 0n, upper = take / parse('1');
      while (lower < upper) {
        const middle = (lower + upper + 1n) / 2n;
        const estimated = executedQuote + mul(price, middle * parse('1'), 'ceil');
        if (cnyDebit(estimated) + feesFor(estimated, side).total <= budget) lower = middle;
        else upper = middle - 1n;
      }
      take = lower * parse('1');
    }
    if (take > 0n) { filled += take; executedQuote += mul(price, take, 'floor'); }
    if (filled === qty) break;
  }
  return { filled, quote: executedQuote };
}
export function fillAshare(state, order, qty, quote, now) {
  const previousQuote = parse(order.executedQuote), totalQuote = previousQuote + quote;
  const totalFees = feesFor(totalQuote, order.side), fee = totalFees.total - parse(order.fee);
  const holding = state.ashare.holdings[order.code];
  // ASHARE §2、§3.4：买入出账 ceil2，成本含费用，按数量加权；新买入当天不可卖。
  if (order.side === 'buy') {
    const spent = cnyDebit(quote) + fee;
    if (spent > parse(order.lock.amount)) fail('insufficient_balance');
    cashChange(state, 'locked', -spent); order.lock.amount = toStr(parse(order.lock.amount) - spent);
    const current = holding || { name: order.name, qty: '0', available: '0', cost: '0', buys: [] };
    const totalQty = parse(current.qty) + qty;
    current.cost = toStr(div(mul(parse(current.cost), parse(current.qty), 'floor') + spent, totalQty, 'half'));
    current.qty = toStr(totalQty); current.buys.push({ date: dayKey(now), qty: toStr(qty) });
    state.ashare.holdings[order.code] = current;
  } else {
    // ASHARE §2：已冻结可卖股数消耗；卖出净入账 floor2，印花税仅卖方承担。
    order.lock.amount = toStr(parse(order.lock.amount) - qty);
    holding.qty = toStr(parse(holding.qty) - qty);
    cashChange(state, 'free', cnyCredit(quote) - fee);
    if (holding.qty === '0') delete state.ashare.holdings[order.code];
  }
  order.filled = toStr(parse(order.filled) + qty); order.executedQuote = toStr(totalQuote);
  order.avgPrice = toStr(div(totalQuote, parse(order.filled), 'half')); order.fee = toStr(totalFees.total);
  order.fees = feeView(totalFees); order.updatedAt = now;
  state.history.trades.unshift({ id: order.id + '-' + now + '-' + state.history.trades.length,
    orderId: order.id, market: 'ashare', symbol: order.code, code: order.code, name: order.name, side: order.side,
    qty: toStr(qty), quote: toStr(quote), price: toStr(div(quote, qty, 'half')), fee: toStr(fee), feeAsset: 'CNY', t: now });
  ledger(state, 'fee', 'CNY', -fee, 'A 股交易费用', now, 'ashare');
}
function createAshareOrder(state, data, quote, market, now) {
  const checkFrom = market.status === 'open' ? now : market.nextOpen;
  return { id: 'A' + ++state.seq, clientId: data.clientId, market: 'ashare', code: data.code, symbol: data.code,
    name: quote.name, side: data.side, type: data.type, price: data.type === 'limit' ? data.price : null, qty: data.qty,
    filled: '0', executedQuote: '0', avgPrice: '0', fee: '0', feeAsset: 'CNY', status: 'new',
    lock: { asset: data.side === 'buy' ? 'CNY' : data.code, amount: '0' }, createdAt: now, updatedAt: now,
    checkFrom, expiresAt: dayTime(dayKey(checkFrom), 15), preplaced: market.status !== 'open' };
}
function remainingLock(order) {
  const remaining = parse(order.qty) - parse(order.filled);
  if (order.side === 'sell') return remaining;
  const quote = mul(parse(order.price), remaining, 'ceil');
  return cnyDebit(quote) + feesFor(parse(order.executedQuote) + quote, 'buy').total - parse(order.fee);
}
export async function placeAshareOrder(state, data, client, now) {
  const previous = state.clientIds.find(entry => entry.clientId === data.clientId);
  if (previous) return structuredClone(previous.result);
  const quotes = await client.quotes([data.code, 'sh000001']), quote = quotes[data.code], index = quotes.sh000001;
  unlockHoldings(state, index, now);
  const values = validateAshare(data, quote, state.ashare.holdings[data.code]), market = marketStatus(now, index);
  if (state.orders.length >= 50) fail('too_many_orders');
  if (data.type === 'market' && market.status !== 'open') fail('market_closed');
  if (data.type === 'market' && quote.suspended) fail('suspended');
  // PLATFORM §5.2.2：市价拒绝旧报价；限价保留挂单意图，旧盘口不能立即成交。
  const fresh = Math.abs(now - quote.time) <= 30000;
  if (data.type === 'market' && !fresh) throw { status: 503, code: 'market_stale' };
  const order = createAshareOrder(state, data, quote, market, now);
  const matching = market.status === 'open' && !quote.suspended && fresh;
  const estimate = data.type === 'limit' ? mul(values.price, values.qty, 'ceil') : 0n;
  const match = matching ? matchAshare(quote, data.side, values.qty, values.price,
    data.type === 'market' && data.side === 'buy' ? parse(state.ashare.cash.free) : null) : { filled: 0n, quote: 0n };
  if (data.type === 'market' && !match.filled) {
    if (matchAshare(quote, data.side, values.qty).filled) fail('insufficient_balance');
    fail('no_liquidity');
  }
  // ASHARE §3.1–2：限价冻结全量价格与费用上限，市价按可信盘口估算冻结。
  const lock = data.side === 'sell' ? (data.type === 'market' ? match.filled : values.qty)
    : cnyDebit(data.type === 'limit' ? estimate : match.quote) + feesFor(data.type === 'limit' ? estimate : match.quote, 'buy').total;
  resizeLock(state, order, lock); state.orders.push(order);
  if (match.filled) fillAshare(state, order, match.filled, match.quote, now);
  if (data.type === 'market') finishAshareOrder(state, order, match.filled === values.qty ? 'filled' : 'partial_canceled', now);
  else if (match.filled === values.qty) finishAshareOrder(state, order, 'filled', now);
  else resizeLock(state, order, remainingLock(order));
  state.ashare.marketTime = index.time;
  const result = structuredClone(order); state.clientIds.unshift({ clientId: data.clientId, result }); return result;
}
export function cancelAshareOrder(state, id, now) {
  const order = state.orders.find(entry => entry.id === id && entry.market === 'ashare');
  if (!order) throw { status: 404, code: 'order_not_found' };
  finishAshareOrder(state, order, 'canceled', now);
}
