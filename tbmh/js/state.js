'use strict';
// =====================================================================
//  STATE — save shape, migration, derived hero and party stats
// =====================================================================
const SAVE_VERSION = 3;

function newItem(s, t, g, l, extra = {}) {
  const k = GRADES[g].sockets;
  return { u: s.uid++, t, g, l, q: 1, s: [], sd: Array(k[0]).fill(null), se: Array(k[1]).fill(null), si: Array(k[2]).fill(null), ...extra };
}
// a recruit joins with the guild's training weapon
function newHero(s, cls) {
  const h = { lv: 1, exp: 0, eq: Object.fromEntries(SLOTS.map(k => [k, null])), sk: {}, act: [null, null] };
  const it = newItem(s, CLASSES[cls].weapon, 0, 1, { s: [['atkPct', 0.05]] });
  if (TYPES[it.t].elemRoll) it.el = TYPES[it.t].elemRoll[0];
  h.eq.weapon = it;
  return h;
}
function newSave(now = Date.now(), first = 'knight') {
  const s = {
    v: SAVE_VERSION, t: now, created: now, seed: (Math.random() * 2 ** 31) >>> 0, uid: 1,
    gold: 0,
    heroes: {}, party: [first, null, null], deployT: 0,
    inv: [], mats: {}, tray: [],
    cube: { lv: 1, exp: 0, filter: GRADES.map((g, i) => i < 2) },
    runes: {},
    pets: { own: {}, cur: null },
    prog: { d: 0, a: 1, s: 1, w: 1, best: [0, 0, 0, 0], farm: false, auto: false, fails: 0, clears: 0 },
    codex: { m: {}, c: {}, b: {}, l: {}, n: {} },
    stats: { kills: 0, elites: 0, champs: 0, bosses: 0, gold: 0, play: 0, items: 0, legends: 0, deaths: 0, crits: 0, casts: 0, opened: 0, synth: 0, alch: 0, bestGrade: 0, stages: 0, lost: 0 },
    ach: {},
    keepUp: true,
    opts: { music: 0.45, sfx: 0.7, shake: 1, nums: 1, autoEquip: 0, fx: 1, autoSkill: 1 },
    flags: {},
  };
  s.heroes[first] = newHero(s, first);
  Skills.auto(s, first);
  return s;
}

// ---------- normalize anything loaded (local storage, cloud, imported code) ----------
const finite = (v, d = 0, lo = 0, hi = 1e300) => typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : d;
const int = (v, d = 0, lo = 0, hi = 1e9) => Math.floor(finite(v, d, lo, hi));
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const inscribeOk = x => Array.isArray(x) && INSCRIBE_POOL.includes(x[0]) && Number.isFinite(x[1]);

function cleanItem(it, slot) {
  if (!isObj(it) || !TYPES[it.t]) return null;
  const T = TYPES[it.t];
  if (slot && T.slot !== slot) return null;
  const g = int(it.g, 0, 0, GRADE_MAX), K = GRADES[g].sockets;
  const out = { u: int(it.u, 0, 0, 1e9), t: it.t, g, l: int(it.l, 1, 1, 100), q: finite(it.q, 1, 0.9, 1.1), s: [] };
  if (Array.isArray(it.s)) for (const a of it.s.slice(0, GRADES[g].affixes)) if (Array.isArray(a) && AFFIXES[a[0]] && !out.s.some(x => x[0] === a[0])) out.s.push([a[0], finite(a[1], 0, 0, 10)]);
  if (it.lg && LEGENDS[it.lg] && g >= LEGEND_GRADE && legendsFor(it.t).includes(it.lg)) out.lg = it.lg;
  if (T.elemRoll) out.el = T.elemRoll.includes(it.el) ? it.el : T.elemRoll[0];
  const sock = (arr, n, ok) => Array.from({ length: n }, (_, i) => (Array.isArray(arr) && ok(arr[i]) ? arr[i] : null));
  out.sd = sock(it.sd, K[0], v => typeof v === 'string' && MATS[v]?.kind === 'gem');
  out.se = sock(it.se, K[1], v => typeof v === 'string' && MATS[v]?.kind === 'part');
  out.si = sock(it.si, K[2], inscribeOk).map(v => (v ? [v[0], finite(v[1], 0, 0, 10)] : null));
  if (it.k) out.k = 1;
  return out;
}
function cleanHero(raw, cls) {
  const h = { lv: int(raw.lv, 1, 1, HERO_MAX_LEVEL), exp: finite(raw.exp, 0, 0, 1e300), eq: {}, sk: {}, act: [null, null] };
  for (const slot of SLOTS) { const it = isObj(raw.eq) ? cleanItem(raw.eq[slot], slot) : null; h.eq[slot] = it && canWear(cls, it.t) ? it : null; }
  if (isObj(raw.sk)) for (const id of skillTree(cls)) if (raw.sk[id] > 0) h.sk[id] = int(raw.sk[id], 0, 0, SKILLS[id].max);
  if (Array.isArray(raw.act)) h.act = [0, 1].map(i => { const id = raw.act[i]; return ACTIVES[id] && ACTIVES[id].cls === cls && h.sk[id] ? id : null; });
  if (h.act[0] && h.act[0] === h.act[1]) h.act[1] = null;
  // a tree that no longer adds up is given back in full
  if (!Skills.valid(h)) { h.sk = {}; h.act = [null, null]; }
  return h;
}

