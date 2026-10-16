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
  // foreign: the page switched from one signed-in account to another during a run, which belongs to the previous
  // account; its saves never reach this account's cache (see G.store) until the page is reloaded
  const A = { name: null, cache: null, status: 'guest', last: 0, job: null, timer: null, verified: false, checked: false, retry: 0, foreign: false, file: !C || C.file };
  // every /api call is a billed request: a save waits up to 2 minutes and later saves ride along with that upload;
  // failed syncs retry after 1, 2, then every 5 minutes
  const INTERVAL = 120000, RETRY = [60000, 120000, 300000];
  const listeners = new Set();
  const notify = () => { for (const fn of listeners) { try { fn(); } catch (e) { /* 各自独立 */ } } };
  const cacheKey = (name) => C.cacheKey(GAME, name);
  // /api/me 回答的是不是这个账号（回答里没有用户名时无法判断，不拦）
  const sameUser = (me, name) => !(me && me.user && me.user.name) || me.user.name.toLowerCase() === String(name).toLowerCase();
  // a save request named another account than the session's (GameAccount has moved the profile to the session's)
  const wrongAccount = (e) => !!(e && e.status === 409 && e.data && e.data.error === 'wrong_account');

  // ---------- 存档文档 ----------
  // deleted { auto, slots[3] }：自动存档与各存档位被删除的时间（毫秒）。合并时与存档的 time 比较，较新的一方为准，
  // 删掉的存档不会被别的设备上的旧存档带回来；删除之后别的设备新存的档照样保留。
  const emptyDoc = () => ({ v: 1, meta: {}, auto: null, slots: Array(SLOTS).fill(null), updated: 0 });
  const stamp = (t) => (Number.isSafeInteger(t) && t > 0 ? t : 0);
  function tombs(d) {
    const g = d && d.deleted && typeof d.deleted === 'object' ? d.deleted : {}, slots = Array.isArray(g.slots) ? g.slots : [];
    return { auto: stamp(g.auto), slots: Array.from({ length: SLOTS }, (_, i) => stamp(slots[i])) };
  }
  function normalize(doc) {
    const d = doc && typeof doc === 'object' ? doc : {};
    const slots = Array.isArray(d.slots) ? d.slots : [];
    const out = { v: 1, meta: d.meta && typeof d.meta === 'object' ? d.meta : {}, auto: d.auto || null,
      slots: Array.from({ length: SLOTS }, (_, i) => slots[i] || null), updated: +d.updated || 0 };
    const g = tombs(d);
    if (g.auto || g.slots.some(Boolean)) out.deleted = g;
    return out;
  }
  // 本机（未登录）的进度组成一份文档：首次登录且云端为空时作为账号的起点
  function guestDoc() {
    const slots = raw.get('wl_slots');
    return normalize({ meta: raw.get('wl_meta') || {}, auto: raw.get('wl_save'), slots, updated: Date.now() });
  }
  const hasProgress = (d) => !!(d && (d.auto || d.slots.some(Boolean) || Object.keys(d.meta.dex || {}).length || d.meta.cleared));
  const newer = (x, y) => (!x ? y || null : !y ? x : (+y.time || 0) > (+x.time || 0) ? y : x);
  // 较新的一份留下，除非这个位置在它之后被删过
  const keep = (x, y, cut) => { const s = newer(x, y); return s && (!cut || (+s.time || 0) > cut) ? s : null; };
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
    const a = normalize(local), b = normalize(remote), ga = tombs(a), gb = tombs(b);
    const cut = { auto: Math.max(ga.auto, gb.auto), slots: ga.slots.map((t, i) => Math.max(t, gb.slots[i])) };
    const out = { v: 1, meta: mergeMeta(a.meta, b.meta), auto: keep(a.auto, b.auto, cut.auto), slots: a.slots.map((s, i) => keep(s, b.slots[i], cut.slots[i])),
      updated: Math.max(a.updated, b.updated) };
    if (cut.auto || cut.slots.some(Boolean)) out.deleted = cut;
    return out;
  }

  // ---------- 进度键：登录时读写账号缓存，未登录时读写本机 ----------
  G.store = {
    get(k, d) {
      if (A.cache && FIELD[k]) { const v = A.cache.data ? A.cache.data[FIELD[k]] : null; return v == null ? d : clone(v); }
      return base.get(k, d);
    },
    set(k, v) {
      if (A.cache && FIELD[k]) { if (A.foreign) return false; const d = doc(); erase(d, FIELD[k], v); d[FIELD[k]] = clone(v); touch(); return true; }
      return base.set(k, v);
    },
    del(k) {
      if (A.cache && FIELD[k]) { if (A.foreign) return; const d = doc(); erase(d, FIELD[k], null); d[FIELD[k]] = null; touch(); return; }
      base.del(k);
    },
  };
  function doc() { if (!A.cache.data) A.cache.data = emptyDoc(); return A.cache.data; }
  // 存档被删掉（或被空位替换）时记下删除时间，至少比被删的那份新，别的设备上的旧存档不会在合并时复活
  function erase(d, field, next) {
    const mark = (i, old) => {
      const g = d.deleted = tombs(d), t = Math.max(Date.now(), (+old.time || 0) + 1);
      if (i < 0) g.auto = t; else g.slots[i] = t;
    };
    if (field === 'auto' && d.auto && !next) mark(-1, d.auto);
    if (field === 'slots') (Array.isArray(d.slots) ? d.slots : []).forEach((s, i) => { if (s && i < SLOTS && !(Array.isArray(next) && next[i])) mark(i, s); });
  }
  function persistCache() { if (A.name && A.cache) { A.cache.name = A.name; raw.set(cacheKey(A.name), A.cache); } }
  function touch() { A.cache.data.updated = Date.now(); A.cache.dirty = true; persistCache(); schedule(); }
  const hidden = () => document.visibilityState === 'hidden';
  // one pending upload at a time (later saves ride along); a hidden tab only uploads from the hide flush
  function schedule(delay = INTERVAL) {
    if (!A.name || A.file || A.status === 'expired' || A.timer || hidden()) return;
    A.timer = setTimeout(() => { A.timer = null; sync(); }, delay);
  }
  function retry() { clearTimeout(A.timer); A.timer = null; schedule(RETRY[Math.min(A.retry++, RETRY.length - 1)]); }
  // a 409 answers with the cloud save: merge with it, no extra GET
  function conflict(e) {
    if (!e || e.status !== 409 || !e.data || !Number.isSafeInteger(e.data.rev)) throw e;
    return { rev: e.data.rev, data: e.data.data == null ? null : e.data.data };
  }
  // one PUT on a version this device has merged with
  async function upload(cache, baseRev, keepalive) {
    const body = { baseRev, data: cache.data }, sent = JSON.stringify(cache.data);
    // browsers cap keepalive bodies at 64 KB; a bigger save goes as a normal request
    const small = keepalive && new TextEncoder().encode(JSON.stringify(body)).length < 60000;
    const next = await C.request('/api/save/' + GAME, 'PUT', body, small, undefined, { account: cache.name || A.name });
    if (A.cache !== cache) return false;
    // 上传途中游戏又存了档：这份新存档还要再传一次
    cache.rev = next.rev; cache.dirty = JSON.stringify(cache.data) !== sent; persistCache();
    if (cache.dirty) schedule();
    return done();
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
    clearTimeout(A.timer); A.timer = null;
    A.status = 'syncing'; notify();
    const cache = A.cache;
    A.job = (async () => {
      try {
        if (!A.verified) {
          const me = await C.me();
          // 会话属于另一个账号时，GameAccount.me() 会把资料切过去，这里随之换成那个账号的缓存；这份缓存不会传到别的账号
          if (A.cache !== cache) return false;
          if (!sameUser(me, A.name)) { A.status = 'expired'; return false; }
          A.verified = true;
        }
        let remote = null;
        for (let tries = 0; tries < 3; tries++) {
          // this page already compared with the cloud: a save goes up as one PUT on the known version
          if (!remote && A.checked && !cache.fresh && cache.dirty && cache.data) {
            try { return await upload(cache, cache.rev, keepalive); } catch (e) { remote = conflict(e); }
          }
          const got = remote || await C.request('/api/save/' + GAME, 'GET', undefined, false, undefined, { account: cache.name || A.name });
          remote = null;
          if (A.cache !== cache) return false;
          A.checked = true;
          if (cache.fresh) {
            // this account has no save anywhere while another account's run is on screen: nothing goes up; after the
            // reload it starts like any first sign-in on this device
            if (!got.data && A.foreign) { A.status = 'pending'; return false; }
            // 这个账号第一次在这台设备上玩：云端有存档就用云端的；云端为空时，本机进度成为账号的起点
            delete cache.fresh;
            if (got.data) { apply(got.data, got.rev); cache.dirty = false; persistCache(); return done(); }
            const start = guestDoc();
            apply(hasProgress(start) ? start : emptyDoc(), got.rev);
            cache.dirty = true; persistCache();
          } else if (got.rev !== cache.rev) {
            // 别的设备更新过：本机没有新改动就直接采用云端，否则合并后再上传
            if (!cache.dirty) { apply(got.data, got.rev); return done(); }
            apply(merge(cache.data, got.data), got.rev);
            cache.dirty = true; persistCache();
          } else if (!cache.dirty) return done();
          try { return await upload(cache, got.rev, keepalive); } catch (e) { remote = conflict(e); }
        }
        A.status = 'error'; retry();
        return false;
      } catch (e) {
        // 上一个账号留下的同步不改动新账号的状态
        if (A.cache !== cache) return false;
        // the session belongs to another account: stop here, the profile change re-activates this module
        if (wrongAccount(e)) { A.status = 'expired'; return false; }
        A.status = e && e.status === 401 ? 'expired' : e && e.status === 422 ? 'rejected' : 'error';
        if (A.status !== 'expired') retry();
        return false;
      } finally { if (A.cache === cache) A.job = null; notify(); }
    })();
    return A.job;
  }
  function done() { A.retry = 0; A.last = Date.now(); A.status = 'synced'; return true; }

  // ---------- 账号切换 ----------
  function activate(name) {
    // 上一个账号还在进行的同步会在下一步停下；这个账号开始自己的同步
    clearTimeout(A.timer); A.timer = null; A.job = null;
    // switching between two signed-in accounts: a run on screen started under the previous account
    const switching = !!A.name && A.name.toLowerCase() !== name.toLowerCase();
    if (switching && G.game && G.game.running) A.foreign = true;
    A.name = name; A.verified = false; A.checked = false; A.retry = 0;
    const cached = raw.get(cacheKey(name));
    A.cache = cached && Number.isSafeInteger(cached.rev) && cached.data ? cached : { name, rev: 0, dirty: false, data: null, fresh: true };
    A.status = 'pending';
    G.loadMeta(); notify();
    if (switching && !A.foreign) redrawTitle();
    return sync();
  }
  // the title menu offers the signed-in account's autosave: draw it again for the new account
  function redrawTitle() {
    try {
      const app = document.getElementById('app'), title = document.getElementById('title');
      if (app && title && !app.classList.contains('booting') && !title.classList.contains('hidden') && G.ui && G.ui.showTitle) G.ui.showTitle();
    } catch (e) { /* drawn again the next time the title opens */ }
  }
  function deactivate() {
    clearTimeout(A.timer); A.timer = null;
    A.name = null; A.cache = null; A.status = 'guest'; A.verified = false; A.checked = false; A.foreign = false;
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
    if (A.foreign && A.status !== 'expired') return { logged: true, text: `${A.name} · 请刷新页面`, state: 'reload' };
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
    // hiding the tab sends the save once and stops the timer; showing it again resumes uploads
    document.addEventListener('visibilitychange', () => {
      if (hidden()) { flush(); clearTimeout(A.timer); A.timer = null; }
      else if (A.cache && A.cache.dirty) schedule();
    });
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
