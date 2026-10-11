// 悬赏怪物猎人 cloud save cleaner (third edition): keeps only known fields, ids and ranges.
// The id tables mirror tbmh/js/data.js; build.mjs fails when they drift apart.
// Second-edition saves are migrated in the browser before they are uploaded again.
export const MAX = 180000; // a late-game bag with sockets and three geared heroes is larger than the default save limit

export const CLASSES = ['knight', 'ranger', 'sorcerer', 'priest', 'hunter', 'slayer'];
// type: [slot, class that can wear it]
export const TYPES = {
  sword: ['weapon', 'knight'], bow: ['weapon', 'ranger'], staff: ['weapon', 'sorcerer'], scepter: ['weapon', 'priest'], crossbow: ['weapon', 'hunter'], axe: ['weapon', 'slayer'],
  shield: ['offhand', 'knight'], arrow: ['offhand', 'ranger'], orb: ['offhand', 'sorcerer'], tome: ['offhand', 'priest'], bolt: ['offhand', 'hunter'], hatchet: ['offhand', 'slayer'],
  helm: ['helm', ''], armor: ['armor', ''], gloves: ['gloves', ''], boots: ['boots', ''], amulet: ['amulet', ''], earring: ['earring', ''], ring: ['ring', ''], bracer: ['bracer', ''],
};
export const ELEM_ROLL = { orb: ['fire', 'cold', 'lightning'] };
export const SLOT_CAT = { weapon: 'weapon', offhand: 'weapon', helm: 'armor', armor: 'armor', gloves: 'armor', boots: 'armor', amulet: 'acc', earring: 'acc', ring: 'acc', bracer: 'acc' };
export const LEGENDS = {
  chain: ['weapon', ''], pierce: ['weapon', ''], sunder: ['weapon', ''], ember: ['weapon', ''], verdict: ['weapon', ''],
  crown: ['armor', ''], undying: ['armor', ''], pact: ['armor', ''], bulwark: ['armor', ''], phoenix: ['armor', ''],
  sand: ['acc', ''], echo: ['acc', ''], gale: ['acc', ''], prism: ['acc', ''], focus: ['acc', ''], midas: ['acc', ''], seeker: ['acc', ''], bounty: ['acc', ''], collector: ['acc', ''], scholar: ['acc', ''],
  swordwave: ['weapon', 'knight'], kingshield: ['weapon', 'knight'], tempest: ['weapon', 'slayer'], bloodaxe: ['weapon', 'slayer'],
  splitarrow: ['weapon', 'ranger'], falcon: ['weapon', 'ranger'], sunpierce: ['weapon', 'hunter'], thunderclap: ['weapon', 'hunter'],
  elemchain: ['weapon', 'sorcerer'], hydraking: ['weapon', 'sorcerer'], sainthood: ['weapon', 'priest'], judgement: ['weapon', 'priest'],
};
export const AFFIXES = ['atkPct', 'aspd', 'crit', 'cdmg', 'hpPct', 'armPct', 'regen', 'ls', 'hpKill', 'hpHit', 'block', 'dodge', 'dr', 'allRes', 'fireRes', 'coldRes', 'lightningRes', 'chaosRes',
  'phys', 'fire', 'cold', 'lightning', 'chaos', 'proj', 'aoeDmg', 'aoe', 'skill', 'cdr', 'cast', 'move', 'gold', 'exp', 'chestN', 'chestB'];
