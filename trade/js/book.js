// 固定节点的订单簿视图，展示真实盘口及深度比例。
// 规格 9.3、9.9：桌面 18 / 40 档，手机双边 7 档。
// 行情刷新只更改文字、样式和隐藏属性，不重建档位节点。
import { element, button, price, quantity, money } from './format.js';
import { segment } from './ui.js';
export class Book {
  constructor(panel, feed, onPrice) {
    this.feed = feed; this.view = 'both'; this.factor = 1;
    this.switcher = segment([['book', '盘口'], ['trades', '成交']], tab => {
      panel.classList.toggle('mode-trades', tab === 'trades'); panel.classList.toggle('mode-book', tab === 'book');
    }); this.switcher.classList.add('book-switch'); panel.classList.add('mode-book'); panel.append(this.switcher);
    const title = element('div', '', 'book-title'); title.append(element('span', '订单簿')); this.viewButtons = new Map();
    for (const [mode, colors] of [['both', ['#E5484D', '#22B573']], ['buy', ['#22B573']], ['sell', ['#E5484D']]]) {
      const control = button('', () => { this.view = mode; feed.dirty = true; }, 'book-view');
      control.setAttribute('aria-label', mode === 'both' ? '买卖都显示' : mode === 'buy' ? '只显示买盘' : '只显示卖盘');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 16 16');
      for (let i = 0; i < 4; i++) {
        const bar = document.createElementNS(svg.namespaceURI, 'rect');
        bar.setAttribute('x', '1'); bar.setAttribute('y', String(1 + i * 4)); bar.setAttribute('width', '14');
        bar.setAttribute('height', '2'); bar.setAttribute('fill', colors[Math.floor(i / 2)] || colors[0]); svg.append(bar);
      }
      control.append(svg); title.append(control); this.viewButtons.set(mode, control);
    }
    this.precision = element('select'); this.precision.setAttribute('aria-label', '精度');
    this.precision.onchange = () => { this.factor = Number(this.precision.value); feed.dirty = true; };
    title.append(this.precision); panel.append(title);
    this.header = element('div', '', 'book-header'); panel.append(this.header);
    this.rows = {};
    for (const side of ['asks', 'bids']) {
      const list = element('div', '', 'book-' + side), rows = [];
      for (let i = 0; i < 40; i++) {
        const row = button('', () => { if (row.dataset.price) onPrice(row.dataset.price); }, 'book-row');
        const depth = element('i', '', 'depth'), cells = Array.from({ length: 3 }, () => element('span'));
        row.append(depth, ...cells); list.append(row); rows.push({ row, depth, cells });
      }
      this.rows[side] = { list, rows }; panel.append(list);
      if (side === 'asks') { this.middle = element('div', '', 'book-middle'); panel.append(this.middle); }
    }
    this.ratio = element('div', '', 'book-ratio');
    this.buyRatio = element('span', '', 'up'); this.sellRatio = element('span', '', 'down');
    this.ratioBar = element('i'); this.ratio.append(this.buyRatio, this.sellRatio, this.ratioBar); panel.append(this.ratio);
    this.mobilePrecision = element('div', '', 'mobile-precision'); panel.append(this.mobilePrecision);
    this.mobilePrecision.append(this.precision.cloneNode());
    this.mobilePrecision.firstChild.onchange = () => {
      this.factor = Number(this.mobilePrecision.firstChild.value); this.precision.value = String(this.factor); feed.dirty = true;
    };
  }
  grouped(levels, side) {
    const tick = 10 ** -this.feed.precision() * this.factor, groups = new Map();
    for (const [levelPrice, amount] of levels) {
      const steps = Number(levelPrice) / tick;
      const groupedPrice = (side === 'asks' ? Math.ceil(steps - 1e-8) : Math.floor(steps + 1e-8)) * tick;
      groups.set(groupedPrice, (groups.get(groupedPrice) || 0) + Number(amount));
    }
    return [...groups].sort((left, right) => side === 'asks' ? left[0] - right[0] : right[0] - left[0]);
  }
  render() {
    const feed = this.feed, coin = feed.symbol.split('_')[0], precision = feed.precision();
    for (const [mode, control] of this.viewButtons) {
      control.classList.toggle('selected', this.view === mode);
      if (this.view !== mode) for (const shape of control.querySelectorAll('rect')) shape.setAttribute('fill', '#59616F');
      else for (const shape of control.querySelectorAll('rect')) shape.setAttribute('fill', '#E8EAEE');
    }
    if (this.lastPrecision !== precision) {
      this.lastPrecision = precision;
      for (const select of [this.precision, this.mobilePrecision.firstChild]) {
        select.replaceChildren();
        for (const factor of [1, 10, 50, 100, 1000]) {
          const option = element('option', price(10 ** -precision * factor, precision)); option.value = factor; select.append(option);
        }
        select.value = String(this.factor);
      }
    }
    const headings = ['价格(USDT)', '数量(' + coin + ')', '成交额(USDT)'];
    this.header.replaceChildren(...headings.map(text => element('span', text)));
    // DESIGN §4.6：电脑端买卖各12档，手机沿用7档。
    const count = feed.mobile() ? 7 : this.view === 'both' ? 12 : 24;
    const visible = {};
    for (const side of ['asks', 'bids']) {
      const hidden = !feed.mobile() && (side === 'asks' ? this.view === 'buy' : this.view === 'sell');
      visible[side] = hidden ? [] : this.grouped(feed.book[side], side).slice(0, count);
      if (side === 'asks') visible[side].reverse();
    }
    const maximum = Math.max(1e-18, ...Object.values(visible).flat().map(([levelPrice, qty]) => levelPrice * qty));
    for (const side of ['asks', 'bids']) {
      const hidden = !feed.mobile() && (side === 'asks' ? this.view === 'buy' : this.view === 'sell');
      this.rows[side].list.hidden = hidden;
      this.rows[side].rows.forEach(({ row, depth, cells }, index) => {
        row.hidden = index >= count;
        const [levelPrice, qty] = visible[side][index] || [];
        cells[0].textContent = price(levelPrice, precision); cells[0].className = side === 'asks' ? 'down' : 'up';
        cells[1].textContent = quantity(qty, feed.quantityPrecision()); cells[2].textContent = money(levelPrice * qty);
        depth.style.width = levelPrice ? Math.min(100, levelPrice * qty / maximum * 100) + '%' : '0%';
        depth.style.backgroundColor = side === 'asks' ? 'var(--down-bg)' : 'var(--up-bg)';
        row.dataset.price = levelPrice ? levelPrice.toFixed(precision) : '';
      });
    }
    const last = feed.tickers[feed.market].get(feed.symbol)?.last;
    this.middle.textContent = price(last, precision) + (feed.priceUp ? ' ↑' : ' ↓');
    this.middle.className = 'book-middle ' + (feed.priceUp ? 'up' : 'down');
    if (feed.market === 'futures') this.middle.append(element('small',
      price(feed.tickers.futures.get(feed.symbol)?.mark_price || feed.spec?.mark_price, precision), 'muted'));
    const sum = side => visible[side].reduce((total, row) => total + row[1], 0);
    const ratio = Math.round(sum('bids') / (sum('bids') + sum('asks') || 1) * 100);
    this.buyRatio.textContent = 'B ' + ratio + '%'; this.sellRatio.textContent = 100 - ratio + '% S';
    this.ratioBar.style.backgroundColor = 'var(--down)'; this.ratioBar.style.setProperty('--buy-ratio', ratio + '%');
  }
}
