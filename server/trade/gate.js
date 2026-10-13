// Gate.io 公开行情客户端与 Cloudflare Cache 接口。
// 请求预算按一次 Worker 调用共享，条件写重试也不重置预算。
// 规格 5.3：合成缓存 URL、8 秒超时、最多 30 次上游请求。
export class GateClient {
  constructor(now = Date.now()) { this.now = now; this.used = 0; this.pending = new Map(); }
  async get(path, query = {}, ttl = 5) {
    const parameters = new URLSearchParams(Object.entries(query).map(([name, value]) => [name, String(value)]));
    const suffix = path + (parameters.size ? '?' + parameters : '');
    if (this.pending.has(suffix)) return this.pending.get(suffix);
    const promise = this.load(suffix, ttl);
    this.pending.set(suffix, promise);
    return promise;
  }
  async load(suffix, ttl) {
    const key = new Request('https://trade-cache.game.inc.re' + suffix);
    const cache = globalThis.caches?.default;
    const cached = cache && await cache.match(key);
    if (cached) return cached.json();
    // 规格 5.3：Cache 命中不计预算，并发请求在 fetch 前同步领取额度。
    if (this.used >= 30) throw { code: 'upstream_budget' };
    this.used++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch('https://api.gateio.ws/api/v4' + suffix, {
        headers: { Accept: 'application/json', 'User-Agent': 'game.inc.re-sim/1' }, signal: controller.signal,
      });
      if (!response.ok) throw new Error('upstream');
      const value = await response.json();
      if (cache) await cache.put(key, new Response(JSON.stringify(value), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=' + ttl },
      }));
      return value;
    } catch { throw { status: 503, code: 'market_unavailable' }; }
    finally { clearTimeout(timer); }
  }
  spec(symbol) { return this.get('/spot/currency_pairs/' + symbol, {}, 3600); }
  book(symbol) { return this.get('/spot/order_book', { currency_pair: symbol, limit: 100 }, 1); }
  ticker(symbol) { return this.get('/spot/tickers', { currency_pair: symbol }, 2); }
  candles(symbol, interval, from, to) {
    const ttl = to < Math.floor(this.now / 60000) * 60 ? 300 : 5;
    return this.get('/spot/candlesticks', { currency_pair: symbol, interval, from, to }, ttl);
  }
  trades(symbol, from, to, page = 1) {
    return this.get('/spot/trades', { currency_pair: symbol, from, to, limit: 1000, page }, 5);
  }
}
