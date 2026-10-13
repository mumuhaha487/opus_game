// 登录、每日签到、账户划转和最多三条 Toast。
// 规格 9.10：固定 token、尺寸、逐字文案，Esc / 遮罩关闭。
// GameAccount 负责认证，密码只在本次提交中使用。
import { element, button, money, number } from './format.js';
import { positionMetrics, markFor } from './futures.js';
export class Modals {
  constructor(api) {
    this.api = api; this.dialog = document.getElementById('modal'); this.content = document.getElementById('modal-content');
    this.dialog.addEventListener('click', event => { if (event.target === this.dialog) this.dialog.close(); });
    this.dialog.addEventListener('close', () => {
      for (const input of this.content.querySelectorAll('input[type=password]')) input.value = '';
    });
  }
  toast(text, error = false) {
    const box = document.getElementById('toasts'), node = element('div', '', 'toast');
    node.append(element('span', error ? '×' : '✓', error ? 'down' : 'up'), element('span', text));
    box.append(node); while (box.children.length > 3) box.firstChild.remove(); setTimeout(() => node.remove(), 3000);
  }
  error(error) { this.toast(error.data?.message || GameAccount.errorText(error), true); }
  open(title) {
    this.dialog.classList.toggle('checkin-modal', title === '每日签到');
    this.content.replaceChildren();
    const header = element('div', '', 'modal-header'); header.append(element('h2', title), button('×', () => this.dialog.close()));
    this.content.append(header); if (!this.dialog.open) this.dialog.showModal(); return this.content;
  }
  focus() { (this.content.querySelector('input') || this.content.querySelector('.primary'))?.focus(); }
  field(container, label, type = 'text') {
    const field = element('label', label, 'modal-field'), input = element('input');
    input.type = type; input.name = label; input.autocomplete = type === 'password' ? 'current-password' : 'username';
    field.append(input); container.append(field); return input;
  }
  login(register = false) {
    const box = this.open(register ? '注册' : '登录'), tabs = element('div', '', 'modal-tabs');
    tabs.append(button('登录', () => this.login(false), register ? '' : 'selected'),
      button('注册', () => this.login(true), register ? 'selected' : '')); box.append(tabs);
    const form = element('form'); form.noValidate = true; box.append(form);
    const username = this.field(form, '用户名'), password = this.field(form, '密码', 'password');
    username.maxLength = 16; password.maxLength = 64;
    password.autocomplete = register ? 'new-password' : 'current-password';
    const confirmation = register ? this.field(form, '确认密码', 'password') : null;
    if (confirmation) { confirmation.autocomplete = 'new-password'; confirmation.maxLength = 64; }
    const submit = button(register ? '注册并登录' : '登录', null, 'primary'); submit.type = 'submit'; form.append(submit);
    const message = element('p', '', 'down'); form.append(message);
    box.append(element('p', '使用 GAME.INC.RE 通用账号，所有游戏和交易所共用。', 'muted'));
    form.onsubmit = async event => {
      event.preventDefault(); if (submit.disabled) return;
      if (!GameAccount.validName(username.value.trim())) {
        message.textContent = GameAccount.errorText({ data: { error: 'bad_username' } }); return;
      }
      if (!GameAccount.validPassword(password.value) || confirmation && password.value !== confirmation.value) {
        message.textContent = GameAccount.errorText({ data: { error: 'bad_password' } }); return;
      }
      submit.disabled = true;
      try {
        const action = register ? GameAccount.register : GameAccount.login;
        await action(username.value.trim(), password.value); this.dialog.close(); this.api.accountChanged();
      } catch (error) { message.textContent = GameAccount.errorText(error); }
      finally { password.value = ''; if (confirmation) confirmation.value = ''; submit.disabled = false; }
    };
    this.focus();
  }
  async checkin() {
    if (!this.api.logged()) { this.login(); return; }
    if (!this.api.state) await this.api.refresh();
    const state = this.api.state; if (!state) return;
    const box = this.open('每日签到'), cards = element('div', '', 'day-cards'), data = state.checkin;
    data.rewards.forEach((reward, index) => {
      const card = element('div', '', 'day-card');
      const taken = index < data.dayIndex || data.checkedToday && index === data.dayIndex;
      if (taken) card.classList.add('taken'); else if (index === data.dayIndex) card.classList.add('today');
      card.append(element('span', '第' + (index + 1) + '天'), element('b', number(reward, 0)), element('small', 'USDT'));
      if (taken) card.append(element('i', '✓', 'up')); cards.append(card);
    });
    box.append(cards);
    const submit = button(data.checkedToday ? '今日已签到' : '立即签到', async () => {
      submit.disabled = true;
      try {
        const result = await this.api.post('checkin', {});
        this.toast('签到成功，+' + number(result.reward, 0) + ' USDT'); await this.checkin();
      } catch (error) { this.error(error); submit.disabled = false; }
    }, 'primary'); submit.disabled = data.checkedToday; box.append(submit);
    box.append(element('p', `已连续签到 ${data.streak} 天 · 奖励发放到现货账户 · 断签后从第 1 天重新开始`, 'muted'));
    this.focus();
  }
  async transfer() {
    if (!this.api.logged()) { this.login(); return; }
    if (!this.api.state) await this.api.refresh(); if (!this.api.state) return;
    const box = this.open('划转'); let from = 'spot';
    const accounts = element('div', '', 'transfer-accounts'), source = element('div'), target = element('div');
    const available = element('p', '', 'muted');
    const repaint = () => {
      source.textContent = '从 ' + (from === 'spot' ? '现货账户' : '合约账户');
      target.textContent = '到 ' + (from === 'spot' ? '合约账户' : '现货账户');
      available.textContent = '可划转 ' + money(funds()) + ' USDT';
    };
    const funds = () => from === 'spot' ? this.api.state.spot.balances.find(entry => entry.asset === 'USDT')?.free || '0'
      : this.api.state.futures.wallet;
    accounts.append(source, button('⇅', () => { from = from === 'spot' ? 'futures' : 'spot'; repaint(); }), target);
    box.append(accounts, element('p', 'USDT'));
    const amount = this.field(box, '数量'); amount.autocomplete = 'off'; amount.inputMode = 'decimal';
    amount.parentElement.append(button('全部', () => { amount.value = funds(); })); box.append(available);
    const submit = button('确认划转', async () => {
      submit.disabled = true;
      try { await this.api.post('transfer', { from, to: from === 'spot' ? 'futures' : 'spot', amount: amount.value });
        this.dialog.close(); }
      catch (error) { this.error(error); } finally { submit.disabled = false; }
    }, 'primary'); box.append(submit); repaint(); this.focus();
  }
  action(box, text, run) {
    const submit = button(text, async () => {
      if (submit.disabled) return; submit.disabled = true;
      try { await run(); this.dialog.close(); } catch (error) { this.error(error); }
      finally { submit.disabled = false; }
    }, 'primary'); box.append(submit); this.focus(); return submit;
  }
  decimalField(box, label, name) {
    const input = this.field(box, label); input.name = name; input.autocomplete = 'off'; input.inputMode = 'decimal'; return input;
  }
  leverage(feed) {
    if (!this.api.logged()) { this.login(); return; }
    const symbol = feed.symbol, maximum = Math.min(125, Number(feed.spec?.leverage_max || 20));
    let value = this.api.state?.futures.leverage[symbol] || Math.min(20, maximum);
    const box = this.open('调整杠杆'), row = element('div', '', 'leverage-control'), label = element('b');
    const range = element('input'); range.type = 'range'; range.min = 1; range.max = maximum; range.value = value;
    range.setAttribute('aria-label', '杠杆倍数');
    const repaint = () => { label.textContent = value + 'x'; range.value = value; };
    const change = delta => { value = Math.max(1, Math.min(maximum, value + delta)); repaint(); };
    row.append(button('−', () => change(-1)), label, button('+', () => change(1))); box.append(row, range);
    range.oninput = () => { value = Number(range.value); repaint(); };
    const ticks = element('div', '', 'leverage-ticks');
    for (let i = 0; i < 5; i++) ticks.append(element('span', Math.round(1 + (maximum - 1) * i / 4) + 'x'));
    const capacity = element('p');
    const update = () => { capacity.textContent = '当前杠杆下最大可开仓位：'
      + money(Math.min(Number(feed.spec?.risk_limit_base || 0), Number(this.api.state?.futures.wallet || 0)
        / (1 / value + 0.0005))) + ' USDT'; };
    range.addEventListener('input', update); row.addEventListener('click', update);
    box.append(ticks, capacity, element('p', '杠杆越高，强平风险越大。', 'down')); repaint(); update();
    this.action(box, '确认', () => this.api.post('futures/leverage', { symbol, leverage: value }));
  }
  margin(feed, position) {
    const symbol = position.symbol, box = this.open('调整保证金'); let action = 'add';
    const tabs = element('div', '', 'modal-tabs'), maximum = element('p', '', 'muted'), estimate = element('p', '', 'futures-liq');
    const input = this.decimalField(box, '数量', 'margin-amount');
    const repaint = () => {
      const current = this.api.state?.futures.positions.find(entry => entry.symbol === symbol) || position;
      const mark = markFor(feed, symbol), metrics = positionMetrics(current, mark);
      const limit = action === 'add' ? this.api.state?.futures.wallet || '0' : metrics.removable;
      maximum.textContent = (action === 'add' ? '最多可增加 ' : '最多可减少 ') + money(limit) + ' USDT';
      const next = { ...current, margin: String(Number(current.margin) + Number(input.value || 0) * (action === 'add' ? 1 : -1)) };
      const liq = positionMetrics(next, mark).liq;
      estimate.textContent = '调整后强平价格 ' + (liq > 0 ? number(liq, feed.precision()) : '--');
      [...tabs.children].forEach((control, index) => control.classList.toggle('selected', (index === 0) === (action === 'add')));
    };
    for (const [name, label] of [['add', '增加'], ['remove', '减少']]) tabs.append(button(label, () => { action = name; repaint(); }));
    input.oninput = repaint; box.insertBefore(tabs, input.parentElement); box.append(maximum, estimate); repaint();
    this.action(box, '确认', () => this.api.post('futures/margin', { symbol, action, amount: input.value }));
  }
  tpsl(feed, position) {
    const symbol = position.symbol, box = this.open('止盈止损');
    const tp = this.decimalField(box, '止盈触发价', 'position-tp'), tpPnl = element('p'); box.append(tpPnl);
    const sl = this.decimalField(box, '止损触发价', 'position-sl'), slPnl = element('p'); box.append(slPnl);
    tp.value = position.tp || ''; sl.value = position.sl || '';
    const repaint = () => {
      for (const [input, label] of [[tp, tpPnl], [sl, slPnl]]) {
        const pnl = input.value ? positionMetrics(position, Number(input.value)).pnl : 0;
        label.textContent = '预计盈亏 ' + (pnl > 0 ? '+' : '') + money(pnl) + ' USDT'; label.className = pnl >= 0 ? 'up' : 'down';
      }
    };
    tp.oninput = sl.oninput = repaint; repaint();
    box.append(element('p', '按标记价格触发，触发后以市价全部平仓。', 'muted'));
    this.action(box, '确认', () => this.api.post('futures/tpsl', { symbol, tp: tp.value || null, sl: sl.value || null }));
  }
  closePosition(feed, position) {
    const box = this.open('平仓'), type = element('select'); type.name = 'close-type';
    for (const [value, label] of [['market', '市价'], ['limit', '限价']]) {
      const option = element('option', label); option.value = value; type.append(option);
    }
    box.append(type); const price = this.decimalField(box, '价格', 'close-price');
    const qty = this.decimalField(box, '数量', 'close-qty'); qty.value = position.qty;
    price.parentElement.hidden = true; type.onchange = () => { price.parentElement.hidden = type.value === 'market'; };
    this.action(box, '确认平仓', async () => {
      const data = { symbol: position.symbol, type: type.value, qty: qty.value, clientId: crypto.randomUUID() };
      if (type.value === 'limit') data.price = price.value;
      const result = await this.api.post('futures/close', data);
      this.toast(Number(result.order.filled) > 0 ? '平仓已成交，均价 ' + number(result.order.avgPrice, feed.precision()) : '委托已提交');
    });
  }
}
