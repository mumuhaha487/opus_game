// PLATFORM §6.2–6.5：网页会话管理Key，HMAC索引认证，isolate令牌桶与脱敏调用日志。
// 完整Key仅在创建响应出现；元数据和日志没有secret/hash；撤销以两份文档共同有效为准。
// 条件写限制五个有效Key；认证不接受Cookie回退，不信任客户端uid。
import { b64url, unbase64, randomBytes, equal32, passwordHash, passwordValid } from './auth.js';
import { absent, rateWindow } from './store.js';
const metaPath = uid => `apikeys/${uid}.json`;
const indexPath = id => `apikey-index/${id}.json`;
const ID = /^[a-z2-7]{10}$/;
const KEY = /^gk_([a-z2-7]{10})_([A-Za-z0-9_-]{43})$/;
const buckets = new Map();
const loggedPaths = new Set(['account', 'quote', 'orders', 'trades', 'orders/cancel', 'transfer',
  'futures/leverage', 'futures/close', 'futures/tpsl'].map(path => '/api/v1/' + path));
const fail = (status, code, message) => { throw { status, code, message }; };
async function hashSecret(secret, authSecret) {
  const encoding = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoding.encode(authSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoding.encode('apikey:' + secret)));
}
async function metadata(bucket, uid) {
  const object = await bucket.get(metaPath(uid));
  return { rows: object ? await object.json() : [], etag: object?.etag };
}
const condition = etag => etag ? { etagMatches: etag } : absent();
export const publicKey = row => Object.fromEntries(['id', 'name', 'prefix', 'scopes', 'project', 'created',
  'expires', 'lastUsed', 'revoked'].map(field => [field, row[field]]));
