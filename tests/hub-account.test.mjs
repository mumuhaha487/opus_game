import test from 'node:test';
import assert from 'node:assert/strict';
import { hubContext, jsonResponse, tick } from './helpers/hub-context.mjs';

test('shared core migrates profile, caches and resets without touching guest/settings', () => {
  const storage = new Map([
    ['entropy_blade_profile_v1', '{"name":"PlayerA"}'], ['entropy_blade_acct_playera_v1', '{"dirty":true}'], ['entropy_blade_acct_playera_reset_v1', 'true'],
    ['entropy_blade_acct_a_reset_v1', '{"dirty":true}'],
    ['entropy_blade_save_v1', '{"crystals":9}'], ['entropy_blade_settings_v1', '{"music":0.5}'],
  ]);
  const c = hubContext({ storage });
  assert.deepEqual(c.json('GameAccount.profile()'), { name: 'PlayerA' });
  assert.equal(storage.get('gameinc_profile_v1'), '{"name":"PlayerA"}'); assert.equal(storage.has('entropy_blade_profile_v1'), false);
  assert.equal(storage.get('gameinc_save_entropy-blade_playera_v1'), '{"dirty":true}');
  assert.equal(storage.get('gameinc_save_entropy-blade_playera_reset_v1'), 'true');
  assert.equal(storage.get('gameinc_save_entropy-blade_a_reset_v1'), '{"dirty":true}');
  assert.ok(![...storage.keys()].some(key => key.startsWith('entropy_blade_acct_')));
  assert.equal(storage.get('entropy_blade_save_v1'), '{"crystals":9}'); assert.equal(storage.get('entropy_blade_settings_v1'), '{"music":0.5}');
});

test('migration retains existing new keys and removes old copies', () => {
  const storage = new Map([['gameinc_profile_v1', '{"name":"PlayerB"}'], ['entropy_blade_profile_v1', '{"name":"PlayerA"}'], ['gameinc_save_entropy-blade_playera_v1', 'new'], ['entropy_blade_acct_playera_v1', 'old'], ['gameinc_save_entropy-blade_playera_reset_v1', 'false'], ['entropy_blade_acct_playera_reset_v1', 'true']]);
  const c = hubContext({ storage });
  assert.deepEqual(c.json('GameAccount.profile()'), { name: 'PlayerB' });
  assert.equal(storage.get('gameinc_save_entropy-blade_playera_v1'), 'new'); assert.equal(storage.get('gameinc_save_entropy-blade_playera_reset_v1'), 'false');
  assert.ok(![...storage.keys()].some(key => key.startsWith('entropy_blade_acct_') || key === 'entropy_blade_profile_v1'));
});

test('shared login/register validation, requests, error copy and file mode', async () => {
  const c = hubContext({ fetcher: async () => jsonResponse({ user: { name: 'PlayerA' } }) });
  assert.equal(c.run("GameAccount.validName('ab')"), false); assert.equal(c.run("GameAccount.validName('Player_A')"), true);
  assert.equal(c.run("GameAccount.validPassword('😀'.repeat(8))"), true); assert.equal(c.run("GameAccount.validPassword('x'.repeat(65))"), false);
  await c.run("GameAccount.login('PlayerA', 'test-password')"); assert.deepEqual(c.json('GameAccount.profile()'), { name: 'PlayerA' });
  await c.run("GameAccount.register('PlayerA', 'test-password')");
  for (const request of c.requests) { assert.equal(request.credentials, 'same-origin'); assert.equal(request.headers['Content-Type'], 'application/json'); }
  assert.equal(c.run("GameAccount.errorText({data:{error:'rate_limited',retryAfter:61}})"), '尝试次数过多，请 2 分钟后再试');
  assert.ok([...c.storage.values()].every(value => !value.includes('test-password')));
  const failed = hubContext({ fetcher: async () => jsonResponse({ error: 'bad_credentials' }, 401) });
  await assert.rejects(failed.run("GameAccount.login('PlayerA','incorrect')"), error => error.status === 401 && error.data.error === 'bad_credentials');
  assert.equal(failed.run('GameAccount.profile()'), null);
  const local = hubContext({ file: true }); await assert.rejects(local.run('GameAccount.me()'), /file/); assert.equal(local.requests.length, 0);
});

