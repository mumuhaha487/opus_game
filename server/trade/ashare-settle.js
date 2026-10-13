// ASHARE §3：T+1 转换、委托后逐笔及完整分钟、收盘过期与游标。
// 首尾不完整分钟使用当日真实逐笔，历史行情不能填补委托前的区间。
// 上游预算耗尽保存已完成订单进度，真实失败交给现有 GET 副本回退。
import { parse, mul } from './decimal.js';
import { dayKey } from '../likes.js';
import { dayTime, unlockHoldings } from './ashare-rules.js';
import { fillAshare, finishAshareOrder } from './ashare.js';
export function hasAshareWork(state, now) {
  return state.orders.some(order => order.market === 'ashare')
    || Object.values(state.ashare.holdings).some(holding => holding.buys.some(buy => buy.date < dayKey(now)));
}
function tradingTime(time) {
  const date = dayKey(time);
  return time >= dayTime(date, 9, 30) && time < dayTime(date, 11, 30)
    || time >= dayTime(date, 13) && time < dayTime(date, 15);
}
export function processAshareEvent(state, order, event, notices) {
  // ASHARE §3.2 / PLATFORM §5.2.3：逐笔严格晚于委托和游标，K 线开盘不早于游标。
  if (event.candle ? event.t < order.checkFrom : event.t <= Math.max(order.checkFrom, order.createdAt)) return;
  if (!tradingTime(event.t) || event.t >= order.expiresAt) return;
  const price = parse(order.price);
  if (order.side === 'buy' ? parse(event.low) > price : parse(event.high) < price) return;
  const remaining = parse(order.qty) - parse(order.filled);
  fillAshare(state, order, remaining, mul(price, remaining, 'floor'), event.t);
  finishAshareOrder(state, order, 'filled', event.t);
  notices.push({ t: event.t, kind: 'filled', text: order.name + ' 已成交 ' + order.filled + ' 股，均价 ' + order.avgPrice });
}
async function settleOrder(state, order, client, now, notices) {
  if (order.checkFrom >= now) return;
  const end = Math.min(now, order.expiresAt), start = order.checkFrom;
  if (end <= start) return;
  const quote = await client.quote(order.code);
  const cursorDate = dayKey(start), date = dayKey(quote.time);
  const minuteStart = Math.ceil(start / 60000) * 60000;
  // ASHARE §3.2：当日 details 没有日期；历史首分钟缺逐笔时保守跳过，不借用整根 K 线回填。
  const events = date === cursorDate ? await client.details(order.code, date) : [];
  const older = now - start > 7 * 86400000;
  const candles = older ? await client.daily(order.code, cursorDate, dayKey(end)) : await client.trends(order.code);
  events.push(...candles.filter(event => event.t >= minuteStart && event.end <= end));
  events.sort((left, right) => left.t - right.t);
  for (const event of events.filter(event => event.t >= start && event.t < end
    && (!quote.suspended || dayKey(event.t) !== date))) {
    processAshareEvent(state, order, event, notices);
    if (order.status === 'filled') break;
  }
  if (order.status !== 'filled') {
    // ASHARE §3.2：保留尚未完整的尾分钟，下一轮完整 K 线仍可覆盖该区间。
    order.checkFrom = Math.max(start, Math.floor(end / 60000) * 60000);
    // ASHARE §3.3：先处理到收盘的成交，再过期解冻，不能因预算用尽直接越过历史。
    if (now >= order.expiresAt) finishAshareOrder(state, order, 'expired', order.expiresAt);
  }
  state.settledAt['ashare:' + order.code] = end;
}
export async function settleAshare(state, client, now, notices) {
  if (!hasAshareWork(state, now)) return false;
  try {
    const index = await client.quote('sh000001');
    // ASHARE §3.3：T+1 可卖转换先于成交检查。
    unlockHoldings(state, index, now); state.ashare.marketTime = index.time;
    const orders = state.orders.filter(order => order.market === 'ashare').sort((left, right) => left.checkFrom - right.checkFrom);
    for (const order of orders) {
      // ASHARE §2：预埋单遇到休市日，在确认的新交易日开盘时进入当日委托。
      if (order.preplaced && dayKey(index.time) < dayKey(order.checkFrom)) continue;
      if (order.preplaced && dayKey(index.time) > dayKey(order.checkFrom)) {
        // ASHARE §2：离线跨多个交易日时找第一次实际开盘，不能把委托顺延到最新交易日。
        const sessions = await client.daily('sh000001', dayKey(order.checkFrom), dayKey(index.time));
        const first = sessions.sort((left, right) => left.t - right.t).find(event => event.t >= order.checkFrom);
        if (!first) throw { status: 503, code: 'market_unavailable' };
        order.checkFrom = first.t; order.expiresAt = dayTime(dayKey(first.t), 15);
      }
      if (order.preplaced && now >= order.checkFrom) order.preplaced = false;
      await settleOrder(state, order, client, now, notices);
      // ASHARE §2：离线补记前日买入时，同请求的最终持仓也应已转为可卖。
      unlockHoldings(state, index, now);
    }
    return false;
  } catch (error) {
    if (error?.code === 'upstream_budget') return true;
    throw error;
  }
}
