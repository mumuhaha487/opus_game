// DESIGN §4.8、PLATFORM §2.3：四账户卡片、原生单位及显示货币估值；余额来自服务端。
import { element, button, money, quantity, time } from './format.js';
import { title, segment, table } from './ui.js';
import { ACCOUNTS, availableFunds, valuations, totalValue } from './wallet.js';
import { positionMetrics } from './futures.js';
export function assetAmount(feed, asset, value) {
  if (asset === 'USDT') return money(value);
  const precision = feed.specs.get('spot:' + asset + '_USDT')?.value.amount_precision;
  return precision === undefined ? '--' : quantity(value, Number(precision));
}
export class Assets {
  constructor(panel, feed, api, modals, ashare, wallet, navigate) {
    Object.assign(this, { panel, feed, api, modals, ashare, wallet, navigate, tab: 'ashare' });
    this.cards = element('div', '', 'asset-summary'); this.list = element('section', '', 'panel asset-list');
    this.tabs = segment([['ashare', 'A 股持仓'], ['spot', '加密现货'], ['futures', '合约仓位'], ['ledger', '资金流水']], tab => {
      this.tab = tab; this.ledgerLoaded = false; this.render(api.state); if (tab === 'ledger') this.loadLedger();
    });
    this.body = element('div'); this.list.append(this.tabs, this.body); panel.replaceChildren(this.cards, this.list);
  }
  render(state) {
    const values = valuations(state, this.feed, this.ashare), total = totalValue(values, this.wallet);
    const totalCard = element('section', '', 'panel asset-total');
    totalCard.append(title('WALLET', '总资产'), element('b', this.wallet.display(total, this.wallet.currency), 'wallet-total'));
    const currency = segment([['CNY', 'CNY'], ['USD', 'USD']], value => this.wallet.select(value), this.wallet.currency || 'USD');
    currency.classList.add('asset-currency'); totalCard.append(currency);
    if (!state) totalCard.append(element('p', '登录后查看资产', 'muted'), button('登录', () => this.modals.login(), 'primary'));
    const cards = ACCOUNTS.map(([id, name, unit]) => {
      const card = element('section', '', 'panel asset-account');
      card.append(title(id.toUpperCase(), name), element('b', money(state ? availableFunds(state, id) : '0') + ' ' + unit),
        element('small', this.wallet.display(values[id], id === 'ashare' ? 'CNY' : 'USD'), 'muted'));
      const actions = element('div', '', 'card-actions');
      actions.append(button('划转', () => this.modals.transfer(id, id === 'wallet' ? 'ashare' : 'wallet'), 'secondary'),
        button('交易', () => this.navigate(id === 'ashare' ? '#/ashare'
          : id === 'futures' ? '#/futures/' + this.feed.symbol : '#/crypto'), 'secondary')); card.append(actions); return card;
    });
    this.cards.replaceChildren(totalCard, ...cards);
    if (!state) { this.body.replaceChildren(element('p', '登录后查看资产', 'muted')); return; }
    if (this.tab === 'ashare') {
      this.body.className = 'cn-market';
      this.body.replaceChildren(table(['名称', '总数', '可卖（T+1）', '成本', '现价', '盈亏', '操作'],
        state.ashare.holdings.map(row => {
          const last = this.ashare.quotes[row.code]?.last;
          return [row.name, row.qty, row.available, money(row.cost), money(last),
            money(last == null ? null : (last - +row.cost) * +row.qty), this.trade('#/stock/' + row.code)];
        })));
    } else if (this.tab === 'spot') {
      this.body.className = '';
      this.body.replaceChildren(table(['币种', '总额', '可用', '冻结', '估值 (USDT)', '操作'], state.spot.balances.map(row => {
        const total = +row.free + +row.locked, last = row.asset === 'USDT' ? 1 : this.feed.tickers.spot.get(row.asset + '_USDT')?.last;
        return [row.asset, quantity(total), quantity(row.free), quantity(row.locked), money(last == null ? null : total * +last),
          this.trade('#/spot/' + (row.asset === 'USDT' ? 'BTC' : row.asset) + '_USDT')];
      })));
    } else if (this.tab === 'futures') {
      this.body.className = '';
      this.body.replaceChildren(table(['合约', '方向', '数量', '开仓价', '保证金', '盈亏', '操作'], state.futures.positions.map(row => {
        const mark = this.feed.tickers.futures.get(row.symbol)?.mark_price;
        return [row.symbol, row.side === 'long' ? '多' : '空', quantity(row.qty), money(row.entry), money(row.margin),
          money(mark ? positionMetrics(row, +mark).pnl : null), this.trade('#/futures/' + row.symbol)];
      })));
    } else if (!this.ledgerLoaded) this.body.replaceChildren(element('p', '读取资金流水…', 'muted'));
  }
  trade(hash) { return button('交易', () => this.navigate(hash), 'accent'); }
  async loadLedger() {
    const generation = this.api.generation;
    try {
      const rows = (await Promise.all(ACCOUNTS.map(([id]) => this.api.history('ledger', id))))
        .flat().sort((a, b) => b.t - a.t);
      if (generation !== this.api.generation || this.tab !== 'ledger') return;
      this.ledgerLoaded = true;
      this.body.replaceChildren(table(['日期', '类型', '账户', '单位', '数量', '备注'],
        rows.map(row => [time(row.t, true), row.kind, row.market, row.asset, row.amount, row.note])));
    } catch (error) { this.modals.error(error); }
  }
}
