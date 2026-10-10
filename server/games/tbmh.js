// 悬赏怪物猎人 cloud save cleaner (second edition): keeps only known fields, ids and ranges.
// The id tables mirror tbmh/js/data.js; build.mjs fails when they drift apart.
export const MAX = 163840; // a late-game bag with sockets is larger than the default save limit

export const TYPES = {
  sword: ['main', 'sword'], axe: ['main', 'axe'], bow: ['main', 'bow'], crossbow: ['main', 'crossbow'], staff: ['main', 'staff'], scepter: ['main', 'scepter'],
  shield: ['off', 'sword'], hatchet: ['off', 'axe'], quiver: ['off', 'bow'], bolts: ['off', 'crossbow'], orb: ['off', 'staff'], tome: ['off', 'scepter'],
  head: ['head', ''], chest: ['chest', ''], hands: ['hands', ''], feet: ['feet', ''], neck: ['neck', ''], ear: ['ear', ''], ring: ['ring', ''], wrist: ['wrist', ''],
  m_hunter: ['medal', ''], m_seeker: ['medal', ''], m_honor: ['medal', ''],
};
export const ELEM_ROLL = { orb: ['fire', 'ice', 'light'] };
export const SLOT_CAT = { main: 'weapon', off: 'weapon', head: 'armor', chest: 'armor', hands: 'armor', feet: 'armor', neck: 'acc', ear: 'acc', ring: 'acc', wrist: 'acc', medal: 'medal' };
export const LEGENDS = {
  chain: ['weapon', ''], pierce: ['weapon', ''], sunder: ['weapon', ''], ember: ['weapon', ''], verdict: ['weapon', ''],
  crown: ['armor', ''], undying: ['armor', ''], pact: ['armor', ''], bulwark: ['armor', ''], phoenix: ['armor', ''],
  sand: ['acc', ''], echo: ['acc', ''], gale: ['acc', ''], prism: ['acc', ''], focus: ['acc', ''],
  midas: ['medal', ''], seeker: ['medal', ''], bounty: ['medal', ''], collector: ['medal', ''], scholar: ['medal', ''],
  swordwave: ['weapon', 'sword'], kingshield: ['weapon', 'sword'], tempest: ['weapon', 'axe'], bloodaxe: ['weapon', 'axe'],
  splitarrow: ['weapon', 'bow'], falcon: ['weapon', 'bow'], sunpierce: ['weapon', 'crossbow'], thunderclap: ['weapon', 'crossbow'],
  elemchain: ['weapon', 'staff'], hydraking: ['weapon', 'staff'], sainthood: ['weapon', 'scepter'], judgement: ['weapon', 'scepter'],
};
export const AFFIXES = ['atkPct', 'aspd', 'crit', 'cdmg', 'hpPct', 'armPct', 'ls', 'regen', 'skill', 'cdr', 'boss', 'elite', 'thorns', 'block', 'gold', 'chest', 'exp', 'phys', 'fire', 'ice', 'light', 'poison', 'holy', 'move'];
export const INSCRIPTIONS = ['dmg', 'boss', 'cdmg', 'aspd', 'hpPct', 'gold', 'exp', 'skill'];
// per grade: [affixes, gem sockets, engrave sockets, inscription sockets]
export const GRADES = [[1, 0, 0, 0], [2, 1, 0, 0], [3, 1, 0, 0], [3, 1, 1, 0], [4, 2, 1, 0], [4, 2, 1, 1], [5, 2, 1, 1], [5, 3, 1, 1], [6, 3, 2, 1], [6, 3, 2, 1]];
export const GEMS = ['ruby', 'sapphire', 'topaz', 'emerald', 'amethyst'];
export const PARTS = ['p_slime', 'p_rabbit', 'p_insect', 'p_goblin', 'p_shroom', 'p_bat', 'p_plant', 'p_spider', 'p_fox', 'p_troll', 'p_scorpion', 'p_snake', 'p_mummy', 'p_rat', 'p_wolf', 'p_beast', 'p_frost', 'p_skeleton', 'p_penguin', 'p_ghost', 'p_undead', 'p_frog', 'p_golem', 'p_mole', 'p_crystal', 'p_demon', 'p_lizard', 'p_flame', 'p_worm', 'p_bird', 'p_sky', 'p_gargoyle', 'p_knight', 'p_eye', 'p_drake', 'p_cult'];
export const SKILLS = {
  cleave: 10, bash: 10, bladestorm: 10, execute: 10, guard: 5, riposte: 5, whirl: 10, throwaxe: 10, crush: 10, rage: 10, bloodlust: 5, cleaver: 5,
  multishot: 10, pierceshot: 10, arrowrain: 10, gale: 10, rapid: 5, hawkeye: 5, blastbolt: 10, snipe: 10, snare: 10, repeater: 10, weakspot: 5, armorpierce: 5,
  fireball: 10, chainlight: 10, frostnova: 10, hydra: 10, elemmastery: 5, surge: 5, smite: 10, prayer: 10, aegis: 10, holynova: 10, aura: 5, devotion: 5,
  warcry: 10, storm: 10, soul: 10,
};
export const PASSIVES = ['guard', 'riposte', 'bloodlust', 'cleaver', 'rapid', 'hawkeye', 'weakspot', 'armorpierce', 'elemmastery', 'surge', 'aura', 'devotion'];
// rune node: [max level, parent]
export const RUNES = {
  heart: [1, ''], aw1: [5, 'heart'], slot2: [1, 'aw1'], petres: [5, 'aw1'], skillmast: [10, 'aw1'], slot3: [1, 'slot2'], slot4: [1, 'slot3'],
  blade: [30, 'heart'], haste: [20, 'blade'], precise: [20, 'blade'], lethal: [20, 'precise'], rend: [20, 'haste'], berserk: [10, 'lethal'],
  body: [30, 'heart'], iron: [20, 'body'], leech: [20, 'body'], mend: [20, 'leech'], thorn: [20, 'iron'], unbroken: [10, 'mend'],
  bounty: [30, 'heart'], bossgold: [20, 'bounty'], alchemy: [20, 'bounty'], cubeexp: [20, 'alchemy'], wisdom: [30, 'bossgold'], goldtouch: [10, 'cubeexp'],
  seek: [20, 'heart'], tray: [10, 'seek'], autoN: [1, 'seek'], autoB: [1, 'autoN'], appraise: [20, 'tray'], hoard: [10, 'autoB'],
  pack: [10, 'heart'], sleep: [8, 'pack'], dream: [10, 'sleep'], autoalch: [1, 'sleep'], vault: [5, 'sleep'],
  elem: [20, 'heart'], r_phys: [20, 'elem'], r_fire: [20, 'r_phys'], r_ice: [20, 'r_fire'], r_light: [20, 'r_ice'], r_poison: [20, 'r_light'], r_holy: [20, 'r_poison'],
  hunt: [20, 'heart'], slayer: [20, 'hunt'], march: [5, 'slayer'], wanted: [10, 'march'], kingslayer: [10, 'wanted'],
};
export const PETS = ['slimepet', 'batpet', 'foxpet', 'beetlepet', 'snowpet', 'wisppet', 'crystalpet', 'lizardpet', 'cloudpet', 'eyepet', 'gobpet', 'dragonpet'];
export const MONSTERS = ['slime', 'bigslime', 'rabbit', 'wasp', 'gobthief', 'gobarcher', 'gobshaman', 'gobbrute', 'shroom', 'toxshroom', 'sporebat', 'sapling', 'forestspider', 'mossgob', 'fox', 'mosstroll',
  'scorpion', 'cobra', 'mummy', 'mummypriest', 'ratscout', 'ratbomber', 'scarab', 'cactus', 'wolf', 'frostslime', 'yeti', 'icewisp', 'iceskel', 'penguin', 'icebear',
  'ghost', 'zombie', 'wisp', 'ghoul', 'skelwar', 'skelarcher', 'frogman', 'vampbat', 'golem', 'cavebat', 'mole', 'minegob', 'gembeetle', 'crystalspider', 'crystalwisp',
  'imp', 'lavaslime', 'salamander', 'hellhound', 'firedemon', 'fireelem', 'lavaworm', 'harpy', 'hawk', 'cloudling', 'thunderbird', 'gargoyle', 'skyknight', 'windsprite',
  'demonling', 'darkknight', 'shade', 'eyebeast', 'bonedrake', 'abysshound', 'cultist', 'voidslime', 'goldgob', 'oregolem'];
