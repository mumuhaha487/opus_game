// PLATFORM §6.3–6.5：只接受Bearer的Agent API；Cookie不参与认证，JSON边界保留，不开放CORS。
// 委托、撤单、划转和合约操作复用网页handler与R2条件写，每日额度及上游预算共同计数。
// 账户估值使用服务端可信报价，逐仓亏损以保证金为限；日志仅保存请求元信息。
import { authenticateKey, requestKeyRate, recordKeyUse } from './api-keys.js';
import { dailyUsage } from './api-usage.js';
import { handleTrade } from './trade/index.js';
import { GateClient, assertBookFresh } from './trade/gate.js';
import { AshareClient, validateCode } from './trade/ashare-data.js';
import { marketStatus } from './trade/ashare-rules.js';
import { readState } from './trade/state.js';
import { marketFor } from './trade/markets.js';
import { getFx } from './trade/fx.js';
import { parse, toStr, mul, div, roundTo, max } from './trade/decimal.js';
import { pnl, MAKER, TAKER, maxLeverage } from './trade/futures.js';
import { FEE_RATE } from './trade/spot.js';
const ROUTES = { account: 'GET', quote: 'GET', spec: 'GET', orders: 'GET, POST', trades: 'GET', 'orders/cancel': 'POST',
  transfer: 'POST', 'futures/leverage': 'POST', 'futures/close': 'POST', 'futures/tpsl': 'POST' };
