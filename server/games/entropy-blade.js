// PLATFORM §5.3：熵刃存档清洗与进度合理性校验；经济常量来自真实 TALENTS 和 endRun。
// 开局计局数、结束发奖励；累计预算允许一次进行中的局结算，防止中途同步误拒。
// 返回标题的保留奖励另按每局未加倍率的奖励预算计入容差。
import { SAVE_DATA } from './plausibility-data.js';
export const ID = /^[A-Za-z0-9_]{1,24}$/;
export const TALENT_ID = /^[A-Za-z0-9_]{1,32}$/;
export const UPLOAD_ID = /^[A-Za-z0-9]{8,24}$/;
export const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const number = (v, max, integer = true) => typeof v === 'number' && Number.isFinite(v) && (!integer || Number.isInteger(v)) ? Math.min(max, Math.max(0, v)) : undefined;
const forbiddenKeys = new Set(['__proto__', 'constructor', 'prototype']);
function map(value, limit, keyPattern, clean) {
  const out = Object.create(null);
  if (isObject(value)) for (const [k, v] of Object.entries(value)) {
    if (Object.keys(out).length >= limit) break;
    if (forbiddenKeys.has(k) || !keyPattern.test(k)) continue;
    const c = clean(v);
    if (c !== undefined) out[k] = c;
  }
  return out;
}
const ENTROPY = SAVE_DATA.entropy;
export const MAX_CRYSTALS_PER_RUN = ENTROPY.crystalsPerRun;
const counters = ['runs', 'wins', 'kills', 'crystalsTotal', 'bossKills'];
const count = (save, key) => save?.stats?.[key] || 0;
const reject = reason => ({ ok: false, reason });
export function plausible(previous, next, elapsedMs) {
  const runs = count(next, 'runs'), total = count(next, 'crystalsTotal');
  const reset = Object.values(next.stats).every(value => value === 0) && !next.crystals && !next.titles.length
    && !Object.values(next.talents).some(Boolean) && !Object.values(next.heroBest).some(Boolean) && !next.history.length;
  if (reset) return { ok: true };
  // PLATFORM §5.3①④：统计只增；一分钟一局，加三局同步容差，首次仍按零时间。
  if (previous && counters.some(key => count(next, key) < count(previous, key))) return reject('entropy_counter_decreased');
  const addedRuns = runs - count(previous, 'runs');
  if (addedRuns > Math.max(0, elapsedMs) / 60000 + 3) return reject('entropy_runs_too_fast');
  if (count(next, 'wins') > runs || count(next, 'bossKills') > runs * ENTROPY.scenes) return reject('entropy_run_counters');
  let spent = 0;
  // PLATFORM §5.3②：逐级使用真实天赋成本，未知天赋和超过真实上限的等级拒绝。
  for (const [id, level] of Object.entries(next.talents)) {
    const costs = ENTROPY.talents[id];
    if (!costs || level > costs.length) return reject('entropy_talent_level');
    spent += costs.slice(0, level).reduce((sum, cost) => sum + cost, 0);
  }
  // PLATFORM §5.3③：累计预算不因同步次数重置；+1 仅承接开局已同步的在途局。
  if (total > runs * MAX_CRYSTALS_PER_RUN
    || total - count(previous, 'crystalsTotal') > (addedRuns + 1) * MAX_CRYSTALS_PER_RUN) {
    return reject('entropy_crystals_per_run');
  }
  const completed = Math.max(next.history.length, count(next, 'wins'), Math.ceil(total / MAX_CRYSTALS_PER_RUN));
  const abandonedBudget = Math.max(0, runs - completed) * (MAX_CRYSTALS_PER_RUN / 4 - 40);
  if ((next.crystals || 0) + spent > total + abandonedBudget) return reject('entropy_crystal_budget');
  // PLATFORM §5.3⑤：召唤与命中连击随时长增长；每帧每个敌人三次命中作为宽松预算。
  // game.planWaves: 每房 4 波 × 30 个 + 4 精英；main 固定 60 Hz；首领每秒最多两只召唤。
  const seconds = Math.max(180, elapsedMs / 1000, ...next.history.map(row => row.time),
    ...(previous?.history || []).map(row => row.time));
  const kills = ENTROPY.scenes * 6 * 124 + Math.ceil(seconds * 2);
  const hits = Math.ceil(seconds * 60 * 124 * 3);
  const scoreMax = Math.round((3000 + 7 * 150 + 4 * 800 + kills * 5 + hits * 8 + 2000) * (1 + ENTROPY.pts * 0.03));
  if (Object.values(next.heroBest).some(score => score > scoreMax)) return reject('entropy_score_budget');
  return { ok: true };
}
const numericStats = ['runs', 'wins', 'kills', 'crystalsTotal', 'bossKills', 'deepest', 'bestTrial'];
const historyRanges = { t: Number.MAX_SAFE_INTEGER, pts: 999, score: 1e9, time: 1e7, kills: 1e9, scene: 9, depth: 99, bosses: 99 };
function historyRow(v) {
  if (!isObject(v) || typeof v.hero !== 'string' || !ID.test(v.hero) || typeof v.weapon !== 'string' || !ID.test(v.weapon) || !['normal', 'hard', 'trial'].includes(v.mode) || typeof v.win !== 'boolean') return null;
  const out = { hero: v.hero, weapon: v.weapon, mode: v.mode, win: v.win };
  for (const [key, max] of Object.entries(historyRanges)) {
    const n = number(v[key], max, key !== 'time');
    if (n === undefined || n !== v[key]) return null;
    out[key] = n;
  }
  return out;
}
export function clean(value) {
  if (!isObject(value)) return null;
  const out = {};
  const assignNumber = (k, max) => { const v = number(value[k], max); if (v !== undefined) out[k] = v; };
  assignNumber('crystals', 1e9);
  assignNumber('lastChar', 15);
  out.talents = map(value.talents, 64, TALENT_ID, v => number(v, 99));
  out.heroBest = map(value.heroBest, 16, ID, v => number(v, 1e9));
  out.stats = {};
  if (isObject(value.stats)) for (const k of [...numericStats, 'bestTime']) {
    const v = number(value.stats[k], k === 'bestTime' ? 1e7 : 1e9, k !== 'bestTime');
    if (v !== undefined) out.stats[k] = v;
  }
  out.titles = Array.isArray(value.titles) ? [...new Set(value.titles.filter(t => typeof t === 'string' && [...t].length >= 1 && [...t].length <= 16 && !/[\u0000-\u001f\u007f-\u009f]/.test(t)))].slice(0, 32) : [];
  out.history = Array.isArray(value.history) ? value.history.map(historyRow).filter(Boolean).slice(0, 50) : [];
  out.lastWeapon = map(value.lastWeapon, 16, ID, v => typeof v === 'string' && ID.test(v) ? v : undefined);
  out.trialSel = map(value.trialSel, 32, ID, v => number(v, 9));
  if (['normal', 'hard'].includes(value.lastMode)) out.lastMode = value.lastMode;
  if (typeof value.seenTutorial === 'boolean') out.seenTutorial = value.seenTutorial;
  // 上传编号（客户端每次 PUT 附一个，最近 16 个）：回复丢失时设备凭它认出已落地的上传；没有这一项的旧存档清洗结果不变
  if (Array.isArray(value.ups)) out.ups = [...new Set(value.ups.filter(id => typeof id === 'string' && UPLOAD_ID.test(id)))].slice(-16);
  return out;
}