export const BOSSES = ['slimeking', 'treant', 'scorpking', 'wolfking', 'witch', 'spider', 'magmagolem', 'griffin', 'archon'];
export const CONTRACTS = ['hunt', 'elite', 'champ', 'boss', 'open', 'alch', 'crit', 'stage'];
export const MUTATORS = ['frenzy', 'plated', 'quick', 'frail', 'hurry', 'giant'];
export const LIMITS = { diffs: 4, acts: 9, stages: 10, heroMax: 100, cubeMax: 100, enhMax: 50, ilvlMax: 100, chests: 3, ores: 10, inv: 400, tray: 200 };
const STATS = ['kills', 'elites', 'champs', 'bosses', 'gold', 'play', 'items', 'legends', 'deaths', 'crits', 'casts', 'opened', 'synth', 'alch', 'bestGrade', 'stages'];
const SLOTS = Object.keys(SLOT_CAT);

// every material id the game can write
export function matIds() {
  const out = [];
  for (const k of GEMS) for (let g = 0; g < 10; g++) out.push(`gem_${k}_${g}`);
  for (const p of PARTS) for (let g = 0; g < 10; g++) out.push(`${p}_${g}`);
  for (let g = 0; g < 10; g++) out.push(`scroll_${g}`);
  for (let t = 0; t < LIMITS.ores; t++) out.push(`ore_${t}`);
  out.push('chaos');
  for (let g = 0; g < 10; g++) out.push(`coin_${g}`);
  for (let d = 0; d < LIMITS.diffs; d++) out.push(`wanted_${d}`);
  return out;
}
const MATS = new Set(matIds());
const isGem = id => typeof id === 'string' && MATS.has(id) && id.startsWith('gem_');
const isPart = id => typeof id === 'string' && MATS.has(id) && id.startsWith('p_');

