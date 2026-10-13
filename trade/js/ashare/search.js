// ASHARE §1/§6、DESIGN §4.2：JSONP搜索严格过滤沪深A股，清理脚本与回调，不执行动态HTML。
import { element } from '../format.js';
export function searchStocks(query) {
  if (!query.trim()) return Promise.resolve([]);
  return new Promise((resolve, reject) => {
    const callback = 'ashareSearch_' + crypto.randomUUID().replaceAll('-', ''), script = document.createElement('script');
    const cleanup = () => { clearTimeout(timer); script.remove(); delete globalThis[callback]; };
    const timer = setTimeout(() => { cleanup(); reject(Error('search timeout')); }, 8000);
    globalThis[callback] = response => {
      const rows = response?.QuotationCodeTable?.Data || [];
      const result = rows.filter(row => [0, 1].includes(+row.MktNum) && ['沪A', '深A'].includes(row.SecurityTypeName)
        && /^\d{6}$/.test(row.Code)).map(row => ({ code: (+row.MktNum === 1 ? 'sh' : 'sz') + row.Code, name: row.Name }));
      cleanup(); resolve(result);
    };
    script.onerror = () => { cleanup(); reject(Error('search unavailable')); };
    const params = new URLSearchParams({ input: query.slice(0, 40), type: 14, count: 10,
      token: 'D43BF722C8E33BDC906FB84D85E326E8', cb: callback });
    script.src = 'https://searchapi.eastmoney.com/api/suggest/get?' + params; document.head.append(script);
  });
}
export class Search {
  constructor(input, results) {
    this.input = input; this.results = results; this.revision = 0; this.selected = -1;
    input.oninput = () => {
      clearTimeout(this.timer); this.revision++;
      this.timer = setTimeout(() => this.load(input.value.trim(), this.revision), 250);
    };
    input.addEventListener('keydown', event => {
      const links = [...results.querySelectorAll('a')];
      if (event.key === 'Escape') { results.hidden = true; input.blur(); }
      if (['ArrowDown', 'ArrowUp'].includes(event.key) && links.length) {
        event.preventDefault(); this.selected = (this.selected + (event.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
        links.forEach((link, index) => link.classList.toggle('selected', index === this.selected));
      }
      if (event.key === 'Enter' && links[this.selected]) {
        event.preventDefault(); links[this.selected].click(); results.hidden = true;
      }
    });
    results.addEventListener('click', () => { results.hidden = true; });
    document.addEventListener('click', event => {
      if (!results.contains(event.target) && event.target !== input) results.hidden = true;
    });
    document.addEventListener('keydown', event => {
      if (event.key === '/' && !event.target.closest('input,textarea,select') && !document.querySelector('dialog[open]')) {
        event.preventDefault(); input.focus();
      }
    });
  }
  async load(query, revision) {
    this.results.replaceChildren(); this.results.hidden = !query; this.selected = -1;
    if (!query) return;
    const coins = globalThis.TRADE_MARKETS.filter(row => [row.coin, row.name]
      .some(value => value.toLowerCase().includes(query.toLowerCase())));
    let stocks;
    try { stocks = await searchStocks(query); } catch { stocks = []; }
    if (revision !== this.revision) return;
    for (const [label, rows, route] of [['A 股', stocks, 'stock'], ['加密', coins, 'spot']]) {
      this.results.append(element('b', label, 'search-group'));
      for (const row of rows) {
        const link = element('a', row.name + ' · ' + (row.code || row.coin));
        link.href = '#/' + route + '/' + (row.code || row.spot); this.results.append(link);
      }
    }
    if (!stocks.length && !coins.length) this.results.append(element('p', '未找到结果', 'muted'));
  }
}