function normalizeSave(raw, now = Date.now()) {
  const s = newSave(now);
  if (!isObj(raw)) return s;
  // options survive every version
  if (isObj(raw.opts)) {
    const o = raw.opts;
    s.opts.music = finite(o.music, s.opts.music, 0, 1); s.opts.sfx = finite(o.sfx, s.opts.sfx, 0, 1);
    for (const k of ['shake', 'nums', 'autoEquip', 'fx', 'autoSkill']) if (o[k] !== undefined) s.opts[k] = o[k] ? 1 : 0;
  }
  if (isObj(raw.flags)) for (const k of Object.keys(raw.flags).slice(0, 60)) if (/^[a-z_0-9]{1,24}$/.test(k) && raw.flags[k]) s.flags[k] = 1;
  if (raw.v === 2) return migrateV2(raw, s, now);
  if (raw.v !== SAVE_VERSION) {
    // a first-edition hunter keeps the play time; the new world starts from 1-1
    if (raw.v === 1) { s.flags.v1 = 1; s.stats.play = finite(raw.stats?.play); }
    return s;
  }
  s.t = int(raw.t, now, 0, 1e15); s.created = int(raw.created, s.t, 0, 1e15);
  s.seed = int(raw.seed, s.seed, 0, 2 ** 32); s.uid = int(raw.uid, 1, 1, 1e9);
  s.gold = finite(raw.gold);
  s.heroes = {};
  if (isObj(raw.heroes)) for (const cls of CLASS_IDS) if (isObj(raw.heroes[cls])) s.heroes[cls] = cleanHero(raw.heroes[cls], cls);
  if (Array.isArray(raw.party)) s.party = [0, 1, 2].map(i => { const c = raw.party[i]; return s.heroes[c] ? c : null; });
  s.party = s.party.map((c, i) => (c && s.party.indexOf(c) === i ? c : null));
  if (!Object.keys(s.heroes).length) { s.heroes.knight = newHero(s, 'knight'); Skills.auto(s, 'knight'); }
  if (!s.party.some(Boolean)) s.party[0] = Object.keys(s.heroes)[0];
  s.deployT = int(raw.deployT, 0, 0, 1e15);
  s.inv = Array.isArray(raw.inv) ? raw.inv.slice(0, 2000).map(it => cleanItem(it)).filter(Boolean) : [];
  if (isObj(raw.mats)) for (const id of MAT_IDS) if (raw.mats[id] > 0) s.mats[id] = int(raw.mats[id], 0, 0, 1e9);
  if (Array.isArray(raw.tray)) s.tray = raw.tray.slice(0, 120).filter(c => isObj(c) && CHESTS[c.k]).map(c => ({ k: int(c.k, 0, 0, 2), d: int(c.d, 0, 0, DIFFS.length - 1), L: int(c.L, 1, 1, 100), a: int(c.a, 1, 1, ACT_COUNT) }));
  if (isObj(raw.cube)) {
    s.cube.lv = int(raw.cube.lv, 1, 1, CUBE_MAX); s.cube.exp = finite(raw.cube.exp);
    if (Array.isArray(raw.cube.filter)) s.cube.filter = GRADES.map((g, i) => raw.cube.filter[i] === true);
  }
  if (isObj(raw.runes)) for (const n of RUNE_SPEC) if (raw.runes[n.id]) s.runes[n.id] = int(raw.runes[n.id], 0, 0, n.max);
  for (const n of RUNE_SPEC) if (s.runes[n.id] && n.p && !s.runes[n.p]) delete s.runes[n.id];
  if (isObj(raw.pets)) {
    if (isObj(raw.pets.own)) for (const id of PET_IDS) if (raw.pets.own[id]) s.pets.own[id] = 1;
    s.pets.cur = s.pets.own[raw.pets.cur] ? raw.pets.cur : null;
  }
  if (isObj(raw.prog)) {
    const p = raw.prog;
    s.prog.best = DIFFS.map((D, d) => int(p.best?.[d], 0, 0, FULL));
    for (let d = 1; d < DIFFS.length; d++) if (s.prog.best[d - 1] < FULL) s.prog.best[d] = 0;
    s.prog.d = int(p.d, 0, 0, DIFFS.length - 1); s.prog.a = int(p.a, 1, 1, ACT_COUNT); s.prog.s = int(p.s, 1, 1, STAGES);
    if (!stageOpen(s, s.prog.d, s.prog.a, s.prog.s)) { s.prog.d = 0; s.prog.a = 1; s.prog.s = 1; }
    s.prog.farm = !!p.farm; s.prog.auto = !!p.auto; s.prog.fails = int(p.fails, 0, 0, 9); s.prog.clears = int(p.clears, 0, 0, 99);
  }
  if (isObj(raw.codex)) cleanCodex(s, raw.codex);
  if (isObj(raw.stats)) for (const k in s.stats) s.stats[k] = finite(raw.stats[k]);
  if (isObj(raw.ach)) for (const a of ACHIEVEMENTS) if (raw.ach[a.id]) s.ach[a.id] = 1;
  s.keepUp = raw.keepUp !== false;
  fixUid(s);
  return s;
}
function cleanCodex(s, c) {
  for (const id in MONSTERS) if (c.m?.[id]) s.codex.m[id] = int(c.m[id], 0, 0, 1e12);
  for (const k in c.c || {}) if (/^[1-3]-\d{1,2}$/.test(k)) s.codex.c[k] = int(c.c[k], 0, 0, 1e9);
  // a fight time per difficulty; -1 marks a stage boss that has fallen (they have no timer)
  for (const id of BOSS_IDS) if (Array.isArray(c.b?.[id])) s.codex.b[id] = DIFFS.map((D, d) => finite(c.b[id][d], 0, -1, 1e6));
  for (const id of LEGEND_IDS) if (c.l?.[id]) s.codex.l[id] = 1;
  for (const id of TYPE_IDS) if (c.n?.[id]) s.codex.n[id] = int(c.n[id], 0, 0, 2 ** 20 - 1);
}
function fixUid(s) {
  let maxU = 0;
  for (const it of s.inv) maxU = Math.max(maxU, it.u);
  for (const cls in s.heroes) for (const slot of SLOTS) maxU = Math.max(maxU, s.heroes[cls].eq[slot]?.u || 0);
  s.uid = Math.max(s.uid, maxU + 1);
}

