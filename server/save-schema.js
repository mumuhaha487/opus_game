export const ID = /^[A-Za-z0-9_]{1,24}$/;
export const TALENT_ID = /^[A-Za-z0-9_]{1,32}$/;
export const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const number = (v, max, integer = true) => typeof v === 'number' && Number.isFinite(v) && (!integer || Number.isInteger(v)) ? Math.min(max, Math.max(0, v)) : undefined;
function map(value, limit, keyPattern, clean) {
  const out = Object.create(null);
  if (isObject(value)) for (const [k, v] of Object.entries(value)) {
    if (Object.keys(out).length >= limit) break;
    if (!keyPattern.test(k)) continue;
    const c = clean(v);
    if (c !== undefined) out[k] = c;
  }
  return out;
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
export function cleanSave(value) {
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
  return out;
}