export const INSCRIBE = ['atkPct', 'aspd', 'crit', 'cdmg', 'hpPct', 'skill', 'cdr', 'allRes', 'phys', 'fire', 'cold', 'lightning', 'chaos', 'aoeDmg', 'proj', 'gold', 'exp'];
// per grade: [affixes, decoration, engraving, inscription sockets]
export const GRADES = [[1, 0, 0, 0], [2, 1, 0, 0], [3, 1, 1, 0], [3, 2, 2, 0], [4, 2, 2, 1], [4, 3, 2, 1], [5, 3, 2, 2], [5, 3, 2, 2], [6, 3, 2, 2], [6, 3, 2, 2]];
const LEGEND_GRADE = 3;
// how many gems / engraving parts / ores each grade has
export const MAT_ROWS = { gem: [5, 4, 5, 4, 4, 4, 4, 2, 2, 2], part: [3, 4, 4, 4, 4, 4, 4, 2, 2, 2], ore: [4, 2, 2, 2, 2, 2, 2, 2, 2, 2] };
// skill: [class, max level, active 1 / passive 0]
export const SKILLS = {};
const ACTIVE_IDS = {
  knight: ['k_thrust', 'k_charge', 'k_retri', 'k_aegis', 'k_blade', 'k_will'], ranger: ['r_rapid', 'r_scatter', 'r_rain', 'r_swift', 'r_pierce', 'r_skewer'],
  sorcerer: ['s_fireball', 's_iceorb', 's_lightning', 's_hydra', 's_storm', 's_meteor'], priest: ['p_heal', 'p_might', 'p_wrath', 'p_sanct', 'p_ward', 'p_rez'],
  hunter: ['h_blast', 'h_frost', 'h_quick', 'h_trap', 'h_turret', 'h_shock'], slayer: ['y_jump', 'y_crush', 'y_cry', 'y_quake', 'y_spin', 'y_blood'],
};
const PASSIVE_MAX = [5, 8, 8, 5, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10];
for (const cls of CLASSES) {
  for (const id of ACTIVE_IDS[cls]) SKILLS[id] = [cls, 10, 1];
  PASSIVE_MAX.forEach((max, i) => { SKILLS[`${cls}_p${i}`] = [cls, max, 0]; });
}
// rune node: [max level, parent id or 0]
export const RUNES = {};
{
  const R = (id, max, p) => { RUNES[id] = [max, p]; };
  R(1, 1, 0); R(10, 3, 1); R(20, 3, 1);
  R(21, 1, 20); R(22, 3, 21); R(23, 5, 22); R(24, 1, 23); R(25, 3, 21); R(26, 3, 25); R(27, 1, 26);
  for (let i = 11; i <= 16; i++) R(i, 3, i === 11 ? 10 : i - 1);
  R(11001, 1, 11); R(110011, 3, 11001); R(110012, 3, 11001); R(11002, 1, 11); R(11003, 1, 11002); R(11004, 1, 11003);
  R(13001, 1, 13); R(13002, 1, 13); R(130021, 3, 13002); R(15001, 1, 15); R(150011, 3, 15001); R(15002, 3, 15); R(150021, 3, 15002);
  for (let i = 1801; i <= 1808; i++) R(i, 3, i === 1801 ? 16 : i - 1);
  for (const id of [180201, 180301, 180401, 180501, 180601, 180701]) R(id, 5, Math.floor(id / 100));
  for (let i = 1901; i <= 1908; i++) R(i, 3, i === 1901 ? 16 : i - 1);
  R(1902001, 1, 1902); R(19020011, 3, 1902001); R(190301, 5, 1903); R(190302, 5, 1903); R(190401, 3, 1904);
  R(190501, 5, 1905); R(1905011, 5, 190501); R(190502, 5, 1905); R(1905021, 5, 190502);
  R(16001, 1, 16); R(160011, 1, 16001);
  for (let i = 101; i <= 128; i++) R(i, i <= 102 ? 3 : 5, i === 101 ? 10 : i - 1);
  for (const [id, p, max] of [[1021, 102], [1031, 103], [1051, 105, 5], [1052, 1051], [1054, 1052, 5], [1053, 1051, 3], [1055, 1051], [1056, 1051],
    [1061, 106], [1071, 107], [1072, 107], [1091, 109], [1101, 110], [1102, 110], [1111, 111], [1121, 112],
    [1131, 113], [1132, 113], [1133, 113], [1141, 114], [1142, 114], [1161, 116], [11611, 1161],
    [1171, 117], [1172, 117], [1181, 118], [1182, 118], [1191, 119], [1201, 120], [1202, 120], [1203, 120],
    [1221, 122], [1222, 122], [1241, 124], [1251, 125], [1252, 125], [1261, 126], [1262, 126], [1281, 128], [1282, 128], [12821, 1282]]) R(id, max || 1, p);
  const goldMax = { 201: 1, 204: 1 };
  for (let i = 201; i <= 215; i++) R(i, goldMax[i] || 5, i === 201 ? 10 : i - 1);
  for (const [id, p, m] of [[2031, 203, 1], [2032, 2031, 5], [2071, 207, 1], [2091, 209, 5], [2111, 211, 5], [2131, 213, 3], [2132, 213, 5], [2151, 215, 2], [2152, 2151, 5]]) R(id, m, p);
  const expMax = { 301: 1, 304: 1, 305: 3 };
  for (let i = 301; i <= 315; i++) R(i, expMax[i] || 5, i === 301 ? 20 : i - 1);
  for (const [id, p, m] of [[3031, 302, 1], [3032, 3031, 5], [3061, 306, 5], [3091, 309, 1], [3121, 312, 5], [3122, 3121, 5], [3151, 315, 5], [3152, 315, 5]]) R(id, m, p);
  const cmb = [[401, 3], [402, 3], [403, 10], [404, 5], [405, 10], [406, 5], [407, 5], [408, 5], [409, 5], [410, 5], [411, 5], [412, 5], [413, 5], [414, 5]];
  cmb.forEach(([id, m], i) => R(id, m, i ? id - 1 : 20));
  for (const [id, p, m] of [[4031, 403, 1], [4061, 406, 3], [4081, 408, 5], [4082, 4081, 1], [4101, 410, 5]]) R(id, m, p);
}
export const PETS = ['bat', 'watcher', 'burnskull', 'bluegolem', 'darkspirit', 'sword', 'butterfly', 'dragon'];
export const MONSTERS = ['slime', 'bigslime', 'rabbit', 'wasp', 'gobthief', 'gobarcher', 'gobshaman', 'gobbrute', 'shroom', 'toxshroom', 'sporebat', 'sapling', 'forestspider', 'mossgob', 'fox', 'mosstroll',
  'scorpion', 'cobra', 'mummy', 'mummypriest', 'ratscout', 'ratbomber', 'scarab', 'cactus', 'wolf', 'frostslime', 'yeti', 'icewisp', 'iceskel', 'penguin', 'icebear',
  'ghost', 'zombie', 'wisp', 'ghoul', 'skelwar', 'skelarcher', 'frogman', 'vampbat', 'golem', 'cavebat', 'mole', 'minegob', 'gembeetle', 'crystalspider', 'crystalwisp',
  'imp', 'lavaslime', 'salamander', 'hellhound', 'firedemon', 'fireelem', 'lavaworm', 'harpy', 'hawk', 'cloudling', 'thunderbird', 'gargoyle', 'skyknight', 'windsprite',
  'demonling', 'darkknight', 'shade', 'eyebeast', 'bonedrake', 'abysshound', 'cultist', 'voidslime'];
