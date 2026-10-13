// 登录、每日签到、账户划转和最多三条 Toast。
// 规格 9.10：固定 token、尺寸、逐字文案，Esc / 遮罩关闭。
// GameAccount 负责认证，密码只在本次提交中使用。
import { element, button, money, number } from './format.js';
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
}
