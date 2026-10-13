// Gate.io 公开行情客户端与 Cloudflare Cache 接口。
// 请求预算按一次 Worker 调用共享，条件写重试也不重置预算。
// 规格 5.3：合成缓存 URL、8 秒超时、最多 30 次上游请求。
export function assertBookFresh(book, now) {
  // PLATFORM §5.2.2：盘口 current 为毫秒；缺失、无效、超过 10 秒或远未来均不可成交。
  const time = typeof book?.current === 'number' || typeof book?.current === 'string' ? Number(book.current) : NaN;
  if (!Number.isFinite(time) || time <= 0 || Math.abs(now - time) > 10000) {
    throw { status: 503, code: 'market_stale' };
  }
}
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
    if (this.used >= (this.budgetLimit ?? 30)) throw { code: 'upstream_budget' };
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
  async preloadTickers(symbols, futures = false) {
    // PLATFORM §6.4：多资产估值一次批量报价，避免39个市场耗尽每请求30次上游预算。
    const unique = [...new Set(symbols)];
    if (!unique.length) return;
    if (unique.length === 1) { await (futures ? this.futuresTicker(unique[0]) : this.ticker(unique[0])); return; }
    const path = futures ? '/futures/usdt/tickers' : '/spot/tickers';
    const field = futures ? 'contract' : 'currency_pair', query = futures ? 'contract' : 'currency_pair';
    const rows = await this.get(path, {}, 2);
    if (!Array.isArray(rows)) throw { status: 503, code: 'market_unavailable' };
    for (const symbol of unique) {
      const quote = rows.find(row => row[field] === symbol);
      if (!quote) throw { status: 503, code: 'market_unavailable' };
      this.pending.set(path + '?' + query + '=' + symbol, Promise.resolve([quote]));
    }
  }
  candles(symbol, interval, from, to) {
    const ttl = to < Math.floor(this.now / 60000) * 60 ? 300 : 5;
    return this.get('/spot/candlesticks', { currency_pair: symbol, interval, from, to }, ttl);
  }
  trades(symbol, from, to, page = 1) {
    return this.get('/spot/trades', { currency_pair: symbol, from, to, limit: 1000, page }, 5);
  }
  contract(symbol) { return this.get('/futures/usdt/contracts/' + symbol, {}, 3600); }
  async futuresBook(symbol) {
    const book = await this.get('/futures/usdt/order_book', { contract: symbol, limit: 100 }, 1);
    // PLATFORM §5.2.2 / §6.4：真实合约current是带小数的Unix秒，读取边界统一为毫秒再查10秒新鲜度。
    const current = Number(book.current);
    return { ...book, current: current > 0 && current < 1e11 ? current * 1000 : book.current };
  }
  futuresTicker(symbol) { return this.get('/futures/usdt/tickers', { contract: symbol }, 2); }
  futuresCandles(symbol, interval, from, to, mark = false) {
    const ttl = to < Math.floor(this.now / 60000) * 60 ? 300 : 5;
    return this.get('/futures/usdt/candlesticks', { contract: (mark ? 'mark_' : '') + symbol, interval, from, to }, ttl);
  }
  futuresTrades(symbol, from, to, offset = 0) {
    return this.get('/futures/usdt/trades', { contract: symbol, from, to, limit: 1000, offset }, 5);
  }
  funding(symbol, from, to, limit = 1000) {
    return this.get('/futures/usdt/funding_rate', { contract: symbol, from, to, limit }, 300);
  }
}
