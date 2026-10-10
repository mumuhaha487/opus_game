import { ITERATIONS, USERNAME, b64url, unbase64, randomBytes, hex, equal32, passwordHash, passwordValid, signSession, sessionCookie, verifySession } from './auth.js';
import { absent, userKey, saveKey, readSave, publicSave, rateWindow } from './store.js';
import { GAMES } from './games/index.js';

const MAX = 65536;
const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
function reply(status, data, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', ...headers,
  } });
}
const fail = (status, error, headers) => reply(status, { error }, headers);
const limited = seconds => reply(429, { error: 'rate_limited', retryAfter: seconds }, { 'Retry-After': String(seconds) });
async function body(request) {
  if (Number(request.headers.get('Content-Length')) > MAX) throw { status: 413, code: 'too_large' };
  const reader = request.body?.getReader();
  const chunks = []; let size = 0;
  if (reader) while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX) { await reader.cancel(); throw { status: 413, code: 'too_large' }; }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const c of chunks) { bytes.set(c, offset); offset += c.length; }
  try { const v = JSON.parse(new TextDecoder().decode(bytes)); if (isObject(v)) return v; } catch { /* invalid JSON */ }
  throw { status: 400, code: 'bad_request' };
}
export async function handle(request, env) {
  try {
    if (!env?.ACCOUNTS || typeof env.AUTH_SECRET !== 'string' || env.AUTH_SECRET.length < 32 || typeof env.PW_PEPPER !== 'string' || env.PW_PEPPER.length < 32) return fail(500, 'server_error');
    const url = new URL(request.url), path = url.pathname, method = request.method;
    if (method === 'POST' || method === 'PUT') {
      if ((request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase() !== 'application/json') return fail(415, 'unsupported_media_type');
      const site = request.headers.get('Sec-Fetch-Site');
      if (request.headers.get('Origin') !== url.origin || (site !== null && site !== 'same-origin')) return fail(403, 'forbidden_origin');
    }
    const routes = { '/api/register': 'POST', '/api/login': 'POST', '/api/logout': 'POST', '/api/me': 'GET', '/api/saves': 'GET' };
    const match = /^\/api\/save\/([a-z0-9-]{1,32})$/.exec(path);
    const game = match && Object.hasOwn(GAMES, match[1]) ? match[1] : null;
    const allow = game ? 'GET, PUT' : Object.hasOwn(routes, path) ? routes[path] : null;
    if (!allow) return fail(404, path.startsWith('/api/save/') ? 'unknown_game' : 'not_found');
    if (!allow.split(', ').includes(method)) return fail(405, 'method_not_allowed', { Allow: allow });
    const data = method === 'POST' || method === 'PUT' ? await body(request) : null;
    const bucket = env.ACCOUNTS, ip = request.headers.get('CF-Connecting-IP') || '';
    if (path === '/api/logout') return reply(200, { ok: true }, { 'Set-Cookie': sessionCookie('', true) });
    if (path === '/api/register' || path === '/api/login') {
      const registering = path === '/api/register';
      if (registering) { const wait = await rateWindow(bucket, 'register-ip', ip, 3600, 5, true); if (wait) return limited(wait); }
      const { username, password } = data;
      if (typeof username !== 'string' || typeof password !== 'string') return fail(400, 'bad_request');
      if (registering && !USERNAME.test(username)) return fail(400, 'bad_username');
      if (registering && !passwordValid(password)) return fail(400, 'bad_password');
      const name = username.toLowerCase();
      if (!registering) {
        const waits = await Promise.all([rateWindow(bucket, 'login-name', name, 900, 10), rateWindow(bucket, 'login-ip', ip, 900, 30)]);
        if (Math.max(...waits)) return limited(Math.max(...waits));
      }
      const object = USERNAME.test(username) ? await bucket.get(userKey(name)) : null;
      let user = object ? await object.json() : null;
      if (registering) {
        if (user) return fail(409, 'name_taken');
        const salt = randomBytes(16);
        user = { v: 1, uid: hex(randomBytes(16)), name: username, salt: b64url(salt), hash: b64url(await passwordHash(password, env.PW_PEPPER, salt)), iter: ITERATIONS, sv: 1, created: Date.now() };
        if (!await bucket.put(userKey(name), JSON.stringify(user), { onlyIf: absent() })) return fail(409, 'name_taken');
      } else {
        const hash = await passwordHash(password, env.PW_PEPPER, user ? unbase64(user.salt) : undefined, user ? user.iter : ITERATIONS);
        if (!user || !equal32(hash, unbase64(user.hash))) {
          await Promise.all([rateWindow(bucket, 'login-name', name, 900, 10, true), rateWindow(bucket, 'login-ip', ip, 900, 30, true)]);
          return fail(401, 'bad_credentials');
        }
        if (user.iter < ITERATIONS) {
          user.iter = ITERATIONS; user.hash = b64url(await passwordHash(password, env.PW_PEPPER, unbase64(user.salt)));
          await bucket.put(userKey(name), JSON.stringify(user), { onlyIf: { etagMatches: object.etag } });
        }
      }
      return reply(registering ? 201 : 200, { user: { name: user.name } }, { 'Set-Cookie': sessionCookie(await signSession(user, env.AUTH_SECRET)) });
    }
    const session = await verifySession(request, env);
    if (!session) return fail(401, 'unauthorized', { 'Set-Cookie': sessionCookie('', true) });
    const user = session.user;
    if (path === '/api/me') {
      const headers = session.expires - Date.now() / 1000 < 1296000 ? { 'Set-Cookie': sessionCookie(await signSession(user, env.AUTH_SECRET)) } : {};
      return reply(200, { user: { name: user.name } }, headers);
    }
    if (path === '/api/saves') {
      const games = {};
      for (const id of Object.keys(GAMES)) {
        const saved = await readSave(bucket, user.uid, id);
        if (saved.rev > 0) games[id] = publicSave(saved);
      }
      return reply(200, { games });
    }
    if (method === 'GET') return reply(200, publicSave(await readSave(bucket, user.uid, game)));
    if (!Number.isSafeInteger(data.baseRev) || data.baseRev < 0) return fail(400, 'bad_save');
    const clean = GAMES[game].clean(data.data);
    if (!clean) return fail(400, 'bad_save');
    if (new TextEncoder().encode(JSON.stringify(clean)).length > MAX) return fail(413, 'too_large');
    const wait = await rateWindow(bucket, 'save-uid', user.uid, 600, 60, true);
    if (wait) return limited(wait);
    const current = await readSave(bucket, user.uid, game);
    if (current.rev !== data.baseRev) return reply(409, { error: 'conflict', ...publicSave(current) });
    const next = { v: 1, rev: current.rev + 1, updated: Date.now(), data: clean };
    const written = await bucket.put(saveKey(user.uid, game), JSON.stringify(next), { onlyIf: current.etag ? { etagMatches: current.etag } : absent() });
    if (!written) return reply(409, { error: 'conflict', ...publicSave(await readSave(bucket, user.uid, game)) });
    return reply(200, { rev: next.rev, updated: next.updated });
  } catch (e) {
    if (e?.code === 'bad_request' || e?.code === 'too_large') return fail(e.status, e.code);
    return fail(500, 'server_error');
  }
}
