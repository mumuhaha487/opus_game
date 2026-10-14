// ACCOUNT §2–3：三个宿主共用；凭据只活在结果页闭包，关闭/账号变化令异步结果失效。
import { generatePrompt, environmentCommands, maskKey, keyDate } from './agent-prompt.js';
const el = (tag, text = '', cls = '') => {
  const n = document.createElement(tag); n.textContent = text; n.className = cls; return n;
};
const btn = (text, action, cls = '') => {
  const n = el('button', text, 'k-button ' + cls); n.type = 'button'; n.addEventListener('click', action); return n;
};
const active = k => !k.revoked && k.expires > Date.now();
const errorText = e => e.data?.message || GameAccount.errorText(e);
export const GameKeys = { mount(container, { project = null, compact = false, onChange = () => {} } = {}) {
  const root = el('section', '', 'k-ui' + (compact ? ' k-compact' : '')); container.append(root);
  const legacy = container.dataset.keyIds === 'developer';
  const id = (node, name) => { if (legacy) node.id = name; return node; };
  let keys = [], projects = {}, identity = GameAccount.profile()?.name, revision = 0, generation = 0, logToken = 0;
  let secret = '', current = null, pending = false, disposed = false, focusOrigin;
  const heading = el('div', '', 'k-heading'), title = el('h3', 'API 密钥'), status = id(el('p', '', 'k-status'), 'keys-message');
  status.setAttribute('role', 'status');
  const create = id(btn('新建密钥', () => openCreate(), 'k-primary'), 'key-create');
  const guest = id(el('div'), 'keys-guest');
  guest.append(el('p', '登录后管理 API 密钥'), id(btn('登录', () => document.getElementById('acct-open')?.click()), 'key-login'));
  const tableBox = id(el('div', '', 'k-table-scroll'), 'keys-table'), table = el('table', '', 'k-table');
  const thead = el('thead'), labels = el('tr');
  for (const label of ['名称', '前缀', '权限', '到期时间', '最近使用', '操作']) labels.append(el('th', label));
  const rows = id(el('tbody'), 'key-rows'); thead.append(labels); table.append(thead, rows); tableBox.append(table);
  heading.append(title, create); root.append(heading, guest, status, tableBox);
  const dialogs = [];
  function dialog(name, caption) {
    const d = id(el('dialog', '', 'k-dialog'), name), box = el('div', '', 'k-dialog-in');
    const head = el('div', '', 'k-heading'), h = id(el('h2', caption), name + '-title');
    const close = btn('×', () => d.close()); close.setAttribute('aria-label', '关闭'); close.dataset.close = '';
    head.append(h, close); box.append(head); d.append(box); root.append(d); dialogs.push(d);
    d.setAttribute('aria-label', caption);
    d.addEventListener('click', e => { if (e.target === d) d.close(); });
    return { d, box, h };
  }
  const editor = dialog('key-new', '新建密钥'), form = id(el('form', '', 'k-form'), 'key-form');
  const resultBox = id(el('div'), 'key-result'), formMessage = id(el('p', '', 'k-status'), 'key-new-message');
  const projectField = el('label', '项目', 'k-field'), select = el('select'), singleProject = el('span');
  projectField.append(select, singleProject);
  function input(label, name, type = 'text') {
    const field = el('label', label, 'k-field'), n = el('input'); n.name = name; n.type = type;
    field.append(n); form.append(field); return n;
  }
  form.append(projectField);
  const name = input('名称', 'name'); name.maxLength = 24; name.required = true; name.autocomplete = 'off';
  const permissions = el('fieldset', '', 'k-options'); permissions.append(el('legend', '权限')); form.append(permissions);
  const expiry = el('fieldset', '', 'k-options'); expiry.append(el('legend', '有效期'));
  for (const days of [30, 90, 180]) {
    const l = el('label', days + ' 天'), n = el('input'); n.type = 'radio'; n.name = 'expiry'; n.value = days;
    n.defaultChecked = days === 30; l.prepend(n); expiry.append(l);
  }
  form.append(expiry);
  const password = input('登录密码', 'password', 'password'); password.required = true;
  password.maxLength = 64; password.autocomplete = 'current-password';
  const consentLabel = el('label', '我已阅读使用须知：仅教学练习，不构成投资建议', 'k-consent');
  const consent = el('input'); consent.type = 'checkbox'; consent.name = 'consent'; consent.required = true;
  consentLabel.prepend(consent);
  const generate = id(btn('生成密钥', () => {}, 'k-primary'), 'key-generate'); generate.type = 'submit';
  form.append(consentLabel, generate); editor.box.append(form, resultBox, formMessage);
  const log = dialog('key-log', '调用记录'), logMessage = id(el('p', '', 'k-status'), 'key-log-message');
  const logRows = id(el('tbody'), 'key-log-rows'), logTable = el('table', '', 'k-table');
  const logHead = el('tr'); for (const v of ['时间', '方法', '路径', '状态', '来源 IP 段']) logHead.append(el('th', v));
  const logHeaders = el('thead'); logHeaders.append(logHead); logTable.append(logHeaders, logRows);
  const logScroll = el('div', '', 'k-table-scroll'); logScroll.append(logTable); log.box.append(logMessage, logScroll);
  log.d.addEventListener('close', () => { if (!log.d.open) { logToken++; logRows.replaceChildren(); } });
  const revoke = dialog('key-revoke', '撤销密钥'), revokeDetail = id(el('p'), 'key-revoke-detail');
  const revokeMessage = id(el('p', '', 'k-status'), 'key-revoke-message'); let revokeId = null;
  const confirmRevoke = id(btn('确认撤销', async () => {
    if (!revokeId || confirmRevoke.disabled) return;
    const token = generation, keyId = revokeId; confirmRevoke.disabled = true;
    try {
      await GameAccount.request('/api/keys/revoke', 'POST', { id: keyId });
      if (token !== generation || disposed) return;
      revoke.d.close(); await refresh(); onChange();
    } catch (e) { if (token === generation) revokeMessage.textContent = errorText(e); }
    finally { confirmRevoke.disabled = false; }
  }, 'k-primary'), 'key-revoke-confirm');
  revoke.box.append(revokeDetail, confirmRevoke, revokeMessage);
  revoke.d.addEventListener('close', () => { if (!revoke.d.open) { revokeId = null; revokeMessage.textContent = ''; } });
  const warning = dialog('key-export', '含密钥的提示词'); let exportAction = null;
  warning.box.append(el('p', '任何能看到这段对话的人或服务都能使用这个密钥。建议只读密钥或短期密钥才这样用。'));
  warning.box.append(btn('确认', () => { const action = exportAction; exportAction = null; warning.d.close(); action?.(); }, 'k-primary'),
    btn('取消', () => warning.d.close()));
  warning.d.addEventListener('close', () => { if (!warning.d.open) exportAction = null; });
  function clearSecret() {
    generation++; secret = ''; current = null; pending = false; exportAction = null;
    if (warning.d.open) warning.d.close();
    for (const n of resultBox.querySelectorAll('textarea, input')) n.value = '';
    resultBox.replaceChildren(); resultBox.hidden = true; form.hidden = false; form.reset(); password.value = '';
    formMessage.textContent = ''; generate.textContent = '生成密钥'; generate.disabled = true;
  }
  editor.d.addEventListener('cancel', clearSecret);
  editor.d.addEventListener('close', () => { if (!editor.d.open) { clearSecret(); focusOrigin?.focus(); } });
  function closeAll() { clearSecret(); for (const d of dialogs) if (d.open) d.close(); }
  function scopeOptions() {
    permissions.replaceChildren(el('legend', '权限'));
    for (const [scope, text] of Object.entries(projects[select.value]?.scopes || {})) {
      const l = el('label', text), n = el('input'); n.type = 'checkbox'; n.name = scope;
      n.checked = scope === 'read'; n.disabled = scope === 'read'; l.prepend(n); permissions.append(l);
    }
  }
  select.addEventListener('change', scopeOptions);
  function openCreate() {
    if (keys.filter(active).length >= 5 || !identity || !Object.keys(projects).length) return;
    focusOrigin = document.activeElement; clearSecret(); editor.h.textContent = '新建密钥';
    scopeOptions(); editor.d.showModal(); name.focus();
  }
  form.addEventListener('input', () => { generate.disabled = pending || !form.checkValidity(); });
  form.addEventListener('submit', async e => {
    e.preventDefault(); if (pending || !form.reportValidity()) return;
    if (!name.value.trim() || [...name.value.trim()].length > 24) { formMessage.textContent = '请输入 1–24 个字的名称'; return; }
    const token = generation; pending = true; generate.disabled = true; generate.textContent = '正在生成…';
    const data = { name: name.value.trim(), project: select.value,
      scopes: [...permissions.querySelectorAll('input:checked')].map(n => n.name),
      expiresDays: +form.elements.expiry.value, password: password.value, acceptDisclaimer: true };
    const request = GameAccount.request('/api/keys', 'POST', data); password.value = ''; data.password = '';
    try {
      const result = await request;
      if (token === generation && editor.d.open && !disposed) {
        secret = result.key; delete result.key; current = result; editor.h.textContent = '密钥已创建';
        renderResult(); onChange();
      } else { delete result.key; }
      if (!disposed && token === generation) await refresh();
    } catch (error) { if (token === generation) formMessage.textContent = errorText(error); }
    finally { if (token === generation) { pending = false; generate.textContent = '生成密钥'; } }
  });
  async function copy(text, control) {
    const label = control.textContent;
    try { await navigator.clipboard.writeText(text); control.textContent = '已复制'; }
    catch { control.textContent = '复制失败，请允许剪贴板访问'; }
    setTimeout(() => { if (control.isConnected) control.textContent = label; }, 2000);
  }
  function renderResult() {
    form.hidden = true; resultBox.hidden = false; resultBox.replaceChildren();
    resultBox.append(el('p', secret ? '密钥只显示这一次。关闭后无法再次查看；遗失请撤销后重建。'
      : '密钥只在创建时显示；如需含密钥的版本，请新建密钥', 'k-warning key-warning'));
    if (secret) {
      const line = el('div', '', 'k-secret-line'), text = id(el('code', maskKey(secret), 'k-secret'), 'key-secret');
      const reveal = btn('显示', () => {
        const hidden = reveal.textContent === '显示'; text.textContent = hidden ? secret : maskKey(secret);
        reveal.textContent = hidden ? '隐藏' : '显示';
      }); reveal.dataset.action = 'reveal';
      const copyKey = id(btn('复制', e => copy(secret, e.currentTarget)), 'key-copy');
      line.append(text, reveal, copyKey); resultBox.append(line);
    }
    let policy = 'A';
    const amount = el('input'); amount.type = 'number'; amount.min = 1; amount.max = 1000; amount.value = 10;
    amount.setAttribute('aria-label', '单笔上限（USDT）'); amount.disabled = true;
    const preview = el('textarea', '', 'k-prompt'); preview.readOnly = true; preview.setAttribute('aria-label', 'AI 提示词');
    const prompt = mode => generatePrompt(current, { mode, secret, policy, limit: amount.value });
    const update = () => { preview.value = prompt('environment'); };
    if (current.scopes.includes('trade')) {
      const policies = el('fieldset', '', 'k-options'); policies.append(el('legend', '代理确认方式'));
      for (const [value, label] of [['A', '每次下单、撤单、划转前，先征求我同意'],
        ['B', '允许在我设定的单笔上限内自主交易']]) {
        const l = el('label', label), radio = el('input'); radio.type = 'radio'; radio.name = 'policy';
        radio.value = value; radio.checked = value === 'A'; l.prepend(radio); policies.append(l);
        radio.addEventListener('change', () => { policy = value; amount.disabled = value !== 'B'; update(); });
      }
      const l = el('label', '单笔上限（USDT）', 'k-field'); l.append(amount); policies.append(l); resultBox.append(policies);
      amount.addEventListener('input', update);
      amount.addEventListener('change', () => { amount.value = Math.min(1000, Math.max(1, +amount.value || 10)); update(); });
    }
    resultBox.append(el('h3', 'AI 提示词'), preview); update();
    const actions = el('div', '', 'k-actions');
    actions.append(btn('复制提示词（推荐：密钥放环境变量）', e => copy(prompt('environment'), e.currentTarget), 'k-primary'));
    if (secret) {
      actions.append(btn('复制环境变量命令（PowerShell / bash）', e => copy(environmentCommands(secret), e.currentTarget)));
      const confirm = action => { exportAction = action; warning.d.showModal(); };
      actions.append(btn('复制提示词（含密钥）', e => {
        const control = e.currentTarget; confirm(() => copy(prompt('inline'), control));
      }));
      actions.append(btn('下载 .md', () => confirm(() => {
        const blob = new Blob([prompt('inline')], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob), a = el('a'); a.href = url; a.download = 'gameinc-agent.md'; a.hidden = true;
        document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 0);
      })));
    }
    resultBox.append(actions); actions.firstChild.focus();
  }
  function row(values) {
    const tr = el('tr');
    for (const v of values) {
      const td = el('td'); td.append(v?.nodeType ? v : document.createTextNode(v)); tr.append(td);
    }
    return tr;
  }
  function render() {
    rows.replaceChildren(); const filtered = keys.filter(k => !project || k.project === project);
    for (const [slug, meta] of Object.entries(projects)) {
      if (project && slug !== project) continue;
      if (!project) { const group = row([meta.name]); group.firstChild.colSpan = 6; group.className = 'k-group'; rows.append(group); }
      for (const key of filtered.filter(k => k.project === slug)) {
        const actions = el('div', '', 'k-actions');
        if (active(key)) actions.append(btn('提示词', () => {
          focusOrigin = document.activeElement; clearSecret(); current = key; editor.h.textContent = 'AI 提示词';
          editor.d.showModal(); renderResult();
        }));
        actions.append(btn('调用记录', () => showLog(key)));
        if (active(key)) actions.append(btn('撤销', () => {
          revokeId = key.id; revokeDetail.textContent = '撤销「' + key.name + '」后，使用此密钥的调用立即失效。';
          revoke.d.showModal();
        })); else actions.append(el('span', key.revoked ? '已撤销' : '已到期'));
        const scopes = el('div', key.scopes.includes('trade') ? '只读 · 交易' : '只读', 'k-scope');
        const tr = row([key.name, el('code', key.prefix), scopes, keyDate(key.expires),
          key.lastUsed ? keyDate(key.lastUsed) : '尚未使用', actions]); tr.dataset.id = key.id; rows.append(tr);
      }
    }
    create.disabled = keys.filter(active).length >= 5 || !Object.keys(projects).length;
    status.textContent = keys.filter(active).length >= 5 ? '最多保留 5 个有效密钥'
      : filtered.length ? '' : '还没有密钥。创建后，AI 可以用它查询行情或代你交易。';
  }
  async function refresh() {
    const token = ++revision, logged = !!GameAccount.profile();
    guest.hidden = logged; tableBox.hidden = !logged; create.hidden = !logged;
    if (!logged) { keys = []; rows.replaceChildren(); return; }
    create.disabled = true; status.textContent = '正在读取密钥…';
    try {
      const data = await GameAccount.request('/api/keys'); if (token !== revision || disposed) return;
      keys = data.keys; projects = data.projects; select.replaceChildren();
      title.textContent = project ? 'API 密钥 · ' + (projects[project]?.name || project) : 'API 密钥';
      for (const [slug, meta] of Object.entries(projects)) {
        if (project && slug !== project) continue;
        const o = el('option', meta.name); o.value = slug; select.append(o);
      }
      select.hidden = select.options.length <= 1; singleProject.hidden = !select.hidden;
      singleProject.textContent = projects[select.value]?.name || '暂无可用项目';
      if (!editor.d.open) editor.h.textContent = '新建密钥';
      render();
    } catch (e) {
      if (token !== revision || disposed) return;
      rows.replaceChildren(); status.textContent = errorText(e);
      if (e.status === 401) { guest.hidden = false; create.hidden = true; tableBox.hidden = true; closeAll(); }
    }
  }
  async function showLog(key) {
    const token = ++logToken; logRows.replaceChildren(); log.h.textContent = key.name + ' · 调用记录';
    logMessage.textContent = '正在读取最近 100 条…'; log.d.showModal();
    try {
      const data = await GameAccount.request('/api/keys/log?id=' + encodeURIComponent(key.id));
      if (token !== logToken || disposed) return;
      logRows.replaceChildren(...data.logs.map(v => row([keyDate(v.time), v.method, v.path, String(v.status), v.ip])));
      logMessage.textContent = data.logs.length ? '最近 ' + data.logs.length + ' 条调用' : '还没有调用记录';
    } catch (e) { if (token === logToken) logMessage.textContent = errorText(e); }
  }
  const changed = () => {
    const name = GameAccount.profile()?.name;
    if (identity !== name) { identity = name; closeAll(); keys = []; revision++; }
    if (!disposed) refresh();
  };
  const unsubscribe = GameAccount.onProfileChange(changed);
  document.addEventListener('hub-account-change', changed);
  refresh();
  return { refresh, close: closeAll, destroy() {
    disposed = true; revision++; logToken++; closeAll();
    if (typeof unsubscribe === 'function') unsubscribe(); root.remove();
    document.removeEventListener('hub-account-change', changed);
  } };
} };
