// 已通过全站会话验证的交易 API 路由。
// 规格 5.1：方法检查、账号限流、统一错误与 no-store 响应。
// 结算和操作在同一 R2 条件写内提交，summary 只读一次交易文档。
import { rateWindow } from '../store.js';
import { GateClient } from './gate.js';
import { readState, updateState, stateView, summary, transfer } from './state.js';
import { checkin } from './checkin.js';
import { placeOrder, cancelOrder, cancelAll } from './spot.js';
import { settle } from './settle.js';
const ROUTES = {
  state: 'GET', summary: 'GET', history: 'GET', checkin: 'POST', transfer: 'POST',
  'spot/order': 'POST', 'spot/cancel': 'POST', 'spot/cancel-all': 'POST',
};
const MESSAGES = {
  bad_request: '请求格式错误', unknown_symbol: '不支持的交易对', bad_price: '价格不符合精度要求',
  bad_qty: '数量不符合精度要求', insufficient_balance: '可用余额不足', too_many_orders: '当前委托最多 50 笔',
  order_not_found: '委托不存在或已结束', already_checked_in: '今天已经签到过了',
  market_unavailable: '行情服务暂时不可用，请稍后再试', no_liquidity: '当前盘口深度不足，未能成交',
};
function reply(status, data, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', ...headers,
  } });
}
export async function handleTrade(request, env, session, data) {
  const url = new URL(request.url), route = url.pathname.slice('/api/trade/'.length);
  if (!Object.hasOwn(ROUTES, route)) return reply(404, { error: 'not_found' });
  const method = ROUTES[route];
  if (request.method !== method) return reply(405, { error: 'method_not_allowed' }, { Allow: method });
  const uid = session.user.uid, now = Date.now();
  try {
    const waits = [await rateWindow(env.ACCOUNTS, 'trade-uid', uid, 60, 180, true)];
    if (method === 'POST') waits.push(await rateWindow(env.ACCOUNTS, 'trade-post', uid, 60, 40, true));
    const retryAfter = Math.max(...waits);
    if (retryAfter) return reply(429, { error: 'rate_limited', retryAfter }, { 'Retry-After': String(retryAfter) });
    if (route === 'summary' || route === 'history') {
      const { state } = await readState(env.ACCOUNTS, uid, now);
      if (route === 'summary') return reply(200, summary(state, now));
      const kind = url.searchParams.get('kind'), market = url.searchParams.get('market');
      if (!['orders', 'trades', 'ledger'].includes(kind) || !['spot', 'futures'].includes(market)) {
        throw { status: 400, code: 'bad_request' };
      }
      return reply(200, { [kind]: state.history[kind].filter(entry => entry.market === market) });
    }
    const gate = new GateClient(now);
    const result = await updateState(env.ACCOUNTS, uid, async state => {
      const settlement = await settle(state, gate, now, method === 'POST');
      let order, reward;
      if (route === 'checkin') reward = checkin(state, now);
      if (route === 'transfer') transfer(state, data, now);
      if (route === 'spot/order') order = await placeOrder(state, data, gate, now);
      if (route === 'spot/cancel') cancelOrder(state, data.id, now);
      if (route === 'spot/cancel-all') cancelAll(state, data.symbol, now);
      return { ...settlement, order, reward };
    }, now);
    return reply(200, { ...stateView(result.state, now, result.partial, result.notices),
      ...(result.order ? { order: result.order } : {}), ...(result.reward ? { reward: result.reward } : {}) });
  } catch (error) {
    const code = error?.code === 'upstream_budget' ? 'market_unavailable' : error?.code || 'market_unavailable';
    const message = code === 'min_notional' ? `下单金额低于最小值 ${error.minimum} USDT` : MESSAGES[code];
    return reply(error?.status || 503, { error: code, message: message || MESSAGES.market_unavailable });
  }
}