// ---------- the second edition joins the third: one hunter becomes the first hero of the party ----------
const V2_FAM_CLASS = { sword: 'knight', axe: 'slayer', bow: 'ranger', crossbow: 'hunter', staff: 'sorcerer', scepter: 'priest' };
const V2_TYPE = { quiver: 'arrow', bolts: 'bolt', head: 'helm', chest: 'armor', hands: 'gloves', feet: 'boots', neck: 'amulet', ear: 'earring', wrist: 'bracer' };
const V2_SLOT = { main: 'weapon', off: 'offhand', head: 'helm', chest: 'armor', hands: 'gloves', feet: 'boots', neck: 'amulet', ear: 'earring', ring: 'ring', wrist: 'bracer' };
const V2_GRADE = [0, 1, 2, 2, 3, 4, 5, 6, 7, 9];
const V2_AFFIX = { chest: 'chestN', ice: 'cold', light: 'lightning', poison: 'chaos' };
// rune prices of the second edition: [base, growth]; every level bought comes back as gold
const V2_RUNE_COST = {
  aw1: [2000, 1.8], slot2: [50000, 1], petres: [30000, 2], skillmast: [20000, 1.6], slot3: [3e6, 1], slot4: [2e8, 1], blade: [100, 1.35], haste: [800, 1.4],
  precise: [1500, 1.4], lethal: [6000, 1.42], rend: [6000, 1.42], berserk: [1.5e6, 1.6], body: [100, 1.35], iron: [800, 1.4], leech: [2000, 1.4], mend: [6000, 1.42],
  thorn: [6000, 1.42], unbroken: [1.5e6, 1.6], bounty: [150, 1.36], bossgold: [1200, 1.4], alchemy: [2000, 1.4], cubeexp: [5000, 1.42], wisdom: [3000, 1.38],
  goldtouch: [2e6, 1.6], seek: [300, 1.4], tray: [2000, 1.6], autoN: [20000, 1], autoB: [250000, 1], appraise: [8000, 1.45], hoard: [3e6, 1.6], pack: [500, 1.7],
  sleep: [5000, 1.8], dream: [20000, 1.6], autoalch: [60000, 1], vault: [5e6, 3], elem: [1000, 1.4], r_phys: [3000, 1.42], r_fire: [9000, 1.42], r_ice: [27000, 1.42],
  r_light: [81000, 1.42], r_poison: [2.4e5, 1.42], r_holy: [7e5, 1.42], hunt: [1000, 1.4], slayer: [4000, 1.42], march: [15000, 2], wanted: [50000, 1.6], kingslayer: [4e6, 1.6],
};
function migrateItemV2(s, it) {
  if (!isObj(it)) return null;
  const t = V2_TYPE[it.t] || it.t;
  // medals have no slot any more: they are melted down at their alchemy price
  if (!TYPES[t]) { s.gold += alchGoldOf(V2_GRADE[int(it.g, 0, 0, 9)], int(it.l, 1, 1, 100)); return null; }
  const g = V2_GRADE[int(it.g, 0, 0, 9)];
  const out = { u: s.uid++, t, g, l: int(it.l, 1, 1, 100), q: finite(it.q, 1, 0.9, 1.1), s: [] };
  if (Array.isArray(it.s)) for (const a of it.s) {
    const k = Array.isArray(a) ? V2_AFFIX[a[0]] || a[0] : null;
    if (k && AFFIXES[k] && !out.s.some(x => x[0] === k) && out.s.length < GRADES[g].affixes) out.s.push([k, finite(a[1], 0, 0, 10)]);
  }
  if (TYPES[t].elemRoll) out.el = V2_AFFIX[it.el] && TYPES[t].elemRoll.includes(V2_AFFIX[it.el]) ? V2_AFFIX[it.el] : TYPES[t].elemRoll.includes(it.el) ? it.el : TYPES[t].elemRoll[0];
  if (g >= LEGEND_GRADE) {
    const list = legendsFor(t);
    out.lg = list.includes(it.lg) ? it.lg : list[out.u % list.length];
  }
  const K = GRADES[g].sockets;
  out.sd = Array(K[0]).fill(null); out.se = Array(K[1]).fill(null); out.si = Array(K[2]).fill(null);
  if (it.k) out.k = 1;
  return out;
}
const V2_GEM_STAT = { ruby: 'atkPct', sapphire: 'hpPct', topaz: 'aspd', emerald: 'crit', amethyst: 'cdmg' };
function migrateMatV2(id) {
  let m;
  if ((m = /^gem_(\w+)_(\d)$/.exec(id))) {
    const g = +m[2], list = matsOf('gem', g);
    return list.find(x => MATS[x].stat === V2_GEM_STAT[m[1]]) || list[0];
  }
  if ((m = /^p_\w+_(\d)$/.exec(id))) return matsOf('part', +m[1])[0];
  if ((m = /^scroll_(\d)$/.exec(id))) return `scroll${m[1]}`;
  if ((m = /^ore_(\d)$/.exec(id))) return `ore${m[1]}_0`;
  if (id === 'chaos') return 'ore5_0';
  if ((m = /^coin_(\d)$/.exec(id))) return `coin${m[1]}`;
  if ((m = /^wanted_(\d)$/.exec(id))) return `stone${m[1]}`;
  return null;
}
function migrateV2(raw, s, now) {
  s.flags.v2 = 1;
  s.t = int(raw.t, now, 0, 1e15); s.created = int(raw.created, s.t, 0, 1e15);
  s.seed = int(raw.seed, s.seed, 0, 2 ** 32); s.uid = Math.max(s.uid, int(raw.uid, 1, 1, 1e9));
  s.gold = finite(raw.gold);
  // the old main weapon decides the class
  const fam = isObj(raw.eq?.main) && ({ sword: 'sword', axe: 'axe', bow: 'bow', crossbow: 'crossbow', staff: 'staff', scepter: 'scepter' })[raw.eq.main.t];
  const cls = V2_FAM_CLASS[fam] || 'knight';
  s.heroes = {}; s.party = [cls, null, null];
  const h = s.heroes[cls] = { lv: int(raw.hero?.lv, 1, 1, HERO_MAX_LEVEL), exp: 0, eq: Object.fromEntries(SLOTS.map(k => [k, null])), sk: {}, act: [null, null] };
  const loose = [];
  if (isObj(raw.eq)) for (const old in V2_SLOT) {
    const it = migrateItemV2(s, raw.eq[old]);
    if (!it) continue;
    const slot = TYPES[it.t].slot;
    if (slot === V2_SLOT[old] && canWear(cls, it.t) && !h.eq[slot]) h.eq[slot] = it; else loose.push(it);
  }
  if (!h.eq.weapon) { const w = newHero(s, cls).eq.weapon; h.eq.weapon = w; }
  s.inv = loose.concat(Array.isArray(raw.inv) ? raw.inv.slice(0, 400).map(it => migrateItemV2(s, it)).filter(Boolean) : []);
  if (isObj(raw.mats)) for (const id in raw.mats) { const to = migrateMatV2(id); if (to && raw.mats[id] > 0) s.mats[to] = (s.mats[to] || 0) + int(raw.mats[id], 0, 0, 1e9); }
  // nine regions of ten stages fold into three acts of ten
  if (isObj(raw.prog) && Array.isArray(raw.prog.best)) s.prog.best = DIFFS.map((D, d) => clamp(Math.floor(int(raw.prog.best[d], 0, 0, 90) / 3), 0, FULL));
  for (let d = 1; d < DIFFS.length; d++) if (s.prog.best[d - 1] < FULL) s.prog.best[d] = 0;
  const d = topDiff(s), i = Math.min(FULL - 1, s.prog.best[d]);
  s.prog.d = d; s.prog.a = Math.floor(i / STAGES) + 1; s.prog.s = Math.min(STAGES - 1, (i % STAGES) + 1);
  if (Array.isArray(raw.tray)) s.tray = raw.tray.slice(0, 18).filter(c => isObj(c) && CHESTS[c.k]).map(c => ({ k: int(c.k, 0, 0, 2), d: int(c.d, 0, 0, 3), L: int(c.L, 1, 1, 100), a: clamp(Math.ceil(int(c.a, 1, 1, 9) / 3), 1, ACT_COUNT) }));
  if (isObj(raw.cube)) { s.cube.lv = int(raw.cube.lv, 1, 1, CUBE_MAX); s.cube.exp = finite(raw.cube.exp); }
  // every rune level bought in the second edition comes back as gold
  let refund = 0;
  if (isObj(raw.runes)) for (const id in V2_RUNE_COST) { const n = int(raw.runes[id], 0, 0, 50), [c0, c1] = V2_RUNE_COST[id]; for (let l = 0; l < n; l++) refund += Math.ceil(c0 * Math.pow(c1, l)); }
  s.gold += refund; s.flags.refund = refund > 0 ? 1 : 0;
  if (isObj(raw.codex)) cleanCodex(s, { m: raw.codex.m, b: raw.codex.b, l: raw.codex.l });
  if (isObj(raw.stats)) for (const k in s.stats) s.stats[k] = finite(raw.stats[k]);
  s.stats.bestGrade = V2_GRADE[int(raw.stats?.bestGrade, 0, 0, 9)];
  s.keepUp = raw.keepUp !== false;
  checkPets(s, null);
  fixUid(s);
  Skills.auto(s, cls);
  return s;
}

