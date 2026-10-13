// 当前委托、完整历史、成交与账户资产表格。
// 规格 9.3、9.9：桌面 40px 表格行，手机当前委托卡片。
// 撤单与全部撤单通过已登录交易 API 执行，动态内容使用 textContent。
import { element, button, price, quantity, money, time, icon } from './format.js';
import { assetAmount } from './assets.js';
import { positionMetrics, markFor } from './futures.js';
const STATUS = { new: '未成交', triggered: '已触发', filled: '已成交', partial_canceled: '部分成交', canceled: '已撤销' };
const TYPE = { market: '市价', limit: '限价', stop_limit: '止盈止损', stop_market: '止盈止损' };
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
    try { await this.api.post(this.feed.market + '/cancel', { id }); } catch (error) { this.modals.error(error); }
  }
  async cancelAll() {
    try { await this.api.post('spot/cancel-all', this.hideOthers.checked ? { symbol: this.feed.symbol } : {}); }
    catch (error) { this.modals.error(error); }
  }
  tabsFor(state) {
    const count = (state?.openOrders || []).filter(order => order.market === this.feed.market).length;
    return this.feed.market === 'spot'
      ? [['open', `当前委托(${count})`], ['orders', '历史委托'], ['trades', '历史成交'], ['assets', '资产']]
      : [['positions', `仓位(${state?.futures.positions.length || 0})`], ['open', `当前委托(${count})`],
        ['orders', '历史委托'], ['trades', '历史成交'], ['ledger', '资金流水']];
  }
  async render(state) {
    // DESIGN §4.6：未登录及空记录的 dock 仅120px。
    this.panel.classList.toggle('empty-dock', !state);
    this.panel.closest('.trade')?.classList.toggle('empty-dock', !state);
    const generation = this.api.generation;
    const signature = JSON.stringify([this.feed.market, this.feed.symbol, this.tab, this.hideOthers.checked,
      state?.openOrders, state?.recent, state?.spot, state?.futures,
      state?.spot.balances.map(funds => this.feed.specs.get('spot:' + funds.asset + '_USDT')?.value.amount_precision)]);
    if (signature === this.signature) { if (this.tab === 'positions') this.refreshPositions(state); return; }
    this.signature = signature;
    const tabs = this.tabsFor(state);
    if (!tabs.some(([name]) => name === this.tab)) this.tab = tabs[0][0];
    const tabKey = tabs.map(([name]) => name).join(':');
    if (tabKey !== this.tabKey) {
      this.tabKey = tabKey; this.tabs.replaceChildren(...tabs.map(([name, label]) => button(label, () => {
        this.tab = name; this.signature = ''; this.feed.dirty = true;
      })));
    }
    tabs.forEach(([name, label], index) => {
      this.tabs.children[index].textContent = label; this.tabs.children[index].classList.toggle('selected', this.tab === name);
    });
    this.controls.hidden = this.tab !== 'open' || !state || this.feed.market !== 'spot';
    if (!state) {
      this.body.replaceChildren(element('div', '登录后查看委托与持仓', 'empty-message'),
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
    if (this.feed.mobile() && this.tab === 'positions') { this.positionCards(rows); return; }
    if (this.feed.mobile() && this.tab === 'open') { this.cards(rows); return; }
    const table = element('table'), header = element('tr'), head = element('thead'), body = element('tbody');
    for (const label of this.headings()) header.append(element('th', label)); head.append(header); table.append(head, body);
    for (const record of rows) {
      const row = element('tr'); if (this.tab === 'positions') row.dataset.symbol = record.symbol;
      for (const value of this.values(record)) {
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
    if (this.tab === 'positions') return ['合约', '方向', '杠杆', '数量', '开仓价格', '标记价格', '强平价格',
      '保证金', '保证金率', '未实现盈亏(回报率)', '止盈/止损', '操作'];
    if (this.tab === 'open') return ['日期', '交易对', '类型', '方向', '价格', '数量', '已成交', '成交额', '触发条件', '操作'];
    if (this.tab === 'orders') return ['日期', '交易对', '类型', '方向', '平均价', '价格', '已成交', '数量', '成交额', '状态'];
    if (this.tab === 'trades') return ['时间', '交易对', '方向', '价格', '数量', '手续费', '成交额', '角色'];
    if (this.tab === 'assets') return ['币种', '总额', '可用', '冻结', '估值(USDT)', '操作'];
    return ['日期', '类型', '币种', '数量', '备注'];
  }
  values(record) {
    if (this.tab === 'positions') return this.positionValues(record);
    const direction = element('span', record.side === 'buy' ? '买入' : '卖出', record.side === 'buy' ? 'up' : 'down');
    const specification = this.feed.specs.get(this.feed.market + ':' + record.symbol)?.value;
    const precision = this.feed.market === 'spot' ? Number(specification?.precision ?? this.feed.precision())
      : (String(specification?.order_price_round || '0.1').split('.')[1] || '').length;
    const qtyDecimals = this.feed.market === 'spot' ? Number(specification?.amount_precision ?? this.feed.quantityPrecision())
      : (String(specification?.quanto_multiplier || '0.0001').split('.')[1] || '').length;
    if (this.tab === 'trades') return [time(record.t, true), record.symbol.replace('_', '/'), direction,
      price(record.price, precision), quantity(record.qty, qtyDecimals), quantity(record.fee, 8) + ' ' + record.feeAsset,
      money(record.quote), record.role === 'liquidation' ? '强平' : record.role === 'maker' ? 'Maker' : 'Taker'];
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
      const specification = this.feed.specs.get(this.feed.market + ':' + order.symbol)?.value;
      const precision = this.feed.market === 'spot' ? Number(specification?.precision ?? this.feed.precision())
        : (String(specification?.order_price_round || '0.1').split('.')[1] || '').length;
      const qtyDecimals = this.feed.market === 'spot' ? Number(specification?.amount_precision ?? this.feed.quantityPrecision())
        : (String(specification?.quanto_multiplier || '0.0001').split('.')[1] || '').length;
      const card = element('div', '', 'order-card');
      card.append(element('div', order.symbol.replace('_', '/') + ' ' + (order.side === 'buy' ? '买入' : '卖出')
        + ' ' + TYPE[order.type], order.side === 'buy' ? 'up' : 'down'),
      element('div', '价格 ' + price(order.price, precision)),
      element('div', '数量 ' + quantity(order.qty, qtyDecimals)),
      element('div', '已成交 ' + quantity(order.filled, qtyDecimals)),
      button('撤单', () => this.cancel(order.id), 'accent')); return card;
    }));
  }
  positionActions(position) {
    if (this.controlsGeneration !== this.api.generation) {
      this.controlsGeneration = this.api.generation; this.positionControls = new Map();
    }
    if (this.positionControls.has(position.symbol)) return this.positionControls.get(position.symbol);
    const actions = element('div', '', 'position-actions');
    const current = () => this.api.state?.futures.positions.find(entry => entry.symbol === position.symbol) || position;
    actions.append(button('调整保证金', () => this.modals.margin(this.feed, current()), 'accent'),
      button('止盈止损', () => this.modals.tpsl(this.feed, current()), 'accent'),
      button('平仓', () => this.modals.closePosition(this.feed, current()), 'accent'));
    this.positionControls.set(position.symbol, actions); return actions;
  }
  positionValues(position) {
    const spec = this.feed.specs.get('futures:' + position.symbol)?.value;
    const precision = (String(spec?.order_price_round || '0.1').split('.')[1] || '').length;
    const qtyPrecision = (String(spec?.quanto_multiplier || '0.0001').split('.')[1] || '').length;
    const mark = markFor(this.feed, position.symbol), metrics = positionMetrics(position, mark);
    const profit = element('span', money(metrics.pnl) + ' USDT (' + metrics.roe.toFixed(2) + '%)', metrics.pnl >= 0 ? 'up' : 'down');
    const liq = element('span', metrics.liq > 0 ? price(metrics.liq, precision) : '--', 'futures-liq');
    return [position.symbol.replace('_', '/'), element('span', position.side === 'long' ? '多' : '空',
      position.side === 'long' ? 'up' : 'down'), position.leverage + 'x', quantity(position.qty, qtyPrecision),
    price(position.entry, precision), mark ? price(mark, precision) : '--', liq, money(position.margin) + ' USDT',
    metrics.ratio.toFixed(2) + '%', profit, price(position.tp, precision) + ' / ' + price(position.sl, precision),
    this.positionActions(position)];
  }
  positionCards(rows) {
    this.body.replaceChildren(...rows.map(position => {
      const values = this.positionValues(position), card = element('div', '', 'position-card'); card.dataset.symbol = position.symbol;
      card.append(element('div', position.symbol.replace('_', '/') + (position.side === 'long' ? ' 多 ' : ' 空 ')
        + position.leverage + 'x', position.side === 'long' ? 'up' : 'down'), values[9]);
      const data = element('div', '', 'position-data');
      for (const [label, index] of [['数量', 3], ['开仓价格', 4], ['标记价格', 5], ['强平价格', 6], ['保证金', 7], ['保证金率', 8]]) {
        const cell = element('div'); cell.append(element('span', label, 'muted'));
        cell.append(values[index] instanceof Node ? values[index] : element('span', values[index])); data.append(cell);
      }
      card.append(data, this.positionActions(position)); return card;
    }));
  }
  refreshPositions(state) {
    for (const position of state?.futures.positions || []) {
      const values = this.positionValues(position);
      const row = [...this.body.querySelectorAll('tr[data-symbol]')].find(node => node.dataset.symbol === position.symbol);
      if (row) values.slice(0, -1).forEach((value, index) => {
        row.children[index].replaceChildren(value instanceof Node ? value : document.createTextNode(String(value)));
      });
      const card = [...this.body.querySelectorAll('.position-card')].find(node => node.dataset.symbol === position.symbol);
      if (card) {
        card.children[1].replaceWith(values[9]);
        [3, 4, 5, 6, 7, 8].forEach((valueIndex, index) => {
          const cell = card.querySelector('.position-data').children[index], value = values[valueIndex];
          cell.lastChild.replaceWith(value instanceof Node ? value : element('span', value));
        });
      }
    }
  }
}
