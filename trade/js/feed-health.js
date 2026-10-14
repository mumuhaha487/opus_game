// SPEC-FEED §2.5: one health policy for browser-only sources; no Worker proxy for live prices.
export async function sourceJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw { status: response.status };
  return response.json();
}
export class SourceHealth {
  constructor(count, onChange = () => {}) {
    this.count = count; this.onChange = onChange; this.index = 0; this.failures = 0;
    this.recoveries = 0; this.lastProbe = Date.now(); this.lastMessage = Date.now(); this.unavailable = false;
  }
  select(index) {
    // Recovery belongs to the primary, not the backup transport. A backup switch must not
    // erase one successful primary probe or postpone the next 60s probe.
    if (this.index === 0 || index === 0) { this.recoveries = 0; this.lastProbe = Date.now(); }
    this.index = index; this.failures = 0;
    this.lastMessage = Date.now(); this.unavailable = index >= this.count; this.onChange(this);
  }
  success() { this.failures = 0; this.unavailable = false; }
  failure() { if (++this.failures >= 2) this.select(this.index + 1); }
  message() { this.lastMessage = Date.now(); this.success(); }
  silent() { if (Date.now() - this.lastMessage >= 10000) { this.select(this.index + 1); return true; } return false; }
  probeDue() { return this.index > 0 && Date.now() - this.lastProbe >= 60000; }
  recovered(ok) {
    this.lastProbe = Date.now(); this.recoveries = ok ? this.recoveries + 1 : 0;
    if (this.recoveries >= 2) this.select(0);
  }
}
export class SourceChain {
  constructor(count, onChange = () => {}) {
    this.health = new SourceHealth(count, health => { onChange(health); this.armProbe(); });
    this.retry = 0; this.retryAt = 0;
    globalThis.document?.addEventListener?.('visibilitychange', () => this.armProbe());
  }
  armProbe() {
    clearTimeout(this.probeTimer);
    if (!this.loaders || !this.health.index || document.hidden || this.probing) return;
    const delay = Math.max(0, 60000 - (Date.now() - this.health.lastProbe));
    this.probeTimer = setTimeout(() => this.probe(this.loaders[0]), delay);
    this.probeTimer.unref?.();
  }
  async probe(primary) {
    if (this.probing || !this.health.probeDue() || document.hidden) return;
    this.probing = true;
    try { await primary(); this.health.recovered(true); } catch { this.health.recovered(false); }
    finally { this.probing = false; this.armProbe(); }
  }
  async read(loaders) {
    if (document.hidden) throw Error('hidden');
    this.loaders = loaders; this.armProbe();
    this.probe(loaders[0]);
    if (this.health.unavailable) {
      if (Date.now() < this.retryAt) throw Error('sources unavailable');
      this.health.select(0);
    }
    while (!this.health.unavailable) {
      const index = this.health.index;
      try {
        const value = await loaders[index]();
        if (index !== this.health.index) continue;
        this.health.success(); this.retry = 0; return value;
      } catch (error) {
        if (index !== this.health.index) continue;
        this.health.failure();
        if (this.health.unavailable) {
          this.retryAt = Date.now() + Math.min(60000, 1000 * 2 ** this.retry++); throw error;
        }
      }
    }
    throw Error('sources unavailable');
  }
}
