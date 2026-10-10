import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { handle } from '../server/api.js';
import { signSession, passwordHash, b64url, unbase64, equal32, ITERATIONS } from '../server/auth.js';
import { ID, TALENT_ID, cleanSave } from '../server/save-schema.js';

class MemoryR2 {
  objects = new Map();
  serial = 0;
  async get(key) {
    const o = this.objects.get(key);
    return o ? { etag: o.etag, json: async () => JSON.parse(o.value), text: async () => o.value } : null;
  }
  async head(key) { return this.get(key); }
  async delete(key) { this.objects.delete(key); }
  async put(key, value, opts = {}) {
    const old = this.objects.get(key), cond = opts.onlyIf;
    if (cond instanceof Headers && cond.get('If-None-Match') === '*' && old) return null;
    if (cond?.etagMatches && old?.etag !== cond.etagMatches) return null;
    const etag = String(++this.serial);
    this.objects.set(key, { value, etag });
    return { etag };
  }
}
const environment = () => ({ ACCOUNTS: new MemoryR2(), AUTH_SECRET: 'test-session-secret-32-characters-long', PW_PEPPER: 'test-password-pepper-32-characters-long' });
const password = 'pass-word-123';
function request(env, path, method = 'GET', data, cookie, options = {}) {
  const headers = { 'Content-Type': 'application/json', Origin: 'https://game.test', 'CF-Connecting-IP': '127.0.0.1', ...options.headers };
  if (cookie) headers.Cookie = cookie;
  for (const [k, v] of Object.entries(headers)) if (v === null) delete headers[k];
  return handle(new Request('https://game.test' + path, { method, headers, body: method === 'GET' ? undefined : options.raw ?? JSON.stringify(data ?? {}) }), env);
}
const cookieOf = response => response.headers.get('Set-Cookie').split(';')[0];
async function register(env, name = 'PlayerA', ip = '127.0.0.1') {
  const r = await request(env, '/api/register', 'POST', { username: name, password }, null, { headers: { 'CF-Connecting-IP': ip } });
  assert.equal(r.status, 201); return cookieOf(r);
}
function headersOK(r) {
  assert.equal(r.headers.get('Cache-Control'), 'no-store');
  assert.equal(r.headers.get('Content-Type'), 'application/json; charset=utf-8');
  assert.equal(r.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(r.headers.get('Referrer-Policy'), 'same-origin');
  assert.ok(![...r.headers.keys()].some(k => k.startsWith('access-control-allow-')));
}

test('register, case-insensitive uniqueness, validation and concurrent creation', async () => {
  const env = environment(), r = await request(env, '/api/register', 'POST', { username: 'PlayerA', password });
  assert.equal(r.status, 201); headersOK(r);
  const cookie = r.headers.get('Set-Cookie');
  for (const attr of ['__Host-gsid=', 'HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/', 'Max-Age=2592000']) assert.ok(cookie.includes(attr));
  assert.deepEqual(await r.json(), { user: { name: 'PlayerA' } });
  const user = await (await env.ACCOUNTS.get('users/playera.json')).json();
  assert.match(user.uid, /^[a-f0-9]{32}$/); assert.equal(unbase64(user.salt).length, 16); assert.equal(unbase64(user.hash).length, 32); assert.equal(user.iter, 100000);
  assert.equal(equal32(await passwordHash(password, env.PW_PEPPER, unbase64(user.salt)), unbase64(user.hash)), true);
  assert.equal(equal32(await passwordHash(password, 'different-pepper', unbase64(user.salt)), unbase64(user.hash)), false);
  assert.equal(equal32(new Uint8Array(32), new Uint8Array(33)), false);
  assert.equal((await request(env, '/api/register', 'POST', { username: 'pLaYeRa', password })).status, 409);
  for (const [username, pw, error] of [[' ab', password, 'bad_username'], ['abc', '1234567', 'bad_password'], ['abc', 'x'.repeat(65), 'bad_password']]) {
    const response = await request(environment(), '/api/register', 'POST', { username, password: pw });
    assert.equal(response.status, 400); assert.deepEqual(await response.json(), { error });
  }
  const concurrent = environment();
  const results = await Promise.all([request(concurrent, '/api/register', 'POST', { username: 'SameName', password }), request(concurrent, '/api/register', 'POST', { username: 'samename', password })]);
  assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
  const unicode = await request(environment(), '/api/register', 'POST', { username: 'unicode', password: '😀'.repeat(8) });
  assert.equal(unicode.status, 201);
});

test('login, dummy hashing, session tamper, expiry, uid/sv checks, renewal and logout', async () => {
  const env = environment(), cookie = await register(env);
  const realCrypto = globalThis.crypto, costs = [];
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { getRandomValues: realCrypto.getRandomValues.bind(realCrypto), subtle: new Proxy(realCrypto.subtle, { get(target, key) {
    if (key === 'deriveBits') return (...args) => { costs.push(args[0].iterations); return target.deriveBits(...args); };
    const value = target[key]; return typeof value === 'function' ? value.bind(target) : value;
  } }) } });
  try {
    const wrong = await request(env, '/api/login', 'POST', { username: 'PlayerA', password: 'incorrect' });
    const absent = await request(env, '/api/login', 'POST', { username: 'unknown', password: 'incorrect' });
    assert.equal(wrong.status, 401); assert.equal(absent.status, 401); assert.equal(await wrong.text(), await absent.text());
    assert.deepEqual(costs, [ITERATIONS, ITERATIONS]);
  } finally { Object.defineProperty(globalThis, 'crypto', { configurable: true, value: realCrypto }); }
  assert.equal((await request(env, '/api/login', 'POST', { username: 'playera', password })).status, 200);
  assert.equal((await request(env, '/api/me', 'GET', undefined, cookie)).status, 200);
  const user = await (await env.ACCOUNTS.get('users/playera.json')).json();
  const expiry = Math.floor(Date.now() / 1000);
  const invalids = [cookie.slice(0, -8) + 'xxxxxxxx', '__Host-gsid=' + await signSession(user, env.AUTH_SECRET, expiry - 1), '__Host-gsid=' + await signSession({ ...user, sv: 2 }, env.AUTH_SECRET), '__Host-gsid=' + await signSession({ ...user, uid: '0'.repeat(32) }, env.AUTH_SECRET)];
  for (const c of invalids) { const r = await request(env, '/api/me', 'GET', undefined, c); assert.equal(r.status, 401); assert.match(r.headers.get('Set-Cookie'), /Max-Age=0/); headersOK(r); }
  const renewed = await request(env, '/api/me', 'GET', undefined, '__Host-gsid=' + await signSession(user, env.AUTH_SECRET, expiry + 3600));
  assert.equal(renewed.status, 200); assert.match(renewed.headers.get('Set-Cookie'), /Max-Age=2592000/);
  const logout = await request(env, '/api/logout', 'POST'); assert.equal(logout.status, 200); assert.match(logout.headers.get('Set-Cookie'), /Max-Age=0/);
  user.iter = 20000; user.hash = b64url(await passwordHash(password, env.PW_PEPPER, unbase64(user.salt), 20000));
  await env.ACCOUNTS.put('users/playera.json', JSON.stringify(user));
  assert.equal((await request(env, '/api/login', 'POST', { username: 'PlayerA', password })).status, 200);
  assert.equal((await (await env.ACCOUNTS.get('users/playera.json')).json()).iter, ITERATIONS);
});

