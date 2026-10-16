'use strict';
const GameAccount = (() => {
  const PROFILE = 'gameinc_profile_v1';
  const validName = name => typeof name === 'string' && /^[A-Za-z0-9_]{3,16}$/.test(name);
  const read = key => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
  const remove = key => { try { localStorage.removeItem(key); } catch { /* storage unavailable */ } };
  const keys = () => {
    try { return Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).filter(Boolean); }
    catch { return []; }
  };
  const cacheKey = (game, name) => 'gameinc_save_' + game + '_' + name.toLowerCase() + '_v1';
  const resetKey = (game, name) => 'gameinc_save_' + game + '_' + name.toLowerCase() + '_reset_v1';
  // Keep old data if storage cannot accept its replacement.
  try {
    const old = localStorage.getItem('entropy_blade_profile_v1');
    if (old !== null) {
      if (localStorage.getItem(PROFILE) === null) localStorage.setItem(PROFILE, old);
      localStorage.removeItem('entropy_blade_profile_v1');
    }
    for (const key of keys()) {
      const match = /^entropy_blade_acct_([A-Za-z0-9_]{3,16})(_reset)?_v1$/.exec(key);
      if (!match) continue;
      const next = (match[2] ? resetKey : cacheKey)('entropy-blade', match[1]);
      if (localStorage.getItem(next) === null) localStorage.setItem(next, localStorage.getItem(key));
      localStorage.removeItem(key);
    }
  } catch { /* migration is best effort */ }
  const profileValue = value => validName(value?.name) ? { name: value.name } : null;
  let current = profileValue(read(PROFILE));
  let regionPending;
  // this tab's last confirmed session (see me()); cleared on sign-out
  const ME_KEY = 'gameinc_me_v1';
  const confirmed = name => { try { sessionStorage.setItem(ME_KEY, JSON.stringify({ name: name.toLowerCase(), display: name, at: Date.now() })); } catch { /* not cached */ } };
  const listeners = new Set();
  const changed = () => { for (const fn of listeners) { try { fn(C.profile()); } catch { /* independent listeners */ } } };
  // canonical JSON (sorted keys) signature, the same one game-cloud.js keeps in cache.sent: an upload whose reply
  // was lost is recognised on the next sync instead of being merged twice
  const canon = v => JSON.stringify(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(n => [n, x[n]])) : x);
  const sig = v => { const s = canon(v); let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36) + '.' + s.length; };
  const C = {
    file: location.protocol === 'file:', validName,
    validPassword: password => typeof password === 'string' && [...password].length >= 8 && [...password].length <= 64,
    cacheKey, resetKey,
    profile: () => current && { ...current },
    setProfile(name) { current = profileValue({ name }); if (current) write(PROFILE, current); },
    clearProfile() { current = null; remove(PROFILE); try { sessionStorage.removeItem(ME_KEY); } catch { /* unavailable */ } },
    onProfileChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    errorText(e) {
      const code = e.data?.error;
      if (code === 'bad_username') return '用户名需为 3–16 位字母、数字或下划线';
      if (code === 'bad_password') return '密码需为 8–64 位';
      if (code === 'name_taken') return '这个用户名已被注册';
      if (code === 'bad_credentials') return '用户名或密码错误';
      if (code === 'login_limited') return '登录失败次数过多，请稍后再试。';
      if (code === 'register_limited') return '注册次数过多，请稍后再试。';
      if (code === 'rate_limited') return `尝试次数过多，请 ${Math.ceil((e.data.retryAfter || 60) / 60)} 分钟后再试`;
      if (code === 'unauthorized') return '登录已过期，请重新登录';
      return e.status ? '服务器出了点问题，请稍后再试' : '无法连接服务器，请稍后再试';
    },
    region() {
      if (regionPending) return regionPending;
      try {
        const saved = sessionStorage.getItem('gameinc_region_v1');
        if (saved) return Promise.resolve(JSON.parse(saved));
      } catch { /* unavailable */ }
      regionPending = C.request('/api/region').catch(() => ({ region: 'intl', currency: 'USD' })).then(value => {
        try { sessionStorage.setItem('gameinc_region_v1', JSON.stringify(value)); } catch { /* unavailable */ }
        return value;
      });
      return regionPending;
    },
    async request(path, method = 'GET', data, keepalive = false, onResponse) {
      if (C.file) throw new Error('file');
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch(path, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data), signal: controller.signal, keepalive });
        const text = await response.text();
        let value;
        try { value = JSON.parse(text); }
        catch {
          const quota = /\b1027\b/.test(text);
          throw { status: quota ? 1027 : response.status, data: quota ? { error: '1027' } : {} };
        }
        if (!response.ok) throw { status: response.status, data: value };
        onResponse?.(response);
        return value;
      } finally { clearTimeout(timer); }
    },
    async login(username, password) {
      const result = await C.request('/api/login', 'POST', { username, password });
      C.setProfile(result.user.name); confirmed(result.user.name); return { name: result.user.name };
    },
    async register(username, password) {
      const result = await C.request('/api/register', 'POST', { username, password });
      C.setProfile(result.user.name); confirmed(result.user.name); return { name: result.user.name };
    },
    // The session cookie decides whose account this browser is signed in to. When it is not the stored profile
    // (another account signed in meanwhile and its profile write failed), the profile follows the session and every
    // listener re-activates with that account's own cache; the caller's sync for the old account then stops.
    // Each /api/me is a billed Worker request: a tab that confirmed this account in the last 10 minutes reuses the answer
    // (an expired session still shows up as 401 on the next save). fresh: true always asks the server.
    async me({ fresh = false } = {}) {
      const asked = current?.name;
      if (!fresh && asked) {
        try {
          const seen = JSON.parse(sessionStorage.getItem(ME_KEY));
          if (seen && seen.name === asked.toLowerCase() && Date.now() - seen.at < 600000) return { user: { name: seen.display } };
        } catch { /* storage unavailable: ask the server */ }
      }
      const result = await C.request('/api/me'), name = result?.user?.name;
      // a profile changed while the request was in flight makes this answer stale
      if (asked && current?.name === asked && validName(name) && name.toLowerCase() !== asked.toLowerCase()) { C.setProfile(name); changed(); }
      if (validName(name)) confirmed(name);
      return result;
    },
    async logout({ flush } = {}) {
      const name = current?.name;
      if (flush) { try { await flush(); } catch { /* remaining dirty caches are retried below */ } }
      const accountCaches = () => name ? keys().flatMap(key => {
        const match = /^gameinc_save_([a-z0-9-]{1,32})_([a-z0-9_]{3,16})_v1$/.exec(key);
        return match && match[2] === name.toLowerCase() ? [{ key, game: match[1] }] : [];
      }) : [];
      const dirty = accountCaches().filter(({ key }) => read(key)?.dirty);
      // these caches belong to `name`: they only go up while the session is that account (otherwise they stay on the device)
      let owner = null;
      if (dirty.length) { try { owner = (await C.request('/api/me'))?.user?.name; } catch { /* offline: kept below */ } }
      for (const { key, game } of owner && owner.toLowerCase() === name.toLowerCase() ? dirty : []) {
        const cache = read(key);
        if (!cache?.dirty) continue;
        // a save that carries upload ids (entropy-blade) gets a fresh one for this PUT as well, remembered with what was sent
        let data = cache.data, id = null;
        if (Array.isArray(data?.ups)) {
          const bytes = typeof crypto !== 'undefined' && crypto.getRandomValues ? crypto.getRandomValues(new Uint8Array(16)) : Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
          id = Array.from(bytes, b => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[b % 62]).join('');
          data = { ...data, ups: [...data.ups.filter(x => typeof x === 'string' && /^[A-Za-z0-9]{8,24}$/.test(x)), id].slice(-16) };
        }
        const mark = id ? { base: cache.rev, id, sig: sig(data), data } : { base: cache.rev, sig: sig(data) };
        cache.sent = [...(Array.isArray(cache.sent) ? cache.sent : []).filter(s => s.base === mark.base && s.sig !== mark.sig).slice(-2), mark];
        write(key, cache);
        try {
          const next = await C.request('/api/save/' + game, 'PUT', { baseRev: cache.rev, data });
          const latest = read(key);
          // A game in another tab may write while this request is in flight.
          if (latest && latest.rev === cache.rev) {
            latest.dirty = JSON.stringify(latest.data) !== JSON.stringify(cache.data);
            latest.base = data; latest.rev = next.rev; delete latest.sent; write(key, latest);
          }
        } catch { /* conflicts and offline progress stay dirty */ }
      }
      await C.request('/api/logout', 'POST', {});
      C.clearProfile();
      const kept = [];
      for (const { key, game } of accountCaches()) {
        const cache = read(key);
        if (cache?.dirty) kept.push(game);
        else { remove(key); remove(resetKey(game, name)); }
      }
      return { kept };
    },
  };
  window.addEventListener('storage', event => {
    if (event.key !== PROFILE && event.key !== null) return;
    let value = null;
    try { value = event.key === null ? read(PROFILE) : JSON.parse(event.newValue); } catch { /* invalid profile */ }
    current = profileValue(value);
    changed();
  });
  return C;
})();