export const BOSSES = ['slimeking', 'treant', 'witch', 'scorpking', 'spider', 'griffin', 'wolfking', 'magmagolem', 'archon'];
// stages whose last wave is an aura champion (codex keys "act-stage")
export const CHAMPS = ['1-1', '1-2', '1-4', '1-5', '1-7', '1-8', '1-9', '2-1', '2-2', '2-4', '2-5', '2-7', '2-8', '2-9', '3-1', '3-2', '3-4', '3-5', '3-7', '3-8', '3-9'];
export const LIMITS = { diffs: 4, acts: 3, stages: 10, heroMax: 100, cubeMax: 100, ilvlMax: 100, chests: 3, party: 3, inv: 2000, tray: 120 };
const STATS = ['kills', 'elites', 'champs', 'bosses', 'gold', 'play', 'items', 'legends', 'deaths', 'crits', 'casts', 'opened', 'synth', 'alch', 'bestGrade', 'stages', 'lost'];
const SLOTS = Object.keys(SLOT_CAT);

// every material id the game can write
export function matIds() {
  const out = [];
  MAT_ROWS.gem.forEach((n, g) => { for (let i = 0; i < n; i++) out.push(`gem${g}_${i}`); });
  MAT_ROWS.part.forEach((n, g) => { for (let i = 0; i < n; i++) out.push(`part${g}_${i}`); });
  for (let g = 0; g < 10; g++) out.push(`scroll${g}`);
  MAT_ROWS.ore.forEach((n, g) => { for (let i = 0; i < n; i++) out.push(`ore${g}_${i}`); });
  for (let g = 0; g < 10; g++) out.push(`coin${g}`);
  for (let d = 0; d < LIMITS.diffs; d++) out.push(`stone${d}`);
  return out;
}
const MATS = new Set(matIds());
const isGem = id => typeof id === 'string' && MATS.has(id) && id.startsWith('gem');
const isPart = id => typeof id === 'string' && MATS.has(id) && id.startsWith('part');

