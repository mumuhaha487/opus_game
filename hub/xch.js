// DESIGN §1.4/1.6/1.7：直连市场数据、像素阶梯走势、签到与统一钱包；可见时15秒刷新。
import '../trade/js/markets.js';
import { Feed } from '../trade/js/feed.js';
import { AshareFeed } from '../trade/js/ashare/feed.js';
import { WalletView, valuations, totalValue } from '../trade/js/wallet.js';
const indices = [['sh000001', '上证指数'], ['sz399001', '深证成指'], ['sz399006', '创业板指'], ['sh000300', '沪深300']];
const coins = ['BTC', 'ETH', 'SOL', 'DOGE'];
const ns = 'http://www.w3.org/2000/svg', rows = [], mini = new Map();
let state = null, quotes = {}, cryptoQuotes = new Map(), futuresQuotes = new Map(), timer, loading = false, revision = 0;
const wallet = new WalletView(renderAccount);
const live = new Feed(), stocks = new AshareFeed(() => {});
live.connect('spot');
const node = (tag, text = '', cls = '') => {
  const value = document.createElement(tag); value.textContent = text; value.className = cls; return value;
};
// Hub prices follow magnitude; index points always retain two decimal places.
function number(value, index = false) {
  if (value == null || !Number.isFinite(Number(value))) return '--';
  const price = Number(value), magnitude = Math.abs(price);
  const options = index || magnitude >= 1000 ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
    : magnitude >= 1 ? { minimumFractionDigits: 2, maximumFractionDigits: 4 }
    : magnitude >= 0.01 ? { minimumFractionDigits: 5, maximumFractionDigits: 5 }
    : { minimumSignificantDigits: 4, maximumSignificantDigits: 4 };
  return price.toLocaleString('en-US', options);
}
const pct = value => value == null ? '--' : (value > 0 ? '+' : '') + Number(value).toFixed(2) + '%';
const tone = (value, cn) => value > 0 ? cn ? '#e0485e' : '#63c74d' : value < 0 ? cn ? '#63c74d' : '#e0485e' : 'var(--ink)';
function svgChart(svg, values, color, filled = false) {
  const points = values.filter(Number.isFinite); if (points.length < 2) return;
  const height = filled ? 96 : 32, width = filled ? 500 : 160;
  const low = Math.min(...points), range = Math.max(...points) - low || 1;
  const line = points.map((value, index) => (index ? 'H' + (index * width / (points.length - 1)) + 'V' : 'M0 ')
    + (height - 2 - (value - low) * (height - 4) / range)).join(' ');
  svg.replaceChildren();
  if (filled) {
    const area = document.createElementNS(ns, 'path'); area.setAttribute('d', line + 'V96H0Z');
    area.setAttribute('fill', 'rgba(242,198,109,0.08)'); svg.append(area);
  }
  const path = document.createElementNS(ns, 'path'); path.setAttribute('d', line); path.setAttribute('fill', 'none');
  path.setAttribute('stroke', color); path.setAttribute('stroke-width', filled ? '2' : '1.5'); svg.append(path);
}
function makeQuote(code, name, cn, compact) {
  const card = node(compact ? 'div' : 'a', '', compact ? 'door-quote' : 'tk frame');
  if (!compact) card.href = '/trade/index.html#/' + (cn ? 'stock/' + code : 'spot/' + code + '_USDT');
  const heading = node('div', '', 'tk-heading'), value = node('b', '--', 'tk-price px'), change = node('span', '--', 'tk-change px');
  heading.append(node('span', name, 'px'));
  if (!compact) heading.append(node('small', code, 'px'));
  const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 160 32');
  svg.setAttribute('class', 'tk-spark'); svg.setAttribute('aria-hidden', 'true');
  card.append(heading, value, change); if (!compact) card.append(svg);
  rows.push({ code, name, cn, value, change, svg, compact }); return card;
}
const door = document.getElementById('door-quotes');
if (door) door.append(...[indices[0], indices[3]].map(([code, name]) => makeQuote(code, name, true, true)),
  ...coins.slice(0, 2).map(coin => makeQuote(coin, coin, false, true)));
const strip = document.getElementById('market-tickers');
if (strip) strip.append(...indices.map(([code, name]) => makeQuote(code, name, true, false)),
  ...coins.map(coin => makeQuote(coin, coin, false, false)));
