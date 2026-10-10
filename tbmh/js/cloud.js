'use strict';
// =====================================================================
//  CLOUD — GAME.INC.RE account sync for TBMH. Guests keep tbmh_save_v2;
//  a signed-in hunter keeps an account cache { name, rev, dirty, data }
//  that the hub can see and flush. Conflicts keep the deeper progress.
// =====================================================================
const GUEST_KEY = 'tbmh_save_v2', GUEST_KEY_V1 = 'tbmh_save_v1';
const Cloud = (() => {
  // GameAccount is a top-level const in hub/account-core.js, not a window property
  const C = typeof GameAccount !== 'undefined' ? GameAccount : null;
  const read = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
  const A = { name: null, cache: null, status: 'guest', last: 0, job: null, timer: null, verified: false, pulled: false, file: !C || C.file };
  // deeper progress wins a conflict: stages cleared across difficulties, then hunter level, then play time
  const score = d => {
    if (!d) return -1;
    if (d.v !== SAVE_VERSION) return (d.stats?.play || 0) / 3600 / 1e6;
    const best = Array.isArray(d.prog?.best) ? d.prog.best.reduce((a, x) => a + (+x || 0), 0) : 0;
    return best * 1e6 + (d.hero?.lv || 0) * 1e3 + (d.stats?.play || 0) / 3600;
  };
  const cacheKey = name => C.cacheKey('tbmh', name);

  // the save to start with: account cache when signed in, else the guest slot
  // a first-edition guest save becomes the starting point of the new world once
  const guest = () => read(GUEST_KEY) || read(GUEST_KEY_V1);
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
  function persist(s) {
    if (A.name && A.cache) { A.cache.data = s; A.cache.dirty = true; A.cache.name = A.name; write(cacheKey(A.name), A.cache); schedule(); }
    else write(GUEST_KEY, s);
  }
  function schedule(delay = 45000) {
    if (!A.name || A.file || A.status === 'expired' || A.timer) return;
    A.timer = setTimeout(() => { A.timer = null; sync(); }, delay);
  }
  async function sync(keepalive = false) {
    if (!A.name || A.file || A.status === 'expired') return false;
    if (A.job) return A.job;
    A.status = 'syncing';
    const cache = A.cache;
    A.job = (async () => {
      try {
        if (!A.verified) { await C.me(); A.verified = true; }
        for (let tries = 0; tries < 3; tries++) {
          const remote = await C.request('/api/save/tbmh');
          if (A.cache !== cache) return false;
          const local = Game.ready ? Game.save() : cache.data;
          const takeRemote = () => { cache.rev = remote.rev; Game.adopt(normalizeSave(remote.data), 'cloud'); cache.dirty = false; persistCache(); A.last = Date.now(); A.status = 'synced'; return true; };
          if (!A.pulled) {
            A.pulled = true;
            if (cache.fresh) {
              // first time this account plays on this device
              delete cache.fresh;
              if (remote.data) return takeRemote();
              await Game.firstAccountSave();
            } else if (remote.data && score(remote.data) > score(local)) return takeRemote();
          }
          const data = Game.ready ? Game.save() : cache.data;
          if (!data) return false;
          try {
            const next = await C.request('/api/save/tbmh', 'PUT', { baseRev: remote.rev, data }, keepalive);
            cache.rev = next.rev; cache.dirty = false; persistCache();
            A.last = Date.now(); A.status = 'synced';
            return true;
          } catch (e) { if (e.status !== 409) throw e; }
        }
        A.status = 'error';
        return false;
      } catch (e) {
        A.status = e && e.status === 401 ? 'expired' : 'error';
        if (A.status === 'error') schedule(60000);
        return false;
      } finally { A.job = null; }
    })();
    return A.job;
  }
  function persistCache() { if (A.name && A.cache) { A.cache.name = A.name; write(cacheKey(A.name), A.cache); } }
  function status() {
    if (A.file) return { logged: false, text: '本地文件模式：进度保存在这台设备上', color: PAL.steel };
    if (!A.name) return { logged: false, text: '未登录：进度保存在这台设备上。登录后在所有设备同步', color: PAL.steel };
    const when = A.last ? new Date(A.last).toTimeString().slice(0, 5) : '';
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
    A.name = name; A.verified = true; A.pulled = false;
    const cached = read(cacheKey(name));
    A.cache = cached && cached.data && Number.isSafeInteger(cached.rev) ? cached : { name, rev: 0, dirty: false, data: null, fresh: true };
    A.status = 'pending';
    if (A.cache.data) Game.adopt(normalizeSave(A.cache.data), 'account');
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
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);
  return { boot, persist, sync, syncNow, status, logout, openLogin, get file() { return A.file; }, get name() { return A.name; }, readGuest: () => read(GUEST_KEY) };
})();
