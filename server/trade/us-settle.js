// 美股限价单惰性结算：只用委托之后、完整结束的分钟（跳过委托所在分钟），每分钟只用该分钟确实成交过的价格；
// 触价按限价成交（保守）；盘外预埋单若开盘第一根就已越过限价，按该根开盘价成交（真实成交价、优于限价）；收盘未成交部分过期并解冻。当日用 UsMinute，近 5 个交易日用 dayus，更早用未复权日 K
// （仅当委托覆盖整个交易时段，即盘外预埋单；盘中委托缺分钟数据时保守按未成交过期）。
import { parse } from './decimal.js';
import { nyParts, sessionFor } from './us-calendar.js';
import { fillUs, finishUsOrder } from './usstock.js';
export const hasUsWork = state => state.orders.some(order => order.market === 'usstock');
function processEvent(state, order, event, notices, gap) {
  const limit = parse(order.price), buy = order.side === 'buy', open = parse(event.open);
  if (!(buy ? parse(event.low) <= limit : parse(event.high) >= limit)) return;
  const price = gap && (buy ? open < limit : open > limit) ? open : limit;
  const remaining = parse(order.qty) - parse(order.filled);
  fillUs(state, order, remaining, price, event.end);
  finishUsOrder(state, order, 'filled', event.end);
  notices.push({ t: event.end, kind: 'filled', text: order.name + '（' + order.ticker + '）已成交 ' + order.filled + ' 股，价格 $' + order.avgPrice });
}
async function settleOrder(state, order, client, now, notices) {
  if (now <= order.checkFrom) return;
  const end = Math.min(now, order.expiresAt), date = nyParts(order.expiresAt - 1).date;
  const session = sessionFor(date);
  if (!session) { finishUsOrder(state, order, 'expired', order.expiresAt); return; }
  const today = nyParts(now).date === date, ageDays = (now - session.close) / 86400000;
  const firstMinute = Math.floor(order.createdAt / 60000) * 60000 + 60000;   // 跳过委托所在分钟
  let events = [];
  if (today || ageDays <= 6) {
    events = (await client.minutes(order.ticker, !today)).filter(event => event.end > Math.max(order.checkFrom, firstMinute)
      && event.end <= end && event.end > session.open && event.end <= session.close);
  } else if (order.preplaced || order.createdAt < session.open) {
    events = (await client.daily(order.ticker, 60)).filter(bar => bar.date === date)
      .map(bar => ({ ...bar, end: session.close }));
  }
  // 开盘价改善只给起始时间等于本交易时段开盘时刻的那一根（09:30 分钟或日 K）；缺少这一根时按限价保守成交。
  const gap = order.createdAt < session.open && order.checkFrom <= session.open;
  for (const event of events.sort((a, b) => a.end - b.end)) {
    processEvent(state, order, event, notices, gap && event.t === session.open);
    if (order.status === 'filled') return;
  }
  order.checkFrom = Math.max(order.checkFrom, Math.floor(end / 60000) * 60000);
  if (now >= order.expiresAt) finishUsOrder(state, order, 'expired', order.expiresAt);
}
export async function settleUs(state, client, now, notices) {
  if (!hasUsWork(state)) return false;
  try {
    const orders = state.orders.filter(order => order.market === 'usstock').sort((a, b) => a.checkFrom - b.checkFrom);
    for (const order of orders) {
      if (order.preplaced && now >= order.checkFrom) order.preplaced = false;
      await settleOrder(state, order, client, now, notices);
    }
    return false;
  } catch (error) {
    if (error?.code === 'upstream_budget') return true;
    throw error;
  }
}
