// Lightweight Charts 5.2.1 图表、指标和用户委托价格线。
// 配置与颜色逐项对应规格 9.4、9.6，保留 TradingView attribution。
// 历史滚动使用 REST，实时末根使用 series.update，图例通过安全 DOM 更新。
import { element, button, price, percent, time } from './format.js';
const COLORS = ['#F0B90B', '#EB40B5', '#B385F8'];
export function movingAverage(candles, period, exponential = false) {
  const values = []; let total = 0, previous;
  for (let i = 0; i < candles.length; i++) {
    total += candles[i].close;
    if (i >= period) total -= candles[i - period].close;
    previous = exponential ? previous === undefined ? candles[i].close
      : candles[i].close * 2 / (period + 1) + previous * (1 - 2 / (period + 1)) : total / period;
    if (i >= period - 1) values.push({ time: candles[i].time, value: previous });
  }
  return values;
}
export class Chart {
  constructor(panel, feed, onInterval, onFullscreen) {
    this.feed = feed; this.key = ''; this.lastFirst = null; this.series = []; this.lines = [];
    this.indicators = ['MA', 'VOL'];
    try { this.indicators = JSON.parse(localStorage.getItem('trade_ind_v1')) || this.indicators; } catch { /* storage unavailable */ }
    const toolbar = element('div', '', 'chart-toolbar'); panel.append(toolbar);
    const intervals = [['分时', '1m'], ['1分', '1m'], ['5分', '5m'], ['15分', '15m'],
      ['1小时', '1h'], ['4小时', '4h'], ['1日', '1d'], ['1周', '7d']];
    this.buttons = intervals.map(([label, interval]) => {
      const node = button(label, () => { this.area = label === '分时'; onInterval(interval); });
      node.dataset.interval = interval; toolbar.append(node); return node;
    });
    const more = element('select'); more.setAttribute('aria-label', '更多');
    for (const [label, interval] of [['更多', ''], ['30分', '30m'], ['8小时', '8h'], ['1月', '30d']]) {
      const option = element('option', label); option.value = interval; more.append(option);
    }
    more.onchange = () => { if (more.value) { this.area = false; onInterval(more.value); } }; toolbar.append(more);
    const menu = element('details', '', 'indicator-menu'); menu.append(element('summary', '指标'));
    const choices = element('div', '', 'indicator-choices'); menu.append(choices); toolbar.append(menu);
    for (const name of ['MA', 'EMA', 'BOLL', 'VOL', 'MACD', 'RSI']) {
      const label = element('label', name), input = element('input'); input.type = 'checkbox';
      input.checked = this.indicators.includes(name); label.prepend(input); choices.append(label);
      input.onchange = () => {
        this.indicators = input.checked ? [...this.indicators, name] : this.indicators.filter(value => value !== name);
        try { localStorage.setItem('trade_ind_v1', JSON.stringify(this.indicators)); } catch { /* storage unavailable */ }
        this.key = ''; this.feed.dirty = true;
      };
    }
    toolbar.append(button('⛶', onFullscreen, 'fullscreen-button'));
    this.container = element('div', '', 'chart-canvas'); this.legend = element('div', '', 'chart-legend');
    this.container.append(this.legend); panel.append(this.container);
    this.chart = globalThis.LightweightCharts.createChart(this.container, this.options());
    this.chart.subscribeCrosshairMove(event => {
      const candle = feed.candles.find(entry => entry.time === event.time) || feed.candles.at(-1); this.paintLegend(candle);
    });
    this.chart.timeScale().subscribeVisibleLogicalRangeChange(range => { if (range && range.from < 10) this.loadOlder(); });
    new ResizeObserver(() => this.chart.resize(this.container.clientWidth, this.container.clientHeight)).observe(this.container);
  }
  options() {
    return {
      layout: { background: { type: 'solid', color: '#181A20' }, textColor: '#848E9C', fontSize: 11,
        fontFamily: getComputedStyle(document.body).fontFamily, attributionLogo: true,
        panes: { separatorColor: '#2B3139', separatorHoverColor: '#474D57' } },
      grid: { vertLines: { color: '#1F242B' }, horzLines: { color: '#1F242B' } },
      crosshair: { mode: 0, vertLine: { color: '#5E6673', style: 3, labelBackgroundColor: '#2B3139' },
        horzLine: { color: '#5E6673', style: 3, labelBackgroundColor: '#2B3139' } },
      rightPriceScale: { borderColor: '#2B3139' },
      timeScale: { borderColor: '#2B3139', timeVisible: true, secondsVisible: false, rightOffset: 6, barSpacing: 8 },
      localization: { priceFormatter: value => price(value, this.feed.precision()),
        timeFormatter: value => time(value * 1000, true).slice(0, 16) },
    };
  }
  rebuild() {
    const library = globalThis.LightweightCharts;
    for (const series of this.series) this.chart.removeSeries(series);
    this.series = []; this.lines = [];
    const specification = { type: 'price', precision: this.feed.precision(), minMove: 10 ** -this.feed.precision() };
    const options = this.area ? { lineColor: '#F0B90B', lineWidth: 1.5,
      topColor: 'rgba(240,185,11,0.12)', bottomColor: 'rgba(240,185,11,0)' }
      : { upColor: '#0ECB81', wickUpColor: '#0ECB81', downColor: '#F6465D', wickDownColor: '#F6465D', borderVisible: false };
    this.main = this.chart.addSeries(this.area ? library.AreaSeries : library.CandlestickSeries,
      { ...options, priceFormat: specification });
    this.series.push(this.main); this.extras = [];
    if (this.indicators.includes('VOL')) {
      this.volume = this.chart.addSeries(library.HistogramSeries, { priceScaleId: 'vol', priceFormat: { type: 'volume' } });
      this.volume.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } }); this.series.push(this.volume);
    } else this.volume = null;
    this.buildIndicators();
  }
  addLine(name, period, color, pane = 0) {
    const series = this.chart.addSeries(globalThis.LightweightCharts.LineSeries, {
      color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
    }, pane);
    this.series.push(series); this.extras.push({ name, period, series, color }); return series;
  }
  buildIndicators() {
    for (const name of ['MA', 'EMA']) if (this.indicators.includes(name)) {
      [7, 25, 99].forEach((period, index) => this.addLine(name, period, COLORS[index]));
    }
    if (this.indicators.includes('BOLL')) [1, 0, -1].forEach((factor, index) => this.addLine('BOLL', factor, COLORS[index]));
    let pane = 1;
    if (this.indicators.includes('MACD')) {
      this.addLine('DIF', 0, COLORS[0], pane); this.addLine('DEA', 0, COLORS[1], pane);
      const histogram = this.chart.addSeries(globalThis.LightweightCharts.HistogramSeries,
        { priceLineVisible: false, lastValueVisible: false }, pane++);
      this.series.push(histogram); this.extras.push({ name: 'MACD', series: histogram });
    }
    if (this.indicators.includes('RSI')) [6, 12, 24].forEach((period, index) => this.addLine('RSI', period, COLORS[index], pane));
    for (const chartPane of this.chart.panes().slice(1)) chartPane.setHeight(Math.round(this.container.clientHeight * 0.25));
  }
  indicatorData(extra) {
    const candles = this.feed.candles;
    if (['MA', 'EMA'].includes(extra.name)) return movingAverage(candles, extra.period, extra.name === 'EMA');
    if (extra.name === 'BOLL') return candles.slice(19).map((candle, index) => {
      const closes = candles.slice(index, index + 20).map(entry => entry.close);
      const mean = closes.reduce((sum, value) => sum + value, 0) / 20;
      const deviation = Math.sqrt(closes.reduce((sum, value) => sum + (value - mean) ** 2, 0) / 20);
      return { time: candle.time, value: mean + extra.period * 2 * deviation };
    });
    if (extra.name === 'RSI') return this.rsi(extra.period);
    const fast = movingAverage(candles, 12, true), slow = movingAverage(candles, 26, true);
    const fastMap = new Map(fast.map(row => [row.time, row.value]));
    const dif = slow.map(row => ({ time: row.time, value: fastMap.get(row.time) - row.value }));
    const dea = movingAverage(dif.map(row => ({ time: row.time, close: row.value })), 9, true);
    if (extra.name === 'DIF') return dif;
    if (extra.name === 'DEA') return dea;
    const difMap = new Map(dif.map(row => [row.time, row.value]));
    return dea.map(row => ({ time: row.time, value: (difMap.get(row.time) - row.value) * 2,
      color: difMap.get(row.time) >= row.value ? 'rgba(14,203,129,0.6)' : 'rgba(246,70,93,0.6)' }));
  }
  rsi(period) {
    const result = [], candles = this.feed.candles;
    let gains = 0, losses = 0;
    for (let i = 1; i < candles.length; i++) {
      const change = candles[i].close - candles[i - 1].close;
      if (i <= period) { gains += Math.max(change, 0) / period; losses += Math.max(-change, 0) / period; }
      else { gains = (gains * (period - 1) + Math.max(change, 0)) / period;
        losses = (losses * (period - 1) + Math.max(-change, 0)) / period; }
      if (i >= period) result.push({ time: candles[i].time, value: !losses ? 100 : 100 - 100 / (1 + gains / losses) });
    }
    return result;
  }
  render(state) {
    const feed = this.feed, key = [feed.market, feed.symbol, feed.interval, this.area, feed.precision(), this.indicators].join(':');
    const changed = key !== this.key;
    if (changed) { this.key = key; this.rebuild(); }
    for (const node of this.buttons) node.classList.toggle('selected',
      node.dataset.interval === feed.interval && (this.area ? node.textContent === '分时' : node.textContent !== '分时'));
    const data = feed.candles.map(candle => this.area ? { time: candle.time, value: candle.close } : candle);
    if (!data.length) { this.main.setData([]); return; }
    const missingBars = this.lastTime && data.filter(candle => candle.time > this.lastTime).length > 1;
    if (changed || this.lastFirst !== data[0].time || missingBars) this.main.setData(data);
    else this.main.update(data.at(-1));
    this.lastFirst = data[0].time; this.lastTime = data.at(-1).time;
    if (this.volume) this.volume.setData(feed.candles.map(candle => ({ time: candle.time, value: candle.volume,
      color: candle.close >= candle.open ? 'rgba(14,203,129,0.5)' : 'rgba(246,70,93,0.5)' })));
    for (const extra of this.extras) extra.series.setData(this.indicatorData(extra));
    this.paintLegend(feed.candles.at(-1)); this.priceLines(state);
    if (changed) this.chart.timeScale().fitContent();
  }
  priceLines(state) {
    const orders = (state?.openOrders || []).filter(order => order.market === this.feed.market && order.symbol === this.feed.symbol);
    const signature = JSON.stringify(orders.map(order => [order.id, order.price, order.stopPrice, order.status]));
    if (signature === this.lineSignature && this.lines.length === orders.length) return;
    for (const line of this.lines) this.main.removePriceLine(line);
    this.lines = []; this.lineSignature = signature;
    for (const order of orders) {
      const stop = order.type === 'stop_limit' && order.status === 'new', buy = order.side === 'buy';
      this.lines.push(this.main.createPriceLine({ price: Number(stop ? order.stopPrice : order.price),
        color: buy ? '#0ECB81' : '#F6465D', lineStyle: 2, axisLabelVisible: true,
        title: (stop ? '触发 ' : '限价 ') + (buy ? '买入' : '卖出') + (stop ? '' : ' ' + order.qty) }));
    }
  }
  paintLegend(candle) {
    if (!candle) { this.legend.replaceChildren(); return; }
    const precision = this.feed.precision();
    const first = element('div', time(candle.time * 1000, true).slice(0, 16).replaceAll('-', '/') + '  ', 'muted');
    for (const [label, value] of [['开', candle.open], ['高', candle.high], ['低', candle.low], ['收', candle.close]]) {
      first.append(element('span', label + ' ', 'muted'), element('span', price(value, precision) + '  ',
        candle.close >= candle.open ? 'up' : 'down'));
    }
    first.append(element('span', '涨跌幅 ', 'muted'),
      element('span', percent((candle.close / candle.open - 1) * 100) + '  ', candle.close >= candle.open ? 'up' : 'down'),
      element('span', '振幅 ', 'muted'), element('span', ((candle.high - candle.low) / candle.open * 100).toFixed(2) + '%',
        candle.close >= candle.open ? 'up' : 'down'));
    const second = element('div');
    for (const extra of this.extras.filter(entry => ['MA', 'EMA', 'BOLL'].includes(entry.name))) {
      const value = this.indicatorData(extra).find(row => row.time === candle.time)?.value;
      const label = extra.name === 'BOLL' ? ['DN', 'MB', 'UP'][extra.period + 1] : `${extra.name}(${extra.period})`;
      const item = element('span', `${label}: ${price(value, precision)}  `); item.style.color = extra.color;
      second.append(item);
    }
    this.legend.replaceChildren(first, second);
  }
  async loadOlder() {
    if (this.loading || !this.feed.candles.length || this.exhausted === this.key) return;
    this.loading = true; const revision = this.feed.revision;
    try {
      const rows = await this.feed.history(this.feed.candles[0].time - 1);
      if (revision !== this.feed.revision) return;
      if (!rows.length) this.exhausted = this.key;
      this.feed.candles = [...new Map([...rows, ...this.feed.candles].map(row => [row.time, row])).values()]
        .sort((left, right) => left.time - right.time); this.feed.dirty = true;
    } catch { /* 下一次滚动重试 */ } finally { this.loading = false; }
  }
}
