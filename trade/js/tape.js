// 最新公开成交与当前账号成交的固定行视图。
// 规格 9.3：最多 60 行，主动买绿、主动卖红。
// 数据刷新只修改现有单元格，手机图表页共用本模块。
import { element, button, price, quantity, time } from './format.js';
export class Tape {
  constructor(panel, feed) {
    this.feed = feed; this.mine = false; this.panel = panel;
    this.tabs = element('div', '', 'tape-tabs');
    this.tabs.append(button('最新成交', () => { this.mine = false; feed.dirty = true; }));
    this.mineButton = button('我的成交', () => { this.mine = true; feed.dirty = true; }); this.tabs.append(this.mineButton);
    this.header = element('div', '', 'book-header'); panel.append(this.tabs, this.header);
    this.rows = Array.from({ length: 60 }, () => {
      const row = element('div', '', 'tape-row'), cells = Array.from({ length: 3 }, () => element('span'));
      row.append(...cells); panel.append(row); return { row, cells };
    });
  }
  render(state) {
    const feed = this.feed; this.mineButton.hidden = !state;
    this.header.replaceChildren(...['价格(USDT)', '数量(' + feed.symbol.split('_')[0] + ')', '时间'].map(text => element('span', text)));
    const trades = this.mine && state ? state.recent.trades.filter(trade =>
      trade.symbol === feed.symbol && trade.market === feed.market) : feed.trades;
    const count = Math.max(0, Math.min(60, Math.floor((this.panel.clientHeight - 64) / 20)));
    this.rows.forEach(({ row, cells }, index) => {
      row.hidden = index >= count; const trade = trades[index];
      cells[0].textContent = trade ? price(trade.price, feed.precision()) : '--';
      cells[0].className = trade?.side === 'buy' ? 'up' : 'down';
      cells[1].textContent = trade ? quantity(trade.qty, feed.quantityPrecision()) : '--';
      cells[2].textContent = trade ? time(trade.time || trade.t) : '--';
    });
  }
}
