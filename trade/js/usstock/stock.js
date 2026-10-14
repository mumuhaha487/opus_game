// 美股个股页：图表（美东时间、绿涨红跌）、买一卖一、下单（整股、市价/限价）、委托/持仓/成交/流水。
// 服务端执行权威规则：市价按实时成交价成交；限价当日有效；卖出收 SEC 费与 FINRA TAF。
import { element, button, money, quantity, large, direction, time } from '../format.js';
import { title, segment, change, table } from '../ui.js';
import { AshareChart } from '../ashare/chart.js';
import { nyChartTime } from './feed.js';
import { nyParts } from './calendar.js';
const STATUS = { new: '未成交', filled: '已成交', canceled: '已撤销', expired: '已撤销（收盘未成交）' };
const usd = value => value == null || !Number.isFinite(+value) ? '--' : '$' + money(+value);
export function usFeesEstimate(amount, shares, side) {
  if (side !== 'sell' || !(amount > 0)) return { sec: 0, taf: 0, total: 0 };
  const ceil = value => Math.ceil(value * 100 - 1e-8) / 100;
  const sec = ceil(amount * 0.0000278), taf = Math.min(8.3, ceil(shares * 0.000166));
  return { sec, taf, total: sec + taf };
}
export const MARKET_LABEL = { open: '交易中', pre: '盘前 · 未开盘', post: '已收盘', closed: '休市', loading: '连接中' };
export function beijingClock(time) {
  return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit',
    minute: '2-digit', hour12: false }).format(new Date(time));
}
export class UsStock {
  constructor(panel, feed, api, modals) {
    Object.assign(this, { panel, feed, api, modals, side: 'buy', type: 'limit', tab: 'orders' });
    this.head = element('section', '', 'panel bar stock-head'); this.chartPanel = element('section', '', 'panel chart');
    this.book = element('section', '', 'panel book stock-book'); this.ticket = element('section', '', 'panel form stock-ticket');
    this.dock = element('section', '', 'panel orders stock-dock');
    panel.append(this.head, this.chartPanel, this.book, this.ticket, this.dock);
    this.chart = new AshareChart(this.chartPanel, feed, { up: '#22B573', down: '#E5484D', shift: nyChartTime,
      zone: 'America/New_York', more: false });
    this.buildTicket();
    this.actions = element('div', '', 'stock-mobile-actions');
    this.actions.append(button('买入', () => this.openTicket('buy'), 'buy-button'),
      button('卖出', () => this.openTicket('sell'), 'sell-button')); panel.append(this.actions);
    this.ticketClose = button('返回', () => this.ticket.classList.remove('sheet-open'), 'ticket-close');
    this.ticket.prepend(this.ticketClose);
  }
  buildTicket() {
    this.sideTabs = segment([['buy', '买入'], ['sell', '卖出']], side => { this.side = side; this.renderTicket(); });
    this.sideTabs.classList.add('ticket-sides');
    this.types = segment([['limit', '限价'], ['market', '市价']], type => { this.type = type; this.renderTicket(); });
    this.types.classList.add('order-types'); this.ticket.append(this.sideTabs, this.types); this.fields = {};
    for (const [key, label, unit] of [['price', '价格', '$'], ['qty', '数量', '股']]) {
      const field = element('div', '', 'field'), text = element('label', label), row = element('div', '', 'input-row');
      const input = element('input'); input.inputMode = 'decimal'; input.autocomplete = 'off'; input.name = 'us-' + key;
      input.id = 'us-' + key; text.htmlFor = input.id; input.oninput = () => this.renderTicket();
      const adjust = sign => {
        input.value = key === 'price' ? Math.max(0, +input.value + sign * 0.01).toFixed(2) : String(Math.max(0, Math.floor(+input.value) + sign));
        this.renderTicket();
      };
      row.append(input, element('span', unit, 'field-unit'), button('−', () => adjust(-1), 'stepper'),
        button('+', () => adjust(1), 'stepper')); field.append(text, row); this.ticket.append(field); this.fields[key] = input;
    }
    this.note = element('small', '', 'muted'); this.ticket.append(this.note);
    this.ratios = segment([[25, '25%'], [50, '50%'], [75, '75%'], [100, '100%']], ratio => {
      this.fields.qty.value = String(Math.floor(this.maximum() * ratio / 100)); this.renderTicket();
    }, 0); this.ratios.classList.add('quick-ratios'); this.ticket.append(this.ratios);
    this.summary = element('div', '', 'ticket-summary'); this.submit = button('', () => this.order(), 'buy-button');
    this.register = button('没有账号？注册', () => this.modals.login(true), 'register-link');
    this.balance = element('div', '', 'ticket-balance'); this.balanceValue = element('span');
    this.balance.append(this.balanceValue, button('划转', () => this.modals.transfer('wallet', 'usstock'), 'accent'));
    this.ticket.append(this.summary, this.submit, this.register, this.balance);
  }
  setCode(code) {
    if (this.code === code) return;
    this.code = code; this.fields.price.value = ''; this.fields.qty.value = ''; this.tab = 'orders'; this.chart.key = '';
  }
  openTicket(side) { this.side = side; this.ticket.classList.add('sheet-open'); this.renderTicket(); }
  marketPill() {
    const market = this.feed.market(), pill = element('span', MARKET_LABEL[market.status] || '', 'market-status '
      + (market.status === 'open' ? 'open' : 'closed'));
    pill.title = market.status === 'open' ? '今日 ' + beijingClock(market.closeAt) + ' 收盘（北京时间）'
      : '下次开盘 ' + beijingClock(market.nextOpen) + '（北京时间）';
    return pill;
  }
  renderHead() {
    const quote = this.feed.quotes[this.code], stock = globalThis.US_UNIVERSE.find(row => row.ticker === this.code);
    if (!quote || !stock) return;
    const identity = element('div', '', 'stock-identity'), name = element('div');
    const exchange = { OQ: '纳斯达克', N: '纽交所', AM: '纽交所 Arca' }[stock.exchange] || '';
    name.append(element('b', quote.name), element('small', this.code + ' · ' + exchange, 'muted')); identity.append(name);
    const latest = element('div', '', 'stock-price');
    latest.append(element('b', usd(quote.last), 'latest-price ' + direction(quote.last - quote.prevClose)), change(quote.percent),
      element('small', (quote.change > 0 ? '+' : '') + money(quote.change)));
    const statistics = [['今开', usd(quote.open)], ['最高', usd(quote.high)], ['最低', usd(quote.low)], ['昨收', usd(quote.prevClose)],
      ['成交量', quantity(quote.volume, 0)], ['成交额', '$' + large(quote.turnover)],
      ['行情时间', quote.time ? nyParts(quote.time).date.slice(5) + ' ' + String(nyParts(quote.time).hour).padStart(2, '0') + ':'
        + String(nyParts(quote.time).minute).padStart(2, '0') + ' 美东' : '--']];
    const cells = statistics.map(([label, value]) => {
      const cell = element('div', '', 'bar-stat'); cell.append(element('span', label), element('b', String(value))); return cell;
    });
    const stats = element('div', '', 'stock-statistics'); stats.append(...cells);
    const back = element('a', '全部美股', 'accent'); back.href = '#/usstock';
    this.head.replaceChildren(identity, latest, stats, this.marketPill(), back);
    if (!this.fields.price.value && quote.last) this.fields.price.value = (+quote.last).toFixed(2);
  }
  renderBook() {
    const quote = this.feed.quotes[this.code];
    if (!quote) { this.book.replaceChildren(element('p', this.feed.status === 'failed' ? '行情连接中断，正在重试' : '正在读取行情…', 'muted')); return; }
    this.book.replaceChildren(title('QUOTE', '买卖盘'));
    const level = (label, value, size, kind) => {
      const row = button('', () => { if (value) { this.fields.price.value = (+value).toFixed(2); this.type = 'limit'; this.renderTicket(); } }, 'stock-level');
      row.append(element('span', label, 'muted'), element('span', value ? usd(value) : '--', kind), element('span', size ? quantity(size, 0) + ' 股' : '--'));
      return row;
    };
    this.book.append(level('卖一', quote.ask, quote.askSize, 'down'));
    const middle = element('div', '', 'book-middle');
    middle.append(element('b', usd(quote.last), direction(quote.last - quote.prevClose)), change(quote.percent));
    this.book.append(middle, level('买一', quote.bid, quote.bidSize, 'up'));
    const tip = element('p', '展示行情来自腾讯；盘中市价单按服务器取得的实时成交价成交，限价单以限价或更优价格成交。', 'muted');
    tip.style.fontSize = '12px'; tip.style.padding = '8px 12px'; this.book.append(tip);
  }
  orderPrice() { return this.type === 'market' ? this.feed.quotes[this.code]?.last || 0 : +this.fields.price.value; }
  holding() { return this.api.state?.usstock?.holdings.find(row => row.ticker === this.code); }
  maximum() {
    if (this.side === 'sell') return +(this.holding()?.available || 0);
    const price = this.orderPrice(), cash = +(this.api.state?.usstock?.cash.free || 0);
    return price ? Math.max(0, Math.floor(cash / price)) : 0;
  }
  renderTicket() {
    const quote = this.feed.quotes[this.code], logged = this.api.logged(), shares = Math.floor(+this.fields.qty.value || 0);
    const value = this.orderPrice() * shares, fees = usFeesEstimate(value, shares, this.side), market = this.feed.market();
    this.fields.price.readOnly = this.type === 'market';
    [...this.sideTabs.children].forEach(control => control.classList.toggle('selected', control.dataset.value === this.side));
    [...this.types.children].forEach(control => control.classList.toggle('selected', control.dataset.value === this.type));
    this.note.textContent = this.type === 'market'
      ? market.status === 'open' ? '市价单按实时成交价立即成交' : '休市中，市价单不可用；可挂限价单在下一交易时段生效'
      : market.status === 'open' ? '限价单当日有效，收盘未成交自动撤销' : '限价单将在下一交易时段（' + beijingClock(market.nextOpen) + ' 北京时间）生效';
    this.summary.hidden = !logged;
    this.summary.replaceChildren(...[['可用', this.side === 'buy' ? usd(this.api.state?.usstock?.cash.free || 0)
      : (this.holding()?.available || '0') + ' 股'], ['预计金额', usd(value)], ['预计费用', usd(fees.total)],
      [this.side === 'buy' ? '可买' : '可卖', this.maximum() + ' 股']].map(([label, text]) => {
      const row = element('div'); row.append(element('span', label), element('b', text)); return row;
    }));
    this.summary.children[2].title = this.side === 'sell' ? 'SEC 费 ' + usd(fees.sec) + ' · FINRA TAF ' + usd(fees.taf) : '买入不收佣金';
    this.submit.textContent = !logged ? '登录后交易' : this.busy ? '提交中…' : (this.side === 'buy' ? '买入 ' : '卖出 ') + (quote?.name || this.code);
    this.submit.className = !logged ? 'primary' : this.side === 'buy' ? 'buy-button' : 'sell-button';
    this.submit.disabled = this.busy || !quote || (this.type === 'market' && market.status !== 'open');
    this.register.hidden = logged;
    this.balanceValue.textContent = '美股账户 · ' + usd(this.api.state?.usstock?.cash.free || 0);
  }
  async order() {
    if (!this.api.logged()) { this.modals.login(); return; } if (this.busy) return;
    const data = { ticker: this.code, side: this.side, type: this.type, qty: String(Math.floor(+this.fields.qty.value || 0)) };
    if (this.type === 'limit') data.price = this.fields.price.value;
    if (!/^[1-9]\d{0,6}$/.test(data.qty)) { this.modals.toast('请输入整数股数', true); return; }
    const signature = JSON.stringify(data); if (signature !== this.lastSignature) this.clientId = crypto.randomUUID();
    this.lastSignature = signature; data.clientId = this.clientId; this.busy = true; this.renderTicket();
    try {
      const result = await this.api.post('usstock/order', data);
      this.modals.toast(+result.order.filled ? '已成交 ' + result.order.filled + ' 股，均价 ' + usd(result.order.avgPrice)
        : result.order.preplaced ? '已挂单，下一交易时段生效' : '委托已提交'); this.lastSignature = null;
    } catch (error) { this.modals.error(error); } finally { this.busy = false; this.renderTicket(); }
  }
  renderDock(state) {
    if (!state) {
      this.dock.classList.add('empty-dock'); this.panel.classList.add('empty-dock');
      this.dock.replaceChildren(element('div', '登录后查看委托与持仓', 'muted'), button('登录', () => this.modals.login(), 'primary')); return;
    }
    const open = state.openOrders.filter(row => row.market === 'usstock'), holdings = state.usstock?.holdings || [];
    const tabs = segment([['orders', '当日委托'], ['holdings', '持仓'], ['trades', '当日成交'], ['history', '历史委托'], ['ledger', '资金流水']], tab => {
      this.tab = tab; this.historyRows = null;
      if (['history', 'ledger'].includes(tab)) this.api.history(tab === 'history' ? 'orders' : 'ledger', 'usstock')
        .then(rows => { this.historyRows = rows; this.renderDock(this.api.state); }).catch(error => this.modals.error(error));
      this.renderDock(this.api.state);
    }, this.tab);
    [open.length, holdings.length].forEach((count, index) => { tabs.children[index].append(' ', element('small', '(' + count + ')')); });
    const today = nyParts(state.serverTime).date, isToday = value => nyParts(value).date === today;
    let rows, headings;
    if (this.tab === 'holdings') {
      headings = ['名称', '代码', '持仓', '可卖', '成本', '现价', '盈亏'];
      rows = holdings.map(row => {
        const last = this.feed.quotes[row.ticker]?.last;
        const link = element('a', row.ticker, 'accent'); link.href = '#/us/' + row.ticker;
        return [row.name, link, row.qty, row.available, usd(row.cost), usd(last), last == null ? '--' : usd((last - +row.cost) * +row.qty)];
      });
    } else if (this.tab === 'ledger') {
      headings = ['时间', '类型', '单位', '数量', '备注'];
      rows = (this.historyRows || []).map(row => [time(row.t, true), row.kind, row.asset, row.amount, row.note]);
    } else if (this.tab === 'trades') {
      headings = ['时间', '代码', '方向', '股数', '价格', '费用'];
      rows = state.recent.trades.filter(row => row.market === 'usstock' && isToday(row.t))
        .map(row => [time(row.t), row.ticker, row.side === 'buy' ? '买入' : '卖出', row.qty, usd(row.price), usd(row.fee)]);
    } else {
      const records = this.tab === 'history' ? this.historyRows || []
        : [...open, ...state.recent.orders.filter(row => row.market === 'usstock' && isToday(row.createdAt))];
      headings = ['时间', '代码', '方向', '类型', '价格', '股数', '成交', '状态', '操作'];
      rows = records.map(row => [time(row.createdAt), row.ticker, row.side === 'buy' ? '买入' : '卖出',
        row.type === 'limit' ? '限价' : '市价', row.price ? usd(row.price) : '市价', row.qty, row.filled,
        row.status === 'new' && row.preplaced ? '待开盘' : STATUS[row.status] || row.status,
        open.some(order => order.id === row.id) ? button('撤单', () => this.cancel(row.id), 'accent') : '']);
    }
    this.panel.classList.toggle('empty-dock', !rows.length); this.dock.classList.toggle('empty-dock', !rows.length);
    this.dock.replaceChildren(tabs, rows.length ? table(headings, rows) : element('p', '暂无记录', 'empty-message'));
  }
  async cancel(id) { try { await this.api.post('usstock/cancel', { id }); } catch (error) { this.modals.error(error); } }
  render() { this.renderHead(); this.renderBook(); this.renderTicket(); this.renderDock(this.api.state); }
}
