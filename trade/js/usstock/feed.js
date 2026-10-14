// 美股浏览器行情：腾讯报价（qt → sqt 回退）、分时/五日/日周月 K。全部浏览器直连，不消耗 Worker 额度。
// 常规时段且页面可见时每 5 秒刷新报价；休市 60 秒；隐藏时暂停。图表数据 30 秒刷新。
import './universe.js';
import { usMarketStatus, nyTime, nyOffsetMinutes } from './calendar.js';
const UNIVERSE = globalThis.US_UNIVERSE, INDICES = globalThis.US_INDICES;
const BY_TICKER = new Map(UNIVERSE.map(row => [row.ticker, row]));
const num = value => { const n = Number(value); return Number.isFinite(n) ? n : 0; };
// 美东时间 "YYYY-MM-DD HH:MM:SS" → UTC 毫秒
const nyStamp = text => {
  const m = /^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(text || '');
  return m ? nyTime(m[1], +m[2], +m[3]) + +m[4] * 1000 : 0;
};
export function parseUsQuotes(text) {
  const quotes = {};
  for (const m of text.matchAll(/v_us([A-Z.]+)="200~([^"]*)"/g)) {
    const f = ('200~' + m[2]).split('~'), id = m[1];
    if (BY_TICKER.has(id) && f.length > 37) {
      quotes[id] = { ticker: id, name: BY_TICKER.get(id).name, code: f[2], last: num(f[3]), prevClose: num(f[4]), open: num(f[5]),
        volume: num(f[6]), bid: num(f[9]), bidSize: num(f[10]), ask: num(f[19]), askSize: num(f[20]), time: nyStamp(f[30]),
        change: num(f[31]), percent: num(f[32]), high: num(f[33]), low: num(f[34]), turnover: num(f[37]) };
    } else if (INDICES.some(([code]) => code === id) && f.length > 34) {
      // 指数与个股同一长格式（无买卖盘）。
      quotes[id] = { ticker: id, name: f[1], last: num(f[3]), prevClose: num(f[4]), open: num(f[5]), time: nyStamp(f[30]),
        change: num(f[31]), percent: num(f[32]), high: num(f[33]), low: num(f[34]), index: true };
    }
  }
  return quotes;
}
// 腾讯分钟行：["0930 346.97 495439", …]，标签为美东分钟结束；显示用上一分钟收盘作 open。
function minuteRows(day) {
  const date = String(day.date).replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3'), rows = [];
  let previous = 0, cumulative = 0;
  for (const text of day.data || []) {
    const [hhmm, price, total] = text.split(/\s+/), close = num(price), cum = num(total);
    if (!/^\d{4}$/.test(hhmm) || !(close > 0)) continue;
    const time = Math.floor((nyTime(date, +hhmm.slice(0, 2), +hhmm.slice(2)) - 60000) / 1000);
    const open = previous || close;
    rows.push({ time, open, close, high: Math.max(open, close), low: Math.min(open, close), volume: Math.max(0, cum - cumulative), average: 0 });
    previous = close; cumulative = Math.max(cumulative, cum);
  }
  return rows;
}
export function parseUsBars(payload, code, period) {
  const data = payload?.data?.[code];
  if (payload?.code !== 0 || !data) throw Error('us bars');
  if (period === 'trends') return minuteRows(data.data);
  if (period === 'five') return (data.data || []).flatMap(minuteRows).sort((a, b) => a.time - b.time);
  const name = { 101: 'day', 102: 'week', 103: 'month' }[period];
  const rows = data['qfq' + name] || data[name] || [];
  return rows.map(([date, open, close, high, low, volume]) => ({ time: Math.floor(nyTime(date, 9, 30) / 1000),
    open: num(open), close: num(close), high: num(high), low: num(low), volume: num(volume), average: 0 }))
    .filter(row => row.close > 0).sort((a, b) => a.time - b.time);
}
// 图表时间：按美东当地时间显示（平移该时刻的 UTC 偏移，自动夏令时）。
export const nyChartTime = seconds => seconds + nyOffsetMinutes(seconds * 1000) * 60;
export class UsFeed {
  constructor(onChange) {
    this.onChange = onChange; this.quotes = {}; this.bars = new Map(); this.barsSource = new Map();
    this.code = 'AAPL'; this.period = 'trends'; this.page = null; this.timers = {}; this.status = 'loading';
    this.hosts = ['qt.gtimg.cn', 'sqt.gtimg.cn']; this.host = 0;
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.schedule(); });
  }
  market() { return usMarketStatus(Date.now()); }
  configure(page, ticker) {
    this.page = page; if (ticker && BY_TICKER.has(ticker)) this.code = ticker;
    this.schedule();
  }
  active() { return ['usstock', 'us', 'overview', 'assets'].includes(this.page) && !document.hidden; }
  schedule() {
    clearTimeout(this.timers.quotes); clearTimeout(this.timers.bars);
    if (!this.active()) return;
    this.loadQuotes(); if (this.page === 'us') this.loadBars(this.code, this.period);
  }
  async loadQuotes() {
    clearTimeout(this.timers.quotes);
    const codes = this.page === 'us' ? [this.code, ...INDICES.map(([c]) => c)]
      : [...UNIVERSE.map(row => row.ticker), ...INDICES.map(([c]) => c)];
    if (codes.length) {
      for (let attempt = 0; attempt < this.hosts.length; attempt++) {
        try {
          const response = await fetch('https://' + this.hosts[this.host] + '/q=' + codes.map(c => 'us' + c).join(','),
            { signal: AbortSignal.timeout(6000) });
          if (!response.ok) throw Error(String(response.status));
          const parsed = parseUsQuotes(new TextDecoder('gbk').decode(await response.arrayBuffer()));
          if (!Object.keys(parsed).length) throw Error('empty');
          Object.assign(this.quotes, parsed); this.status = 'ok'; this.source = this.host ? '腾讯行情（备用）' : '腾讯行情';
          break;
        } catch { this.host = (this.host + 1) % this.hosts.length; this.status = 'failed'; }
      }
      this.onChange();
    }
    if (this.active()) this.timers.quotes = setTimeout(() => this.loadQuotes(), this.market().status === 'open' ? 5000 : 60000);
  }
  async loadBars(ticker, period) {
    clearTimeout(this.timers.bars);
    const stock = BY_TICKER.get(ticker); if (!stock) return;
    const code = 'us' + ticker + '.' + stock.exchange, name = { 101: 'day', 102: 'week', 103: 'month' }[period];
    const path = period === 'trends' ? 'UsMinute/query?code=' + code : period === 'five' ? 'dayus/query?code=' + code
      : 'usfqkline/get?param=' + code + ',' + name + ',,,320,qfq';
    try {
      const response = await fetch('https://web.ifzq.gtimg.cn/appstock/app/' + path, { signal: AbortSignal.timeout(8000) });
      const rows = parseUsBars(await response.json(), code, period);
      this.bars.set(ticker + ':' + period, rows); this.barsSource.set(ticker + ':' + period, 'tencent'); this.onChange();
    } catch { /* keep the previous bars; retry on the next tick */ }
    if (this.active() && this.page === 'us') this.timers.bars = setTimeout(() => this.loadBars(this.code, this.period), 30000);
  }
}
