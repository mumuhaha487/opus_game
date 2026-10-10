import { hex } from './auth.js';

export const absent = () => new Headers({ 'If-None-Match': '*' });
export const userKey = name => `users/${name.toLowerCase()}.json`;
export const saveKey = uid => `saves/${uid}/entropy-blade.json`;
export async function readSave(bucket, uid) {
  const object = await bucket.get(saveKey(uid));
  return object ? { ...(await object.json()), etag: object.etag } : { rev: 0, updated: 0, data: null, etag: null };
}
export const publicSave = s => ({ rev: s.rev, updated: s.updated, data: s.data });
export async function rateWindow(bucket, kind, key, seconds, limit, count = false) {
  const now = Math.floor(Date.now() / 1000), window = Math.floor(now / seconds);
  const hash = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(kind + ':' + key))));
  const path = `rl/${kind}/${hash}/${window}`;
  const object = await bucket.get(path);
  const n = object ? Number(await object.text()) || 0 : 0;
  const retryAfter = seconds - now % seconds;
  if (n >= limit) return retryAfter;
  if (count) await bucket.put(path, String(n + 1));
  return 0;
}