const history = t => ({ t, hero: 'rin', weapon: 'rin_hizakura', mode: 'normal', pts: 0, win: true, score: 100, time: 30, kills: 10, scene: 3, depth: 7, bosses: 4 });
test('save cleaning, revision conflicts, conditional update, isolation and paths', async () => {
  const env = environment(), a = await register(env), b = await register(env, 'PlayerB');
  assert.deepEqual(await (await request(env, '/api/save/entropy-blade', 'GET', undefined, a)).json(), { rev: 0, updated: 0, data: null });
  const data = { crystals: 2e9, stats: { runs: -10, bestTime: 12.5, mystery: 7 }, talents: { hp: 120, 'bad-id': 3 }, heroBest: { rin: 200 }, titles: ['劫主', '劫主', '\u0000bad'], history: [history(1234), { ...history(1235), scene: 10 }], settings: { music: 0 }, unknown: 9, lastChar: 40, lastMode: 'hard', lastWeapon: { rin: 'rin_hizakura' }, trialSel: { fierce: 100 }, seenTutorial: true };
  const put = await request(env, '/api/save/entropy-blade', 'PUT', { baseRev: 0, data }, a); assert.equal(put.status, 200); headersOK(put);
  const saved = await (await request(env, '/api/save/entropy-blade', 'GET', undefined, a)).json();
  assert.equal(saved.rev, 1); assert.equal(saved.data.crystals, 1e9); assert.equal(saved.data.stats.runs, 0); assert.equal(saved.data.stats.bestTime, 12.5);
  assert.equal(saved.data.talents.hp, 99); assert.equal(saved.data.lastChar, 15); assert.equal(saved.data.trialSel.fierce, 9);
  assert.equal(saved.data.settings, undefined); assert.equal(saved.data.unknown, undefined); assert.equal(saved.data.stats.mystery, undefined); assert.deepEqual(saved.data.titles, ['劫主']); assert.equal(saved.data.history.length, 1);
  const conflict = await request(env, '/api/save/entropy-blade', 'PUT', { baseRev: 0, data: {} }, a);
  assert.equal(conflict.status, 409); assert.deepEqual(await conflict.json(), { error: 'conflict', ...saved });
  const races = await Promise.all([1, 2].map(n => request(env, '/api/save/entropy-blade', 'PUT', { baseRev: 1, data: { crystals: n } }, a)));
  assert.deepEqual(races.map(r => r.status).sort(), [200, 409]);
  assert.equal((await request(env, '/api/save/entropy-blade', 'PUT', { baseRev: 0, data: { crystals: 42 } }, b)).status, 200);
  assert.notEqual((await (await request(env, '/api/save/entropy-blade', 'GET', undefined, a)).json()).data.crystals, 42);
  for (const path of ['/api/save/..%2Fusers', '/api/save/other-game', '/api/save/playera/entropy-blade']) assert.equal((await request(env, path, 'GET', undefined, a)).status, 404);
  for (const data of [{ baseRev: -1, data: {} }, { baseRev: 2, data: null }, { baseRev: 2, data: [] }]) assert.equal((await request(env, '/api/save/entropy-blade', 'PUT', data, a)).status, 400);
  assert.equal((await request(env, '/api/save/entropy-blade')).status, 401);
});

