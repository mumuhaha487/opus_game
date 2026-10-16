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
  return (await windowSlot(bucket, kind, key, seconds, limit, count)).wait;
}
// 预占一个名额：返回 { wait, stamp }，wait 为 0 时 stamp 是本次记入的时间戳，releaseWindow 凭它退回这一个名额。
export const reserveWindow = (bucket, kind, key, seconds, limit) => windowSlot(bucket, kind, key, seconds, limit, true);
const windowPath = async (kind, key) =>
  `rl/${kind}/${hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(kind + ':' + key))))}`;
async function windowSlot(bucket, kind, key, seconds, limit, count) {
  const now = Date.now(), span = seconds * 1000, path = await windowPath(kind, key);
  for (let attempt = 0; attempt < 64; attempt++) {
    const object = await bucket.get(path);
    let stamps = [];
    try { stamps = object ? JSON.parse(await object.text()) : []; } catch { stamps = []; }
    stamps = (Array.isArray(stamps) ? stamps : []).filter(time => Number.isFinite(time) && Math.floor(time) > now - span && time <= now + 60000)
      .sort((x, y) => x - y);
    if (stamps.length >= limit) return { wait: Math.max(1, Math.ceil((Math.floor(stamps[stamps.length - limit]) + span - now) / 1000)) };
    if (!count) return { wait: 0 };
    // 毫秒后面加随机小数：同一毫秒的并发预占也各有各的时间戳，退回时只删自己那一个
    const stamp = now + Math.random();
    stamps.push(stamp);
    const onlyIf = object ? { etagMatches: object.etag } : absent();
    if (await bucket.put(path, JSON.stringify(stamps.slice(-limit)), { onlyIf })) return { wait: 0, stamp };
  }
  return { wait: seconds };
}
// 退回 reserveWindow 预占的名额：只删除那一个时间戳，条件写冲突时重读重试；已经滑出窗口或找不到时不写。
export async function releaseWindow(bucket, kind, key, stamp) {
  if (stamp === undefined) return;
  const path = await windowPath(kind, key);
  for (let attempt = 0; attempt < 64; attempt++) {
    const object = await bucket.get(path);
    let stamps = null;
    try { stamps = object ? JSON.parse(await object.text()) : null; } catch { stamps = null; }
    const index = Array.isArray(stamps) ? stamps.indexOf(stamp) : -1;
    if (index < 0) return;
    stamps.splice(index, 1);
    if (await bucket.put(path, JSON.stringify(stamps), { onlyIf: { etagMatches: object.etag } })) return;
  }
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
