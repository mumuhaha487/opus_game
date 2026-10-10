'use strict';
// =====================================================================
//  STATE — save shape, migration, derived hunter stats
// =====================================================================
const SAVE_VERSION = 2;

function newItem(s, t, g, l, extra = {}) {
  const k = GRADES[g].sockets;
  return { u: s.uid++, t, g, l, q: 1, s: [], sd: Array(k[0]).fill(null), se: Array(k[1]).fill(null), si: Array(k[2]).fill(null), ...extra };
}

function newSave(now = Date.now()) {
  const tk = () => ({ n: 3, t: now });
  const s = {
    v: SAVE_VERSION, t: now, created: now, seed: (Math.random() * 2 ** 31) >>> 0, uid: 1,
    gold: 0,
    hero: { lv: 1, exp: 0 },
    skills: { lv: { cleave: 1 }, slots: ['cleave', null, null, null] },
    eq: Object.fromEntries(SLOTS.map(k => [k, null])),
    enh: Object.fromEntries(SLOTS.map(k => [k, 0])),
    inv: [], mats: {}, tray: [],
    cube: { lv: 1, exp: 0, filter: GRADES.map((g, i) => i < 2) },
    runes: { heart: 1 },
    pets: { own: {}, cur: null },
    prog: { d: 0, a: 1, s: 1, w: 1, best: [0, 0, 0, 0], farm: false, auto: false, fails: 0, clears: 0 },
    codex: { m: {}, c: {}, b: {}, l: {}, n: {} },
    stats: { kills: 0, elites: 0, champs: 0, bosses: 0, gold: 0, play: 0, items: 0, legends: 0, deaths: 0, crits: 0, casts: 0, opened: 0, synth: 0, alch: 0, bestGrade: 0, stages: 0 },
    ach: {},
    tickets: { mine: tk(), rush: tk(), trial: tk() },
    board: { t: 0, list: [], done: 0 },
    trial: { best: 0, sel: [] },
    keepUp: true,
    opts: { music: 0.45, sfx: 0.7, shake: 1, nums: 1, autoEquip: 0, fx: 1, autoSkill: 1 },
    flags: {},
    rates: null,
  };
  // the guild sends every hunter out with a short sword
  s.eq.main = newItem(s, 'sword', 0, 1, { s: [['atkPct', 0.05]] });
  return s;
}

// ---------- normalize anything loaded (local storage, cloud, imported code) ----------
const finite = (v, d = 0, lo = 0, hi = 1e300) => typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : d;
const int = (v, d = 0, lo = 0, hi = 1e9) => Math.floor(finite(v, d, lo, hi));
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);

function cleanItem(it, slot) {
  if (!isObj(it) || !TYPES[it.t]) return null;
  const T = TYPES[it.t];
  if (slot && T.slot !== slot) return null;
  const g = int(it.g, 0, 0, GRADE_MAX), K = GRADES[g].sockets;
  const out = { u: int(it.u, 0, 0, 1e9), t: it.t, g, l: int(it.l, 1, 1, 100), q: finite(it.q, 1, 0.9, 1.1), s: [] };
  if (Array.isArray(it.s)) for (const a of it.s.slice(0, GRADES[g].affixes)) if (Array.isArray(a) && AFFIXES[a[0]] && !out.s.some(x => x[0] === a[0])) out.s.push([a[0], finite(a[1], 0, 0, 10)]);
  if (it.lg && LEGENDS[it.lg] && g >= 4 && legendsFor(it.t).includes(it.lg)) out.lg = it.lg;
  if (T.elemRoll) out.el = T.elemRoll.includes(it.el) ? it.el : T.elemRoll[0];
  const sock = (arr, n, ok) => Array.from({ length: n }, (_, i) => (Array.isArray(arr) && ok(arr[i]) ? arr[i] : null));
  out.sd = sock(it.sd, K[0], v => typeof v === 'string' && MATS[v]?.kind === 'gem');
  out.se = sock(it.se, K[1], v => typeof v === 'string' && MATS[v]?.kind === 'part');
  out.si = sock(it.si, K[2], v => Array.isArray(v) && INSCRIPTIONS[v[0]] && Number.isFinite(v[1])).map(v => (v ? [v[0], finite(v[1], 0, 0, 10)] : null));
  if (it.k) out.k = 1;
  return out;
}