test('CSRF, body bounds, method/path errors, safe exception and all response headers', async () => {
  const env = environment();
  for (const headers of [{ Origin: null }, { Origin: 'https://evil.test' }, { 'Sec-Fetch-Site': 'same-site' }]) {
    const r = await request(env, '/api/logout', 'POST', {}, null, { headers }); assert.equal(r.status, 403); headersOK(r);
  }
  const media = await request(env, '/api/logout', 'POST', {}, null, { headers: { 'Content-Type': 'text/plain' } }); assert.equal(media.status, 415); headersOK(media);
  for (const raw of ['[1]', 'null', '1', 'invalid']) { const r = await request(env, '/api/logout', 'POST', {}, null, { raw }); assert.equal(r.status, 400); headersOK(r); }
  for (const options of [{ raw: 'x'.repeat(65537) }, { headers: { 'Content-Length': '65537' } }, { raw: JSON.stringify({ x: '汉'.repeat(30000) }) }]) {
    const r = await request(env, '/api/logout', 'POST', {}, null, options); assert.equal(r.status, 413); headersOK(r);
  }
  for (const [path, method, status] of [['/api/missing', 'GET', 404], ['/api/register', 'GET', 405], ['/api/me', 'GET', 401]]) { const r = await request(env, path, method); assert.equal(r.status, status); headersOK(r); if (status === 405) assert.equal(r.headers.get('Allow'), 'POST'); }
  env.ACCOUNTS.get = () => { throw new Error('private storage detail'); };
  const failed = await request(env, '/api/register', 'POST', { username: 'abc', password });
  assert.equal(failed.status, 500); assert.deepEqual(await failed.json(), { error: 'server_error' }); headersOK(failed);
});

test('missing or invalid configuration rejects every API route without accessing R2', async () => {
  for (const invalid of [{ PW_PEPPER: undefined }, { AUTH_SECRET: 'x'.repeat(31) }, { PW_PEPPER: 'x'.repeat(31) }, { AUTH_SECRET: undefined }, { AUTH_SECRET: 123 }, { ACCOUNTS: undefined }]) {
    let calls = 0;
    const bucket = Object.fromEntries(['get', 'put', 'head', 'delete'].map(method => [method, () => { calls++; throw new Error('R2 must not be accessed'); }]));
    const env = { ...environment(), ACCOUNTS: bucket, ...invalid };
    for (const [path, method] of [['/api/register', 'POST'], ['/api/login', 'POST'], ['/api/logout', 'POST'], ['/api/me', 'GET'], ['/api/save/entropy-blade', 'GET'], ['/api/save/entropy-blade', 'PUT'], ['/api/unknown', 'GET'], ['/api/register', 'GET']]) {
      const response = await request(env, path, method, {}, null, { headers: { Origin: null } });
      assert.equal(response.status, 500); assert.deepEqual(await response.json(), { error: 'server_error' }); headersOK(response);
    }
    assert.equal(calls, 0);
  }
});

test('fixed-window rate limits and hashed keys', async () => {
  const env = environment(); await register(env);
  for (let i = 0; i < 10; i++) assert.equal((await request(env, '/api/login', 'POST', { username: 'PlayerA', password: 'bad' })).status, 401);
  const r = await request(env, '/api/login', 'POST', { username: 'PlayerA', password }); assert.equal(r.status, 429); headersOK(r);
  assert.ok(Number(r.headers.get('Retry-After')) > 0); assert.equal((await r.json()).retryAfter, Number(r.headers.get('Retry-After')));
  const reg = environment();
  for (let i = 0; i < 5; i++) assert.equal((await request(reg, '/api/register', 'POST', { username: 'bad!', password })).status, 400);
  assert.equal((await request(reg, '/api/register', 'POST', { username: 'valid', password })).status, 429);
  const ip = environment();
  for (let i = 0; i < 30; i++) assert.equal((await request(ip, '/api/login', 'POST', { username: 'user_' + i, password: 'bad' })).status, 401);
  assert.equal((await request(ip, '/api/login', 'POST', { username: 'newuser', password })).status, 429);
  const writes = environment(), cookie = await register(writes);
  for (let rev = 0; rev < 60; rev++) assert.equal((await request(writes, '/api/save/entropy-blade', 'PUT', { baseRev: rev, data: {} }, cookie)).status, 200);
  assert.equal((await request(writes, '/api/save/entropy-blade', 'PUT', { baseRev: 60, data: {} }, cookie)).status, 429);
  for (const key of env.ACCOUNTS.objects.keys()) if (key.startsWith('rl/')) assert.match(key, /^rl\/[a-z-]+\/[a-f0-9]{64}\/\d+$/);
});

