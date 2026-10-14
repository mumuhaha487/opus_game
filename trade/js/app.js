// 交易所启动、hash 路由、桌面与手机布局协调。
// 规格 9.11、13：非法交易对回默认路由；现货和合约共用真实行情。
// DESIGN §4、§6、§7：常驻页面、导航不增长历史，行情接收与视图刷新分离。
import { Feed } from './feed.js';
import { Chart } from './chart.js';
import { Book } from './book.js';
import { Tape } from './tape.js';
import { MarketList } from './marketlist.js';
import { TradeApi } from './api.js';
import { Spot } from './spot.js';
import { Futures } from './futures.js';
import { Orders } from './orders.js';
import { Assets } from './assets.js';
import { Modals } from './modals.js';
import { Navigation } from './navigation.js';
import { AshareFeed } from './ashare/feed.js';
import { WalletView } from './wallet.js';
import { Overview } from './overview.js';
import { segment } from './ui.js';
import { Search } from './ashare/search.js';
import { Watchlist } from './ashare/watch.js';
import { Screener } from './ashare/screener.js';
import { Stock } from './ashare/stock.js';
import { HOT_STOCKS } from './ashare/universe.js';
import { RenderSchedule } from './render-schedule.js';
import { badge } from './ui.js';
import { element, button, icon, gift, price, percent, quantity, large, countdown, direction } from './format.js';
const node = id => document.getElementById(id);
const renderSchedule = new RenderSchedule(), firstAshareLists = new Set();
const feed = new Feed();
// DESIGN §6：两个市场连接在入口建立，导航保留已有实例；隐藏60秒后统一暂停。
feed.connect('spot'); feed.setFuturesWanted(true);
const ashare = new AshareFeed(() => {
  feed.dirty = true;
  for (const name of ['list', 'ranking']) if (ashare[name].length && !firstAshareLists.has(name)) {
    firstAshareLists.add(name); renderSchedule.last.lists = -Infinity;
  }
});
const wallet = new WalletView(() => { feed.dirty = true; });
let modals;
const api = new TradeApi(() => { feed.dirty = true; }, text => modals.toast(text));
modals = new Modals(api);
modals.wallet = wallet; api.onDisclaimer = () => modals.disclaimer();
const spot = new Spot(node('spot-form'), feed, api, modals);
const futures = new Futures(node('futures-form'), feed, api, modals);
const book = new Book(node('book'), feed, value => (feed.market === 'spot' ? spot : futures).setPrice(value));
const tape = new Tape(node('tape'), feed);
// DESIGN §4.6：成交面板仍是同一个实例，电脑端收进盘口分段，手机图表页沿用原aux。
function placeTape() {
  const target = feed.mobile() ? node('aux') : node('book');
  if (node('tape').parentElement !== target) target.append(node('tape'));
}
placeTape();
const side = new MarketList(node('side'), feed);
const markets = new MarketList(node('markets-page'), feed, true);
const orders = new Orders(node('orders'), feed, api, modals);
const assets = new Assets(node('assets-page'), feed, api, modals, ashare, wallet, hash => navigation.go(hash));
const chart = new Chart(node('chart'), feed, interval => feed.activate(feed.market, feed.symbol, interval), toggleChart);
const compactTabs = segment([['chart', '图表'], ['book', '盘口']], tab => {
  node('desk').classList.toggle('compact-book', tab === 'book');
}); compactTabs.classList.add('compact-chart-tabs'); node('chart').prepend(compactTabs);
const NAVIGATION = [['overview', '总览'], ['ashare', 'A股'], ['crypto', '加密'],
  ['futures', '合约'], ['assets', '资产'], ['api', 'API']];