function normalizeSave(raw, now = Date.now()) {
  const s = newSave(now);
  if (!isObj(raw)) return s;
  // opts and the hunter's look survive every version
  if (isObj(raw.opts)) {
    const o = raw.opts;
    s.opts.music = finite(o.music, s.opts.music, 0, 1); s.opts.sfx = finite(o.sfx, s.opts.sfx, 0, 1);
    for (const k of ['shake', 'nums', 'autoEquip', 'fx', 'autoSkill']) if (o[k] !== undefined) s.opts[k] = o[k] ? 1 : 0;
    if (o.hero === 'm' || o.hero === 'f') s.opts.hero = o.hero;
  }
  if (isObj(raw.flags)) for (const k of Object.keys(raw.flags).slice(0, 60)) if (/^[a-z_0-9]{1,24}$/.test(k) && raw.flags[k]) s.flags[k] = 1;
  if (raw.v !== SAVE_VERSION) {
    // a first-edition hunter keeps the look and play time; the new world starts from 1-1
    if (raw.v === 1) { s.flags.v1 = 1; s.stats.play = finite(raw.stats?.play); }
    return s;
  }
  s.t = int(raw.t, now, 0, 1e15); s.created = int(raw.created, s.t, 0, 1e15);
  s.seed = int(raw.seed, s.seed, 0, 2 ** 32); s.uid = int(raw.uid, 1, 1, 1e9);
  s.gold = finite(raw.gold);
  if (isObj(raw.hero)) { s.hero.lv = int(raw.hero.lv, 1, 1, HERO.maxLevel); s.hero.exp = finite(raw.hero.exp, 0, 0, 1e300); }
  if (isObj(raw.skills)) {
    s.skills.lv = {};
    if (isObj(raw.skills.lv)) for (const id of SKILL_IDS) if (raw.skills.lv[id]) s.skills.lv[id] = int(raw.skills.lv[id], 0, 0, SKILLS[id].max);
    if (Array.isArray(raw.skills.slots)) s.skills.slots = [0, 1, 2, 3].map(i => (SKILLS[raw.skills.slots[i]] && !SKILLS[raw.skills.slots[i]].passive ? raw.skills.slots[i] : null));
    s.skills.slots = s.skills.slots.map((id, i) => (id && s.skills.slots.indexOf(id) === i ? id : null));
  }
  if (isObj(raw.eq)) for (const slot of SLOTS) s.eq[slot] = cleanItem(raw.eq[slot], slot);
  if (isObj(raw.enh)) for (const slot of SLOTS) s.enh[slot] = int(raw.enh[slot], 0, 0, ENH_MAX);
  s.inv = Array.isArray(raw.inv) ? raw.inv.slice(0, 400).map(it => cleanItem(it)).filter(Boolean) : [];
  if (isObj(raw.mats)) for (const id of MAT_IDS) if (raw.mats[id] > 0) s.mats[id] = int(raw.mats[id], 0, 0, 1e9);
  if (Array.isArray(raw.tray)) s.tray = raw.tray.slice(0, 200).filter(c => isObj(c) && CHESTS[c.k]).map(c => ({ k: int(c.k, 0, 0, 2), d: int(c.d, 0, 0, DIFFS.length - 1), L: int(c.L, 1, 1, 100), a: int(c.a, 1, 1, ACT_COUNT) }));
  if (isObj(raw.cube)) {
    s.cube.lv = int(raw.cube.lv, 1, 1, CUBE_MAX); s.cube.exp = finite(raw.cube.exp);
    if (Array.isArray(raw.cube.filter)) s.cube.filter = GRADES.map((g, i) => raw.cube.filter[i] === true);
  }
  if (isObj(raw.runes)) for (const n of RUNE_NODES) if (raw.runes[n.id]) s.runes[n.id] = int(raw.runes[n.id], 0, 0, n.max);
  s.runes.heart = 1;
  for (const n of RUNE_NODES) if (s.runes[n.id] && n.p && !s.runes[n.p]) delete s.runes[n.id];
  if (isObj(raw.pets)) {
    if (isObj(raw.pets.own)) for (const id of PET_IDS) if (raw.pets.own[id]) s.pets.own[id] = 1;
    s.pets.cur = s.pets.own[raw.pets.cur] ? raw.pets.cur : null;
  }
  if (isObj(raw.prog)) {
    const p = raw.prog;
    s.prog.best = DIFFS.map((D, d) => int(p.best?.[d], 0, 0, ACT_COUNT * STAGES));
    for (let d = 1; d < DIFFS.length; d++) if (s.prog.best[d - 1] < ACT_COUNT * STAGES) s.prog.best[d] = 0;
    s.prog.d = int(p.d, 0, 0, DIFFS.length - 1); s.prog.a = int(p.a, 1, 1, ACT_COUNT); s.prog.s = int(p.s, 1, 1, STAGES);
    if (!stageOpen(s, s.prog.d, s.prog.a, s.prog.s)) { s.prog.d = 0; s.prog.a = 1; s.prog.s = 1; }
    s.prog.w = 1;
    s.prog.farm = !!p.farm; s.prog.auto = !!p.auto; s.prog.fails = int(p.fails, 0, 0, 9); s.prog.clears = int(p.clears, 0, 0, 99);
  }
  if (isObj(raw.codex)) {
    const c = raw.codex;
    for (const id in MONSTERS) if (c.m?.[id]) s.codex.m[id] = int(c.m[id], 0, 0, 1e12);
    for (const k in c.c || {}) if (/^\d-\d$/.test(k)) s.codex.c[k] = int(c.c[k], 0, 0, 1e9);
    for (const id of BOSS_IDS) if (Array.isArray(c.b?.[id])) s.codex.b[id] = DIFFS.map((D, d) => finite(c.b[id][d], 0, 0, 1e6));
    for (const id of LEGEND_IDS) if (c.l?.[id]) s.codex.l[id] = 1;
    for (const id of TYPE_IDS) if (c.n?.[id]) s.codex.n[id] = int(c.n[id], 0, 0, 2 ** 21 - 1);
  }
  if (isObj(raw.stats)) for (const k in s.stats) s.stats[k] = finite(raw.stats[k]);
  if (isObj(raw.ach)) for (const a of ACHIEVEMENTS) if (raw.ach[a.id]) s.ach[a.id] = 1;
  for (const k of ['mine', 'rush', 'trial']) {
    const t = raw.tickets?.[k];
    if (t) s.tickets[k] = { n: int(t.n, 0, 0, 10), t: int(t.t, now, 0, 1e15) };
  }
  if (isObj(raw.board)) {
    s.board.t = int(raw.board.t, 0, 0, 1e15); s.board.done = int(raw.board.done, 0, 0, 1e9);
    s.board.list = Array.isArray(raw.board.list) ? raw.board.list.filter(c => isObj(c) && CONTRACTS[c.k]).slice(0, 3).map(c => ({
      k: c.k, goal: int(c.goal, 1, 1, 1e6), p: int(c.p, 0, 0, 1e6), mob: MONSTERS[c.mob] ? c.mob : undefined,
      rw: cleanReward(c.rw), done: !!c.done, claimed: !!c.claimed,
    })) : [];
  }
  if (isObj(raw.trial)) {
    s.trial.best = int(raw.trial.best, 0, 0, 1e6);
    s.trial.sel = Array.isArray(raw.trial.sel) ? [...new Set(raw.trial.sel.filter(m => MUTATORS[m]))] : [];
  }
  s.keepUp = raw.keepUp !== false;
  const maxU = Math.max(0, ...s.inv.map(i => i.u), ...SLOTS.map(k => s.eq[k]?.u || 0));
  s.uid = Math.max(s.uid, maxU + 1);
  return s;
}
// contract rewards: { gold, chest: [kind, count], mat: [id, count], wanted: count }
function cleanReward(rw) {
  const out = {};
  if (!isObj(rw)) return { gold: 100 };
  if (rw.gold) out.gold = finite(rw.gold);
  if (Array.isArray(rw.chest) && CHESTS[rw.chest[0]]) out.chest = [int(rw.chest[0], 0, 0, 2), int(rw.chest[1], 1, 1, 10)];
  if (Array.isArray(rw.mat) && MATS[rw.mat[0]]) out.mat = [rw.mat[0], int(rw.mat[1], 1, 1, 100)];
  if (rw.wanted) out.wanted = int(rw.wanted, 1, 1, 10);
  return out;
}

