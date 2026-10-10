'use strict';
const Account = (() => {
  const PROFILE = 'entropy_blade_profile_v1';
  const cacheKey = name => 'entropy_blade_acct_' + name.toLowerCase() + '_v1';
  const resetKey = name => 'entropy_blade_acct_' + name.toLowerCase() + '_reset_v1';
  const read = key => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
  const validName = name => typeof name === 'string' && /^[A-Za-z0-9_]{3,16}$/.test(name);
  const A = { name: null, cache: null, status: 'guest', lastSuccess: 0, busy: false, tab: 0, row: 0, relogin: false, message: '', messageColor: '#ffd36a', file: location.protocol === 'file:', verified: false, pulled: false, needsImport: false, version: 0, resetVersion: null, retry: 0, timer: null, job: null, blurred: false };
  const form = document.createElement('form');
  form.style.cssText = 'position:fixed;opacity:0;z-index:2;border:0;padding:0;margin:0;background:transparent;color:transparent;caret-color:transparent;font-size:16px';
  form.onsubmit = e => { e.preventDefault(); A.submit(); };
  A.inputs = ['username', 'password', 'confirmPassword'].map((name, i) => {
    const input = document.createElement('input');
    input.style.cssText = 'position:fixed;opacity:0;z-index:2;border:0;padding:0;margin:0;background:transparent;color:transparent;caret-color:transparent;font-size:16px;display:none;touch-action:auto';
    input.type = i ? 'password' : 'text'; input.name = name;
    input.maxLength = i ? 64 : 16;
    input.autocomplete = i === 0 ? 'username' : i === 1 ? 'current-password' : 'new-password';
    if (!i) { input.setAttribute('autocapitalize', 'off'); input.setAttribute('autocorrect', 'off'); input.spellcheck = false; }
    input.addEventListener('focus', () => { A.row = i + 1; Input.clear(); });
    input.addEventListener('keydown', e => {
      if (e.isComposing) return;
      if (!['Enter', 'Tab', 'ArrowUp', 'ArrowDown', 'Escape'].includes(e.key)) return;
      e.preventDefault();
      if (A.busy) return;
      if (e.key === 'Escape') { A.hideInputs(); A.back(); }
      else if (e.key === 'Enter') { if (A.row === (A.tab ? 3 : 2)) A.submit(); else A.selectRow(A.row + 1); }
      else A.selectRow((A.row + ((e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) ? -1 : 1) + A.rows()) % A.rows());
    });
    form.appendChild(input);
    return input;
  });
  document.body.appendChild(form);
  A.formVisible = () => !A.name || A.relogin;
  A.rows = () => A.formVisible() ? (A.tab ? 5 : 4) : 2;
  A.hideInputs = () => { for (const input of A.inputs) { input.blur(); input.style.display = 'none'; } form.style.display = 'none'; };
  A.layout = () => {
    const visible = !A.blurred && G.state === 'title' && UI.screen === 'account' && A.formVisible() && !UI.confirm;
    if (!visible) { A.hideInputs(); return; }
    form.style.display = 'block';
    A.inputs[1].autocomplete = A.tab ? 'new-password' : 'current-password';
    const v = Gfx.view;
    A.inputs.forEach((input, i) => {
      input.style.display = i === 2 && !A.tab ? 'none' : 'block'; input.readOnly = A.busy || A.file;
      input.style.left = (v.x + 80 / UW * v.w) / v.dpr + 'px';
      input.style.top = (v.y + (178 + i * 62) / UH * v.h) / v.dpr + 'px';
      input.style.width = 360 / UW * v.w / v.dpr + 'px'; input.style.height = 32 / UH * v.h / v.dpr + 'px';
    });
  };
  A.selectRow = row => {
    if (A.busy) return;
    A.row = row; Sound.play('select');
    A.inputs.forEach(input => input.blur());
    if (A.formVisible() && row > 0 && row < A.rows() - 1 && !A.file) { A.layout(); A.inputs[row - 1].focus(); }
  };
  A.changeTab = tab => {
    if (A.busy) return;
    A.tab = tab; A.row = 0; A.inputs[1].value = ''; A.inputs[2].value = ''; A.message = ''; A.hideInputs(); Sound.play('select');
  };
  A.back = () => { A.hideInputs(); UI.screen = 'title'; UI.sel = 5; A.relogin = false; Sound.play('cancel'); };
  A.errorText = e => {
    const code = e.data?.error;
    if (code === 'bad_username') return '用户名需为 3–16 位字母、数字或下划线';
    if (code === 'bad_password') return '密码需为 8–64 位';
    if (code === 'name_taken') return '这个用户名已被注册';
    if (code === 'bad_credentials') return '用户名或密码错误';
    if (code === 'rate_limited') return `尝试次数过多，请 ${Math.ceil((e.data.retryAfter || 60) / 60)} 分钟后再试`;
    if (code === 'unauthorized') return '登录已过期，请重新登录';
    return e.status ? '服务器出了点问题，请稍后再试' : '无法连接服务器，请稍后再试';
  };
  A.say = (text, color) => { A.message = text; A.messageColor = color; };
  A.request = async (path, method = 'GET', data, keepalive = false) => {
    if (A.file) throw new Error('file');
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(path, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data), signal: controller.signal, keepalive });
      const value = await response.json();
      if (!response.ok) throw { status: response.status, data: value };
      return value;
    } finally { clearTimeout(timer); }
  };
  A.persist = () => {
    if (A.cache) { A.cache.data = pickProgress(Save.data); localStorage.setItem(cacheKey(A.name), JSON.stringify(A.cache)); }
  };
  A.apply = data => {
    const settings = Save.data.settings;
    Save.data = Save.normalize(data || {}); Save.data.settings = settings;
    if (typeof UI !== 'undefined') UI.weaponSel = null;
  };
  A.activate = name => {
    A.name = name;
    const cached = read(cacheKey(name));
    A.cache = cached && validName(cached.name) && cached.name.toLowerCase() === name.toLowerCase() && cached.data && Number.isSafeInteger(cached.rev) && cached.rev >= 0 ? cached : { name, data: pickProgress(Save.defaults()), base: null, rev: 0, dirty: false };
    A.cache.name = name;
    A.version = 0; A.resetVersion = read(resetKey(name)) ? 0 : null;
    A.apply(A.cache.data);
    Save.backend = {
      write() { A.version++; A.cache.dirty = true; A.persist(); },
      reset() { A.resetVersion = A.version + 1; localStorage.setItem(resetKey(A.name), 'true'); },
    };
    localStorage.setItem(PROFILE, JSON.stringify({ name }));
    A.status = 'pending'; A.verified = false; A.pulled = false; A.retry = 0;
  };
  A.schedule = (delay = 4000) => {
    clearTimeout(A.timer);
    if (A.name && A.status !== 'expired' && !A.file) A.timer = setTimeout(() => { A.timer = null; A.sync(); }, delay);
  };
  A.failed = e => {
    if (e.status === 401) { A.status = 'expired'; A.verified = false; clearTimeout(A.timer); }
    else { A.status = 'error'; A.schedule([15000, 30000, 60000, 120000, 300000][Math.min(A.retry++, 4)]); }
  };
  A.choose = (text, labels, sel) => new Promise(resolve => {
    A.hideInputs();
    UI.confirm = { text, labels, sel, yes: () => resolve(true), no: () => resolve(false), cancel: () => resolve(false) };
  });
  A.pull = async () => {
    const remote = await A.request('/api/save/entropy-blade');
    if (A.cache.dirty) {
      if (A.resetVersion === null) A.apply(mergeProgress(A.cache.base, Save.data, remote.data));
    } else if (A.needsImport && remote.data === null && remote.rev === 0 && hasProgress(A.guestProgress())) {
      const imported = await A.choose('把本机存档（熵晶、天赋、战绩）带入这个账号？', ['带入', '从零开始'], 0);
      A.apply(imported ? A.guestProgress() : pickProgress(Save.defaults()));
      A.cache.dirty = true; A.version++;
    } else A.apply(remote.data);
    A.cache.base = pickProgress(remote.data || Save.defaults()); A.cache.rev = remote.rev;
    A.needsImport = false; A.pulled = true; A.persist();
  };
  A.push = async keepalive => {
    if (!A.cache.dirty) return true;
    for (let conflicts = 0; conflicts <= 3; conflicts++) {
      const snapshot = pickProgress(Save.data), version = A.version;
      try {
        const next = await A.request('/api/save/entropy-blade', 'PUT', { baseRev: A.cache.rev, data: snapshot }, keepalive);
        A.cache.base = snapshot; A.cache.rev = next.rev; A.cache.dirty = A.version !== version;
        if (A.resetVersion !== null && version >= A.resetVersion) { A.resetVersion = null; localStorage.removeItem(resetKey(A.name)); }
        A.lastSuccess = Date.now(); A.retry = 0; A.persist();
        return true;
      } catch (e) {
        if (e.status !== 409) throw e;
        const flushed = A.flushJob;
        const result = flushed ? await flushed.promise : null;
        const base = result && flushed.cache === A.cache && result.rev <= e.data.rev ? flushed.snapshot : A.cache.base;
        if (A.resetVersion === null) A.apply(mergeProgress(base, Save.data, e.data.data));
        A.cache.base = pickProgress(e.data.data || Save.defaults()); A.cache.rev = e.data.rev; A.persist();
        if (conflicts === 3) throw e;
      }
    }
    return false;
  };
  A.sync = (keepalive = false) => {
    if (!A.name || A.file || A.status === 'expired') return Promise.resolve(false);
    if (A.job) return A.job;
    clearTimeout(A.timer); A.timer = null; A.status = 'syncing';
    A.job = (async () => {
      try {
        if (!A.verified) { await A.request('/api/me'); A.verified = true; }
        if (!A.pulled) await A.pull();
        await A.push(keepalive);
        A.lastSuccess = Date.now(); A.retry = 0; A.status = A.cache.dirty ? 'pending' : 'synced';
        if (A.cache.dirty) A.schedule();
        return !A.cache.dirty;
      } catch (e) { A.failed(e); return false; }
      finally { A.job = null; }
    })();
    return A.job;
  };
  A.guestProgress = () => pickProgress(Save.normalize(read(Save.key) || {}));
  A.submit = async () => {
    if (A.busy || A.file) return;
    const username = A.inputs[0].value.trim(), password = A.inputs[1].value, register = A.tab === 1;
    let error = '';
    if (!validName(username)) error = '用户名需为 3–16 位字母、数字或下划线';
    else if ([...password].length < 8 || [...password].length > 64) error = '密码需为 8–64 位';
    else if (register && password !== A.inputs[2].value) error = '两次输入的密码不一致';
    if (error) { A.say(error, '#ff5a5a'); Sound.play('error'); return; }
    A.busy = true; A.say('', '#ffd36a'); A.inputs[1].value = ''; A.inputs[2].value = '';
    try {
      if (A.job) await A.job;
      const result = await A.request(register ? '/api/register' : '/api/login', 'POST', { username, password });
      clearTimeout(A.timer); A.activate(result.user.name); A.verified = true; A.needsImport = true; A.relogin = false; A.row = 0;
      const synced = await A.sync();
      if (!synced) A.say(A.status === 'expired' ? '登录已过期，请重新登录' : '无法连接服务器，请稍后再试', '#ff5a5a');
      else { A.say(register ? '注册成功，已登录' : '登录成功，已载入云端存档', '#6aff8a'); Sound.play('confirm'); }
    } catch (e) { A.say(A.errorText(e), '#ff5a5a'); Sound.play('error'); }
    finally { A.busy = false; }
  };
  A.logout = async () => {
    if (A.busy || !A.name) return;
    A.busy = true;
    try {
      if (A.job) await A.job;
      if (A.cache.dirty && !await A.sync()) {
        const exit = await A.choose('还有进度没同步到云端，现在退出会丢失这部分进度。仍要退出？', ['退出', '取消'], 1);
        if (!exit) return;
      }
      await A.request('/api/logout', 'POST', {});
      clearTimeout(A.timer); localStorage.removeItem(PROFILE); localStorage.removeItem(cacheKey(A.name)); localStorage.removeItem(resetKey(A.name));
      Save.backend = null; Save.load(); A.name = null; A.cache = null; A.status = 'guest'; A.relogin = false; A.row = 0;
      UI.weaponSel = null; A.say('已退出，当前使用本机存档', '#6aff8a'); Sound.play('confirm');
    } catch (e) { A.say(A.errorText(e), '#ff5a5a'); Sound.play('error'); }
    finally { A.busy = false; }
  };
  A.action = () => {
    if (A.busy) return;
    if (A.formVisible()) { if (A.row === A.rows() - 1) A.submit(); else if (A.row > 0) A.selectRow(A.row); }
    else if (A.row === 1) A.logout();
    else if (A.status === 'expired') { A.relogin = true; A.tab = 0; A.inputs[0].value = A.name; A.selectRow(2); }
    else { Sound.play('confirm'); A.sync(); }
  };
  Save.onWrite = () => {
    if (!A.name) return;
    if (A.status !== 'expired' && A.status !== 'error') { A.status = 'pending'; A.schedule(); }
  };
  const profile = read(PROFILE);
  if (!A.file && validName(profile?.name)) {
    try { A.activate(profile.name); } catch { /* keep the loaded local progress */ }
    Promise.resolve().then(() => A.sync());
  }
  window.addEventListener('online', () => { if (A.name) A.sync(); });
  window.addEventListener('blur', () => { A.blurred = true; A.hideInputs(); });
  window.addEventListener('focus', () => { A.blurred = false; });
  const flush = () => {
    if (!A.cache?.dirty || A.status === 'expired' || A.file) return;
    if (!A.job || !A.verified || !A.pulled) { A.sync(true); return; }
    if (A.flushJob) return;
    // A pending normal request may be cancelled during navigation; send its
    // current revision again with keepalive and let R2 serialize the writes.
    const cache = A.cache, name = A.name, version = A.version, rev = cache.rev, snapshot = pickProgress(Save.data);
    const flushed = { cache, snapshot, promise: null };
    A.flushJob = flushed;
    flushed.promise = A.request('/api/save/entropy-blade', 'PUT', { baseRev: rev, data: snapshot }, true).then(next => {
      if (A.cache === cache && cache.rev === rev) {
        cache.base = snapshot; cache.rev = next.rev; cache.dirty = A.version !== version;
        if (A.resetVersion !== null && version >= A.resetVersion) { A.resetVersion = null; localStorage.removeItem(resetKey(name)); }
        A.lastSuccess = Date.now(); A.persist();
      }
      return next;
    }).catch(() => null).finally(() => { if (A.flushJob === flushed) A.flushJob = null; });
  };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);
  return A;
})();