const NAV_ICONS = [
  [['rect', { x: 3, y: 3, width: 8, height: 8, rx: 1.5 }], ['rect', { x: 13, y: 3, width: 8, height: 5, rx: 1.5 }],
    ['rect', { x: 13, y: 10, width: 8, height: 11, rx: 1.5 }], ['rect', { x: 3, y: 13, width: 8, height: 8, rx: 1.5 }]],
  [['path', { d: 'M7 3v4M7 15v6M17 3v6M17 17v4' }], ['rect', { x: 5, y: 7, width: 4, height: 8, rx: 1 }],
    ['rect', { x: 15, y: 9, width: 4, height: 8, rx: 1 }]],
  [['circle', { cx: 12, cy: 12, r: 9 }],
    ['path', { d: 'M9.5 8h4a2 2 0 0 1 0 4h-4m0 0h4.5a2 2 0 0 1 0 4H9.5zM9.5 8v8M11 6.5V8M11 16v1.5' }]],
  [['path', { d: 'M4 18 20 6' }], ['circle', { cx: 7, cy: 16, r: 2.5 }], ['path', { d: 'M3 21h18M15 6h5v5' }]],
  [['rect', { x: 3, y: 6, width: 18, height: 13, rx: 2 }], ['path', { d: 'M3 10h18' }],
    ['circle', { cx: 16, cy: 14.5, r: 1.2, fill: 'currentColor' }]],
  [['path', { d: 'm9 8-4 4 4 4M15 8l4 4-4 4M13 6l-2 12' }]],
];
let page = 'overview', picker, pickerList, accountSignature = '';
const navigation = new Navigation({ overview: node('overview-page'), ashare: node('ashare-page'),
  crypto: node('markets-page'), assets: node('assets-page'), desk: node('desk'), stock: node('stock-page') }, route);