async function patchMetadata(bucket, uid, id, change) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const { rows, etag } = await metadata(bucket, uid), row = rows.find(entry => entry.id === id);
    if (!row) fail(404, 'not_found', '密钥不存在');
    if (change(row) === false) return row;
    if (await bucket.put(metaPath(uid), JSON.stringify(rows), { onlyIf: condition(etag) })) return row;
  }
  fail(503, 'storage_unavailable', '存储服务暂时不可用，请稍后再试');
}
export async function manageKeys(request, env, session, data) {
  const path = new URL(request.url).pathname, bucket = env.ACCOUNTS, uid = session.user.uid, now = Date.now();
  if (request.method === 'POST') {
    const wait = await rateWindow(bucket, 'trade-post', uid, 60, 40, true);
    if (wait) return { status: 429, body: { error: 'rate_limited', message: '操作太频繁，请稍后再试' },
      headers: { 'Retry-After': String(wait) } };
  }
  if (path === '/api/keys' && request.method === 'GET') {
    const { rows } = await metadata(bucket, uid);
    return { status: 200, body: { keys: rows.map(publicKey) } };
  }
  if (path === '/api/keys/log') {
    const id = new URL(request.url).searchParams.get('id');
    const { rows } = await metadata(bucket, uid);
    if (!ID.test(id) || !rows.some(row => row.id === id)) fail(404, 'not_found', '密钥不存在');
    const object = await bucket.get(`apikeys/log/${id}.json`);
    return { status: 200, body: { logs: object ? await object.json() : [] } };
  }
  if (path === '/api/keys/revoke') {
    if (typeof data.id !== 'string' || !ID.test(data.id)) fail(400, 'bad_request', '请求格式错误');
    // PLATFORM §6.2：先撤销元数据，认证同时检查它，因此索引更新失败也无法继续使用Key。
    await patchMetadata(bucket, uid, data.id, row => { row.revoked = true; });
    for (let attempt = 0; attempt < 8; attempt++) {
      const object = await bucket.get(indexPath(data.id));
      if (!object) return { status: 200, body: { ok: true, id: data.id } };
      const index = await object.json();
      if (index.uid !== uid) fail(404, 'not_found', '密钥不存在');
      index.revoked = true;
      if (await bucket.put(indexPath(data.id), JSON.stringify(index), { onlyIf: condition(object.etag) })) {
        return { status: 200, body: { ok: true, id: data.id } };
      }
    }
    fail(503, 'storage_unavailable', '存储服务暂时不可用，请稍后再试');
  }
  // PLATFORM §6.2：重新校验原账号PBKDF2密码，必须明确接受免责声明。
  if (data.acceptDisclaimer !== true) fail(400, 'disclaimer_required', '请确认使用须知');
  if (!passwordValid(data.password)) fail(401, 'bad_credentials', '用户名或密码错误');
  const user = session.user;
  const password = await passwordHash(data.password, env.PW_PEPPER, unbase64(user.salt), user.iter);
  if (!equal32(password, unbase64(user.hash))) fail(401, 'bad_credentials', '用户名或密码错误');
  const scopes = data.scopes;
  if (typeof data.name !== 'string' || !data.name.trim() || [...data.name.trim()].length > 40
    || /[\u0000-\u001f\u007f-\u009f]/.test(data.name) || data.project !== 'exchange'
    || !Array.isArray(scopes) || !['read', 'read,trade'].includes(scopes.join(','))
    || ![30, 90, 180].includes(data.expiresDays)) fail(400, 'bad_request', '请求格式错误');
  const id = Array.from(randomBytes(10), byte => 'abcdefghijklmnopqrstuvwxyz234567'[byte & 31]).join('');
  const secret = b64url(randomBytes(32));
  const row = { id, name: data.name.trim(), prefix: 'gk_' + id, scopes: [...scopes], project: 'exchange',
    created: now, expires: now + data.expiresDays * 86400000, lastUsed: null, revoked: false };
  // PLATFORM §6.2：元数据数组CAS为创建事务的名额边界，并发创建不超过五个有效Key。
  for (let attempt = 0; attempt < 8; attempt++) {
    const { rows, etag } = await metadata(bucket, uid);
    if (rows.filter(entry => !entry.revoked && entry.expires > now).length >= 5) {
      fail(409, 'key_limit', '最多保留 5 个有效密钥');
    }
    if (!await bucket.put(metaPath(uid), JSON.stringify([...rows, row]), { onlyIf: condition(etag) })) continue;
    try {
      const index = { uid, hash: b64url(await hashSecret(secret, env.AUTH_SECRET)), scopes: [...scopes],
        project: 'exchange', expires: row.expires, revoked: false };
      if (!await bucket.put(indexPath(id), JSON.stringify(index), { onlyIf: absent() })) throw Error('id collision');
    } catch {
      await patchMetadata(bucket, uid, id, entry => { entry.revoked = true; });
      fail(503, 'storage_unavailable', '存储服务暂时不可用，请稍后再试');
    }
    return { status: 201, body: { key: 'gk_' + id + '_' + secret, ...publicKey(row) } };
  }
  fail(503, 'storage_unavailable', '存储服务暂时不可用，请稍后再试');
}
export async function authenticateKey(request, env) {
  const authorization = request.headers.get('Authorization');
  if (!authorization) fail(401, 'api_key_required', '请提供 API 密钥');
  const match = /^Bearer (.+)$/.exec(authorization), key = match && KEY.exec(match[1]);
  if (!key) fail(401, 'invalid_api_key', 'API 密钥无效');
  const [, id, secret] = key;
  if (b64url(unbase64(secret)) !== secret) fail(401, 'invalid_api_key', 'API 密钥无效');
  const object = await env.ACCOUNTS.get(indexPath(id)), index = object ? await object.json() : null;
  if (!index || !equal32(await hashSecret(secret, env.AUTH_SECRET), unbase64(index.hash))) {
    fail(401, 'invalid_api_key', 'API 密钥无效');
  }
  // PLATFORM §6.2：每次同时核对元数据和索引，半撤销/半创建状态一律拒绝。
  const { rows } = await metadata(env.ACCOUNTS, index.uid), meta = rows.find(row => row.id === id);
  if (!meta || meta.revoked || index.revoked || meta.expires <= Date.now() || index.expires <= Date.now()
    || index.project !== 'exchange' || meta.project !== 'exchange') fail(401, 'invalid_api_key', 'API 密钥无效');
  return { id, uid: index.uid, scopes: index.scopes.filter(scope => meta.scopes.includes(scope)), meta };
}
export function keyRate(id, method, now = Date.now()) {
  // PLATFORM §6.5：GET120/分钟、POST30/分钟，各自独立的isolate令牌桶。
  const limit = method === 'GET' ? 120 : 30, name = id + ':' + (method === 'GET' ? 'read' : 'write');
  const previous = buckets.get(name) || { tokens: limit, time: now };
  const tokens = Math.min(limit, previous.tokens + Math.max(0, now - previous.time) * limit / 60000);
  const allowed = tokens >= 1;
  buckets.set(name, { tokens: allowed ? tokens - 1 : tokens, time: now });
  if (buckets.size > 10000) for (const [key, value] of buckets) if (now - value.time > 120000) buckets.delete(key);
  return { limit, remaining: Math.floor(allowed ? tokens - 1 : tokens),
    retryAfter: allowed ? 0 : Math.max(1, Math.ceil((1 - tokens) * 60 / limit)) };
}
export function ipPrefix(value) {
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(value) && value.split('.').every(part => Number(part) <= 255)) {
    return value.split('.').slice(0, 3).join('.') + '.0/24';
  }
  if (!/^[\da-fA-F:]+$/.test(value) || !value.includes(':')) return '';
  const [left, right = ''] = value.toLowerCase().split('::'), a = left ? left.split(':') : [], b = right ? right.split(':') : [];
  const groups = value.includes('::') ? [...a, ...Array(Math.max(0, 8 - a.length - b.length)).fill('0'), ...b] : a;
  if (groups.length !== 8 || groups.some(group => !/^[\da-f]{1,4}$/.test(group))) return '';
  return groups.slice(0, 3).map(group => parseInt(group, 16).toString(16)).join(':') + '::/48';
}
export async function recordKeyUse(bucket, key, request, status, now = Date.now()) {
  // PLATFORM §6.5：最近100条，只写方法、路径、状态和IP前缀；CAS失败丢本条，不影响主请求。
  try {
    const path = `apikeys/log/${key.id}.json`, object = await bucket.get(path);
    const rows = object ? await object.json() : [];
    const pathname = new URL(request.url).pathname;
    rows.unshift({ time: now, method: request.method, path: loggedPaths.has(pathname) ? pathname : '/api/v1/[unknown]', status,
      ip: ipPrefix(request.headers.get('CF-Connecting-IP') || '') });
    await bucket.put(path, JSON.stringify(rows.slice(0, 100)), { onlyIf: condition(object?.etag) });
  } catch { /* logging is best effort */ }
  try {
    if (key.meta.lastUsed !== null && now - key.meta.lastUsed < 600000) return;
    await patchMetadata(bucket, key.uid, key.id, row => {
      if (row.lastUsed !== null && now - row.lastUsed < 600000) return false;
      row.lastUsed = now;
    });
  } catch { /* lastUsed is best effort */ }
}
