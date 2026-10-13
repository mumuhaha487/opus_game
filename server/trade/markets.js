// 共享市场清单的服务端入口。
// 只允许规格第 3 节列出的交易对，避免任意上游路径。
// 价格与数量精度始终读取 Gate.io 规格。
import '../../trade/js/markets.js';
export const MARKETS = globalThis.TRADE_MARKETS;
export function marketFor(symbol) {
  const market = MARKETS.find(entry => entry.spot === symbol);
  if (!market) throw { status: 400, code: 'unknown_symbol' };
  return market;
}
