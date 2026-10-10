'use strict';
const HUB_GAMES = [{
  id: 'entropy-blade', name: '熵刃', href: 'entropy-blade/index.html', guestKey: 'entropy_blade_save_v1',
  summary: data => `挑战 ${data.stats?.runs || 0} 次 · 通关 ${data.stats?.wins || 0} 次 · 熵晶 ${data.crystals || 0}`,
  guestHasProgress: data => (data?.stats?.runs || 0) > 0 || (data?.crystals || 0) > 0,
}, {
  id: 'tbmh', name: '悬赏怪物猎人', href: 'tbmh/index.html', guestKey: 'tbmh_save_v2',
  summary: data => data.v === 2
    ? `${['普通', '噩梦', '地狱', '折磨'][data.prog?.d || 0]} ${data.prog?.a || 1}-${data.prog?.s || 1} · 猎人 ${data.hero?.lv || 1} 级 · 通关 ${(data.prog?.best || []).reduce((a, x) => a + (x || 0), 0)} 关`
    : '第一版存档 · 进入游戏开始 2.0 的旅程',
  guestHasProgress: data => (data?.prog?.best?.[0] || 0) > 0 || (data?.stats?.kills || 0) > 0,
}];
(() => {
  const C = GameAccount, opener = document.getElementById('acct-open'), dialog = document.getElementById('acct');
  const guest = document.getElementById('acct-guest'), user = document.getElementById('acct-user');
  const form = guest.querySelector('form'), tabs = [...guest.querySelectorAll('.tab')];
  const username = form.elements.username, password = form.elements.password, confirm = form.elements.confirm;
  const submit = form.querySelector('.btn'), logout = user.querySelector('.btn2');
  const message = dialog.querySelector('.msg'), note = dialog.querySelector('.note'), saves = user.querySelector('.saves');
  let mode = 0, busy = false, expired = false, revision = 0;
  const read = key => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
  const say = (text = '', kind = '') => { message.textContent = text; message.className = 'msg' + (kind ? ' ' + kind : ''); };
  const clearPasswords = () => { password.value = ''; confirm.value = ''; };
  function changeTab(next) {
    if (busy) return;
    mode = next;
    tabs.forEach((tab, i) => tab.setAttribute('aria-selected', String(i === mode)));
    confirm.parentElement.hidden = mode !== 1;
    password.autocomplete = mode ? 'new-password' : 'current-password';
    submit.textContent = mode ? '注册并登录' : '登录'; clearPasswords(); say();
  }
  function setBusy(value, button) {
    busy = value;
    button.setAttribute('aria-busy', String(value)); button.disabled = value || C.file;
    submit.disabled = value || C.file; logout.disabled = value || C.file;
    button.textContent = value ? '正在连接…' : button === logout ? '退出登录' : mode ? '注册并登录' : '登录';
    for (const input of [username, password, confirm]) input.readOnly = value;
  }
  function renderRows(games, state = '') {
    saves.replaceChildren();
    const profile = C.profile();
    for (const game of HUB_GAMES) {
      const row = document.createElement('li'), link = document.createElement('a');
      link.className = 'gsave'; link.href = game.href;
      const name = document.createElement('span'), status = document.createElement('span'), summary = document.createElement('span');
      name.className = 'gname px'; name.textContent = game.name;
      status.className = 'gstat px'; summary.className = 'gsum';
      const saved = games?.[game.id], cache = profile && read(C.cacheKey(game.id, profile.name));
      status.textContent = '云端还没有存档';
      if (saved) {
        const d = new Date(saved.updated), pad = n => String(n).padStart(2, '0');
        status.textContent = `云端 · ${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
      }
      if (cache?.dirty) { status.textContent = '本机有未同步进度'; status.classList.add('warn'); }
      summary.textContent = state === 'loading' ? '正在读取…' : state === 'error' ? '无法连接服务器，请稍后再试' : saved?.data ? game.summary(saved.data) : game.guestHasProgress(read(game.guestKey)) ? '本机有游客存档，进入游戏后可以选择带入这个账号。' : '还没有进度，开始一局吧。';
      link.append(name, status, summary); row.appendChild(link); saves.appendChild(row);
    }
  }
  async function loadSaves() {
    const token = ++revision;
    renderRows(null, 'loading');
    try {
      const result = await C.request('/api/saves');
      if (token === revision) renderRows(result.games);
    } catch { if (token === revision) renderRows(null, 'error'); }
  }
  function render() {
    const profile = C.profile(), logged = !!profile && !expired;
    opener.className = 'acct px' + (profile ? expired ? ' warn' : ' on' : '');
    opener.querySelector('span').textContent = profile ? profile.name + (expired ? ' · 登录已过期' : '') : '登录 / 注册';
    guest.hidden = logged; user.hidden = !logged;
    note.textContent = logged ? '退出后，各游戏回到本机存档；账号数据保留在云端。' : '这是 GAME.INC.RE 的通用账号，所有游戏共用。请妥善保管密码。';
    submit.disabled = C.file || busy;
    if (logged) {
      user.querySelector('.who b').textContent = profile.name;
      if (dialog.open) loadSaves();
    } else {
      revision++;
      if (expired) { changeTab(0); username.value = profile.name; say('登录已过期，请重新登录。', 'err'); }
      if (C.file) say('本地文件模式下只能使用本机存档。');
    }
  }
  async function verify() {
    const profile = C.profile();
    if (!profile || C.file) return;
    const name = profile.name;
    try {
      await C.me();
      if (C.profile()?.name === name) { expired = false; render(); }
    } catch (e) {
      if (e.status === 401 && C.profile()?.name === name) { expired = true; render(); }
    }
  }
  tabs.forEach((tab, i) => tab.addEventListener('click', () => changeTab(i)));
  opener.addEventListener('click', () => {
    if (!busy) { changeTab(0); say(); }
    dialog.showModal(); render();
    if (!guest.hidden) (expired ? password : username).focus();
  });
  dialog.querySelector('.x').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('close', clearPasswords);
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (busy || C.file) return;
    const u = username.value.trim(), p = password.value, registering = mode === 1;
    let error = '';
    if (!C.validName(u)) error = C.errorText({ data: { error: 'bad_username' } });
    else if (!C.validPassword(p)) error = C.errorText({ data: { error: 'bad_password' } });
    else if (registering && p !== confirm.value) error = '两次输入的密码不一致';
    clearPasswords();
    if (error) { say(error, 'err'); return; }
    setBusy(true, submit); say();
    try {
      await (registering ? C.register(u, p) : C.login(u, p));
      expired = false;
      say(registering ? '注册成功，已登录。' : '登录成功。进入游戏后，存档会自动从云端载入。', 'ok');
      render();
    } catch (err) { say(C.errorText(err), 'err'); }
    finally { setBusy(false, submit); clearPasswords(); }
  });
  logout.addEventListener('click', async () => {
    if (busy || C.file) return;
    setBusy(true, logout); say();
    try {
      const result = await C.logout();
      expired = false; render();
      const names = result.kept.map(id => HUB_GAMES.find(game => game.id === id)?.name || id).join('、');
      say(result.kept.length ? `已退出。《${names}》有未同步的进度保留在这台设备上，下次登录同一账号时会自动同步。` : '已退出，各游戏回到本机存档。', 'ok');
    } catch (err) { say(C.errorText(err), 'err'); }
    finally { setBusy(false, logout); }
  });
  C.onProfileChange(() => { expired = false; clearPasswords(); say(); render(); verify(); });
  render(); verify();
})();
