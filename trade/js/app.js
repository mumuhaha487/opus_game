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
import { element, button, icon, gift, price, percent, quantity, large, countdown, direction } from './format.js';
const node = id => document.getElementById(id);
const feed = new Feed();
const ashare = new AshareFeed(() => { feed.dirty = true; });
const wallet = new WalletView(() => { feed.dirty = true; });
let modals;
const api = new TradeApi(() => { feed.dirty = true; }, text => modals.toast(text));
modals = new Modals(api);
modals.wallet = wallet; api.onDisclaimer = () => modals.disclaimer();
const spot = new Spot(node('spot-form'), feed, api, modals);
const futures = new Futures(node('futures-form'), feed, api, modals);
const book = new Book(node('book'), feed, value => (feed.market === 'spot' ? spot : futures).setPrice(value));
const tape = new Tape(node('tape'), feed);
const side = new MarketList(node('side'), feed);
const markets = new MarketList(node('markets-page'), feed, true);
const orders = new Orders(node('orders'), feed, api, modals);
const assets = new Assets(node('assets-page'), feed, api, modals, ashare, wallet, hash => navigation.go(hash));
const chart = new Chart(node('chart'), feed, interval => feed.activate(feed.market, feed.symbol, interval), toggleChart);
const NAVIGATION = [['overview', '总览'], ['ashare', 'A股'], ['crypto', '加密'],
  ['futures', '合约'], ['assets', '资产'], ['api', 'API']];
const NAV_ICONS = [
  [['polyline', { points: '3,17 9,11 13,15 21,7' }], ['path', { d: 'M15 7h6v6' }]],
  [['path', { d: 'M4 8h13l-3-3M20 16H7l3 3' }]],
  [['rect', { x: 4, y: 3, width: 16, height: 18, rx: 2 }], ['path', { d: 'M8 8h8M8 12h8M8 16h5' }]],
  [['rect', { x: 3, y: 6, width: 18, height: 13, rx: 2 }], ['path', { d: 'M3 10h18' }],
    ['circle', { cx: 16, cy: 14.5, r: 1.2, fill: 'currentColor' }]],
];
let page = 'overview', picker, pickerList, accountSignature = '';
const navigation = new Navigation({ overview: node('overview-page'), ashare: node('ashare-page'),
  crypto: node('markets-page'), assets: node('assets-page'), desk: node('desk'), stock: node('stock-page') }, route);
const overview = new Overview(node('overview-page'), feed, ashare, api, modals, wallet, hash => navigation.go(hash));
node('ashare-page').append(element('span', 'SCREENER', 'px-label'), element('h1', 'A 股行情'));
const barElements = createBar();
for (const id of ['desktop-nav', 'mobile-nav']) NAVIGATION.forEach(([route, label], index) => {
  const link = element('a'); link.href = '#/' + route + (['spot', 'futures'].includes(route) ? '/BTC_USDT' : '');
  link.dataset.route = route;
  if (id === 'mobile-nav' && ['futures', 'api'].includes(route)) return;
  if (route === 'api') link.href = '../developer/index.html';
  const glyph = icon(NAV_ICONS[index % NAV_ICONS.length], 22); glyph.setAttribute('stroke-width', '1.6');
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
  const railControls = [button('签到', () => modals.checkin(), 'rail-checkin')];
  railControls[0].classList.toggle('unchecked', !api.state?.checkin.checkedToday);
  if (profile) {
    const menu = element('details', '', 'user-menu'), options = element('div'); menu.append(element('summary', profile.name));
    for (const [label, target] of [['资产', '#/assets'], ['返回游戏汇总', '../index.html']]) {
      const link = element('a', label); link.href = target; options.append(link);
    }
    options.append(button('退出登录', async () => {
      try { await GameAccount.logout(); api.accountChanged(); } catch (error) { modals.error(error); }
    })); menu.append(options); controls.push(menu); railControls.push(menu.cloneNode(true));
    // 克隆菜单不复制事件，顶部账号菜单直接移入rail；手机保留顶部登录入口。
    railControls.pop(); railControls.push(menu);
  } else {
    controls.push(button('登录', () => modals.login(), 'mobile-account'));
    railControls.push(button('登录', () => modals.login(), 'avatar'));
  }
  node('header-actions').replaceChildren(...controls);
  node('rail-actions').replaceChildren(...railControls);
}
function createBar() {
  const pair = element('div', '', 'pair-control');
  const back = button('返回', closeChart), pairButton = button('', openPicker, 'pair-button');
  const tag = element('span', '', 'market-tag'); pair.append(back, pairButton, tag);
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
  return { back, pairButton, tag, latest, cells, dot, giftButton };
}
function bar() {
  const ticker = feed.tickers[feed.market].get(feed.symbol) || {}, coin = feed.symbol.split('_')[0];
  const view = barElements;
  view.back.hidden = !document.body.classList.contains('mobile-chart');
  view.pairButton.textContent = coin + '/USDT' + (feed.mobile() ? ' ▾' : '');
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
function connectionColor() { return feed.status === 'connected' ? '#0ECB81' : feed.status === 'failed' ? '#F6465D' : '#F0B90B'; }
function status() {
  node('connection-status').textContent = feed.status === 'connected' ? '实时行情已连接'
    : feed.status === 'failed' ? '行情连接失败，正在重试' : '行情重连中…';
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
    || !globalThis.TRADE_MARKETS.some(market => market.spot === symbol)) || parts.length > (marketPage ? 2 : 1)) {
    navigation.go('#/overview'); return;
  }
  closePicker(); closeChart(); page = requested;
  ashare.configure(page, page === 'stock' ? symbol : null, api.state?.ashare.holdings.map(row => row.code) || []);
  navigation.show(marketPage ? 'desk' : page, page);
  node('spot-form').hidden = page === 'futures'; node('futures-form').hidden = page !== 'futures';
  for (const link of document.querySelectorAll('[data-route]')) {
    const selected = link.dataset.route === page || page === 'spot' && link.dataset.route === 'crypto';
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
let lastRender = 0;
function renderFrame(timestamp) {
  if (feed.dirty && timestamp - lastRender >= 100) {
    lastRender = timestamp; feed.dirty = false;
    header(); status();
    if (page === 'crypto') markets.render();
    else if (page === 'overview') overview.render(api.state);
    else if (page === 'assets') assets.render(api.state);
    else if (['spot', 'futures'].includes(page)) {
      bar(); book.render(); chart.render(api.state); tape.render(api.state); side.render();
      if (page === 'spot') spot.render(); else futures.render(); orders.render(api.state); api.crossing(feed);
    }
    pickerList?.render();
  }
  requestAnimationFrame(renderFrame);
}
document.addEventListener('keydown', event => { if (event.key === 'Escape') { closeChart(); closePicker(); } });
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer); resizeTimer = setTimeout(() => {
    feed.activate(feed.market, feed.symbol, feed.interval).then(() => {
      feed.setFuturesWanted(page === 'crypto' ? markets.tab === 'futures' : side.tab === 'futures');
    });
    orders.signature = ''; feed.dirty = true;
  }, 200);
});
setInterval(() => { feed.dirty = true; }, 1000);
route(); api.refresh(); requestAnimationFrame(renderFrame);
modals.initialDisclaimer().then(() => {
  if (location.hash.includes('checkin=1')) modals.checkin();
});