const src = name => readFileSync(new URL('../entropy-blade/js/' + name + '.js', import.meta.url), 'utf8');
function mergeVM() {
  const context = vm.createContext({}); vm.runInContext(src('syncmerge'), context);
  return code => JSON.parse(JSON.stringify(vm.runInContext(code, context)));
}
test('three-way counters, crystal spending, maxima, minima, local preferences and defaults', () => {
  const run = mergeVM();
  const b = { crystals: 100, stats: { runs: 10, wins: 4, kills: 100, crystalsTotal: 200, bossKills: 12 }, talents: { hp: 1 } };
  const l = { crystals: 70, stats: { runs: 12, wins: 5, kills: 120, crystalsTotal: 230, bossKills: 14, deepest: 30, bestTrial: 10, bestTime: 60 }, talents: { hp: 2 }, heroBest: { rin: 500 }, titles: ['劫主'], lastChar: 2, lastMode: 'hard', lastWeapon: { gao: 'gao_gaku' }, trialSel: { fierce: 3 }, seenTutorial: true };
  const r = { crystals: 150, stats: { runs: 13, wins: 6, kills: 150, crystalsTotal: 250, bossKills: 15, deepest: 37, bestTrial: 40, bestTime: 80 }, talents: { hp: 1, atk: 3 }, heroBest: { rin: 400 }, titles: ['别称'] };
  const m = run(`mergeProgress(${JSON.stringify(b)},${JSON.stringify(l)},${JSON.stringify(r)})`);
  assert.equal(m.crystals, 120); assert.deepEqual(m.stats, { runs: 15, wins: 7, kills: 170, crystalsTotal: 280, bossKills: 17, deepest: 37, bestTrial: 40, bestTime: 60 });
  assert.deepEqual(m.talents, { hp: 2, atk: 3 }); assert.equal(m.heroBest.rin, 500); assert.deepEqual(m.titles, ['别称', '劫主']);
  for (const k of ['lastChar', 'lastMode', 'lastWeapon', 'trialSel', 'seenTutorial']) assert.deepEqual(m[k], l[k]);
  assert.equal(run('mergeProgress(null,{crystals:4,stats:{runs:2}},{crystals:7,stats:{runs:3}})').crystals, 11);
  assert.equal(run('mergeProgress(null,{crystals:0},{crystals:0})').stats.bestTime, 0);
  assert.equal(run('hasProgress({})'), false);
  for (const value of ['{stats:{runs:1}}', '{crystals:1}', '{talents:{hp:1}}', '{history:[{}]}']) assert.equal(run(`hasProgress(${value})`), true);
  assert.deepEqual(run('pickProgress({crystals:1, settings:{music:0}, extra:2})'), { crystals: 1 });
});
test('history union, timestamp/hero deduplication, ordering and 50-row bound', () => {
  const run = mergeVM(), rows = Array.from({ length: 60 }, (_, i) => history(i));
  const m = run(`mergeProgress(null,{history:${JSON.stringify(rows.slice(20))}},{history:${JSON.stringify(rows.slice(0, 40))}})`);
  assert.equal(m.history.length, 50); assert.equal(m.history[0].t, 59); assert.equal(m.history[49].t, 10);
});

test('real hero, weapon, talent and curse IDs fit schema and collection limits stay bounded', () => {
  const context = vm.createContext({ window: { addEventListener() {} }, navigator: {}, localStorage: { getItem() {} }, document: { createElement: () => ({ getContext: () => ({}) }) } });
  for (const name of ['core', 'sprites', 'heroes', 'heroes_eve', 'heroes_gao', 'arts', 'upgrades', 'trials']) vm.runInContext(src(name), context);
  const ids = vm.runInContext('({ heroes: HERO_ORDER, weapons: Object.keys(WEAPONS), talents: TALENTS.map(t=>t.id), curses: CURSES.map(c=>c.id) })', context);
  for (const id of [...ids.heroes, ...ids.weapons, ...ids.curses]) assert.match(id, ID);
  for (const id of ids.talents) assert.match(id, TALENT_ID);
  const cleaned = cleanSave({ talents: Object.fromEntries(Array.from({ length: 80 }, (_, i) => ['t' + i, 1])), heroBest: Object.fromEntries(Array.from({ length: 20 }, (_, i) => ['h' + i, 1])), titles: Array.from({ length: 40 }, (_, i) => 'Title' + i), history: Array.from({ length: 60 }, (_, i) => history(i)) });
  assert.equal(Object.keys(cleaned.talents).length, 64); assert.equal(Object.keys(cleaned.heroBest).length, 16); assert.equal(cleaned.titles.length, 32); assert.equal(cleaned.history.length, 50);
});

test('all save maps reject prototype keys while retaining valid IDs', async () => {
  const numeric = JSON.parse('{"__proto__":2,"constructor":3,"prototype":4,"rin":5}');
  const weapons = JSON.parse('{"__proto__":"rin_hizakura","constructor":"rin_hizakura","prototype":"rin_hizakura","rin":"rin_hizakura"}');
  const data = { talents: numeric, heroBest: numeric, trialSel: numeric, lastWeapon: weapons };
  const cleaned = cleanSave(data);
  for (const field of ['talents', 'heroBest', 'trialSel', 'lastWeapon']) {
    for (const key of ['__proto__', 'constructor', 'prototype']) assert.equal(Object.hasOwn(cleaned[field], key), false);
    assert.ok(Object.hasOwn(cleaned[field], 'rin'));
  }
  assert.equal({}.polluted, undefined);
  const env = environment(), cookie = await register(env);
  assert.equal((await request(env, '/api/save/entropy-blade', 'PUT', { baseRev: 0, data }, cookie)).status, 200);
  const saved = await (await request(env, '/api/save/entropy-blade', 'GET', undefined, cookie)).json();
  for (const field of ['talents', 'heroBest', 'trialSel', 'lastWeapon']) assert.deepEqual(Object.keys(saved.data[field]), ['rin']);
});