test('logout flushes first, removes clean caches, keeps conflicts/offline caches and other users', async () => {
  const cache = (dirty, data = { crystals: 4 }) => JSON.stringify({ name: 'PlayerA', rev: 2, data, base: { crystals: 1 }, dirty });
  const storage = new Map([['gameinc_profile_v1', '{"name":"PlayerA"}'], ['gameinc_save_entropy-blade_playera_v1', cache(true)], ['gameinc_save_clean-game_playera_v1', cache(false)], ['gameinc_save_conflict-game_playera_v1', cache(true)], ['gameinc_save_offline-game_playera_v1', cache(true)], ['gameinc_save_entropy-blade_playerb_v1', cache(false)], ['gameinc_save_clean-game_playera_reset_v1', 'true']]);
  const c = hubContext({ storage, fetcher: async path => {
    if (path === '/api/save/conflict-game') return jsonResponse({ error: 'conflict' }, 409);
    if (path === '/api/save/offline-game') throw new Error('offline');
    return jsonResponse(path === '/api/logout' ? { ok: true } : { rev: 3, updated: 1 });
  } });
  let flushes = 0; c.run('GameAccount').flush = () => { flushes++; };
  const result = await c.run('GameAccount.logout({flush:GameAccount.flush})');
  assert.equal(flushes, 1); assert.deepEqual([...result.kept], ['conflict-game', 'offline-game']);
  assert.equal(storage.has('gameinc_profile_v1'), false); assert.equal(storage.has('gameinc_save_entropy-blade_playera_v1'), false);
  assert.equal(storage.has('gameinc_save_clean-game_playera_v1'), false); assert.equal(storage.has('gameinc_save_clean-game_playera_reset_v1'), false);
  assert.equal(JSON.parse(storage.get('gameinc_save_conflict-game_playera_v1')).dirty, true);
  assert.equal(JSON.parse(storage.get('gameinc_save_offline-game_playera_v1')).dirty, true);
  assert.ok(storage.has('gameinc_save_entropy-blade_playerb_v1'));
  assert.equal(c.requests.at(-1).path, '/api/logout');
});

test('failed logout retains profile and newly synced cache revision/base', async () => {
  const storage = new Map([['gameinc_profile_v1', '{"name":"PlayerA"}'], ['gameinc_save_entropy-blade_playera_v1', JSON.stringify({ name: 'PlayerA', rev: 2, data: { crystals: 4 }, base: null, dirty: true })]]);
  const c = hubContext({ storage, fetcher: async path => { if (path === '/api/logout') throw new Error('offline'); return jsonResponse({ rev: 3, updated: 1 }); } });
  await assert.rejects(c.run('GameAccount.logout()'), /offline/);
  assert.deepEqual(c.json('GameAccount.profile()'), { name: 'PlayerA' });
  const cache = JSON.parse(storage.get('gameinc_save_entropy-blade_playera_v1'));
  assert.equal(cache.dirty, false); assert.equal(cache.rev, 3); assert.deepEqual(cache.base, cache.data);
});

test('logout does not discard writes made by a game during a generic upload', async () => {
  let resolve;
  const storage = new Map([['gameinc_profile_v1', '{"name":"PlayerA"}'], ['gameinc_save_entropy-blade_playera_v1', JSON.stringify({ name: 'PlayerA', rev: 2, data: { crystals: 4 }, base: null, dirty: true })]]);
  const c = hubContext({ storage, fetcher: async path => path === '/api/logout' ? jsonResponse({ ok: true }) : new Promise(r => { resolve = r; }) });
  const pending = c.run('GameAccount.logout()'); await tick();
  const cache = JSON.parse(storage.get('gameinc_save_entropy-blade_playera_v1')); cache.data.crystals = 7; storage.set('gameinc_save_entropy-blade_playera_v1', JSON.stringify(cache));
  resolve(jsonResponse({ rev: 3, updated: 1 }));
  assert.deepEqual([...(await pending).kept], ['entropy-blade']);
  const kept = JSON.parse(storage.get('gameinc_save_entropy-blade_playera_v1'));
  assert.equal(kept.data.crystals, 7); assert.equal(kept.base.crystals, 4); assert.equal(kept.rev, 3); assert.equal(kept.dirty, true);
});

test('profile events notify subscribers; unavailable storage never breaks login/logout', async () => {
  const c = hubContext(), values = []; const unsubscribe = c.run('GameAccount').onProfileChange(value => values.push(value));
  c.event('storage', { key: 'irrelevant', newValue: '{}' }); assert.equal(values.length, 0);
  c.event('storage', { key: 'gameinc_profile_v1', newValue: '{"name":"PlayerA"}' }); assert.deepEqual({ ...values[0] }, { name: 'PlayerA' });
  c.event('storage', { key: 'gameinc_profile_v1', newValue: null }); assert.equal(values[1], null); unsubscribe();
  c.event('storage', { key: 'gameinc_profile_v1', newValue: '{}' }); assert.equal(values.length, 2);
  const failedStorage = hubContext({ storageThrows: true, fetcher: async path => jsonResponse(path === '/api/logout' ? { ok: true } : { user: { name: 'PlayerA' } }) });
  await failedStorage.run("GameAccount.login('PlayerA','test-password')"); assert.deepEqual(failedStorage.json('GameAccount.profile()'), { name: 'PlayerA' });
  assert.deepEqual([...(await failedStorage.run('GameAccount.logout()')).kept], []); assert.equal(failedStorage.run('GameAccount.profile()'), null);
});
