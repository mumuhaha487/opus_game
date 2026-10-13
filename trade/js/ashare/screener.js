// ASHARE §6、DESIGN §4.5：五指数、板块/排序/搜索、50行分页与云自选。
import { element, button, money, large, countdown } from '../format.js';
import { title, segment, table, change } from '../ui.js';
import { BOARDS, SORTS, HOT_STOCKS, INDICES } from './universe.js';
import { Search } from './search.js';
export class Screener {
  constructor(panel, feed, overview, watch) {
    Object.assign(this, { panel, feed, overview, watch }); panel.replaceChildren();
    this.indices = element('div', '', 'index-cards'); this.status = element('div', '', 'ashare-status');
    this.section = element('section', '', 'panel'); this.section.append(title('SCREENER', '选股'));
    const controls = element('div', '', 'screener-controls');
    controls.append(segment(BOARDS.map(([name], index) => [index, name]), value => this.select('board', value)));
    const sort = element('select'); sort.setAttribute('aria-label', '排序');
    SORTS.forEach(([label], index) => { const option = element('option', label); option.value = index; sort.append(option); });
    sort.onchange = () => this.select('sort', +sort.value); controls.append(sort);
    const searchBox = element('div', '', 'stock-search'), input = element('input'), results = element('div'); results.hidden = true;
    input.placeholder = '代码 / 名称 / 拼音'; input.setAttribute('aria-label', '搜索A股');
    searchBox.append(input, results); new Search(input, results); controls.append(searchBox);
    this.body = element('div'); this.pager = element('div', '', 'pager'); this.pageLabel = element('span');
    this.previous = button('上一页', () => this.select('pageNumber', Math.max(1, feed.pageNumber - 1)));
    this.next = button('下一页', () => this.select('pageNumber', feed.pageNumber + 1));
    this.pager.append(this.previous, this.pageLabel, this.next); this.section.append(controls, this.body, this.pager);
    this.favorites = element('section', '', 'panel stock-watch'); panel.append(this.indices, this.status, this.section, this.favorites);
  }
  select(field, value) {
    this.feed[field] = value; if (field !== 'pageNumber') this.feed.pageNumber = 1;
    this.feed.schedule(); this.render();
  }
  render() {
    this.indices.replaceChildren(...INDICES.map(([code, name]) => this.overview.ticker(code, name, true)));
    const clock = this.feed.clock();
    this.status.replaceChildren(element('span', clock.label, 'market-status ' + clock.status),
      element('span', (clock.status === 'open' ? '距离收盘 ' : '距离开盘 ') + countdown((clock.target - Date.now()) / 1000)),
      element('small', '仅教学练习 · 不构成投资建议', 'muted'));
    this.body.replaceChildren(table(['代码', '名称', '最新价', '涨跌幅', '涨跌额', '成交额', '换手率', '最高', '最低', '操作'],
      this.feed.list.map(row => this.values(row))));
    if (!this.feed.list.length) this.body.append(element('p', '行情连接中断，正在重试', 'muted'));
    this.pageLabel.textContent = this.feed.pageNumber + ' / ' + Math.max(1, Math.ceil(this.feed.total / 50));
    this.previous.disabled = this.feed.pageNumber === 1; this.next.disabled = this.feed.pageNumber * 50 >= this.feed.total;
    const codes = this.watch.codes.length ? this.watch.codes : HOT_STOCKS.map(([code]) => code);
    this.favorites.replaceChildren(title('WATCHLIST', this.watch.codes.length ? '自选' : '热门 A 股'),
      table(['代码', '名称', '最新价', '涨跌幅', '操作'], codes.map(code => {
        const quote = this.feed.quotes[code], name = quote?.name || HOT_STOCKS.find(row => row[0] === code)?.[1] || code;
        return [code, name, money(quote?.last), change(quote?.percent), this.actions(code)];
      })));
  }
  values(row) {
    const name = element('span', row.name); name.append(element('small', row.code, 'dim'));
    return [row.code, name, money(row.last), change(row.percent), money(row.change), large(row.turnover),
      money(row.turnoverRate) + '%', money(row.high), money(row.low), this.actions(row.code)];
  }
  actions(code) {
    const actions = element('div', '', 'stock-actions'), link = element('a', '交易', 'accent'); link.href = '#/stock/' + code;
    actions.append(link, button(this.watch.codes.includes(code) ? '★' : '☆', () => this.watch.toggle(code), 'star'));
    return actions;
  }
}