const overview = new Overview(node('overview-page'), feed, ashare, api, modals, wallet, hash => navigation.go(hash));
const watch = new Watchlist(api, modals, () => {
  feed.dirty = true; ashare.configure(page, stock.code, watch.codes.length ? watch.codes : HOT_STOCKS.map(([code]) => code));
});
const screener = new Screener(node('ashare-page'), ashare, overview, watch);
const stock = new Stock(node('stock-page'), ashare, api, modals, watch);
new Search(node('global-search'), node('search-results'));
const barElements = createBar();
for (const id of ['desktop-nav', 'mobile-nav']) NAVIGATION.forEach(([route, label], index) => {
  const link = element('a'); link.href = '#/' + route + (['spot', 'futures'].includes(route) ? '/BTC_USDT' : '');
  link.dataset.route = route;
  if (id === 'mobile-nav' && ['futures', 'api'].includes(route)) return;
  if (route === 'api') link.href = '../developer/index.html';
  const glyph = icon(NAV_ICONS[index], 22); glyph.setAttribute('stroke-width', '1.6');
  link.append(glyph, element('span', label)); node(id).append(link);
});
const auxiliaryTabs = node('aux-tabs');
auxiliaryTabs.append(button('最新成交', () => setAux('tape')), button('市场', () => setAux('side')));
node('aux').classList.add('show-tape');
function setAux(selected) {
  if (document.body.classList.contains('mobile-chart')) {
    document.body.classList.toggle('show-chart-book', selected === 'side');
  } else {
    node('aux').classList.toggle('show-tape', selected === 'tape');
    node('aux').classList.toggle('show-side', selected === 'side');
  }
  feed.dirty = true;
}
function toggleChart() {
  const mobile = feed.mobile();
  document.body.classList.toggle(mobile ? 'mobile-chart' : 'chart-fullscreen');
  const expanded = document.body.classList.contains('mobile-chart');
  auxiliaryTabs.children[1].textContent = expanded ? '订单簿' : '市场';
  feed.dirty = true;
}
function closeChart() {
  document.body.classList.remove('mobile-chart', 'chart-fullscreen', 'show-chart-book');
  auxiliaryTabs.children[1].textContent = '市场'; feed.dirty = true;
}
function openPicker() {
  if (picker) { closePicker(); return; }
  picker = element('section', '', 'panel market-picker');
  picker.append(button('返回', closePicker)); pickerList = new MarketList(picker, feed, false, closePicker);
  if (page === 'futures') pickerList.selectTab('futures');
  document.body.append(picker); pickerList.render(); pickerList.search.focus();
}
function closePicker() { picker?.remove(); picker = null; pickerList = null; }
function header() {
  const signature = JSON.stringify([GameAccount.profile(), api.state?.checkin.checkedToday, api.state?.wallet,
    wallet.currency, wallet.rate]);
  if (signature === accountSignature) return; accountSignature = signature;
  const checkin = button('', () => modals.checkin(), 'checkin-button');
  checkin.append(gift(), element('span', '每日签到'));
  checkin.classList.toggle('unchecked', !api.state?.checkin.checkedToday);
  const chip = element('a', '', 'wallet-chip'); chip.href = '#/assets';
  chip.append(element('span', '钱包', 'muted'), element('b', wallet.display(+(api.state?.wallet.usd || 0))));
  const currency = segment([['CNY', 'CNY'], ['USD', 'USD']], value => wallet.select(value), wallet.currency || 'USD');
  const controls = [chip, currency, checkin], profile = GameAccount.profile();
  const railControls = [button('', () => modals.checkin(), 'rail-checkin')];
  const present = icon([['rect', { x: 4, y: 9, width: 16, height: 4, rx: 1 }],
    ['rect', { x: 5, y: 13, width: 14, height: 7, rx: 1 }],
    ['path', { d: 'M12 9v11M12 9c-2-3.5-6-3.5-6-1.5S10 9 12 9c2 0 6 .5 6-1.5S14 5.5 12 9' }]], 22);
  present.setAttribute('stroke-width', '1.6'); railControls[0].append(present); railControls[0].title = '签到';
  railControls[0].classList.toggle('unchecked', !api.state?.checkin.checkedToday);
  if (profile) {
    const menu = element('details', '', 'user-menu'), options = element('div');
    const avatar = element('summary', profile.name[0].toUpperCase()); avatar.title = profile.name; menu.append(avatar);
    for (const [label, target] of [['资产', '#/assets'], ['返回游戏汇总', '../index.html']]) {
      const link = element('a', label); link.href = target; options.append(link);
    }
    options.append(button('退出登录', async () => {
      try { await GameAccount.logout(); api.accountChanged(); } catch (error) { modals.error(error); }
    })); menu.append(options); railControls.push(menu);
    controls.push(button(profile.name, () => navigation.go('#/assets'), 'mobile-account'));
  } else {
    controls.push(button('登录', () => modals.login(), 'mobile-account'));
    const login = button('', () => modals.login(), 'rail-login'), circle = element('span', '', 'avatar');
    const user = icon([['circle', { cx: 12, cy: 8, r: 4 }], ['path', { d: 'M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6' }]], 18);
    user.setAttribute('stroke-width', '1.6'); circle.append(user); login.append(circle, element('span', '登录'));
    railControls.push(login);
  }
  node('header-actions').replaceChildren(...controls);
  node('rail-actions').replaceChildren(...railControls);
}
function createBar() {
  const pair = element('div', '', 'pair-control');
  const logo = badge('BTC', 'BTC'), subtitle = element('small', '', 'pair-subtitle');
  const back = button('返回', closeChart), pairButton = button('', openPicker, 'pair-button');
  const tag = element('span', '', 'market-tag'), identity = element('div'); identity.append(pairButton, subtitle);
  const favorite = button('☆', () => {
    const row = markets.rows.find(entry => entry.market.spot === feed.symbol); row?.star.click(); feed.dirty = true;
  }, 'star'); pair.append(back, logo, identity, tag, favorite);
  const latest = element('div', '', 'latest-price');
  const cells = Array.from({ length: 8 }, (unusedCell, index) => {
    const cell = element('div', '', 'bar-stat'), label = element('span'), absolute = element('b', '', 'change-absolute');
    const value = element('b'); cell.append(label); if (index === 0) cell.append(absolute); cell.append(value);
    return { cell, label, absolute, value };
  });
  const mobile = element('div', '', 'bar-mobile-actions'), dot = element('i', '', 'connection-dot');
  const giftButton = button('', () => modals.checkin(), 'checkin-button'); giftButton.append(gift());
  giftButton.setAttribute('aria-label', '每日签到');
  mobile.append(dot, button('▥', toggleChart, 'mobile-chart-button'), giftButton);
  node('bar').append(pair, latest, ...cells.map(entry => entry.cell), mobile);
  return { back, pairButton, tag, latest, cells, dot, giftButton, logo, subtitle, favorite };
}
function bar() {
  const ticker = feed.tickers[feed.market].get(feed.symbol) || {}, coin = feed.symbol.split('_')[0];
  const view = barElements;
  view.back.hidden = !document.body.classList.contains('mobile-chart');
  view.pairButton.textContent = coin + '/USDT' + (feed.mobile() ? ' ▾' : '');
  view.logo.textContent = coin[0]; view.logo.style.background = badge(coin, coin).style.background;
  view.subtitle.textContent = coin + '/USDT · ' + (feed.market === 'spot' ? '现货' : '永续') + ' · ' + (feed.source || 'Gate.io');
  view.favorite.textContent = markets.favorites.includes(coin) ? '★' : '☆';
  view.tag.textContent = feed.market === 'spot' ? '现货' : '永续';
  view.latest.textContent = price(ticker.last, feed.precision()) + (feed.priceUp ? ' ↑' : ' ↓');
  view.latest.className = 'latest-price ' + (feed.priceUp ? 'up' : 'down');
  const statistics = [
    ['24h涨跌', percent(ticker.change_percentage), 'change ' + direction(ticker.change_percentage)],
    ['24h最高', price(ticker.high_24h, feed.precision())], ['24h最低', price(ticker.low_24h, feed.precision())],
    ['24h成交量(' + coin + ')', quantity(ticker.base_volume || ticker.volume_24h_base, feed.quantityPrecision())],
    ['24h成交额(USDT)', large(ticker.quote_volume || ticker.volume_24h_quote)],
  ];
  if (feed.market === 'futures') {
    const funding = ticker.funding_rate || feed.spec?.funding_rate;
    statistics.push(['标记价格', price(ticker.mark_price || feed.spec?.mark_price, feed.precision())],
      ['指数价格', price(ticker.index_price || feed.spec?.index_price, feed.precision())],
      ['资金费率 / 倒计时', (Number(funding || 0) * 100).toFixed(4) + '% / '
        + countdown(Number(feed.spec?.funding_next_apply || 0) - Date.now() / 1000), direction(funding)]);
  }
  view.cells.forEach((entry, index) => {
    entry.cell.hidden = index >= statistics.length; if (entry.cell.hidden) return;
    const [label, value, className = ''] = statistics[index];
    entry.cell.className = 'bar-stat ' + className; entry.label.textContent = label; entry.value.textContent = value;
    entry.value.className = index === 0 ? 'chg ' + direction(ticker.change_percentage) : '';
    if (className.startsWith('change')) {
      const change = Number(ticker.change_percentage), previous = Number(ticker.last) / (1 + change / 100);
      const absolute = Number(ticker.last) - previous;
      entry.absolute.textContent = (absolute > 0 ? '+' : '') + price(absolute, feed.precision()) + ' ';
    }
  });
  view.dot.style.backgroundColor = connectionColor();
  view.giftButton.classList.toggle('unchecked', !api.state?.checkin.checkedToday);
  node('bar').classList.toggle('futures-bar', feed.market === 'futures');
  document.title = ticker.last ? price(ticker.last, feed.precision()) + ' | ' + coin + 'USDT | 模拟交易所'
    : '模拟交易所 · GAME.INC.RE';
}
function connectionColor() {
  const active = page === 'stock' || page === 'ashare' ? ashare : feed;
  return active.status === 'failed' ? '#E5484D' : active.degraded ? '#F2C66D'
    : active.status === 'connected' ? '#22B573' : '#F2C66D';
}
function status() {
  const active = page === 'stock' || page === 'ashare' ? ashare : feed, state = active.status;
  node('connection-status').textContent = ashare.listBusy && ['ashare', 'overview'].includes(page) ? '列表更新放缓'
    : state === 'connected' ? '实时行情已连接'
    : state === 'failed' ? '行情暂不可用，正在重试' : '行情重连中…';
  node('feed-source').textContent = '数据来源 ' + (active.source || (active === ashare ? '腾讯行情' : 'Gate.io'));
  document.body.classList.toggle('feed-unavailable', state === 'failed');
  node('connection-dot').style.backgroundColor = connectionColor();
}
function mobileChartActions() {
  node('chart-mobile-actions').replaceChildren(...[['buy', page === 'futures' ? '开多' : '买入'],
    ['sell', page === 'futures' ? '开空' : '卖出']].map(([side, label]) => button(label, () => {
    (page === 'futures' ? futures : spot).side = side; closeChart();
  }, side === 'buy' ? 'buy-button' : 'sell-button')));
}
async function route() {
  const parts = location.hash.slice(2).split('?')[0].split('/');
  const requested = parts[0] === 'markets' ? 'crypto' : parts[0], symbol = parts[1];
  const marketPage = ['spot', 'futures'].includes(requested);
  const valid = ['overview', 'ashare', 'crypto', 'assets', 'spot', 'futures', 'stock'];
  if (!valid.includes(requested) || marketPage && (!symbol
    || !globalThis.TRADE_MARKETS.some(market => market.spot === symbol))
    || requested === 'stock' && !/^(sh|sz)\d{6}$/.test(symbol || '')
    || parts.length > (marketPage || requested === 'stock' ? 2 : 1)) {
    navigation.go('#/overview'); return;
  }
  closePicker(); closeChart(); page = requested;
  feed.sources.listVisible = () => ['crypto', 'overview'].includes(page)
    || [...document.querySelectorAll('.market-body')].some(node => node.getClientRects().length > 0);
  if (page === 'stock') stock.setCode(symbol);
  const pool = watch.codes.length ? watch.codes : HOT_STOCKS.map(([code]) => code);
  ashare.configure(page, page === 'stock' ? symbol : null, [...pool, ...(api.state?.ashare.holdings.map(row => row.code) || [])]);
  navigation.show(marketPage ? 'desk' : page, page);
  node('spot-form').hidden = page === 'futures'; node('futures-form').hidden = page !== 'futures';
  for (const link of document.querySelectorAll('[data-route]')) {
    const selected = link.dataset.route === page || page === 'spot' && link.dataset.route === 'crypto'
      || page === 'stock' && link.dataset.route === 'ashare'
      || feed.mobile() && page === 'futures' && link.dataset.route === 'crypto';
    link.classList.toggle('selected', selected);
    if (['spot', 'futures'].includes(link.dataset.route)) link.href = '#/' + link.dataset.route + '/' + (symbol || feed.symbol);
  }
  const active = page === 'stock' ? 'ashare' : page === 'spot' ? 'crypto' : page;
  const index = NAVIGATION.findIndex(([name]) => name === active);
  node('rail-indicator').style.transform = 'translateY(' + Math.max(0, index) * 60 + 'px)';
  node('page-title').textContent = NAVIGATION.find(([name]) => name === active)?.[1] || '交易';
  orders.signature = ''; api.previousPrice = null;
  api.previousMark = null; orders.tab = page === 'futures' ? 'positions' : 'open';
  if (marketPage) await feed.activate(page, symbol, '15m');
  else if (!feed.connections.spot) await feed.activate('spot', feed.symbol, '15m');
  if (page === 'futures') side.selectTab('futures'); else side.selectTab('spot');
  if (page === 'crypto') feed.setFuturesWanted(markets.tab === 'futures');
  feed.dirty = true; mobileChartActions();
}
function renderFrame(timestamp) {
  if (!document.hidden) renderSchedule.run(timestamp, {
    fast: () => {
      header(); status(); watch.sync(api.state);
      if (['spot', 'futures'].includes(page)) { bar(); book.render(); tape.render(api.state); api.crossing(feed); }
      if (page === 'stock') { stock.renderHead(); stock.renderBook(); }
    },
    chart: () => {
      if (['spot', 'futures'].includes(page)) {
        chart.render(api.state); if (page === 'spot') spot.render(); else futures.render();
      }
      if (page === 'stock') { stock.chart.render(); stock.renderTicket(); }
    },
    lists: () => {
      if (page === 'crypto') markets.render();
      else if (page === 'overview') overview.render(api.state);
      else if (page === 'ashare') screener.render();
      else if (page === 'assets') assets.render(api.state);
      else if (page === 'stock') stock.renderDock(api.state);
      else { side.render(); orders.render(api.state); }
      pickerList?.render();
    },
  });
  requestAnimationFrame(renderFrame);
}
document.addEventListener('keydown', event => { if (event.key === 'Escape') { closeChart(); closePicker(); } });
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer); resizeTimer = setTimeout(() => {
    feed.activate(feed.market, feed.symbol, feed.interval).then(() => {
      feed.setFuturesWanted(page === 'crypto' ? markets.tab === 'futures' : side.tab === 'futures');
    });
    placeTape(); orders.signature = ''; feed.dirty = true;
  }, 200);
});
setInterval(() => { feed.dirty = true; }, 1000);
// DESIGN §4.4：迷你图刷新由页面拥有计时器，纯数据Feed构造不启动后台任务。
feed.loadMiniCharts();
setInterval(() => { if (!document.hidden) feed.loadMiniCharts(); }, 30000);
route(); api.refresh(); requestAnimationFrame(renderFrame);
modals.initialDisclaimer().then(() => {
  if (location.hash.includes('checkin=1')) modals.checkin();
});