// ---------- progress ----------
const FULL = ACT_COUNT * STAGES;
const diffOpen = (s, d) => d === 0 || s.prog.best[d - 1] >= FULL;
const stageOpen = (s, d, a, st) => diffOpen(s, d) && stageIndex(a, st) <= Math.min(FULL - 1, s.prog.best[d]);
const stageCleared = (s, d, a, st) => stageIndex(a, st) < s.prog.best[d];
const topDiff = s => { let d = 0; while (d + 1 < DIFFS.length && diffOpen(s, d + 1)) d++; return d; };
// the highest monster level this hunter has reached
function topLevel(s) {
  const d = topDiff(s), i = Math.min(FULL - 1, s.prog.best[d]);
  return stageLevel(d, Math.floor(i / STAGES) + 1, (i % STAGES) + 1);
}
const modeOpen = (s, k) => { const [d, a, st] = MODES[k].unlock; return s.prog.best[d] >= stageIndex(a, st) + 1; };
const ticketCap = (s, k) => MODES[k].tickets;

// ---------- runes, skills, sizes ----------
function runeEff(s, k) {
  let v = 0;
  for (const id in s.runes) { const n = RUNE[id]; if (n && n.eff[k]) v += n.eff[k] * s.runes[id]; }
  return v;
}
const runeOpen = (s, n) => !n.p || (s.runes[n.p] || 0) > 0;
const skillSlots = s => SKILL_SLOT_BASE + runeEff(s, 'skillSlot');
const bagSize = s => BAG_BASE + runeEff(s, 'bag');
const traySize = s => TRAY_BASE + runeEff(s, 'tray');
const famOf = s => (s.eq.main ? TYPES[s.eq.main.t].fam : 'sword');
const skillPoints = s => s.hero.lv;
const skillSpent = s => Object.values(s.skills.lv).reduce((a, b) => a + b, 0);
const skillFree = s => skillPoints(s) - skillSpent(s);
const skillUsable = (s, id) => { const k = SKILLS[id]; return (k.fam === 'any' || k.fam === famOf(s)) && s.hero.lv >= k.req && (s.skills.lv[id] || 0) > 0; };
const skillLevel = (s, id) => s.skills.lv[id] || 0;

