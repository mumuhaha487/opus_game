// 当前委托、完整历史、成交与账户资产表格。
// 规格 9.3、9.9：桌面 40px 表格行，手机当前委托卡片。
// 撤单与全部撤单通过已登录交易 API 执行，动态内容使用 textContent。
import { element, button, price, quantity, money, time, icon } from './format.js';
import { assetAmount } from './assets.js';
const STATUS = { new: '未成交', triggered: '已触发', filled: '已成交', partial_canceled: '部分成交', canceled: '已撤销' };
const TYPE = { market: '市价', limit: '限价', stop_limit: '止盈止损' };
export class Orders {
  constructor(panel, feed, api, modals) {
    this.feed = feed; this.api = api; this.modals = modals; this.tab = 'open'; this.panel = panel;
    this.tabs = element('div', '', 'orders-tabs'); this.controls = element('div', '', 'order-controls');
    const hideLabel = element('label', '隐藏其他交易对'); this.hideOthers = element('input'); this.hideOthers.type = 'checkbox';
    this.hideOthers.onchange = () => { this.signature = ''; feed.dirty = true; }; hideLabel.prepend(this.hideOthers);
    this.controls.append(hideLabel, button('全部撤销', () => this.cancelAll()));
    this.body = element('div', '', 'orders-body'); panel.append(this.tabs, this.controls, this.body);
  }
  async cancel(id) {
    try { await this.api.post('spot/cancel', { id }); } catch (error) { this.modals.error(error); }
  }
  async cancelAll() {
    try { await this.api.post('spot/cancel-all', this.hideOthers.checked ? { symbol: this.feed.symbol } : {}); }
    catch (error) { this.modals.error(error); }
  }
  tabsFor(state) {
    const count = (state?.openOrders || []).filter(order => order.market === this.feed.market).length;
    return this.feed.market === 'spot'
      ? [['open', `当前委托(${count})`], ['orders', '历史委托'], ['trades', '历史成交'], ['assets', '资产']]
      : [['positions', '仓位(0)'], ['open', `当前委托(${count})`], ['orders', '历史委托'], ['trades', '历史成交'], ['ledger', '资金流水']];
  }
  async render(state) {
    const generation = this.api.generation;
    const signature = JSON.stringify([this.feed.market, this.feed.symbol, this.tab, this.hideOthers.checked,
      state?.openOrders, state?.recent, state?.spot,
      state?.spot.balances.map(funds => this.feed.specs.get('spot:' + funds.asset + '_USDT')?.value.amount_precision)]);
    if (signature === this.signature) return; this.signature = signature;
    const tabs = this.tabsFor(state);
    if (!tabs.some(([name]) => name === this.tab)) this.tab = tabs[0][0];
    this.tabs.replaceChildren(...tabs.map(([name, label]) => button(label, () => {
      this.tab = name; this.signature = ''; this.feed.dirty = true;
    }, this.tab === name ? 'selected' : '')));
    this.controls.hidden = this.tab !== 'open' || !state || this.feed.market !== 'spot';
    if (!state) {
      this.body.replaceChildren(element('div', '登录后查看委托与资产', 'empty-message'),
        button('登录', () => this.modals.login(), 'primary empty-login')); return;
    }
    let rows;
    if (this.tab === 'open') rows = state.openOrders.filter(order => order.market === this.feed.market);
    else if (this.tab === 'assets') rows = state.spot.balances;
    else if (this.tab === 'positions') rows = state.futures.positions;
    else {
      try { rows = await this.api.history(this.tab, this.feed.market); }
      catch (error) { if (generation === this.api.generation) this.modals.error(error); return; }
      if (signature !== this.signature || generation !== this.api.generation) return;
    }
    if (this.hideOthers.checked && ['open', 'orders', 'trades'].includes(this.tab)) {
      rows = rows.filter(row => row.symbol === this.feed.symbol);
    }
    if (!rows.length) { this.empty(); return; }
    if (this.feed.mobile() && this.tab === 'open') { this.cards(rows); return; }
    const table = element('table'), header = element('tr'), head = element('thead'), body = element('tbody');
    for (const label of this.headings()) header.append(element('th', label)); head.append(header); table.append(head, body);
    for (const record of rows) {
      const row = element('tr'); for (const value of this.values(record)) {
        const cell = element('td'); cell.append(value instanceof Node ? value : document.createTextNode(String(value ?? '--')));
        row.append(cell);
      }
      body.append(row);
    }
    this.body.replaceChildren(table);
  }
  empty() {
    const placeholder = element('div', '', 'empty-message');
    placeholder.append(icon([['path', { d: 'M7 3h7l4 4v14H7zM14 3v5h4M10 12h5M10 16h5' }]], 48),
      element('div', '暂无记录', 'dim')); this.body.replaceChildren(placeholder);
  }
  headings() {
    if (this.tab === 'open') return ['日期', '交易对', '类型', '方向', '价格', '数量', '已成交', '成交额', '触发条件', '操作'];
    if (this.tab === 'orders') return ['日期', '交易对', '类型', '方向', '平均价', '价格', '已成交', '数量', '成交额', '状态'];
    if (this.tab === 'trades') return ['时间', '交易对', '方向', '价格', '数量', '手续费', '成交额', '角色'];
    if (this.tab === 'assets') return ['币种', '总额', '可用', '冻结', '估值(USDT)', '操作'];
    return ['日期', '类型', '币种', '数量', '备注'];
  }
  values(record) {
    const direction = element('span', record.side === 'buy' ? '买入' : '卖出', record.side === 'buy' ? 'up' : 'down');
    const specification = this.feed.specs.get(this.feed.market + ':' + record.symbol)?.value;
    const precision = Number(specification?.precision ?? this.feed.precision());
    const qtyDecimals = Number(specification?.amount_precision ?? this.feed.quantityPrecision());
    if (this.tab === 'trades') return [time(record.t, true), record.symbol.replace('_', '/'), direction,
      price(record.price, precision), quantity(record.qty, qtyDecimals), quantity(record.fee, 8) + ' ' + record.feeAsset,
      money(record.quote), record.role === 'maker' ? 'Maker' : 'Taker'];
    if (this.tab === 'assets') {
      const total = Number(record.free) + Number(record.locked);
      const latest = record.asset === 'USDT' ? 1 : Number(this.feed.tickers.spot.get(record.asset + '_USDT')?.last || 0);
      const amount = value => assetAmount(this.feed, record.asset, value);
      return [record.asset, amount(total), amount(record.free), amount(record.locked), money(total * latest),
        button('交易', () => { location.hash = '#/spot/' + (record.asset === 'USDT' ? 'BTC' : record.asset) + '_USDT'; }, 'accent')];
    }
    if (this.tab === 'ledger') return [time(record.t, true), record.note, record.asset, record.amount, record.note];
    const common = [time(record.createdAt, true), record.symbol.replace('_', '/'), TYPE[record.type], direction];
    if (this.tab === 'orders') return [...common, price(record.avgPrice, precision), price(record.price, precision),
      quantity(record.filled, qtyDecimals), quantity(record.qty, qtyDecimals), money(record.executedQuote), STATUS[record.status]];
    return [...common, record.type === 'market' ? '市场最优价格' : price(record.price, precision),
      quantity(record.qty, qtyDecimals), quantity(record.filled, qtyDecimals), money(record.executedQuote || '0'),
      record.stopPrice ? (record.stopDir === 'up' ? '≥ ' : '≤ ') + price(record.stopPrice, precision) : '--',
      button('撤单', () => this.cancel(record.id), 'accent')];
  }
  cards(rows) {
    this.body.replaceChildren(...rows.map(order => {
      const specification = this.feed.specs.get('spot:' + order.symbol)?.value;
      const precision = Number(specification?.precision ?? this.feed.precision());
      const qtyDecimals = Number(specification?.amount_precision ?? this.feed.quantityPrecision());
      const card = element('div', '', 'order-card');
      card.append(element('div', order.symbol.replace('_', '/') + ' ' + (order.side === 'buy' ? '买入' : '卖出')
        + ' ' + TYPE[order.type], order.side === 'buy' ? 'up' : 'down'),
      element('div', '价格 ' + price(order.price, precision)),
      element('div', '数量 ' + quantity(order.qty, qtyDecimals)),
      element('div', '已成交 ' + quantity(order.filled, qtyDecimals)),
      button('撤单', () => this.cancel(order.id), 'accent')); return card;
    }));
  }
}
