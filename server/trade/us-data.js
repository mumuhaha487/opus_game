// 美股行情：成交价取新浪实时（服务端带 Referer），腾讯报价作为同等新鲜度要求下的备用与估值来源；
// 挂单惰性结算用腾讯分钟（当日 UsMinute、近 5 日 dayus）与未复权日 K（kline/kline）。
// 所有上游请求计入同一个每请求 30 次预算；数值一律十进制字符串。
import '../../trade/js/usstock/universe.js';
import { parse, toStr } from './decimal.js';
import { upstream } from './upstream.js';
import { nyTime } from './us-calendar.js';
export const US_UNIVERSE = globalThis.US_UNIVERSE;
const BY_TICKER = new Map(US_UNIVERSE.map(row => [row.ticker, row]));
export function usStock(ticker) {
  // 白名单：名单外代码、指数、路径字符一律拒绝。
  if (typeof ticker !== 'string' || !BY_TICKER.has(ticker)) throw { status: 400, code: 'unknown_symbol' };
  return BY_TICKER.get(ticker);
}
export const tencentCode = ticker => 'us' + ticker + '.' + usStock(ticker).exchange;
const number = value => {
  if (value == null || value === '' || value === '-') return '0';
  return toStr(parse(String(value).trim()));
};
// 腾讯 v_usAAPL="200~苹果~AAPL.OQ~last~prev~open~volume~…~bid(9)~bidSize(10)~…~ask(19)~askSize(20)~…~time(30, 美东)~change~pct~high~low~USD~…"
export const US_QUOTE_FIELDS = Object.freeze({ name: 1, code: 2, last: 3, prevClose: 4, open: 5, volume: 6,
  bid: 9, bidSize: 10, ask: 19, askSize: 20, time: 30, change: 31, percent: 32, high: 33, low: 34, currency: 35, turnover: 37 });
