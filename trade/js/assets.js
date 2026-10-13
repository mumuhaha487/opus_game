// 账号资产估值、现货与合约账户卡片及资金流水。
// 规格 9.9：估算总值、签到 / 划转 / 交易三按钮和登录入口。
// 估值使用浏览器 Gate.io 行情；余额始终来自已认证 Worker。
import { element, button, money, quantity, time } from './format.js';
import { futuresEquity } from './futures.js';
export function assetAmount(feed, asset, value) {
  if (asset === 'USDT') return money(value);
  const precision = feed.specs.get('spot:' + asset + '_USDT')?.value.amount_precision;
  return precision === undefined ? '--' : quantity(value, Number(precision));
}
export class Assets {
  constructor(panel, feed, api, modals) { this.panel = panel; this.feed = feed; this.api = api; this.modals = modals; }
  spotValue(state) {
    return state.spot.balances.reduce((total, funds) => {
      const last = funds.asset === 'USDT' ? 1 : Number(this.feed.tickers.spot.get(funds.asset + '_USDT')?.last || 0);
      return total + (Number(funds.free) + Number(funds.locked)) * last;
    }, 0);
  }
  refreshValues(state) {
    if (!state || !this.totalValue) return;
    const spot = this.spotValue(state), futures = futuresEquity(this.feed, state.futures).equity;
    this.totalValue.textContent = money(spot + futures) + ' USDT';
    this.spotAccountValue.textContent = money(spot) + ' USDT';
    this.futuresAccountValue.textContent = money(futures) + ' USDT';
    for (const entry of this.valuations) {
      const last = entry.asset === 'USDT' ? 1 : Number(this.feed.tickers.spot.get(entry.asset + '_USDT')?.last || 0);
      entry.cell.textContent = money(entry.total * last);
    }
  }
  render(state) {
    const panel = this.panel;
    const precisions = state?.spot.balances.map(funds => this.feed.specs.get('spot:' + funds.asset + '_USDT')?.value.amount_precision);
    const signature = JSON.stringify([this.api.generation, state?.spot, state?.futures, state?.recent.ledger, precisions]);
    if (signature === this.signature) { this.refreshValues(state); return; }
    this.signature = signature;
    const ledgerSignature = JSON.stringify([this.api.generation, state?.recent.ledger]);
    if (ledgerSignature !== this.ledgerSignature) {
      this.ledgerSignature = ledgerSignature;
      if (this.ledgerElement && this.ledgerControl) this.ledgerElement.replaceChildren(this.ledgerControl);
    }
    if (!state) {
      this.totalValue = null;
      const card = element('div', '登录后领取每日签到奖励', 'asset-login');
      card.append(button('登录', () => this.modals.login(), 'primary')); panel.replaceChildren(card); return;
    }
    const futures = futuresEquity(this.feed, state.futures).equity;
    const spot = this.spotValue(state), header = element('div', '', 'asset-total');
    header.append(element('div', '估算总值', 'muted'), element('b', money(spot + futures) + ' USDT'));
    this.totalValue = header.lastChild;
    const actions = element('div', '', 'asset-actions'); actions.append(button('签到', () => this.modals.checkin(), 'primary'),
      button('划转', () => this.modals.transfer(), 'secondary'),
      button('交易', () => { location.hash = '#/spot/' + this.feed.symbol; }, 'secondary'));
    const accounts = element('div', '', 'asset-accounts');
    for (const [name, value] of [['现货账户', spot], ['合约账户', futures]]) {
      const card = element('div', '', 'asset-account'); card.append(element('div', name, 'muted'), element('b', money(value) + ' USDT'));
      accounts.append(card);
    }
    this.spotAccountValue = accounts.children[0].lastChild; this.futuresAccountValue = accounts.children[1].lastChild;
    const table = element('table'), head = element('tr');
    for (const name of ['币种', '总额', '可用', '冻结', '估值(USDT)', '操作']) head.append(element('th', name));
    table.append(head);
    this.valuations = [];
    for (const funds of state.spot.balances) {
      const total = Number(funds.free) + Number(funds.locked), row = element('tr');
      const last = funds.asset === 'USDT' ? 1 : Number(this.feed.tickers.spot.get(funds.asset + '_USDT')?.last || 0);
      const amount = value => assetAmount(this.feed, funds.asset, value);
      for (const value of [funds.asset, amount(total), amount(funds.free), amount(funds.locked), money(total * last)]) {
        row.append(element('td', value));
      }
      this.valuations.push({ asset: funds.asset, total, cell: row.lastChild });
      const action = element('td'); action.append(button('交易', () => {
        location.hash = '#/spot/' + (funds.asset === 'USDT' ? 'BTC' : funds.asset) + '_USDT';
      }, 'accent')); row.append(action); table.append(row);
    }
    const list = element('div', '', 'asset-list'); list.append(table);
    panel.replaceChildren(header, actions, accounts, list, this.ledgerView());
  }
  ledgerView() {
    const ledger = this.ledgerElement || element('div', '', 'asset-ledger');
    if (!this.ledgerElement) {
      this.ledgerControl = button('资金流水', async () => {
      const generation = this.api.generation;
      try {
        const histories = await Promise.all([this.api.history('ledger', 'spot'), this.api.history('ledger', 'futures')]);
        if (generation !== this.api.generation || ledger !== this.ledgerElement) return;
        const rows = histories.flat().sort((left, right) => right.t - left.t), ledgerTable = element('table');
        const headings = element('tr');
        for (const label of ['日期', '类型', '币种', '数量', '备注']) headings.append(element('th', label));
        ledgerTable.append(headings);
        for (const entry of rows) {
          const row = element('tr');
          for (const value of [time(entry.t, true), entry.note, entry.asset, entry.amount, entry.note]) row.append(element('td', value));
          ledgerTable.append(row);
        }
        ledger.replaceChildren(ledgerTable);
      } catch (error) { if (generation === this.api.generation) this.modals.error(error); }
      }, 'accent'); ledger.append(this.ledgerControl);
    }
    this.ledgerElement = ledger;
    return ledger;
  }
}
