// 浏览器直连 Gate.io 的行情连接、REST 补数据与内存缓存。
// 规格第 4 节：共享 ticker 订阅、切换撤订、心跳、退避与隐藏暂停。
// 消息只标记内存脏数据，DOM 由 app 的 requestAnimationFrame 更新。
const BASE = 'https://api.gateio.ws/api/v4';
const SOCKETS = { spot: 'wss://api.gateio.ws/ws/v4/', futures: 'wss://fx-ws.gateio.ws/v4/ws/usdt' };
const symbols = new Set(globalThis.TRADE_MARKETS.map(market => market.spot));
export class Feed {
  constructor() {
    this.market = 'spot'; this.symbol = 'BTC_USDT'; this.interval = '15m'; this.revision = 0;
    this.tickers = { spot: new Map(), futures: new Map() }; this.specs = new Map();
    this.book = { asks: [], bids: [] }; this.perpBook = { asks: new Map(), bids: new Map() };
    this.trades = []; this.candles = []; this.connections = {}; this.status = 'reconnecting';
    this.dirty = true; this.priceUp = true; this.wantFutures = false; this.received = {};
    document.addEventListener('visibilitychange', () => this.visibility());
  }
  mobile() { return matchMedia('(max-width: 767px), (max-height: 499px)').matches; }
  async rest(path) {
    const response = await fetch(BASE + path, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw Error('gate'); return response.json();
  }
  prefix(market = this.market) { return market === 'spot' ? '/spot' : '/futures/usdt'; }
  parameter(market = this.market) { return market === 'spot' ? 'currency_pair' : 'contract'; }
  async specification(market, symbol) {
    const key = market + ':' + symbol;
    let saved = this.specs.get(key);
    if (!saved) { try { saved = JSON.parse(sessionStorage.getItem('trade_spec:' + key)); } catch { /* storage unavailable */ } }
    if (saved && Date.now() - saved.at < 3600000) { this.specs.set(key, saved); return saved.value; }
    this.specRequests ||= new Map();
    if (this.specRequests.has(key)) return this.specRequests.get(key);
    const promise = this.loadSpecification(market, symbol, key).finally(() => this.specRequests.delete(key));
    this.specRequests.set(key, promise); return promise;
  }
  async loadSpecification(market, symbol, key) {
    const path = this.prefix(market) + (market === 'spot' ? '/currency_pairs/' : '/contracts/') + symbol;
    const value = await this.rest(path), entry = { at: Date.now(), value };
    this.specs.set(key, entry);
    try { sessionStorage.setItem('trade_spec:' + key, JSON.stringify(entry)); } catch { /* storage unavailable */ }
    return value;
  }
  precision() {
    if (this.market === 'spot') return Number(this.spec?.precision ?? 1);
    return (String(this.spec?.order_price_round || '0.1').split('.')[1] || '').length;
  }
  quantityPrecision() {
    if (this.market === 'spot') return Number(this.spec?.amount_precision ?? 6);
    return (String(this.spec?.quanto_multiplier || '0.0001').split('.')[1] || '').length;
  }
  multiplier() { return this.market === 'futures' ? Number(this.spec?.quanto_multiplier || 0) : 1; }
  subscription(market, event, active = false) {
    const socket = this.connections[market]?.socket;
    if (socket?.readyState !== WebSocket.OPEN) return;
    const send = (name, payload) => socket.send(JSON.stringify({ time: Math.floor(Date.now() / 1000),
      channel: market + '.' + name, event, payload }));
    if (!active) { send('tickers', [...symbols]); return; }
    send('order_book', [this.symbol, this.mobile() ? '20' : '50', market === 'spot' ? '100ms' : '0']);
    send('trades', [this.symbol]); send('candlesticks', [this.interval, this.symbol]);
  }
  connect(market) {
    if (this.connections[market]?.socket?.readyState < WebSocket.CLOSING) return;
    const connection = this.connections[market] ||= { attempts: 0 };
    clearTimeout(connection.retry);
    const socket = new WebSocket(SOCKETS[market]); connection.socket = socket;
    socket.onopen = () => {
      connection.attempts = 0;
      this.subscription(market, 'subscribe');
      if (this.market === market) { this.subscription(market, 'subscribe', true); this.status = 'connected'; }
      clearInterval(connection.heartbeat);
      connection.heartbeat = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ time: Math.floor(Date.now() / 1000),
          channel: market + '.ping' }));
      }, 15000);
      this.snapshot(market).catch(() => {}); this.dirty = true;
    };
    socket.onmessage = message => {
      try { this.message(market, JSON.parse(message.data)); } catch { /* malformed upstream message */ }
    };
    socket.onerror = () => { if (market === this.market) { this.status = 'failed'; this.dirty = true; } };
    socket.onclose = () => {
      clearInterval(connection.heartbeat);
      if (connection.paused || (market === 'futures' && !this.wantFutures)) return;
      if (market === this.market) { this.status = 'reconnecting'; this.dirty = true; }
      const delay = [1, 2, 4, 8, 15][Math.min(connection.attempts++, 4)] * 1000;
      connection.retry = setTimeout(() => this.connect(market), delay);
    };
  }
  setFuturesWanted(wanted) {
    this.wantFutures = wanted || this.market === 'futures';
    if (this.wantFutures) {
      if (this.connections.futures) this.connections.futures.paused = false;
      this.connect('futures');
    }
    else this.close('futures');
  }
  close(market) {
    const connection = this.connections[market]; if (!connection) return;
    connection.paused = true; clearTimeout(connection.retry); clearInterval(connection.heartbeat); connection.socket?.close();
  }
  async activate(market, symbol, interval = this.interval) {
    clearTimeout(this.snapshotRetry);
    this.subscription(this.market, 'unsubscribe', true);
    this.market = market; this.symbol = symbol; this.interval = interval; this.revision++;
    this.book = { asks: [], bids: [] }; this.trades = []; this.candles = []; this.spec = null;
    this.status = this.connections[market]?.socket?.readyState === WebSocket.OPEN ? 'connected' : 'reconnecting';
    this.perpBook = { asks: new Map(), bids: new Map() }; this.dirty = true;
    this.connections.spot && (this.connections.spot.paused = false);
    this.connect('spot');
    if (market === 'futures') { this.wantFutures = true; this.connections.futures && (this.connections.futures.paused = false); }
    this.setFuturesWanted(market === 'futures');
    this.subscription(market, 'subscribe', true);
    await this.snapshot(market);
  }
  snapshot(market) {
    const key = market + ':' + this.revision;
    this.snapshots ||= new Map();
    if (this.snapshots.has(key)) return this.snapshots.get(key);
    const promise = this.loadSnapshot(market).finally(() => this.snapshots.delete(key));
    this.snapshots.set(key, promise); return promise;
  }
  async loadSnapshot(market) {
    const revision = this.revision, symbol = this.symbol, interval = this.interval;
    try {
      const tickers = await this.rest(this.prefix(market) + '/tickers');
      for (const ticker of tickers) this.saveTicker(market, ticker);
      if (market !== this.market || revision !== this.revision) return;
      const specification = await this.specification(market, symbol);
      if (market !== this.market || revision !== this.revision) return;
      this.spec = specification;
      const query = this.parameter(market) + '=' + symbol;
      const results = await Promise.all([
        this.rest(this.prefix(market) + '/order_book?' + query + '&limit=' + (this.mobile() ? 20 : 50)),
        this.history(), this.rest(this.prefix(market) + '/trades?' + query + '&limit=50'),
      ]);
      if (revision !== this.revision || interval !== this.interval) return;
      this.saveBook(market, results[0], 'all');
      this.candles = results[1]; this.trades = this.normalizeTrades(results[2]); this.dirty = true;
    } catch {
      if (revision === this.revision && market === this.market) {
        this.status = 'failed'; this.dirty = true;
        clearTimeout(this.snapshotRetry);
        this.snapshotRetry = setTimeout(() => {
          if (!document.hidden && revision === this.revision && market === this.market) this.snapshot(market);
        }, 3000);
      }
    }
  }
  async history(to) {
    const market = this.market, multiplier = this.multiplier();
    const query = this.parameter() + '=' + this.symbol + '&interval=' + this.interval + '&limit=500'
      + (to === undefined ? '' : '&to=' + to);
    const rows = await this.rest(this.prefix() + '/candlesticks?' + query);
    return rows.map(row => this.normalizeCandle(row, market, multiplier)).sort((left, right) => left.time - right.time);
  }
  normalizeCandle(row, market = this.market, multiplier = this.multiplier()) {
    return market === 'spot' && Array.isArray(row)
      ? { time: Number(row[0]), open: Number(row[5]), high: Number(row[3]), low: Number(row[4]),
        close: Number(row[2]), volume: Number(row[6]) }
      : { time: Number(row.t), open: Number(row.o), high: Number(row.h), low: Number(row.l),
        close: Number(row.c), volume: Number(market === 'spot' ? row.a : row.v) * multiplier };
  }
  normalizeTrades(rows) {
    return rows.map(row => ({ id: String(row.id), price: Number(row.price),
      qty: this.market === 'spot' ? Number(row.amount) : Math.abs(Number(row.size)) * this.multiplier(),
      side: this.market === 'spot' ? row.side : Number(row.size) > 0 ? 'buy' : 'sell',
      // Gate 合约 REST 的 create_time_ms 实测仍是秒；现货 / WS 的毫秒值保留原值（规格 4.2、4.3）。
      time: Number(row.create_time_ms || row.create_time) * (Number(row.create_time_ms || row.create_time) < 1e12 ? 1000 : 1),
    })).sort((left, right) => right.time - left.time).slice(0, 60);
  }
  saveTicker(market, ticker) {
    const symbol = ticker.currency_pair || ticker.contract; if (!symbols.has(symbol)) return;
    if (!this.specs.has(market + ':' + symbol)) {
      this.specification(market, symbol).then(() => { this.dirty = true; }).catch(() => {});
    }
    const previous = this.tickers[market].get(symbol);
    if (market === this.market && symbol === this.symbol && previous) this.priceUp = Number(ticker.last) >= Number(previous.last);
    this.tickers[market].set(symbol, { ...previous, ...ticker }); this.dirty = true;
  }
  saveBook(market, snapshot, event) {
    if (market === 'spot') this.book = { asks: snapshot.asks || [], bids: snapshot.bids || [] };
    else {
      if (event === 'all') { this.perpBook.asks.clear(); this.perpBook.bids.clear(); }
      // 规格 4.3：all 替换快照；update 按价格修改，s=0 删除档位。
      for (const side of ['asks', 'bids']) for (const level of snapshot[side] || []) {
        if (Number(level.s) === 0) this.perpBook[side].delete(level.p);
        else this.perpBook[side].set(level.p, Number(level.s) * this.multiplier());
      }
      this.book = Object.fromEntries(['asks', 'bids'].map(side => [side, [...this.perpBook[side]]
        .sort((left, right) => side === 'asks' ? Number(left[0]) - Number(right[0]) : Number(right[0]) - Number(left[0]))]));
    }
    this.dirty = true;
  }
  message(market, message) {
    if (message.error || message.event === 'subscribe') return;
    const result = message.result;
    if (!result) return;
    this.received[message.channel] = (this.received[message.channel] || 0) + 1;
    if (message.channel.endsWith('.tickers')) {
      for (const ticker of Array.isArray(result) ? result : [result]) this.saveTicker(market, ticker);
      return;
    }
    if (market !== this.market) return;
    if (message.channel.endsWith('.order_book')) {
      if ((result.s || result.contract) === this.symbol) this.saveBook(market, result, message.event);
    } else if (message.channel.endsWith('.trades')) {
      const rows = (Array.isArray(result) ? result : [result]).filter(row => (row.currency_pair || row.contract) === this.symbol);
      const merged = [...this.normalizeTrades(rows), ...this.trades];
      this.trades = merged.filter((row, index) => merged.findIndex(entry => entry.id === row.id) === index).slice(0, 60);
      this.dirty = true;
    } else if (message.channel.endsWith('.candlesticks')) {
      for (const row of Array.isArray(result) ? result : [result]) {
        if (row.n !== this.interval + '_' + this.symbol || !this.spec) continue;
        const candle = this.normalizeCandle(row), index = this.candles.findIndex(entry => entry.time === candle.time);
        if (index >= 0) this.candles[index] = candle; else this.candles.push(candle);
        this.candles.sort((left, right) => left.time - right.time); this.dirty = true;
      }
    }
  }
  visibility() {
    clearTimeout(this.hideTimer);
    if (document.hidden) this.hideTimer = setTimeout(() => { this.close('spot'); this.close('futures'); }, 60000);
    else {
      for (const market of ['spot', 'futures']) if (market === 'spot' || this.wantFutures) {
        this.connections[market] && (this.connections[market].paused = false);
        this.connect(market); this.snapshot(market).catch(() => {});
      }
    }
  }
}
