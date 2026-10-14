// DESIGN §4.4：统一钱包、签到、市场状态（含美股时段）、八项行情、榜单和三个市场持仓。
import { element, button, price, money, countdown } from './format.js';
import { title, segment, change, spark, table } from './ui.js';
import { INDICES } from './ashare/universe.js';
import { valuations, totalValue, ACCOUNTS } from './wallet.js';
import { positionMetrics } from './futures.js';
import { marketClock } from './ashare/feed.js';
import { MARKET_LABEL, beijingClock } from './usstock/stock.js';
export class Overview {
  constructor(panel, feed, ashare, api, modals, wallet, navigate) {
    Object.assign(this, { panel, feed, ashare, api, modals, wallet, navigate, cryptoSort: 0 });
    this.cards = ['wallet', 'checkin', 'status', 'tickers', 'ashare', 'crypto', 'holdings'].map((name, index) => {
      const card = element('section', '', 'panel overview-' + name); card.style.order = index;
      panel.append(card); return card;
    });
    this.cards[4].classList.add('cn-market');
    this.rankTabs = [segment([[0, '涨幅'], [1, '跌幅'], [2, '成交额']], value => {
      ashare.rankSort = value; ashare.schedule();
    }), segment([[0, '涨幅'], [1, '跌幅'], [2, '成交额']], value => { this.cryptoSort = value; feed.dirty = true; })];
  }
  render(state) {
    const [funds, checkin, status, tickers, cnRank, cryptoRank, holdings] = this.cards;
    const values = valuations(state, this.feed, this.ashare), total = totalValue(values, this.wallet);
    funds.replaceChildren(title('WALLET', '我的资产'), element('b', this.wallet.display(total, this.wallet.currency), 'wallet-total'));
    const statistics = element('div', '', 'wallet-statistics');
    for (const [id, name, unit] of ACCOUNTS) {
      const row = element('div'), native = id === 'ashare' ? 'CNY' : 'USD';
      row.append(element('span', name, 'muted'), element('b', money(values[id]) + ' ' + unit));
      if (this.wallet.currency !== native) row.append(element('small', this.wallet.display(values[id], native), 'muted'));
      statistics.append(row);
    }
    const actions = element('div', '', 'card-actions');
    actions.append(button('签到', () => this.modals.checkin(), 'primary'), button('划转', () => this.modals.transfer(), 'secondary'),
      button('去交易', () => this.navigate(this.wallet.region === 'cn' ? '#/ashare' : '#/crypto'), 'secondary'));
    funds.append(statistics, actions); if (!state) funds.append(element('p', '登录后查看资产', 'muted'));
    const data = state?.checkin || { streak: 0, nextReward: '20', rewards: ['20', '25', '30', '35', '40', '45', '50'] };
    const days = element('div', '', 'checkin-squares');
    data.rewards.forEach((reward, index) => {
      const square = element('span', '', index < data.streak ? 'taken' : index === Math.min(6, data.streak) ? 'today' : '');
      const day = element('div', '', 'checkin-day'), cny = this.wallet.currency === 'CNY';
      const amount = cny ? this.wallet.rate ? Math.round(+reward * this.wallet.rate) : '--' : Math.round(+reward);
      square.title = '本周第 ' + (index + 1) + ' 次 · ' + this.wallet.display(+reward);
      day.append(square, element('small', '+' + (cny ? '¥' : '') + amount)); days.append(day);
    });
    checkin.replaceChildren(title('CHECK-IN', '每周签到'), days, element('p', '本周已签 ' + data.streak + ' 次 · 每周一重置'),
      element('p', '下次 +' + this.wallet.display(+data.nextReward)),
      button(data.checkedToday ? '今日已签到' : '签到', () => this.modals.checkin(), 'primary'));
    const clock = this.ashare.clock(), pill = element('span', clock.label, 'market-status ' + clock.status);
    const nextOpen = clock.status === 'open' ? marketClock(clock.target + 1).target : clock.target;
    status.replaceChildren(title('MARKET', '市场状态'), pill,
      element('p', (clock.status === 'open' ? '距离收盘 ' : '距离开盘 ') + countdown((clock.target - Date.now()) / 1000)),
      element('p', '加密市场 · 24 小时交易', 'muted'),
      element('p', 'A 股交易时段 09:30–11:30 · 13:00–15:00（北京时间）', 'market-hours muted'),
      element('p', '下一次开盘：' + new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai',
        month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(nextOpen), 'muted'));
    const us = this.feed.us?.market();
    if (us) {
      status.append(element('p', '美股 ' + MARKET_LABEL[us.status] + ' · 北京时间 '
        + (us.status === 'open' ? beijingClock(us.closeAt) + ' 收盘' : beijingClock(us.nextOpen) + ' 开盘'), 'muted'));
    }
    const cn = INDICES.map(([code, name]) => this.ticker(code, name, true));
    const crypto = ['BTC', 'ETH', 'SOL'].map(coin => this.ticker(coin, coin, false));
    tickers.replaceChildren(...(this.wallet.region === 'cn' ? [...cn, ...crypto] : [...crypto, ...cn]));
    cnRank.replaceChildren(title('RANKING', 'A 股榜单'), this.rankTabs[0], this.rankRows(this.ashare.ranking, true));
    const ranked = globalThis.TRADE_MARKETS.map(market => {
      const quote = this.feed.tickers.spot.get(market.spot) || {};
      return { code: market.spot, name: market.name, last: quote.last, percent: quote.change_percentage, turnover: quote.quote_volume };
    }).sort((a, b) => this.cryptoSort === 2 ? +b.turnover - +a.turnover
      : this.cryptoSort === 1 ? +a.percent - +b.percent : +b.percent - +a.percent).slice(0, 10);
    cryptoRank.replaceChildren(title('RANKING', '加密榜单'), this.rankTabs[1], this.rankRows(ranked, false));
    holdings.hidden = !state; if (state) holdings.replaceChildren(title('POSITIONS', '我的持仓'), this.positions(state));
    cnRank.style.order = this.wallet.region === 'cn' ? 4 : 5; cryptoRank.style.order = this.wallet.region === 'cn' ? 5 : 4;
  }
  ticker(code, name, cn) {
    const pair = code + '_USDT', quote = cn ? this.ashare.quotes[code] : this.feed.tickers.spot.get(pair);
    const link = element('a', '', 'ticker-card' + (cn ? ' cn-market' : ''));
    link.href = cn ? '#/stock/' + code : '#/spot/' + pair;
    const bars = cn ? this.ashare.bars.get(code + ':trends') || [] : this.feed.sparkCandles?.get(pair) || [];
    link.append(element('span', name), element('b', price(quote?.last, 2)),
      change(cn ? quote?.percent : quote?.change_percentage), spark(bars.map(row => row.close))); return link;
  }
  rankRows(rows, cn) {
    const list = element('div', '', 'ranking-list');
    for (const row of rows) {
      const link = element('a'); link.href = (cn ? '#/stock/' : '#/spot/') + row.code;
      const name = element('span', row.name); name.append(element('small', row.code, 'dim'));
      link.append(name, element('span', price(row.last, 2)), change(row.percent)); list.append(link);
    }
    if (!rows.length) list.append(element('p', '行情连接中断，正在重试', 'muted')); return list;
  }
  positions(state) {
    const rows = state.ashare.holdings.map(row => {
      const last = this.ashare.quotes[row.code]?.last;
      return ['A 股', row.name, row.qty, money(row.cost), price(last, 2),
        money(last == null ? null : (last - +row.cost) * +row.qty), this.trade('#/stock/' + row.code)];
    });
    for (const row of state.spot.balances.filter(row => row.asset !== 'USDT')) {
      const last = this.feed.tickers.spot.get(row.asset + '_USDT')?.last;
      rows.push(['加密现货', row.asset, +row.free + +row.locked, '--', price(last, 2), '--', this.trade('#/spot/' + row.asset + '_USDT')]);
    }
    for (const row of state.futures.positions) {
      const mark = this.feed.tickers.futures.get(row.symbol)?.mark_price;
      rows.push(['合约', row.symbol, row.qty, money(row.entry), price(mark, 2),
        money(mark ? positionMetrics(row, +mark).pnl : null), this.trade('#/futures/' + row.symbol)]);
    }
    return rows.length ? table(['市场', '名称', '数量', '成本或开仓价', '现价', '盈亏', '操作'], rows)
      : element('p', '暂无记录', 'muted');
  }
  trade(hash) { return button('交易', () => this.navigate(hash), 'accent'); }
}
