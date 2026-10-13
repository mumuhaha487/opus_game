// DESIGN §4.6/§8、ASHARE §2/§4：五档盘口、下单、T+1持仓和当日委托；服务端执行权威规则。
import { element, button, money, price, quantity, large, direction, time } from '../format.js';
import { title, segment, change, badge, table } from '../ui.js';
import { AshareChart } from './chart.js';
const STATUS = { new: '未成交', filled: '已成交', partial_canceled: '部分成交', canceled: '已撤销',
  expired: '已撤销（收盘未成交）' };
export function estimateFees(amount, side) {
  const ceil = value => Math.ceil(value * 100 - 1e-8) / 100;
  const commission = amount > 0 ? Math.max(5, ceil(amount * 0.00025)) : 0;
  const transferFee = ceil(amount * 0.00001), stamp = side === 'sell' ? ceil(amount * 0.0005) : 0;
  return { commission, transferFee, stamp, total: commission + transferFee + stamp };
}
export class Stock {
  constructor(panel, feed, api, modals, watch) {
    Object.assign(this, { panel, feed, api, modals, watch, side: 'buy', type: 'limit', tab: 'orders' });
    this.head = element('section', '', 'panel bar stock-head'); this.chartPanel = element('section', '', 'panel chart');
    this.book = element('section', '', 'panel book stock-book'); this.ticket = element('section', '', 'panel form stock-ticket');
    this.dock = element('section', '', 'panel orders stock-dock');
    panel.append(this.head, this.chartPanel, this.book, this.ticket, this.dock);
    this.chart = new AshareChart(this.chartPanel, feed); this.buildTicket();
    new ResizeObserver(() => this.fitStatistics()).observe(this.head);
    this.bookTabs = segment([['book', '盘口'], ['trades', '逐笔']], mode => {
      this.bookMode = mode; this.book.classList.toggle('stock-book-trades', mode === 'trades');
    }); this.bookTabs.classList.add('stock-book-tabs');
    this.actions = element('div', '', 'stock-mobile-actions');
    this.actions.append(button('买入', () => this.openTicket('buy'), 'buy-button'),
      button('卖出', () => this.openTicket('sell'), 'sell-button')); panel.append(this.actions);
    this.ticketClose = button('返回', () => this.ticket.classList.remove('sheet-open'), 'ticket-close');
    this.ticket.prepend(this.ticketClose);
    this.compact = segment([['chart', '图表'], ['book', '盘口']], tab => {
      this.panel.classList.toggle('compact-book', tab === 'book');
    }); this.compact.classList.add('compact-chart-tabs'); this.chartPanel.prepend(this.compact);
  }
  buildTicket() {
    this.sideTabs = segment([['buy', '买入'], ['sell', '卖出']], side => { this.side = side; this.renderTicket(); });
    this.sideTabs.classList.add('ticket-sides');
    this.types = segment([['limit', '限价'], ['market', '市价']], type => { this.type = type; this.renderTicket(); });
    this.types.classList.add('order-types'); this.ticket.append(this.sideTabs, this.types); this.fields = {};
    for (const [key, label, unit] of [['price', '价格', '¥'], ['qty', '数量', '股']]) {
      const field = element('div', '', 'field'), text = element('label', label), row = element('div', '', 'input-row');
      const input = element('input'); input.inputMode = 'decimal'; input.autocomplete = 'off'; input.name = 'ashare-' + key;
      input.id = 'ashare-' + key; text.htmlFor = input.id; input.oninput = () => this.renderTicket();
      const adjust = sign => {
        const step = key === 'price' ? 0.01 : this.feed.quotes[this.feed.code]?.type.includes('KCB') ? 1 : 100;
        input.value = key === 'price' ? Math.max(0, +input.value + sign * step).toFixed(2)
          : String(Math.max(0, +input.value + sign * step)); this.renderTicket();
      };
      row.append(input, element('span', unit, 'field-unit'), button('−', () => adjust(-1), 'stepper'),
        button('+', () => adjust(1), 'stepper')); field.append(text, row); this.ticket.append(field); this.fields[key] = input;
    }
    this.hands = element('small', '', 'muted'); this.ticket.append(this.hands);
    this.ratios = segment([[25, '25%'], [50, '50%'], [75, '75%'], [100, '100%']], ratio => {
      const maximum = this.maximum(), star = this.feed.quotes[this.feed.code]?.type.includes('KCB');
      const desired = Math.floor(maximum * ratio / 100);
      this.fields.qty.value = String(this.side === 'buy' && star ? desired >= 200 ? desired : 0
        : this.side === 'sell' && ratio === 100 ? maximum : Math.floor(desired / 100) * 100);
      this.renderTicket();
    }, 0); this.ratios.classList.add('quick-ratios'); this.ticket.append(this.ratios);
    this.summary = element('div', '', 'ticket-summary'); this.submit = button('', () => this.order(), 'buy-button');
    this.register = button('没有账号？注册', () => this.modals.login(true), 'register-link');
    // DESIGN §6/§7：刷新只更新余额文字，保留用户正在点击的划转节点。
    this.balance = element('div', '', 'ticket-balance'); this.balanceValue = element('span');
    this.balance.append(this.balanceValue, button('划转', () => this.modals.transfer('wallet', 'ashare'), 'accent'));
    this.ticket.append(this.summary, this.submit, this.register, this.balance);
  }
  setCode(code) {
    if (this.code === code) return;
    this.code = code; this.fields.price.value = ''; this.fields.qty.value = ''; this.tab = 'orders'; this.chart.key = '';
  }
  openTicket(side) {
    this.side = side; this.ticket.classList.add('sheet-open'); this.renderTicket();
  }
  renderHead() {
    const quote = this.feed.quotes[this.code]; if (!quote) return;
    const identity = element('div', '', 'stock-identity'), name = element('div');
    const board = quote.type.includes('KCB') ? '科创板' : quote.type.includes('CYB') ? '创业板'
      : quote.type.startsWith('GP-A') ? this.code.startsWith('sh') ? '沪市主板' : '深市主板' : '指数';
    name.append(element('b', quote.name), element('small', this.code + ' · ' + board, 'muted'));
    identity.append(badge(quote.name, this.code, quote.type), name,
      button(this.watch.codes.includes(this.code) ? '★' : '☆', () => this.watch.toggle(this.code), 'star'));
    const latest = element('div', '', 'stock-price');
    latest.append(element('b', money(quote.last), 'latest-price ' + direction(quote.last - quote.prevClose)), change(quote.percent),
      element('small', (quote.change > 0 ? '+' : '') + money(quote.change)));
    const statistics = [['今开', quote.open], ['最高', quote.high], ['最低', quote.low], ['昨收', quote.prevClose],
      ['成交量（手）', quantity(quote.volume, 0)], ['成交额', large(quote.turnover * 10000)],
      ['换手率', money(quote.turnoverRate) + '%'], ['市盈率', money(quote.pe)], ['涨停', quote.limitUp], ['跌停', quote.limitDown]];
    const cells = statistics.map(([label, value]) => {
      const cell = element('div', '', 'bar-stat'); cell.append(element('span', label), element('b', String(value ?? '--'))); return cell;
    });
    const clock = this.feed.clock(), pill = element('span', quote.suspended ? '停牌' : clock.label, 'market-status ' + clock.status);
    const switcher = button('切换 ▾', () => {
      document.querySelector('#global-search').focus();
      if (this.feed.page === 'stock' && matchMedia('(max-width:767px), (max-height:499px)').matches) {
        history.replaceState(null, '', '#/ashare'); window.dispatchEvent(new HashChangeEvent('hashchange'));
      }
    });
    const stats = element('div', '', 'stock-statistics'); stats.append(...cells);
    this.head.replaceChildren(identity, latest, stats, pill, switcher); this.fitStatistics();
    if (!this.fields.price.value) this.fields.price.value = money(quote.last).replaceAll(',', '');
  }
  fitStatistics() {
    const stats = this.head.querySelector('.stock-statistics'); if (!stats || !stats.clientWidth) return;
    const cells = [...stats.children]; cells.forEach(cell => { cell.hidden = false; });
    for (let index = cells.length - 1; index >= 0 && stats.scrollWidth > stats.clientWidth; index--) cells[index].hidden = true;
  }
  renderBook() {
    const quote = this.feed.quotes[this.code];
    if (!quote) { this.book.replaceChildren(element('p', '行情连接中断，正在重试', 'muted')); return; }
    this.book.replaceChildren(this.bookTabs, title('ORDER BOOK', '五档盘口'));
    const maximum = Math.max(1, ...[...quote.asks, ...quote.bids].map(row => row[1]));
    const paint = (levels, side) => levels.forEach(([value, size], index) => {
      const row = button('', () => { this.fields.price.value = String(value); this.type = 'limit'; this.renderTicket(); }, 'stock-level');
      const depth = element('i'); depth.style.width = size / maximum * 100 + '%';
      depth.style.background = side === 'buy' ? 'var(--rise-bg)' : 'var(--fall-bg)';
      row.append(depth, element('span', (side === 'buy' ? '买 ' : '卖 ') + (side === 'buy' ? index + 1 : 5 - index), 'muted'),
        element('span', value ? money(value) : '--', direction(value - quote.prevClose)), element('span', quantity(size, 0)));
      this.book.append(row);
    });
    paint([...quote.asks].reverse(), 'sell');
    const middle = element('div', '', 'book-middle');
    middle.append(element('b', money(quote.last), direction(quote.last - quote.prevClose)), change(quote.percent));
    this.book.append(middle);
    paint(quote.bids, 'buy');
    const details = element('div', '', 'stock-details'); details.append(title('TRADES', '逐笔成交'));
    for (const row of this.feed.trades.slice(-12).reverse()) {
      const entry = element('div', '', 'stock-trade');
      entry.append(element('span', row.time), element('span', money(row.price), direction(row.price - quote.prevClose)),
        element('span', quantity(row.qty, 0)), element('span', row.side === 2 ? 'B' : row.side === 1 ? 'S' : '--',
          row.side === 2 ? 'up' : row.side === 1 ? 'down' : 'muted')); details.append(entry);
    }
    this.book.append(details);
  }
  orderPrice() { return this.type === 'market' ? this.feed.quotes[this.code]?.last || 0 : +this.fields.price.value; }
  holding() { return this.api.state?.ashare.holdings.find(row => row.code === this.code); }
  maximum() {
    if (this.side === 'sell') return +(this.holding()?.available || 0);
    const price = this.orderPrice(), cash = +(this.api.state?.ashare.cash.free || 0);
    return price ? Math.max(0, Math.floor((cash - 5) / (price * 1.00026))) : 0;
  }
  renderTicket() {
    const quote = this.feed.quotes[this.code], logged = this.api.logged(), value = this.orderPrice() * +this.fields.qty.value;
    const fees = estimateFees(value, this.side); this.fields.price.readOnly = this.type === 'market';
    [...this.sideTabs.children].forEach(control => control.classList.toggle('selected', control.dataset.value === this.side));
    [...this.types.children].forEach(control => control.classList.toggle('selected', control.dataset.value === this.type));
    this.hands.textContent = '= ' + quantity(Math.floor(+this.fields.qty.value / 100), 0) + ' 手';
    this.summary.hidden = !logged;
    this.summary.replaceChildren(...[['可用', this.side === 'buy' ? money(this.api.state?.ashare.cash.free || 0) + ' CNY'
      : (this.holding()?.available || '0') + ' 股'], ['预计金额', money(value) + ' CNY'], ['预计费用', money(fees.total) + ' CNY'],
      [this.side === 'buy' ? '可买' : '可卖', this.side === 'buy' ? Math.floor(this.maximum() / 100) + ' 手'
        : this.maximum() + ' 股（T+1）']].map(([label, text]) => {
      const row = element('div'); row.append(element('span', label), element('b', text)); return row;
    }));
    this.summary.children[2].title = '佣金 ' + money(fees.commission) + ' · 过户费 ' + money(fees.transferFee)
      + ' · 印花税 ' + money(fees.stamp);
    const index = quote && !quote.type.startsWith('GP-A');
    this.submit.textContent = index ? '指数仅供查看' : !logged ? '登录后交易' : this.busy ? '提交中…'
      : (this.side === 'buy' ? '买入 ' : '卖出 ') + (quote?.name || this.code);
    this.submit.className = !logged ? 'primary' : this.side === 'buy' ? 'buy-button' : 'sell-button';
    this.submit.disabled = index || this.busy || !quote; this.register.hidden = logged || index;
    this.balanceValue.textContent = 'A 股账户 · ' + money(this.api.state?.ashare.cash.free || 0) + ' CNY';
  }
  async order() {
    if (!this.api.logged()) { this.modals.login(); return; } if (this.busy) return;
    const data = { code: this.code, side: this.side, type: this.type, qty: this.fields.qty.value };
    if (this.type === 'limit') data.price = this.fields.price.value;
    if (!/^[1-9]\d{0,14}$/.test(data.qty)) { this.modals.toast('请输入股数', true); return; }
    const signature = JSON.stringify(data); if (signature !== this.lastSignature) this.clientId = crypto.randomUUID();
    this.lastSignature = signature; data.clientId = this.clientId; this.busy = true; this.renderTicket();
    try {
      const result = await this.api.post('ashare/order', data);
      this.modals.toast(+result.order.filled ? '已成交 ' + result.order.filled + ' 股，均价 ' + money(result.order.avgPrice)
        : this.feed.clock().status === 'open' ? '委托已提交' : '预埋单已提交'); this.lastSignature = null;
    } catch (error) { this.modals.error(error); } finally { this.busy = false; this.renderTicket(); }
  }
  renderDock(state) {
    if (!state) {
      this.dock.classList.add('empty-dock'); this.panel.classList.add('empty-dock');
      this.dock.replaceChildren(element('div', '登录后查看委托与持仓', 'muted'),
        button('登录', () => this.modals.login(), 'primary')); return;
    }
    const open = state.openOrders.filter(row => row.market === 'ashare');
    const tabs = segment([['orders', '当日委托 (' + open.length + ')'], ['holdings', '持仓 (' + state.ashare.holdings.length + ')'],
      ['trades', '当日成交'], ['history', '历史委托'], ['ledger', '资金流水']], tab => {
      this.tab = tab; this.historyRows = null;
      if (['history', 'ledger'].includes(tab)) this.api.history(tab === 'history' ? 'orders' : 'ledger', 'ashare')
        .then(rows => { this.historyRows = rows; this.renderDock(this.api.state); }).catch(error => this.modals.error(error));
      this.renderDock(this.api.state);
    }, this.tab);
    const today = new Date(state.serverTime + 28800000).toISOString().slice(0, 10);
    const isToday = value => new Date(value + 28800000).toISOString().slice(0, 10) === today;
    let rows, headings;
    if (this.tab === 'holdings') {
      headings = ['名称', '总数', '可卖（T+1）', '成本', '现价', '盈亏'];
      rows = state.ashare.holdings.map(row => {
        const last = this.feed.quotes[row.code]?.last;
        return [row.name, row.qty, row.available, money(row.cost), money(last), money(last == null ? null : (last - +row.cost) * +row.qty)];
      });
    } else if (this.tab === 'ledger') {
      headings = ['日期', '类型', '单位', '数量', '备注'];
      rows = (this.historyRows || []).map(row => [time(row.t, true), row.kind, row.asset, row.amount, row.note]);
    } else if (this.tab === 'trades') {
      headings = ['时间', '名称', '方向', '股数', '价格', '费用'];
      rows = state.recent.trades.filter(row => row.market === 'ashare' && isToday(row.t))
        .map(row => [time(row.t), row.symbol, row.side === 'buy' ? '买入' : '卖出', row.qty, money(row.price), money(row.fee)]);
    } else {
      const records = this.tab === 'history' ? this.historyRows || []
        : [...open, ...state.recent.orders.filter(row => row.market === 'ashare' && isToday(row.createdAt))];
      headings = ['时间', '名称', '方向', '类型', '价格', '股数', '成交', '状态', '操作'];
      rows = records.map(row => [time(row.createdAt), row.name, row.side === 'buy' ? '买入' : '卖出',
        row.type === 'limit' ? '限价' : '市价', money(row.price), row.qty, row.filled, STATUS[row.status],
        open.some(order => order.id === row.id) ? button('撤单', () => this.cancel(row.id), 'accent') : '']);
    }
    this.panel.classList.toggle('empty-dock', !rows.length); this.dock.classList.toggle('empty-dock', !rows.length);
    this.dock.replaceChildren(tabs, rows.length ? table(headings, rows) : element('p', '暂无记录', 'empty-message'));
  }
  async cancel(id) { try { await this.api.post('ashare/cancel', { id }); } catch (error) { this.modals.error(error); } }
  render() { this.renderHead(); this.renderBook(); this.renderTicket(); this.renderDock(this.api.state); }
}