const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const num = (v, lo, hi, d = lo) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const int = (v, lo, hi, d = lo) => Math.floor(num(v, lo, hi, d));
const own = (o, k) => isObject(o) && Object.prototype.hasOwnProperty.call(o, k);
const BIG = 1e300;

function legendOk(lg, type) {
  if (!own(LEGENDS, lg)) return false;
  const [slot, cls] = TYPES[type], [cat, lcls] = LEGENDS[lg];
  return cat === SLOT_CAT[slot] && (!lcls || lcls === cls);
}
function item(v, slot) {
  if (!isObject(v) || !own(TYPES, v.t)) return null;
  if (slot && TYPES[v.t][0] !== slot) return null;
  const g = int(v.g, 0, 9), K = GRADES[g];
  const out = { u: int(v.u, 0, 1e9), t: v.t, g, l: int(v.l, 1, LIMITS.ilvlMax, 1), q: num(v.q, 0.9, 1.1, 1), s: [] };
  if (Array.isArray(v.s)) for (const a of v.s.slice(0, K[0])) if (Array.isArray(a) && AFFIXES.includes(a[0]) && !out.s.some(x => x[0] === a[0])) out.s.push([a[0], num(a[1], 0, 10, 0)]);
  if (g >= LEGEND_GRADE && legendOk(v.lg, v.t)) out.lg = v.lg;
  if (own(ELEM_ROLL, v.t)) out.el = ELEM_ROLL[v.t].includes(v.el) ? v.el : ELEM_ROLL[v.t][0];
  const sock = (arr, n, ok) => Array.from({ length: n }, (_, i) => (Array.isArray(arr) && ok(arr[i]) ? arr[i] : null));
  out.sd = sock(v.sd, K[1], isGem);
  out.se = sock(v.se, K[2], isPart);
  out.si = sock(v.si, K[3], x => Array.isArray(x) && INSCRIBE.includes(x[0]) && Number.isFinite(x[1])).map(x => (x ? [x[0], num(x[1], 0, 10, 0)] : null));
  if (v.k) out.k = 1;
  return out;
}
function hero(v, cls) {
  const out = { lv: int(v.lv, 1, LIMITS.heroMax, 1), exp: num(v.exp, 0, BIG), eq: {}, sk: {}, act: [null, null] };
  for (const slot of SLOTS) {
    const it = own(v.eq, slot) ? item(v.eq[slot], slot) : null;
    out.eq[slot] = it && (!TYPES[it.t][1] || TYPES[it.t][1] === cls) ? it : null;
  }
  if (isObject(v.sk)) for (const [id, [c, max]] of Object.entries(SKILLS)) if (c === cls && own(v.sk, id) && v.sk[id] > 0) out.sk[id] = int(v.sk[id], 0, max);
  if (Array.isArray(v.act)) out.act = [0, 1].map(i => { const id = v.act[i]; return typeof id === 'string' && own(SKILLS, id) && SKILLS[id][0] === cls && SKILLS[id][2] && out.sk[id] ? id : null; });
  if (out.act[0] && out.act[0] === out.act[1]) out.act[1] = null;
  return out;
}

