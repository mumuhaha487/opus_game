'use strict';
const PROGRESS_FIELDS = ['crystals', 'talents', 'stats', 'heroBest', 'titles', 'history', 'lastChar', 'lastMode', 'lastWeapon', 'trialSel', 'seenTutorial'];
function pickProgress(data) {
  const out = {};
  for (const key of PROGRESS_FIELDS) if (data && Object.prototype.hasOwnProperty.call(data, key)) out[key] = JSON.parse(JSON.stringify(data[key]));
  return out;
}
function progressDefaults() {
  return { crystals: 0, talents: {}, stats: { runs: 0, wins: 0, kills: 0, crystalsTotal: 0, bossKills: 0, deepest: 0, bestTrial: 0, bestTime: 0 }, heroBest: {}, titles: [], history: [], lastChar: 0, lastMode: 'normal', lastWeapon: {}, trialSel: {}, seenTutorial: false };
}
function mergeProgress(base, local, remote) {
  const normalize = p => { const d = progressDefaults(), v = pickProgress(p); return Object.assign(d, v, { stats: Object.assign(d.stats, v.stats) }); };
  const b = normalize(base), l = normalize(local), r = normalize(remote), out = pickProgress(l);
  for (const key of ['runs', 'wins', 'kills', 'crystalsTotal', 'bossKills']) out.stats[key] = r.stats[key] + Math.max(0, l.stats[key] - b.stats[key]);
  for (const key of ['deepest', 'bestTrial']) out.stats[key] = Math.max(l.stats[key], r.stats[key]);
  const times = [l.stats.bestTime, r.stats.bestTime].filter(n => n > 0);
  out.stats.bestTime = times.length ? Math.min(...times) : 0;
  out.crystals = Math.max(0, r.crystals + l.crystals - b.crystals);
  for (const field of ['talents', 'heroBest']) {
    out[field] = Object.create(null);
    for (const key of new Set([...Object.keys(l[field]), ...Object.keys(r[field])])) out[field][key] = Math.max(l[field][key] || 0, r[field][key] || 0);
  }
  out.titles = [...new Set([...r.titles, ...l.titles])];
  const history = new Map();
  for (const row of [...r.history, ...l.history]) history.set(row.t + ':' + row.hero, row);
  out.history = [...history.values()].sort((a, b) => b.t - a.t).slice(0, 50);
  return out;
}
function hasProgress(p) {
  return !!p && ((p.stats?.runs || 0) > 0 || p.crystals > 0 || Object.keys(p.talents || {}).length > 0 || (p.history || []).length > 0);
}
