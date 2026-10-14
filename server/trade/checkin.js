// 每日签到使用北京时间，与全站点赞的日期一致。
// 每周循环（2026-10-14 客户要求）：本周第 n 次签到领 REWARDS[n-1]（20→50，第 7 次封顶），
// 不要求连续；每周一 00:00（北京时间）重新从第 1 次计算。同日重复签到返回 409。
// 奖励只记入统一钱包，并生成 USD 资金流水。
import { dayKey } from '../likes.js';
import { parse, toStr } from './decimal.js';
export const REWARDS = ['20', '25', '30', '35', '40', '45', '50'];
const DAY = 86400000;
const beijingWeekday = time => (new Date(time + 8 * 3600000).getUTCDay() + 6) % 7;   // 周一 = 0 … 周日 = 6
export const weekKey = time => dayKey(time - beijingWeekday(time) * DAY);            // 本周周一的日期
const dayTime = day => Date.parse(day + 'T12:00:00+08:00');
export function nextWeekStart(now) {
  const monday = Date.parse(weekKey(now) + 'T00:00:00+08:00');
  return monday + 7 * DAY;
}
// 本周已签到次数。旧数据只有 streak/last：若上次签到仍在本周，按本周内可能的天数折算，避免改版降档。
export function weekCount(checkin, now) {
  const week = weekKey(now);
  if (checkin.week) return checkin.week === week ? checkin.count || 0 : 0;
  if (!checkin.last || weekKey(dayTime(checkin.last)) !== week) return 0;
  return Math.max(1, Math.min(checkin.streak || 1, beijingWeekday(dayTime(checkin.last)) + 1));
}
export function checkinView(checkin, now) {
  const today = dayKey(now), checkedToday = checkin.last === today, count = weekCount(checkin, now);
  // 今天已签且明天进入新的一周（周日）时，下一次签到回到第 1 档。
  const nextCount = checkedToday && weekKey(now + DAY) !== weekKey(now) ? 0 : count;
  // streak 保留为兼容字段，含义改为“本周已签到次数”；dayIndex 指向今天对应（或已领）的档位。
  return { today, checkedToday, streak: count, weekCount: count, weekStart: weekKey(now), resetsAt: nextWeekStart(now),
    dayIndex: Math.min(checkedToday ? count - 1 : count, 6), rewards: REWARDS,
    nextReward: REWARDS[Math.min(nextCount, 6)], cap: '50', total: checkin.total, days: checkin.days };
}
export function checkin(state, now) {
  if (state.checkin.last === dayKey(now)) throw { status: 409, code: 'already_checked_in' };
  const count = weekCount(state.checkin, now), reward = REWARDS[Math.min(count, 6)];
  // PLATFORM §3：签到奖励只进钱包，保留 spot 的接口结构。
  state.wallet.usd = toStr(parse(state.wallet.usd) + parse(reward));
  state.checkin = { last: dayKey(now), week: weekKey(now), count: count + 1, streak: count + 1,
    total: toStr(parse(state.checkin.total) + parse(reward)), days: state.checkin.days + 1 };
  state.history.ledger.unshift({ t: now, kind: 'checkin', asset: 'USD', amount: reward, note: '每周签到 · 本周第 ' + (count + 1) + ' 次',
    market: 'wallet' });
  return reward;
}
