// Gate.io 公开行情客户端与 Cloudflare Cache 接口。
// 请求预算按一次 Worker 调用共享，条件写重试也不重置预算。
// 规格 5.3：合成缓存 URL、8 秒超时、最多 30 次上游请求。
import { cacheIsFresh } from './upstream.js';
export function assertBookFresh(book, now) {
  // PLATFORM §5.2.2：盘口 current 为毫秒；缺失、无效、超过 10 秒或远未来均不可成交。
  const time = typeof book?.current === 'number' || typeof book?.current === 'string' ? Number(book.current) : NaN;
  const maxAge = book?.bookSource === 'ws' ? 3000 : 10000;
  if (!Number.isFinite(time) || time <= 0 || Math.abs(now - time) > maxAge) {
    throw { status: 503, code: 'market_stale' };
  }
}
export class GateClient {
  constructor(now = Date.now()) { this.now = now; this.used = 0; this.pending = new Map(); }
  async get(path, query = {}, ttl = 5, fresh = false, refresh = false) {
    const parameters = new URLSearchParams(Object.entries(query).map(([name, value]) => [name, String(value)]));
    const suffix = path + (parameters.size ? '?' + parameters : '');
    // 第五轮修复 / PLATFORM §5.2.2：成交直连与缓存读取分开复用，直连只共享本请求的结果。
    const pendingKey = (fresh ? 'live:' : '') + suffix;
    if (refresh) this.pending.delete(pendingKey);
    if (this.pending.has(pendingKey)) return this.pending.get(pendingKey);
    const promise = this.load(suffix, ttl, fresh);
    this.pending.set(pendingKey, promise);
    return promise;
  }
  async load(suffix, ttl, fresh) {
    const key = new Request('https://trade-cache.game.inc.re' + suffix);
    const cache = globalThis.caches?.default;
    const cached = !fresh && cache && await cache.match(key);
    if (cacheIsFresh(cached, ttl)) return cached.json();
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
      if (!fresh && cache) await cache.put(key, new Response(JSON.stringify(value), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=' + ttl,
          'X-Fetched-At': String(Date.now()) },
      }));
      return value;
    } catch { throw { status: 503, code: 'market_unavailable' }; }
    finally { clearTimeout(timer); }
  }
  spec(symbol) { return this.get('/spot/currency_pairs/' + symbol, {}, 3600); }
  book(symbol, fresh = false, refresh = false) {
    return this.get('/spot/order_book', { currency_pair: symbol, limit: 100 }, 1, fresh, refresh);
  }
  executionBook(symbol, { refresh = false } = {}) {
    // 第五轮 WS 修复 / PLATFORM §5.2.2：现货 REST 可能滞后，同一调用每个交易对只取一次 WS 快照。
    const key = 'execution-book:' + symbol;
    if (refresh || !this.pending.has(key)) this.pending.set(key, this.loadExecutionBook(symbol, refresh));
    return this.pending.get(key);
  }
  async loadExecutionBook(symbol, refresh = false) {
    try { return await this.websocketBook(symbol); }
    catch (error) {
      if (error?.code === 'upstream_budget') throw error;
      const book = await this.book(symbol, true, refresh);
      assertBookFresh(book, Date.now());
      return { ...book, bookSource: 'rest' };
    }
  }
  websocketBook(symbol) {
    // TRADE §5.3：升级连接也占一次上游预算；四秒包含握手和等待快照，终态关闭连接。
    if (this.used >= (this.budgetLimit ?? 30)) throw { code: 'upstream_budget' };
    this.used++;
    const controller = new AbortController();
    return new Promise((resolve, reject) => {
      let socket, settled = false;
      const close = () => { try { socket?.close(1000, 'snapshot complete'); } catch {} };
      const finish = (book, error) => {
        if (settled) return;
        settled = true; clearTimeout(timer);
        socket?.removeEventListener('message', message);
        socket?.removeEventListener('error', failed);
        socket?.removeEventListener('close', failed);
        if (error) controller.abort();
        close();
        if (error) reject(error); else resolve(book);
      };
      const failed = () => finish(null, { status: 503, code: 'market_unavailable' });
      const message = event => {
        try {
          const data = JSON.parse(event.data), result = data.result;
          if (data.error) { failed(); return; }
          if (data.channel !== 'spot.order_book' || data.event !== 'update') return;
          if (result?.s && result.s !== symbol) return;
          if (!Array.isArray(result?.bids) || !result.bids.length || !Array.isArray(result?.asks) || !result.asks.length) return;
          const levels = rows => rows.map(row => {
            const price = String(Array.isArray(row) ? row[0] : row.p), size = String(Array.isArray(row) ? row[1] : row.s);
            if (!Number.isFinite(Number(price)) || Number(price) <= 0 || !Number.isFinite(Number(size)) || Number(size) <= 0) {
              throw Error('invalid level');
            }
            return [price, size];
          });
          const current = Number(result.t), age = Date.now() - current;
          if (!Number.isFinite(current) || current <= 0 || age < -1000 || age > 3000) {
            finish(null, { status: 503, code: 'market_stale' }); return;
          }
          finish({ bids: levels(result.bids), asks: levels(result.asks), current, bookSource: 'ws' });
        } catch { failed(); }
      };
      const timer = setTimeout(failed, 4000);
      Promise.resolve().then(() => fetch('https://api.gateio.ws/ws/v4/', {
        headers: { Upgrade: 'websocket' }, signal: controller.signal,
      })).then(response => {
        socket = response.webSocket;
        if (!socket) { failed(); return; }
        socket.accept();
        if (settled) { close(); return; }
        socket.addEventListener('message', message);
        socket.addEventListener('error', failed);
        socket.addEventListener('close', failed);
        socket.send(JSON.stringify({ time: Math.floor(Date.now() / 1000), channel: 'spot.order_book', event: 'subscribe',
          payload: [symbol, '50', '100ms'] }));
      }).catch(failed);
    });
  }
  ticker(symbol, fresh = false) { return this.get('/spot/tickers', { currency_pair: symbol }, 2, fresh); }
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
  async futuresBook(symbol, fresh = false) {
    const book = await this.get('/futures/usdt/order_book', { contract: symbol, limit: 100 }, 1, fresh);
    // PLATFORM §5.2.2 / §6.4：真实合约current是带小数的Unix秒，读取边界统一为毫秒再查10秒新鲜度。
    const current = Number(book.current);
    return { ...book, current: current > 0 && current < 1e11 ? current * 1000 : book.current };
  }
  futuresTicker(symbol, fresh = false) { return this.get('/futures/usdt/tickers', { contract: symbol }, 2, fresh); }
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