// ---------- progress ----------
const diffOpen = (s, d) => d === 0 || s.prog.best[d - 1] >= FULL;
const stageOpen = (s, d, a, st) => diffOpen(s, d) && stageIndex(a, st) <= Math.min(FULL - 1, s.prog.best[d]);
const stageCleared = (s, d, a, st) => stageIndex(a, st) < s.prog.best[d];
const topDiff = s => { let d = 0; while (d + 1 < DIFFS.length && diffOpen(s, d + 1)) d++; return d; };
// the highest monster level reached
function topLevel(s) {
  const d = topDiff(s), i = Math.min(FULL - 1, s.prog.best[d]);
  return stageLevel(d, Math.floor(i / STAGES) + 1, (i % STAGES) + 1);
}

// ---------- account: runes and pets ----------
function runeEff(s, k) {
  let v = 0;
  for (const id in s.runes) { const n = RUNE[id]; const e = n && RUNE_KINDS[n.kind].eff[k]; if (e) v += e * s.runes[id]; }
  return v;
}
const runeOpen = (s, n) => !n.p || (s.runes[n.p] || 0) > 0;
const runesUnlocked = s => Object.values(s.heroes).some(h => h.lv >= RUNE_UNLOCK_LEVEL);
const cubeUnlocked = s => Object.values(s.heroes).some(h => h.lv >= CUBE_UNLOCK_LEVEL);
const partySize = s => Math.min(PARTY_MAX, 1 + runeEff(s, 'party'));
const skillSlots = s => Math.min(2, ACTIVE_SLOTS_BASE + runeEff(s, 'skillSlot'));
const bagSize = s => BAG_BASE + runeEff(s, 'bag') + STASH_PAGE * runeEff(s, 'stash');
const chestCap = (s, k) => CHEST_CAP[k] + runeEff(s, ['capN', 'capB', 'capA'][k]);
const chestCount = (s, k) => s.tray.reduce((n, c) => n + (c.k === k ? 1 : 0), 0);
const partyList = s => s.party.slice(0, partySize(s)).filter(c => c && s.heroes[c]);
const heroUnlocked = (s, cls) => { const u = CLASSES[cls].unlock; return u === 'start' || !!s.heroes[cls] || s.prog.best[u[0]] >= stageIndex(u[1], u[2]) + 1; };
const maxHeroLv = s => Math.max(1, ...Object.values(s.heroes).map(h => h.lv));
const ACCT_KEYS = ['gold', 'exp', 'chestN', 'chestB', 'alchGold', 'cubeExp', 'bossGold', 'bossExp', 'offGold', 'offExp', 'chestGold', 'openSpeed', 'brevity', 'autoN', 'autoB', 'autoA', 'offline', 'atkPct', 'armPct', 'move', 'aspd'];
function acctStats(s) {
  const A = {};
  for (const k of ACCT_KEYS) A[k] = runeEff(s, k);
  for (const id in s.pets.own) if (PETS[id]) for (const k in PETS[id].eff) A[k] = (A[k] || 0) + PETS[id].eff[k];
  return A;
}

