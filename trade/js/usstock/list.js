// 美股列表页：三大指数、开盘状态（美东/北京时间）、分组筛选、搜索、排序与行情表。
import { element, money, large, countdown } from '../format.js';
import { title, segment, table, change } from '../ui.js';
import { MARKET_LABEL, beijingClock } from './stock.js';
import { nyParts } from './calendar.js';
const usd = value => value == null || !Number.isFinite(+value) || !+value ? '--' : '$' + money(+value);
const SORTS = [['涨幅', (a, b) => b.percent - a.percent], ['跌幅', (a, b) => a.percent - b.percent],
  ['成交额', (a, b) => b.turnover - a.turnover], ['代码', (a, b) => a.ticker.localeCompare(b.ticker)]];
export class UsList {
  constructor(panel, feed) {
    Object.assign(this, { panel, feed, group: 'all', sort: 2, query: '' }); panel.replaceChildren();
    this.indices = element('div', '', 'index-cards'); this.status = element('div', '', 'ashare-status');
    this.section = element('section', '', 'panel'); this.section.append(title('US STOCKS', '美股 · 美元结算'));
    const controls = element('div', '', 'screener-controls');
    controls.append(segment(globalThis.US_GROUPS, value => { this.group = value; this.render(); }, 'all'));
    const sort = element('select'); sort.setAttribute('aria-label', '排序');
    SORTS.forEach(([label], index) => { const option = element('option', label); option.value = index; sort.append(option); });
    sort.value = '2'; sort.onchange = () => { this.sort = +sort.value; this.render(); }; controls.append(sort);
    const search = element('div', '', 'stock-search'), input = element('input');
    input.placeholder = '代码 / 名称，如 AAPL、英伟达'; input.setAttribute('aria-label', '搜索美股');
    input.oninput = () => { this.query = input.value.trim().toUpperCase(); this.render(); }; search.append(input); controls.append(search);
    this.body = element('div'); this.section.append(controls, this.body);
    panel.append(this.indices, this.status, this.section);
  }
  card(ticker, name) {
    const quote = this.feed.quotes[ticker], link = element('a', '', 'ticker-card'); link.href = '#/usstock';
    link.append(element('span', name), element('b', quote ? money(quote.last) : '--'), change(quote?.percent));
    return link;
  }
  render() {
    this.indices.replaceChildren(...globalThis.US_INDICES.map(([code, name]) => this.card(code, name)));
    const market = this.feed.market(), now = Date.now(), ny = nyParts(now);
    const target = market.status === 'open' ? market.closeAt : market.nextOpen;
    this.status.replaceChildren(element('span', MARKET_LABEL[market.status], 'market-status ' + (market.status === 'open' ? 'open' : 'closed')),
      element('span', '美东 ' + String(ny.hour).padStart(2, '0') + ':' + String(ny.minute).padStart(2, '0')
        + ' · ' + (market.status === 'open' ? '距离收盘 ' : '距离开盘 ') + countdown((target - now) / 1000)
        + '（北京时间 ' + beijingClock(target) + '）'),
      element('small', '仅教学练习 · 不构成投资建议 · 人民币需先换成美元', 'muted'));
    const rows = globalThis.US_UNIVERSE.filter(row => (this.group === 'all' || row.group === this.group)
      && (!this.query || row.ticker.includes(this.query) || row.name.toUpperCase().includes(this.query)))
      .map(row => ({ ...row, ...(this.feed.quotes[row.ticker] || { last: 0, percent: 0, change: 0, turnover: 0 }) }))
      .sort(SORTS[this.sort][1]);
    this.body.replaceChildren(table(['代码', '名称', '最新价', '涨跌幅', '涨跌额', '成交额', '最高', '最低', '操作'], rows.map(row => {
      const name = element('span', row.name); name.append(element('small', row.ticker, 'dim'));
      const link = element('a', '交易', 'accent'); link.href = '#/us/' + row.ticker;
      return [row.ticker, name, usd(row.last), change(row.percent), money(row.change), row.turnover ? '$' + large(row.turnover) : '--',
        usd(row.high), usd(row.low), link];
    })));
    if (!rows.length) this.body.append(element('p', '没有匹配的股票（名单内共 ' + globalThis.US_UNIVERSE.length + ' 只）', 'muted'));
    else if (this.feed.status === 'failed' && !Object.keys(this.feed.quotes).length) this.body.append(element('p', '行情连接中断，正在重试', 'muted'));
  }
}
