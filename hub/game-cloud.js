'use strict';
// =====================================================================
//  GameCloud — 站内游戏共用的账号存档助手（在 hub/account-core.js 之后加载）
//  · 未登录：游戏照常只用自己的本地存档。
//  · 登录后：游戏每次存档都交给 GameCloud，它把存档写进该账号的缓存
//    （gameinc_save_<game>_<name>_v1，主页账号面板读同一份），稍后上传到 /api/save/<game>，
//    用 baseRev 防止覆盖别的设备的进度。
//  · 两台设备都改过：弹窗列出“云端存档 / 本机存档”的摘要与时间，由玩家决定保留哪一份。
//  · 自带可换肤的登录 / 注册对话框和状态文字；没有账号模块（本地文件打开）时什么都不做。
// =====================================================================
const GameCloud = (() => {
  const C = typeof GameAccount !== 'undefined' ? GameAccount : null;
  const available = !!C && !C.file;
  const read = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const stamp = t => { if (!t) return '时间未知'; const d = new Date(t), p = n => String(n).padStart(2, '0'); return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };

  // ---------- 对话框（一次注入样式，按游戏传入的主题换色换字体） ----------
  let styled = false;
  function injectStyle() {
    if (styled) return; styled = true;
    const s = document.createElement('style');
    s.textContent = `
.gc-back{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(6,6,12,.62)}
.gc-box{width:min(100%,380px);max-height:calc(100dvh - 32px);overflow:auto;background:var(--gc-bg,#1d1b26);color:var(--gc-fg,#efe9dc);
  font:var(--gc-size,15px)/1.55 var(--gc-font,system-ui,sans-serif);border:2px solid var(--gc-line,#4a4560);box-shadow:0 8px 0 rgba(0,0,0,.35);padding:16px 18px}
.gc-box h2{margin:0 0 10px;font-size:1.15em;font-weight:normal;color:var(--gc-accent,#f2c66d)}
.gc-box p{margin:8px 0}.gc-dim{opacity:.72}.gc-err{color:var(--gc-err,#ff8a7a);min-height:1.5em}
.gc-tabs{display:flex;gap:8px;margin:4px 0 10px}
.gc-btn{font:inherit;color:inherit;cursor:pointer;border:2px solid var(--gc-line,#4a4560);background:transparent;padding:6px 12px;min-height:40px}
.gc-btn.gc-on,.gc-btn.gc-main{background:var(--gc-accent,#f2c66d);color:var(--gc-on-accent,#1d1b26);border-color:var(--gc-accent,#f2c66d)}
.gc-btn[disabled]{opacity:.5;cursor:default}
.gc-field{display:block;margin:8px 0}.gc-field input{display:block;width:100%;box-sizing:border-box;margin-top:4px;font:inherit;font-size:max(16px,1em);
  color:var(--gc-fg,#efe9dc);background:var(--gc-input,#11101a);border:2px solid var(--gc-line,#4a4560);padding:8px 10px;border-radius:0}
.gc-field input:focus{outline:none;border-color:var(--gc-accent,#f2c66d)}
.gc-row{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;margin-top:12px}
.gc-field[hidden]{display:none}
.gc-pick{display:block;width:100%;text-align:left;margin:8px 0;padding:10px 12px}
.gc-pick b{display:block;font-weight:normal;color:var(--gc-accent,#f2c66d)}
@media (max-height:520px) and (orientation:landscape){
.gc-box{width:min(100%,600px);padding:10px 16px}
.gc-box h2{margin-bottom:4px}
.gc-tabs{margin:2px 0 4px}
.gc-box form{display:grid;grid-template-columns:1fr 1fr;gap:0 12px;align-items:end}
.gc-field{margin:4px 0}
.gc-field input{padding:6px 8px}
.gc-err,.gc-row{grid-column:1/-1}
.gc-err{min-height:0;margin:4px 0}
.gc-row{margin-top:4px}
.gc-box>p.gc-dim{margin:6px 0 0}}`;
    document.head.appendChild(s);
  }
  // opens a modal box; returns { box, close }
  function modal(theme, html) {
    injectStyle();
    const back = document.createElement('div'); back.className = 'gc-back';
    const box = document.createElement('div'); box.className = 'gc-box'; box.setAttribute('role', 'dialog'); box.innerHTML = html;
    for (const [k, v] of Object.entries(theme || {})) box.style.setProperty('--gc-' + k, v);
    back.appendChild(box); document.body.appendChild(back);
    // keys typed into the dialog must not drive the game underneath
    const stop = e => e.stopPropagation();
    for (const ev of ['keydown', 'keyup', 'keypress', 'pointerdown', 'mousedown', 'touchstart', 'wheel']) back.addEventListener(ev, stop);
    const close = () => back.remove();
    return { box, close, back };
  }

  // canonical JSON (sorted keys): a save that went through the server's cleaner compares equal to the copy the game made
  const canon = v => JSON.stringify(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(n => [n, x[n]])) : x);
  const sig = v => { const s = canon(v); let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36) + '.' + s.length; };
  const same = (a, b) => a === b || (!!a && !!b && canon(a) === canon(b));
  // /api/me answered for this account (an answer without a name cannot tell, so it does not block)
  const sameUser = (me, name) => !me?.user?.name || me.user.name.toLowerCase() === String(name).toLowerCase();
  // a save request named another account than the session's (GameAccount has moved the profile to the session's)
  const wrongAccount = e => !!e && e.status === 409 && e.data?.error === 'wrong_account';

  function create(opts) {
    const id = opts.id, theme = opts.theme || {};
    // uploads wait this long after a save, so a game that saves often still sends at most one request per interval
    const interval = Math.max(10000, opts.interval || 120000);
    // foreign: the page switched from one signed-in account to another, so the game still holds the previous account's
    // progress; until this account's own save is loaded into the game, the game's state and saves are never uploaded
    // gen counts activations, so a load that finishes after the page moved on to another account is recognised
    const A = { name: null, cache: null, status: available ? 'guest' : 'file', last: 0, job: null, timer: null, verified: false, checked: false, foreign: false, gen: 0 };
    const listeners = new Set();
    const notify = () => { for (const fn of listeners) { try { fn(api.status()); } catch { /* 各自独立 */ } } };
    const key = name => C.cacheKey(id, name);
    const persistCache = () => { if (A.name && A.cache) { A.cache.name = A.name; write(key(A.name), A.cache); } };
    const summary = doc => { try { return doc ? opts.summary(doc) : '空'; } catch { return '存档'; } };
    const when = doc => (doc && opts.time ? opts.time(doc) : 0) || 0;
    // hand a save to the game; its loader may be async or throw without breaking the sync (resolves true once it finished)
    const apply = doc => { try { return Promise.resolve(opts.load(doc, 'cloud')).then(() => true, () => false); } catch { return Promise.resolve(false); } };
    // the game's own save is device-level; it remembers the account that last synced it (lower case)
    const OWNER = 'gameinc_owner_' + id;
    const owned = () => { if (A.name && !A.foreign) { try { localStorage.setItem(OWNER, A.name.toLowerCase()); } catch { /* best effort */ } } };
    const otherOwner = () => { try { const owner = localStorage.getItem(OWNER); return !!owner && owner !== String(A.name).toLowerCase(); } catch { return false; } };
    // load a save into the game for this activation. Once it finished, the game's state is this account's again. A load
    // that finishes after the page moved on to another account left that account's save in the game: the current
    // account's own copy is loaded again, and the game's state stays foreign until that load has finished
    const load = (cache, doc) => {
      const gen = A.gen;
      apply(doc).then(ok => {
        if (gen !== A.gen) {
          if (!A.name || !A.cache) return;
          A.foreign = true; notify();
          if (A.cache.data) load(A.cache, A.cache.data);
          return;
        }
        if (ok && A.cache === cache && A.foreign) { A.foreign = false; owned(); notify(); }
      });
    };
    // after a sync that kept this account's cached copy: a game still holding another account's progress loads it
    const mine = (cache, ok) => { if (ok && A.foreign && A.cache === cache && cache.data) load(cache, cache.data); return ok; };

    function schedule(delay = interval) {
      if (!A.name || A.status === 'expired' || A.timer) return;
      A.timer = setTimeout(() => { A.timer = null; sync(); }, delay);
    }
    // keep the cloud copy on this device
    function take(cache, remote) {
      cache.rev = remote.rev; cache.data = remote.data; cache.dirty = false; delete cache.sent; persistCache();
      if (remote.data) load(cache, remote.data);
      return done();
    }
    // an upload whose reply never arrived (page closed, network dropped) may still have landed: the cloud save is then ours
    function ours(cache, remote) {
      if (!Array.isArray(cache.sent) || !cache.sent.length || !remote.data) return false;
      const got = sig(remote.data);
      return cache.sent.some(s => s.base + 1 === remote.rev && s.sig === got);
    }
    // PUT the device copy on top of baseRev; a 409 comes back with the cloud save attached
    async function upload(cache, baseRev, keepalive) {
      const doc = cache.data, body = { baseRev, data: doc }, mark = { base: baseRev, sig: sig(doc) };
      const unmark = () => { cache.sent = (Array.isArray(cache.sent) ? cache.sent : []).filter(s => s.base !== mark.base || s.sig !== mark.sig); };
      // remembered until the reply arrives (the write to local storage happens before the request leaves)
      unmark(); cache.sent = [...cache.sent.filter(s => s.base === baseRev).slice(-2), mark]; persistCache();
      // browsers cap keepalive bodies at 64 KB; a bigger save goes as a normal request
      const small = keepalive && new TextEncoder().encode(JSON.stringify(body)).length < 60000;
      let next;
      try { next = await C.request('/api/save/' + id, 'PUT', body, small); }
      catch (e) { if (e && e.status === 409) { unmark(); persistCache(); } throw e; }
      if (A.cache !== cache) return false;
      cache.rev = next.rev; delete cache.sent;
      // the game may have saved again while the request was in flight
      cache.dirty = cache.data !== doc;
      persistCache(); if (cache.dirty) schedule();
      return done();
    }
    // two devices changed progress: let the player keep one of them
    function choose(remote, local) {
      return new Promise(resolve => {
        const m = modal(theme, `<h2>${esc(opts.title)} · 选择存档</h2>
<p class="gc-dim">这台设备和云端的存档都有新进度，保留哪一份？另一份会被替换。</p>
<button class="gc-btn gc-pick" data-k="cloud"><b>云端存档</b>${esc(summary(remote.data))}<br><span class="gc-dim">${esc(stamp(when(remote.data) || remote.updated))}</span></button>
<button class="gc-btn gc-pick" data-k="local"><b>本机存档</b>${esc(summary(local))}<br><span class="gc-dim">${esc(stamp(when(local)))}</span></button>`);
        m.box.querySelectorAll('[data-k]').forEach(b => { b.onclick = () => { m.close(); resolve(b.dataset.k); }; });
      });
    }
    async function sync(keepalive = false) {
      if (!A.name || A.status === 'expired') return false;
      if (A.job) return A.job;
      A.status = 'syncing'; notify();
      const cache = A.cache;
      A.job = (async () => {
        try {
          if (!A.verified) {
            const me = await C.me();
            // GameAccount.me() moves the profile to the session's account, which re-activates this helper with that
            // account's cache; this cache never goes up under another account's session
            if (A.cache !== cache) return false;
            if (!sameUser(me, A.name)) { A.status = 'expired'; return false; }
            A.verified = true;
          }
          for (let tries = 0; tries < 3; tries++) {
            // the game's current local save is the device's progress; anything it saved without persist() still counts.
            // a flush while the page is being hidden sends the last persisted copy right away.
            // a foreign game state is never read: only this account's own cached copy counts
            const local = A.foreign || keepalive || !opts.read ? cache.data : await opts.read();
            if (A.cache !== cache) return false;
            if (local && !same(local, cache.data)) { cache.data = local; if (!cache.fresh) cache.dirty = true; }
            let remote;
            if (A.checked && !cache.fresh && cache.dirty && cache.data) {
              // 本次已经和云端核对过版本：直接按已知版本上传；别的设备改过云端时，服务器回 409 并附上云端存档
              try { return mine(cache, await upload(cache, cache.rev, keepalive)); }
              catch (e) {
                if (e.status !== 409 || !e.data || !Number.isSafeInteger(e.data.rev)) throw e;
                remote = { rev: e.data.rev, updated: e.data.updated, data: e.data.data ?? null };
              }
            } else remote = await C.request('/api/save/' + id);
            if (A.cache !== cache) return false;
            A.checked = true;
            let push = false;
            if (cache.fresh) {
              // 第一次在这台设备上用这个账号：云端为空就上传本机进度；两边都有就让玩家选
              delete cache.fresh;
              if (!remote.data) push = !!cache.data;
              // nothing worth keeping on this device (never played, or the game says the save is still at its starting point);
              // or the device's save last synced with another account: this account's cloud save is loaded, the device copy not offered
              else if (!cache.data || (opts.trivial && opts.trivial(cache.data)) || otherOwner()) return take(cache, remote);
              else if (same(cache.data, remote.data)) { cache.rev = remote.rev; cache.dirty = false; persistCache(); return mine(cache, done()); }
              else if (await choose(remote, cache.data) === 'cloud') return A.cache === cache && take(cache, remote);
              else push = true;
            } else if (remote.rev !== cache.rev) {
              if (ours(cache, remote)) {
                // our upload landed but the reply never arrived: the cloud copy is ours, no need to ask
                cache.rev = remote.rev; delete cache.sent;
                cache.dirty = !!cache.data && !same(cache.data, remote.data); push = cache.dirty;
              }
              // 别的设备更新过：本机没改就直接用云端，两边都改了让玩家选
              else if (!cache.dirty || !cache.data) return take(cache, remote);
              else if (same(cache.data, remote.data)) { cache.rev = remote.rev; cache.dirty = false; persistCache(); return mine(cache, done()); }
              else if (await choose(remote, cache.data) === 'cloud') return A.cache === cache && take(cache, remote);
              else push = true;
            } else push = cache.dirty;
            // the account changed while the player was choosing
            if (A.cache !== cache) return false;
            // this account has no save anywhere while the game still holds the previous account's progress: nothing
            // goes up; a reload starts this account like any first sign-in on this device
            if (A.foreign && !cache.data) { A.status = 'reload'; return false; }
            if (!push || !cache.data) { persistCache(); return mine(cache, done()); }
            try { return mine(cache, await upload(cache, remote.rev, keepalive)); }
            catch (e) { if (e.status !== 409 || wrongAccount(e)) throw e; }
          }
          A.status = 'error'; schedule(60000); return false;
        } catch (e) {
          // a sync left over from the previous account leaves the new one's status alone
          if (A.cache !== cache) return false;
          // the session belongs to another account (GameAccount moved the profile to it, which re-activates this helper)
          if (wrongAccount(e)) { A.status = 'expired'; return false; }
          A.status = e && e.status === 401 ? 'expired' : e && (e.status === 413 || e.status === 422 || e.status === 400) ? 'rejected' : 'error';
          if (A.status === 'error') schedule(60000);
          return false;
        } finally { if (A.cache === cache) A.job = null; notify(); }
      })();
      return A.job;
    }
    function done() { A.last = Date.now(); A.status = 'synced'; owned(); return true; }
    function activate(name) {
      // a sync still running for the previous account stops at its next step; this account starts its own
      clearTimeout(A.timer); A.timer = null; A.job = null; A.gen++;
      // switching between two signed-in accounts: the game's state is the previous account's (a guest's progress
      // is still offered to the account on its first sign-in here)
      if (A.name && A.name.toLowerCase() !== name.toLowerCase()) A.foreign = true;
      A.name = name; A.verified = false; A.checked = false;
      const cached = read(key(name));
      A.cache = cached && Number.isSafeInteger(cached.rev) && cached.data ? cached : { name, rev: 0, dirty: false, data: null, fresh: true };
      A.status = 'pending'; notify();
      return sync();
    }
    function deactivate() { clearTimeout(A.timer); A.timer = null; A.gen++; A.name = null; A.cache = null; A.status = available ? 'guest' : 'file'; A.verified = false; A.checked = false; A.foreign = false; notify(); }

    const api = {
      get available() { return available; },
      get name() { return A.name; },
      // 游戏启动时调用：已登录就开始同步（云端较新时通过 opts.load 交给游戏）
      boot() {
        if (!available) return;
        const profile = C.profile();
        if (profile) activate(profile.name);
        C.onProfileChange(p => {
          if (!p && A.name) deactivate();
          else if (p && p.name.toLowerCase() !== (A.name || '').toLowerCase()) activate(p.name);
        });
        window.addEventListener('online', () => sync());
        const flush = () => { if (A.name && A.cache && A.cache.dirty) sync(true); };
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
        window.addEventListener('pagehide', flush);
      },
      // 游戏每次本地存档后调用：登录时记入账号缓存并安排上传
      persist(doc) {
        // a game still holding another account's progress saves that progress: it is not this account's
        if (!A.name || !A.cache || !doc || A.foreign) return;
        A.cache.data = doc; A.cache.dirty = true; persistCache(); schedule();
      },
      sync: () => sync(),
      status() {
        if (!available) return { logged: false, state: 'file', text: '本地文件模式：存档保存在这台设备上' };
        if (!A.name) return { logged: false, state: 'guest', text: '未登录：存档保存在这台设备上。登录 GAME.INC.RE 账号后在所有设备同步' };
        const t = A.last ? new Date(A.last).toTimeString().slice(0, 5) : '';
        const map = { synced: `${A.name} · 已同步 ${t}`, syncing: `${A.name} · 正在同步…`, pending: `${A.name} · 等待同步`,
          error: `${A.name} · 暂时连不上服务器，稍后自动重试`, expired: `${A.name} · 登录已过期，请重新登录`,
          rejected: `${A.name} · 云端没有接受这份存档，进度保留在这台设备上`, reload: `${A.name} · 请刷新页面` };
        return { logged: A.status !== 'expired', state: A.status, name: A.name, text: map[A.status] || map.pending };
      },
      onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
      async logout() {
        if (!A.name) return { kept: [] };
        const res = await C.logout({ flush: async () => { if (A.cache && A.cache.dirty) await sync(); } });
        deactivate(); return res;
      },
      // 登录 / 注册对话框（GAME.INC.RE 通用账号）
      openLogin() {
        if (!available) return;
        const m = modal(theme, `<h2>GAME.INC.RE 账号</h2>
<div class="gc-tabs"><button class="gc-btn gc-on" data-m="0">登录</button><button class="gc-btn" data-m="1">注册</button></div>
<form novalidate>
<label class="gc-field">用户名<input name="username" autocomplete="username" autocapitalize="off" spellcheck="false" maxlength="16" placeholder="3–16 位字母、数字或下划线"></label>
<label class="gc-field">密码<input name="password" type="password" maxlength="64" autocomplete="current-password" placeholder="8–64 位"></label>
<label class="gc-field" hidden>确认密码<input name="confirm" type="password" maxlength="64" autocomplete="new-password" placeholder="再输入一次密码"></label>
<p class="gc-err" role="status"></p>
<div class="gc-row"><button type="button" class="gc-btn" data-x>取消</button><button type="submit" class="gc-btn gc-main">登录</button></div>
</form><p class="gc-dim">账号在本站所有游戏通用。登录后，${esc(opts.title)}的存档会在你的所有设备间同步。</p>`);
        const form = m.box.querySelector('form'), msg = m.box.querySelector('.gc-err'), submit = form.querySelector('[type=submit]');
        let mode = 0, busy = false;
        const setMode = k => {
          mode = k; msg.textContent = '';
          m.box.querySelectorAll('[data-m]').forEach(b => b.classList.toggle('gc-on', +b.dataset.m === k));
          form.elements.confirm.parentElement.hidden = !k; submit.textContent = k ? '注册并登录' : '登录';
          form.elements.password.autocomplete = k ? 'new-password' : 'current-password';
        };
        m.box.querySelectorAll('[data-m]').forEach(b => { b.onclick = () => setMode(+b.dataset.m); });
        m.box.querySelector('[data-x]').onclick = m.close;
        form.onsubmit = async e => {
          e.preventDefault(); if (busy) return;
          const u = form.elements.username.value.trim(), p = form.elements.password.value;
          if (!C.validName(u)) { msg.textContent = C.errorText({ data: { error: 'bad_username' } }); return; }
          if (!C.validPassword(p)) { msg.textContent = C.errorText({ data: { error: 'bad_password' } }); return; }
          if (mode && p !== form.elements.confirm.value) { msg.textContent = '两次输入的密码不一致'; return; }
          busy = true; submit.disabled = true; msg.textContent = '正在连接…';
          try {
            const r = await (mode ? C.register(u, p) : C.login(u, p));
            A.verified = true; m.close(); await activate(r.name);
          } catch (err) { msg.textContent = C.errorText(err); }
          finally { busy = false; submit.disabled = false; }
        };
        setTimeout(() => form.elements.username.focus(), 50);
      },
    };
    return api;
  }
  return { create, available };
})();
