// 每个全站账号独立保存 trade/<uid>.json。
// 规格 5.4：etag 条件写、最多四次重试、历史与 clientId 有上限。
// 余额调整通过定点十进制完成，读写边界保持字符串。
import { absent } from '../store.js';
import { parse, toStr, mul, div, roundTo } from './decimal.js';
import { checkinView } from './checkin.js';
import { marketStatus } from './ashare-rules.js';
import { usMarketStatus } from './us-calendar.js';
import { dayKey } from '../likes.js';
export const tradeKey = uid => `trade/${uid}.json`;
export function defaultState(now = Date.now()) {
  return {
    v: 2, created: now, updated: now, seq: 0,
    // PLATFORM §2.1：统一钱包、A 股现金及每日委托计数；旧字段继续保留。
    wallet: { usd: '0' }, ashare: { cash: { free: '0', locked: '0' }, holdings: {}, watch: [] },
    // 美股子账户：USD 现金（2 位小数）与持仓 { name, qty, available, cost }，T+0 可卖。
    usstock: { cash: { free: '0', locked: '0' }, holdings: {} },
    disclaimerAt: null, agent: { ordersToday: 0, day: null }, notices: [],
    spot: { balances: { USDT: { free: '0', locked: '0' } } },
    futures: { wallet: '0', locked: '0', leverage: {}, positions: {} },
    orders: [], history: { orders: [], trades: [], ledger: [] },
    checkin: { last: null, streak: 0, total: '0', days: 0 }, settledAt: {}, clientIds: [],
  };
}
export function normalize(state, now) {
  const initial = defaultState(now);
  state ||= initial;
  for (const field of Object.keys(initial)) state[field] ??= initial[field];
  state.spot.balances.USDT ||= { free: '0', locked: '0' };
  // ASHARE §6：旧v2文档只增加自选字段，不删除原有状态字段。
  state.ashare.watch ||= [];
  for (const [kind, limit] of Object.entries({ orders: 100, trades: 200, ledger: 200 })) {
    state.history[kind] = (state.history[kind] || []).slice(0, limit);
  }
  state.clientIds = state.clientIds.slice(0, 50);
  return state;
}
export async function readState(bucket, uid, now = Date.now()) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const object = await bucket.get(tradeKey(uid));
    if (!object) return { state: defaultState(now), etag: null };
    const original = await object.text(), stored = JSON.parse(original);
    if (stored.v !== 1) return { state: normalize(stored, now), etag: object.etag };
    // PLATFORM §2.5：原始字节只归档一次，迁移与其它请求竞争时重新读取 etag。
    await bucket.put(`trade-archive/${uid}-v1.json`, original, { onlyIf: absent() });
    const migrated = defaultState(now);
    migrated.checkin.last = stored.checkin?.last ?? null;
    migrated.checkin.streak = stored.checkin?.streak ?? 0;
    migrated.notices.push({ t: now, kind: 'migration',
      text: '交易所已升级为统一钱包，旧版模拟资产已归档，签到奖励按新规则发放。' });
    const written = await bucket.put(tradeKey(uid), JSON.stringify(migrated), { onlyIf: { etagMatches: object.etag } });
    if (written) return { state: migrated, etag: written.etag };
  }
  throw { status: 503, code: 'market_unavailable' };
}
export async function updateState(bucket, uid, action, now = Date.now()) {
  for (let i = 0; i < 4; i++) {
    const { state, etag } = await readState(bucket, uid, now);
    const before = JSON.stringify(state);
    const result = await action(state);
    normalize(state, now);
    // 本轮验收修正规格 5.4：默认空账户只读，首次发生实际变更时才创建文档。
    if (JSON.stringify(state) === before) return { state, ...result };
    state.updated = now;
    const onlyIf = etag ? { etagMatches: etag } : absent();
    if (await bucket.put(tradeKey(uid), JSON.stringify(state), { onlyIf })) return { state, ...result };
  }
  throw { status: 503, code: 'market_unavailable' };
}
export function balance(state, asset) {
  return state.spot.balances[asset] ||= { free: '0', locked: '0' };
}
export function adjustBalance(state, asset, field, change) {
  const account = balance(state, asset);
  const next = parse(account[field]) + change;
  if (next < 0n) throw { status: 400, code: 'insufficient_balance' };
  account[field] = toStr(next);
}
export function moveLock(state, asset, amount, freeze) {
  adjustBalance(state, asset, freeze ? 'free' : 'locked', -amount);
  adjustBalance(state, asset, freeze ? 'locked' : 'free', amount);
}
export function ledger(state, kind, asset, amount, note, now, market = 'spot') {
  state.history.ledger.unshift({ t: now, kind, asset, amount: toStr(amount), note, market });
}
export function summary(state, now) {
  let futuresTotal = parse(state.futures.wallet) + parse(state.futures.locked);
  for (const position of Object.values(state.futures.positions)) futuresTotal += parse(position.margin);
  const assets = Object.entries(state.spot.balances).filter(([asset, funds]) =>
    asset !== 'USDT' && parse(funds.free) + parse(funds.locked) > 0n).length;
  const funds = balance(state, 'USDT');
  return {
    checkedToday: checkinView(state.checkin, now).checkedToday, streak: checkinView(state.checkin, now).streak,
    spotUSDT: toStr(parse(funds.free) + parse(funds.locked)), futuresUSDT: toStr(futuresTotal),
    assets, positions: Object.keys(state.futures.positions).length,
  };
}
export function stateView(state, now, partial = false, notices = []) {
  const balances = Object.entries(state.spot.balances)
    .filter(([asset, funds]) => asset === 'USDT' || parse(funds.free) + parse(funds.locked) > 0n)
    .map(([asset, funds]) => ({ asset, ...funds }));
  return {
    serverTime: now, partial, checkin: checkinView(state.checkin, now), spot: { balances },
    wallet: state.wallet, disclaimerAt: state.disclaimerAt,
    // PLATFORM §5.2.4：跨日视图清零，下一张成功委托在条件写内更新持久化计数。
    agent: { ...state.agent, day: dayKey(now), ordersToday: state.agent.day === dayKey(now) ? state.agent.ordersToday : 0 },
    ashare: { cash: state.ashare.cash, watch: state.ashare.watch,
      holdings: Object.entries(state.ashare.holdings).map(([code, value]) => ({ code, ...value })),
      market: { ...marketStatus(now, { time: state.ashare.marketTime ?? now }), checked: state.ashare.marketTime != null } },
    usstock: { cash: state.usstock.cash,
      holdings: Object.entries(state.usstock.holdings).map(([ticker, value]) => ({ ticker, ...value })),
      market: (({ status, nextOpen, closeAt }) => ({ status, nextOpen, closeAt }))(usMarketStatus(now)) },
    futures: { ...state.futures, positions: Object.entries(state.futures.positions).map(([symbol, value]) => ({ symbol, ...value })) },
    openOrders: state.orders, recent: Object.fromEntries(Object.entries(state.history).map(([kind, rows]) => [kind, rows.slice(0, 30)])),
    notices: [...state.notices, ...notices],
  };
}
export function transfer(state, data, now, fx) {
  const accounts = ['wallet', 'spot', 'futures', 'ashare', 'usstock'];
  const cents = account => account === 'ashare' || account === 'usstock';
  if (!accounts.includes(data.from) || !accounts.includes(data.to) || data.from === data.to) {
    throw { status: 400, code: 'bad_request' };
  }
  const amount = parse(data.amount);
  const decimals = cents(data.from) ? 2 : 8;
  if (amount <= 0n || amount !== roundTo(amount, decimals, 'floor')) throw { status: 400, code: 'bad_request' };
  const exchanging = data.from === 'ashare' || data.to === 'ashare';
  // PLATFORM §2.2：出账单位扣 0.2% 费用（ceil），随后换算，到账按目标精度 floor。
  if (exchanging && (!fx || now - fx.rateTime > 600000)) throw { status: 503, code: 'fx_unavailable' };
  const fee = exchanging ? roundTo(mul(amount, parse('0.002'), 'ceil'), decimals, 'ceil') : 0n;
  const net = amount - fee, rate = exchanging ? parse(fx.rate) : parse('1');
  if (net <= 0n || rate <= 0n) throw { status: 400, code: 'bad_request' };
  const converted = !exchanging ? net : data.to === 'ashare' ? mul(net, rate, 'floor') : div(net, rate, 'floor');
  const received = roundTo(converted, cents(data.to) ? 2 : 8, 'floor');
  if (!received) throw { status: 400, code: 'bad_request' };
  const location = account => account === 'wallet' ? [state.wallet, 'usd']
    : account === 'spot' ? [balance(state, 'USDT'), 'free']
    : account === 'futures' ? [state.futures, 'wallet'] : account === 'usstock' ? [state.usstock.cash, 'free'] : [state.ashare.cash, 'free'];
  const [source, sourceField] = location(data.from), [target, targetField] = location(data.to);
  if (parse(source[sourceField]) < amount) throw { status: 400, code: 'insufficient_balance' };
  source[sourceField] = toStr(parse(source[sourceField]) - amount);
  target[targetField] = toStr(parse(target[targetField]) + received);
  const asset = account => account === 'ashare' ? 'CNY' : account === 'wallet' || account === 'usstock' ? 'USD' : 'USDT';
  ledger(state, 'transfer_out', asset(data.from), -net, '划转', now, data.from);
  ledger(state, 'transfer_in', asset(data.to), received, '划转', now, data.to);
  if (fee) ledger(state, 'fx_fee', asset(data.from), -fee, '换汇费', now, data.from);
  return { rate: toStr(rate), rateTime: fx?.rateTime ?? null, fee: toStr(fee), received: toStr(received) };
}
