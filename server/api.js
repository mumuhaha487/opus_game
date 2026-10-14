import { ITERATIONS, USERNAME, b64url, unbase64, randomBytes, hex, equal32, passwordHash, passwordValid, signSession, sessionCookie, verifySession } from './auth.js';
import { absent, userKey, saveKey, readSave, publicSave, rateWindow } from './store.js';
import { GAMES } from './games/index.js';
import { likeable, getLikes, addLike } from './likes.js';
import { handleTrade } from './trade/index.js';
import { regionView } from './trade/fx.js';
import { auditSave } from './save-audit.js';
import { manageKeys } from './api-keys.js';
import { handleAgent } from './agent-api.js';
import { ashareList } from './market-ashare.js';
import { ashareQuotes } from './market-quotes.js';

// request bodies stay small; a game module may allow a larger cleaned save (export MAX)
const MAX = 196608, SAVE_MAX = 65536;
const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
function reply(status, data, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', ...headers,
    // PLATFORM §5.4：认证、公共接口、错误和异常响应均使用 JSON 防嵌入策略。
    'X-Frame-Options': 'DENY', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
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
    if (new URL(request.url).pathname.startsWith('/api/v1/')) return handleAgent(request, env, body);
    // PLATFORM §6.3–6.4：Bearer只用于Agent接口；带Cookie也不能回退到网页权限。
    if (request.headers.has('Authorization')) {
      return reply(403, { error: 'scope_denied', message: 'API 密钥不能调用此接口' });
    }
    if (new URL(request.url).pathname === '/api/market/ashare-list') {
      const result = await ashareList(request, env);
      return reply(result.status, result.body, result.headers);
    }
    if (new URL(request.url).pathname === '/api/market/ashare-quotes') {
      const result = await ashareQuotes(request, env);
      return reply(result.status, result.body, result.headers);
    }
    // PLATFORM §2.3：公开只读地区接口，地区只决定显示货币。
    if (new URL(request.url).pathname === '/api/region') {
      if (request.method !== 'GET') return fail(405, 'method_not_allowed', { Allow: 'GET' });
      try { return reply(200, await regionView(request, Date.now(), env?.DEBUG_REGION === '1'),
        { 'Cache-Control': 'private, max-age=60' }); }
      catch { return reply(503, { error: 'fx_unavailable', message: '汇率暂时不可用，请稍后再试' }); }
    }
    if (!env?.ACCOUNTS || typeof env.AUTH_SECRET !== 'string' || env.AUTH_SECRET.length < 32 || typeof env.PW_PEPPER !== 'string' || env.PW_PEPPER.length < 32) return fail(500, 'server_error');
    const url = new URL(request.url), path = url.pathname, method = request.method;
    if (method === 'POST' || method === 'PUT') {
      if ((request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase() !== 'application/json') return fail(415, 'unsupported_media_type');
      const site = request.headers.get('Sec-Fetch-Site');
      if (request.headers.get('Origin') !== url.origin || (site !== null && site !== 'same-origin')) return fail(403, 'forbidden_origin');
    }
    const routes = { '/api/register': 'POST', '/api/login': 'POST', '/api/logout': 'POST', '/api/me': 'GET', '/api/saves': 'GET', '/api/likes': 'GET' };
    const match = /^\/api\/save\/([a-z0-9-]{1,32})$/.exec(path);
    const game = match && Object.hasOwn(GAMES, match[1]) ? match[1] : null;
    const likeMatch = /^\/api\/like\/([a-z0-9-]{1,32})$/.exec(path);
    const liked = likeMatch && likeable(likeMatch[1]) ? likeMatch[1] : null;
    const trading = path.startsWith('/api/trade/');
    const keyMethods = { '/api/keys': 'GET, POST', '/api/keys/revoke': 'POST', '/api/keys/log': 'GET' };
    const managingKeys = Object.hasOwn(keyMethods, path);
    const allow = trading ? method
      : managingKeys ? keyMethods[path] : game ? 'GET, PUT' : liked ? 'POST' : Object.hasOwn(routes, path) ? routes[path] : null;
    if (!allow) return fail(404, path.startsWith('/api/save/') || path.startsWith('/api/like/') ? 'unknown_game' : 'not_found');
    if (!allow.split(', ').includes(method)) return fail(405, 'method_not_allowed', { Allow: allow });
    const data = method === 'POST' || method === 'PUT' ? await body(request) : null;
    const bucket = env.ACCOUNTS, ip = request.headers.get('CF-Connecting-IP') || '';
    if (path === '/api/logout') return reply(200, { ok: true }, { 'Set-Cookie': sessionCookie('', true) });
    // likes work signed in or not: a valid session counts against the account, otherwise against the network
    if (path === '/api/likes' || liked) {
      const session = (request.headers.get('Cookie') || '').includes('__Host-gsid=') ? await verifySession(request, env) : null;
      if (!liked) return reply(200, await getLikes(bucket, request, env, session));
      const wait = await rateWindow(bucket, 'like-ip', ip, 600, 40, true);
      if (wait) return limited(wait);
      const result = await addLike(bucket, request, env, session, liked);
      return reply(result.status, result.body);
    }
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
    if (trading) return handleTrade(request, env, session, data);
    if (managingKeys) {
      const result = await manageKeys(request, env, session, data);
      return reply(result.status, result.body, result.headers);
    }
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
    if (new TextEncoder().encode(JSON.stringify(clean)).length > (GAMES[game].MAX || SAVE_MAX)) return fail(413, 'too_large');
    const wait = await rateWindow(bucket, 'save-uid', user.uid, 600, 60, true);
    if (wait) return limited(wait);
    const current = await readSave(bucket, user.uid, game);
    if (current.rev !== data.baseRev) return reply(409, { error: 'conflict', ...publicSave(current) });
    // PLATFORM §5.3：先检查版本冲突，再检查清洗后的进度；首次保存 elapsedMs 为零。
    const now = Date.now();
    const verdict = GAMES[game].plausible(current.data, clean, current.rev ? Math.max(0, now - current.updated) : 0);
    if (!verdict.ok) {
      // 并发写已更新云端时走原冲突流程，不记录对旧版本的误拒绝。
      const latest = await readSave(bucket, user.uid, game);
      if (latest.etag !== current.etag) return reply(409, { error: 'conflict', ...publicSave(latest) });
      try { await auditSave(bucket, user.uid, game, verdict.reason, now); }
      catch { return reply(503, { error: 'audit_unavailable', message: '审计服务暂时不可用，请稍后再试' }); }
      return reply(422, { error: 'implausible_save', message: '云存档校验未通过，已保留云端进度' });
    }
    const next = { v: 1, rev: current.rev + 1, updated: Date.now(), data: clean };
    const written = await bucket.put(saveKey(user.uid, game), JSON.stringify(next), { onlyIf: current.etag ? { etagMatches: current.etag } : absent() });
    if (!written) return reply(409, { error: 'conflict', ...publicSave(await readSave(bucket, user.uid, game)) });
    return reply(200, { rev: next.rev, updated: next.updated });
  } catch (e) {
    if (new URL(request.url).pathname.startsWith('/api/keys') && e?.code) {
      return reply(e.status || 503, { error: e.code, message: e.message || '请求格式错误' });
    }
    if (new URL(request.url).pathname.startsWith('/api/trade/') && e?.code === 'bad_request') {
      return reply(e.status, { error: e.code, message: '请求格式错误' });
    }
    if (e?.code === 'bad_request' || e?.code === 'too_large') return fail(e.status, e.code);
    return fail(500, 'server_error');
  }
}