function client({ storage = new Map(), fetcher = async () => { throw new Error('offline'); }, file = false, storageThrows = false } = {}) {
  const listeners = new Map(), timers = new Map(); let timerID = 0;
  const document = { activeElement: null, visibilityState: 'visible', addEventListener: (kind, fn) => listeners.set('document:' + kind, fn), body: { appendChild() {} } };
  document.createElement = tag => {
    const events = new Map();
    const node = { tagName: tag.toUpperCase(), style: {}, value: '', readOnly: false, setAttribute() {}, appendChild() {}, addEventListener: (type, fn) => events.set(type, fn), focus() { document.activeElement = node; events.get('focus')?.(); }, blur() { if (document.activeElement === node) document.activeElement = null; }, events };
    return node;
  };
  const requests = [], drawn = [], rectangles = [], sounds = [];
  const ctx = new Proxy({ fillRect(...args) { rectangles.push({ args, color: ctx.fillStyle }); } }, { get: (target, key) => key in target ? target[key] : () => {} });
  const context = vm.createContext({ console, AbortController, Date, TextEncoder, location: { protocol: file ? 'file:' : 'https:' }, navigator: {},
    document, window: { addEventListener: (kind, fn) => { const key = 'window:' + kind; const callbacks = listeners.get(key) || []; callbacks.push(fn); listeners.set(key, callbacks); } },
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => { if (storageThrows) throw new Error('storage unavailable'); storage.set(k, v); }, removeItem: k => { if (storageThrows) throw new Error('storage unavailable'); storage.delete(k); } },
    setTimeout: (fn, delay) => { const id = ++timerID; timers.set(id, { fn, delay }); return id; }, clearTimeout: id => timers.delete(id),
    fetch: async (path, options) => { requests.push({ path, ...options }); return fetcher(path, options); },
    G: { state: 'title', trans: null }, Gfx: { uctx: ctx, artBegin() {}, view: { x: 20, y: 10, w: 1920, h: 1080, dpr: 2 } }, TouchUI: { enabled: false }, Sound: { play: name => sounds.push(name) }, Text: { measure: s => String(s).length * 8, draw: (ctx, text, x, y, o) => drawn.push({ text, x, y, o }) },
    HERO_ORDER: ['rin', 'eve', 'gao'], HEROES: { rin: { name: '凛', color: '#ff3b5c' }, eve: { name: '伊芙', color: '#ffd23f' }, gao: { name: '罡', color: '#ff9a3a' } },
  });
  for (const name of ['core', 'syncmerge', 'account', 'ui']) vm.runInContext(src(name), context, { filename: name + '.js' });
  vm.runInContext("UI.screen = 'account';", context);
  const run = code => vm.runInContext(code, context);
  const event = (key, e = {}) => { const fns = listeners.get(key); if (Array.isArray(fns)) for (const fn of fns) fn(e); else fns?.(e); };
  return { run, storage, requests, timers, document, event, drawn, rectangles, sounds, json: code => JSON.parse(JSON.stringify(run(code))) };
}
const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), { status });
const tick = async () => { await new Promise(resolve => setImmediate(resolve)); };
function activate(c, data = {}) {
  c.run(`Account.activate('PlayerA'); Account.verified = true; Account.pulled = true; Account.cache.base = pickProgress(Save.defaults()); Account.cache.rev = 1; Account.apply(${JSON.stringify(data)});`);
}

test('device settings survive logout, guest bytes stay intact, cached progress has no settings/password', async () => {
  const guest = JSON.stringify({ crystals: 12, settings: { music: 0.7 }, stats: { runs: 1 } }), storage = new Map([['entropy_blade_save_v1', guest]]);
  const c = client({ storage, fetcher: async path => path === '/api/logout' ? jsonResponse({ ok: true }) : jsonResponse({ rev: 2, updated: 1 }) });
  activate(c, { crystals: 20 });
  c.run('Save.data.settings.music = 0.2; Save.data.crystals = 30; Save.write();');
  assert.equal(storage.get('entropy_blade_save_v1'), guest);
  const cache = JSON.parse(storage.get('entropy_blade_acct_playera_v1'));
  assert.equal(cache.dirty, true); assert.equal(cache.data.settings, undefined); assert.equal(cache.data.crystals, 30);
  assert.ok([...c.timers.values()].some(t => t.delay === 4000));
  await c.run('Account.logout()');
  assert.equal(c.run('Account.status'), 'guest'); assert.equal(c.run('Save.data.crystals'), 12); assert.equal(c.run('Save.data.settings.music'), 0.2);
  assert.equal(storage.get('entropy_blade_save_v1'), guest); assert.equal(storage.has('entropy_blade_acct_playera_v1'), false); assert.equal(storage.has('entropy_blade_profile_v1'), false);
  assert.ok(c.requests.every(r => r.credentials === 'same-origin' && r.headers['Content-Type'] === 'application/json'));
  assert.equal(JSON.parse(c.requests.find(r => r.method === 'PUT').body).data.settings, undefined);
});

