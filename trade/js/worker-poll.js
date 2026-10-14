// SPEC-FEED §3: background API requests never faster than 60s, hidden pause, 15-minute backoff ceiling.
export const pollSeconds = value => Math.max(60, Math.min(900,
  value == null || value === '' || !Number.isFinite(Number(value)) ? 300 : Number(value)));
export const budgetFailure = error => [429, 503, 1027].includes(error?.status) || error?.data?.error === '1027';
export class WorkerPoll {
  constructor(run, seconds = 300, enabled = () => true) {
    this.action = run; this.base = pollSeconds(seconds); this.seconds = this.base; this.enabled = enabled; this.last = null;
    document.addEventListener('visibilitychange', () => {
      clearTimeout(this.timer);
      if (!document.hidden) {
        const elapsed = this.last === null ? Infinity : Date.now() - this.last;
        if (elapsed >= (this.seconds > this.base ? this.seconds : 60) * 1000) this.run(true); else this.schedule();
      }
    });
  }
  after(seconds) { this.base = pollSeconds(seconds); this.seconds = this.base; }
  touch(seconds = this.base) { this.after(seconds); this.last = Date.now(); this.schedule(); }
  schedule() {
    clearTimeout(this.timer);
    if (document.hidden || !this.enabled()) return;
    const delay = this.last === null ? 0 : Math.max(0, this.seconds * 1000 - (Date.now() - this.last));
    this.timer = setTimeout(() => this.run(), delay);
  }
  run(force = false) {
    if (document.hidden || !this.enabled()) return Promise.resolve();
    if (this.pending) return this.pending;
    if (!force && this.last !== null && Date.now() - this.last < this.seconds * 1000) {
      this.schedule(); return Promise.resolve();
    }
    this.last = Date.now();
    this.pending = Promise.resolve().then(() => this.action()).then(value => {
      this.seconds = this.base; return value;
    }).catch(error => {
      if (budgetFailure(error)) this.seconds = Math.min(900, this.seconds * 2);
      else this.seconds = Math.max(60, this.seconds);
    }).finally(() => { this.pending = null; this.schedule(); });
    return this.pending;
  }
}
