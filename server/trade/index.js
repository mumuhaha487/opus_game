// 已通过全站会话验证的交易 API 路由。
// 规格 5.1：方法检查、账号限流、统一错误与 no-store 响应。
// 结算和操作在同一 R2 条件写内提交，summary 只读一次交易文档。
import { rateWindow } from '../store.js';
import { dayKey } from '../likes.js';
import { GateClient } from './gate.js';
import { readState, updateState, stateView, summary, transfer } from './state.js';
import { checkin } from './checkin.js';
import { placeOrder, cancelOrder, cancelAll } from './spot.js';
import { settle } from './settle.js';
import { marketFor } from './markets.js';
import { getFx } from './fx.js';
import { AshareClient } from './ashare-data.js';
import { placeAshareOrder, cancelAshareOrder } from './ashare.js';
import { placeFuturesOrder, cancelFuturesOrder, closeFutures, changeLeverage, changeTPSL, changeMargin } from './futures.js';
const ROUTES = {
  state: 'GET', summary: 'GET', history: 'GET', checkin: 'POST', transfer: 'POST',
  disclaimer: 'POST',
  'ashare/order': 'POST', 'ashare/cancel': 'POST',
  'spot/order': 'POST', 'spot/cancel': 'POST', 'spot/cancel-all': 'POST',
  'futures/order': 'POST', 'futures/cancel': 'POST', 'futures/close': 'POST',
  'futures/leverage': 'POST', 'futures/tpsl': 'POST', 'futures/margin': 'POST',
};
const MESSAGES = {
  bad_request: '请求格式错误', unknown_symbol: '不支持的交易对', bad_price: '价格不符合精度要求',
  bad_qty: '数量不符合精度要求', insufficient_balance: '可用余额不足', too_many_orders: '当前委托最多 50 笔',
  order_not_found: '委托不存在或已结束', already_checked_in: '今天已经签到过了',
  market_unavailable: '行情服务暂时不可用，请稍后再试', no_liquidity: '当前盘口深度不足，未能成交',
  rate_limited: '操作太频繁，请稍后再试', not_found: '接口不存在', method_not_allowed: '请求方法不支持',
  leverage_locked: '有仓位或委托时无法调整杠杆', reduce_only: '只减仓委托会增加仓位，已拒绝',
  position_not_found: '没有该合约的仓位', bad_tpsl: '止盈止损价格不合理', margin_limit: '超出可调整的保证金范围',
  fx_unavailable: '汇率暂时不可用，请稍后再试', disclaimer_required: '请先阅读并确认使用须知',
  market_closed: '当前不在交易时段', price_out_of_limit: '委托价格超出涨跌停范围',
  lot_size: '买入数量须为 100 股的整数倍（科创板至少 200 股）',
  t_plus_one: '可卖数量不足（当日买入的股票下一交易日才能卖出）', suspended: '该股票停牌', not_a_share: '仅支持沪深 A 股',
  market_stale: '行情暂时不同步，请稍后再试', daily_order_limit: '今日委托次数已达上限',
};
function reply(status, data, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', ...headers,
    // PLATFORM §5.4：API 仅返回 JSON，所有成功、错误及方法拒绝响应使用同一防嵌入策略。
    'X-Frame-Options': 'DENY', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  } });
}
export async function handleTrade(request, env, session, data, services) {
  const url = new URL(request.url), route = url.pathname.slice('/api/trade/'.length);
  if (!Object.hasOwn(ROUTES, route)) return reply(404, { error: 'not_found', message: MESSAGES.not_found });
  const method = ROUTES[route];
  if (request.method !== method) {
    return reply(405, { error: 'method_not_allowed', message: MESSAGES.method_not_allowed }, { Allow: method });
  }
  const uid = session.user.uid, now = Date.now();
  try {
    // 本轮验收修正规格 5.1：仅 POST 计数，60 秒共 40 次；GET 不写限流文档。
    if (method === 'POST') {
      const retryAfter = await rateWindow(env.ACCOUNTS, 'trade-post', uid, 60, 40, true);
      if (retryAfter) return reply(429, { error: 'rate_limited', message: MESSAGES.rate_limited, retryAfter },
        { 'Retry-After': String(retryAfter) });
    }
    if (route === 'summary' || route === 'history') {
      const { state } = await readState(env.ACCOUNTS, uid, now);
      if (route === 'summary') return reply(200, summary(state, now));
      const kind = url.searchParams.get('kind'), market = url.searchParams.get('market');
      if (!['orders', 'trades', 'ledger'].includes(kind) || !['wallet', 'spot', 'futures', 'ashare'].includes(market)) {
        throw { status: 400, code: 'bad_request' };
      }
      return reply(200, { [kind]: state.history[kind].filter(entry => entry.market === market) });
    }
    // PLATFORM §6.4：Agent结算、操作和估值共用同一个上游预算与请求缓存。
    const gate = services?.gate || new GateClient(now);
    const ashare = services?.ashare || new AshareClient(gate, now);
    const result = await updateState(env.ACCOUNTS, uid, async state => {
      // PLATFORM §4：确认免责先独立落盘；所有交易类 POST 在读行情之前检查。
      if (route === 'disclaimer') { state.disclaimerAt ||= now; return { notices: [] }; }
      if (method === 'POST' && !state.disclaimerAt && !session.apiKey) throw { status: 403, code: 'disclaimer_required' };
      const ordering = ['spot/order', 'futures/order', 'futures/close', 'ashare/order'].includes(route);
      const previous = ordering && state.clientIds.find(entry => entry.clientId === data.clientId);
      // PLATFORM §5.2.4–5：重放不新增委托；每日上限在同一个 etag 事务内检查与增加。
      if (previous) return { order: structuredClone(previous.result), notices: [] };
      const day = dayKey(now), ordersToday = state.agent.day === day ? state.agent.ordersToday : 0;
      if (ordering && ordersToday >= 500) throw { status: 429, code: 'daily_order_limit' };
      const fx = route === 'transfer' && [data.from, data.to].includes('ashare') ? await getFx(now, gate) : null;
      if (route === 'ashare/order' && !state.clientIds.some(entry => entry.clientId === data.clientId)) {
        await ashare.quotes([data.code, 'sh000001']);
      }
      // 规格 5.3、5.5：先取得本次下单行情，剩余预算留给结算，部分结算后仍能执行操作。
      if (route === 'spot/order' && !state.clientIds.some(entry => entry.clientId === data.clientId)) {
        marketFor(data.symbol);
        await Promise.all([gate.spec(data.symbol), data.type === 'stop_limit'
          ? gate.ticker(data.symbol) : gate.book(data.symbol)]);
      }
      if (route.startsWith('futures/') && route !== 'futures/cancel') {
        marketFor(data.symbol);
        const reads = [gate.contract(data.symbol)];
        if (route !== 'futures/leverage') reads.push(gate.futuresTicker(data.symbol));
        if (['futures/order', 'futures/close'].includes(route) && data.type !== 'stop_market') {
          reads.push(gate.futuresBook(data.symbol));
        }
        await Promise.all(reads);
      }
      // 规格 5.5：GET 在副本结算；只有真实上游失败才返回原状态并且零账户写入。
      const candidate = method === 'GET' ? structuredClone(state) : state;
      let settlement;
      try {
        // ASHARE §4：有 A 股资金、持仓或历史参与的账户，state 也刷新指数日期，避免隔日误报休市。
        if (route === 'state' && (candidate.ashare.marketTime != null || candidate.ashare.cash.free !== '0'
          || candidate.ashare.cash.locked !== '0' || Object.keys(candidate.ashare.holdings).length)) {
          candidate.ashare.marketTime = (await ashare.quote('sh000001')).time;
        }
        settlement = await settle(candidate, gate, now, method === 'POST', ashare);
      } catch (error) {
        if (method !== 'GET' || error?.code !== 'market_unavailable') throw error;
        return { partial: true, stale: true, notices: [] };
      }
      if (method === 'GET') Object.assign(state, candidate);
      let order, reward, transferred;
      if (route === 'checkin') reward = checkin(state, now);
      if (route === 'ashare/order') order = await placeAshareOrder(state, data, ashare, now);
      if (route === 'ashare/cancel') cancelAshareOrder(state, data.id, now);
      if (route === 'transfer') transferred = transfer(state, data, now, fx);
      if (route === 'spot/order') order = await placeOrder(state, data, gate, now);
      if (route === 'spot/cancel') cancelOrder(state, data.id, now);
      if (route === 'spot/cancel-all') cancelAll(state, data.symbol, now);
      if (route === 'futures/order') order = await placeFuturesOrder(state, data, gate, now);
      if (route === 'futures/close') order = await closeFutures(state, data, gate, now);
      if (route === 'futures/cancel') cancelFuturesOrder(state, data.id, now);
      if (route === 'futures/leverage') await changeLeverage(state, data, gate);
      if (route === 'futures/tpsl') await changeTPSL(state, data, gate, now);
      if (route === 'futures/margin') await changeMargin(state, data, gate, now);
      if (ordering) state.agent = { ...state.agent, day, ordersToday: ordersToday + 1 };
      return { ...settlement, order, reward, transferred };
    }, now);
    return reply(200, { ...stateView(result.state, now, result.partial, result.notices),
      ...result.transferred,
      ...(result.stale ? { stale: true } : {}),
      ...(result.order ? { order: result.order } : {}), ...(result.reward ? { reward: result.reward } : {}) });
  } catch (error) {
    const code = error?.code === 'upstream_budget' ? 'market_unavailable' : error?.code || 'market_unavailable';
    const message = code === 'min_notional' ? `下单金额低于最小值 ${error.minimum} USDT`
      : code === 'max_position' ? `超出该合约的最大持仓价值 ${error.maximum} USDT` : MESSAGES[code];
    return reply(error?.status || 503, { error: code, message: message || MESSAGES.market_unavailable });
  }
}