// ---------- item numbers ----------
function itemMain(it) {
  const T = TYPES[it.t], G = GRADES[it.g], out = {};
  const m = G.mul * it.q;
  for (const k in T.main) out[k] = T.main[k] * SC(it.l) * m;
  // percentage mains grow with item level and half of the grade bonus
  if (T.mainPct) for (const k in T.mainPct) out[k] = T.mainPct[k] * pctScale(it.l) * (1 + (G.mul - 1) / 2);
  return out;
}
const gemValue = id => MATS[id].value;
const inscribeValue = (k, g) => (AFFIXES[k] ? AFFIXES[k].r[1] : 0.05) * (0.5 + 0.18 * g);
// every stat an item gives besides its main stats
function itemExtras(it, put) {
  for (const [k, v] of it.s) put(k, v);
  for (const id of it.sd) if (id) put(MATS[id].stat, gemValue(id));
  for (const id of it.se) if (id) for (const k of MATS[id].stats) put(k, partValue(k, MATS[id].grade));
  for (const x of it.si) if (x) put(x[0], x[1]);
}

// ---------- derived stats of one hero ----------
// o.swap = { slot, item } evaluates an item before equipping it; o.aura = the party's blessings
function heroStats(s, cls, o = {}) {
  const h = s.heroes[cls], C = CLASSES[cls], A = o.acct || acctStats(s);
  const add = {};
  const put = (k, v) => { if (v) add[k] = (add[k] || 0) + v; };
  const eq = o.swap ? { ...h.eq, [o.swap.slot]: o.swap.item } : h.eq;
  const hs = Math.pow(SC(h.lv), 0.85);
  let atk = C.atk * 6 * hs, hp = C.hp * 1.25 * hs, arm = C.arm * 0.5 * hs;
  const lg = {};
  for (const slot of SLOTS) {
    const it = eq[slot];
    if (!it) continue;
    const T = TYPES[it.t], mm = itemMain(it);
    for (const k in mm) { if (k === 'atk') atk += mm.atk; else if (k === 'hp') hp += mm.hp; else if (k === 'arm') arm += mm.arm; else put(k, mm[k]); }
    if (T.imp) for (const k in T.imp) put(k, T.imp[k]);
    itemExtras(it, put);
    if (it.lg && (!LEGENDS[it.lg].cls || LEGENDS[it.lg].cls === cls)) lg[it.lg] = Math.max(lg[it.lg] || 0, it.g >= 5 ? 1.5 : 1);
  }
  for (const id in h.sk) { const k = PASSIVES[id]; if (k && h.sk[id]) put(k.stat, k.per * h.sk[id]); }
  for (const k of ['atkPct', 'armPct', 'move', 'aspd']) put(k, A[k]);
  if (o.aura) for (const k in o.aura) put(k, o.aura[k]);
  if (lg.gale) put('aspd', 0.15 * lg.gale);
  if (lg.midas) put('gold', 0.4 * lg.midas);
  if (lg.collector) { put('chestN', 0.3 * lg.collector); put('chestB', 0.3 * lg.collector); }
  if (lg.scholar) put('exp', 0.4 * lg.scholar);
  if (lg.kingshield) put('block', 0.15 * lg.kingshield);

  let elem = C.elem;
  if (cls === 'sorcerer') elem = eq.offhand && eq.offhand.t === 'orb' ? eq.offhand.el : 'fire';
  const el = {};
  for (const e of ELEMENTS) el[e] = 1 + (add[e] || 0) + (e === 'phys' ? 0 : add.elemPct || 0);
  const res = {};
  for (const e of RES_IDS) res[e] = Math.min(RES_CAP, (add[e + 'Res'] || 0) + (add.allRes || 0));
  const aspd = Math.min(ASPD_CAP, C.aspd * (1 + (add.aspd || 0)));
  return {
    cls, elem, el, res, reach: C.reach, melee: !!C.melee, shot: C.shot || null, shotSpeed: C.speed || 0,
    atk: atk * (1 + (add.atkPct || 0)), maxHp: hp * (1 + (add.hpPct || 0)), arm: arm * (1 + (add.armPct || 0)),
    aspdBase: C.aspd, aspdPct: add.aspd || 0, aspd,
    crit: Math.min(CRIT_CAP, C.crit + (add.crit || 0)), cdmg: C.cdmg + (add.cdmg || 0),
    ls: add.ls || 0, regen: add.regen || 0, hpKill: add.hpKill || 0, hpHit: add.hpHit || 0,
    block: Math.min(BLOCK_CAP, add.block || 0), dodge: Math.min(DODGE_CAP + (add.dodgeCap || 0), add.dodge || 0), dr: Math.min(0.5, add.dr || 0), absorb: add.absorb || 0,
    skill: 1 + (add.skill || 0), cdr: Math.min(CDR_CAP, add.cdr || 0), cast: 1 + (add.cast || 0), aoe: 1 + (add.aoe || 0), aoeDmg: 1 + (add.aoeDmg || 0),
    proj: 1 + (add.proj || 0), heal: 1 + (add.heal || 0), dur: 1 + (add.dur || 0), move: add.move || 0,
    gold: add.gold || 0, exp: add.exp || 0, chestN: add.chestN || 0, chestB: add.chestB || 0,
    bossTime: lg.verdict ? 8 * lg.verdict : 0, lg,
  };
}
// the party's blessings: 力量祝福 / 守护祝福 while a priest has them slotted
function partyAura(s, list = partyList(s)) {
  const aura = {};
  const n = skillSlots(s);
  for (const cls of list) for (const id of s.heroes[cls].act.slice(0, n)) {
    const k = ACTIVES[id], l = s.heroes[cls].sk[id] || 0;
    if (!k || k.type !== 'cont' || !l) continue;
    const key = id === 'p_might' ? 'atkPct' : 'allRes';
    aura[key] = Math.max(aura[key] || 0, lv(k.v, l));
  }
  return aura;
}
// what the whole party earns: account bonuses plus everyone's gear
function partyStats(s, team, A = acctStats(s)) {
  const P = { gold: 1 + A.gold, exp: 1 + A.exp, chestN: 1 + A.chestN, chestB: 1 + A.chestB, move: 0, bossTime: 0, lg: {} };
  for (const S of team) {
    P.gold += S.gold; P.exp += S.exp; P.chestN += S.chestN; P.chestB += S.chestB;
    P.bossTime = Math.max(P.bossTime, S.bossTime);
    for (const k in S.lg) P.lg[k] = Math.max(P.lg[k] || 0, S.lg[k]);
  }
  P.move = team.length ? Math.min(...team.map(S => S.move)) : 0;
  return P;
}

