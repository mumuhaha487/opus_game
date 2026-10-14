// Public Tencent relay for browsers whose two direct hosts fail. Never used for execution.
import { AshareClient, validateCode } from './trade/ashare-data.js';
import { GateClient } from './trade/gate.js';
import { cacheIsFresh } from './trade/upstream.js';
import { marketRate, marketGlobal } from './market-ashare.js';
const CACHE_ROOT = 'https://trade-cache.game.inc.re/ashare-quotes/';
export function quoteParameters(url) {
  for (const name of url.searchParams.keys()) {
    if (name !== 'codes' || url.searchParams.getAll(name).length !== 1) throw { status: 400, code: 'bad_request' };
  }
  const codes = (url.searchParams.get('codes') || '').split(',');
  if (!codes.length || codes.length > 60) throw { status: 400, code: 'bad_request' };
  codes.forEach(validateCode); return [...new Set(codes)].sort();
}
export function quoteView(quotes) {
  return Object.fromEntries(Object.entries(quotes).map(([code, quote]) => {
    const value = { ...quote };
    for (const name of ['last', 'prevClose', 'open', 'volume', 'change', 'percent', 'high', 'low',
      'turnover', 'turnoverRate', 'pe', 'limitUp', 'limitDown']) value[name] = quote[name] == null ? null : Number(quote[name]);
    for (const side of ['bids', 'asks']) value[side] = quote[side].map(row => row.map(Number));
    return [code, value];
  }));
}
export async function ashareQuotes(request, env) {
  if (request.method !== 'GET') return { status: 405, body: { error: 'method_not_allowed' }, headers: { Allow: 'GET' } };
  try {
    const codes = quoteParameters(new URL(request.url));
    const wait = await marketRate(env, request.headers.get('CF-Connecting-IP') || 'local');
    if (wait) return { status: 429, body: { error: 'rate_limited', retryAfter: wait }, headers: { 'Retry-After': String(wait) } };
    if (!await marketGlobal(env)) return { status: 503, body: { error: 'market_busy' } };
    const key = new Request(CACHE_ROOT + codes.join(',')), cache = globalThis.caches?.default;
    const hit = cache && await cache.match(key);
    if (cacheIsFresh(hit, 5)) return { status: 200, body: await hit.json() };
    const body = quoteView(await new AshareClient(new GateClient()).quotes(codes, true));
    if (cache) await cache.put(key, new Response(JSON.stringify(body), { headers: {
      'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=5', 'X-Fetched-At': String(Date.now()),
    } }));
    return { status: 200, body };
  } catch (error) {
    return { status: error.status || 503, body: { error: error.code || 'market_unavailable' } };
  }
}
