// 发布时运行的纯函数自检，不访问网络或存储。
// 覆盖定点十进制、记账舍入、现货手续费与签到日历。
// 强平价与合约保证金使用生产函数核对，全部检查保持纯函数。
import * as decimal from './decimal.js';
import { defaultState, transfer } from './state.js';
import { checkin, nextStreak, REWARDS } from './checkin.js';
import { FEE_RATE } from './spot.js';
import { liquidation, removable, MAKER, TAKER } from './futures.js';
const assert = (condition, label) => { if (!condition) throw new Error('trade selfcheck: ' + label); };
export function liquidationPrice(entry, qty, margin, maintenanceRate, side) {
  // 规格 7.7：逐仓多/空强平价；多仓结果 ≤ 0 时返回 null。
  const notional = decimal.mul(entry, qty, 'floor');
  const numerator = side === 'long' ? notional - margin : notional + margin;
  if (numerator <= 0n) return null;
  const factor = side === 'long' ? decimal.SCALE - maintenanceRate : decimal.SCALE + maintenanceRate;
  return decimal.div(numerator, decimal.mul(qty, factor, 'floor'), 'half');
}
export function runSelfcheck() {
  const { parse, toStr, mul, div, credit, debit, roundTo } = decimal;
  assert(toStr(parse('1.2300')) === '1.23', 'decimal serialization');
  assert(mul(parse('0.1'), parse('0.2'), 'floor') === parse('0.02'), 'decimal multiply');
  assert(toStr(div(parse('1'), parse('4'), 'half')) === '0.25', 'decimal division');
  assert(roundTo(-parse('1.001'), 2, 'floor') === -parse('1.01'), 'signed rounding');
  for (const invalid of [1, '1e3', '-1', '+1', '01', '1.', '.1', '1000000000000000']) {
    let refused = false;
    try { parse(invalid); } catch { refused = true; }
    assert(refused, 'strict parse');
  }
  let seed = 73517;
  // 规格 5.2：1000 组可重复的随机交易，入账 floor、出账 ceil 永远不多发资产。
  for (let i = 0; i < 1000; i++) {
    seed = (seed * 16807) % 2147483647;
    const amount = BigInt(seed) * 1234567n;
    const fee = debit(mul(amount, FEE_RATE, 'ceil'));
    assert(credit(amount) - fee <= amount - mul(amount, FEE_RATE, 'floor'), 'credit conservation');
    assert(credit(amount) - debit(amount) <= 0n, 'debit conservation');
  }
  assert(debit(mul(parse('0.01'), FEE_RATE, 'ceil')) === parse('0.00001'), 'spot fee');
  const entry = parse('100'), qty = parse('2'), margin = parse('20'), maintenance = parse('0.005');
  assert(toStr(liquidationPrice(entry, qty, margin, maintenance, 'long'), 8) === '90.45226131', 'long liq');
  assert(toStr(liquidationPrice(entry, qty, margin, maintenance, 'short'), 8) === '109.45273632', 'short liq');
  assert(liquidationPrice(entry, qty, parse('200'), maintenance, 'long') === null, 'nonpositive liq');
  const position = { entry: '100', qty: '2', margin: '20', mmr: '0.005', side: 'long', leverage: 20 };
  assert(liquidation(position) === liquidationPrice(entry, qty, margin, maintenance, 'long'), 'production long liq');
  assert(removable(position, parse('100')) === parse('10'), 'removable margin');
  assert(toStr(debit(mul(parse('100'), MAKER, 'ceil'))) === '0.02', 'futures maker');
  assert(toStr(debit(mul(parse('100'), TAKER, 'ceil'))) === '0.05', 'futures taker');
  const now = Date.parse('2026-12-31T15:59:00Z'), state = defaultState(now);
  assert(checkin(state, now) === REWARDS[0], 'first reward');
  assert(nextStreak(state.checkin, now + 60000) === 2, 'CST cross year');
  assert(nextStreak(state.checkin, now + 2 * 86400000) === 1, 'missed day');
  // PLATFORM §3：新奖励表逐日递增，第七天以后保持 50 USD。
  for (let i = 1; i < 10; i++) assert(checkin(state, now + i * 86400000) === REWARDS[Math.min(i, 6)], 'reward cap');
  // PLATFORM §2.2：生产划转核对 0.2% 费用、CNY floor 与往返资产守恒。
  const funds = defaultState(now); funds.wallet.usd = '10';
  const fx = { rate: '6.6944', rateTime: now };
  const outbound = transfer(funds, { from: 'wallet', to: 'ashare', amount: '10' }, now, fx);
  assert(outbound.fee === '0.02' && outbound.received === '66.81', 'fx fee 0.2%');
  transfer(funds, { from: 'ashare', to: 'wallet', amount: funds.ashare.cash.free }, now, fx);
  assert(parse(funds.wallet.usd) < parse('10'), 'fx roundtrip conservation');
  return { checks: ['decimal', 'rounding:1000', 'spot-fee', 'liquidation-formula', 'futures-fee', 'futures-margin',
    'checkin-calendar', 'fx-fee:0.2%', 'fx-conservation'] };
}
runSelfcheck();
