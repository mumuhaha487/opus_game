'use strict';
// =====================================================================
//  CLOUD — GAME.INC.RE account sync for TBMH. Guests keep tbmh_save_v3;
//  a signed-in player keeps an account cache { name, rev, dirty, data }
//  that the hub can see and flush. Conflicts keep the deeper progress.
// =====================================================================
const GUEST_KEY = 'tbmh_save_v3', GUEST_KEY_V2 = 'tbmh_save_v2', GUEST_KEY_V1 = 'tbmh_save_v1';
const Cloud = (() => {
  // GameAccount is a top-level const in hub/account-core.js, not a window property
  const C = typeof GameAccount !== 'undefined' ? GameAccount : null;
  const read = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
  const A = { name: null, cache: null, status: 'guest', last: 0, job: null, timer: null, verified: false, pulled: false, saves: 0, retry: 0, file: !C || C.file };
  // every /api call is a billed request: an idle game saves every few seconds, so a save waits up to 3 minutes and
  // rides along with the next upload; failed syncs retry after 1, 2, then every 5 minutes
  const INTERVAL = 180000, RETRY = [60000, 120000, 300000];
  // deeper progress wins a conflict: stages cleared across difficulties, then the best hero level, then play time;
  // a second-edition save counts by its own scale (90 stages per difficulty) so it is never preferred over a third-edition one
  const score = d => {
    if (!d) return -1;
    const play = (d.stats?.play || 0) / 3600;
    if (d.v !== SAVE_VERSION) return d.v === 2 && Array.isArray(d.prog?.best) ? d.prog.best.reduce((a, x) => a + (+x || 0), 0) / 3 * 1e6 * 0.999 + play : play / 1e6;
    const best = Array.isArray(d.prog?.best) ? d.prog.best.reduce((a, x) => a + (+x || 0), 0) : 0;
    const lv = d.heroes && typeof d.heroes === 'object' ? Math.max(0, ...Object.values(d.heroes).map(h => +h?.lv || 0)) : 0;
    return best * 1e6 + lv * 1e3 + play;
  };
  const cacheKey = name => C.cacheKey('tbmh', name);
  // /api/me answered for this account (an answer without a name cannot tell, so it does not block)
  const sameUser = (me, name) => !me?.user?.name || me.user.name.toLowerCase() === String(name).toLowerCase();
  // a save request named another account than the session's (GameAccount has moved the profile to the session's)
  const wrongAccount = e => !!e && e.status === 409 && e.data?.error === 'wrong_account';

  // the save to start with: account cache when signed in, else the guest slot;
  // older editions become the starting point of the new world once
  const guest = () => read(GUEST_KEY) || read(GUEST_KEY_V2) || read(GUEST_KEY_V1);
  function boot() {
    const profile = C && !A.file ? C.profile() : null;
    if (profile) {
      A.name = profile.name;
      const cached = read(cacheKey(profile.name));
      A.cache = cached && cached.data && Number.isSafeInteger(cached.rev) ? cached : { name: profile.name, rev: 0, dirty: false, data: null, fresh: true };
      A.status = 'pending';
      setTimeout(() => sync(), 300);
      if (A.cache.data) return normalizeSave(A.cache.data);
      // nothing cached for this account yet: show the guest progress until the first pull decides
      const g = guest();
      return g ? normalizeSave(g) : null;
    }
    const g = guest();
    return g ? normalizeSave(g) : null;
  }
  // the cache holds the live game state, which the battle advances every frame; it counts as saved data only
  // when the game calls persist(), so A.saves tells whether a save happened while an upload was in flight
  function persist(s) {
    if (A.name && A.cache) { A.cache.data = s; A.cache.dirty = true; A.cache.name = A.name; A.saves++; write(cacheKey(A.name), A.cache); schedule(); }
    else write(GUEST_KEY, s);
  }
  const hidden = () => document.visibilityState === 'hidden';
  // one pending upload at a time (later saves ride along); a hidden tab only uploads from the hide flush
  function schedule(delay = INTERVAL) {
    if (!A.name || A.file || A.status === 'expired' || A.timer || hidden()) return;
    A.timer = setTimeout(() => { A.timer = null; sync(); }, delay);
  }
  function retry() { clearTimeout(A.timer); A.timer = null; schedule(RETRY[Math.min(A.retry++, RETRY.length - 1)]); }
  function done() { A.retry = 0; A.last = Date.now(); A.status = 'synced'; return true; }
  // a 409 answers with the cloud save: that is the version to compare with, no extra GET
  const conflict = e => {
    if (!e || e.status !== 409 || !e.data || !Number.isSafeInteger(e.data.rev)) throw e;
    return { rev: e.data.rev, data: e.data.data ?? null };
  };
  // one PUT on the version this device last agreed with: a device that fell behind gets a 409 and compares again
  async function upload(cache, keepalive) {
    const data = Game.ready ? Game.save() : cache.data;
    if (!data) return false;
    const saves = A.saves, body = { baseRev: cache.rev, data };
    // browsers cap keepalive bodies at 64 KB; a bigger save goes as a normal request
    const small = keepalive && new TextEncoder().encode(JSON.stringify(body)).length < 60000;
    const next = await C.request('/api/save/tbmh', 'PUT', body, small, undefined, { account: cache.name || A.name });
    if (A.cache !== cache) return false;
    // the game saved again while the request was in flight: that save still has to go up
    cache.rev = next.rev; cache.dirty = A.saves !== saves; persistCache();
    if (cache.dirty) schedule();
    return done();
  }
  async function sync(keepalive = false) {
    if (!A.name || A.file || A.status === 'expired') return false;
    if (A.job) return A.job;
    clearTimeout(A.timer); A.timer = null;
    A.status = 'syncing';
    const cache = A.cache;
    A.job = (async () => {
      try {
        if (!A.verified) {
          const me = await C.me();
          // GameAccount.me() moves the profile to the session's account, which re-activates this module with that
          // account's cache; this cache never goes up under another account's session
          if (A.cache !== cache) return false;
          if (!sameUser(me, A.name)) { A.status = 'expired'; return false; }
          A.verified = true;
        }
        let remote = null;
        for (let tries = 0; tries < 3; tries++) {
          // this page already compared with the cloud: a save goes up as one PUT
          if (!remote && A.pulled && !cache.fresh && cache.dirty) {
            try { return await upload(cache, keepalive); } catch (e) { remote = conflict(e); }
          }
          const got = remote || await C.request('/api/save/tbmh', 'GET', undefined, false, undefined, { account: cache.name || A.name });
          remote = null;
          if (A.cache !== cache) return false;
          const local = Game.ready ? Game.save() : cache.data;
          const takeRemote = () => {
            cache.rev = got.rev; Game.adopt(normalizeSave(got.data), 'cloud'); cache.dirty = false; persistCache();
            // the adopted save is the cloud copy: nothing waits to go up
            clearTimeout(A.timer); A.timer = null;
            return done();
          };
          if (cache.fresh) {
            // first time this account plays on this device
            A.pulled = true; delete cache.fresh;
            if (got.data) return takeRemote();
            await Game.firstAccountSave();
            if (A.cache !== cache) return false;
            cache.rev = got.rev; cache.dirty = true;
          } else if (!A.pulled || got.rev !== cache.rev) {
            // first pull, or another device saved since this one last synced: the deeper progress wins
            A.pulled = true;
            if (got.data && score(got.data) > score(local)) return takeRemote();
            // this device's progress goes up over that version
            if (got.rev !== cache.rev) { cache.rev = got.rev; cache.dirty = true; }
          }
          if (!cache.dirty) { persistCache(); return done(); }
          try { return await upload(cache, keepalive); } catch (e) { remote = conflict(e); }
        }
        A.status = 'error'; retry();
        return false;
      } catch (e) {
        // a sync left over from the previous account leaves the new one alone
        if (A.cache !== cache) return false;
        // the session belongs to another account: stop here, the profile change re-activates this module
        if (wrongAccount(e)) { A.status = 'expired'; return false; }
        // PLATFORM 5.3: 保留本地存档；下次 GET 后重新执行原有深度冲突选择。
        if (e && e.status === 422) { A.pulled = false; A.status = 'rejected'; retry(); return false; }
        A.status = e && e.status === 401 ? 'expired' : 'error';
        if (A.status === 'error') retry();
        return false;
      } finally { if (A.cache === cache) A.job = null; }
    })();
    return A.job;
  }
  function persistCache() { if (A.name && A.cache) { A.cache.name = A.name; write(cacheKey(A.name), A.cache); } }
  function status() {
    if (A.file) return { logged: false, text: '本地文件模式：进度保存在这台设备上', color: PAL.steel };
    if (!A.name) return { logged: false, text: '未登录：进度保存在这台设备上。登录后在所有设备同步', color: PAL.steel };
    const when = A.last ? new Date(A.last).toTimeString().slice(0, 5) : '';
    if (A.status === 'rejected') return { logged: true, text: `${A.name} · 同步失败`, color: PAL.amber };
    const map = { synced: [`${A.name} · 已同步 ${when}`, PAL.green], syncing: [`${A.name} · 正在同步…`, PAL.cyan], pending: [`${A.name} · 等待同步`, PAL.cream], error: [`${A.name} · 暂时连不上服务器，稍后自动重试`, PAL.amber], expired: [`${A.name} · 登录已过期，请重新登录`, PAL.red] };
    const [text, color] = map[A.status] || map.pending;
    return { logged: A.status !== 'expired', text, color };
  }
  async function logout() {
    if (!A.name) return;
    try {
      const res = await C.logout({ flush: async () => { if (A.cache && A.cache.dirty) await sync(); } });
      A.name = null; A.cache = null; A.status = 'guest'; A.verified = false; A.pulled = false;
      const g = guest();
      Game.adopt(g ? normalizeSave(g) : null, 'guest');
      Game.say(res.kept.includes('tbmh') ? '已退出，未同步的进度留在这台设备上' : '已退出，回到本机存档', PAL.cream);
    } catch (e) { Game.say(C.errorText(e), PAL.red); }
  }
  async function syncNow() { const ok = await sync(); Game.say(ok ? '已同步到云端' : status().text, ok ? PAL.green : PAL.amber); }

  // ---------- small DOM form for signing in ----------
  function openLogin() {
    if (A.file) return;
    const dlg = document.getElementById('login');
    const form = dlg.querySelector('form'), msg = dlg.querySelector('.msg'), tabs = [...dlg.querySelectorAll('.tab')], confirm = form.elements.confirm;
    let mode = 0;
    const setMode = m => { mode = m; tabs.forEach((t, i) => t.setAttribute('aria-selected', String(i === m))); confirm.parentElement.hidden = m !== 1; form.querySelector('button[type=submit]').textContent = m ? '注册并登录' : '登录'; msg.textContent = ''; };
    tabs.forEach((t, i) => (t.onclick = () => setMode(i)));
    dlg.querySelector('.x').onclick = () => dlg.close();
    setMode(0);
    form.onsubmit = async e => {
      e.preventDefault();
      const u = form.elements.username.value.trim(), p = form.elements.password.value;
      if (!C.validName(u)) { msg.textContent = C.errorText({ data: { error: 'bad_username' } }); return; }
      if (!C.validPassword(p)) { msg.textContent = C.errorText({ data: { error: 'bad_password' } }); return; }
      if (mode && p !== confirm.value) { msg.textContent = '两次输入的密码不一致'; return; }
      msg.textContent = '正在连接…';
      try {
        const r = await (mode ? C.register(u, p) : C.login(u, p));
        form.elements.password.value = ''; confirm.value = '';
        dlg.close();
        activate(r.name);
      } catch (err) { msg.textContent = C.errorText(err); }
    };
    dlg.showModal();
    form.elements.username.focus();
  }
  // switch to an account's cache and pull
  function activate(name) {
    // a sync still running for the previous account stops at its next step; this account starts its own
    const switching = !!A.name && A.name.toLowerCase() !== name.toLowerCase();
    clearTimeout(A.timer); A.timer = null; A.job = null;
    A.name = name; A.verified = true; A.pulled = false; A.retry = 0;
    const cached = read(cacheKey(name));
    A.cache = cached && cached.data && Number.isSafeInteger(cached.rev) ? cached : { name, rev: 0, dirty: false, data: null, fresh: true };
    A.status = 'pending';
    if (A.cache.data) Game.adopt(normalizeSave(A.cache.data), 'account');
    // the previous account's progress never becomes this one's: start from the guest save, as boot() does
    else if (switching) { const g = guest(); Game.adopt(g ? normalizeSave(g) : null, 'guest'); }
    sync().then(ok => Game.say(ok ? '登录成功，进度已同步' : status().text, ok ? PAL.green : PAL.amber));
  }
  if (C && !A.file) {
    C.onProfileChange(profile => {
      if (!profile && A.name) { A.name = null; A.cache = null; A.status = 'guest'; const g = guest(); Game.adopt(g ? normalizeSave(g) : null, 'guest'); }
      else if (profile && profile.name.toLowerCase() !== (A.name || '').toLowerCase()) activate(profile.name);
    });
    window.addEventListener('online', () => sync());
  }
  const flush = () => { if (A.name && A.cache && A.cache.dirty && Game.ready) { Game.persist(); sync(true); } };
  // hiding the tab sends the save once and stops the timer; showing it again resumes uploads
  document.addEventListener('visibilitychange', () => {
    if (hidden()) { flush(); clearTimeout(A.timer); A.timer = null; }
    else if (A.cache && A.cache.dirty) schedule();
  });
  window.addEventListener('pagehide', flush);
  return { boot, persist, sync, syncNow, status, logout, openLogin, get file() { return A.file; }, get name() { return A.name; }, readGuest: () => read(GUEST_KEY) || read(GUEST_KEY_V2) };
})();
