// PLATFORM §6.2–6.5：网页会话管理Key，HMAC索引认证，isolate令牌桶与脱敏调用日志。
// 完整Key仅在创建响应出现；元数据和日志没有secret/hash；撤销以两份文档共同有效为准。
// 条件写限制五个有效Key；认证不接受Cookie回退，不信任客户端uid。
import { AGENT_ROUTES } from './agent-routes.js';
import { b64url, unbase64, randomBytes, equal32, passwordHash, passwordValid } from './auth.js';
import { absent, rateWindow } from './store.js';
export const KEY_PROJECTS = {
  exchange: { name: '模拟交易所', scopes: { read: '只读（查询账户、行情、委托、成交）',
    trade: '交易（下单、撤单、划转、合约杠杆/平仓/止盈止损）' }, base: '/api/v1', docs: '/developer/#docs' },
};
const metaPath = uid => `apikeys/${uid}.json`;
const indexPath = id => `apikey-index/${id}.json`;
const ID = /^[a-z2-7]{10}$/;
const KEY = /^gk_([a-z2-7]{10})_([A-Za-z0-9_-]{43})$/;
const buckets = new Map();
const sampledGets = new WeakMap();
const loggedPaths = new Set(Object.keys(AGENT_ROUTES).map(path => '/api/v1/' + path));
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
    // 删除语义：列表只含未删除的密钥（旧版“已撤销”记录视为已删除），最新创建的在最前。
    const { rows } = await metadata(bucket, uid);
    const keys = rows.filter(row => !row.revoked).sort((a, b) => b.created - a.created).map(publicKey);
    return { status: 200, body: { keys, projects: KEY_PROJECTS } };
  }
  if (path === '/api/keys/log') {
    const id = new URL(request.url).searchParams.get('id');
    const { rows } = await metadata(bucket, uid);
    if (!ID.test(id) || !rows.some(row => row.id === id)) fail(404, 'not_found', '密钥不存在');
    const object = await bucket.get(`apikeys/log/${id}.json`);
    return { status: 200, body: { logs: object ? await object.json() : [] } };
  }
  if (path === '/api/keys/delete') {
    // 删除：先在条件写里移除元数据行——认证同时要求元数据与索引，
    // 此后 Key 立即 401；再删除本人名下的索引与调用记录。索引删除失败也无法复活 Key。
    if (typeof data.id !== 'string' || !ID.test(data.id)) fail(400, 'bad_request', '请求格式错误');
    let removed = false;
    for (let attempt = 0; attempt < 8 && !removed; attempt++) {
      const { rows, etag } = await metadata(bucket, uid);
      if (!rows.some(row => row.id === data.id)) fail(404, 'not_found', '密钥不存在');
      removed = !!await bucket.put(metaPath(uid), JSON.stringify(rows.filter(row => row.id !== data.id)),
        { onlyIf: condition(etag) });
    }
    if (!removed) fail(503, 'storage_unavailable', '存储服务暂时不可用，请稍后再试');
    const index = await bucket.get(indexPath(data.id));
    if (index && (await index.json()).uid === uid) await bucket.delete(indexPath(data.id));
    await bucket.delete(`apikeys/log/${data.id}.json`);
    return { status: 200, body: { ok: true, id: data.id, deleted: true } };
  }
  // PLATFORM §6.2：重新校验原账号PBKDF2密码，必须明确接受免责声明。
  if (data.acceptDisclaimer !== true) fail(400, 'disclaimer_required', '请确认使用须知');
  if (!passwordValid(data.password)) fail(401, 'bad_credentials', '用户名或密码错误');
  const user = session.user;
  const password = await passwordHash(data.password, env.PW_PEPPER, unbase64(user.salt), user.iter);
  if (!equal32(password, unbase64(user.hash))) fail(401, 'bad_credentials', '用户名或密码错误');
  const scopes = data.scopes, project = Object.hasOwn(KEY_PROJECTS, data.project) ? KEY_PROJECTS[data.project] : null;
  if (typeof data.name !== 'string' || !data.name.trim() || [...data.name.trim()].length > 24
    || /[\u0000-\u001f\u007f-\u009f]/.test(data.name) || !project
    || !Array.isArray(scopes) || scopes[0] !== 'read' || new Set(scopes).size !== scopes.length
    || scopes.some(scope => !Object.hasOwn(project?.scopes || {}, scope))
    || ![30, 90, 180].includes(data.expiresDays)) fail(400, 'bad_request', '请求格式错误');
  const id = Array.from(randomBytes(10), byte => 'abcdefghijklmnopqrstuvwxyz234567'[byte & 31]).join('');
  const secret = b64url(randomBytes(32));
  const row = { id, name: data.name.trim(), prefix: 'gk_' + id, scopes: [...scopes], project: data.project,
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
        project: data.project, expires: row.expires, revoked: false };
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
    || !Object.hasOwn(KEY_PROJECTS, index.project) || meta.project !== index.project) {
    fail(401, 'invalid_api_key', 'API 密钥无效');
  }
  return { id, uid: index.uid, scopes: index.scopes.filter(scope => meta.scopes.includes(scope)), meta };
}
export function keyRate(id, method, now = Date.now()) {
  // PLATFORM §6.5 / 第2b轮：GET与POST分别10/分钟；绑定不可用时使用isolate令牌桶。
  const limit = 10, name = id + ':' + (method === 'GET' ? 'read' : 'write');
  const previous = buckets.get(name) || { tokens: limit, time: now };
  const tokens = Math.min(limit, previous.tokens + Math.max(0, now - previous.time) * limit / 60000);
  const allowed = tokens >= 1;
  buckets.set(name, { tokens: allowed ? tokens - 1 : tokens, time: now });
  if (buckets.size > 10000) for (const [key, value] of buckets) if (now - value.time > 120000) buckets.delete(key);
  return { limit, remaining: Math.floor(allowed ? tokens - 1 : tokens),
    retryAfter: allowed ? 0 : Math.max(1, Math.ceil((1 - tokens) * 60 / limit)) };
}
export async function requestKeyRate(env, id, method, now) {
  const estimate = keyRate(id, method, now), binding = method === 'GET' ? env.API_RATE_READ : env.API_RATE_WRITE;
  if (!binding?.limit) return estimate;
  try {
    const { success } = await binding.limit({ key: id });
    return { ...estimate, retryAfter: success ? 0 : 60, remaining: success ? estimate.remaining : 0 };
  } catch { return estimate; }
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
  // PLATFORM §6.5 / 第2b轮：成功GET每Key每分钟采样一次；POST与非2xx逐次记，仍仅保留100条。
  if (!sampledGets.has(bucket)) sampledGets.set(bucket, new Map());
  const samples = sampledGets.get(bucket), sampled = request.method === 'GET' && status >= 200 && status < 300;
  const shouldLog = !sampled || !samples.has(key.id) || now - samples.get(key.id) >= 60000;
  if (sampled && shouldLog) samples.set(key.id, now);
  try {
    if (shouldLog) {
    const path = `apikeys/log/${key.id}.json`, object = await bucket.get(path);
    const rows = object ? await object.json() : [];
    const pathname = new URL(request.url).pathname;
    rows.unshift({ time: now, method: request.method, path: loggedPaths.has(pathname) ? pathname : '/api/v1/[unknown]', status,
      ip: ipPrefix(request.headers.get('CF-Connecting-IP') || ''), ...(sampled ? { sampled: true } : {}) });
    await bucket.put(path, JSON.stringify(rows.slice(0, 100)), { onlyIf: condition(object?.etag) });
    }
  } catch { /* logging is best effort */ }
  try {
    if (key.meta.lastUsed !== null && now - key.meta.lastUsed < 600000) return;
    await patchMetadata(bucket, key.uid, key.id, row => {
      if (row.lastUsed !== null && now - row.lastUsed < 600000) return false;
      row.lastUsed = now;
    });
  } catch { /* lastUsed is best effort */ }
}
