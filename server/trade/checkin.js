// 每日签到使用北京时间，与全站点赞的日期一致。
// 规格第 8 节：七天一轮，断签归第一档，同日返回 409。
// 奖励记入现货 USDT，并生成账户资金流水。
import { dayKey } from '../likes.js';
import { parse, toStr } from './decimal.js';
export const REWARDS = ['1000', '1000', '1500', '1500', '2000', '2000', '5000'];
export function nextStreak(checkin, now) {
  return checkin.last === dayKey(now - 86400000) ? checkin.streak + 1 : 1;
}
export function checkinView(checkin, now) {
  const today = dayKey(now), checkedToday = checkin.last === today;
  const streak = checkedToday ? checkin.streak : nextStreak(checkin, now);
  const dayIndex = (streak - 1) % 7;
  return { today, checkedToday, streak: checkin.streak, dayIndex, rewards: REWARDS,
    nextReward: REWARDS[checkedToday ? streak % 7 : dayIndex], total: checkin.total, days: checkin.days };
}
export function checkin(state, now) {
  if (state.checkin.last === dayKey(now)) throw { status: 409, code: 'already_checked_in' };
  const streak = nextStreak(state.checkin, now), reward = REWARDS[(streak - 1) % 7];
  const funds = state.spot.balances.USDT;
  funds.free = toStr(parse(funds.free) + parse(reward));
  state.checkin = { last: dayKey(now), streak, total: toStr(parse(state.checkin.total) + parse(reward)),
    days: state.checkin.days + 1 };
  state.history.ledger.unshift({ t: now, kind: 'checkin', asset: 'USDT', amount: reward, note: '每日签到', market: 'spot' });
  return reward;
}
