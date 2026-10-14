// 全站 GameAccount 会话下的交易请求、状态与历史读取。
// SPEC-FEED §3：服务端调节 60/300 秒轮询，隐藏暂停；POST 直接应用完整 state。
import { WorkerPoll } from './worker-poll.js';
export const pendingSettlement = state => !!(state?.openOrders.length || state?.futures.positions.length);
export class TradeApi {
  constructor(onChange, onNotice) {
    this.state = null; this.onChange = onChange; this.onNotice = onNotice; this.lastRequest = 0; this.generation = 0;
    this.historyCache = new Map(); this.previousPrice = null;
    this.poll = new WorkerPoll(() => this.loadState(), 300, () => this.logged());
    GameAccount.onProfileChange(() => this.accountChanged());
  }
  logged() { return !!GameAccount.profile(); }
  apply(state) {
    if (JSON.stringify(this.state?.recent) !== JSON.stringify(state.recent)) this.historyCache.clear();
    this.state = state; this.onChange(state);
    for (const notice of state.notices || []) this.onNotice(notice.text);
  }
  refresh() {
    if (!this.logged()) return Promise.resolve();
    return this.poll.run(true);
  }
  async loadState() {
    this.lastRequest = Date.now(); const generation = this.generation;
    try {
      let cadence;
      const state = await GameAccount.request('/api/trade/state', 'GET', undefined, false,
        response => { cadence = response.headers.get('X-Poll-After'); });
      if (generation === this.generation) {
        this.poll.after(cadence || (pendingSettlement(state) ? 60 : 300)); this.apply(state);
      }
    } catch (error) {
      if (error.status === 401 && generation === this.generation) {
        GameAccount.clearProfile(); this.state = null; this.onChange(null);
      }
      throw error;
    }
  }
  async post(path, data) {
    const generation = this.generation;
    let result;
    try { result = await GameAccount.request('/api/trade/' + path, 'POST', data); }
    catch (error) {
      // PLATFORM §4：拒绝发生在交易前，确认同一个声明后保留原委托参数与clientId再提交。
      if (error.data?.error !== 'disclaimer_required' || !this.onDisclaimer) throw error;
      await this.onDisclaimer();
      if (generation !== this.generation) throw error;
      result = await GameAccount.request('/api/trade/' + path, 'POST', data);
    }
    if (generation === this.generation) {
      this.historyCache.clear(); this.apply(result); this.poll.touch(pendingSettlement(result) ? 60 : 300);
    }
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
    clearTimeout(this.poll.timer); this.previousPrice = null;
    this.generation++; this.state = null; this.historyCache.clear(); this.onChange(null);
    // A response belonging to the old login is discarded before the new login's initial read.
    if (this.poll.pending) await this.poll.pending;
    await this.refresh();
  }
  crossing(feed) {
    // Realtime ticks update local valuation only; they never accelerate Worker synchronization.
    this.previousPrice = Number(feed.tickers[feed.market].get(feed.symbol)?.last);
  }
}
