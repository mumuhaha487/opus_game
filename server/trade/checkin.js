// 每日签到使用北京时间，与全站点赞的日期一致。
// PLATFORM §3：第七天起封顶 50 USD，断签归第一档，同日返回 409。
// 奖励只记入统一钱包，并生成 USD 资金流水。
import { dayKey } from '../likes.js';
import { parse, toStr } from './decimal.js';
export const REWARDS = ['20', '25', '30', '35', '40', '45', '50'];
export function nextStreak(checkin, now) {
  return checkin.last === dayKey(now - 86400000) ? checkin.streak + 1 : 1;
}
export function checkinView(checkin, now) {
  const today = dayKey(now), checkedToday = checkin.last === today;
  // 规格 8、9.10：已连续天数只保留今日或昨日签到；断签显示 0，待领回第 1 档。
  const streak = checkedToday || checkin.last === dayKey(now - 86400000) ? checkin.streak : 0;
  // PLATFORM §3：保留旧视图字段，日卡索引与奖励在第七档封顶。
  const dayIndex = Math.min(checkedToday ? streak - 1 : streak, 6);
  return { today, checkedToday, streak, dayIndex, rewards: REWARDS,
    nextReward: REWARDS[Math.min(streak, 6)], cap: '50', total: checkin.total, days: checkin.days };
}
export function checkin(state, now) {
  if (state.checkin.last === dayKey(now)) throw { status: 409, code: 'already_checked_in' };
  const streak = nextStreak(state.checkin, now), reward = REWARDS[Math.min(streak - 1, 6)];
  // PLATFORM §3：签到奖励只进钱包，保留 spot 的接口结构。
  state.wallet.usd = toStr(parse(state.wallet.usd) + parse(reward));
  state.checkin = { last: dayKey(now), streak, total: toStr(parse(state.checkin.total) + parse(reward)),
    days: state.checkin.days + 1 };
  state.history.ledger.unshift({ t: now, kind: 'checkin', asset: 'USD', amount: reward, note: '每日签到', market: 'wallet' });
  return reward;
}
