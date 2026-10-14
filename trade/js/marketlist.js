// 市场列表共用于侧栏、行情页和交易对选择页。
// 规格 9.3、9.9、9.11：39 币搜索、排序、自选和真实永续行情。
// 自选仅存在浏览器 localStorage，失败时保留本次内存选择。
import { element, button, icon, price, percent, large, direction } from './format.js';
import { navigate } from './navigation.js';
import { title, badge } from './ui.js';
export class MarketList {
  constructor(panel, feed, full = false, onNavigate) {
    this.feed = feed; this.full = full; this.onNavigate = onNavigate; this.tab = 'spot';
    this.sortField = 'coin'; this.reverse = false; this.metric = 'change'; this.query = '';
    this.favorites = [];
    if (full) panel.append(title('MARKETS', '加密行情'));
    try { const saved = JSON.parse(localStorage.getItem('trade_fav_v1')); if (Array.isArray(saved)) this.favorites = saved; }
    catch { /* storage unavailable */ }
    this.search = element('input', '', 'market-search'); this.search.type = 'search'; this.search.placeholder = '搜索';
    this.search.oninput = () => { this.query = this.search.value.trim().toLowerCase(); feed.dirty = true; };
    const searchBox = element('div', '', 'market-search-box');
    searchBox.append(icon([['circle', { cx: 10, cy: 10, r: 6 }], ['path', { d: 'M15 15l5 5' }]], 16), this.search);
    panel.append(searchBox);
    this.tabs = element('div', '', 'market-tabs seg'); this.tabButtons = new Map();
    for (const [tab, label] of [['spot', '现货'], ['futures', '永续'], ['favorites', '自选']]) {
      const control = button(label, () => this.selectTab(tab)); this.tabs.append(control); this.tabButtons.set(tab, control);
    }
    panel.append(this.tabs);
    const headings = full ? ['交易对', '最新价', '24h涨跌', '24h最高', '24h最低', '24h成交额', '操作'] : ['交易对', '最新价', '涨跌幅'];
    this.header = element('div', '', 'market-header');
    headings.forEach((label, index) => this.header.append(button(label, () => {
      const fields = ['coin', 'last', 'change', 'high', 'low', 'volume'];
      if (index === 2 && !full) this.metric = this.metric === 'change' ? 'volume' : 'change';
      this.sortField = index === 2 ? this.metric : fields[index] || 'coin'; this.reverse = !this.reverse; feed.dirty = true;
    })));
    panel.append(this.header); this.body = element('div', '', 'market-body'); panel.append(this.body);
    this.rows = globalThis.TRADE_MARKETS.map(market => this.createRow(market));
    this.rows.forEach(entry => this.body.append(entry.row));
  }
  selectTab(tab) {
    this.tab = tab; this.feed.setFuturesWanted(tab === 'futures'); this.feed.dirty = true;
  }
  navigate(market, symbol) {
    navigate('#/' + market + '/' + symbol);
    if (this.onNavigate) this.onNavigate();
  }
  createRow(market) {
    const row = element('div', '', 'market-row'), name = element('div', '', 'market-name');
    row.tabIndex = 0; row.setAttribute('role', 'link');
    row.onkeydown = event => { if (event.key === 'Enter') this.navigate(this.tab === 'futures' ? 'futures' : 'spot', market.spot); };
    const star = button('☆', event => {
      event.stopPropagation();
      this.favorites = this.favorites.includes(market.coin) ? this.favorites.filter(coin => coin !== market.coin)
        : [...this.favorites, market.coin];
      try { localStorage.setItem('trade_fav_v1', JSON.stringify(this.favorites)); } catch { /* storage unavailable */ }
      this.feed.dirty = true;
    }, 'star');
    name.append(star, element('b', market.coin), element('span', '/USDT', 'muted'));
    if (this.full) name.prepend(badge(market.coin, market.coin));
    if (this.full) name.append(element('small', market.name, 'coin-chinese muted'));
    const tag = element('small', '永续', 'perp-tag'); name.append(tag);
    const volume = element('small', '', 'market-volume'); name.append(volume);
    const last = element('span', '--', 'market-last'), change = element('span', '--', 'market-change');
    const extra = [element('span'), element('span'), element('span')], actions = element('div', '', 'market-actions');
    actions.append(button('现货', event => { event.stopPropagation(); this.navigate('spot', market.spot); }),
      button('合约', event => { event.stopPropagation(); this.navigate('futures', market.perp); }));
    row.append(name, last, change);
    if (this.full) row.append(...extra, actions);
    row.addEventListener('click', () => this.navigate(this.tab === 'futures' ? 'futures' : 'spot', market.spot));
    return { row, market, star, tag, volume, last, change, extra };
  }
  render() {
    const marketType = this.tab === 'futures' ? 'futures' : 'spot';
    // DESIGN §8：手机市场分段使用「合约」，电脑端保持「永续」。
    this.tabButtons.get('futures').textContent = this.feed.mobile() ? '合约' : '永续';
    this.tabButtons.get('favorites').textContent = this.full && this.feed.mobile() ? '自选' : '☆ 自选';
    for (const [tab, control] of this.tabButtons) control.classList.toggle('selected', this.tab === tab);
    this.header.children[2].textContent = this.full ? '24h涨跌' : this.metric === 'change' ? '涨跌幅' : '成交额';
    const tickers = this.feed.tickers[marketType];
    const fieldValue = entry => {
      const ticker = tickers.get(entry.market.spot) || {};
      return { coin: entry.market.coin, last: Number(ticker.last || 0), change: Number(ticker.change_percentage || 0),
        high: Number(ticker.high_24h || 0), low: Number(ticker.low_24h || 0),
        volume: Number(ticker.quote_volume || ticker.volume_24h_quote || 0) }[this.sortField];
    };
    const rows = [...this.rows].sort((left, right) => {
      const first = fieldValue(left), second = fieldValue(right);
      const comparison = typeof first === 'string' ? first.localeCompare(second) : first - second;
      return this.reverse ? -comparison : comparison;
    });
    for (const entry of rows) {
      const { market, row, last, change, star, tag, volume, extra } = entry, ticker = tickers.get(market.spot);
      const favorite = this.favorites.includes(market.coin);
      row.hidden = (this.tab === 'favorites' && !favorite)
        || !!this.query && ![market.coin, market.name].some(value => value.toLowerCase().includes(this.query));
      star.textContent = favorite ? '★' : '☆'; star.classList.toggle('favorite', favorite); tag.hidden = marketType !== 'futures';
      const specification = this.feed.specs.get(marketType + ':' + market.spot)?.value;
      const precision = marketType === 'spot' ? specification?.precision
        : specification ? (String(specification.order_price_round).split('.')[1] || '').length : undefined;
      const digits = precision ?? (ticker?.last ? (String(ticker.last).split('.')[1] || '').length : 1);
      last.textContent = price(ticker?.last, digits);
      const amount = ticker?.quote_volume || ticker?.volume_24h_quote;
      change.textContent = this.metric === 'volume' && !this.full ? large(amount) : percent(ticker?.change_percentage);
      change.className = 'market-change chg ' + direction(ticker?.change_percentage);
      volume.textContent = this.full && this.feed.mobile() ? market.name + ' · ' + large(amount) : '成交额 ' + large(amount);
      extra[0].textContent = price(ticker?.high_24h, digits); extra[1].textContent = price(ticker?.low_24h, digits);
      extra[2].textContent = large(amount); this.body.append(row);
    }
  }
}
