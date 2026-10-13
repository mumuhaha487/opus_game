// 汇总页模拟交易所的四币行情卡片。
// 规格 10.2：浏览器并发直连 Gate.io，可见时每十秒刷新，失败三十秒重试。
// 只使用 textContent 与属性赋值，沿用汇总页像素组件。
(() => {
  const markets = [['BTC', '比特币'], ['ETH', '以太坊'], ['SOL', 'Solana'], ['DOGE', '狗狗币']];
  const container = document.getElementById('xch-tk');
  if (!container) return;
  let timer, loading = false;
  const rows = markets.map(([coin, name]) => {
    const row = document.createElement('li'), link = document.createElement('a');
    link.href = 'trade/index.html#/spot/' + coin + '_USDT';
    const symbol = document.createElement('b'), price = document.createElement('span');
    const title = document.createElement('small'), change = document.createElement('span');
    symbol.textContent = coin; title.textContent = name; price.textContent = '--'; change.textContent = '--';
    price.className = 'p'; change.className = 'c'; link.append(symbol, price, title, change); row.append(link); container.append(row);
    return { coin, price, change };
  });
  async function refresh() {
    if (document.hidden || loading) return;
    loading = true; let failed = false;
    await Promise.all(rows.map(async row => {
      try {
        const response = await fetch('https://api.gateio.ws/api/v4/spot/tickers?currency_pair=' + row.coin + '_USDT',
          { signal: AbortSignal.timeout(8000) });
        if (!response.ok) throw Error('gate');
        const [ticker] = await response.json(), digits = (ticker.last.split('.')[1] || '').length;
        row.price.textContent = Number(ticker.last).toLocaleString('en-US',
          { minimumFractionDigits: digits, maximumFractionDigits: digits });
        const percentage = Number(ticker.change_percentage);
        row.change.textContent = (percentage > 0 ? '+' : '') + percentage.toFixed(2) + '%';
        row.change.className = 'c ' + (percentage > 0 ? 'up' : percentage < 0 ? 'down' : '');
      } catch { row.price.textContent = '--'; row.change.textContent = '--'; failed = true; }
    }));
    loading = false; clearTimeout(timer); timer = setTimeout(refresh, failed ? 30000 : 10000);
  }
  document.addEventListener('visibilitychange', () => {
    clearTimeout(timer); if (!document.hidden) refresh();
  });
  refresh();
})();
