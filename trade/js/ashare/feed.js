// ASHARE §1、§5：GBK腾讯报价、东方财富图表/逐笔/榜单；可见时共用调度和退避。
// 字段表与服务端独立维护，由build逐值检查；客户端数据仅用于展示。
import { INDICES, BOARDS, SORTS } from './universe.js';
import { SourceChain } from '../feed-health.js';
import { budgetFailure } from '../worker-poll.js';
export const QUOTE_FIELDS = Object.freeze({
  name: 1, code: 2, last: 3, prevClose: 4, open: 5, volume: 6,
  bidPrices: [9, 11, 13, 15, 17], bidSizes: [10, 12, 14, 16, 18],
  askPrices: [19, 21, 23, 25, 27], askSizes: [20, 22, 24, 26, 28],
  time: 30, change: 31, percent: 32, high: 33, low: 34, turnover: 37,
  turnoverRate: 38, pe: 39, limitUp: 47, limitDown: 48, type: 61,
});
export const secidFor = code => (code.startsWith('sh') ? '1.' : '0.') + code.slice(2);
export function parseTencent(text) {
  const quotes = {};
  for (const match of text.matchAll(/v_((?:sh|sz)\d{6})="([^"]*)"/g)) {
    const code = match[1], fields = match[2].split('~');
    if (fields.length <= 61 || fields[2] !== code.slice(2)) continue;
    const quote = { code };
    for (const name of ['name', 'type']) quote[name] = fields[QUOTE_FIELDS[name]];
    for (const name of ['last', 'prevClose', 'open', 'volume', 'change', 'percent', 'high', 'low',
      'turnover', 'turnoverRate', 'pe', 'limitUp', 'limitDown']) {
      const value = Number(fields[QUOTE_FIELDS[name]]);
      quote[name] = Number.isFinite(value) ? value : null;
    }
    const stamp = fields[30];
    quote.time = /^\d{14}$/.test(stamp) ? Date.parse(stamp.slice(0, 4) + '-' + stamp.slice(4, 6) + '-' + stamp.slice(6, 8)
      + 'T' + stamp.slice(8, 10) + ':' + stamp.slice(10, 12) + ':' + stamp.slice(12) + '+08:00') : 0;
    for (const side of ['bid', 'ask']) quote[side + 's'] = QUOTE_FIELDS[side + 'Prices'].map((index, offset) =>
      [Number(fields[index]) || 0, Number(fields[QUOTE_FIELDS[side + 'Sizes'][offset]]) || 0]);
    quote.suspended = !quote.last || !quote.volume && [...quote.bids, ...quote.asks].every(row => !row[0] || !row[1]);
    quotes[code] = quote;
  }
  if (!Object.keys(quotes).length) throw Error('missing quotes');
  return quotes;
}
export const chinaDay = now => new Date(now + 28800000).toISOString().slice(0, 10);
export function marketClock(now, index) {
  const today = chinaDay(now), local = new Date(now + 28800000), minute = local.getUTCHours() * 60 + local.getUTCMinutes();
  const weekend = [0, 6].includes(local.getUTCDay());
  const holiday = weekend || minute >= 570 && minute < 900 && index && chinaDay(index.time) !== today;
  const status = holiday ? 'holiday' : minute >= 570 && minute < 690 || minute >= 780 && minute < 900 ? 'open'
    : minute >= 690 && minute < 780 ? 'lunch' : 'closed';
  let target = Date.parse(today + (status === 'open' ? minute < 690 ? 'T11:30:00' : 'T15:00:00'
    : status === 'lunch' ? 'T13:00:00' : 'T09:30:00') + '+08:00');
  if (status !== 'open' && status !== 'lunch') while (target <= now || [0, 6].includes(new Date(target + 28800000).getUTCDay())) {
    target += 86400000;
  }
  return { status, target, label: { open: '交易中', lunch: '午间休市', closed: '已收盘', holiday: '今日休市' }[status] };
}
const EAST = 'https://push2.eastmoney.com/api/qt/';
export function parseBars(data, trends = false) {
  const rows = trends ? data?.trends : data?.klines;
  if (!Array.isArray(rows)) throw Error('missing bars');
  // ASHARE §1 实测修正：f53收盘，f54/f55最高/最低，f58均价。
  return rows.map(row => {
    const fields = row.split(','), stamp = fields[0].replace(' ', 'T');
    return { time: Date.parse(stamp + (stamp.length === 10 ? 'T09:30:00' : ':00') + '+08:00') / 1000,
      open: +fields[1], close: +fields[2], high: +fields[3], low: +fields[4], volume: +fields[5], average: +fields[7] };
  }).filter(row => Number.isFinite(row.time) && row.close > 0);
}
export function parseTencentBars(payload, code, period) {
  if (payload?.code !== 0) throw Error('tencent bars');
  const data = payload.data?.[code], rows = [];
  const minutes = (day, date, prevClose) => {
    const compact = String(date).replaceAll('-', '');
    if (!/^\d{8}$/.test(compact) || !Array.isArray(day)) throw Error('minute data');
    const localDate = compact.slice(0, 4) + '-' + compact.slice(4, 6) + '-' + compact.slice(6);
    let previous = 0, previousClose = Number(prevClose);
    if (!(previousClose > 0)) throw Error('previous close');
    for (const text of day) {
      const [hhmm, price, cumulative, amount] = text.split(/\s+/), value = Number(price), volume = Number(cumulative);
      if (!/^\d{4}$/.test(hhmm) || !(value > 0) || !Number.isFinite(volume) || volume < previous) throw Error('minute row');
      rows.push({ time: Date.parse(localDate + 'T' + hhmm.slice(0, 2) + ':' + hhmm.slice(2) + ':00+08:00') / 1000,
        open: previousClose, high: Math.max(previousClose, value), low: Math.min(previousClose, value),
        close: value, volume: volume - previous,
        average: volume > 0 ? Number(amount) / (volume * 100) : 0 });
      previous = volume; previousClose = value;
    }
  };
  if (period === 'trends') minutes(data?.data?.data, data?.data?.date, data?.qt?.[code]?.[QUOTE_FIELDS.prevClose]);
  else if (period === 'five') {
    if (!Array.isArray(data?.data)) throw Error('five days');
    for (const day of data.data) minutes(day.data, day.date, day.prec);
  } else {
    const name = { 101: 'day', 102: 'week', 103: 'month' }[period];
    const candles = data?.['qfq' + name] || data?.[name];
    if (!name || !Array.isArray(candles)) throw Error('kline data');
    for (const [date, open, close, high, low, volume] of candles) rows.push({
      time: Date.parse(date + 'T09:30:00+08:00') / 1000,
      open: +open, close: +close, high: +high, low: +low, volume: +volume, average: 0,
    });
  }
  const valid = [...new Map(rows.filter(row => Number.isFinite(row.time) && row.close > 0).map(row => [row.time, row])).values()]
    .sort((a, b) => a.time - b.time);
  if (!valid.length) throw Error('empty bars'); return valid;
}
export class AshareFeed {
  constructor(onChange) {
    this.onChange = onChange; this.quotes = {}; this.bars = new Map(); this.trades = []; this.ranking = [];
    this.list = []; this.total = 0; this.tasks = new Map(); this.status = 'connecting'; this.page = 'overview';
    this.codes = INDICES.map(([code]) => code); this.board = 0; this.sort = 0; this.pageNumber = 1;
    this.barsSource = new Map(); this.barsFetchedAt = new Map(); this.eastBarsRetryAt = 0;
    this.barChains = new Map(); this.detailsChain = new SourceChain(2, undefined, 'ashare-details');
    this.listChain = new SourceChain(3, undefined, 'ashare-list');
    this.workerLists = new Map(); this.workerDelay = 60000;
    this.quoteChain = new SourceChain(3, health => {
      this.source = health.index === 2 ? '腾讯行情（中转·30秒）' : '腾讯行情'; this.degraded = health.index > 0;
      this.status = health.unavailable ? 'failed' : 'connecting'; this.onChange();
    }, 'ashare-quotes');
    document.addEventListener('visibilitychange', () => {
      for (const task of this.tasks.values()) clearTimeout(task.timer);
      if (!document.hidden) this.schedule();
    });
  }
  async json(url) {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const text = await response.text();
    let value;
    try { value = JSON.parse(text); }
    catch { throw { status: /\b1027\b/.test(text) ? 1027 : response.status }; }
    if (!response.ok) throw { status: response.status, data: value }; return value;
  }
  configure(page, code, extra = []) {
    this.page = page; this.code = code;
    this.codes = [...new Set([...INDICES.map(([value]) => value), ...(code ? [code] : []), ...extra])].slice(0, 60);
    this.schedule();
  }
  schedule() {
    this.poll('quotes', () => this.loadQuotes(), () => this.quoteChain.health.index === 2
      ? this.quoteWorkerDelay || 30000 : this.clock().status === 'open' ? 3000 : 60000);
    if (this.page === 'stock') {
      this.poll('bars', () => this.loadBars(this.code, this.period || 'trends'), () => 30000);
      this.poll('details', () => this.loadDetails(), () => this.clock().status === 'open' ? 5000 : 60000);
    }
    const listInterval = () => this.listFallback ? this.workerDelay : this.clock().status === 'open' ? 30000 : 60000;
    if (this.page === 'ashare') this.poll('list', () => this.loadList(), listInterval);
    if (['overview', 'ashare'].includes(this.page)) {
      if (this.page === 'overview') this.poll('rank', () => this.loadRank(), listInterval);
      this.poll('indices', async () => Promise.all(INDICES.map(([code]) => this.loadBars(code))), () => 30000);
    }
  }
  enabled(name) {
    return name === 'quotes' || ['bars', 'details'].includes(name) && this.page === 'stock'
      || name === 'list' && this.page === 'ashare' || name === 'rank' && this.page === 'overview'
      || name === 'indices' && ['overview', 'ashare'].includes(this.page);
  }
  poll(name, run, interval) {
    let task = this.tasks.get(name);
    if (!task) { task = { attempts: 0, revision: 0 }; this.tasks.set(name, task); }
    clearTimeout(task.timer); task.run = run; task.interval = interval;
    if (document.hidden || task.busy) return;
    const execute = async () => {
      if (document.hidden || !this.enabled(name)) return;
      task.busy = true;
      try { await task.run(); task.attempts = 0; if (name === 'quotes') this.status = 'connected'; }
      catch { task.attempts++; if (name === 'quotes') this.status = 'failed'; }
      finally {
        task.busy = false; this.onChange();
        const worker = ['list', 'rank'].includes(name) && this.listFallback;
        const relay = name === 'quotes' && this.quoteChain.health.index >= 2;
        const delay = worker ? this.workerDelay : relay ? this.quoteWorkerDelay || 30000
          : task.attempts ? [3000, 6000, 12000, 30000][Math.min(task.attempts - 1, 3)] : task.interval();
        if (!document.hidden && this.enabled(name)) task.timer = setTimeout(execute, delay);
      }
    };
    execute();
  }
  clock() { return marketClock(Date.now(), this.quotes.sh000001); }
  async loadQuotes() {
    const codes = [...this.codes];
    const load = host => async () => {
      const response = await fetch('https://' + host + '/q=' + codes.join(','), { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw Error('quotes');
      const data = parseTencent(new TextDecoder('gbk').decode(await response.arrayBuffer()));
      if (codes.some(code => !data[code])) throw Error('missing quotes'); return data;
    };
    const quotes = await this.quoteChain.read([...['qt.gtimg.cn', 'sqt.gtimg.cn'].map(load), async () => {
      // One relay request per 30s across route changes and repeated failed-source attempts.
      const now = Date.now();
      if (this.quoteWorkerNext > now) {
        if (this.quoteWorkerError) throw this.quoteWorkerError;
        if (codes.some(code => !this.quoteWorkerValue?.[code])) throw Error('relay waiting');
        return this.quoteWorkerValue;
      }
      this.quoteWorkerNext = now + (this.quoteWorkerDelay || 30000);
      try {
        const data = await this.json('/api/market/ashare-quotes?codes=' + [...codes].sort().join(','));
        if (codes.some(code => !data[code])) throw Error('missing quotes');
        this.quoteWorkerDelay = 30000; this.quoteWorkerNext = now + 30000;
        this.quoteWorkerValue = data; this.quoteWorkerError = null; return data;
      } catch (error) {
        if (budgetFailure(error)) this.quoteWorkerDelay = Math.min(900000, (this.quoteWorkerDelay || 30000) * 2);
        this.quoteWorkerNext = now + (this.quoteWorkerDelay || 30000); this.quoteWorkerError = error; throw error;
      }
    }]);
    Object.assign(this.quotes, quotes); this.status = 'connected'; this.degraded = this.quoteChain.health.index > 0;
    this.source = this.quoteChain.health.index === 2 ? '腾讯行情（中转·30秒）' : '腾讯行情';
  }
  async loadBars(code, period = 'trends') {
    const key = code + ':' + period;
    if (this.bars.has(key) && Date.now() - this.barsFetchedAt.get(key) < 30000) return this.bars.get(key);
    const trends = ['trends', 'five'].includes(period), parameters = new URLSearchParams({ secid: secidFor(code),
      fields1: 'f1,f2,f3,f4,f5,f6,f7,f8', fields2: 'f51,f52,f53,f54,f55,f56,f57,f58',
      ...(trends ? { ndays: period === 'five' ? '5' : '1' } : { klt: period, fqt: '1', lmt: '500', end: '20500101' }) });
    const prefix = trends ? EAST + 'stock/trends2/get?' : 'https://push2his.eastmoney.com/api/qt/stock/kline/get?';
    let source;
    if (!this.barChains.has(key)) this.barChains.set(key, new SourceChain(2, undefined, 'ashare-bars-' + period));
    const rows = await this.barChains.get(key).read([async () => {
      const payload = await this.json(prefix + parameters);
      if (payload.rc !== undefined && payload.rc !== 0) throw Error('east rc');
      const bars = parseBars(payload.data, trends); if (!bars.length) throw Error('empty bars');
      source = 'eastmoney'; return bars;
    }, async () => {
      const name = { 101: 'day', 102: 'week', 103: 'month' }[period];
      const path = period === 'trends' ? 'minute/query?code=' + code : period === 'five' ? 'day/query?code=' + code
        : name ? 'fqkline/get?param=' + code + ',' + name + ',,,320,qfq' : null;
      if (!path) throw Error('unsupported fallback period');
      const bars = parseTencentBars(await this.json('https://web.ifzq.gtimg.cn/appstock/app/' + path), code, period);
      source = 'tencent'; return bars;
    }]);
    source = this.barChains.get(key).health.index === 0 ? 'eastmoney' : 'tencent';
    this.bars.set(key, rows); this.barsSource.set(key, source); this.barsFetchedAt.set(key, Date.now()); return rows;
  }
  async loadDetails() {
    const code = this.code;
    try {
      const payload = await this.detailsChain.read(['push2', 'push2delay'].map(host => async () => {
        const value = await this.json(`https://${host}.eastmoney.com/api/qt/stock/details/get?secid=` + secidFor(code)
          + '&fields1=f1,f2,f3,f4&fields2=f51,f52,f53,f54,f55&pos=-50');
        if (value.rc !== undefined && value.rc !== 0 || !value.data?.details?.length) throw Error('details'); return value;
      }));
      if (code !== this.code) return;
      this.trades = payload.data.details.map(row => {
        const fields = row.split(','); return { time: fields[0], price: +fields[1], qty: +fields[2], side: +fields[4] };
      }); this.detailsUnavailable = false;
    } catch {
      if (code !== this.code) return; this.trades = []; this.detailsUnavailable = true;
    }
  }
  async listRequest(sort = this.sort, page = this.pageNumber) {
    const [, fid, po] = SORTS[sort], query = new URLSearchParams({ pn: page, pz: 50, po, np: 1, fltt: 2, invt: 2,
      fid, fs: BOARDS[this.board][1], fields: 'f12,f13,f14,f2,f3,f4,f5,f6,f7,f8,f15,f16,f17,f18' });
    const direct = ['push2', 'push2delay'].map(host => async () => {
      const payload = await this.json(`https://${host}.eastmoney.com/api/qt/clist/get?` + query), data = payload.data;
      if (payload.rc !== undefined && payload.rc !== 0 || !data || !Array.isArray(data.diff) || !data.diff.length) {
        throw Error('list');
      }
      this.listFallback = false;
      return { total: data.total, source: 'eastmoney', rows: data.diff.map(row => ({
        code: (row.f13 === 1 ? 'sh' : 'sz') + row.f12, name: row.f14, last: row.f2, percent: row.f3,
        change: row.f4, turnover: row.f6, turnoverRate: row.f8, high: row.f15, low: row.f16 })) };
    });
    const health = this.listChain.health;
    if (!document.hidden && health.index === 0 && !health.worked.size && !this.listPrefetched) {
      // Only the first public-list attempt overlaps the two hosts. Selection stays ordered;
      // the Worker loader remains lazy and is never called unless both public requests fail.
      this.listPrefetched = true;
      direct.forEach((load, index) => {
        const pending = load(); pending.catch(() => {}); let first = true;
        direct[index] = () => { if (first) { first = false; return pending; } return load(); };
      });
    }
    return this.listChain.read([...direct, async () => {
      this.listFallback = true;
      if (sort > 2) { sort = 0; this.sort = 0; }
      const parameters = new URLSearchParams({ board: String(this.board), sort: String(sort), page: String(page) });
      const key = String(parameters), cached = this.workerLists.get(key);
      if (cached && Date.now() < cached.next) {
        if (cached.error) throw cached.error; return cached.value;
      }
      try {
        const value = await this.json('/api/market/ashare-list?' + parameters);
        this.workerDelay = 60000; this.listBusy = false;
        this.workerLists.set(key, { value, next: Date.now() + 60000 }); return value;
      } catch (error) {
        if (budgetFailure(error)) this.workerDelay = Math.min(900000, this.workerDelay * 2);
        this.listBusy = true;
        this.workerLists.set(key, { value: cached?.value, error, next: Date.now() + this.workerDelay }); throw error;
      }
    }]);
  }
  async loadList() {
    const board = this.board, sort = this.sort, page = this.pageNumber;
    const result = await this.listRequest();
    if (board !== this.board || page !== this.pageNumber || this.sort !== sort && !(sort > 2 && this.sort === 0)) return;
    this.list = result.rows; this.total = result.total; this.listSource = result.source;
  }
  async loadRank() { this.ranking = (await this.listRequest(this.rankSort || 0, 1)).rows.slice(0, 10); }
}
