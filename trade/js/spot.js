// 现货两列下单表单与手机买卖分段布局。
// 规格 9.7、9.9：三种委托、金额联动、余额滑杆及精度预校验。
// 请求只传用户委托参数，价格权威与成交记账留在 Worker。
import { element, button, money, quantity, price } from './format.js';
import { parseInput, inputString, product, divide, stepInput } from './decimal.js';
const TYPES = [['limit', '限价'], ['market', '市价'], ['stop_limit', '条件']];
export class Spot {
  constructor(panel, feed, api, modals) {
    this.feed = feed; this.api = api; this.modals = modals; this.type = 'limit'; this.side = 'buy'; this.columns = {};
    window.addEventListener('hashchange', () => { this.prefillKey = null; });
    const top = element('div', '', 'form-top'), tabs = element('div', '', 'order-types'); this.tabs = new Map();
    for (const [type, label] of TYPES) {
      const control = button(label, () => this.setType(type)); tabs.append(control); this.tabs.set(type, control);
    }
    top.append(tabs, element('small', 'Maker 0.1000% · Taker 0.1000%', 'fee-label')); panel.append(top);
    this.sideTabs = element('div', '', 'side-tabs');
    for (const [side, label] of [['buy', '买入'], ['sell', '卖出']]) {
      this.sideTabs.append(button(label, () => { this.side = side; feed.dirty = true; }, side));
    }
    panel.prepend(this.sideTabs); this.panel = panel;
    this.typeSelect = element('select', '', 'mobile-order-type');
    for (const [type, label] of TYPES) { const option = element('option', label); option.value = type; this.typeSelect.append(option); }
    this.typeSelect.onchange = () => this.setType(this.typeSelect.value); panel.append(this.typeSelect);
    const columns = element('div', '', 'spot-columns'); panel.append(columns);
    for (const side of ['buy', 'sell']) this.columns[side] = this.column(columns, side);
    // DESIGN §6/§7：账户刷新保留划转按钮，避免交互期间重建节点。
    this.balance = element('div', '', 'ticket-balance'); this.balanceValue = element('span');
    this.balance.append(this.balanceValue, button('划转', () => this.modals.transfer('wallet', 'spot'), 'accent'));
    panel.append(this.balance);
  }
  field(container, label, unit, name, side) {
    const row = element('div', '', 'input-row'), wrapper = element('div', '', 'field field-' + name);
    const text = element('label', label, 'field-label');
    const input = element('input'); input.name = side + '-' + name; input.inputMode = 'decimal'; input.autocomplete = 'off';
    input.id = 'spot-' + input.name; text.htmlFor = input.id;
    const suffix = element('span', unit, 'field-unit');
    const precision = () => name === 'qty' ? this.feed.quantityPrecision() : this.feed.precision();
    const minus = button('−', () => { input.value = stepInput(input.value, precision(), -1); this.linked(side, name); }, 'stepper');
    const plus = button('+', () => { input.value = stepInput(input.value, precision(), 1); this.linked(side, name); }, 'stepper');
    row.append(input, suffix, minus, plus); input.addEventListener('input', () => this.linked(side, name));
    wrapper.append(text, row); container.append(wrapper); return { row: wrapper, input, text, suffix };
  }
  column(container, side) {
    const form = element('form', '', 'spot-column ' + side); form.noValidate = true; container.append(form);
    const available = element('div', '', 'available'); available.append(element('span', '可用', 'muted'), element('span'));
    form.append(available);
    const stop = this.field(form, '触发价', 'USDT', 'stop', side);
    const limit = this.field(form, '价格', 'USDT', 'price', side);
    const qty = this.field(form, '数量', '', 'qty', side);
    const unit = element('select', '', 'quantity-unit'); unit.setAttribute('aria-label', '数量单位');
    const base = element('option'), quote = element('option', 'USDT'); base.value = 'qty'; quote.value = 'quoteQty';
    unit.append(base); if (side === 'buy') unit.append(quote);
    qty.suffix.replaceWith(unit); unit.onchange = () => { this.linked(side, 'qty'); this.feed.dirty = true; };
    // DESIGN §4.6：4个胶囊取代菱形滑杆，保留定点数量联动。
    const slider = element('div', '', 'quick-ratios seg'), range = element('input'); range.type = 'hidden';
    range.min = 0; range.max = 100; range.value = 0; range.setAttribute('aria-label', '可用余额百分比');
    const marks = element('div', '', 'ratio-buttons');
    for (const value of [25, 50, 75, 100]) {
      const mark = button(value + '%', () => { range.value = value; range.dispatchEvent(new Event('input')); });
      mark.setAttribute('aria-label', value + '%'); marks.append(mark);
    }
    slider.append(range, marks); form.append(slider);
    range.oninput = () => {
      const availableAmount = parseInput(this.available(side)) || 0n;
      const gross = inputString(availableAmount * BigInt(range.value) / 100n, 8);
      const fraction = side === 'buy' ? divide(gross, '1.001', 8) : gross;
      qty.input.value = side === 'buy' && unit.value !== 'quoteQty' ? divide(fraction, this.orderPrice(side), this.feed.quantityPrecision())
        : inputString(parseInput(fraction) || 0n, unit.value === 'quoteQty' ? 8 : this.feed.quantityPrecision());
      this.linked(side, 'qty');
      marks.childNodes.forEach((mark, index) => mark.classList.toggle('selected', Number(range.value) === (index + 1) * 25));
    };
    const amount = this.field(form, '成交额', 'USDT', 'amount', side), maximum = element('div', '', 'maximum muted');
    const submit = button('', null, side === 'buy' ? 'buy-button' : 'sell-button'); submit.type = 'submit';
    const register = button('没有账号？注册', () => this.modals.login(true), 'register-link'); form.append(maximum, submit, register);
    const summary = element('div', '', 'ticket-summary'), estimated = element('div'), fee = element('div');
    summary.append(available, estimated, fee, maximum); form.insertBefore(summary, submit);
    const column = { form, available, stop, limit, qty, unit, base, amount, range, maximum, submit, register,
      summary, estimated, fee, busy: false };
    form.onsubmit = event => { event.preventDefault(); this.submit(side); }; return column;
  }
  available(side) {
    const asset = side === 'buy' ? 'USDT' : this.feed.symbol.split('_')[0];
    return this.api.state?.spot.balances.find(entry => entry.asset === asset)?.free || '0';
  }
  orderPrice(side) {
    const latest = this.feed.tickers.spot.get(this.feed.symbol)?.last;
    return this.type === 'market' ? latest || '0' : this.columns[side].limit.input.value;
  }
  setType(type) {
    this.type = type; this.typeSelect.value = type; this.prefillKey = null; this.feed.dirty = true;
  }
  prefillPrice() {
    const key = this.feed.symbol + ':' + this.type, latest = this.feed.tickers.spot.get(this.feed.symbol)?.last;
    if (this.type === 'market' || this.prefillKey === key || !this.feed.spec || !(Number(latest) > 0)) return;
    for (const column of Object.values(this.columns)) {
      if (!column.limit.input.value) column.limit.input.value = Number(latest).toFixed(this.feed.precision());
    }
    this.prefillKey = key;
  }
  setPrice(value) {
    this.setType('limit');
    for (const side of ['buy', 'sell']) { this.columns[side].limit.input.value = value; this.linked(side, 'price'); }
  }
  linked(side, field) {
    const column = this.columns[side]; if (!column) return;
    if (field === 'amount') {
      column.qty.input.value = divide(column.amount.input.value, this.orderPrice(side), this.feed.quantityPrecision());
    }
    else column.amount.input.value = column.unit.value === 'quoteQty' ? column.qty.input.value
      : product(column.qty.input.value, this.orderPrice(side));
    this.feed.dirty = true;
  }
  render() {
    this.prefillPrice();
    const coin = this.feed.symbol.split('_')[0], logged = this.api.logged();
    for (const [type, control] of this.tabs) control.classList.toggle('selected', this.type === type);
    [...this.sideTabs.children].forEach(control => control.classList.toggle('selected', control.classList.contains(this.side)));
    for (const [side, column] of Object.entries(this.columns)) {
      column.form.classList.toggle('mobile-hidden', side !== this.side);
      column.stop.row.hidden = this.type !== 'stop_limit'; column.amount.row.hidden = true;
      column.summary.hidden = !logged;
      column.limit.text.textContent = this.type === 'stop_limit' ? '限价' : '价格';
      column.limit.input.readOnly = this.type === 'market';
      column.limit.input.placeholder = this.type === 'market' ? '市场最优价格' : '';
      if (this.type === 'market') column.limit.input.value = '';
      const quoteMode = this.type === 'market' && side === 'buy' && column.unit.value === 'quoteQty';
      if (this.type !== 'market') column.unit.value = 'qty';
      column.unit.disabled = this.type !== 'market' || side === 'sell'; column.base.textContent = coin;
      column.qty.text.textContent = quoteMode ? '成交额' : '数量';
      column.available.lastChild.textContent = side === 'buy' ? money(this.available(side)) + ' USDT'
        : quantity(this.available(side), this.feed.quantityPrecision()) + ' ' + coin;
      const maximum = side === 'buy' ? divide(divide(this.available(side), '1.001', 8),
        this.orderPrice(side), this.feed.quantityPrecision())
        : this.available(side);
      column.maximum.textContent = (side === 'buy' ? '最大可买 ' : '最大可卖 ')
        + quantity(maximum || '0', this.feed.quantityPrecision()) + ' ' + coin;
      const amount = Number(quoteMode ? column.qty.input.value : product(column.qty.input.value || '0', this.orderPrice(side) || '0'));
      column.estimated.replaceChildren(element('span', '预计金额'), element('b', money(amount) + ' USDT'));
      column.fee.replaceChildren(element('span', '预计费用'), element('b', money(amount * 0.001) + ' USDT'));
      column.submit.textContent = column.busy ? '提交中…' : logged ? (side === 'buy' ? '买入 ' : '卖出 ') + coin : '登录后交易';
      column.submit.className = logged ? side === 'buy' ? 'buy-button' : 'sell-button' : 'primary';
      column.submit.disabled = column.busy; column.register.hidden = logged;
    }
    this.balanceValue.textContent = '加密现货 · ' + money(this.available('buy')) + ' USDT';
  }
  validate(side, data) {
    const decimals = this.feed.quantityPrecision(), priceDecimals = this.feed.precision();
    if (data.price !== undefined && !(parseInput(data.price) > 0n)) return '请输入价格';
    if (data.stopPrice !== undefined && !(parseInput(data.stopPrice) > 0n)) return '请输入价格';
    if (data.qty !== undefined && !(parseInput(data.qty) > 0n)) return '请输入数量';
    if (data.quoteQty !== undefined && !(parseInput(data.quoteQty) > 0n)) return '请输入数量';
    if (data.qty && (data.qty.split('.')[1]?.length || 0) > decimals) return `数量精度最多 ${decimals} 位小数`;
    if ([data.price, data.stopPrice].some(value => value && (value.split('.')[1]?.length || 0) > priceDecimals)) {
      return `价格精度最多 ${priceDecimals} 位小数`;
    }
    const notional = data.quoteQty || product(data.qty, this.orderPrice(side));
    const minimum = this.feed.spec?.min_quote_amount || '0';
    if ((parseInput(notional) || 0n) < (parseInput(minimum) || 0n)) return `下单金额低于最小值 ${minimum} USDT`;
    const required = side === 'buy' ? notional : data.qty;
    if ((parseInput(required) || 0n) > (parseInput(this.available(side)) || 0n)) return '可用余额不足';
    return '';
  }
  async submit(side) {
    if (!this.api.logged()) { this.modals.login(); return; }
    const column = this.columns[side]; if (column.busy) return;
    const data = { symbol: this.feed.symbol, side, type: this.type };
    if (this.type !== 'market') data.price = column.limit.input.value;
    if (this.type === 'stop_limit') data.stopPrice = column.stop.input.value;
    data[this.type === 'market' && side === 'buy' ? column.unit.value : 'qty'] = column.qty.input.value;
    const error = this.validate(side, data); if (error) { this.modals.toast(error, true); return; }
    const signature = JSON.stringify(data);
    if (column.lastSignature !== signature) column.clientId = crypto.randomUUID();
    column.lastSignature = signature; data.clientId = column.clientId;
    column.busy = true; this.render();
    try {
      const result = await this.api.post('spot/order', data), order = result.order;
      this.modals.toast(Number(order.filled) > 0 ? '已成交 ' + quantity(order.filled, this.feed.quantityPrecision())
        + ' ' + data.symbol.split('_')[0] + '，均价 ' + price(order.avgPrice, this.feed.precision()) : '委托已提交');
      column.lastSignature = null;
    } catch (failure) { this.modals.error(failure); }
    finally { column.busy = false; this.render(); }
  }
}
