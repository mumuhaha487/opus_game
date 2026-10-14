import { hex } from './auth.js';

export const absent = () => new Headers({ 'If-None-Match': '*' });
export const userKey = name => `users/${name.toLowerCase()}.json`;
export const saveKey = (uid, game) => `saves/${uid}/${game}.json`;
export async function readSave(bucket, uid, game) {
  const object = await bucket.get(saveKey(uid, game));
  return object ? { ...(await object.json()), etag: object.etag } : { rev: 0, updated: 0, data: null, etag: null };
}
export const publicSave = s => ({ rev: s.rev, updated: s.updated, data: s.data });
// 网络键：IPv4 按单个地址；IPv6 按 /64（同一家庭/设备网段可随意换地址，不能借此绕过限制）。
export function networkKey(ip) {
  if (!ip.includes(':')) return ip;
  const [left, right = ''] = ip.toLowerCase().split('::'), a = left ? left.split(':') : [], b = right ? right.split(':') : [];
  const groups = ip.includes('::') ? [...a, ...Array(Math.max(0, 8 - a.length - b.length)).fill('0'), ...b] : a;
  return groups.slice(0, 4).map(group => parseInt(group || '0', 16).toString(16)).join(':') + '::/64';
}
// 滑动窗口：rl/<kind>/<hash> 保存窗口内最近的时间戳（最多 limit 个），条件写防并发。
// 窗口内已有 limit 次时返回需要等待的秒数；count=true 时记入本次。
export async function slidingWindow(bucket, kind, key, seconds, limit, count = false) {
  const now = Date.now(), span = seconds * 1000;
  const hash = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(kind + ':' + key))));
  const path = `rl/${kind}/${hash}`;
  for (let attempt = 0; attempt < 64; attempt++) {
    const object = await bucket.get(path);
    let stamps = [];
    try { stamps = object ? JSON.parse(await object.text()) : []; } catch { stamps = []; }
    stamps = (Array.isArray(stamps) ? stamps : []).filter(time => Number.isFinite(time) && time > now - span && time <= now + 60000)
      .sort((x, y) => x - y);
    if (stamps.length >= limit) return Math.max(1, Math.ceil((stamps[stamps.length - limit] + span - now) / 1000));
    if (!count) return 0;
    stamps.push(now);
    const onlyIf = object ? { etagMatches: object.etag } : absent();
    if (await bucket.put(path, JSON.stringify(stamps.slice(-limit)), { onlyIf })) return 0;
  }
  return seconds;
}
export async function rateWindow(bucket, kind, key, seconds, limit, count = false) {
  const now = Math.floor(Date.now() / 1000), window = Math.floor(now / seconds);
  const hash = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(kind + ':' + key))));
  const path = `rl/${kind}/${hash}/${window}`;
  const retryAfter = seconds - now % seconds;
  // PLATFORM §6.5：跨isolate硬上限以R2条件写计数；并发冲突重读，耗尽重试时拒绝。
  for (let attempt = 0; attempt < 64; attempt++) {
    const object = await bucket.get(path);
    const n = object ? Number(await object.text()) || 0 : 0;
    if (n >= limit) return retryAfter;
    if (!count) return 0;
    const onlyIf = object ? { etagMatches: object.etag } : absent();
    if (await bucket.put(path, String(n + 1), { onlyIf })) return 0;
  }
  return retryAfter;
}
