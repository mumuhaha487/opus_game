// ASHARE §2：北京时间交易时段、涨跌停、手数、T+1 及费用。
// 所有金额使用 BigInt，CNY 入账 floor2、出账与费用 ceil2。
// 股票类型依据腾讯字段 61，工作日是否开市依据上证指数报价日期。
import { parse, toStr, mul, max, roundTo } from './decimal.js';
import { dayKey } from '../likes.js';
import { validateCode } from './ashare-data.js';
export const cnyCredit = value => roundTo(value, 2, 'floor');
export const cnyDebit = value => roundTo(value, 2, 'ceil');
export const dayTime = (date, hour, minute = 0) => Date.parse(date + 'T'
  + String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0') + ':00+08:00');
function weekday(time) { return ![0, 6].includes(new Date(time + 28800000).getUTCDay()); }
export function nextWeekdayOpen(now) {
  let day = dayKey(now), candidate = dayTime(day, 9, 30);
  while (candidate <= now || !weekday(candidate)) {
    day = dayKey(candidate + 86400000); candidate = dayTime(day, 9, 30);
  }
  return candidate;
}
export function marketStatus(now, index) {
  const date = dayKey(now), morning = dayTime(date, 9, 30), lunch = dayTime(date, 11, 30);
  const afternoon = dayTime(date, 13), close = dayTime(date, 15);
  // ASHARE §2：时段内以指数日期确认真实交易日，周末全天休市。
  const holiday = !weekday(now) || (now >= morning && now < close && dayKey(index.time) !== date);
  const status = holiday ? 'holiday' : now >= morning && now < lunch || now >= afternoon && now < close ? 'open'
    : now >= lunch && now < afternoon ? 'lunch' : 'closed';
  const nextOpen = status === 'open' ? null : status === 'lunch' ? afternoon
    : !holiday && now < morning ? morning : nextWeekdayOpen(now);
  return { status, nextOpen };
}
export function feesFor(quote, side) {
  // ASHARE §2：佣金单笔最低 5 元，过户费双边，印花税仅卖出，分别向上取到分。
  if (quote <= 0n) return { commission: 0n, transferFee: 0n, stamp: 0n, total: 0n };
  const commission = max(parse('5'), cnyDebit(mul(quote, parse('0.00025'), 'ceil')));
  const transferFee = cnyDebit(mul(quote, parse('0.00001'), 'ceil'));
  const stamp = side === 'sell' ? cnyDebit(mul(quote, parse('0.0005'), 'ceil')) : 0n;
  return { commission, transferFee, stamp, total: commission + transferFee + stamp };
}
export const feeView = fees => Object.fromEntries(Object.entries(fees).map(([name, value]) => [name, toStr(value)]));
export function validateAshare(data, quote, holding) {
  validateCode(data.code);
  if (!quote.type.startsWith('GP-A')) throw { status: 400, code: 'not_a_share' };
  if (typeof data.clientId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(data.clientId)
    || !['buy', 'sell'].includes(data.side) || !['limit', 'market'].includes(data.type)) {
    throw { status: 400, code: 'bad_request' };
  }
  if (typeof data.qty !== 'string' || !/^[1-9]\d{0,14}$/.test(data.qty)) throw { status: 400, code: 'bad_qty' };
  const qty = parse(data.qty), shares = qty / parse('1');
  const star = quote.type.startsWith('GP-A-KCB');
  // ASHARE §2：科创板买入 200 起、之后逐股；其它买入整手；卖出整手或一次清空零股。
  if (data.side === 'buy' ? star ? shares < 200n : shares % 100n !== 0n
    : shares % 100n !== 0n && data.qty !== holding?.available) throw { status: 400, code: 'lot_size' };
  if (data.side === 'sell' && qty > parse(holding?.available || '0')) throw { status: 400, code: 't_plus_one' };
  let price = 0n;
  if (data.type === 'limit') {
    try { price = parse(data.price); } catch { throw { status: 400, code: 'bad_price' }; }
    if (price <= 0n || (data.price.split('.')[1]?.length || 0) > 2) throw { status: 400, code: 'bad_price' };
    if (!quote.limitUp || !quote.limitDown || price > parse(quote.limitUp) || price < parse(quote.limitDown)) {
      throw { status: 400, code: 'price_out_of_limit' };
    }
  }
  return { qty, price };
}
export function unlockHoldings(state, index, now) {
  // ASHARE §2、§3.3：只在确认的新交易日开盘以后释放前日买入，不在周末/节假日提前释放。
  const today = dayKey(now), market = marketStatus(now, index);
  if (market.status === 'holiday' || dayKey(index.time) !== today || now < dayTime(today, 9, 30)) return;
  for (const holding of Object.values(state.ashare.holdings)) {
    const unlocked = holding.buys.filter(buy => buy.date < today);
    holding.available = toStr(parse(holding.available) + unlocked.reduce((sum, buy) => sum + parse(buy.qty), 0n));
    holding.buys = holding.buys.filter(buy => buy.date >= today);
  }
}
