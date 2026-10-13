// DESIGN §4.6、ASHARE §5：常驻A股图表；分时/均价/昨收、五日及前复权K线，末根每秒更新。
import { element, button, price, time } from '../format.js';
import { segment } from '../ui.js';
import { movingAverage } from '../chart.js';
export class AshareChart {
  constructor(panel, feed) {
    this.feed = feed; this.period = 'trends'; this.indicators = true;
    const toolbar = element('div', '', 'chart-toolbar');
    toolbar.append(segment([['trends', '分时'], ['five', '五日'], ['101', '日K'], ['102', '周K'], ['103', '月K']],
      period => this.select(period)));
    const more = element('select'); more.setAttribute('aria-label', '更多周期');
    for (const [value, text] of [['', '更多'], ['1', '1 分'], ['5', '5 分'], ['15', '15 分'], ['30', '30 分'], ['60', '60 分']]) {
      const option = element('option', text); option.value = value; more.append(option);
    }
    more.onchange = () => { if (more.value) this.select(more.value); };
    toolbar.append(more, button('指标', () => { this.indicators = !this.indicators; this.key = ''; }),
      button('⛶', () => panel.classList.toggle('stock-fullscreen'), 'fullscreen-button'));
    this.canvas = element('div', '', 'chart-canvas'); this.legend = element('div', '', 'chart-legend');
    this.canvas.append(this.legend); panel.append(toolbar, this.canvas);
    const style = getComputedStyle(document.body);
    this.chart = globalThis.LightweightCharts.createChart(this.canvas, {
      layout: { background: { color: '#13161C' }, textColor: '#7D8696', fontFamily: style.fontFamily, fontSize: 11 },
      grid: { vertLines: { color: '#1C2029' }, horzLines: { color: '#1C2029' } },
      crosshair: { vertLine: { color: '#59616F', style: 2 }, horzLine: { color: '#59616F', style: 2 } },
      rightPriceScale: { borderColor: '#232833' }, timeScale: { borderColor: '#232833', timeVisible: true },
      localization: { timeFormatter: value => time(value * 1000, true).slice(0, 16), priceFormatter: value => price(value, 2) },
    });
    this.chart.subscribeCrosshairMove(event => {
      const rows = feed.bars.get(feed.code + ':' + this.period) || [];
      this.paintLegend(rows.find(row => row.time === event.time) || rows.at(-1));
    });
    new ResizeObserver(() => {
      if (this.canvas.clientWidth && this.canvas.clientHeight) this.chart.resize(this.canvas.clientWidth, this.canvas.clientHeight);
    }).observe(this.canvas);
  }
  select(period) { this.period = this.feed.period = period; this.key = ''; this.feed.schedule(); }
  rebuild() {
    for (const series of this.series || []) this.chart.removeSeries(series);
    const library = globalThis.LightweightCharts, line = ['trends', 'five'].includes(this.period);
    this.main = this.chart.addSeries(line ? library.LineSeries : library.CandlestickSeries,
      line ? { color: '#F2C66D', lineWidth: 1.5, priceLineVisible: false }
        : { upColor: '#E5484D', downColor: '#22B573', wickUpColor: '#E5484D', wickDownColor: '#22B573', borderVisible: false });
    this.average = this.chart.addSeries(library.LineSeries, { color: '#5B8DEF', lineWidth: 1,
      priceLineVisible: false, lastValueVisible: false });
    this.volume = this.chart.addSeries(library.HistogramSeries, { priceScaleId: 'volume', priceFormat: { type: 'volume' } });
    this.volume.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    this.main.priceScale().applyOptions({ scaleMargins: { top: 0.1, bottom: 0.2 } });
    this.series = [this.main, this.average, this.volume];
    const previous = this.feed.quotes[this.feed.code]?.prevClose;
    if (line && previous > 0) this.main.createPriceLine({ price: previous, color: '#7D8696', lineStyle: 2, title: '昨收' });
  }
  render() {
    const code = this.feed.code, rows = this.feed.bars.get(code + ':' + this.period) || [];
    const key = code + ':' + this.period + ':' + this.indicators, changed = key !== this.key;
    if (changed) { this.key = key; this.rebuild(); }
    const line = ['trends', 'five'].includes(this.period);
    const unique = [...new Map(rows.map(row => [row.time, row])).values()].sort((a, b) => a.time - b.time);
    this.main.setData(unique.map(row => line ? { time: row.time, value: row.close } : row));
    this.average.setData(line ? unique.filter(row => row.average > 0).map(row => ({ time: row.time, value: row.average }))
      : this.indicators ? movingAverage(unique, 7) : []);
    this.volume.setData(this.indicators ? unique.map(row => ({ time: row.time, value: row.volume,
      color: row.close >= row.open ? 'rgba(229,72,77,0.5)' : 'rgba(34,181,115,0.5)' })) : []);
    this.paintLegend(unique.at(-1)); if (changed) this.chart.timeScale().fitContent();
  }
  paintLegend(row) {
    this.legend.textContent = row ? time(row.time * 1000, true).slice(0, 16) + '  开 ' + price(row.open, 2)
      + '  高 ' + price(row.high, 2) + '  低 ' + price(row.low, 2) + '  收 ' + price(row.close, 2) : '';
  }
}