// ---------- item numbers ----------
function itemMain(it, enh = 0, res = false) {
  const T = TYPES[it.t], G = GRADES[it.g], e = 1 + ENH_BONUS * enh;
  const m = G.mul * it.q * e * (res ? 1.25 : 1), out = {};
  for (const k in T.main) out[k] = T.main[k] * SC(it.l) * m;
  // percentage mains grow with item level and half of the grade bonus; enhancement adds flat stats only
  if (T.mainPct) for (const k in T.mainPct) out[k] = T.mainPct[k] * pctScale(it.l) * (1 + (G.mul - 1) / 2) * (res ? 1.25 : 1);
  return out;
}
// every stat an item gives besides its main stats
function itemExtras(it, put) {
  for (const [k, v] of it.s) put(k, v);
  for (const id of it.sd) if (id) { const st = gemStats(MATS[id].gem, MATS[id].grade); for (const k in st) put(k, st[k]); }
  for (const id of it.se) if (id) put(MATS[id].stat, partValue(MATS[id].stat, MATS[id].grade));
  for (const x of it.si) if (x) put(x[0], x[1]);
}
const alchGoldOf = (g, l) => Math.round(GRADES[g].alch * Math.pow(SC(l), 0.75));

// ---------- derived stats ----------
// o.swap = { slot, item } evaluates an item before equipping it
function computeStats(s, o = {}) {
  const add = {};
  const put = (k, v) => { if (v) add[k] = (add[k] || 0) + v; };
  const eq = o.swap ? { ...s.eq, [o.swap.slot]: o.swap.item } : s.eq;
  const fam = eq.main ? TYPES[eq.main.t].fam : 'sword', F = FAMS[fam];
  const hs = Math.pow(SC(s.hero.lv), 0.85);
  let atk = HERO.atk * hs, hp = HERO.hp * hs, arm = 2 * hs;
  const lg = {};
  for (const slot of SLOTS) {
    const it = eq[slot];
    if (!it) continue;
    const T = TYPES[it.t], res = slot === 'off' && T.fam === fam;
    const mm = itemMain(it, s.enh[slot], res);
    for (const k in mm) { if (k === 'atk') atk += mm.atk; else if (k === 'hp') hp += mm.hp; else if (k === 'arm') arm += mm.arm; else put(k, mm[k]); }
    if (T.imp && (slot === 'main' || res)) for (const k in T.imp) put(k, T.imp[k]);
    itemExtras(it, put);
    if (it.lg && (!LEGENDS[it.lg].fam || LEGENDS[it.lg].fam === fam)) lg[it.lg] = Math.max(lg[it.lg] || 0, it.g >= 6 ? 1.5 : 1);
  }
  for (const id in s.runes) { const n = RUNE[id]; if (n) for (const k in n.eff) put(k, n.eff[k] * s.runes[id]); }
  for (const id in s.skills.lv) {
    const k = SKILLS[id], l = s.skills.lv[id];
    if (!k || !k.passive || !l || (k.fam !== fam && k.fam !== 'any') || s.hero.lv < k.req) continue;
    for (const e in k.eff) put(e, k.eff[e] * l);
    if (id === 'cleaver' && l >= 5) put('cleaveN', 1);
  }
  const petMul = 1 + (add.petBonus || 0);
  for (const id in s.pets.own) for (const k in PETS[id].eff) put(k, PETS[id].eff[k] * petMul);
  // the codex pays out: every monster kind hunted, every bounty claimed
  put('gold', 0.003 * Object.keys(s.codex.m).length);
  let bossMarks = 0;
  for (const id in s.codex.b) for (const t of s.codex.b[id]) if (t > 0) bossMarks++;
  put('dmg', 0.01 * bossMarks);
  if (lg.gale) { put('aspd', 0.15 * lg.gale); put('aspdCap', 1); }
  if (lg.midas) put('gold', 0.4 * lg.midas);
  if (lg.collector) put('chest', 0.3 * lg.collector);
  if (lg.scholar) put('exp', 0.4 * lg.scholar);
  if (lg.kingshield) put('block', 0.15 * lg.kingshield);
  if (lg.judgement) put('holy', 0.5 * lg.judgement);

  let elem = F.elem;
  if (fam === 'staff') elem = eq.off && eq.off.t === 'orb' ? eq.off.el : 'fire';
  const el = {};
  for (const e of ELEMENTS) el[e] = 1 + (add[e] || 0) + (add.elemAll || 0) + (e === 'phys' ? 0 : add.elemPct || 0);
  const aspdCap = HERO.aspdCap + (add.aspdCap || 0);
  const S = {
    fam, elem, el, reach: F.reach, melee: !!F.melee, shot: F.shot || null, shotSpeed: F.speed || 0,
    atk: atk * (1 + (add.atkPct || 0)) * (1 + (add.tAtk || 0)),
    maxHp: hp * (1 + (add.hpPct || 0)) * (1 + (add.tHp || 0)),
    arm: arm * (1 + (add.armPct || 0)),
    aspdBase: F.aspd, aspdPct: add.aspd || 0, aspdCap,
    aspd: Math.min(aspdCap, F.aspd * (1 + (add.aspd || 0))),
    crit: Math.min(HERO.critCap, HERO.crit + (add.crit || 0)), cdmg: HERO.cdmg + (add.cdmg || 0),
    ls: add.ls || 0, regen: add.regen || 0, thorns: add.thorns || 0,
    skill: 1 + (add.skill || 0), cdr: Math.min(0.6, add.cdr || 0), dmg: 1 + (add.dmg || 0),
    boss: 1 + (add.boss || 0), elite: 1 + (add.elite || 0),
    block: Math.min(0.75, add.block || 0), pen: Math.min(0.9, add.pen || 0),
    gold: 1 + (add.gold || 0), chest: 1 + (add.chest || 0), exp: 1 + (add.exp || 0),
    runSpeed: (add.runSpeed || 0) + (add.move || 0),
    cleave: add.cleave || 0, cleaveN: 1 + (add.cleaveN || 0), splash: add.splash || 0, pierce: add.pierce || 0,
    toss: add.toss || 0, hitHeal: add.hitHeal || 0, rapid: add.rapid || 0, riposte: add.riposte ? 0.6 + add.riposte : 0,
    skillSlots: SKILL_SLOT_BASE + (add.skillSlot || 0), tray: TRAY_BASE + (add.tray || 0), bag: BAG_BASE + (add.bag || 0),
    autoN: !!add.autoN, autoB: !!add.autoB, autoAlch: !!add.autoAlch,
    offlineH: OFFLINE_BASE_H + (add.offline || 0), offlineGain: 0.5 + (add.offlineGain || 0),
    wantedDrop: add.wantedDrop || 0, gradeUp: add.gradeUp || 0, bossGold: add.bossGold || 0,
    alchGold: 1 + (add.alchGold || 0), cubeExp: 1 + (add.cubeExp || 0),
    bossTime: lg.verdict ? 8 * lg.verdict : 0, lg,
  };
  return S;
}