const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const num = (v, lo, hi, d = lo) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const int = (v, lo, hi, d = lo) => Math.floor(num(v, lo, hi, d));
const own = (o, k) => isObject(o) && Object.prototype.hasOwnProperty.call(o, k);
const BIG = 1e300;

function legendOk(lg, type) {
  if (!own(LEGENDS, lg)) return false;
  const [slot, fam] = TYPES[type], [cat, lfam] = LEGENDS[lg];
  return cat === SLOT_CAT[slot] && (!lfam || lfam === fam);
}
function item(v, slot) {
  if (!isObject(v) || !own(TYPES, v.t)) return null;
  if (slot && TYPES[v.t][0] !== slot) return null;
  const g = int(v.g, 0, 9), K = GRADES[g];
  const out = { u: int(v.u, 0, 1e9), t: v.t, g, l: int(v.l, 1, LIMITS.ilvlMax, 1), q: num(v.q, 0.9, 1.1, 1), s: [] };
  if (Array.isArray(v.s)) for (const a of v.s.slice(0, K[0])) if (Array.isArray(a) && AFFIXES.includes(a[0]) && !out.s.some(x => x[0] === a[0])) out.s.push([a[0], num(a[1], 0, 10, 0)]);
  if (g >= 4 && legendOk(v.lg, v.t)) out.lg = v.lg;
  if (own(ELEM_ROLL, v.t)) out.el = ELEM_ROLL[v.t].includes(v.el) ? v.el : ELEM_ROLL[v.t][0];
  const sock = (arr, n, ok) => Array.from({ length: n }, (_, i) => (Array.isArray(arr) && ok(arr[i]) ? arr[i] : null));
  out.sd = sock(v.sd, K[1], isGem);
  out.se = sock(v.se, K[2], isPart);
  out.si = sock(v.si, K[3], x => Array.isArray(x) && INSCRIPTIONS.includes(x[0]) && Number.isFinite(x[1])).map(x => (x ? [x[0], num(x[1], 0, 10, 0)] : null));
  if (v.k) out.k = 1;
  return out;
}