const MARKETS = { crypto_spot: 'spot', crypto_futures: 'futures', ashare: 'ashare' };
const denied = new Set(['checkin', 'keys', 'keys/revoke', 'keys/log', 'register', 'login', 'logout', 'me', 'saves', 'likes']);
const fail = (status, code, message) => { throw { status, code, message }; };
function reply(status, data, headers) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin',
    'X-Frame-Options': 'DENY', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'", ...headers } });
}
function marketName(value, optional = false) {
  if (optional && value === null) return null;
  if (optional && ['spot', 'futures'].includes(value)) return value;
  if (!Object.hasOwn(MARKETS, value)) fail(422, 'bad_request', '请求格式错误');
  return MARKETS[value];
}
function positivePrice(value) {
  let price;
  try { price = parse(value); } catch { fail(503, 'market_unavailable', '行情服务暂时不可用，请稍后再试'); }
  if (price <= 0n) fail(503, 'market_unavailable', '行情服务暂时不可用，请稍后再试');
  return price;
}
async function valuation(view, gate, ashare, now) {
  let usd = parse(view.wallet.usd) + parse(view.futures.wallet) + parse(view.futures.locked);
  let cny = parse(view.ashare.cash.free) + parse(view.ashare.cash.locked);
  for (const funds of view.spot.balances) {
    const quantity = parse(funds.free) + parse(funds.locked);
    if (!quantity) continue;
    if (funds.asset === 'USDT') usd += quantity;
    else {
      const symbol = marketFor(funds.asset + '_USDT').spot;
      usd += mul(quantity, positivePrice((await gate.ticker(symbol))[0]?.last), 'floor');
    }
  }
  for (const position of view.futures.positions) {
    marketFor(position.symbol);
    const mark = positivePrice((await gate.futuresTicker(position.symbol))[0]?.mark_price);
    // PLATFORM §6.4：合约权益计入未实现盈亏，逐仓损失封顶，不重复计算冻结保证金。
    usd += max(0n, parse(position.margin) + pnl(position, mark));
  }
  const codes = view.ashare.holdings.map(holding => holding.code);
  if (codes.length) await ashare.quotes(codes);
  for (const holding of view.ashare.holdings) {
    cny += mul(parse(holding.qty), positivePrice((await ashare.quote(holding.code)).last), 'floor');
  }
  // PLATFORM §2.4 / 第2b轮：读原生余额不依赖FX；仅跨币种总值无法计算时置null。
  let fx;
  try { fx = await getFx(now, gate); } catch { fx = null; }
  if (!fx) return { totalUSD: cny ? null : toStr(roundTo(usd, 8, 'floor')),
    totalCNY: usd ? null : toStr(roundTo(cny, 2, 'floor')), fx: null, valuation: null };
  const rate = parse(fx.rate);
  return { totalUSD: toStr(roundTo(usd + div(cny, rate, 'floor'), 8, 'floor')),
    totalCNY: toStr(roundTo(mul(usd, rate, 'floor') + cny, 2, 'floor')), fx, valuation: fx };
}
async function quoteView(url, gate, ashare, now) {
  const market = url.searchParams.get('market'), symbol = url.searchParams.get('symbol');
  if (market === 'crypto') {
    marketFor(symbol);
    const [ticker, initialBook] = await Promise.all([gate.ticker(symbol), gate.executionBook(symbol)]);
    let book = initialBook;
    // 第五轮延迟修复：ticker 等待结束后重查盘口，超过余量时最多强制刷新一次。
    if (Date.now() - Number(book.current) > (book.bookSource === 'ws' ? 2500 : 8000)) {
      book = await gate.executionBook(symbol, { refresh: true });
    }
    assertBookFresh(book, Date.now());
    return { market, symbol, last: toStr(positivePrice(ticker[0]?.last)),
      bid: book.bids[0]?.[0] || '0', ask: book.asks[0]?.[0] || '0', time: Number(book.current) };
  }
  if (market !== 'ashare') fail(422, 'bad_request', '请求格式错误');
  validateCode(symbol);
  const quotes = await ashare.quotes([symbol, 'sh000001']), quote = quotes[symbol];
  if (!quote.type.startsWith('GP-A')) fail(422, 'not_a_share', '仅支持沪深 A 股');
  const state = marketStatus(now, quotes.sh000001);
  return { market, symbol, last: quote.last, bid: quote.bids[0]?.[0] || '0', ask: quote.asks[0]?.[0] || '0',
    time: quote.time, limitUp: quote.limitUp, limitDown: quote.limitDown,
    status: quote.suspended ? '停牌' : state.status === 'open' ? '交易中' : '休市' };
}
// ACCOUNT §3：下单前计算合法数量所需的交易规格；只读、白名单参数，规格走 GateClient 1 小时缓存。
async function specView(url, gate, ashare) {
  for (const name of url.searchParams.keys()) {
    if (!['market', 'symbol'].includes(name) || url.searchParams.getAll(name).length !== 1) fail(422, 'bad_request', '请求格式错误');
  }
  const market = url.searchParams.get('market'), symbol = url.searchParams.get('symbol');
  const text = value => value == null || value === '' ? null : String(value);
  if (market === 'crypto_spot') {
    marketFor(symbol);
    const spec = await gate.spec(symbol);
    return { market, symbol, pricePrecision: Number(spec.precision), amountPrecision: Number(spec.amount_precision),
      minQuoteAmount: text(spec.min_quote_amount), minBaseAmount: text(spec.min_base_amount),
      feeRate: toStr(FEE_RATE), feeAsset: { buy: '基础币', sell: 'USDT' }, tradable: spec.trade_status === 'tradable' };
  }
  if (market === 'crypto_futures') {
    marketFor(symbol);
    const [contract, tickers] = await Promise.all([gate.contract(symbol), gate.futuresTicker(symbol)]);
    return { market, symbol, quantoMultiplier: text(contract.quanto_multiplier),
      orderPriceRound: text(contract.order_price_round), leverageMin: Number(contract.leverage_min) || 1,
      leverageMax: maxLeverage(contract), maintenanceRate: text(contract.maintenance_rate),
      makerFee: toStr(MAKER), takerFee: toStr(TAKER), markPrice: text(tickers[0]?.mark_price ?? contract.mark_price),
      fundingRate: text(contract.funding_rate), fundingIntervalSeconds: Number(contract.funding_interval) || null };
  }
  if (market !== 'ashare') fail(422, 'bad_request', '请求格式错误');
  validateCode(symbol);
  const quote = (await ashare.quotes([symbol]))[symbol];
  if (!quote.type.startsWith('GP-A')) fail(422, 'not_a_share', '仅支持沪深 A 股');
  const star = quote.type.startsWith('GP-A-KCB');
  return { market, symbol, name: quote.name, board: star ? '科创板' : quote.type.startsWith('GP-A-CYB') ? '创业板' : '主板',
    buyLot: star ? { min: 200, step: 1 } : { min: 100, step: 100 },
    sellRule: '卖出数量须为 100 股整数倍，或等于全部可卖数量（一次清空零股）', tick: '0.01',
    limitUp: quote.limitUp, limitDown: quote.limitDown, tPlus: 1, suspended: !!quote.suspended,
    fees: { commission: '0.00025', commissionMinCNY: '5', transfer: '0.00001', stampOnSell: '0.0005' },
    sessions: ['09:30-11:30', '13:00-15:00'], timeZone: 'Asia/Shanghai' };
}
async function dispatch(request, env, key, route, data, now) {
  const url = new URL(request.url), method = request.method, gate = new GateClient(now), ashare = new AshareClient(gate, now);
  if (route === 'account') {
    // PLATFORM §6.4：结算前准备估值报价，积压结算耗尽预算时仍可返回全部资产的可信估值。
    const { state } = await readState(env.ACCOUNTS, key.uid, now);
    const spot = Object.keys(state.spot.balances).filter(asset => asset !== 'USDT').map(asset => marketFor(asset + '_USDT').spot);
    const futures = Object.keys(state.futures.positions);
    const codes = Object.keys(state.ashare.holdings);
    for (const order of state.orders) {
      if (order.market === 'spot') spot.push(order.symbol);
      if (order.market === 'futures') futures.push(order.symbol);
      if (order.market === 'ashare') codes.push(order.code);
    }
    if (codes.length || state.ashare.cash.free !== '0' || state.ashare.cash.locked !== '0') codes.push('sh000001');
    await Promise.all([gate.preloadTickers(spot), gate.preloadTickers(futures, true), getFx(now, gate).catch(() => null),
      ...(codes.length ? [ashare.quotes(codes)] : [])]);
  }
  if (route === 'quote') return reply(200, await quoteView(url, gate, ashare, now));
  if (route === 'spec') return reply(200, await specView(url, gate, ashare));
  if (method === 'GET' && ['orders', 'trades'].includes(route)) {
    const market = marketName(url.searchParams.get('market'), true), { state } = await readState(env.ACCOUNTS, key.uid, now);
    const status = url.searchParams.get('status');
    if (route === 'orders' && !['open', 'history'].includes(status)) fail(422, 'bad_request', '请求格式错误');
    const rows = route === 'trades' ? state.history.trades : status === 'open' ? state.orders : state.history.orders;
    return reply(200, { [route]: rows.filter(row => !market || row.market === market) });
  }
  let tradeRoute = route === 'account' ? 'state' : route;
  if (route === 'orders') {
    const market = marketName(data.market);
    if (typeof data.clientId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(data.clientId)) {
      fail(422, 'bad_request', 'clientId 为必填字段');
    }
    tradeRoute = market + '/order';
  }
  if (route === 'orders/cancel') tradeRoute = marketName(data.market) + '/cancel';
  const target = new URL('/api/trade/' + tradeRoute, url.origin);
  const response = await handleTrade(new Request(target, { method }), env, { user: { uid: key.uid }, apiKey: true },
    data, { gate, ashare });
  const result = await response.json();
  if (route === 'account' && response.ok) Object.assign(result, await valuation(result, gate, ashare, now));
  // PLATFORM §6.3：Agent输入错误统一422，中文错误码沿用网页业务规则。
  return reply(response.status === 400 ? 422 : response.status, result,
    response.headers.has('Retry-After') ? { 'Retry-After': response.headers.get('Retry-After') } : {});
}
export async function handleAgent(request, env, readBody) {
  const now = Date.now(), limit = 10;
  let key, response;
  const headers = { 'X-Request-Id': crypto.randomUUID(), 'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(limit) };
  try {
    if (!env?.ACCOUNTS || typeof env.AUTH_SECRET !== 'string' || env.AUTH_SECRET.length < 32) {
      fail(503, 'storage_unavailable', '存储服务暂时不可用，请稍后再试');
    }
    key = await authenticateKey(request, env);
    // ACCOUNT §2.1：注册表可扩展项目；交易所路由只接受交易所项目，不能跨项目使用权限。
    if (key.meta.project !== 'exchange') fail(403, 'scope_denied', '此密钥不属于模拟交易所项目');
    const usage = await dailyUsage(env.ACCOUNTS, key, now);
    headers['X-Daily-Quota-Limit'] = '1500'; headers['X-Daily-Quota-Remaining'] = String(usage.keyRemaining);
    headers['X-Account-Quota-Remaining'] = String(usage.accountRemaining);
    if (usage.denied) {
      headers['X-RateLimit-Limit'] = usage.accountRemaining ? '1500' : '3000';
      headers['X-RateLimit-Remaining'] = '0'; headers['Retry-After'] = String(usage.retryAfter);
      fail(429, 'daily_quota', '今日 API 调用次数已用完');
    }
    const rate = await requestKeyRate(env, key.id, request.method, now);
    headers['X-RateLimit-Remaining'] = String(rate.remaining);
    if (rate.retryAfter) {
      headers['Retry-After'] = String(rate.retryAfter); fail(429, 'rate_limited', '操作太频繁，请稍后再试');
    }
    const route = new URL(request.url).pathname.slice('/api/v1/'.length);
    if (denied.has(route) || route.startsWith('save/') || route.startsWith('like/')) {
      fail(403, 'scope_denied', 'API 密钥不能调用此接口');
    }
    if (!Object.hasOwn(ROUTES, route)) fail(404, 'not_found', '接口不存在');
    const methods = ROUTES[route];
    if (!methods.split(', ').includes(request.method)) {
      headers.Allow = methods; fail(405, 'method_not_allowed', '请求方法不支持');
    }
    // PLATFORM §6.3：只认Key及其scope；JSON和大小校验保留，Cookie与Origin不参与鉴权。
    if (!key.scopes.includes(request.method === 'GET' ? 'read' : 'trade')) fail(403, 'scope_denied', '密钥权限不足');
    let data = null;
    if (request.method === 'POST') {
      const media = (request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
      if (media !== 'application/json') fail(415, 'unsupported_media_type', '请使用 JSON 请求');
      data = await readBody(request);
    }
    response = await dispatch(request, env, key, route, data, now);
  } catch (error) {
    const code = error?.code === 'upstream_budget' ? 'market_unavailable' : error?.code || 'server_error';
    response = reply(error?.status === 400 ? 422 : error?.status || 503, { error: code,
      message: error?.message || (code === 'bad_request' ? '请求格式错误' : '服务暂时不可用，请稍后再试') });
  }
  for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
  if (key) await recordKeyUse(env.ACCOUNTS, key, request, response.status, now);
  return response;
}