export function clean(v) {
  // only third-edition saves: an older tab still open somewhere must not overwrite the new world
  if (!isObject(v) || v.v !== 3 || !isObject(v.prog) || !isObject(v.heroes)) return null;
  const now = Date.now(), FULL = LIMITS.acts * LIMITS.stages;
  const out = {
    v: 3, t: int(v.t, 0, now + 864e5, now), created: int(v.created, 0, now + 864e5, now), seed: int(v.seed, 0, 4294967295), uid: int(v.uid, 1, 1e9, 1),
    gold: num(v.gold, 0, BIG), heroes: {},
  };
  for (const cls of CLASSES) if (isObject(v.heroes[cls])) out.heroes[cls] = hero(v.heroes[cls], cls);
  if (!Object.keys(out.heroes).length) return null;
  out.party = [0, 1, 2].map(i => { const c = Array.isArray(v.party) ? v.party[i] : null; return typeof c === 'string' && own(out.heroes, c) ? c : null; });
  out.party = out.party.map((c, i) => (c && out.party.indexOf(c) === i ? c : null));
  out.deployT = int(v.deployT, 0, now + 864e5);
  out.inv = Array.isArray(v.inv) ? v.inv.slice(0, LIMITS.inv).map(x => item(x)).filter(Boolean) : [];
  out.mats = {};
  if (isObject(v.mats)) for (const id of MATS) if (own(v.mats, id) && v.mats[id] > 0) out.mats[id] = int(v.mats[id], 0, 1e9);
  out.tray = Array.isArray(v.tray) ? v.tray.slice(0, LIMITS.tray).filter(c => isObject(c) && Number.isInteger(c.k) && c.k >= 0 && c.k < LIMITS.chests)
    .map(c => ({ k: c.k, d: int(c.d, 0, LIMITS.diffs - 1), L: int(c.L, 1, LIMITS.ilvlMax, 1), a: int(c.a, 1, LIMITS.acts, 1) })) : [];
  out.cube = { lv: int(v.cube?.lv, 1, LIMITS.cubeMax, 1), exp: num(v.cube?.exp, 0, BIG), filter: Array.from({ length: 10 }, (_, i) => Array.isArray(v.cube?.filter) && v.cube.filter[i] === true) };
  out.runes = {};
  if (isObject(v.runes)) for (const [id, [max]] of Object.entries(RUNES)) if (own(v.runes, id) && v.runes[id] > 0) out.runes[id] = int(v.runes[id], 0, max);
  // children without their parent fall off, deepest last
  for (let pass = 0; pass < 40; pass++) {
    let changed = false;
    for (const id of Object.keys(out.runes)) { const p = RUNES[id][1]; if (p && !out.runes[p]) { delete out.runes[id]; changed = true; } }
    if (!changed) break;
  }
  out.pets = { own: {}, cur: null };
  if (isObject(v.pets?.own)) for (const id of PETS) if (v.pets.own[id]) out.pets.own[id] = 1;
  if (typeof v.pets?.cur === 'string' && out.pets.own[v.pets.cur]) out.pets.cur = v.pets.cur;
  const p = v.prog;
  out.prog = { d: int(p.d, 0, LIMITS.diffs - 1), a: int(p.a, 1, LIMITS.acts, 1), s: int(p.s, 1, LIMITS.stages, 1), w: 1, best: [], farm: p.farm === true, auto: p.auto === true, fails: int(p.fails, 0, 9), clears: int(p.clears, 0, 99) };
  for (let d = 0; d < LIMITS.diffs; d++) out.prog.best.push(d && out.prog.best[d - 1] < FULL ? 0 : int(p.best?.[d], 0, FULL));
  out.codex = { m: {}, c: {}, b: {}, l: {}, n: {} };
  const c = isObject(v.codex) ? v.codex : {};
  for (const id of MONSTERS) if (own(c.m, id)) out.codex.m[id] = int(c.m[id], 0, 1e12);
  for (const k of CHAMPS) if (own(c.c, k)) out.codex.c[k] = int(c.c[k], 0, 1e9);
  for (const id of BOSSES) if (Array.isArray(c.b?.[id])) out.codex.b[id] = Array.from({ length: LIMITS.diffs }, (_, d) => num(c.b[id][d], -1, 1e6, 0));
  for (const id of Object.keys(LEGENDS)) if (own(c.l, id) && c.l[id]) out.codex.l[id] = 1;
  for (const id of Object.keys(TYPES)) if (own(c.n, id)) out.codex.n[id] = int(c.n[id], 0, 2 ** 20 - 1);
  out.stats = {};
  for (const k of STATS) out.stats[k] = num(v.stats?.[k], 0, BIG);
  out.ach = {};
  if (isObject(v.ach)) for (const k of Object.keys(v.ach).slice(0, 200)) if (/^[a-z0-9_]{1,24}$/.test(k) && v.ach[k]) out.ach[k] = 1;
  out.keepUp = v.keepUp !== false;
  const o = isObject(v.opts) ? v.opts : {};
  out.opts = { music: num(o.music, 0, 1, 0.45), sfx: num(o.sfx, 0, 1, 0.7), shake: o.shake ? 1 : 0, nums: o.nums === 0 ? 0 : 1, autoEquip: o.autoEquip ? 1 : 0, fx: o.fx === 0 ? 0 : 1, autoSkill: o.autoSkill === 0 ? 0 : 1 };
  out.flags = {};
  if (isObject(v.flags)) for (const k of Object.keys(v.flags).slice(0, 60)) if (/^[a-z_0-9]{1,24}$/.test(k) && v.flags[k]) out.flags[k] = 1;
  return out;
}
