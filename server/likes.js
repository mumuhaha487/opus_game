import '../hub/catalog.js';
import { absent } from './store.js';
import { hex } from './auth.js';

// Likes: one per network (IP) per game per day, and one per signed-in account
// per game per day; the two quotas are separate. Days follow China Standard Time.
// Daily markers live under rl/ so the bucket's one-day lifecycle rule clears them;
// the running totals live in likes/summary.json. Every write is an R2 conditional put.
const IDS = new Set(globalThis.HUB_CATALOG.games.map(g => g.id));
export const likeable = id => IDS.has(id);
const SUMMARY = 'likes/summary.json';
const KEEP_DAYS = 14;
const enc = new TextEncoder();

export const dayKey = (t = Date.now()) => new Date(t + 8 * 3600e3).toISOString().slice(0, 10);
const shiftDay = (day, n) => dayKey(Date.parse(day + 'T12:00:00Z') - 8 * 3600e3 + n * 864e5);

// IPv6 addresses rotate inside a /64, so a household counts as one network
export function ipKey(ip) {
  ip = String(ip || '').trim().toLowerCase();
  if (!ip.includes(':')) return ip || 'unknown';
  const [head, tail = ''] = ip.split('::');
  const a = head ? head.split(':') : [], b = tail ? tail.split(':') : [];
  const full = [...a, ...Array(Math.max(0, 8 - a.length - b.length)).fill('0'), ...b];
  return full.slice(0, 4).map(x => x.replace(/^0+(?=.)/, '')).join(':') + '::/64';
}
async function digest(secret, text) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(text)))).slice(0, 40);
}
async function readJSON(bucket, key) {
  const o = await bucket.get(key);
  return o ? { value: await o.json(), etag: o.etag } : { value: null, etag: null };
}
// read-modify-write with optimistic concurrency; fn returns the next value or undefined for "no change"
async function update(bucket, key, fn, tries = 8) {
  for (let i = 0; i < tries; i++) {
    const { value, etag } = await readJSON(bucket, key);
    const next = fn(value);
    if (next === undefined) return { value, changed: false };
    const ok = await bucket.put(key, JSON.stringify(next), { onlyIf: etag ? { etagMatches: etag } : absent() });
    if (ok) return { value: next, changed: true };
    await new Promise(r => setTimeout(r, 10 + Math.random() * 30 * (i + 1)));
  }
  throw new Error('contention');
}
export function counts(summary, today = dayKey()) {
  const from = shiftDay(today, -6), out = {};
  for (const id of IDS) {
    const g = summary?.games?.[id];
    let week = 0;
    if (g?.days) for (const [d, n] of Object.entries(g.days)) if (d >= from && d <= today) week += n;
    out[id] = { total: g?.total || 0, week };
  }
  return out;
}
async function keys(request, env, session, day) {
  const ip = ipKey(request.headers.get('CF-Connecting-IP'));
  return {
    ip: `rl/like/${day}/ip/${await digest(env.AUTH_SECRET, 'like-ip:' + ip)}.json`,
    user: session ? `rl/like/${day}/u/${await digest(env.AUTH_SECRET, 'like-user:' + session.user.uid)}.json` : null,
  };
}
async function mine(bucket, k) {
  const [ip, user] = await Promise.all([readJSON(bucket, k.ip), k.user ? readJSON(bucket, k.user) : null]);
  const list = v => (Array.isArray(v?.games) ? v.games.filter(id => IDS.has(id)) : []);
  return { guest: list(ip.value), user: k.user ? list(user.value) : null };
}
export async function getLikes(bucket, request, env, session) {
  const day = dayKey(), k = await keys(request, env, session, day);
  const [summary, m] = await Promise.all([readJSON(bucket, SUMMARY), mine(bucket, k)]);
  return { day, games: counts(summary.value, day), mine: m };
}
// returns { status, body }
export async function addLike(bucket, request, env, session, game) {
  const day = dayKey(), k = await keys(request, env, session, day);
  const marker = session ? k.user : k.ip;
  const claim = await update(bucket, marker, cur => {
    const games = Array.isArray(cur?.games) ? cur.games : [];
    return games.includes(game) ? undefined : { games: [...games, game] };
  });
  if (!claim.changed) {
    const [summary, m] = await Promise.all([readJSON(bucket, SUMMARY), mine(bucket, k)]);
    return { status: 409, body: { error: 'already_liked', day, games: counts(summary.value, day), mine: m } };
  }
  let summary;
  try {
    summary = await update(bucket, SUMMARY, cur => {
      const s = cur && typeof cur === 'object' && cur.games ? cur : { v: 1, games: {} };
      const g = s.games[game] || { total: 0, days: {} };
      g.total += 1; g.days[day] = (g.days[day] || 0) + 1;
      const keep = shiftDay(day, -KEEP_DAYS);
      for (const d of Object.keys(g.days)) if (d < keep) delete g.days[d];
      s.games[game] = g;
      return s;
    });
  } catch (e) {
    // give the like back if the counter could not be written
    await update(bucket, marker, cur => ({ games: (cur?.games || []).filter(id => id !== game) })).catch(() => {});
    throw e;
  }
  const all = counts(summary.value, day);
  return { status: 200, body: { day, game, count: all[game], games: all, mine: await mine(bucket, k) } };
}
