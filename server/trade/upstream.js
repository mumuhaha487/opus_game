// 腾讯、东方财富与汇率的服务端上游读取边界。
// TRADE §5.3 / ASHARE §3：缓存命中免预算，所有市场共享每请求 30 次 fetch。
// 合成缓存键、8 秒超时；只缓存成功解码的数据，不缓存错误响应。
export async function upstream(url, ttl, decode, budget) {
  const key = new Request('https://trade-cache.game.inc.re/external?url=' + encodeURIComponent(url));
  const cache = globalThis.caches?.default;
  const cached = cache && await cache.match(key);
  if (cached) return cached.json();
  if (budget) {
    if (budget.used >= (budget.budgetLimit ?? 30)) throw { code: 'upstream_budget' };
    budget.used++;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: '*/*' } });
    if (!response.ok) throw Error('upstream');
    const value = await decode(response);
    if (cache) await cache.put(key, new Response(JSON.stringify(value), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=' + ttl },
    }));
    return value;
  } catch { throw { status: 503, code: 'market_unavailable' }; }
  finally { clearTimeout(timer); }
}
export function chinaTime(value) {
  if (!/^\d{14}$/.test(value)) throw Error('invalid time');
  const iso = value.slice(0, 4) + '-' + value.slice(4, 6) + '-' + value.slice(6, 8)
    + 'T' + value.slice(8, 10) + ':' + value.slice(10, 12) + ':' + value.slice(12, 14) + '+08:00';
  const time = Date.parse(iso);
  const roundtrip = new Date(time + 28800000).toISOString().replace(/\D/g, '').slice(0, 14);
  if (!Number.isFinite(time) || roundtrip !== value) throw Error('invalid time');
  return time;
}
