// ASHARE §1、§5：GBK腾讯报价、东方财富图表/逐笔/榜单；可见时共用调度和退避。
// 字段表与服务端独立维护，由build逐值检查；客户端数据仅用于展示。
import { INDICES, BOARDS, SORTS } from './universe.js';
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
export class AshareFeed {
  constructor(onChange) {
    this.onChange = onChange; this.quotes = {}; this.bars = new Map(); this.trades = []; this.ranking = [];
    this.list = []; this.total = 0; this.tasks = new Map(); this.status = 'connecting'; this.page = 'overview';
    this.codes = INDICES.map(([code]) => code); this.board = 0; this.sort = 0; this.pageNumber = 1;
    document.addEventListener('visibilitychange', () => {
      for (const task of this.tasks.values()) clearTimeout(task.timer);
      if (!document.hidden) this.schedule();
    });
  }
  async json(url) {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw Error('upstream'); return response.json();
  }
  configure(page, code, extra = []) {
    this.page = page; this.code = code;
    this.codes = [...new Set([...INDICES.map(([value]) => value), ...(code ? [code] : []), ...extra])].slice(0, 60);
    this.schedule();
  }
  schedule() {
    this.poll('quotes', () => this.loadQuotes(), () => this.clock().status === 'open' ? 3000 : 60000);
    if (this.page === 'stock') {
      this.poll('bars', () => this.loadBars(this.code, this.period || 'trends'), () => 30000);
      this.poll('details', () => this.loadDetails(), () => this.clock().status === 'open' ? 5000 : 60000);
    }
    if (this.page === 'ashare') this.poll('list', () => this.loadList(), () => this.clock().status === 'open' ? 30000 : 60000);
    if (this.page === 'overview') {
      this.poll('rank', () => this.loadRank(), () => this.clock().status === 'open' ? 30000 : 60000);
      this.poll('indices', async () => Promise.all(INDICES.map(([code]) => this.loadBars(code))), () => 30000);
    }
  }
  enabled(name) {
    return name === 'quotes' || ['bars', 'details'].includes(name) && this.page === 'stock'
      || name === 'list' && this.page === 'ashare' || ['rank', 'indices'].includes(name) && this.page === 'overview';
  }
  poll(name, run, interval) {
    let task = this.tasks.get(name);
    if (!task) { task = { attempts: 0, revision: 0 }; this.tasks.set(name, task); }
    clearTimeout(task.timer); task.run = run; task.interval = interval;
    if (document.hidden || task.busy) return;
    const execute = async () => {
      if (document.hidden || !this.enabled(name)) return;
      task.busy = true;
      try { await task.run(); task.attempts = 0; this.status = 'connected'; }
      catch { task.attempts++; this.status = 'failed'; }
      finally {
        task.busy = false; this.onChange();
        const delay = task.attempts ? [3000, 6000, 12000, 30000][Math.min(task.attempts - 1, 3)] : task.interval();
        if (!document.hidden && this.enabled(name)) task.timer = setTimeout(execute, delay);
      }
    };
    execute();
  }
  clock() { return marketClock(Date.now(), this.quotes.sh000001); }
  async loadQuotes() {
    const response = await fetch('https://qt.gtimg.cn/q=' + this.codes.join(','), { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw Error('quotes');
    Object.assign(this.quotes, parseTencent(new TextDecoder('gbk').decode(await response.arrayBuffer())));
  }
  async loadBars(code, period = 'trends') {
    const trends = ['trends', 'five'].includes(period), parameters = new URLSearchParams({ secid: secidFor(code),
      fields1: 'f1,f2,f3,f4,f5,f6,f7,f8', fields2: 'f51,f52,f53,f54,f55,f56,f57,f58',
      ...(trends ? { ndays: period === 'five' ? '5' : '1' } : { klt: period, fqt: '1', lmt: '500', end: '20500101' }) });
    const prefix = trends ? EAST + 'stock/trends2/get?' : 'https://push2his.eastmoney.com/api/qt/stock/kline/get?';
    const rows = parseBars((await this.json(prefix + parameters)).data, trends);
    this.bars.set(code + ':' + period, rows); return rows;
  }
  async loadDetails() {
    const code = this.code, data = (await this.json(EAST + 'stock/details/get?secid=' + secidFor(code)
      + '&fields1=f1,f2,f3,f4&fields2=f51,f52,f53,f54,f55&pos=-50')).data;
    if (code !== this.code) return;
    this.trades = (data?.details || []).map(row => {
      const fields = row.split(','); return { time: fields[0], price: +fields[1], qty: +fields[2], side: +fields[4] };
    });
  }
  async listRequest(sort = this.sort, page = this.pageNumber) {
    const [, fid, po] = SORTS[sort], query = new URLSearchParams({ pn: page, pz: 50, po, np: 1, fltt: 2, invt: 2,
      fid, fs: BOARDS[this.board][1], fields: 'f12,f13,f14,f2,f3,f4,f5,f6,f7,f8,f15,f16,f17,f18' });
    const data = (await this.json(EAST + 'clist/get?' + query)).data;
    if (!data || !Array.isArray(data.diff)) throw Error('list');
    return { total: data.total, rows: data.diff.map(row => ({ code: (row.f13 === 1 ? 'sh' : 'sz') + row.f12,
      name: row.f14, last: row.f2, percent: row.f3, change: row.f4, turnover: row.f6, turnoverRate: row.f8,
      high: row.f15, low: row.f16 })) };
  }
  async loadList() {
    const signature = [this.board, this.sort, this.pageNumber].join(':');
    const result = await this.listRequest();
    if (signature !== [this.board, this.sort, this.pageNumber].join(':')) return;
    this.list = result.rows; this.total = result.total;
  }
  async loadRank() { this.ranking = (await this.listRequest(this.rankSort || 0, 1)).rows.slice(0, 10); }
}