test('startup switches synchronously to profile cache and expired login preserves dirty progress', async () => {
  const storage = new Map([['entropy_blade_profile_v1', '{"name":"PlayerA"}'], ['entropy_blade_acct_playera_v1', JSON.stringify({ name: 'PlayerA', data: { crystals: 88, stats: { runs: 3 } }, base: { crystals: 60 }, rev: 4, dirty: true })]]);
  const c = client({ storage, fetcher: async () => jsonResponse({ error: 'unauthorized' }, 401) });
  assert.equal(c.run('Save.data.crystals'), 88); await tick(); await c.run('Account.job');
  assert.equal(c.run('Account.status'), 'expired'); assert.equal(c.run('Save.data.crystals'), 88);
  c.run('Save.data.crystals++; Save.write();'); assert.equal(c.run('Account.cache.dirty'), true); assert.equal(c.requests.length, 1);
  const refreshed = client({ storage }); assert.equal(refreshed.run('Save.data.crystals'), 89);
  await tick();
});

test('push snapshots preserve concurrent local writes; conflict merges local deltas once', async () => {
  let resolve, count = 0;
  const c = client({ fetcher: async () => ++count === 1 ? new Promise(r => { resolve = r; }) : jsonResponse({ rev: 3, updated: 2 }) });
  activate(c, { crystals: 10, stats: { runs: 1 } }); c.run('Save.write();');
  const pending = c.run('Account.sync()'); await tick();
  c.run('Save.data.crystals += 5; Save.data.stats.runs++; Save.write();'); resolve(jsonResponse({ rev: 2, updated: 1 })); await pending;
  assert.equal(c.run('Account.cache.base.crystals'), 10); assert.equal(c.run('Account.cache.dirty'), true);
  await c.run('Account.sync()'); assert.equal(c.run('Account.cache.dirty'), false); assert.equal(c.run('Account.cache.base.crystals'), 15);
  let n = 0;
  const conflict = client({ fetcher: async () => ++n === 1 ? jsonResponse({ error: 'conflict', rev: 5, updated: 1, data: { crystals: 20, stats: { runs: 4 } } }, 409) : jsonResponse({ rev: 6, updated: 2 }) });
  activate(conflict, { crystals: 10, stats: { runs: 2 } }); conflict.run('Save.write();');
  await conflict.run('Account.sync()');
  assert.equal(conflict.run('Save.data.crystals'), 30); assert.equal(conflict.run('Save.data.stats.runs'), 6);
  assert.equal(JSON.parse(conflict.requests[1].body).baseRev, 5); assert.equal(conflict.run('Account.cache.dirty'), false);
});

test('account reset overwrites conflicts and survives offline refresh without resurrecting progress', async () => {
  const storage = new Map(), c = client({ storage });
  activate(c, { crystals: 100, stats: { runs: 20 } }); c.run('Save.reset();'); await c.run('Account.sync()');
  assert.equal(c.run('Save.data.crystals'), 0); assert.equal(storage.get('entropy_blade_acct_playera_reset_v1'), 'true');
  let puts = 0;
  const refreshed = client({ storage, fetcher: async (path, opts) => {
    if (path === '/api/me') return jsonResponse({ user: { name: 'PlayerA' } });
    if (opts.method === 'GET') return jsonResponse({ rev: 4, updated: 1, data: { crystals: 200, stats: { runs: 50 } } });
    return ++puts === 1 ? jsonResponse({ error: 'conflict', rev: 5, updated: 2, data: { crystals: 300, stats: { runs: 70 } } }, 409) : jsonResponse({ rev: 6, updated: 3 });
  } });
  await tick(); await refreshed.run('Account.job');
  assert.equal(refreshed.run('Save.data.crystals'), 0); assert.equal(refreshed.run('Save.data.stats.runs'), 0); assert.equal(refreshed.run('Account.cache.rev'), 6);
  assert.equal(storage.has('entropy_blade_acct_playera_reset_v1'), false);
});

test('form navigation, transparent positioning, password handling and file-mode request suppression', async () => {
  const c = client({ file: true }); c.run('Account.layout(); Account.selectRow(1);');
  assert.equal(c.run('Account.inputs[0].style.left'), '90px'); assert.equal(c.run('Account.inputs[0].style.top'), '183px'); assert.equal(c.run('Account.inputs[0].style.width'), '360px');
  c.run("Account.inputs[0].value = 'PlayerA'; Account.inputs[1].value = 'pass-word-123';"); await c.run('Account.submit()'); assert.equal(c.requests.length, 0);
  const failed = client({ fetcher: async () => jsonResponse({ error: 'bad_credentials' }, 401) });
  failed.run("Account.selectRow(1); Account.inputs[0].value = ' PlayerA '; Account.inputs[1].value = 'pass-word-123';");
  const event = { key: 'Enter', preventDefault() {} }; failed.run('Account.inputs[0]').events.get('keydown')(event);
  assert.equal(failed.run('Account.row'), 2); assert.equal(failed.document.activeElement, failed.run('Account.inputs[1]'));
  failed.event('window:keydown', { code: 'KeyJ', target: failed.run('Account.inputs[1]'), preventDefault() { assert.fail('core must let input keys through'); } });
  assert.equal(failed.run("Input.hit('ok')"), false);
  await failed.run('Account.submit()'); assert.equal(failed.run('Account.inputs[1].value'), ''); assert.equal(failed.run('Account.inputs[2].value'), '');
  assert.equal(JSON.parse(failed.requests[0].body).username, 'PlayerA'); assert.equal(failed.run('Account.message'), '用户名或密码错误');
  assert.ok([...failed.storage.values()].every(v => !v.includes(password)));
  failed.run('Account.hideInputs();'); assert.equal(failed.document.activeElement, null); assert.equal(failed.run('Account.inputs[0].style.display'), 'none');
});

