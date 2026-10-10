'use strict';
const Account = (() => {
  const cacheKey = name => GameAccount.cacheKey('entropy-blade', name);
  const resetKey = name => GameAccount.resetKey('entropy-blade', name);
  const read = key => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ } };
  const remove = key => { try { localStorage.removeItem(key); } catch { /* storage unavailable */ } };
  const validName = GameAccount.validName;
  const A = { name: null, cache: null, status: 'guest', lastSuccess: 0, busy: false, busyRow: null, tab: 0, row: 0, relogin: false, message: '', messageColor: '#ffd36a', file: GameAccount.file, verified: false, pulled: false, needsImport: false, importPending: false, version: 0, resetVersion: null, retry: 0, timer: null, job: null, blurred: false };
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
  A.selectRow = (row, silent = false) => {
    if (A.busy) return;
    if (A.row !== row && !silent) Sound.play('select');
    A.row = row;
    A.inputs.forEach(input => input.blur());
    if (A.formVisible() && row > 0 && row < A.rows() - 1 && !A.file) { A.layout(); A.inputs[row - 1].focus(); }
  };
  A.changeTab = tab => {
    if (A.busy) return;
    A.tab = tab; A.row = 0; A.inputs[1].value = ''; A.inputs[2].value = ''; A.message = ''; A.hideInputs(); Sound.play('select');
  };
  A.back = () => { A.hideInputs(); UI.screen = 'title'; UI.sel = 5; A.relogin = false; Sound.play('cancel'); };
  A.errorText = GameAccount.errorText;
  A.say = (text, color) => { A.message = text; A.messageColor = color; };
  A.request = GameAccount.request;
  A.persist = () => {
    if (A.cache) { A.cache.data = pickProgress(Save.data); write(cacheKey(A.name), A.cache); }
  };
  A.apply = data => {
    const settings = Save.data.settings;
    Save.data = Save.normalize(data || {}); Save.data.settings = settings;
    if (typeof UI !== 'undefined') UI.weaponSel = null;
  };
  A.activate = name => {
    clearTimeout(A.timer); A.job = null; A.cancelChoice();
    A.name = name;
    const cached = read(cacheKey(name));
    A.cache = cached && validName(cached.name) && cached.name.toLowerCase() === name.toLowerCase() && cached.data && Number.isSafeInteger(cached.rev) && cached.rev >= 0 ? cached : { name, data: pickProgress(Save.defaults()), base: null, rev: 0, dirty: false };
    A.cache.name = name;
    A.needsImport = !cached; A.importPending = false;
    A.version = 0; A.resetVersion = read(resetKey(name)) ? 0 : null;
    A.apply(A.cache.data);
    Save.backend = {
      write() { A.version++; A.cache.dirty = true; A.persist(); },
      reset() { A.resetVersion = A.version + 1; write(resetKey(A.name), true); },
    };
    GameAccount.setProfile(name);
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
    const finish = answer => { A.choice = null; resolve(answer); };
    const confirm = { text, labels, sel, yes: () => finish(true), no: () => finish(false), cancel: () => finish(false) };
    A.choice = { confirm, resolve: finish }; UI.confirm = confirm;
  });
  A.cancelChoice = () => {
    if (!A.choice) return;
    if (UI.confirm === A.choice.confirm) UI.confirm = null;
    A.choice.resolve(false);
  };
  A.pull = async () => {
    const cache = A.cache;
    const remote = await A.request('/api/save/entropy-blade');
    if (A.cache !== cache) return false;
    if (A.cache.dirty) {
      if (A.resetVersion === null) A.apply(mergeProgress(A.cache.base, Save.data, remote.data));
    } else if (A.needsImport && remote.data === null && remote.rev === 0 && hasProgress(A.guestProgress())) {
      if (G.state !== 'title' || UI.confirm) { A.importPending = true; return false; }
      const imported = await A.choose('把本机存档（熵晶、天赋、战绩）带入这个账号？', ['带入', '从零开始'], 0);
      if (A.cache !== cache) return false;
      if (A.cache.dirty) A.apply(mergeProgress(A.cache.base, Save.data, remote.data));
      else A.apply(imported ? A.guestProgress() : pickProgress(Save.defaults()));
      A.cache.dirty = true; A.version++;
    } else A.apply(remote.data);
    A.cache.base = pickProgress(remote.data || Save.defaults()); A.cache.rev = remote.rev;
    A.needsImport = false; A.importPending = false; A.pulled = true; A.persist();
    return true;
  };
  A.push = async keepalive => {
    const cache = A.cache;
    if (!A.cache.dirty) return true;
    for (let conflicts = 0; conflicts <= 3; conflicts++) {
      const snapshot = pickProgress(Save.data), version = A.version;
      try {
        const next = await A.request('/api/save/entropy-blade', 'PUT', { baseRev: A.cache.rev, data: snapshot }, keepalive);
        if (A.cache !== cache) return false;
        A.cache.base = snapshot; A.cache.rev = next.rev; A.cache.dirty = A.version !== version;
        if (A.resetVersion !== null && version >= A.resetVersion) { A.resetVersion = null; remove(resetKey(A.name)); }
        A.lastSuccess = Date.now(); A.retry = 0; A.persist();
        return true;
      } catch (e) {
        if (A.cache !== cache) return false;
        if (e.status !== 409) throw e;
        const flushed = A.flushJob;
        const result = flushed ? await flushed.promise : null;
        if (A.cache !== cache) return false;
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
    const cache = A.cache;
    clearTimeout(A.timer); A.timer = null; A.status = 'syncing';
    A.job = (async () => {
      try {
        if (!A.verified) { await GameAccount.me(); if (A.cache !== cache) return false; A.verified = true; }
        if (!A.pulled && !await A.pull()) { if (A.cache === cache) A.status = 'pending'; return false; }
        await A.push(keepalive);
        if (A.cache !== cache) return false;
        A.lastSuccess = Date.now(); A.retry = 0; A.status = A.cache.dirty ? 'pending' : 'synced';
        if (A.cache.dirty) A.schedule();
        return !A.cache.dirty;
      } catch (e) { if (A.cache === cache) A.failed(e); return false; }
      finally { if (A.cache === cache) A.job = null; }
    })();
    return A.job;
  };
  A.guestProgress = () => pickProgress(Save.normalize(read(Save.key) || {}));
  A.submit = async () => {
    if (A.busy || A.file) return;
    const username = A.inputs[0].value.trim(), password = A.inputs[1].value, register = A.tab === 1;
    let error = '';
    if (!validName(username)) error = '用户名需为 3–16 位字母、数字或下划线';
    else if (!GameAccount.validPassword(password)) error = '密码需为 8–64 位';
    else if (register && password !== A.inputs[2].value) error = '两次输入的密码不一致';
    if (error) { A.say(error, '#ff5a5a'); Sound.play('error'); return; }
    A.busy = true; A.busyRow = A.rows() - 1; A.say('', '#ffd36a'); A.inputs[1].value = ''; A.inputs[2].value = '';
    try {
      if (A.job) await A.job;
      const result = await (register ? GameAccount.register(username, password) : GameAccount.login(username, password));
      clearTimeout(A.timer); A.activate(result.name); A.verified = true; A.relogin = false; A.row = 0;
      const synced = await A.sync();
      if (!synced) A.say(A.status === 'expired' ? '登录已过期，请重新登录' : '无法连接服务器，请稍后再试', '#ff5a5a');
      else { A.say(register ? '注册成功，已登录' : '登录成功，已载入云端存档', '#6aff8a'); Sound.play('confirm'); }
    } catch (e) { A.say(A.errorText(e), '#ff5a5a'); Sound.play('error'); }
    finally { A.busy = false; A.busyRow = null; }
  };
  A.logout = async () => {
    if (A.busy || !A.name) return;
    A.busy = true; A.busyRow = 1;
    try {
      const result = await GameAccount.logout({ flush: async () => {
        if (A.job) await A.job;
        if (A.cache?.dirty) await A.sync();
      } });
      const name = A.name;
      // Cache persistence can fail while the in-memory sync still succeeds.
      if (!result.kept.includes('entropy-blade') && name) remove(resetKey(name));
      A.deactivate();
      A.say(result.kept.length ? '已退出。未同步的进度保留在这台设备上，下次登录时自动同步。' : '已退出，当前使用本机存档', result.kept.length ? '#ffd36a' : '#6aff8a'); Sound.play('confirm');
    } catch (e) { A.say(A.errorText(e), '#ff5a5a'); Sound.play('error'); }
    finally { A.busy = false; A.busyRow = null; }
  };
  A.syncNow = async () => {
    if (A.busy || !A.name) return;
    A.busy = true; A.busyRow = 0; Sound.play('confirm');
    try { await A.sync(); }
    finally { A.busy = false; A.busyRow = null; }
  };
  A.action = () => {
    if (A.busy) return;
    if (A.formVisible()) { if (A.row === A.rows() - 1) A.submit(); else if (A.row > 0) A.selectRow(A.row); }
    else if (A.row === 1) A.logout();
    else if (A.status === 'expired') { A.relogin = true; A.tab = 0; A.inputs[0].value = A.name; A.selectRow(2); }
    else A.syncNow();
  };
  Save.onWrite = () => {
    if (!A.name) return;
    if (A.status !== 'expired' && A.status !== 'error') { A.status = 'pending'; A.schedule(); }
  };
  A.deactivate = () => {
    clearTimeout(A.timer); A.cancelChoice(); A.hideInputs();
    Save.backend = null; Save.load(); A.name = null; A.cache = null; A.status = 'guest'; A.relogin = false; A.row = 0;
    A.job = null; A.needsImport = false; A.importPending = false; UI.weaponSel = null;
  };
  A.checkImport = () => {
    if (A.importPending && A.status === 'pending' && G.state === 'title' && !UI.confirm && !A.job) A.sync();
  };
  GameAccount.onProfileChange(profile => {
    if (A.file) return;
    if (!profile) {
      A.deactivate();
      if (UI.screen === 'account') A.say('已在其它页面退出登录', '#ffd36a');
    } else if (A.name?.toLowerCase() !== profile.name.toLowerCase()) {
      A.activate(profile.name); A.sync();
    } else if (A.status === 'expired') { A.verified = false; A.pulled = false; A.status = 'pending'; A.sync(); }
  });
  const profile = GameAccount.profile();
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
        if (A.resetVersion !== null && version >= A.resetVersion) { A.resetVersion = null; remove(resetKey(name)); }
        A.lastSuccess = Date.now(); A.persist();
      }
      return next;
    }).catch(() => null).finally(() => { if (A.flushJob === flushed) A.flushJob = null; });
  };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);
  return A;
})();
