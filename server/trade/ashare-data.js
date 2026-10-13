// ASHARE §1、§1.1：腾讯 GBK 实时报价与东方财富成交、分时及日 K。
// 市价只采用腾讯盘口；东方财富历史数据只用于委托后的惰性结算。
// 服务端字段表独立导出，供下一轮客户端字段表与构建检查对照。
import { parse, toStr } from './decimal.js';
import { upstream, chinaTime } from './upstream.js';
export const QUOTE_FIELDS = Object.freeze({
  name: 1, code: 2, last: 3, prevClose: 4, open: 5, volume: 6,
  bidPrices: [9, 11, 13, 15, 17], bidSizes: [10, 12, 14, 16, 18],
  askPrices: [19, 21, 23, 25, 27], askSizes: [20, 22, 24, 26, 28],
  time: 30, change: 31, percent: 32, high: 33, low: 34, turnover: 37,
  turnoverRate: 38, pe: 39, limitUp: 47, limitDown: 48, type: 61,
});
export function validateCode(code) {
  // PLATFORM §5.2.7：严格沪深代码白名单形状，不允许路径、北交所或原型键。
  if (typeof code !== 'string' || !/^(sh|sz)\d{6}$/.test(code)) throw { status: 400, code: 'not_a_share' };
  return code;
}
export const secidFor = code => (validateCode(code).startsWith('sh') ? '1.' : '0.') + code.slice(2);
function numeric(value, zero = false) {
  if ((value === '' || value === '-') && zero) return '0';
  return toStr(parse(value));
}
export function parseTencent(text) {
  const quotes = {};
  for (const match of text.matchAll(/v_((?:sh|sz)\d{6})="([^"]*)"/g)) {
    const code = match[1], fields = match[2].split('~'), indexes = QUOTE_FIELDS;
    if (fields.length <= indexes.type || fields[indexes.code] !== code.slice(2)) throw Error('invalid quote');
    const quote = { code, name: fields[indexes.name], type: fields[indexes.type], time: chinaTime(fields[indexes.time]) };
    for (const name of ['last', 'prevClose', 'open', 'volume', 'high', 'low', 'turnover', 'turnoverRate']) {
      quote[name] = numeric(fields[indexes[name]], true);
    }
    // ASHARE §1.1：指数限价字段 -1 保留为 null，指数只能用于展示和交易日判断。
    for (const name of ['limitUp', 'limitDown']) {
      quote[name] = fields[indexes[name]] === '-1' ? null : numeric(fields[indexes[name]], true);
    }
    for (const side of ['bid', 'ask']) quote[side + 's'] = indexes[side + 'Prices'].map((index, offset) =>
      [numeric(fields[index], true), numeric(fields[indexes[side + 'Sizes'][offset]], true)]);
    quote.suspended = quote.last === '0' || (quote.volume === '0'
      && [...quote.bids, ...quote.asks].every(([price, size]) => price === '0' || size === '0'));
    quotes[code] = quote;
  }
  if (!Object.keys(quotes).length) throw Error('missing quotes');
  return quotes;
}
function localTimestamp(value) {
  if (!/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?$/.test(value)) throw Error('invalid bar time');
  return chinaTime(value.replace(/\D/g, '') + (value.length === 10 ? '093000' : '00'));
}
export function parseTrends(data) {
  if (!data || !Array.isArray(data.trends)) throw Error('missing trends');
  // ASHARE §3.2 实测适配：trends2 的 f54/f55 才是高/低，f53 是收盘；报告附原始证据。
  return data.trends.map(row => {
    const fields = row.split(',');
    const high = numeric(fields[3]), low = numeric(fields[4]);
    if (parse(high) < parse(low)) throw Error('invalid bar');
    return { t: localTimestamp(fields[0]), high, low, candle: true, end: localTimestamp(fields[0]) + 60000 };
  });
}
export function parseDaily(data) {
  if (!data || !Array.isArray(data.klines)) throw Error('missing daily bars');
  return data.klines.map(row => {
    const fields = row.split(','), high = numeric(fields[3]), low = numeric(fields[4]);
    if (parse(high) < parse(low)) throw Error('invalid bar');
    const time = localTimestamp(fields[0]);
    return { t: time, high, low, candle: true, end: time + 19800000 };
  });
}
export function parseDetails(data, date) {
  if (!data || !Array.isArray(data.details)) throw Error('missing details');
  return data.details.map(row => {
    const fields = row.split(',');
    if (!/^\d{2}:\d{2}:\d{2}$/.test(fields[0])) throw Error('invalid trade time');
    const time = chinaTime(date.replace(/-/g, '') + fields[0].replace(/:/g, ''));
    const price = numeric(fields[1]);
    return { t: time, low: price, high: price, candle: false, end: time + 1 };
  });
}
export class AshareClient {
  constructor(budget, now = Date.now()) { this.budget = budget; this.now = now; this.pending = new Map(); }
  load(url, ttl, decode) {
    if (!this.pending.has(url)) this.pending.set(url, upstream(url, ttl, decode, this.budget));
    return this.pending.get(url);
  }
  async quotes(codes) {
    codes.forEach(validateCode);
    const url = 'https://qt.gtimg.cn/q=' + [...new Set(codes)].sort().join(',');
    const result = await this.load(url, 1, async response =>
      parseTencent(new TextDecoder('gbk').decode(await response.arrayBuffer())));
    if (codes.some(code => !result[code])) throw { status: 503, code: 'market_unavailable' };
    return result;
  }
  async quote(code) { return (await this.quotes([code]))[code]; }
  async details(code, date) {
    const url = 'https://push2.eastmoney.com/api/qt/stock/details/get?secid=' + secidFor(code)
      + '&fields1=f1,f2,f3,f4&fields2=f51,f52,f53,f54,f55&pos=-50';
    // ASHARE §3.2：details 只有当日时分秒，用可信腾讯报价日期赋予日期。
    const data = await this.load(url, 1, async response => (await response.json()).data);
    try { return parseDetails(data, date); } catch { throw { status: 503, code: 'market_unavailable' }; }
  }
  trends(code) {
    const url = 'https://push2.eastmoney.com/api/qt/stock/trends2/get?secid=' + secidFor(code)
      + '&fields1=f1,f2,f3,f4,f5,f6,f7,f8&fields2=f51,f52,f53,f54,f55,f56,f57,f58&ndays=5';
    return this.load(url, 5, async response => parseTrends((await response.json()).data));
  }
  daily(code, from, to) {
    const url = 'https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=' + secidFor(code)
      + '&klt=101&fqt=0&lmt=500&beg=' + from.replace(/-/g, '') + '&end=' + to.replace(/-/g, '')
      + '&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56,f57';
    return this.load(url, 300, async response => parseDaily((await response.json()).data));
  }
}