// damage left after a monster's defence / a hero's armor
const defMul = (atk, def) => 1 - def / (def + 3 * atk);
const armMul = (arm, raw) => 1 - Math.min(0.8, arm / (arm + 5 * raw));

// a single "战力" number for comparing loadouts: damage output blended with toughness
function powerOf(S, L = 1, d = 0) {
  const hit = S.atk * defMul(S.atk, CURVE.def(L)) * (1 + S.crit * (S.cdmg - 1)) * S.el[S.elem];
  const dps = hit * S.aspd * (S.shot ? S.proj : 1) * (1 + 0.25 * (S.aoeDmg - 1)) * (1 + 0.6 * S.skill / Math.max(0.4, 1 - S.cdr));
  const raw = CURVE.atk(L) * DIFFS[d].atk * 1.2;
  const resAvg = RES_IDS.reduce((a, e) => a + S.res[e], 0) / RES_IDS.length;
  const taken = raw * armMul(S.arm, raw) * (1 - S.dodge) * (1 - S.block * 0.5) * (1 - S.dr) * (1 - resAvg * 0.4);
  const ehp = S.maxHp * (raw / Math.max(1e-9, taken)) * (1 + S.ls * 4 + S.regen * 10 + S.hpHit * S.aspd * 3 + S.absorb * 5);
  return Math.pow(dps, 0.65) * Math.pow(ehp, 0.35);
}
const powerHero = (s, cls, S) => powerOf(S || heroStats(s, cls, { aura: partyAura(s) }), stageLevel(s.prog.d, s.prog.a, s.prog.s), s.prog.d);
const powerParty = s => partyList(s).reduce((a, cls) => a + powerHero(s, cls), 0);