test('login imports a copy on confirmation and logout defaults to cancel when sync fails', async () => {
  const guest = JSON.stringify({ crystals: 42, stats: { runs: 1 } }), storage = new Map([['entropy_blade_save_v1', guest]]);
  const c = client({ storage, fetcher: async (path, options) => path === '/api/login' ? jsonResponse({ user: { name: 'PlayerA' } }) : options.method === 'GET' ? jsonResponse({ rev: 0, updated: 0, data: null }) : jsonResponse({ rev: 1, updated: 1 }) });
  c.run("Account.inputs[0].value = 'PlayerA'; Account.inputs[1].value = 'pass-word-123';");
  const pending = c.run('Account.submit()'); await tick();
  assert.deepEqual(c.json('UI.confirm.labels'), ['带入', '从零开始']); assert.equal(c.run('UI.confirm.sel'), 0);
  c.run('UI.confirm.yes(); UI.confirm = null;'); await pending;
  assert.equal(c.run('Save.data.crystals'), 42); assert.equal(storage.get('entropy_blade_save_v1'), guest);
  assert.equal(c.run('Account.message'), '登录成功，已载入云端存档');
  const offline = client(); activate(offline, { crystals: 9 }); offline.run('Save.write();');
  const logout = offline.run('Account.logout()'); await tick();
  assert.deepEqual(offline.json('UI.confirm.labels'), ['退出', '取消']); assert.equal(offline.run('UI.confirm.sel'), 1);
  offline.run('UI.confirm.no(); UI.confirm = null;'); await logout;
  assert.equal(offline.run('Account.name'), 'PlayerA'); assert.ok(!offline.requests.some(r => r.path === '/api/logout'));
});

test('network/429/5xx backoff, online retry and conflict retry bound', async () => {
  let status = 429;
  const c = client({ fetcher: async () => jsonResponse({ error: 'rate_limited', retryAfter: 1 }, status) });
  activate(c, { crystals: 10 }); c.run('Save.write();');
  for (const delay of [15000, 30000, 60000, 120000, 300000, 300000]) {
    await c.run('Account.sync()');
    assert.equal(c.run('Account.status'), 'error'); assert.equal(c.run('Account.cache.dirty'), true);
    assert.ok([...c.timers.values()].some(t => t.delay === delay));
    status = 500;
  }
  const before = c.requests.length; c.event('window:online'); await c.run('Account.job'); assert.equal(c.requests.length, before + 1);
  const conflict = client({ fetcher: async () => jsonResponse({ error: 'conflict', rev: 2, updated: 1, data: {} }, 409) });
  activate(conflict, { crystals: 1 }); conflict.run('Save.write();'); await conflict.run('Account.sync()');
  assert.equal(conflict.requests.length, 4); assert.equal(conflict.run('Account.cache.dirty'), true);
});

test('hidden/pagehide flush uses keepalive and does not double-count its own winning write', async () => {
  const resolvers = [], c = client({ fetcher: async () => new Promise(resolve => resolvers.push(resolve)) });
  activate(c, { crystals: 10, stats: { runs: 2 } }); c.run('Save.write();');
  const pending = c.run('Account.sync()'); await tick();
  c.run('Save.data.crystals = 15; Save.data.stats.runs = 3; Save.write();');
  c.document.visibilityState = 'hidden'; c.event('document:visibilitychange'); c.event('window:pagehide');
  assert.equal(c.requests.length, 2); assert.equal(c.requests[1].keepalive, true);
  // The normal request learns about the winning flush before its response arrives.
  resolvers[0](jsonResponse({ error: 'conflict', rev: 2, updated: 1, data: { crystals: 15, stats: { runs: 3 } } }, 409));
  await tick(); resolvers[1](jsonResponse({ rev: 2, updated: 1 })); await tick();
  assert.equal(c.run('Save.data.crystals'), 15); assert.equal(c.run('Save.data.stats.runs'), 3);
  resolvers[2](jsonResponse({ rev: 3, updated: 2 })); await pending;
  assert.equal(c.run('Account.cache.dirty'), false);
});