function paintQuotes() {
  for (const row of rows) {
    const quote = row.cn ? quotes[row.code] : cryptoQuotes.get(row.code + '_USDT');
    const percent = row.cn ? quote?.percent : quote?.change_percentage;
    row.value.textContent = number(quote?.last, row.cn);
    row.change.textContent = pct(percent); row.change.style.color = tone(percent, row.cn);
    row.value.style.color = (row.cn ? stocks : live).status === 'failed' ? 'var(--muted)' : '';
    if (!row.compact) svgChart(row.svg, mini.get(row.code)?.values || [], tone(percent, row.cn));
  }
}
async function json(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw Error('market'); return response.json();
}
async function loadMini(code, cn) {
  if (Date.now() - (mini.get(code)?.at || 0) < 60000) return;
  let values;
  if (cn) {
    values = (await stocks.loadBars(code)).map(row => row.close);
  } else {
    values = (await live.sources.miniHistory(code + '_USDT')).map(row => row.close);
  }
  mini.set(code, { at: Date.now(), values });
}
async function accountChanged() {
  const token = ++revision; state = null; renderAccount();
  if (!GameAccount.profile()) return;
  try {
    const data = await GameAccount.request('/api/trade/state');
    if (token !== revision) return; state = data; renderAccount();
  } catch { /* session or upstream unavailable; keep the login/read prompt */ }
}
function renderAccount() {
  const check = document.getElementById('hub-checkin'), logged = !!GameAccount.profile();
  if (check) {
    check.querySelector('i').classList.toggle('xi', logged && !state?.checkin.checkedToday);
    check.querySelector('span').textContent = state?.checkin.checkedToday ? '已签到'
      : logged ? '签到 · 本周第 ' + ((state?.checkin.streak || 0) + 1) + ' 次' : '签到';
  }
  const days = document.getElementById('hub-checkin-days');
  if (days) {
    days.replaceChildren(...Array.from({ length: 7 }, (_, index) => node('i', '',
      index < (state?.checkin.streak || 0) ? 'taken' : index === Math.min(6, state?.checkin.streak || 0) ? 'today' : '')));
    document.getElementById('hub-checkin-detail').textContent = '本周已签 ' + (state?.checkin.streak || 0)
      + ' 次 · 下次 +' + wallet.display(+(state?.checkin.nextReward || 20)) + ' · 每周一重置';
  }
  const assets = document.getElementById('hub-assets'); if (!assets) return;
  if (!logged) {
    const login = node('button', '登录', 'btn sm px'); login.onclick = () => document.getElementById('acct-open').click();
    assets.replaceChildren(node('p', '登录后查看资产'), login); return;
  }
  if (!state) { assets.replaceChildren(node('p', '正在读取资产…')); return; }
  const feed = { tickers: { spot: cryptoQuotes, futures: futuresQuotes }, specs: new Map() };
  const values = valuations(state, feed, { quotes });
  assets.replaceChildren(node('b', wallet.display(totalValue(values, wallet), wallet.currency), 'tile-total px'),
    node('p', '钱包 ' + wallet.display(values.wallet)),
    node('p', '加密 ' + wallet.display(values.spot == null || values.futures == null ? null : values.spot + values.futures)),
    node('p', 'A 股 ' + wallet.display(values.ashare, 'CNY')));
}
async function refresh() {
  if (document.hidden || loading) return; loading = true;
  try {
    const codes = [...new Set([...indices.map(([code]) => code), ...(state?.ashare.holdings || []).map(row => row.code)])];
    await Promise.allSettled([
      (async () => {
        stocks.codes = codes; await stocks.loadQuotes(); quotes = stocks.quotes;
      })(),
      (async () => {
        live.sources.listVisible = true;
        if (live.sources.state('spot').health.index >= 2) await live.sources.binanceList();
        else if (!live.tickers.spot.size) {
          const data = await live.rest('/spot/tickers'); data.forEach(row => live.saveTicker('spot', row));
        }
        cryptoQuotes = live.tickers.spot;
      })(),
      ...(state?.futures.positions.length ? [(async () => {
        live.setFuturesWanted(true); futuresQuotes = live.tickers.futures;
      })()] : []),
      ...indices.map(([code]) => loadMini(code, true)), ...coins.map(coin => loadMini(coin, false)),
    ]);
    paintQuotes(); renderAccount();
    const chart = document.getElementById('door-chart');
    if (chart) svgChart(chart, mini.get('sh000001')?.values || [], '#F2C66D', true);
  } finally { loading = false; clearTimeout(timer); timer = setTimeout(refresh, 15000); }
}
document.addEventListener('hub-account-change', accountChanged);
GameAccount.onProfileChange(accountChanged);
document.addEventListener('visibilitychange', () => { clearTimeout(timer); if (!document.hidden) refresh(); });
accountChanged(); refresh();
let painted = 0;
function paintLive(at) {
  if (!document.hidden && at - painted >= 250) {
    cryptoQuotes = live.tickers.spot; futuresQuotes = live.tickers.futures;
    paintQuotes(); renderAccount(); painted = at;
  }
  requestAnimationFrame(paintLive);
}
requestAnimationFrame(paintLive);