// ---------- hero levels ----------
function gainExp(s, cls, x, ev) {
  const h = s.heroes[cls];
  if (!h || h.lv >= HERO_MAX_LEVEL) return 0;
  h.exp += x;
  let ups = 0;
  while (h.lv < HERO_MAX_LEVEL && h.exp >= expNeed(h.lv)) {
    h.exp -= expNeed(h.lv); h.lv++; ups++;
    if (ev) ev.emit('levelUp', cls, h.lv);
  }
  if (h.lv >= HERO_MAX_LEVEL) h.exp = 0;
  if (ups && s.opts.autoSkill) Skills.auto(s, cls);
  return ups;
}

// ---------- the skill tree: 1 point per level, tier t opens at 10·t points below it ----------
const Skills = (() => {
  const spent = h => Object.values(h.sk).reduce((a, b) => a + b, 0);
  const free = h => h.lv - spent(h);
  const below = (h, tier) => { let n = 0; for (const id in h.sk) if (SKILLS[id].tier < tier) n += h.sk[id]; return n; };
  const tierOpen = (h, tier) => below(h, tier) >= TIER_STEP * tier;
  // every tier with points still has enough points below it
  function valid(h) {
    if (spent(h) > h.lv) return false;
    for (const id in h.sk) if (h.sk[id] > 0 && !tierOpen(h, SKILLS[id].tier)) return false;
    return true;
  }
  function canRaise(s, cls, id) {
    const h = s.heroes[cls], k = SKILLS[id];
    return !!h && !!k && k.cls === cls && free(h) > 0 && (h.sk[id] || 0) < k.max && tierOpen(h, k.tier);
  }
  function raise(s, cls, id) { if (!canRaise(s, cls, id)) return false; const h = s.heroes[cls]; h.sk[id] = (h.sk[id] || 0) + 1; return true; }
  function canLower(s, cls, id) {
    const h = s.heroes[cls];
    if (!h || !h.sk[id]) return false;
    h.sk[id]--;
    const ok = valid(h);
    h.sk[id]++;
    return ok;
  }
  function lower(s, cls, id) {
    if (!canLower(s, cls, id)) return false;
    const h = s.heroes[cls];
    if (--h.sk[id] <= 0) { delete h.sk[id]; h.act = h.act.map(x => (x === id ? null : x)); }
    return true;
  }
  function reset(s, cls) { const h = s.heroes[cls]; h.sk = {}; h.act = [null, null]; }
  function slot(s, cls, id, i) {
    const h = s.heroes[cls];
    if (!h || !ACTIVES[id] || ACTIVES[id].cls !== cls || !h.sk[id]) return false;
    const n = skillSlots(s);
    if (i === undefined) { i = h.act.slice(0, n).indexOf(null); if (i < 0) i = n - 1; }
    if (i >= n) return false;
    h.act = h.act.map(x => (x === id ? null : x));
    h.act[i] = id;
    return true;
  }
  const unslot = (s, cls, i) => { s.heroes[cls].act[i] = null; };
  // the auto plan: learn the class's best actives as tiers open, slot them, then grow the slotted actives and the passives evenly
  function auto(s, cls) {
    const h = s.heroes[cls];
    if (!h) return;
    const tree = skillTree(cls), pref = AUTO_ACTIVE[cls], n = skillSlots(s);
    const rank = id => { const r = pref.indexOf(id); return r < 0 ? 99 : r; };
    const fill = () => {
      for (let i = 0; i < n; i++) {
        if (h.act[i] && h.sk[h.act[i]]) continue;
        h.act[i] = pref.find(id => h.sk[id] && !h.act.includes(id)) || null;
      }
    };
    fill();
    let guard = 600;
    while (free(h) > 0 && guard--) {
      const open = tree.filter(id => canRaise(s, cls, id));
      if (!open.length) break;
      const slotted = h.act.slice(0, n).filter(Boolean);
      const worst = slotted.length < n ? 98 : Math.max(...slotted.map(rank));
      const learn = open.filter(id => ACTIVES[id] && !h.sk[id] && rank(id) < worst).sort((a, b) => rank(a) - rank(b))[0];
      if (learn) {
        raise(s, cls, learn);
        if (slotted.length >= n) h.act[h.act.indexOf(slotted.find(id => rank(id) === worst))] = learn;
        fill();
        continue;
      }
      const grow = open.filter(id => PASSIVES[id] || h.act.slice(0, n).includes(id));
      const pool = grow.length ? grow : open;
      pool.sort((a, b) => (h.sk[a] || 0) / SKILLS[a].max - (h.sk[b] || 0) / SKILLS[b].max || SKILLS[a].tier - SKILLS[b].tier);
      raise(s, cls, pool[0]);
    }
    fill();
  }
  return { spent, free, below, tierOpen, valid, canRaise, raise, canLower, lower, reset, slot, unslot, auto };
})();
const skillLv = (s, cls, id) => (s.heroes[cls] && s.heroes[cls].sk[id]) || 0;

