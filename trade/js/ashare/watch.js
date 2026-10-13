// ASHARE §6：本地自选与会话云自选合并，最多50个；切换账号后重新按该账号合并。
export class Watchlist {
  constructor(api, modals, onChange) {
    Object.assign(this, { api, modals, onChange, codes: [], generation: -1 });
    try {
      const value = JSON.parse(localStorage.getItem('gameinc_ashare_fav_v1'));
      if (Array.isArray(value)) this.codes = value.filter(code => /^(sh|sz)\d{6}$/.test(code)).slice(0, 50);
    } catch { /* unavailable */ }
  }
  sync(state) {
    if (!state || this.generation === this.api.generation) return;
    this.generation = this.api.generation;
    this.codes = [...new Set([...(state.ashare.watch || []), ...this.codes])].slice(0, 50);
    this.store();
    if (JSON.stringify(this.codes) !== JSON.stringify(state.ashare.watch || [])) this.persist();
  }
  toggle(code) {
    if (this.codes.includes(code)) this.codes = this.codes.filter(value => value !== code);
    else if (this.codes.length < 50) this.codes.push(code);
    else { this.modals.toast('最多保留 50 个自选'); return; }
    this.store(); this.onChange(); if (this.api.logged()) this.persist();
  }
  store() { try { localStorage.setItem('gameinc_ashare_fav_v1', JSON.stringify(this.codes)); } catch { /* unavailable */ } }
  persist() {
    const codes = [...this.codes];
    this.queue = (this.queue || Promise.resolve()).then(() => this.api.post('ashare/watch', { codes }))
      .catch(error => this.modals.error(error));
  }
}
