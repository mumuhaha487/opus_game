// 现货参数校验、盘口吃单、记账与撤单。
// Worker 只采用 Gate.io 价格；clientId 在账户条件写内去重。
// 关键规则对应规格第 5.2、6.1–6.7 节。
import { parse, toStr, mul, div, min, roundTo, credit, debit } from './decimal.js';
import { marketFor } from './markets.js';
import { balance, adjustBalance, moveLock, ledger } from './state.js';
import { assertBookFresh } from './gate.js';
export const FEE_RATE = parse('0.001');
const failure = code => { throw { status: 400, code }; };
function checkedDecimal(value, decimals, code) {
  let parsed;
  try { parsed = parse(value); } catch { failure(code); }
  if (parsed <= 0n || (value.split('.')[1]?.length || 0) > decimals) failure(code);
  return parsed;
}
export function validateOrder(data, specification) {
  marketFor(data.symbol);
  if (typeof data.clientId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(data.clientId)) failure('bad_request');
  if (!['buy', 'sell'].includes(data.side) || !['limit', 'market', 'stop_limit'].includes(data.type)) failure('bad_request');
  const quoteOrder = data.type === 'market' && data.side === 'buy' && data.quoteQty !== undefined;
  if (quoteOrder && data.qty !== undefined) failure('bad_request');
  if (!quoteOrder && data.quoteQty !== undefined) failure('bad_request');
  const qty = quoteOrder ? 0n : checkedDecimal(data.qty, Number(specification.amount_precision), 'bad_qty');
  if (!quoteOrder && qty < parse(specification.min_base_amount || '0')) failure('bad_qty');
  const quoteQty = quoteOrder ? checkedDecimal(data.quoteQty, 8, 'bad_request') : 0n;
  const price = data.type === 'market' ? 0n : checkedDecimal(data.price, Number(specification.precision), 'bad_price');
  if (data.type === 'stop_limit') checkedDecimal(data.stopPrice, Number(specification.precision), 'bad_price');
  return { qty, quoteQty, price, quoteOrder };
}
export function eatBook(book, side, qty, quoteQty, decimals, limitPrice = 0n) {
  const levels = [...(side === 'buy' ? book.asks : book.bids) || []];
  levels.sort((left, right) => Number(left[0]) - Number(right[0]));
  if (side === 'sell') levels.reverse();
  let filled = 0n, quote = 0n;
  const quantityStep = 10n ** BigInt(18 - decimals);
  // 规格 6.3、6.4：买 asks、卖 bids，限价单只吃限价范围内的档位。
  for (const level of levels) {
    const price = parse(String(level[0])), available = parse(String(level[1]));
    if (!price || !available) continue;
    if (limitPrice && (side === 'buy' ? price > limitPrice : price < limitPrice)) break;
    const remaining = quoteQty ? div(quoteQty - quote, price, 'floor') : qty - filled;
    const take = roundTo(min(remaining, available), decimals, 'floor');
    if (take <= 0n) continue;
    filled += take;
    quote += mul(price, take, 'floor');
    if (quoteQty ? quoteQty - quote < mul(price, quantityStep, 'ceil')
      : filled >= qty) break;
  }
  return { filled, quote, average: filled ? div(quote, filled, 'half') : 0n };
}
export function completeOrder(state, order, status, now) {
  // 规格 6.4、6.7：剩余冻结全部退回，终态委托从当前列表移到历史。
  const locked = parse(order.lock.amount);
  if (locked) moveLock(state, order.lock.asset, locked, false);
  order.lock.amount = '0'; order.status = status; order.updatedAt = now;
  state.orders = state.orders.filter(entry => entry.id !== order.id);
  state.history.orders.unshift(structuredClone(order));
}
export function applyFill(state, order, filled, quote, role, now) {
  const coin = marketFor(order.symbol).coin, buy = order.side === 'buy';
  // 规格 5.2、6.2：入账 floor8，出账/手续费 ceil8；买扣币费，卖扣 USDT 费。
  const fee = debit(mul(buy ? filled : quote, FEE_RATE, 'ceil'));
  const spent = debit(buy ? quote : filled), received = credit(buy ? filled : quote);
  const currentLock = parse(order.lock.amount);
  if (currentLock) {
    if (currentLock < spent) failure('insufficient_balance');
    adjustBalance(state, order.lock.asset, 'locked', -spent);
    order.lock.amount = toStr(currentLock - spent);
  } else adjustBalance(state, buy ? 'USDT' : coin, 'free', -spent);
  adjustBalance(state, buy ? coin : 'USDT', 'free', received - fee);
  const oldFilled = parse(order.filled), oldQuote = order.executedQuote ? parse(order.executedQuote) : 0n;
  order.filled = toStr(oldFilled + filled); order.executedQuote = toStr(oldQuote + quote);
  order.avgPrice = toStr(div(oldQuote + quote, oldFilled + filled, 'half'));
  order.fee = toStr(parse(order.fee) + fee); order.feeAsset = buy ? coin : 'USDT'; order.updatedAt = now;
  state.history.trades.unshift({
    id: order.id + '-' + state.history.trades.length + '-' + now, orderId: order.id, market: 'spot',
    symbol: order.symbol, side: order.side, price: toStr(div(quote, filled, 'half')), qty: toStr(filled),
    quote: toStr(quote), fee: toStr(fee), feeAsset: order.feeAsset, role, t: now,
  });
  ledger(state, 'fee', order.feeAsset, -fee, '手续费', now);
}
function createOrder(state, data, now) {
  return {
    id: 'S' + ++state.seq, clientId: data.clientId, market: 'spot', symbol: data.symbol,
    side: data.side, type: data.type, price: data.price || null, stopPrice: data.stopPrice || null, stopDir: null,
    qty: data.qty || null, quoteQty: data.quoteQty || null, filled: '0', avgPrice: '0', fee: '0', feeAsset: null,
    status: 'new', reduceOnly: false, tp: null, sl: null, leverage: null,
    lock: { asset: data.side === 'buy' ? 'USDT' : marketFor(data.symbol).coin, amount: '0' },
    createdAt: now, triggeredAt: null, updatedAt: now, checkFrom: now,
  };
}
function checkNotional(amount, specification) {
  const minimum = specification.min_quote_amount || '0';
  if (amount < parse(minimum)) throw { status: 400, code: 'min_notional', minimum };
}
function freezeOrder(state, order, values) {
  // 规格 6.4、6.6：买冻结限价×数量（ceil8），卖冻结数量（ceil8）。
  const amount = debit(order.side === 'buy' ? mul(values.price, values.qty, 'ceil') : values.qty);
  moveLock(state, order.lock.asset, amount, true);
  order.lock.amount = toStr(amount);
}
export async function placeOrder(state, data, gate, now) {
  const previous = state.clientIds.find(entry => entry.clientId === data.clientId);
  if (previous) return structuredClone(previous.result);
  marketFor(data.symbol);
  const specification = await gate.spec(data.symbol), values = validateOrder(data, specification);
  if (state.orders.length >= 50) failure('too_many_orders');
  const order = createOrder(state, data, now);
  let bookSource;
  if (data.type === 'stop_limit') {
    checkNotional(mul(values.price, values.qty, 'floor'), specification);
    const tickers = await gate.ticker(data.symbol, true), latest = parse(tickers[0]?.last);
    // 规格 6.6：触发方向只依据服务端从 Gate.io 读取的最新价。
    order.stopDir = parse(data.stopPrice) > latest ? 'up' : 'down';
    freezeOrder(state, order, values); state.orders.push(order);
  } else bookSource = await placeBookOrder(state, order, values, specification, gate, now);
  const result = structuredClone(order);
  // 第五轮 WS 修复：来源只随下单结果返回，订单本体和历史记录不保存调试字段。
  if (bookSource) result.bookSource = bookSource;
  state.clientIds.unshift({ clientId: data.clientId, result });
  return result;
}
async function placeBookOrder(state, order, values, specification, gate, now) {
  // 第五轮修复 / TRADE §6.3：金额市价委托检查原始 quoteQty，数量取整不能降低委托门槛。
  if (values.quoteOrder) checkNotional(values.quoteQty, specification);
  const book = await gate.executionBook(order.symbol);
  assertBookFresh(book, Date.now());
  const match = eatBook(book, order.side, values.qty, values.quoteQty, Number(specification.amount_precision), values.price);
  if (order.type === 'limit') {
    checkNotional(mul(values.price, values.qty, 'floor'), specification);
    freezeOrder(state, order, values); state.orders.push(order);
  } else {
    if (!match.filled) {
      if (values.quoteOrder) throw { status: 400, code: 'bad_qty', quoteOrder: true };
      failure('no_liquidity');
    }
    if (!values.quoteOrder) checkNotional(match.quote, specification);
    // 规格 6.3：市价买入按吃单估算成交额 ceil8 检查可用余额。
    const required = debit(order.side === 'buy' ? match.quote : match.filled);
    if (parse(balance(state, order.lock.asset).free) < required) failure('insufficient_balance');
  }
  if (match.filled) applyFill(state, order, match.filled, match.quote, 'taker', now);
  if (order.type === 'market') {
    const tick = 10n ** BigInt(18 - Number(specification.amount_precision));
    const finished = values.quoteOrder ? values.quoteQty - match.quote < mul(match.average, tick, 'ceil') : match.filled === values.qty;
    // 规格 6.3：深度不足只成交可吃到的部分，余量取消。
    completeOrder(state, order, finished ? 'filled' : 'partial_canceled', now);
  } else if (match.filled === values.qty) completeOrder(state, order, 'filled', now);
  return book.bookSource;
}
export function cancelOrder(state, id, now) {
  const order = state.orders.find(entry => entry.id === id && entry.market === 'spot');
  if (!order) throw { status: 404, code: 'order_not_found' };
  completeOrder(state, order, 'canceled', now);
}
export function cancelAll(state, symbol, now) {
  if (symbol !== undefined) marketFor(symbol);
  const orders = state.orders.filter(order => order.market === 'spot' && (!symbol || order.symbol === symbol));
  for (const order of orders) completeOrder(state, order, 'canceled', now);
}
