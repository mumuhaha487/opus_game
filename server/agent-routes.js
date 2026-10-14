// /api/v1 路由表（路径 → 允许的方法）。网页能做的交易操作 API 都能做（含签到、资金流水、一键撤单、逐仓保证金、A 股自选），
// 行情另有清单、盘口与 K 线。agent-api 据此分发，api-keys 据此记录调用路径（表外路径记为 [unknown]）。
export const AGENT_ROUTES = Object.freeze({ account: 'GET', quote: 'GET', spec: 'GET', markets: 'GET', depth: 'GET', klines: 'GET',
  orders: 'GET, POST', trades: 'GET', ledger: 'GET',
  'orders/cancel': 'POST', 'orders/cancel-all': 'POST', transfer: 'POST', checkin: 'POST', 'ashare/watch': 'POST',
  'futures/leverage': 'POST', 'futures/close': 'POST', 'futures/tpsl': 'POST', 'futures/margin': 'POST' });
