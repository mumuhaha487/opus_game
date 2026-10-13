// PLATFORM §2.4：USD/CNY 主源腾讯 GBK 报价，备源东方财富离岸人民币。
// 汇率缓存 60 秒，服务端检查时间；客户端传入的汇率不参与记账。
// PLATFORM §2.2：超过 10 分钟或两源失败时拒绝换汇。
import { parse } from './decimal.js';
import { upstream, chinaTime } from './upstream.js';
const PRIMARY = 'https://qt.gtimg.cn/q=whUSDCNY';
const SECONDARY = 'https://push2.eastmoney.com/api/qt/stock/get?secid=133.USDCNH&fields=f43,f86&fltt=2';
function validRate(rate, rateTime, now) {
  rate = String(rate);
  if (parse(rate) <= 0n || !Number.isFinite(rateTime) || now - rateTime > 600000 || rateTime > now + 30000) {
    throw Error('invalid rate');
  }
  return { rate, rateTime };
}
export async function getFx(now = Date.now(), budget) {
  const sources = [
    [PRIMARY, async response => {
      const text = new TextDecoder('gbk').decode(await response.arrayBuffer());
      const fields = /v_whUSDCNY="([^"]+)"/.exec(text)?.[1].split('~');
      return validRate(fields?.[3], chinaTime(fields?.[5]), now);
    }],
    [SECONDARY, async response => {
      const data = (await response.json()).data;
      return validRate(data?.f43, Number(data?.f86) * 1000, now);
    }],
  ];
  for (const [url, decode] of sources) {
    try {
      const result = await upstream(url, 60, decode, budget);
      return validRate(result.rate, result.rateTime, now);
    } catch (error) { if (error?.code === 'upstream_budget') throw error; }
  }
  throw { status: 503, code: 'fx_unavailable' };
}
export async function regionView(request, now = Date.now()) {
  const country = request.cf?.country || null, domestic = country === 'CN';
  const { rate, rateTime } = await getFx(now);
  return { country, region: domestic ? 'cn' : 'intl', currency: domestic ? 'CNY' : 'USD', usdcny: rate, rateTime };
}