const nyStamp = text => {
  const match = /^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(text || '');
  if (!match) throw Error('invalid time');
  return nyTime(match[1], +match[2], +match[3]) + +match[4] * 1000;
};
export function parseTencentUs(text) {
  const quotes = {};
  for (const match of text.matchAll(/v_us([A-Z.]+)="200~([^"]*)"/g)) {
    const ticker = match[1]; if (!BY_TICKER.has(ticker)) continue;
    const fields = ('200~' + match[2]).split('~'), f = US_QUOTE_FIELDS;
    if (fields.length <= f.turnover || fields[f.currency] !== 'USD') throw Error('invalid us quote');
    const quote = { ticker, name: BY_TICKER.get(ticker).name, code: fields[f.code], time: nyStamp(fields[f.time]), source: 'tencent' };
    for (const name of ['last', 'prevClose', 'open', 'volume', 'bid', 'bidSize', 'ask', 'askSize', 'high', 'low', 'turnover']) {
      quote[name] = number(fields[f[name]]);
    }
    quote.change = fields[f.change]?.startsWith('-') ? toStr(-parse(fields[f.change].slice(1))) : number(fields[f.change]);
    quote.percent = fields[f.percent]?.startsWith('-') ? toStr(-parse(fields[f.percent].slice(1))) : number(fields[f.percent]);
    quotes[ticker] = quote;
  }
  if (!Object.keys(quotes).length) throw Error('missing us quotes');
  return quotes;
}
// 新浪 hq_str_gb_aapl="名称,last,pct,北京时间,change,open,high,low,…,volume(10),…,prevClose(26),…"
export function parseSinaUs(text) {
  const quotes = {};
  for (const match of text.matchAll(/hq_str_gb_([a-z.]+)="([^"]*)"/g)) {
    const ticker = match[1].toUpperCase(); if (!BY_TICKER.has(ticker) || !match[2]) continue;
    const fields = match[2].split(',');
    if (fields.length < 27 || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(fields[3])) throw Error('invalid sina quote');
    const time = Date.parse(fields[3].replace(' ', 'T') + '+08:00');
    quotes[ticker] = { ticker, name: BY_TICKER.get(ticker).name, last: number(fields[1]), open: number(fields[5]),
      high: number(fields[6]), low: number(fields[7]), volume: number(fields[10]), prevClose: number(fields[26]),
      time, regularTime: fields[25] || '', source: 'sina' };
  }
  if (!Object.keys(quotes).length) throw Error('missing sina quotes');
  return quotes;
}
// 腾讯分钟（UsMinute 当日 / dayus 近 5 日）：每分钟一个成交价 + 累计成交量；标签为美东分钟结束时刻。
// 撮合只用这一分钟确实成交过的价格（open = high = low = close），不能把上一分钟收盘当作本分钟区间。
export function parseUsMinutes(payload, code) {
  const data = payload?.data?.[code];
  if (payload?.code !== 0 || !data) throw Error('missing us minutes');
  const days = Array.isArray(data.data) ? data.data : [data.data];
  return days.flatMap(day => {
    const date = String(day?.date || '').replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(day.data)) throw Error('missing us minute rows');
    let cumulative = 0n;
    return day.data.map(row => {
      const [hhmm, price, total] = row.split(/\s+/);
      if (!/^\d{4}$/.test(hhmm)) throw Error('invalid minute');
      const end = nyTime(date, +hhmm.slice(0, 2), +hhmm.slice(2)), close = number(price), cum = parse(number(total));
      const volume = cum >= cumulative ? cum - cumulative : 0n; cumulative = cum > cumulative ? cum : cumulative;
      return { t: end - 60000, end, candle: true, open: close, close, high: close, low: close, volume: toStr(volume) };
    }).filter(event => parse(event.close) > 0n && parse(event.volume) > 0n);
  }).sort((left, right) => left.t - right.t);
}
// 未复权日 K：kline/kline 的 day 字段 [日期, 开, 收, 高, 低, 量]；会话为当日 09:30–16:00 ET。
export function parseUsDaily(payload, code) {
  const rows = payload?.data?.[code]?.day;
  if (payload?.code !== 0 || !Array.isArray(rows) || !rows.length) throw Error('missing us daily bars');
  return rows.map(([date, open, close, high, low, volume]) => ({ date, t: nyTime(date, 9, 30), end: nyTime(date, 16, 0),
    candle: true, open: number(open), close: number(close), high: number(high), low: number(low), volume: number(volume) }))
    .filter(row => parse(row.high) >= parse(row.low) && parse(row.low) > 0n);
}
export class UsClient {
  constructor(budget, now = Date.now()) {
    this.budget = budget; this.now = now; this.pending = new Map(); this.quoteMap = {};
  }
  load(url, ttl, decode, fresh = false) {
    const key = (fresh ? 'live:' : '') + url;
    if (!this.pending.has(key)) this.pending.set(key, upstream(url, ttl, decode, this.budget, fresh));
    return this.pending.get(key);
  }
  // 展示与估值报价（腾讯，可能延迟）。
  async quotes(tickers, fresh = false) {
    tickers.forEach(usStock);
    const list = [...new Set(tickers)].sort(), query = list.map(t => 'us' + t).join(',');
    for (const host of ['qt.gtimg.cn', 'sqt.gtimg.cn']) {
      try {
        return await this.load('https://' + host + '/q=' + query, 3, async response => {
          const quotes = parseTencentUs(new TextDecoder('gbk').decode(await response.arrayBuffer()));
          if (list.some(t => !quotes[t])) throw Error('missing quote');
          return quotes;
        }, fresh);
      } catch (error) { if (error.code === 'upstream_budget') throw error; }
    }
    throw { status: 503, code: 'market_unavailable' };
  }
  // 成交价：新浪实时（带 Referer，不走缓存）；失败或过期时由调用方决定是否接受腾讯备用（同样要新鲜）。
  async realtime(ticker) {
    usStock(ticker);
    const key = 'sina:' + ticker;
    if (!this.pending.has(key)) this.pending.set(key, (async () => {
      if (this.budget.used >= (this.budget.budgetLimit ?? 30)) throw { code: 'upstream_budget' };
      this.budget.used++;
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 6000);
      try {
        const response = await fetch('https://hq.sinajs.cn/list=gb_' + ticker.toLowerCase(), { signal: controller.signal,
          headers: { Referer: 'https://finance.sina.com.cn/', 'User-Agent': 'Mozilla/5.0' } });
        if (!response.ok) throw Error('sina ' + response.status);
        return parseSinaUs(new TextDecoder('gbk').decode(await response.arrayBuffer()))[ticker];
      } finally { clearTimeout(timer); }
    })());
    return this.pending.get(key);
  }
  minutes(ticker, multiDay = false) {
    const code = tencentCode(ticker);
    const path = multiDay ? 'dayus/query?code=' : 'UsMinute/query?code=';
    return this.load('https://web.ifzq.gtimg.cn/appstock/app/' + path + code, 5,
      async response => parseUsMinutes(await response.json(), code));
  }
  daily(ticker, count = 30) {
    const code = tencentCode(ticker);
    return this.load('https://web.ifzq.gtimg.cn/appstock/app/kline/kline?param=' + code + ',day,,,' + count, 300,
      async response => parseUsDaily(await response.json(), code));
  }
}
