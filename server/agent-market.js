// /api/v1 行情扩展（read）：市场清单、盘口深度、K 线。数据源与网页一致：加密 Gate.io，A 股与美股腾讯。
// 只供分析；成交价仍由下单接口按权威行情决定。参数白名单，代码一律先过各市场白名单/形状校验再拼上游地址。
import { MARKETS, marketFor } from './trade/markets.js';
import { validateCode } from './trade/ashare-data.js';
import { US_UNIVERSE, usStock, tencentCode } from './trade/us-data.js';
import { ashareRows } from './market-ashare.js';
import { nyTime } from './trade/us-calendar.js';
const fail = (status, code, message) => { throw { status, code, message }; };
const bad = () => fail(422, 'bad_request', '请求格式错误');
const text = value => value == null || value === '' ? null : String(value);
function params(url, allowed) {
  for (const name of url.searchParams.keys()) if (!allowed.includes(name) || url.searchParams.getAll(name).length !== 1) bad();
  return Object.fromEntries(allowed.map(name => [name, url.searchParams.get(name)]));
}
function integer(value, fallback, min, max) {
  if (value == null) return fallback;
  if (!/^\d{1,4}$/.test(value) || +value < min || +value > max) bad();
  return +value;
}
const usSymbol = value => { const ticker = typeof value === 'string' ? value.toUpperCase() : value; usStock(ticker); return ticker; };
const perps = MARKETS.filter(market => market.perp);
function perpFor(symbol) {
  const market = perps.find(entry => entry.perp === symbol);
  if (!market) fail(422, 'unknown_symbol', '不支持的交易对');
  return market;
}
// 腾讯日期 "YYYY-MM-DD"（A 股北京时间 / 美股美东时间）→ 当日开盘毫秒。
const chinaDay = date => Date.parse(date + 'T09:30:00+08:00');
const tencentJson = async response => {
  const payload = await response.json();
  if (payload?.code !== 0 || !payload.data) throw Error('tencent');
  return payload.data;
};
// ---------- GET /markets ----------
export async function marketsView(url, gate, us) {
  const query = params(url, ['market', 'board', 'sort', 'page']), market = query.market;
  if (market === 'crypto_spot' || market === 'crypto_futures') {
    if (query.board || query.sort || query.page) bad();
    const futures = market === 'crypto_futures';
    const tickers = await gate.get(futures ? '/futures/usdt/tickers' : '/spot/tickers', {}, 5);
    const byId = new Map(tickers.map(row => [futures ? row.contract : row.currency_pair, row]));
    return { market, markets: (futures ? perps : MARKETS).map(entry => {
      const symbol = futures ? entry.perp : entry.spot, row = byId.get(symbol) || {};
      return { symbol, name: entry.name, last: text(row.last), changePercent: text(row.change_percentage),
        high24h: text(row.high_24h), low24h: text(row.low_24h),
        quoteVolume24h: text(futures ? row.volume_24h_quote : row.quote_volume),
        ...(futures ? { markPrice: text(row.mark_price), fundingRate: text(row.funding_rate) } : {}) };
    }) };
  }
  if (market === 'usstock') {
    if (query.board || query.sort || query.page) bad();
    const quotes = await us.quotes(US_UNIVERSE.map(row => row.ticker));
    return { market, markets: US_UNIVERSE.map(row => {
      const quote = quotes[row.ticker] || {};
      return { symbol: row.ticker, name: row.name, group: row.group, exchange: row.exchange, last: text(quote.last),
        changePercent: text(quote.percent), turnover: text(quote.turnover) };
    }) };
  }
  if (market === 'ashare') {
    const board = query.board ?? '0', sort = query.sort ?? '0', page = query.page ?? '1';
    if (!/^[0-4]$/.test(board) || !/^[0-2]$/.test(sort) || !/^[1-9]\d{0,2}$/.test(page) || +page > 200) bad();
    const result = await ashareRows({ board: +board, sort: +sort, page: +page });
    return { market, board: +board, sort: +sort, page: +page, total: result.total,
      markets: result.rows.map(row => ({ symbol: row.code, name: row.name, last: text(row.last), changePercent: text(row.percent),
        change: text(row.change), turnover: text(row.turnover), turnoverRate: text(row.turnoverRate) })) };
  }
  bad();
}
// ---------- GET /depth ----------
export async function depthView(url, gate, ashare, us) {
  const query = params(url, ['market', 'symbol', 'limit']), market = query.market, limit = integer(query.limit, 20, 1, 50);
  if (market === 'crypto_spot') {
    marketFor(query.symbol);
    const book = await gate.executionBook(query.symbol);
    return { market, symbol: query.symbol, unit: '基础币数量', time: Number(book.current),
      bids: book.bids.slice(0, limit), asks: book.asks.slice(0, limit) };
  }
  if (market === 'crypto_futures') {
    perpFor(query.symbol);
    const [book, contract] = await Promise.all([gate.futuresBook(query.symbol), gate.contract(query.symbol)]);
    const multiplier = Number(contract.quanto_multiplier);
    // Gate 合约盘口 s 是张数；换算成基础币数量，与下单 qty 同单位。
    const levels = rows => rows.slice(0, limit).map(row => [String(row.p), String(+(Number(row.s) * multiplier).toPrecision(12))]);
    return { market, symbol: query.symbol, unit: '基础币数量', time: Number(book.current), bids: levels(book.bids), asks: levels(book.asks) };
  }
  if (market === 'ashare') {
    validateCode(query.symbol);
    const quote = await ashare.quote(query.symbol);
    if (!quote.type.startsWith('GP-A')) fail(422, 'not_a_share', '仅支持沪深 A 股');
    // 腾讯五档单位为手；换算为股，与下单 qty 同单位。
    const levels = rows => rows.slice(0, Math.min(limit, 5)).filter(([price]) => price !== '0')
      .map(([price, size]) => [price, String(Number(size) * 100)]);
    return { market, symbol: query.symbol, unit: '股', time: quote.time, bids: levels(quote.bids), asks: levels(quote.asks) };
  }
  if (market === 'usstock') {
    const ticker = usSymbol(query.symbol), quote = (await us.quotes([ticker]))[ticker];
    return { market, symbol: ticker, unit: '股', time: quote.time, levels: 1,
      bids: +quote.bid ? [[quote.bid, quote.bidSize]] : [], asks: +quote.ask ? [[quote.ask, quote.askSize]] : [] };
  }
  bad();
}
// ---------- GET /klines ----------
const CRYPTO_INTERVALS = { '1m': 60, '5m': 300, '15m': 900, '30m': 1800, '1h': 3600, '4h': 14400, '1d': 86400, '1w': 604800 };
const STOCK_INTERVALS = { '1m': null, '1d': 'day', '1w': 'week', '1M': 'month' };
// 腾讯分时：每分钟一个成交价与累计量（A 股为手），转成每分钟 {t, close, volume}。
function minuteRows(rows, date, toTime, lots) {
  let previous = 0;
  return rows.map(row => {
    const [hhmm, price, total] = row.split(/\s+/), cumulative = Number(total);
    const volume = Math.max(0, cumulative - previous); previous = Math.max(previous, cumulative);
    return { t: toTime(date, +hhmm.slice(0, 2), +hhmm.slice(2)), close: price, volume: String(lots ? volume * 100 : volume) };
  }).filter(row => Number(row.close) > 0);
}
export async function klinesView(url, gate, ashare, us) {
  const query = params(url, ['market', 'symbol', 'interval', 'limit']), market = query.market;
  const limit = integer(query.limit, 100, 1, 500), interval = query.interval ?? '1d';
  if (market === 'crypto_spot' || market === 'crypto_futures') {
    const seconds = CRYPTO_INTERVALS[interval]; if (!seconds) bad();
    const futures = market === 'crypto_futures';
    if (futures) perpFor(query.symbol); else marketFor(query.symbol);
    const gateInterval = interval === '1w' ? '7d' : interval, to = Math.floor(gate.now / 1000), from = to - seconds * limit;
    if (!futures) {
      const rows = await gate.candles(query.symbol, gateInterval, from, to);
      // Gate 现货：[t秒, 计价成交额, close, high, low, open, 基础币成交量, closed]
      return { market, symbol: query.symbol, interval, candles: rows.slice(-limit).map(row => ({ t: Number(row[0]) * 1000,
        open: row[5], high: row[3], low: row[4], close: row[2], volume: row[6], quoteVolume: row[1] })) };
    }
    const [rows, contract] = await Promise.all([gate.futuresCandles(query.symbol, gateInterval, from, to), gate.contract(query.symbol)]);
    const multiplier = Number(contract.quanto_multiplier);
    return { market, symbol: query.symbol, interval, candles: rows.slice(-limit).map(row => ({ t: Number(row.t) * 1000,
      open: row.o, high: row.h, low: row.l, close: row.c, volume: String(+(Number(row.v) * multiplier).toPrecision(12)),
      quoteVolume: text(row.sum) })) };
  }
  if (market !== 'ashare' && market !== 'usstock') bad();
  if (!Object.hasOwn(STOCK_INTERVALS, interval)) bad();
  const ashareMarket = market === 'ashare';
  const symbol = ashareMarket ? validateCode(query.symbol) : usSymbol(query.symbol);
  const code = ashareMarket ? symbol : tencentCode(symbol), client = ashareMarket ? ashare : us;
  const base = 'https://web.ifzq.gtimg.cn/appstock/app/';
  if (interval === '1m') {
    const data = await client.load(base + (ashareMarket ? 'minute/query?code=' : 'UsMinute/query?code=') + code, 5, tencentJson);
    const day = data[code]?.data; if (!Array.isArray(day?.data)) fail(503, 'market_unavailable', '行情服务暂时不可用，请稍后再试');
    const date = String(day.date).replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3');
    const toTime = ashareMarket ? (d, h, m) => Date.parse(`${d}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+08:00`) : nyTime;
    return { market, symbol, interval, note: '分时：每分钟一个成交价 close 与该分钟成交量（股）',
      candles: minuteRows(day.data, date, toTime, ashareMarket).slice(-limit) };
  }
  const name = STOCK_INTERVALS[interval];
  const data = await client.load(base + (ashareMarket ? 'fqkline/get?param=' : 'usfqkline/get?param=') + code + ',' + name
    + ',,,' + limit + ',qfq', 60, tencentJson);
  const rows = data[code]?.['qfq' + name] || data[code]?.[name];
  if (!Array.isArray(rows)) fail(503, 'market_unavailable', '行情服务暂时不可用，请稍后再试');
  return { market, symbol, interval, adjusted: '前复权', candles: rows.slice(-limit).map(([date, open, close, high, low, volume]) => ({
    t: ashareMarket ? chinaDay(date) : nyTime(date, 9, 30), open, high, low, close,
    // A 股日线量为手 → 股；美股为股。
    volume: ashareMarket ? String(Number(volume) * 100) : String(Number(volume)) })) };
}
// ---------- GET /quote?market=crypto_futures ----------
export async function futuresQuote(symbol, gate) {
  perpFor(symbol);
  const row = (await gate.futuresTicker(symbol))[0];
  if (!row || !(Number(row.last) > 0)) fail(503, 'market_unavailable', '行情服务暂时不可用，请稍后再试');
  return { market: 'crypto_futures', symbol, last: text(row.last), bid: text(row.highest_bid), ask: text(row.lowest_ask),
    markPrice: text(row.mark_price), indexPrice: text(row.index_price), fundingRate: text(row.funding_rate),
    changePercent: text(row.change_percentage), time: gate.now };
}
