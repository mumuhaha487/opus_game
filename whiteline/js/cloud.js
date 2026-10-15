/* =========================================================
   cloud.js —— 存档与 GAME.INC.RE 账号同步
   进度（自动存档 wl_save、手动存档 wl_slots、图鉴 wl_meta）：
   · 未登录：保存在这台设备（localStorage 原有键）。
   · 登录后：保存在该账号的缓存 { name, rev, dirty, data }，并同步到 /api/save/whiteline；
     两台设备都改过时按条目合并（图鉴取并集，每个存档位保留较新的一份）。
   设置（wl_settings）始终只在本机。
   ========================================================= */
(function () {
  'use strict';
  // GameAccount 是 hub/account-core.js 的顶层 const，不在 window 上
  const C = typeof GameAccount !== 'undefined' ? GameAccount : null;
  const GAME = 'whiteline', SLOTS = 3;
  const FIELD = { wl_save: 'auto', wl_meta: 'meta', wl_slots: 'slots' };
  const base = G.store;
  const raw = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  };
  const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));
  const A = { name: null, cache: null, status: 'guest', last: 0, job: null, timer: null, verified: false, file: !C || C.file };
  const listeners = new Set();
  const notify = () => { for (const fn of listeners) { try { fn(); } catch (e) { /* 各自独立 */ } } };
  const cacheKey = (name) => C.cacheKey(GAME, name);

  // ---------- 存档文档 ----------
  const emptyDoc = () => ({ v: 1, meta: {}, auto: null, slots: Array(SLOTS).fill(null), updated: 0 });
  function normalize(doc) {
    const d = doc && typeof doc === 'object' ? doc : {};
    const slots = Array.isArray(d.slots) ? d.slots : [];
    return { v: 1, meta: d.meta && typeof d.meta === 'object' ? d.meta : {}, auto: d.auto || null,
      slots: Array.from({ length: SLOTS }, (_, i) => slots[i] || null), updated: +d.updated || 0 };
  }
  // 本机（未登录）的进度组成一份文档：首次登录且云端为空时作为账号的起点
  function guestDoc() {
    const slots = raw.get('wl_slots');
    return normalize({ meta: raw.get('wl_meta') || {}, auto: raw.get('wl_save'), slots, updated: Date.now() });
  }
  const hasProgress = (d) => !!(d && (d.auto || d.slots.some(Boolean) || Object.keys(d.meta.dex || {}).length || d.meta.cleared));
  const newer = (x, y) => (!x ? y || null : !y ? x : (+y.time || 0) > (+x.time || 0) ? y : x);
  function mergeMeta(x = {}, y = {}) {
    const out = Object.assign({}, y, x);
    for (const k of ['combos', 'tagsSeen', 'endings', 'secrets']) out[k] = Object.assign({}, y[k] || {}, x[k] || {});
    out.dex = Object.assign({}, y.dex || {});
    for (const [k, v] of Object.entries(x.dex || {})) out.dex[k] = Math.max(+v || 0, +out.dex[k] || 0);
    out.solutions = {};
    for (const node of new Set([...Object.keys(x.solutions || {}), ...Object.keys(y.solutions || {})])) {
      out.solutions[node] = Object.assign({}, (y.solutions || {})[node] || {}, (x.solutions || {})[node] || {});
    }
    out.cleared = !!(x.cleared || y.cleared); out.sandbox = !!(x.sandbox || y.sandbox);
    return out;
  }
  function merge(local, remote) {
    if (!local) return normalize(remote); if (!remote) return normalize(local);
    const a = normalize(local), b = normalize(remote);
    return { v: 1, meta: mergeMeta(a.meta, b.meta), auto: newer(a.auto, b.auto), slots: a.slots.map((s, i) => newer(s, b.slots[i])),
      updated: Math.max(a.updated, b.updated) };
  }

  // ---------- 进度键：登录时读写账号缓存，未登录时读写本机 ----------
  G.store = {
    get(k, d) {
      if (A.cache && FIELD[k]) { const v = A.cache.data ? A.cache.data[FIELD[k]] : null; return v == null ? d : clone(v); }
      return base.get(k, d);
    },
    set(k, v) {
      if (A.cache && FIELD[k]) { doc()[FIELD[k]] = clone(v); touch(); return true; }
      return base.set(k, v);
    },
    del(k) {
      if (A.cache && FIELD[k]) { doc()[FIELD[k]] = null; touch(); return; }
      base.del(k);
    },
  };
  function doc() { if (!A.cache.data) A.cache.data = emptyDoc(); return A.cache.data; }
  function persistCache() { if (A.name && A.cache) { A.cache.name = A.name; raw.set(cacheKey(A.name), A.cache); } }
  function touch() { A.cache.data.updated = Date.now(); A.cache.dirty = true; persistCache(); schedule(); }
  function schedule(delay = 20000) {
    if (!A.name || A.file || A.status === 'expired' || A.timer) return;
    A.timer = setTimeout(() => { A.timer = null; sync(); }, delay);
  }
  // 云端的数据写进账号缓存，并刷新图鉴等常驻数据
  function apply(data, rev) {
    A.cache.data = normalize(data);
    if (rev != null) A.cache.rev = rev;
    persistCache();
    G.loadMeta();
  }

  // ---------- 同步 ----------
  async function sync(keepalive = false) {
    if (!A.name || A.file || A.status === 'expired') return false;
    if (A.job) return A.job;
    A.status = 'syncing'; notify();
    const cache = A.cache;
    A.job = (async () => {
      try {
        if (!A.verified) { await C.me(); A.verified = true; }
        for (let tries = 0; tries < 3; tries++) {
          const remote = await C.request('/api/save/' + GAME);
          if (A.cache !== cache) return false;
          if (cache.fresh) {
            // 这个账号第一次在这台设备上玩：云端有存档就用云端的；云端为空时，本机进度成为账号的起点
            delete cache.fresh;
            if (remote.data) { apply(remote.data, remote.rev); cache.dirty = false; persistCache(); return done(); }
            const start = guestDoc();
            apply(hasProgress(start) ? start : emptyDoc(), remote.rev);
            cache.dirty = true; persistCache();
          } else if (remote.rev !== cache.rev) {
            // 别的设备更新过：本机没有新改动就直接采用云端，否则合并后再上传
            if (!cache.dirty) { apply(remote.data, remote.rev); return done(); }
            apply(merge(cache.data, remote.data), remote.rev);
            cache.dirty = true; persistCache();
          } else if (!cache.dirty) return done();
          try {
            const next = await C.request('/api/save/' + GAME, 'PUT', { baseRev: remote.rev, data: cache.data }, keepalive);
            cache.rev = next.rev; cache.dirty = false; persistCache();
            return done();
          } catch (e) { if (e.status !== 409) throw e; }
        }
        A.status = 'error'; schedule(60000);
        return false;
      } catch (e) {
        A.status = e && e.status === 401 ? 'expired' : e && e.status === 422 ? 'rejected' : 'error';
        if (A.status !== 'expired') schedule(60000);
        return false;
      } finally { A.job = null; notify(); }
    })();
    return A.job;
  }
  function done() { A.last = Date.now(); A.status = 'synced'; return true; }

  // ---------- 账号切换 ----------
  function activate(name) {
    A.name = name; A.verified = false;
    const cached = raw.get(cacheKey(name));
    A.cache = cached && Number.isSafeInteger(cached.rev) && cached.data ? cached : { name, rev: 0, dirty: false, data: null, fresh: true };
    A.status = 'pending';
    G.loadMeta(); notify();
    return sync();
  }
  function deactivate() {
    clearTimeout(A.timer); A.timer = null;
    A.name = null; A.cache = null; A.status = 'guest'; A.verified = false;
    G.loadMeta(); notify();
  }
  async function login(username, password, register) {
    const r = await (register ? C.register(username, password) : C.login(username, password));
    A.verified = true;
    await activate(r.name);
    return r.name;
  }
  async function logout() {
    if (!A.name) return { kept: [] };
    const res = await C.logout({ flush: async () => { if (A.cache && A.cache.dirty) await sync(); } });
    deactivate();
    return res;
  }
  function status() {
    if (A.file) return { logged: false, text: '本地文件模式：存档保存在这台设备上。' };
    if (!A.name) return { logged: false, text: '未登录：存档保存在这台设备上。登录 GAME.INC.RE 账号后，存档会在你的所有设备间同步。' };
    const when = A.last ? new Date(A.last).toTimeString().slice(0, 5) : '';
    const map = { synced: `${A.name} · 已同步 ${when}`, syncing: `${A.name} · 正在同步…`, pending: `${A.name} · 等待同步`,
      error: `${A.name} · 暂时连不上服务器，稍后自动重试`, expired: `${A.name} · 登录已过期，请重新登录`, rejected: `${A.name} · 同步失败，存档保留在这台设备上` };
    return { logged: A.status !== 'expired', text: map[A.status] || map.pending, state: A.status };
  }

  if (C && !A.file) {
    const profile = C.profile();
    if (profile) activate(profile.name);
    // 在主页或其他游戏里登录、退出时跟着切换
    C.onProfileChange((p) => {
      if (!p && A.name) deactivate();
      else if (p && p.name.toLowerCase() !== (A.name || '').toLowerCase()) activate(p.name);
    });
    window.addEventListener('online', () => sync());
    const flush = () => { if (A.name && A.cache && A.cache.dirty) sync(true); };
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
    window.addEventListener('pagehide', flush);
  }

  G.cloud = {
    SLOTS, status, login, logout, sync, merge,
    syncNow: () => sync(),
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    get name() { return A.name; },
    get file() { return A.file; },
    validName: (u) => !!C && C.validName(u),
    validPassword: (p) => !!C && C.validPassword(p),
    errorText: (e) => (C ? C.errorText(e) : '无法连接服务器，请稍后再试'),
  };
})();
