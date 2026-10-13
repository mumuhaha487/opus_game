// 交易市场白名单，供浏览器与 Worker 共享。
// 按规格第 3 节保持币种顺序与中文名。
// 交易精度及合约参数由 Gate.io 在运行时提供。
(function (root) {
  const coins = [
    'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'DOGE', 'ADA', 'TRX', 'AVAX', 'LINK',
    'DOT', 'BCH', 'LTC', 'SHIB', 'NEAR', 'UNI', 'APT', 'ARB', 'OP', 'SUI', 'PEPE',
    'FIL', 'ATOM', 'ETC', 'AAVE', 'INJ', 'WLD', 'TIA', 'SEI', 'HBAR', 'XLM',
    'ICP', 'RENDER', 'ENA', 'ONDO', 'TAO', 'FET', 'POL', 'HYPE',
  ];
  const names = [
    '比特币', '以太坊', '币安币', 'Solana', '瑞波币', '狗狗币', '艾达币', '波场', '雪崩', 'Chainlink',
    '波卡', '比特币现金', '莱特币', '柴犬币', 'NEAR', 'Uniswap', 'Aptos', 'Arbitrum', 'Optimism', 'Sui', 'Pepe',
    'Filecoin', 'Cosmos', '以太经典', 'Aave', 'Injective', 'Worldcoin', 'Celestia', 'Sei', 'Hedera', '恒星币',
    '互联网计算机', 'Render', 'Ethena', 'Ondo', 'Bittensor', 'Fetch.ai', 'Polygon', 'Hyperliquid',
  ];
  root.TRADE_MARKETS = coins.map((coin, index) => ({
    coin, name: names[index], spot: coin + '_USDT', perp: coin + '_USDT', hot: index < 8,
  }));
})(globalThis);
