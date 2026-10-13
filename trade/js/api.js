// 全站 GameAccount 会话下的交易请求、状态与历史读取。
// 规格 5.5：可见时 20 秒轮询，穿价 1 秒防抖且至少间隔 3 秒。
// partial 状态一秒后续结算；退出和换账号丢弃过期响应。
export class TradeApi {
  constructor(onChange, onNotice) {
    this.state = null; this.onChange = onChange; this.onNotice = onNotice; this.lastRequest = 0; this.generation = 0;
    this.historyCache = new Map(); this.previousPrice = null;
    setInterval(() => { if (!document.hidden && this.logged()) this.refresh(); }, 20000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && this.logged()) this.refresh(); });
    GameAccount.onProfileChange(() => this.accountChanged());
  }
  logged() { return !!GameAccount.profile(); }
  apply(state) {
    if (JSON.stringify(this.state?.recent) !== JSON.stringify(state.recent)) this.historyCache.clear();
    this.state = state; this.onChange(state);
    for (const notice of state.notices || []) this.onNotice(notice.text);
    clearTimeout(this.partialTimer);
    if (state.partial) this.partialTimer = setTimeout(() => this.refresh(), 1000);
  }
  refresh() {
    if (!this.logged()) return Promise.resolve();
    if (this.pending) return this.pending;
    this.pending = this.loadState().finally(() => { this.pending = null; });
    return this.pending;
  }
  async loadState() {
    this.lastRequest = Date.now(); const generation = this.generation;
    try {
      const state = await GameAccount.request('/api/trade/state');
      if (generation === this.generation) this.apply(state);
    } catch (error) {
      if (error.status === 401 && generation === this.generation) {
        GameAccount.clearProfile(); this.state = null; this.onChange(null);
      }
    }
  }
  async post(path, data) {
    const generation = this.generation;
    const result = await GameAccount.request('/api/trade/' + path, 'POST', data);
    if (generation === this.generation) { this.historyCache.clear(); this.apply(result); }
    return result;
  }
  async history(kind, market) {
    const key = kind + ':' + market, generation = this.generation;
    if (this.historyCache.has(key)) return this.historyCache.get(key);
    const result = await GameAccount.request('/api/trade/history?kind=' + kind + '&market=' + market);
    if (generation !== this.generation) return [];
    this.historyCache.set(key, result[kind]); return result[kind];
  }
  async accountChanged() {
    clearTimeout(this.partialTimer); clearTimeout(this.crossTimer); this.previousPrice = null;
    this.generation++; this.state = null; this.historyCache.clear(); this.onChange(null);
    await this.refresh();
    if (!this.state && this.logged()) await this.refresh();
  }
  crossing(feed) {
    const current = Number(feed.tickers[feed.market].get(feed.symbol)?.last);
    const previous = this.previousPrice; this.previousPrice = current;
    const mark = Number(feed.tickers[feed.market].get(feed.symbol)?.mark_price), previousMark = this.previousMark;
    this.previousMark = mark;
    if (!this.state) return;
    const levels = this.state.openOrders.filter(order => order.symbol === feed.symbol && order.market === feed.market)
      .map(order => Number(['stop_limit', 'stop_market'].includes(order.type) && order.status === 'new'
        ? order.stopPrice : order.price));
    const position = this.state.futures.positions.find(entry => entry.symbol === feed.symbol);
    const markLevels = feed.market === 'futures' && position ? [position.liq, position.tp, position.sl].map(Number).filter(Boolean) : [];
    const crossed = (before, after, level) => before && after && before !== after
      && ((before <= level && after >= level) || (before >= level && after <= level));
    if (!levels.some(level => crossed(previous, current, level))
      && !markLevels.some(level => crossed(previousMark, mark, level))) return;
    clearTimeout(this.crossTimer);
    this.crossTimer = setTimeout(() => {
      if (Date.now() - this.lastRequest >= 3000 && !document.hidden) this.refresh();
    }, Math.max(1000, 3000 - (Date.now() - this.lastRequest)));
  }
}
