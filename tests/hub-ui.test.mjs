import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hubContext, jsonResponse, tick } from './helpers/hub-context.mjs';

function ui(options = {}) {
  class Element {
    children = []; events = new Map(); attributes = new Map(); selectors = new Map(); style = {}; value = ''; className = ''; hidden = false;
    constructor() { this.classList = { add: name => { this.className += ' ' + name; } }; }
    querySelector(selector) { return this.selectors.get(selector); }
    querySelectorAll(selector) { return this.selectors.get(selector); }
    setAttribute(name, value) { this.attributes.set(name, value); }
    addEventListener(type, fn) { this.events.set(type, fn); }
    async emit(type, event = {}) { await this.events.get(type)?.(event); }
    append(...nodes) { this.children.push(...nodes); for (const node of nodes) node.parentElement = this; }
    appendChild(node) { this.append(node); }
    replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
    focus() { document.activeElement = this; }
    showModal() { this.open = true; }
    close() { this.open = false; this.emit('close'); }
  }
  const opener = new Element(), dialog = new Element(), guest = new Element(), user = new Element();
  const message = new Element(), note = new Element(), close = new Element(), label = new Element(), list = new Element();
  const form = new Element(), username = new Element(), password = new Element(), confirm = new Element();
  const submit = new Element(), logout = new Element(), tabs = [new Element(), new Element()];
  const name = new Element(), who = new Element(); opener.selectors.set('span', name); user.selectors.set('.who b', who);
  form.elements = { username, password, confirm }; form.selectors.set('.btn', submit); label.append(confirm);
  guest.selectors.set('form', form); guest.selectors.set('.tab', tabs);
  user.selectors.set('.btn2', logout); user.selectors.set('.saves', list);
  dialog.selectors.set('.msg', message); dialog.selectors.set('.note', note); dialog.selectors.set('.x', close);
  const nodes = new Map([['acct-open', opener], ['acct', dialog], ['acct-guest', guest], ['acct-user', user]]);
  const document = { getElementById: id => nodes.get(id), createElement: () => new Element() };
  const c = hubContext({ ...options, document }); c.load('account-ui');
  const submitForm = () => form.emit('submit', { preventDefault() {} });
  return { ...c, opener, dialog, guest, user, message, note, close, form, username, password, confirm, submit, logout, tabs, name, who, list, submitForm, document };
}

test('hub dialog form tabs, validation, busy state, login, save summaries and logout', async () => {
  let resolve;
  const c = ui({ fetcher: async path => path === '/api/login' ? new Promise(r => { resolve = r; }) : path === '/api/saves' ? jsonResponse({ games: { 'entropy-blade': { rev: 1, updated: Date.UTC(2026, 9, 10), data: { stats: { runs: 3, wins: 1 }, crystals: 7 } } } }) : jsonResponse({ ok: true }) });
  assert.equal(c.name.textContent, '登录 / 注册'); await c.opener.emit('click'); assert.equal(c.dialog.open, true); assert.equal(c.document.activeElement, c.username);
  await c.tabs[1].emit('click'); assert.equal(c.confirm.parentElement.hidden, false); assert.equal(c.password.autocomplete, 'new-password'); assert.equal(c.submit.textContent, '注册并登录');
  c.username.value = 'ab'; c.password.value = '12345678'; await c.submitForm(); assert.equal(c.message.textContent, '用户名需为 3–16 位字母、数字或下划线'); assert.equal(c.requests.length, 0);
  await c.tabs[0].emit('click'); assert.equal(c.confirm.parentElement.hidden, true); assert.equal(c.password.value, '');
  c.username.value = ' PlayerA '; c.password.value = 'test-password';
  const pending = c.submitForm(); await tick();
  assert.equal(c.submit.textContent, '正在连接…'); assert.equal(c.submit.attributes.get('aria-busy'), 'true'); assert.equal(c.username.readOnly, true);
  resolve(jsonResponse({ user: { name: 'PlayerA' } })); await pending; await tick();
  assert.equal(c.name.textContent, 'PlayerA'); assert.equal(c.guest.hidden, true); assert.equal(c.who.textContent, 'PlayerA');
  assert.equal(c.message.textContent, '登录成功。进入游戏后，存档会自动从云端载入。'); assert.equal(c.message.className, 'msg ok');
  assert.equal(c.password.value, ''); assert.equal(c.username.readOnly, false);
  const link = c.list.children[0].children[0]; assert.equal(link.href, 'entropy-blade/index.html');
  assert.equal(link.children[0].textContent, '熵刃'); assert.equal(link.children[2].textContent, '挑战 3 次 · 通关 1 次 · 熵晶 7');
  await c.logout.emit('click'); assert.equal(c.name.textContent, '登录 / 注册'); assert.equal(c.user.hidden, true);
  assert.equal(c.message.textContent, '已退出，各游戏回到本机存档。'); assert.equal(c.submit.disabled, false);
  await c.dialog.emit('click', { target: c.dialog }); assert.equal(c.dialog.open, false);
});

