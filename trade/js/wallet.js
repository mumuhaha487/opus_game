// PLATFORM §2.3、DESIGN §4.4/4.8：原生余额与显示货币，汇率失败不伪造换算金额。
import { money } from './format.js';
import { futuresEquity } from './futures.js';
import { parseInput, inputString } from './decimal.js';
import { FxFeed } from './fx-feed.js';
export const ACCOUNTS = [['wallet', '钱包', 'USD'], ['spot', '加密现货', 'USDT'],
  ['futures', '合约', 'USDT'], ['ashare', 'A 股', 'CNY']];
export function availableFunds(state, account) {
  return account === 'wallet' ? state.wallet.usd : account === 'futures' ? state.futures.wallet
    : account === 'ashare' ? state.ashare.cash.free : state.spot.balances.find(row => row.asset === 'USDT')?.free || '0';
}
export function transferEstimate(amount, from, to, rate) {
  // PLATFORM §2.2：费用在来源单位ceil，到账按目标精度floor；展示采用与服务端相同的定点顺序。
  const value = parseInput(amount), fx = parseInput(String(rate));
  if (!value || from === to) return null;
  const scale = 10n ** 18n, exchanging = from === 'ashare' || to === 'ashare';
  if (exchanging && !fx) return null;
  const step = 10n ** BigInt(from === 'ashare' ? 16 : 10);
  const fee = exchanging ? (value * 2n + 1000n * step - 1n) / (1000n * step) * step : 0n;
  const net = value - fee;
  const converted = exchanging ? to === 'ashare' ? net * fx / scale : net * scale / fx : net;
  return { fee: inputString(fee, from === 'ashare' ? 2 : 8), received: inputString(converted, to === 'ashare' ? 2 : 8) };
}
export class WalletView {
  constructor(onChange) {
    this.currency = null; this.region = 'intl'; this.onChange = onChange; this.rate = null;
    try { this.currency = localStorage.getItem('gameinc_currency_v1'); } catch { /* unavailable */ }
    if (!['CNY', 'USD'].includes(this.currency)) this.currency = null;
    this.fx = new FxFeed();
    this.refresh();
    this.timer = setInterval(() => { if (!document.hidden) this.refresh(); }, 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.refresh(); });
  }
  async refresh() {
    if (document.hidden) return;
    if (this.pending) return this.pending;
    this.pending = this.load().finally(() => { this.pending = null; }); return this.pending;
  }
  async load() {
    try {
      const [region, fx] = await Promise.allSettled([GameAccount.region(), this.fx.read()]);
      if (region.status === 'fulfilled') { this.region = region.value.region; this.currency ||= region.value.currency; }
      if (fx.status === 'fulfilled') { this.rate = fx.value.rate; this.rateTime = fx.value.rateTime; }
      else this.rate = null;
    } catch { this.rate = null; }
    this.currency ||= 'USD';
    this.onChange();
  }
  select(currency) {
    this.currency = currency;
    try { localStorage.setItem('gameinc_currency_v1', currency); } catch { /* unavailable */ }
    this.onChange();
  }
  display(value, native = 'USD') {
    const unit = this.currency || 'USD'; let amount = value;
    if (amount != null && unit !== native) amount = !this.rate ? null : unit === 'CNY' ? amount * this.rate : amount / this.rate;
    return (unit === 'CNY' ? '¥' : '$') + money(amount);
  }
}
export function valuations(state, feed, ashare) {
  if (!state) return { wallet: 0, spot: 0, futures: 0, ashare: 0 };
  let spot = 0, cn = +state.ashare.cash.free + +state.ashare.cash.locked;
  for (const funds of state.spot.balances) {
    const quote = funds.asset === 'USDT' ? 1 : feed.tickers.spot.get(funds.asset + '_USDT')?.last;
    if (!quote) { spot = null; break; } spot += (+funds.free + +funds.locked) * +quote;
  }
  for (const holding of state.ashare.holdings) {
    const quote = ashare.quotes[holding.code]; if (!quote) { cn = null; break; } cn += +holding.qty * quote.last;
  }
  const futures = state.futures.positions.some(row => !feed.tickers.futures.get(row.symbol)?.mark_price) ? null
    : futuresEquity(feed, state.futures).equity;
  return { wallet: +state.wallet.usd, spot, futures, ashare: cn };
}
export function totalValue(values, wallet) {
  if (Object.values(values).some(value => value == null)) return null;
  const usd = values.wallet + values.spot + values.futures, cny = values.ashare;
  return wallet.currency === 'CNY' ? cny + (usd ? wallet.rate ? usd * wallet.rate : NaN : 0)
    : usd + (cny ? wallet.rate ? cny / wallet.rate : NaN : 0);
}
