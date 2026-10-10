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
  const listeners = new Set();
  const C = {
    file: location.protocol === 'file:', validName,
    validPassword: password => typeof password === 'string' && [...password].length >= 8 && [...password].length <= 64,
    cacheKey, resetKey,
    profile: () => current && { ...current },
    setProfile(name) { current = profileValue({ name }); if (current) write(PROFILE, current); },
    clearProfile() { current = null; remove(PROFILE); },
    onProfileChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    errorText(e) {
      const code = e.data?.error;
      if (code === 'bad_username') return '用户名需为 3–16 位字母、数字或下划线';
      if (code === 'bad_password') return '密码需为 8–64 位';
      if (code === 'name_taken') return '这个用户名已被注册';
      if (code === 'bad_credentials') return '用户名或密码错误';
      if (code === 'rate_limited') return `尝试次数过多，请 ${Math.ceil((e.data.retryAfter || 60) / 60)} 分钟后再试`;
      if (code === 'unauthorized') return '登录已过期，请重新登录';
      return e.status ? '服务器出了点问题，请稍后再试' : '无法连接服务器，请稍后再试';
    },
    async request(path, method = 'GET', data, keepalive = false) {
      if (C.file) throw new Error('file');
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch(path, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data), signal: controller.signal, keepalive });
        const value = await response.json();
        if (!response.ok) throw { status: response.status, data: value };
        return value;
      } finally { clearTimeout(timer); }
    },
    async login(username, password) {
      const result = await C.request('/api/login', 'POST', { username, password });
      C.setProfile(result.user.name); return { name: result.user.name };
    },
    async register(username, password) {
      const result = await C.request('/api/register', 'POST', { username, password });
      C.setProfile(result.user.name); return { name: result.user.name };
    },
    me: () => C.request('/api/me'),
    async logout({ flush } = {}) {
      const name = current?.name;
      if (flush) { try { await flush(); } catch { /* remaining dirty caches are retried below */ } }
      const accountCaches = () => name ? keys().flatMap(key => {
        const match = /^gameinc_save_([a-z0-9-]{1,32})_([a-z0-9_]{3,16})_v1$/.exec(key);
        return match && match[2] === name.toLowerCase() ? [{ key, game: match[1] }] : [];
      }) : [];
      for (const { key, game } of accountCaches()) {
        const cache = read(key);
        if (!cache?.dirty) continue;
        try {
          const next = await C.request('/api/save/' + game, 'PUT', { baseRev: cache.rev, data: cache.data });
          const latest = read(key);
          // A game in another tab may write while this request is in flight.
          if (latest && latest.rev === cache.rev) {
            latest.dirty = JSON.stringify(latest.data) !== JSON.stringify(cache.data);
            latest.base = cache.data; latest.rev = next.rev; write(key, latest);
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
    for (const fn of listeners) { try { fn(C.profile()); } catch { /* independent listeners */ } }
  });
  return C;
})();
