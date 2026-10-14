import { SourceChain } from './feed-health.js';
import { budgetFailure } from './worker-poll.js';
export function tencentFx(text) {
  const fields = /v_whUSDCNY="([^"]+)"/.exec(text)?.[1].split('~'), stamp = fields?.[5];
  const rate = Number(fields?.[3]);
  if (!(rate > 0) || !/^\d{14}$/.test(stamp)) throw Error('fx');
  const rateTime = Date.parse(stamp.slice(0, 4) + '-' + stamp.slice(4, 6) + '-' + stamp.slice(6, 8)
    + 'T' + stamp.slice(8, 10) + ':' + stamp.slice(10, 12) + ':' + stamp.slice(12) + '+08:00');
  if (!Number.isFinite(rateTime)) throw Error('fx'); return { rate, rateTime };
}
export class FxFeed {
  constructor() { this.chain = new SourceChain(3, undefined, 'fx'); this.regionDelay = 600000; }
  async regionRate() {
    const now = Date.now();
    if (this.regionNext > now) {
      if (this.regionError) throw this.regionError; return this.regionValue;
    }
    this.regionNext = now + this.regionDelay;
    try {
      // The first relay attempt reuses the session's initial region request; later attempts refresh FX only.
      const region = this.regionRead ? await GameAccount.request('/api/region') : await GameAccount.region();
      this.regionRead = true;
      if (!(Number(region.usdcny) > 0) || !(Number(region.rateTime) > 0)) throw Error('fx');
      this.regionValue = { rate: +region.usdcny, rateTime: +region.rateTime }; this.regionError = null;
      this.regionDelay = 600000; this.regionNext = now + this.regionDelay; return this.regionValue;
    } catch (error) {
      this.regionRead = true;
      if (budgetFailure(error)) this.regionDelay = Math.min(900000, this.regionDelay * 2);
      this.regionNext = now + this.regionDelay; this.regionError = error; throw error;
    }
  }
  read() {
    return this.chain.read([...['qt.gtimg.cn', 'sqt.gtimg.cn'].map(host => async () => {
        const response = await fetch('https://' + host + '/q=whUSDCNY', { signal: AbortSignal.timeout(5000) });
        if (!response.ok) throw Error('fx');
        return tencentFx(new TextDecoder('gbk').decode(await response.arrayBuffer()));
      }), () => this.regionRate()]);
  }
}
