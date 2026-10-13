// 每个全站账号独立保存 trade/<uid>.json。
// 规格 5.4：etag 条件写、最多四次重试、历史与 clientId 有上限。
// 余额调整通过定点十进制完成，读写边界保持字符串。
import { absent } from '../store.js';
import { parse, toStr, credit, debit } from './decimal.js';
import { checkinView } from './checkin.js';
export const tradeKey = uid => `trade/${uid}.json`;
export function defaultState(now = Date.now()) {
  return {
    v: 1, created: now, updated: now, seq: 0,
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
  for (const [kind, limit] of Object.entries({ orders: 100, trades: 200, ledger: 200 })) {
    state.history[kind] = (state.history[kind] || []).slice(0, limit);
  }
  state.clientIds = state.clientIds.slice(0, 50);
  return state;
}
export async function readState(bucket, uid, now = Date.now()) {
  const object = await bucket.get(tradeKey(uid));
  return { state: normalize(object ? await object.json() : null, now), etag: object?.etag || null };
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
    futures: { ...state.futures, positions: Object.entries(state.futures.positions).map(([symbol, value]) => ({ symbol, ...value })) },
    openOrders: state.orders, recent: Object.fromEntries(Object.entries(state.history).map(([kind, rows]) => [kind, rows.slice(0, 30)])),
    notices,
  };
}
export function transfer(state, data, now) {
  if (!['spot', 'futures'].includes(data.from) || !['spot', 'futures'].includes(data.to) || data.from === data.to) {
    throw { status: 400, code: 'bad_request' };
  }
  const amount = parse(data.amount);
  if (amount <= 0n || amount !== credit(amount)) throw { status: 400, code: 'bad_request' };
  if (data.from === 'spot') {
    adjustBalance(state, 'USDT', 'free', -debit(amount));
    state.futures.wallet = toStr(parse(state.futures.wallet) + credit(amount));
  } else {
    if (parse(state.futures.wallet) < amount) throw { status: 400, code: 'insufficient_balance' };
    state.futures.wallet = toStr(parse(state.futures.wallet) - debit(amount));
    adjustBalance(state, 'USDT', 'free', credit(amount));
  }
  ledger(state, 'transfer_out', 'USDT', -amount, '划转', now, data.from);
  ledger(state, 'transfer_in', 'USDT', amount, '划转', now, data.to);
}