// ---------- the party ----------
const Party = (() => {
  const coolLeft = (s, now = Date.now()) => Math.max(0, s.deployT + DEPLOY_COOLDOWN * 1000 - now);
  // bring a hero into a formation slot (a new face waits out the deploy cooldown; reordering is free)
  function deploy(s, cls, i, now = Date.now()) {
    if (!heroUnlocked(s, cls) || i < 0 || i >= partySize(s)) return 'locked';
    const inParty = s.party.indexOf(cls);
    if (inParty >= 0) { [s.party[inParty], s.party[i]] = [s.party[i], s.party[inParty]]; return 'ok'; }
    if (coolLeft(s, now) > 0) return 'cool';
    if (!s.heroes[cls]) { s.heroes[cls] = newHero(s, cls); if (s.opts.autoSkill) Skills.auto(s, cls); }
    s.party[i] = cls;
    s.deployT = now;
    return 'ok';
  }
  function remove(s, i) {
    if (partyList(s).length <= 1 || !s.party[i]) return false;
    s.party[i] = null;
    // close the gap so the formation reads front to back
    s.party = s.party.filter(Boolean).concat([null, null, null]).slice(0, 3);
    return true;
  }
  function move(s, i, dir) {
    const j = i + dir, n = partySize(s);
    if (j < 0 || j >= n) return false;
    [s.party[i], s.party[j]] = [s.party[j], s.party[i]];
    s.party = s.party.filter(Boolean).concat([null, null, null]).slice(0, 3);
    return true;
  }
  return { coolLeft, deploy, remove, move };
})();
function checkUnlocks(s, ev) {
  for (const cls of CLASS_IDS) {
    if (CLASSES[cls].unlock === 'start' || s.flags['un_' + cls] || !heroUnlocked(s, cls)) continue;
    s.flags['un_' + cls] = 1;
    if (ev) ev.emit('heroUnlock', cls);
  }
}

// ---------- pets ----------
function petProgress(s, id) {
  const P = PETS[id];
  if (P.kill) return { n: P.kill.reduce((a, m) => a + (s.codex.m[m] || 0), 0), need: P.need };
  return { n: s.prog.best[P.clear[0]] >= P.clear[1] * STAGES ? 1 : 0, need: 1 };
}
function checkPets(s, ev) {
  for (const id of PET_IDS) {
    if (s.pets.own[id]) continue;
    const p = petProgress(s, id);
    if (p.n >= p.need) { s.pets.own[id] = 1; if (!s.pets.cur) s.pets.cur = id; if (ev) ev.emit('pet', id); }
  }
}

// ---------- achievements ----------
function checkAch(s, ev) {
  for (const a of ACHIEVEMENTS) if (!s.ach[a.id] && a.test(s)) { s.ach[a.id] = 1; Loot.grant(s, a.reward, ev); if (ev) ev.emit('ach', a); }
}