export function clean(v) {
  // only second-edition saves: a first-edition tab still open somewhere must not overwrite the new world
  if (!isObject(v) || v.v !== 2 || !isObject(v.prog)) return null;
  const now = Date.now(), FULL = LIMITS.acts * LIMITS.stages;
  const out = {
    v: 2, t: int(v.t, 0, now + 864e5, now), created: int(v.created, 0, now + 864e5, now), seed: int(v.seed, 0, 4294967295), uid: int(v.uid, 1, 1e9, 1),
    gold: num(v.gold, 0, BIG),
    hero: { lv: int(v.hero?.lv, 1, LIMITS.heroMax, 1), exp: num(v.hero?.exp, 0, BIG) },
  };
  out.skills = { lv: {}, slots: [] };
  if (isObject(v.skills?.lv)) for (const [id, max] of Object.entries(SKILLS)) if (own(v.skills.lv, id) && v.skills.lv[id] > 0) out.skills.lv[id] = int(v.skills.lv[id], 0, max);
  for (let i = 0; i < 4; i++) { const id = v.skills?.slots?.[i]; out.skills.slots.push(typeof id === 'string' && own(SKILLS, id) && !PASSIVES.includes(id) && !out.skills.slots.includes(id) ? id : null); }
  out.eq = {}; out.enh = {};
  for (const slot of SLOTS) { out.eq[slot] = own(v.eq, slot) ? item(v.eq[slot], slot) : null; out.enh[slot] = int(v.enh?.[slot], 0, LIMITS.enhMax); }
  out.inv = Array.isArray(v.inv) ? v.inv.slice(0, LIMITS.inv).map(x => item(x)).filter(Boolean) : [];
  out.mats = {};
  if (isObject(v.mats)) for (const id of MATS) if (own(v.mats, id) && v.mats[id] > 0) out.mats[id] = int(v.mats[id], 0, 1e9);
  out.tray = Array.isArray(v.tray) ? v.tray.slice(0, LIMITS.tray).filter(c => isObject(c) && Number.isInteger(c.k) && c.k >= 0 && c.k < LIMITS.chests)
    .map(c => ({ k: c.k, d: int(c.d, 0, LIMITS.diffs - 1), L: int(c.L, 1, LIMITS.ilvlMax, 1), a: int(c.a, 1, LIMITS.acts, 1) })) : [];
  out.cube = { lv: int(v.cube?.lv, 1, LIMITS.cubeMax, 1), exp: num(v.cube?.exp, 0, BIG), filter: Array.from({ length: 10 }, (_, i) => Array.isArray(v.cube?.filter) && v.cube.filter[i] === true) };
  out.runes = { heart: 1 };
  if (isObject(v.runes)) for (const [id, [max, parent]] of Object.entries(RUNES)) if (id !== 'heart' && own(v.runes, id) && v.runes[id] > 0) out.runes[id] = int(v.runes[id], 0, max);
  for (const [id, [, parent]] of Object.entries(RUNES)) if (out.runes[id] && parent && !out.runes[parent]) delete out.runes[id];
  out.pets = { own: {}, cur: null };
  if (isObject(v.pets?.own)) for (const id of PETS) if (v.pets.own[id]) out.pets.own[id] = 1;
  if (typeof v.pets?.cur === 'string' && out.pets.own[v.pets.cur]) out.pets.cur = v.pets.cur;
  const p = v.prog;
  out.prog = { d: int(p.d, 0, LIMITS.diffs - 1), a: int(p.a, 1, LIMITS.acts, 1), s: int(p.s, 1, LIMITS.stages, 1), w: 1, best: [], farm: p.farm === true, auto: p.auto === true, fails: int(p.fails, 0, 9), clears: int(p.clears, 0, 99) };
  for (let d = 0; d < LIMITS.diffs; d++) out.prog.best.push(d && out.prog.best[d - 1] < FULL ? 0 : int(p.best?.[d], 0, FULL));
  out.codex = { m: {}, c: {}, b: {}, l: {}, n: {} };
  const c = isObject(v.codex) ? v.codex : {};
  for (const id of MONSTERS) if (own(c.m, id)) out.codex.m[id] = int(c.m[id], 0, 1e12);
  for (let a = 1; a <= LIMITS.acts; a++) for (let i = 0; i < 3; i++) { const k = `${a}-${i}`; if (own(c.c, k)) out.codex.c[k] = int(c.c[k], 0, 1e9); }
  for (const id of BOSSES) if (Array.isArray(c.b?.[id])) out.codex.b[id] = Array.from({ length: LIMITS.diffs }, (_, d) => num(c.b[id][d], 0, 1e6));
  for (const id of Object.keys(LEGENDS)) if (own(c.l, id) && c.l[id]) out.codex.l[id] = 1;
  for (const id of Object.keys(TYPES)) if (own(c.n, id)) out.codex.n[id] = int(c.n[id], 0, 2 ** 21 - 1);
  out.stats = {};
  for (const k of STATS) out.stats[k] = num(v.stats?.[k], 0, BIG);
  out.ach = {};
  if (isObject(v.ach)) for (const k of Object.keys(v.ach).slice(0, 200)) if (/^[a-z0-9_]{1,24}$/.test(k) && v.ach[k]) out.ach[k] = 1;
  out.tickets = {};
  for (const k of ['mine', 'rush', 'trial']) out.tickets[k] = { n: int(v.tickets?.[k]?.n, 0, 10), t: int(v.tickets?.[k]?.t, 0, now + 864e5, now) };
  out.board = { t: int(v.board?.t, 0, now + 864e5), done: int(v.board?.done, 0, 1e9), list: [] };
  if (Array.isArray(v.board?.list)) for (const b of v.board.list.slice(0, 3)) {
    if (!isObject(b) || !CONTRACTS.includes(b.k)) continue;
    const rw = isObject(b.rw) ? b.rw : {}, r = {};
    if (rw.gold) r.gold = num(rw.gold, 0, BIG);
    if (Array.isArray(rw.chest)) r.chest = [int(rw.chest[0], 0, LIMITS.chests - 1), int(rw.chest[1], 1, 10, 1)];
    if (Array.isArray(rw.mat) && MATS.has(rw.mat[0])) r.mat = [rw.mat[0], int(rw.mat[1], 1, 100, 1)];
    if (rw.wanted) r.wanted = int(rw.wanted, 1, 10, 1);
    const row = { k: b.k, goal: int(b.goal, 1, 1e6, 1), p: int(b.p, 0, 1e6), rw: r, done: b.done === true, claimed: b.claimed === true };
    if (MONSTERS.includes(b.mob)) row.mob = b.mob;
    out.board.list.push(row);
  }
  out.trial = { best: int(v.trial?.best, 0, 1e6), sel: Array.isArray(v.trial?.sel) ? [...new Set(v.trial.sel.filter(m => MUTATORS.includes(m)))] : [] };
  out.keepUp = v.keepUp !== false;
  const o = isObject(v.opts) ? v.opts : {};
  out.opts = { music: num(o.music, 0, 1, 0.45), sfx: num(o.sfx, 0, 1, 0.7), shake: o.shake ? 1 : 0, nums: o.nums === 0 ? 0 : 1, autoEquip: o.autoEquip ? 1 : 0, fx: o.fx === 0 ? 0 : 1, autoSkill: o.autoSkill === 0 ? 0 : 1 };
  if (o.hero === 'm' || o.hero === 'f') out.opts.hero = o.hero;
  out.flags = {};
  if (isObject(v.flags)) for (const k of Object.keys(v.flags).slice(0, 60)) if (/^[a-z_0-9]{1,24}$/.test(k) && v.flags[k]) out.flags[k] = 1;
  return out;
}
