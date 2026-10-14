// ACCOUNT §2.3：账户抽屉与交易弹窗独立，内部 Key 对话框沿用共享生命周期。
import { GameKeys } from '../../hub/keys-ui.js';
import { element, button } from './format.js';
import { segment } from './ui.js';
export class AccountDrawer {
  constructor(api, modals, wallet) {
    this.api = api; this.modals = modals; this.wallet = wallet;
    this.dialog = element('dialog', '', 'account-drawer'); this.dialog.setAttribute('aria-label', '账户');
    document.body.append(this.dialog);
    this.dialog.addEventListener('click', e => { if (e.target === this.dialog) this.dialog.close(); });
    this.dialog.addEventListener('close', () => {
      this.keys?.destroy(); this.keys = null;
      (this.trigger?.isConnected ? this.trigger : document.querySelector(this.returnSelector))?.focus();
    });
    GameAccount.onProfileChange(() => {
      if (this.dialog.open) this.render();
    });
  }
  open(keys = false) {
    if (this.modals.locked) return;
    this.trigger = document.activeElement;
    this.returnSelector = this.trigger?.dataset.route === 'api' ? '#desktop-nav [data-route="api"]'
      : this.trigger?.closest('.user-menu') ? '.user-menu summary' : '.mobile-account';
    this.render(); this.dialog.showModal();
    if (keys) this.keySection?.scrollIntoView({ block: 'start' });
  }
  render() {
    this.keys?.destroy(); this.keys = null; this.dialog.replaceChildren(); this.keySection = null;
    const content = element('div', '', 'account-drawer-in'), heading = element('div', '', 'account-heading');
    heading.append(element('h2', '账户'), button('×', () => this.dialog.close()));
    heading.lastChild.setAttribute('aria-label', '关闭账户'); content.append(heading); this.dialog.append(content);
    const profile = GameAccount.profile();
    if (!profile) {
      content.append(element('p', '登录后可创建 API 密钥，让 AI 代你查询或交易', 'muted'),
        button('登录', () => { this.dialog.close(); this.modals.login(); }, 'primary'),
        button('注册', () => { this.dialog.close(); this.modals.login(true); }, 'secondary'));
      return;
    }
    const identity = element('section', '', 'account-card account-identity');
    const avatar = element('span', profile.name[0].toUpperCase(), 'account-avatar'), who = element('div');
    who.append(element('b', profile.name), element('p', 'GAME.INC.RE 账号', 'muted'));
    identity.append(avatar, who, button('退出登录', async () => {
      try { await GameAccount.logout(); this.api.accountChanged(); this.render(); } catch (e) { this.modals.error(e); }
    })); content.append(identity);
    const currency = element('section', '', 'account-card'); currency.append(element('h3', '显示货币'));
    currency.append(segment([['CNY', 'CNY'], ['USD', 'USD']], value => this.wallet.select(value), this.wallet.currency || 'USD'));
    content.append(currency);
    this.keySection = element('section', '', 'account-card'); content.append(this.keySection);
    this.keys = GameKeys.mount(this.keySection, { project: 'exchange', compact: true });
    const links = element('div', '', 'account-links');
    for (const [label, href] of [['在主页管理全部密钥 →', '/developer/#keys'], ['返回主页', '/']]) {
      const a = element('a', label); a.href = href; links.append(a);
    }
    content.append(links);
  }
}
