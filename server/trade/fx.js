// SPEC-FEED / task-9 决策：USD/CNY 只走腾讯 qt → sqt，同厂商 GBK 报价。
// 汇率缓存 30 秒，服务端检查时间；客户端传入的汇率不参与记账。
// PLATFORM §2.2：超过 10 分钟或两源失败时拒绝换汇。
import { parse } from './decimal.js';
import { upstream, chinaTime } from './upstream.js';
const PRIMARY = 'https://qt.gtimg.cn/q=whUSDCNY';
const SECONDARY = 'https://sqt.gtimg.cn/q=whUSDCNY';
function validRate(rate, rateTime, now) {
  rate = String(rate);
  if (parse(rate) <= 0n || !Number.isFinite(rateTime) || now - rateTime > 600000 || rateTime > now + 30000) {
    throw Error('invalid rate');
  }
  return { rate, rateTime };
}
export async function getFx(now = Date.now(), budget) {
  const sources = [PRIMARY, SECONDARY].map(url => [url, async response => {
      const text = new TextDecoder('gbk').decode(await response.arrayBuffer());
      const fields = /v_whUSDCNY="([^"]+)"/.exec(text)?.[1].split('~');
      return validRate(fields?.[3], chinaTime(fields?.[5]), now);
    }]);
  for (const [url, decode] of sources) {
    try {
      const result = await upstream(url, 30, decode, budget);
      return validRate(result.rate, result.rateTime, now);
    } catch (error) { if (error?.code === 'upstream_budget') throw error; }
  }
  throw { status: 503, code: 'fx_unavailable' };
}
export async function regionView(request, now = Date.now(), debug = false) {
  const override = debug ? new URL(request.url).searchParams.get('region') : null;
  const country = ['cn', 'intl'].includes(override) ? override === 'cn' ? 'CN' : 'US' : request.cf?.country || null;
  // PLATFORM §2.3 / 第2b轮：地区独立于FX可用性；第三轮覆盖仅由本地DEBUG_REGION=1开启。
  let fx;
  try { fx = await getFx(now); } catch { fx = null; }
  return { country, region: country === 'CN' ? 'cn' : 'intl', currency: country === 'CN' ? 'CNY' : 'USD',
    usdcny: fx?.rate || null, rateTime: fx?.rateTime || null };
}
