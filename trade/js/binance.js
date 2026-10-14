// Verified public mirror fields. Display only; never imported by server execution code.
import { sourceJson } from './feed-health.js';
export const BINANCE = 'https://data-api.binance.vision/api/v3';
export const binanceSymbol = symbol => /^[A-Z0-9]+_USDT$/.test(symbol) ? symbol.replace('_', '') : null;
export const binanceInterval = interval => ({ '7d': '1w', '30d': '1M' })[interval]
  || (['1m','5m','15m','30m','1h','4h','8h','1d','1w','1M'].includes(interval) ? interval : null);
export function binanceTicker(row) {
  return { currency_pair: (row.symbol ?? row.s)?.replace(/USDT$/, '_USDT'), last: row.lastPrice ?? row.c,
    change_percentage: row.priceChangePercent ?? row.P, high_24h: row.highPrice ?? row.h,
    low_24h: row.lowPrice ?? row.l, base_volume: row.volume ?? row.v, quote_volume: row.quoteVolume ?? row.q };
}
export const binanceBook = row => ({ asks: row.asks, bids: row.bids });
export const binanceTrade = row => ({ id: String(row.id ?? row.t), price: +(row.price ?? row.p), qty: +(row.qty ?? row.q),
  time: row.time ?? row.T, side: (row.isBuyerMaker ?? row.m) ? 'sell' : 'buy' });
export const binanceCandle = row => Array.isArray(row)
  ? { time: +row[0] / 1000, open: +row[1], high: +row[2], low: +row[3], close: +row[4], volume: +row[5] }
  : { time: +row.t / 1000, open: +row.o, high: +row.h, low: +row.l, close: +row.c, volume: +row.v };
export function binancePrecision(value) { return String(Number(value)).split('.')[1]?.length || 0; }
export async function binanceSpec(symbol) {
  const mapped = binanceSymbol(symbol); if (!mapped) return null;
  const key = 'trade_binance:' + mapped;
  let saved; try { saved = JSON.parse(sessionStorage.getItem(key)); } catch {}
  if (saved !== null && saved !== undefined) return saved || null;
  let data;
  try { data = await sourceJson(BINANCE + '/exchangeInfo?symbol=' + mapped); }
  catch (error) { if (error.status !== 400) throw error; data = { symbols: [] }; }
  const market = data.symbols?.find(row => row.symbol === mapped && row.status === 'TRADING' && row.isSpotTradingAllowed);
  const value = market ? { precision: binancePrecision(market.filters.find(row => row.filterType === 'PRICE_FILTER').tickSize),
    amount_precision: binancePrecision(market.filters.find(row => row.filterType === 'LOT_SIZE').stepSize) } : false;
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch {}
  return value || null;
}
