// 逐仓合约下单表单、账户卡片及展示计算。
// 规格 9.8、9.9：桌面 60/40 输入与账户，手机上下开多/开空按钮。
// 展示按浏览器行情估算，成交、强平与资金记账由 Worker 权威执行。
import { element, button, money, quantity, price } from './format.js';
import { parseInput, inputString } from './decimal.js';
import { segment } from './ui.js';
export function positionMetrics(position, mark) {
  const qty = Number(position.qty), entry = Number(position.entry), margin = Number(position.margin);
  const long = position.side === 'long', pnl = (mark - entry) * qty * (long ? 1 : -1);
  // 规格 7.7：展示和服务端采用同一个逐仓多空强平价公式。
  const liq = Math.max(0, (entry * qty + (long ? -margin : margin)) / (qty * (1 + (long ? -1 : 1) * Number(position.mmr))));
  const removable = Math.max(0, margin + Math.min(pnl, 0) - mark * qty / position.leverage);
  return { pnl, liq, removable, roe: pnl / margin * 100, ratio: Number(position.mmr) * mark * qty / (margin + pnl) * 100 };
}
export function markFor(feed, symbol) {
  return Number(feed.tickers.futures.get(symbol)?.mark_price || feed.specs.get('futures:' + symbol)?.value.mark_price || 0);
}
export function futuresEquity(feed, account) {
  const positions = account?.positions || [], unrealized = positions.reduce((total, position) => {
    const mark = markFor(feed, position.symbol); return total + (mark ? positionMetrics(position, mark).pnl : 0);
  }, 0);
  const balance = Number(account?.wallet || 0) + Number(account?.locked || 0)
    + positions.reduce((total, position) => total + Number(position.margin), 0);
  return { unrealized, balance, equity: balance + unrealized };
}
const TYPES = [['limit', '限价'], ['market', '市价'], ['stop_market', '条件']];
export class Futures {
  constructor(panel, feed, api, modals) {
    Object.assign(this, { feed, api, modals, type: 'limit', fields: {}, side: 'buy' });
    this.formSymbol = null;
    const sideTabs = segment([['buy', '开多'], ['sell', '开空']], side => { this.side = side; this.render(); });
    sideTabs.classList.add('ticket-sides'); panel.append(sideTabs);
    const tags = element('div', '', 'futures-tags'); this.leverageButton = button('20x', () => modals.leverage(feed));
    tags.append(button('逐仓', () => modals.toast('当前版本支持逐仓模式')), this.leverageButton); panel.append(tags);
    this.tabs = element('div', '', 'order-types');
    for (const [type, label] of TYPES) this.tabs.append(button(label, () => this.setType(type)));
    const top = element('div', '', 'form-top'); top.append(this.tabs); panel.append(top);
    this.select = element('select', '', 'mobile-order-type');
    for (const [type, label] of TYPES) { const option = element('option', label); option.value = type; this.select.append(option); }
    this.select.onchange = () => this.setType(this.select.value); panel.append(this.select);
    const columns = element('div', '', 'futures-columns'); this.form = element('div', '', 'futures-inputs');
    this.account = element('div', '', 'futures-account'); columns.append(this.form, this.account); panel.append(columns);
    this.accountPrompt = element('div', '登录后查看合约账户', 'muted'); this.accountDetails = element('div');
    this.account.append(this.accountPrompt, this.accountDetails);
    this.accountValues = ['保证金余额', '钱包余额', '未实现盈亏', '可用'].map(label => {
      const row = element('div', '', 'account-row'), value = element('b'); row.append(element('span', label, 'muted'), value);
      this.accountDetails.append(row); return value;
    });
    this.accountDetails.append(button('划转', () => this.modals.transfer('wallet', 'futures'), 'secondary'));
    this.available = element('div', '', 'available'); this.form.append(this.available);
    this.field('price', '价格', 'USDT'); this.field('qty', '数量', 'BTC'); this.slider();
    this.tpsl = this.checkbox('止盈/止损', 'futures-tpsl');
    this.field('tp', '止盈触发价 · 标记价格', 'USDT'); this.field('sl', '止损触发价 · 标记价格', 'USDT');
    this.reduce = this.checkbox('只减仓', 'futures-reduce');
    // DESIGN §4.6：保证金、费用与强平估值放在主按钮前的统一汇总框。
    this.summary = element('div', '', 'ticket-summary');
    this.summaryValues = ['可用', '预计金额', '预计费用', '保证金', '预估强平价', '最大可开'].map(label => {
      const row = element('div'), value = element('b'); row.append(element('span', label), value);
      this.summary.append(row); return value;
    }); this.form.append(this.summary);
    this.actions = element('div', '', 'futures-actions'); this.buttons = {};
    for (const side of ['buy', 'sell']) {
      const box = element('div'), control = button('', () => this.submit(side), side === 'buy' ? 'buy-button' : 'sell-button');
      box.append(control); this.actions.append(box); this.buttons[side] = { box, control };
    }
    this.form.append(this.actions);
    // 规格 9.7、9.8：未登录保留输入，仅显示一个登录入口和注册链接。
    this.guest = element('div', '', 'futures-login');
    this.guest.append(button('登录后交易', () => this.modals.login(), 'primary'),
      button('没有账号？注册', () => this.modals.login(true), 'register-link')); this.form.append(this.guest);
  }
  field(name, label, unit) {
    const row = element('div', '', 'input-row'), wrapper = element('div', '', 'field futures-field-' + name);
    const text = element('label', label, 'field-label');
    const input = element('input'), suffix = element('span', unit, 'field-unit');
    input.name = 'futures-' + name; input.inputMode = 'decimal'; input.autocomplete = 'off';
    input.id = input.name; text.htmlFor = input.id;
    const adjust = sign => {
      const precision = name === 'qty' ? this.feed.quantityPrecision() : this.feed.precision();
      const step = name === 'qty' ? this.feed.spec?.quanto_multiplier : this.feed.spec?.order_price_round;
      const amount = parseInput(input.value) || 0n, tick = parseInput(step) || parseInput(String(10 ** -precision));
      input.value = inputString(amount + BigInt(sign) * tick > 0n ? amount + BigInt(sign) * tick : 0n, precision);
      this.feed.dirty = true;
    };
    row.append(input, suffix, button('−', () => adjust(-1), 'stepper'), button('+', () => adjust(1), 'stepper'));
    wrapper.append(text, row); input.oninput = () => { this.feed.dirty = true; }; this.form.append(wrapper);
    this.fields[name] = { row: wrapper, text, input, suffix };
  }
  checkbox(text, name) {
    const label = element('label', text, 'futures-checkbox'), input = element('input'); input.type = 'checkbox'; input.name = name;
    input.onchange = () => { this.feed.dirty = true; }; label.prepend(input); this.form.append(label); return input;
  }
  slider() {
    // DESIGN §4.6：快捷比例胶囊，隐藏数值输入仅用于沿用原有数量计算。
    const box = element('div', '', 'quick-ratios seg'), range = element('input'); range.type = 'hidden';
    range.min = 0; range.max = 100; range.value = 0; range.setAttribute('aria-label', '可开数量百分比');
    const marks = element('div', '', 'ratio-buttons');
    for (const value of [25, 50, 75, 100]) marks.append(button(value + '%', () => {
      range.value = value; range.dispatchEvent(new Event('input'));
    }));
    range.oninput = () => {
      const maximum = this.maximum(), tick = Number(this.feed.spec?.quanto_multiplier || 1);
      const qty = Math.floor(maximum * Number(range.value) / 100 / tick) * tick;
      this.fields.qty.input.value = qty.toFixed(this.feed.quantityPrecision());
      [...marks.children].forEach((control, index) => control.classList.toggle('selected', +range.value === (index + 1) * 25));
      this.feed.dirty = true;
    };
    box.append(range, marks); this.form.append(box); this.range = range; this.ratios = box;
  }
  leverage() { return this.api.state?.futures.leverage[this.feed.symbol] || Math.min(20, Number(this.feed.spec?.leverage_max || 20)); }
  orderPrice() {
    return this.type === 'market' ? Number(this.feed.tickers.futures.get(this.feed.symbol)?.last || 0)
      : Number(this.fields.price.input.value || 0);
  }
  maximum() {
    if (this.reduce.checked) return Number(this.api.state?.futures.positions.find(row => row.symbol === this.feed.symbol)?.qty || 0);
    const unitCost = this.orderPrice() * (1 / this.leverage() + 0.0005), tick = Number(this.feed.spec?.quanto_multiplier || 1);
    return unitCost ? Math.floor(Math.min(Number(this.api.state?.futures.wallet || 0) / unitCost,
      Number(this.feed.spec?.risk_limit_base || 0) / this.orderPrice()) / tick) * tick : 0;
  }
  setType(type) { this.type = type; this.select.value = type; this.prefillKey = null; this.feed.dirty = true; }
  prefillPrice() {
    const key = this.feed.symbol + ':' + this.type, latest = this.feed.tickers.futures.get(this.feed.symbol)?.last;
    if (this.type !== 'limit' || this.prefillKey === key || !this.feed.spec || !(Number(latest) > 0)) return;
    if (!this.fields.price.input.value) this.fields.price.input.value = Number(latest).toFixed(this.feed.precision());
    this.prefillKey = key;
  }
  setPrice(value) { this.setType('limit'); this.fields.price.input.value = value; }
  render() {
    if (this.formSymbol !== this.feed.symbol) {
      for (const field of Object.values(this.fields)) field.input.value = '';
      this.range.value = 0;
      this.ratios.querySelectorAll('.selected').forEach(control => control.classList.remove('selected'));
      this.formSymbol = this.feed.symbol; this.prefillKey = null;
    }
    this.prefillPrice();
    const coin = this.feed.symbol.split('_')[0], logged = this.api.logged(), wallet = this.api.state?.futures.wallet || '0';
    const leverage = this.leverage(); this.leverageButton.textContent = leverage + 'x';
    [...this.tabs.children].forEach((control, index) => control.classList.toggle('selected', TYPES[index][0] === this.type));
    this.available.hidden = true; this.fields.qty.suffix.textContent = coin;
    const field = this.fields.price;
    field.text.textContent = this.type === 'stop_market' ? '触发价 · 最新价格' : '价格';
    field.input.readOnly = this.type === 'market'; field.input.placeholder = this.type === 'market' ? '市场最优价格' : '';
    if (this.type === 'market') field.input.value = '';
    this.fields.tp.row.hidden = this.fields.sl.row.hidden = !this.tpsl.checked;
    const priceValue = this.orderPrice(), qty = Number(this.fields.qty.input.value || 0);
    this.summary.hidden = !logged;
    this.actions.hidden = !logged; this.guest.hidden = logged;
    this.accountDetails.hidden = !logged; this.accountPrompt.hidden = logged;
    for (const [side, entry] of Object.entries(this.buttons)) {
      entry.box.hidden = side !== this.side;
      entry.control.textContent = !logged ? '' : this.busy ? '提交中…'
        : (this.reduce.checked ? side === 'buy' ? '平空 ' : '平多 ' : side === 'buy' ? '开多 ' : '开空 ') + coin + 'USDT';
      entry.control.disabled = !!this.busy;
    }
    const projected = { entry: String(priceValue), qty: String(qty), margin: String(priceValue * qty / leverage),
      mmr: this.feed.spec?.maintenance_rate || '0', side: this.side === 'buy' ? 'long' : 'short' };
    const liq = qty && priceValue ? positionMetrics(projected, priceValue).liq : 0;
    [money(wallet) + ' USDT', money(priceValue * qty) + ' USDT', money(priceValue * qty * 0.0005) + ' USDT',
      money(this.reduce.checked ? 0 : priceValue * qty / leverage) + ' USDT',
      liq > 0 && !this.reduce.checked ? price(liq, this.feed.precision()) : '--',
      quantity(this.maximum(), this.feed.quantityPrecision()) + ' ' + coin]
      .forEach((value, index) => { this.summaryValues[index].textContent = value; });
    const account = this.api.state?.futures, equity = futuresEquity(this.feed, account);
    [equity.equity, wallet, equity.unrealized, wallet].forEach((value, index) => { this.accountValues[index].textContent = money(value); });
  }
  async submit(side) {
    if (!this.api.logged()) { this.modals.login(); return; } if (this.busy) return;
    const data = { symbol: this.feed.symbol, side, type: this.type, qty: this.fields.qty.input.value, reduceOnly: this.reduce.checked };
    if (this.type !== 'market') data[this.type === 'limit' ? 'price' : 'stopPrice'] = this.fields.price.input.value;
    if (this.tpsl.checked) { data.tp = this.fields.tp.input.value || null; data.sl = this.fields.sl.input.value || null; }
    if (!(parseInput(data.qty) > 0n)) { this.modals.toast('请输入数量', true); return; }
    if (this.type !== 'market' && !(parseInput(data.price || data.stopPrice) > 0n)) {
      this.modals.toast('请输入价格', true); return;
    }
    const signature = JSON.stringify(data);
    if (this.lastSignature !== signature) this.clientId = crypto.randomUUID();
    this.lastSignature = signature; data.clientId = this.clientId; this.busy = true; this.render();
    try {
      const result = await this.api.post('futures/order', data), order = result.order;
      this.modals.toast(Number(order.filled) ? (this.reduce.checked ? side === 'buy' ? '平空 ' : '平多 '
        : side === 'buy' ? '开多 ' : '开空 ') + quantity(order.filled, this.feed.quantityPrecision())
        + ' ' + data.symbol.split('_')[0] + ' 已成交，均价 ' + price(order.avgPrice, this.feed.precision()) : '委托已提交');
      this.lastSignature = null;
    } catch (error) { this.modals.error(error); } finally { this.busy = false; this.render(); }
  }
}
