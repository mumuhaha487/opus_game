// 逐仓合约下单表单、账户卡片及展示计算。
// 规格 9.8、9.9：桌面 60/40 输入与账户，手机上下开多/开空按钮。
// 展示按浏览器行情估算，成交、强平与资金记账由 Worker 权威执行。
import { element, button, money, quantity, price } from './format.js';
import { parseInput, inputString } from './decimal.js';
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
const TYPES = [['limit', '限价'], ['market', '市价'], ['stop_market', '止盈止损']];
export class Futures {
  constructor(panel, feed, api, modals) {
    Object.assign(this, { feed, api, modals, type: 'limit', fields: {}, side: 'buy' });
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
    this.accountValues = ['保证金余额', '钱包余额', '未实现盈亏', '可用'].map(label => {
      const row = element('div', '', 'account-row'), value = element('b'); row.append(element('span', label, 'muted'), value);
      this.account.append(row); return value;
    });
    this.account.append(button('划转', () => this.modals.transfer(), 'secondary'));
    this.available = element('div', '', 'available'); this.form.append(this.available);
    this.field('price', '价格', 'USDT'); this.field('qty', '数量', 'BTC'); this.slider();
    this.tpsl = this.checkbox('止盈/止损', 'futures-tpsl');
    this.field('tp', '止盈触发价 · 标记价格', 'USDT'); this.field('sl', '止损触发价 · 标记价格', 'USDT');
    this.reduce = this.checkbox('只减仓', 'futures-reduce');
    this.actions = element('div', '', 'futures-actions'); this.buttons = {};
    for (const side of ['buy', 'sell']) {
      const box = element('div'), control = button('', () => this.submit(side), side === 'buy' ? 'buy-button' : 'sell-button');
      const cost = element('div', '', 'futures-cost muted'), liq = element('div', '', 'futures-liq');
      box.append(control, cost, liq); this.actions.append(box); this.buttons[side] = { control, cost, liq };
    }
    this.form.append(this.actions);
  }
  field(name, label, unit) {
    const row = element('label', '', 'input-row futures-field-' + name), text = element('span', label, 'field-label');
    const input = element('input'), suffix = element('span', unit, 'field-unit');
    input.name = 'futures-' + name; input.inputMode = 'decimal'; input.autocomplete = 'off';
    const adjust = sign => {
      const precision = name === 'qty' ? this.feed.quantityPrecision() : this.feed.precision();
      const step = name === 'qty' ? this.feed.spec?.quanto_multiplier : this.feed.spec?.order_price_round;
      const amount = parseInput(input.value) || 0n, tick = parseInput(step) || parseInput(String(10 ** -precision));
      input.value = inputString(amount + BigInt(sign) * tick > 0n ? amount + BigInt(sign) * tick : 0n, precision);
      this.feed.dirty = true;
    };
    row.append(button('−', () => adjust(-1), 'stepper'), text, input, suffix, button('+', () => adjust(1), 'stepper'));
    input.oninput = () => { this.feed.dirty = true; }; this.form.append(row); this.fields[name] = { row, text, input, suffix };
  }
  checkbox(text, name) {
    const label = element('label', text, 'futures-checkbox'), input = element('input'); input.type = 'checkbox'; input.name = name;
    input.onchange = () => { this.feed.dirty = true; }; label.prepend(input); this.form.append(label); return input;
  }
  slider() {
    const box = element('div', '', 'balance-slider'), range = element('input'); range.type = 'range';
    range.min = 0; range.max = 100; range.value = 0; range.setAttribute('aria-label', '可开数量百分比');
    const track = element('i', '', 'slider-selected'), marks = element('div', '', 'slider-marks');
    for (const value of [0, 25, 50, 75, 100]) marks.append(button('', () => {
      range.value = value; range.dispatchEvent(new Event('input'));
    }));
    range.oninput = () => {
      const maximum = this.maximum(), tick = Number(this.feed.spec?.quanto_multiplier || 1);
      const qty = Math.floor(maximum * Number(range.value) / 100 / tick) * tick;
      this.fields.qty.input.value = qty.toFixed(this.feed.quantityPrecision());
      box.style.setProperty('--slider-fraction', String(Number(range.value) / 100)); this.feed.dirty = true;
    };
    box.append(track, range, marks); this.form.append(box);
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
  setType(type) { this.type = type; this.select.value = type; this.feed.dirty = true; }
  setPrice(value) { this.setType('limit'); this.fields.price.input.value = value; }
  render() {
    const coin = this.feed.symbol.split('_')[0], logged = this.api.logged(), wallet = this.api.state?.futures.wallet || '0';
    const leverage = this.leverage(); this.leverageButton.textContent = leverage + 'x';
    [...this.tabs.children].forEach((control, index) => control.classList.toggle('selected', TYPES[index][0] === this.type));
    this.available.textContent = '可用 ' + money(wallet) + ' USDT'; this.fields.qty.suffix.textContent = coin;
    const field = this.fields.price;
    field.text.textContent = this.type === 'stop_market' ? '触发价 · 最新价格' : '价格';
    field.input.readOnly = this.type === 'market'; field.input.placeholder = this.type === 'market' ? '市场最优价格' : '';
    if (this.type === 'market') field.input.value = '';
    this.fields.tp.row.hidden = this.fields.sl.row.hidden = !this.tpsl.checked;
    const priceValue = this.orderPrice(), qty = Number(this.fields.qty.input.value || 0);
    for (const [side, entry] of Object.entries(this.buttons)) {
      entry.control.textContent = this.busy ? '提交中…' : !logged ? '登录'
        : this.reduce.checked ? side === 'buy' ? '平空' : '平多' : side === 'buy' ? '开多' : '开空';
      entry.control.disabled = !!this.busy;
      entry.cost.textContent = '成本 ' + money(this.reduce.checked ? 0 : priceValue * qty * (1 / leverage + 0.0005))
        + ' USDT\n最大 ' + quantity(this.maximum(), this.feed.quantityPrecision()) + ' ' + coin;
      const projected = { entry: String(priceValue), qty: String(qty), margin: String(priceValue * qty / leverage),
        mmr: this.feed.spec?.maintenance_rate || '0', side: side === 'buy' ? 'long' : 'short' };
      const liq = qty && priceValue ? positionMetrics(projected, priceValue).liq : 0;
      entry.liq.textContent = '预估强平价 ' + (liq > 0 && !this.reduce.checked ? price(liq, this.feed.precision()) : '--');
    }
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