// damage left after a monster's defence / the hunter's armor
const defMul = (atk, def) => 1 - def / (def + 3 * atk);
const armMul = (arm, raw) => 1 - Math.min(0.8, arm / (arm + 5 * raw));

// a single "战力" number for comparing loadouts: damage output blended with toughness
function powerOf(S, L = 1, d = 0) {
  const D = DIFFS[d], def = 4 * SC(L) * (1 - S.pen) * (S.lg.sunder ? 0.4 : 1);
  const hit = S.atk * defMul(S.atk, def) * (1 + S.crit * (S.cdmg - 1)) * S.dmg * S.el[S.elem];
  let dps = hit * S.aspd * (1 + S.cleave * 0.5 + S.splash * 0.8 + S.pierce * 0.4 + S.rapid + S.toss * 0.6 + (S.lg.chain ? 0.5 : 0) + (S.lg.pierce ? 0.6 : 0));
  dps += hit * 2.2 * S.skill * S.skillSlots / Math.max(0.4, 1 - S.cdr) * 0.35;
  const raw = 7 * SC(L) * D.atk * 1.2;
  const taken = raw * armMul(S.arm, raw) * (1 - S.block * 0.6);
  const ehp = S.maxHp * (raw / taken) * (1 + S.ls * 4 + S.regen * 10 + S.hitHeal * S.aspd * 3) * (1 + S.thorns * 0.3);
  return Math.pow(dps, 0.65) * Math.pow(ehp, 0.35);
}
const powerNow = (s, S) => powerOf(S || computeStats(s), stageLevel(s.prog.d, s.prog.a, s.prog.s), s.prog.d);

