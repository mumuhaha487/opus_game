// 美股交易日历：纽约时间（自动夏令时）、纽交所假日与半日市。只服务常规时段 09:30–16:00 ET。
// 时间全部为 Unix 毫秒；“日”用纽约当地日期 YYYY-MM-DD。浏览器与 Worker 共用（无依赖）。
const ZONE = 'America/New_York';
const parts = new Intl.DateTimeFormat('en-US', { timeZone: ZONE, hourCycle: 'h23', year: 'numeric', month: '2-digit',
  day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short' });
// 纽交所休市日（含观察日）与 13:00 提前收盘日，覆盖 2026–2027；过期后需随年度更新。
export const US_HOLIDAYS = new Set([
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07',
  '2026-11-26', '2026-12-25',
  '2027-01-01', '2027-01-18', '2027-02-15', '2027-03-26', '2027-05-31', '2027-06-18', '2027-07-05', '2027-09-06',
  '2027-11-25', '2027-12-24',
]);
export const US_EARLY_CLOSE = new Set(['2026-11-27', '2026-12-24', '2027-11-26']);
export function nyParts(time) {
  const out = {};
  for (const { type, value } of parts.formatToParts(new Date(time))) out[type] = value;
  return { date: `${out.year}-${out.month}-${out.day}`, hour: +out.hour, minute: +out.minute, second: +out.second,
    weekday: out.weekday };
}
// 纽约当地 date + HH:MM → UTC 毫秒（按该时刻的实际 UTC 偏移，处理夏令时切换）。
export function nyTime(date, hour = 0, minute = 0) {
  const guess = Date.parse(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`);
  let time = guess + 5 * 3600000;                                  // 先按 UTC-5 估计
  for (let i = 0; i < 2; i++) {
    const p = nyParts(time), seen = Date.parse(`${p.date}T${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}:00Z`);
    time += guess - seen;
  }
  return time;
}
export const nyOffsetMinutes = time => {
  const p = nyParts(time);
  return Math.round((Date.parse(`${p.date}T${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}:${String(p.second).padStart(2, '0')}Z`) - Math.floor(time / 1000) * 1000) / 60000);
};
const shiftDate = (date, days) => new Date(Date.parse(date + 'T12:00:00Z') + days * 86400000).toISOString().slice(0, 10);
export function isTradingDay(date) {
  const weekday = new Date(date + 'T12:00:00Z').getUTCDay();
  return weekday !== 0 && weekday !== 6 && !US_HOLIDAYS.has(date);
}
export function sessionFor(date) {
  if (!isTradingDay(date)) return null;
  return { date, open: nyTime(date, 9, 30), close: nyTime(date, US_EARLY_CLOSE.has(date) ? 13 : 16, 0),
    early: US_EARLY_CLOSE.has(date) };
}
export function nextSession(time) {
  let date = nyParts(time).date;
  for (let i = 0; i < 15; i++, date = shiftDate(date, 1)) {
    const session = sessionFor(date);
    if (session && session.close > time) return session;
  }
  return null;
}
// status：open（常规时段）、pre（交易日开盘前）、post（交易日收盘后）、closed（周末/假日）。
export function usMarketStatus(now) {
  const today = sessionFor(nyParts(now).date);
  if (today && now >= today.open && now < today.close) return { status: 'open', session: today, nextOpen: null, closeAt: today.close };
  const next = nextSession(now + (today && now >= today.close ? 1 : 0));
  const status = !today ? 'closed' : now < today.open ? 'pre' : 'post';
  const upcoming = today && now < today.open ? today : next && next.open > now ? next : nextSession(next ? next.close : now);
  return { status, session: upcoming, nextOpen: upcoming?.open ?? null, closeAt: upcoming?.close ?? null };
}
