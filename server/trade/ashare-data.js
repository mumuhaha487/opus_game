// ASHARE §1、§1.1：腾讯 GBK 实时报价与东方财富成交、分时及日 K。
// 市价只采用腾讯盘口；惰性结算先东方财富，失败后用腾讯未复权历史价格保守撮合。
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
function signedNumeric(value) {
  if (value === '-' || value === '') return '0';
  return value.startsWith('-') ? toStr(-parse(value.slice(1))) : numeric(value, true);
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
    for (const name of ['change', 'percent', 'pe']) quote[name] = signedNumeric(fields[indexes[name]]);
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
    // ASHARE §3.2：分时标签是分钟结束时间（09:31 覆盖 09:30–09:31），零量不是成交。
    const end = localTimestamp(fields[0]);
    return { t: end - 60000, high, low, candle: true, end, volume: numeric(fields[5]) };
  }).filter(event => parse(event.volume) > 0n);
}
export function parseDaily(data) {
  if (!data || !Array.isArray(data.klines)) throw Error('missing daily bars');
  return data.klines.map(row => {
    const fields = row.split(','), high = numeric(fields[3]), low = numeric(fields[4]);
    if (parse(high) < parse(low)) throw Error('invalid bar');
    const time = localTimestamp(fields[0]);
    return { t: time, high, low, candle: true, end: time + 19800000, volume: numeric(fields[5]) };
  }).filter(event => parse(event.volume) > 0n);
}
export function parseDetails(data, date) {
  if (!data || !Array.isArray(data.details)) throw Error('missing details');
  return data.details.map(row => {
    const fields = row.split(',');
    if (!/^\d{2}:\d{2}:\d{2}$/.test(fields[0])) throw Error('invalid trade time');
    const time = chinaTime(date.replace(/-/g, '') + fields[0].replace(/:/g, ''));
    const price = numeric(fields[1]);
    return { t: time, low: price, high: price, candle: false, end: time + 1, volume: numeric(fields[2]) };
  }).filter(event => parse(event.volume) > 0n);
}
export function parseTencentMinutes(payload, code) {
  // 撮合只使用本分钟确实成交过的单个价格，不能把上一分钟收盘价算作本分钟高低价。
  // 客户端 parseTencentBars 用上一分钟收盘作 open 仅供画图；这里扩大价格区间会造成虚假成交。
  const data = payload?.data?.[code];
  if (payload?.code !== 0 || !data) throw Error('missing tencent minutes');
  const days = Array.isArray(data.data) ? data.data : [data.data];
  return days.flatMap(day => {
    const date = String(day.date).replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3');
    if (!Array.isArray(day.data) || !day.data.length) throw Error('missing minute rows');
    let cumulative = 0n, previousTime = 0;
    return day.data.map(row => {
      const [hhmm, price, lots] = row.split(/\s+/);
      if (!/^\d{4}$/.test(hhmm)) throw Error('invalid minute');
      const end = localTimestamp(date + ' ' + hhmm.slice(0, 2) + ':' + hhmm.slice(2));
      const close = numeric(price), total = parse(numeric(lots));
      if (parse(close) <= 0n || total < cumulative || end <= previousTime) throw Error('invalid minute');
      const volume = toStr(total - cumulative);
      cumulative = total; previousTime = end;
      return { t: end - 60000, end, candle: true, open: close, close, high: close, low: close, volume };
    }).filter(event => parse(event.volume) > 0n);
  }).sort((left, right) => left.t - right.t);
}
export function parseTencentDaily(payload, code) {
  // 撮合必须是 day；即使存在 qfqday 也不能把复权价当成实际成交价。
  const rows = payload?.data?.[code]?.day;
  if (payload?.code !== 0 || !Array.isArray(rows) || !rows.length) throw Error('missing unadjusted daily bars');
  return rows.map(([date, first, last, maximum, minimum, lots]) => {
    const open = numeric(first), close = numeric(last), high = numeric(maximum), low = numeric(minimum);
    if (parse(low) <= 0n || parse(high) < parse(open) || parse(high) < parse(close)
      || parse(low) > parse(open) || parse(low) > parse(close)) throw Error('invalid daily bar');
    const t = localTimestamp(date);
    return { t, end: t + 19800000, candle: true, open, close, high, low, volume: numeric(lots) };
  }).filter(event => parse(event.volume) > 0n);
}
function eastData(payload) {
  if (payload.rc !== undefined && payload.rc !== 0 || !payload.data) throw Error('eastmoney unavailable');
  return payload.data;
}
const tencentPath = 'https://web.ifzq.gtimg.cn/appstock/app/';
export class AshareClient {
  constructor(budget, now = Date.now()) {
    this.budget = budget; this.now = now; this.pending = new Map(); this.quoteMap = {}; this.liveQuoteMap = {};
  }
  load(url, ttl, decode, fresh = false) {
    const pendingKey = (fresh ? 'live:' : '') + url;
    if (!this.pending.has(pendingKey)) this.pending.set(pendingKey, upstream(url, ttl, decode, this.budget, fresh));
    return this.pending.get(pendingKey);
  }
  async quotes(codes, fresh = false) {
    codes.forEach(validateCode);
    // 第五轮修复 / PLATFORM §5.2.2：成交报价不能复用普通查询的边缘缓存结果。
    const quoteMap = fresh ? this.liveQuoteMap : this.quoteMap;
    const missing = [...new Set(codes)].filter(code => !quoteMap[code]).sort();
    if (missing.length) {
      const result = await this.load('https://qt.gtimg.cn/q=' + missing.join(','), 1, async response =>
        parseTencent(new TextDecoder('gbk').decode(await response.arrayBuffer())), fresh);
      if (missing.some(code => !result[code])) throw { status: 503, code: 'market_unavailable' };
      Object.assign(quoteMap, result);
    }
    return quoteMap;
  }
  async quote(code, fresh = false) { return (await this.quotes([code], fresh))[code]; }
  async details(code, date) {
    const url = 'https://push2.eastmoney.com/api/qt/stock/details/get?secid=' + secidFor(code)
      + '&fields1=f1,f2,f3,f4&fields2=f51,f52,f53,f54,f55&pos=-50';
    // ASHARE §3.2：details 只有当日时分秒，用可信腾讯报价日期赋予日期。
    try {
      const data = await this.load(url, 1, async response => eastData(await response.json()));
      return parseDetails(data, date);
    } catch (error) {
      if (error.code === 'upstream_budget') throw error;
      // 腾讯无逐笔备用；由结算器跳过委托所在分钟，不能用整分钟回填未知成交。
      return [];
    }
  }
  async trends(code, from) {
    const url = 'https://push2.eastmoney.com/api/qt/stock/trends2/get?secid=' + secidFor(code)
      + '&fields1=f1,f2,f3,f4,f5,f6,f7,f8&fields2=f51,f52,f53,f54,f55,f56,f57,f58&ndays=5';
    try {
      return await this.load(url, 5, async response => {
        const data = eastData(await response.json());
        if (!data.trends?.length) throw Error('empty trends');
        return parseTrends(data);
      });
    } catch (error) {
      if (error.code === 'upstream_budget') throw error;
      // 当日用 minute/query；跨日仍保留原五日分钟线结算范围，每日独立累计量。
      const today = new Date(this.now + 28800000).toISOString().slice(0, 10);
      const path = from && from < today ? 'day/query?code=' : 'minute/query?code=';
      return this.load(tencentPath + path + validateCode(code), 5,
        async response => parseTencentMinutes(await response.json(), code));
    }
  }
  async daily(code, from, to) {
    const url = 'https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=' + secidFor(code)
      + '&klt=101&fqt=0&lmt=500&beg=' + from.replace(/-/g, '') + '&end=' + to.replace(/-/g, '')
      + '&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56,f57';
    try {
      return await this.load(url, 300, async response => {
        const data = eastData(await response.json());
        if (!data.klines?.length) throw Error('empty daily bars');
        return parseDaily(data);
      });
    } catch (error) {
      if (error.code === 'upstream_budget') throw error;
      const param = [validateCode(code), 'day', from, to, '500', ''].join(',');
      const rows = await this.load(tencentPath + 'fqkline/get?param=' + param, 300,
        async response => parseTencentDaily(await response.json(), code));
      const begin = localTimestamp(from), end = localTimestamp(to) + 19800000;
      return rows.filter(event => event.t >= begin && event.end <= end);
    }
  }
}