// ---------- hunter level ----------
function gainExp(s, x, ev) {
  if (s.hero.lv >= HERO.maxLevel) return 0;
  s.hero.exp += x;
  let ups = 0;
  while (s.hero.lv < HERO.maxLevel && s.hero.exp >= expNeed(s.hero.lv)) {
    s.hero.exp -= expNeed(s.hero.lv); s.hero.lv++; ups++;
    if (ev) ev.emit('levelUp', s.hero.lv);
  }
  if (s.hero.lv >= HERO.maxLevel) s.hero.exp = 0;
  if (ups && s.opts.autoSkill) Skills.auto(s);
  return ups;
}

// ---------- skill points ----------
const Skills = (() => {
  const famList = fam => SKILL_IDS.filter(id => SKILLS[id].fam === fam || SKILLS[id].fam === 'any');
  function canRaise(s, id) { const k = SKILLS[id]; return skillFree(s) > 0 && s.hero.lv >= k.req && (s.skills.lv[id] || 0) < k.max; }
  function raise(s, id) { if (!canRaise(s, id)) return false; s.skills.lv[id] = (s.skills.lv[id] || 0) + 1; return true; }
  function lower(s, id) {
    if (!s.skills.lv[id]) return false;
    if (--s.skills.lv[id] <= 0) { delete s.skills.lv[id]; s.skills.slots = s.skills.slots.map(x => (x === id ? null : x)); }
    return true;
  }
  function reset(s) { s.skills.lv = {}; s.skills.slots = [null, null, null, null]; }
  function slot(s, id, i) {
    if (!SKILLS[id] || SKILLS[id].passive || !s.skills.lv[id]) return false;
    const n = skillSlots(s);
    if (i === undefined) { i = s.skills.slots.indexOf(null); if (i < 0 || i >= n) i = n - 1; }
    if (i >= n) return false;
    s.skills.slots = s.skills.slots.map(x => (x === id ? null : x));
    s.skills.slots[i] = id;
    return true;
  }
  const unslot = (s, i) => { s.skills.slots[i] = null; };
  // the auto plan: open every active as it unlocks, then grow the slotted ones and the passives evenly
  function auto(s) {
    const fam = famOf(s), list = famList(fam).filter(id => s.hero.lv >= SKILLS[id].req);
    const n = skillSlots(s);
    for (const id of list) if (!SKILLS[id].passive && !s.skills.lv[id] && skillFree(s) > 0) raise(s, id);
    // fill slots with the strongest usable actives (family skills first)
    const usable = list.filter(id => !SKILLS[id].passive && s.skills.lv[id]);
    usable.sort((a, b) => (SKILLS[a].fam === 'any') - (SKILLS[b].fam === 'any') || SKILLS[b].req - SKILLS[a].req);
    for (let i = 0; i < n; i++) {
      const cur = s.skills.slots[i];
      if (cur && skillUsable(s, cur)) continue;
      const pick = usable.find(id => !s.skills.slots.includes(id));
      s.skills.slots[i] = pick || null;
    }
    const grow = list.filter(id => SKILLS[id].passive || s.skills.slots.slice(0, n).includes(id));
    let guard = 400;
    while (skillFree(s) > 0 && guard--) {
      const open = grow.filter(id => (s.skills.lv[id] || 0) < SKILLS[id].max);
      if (!open.length) break;
      open.sort((a, b) => (s.skills.lv[a] || 0) / SKILLS[a].max - (s.skills.lv[b] || 0) / SKILLS[b].max);
      raise(s, open[0]);
    }
  }
  // a new weapon family: give the points back and plan again
  function refit(s) { reset(s); auto(s); }
  return { famList, canRaise, raise, lower, reset, slot, unslot, auto, refit };
})();

// ---------- pets ----------
function checkPets(s, ev) {
  for (const id of PET_IDS) {
    if (s.pets.own[id]) continue;
    const P = PETS[id];
    if ((s.codex.m[P.mob] || 0) >= P.kills) { s.pets.own[id] = 1; if (!s.pets.cur) s.pets.cur = id; if (ev) ev.emit('pet', id); }
  }
}

// ---------- achievements ----------
function checkAch(s, ev) {
  for (const a of ACHIEVEMENTS) if (!s.ach[a.id] && a.test(s)) { s.ach[a.id] = 1; Loot.grant(s, a.reward, ev); if (ev) ev.emit('ach', a); }
}
