import { hex } from './auth.js';

export const absent = () => new Headers({ 'If-None-Match': '*' });
export const userKey = name => `users/${name.toLowerCase()}.json`;
export const saveKey = (uid, game) => `saves/${uid}/${game}.json`;
export async function readSave(bucket, uid, game) {
  const object = await bucket.get(saveKey(uid, game));
  return object ? { ...(await object.json()), etag: object.etag } : { rev: 0, updated: 0, data: null, etag: null };
}
export const publicSave = s => ({ rev: s.rev, updated: s.updated, data: s.data });
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