test('storage write/delete failures preserve successful login, progress sync, reset and logout', async () => {
  let rev = 1;
  const c = client({ storageThrows: true, fetcher: async (path, options) => {
    if (path === '/api/login') return jsonResponse({ user: { name: 'PlayerA' } });
    if (path === '/api/logout') return jsonResponse({ ok: true });
    if (options.method === 'GET') return jsonResponse({ rev, updated: 1, data: { crystals: 12 } });
    return jsonResponse({ rev: ++rev, updated: 2 });
  } });
  c.run("Account.inputs[0].value = 'PlayerA'; Account.inputs[1].value = 'pass-word-123';");
  await c.run('Account.submit()');
  assert.equal(c.run('Account.name'), 'PlayerA'); assert.equal(c.run('Account.status'), 'synced');
  assert.equal(c.run('Account.message'), '登录成功，已载入云端存档');
  c.run('Save.data.crystals = 15; Save.write();');
  assert.equal(c.run('Account.cache.dirty'), true); assert.equal(c.run('Account.status'), 'pending');
  assert.equal(await c.run('Account.sync()'), true);
  assert.equal(JSON.parse(c.requests.find(r => r.method === 'PUT').body).data.crystals, 15);
  c.run('Save.reset();'); assert.equal(await c.run('Account.sync()'), true);
  assert.equal(c.run('Account.resetVersion'), null); assert.equal(c.run('Save.data.crystals'), 0);
  await c.run('Account.logout()');
  assert.equal(c.run('Account.status'), 'guest'); assert.equal(c.run('Account.message'), '已退出，当前使用本机存档');
});

test('only the executing account button displays busy copy and color', async () => {
  let resolve;
  const c = client({ fetcher: async () => new Promise(r => { resolve = r; }) });
  activate(c, { crystals: 10 }); c.run('Save.write();');
  const pending = c.run('Account.syncNow()'); await tick();
  assert.equal(c.run('Account.status'), 'syncing'); assert.equal(c.run('Account.busyRow'), 0);
  c.run('UI.drawAccount();');
  assert.ok(c.drawn.some(d => d.y === 252 && d.text === '正在连接…' && d.o.color === '#ffd36a'));
  assert.ok(c.drawn.some(d => d.y === 300 && d.text === '退出登录' && d.o.color === '#9a8acb'));
  resolve(jsonResponse({ rev: 2, updated: 1 })); await pending;
  assert.equal(c.run('Account.busy'), false); assert.equal(c.run('Account.busyRow'), null);
  c.drawn.length = 0; c.run('Account.row = 1;');
  const logout = c.run('Account.logout()'); await tick(); c.run('UI.drawAccount();');
  assert.ok(c.drawn.some(d => d.y === 252 && d.text === '立即同步' && d.o.color === '#9a8acb'));
  assert.ok(c.drawn.some(d => d.y === 300 && d.text === '正在连接…' && d.o.color === '#ffd36a'));
  resolve(jsonResponse({ ok: true })); await logout;
  const background = client({ fetcher: async () => new Promise(r => { resolve = r; }) });
  activate(background, { crystals: 1 }); background.run('Save.write();');
  const sync = background.run('Account.sync()'); await tick(); background.run('UI.drawAccount();');
  assert.ok(background.drawn.some(d => d.y === 252 && d.text === '立即同步' && d.o.color === '#ffffff'));
  assert.ok(!background.drawn.some(d => d.text === '正在连接…'));
  resolve(jsonResponse({ rev: 2, updated: 1 })); await sync;
});

test('account keyboard and hover navigation each play select once per row change', () => {
  const c = client();
  c.run("Input.hit = action => action === 'mdown'; UI.updAccount();");
  assert.equal(c.run('Account.row'), 1); assert.deepEqual(c.sounds, ['select']);
  c.sounds.length = 0;
  c.run('Account.inputs[0]').events.get('keydown')({ key: 'ArrowDown', preventDefault() {} });
  assert.equal(c.run('Account.row'), 2); assert.deepEqual(c.sounds, ['select']);
  activate(c); c.sounds.length = 0; c.run('Account.row = 0; UI.drawAccount();');
  c.run('UI.newRegions.find(r => r.y === 288).onHover();');
  assert.equal(c.run('Account.row'), 1); assert.deepEqual(c.sounds, ['select']);
  c.run('UI.newRegions.find(r => r.y === 288).onHover();');
  assert.deepEqual(c.sounds, ['select']);
});

test('canvas account coordinates, copy, menu index and custom confirm labels', () => {
  const c = client(); c.run('UI.titleAction(5); Account.layout(); UI.drawAccount();');
  assert.equal(c.run('UI.screen'), 'account');
  assert.ok(c.drawn.some(d => d.text === '账号战绩' && d.x === 480 && d.y === 30 && d.o.scale === 2));
  assert.ok(c.drawn.some(d => d.text === '登录' && d.x === 260 && d.y === 308));
  assert.ok(c.drawn.some(d => d.text === '用户名' && d.x === 80 && d.y === 160));
  assert.ok(c.rectangles.some(d => d.color === '#05030a' && d.args.join(',') === '80,178,360,32'));
  c.run("Account.changeTab(1); Account.inputs[1].value = '12345678'; UI.drawAccount();");
  assert.ok(c.drawn.some(d => d.text === '注册并登录' && d.y === 370)); assert.ok(c.drawn.some(d => d.text === '确认密码' && d.y === 284));
  assert.ok(c.drawn.some(d => d.text === '•'.repeat(8)));
  c.run('Account.back();'); assert.equal(c.run('UI.sel'), 5); assert.equal(c.run('UI.screen'), 'title');
  c.run("UI.confirm = {text:'test', labels:['带入','从零开始'], sel:0, yes(){}}; UI.drawConfirm();");
  assert.ok(c.drawn.some(d => d.text === '带入')); assert.ok(c.drawn.some(d => d.text === '从零开始'));
});