test('hub expired session prefills username and storage events refresh an open dialog', async () => {
  let online = false;
  const storage = new Map([['gameinc_profile_v1', '{"name":"PlayerA"}']]);
  const c = ui({ storage, fetcher: async path => path === '/api/me' && !online ? jsonResponse({ error: 'unauthorized' }, 401) : path === '/api/saves' ? jsonResponse({ games: {} }) : jsonResponse({ user: { name: 'PlayerA' } }) });
  assert.equal(c.name.textContent, 'PlayerA'); await tick(); assert.equal(c.name.textContent, 'PlayerA · 登录已过期'); assert.match(c.opener.className, /warn/);
  await c.opener.emit('click'); assert.equal(c.username.value, 'PlayerA'); assert.equal(c.document.activeElement, c.password);
  assert.equal(c.message.textContent, '登录已过期，请重新登录。'); assert.equal(c.message.className, 'msg err');
  online = true; c.event('storage', { key: 'gameinc_profile_v1', newValue: '{"name":"PlayerB"}' }); await tick();
  assert.equal(c.who.textContent, 'PlayerB'); assert.equal(c.user.hidden, false);
  c.event('storage', { key: 'gameinc_profile_v1', newValue: null }); assert.equal(c.name.textContent, '登录 / 注册'); assert.equal(c.guest.hidden, false);
});

test('hub missing/cloud/offline summaries and dirty logout retention use exact copy', async () => {
  const cacheKey = 'gameinc_save_entropy-blade_playera_v1';
  const storage = new Map([['gameinc_profile_v1', '{"name":"PlayerA"}'], ['entropy_blade_save_v1', '{"crystals":7}'], [cacheKey, '{"name":"PlayerA","rev":1,"dirty":true,"data":{"crystals":4}}']]);
  let fail = false;
  const c = ui({ storage, fetcher: async path => {
    if (path === '/api/me') return jsonResponse({ user: { name: 'PlayerA' } });
    if (path === '/api/logout') return jsonResponse({ ok: true });
    if (path.startsWith('/api/save/')) return jsonResponse({ error: 'conflict' }, 409);
    if (fail) throw new Error('offline');
    return jsonResponse({ games: {} });
  } });
  await tick(); await c.opener.emit('click'); await tick();
  let spans = c.list.children[0].children[0].children;
  assert.equal(spans[1].textContent, '本机有未同步进度'); assert.match(spans[1].className, /warn/);
  assert.equal(spans[2].textContent, '本机有游客存档，进入游戏后可以选择带入这个账号。');
  storage.delete('entropy_blade_save_v1'); await c.opener.emit('click'); await tick();
  assert.equal(c.list.children[0].children[0].children[2].textContent, '还没有进度，开始一局吧。');
  fail = true; await c.opener.emit('click'); await tick();
  assert.equal(c.list.children[0].children[0].children[2].textContent, '无法连接服务器，请稍后再试');
  await c.logout.emit('click');
  assert.equal(c.message.textContent, '已退出。《熵刃》有未同步的进度保留在这台设备上，下次登录同一账号时会自动同步。');
  assert.ok(storage.has(cacheKey)); assert.equal(c.message.className, 'msg ok');
});

test('hub file mode opens normally and suppresses API submission; dynamic data uses textContent', async () => {
  const c = ui({ file: true }); await c.opener.emit('click');
  assert.equal(c.message.textContent, '本地文件模式下只能使用本机存档。'); assert.equal(c.submit.disabled, true);
  await c.submitForm(); assert.equal(c.requests.length, 0);
  const source = readFileSync(new URL('../hub/account-ui.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /innerHTML|outerHTML|insertAdjacentHTML/);
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<dialog class="dlg" id="acct" aria-labelledby="acct-title">/);
  assert.match(html, /\[hidden\]\s*\{\s*display: none !important;/);
  assert.ok(html.indexOf('src="hub/account-core.js"') < html.indexOf('src="hub/account-ui.js"'));
});
