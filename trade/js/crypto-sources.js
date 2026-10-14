// Ordered browser-only transports. Gate remains the sole crypto execution provider on the server.
import { SourceHealth, SourceChain, sourceJson } from './feed-health.js';
import { BINANCE, binanceSpec, binanceSymbol, binanceInterval, binanceTicker,
  binanceBook, binanceTrade, binanceCandle } from './binance.js';
const sockets = { spot: 'wss://api.gateio.ws/ws/v4/', futures: 'wss://fx-ws.gateio.ws/v4/ws/usdt' };
const labels = ['Gate.io', 'Gate.io（轮询）', '币安（备用）', '币安（备用）'];
export class CryptoSources {
  constructor(feed) { this.feed = feed; this.states = {}; this.listVisible = false; }
  state(market) {
    if (!this.states[market]) {
      const state = { timers: new Map(), revision: 0 };
      state.health = new SourceHealth(market === 'spot' ? 4 : 2, () => {
        if (state.health.unavailable) state.exhausted = true;
        state.revision++; state.errors = {}; this.stop(market); this.status(market);
        if (!document.hidden) this.start(market);
      }, 'crypto-' + market);
      this.states[market] = state;
    }
    return this.states[market];
  }
  label(market = this.feed.market) {
    const health = this.state(market).health;
    return market === 'spot' ? labels[health.index] || '行情暂不可用' : health.index ? 'Gate.io（轮询）' : 'Gate.io';
  }
  listsVisible() { return typeof this.listVisible === 'function' ? this.listVisible() : this.listVisible; }
  status(market) {
    if (market !== this.feed.market) return;
    const health = this.state(market).health;
    this.feed.source = this.label(market); this.feed.degraded = health.index > 0;
    this.feed.status = health.unavailable || this.state(market).exhausted ? 'failed' : 'reconnecting'; this.feed.dirty = true;
    this.feed.sourceRevision = (this.feed.sourceRevision || 0) + 1;
  }
  stop(market) {
    const state = this.state(market);
    for (const timer of state.timers.values()) clearTimeout(timer);
    state.timers.clear(); state.started = false;
    const connection = this.feed.connections[market];
    if (connection) { connection.paused = true; connection.socket?.close(); }
  }
  active(market, revision) { return !document.hidden && this.state(market).revision === revision; }
  timer(market, name, action, ms) {
    const state = this.state(market); clearTimeout(state.timers.get(name));
    if (!document.hidden) state.timers.set(name, setTimeout(action, ms));
  }
  start(market) {
    if (document.hidden) return;
    const state = this.state(market); if (state.started) return; state.started = true;
    const revision = state.revision, health = state.health;
    if (health.unavailable) {
      state.attempt = (state.attempt || 0) + 1;
      this.timer(market, 'retry', () => health.select(0), Math.min(60000, 1000 * 2 ** (state.attempt - 1)));
      return;
    }
    const watchdog = () => {
      if (!this.active(market, revision)) return;
      if (health.index === 0 || market === 'spot' && health.index === 2) health.silent();
      if (health.probeDue()) this.probe(market);
      if (this.active(market, revision)) this.timer(market, 'watch', watchdog, 1000);
    };
    watchdog();
    if (health.index === 0) this.gateSocket(market);
    else if (market === 'spot' && health.index === 2) this.binanceSocket(revision);
    else this.poll(market, revision);
  }
  healthy(market) {
    const state = this.state(market); state.health.success(); state.attempt = 0; state.exhausted = false;
    if (market === this.feed.market) {
      this.feed.status = 'connected'; this.feed.source = this.label(market);
      this.feed.degraded = state.health.index > 0; this.feed.dirty = true;
    }
  }
  gateSocket(market) {
    const state = this.state(market), revision = state.revision;
    const socket = new WebSocket(sockets[market]);
    this.feed.connections[market] = { socket, paused: false };
    let failedOnce = false;
    const failed = () => {
      if (failedOnce || !this.active(market, revision)) return; failedOnce = true;
      state.health.failure();
      if (state.health.index === 0) this.timer(market, 'retry', () => this.gateSocket(market), 1000);
    };
    let errored = false;
    socket.onerror = () => { errored = true; failed(); socket.close(); };
    socket.onclose = () => { if (!this.feed.connections[market]?.paused) failed(); };
    socket.onopen = () => {
      if (!this.active(market, revision)) { socket.close(); return; }
      this.feed.subscription(market, 'subscribe');
      if (market === this.feed.market) this.feed.subscription(market, 'subscribe', true);
      this.feed.snapshot(market).catch(() => {});
      const heartbeat = () => {
        if (!this.active(market, revision)) return;
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({
          time: Math.floor(Date.now() / 1000), channel: market + '.ping' }));
        this.timer(market, 'ping', heartbeat, 15000);
      };
      this.timer(market, 'ping', heartbeat, 15000);
    };
    socket.onmessage = message => {
      if (!this.active(market, revision) || errored) return;
      try {
        const row = JSON.parse(message.data); state.health.lastMessage = Date.now();
        if (row.event === 'update' && row.result && !row.error) { state.health.message(); this.healthy(market); }
        this.feed.message(market, row);
      } catch {}
    };
  }
  async probe(market) {
    const state = this.state(market); if (state.probing) return; state.probing = true;
    state.health.lastProbe = Date.now();
    const revision = state.revision;
    let socket;
    try {
      await new Promise((resolve, reject) => {
        // A WS health probe allows the same 10s silence window as a live connection;
        // connection setup plus the first ticker can exceed the REST 5s timeout.
        const timer = setTimeout(() => reject(Error('probe timeout')), 10000);
        const finish = error => { clearTimeout(timer); error ? reject(error) : resolve(); };
        socket = new WebSocket(sockets[market]);
        socket.onopen = () => socket.send(JSON.stringify({ time: Math.floor(Date.now() / 1000),
          channel: market + '.tickers', event: 'subscribe', payload: [this.feed.symbol] }));
        socket.onmessage = event => {
          try {
            const row = JSON.parse(event.data);
            if (row.error) finish(Error('probe')); else if (row.event === 'update' && row.result) finish();
          } catch {}
        };
        socket.onerror = () => finish(Error('probe')); socket.onclose = () => finish(Error('probe'));
      });
      if (this.active(market, revision)) state.health.recovered(true);
    } catch { if (this.active(market, revision)) state.health.recovered(false); }
    finally { if (socket) { socket.onclose = null; socket.close(); } state.probing = false; }
  }
  async rest(path) {
    if (!path.startsWith('/futures/')) return sourceJson('https://api.gateio.ws/api/v4' + path);
    this.futuresRest ||= new SourceChain(2, undefined, 'gate-futures-rest');
    return this.futuresRest.read(['fx-api.gateio.ws', 'api.gateio.ws'].map(host =>
      () => sourceJson('https://' + host + '/api/v4' + path)));
  }
  async binanceReady() {
    const spec = await binanceSpec(this.feed.symbol);
    if (!spec || !binanceInterval(this.feed.interval)) throw { unsupported: true };
    if (this.feed.market === 'spot') this.feed.spec = spec; return spec;
  }
  async history(to) {
    await this.binanceReady();
    const query = new URLSearchParams({ symbol: binanceSymbol(this.feed.symbol),
      interval: binanceInterval(this.feed.interval), limit: 500 });
    if (to !== undefined) query.set('endTime', String(to * 1000));
    return (await sourceJson(BINANCE + '/klines?' + query)).map(binanceCandle);
  }
  miniHistory(symbol, limit = 24) {
    this.miniChains ||= new Map();
    if (!this.miniChains.has(symbol)) this.miniChains.set(symbol, new SourceChain(2, undefined, 'crypto-mini'));
    return this.miniChains.get(symbol).read([async () => {
      const rows = await this.rest('/spot/candlesticks?currency_pair=' + symbol + '&interval=1h&limit=' + limit);
      return rows.map(row => this.feed.normalizeCandle(row, 'spot', 1));
    }, async () => {
      if (!await binanceSpec(symbol)) throw Error('unsupported pair');
      const rows = await sourceJson(BINANCE + '/klines?symbol=' + binanceSymbol(symbol) + '&interval=1h&limit=' + limit);
      return rows.map(binanceCandle);
    }]);
  }
  async snapshotBinance(revision) {
    await this.binanceReady();
    const symbol = binanceSymbol(this.feed.symbol), routeRevision = this.feed.revision;
    const [ticker, book, trades, candles] = await Promise.all([
      sourceJson(BINANCE + '/ticker/24hr?symbol=' + symbol), sourceJson(BINANCE + '/depth?symbol=' + symbol + '&limit=20'),
      sourceJson(BINANCE + '/trades?symbol=' + symbol + '&limit=50'), this.history(),
    ]);
    if (!this.active('spot', revision) || this.feed.market !== 'spot' || this.feed.revision !== routeRevision) return;
    this.feed.saveTicker('spot', binanceTicker(ticker)); this.feed.book = binanceBook(book);
    this.feed.trades = trades.map(binanceTrade).reverse(); this.feed.candles = candles; this.healthy('spot');
  }
  async binanceSocket(revision) {
    const state = this.state('spot');
    try {
      await this.binanceReady(); if (!this.active('spot', revision)) return;
      const symbol = binanceSymbol(this.feed.symbol).toLowerCase(), interval = binanceInterval(this.feed.interval);
      const streams = [`${symbol}@ticker`, `${symbol}@depth20@1000ms`, `${symbol}@trade`, `${symbol}@kline_${interval}`];
      const socket = new WebSocket('wss://data-stream.binance.vision/stream?streams=' + streams.join('/'));
      this.feed.connections.spot = { socket, paused: false };
      socket.onopen = () => this.snapshotBinance(revision).catch(() => {});
      const list = async () => {
        if (!this.active('spot', revision)) return;
        try { await this.binanceList(); } catch {}
        if (this.active('spot', revision)) this.timer('spot', 'list', list, 10000);
      };
      list();
      socket.onmessage = event => {
        if (!this.active('spot', revision) || this.feed.market !== 'spot') return;
        try {
          const { stream, data } = JSON.parse(event.data); if (!data) return;
          state.health.message(); this.healthy('spot');
          if (stream.endsWith('@ticker')) this.feed.saveTicker('spot', binanceTicker(data));
          else if (stream.includes('@depth')) this.feed.book = binanceBook(data);
          else if (stream.endsWith('@trade')) this.feed.trades = [binanceTrade(data), ...this.feed.trades].slice(0, 60);
          else if (data.k) {
            const row = binanceCandle(data.k), index = this.feed.candles.findIndex(entry => entry.time === row.time);
            if (index < 0) this.feed.candles.push(row); else this.feed.candles[index] = row;
          }
        } catch {}
      };
      let failedOnce = false;
      const failed = () => {
        if (failedOnce || !this.active('spot', revision)) return; failedOnce = true;
        state.health.failure();
        if (state.health.index === 2) this.timer('spot', 'retry', () => this.binanceSocket(revision), 1000);
      };
      socket.onerror = () => { failed(); socket.close(); };
      socket.onclose = () => { if (!this.feed.connections.spot?.paused) failed(); };
    } catch (error) {
      if (this.active('spot', revision)) {
        if (error.unsupported) { state.health.select(4); return; }
        state.health.failure();
        if (state.health.index === 2) this.timer('spot', 'retry', () => this.binanceSocket(revision), 1000);
      }
    }
  }
  poll(market, revision) {
    const state = this.state(market), binance = market === 'spot' && state.health.index === 3;
    const launch = (name, interval, run) => {
      const execute = async () => {
        if (!this.active(market, revision)) return;
        state.errors ||= {};
        try {
          const used = await run();
          if (this.active(market, revision) && used !== false) {
            state.errors[name] = 0; if (name === 'price') this.healthy(market);
          }
        } catch {
          if (this.active(market, revision)
            && (state.errors[name] = (state.errors[name] || 0) + 1) >= state.health.failureLimit) {
            state.health.select(state.health.index + 1);
          }
        }
        if (this.active(market, revision)) this.timer(market, name, execute, interval);
      };
      execute();
    };
    if (binance) {
      this.snapshotBinance(revision).catch(() => {});
      launch('price', 2000, async () => {
        await this.binanceReady();
        const symbol = binanceSymbol(this.feed.symbol), route = this.feed.revision;
        const [ticker, book] = await Promise.all([sourceJson(BINANCE + '/ticker/24hr?symbol=' + symbol),
          sourceJson(BINANCE + '/depth?symbol=' + symbol + '&limit=20')]);
        if (!this.active(market, revision) || route !== this.feed.revision) return false;
        this.feed.saveTicker('spot', binanceTicker(ticker)); this.feed.book = binanceBook(book);
      });
      launch('trades', 3000, async () => {
        const rows = await sourceJson(BINANCE + '/trades?symbol=' + binanceSymbol(this.feed.symbol) + '&limit=50');
        if (this.active(market, revision)) this.feed.trades = rows.map(binanceTrade).reverse();
      });
      launch('candles', 15000, async () => {
        const rows = await this.history(); if (this.active(market, revision)) this.feed.candles = rows;
      });
      launch('list', 10000, () => this.binanceList());
      return;
    }
    this.feed.snapshot(market).catch(() => {});
    launch('price', 2000, async () => {
      if (market !== this.feed.market) return false;
      const path = this.feed.prefix(market), query = this.feed.parameter(market) + '=' + this.feed.symbol;
      const [ticker, book] = await Promise.all([this.rest(path + '/tickers?' + query),
        this.rest(path + '/order_book?' + query + '&limit=50')]);
      if (!this.active(market, revision)) return;
      ticker.forEach(row => this.feed.saveTicker(market, row)); this.feed.saveBook(market, book, 'all');
    });
    launch('trades', 3000, async () => {
      if (market !== this.feed.market) return false;
      const rows = await this.rest(this.feed.prefix(market) + '/trades?' + this.feed.parameter(market) + '=' + this.feed.symbol);
      if (this.active(market, revision)) this.feed.trades = this.feed.normalizeTrades(rows);
    });
    launch('candles', 15000, async () => {
      if (market !== this.feed.market) return false;
      const rows = await this.feed.history(); if (this.active(market, revision)) this.feed.candles = rows;
    });
    launch('list', 10000, async () => {
      if (!this.listsVisible()) return false;
      const rows = await this.rest(this.feed.prefix(market) + '/tickers');
      if (this.active(market, revision)) rows.forEach(row => this.feed.saveTicker(market, row));
    });
  }
  async binanceList() {
    if (!this.listsVisible()) return false;
    const rows = await sourceJson(BINANCE + '/ticker/24hr');
    for (const row of rows) this.feed.saveTicker('spot', binanceTicker(row));
  }
  activate(market) {
    const state = this.state(market); state.revision++; this.stop(market); this.status(market); this.start(market);
  }
  visibility() {
    for (const market of Object.keys(this.states)) {
      const state = this.state(market); state.revision++; this.stop(market);
      if (!document.hidden && (market === 'spot' || this.feed.wantFutures)) this.start(market);
    }
  }
}
