'use strict';
// =====================================================================
//  BATTLE — the auto-fight simulation. World x is measured from the
//  hunter (x = 0, looking right); y is height above the ground.
//  Pure logic: renderers and sound subscribe to its events.
// =====================================================================
const RUN_SPEED = 230, WALK_SPEED = 70;
const SPAWN_AT = 480, SPAWN_GAP = 26, ENGAGE_AT = 150;
const BOSS_W = 52, TRIAL_WAVES = 5;
const MOB_W = {
  slime: 16, bigslime: 24, rabbit: 16, wasp: 14, gobthief: 18, gobarcher: 18, gobshaman: 18, goblin: 22, shroom: 16, bat: 16, sapling: 18, spiderling: 18,
  fox: 20, troll: 26, scorpion: 22, cobra: 18, mummy: 20, mummypriest: 20, rat: 18, ratbomber: 18, scarab: 14, cactus: 18, wolf: 28, yeti: 26, wisp: 12,
  skeleton: 18, penguin: 16, bear: 28, ghost: 18, zombie: 20, ghoul: 20, skelarcher: 18, frogman: 20, golem: 26, mole: 20, minegob: 20, imp: 16,
  salamander: 28, demon: 24, worm: 26, harpy: 24, hawk: 22, gargoyle: 24, knight: 22, eye: 22, drake: 30, cultist: 20, goldgob: 20,
};

class Battle {
  constructor(save, o = {}) {
    this.s = save;
    this.headless = !!o.headless;
    this.rng = RNG(o.seed ?? ((save.seed ^ (Date.now() & 0x7fffffff)) >>> 0));
    this.ev = Emitter();
    this.mobs = []; this.shots = []; this.arrows = []; this.zones = []; this.later = [];
    this.t = 0; this.uid = 1; this.achT = 0;
    this.hero = { hp: 1, shield: 0, atkT: 0.2, inv: 0, down: 0, swing: 0, swingT: 0, cast: 0, hurt: 0, gale: 0, count: 0, spin: 0, undying: false, phoenix: false, pending: null, walking: false, hydraT: 0 };
    this.buffs = { warcry: 0, storm: 0, rage: 0, prayer: 0, aegis: 0, hydra: 0 };
    this.debuff = { slow: 0, slowMul: 1, curse: 0 };
    this.cds = {}; this.prism = {};
    this.mode = { kind: 'main' };
    this.phase = 'march'; this.phaseT = 0;
    this.bossT = 0; this.bossMax = 0; this.boss = null; this.bossClock = 0;
    this.where = { d: 0, a: 1, L: 1 };
    this.recalc(true);
    for (const id of SKILL_IDS) this.cds[id] = 1.2;
    this.startStage();
  }

  // ---------- stats ----------
  recalc(full) {
    const ratio = this.S ? this.hero.hp / this.S.maxHp : 1;
    this.S = computeStats(this.s);
    this.hero.hp = full ? this.S.maxHp : clamp(ratio, 0, 1) * this.S.maxHp;
  }
  get L() { return this.where.L; }
  aspdNow() {
    const S = this.S, l = id => skillLevel(this.s, id);
    let p = S.aspdPct;
    if (this.buffs.warcry > 0) p += lv(SKILLS.warcry.v, l('warcry'));
    if (this.buffs.storm > 0) p += lv(SKILLS.storm.v, l('storm'));
    if (this.buffs.rage > 0) p += lv(SKILLS.rage.v, l('rage'));
    let a = Math.min(S.aspdCap, Math.max(0.3, S.aspdBase * (1 + p)));
    if (this.debuff.slow > 0) a *= this.debuff.slowMul;
    return a;
  }
  frail() { return this.mut('frail'); }
  mut(k) { return !!(this.mode.mut && this.mode.mut[k]); }
  // the first regions of 普通 are gentler so a brand-new hunter learns the ropes
  soft(d, L) { return d === 0 ? 0.3 + 0.7 * Math.min(1, (L - 1) / 12) : 1; }

  // ---------- stages and waves ----------
  bossAccess(d, a) { return !stageCleared(this.s, d, a, STAGES) || Loot.hasMat(this.s, `wanted_${d}`); }
  startStage() {
    const P = this.s.prog;
    this.hero.phoenix = false;
    P.w = 1;
    if (P.s === STAGES && !this.bossAccess(P.d, P.a)) {
      P.s = STAGES - 1; P.farm = true; P.auto = true; P.clears = 0;
      this.ev.emit('needWanted', P.d);
    }
    this.ev.emit('stage', P.d, P.a, P.s);
    this.startWave();
  }
  clearField() {
    this.mobs = []; this.shots = []; this.arrows = []; this.zones = []; this.boss = null;
    this.hero.undying = false; this.hero.spin = 0;
    this.phase = 'march'; this.phaseT = 0;
  }
  startWave() {
    this.clearField();
    const m = this.mode;
    if (m.kind === 'mine') {
      this.where = { d: m.d, a: m.a, L: m.L };
      for (let i = 0; i < 4; i++) this.spawnMine(170 + i * 36);
      this.phase = 'fight';
      return;
    }
    if (m.kind === 'rush') {
      const id = m.list[m.n % m.list.length], a = ACTS.findIndex(A => A.boss === id) + 1;
      this.where = { d: m.d, a, L: Math.min(100, stageLevel(m.d, a, STAGES) + 2 * Math.floor(m.n / m.list.length)) };
      this.spawnBoss(id);
      return;
    }
    if (m.kind === 'trial') {
      this.where = { d: m.d, a: m.a, L: m.L };
      if (m.wave > TRIAL_WAVES) { this.spawnBoss(ACTS[m.a - 1].boss); return; }
      this.spawnWave(ACTS[m.a - 1], waveSize(m.wave + 4), 0.25);
      this.ev.emit('wave', m.wave, TRIAL_WAVES + 1);
      return;
    }
    const P = this.s.prog, act = ACTS[P.a - 1];
    this.where = { d: P.d, a: P.a, L: stageLevel(P.d, P.a, P.s) };
    if (P.s === STAGES) { this.spawnBoss(act.boss); return; }
    const total = waveCount(P.d, P.a, P.s);
    if (P.w >= total) this.spawnChamp(P.a, P.s);
    else this.spawnWave(act, waveSize(P.w), P.w >= 3 ? ELITE_CHANCE : 0);
    this.ev.emit('wave', P.w, total);
  }
  spawnWave(act, n, elite) {
    for (let i = 0; i < n; i++) this.addMob(this.rng.pick(act.mobs), SPAWN_AT + i * SPAWN_GAP + this.rng.int(0, 8), { elite: this.rng.chance(elite) });
  }
  spawnChamp(a, st) {
    const [type, name, aura] = champOf(a, st), act = ACTS[a - 1];
    for (let i = 0; i < 2; i++) this.addMob(this.rng.pick(act.mobs), SPAWN_AT + i * SPAWN_GAP);
    const c = this.addMob(type, SPAWN_AT + 2 * SPAWN_GAP + 14, { champ: { name, aura, key: `${a}-${Math.min(2, Math.floor((st - 1) / 3))}` } });
    if (aura === 'rally') for (let i = 0; i < 2; i++) this.addMob(type, c.x + 24 + i * 22, { summoned: true });
    this.ev.emit('champ', c);
  }
  addMob(type, x, o = {}) {
    const T = MONSTERS[type], { d, L } = this.where, D = DIFFS[d], soft = this.soft(d, L);
    const k = o.elite ? ELITE : o.champ ? CHAMP : null, aura = o.champ ? o.champ.aura : null;
    const quick = (this.mut('quick') ? 1.5 : 1) * (aura === 'swift' ? 1.4 : 1);
    const m = {
      id: this.uid++, type, d: T, fam: FAMILIES[T.fam], boss: false, elite: !!o.elite, champ: o.champ || null, L, x, y: T.fly || 0, w: (T.w || MOB_W[T.spr] || 18) + (o.champ ? 4 : 0),
      maxHp: CURVE.hp(L) * T.hp * D.hp * (k ? k.hp : 1) * soft,
      atk: CURVE.atk(L) * T.atk * D.atk * (k ? k.atk : 1) * soft * (this.mut('frenzy') ? 1.6 : 1),
      dfn: CURVE.def(L) * T.def * (this.mut('plated') ? 3 : 1) * (aura === 'stone' ? 3 : 1),
      spd: T.spd * quick, cd: T.cd / quick,
      gold: CURVE.gold(L) * T.gold * D.gold * (k ? k.gold : 1) * (o.goldMul || 1), exp: CURVE.exp(L) * T.exp * D.exp * (k ? k.exp : 1),
      atkT: 0.6 + this.rng.next() * 0.6, stun: 0, root: 0, burn: 0, burnDps: 0, flash: 0, dead: false, deathT: 0, act: 0, bob: this.rng.next() * TAU,
      flee: 0, summoned: !!o.summoned, focused: false, arcT: 6,
    };
    if (o.summoned) { m.gold *= 0.5; m.exp *= 0.5; }
    m.hp = m.maxHp;
    this.mobs.push(m);
    this.ev.emit('spawn', m);
    return m;
  }
  spawnBoss(id) {
    const b = BOSSES[id], { d, L } = this.where, D = DIFFS[d], soft = this.soft(d, L);
    const m = {
      id: this.uid++, type: id, d: b, fam: FAMILIES[b.fam], boss: true, elite: false, champ: null, L, x: SPAWN_AT + 20, y: 0, w: BOSS_W,
      maxHp: CURVE.hp(L) * BOSS_MUL.hp * b.hp * D.hp * soft * (this.mut('giant') ? 2.5 : 1),
      atk: CURVE.atk(L) * BOSS_MUL.atk * b.atk * D.atk * soft * (this.mut('frenzy') ? 1.6 : 1),
      dfn: CURVE.def(L) * BOSS_MUL.def * b.def * (this.mut('plated') ? 3 : 1), spd: 34, cd: b.cd / (this.mut('quick') ? 1.5 : 1),
      gold: CURVE.gold(L) * BOSS_MUL.gold * D.gold, exp: CURVE.exp(L) * BOSS_MUL.exp * D.exp,
      atkT: 1.2, stun: 0, root: 0, burn: 0, burnDps: 0, flash: 0, dead: false, deathT: 0, act: 0, bob: 0, flee: 0, focused: false,
      sk: {}, tele: null, harden: 0, phase2: false, phase3: false,
    };
    for (const k of b.skills) m.sk[k] = 3 + this.rng.next() * 2;
    m.hp = m.maxHp;
    this.mobs.push(m);
    this.boss = m;
    this.bossMax = Math.max(10, (b.time + this.S.bossTime) * (this.mut('hurry') ? 0.6 : 1));
    if (this.mode.kind === 'rush') this.bossMax = MODES.rush.time + this.S.bossTime;
    this.bossT = this.bossMax; this.bossClock = 0;
    this.ev.emit('bossIntro', m, m.gold * this.S.gold * (1 + this.S.bossGold) * (this.S.lg.bounty ? 2 : 1));
  }
  spawnMine(x) {
    const type = this.rng.chance(0.55) ? 'goldgob' : 'oregolem';
    return this.addMob(type, x, { goldMul: 3 });
  }

  // ---------- damage ----------
  dmgTo(m, mult, o) {
    const S = this.S;
    const atk = (o.base ?? S.atk) * (this.debuff.curse > 0 ? 0.75 : 1);
    const def = m.dfn * (m.harden > 0 ? 3 : 1) * (1 - S.pen) * (S.lg.sunder ? 0.4 : 1);
    let dmg = (o.pure ? atk : atk * defMul(atk, def)) * mult * S.dmg;
    if (o.skill) dmg *= S.skill;
    const elem = o.elem || S.elem;
    dmg *= S.el[elem];
    if (m.fam) { if (m.fam.weak === elem) dmg *= WEAK_MUL; else if (m.fam.resist === elem) dmg *= RESIST_MUL; }
    if (m.boss) dmg *= S.boss * (S.lg.verdict ? 1 + 0.6 * S.lg.verdict : 1) * (o.bossBonus || 1);
    if (m.elite || m.champ) dmg *= S.elite;
    if (S.lg.prism) {
      this.prism[elem] = 5;
      let n = 0; for (const k in this.prism) if (this.prism[k] > 0) n++;
      dmg *= 1 + 0.06 * S.lg.prism * Math.min(5, n);
    }
    if (m.champ) {
      if (m.champ.aura === 'stone') dmg *= 0.75;
      if (m.champ.aura === 'ward' && this.mobs.some(x => !x.dead && x !== m)) dmg *= 0.5;
    }
    let crit = false;
    if (!o.noCrit) {
      if (S.lg.focus && !m.focused) { m.focused = true; crit = true; }
      else crit = this.rng.next() < S.crit + (o.critAdd || 0);
    }
    if (crit) dmg *= S.cdmg + (this.buffs.warcry > 0 ? 0.15 : 0);
    return { dmg, crit, elem };
  }
  hit(m, mult, o = {}) {
    if (!m || m.dead) return 0;
    let { dmg, crit, elem } = this.dmgTo(m, mult, o);
    const kind = o.kind || 'atk';
    if (m.d.block && kind !== 'burn' && this.rng.chance(m.d.block)) { dmg *= 0.4; this.ev.emit('fx', 'mobBlock', m); }
    m.hp -= dmg; m.flash = 2 / 60;
    this.ev.emit('hit', m, dmg, crit, kind, elem);
    const S = this.S;
    if (crit) {
      this.s.stats.crits++;
      this.ev.emit('crit', m, kind);
      if (S.lg.sand) for (const id in this.cds) this.cds[id] = Math.max(0, this.cds[id] - 0.25 * S.lg.sand);
      if (S.lg.thunderclap && kind === 'atk') {
        this.ev.emit('fx', 'boom', m);
        for (const x of this.alive()) if (x !== m && Math.abs(x.x - m.x) < 40) this.hit(x, 0.5 * S.lg.thunderclap, { kind: 'proc', noCrit: true });
      }
    }
    if (S.ls > 0 && (kind === 'atk' || kind === 'skill' || (kind === 'thorns' && S.lg.crown))) this.heal(dmg * (S.ls + (this.buffs.rage > 0 ? 0.03 : 0)), true);
    if (m.champ && m.champ.aura === 'thorny' && kind !== 'thorns' && kind !== 'burn') this.hurtHero(dmg * 0.05, null, { noThorns: true, pure: true, kind: 'thorns' });
    if (m.type === 'oregolem' && kind !== 'burn') this.payGold(m, m.gold * 0.04, true);
    if (m.d.flee && kind !== 'burn') m.flee = 1.2;
    if (m.hp <= 0) this.kill(m);
    return dmg;
  }
  heal(amt, steal) {
    if (amt <= 0 || this.hero.down) return;
    if (this.frail() && steal) return;
    const h = this.hero, room = this.S.maxHp - h.hp;
    if (amt <= room) { h.hp += amt; return; }
    h.hp = this.S.maxHp;
    if (this.S.lg.pact) h.shield = Math.min(this.S.maxHp * 0.3 * this.S.lg.pact, h.shield + (amt - room));
  }
  armNow() { return this.S.arm * (this.buffs.prayer > 0 ? 1.3 : 1); }
  hurtHero(raw, src, o = {}) {
    const h = this.hero, S = this.S;
    if (h.down > 0 || h.inv > 0) return;
    let dmg = o.pure ? raw : raw * armMul(this.armNow(), raw);
    let blocked = false;
    if (!o.pure && S.block > 0 && this.rng.chance(S.block)) {
      blocked = true; dmg *= 0.4;
      this.ev.emit('block');
      if (S.lg.bulwark) h.shield = Math.min(S.maxHp * 0.5, h.shield + S.maxHp * 0.05 * S.lg.bulwark);
      if (src && !src.dead) {
        const counter = S.riposte + (S.lg.kingshield ? S.lg.kingshield : 0);
        if (counter > 0) this.hit(src, counter, { kind: 'atk' });
      }
    }
    if (h.shield > 0) { const a = Math.min(h.shield, dmg); h.shield -= a; dmg -= a; }
    h.hp -= dmg; h.hurt = 0.14;
    this.ev.emit('hurt', dmg, src, o.kind || 'melee', blocked);
    if (src && !src.dead && src.d.drain) src.hp = Math.min(src.maxHp, src.hp + dmg * src.d.drain);
    if (src && !src.dead && src.champ && src.champ.aura === 'vampiric') src.hp = Math.min(src.maxHp, src.hp + dmg * 3);
    if (S.thorns > 0 && src && !src.dead && !o.noThorns) {
      const th = (raw + this.armNow()) * S.thorns * (this.buffs.aegis > 0 ? 2 : 1);
      this.hit(src, 1, { base: th, pure: true, kind: 'thorns', noCrit: !S.lg.crown });
    }
    if (h.hp <= 0) {
      if (S.lg.undying && !h.undying) { h.undying = true; h.hp = 1; h.inv = 2; this.ev.emit('undying'); return; }
      this.heroDown();
    }
  }

  // ---------- rewards ----------
  payGold(m, base, chip) {
    const S = this.S;
    let g = base * S.gold * (this.buffs.storm > 0 ? 2 : 1);
    if (m.boss) g *= (1 + S.bossGold) * (S.lg.bounty ? 2 : 1);
    this.s.gold += g; this.s.stats.gold += g;
    if (this.mode.kind === 'mine') this.mode.gold += g;
    const coins = chip ? 1 : clamp(Math.round(Math.log2(1 + g / Math.max(1, CURVE.gold(this.L) * S.gold))) + 2, 2, m.boss ? 14 : 6);
    if (S.lg.midas) this.heal(S.maxHp * 0.005 * coins, false);
    this.ev.emit('gold', g, m, coins);
  }
  giveExp(x) {
    const lv0 = this.s.hero.lv;
    this.ev.emit('exp', x);
    if (gainExp(this.s, x, this.ev)) { this.recalc(); this.hero.hp = this.S.maxHp; }
    return this.s.hero.lv - lv0;
  }
  dropChest(m, k) {
    const ch = { k, d: this.where.d, L: Math.max(1, Math.round(this.where.L)), a: this.where.a };
    this.ev.emit('chestDrop', ch, m);
    Loot.addChest(this.s, ch, this.ev, this.S);
  }
  kill(m) {
    if (m.dead) return;
    m.dead = true; m.deathT = 0;
    const s = this.s, S = this.S;
    s.stats.kills++;
    if (!m.boss) s.codex.m[m.type] = (s.codex.m[m.type] || 0) + 1;
    if (m.elite) s.stats.elites++;
    this.ev.emit('kill', m);
    if (S.lg.ember) {
      const blast = m.maxHp * 0.4 * S.lg.ember;
      this.ev.emit('fx', 'ember', m);
      for (const o of this.mobs) if (!o.dead && o !== m && Math.abs(o.x - m.x) < 60) this.hit(o, 1, { base: blast, pure: true, kind: 'ember', noCrit: true });
    }
    this.payGold(m, m.gold);
    this.giveExp(m.exp * S.exp);
    if (m.d.split && !m.summoned && this.mode.kind !== 'mine') for (let i = 0; i < 2; i++) this.addMob(m.d.split, m.x + 6 + i * 14, { summoned: true });
    if (this.mode.kind === 'mine') return;
    if (m.boss) { this.bossDown(m); return; }
    if (m.champ) {
      s.stats.champs++; s.codex.c[m.champ.key] = (s.codex.c[m.champ.key] || 0) + 1;
      this.dropChest(m, 1);
    } else if (!m.summoned) {
      const p = (m.elite ? ELITE.chest : CHEST_DROP.mob) * S.chest * (this.buffs.storm > 0 ? 2 : 1) * (this.mode.kind === 'trial' ? 1.5 : 1);
      if (this.rng.next() < p) this.dropChest(m, 0);
    }
    checkPets(s, this.ev);
  }
  bossDown(m) {
    const s = this.s, S = this.S, time = this.bossClock, d = this.where.d;
    s.stats.bosses++;
    const rec = s.codex.b[m.type] || (s.codex.b[m.type] = DIFFS.map(() => 0));
    rec[d] = rec[d] ? Math.min(rec[d], time) : time;
    this.ev.emit('bossKill', m, time);
    for (const o of this.mobs) if (!o.dead && o.summoned) { o.dead = true; o.deathT = 0; }
    const mode = this.mode;
    if (mode.kind === 'rush') {
      mode.n++;
      this.dropChest(m, 1);
      if (S.lg.bounty) this.dropChest(m, 1);
      this.later.push({ t: 1.4, fn: () => this.startWave() });
      this.phase = 'clear'; this.phaseT = 0;
      return;
    }
    const n = 1 + (this.rng.chance(0.35) ? 1 : 0);
    for (let i = 0; i < n; i++) this.dropChest(m, 2);
    if (S.lg.bounty) this.dropChest(m, 1);
    if (mode.kind === 'trial') { this.endTrial(true); return; }
    const P = s.prog;
    if (stageCleared(s, P.d, P.a, STAGES)) Loot.useMat(s, `wanted_${P.d}`);
    this.stageClear();
  }
  stageClear() {
    const s = this.s, P = s.prog;
    s.stats.stages++; P.fails = 0;
    let first = false;
    if (stageIndex(P.a, P.s) === s.prog.best[P.d]) { s.prog.best[P.d]++; first = true; this.ev.emit('record', P.d, P.a, P.s); }
    this.ev.emit('stageClear', P.d, P.a, P.s, first);
    if (P.farm) {
      if (P.auto && ++P.clears >= 3) { P.farm = false; P.auto = false; P.clears = 0; this.ev.emit('autoRetry'); this.advance(); }
    } else this.advance();
    this.phase = 'clear'; this.phaseT = 0;
    this.later.push({ t: 1.6, fn: () => { this.recalc(); this.startStage(); } });
  }
  advance() {
    const s = this.s, P = s.prog;
    let { d, a, s: st } = P;
    if (st < STAGES) st++;
    else if (a < ACT_COUNT) { a++; st = 1; }
    else if (d + 1 < DIFFS.length) { d++; a = 1; st = 1; }
    else { P.farm = true; return; }
    if (!stageOpen(s, d, a, st)) { P.farm = true; return; }
    if (d !== P.d) this.ev.emit('newDiff', d);
    P.d = d; P.a = a; P.s = st;
  }
  retreat() {
    const P = this.s.prog;
    P.fails = 0; P.farm = true; P.auto = true; P.clears = 0;
    if (P.s > 1) P.s = Math.min(P.s - 1, STAGES - 1);
    else if (P.a > 1) { P.a--; P.s = STAGES - 1; }
    this.ev.emit('retreat');
  }
  bossFail(reason) {
    this.ev.emit('bossFail', reason, this.boss);
    if (this.mode.kind === 'rush') { this.endMode(); return; }
    if (this.mode.kind === 'trial') { this.endTrial(false); return; }
    for (const o of this.mobs) if (!o.dead) { o.dead = true; o.escaped = true; o.deathT = 0; }
    const P = this.s.prog;
    P.s = STAGES - 1; P.farm = true; P.auto = true; P.clears = 0;
    this.phase = 'clear'; this.phaseT = 0;
    this.later.push({ t: 1.2, fn: () => { this.hero.hp = Math.max(this.hero.hp, this.S.maxHp * 0.5); this.startStage(); } });
  }
  heroDown() {
    const h = this.hero, S = this.S;
    h.hp = 0; h.down = 2.4; this.s.stats.deaths++;
    this.ev.emit('down');
    if (S.lg.phoenix && !h.phoenix) {
      h.phoenix = true;
      this.later.push({ t: 0.9, fn: () => { h.down = 0; h.hp = S.maxHp * 0.4 * S.lg.phoenix; h.inv = 1.5; this.ev.emit('revive'); } });
    }
  }
  afterDown() {
    const h = this.hero;
    h.hp = this.S.maxHp; h.shield = 0; h.inv = 1;
    if (this.boss && !this.boss.dead) { this.bossFail('down'); return; }
    if (this.mode.kind === 'trial') { this.endTrial(false); return; }
    if (this.mode.kind !== 'main') { this.endMode(); return; }
    const P = this.s.prog;
    if (++P.fails >= 2) this.retreat();
    this.startStage();
  }
  waveCleared() {
    const m = this.mode;
    this.ev.emit('cleared');
    if (m.kind === 'trial') { m.wave++; this.startWave(); return; }
    if (m.kind !== 'main') return;
    const P = this.s.prog;
    if (P.w >= waveCount(P.d, P.a, P.s)) { this.stageClear(); return; }
    P.w++;
    this.startWave();
  }

  // ---------- side modes ----------
  modeSpot() { const d = topDiff(this.s), i = Math.min(FULL - 1, this.s.prog.best[d]); return { d, a: Math.floor(i / STAGES) + 1, L: topLevel(this.s) }; }
  startMine() {
    const p = this.modeSpot();
    this.mode = { kind: 'mine', t: MODES.mine.dur, ...p, gold: 0 };
    this.ev.emit('modeStart', 'mine');
    this.startWave();
  }
  startRush() {
    // the deepest difficulty where at least one bounty boss has fallen
    let d = topDiff(this.s);
    while (d > 0 && this.s.prog.best[d] < STAGES) d--;
    const beaten = Math.max(1, Math.min(ACT_COUNT, Math.floor(this.s.prog.best[d] / STAGES)));
    const list = ACTS.slice(0, beaten).map(A => A.boss);
    this.mode = { kind: 'rush', n: 0, d, list, chests: 0 };
    this.hero.hp = this.S.maxHp;
    this.ev.emit('modeStart', 'rush');
    this.startWave();
  }
  startTrial(muts) {
    const mut = {}; let bonus = 0;
    for (const k of muts) { mut[k] = true; bonus += MUTATORS[k].bonus; }
    const p = this.modeSpot();
    this.mode = { kind: 'trial', ...p, wave: 1, mut, bonus, muts: muts.slice() };
    this.hero.hp = this.S.maxHp;
    this.ev.emit('modeStart', 'trial');
    this.startWave();
  }
  endTrial(win) {
    const m = this.mode, s = this.s;
    const res = { kind: 'trial', win, wave: m.wave, bonus: m.bonus, chests: 0 };
    if (win) {
      res.chests = 1 + Math.floor(m.bonus * 2);
      const S = computeStats(s);
      for (let i = 0; i < res.chests; i++) Loot.addChest(s, { k: 2, d: m.d, L: m.L, a: m.a }, this.ev, S);
      s.trial.best = Math.max(s.trial.best, Math.round(m.bonus * 100));
    }
    this.endMode(res);
  }
  endMode(res) {
    const m = this.mode;
    if (!res) res = m.kind === 'mine' ? { kind: 'mine', gold: m.gold } : m.kind === 'rush' ? { kind: 'rush', n: m.n } : { kind: m.kind };
    this.mode = { kind: 'main' };
    this.debuff.slow = 0; this.debuff.curse = 0;
    this.hero.hp = this.S.maxHp; this.hero.down = 0;
    this.ev.emit('modeEnd', res);
    this.recalc();
    this.startStage();
  }

  // ---------- targeting ----------
  alive() { return this.mobs.filter(m => !m.dead); }
  front() {
    let best = null;
    for (const m of this.mobs) if (!m.dead && (!best || m.x < best.x)) best = m;
    return best;
  }
  inReach(m, extra = 0) { return !!m && m.x - m.w / 2 <= this.S.reach + (this.S.melee ? 6 : 0) + extra; }
  behind(m, n, gap = Infinity) {
    return this.mobs.filter(o => !o.dead && o !== m && o.x > m.x && o.x - m.x < gap).sort((a, b) => a.x - b.x).slice(0, n);
  }
  near(x, r) { return this.alive().filter(m => Math.abs(m.x - x) < r + m.w / 2); }

  // ---------- hunter attacks ----------
  attack(m) {
    const h = this.hero, S = this.S;
    h.count++; h.swing = 1; h.swingT = 0;
    this.ev.emit('swing', h.count, S.fam);
    if (S.melee) { h.pending = { t: 0.07, m }; return; }
    // ranged: one shot, plus 疾风步 / 速射 / 连珠 extras
    let n = 1;
    if (h.gale > 0) { n++; h.gale--; }
    if (S.rapid && this.rng.chance(S.rapid)) n += S.lg.falcon ? 2 : 1;
    if (S.lg.chain && h.count % 4 === 0) n += 2;
    for (let i = 0; i < n; i++) this.later.push({ t: 0.06 + i * 0.07, fn: () => this.fire(m) });
  }
  fire(m, o = {}) {
    if (!m || m.dead) m = this.front();
    if (!m) return;
    const S = this.S;
    const a = { x: 14, y: 14 + this.rng.int(-2, 2), tgt: m, spd: o.spd || S.shotSpeed || 360, kind: o.kind || S.shot, elem: o.elem || S.elem, mult: o.mult ?? 1, opt: o.opt || { kind: 'atk' }, onHit: o.onHit || null, basic: !o.onHit && !o.opt };
    this.arrows.push(a);
    this.ev.emit('arrow', a);
  }
  // a basic ranged hit with the family's on-hit effects
  rangedImpact(m, a) {
    const S = this.S;
    const was = m.hp;
    this.hit(m, a.mult, a.opt);
    if (S.fam === 'staff') {
      if (S.splash) for (const o of this.near(m.x, 30)) if (o !== m) this.hit(o, S.splash, { kind: 'proc', noCrit: true });
      if (S.lg.elemchain) { let from = m; for (let i = 0; i < 2; i++) { const nx = this.alive().filter(o => o !== m && o !== from).sort((p, q) => Math.abs(p.x - from.x) - Math.abs(q.x - from.x))[0]; if (!nx) break; this.ev.emit('fx', 'zap', { from: from.x, to: nx.x }); this.hit(nx, 0.5 * S.lg.elemchain, { kind: 'proc', noCrit: true }); from = nx; } }
    }
    if (S.fam === 'crossbow') {
      const n = S.lg.sunpierce ? 99 : S.pierce;
      const list = this.behind(m, n);
      list.forEach(b => this.hit(b, S.lg.sunpierce ? 0.8 * S.lg.sunpierce : 0.6, { kind: 'atk', noCrit: true }));
      if (list.length) this.ev.emit('fx', 'pierce', m);
    }
    if (S.lg.splitarrow && S.fam === 'bow') {
      const others = this.alive().filter(o => o !== m);
      for (let i = 0; i < 2 && others.length; i++) { const o = others.splice(this.rng.int(0, others.length - 1), 1)[0]; this.ev.emit('fx', 'split', { from: m.x, to: o.x }); this.hit(o, 0.4 * S.lg.splitarrow, { kind: 'proc', noCrit: true }); }
    }
    if (S.lg.pierce) { const list = this.behind(m, 2); list.forEach(b => this.hit(b, 0.5 * S.lg.pierce, { kind: 'atk', noCrit: true })); }
    return was - Math.max(0, m.hp);
  }
  strike(m) {
    const h = this.hero, S = this.S;
    if (!m || m.dead) m = this.front();
    if (!m || !this.inReach(m, 8)) return;
    let hits = 1;
    if (S.lg.chain && h.count % 4 === 0) hits += 2;
    for (let i = 0; i < hits; i++) {
      const d = this.hit(m, 1, { kind: 'atk' });
      if (S.hitHeal) this.heal(S.maxHp * S.hitHeal * (S.lg.sainthood ? 3 * S.lg.sainthood : 1), false);
      if (S.cleave) for (const b of this.behind(m, S.cleaveN, 44)) {
        const cd = this.hit(b, S.cleave, { kind: 'atk', noCrit: true });
        if (S.lg.bloodaxe) this.heal(cd * 0.1 * S.lg.bloodaxe, true);
      }
      if (S.lg.swordwave) { const list = this.behind(m, 2); if (list.length) { this.ev.emit('fx', 'wave', m); list.forEach(b => this.hit(b, 0.6 * S.lg.swordwave, { kind: 'atk', noCrit: true })); } }
      if (S.lg.pierce) { const list = this.behind(m, 2); list.forEach(b => this.hit(b, 0.5 * S.lg.pierce, { kind: 'atk', noCrit: true })); }
      if (S.toss && this.rng.chance(S.toss)) {
        const t = this.rng.pick(this.alive());
        if (t) this.fire(t, { kind: 'hatchet', spd: 300, mult: 0.6, opt: { kind: 'proc' } });
      }
      if (d && m.dead) { m = this.front(); if (!m || !this.inReach(m, 8)) break; }
    }
  }

  // ---------- skills ----------
  skillElem(id) { return SKILLS[id].elem || this.S.elem; }
  castReady(id) {
    const f = this.front(), S = this.S;
    if (!f) return false;
    const melee = S.melee ? this.inReach(f, 24) : this.inReach(f);
    switch (id) {
      case 'bash': case 'execute': case 'crush': case 'soul': case 'smite': return melee;
      case 'cleave': return f.x < 92;
      case 'bladestorm': case 'whirl': return f.x < 74;
      case 'frostnova': return f.x < 118;
      case 'holynova': return f.x < 200;
      case 'throwaxe': return f.x < 170;
      case 'multishot': case 'pierceshot': case 'arrowrain': case 'blastbolt': case 'snipe': case 'repeater': case 'fireball': case 'chainlight': case 'hydra': return this.inReach(f);
      case 'rage': case 'gale': case 'warcry': case 'storm': return f.x < 150;
      case 'prayer': case 'aegis': return this.hero.hp < S.maxHp * 0.85 || !!this.boss;
      case 'snare': return f.x > 40 && f.x < 200;
    }
    return false;
  }
  cast(id, echo) {
    const h = this.hero, l = skillLevel(this.s, id), sk = SKILLS[id], S = this.S;
    const f = this.front(), mul = sk.mul ? lv(sk.mul, l) : 0, el = this.skillElem(id);
    const o = { skill: true, kind: 'skill', elem: el };
    h.cast = 0.28;
    this.s.stats.casts++;
    this.ev.emit('cast', id, echo);
    const ticks = (n, every, fn) => { for (let i = 0; i < n; i++) this.later.push({ t: i * every, fn }); };
    switch (id) {
      // 剑盾
      case 'cleave': this.ev.emit('fx', 'cleave'); for (const m of this.alive()) if (m.x < 90 + m.w / 2) this.hit(m, mul, o); break;
      case 'bash':
        if (f) { this.ev.emit('fx', 'bash', f); this.hit(f, mul * (this.s.eq.off && this.s.eq.off.t === 'shield' ? 1.5 : 1), o); if (!f.dead) f.stun = Math.max(f.stun, 1.5); }
        break;
      case 'bladestorm': h.spin = 2; this.ev.emit('fx', 'spin', { r: 70, t: 2 }); ticks(8, 0.25, () => { if (h.down) return; for (const m of this.near(0, 70)) this.hit(m, mul, o); }); break;
      case 'execute': if (f) { const low = f.hp < f.maxHp * 0.3; this.ev.emit('fx', 'execute', f); this.hit(f, mul * (low ? 3 : 1), o); } break;
      // 双斧
      case 'whirl': {
        const dur = 3 + (S.lg.tempest ? 2 * S.lg.tempest : 0), r = 60 * (S.lg.tempest ? 1.5 : 1);
        h.spin = dur; this.ev.emit('fx', 'spin', { r, t: dur });
        ticks(Math.round(dur / 0.25), 0.25, () => { if (h.down) return; for (const m of this.near(0, r)) this.hit(m, mul, o); });
        break;
      }
      case 'throwaxe': { const list = this.alive().sort((a, b) => a.x - b.x).slice(0, 4); this.ev.emit('fx', 'throwaxe', { x: list.length ? list[list.length - 1].x : 120 }); list.forEach((m, i) => this.later.push({ t: 0.1 + i * 0.06, fn: () => this.hit(m, mul, o) })); break; }
      case 'crush': if (f) { this.ev.emit('fx', 'crush', f); this.hit(f, mul, o); if (!f.dead) f.stun = Math.max(f.stun, 1); } break;
      case 'rage': this.buffs.rage = sk.dur; this.ev.emit('fx', 'rage'); break;
      // 长弓
      case 'multishot': for (const m of this.alive().sort((a, b) => a.x - b.x).slice(0, 5)) this.fire(m, { mult: mul, opt: o, kind: 'arrow' }); break;
      case 'pierceshot': this.ev.emit('fx', 'beamArrow'); for (const m of this.alive()) this.hit(m, mul, o); break;
      case 'arrowrain': {
        const x = f ? f.x : 120;
        this.ev.emit('fx', 'rain', { x, t: 2.5 });
        ticks(10, 0.25, () => { for (const m of this.near(x, 50)) this.hit(m, mul, o); });
        break;
      }
      case 'gale': h.gale = Math.round(lv(sk.v, l)); this.ev.emit('fx', 'gale'); break;
      // 重弩
      case 'blastbolt': if (f) this.fire(f, { kind: 'bomb', mult: mul, opt: o, onHit: m => { this.ev.emit('fx', 'blast', m); for (const x of this.near(m.x, 45)) this.hit(x, mul, o); } }); break;
      case 'snipe': {
        const t = this.alive().sort((a, b) => b.hp - a.hp)[0];
        if (t) { this.ev.emit('fx', 'snipe', t); this.fire(t, { kind: 'bolt', spd: 900, mult: mul, opt: { ...o, critAdd: 0.5 } }); }
        break;
      }
      case 'snare': this.zones.push({ kind: 'snare', x: clamp((f ? f.x : 120) - 30, 40, 140), n: 3, t: 12, mul, cd: 0, o }); this.ev.emit('fx', 'snare'); break;
      case 'repeater': ticks(6, 0.1, () => { const t = this.front(); if (t) this.fire(t, { kind: 'bolt', mult: mul, opt: o, onHit: m => { this.hit(m, mul, o); const b = this.behind(m, 1)[0]; if (b) this.hit(b, mul, o); } }); }); break;
      // 法杖
      case 'fireball': if (f) this.fire(f, { kind: 'fireball', spd: 260, elem: 'fire', mult: mul, opt: o, onHit: m => { this.ev.emit('fx', 'blast', m); for (const x of this.near(m.x, 40)) { const d = this.hit(x, mul, o); if (!x.dead) { x.burn = 3; x.burnDps = Math.max(x.burnDps, d * 0.2); } } } }); break;
      case 'chainlight': {
        let from = { x: 10 }, k = 1;
        const left = this.alive();
        for (let i = 0; i < 5 && left.length; i++) {
          left.sort((a, b) => Math.abs(a.x - from.x) - Math.abs(b.x - from.x));
          const t = left.shift();
          this.ev.emit('fx', 'zap', { from: from.x, to: t.x });
          this.hit(t, mul * k, o); k *= 0.9; from = t;
        }
        break;
      }
      case 'frostnova': this.ev.emit('fx', 'nova', { color: 'ice' }); for (const m of this.near(0, 120)) { this.hit(m, mul, o); if (!m.dead) m.stun = Math.max(m.stun, 1.5); } break;
      case 'hydra': this.buffs.hydra = 8 + (S.lg.hydraking ? 4 : 0); h.hydraT = 0; this.hydraMul = mul; this.ev.emit('fx', 'hydra'); break;
      // 权杖
      case 'smite': if (f) { this.ev.emit('fx', 'smite', f); this.hit(f, mul, o); if (S.lg.judgement && !f.dead) f.stun = Math.max(f.stun, 1); this.heal(S.maxHp * 0.04, false); } break;
      case 'prayer': this.buffs.prayer = sk.dur; this.prayerHps = S.maxHp * lv(sk.v, l) / sk.dur; this.ev.emit('fx', 'prayer'); break;
      case 'aegis': h.shield = Math.max(h.shield, S.maxHp * lv(sk.v, l)); this.buffs.aegis = sk.dur; this.ev.emit('fx', 'aegis'); break;
      case 'holynova': this.ev.emit('fx', 'nova', { color: 'holy' }); for (const m of this.alive()) this.hit(m, mul, o); this.heal(S.maxHp * 0.06, false); break;
      // 通用
      case 'warcry': this.buffs.warcry = sk.dur; this.ev.emit('fx', 'warcry'); break;
      case 'storm': this.buffs.storm = sk.dur; this.ev.emit('fx', 'storm'); break;
      case 'soul': if (f) { this.ev.emit('fx', 'soul', f); this.hit(f, mul, o); this.heal(S.maxHp * 0.08, false); } break;
    }
    if (!echo && S.lg.echo && this.rng.chance(0.3 * S.lg.echo)) this.later.push({ t: 0.35, fn: () => { if (this.alive().length) this.cast(id, true); } });
  }

  // ---------- monsters ----------
  mobAttack(m) {
    const d = m.d;
    m.act = 0.3;
    if (d.heal && this.rng.chance(0.4)) {
      const hurt = this.alive().filter(o => o.hp < o.maxHp * 0.8).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (hurt) { hurt.hp = Math.min(hurt.maxHp, hurt.hp + hurt.maxHp * d.heal); this.ev.emit('fx', 'mobHeal', hurt); return; }
    }
    const atk = m.atk * (m.champ && m.champ.aura === 'fury' && m.hp < m.maxHp * 0.5 ? 1.6 : 1);
    if (d.rng && !m.boss) {
      const sh = { x: m.x - 6, y: m.y || 10, vx: -170, dmg: atk, src: m, kind: d.shot, elem: d.elem || 'phys' };
      this.shots.push(sh);
      this.ev.emit('shot', sh);
      return;
    }
    this.later.push({ t: 0.12, fn: () => { if (!m.dead && m.stun <= 0) this.hurtHero(atk, m); } });
    this.ev.emit('mobSwing', m);
  }
  bossSkill(m, k) {
    const tele = (t, fn, kind) => { m.tele = { k: kind || k, t }; this.ev.emit('telegraph', m, kind || k); this.later.push({ t, fn: () => { m.tele = null; if (!m.dead && m.stun <= 0) fn(); } }); };
    this.ev.emit('bossSkill', m, k);
    switch (k) {
      case 'slam': tele(0.8, () => { this.ev.emit('fx', 'slam', m); this.hurtHero(m.atk * 2.5, m, { kind: 'slam' }); }); return 6.5;
      case 'split': return 99;
      case 'roots': tele(0.6, () => { this.debuff.slow = 2.2; this.debuff.slowMul = 0.5; this.ev.emit('fx', 'roots'); this.hurtHero(m.atk * 0.6, m); }); return 8;
      case 'drain': m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.05); this.ev.emit('fx', 'drain', m); return 10;
      case 'venom': tele(0.5, () => { this.hurtHero(m.atk * 1.2, m); for (let i = 1; i <= 3; i++) this.later.push({ t: i, fn: () => { if (!m.dead) this.hurtHero(m.atk * 0.3, m, { noThorns: true, kind: 'poison' }); } }); }); return 7;
      case 'flurry': for (let i = 0; i < 3; i++) this.later.push({ t: 0.25 + i * 0.18, fn: () => { if (!m.dead && m.stun <= 0) { this.ev.emit('mobSwing', m); this.hurtHero(m.atk * 0.8, m); } } }); return 7;
      case 'howl': tele(0.7, () => { this.debuff.slow = 4; this.debuff.slowMul = 0.7; this.ev.emit('fx', 'howl', m); }); return 9;
      case 'pack': case 'legion': return 99;
      case 'erupt': tele(0.7, () => { for (let i = 0; i < 3; i++) this.later.push({ t: i * 0.2, fn: () => { if (m.dead) return; const sh = { x: m.x - 20, y: 34, vx: -150, dmg: m.atk * 1.2, src: m, kind: 'lava', arc: 1 }; this.shots.push(sh); this.ev.emit('shot', sh); } }); }); return 8;
      case 'harden': m.harden = 4; this.ev.emit('fx', 'harden', m); return 12;
      case 'wisps': for (let i = 0; i < 2; i++) this.addMob('wisp', m.x - 20 + i * 30, { summoned: true }); this.ev.emit('fx', 'summon', m); return 10;
      case 'curse': tele(0.6, () => { this.debuff.curse = 5; this.ev.emit('fx', 'curse'); }); return 9;
      case 'spike': tele(0.8, () => { this.ev.emit('fx', 'spike', m); this.hurtHero(m.atk * 3, m, { kind: 'slam' }); }); return 7;
      case 'web': tele(0.5, () => { this.debuff.slow = 3; this.debuff.slowMul = 0.6; this.ev.emit('fx', 'web'); }); return 10;
      case 'bolt': tele(0.9, () => { this.ev.emit('fx', 'bolt'); this.hurtHero(m.atk * 3, m, { kind: 'bolt' }); }); return 6;
      case 'dive': tele(0.6, () => { this.ev.emit('fx', 'dive', m); this.hurtHero(m.atk * 2, m, { kind: 'slam' }); }); return 8;
      case 'rift': tele(0.9, () => { this.ev.emit('fx', 'rift', m); this.hurtHero(m.atk * 3.2, m, { kind: 'slam' }); }); return 7;
      case 'darkbeam': tele(0.6, () => { this.ev.emit('fx', 'darkbeam', m); for (let i = 0; i < 5; i++) this.later.push({ t: i * 0.3, fn: () => { if (!m.dead && m.stun <= 0) this.hurtHero(m.atk * 0.7, m, { kind: 'bolt', noThorns: i > 0 }); } }); }); return 9;
    }
    return 8;
  }
  bossThresholds(m) {
    const r = m.hp / m.maxHp, sk = m.d.skills;
    const call = (type, n, gap = 22) => { for (let i = 0; i < n; i++) this.addMob(type, m.x + 16 + i * gap, { summoned: true }); this.ev.emit('fx', 'summon', m); };
    if (sk.includes('split') && !m.phase2 && r < 0.5) { m.phase2 = true; call('slime', 2); }
    if (sk.includes('pack')) {
      if (!m.phase2 && r < 0.6) { m.phase2 = true; call('wolf', 2, 24); }
      if (!m.phase3 && r < 0.3) { m.phase3 = true; call('wolf', 2, 24); }
    }
    if (sk.includes('legion')) {
      if (!m.phase2 && r < 0.6) { m.phase2 = true; call('demonling', 2); }
      if (!m.phase3 && r < 0.3) { m.phase3 = true; call('darkknight', 1); call('demonling', 1); }
    }
  }

  // ---------- step ----------
  step(dt) {
    this.t += dt;
    const s = this.s, h = this.hero, S = this.S;
    s.stats.play += dt;
    // scheduled actions
    if (this.later.length) {
      const due = [];
      for (const a of this.later) { a.t -= dt; if (a.t <= 0) due.push(a); }
      if (due.length) { this.later = this.later.filter(a => a.t > 0); for (const a of due) a.fn(); }
    }
    if ((this.achT += dt) >= 2) { this.achT = 0; checkAch(s, this.ev); }
    // buffs / debuffs
    for (const k in this.buffs) if (this.buffs[k] > 0) this.buffs[k] = Math.max(0, this.buffs[k] - dt);
    for (const k in this.prism) if (this.prism[k] > 0) this.prism[k] -= dt;
    if (this.debuff.slow > 0) this.debuff.slow = Math.max(0, this.debuff.slow - dt);
    if (this.debuff.curse > 0) this.debuff.curse = Math.max(0, this.debuff.curse - dt);
    if (this.buffs.aegis <= 0 && h.shield > 0 && !S.lg.pact && !S.lg.bulwark) h.shield = Math.max(0, h.shield - S.maxHp * dt * 0.5);
    h.inv = Math.max(0, h.inv - dt); h.hurt = Math.max(0, h.hurt - dt); h.cast = Math.max(0, h.cast - dt); h.spin = Math.max(0, h.spin - dt);
    if (h.swing > 0) { h.swingT += dt; if (h.swingT > 0.3) h.swing = 0; }
    // mine clock
    if (this.mode.kind === 'mine') {
      this.mode.t -= dt;
      if (this.mode.t <= 0) { this.endMode(); return; }
      if (this.alive().length < 5 && this.rng.chance(dt * 2.2)) this.spawnMine(170 + this.rng.int(0, 150));
    }
    // hunter down?
    if (h.down > 0) {
      h.down -= dt;
      if (h.down <= 0) { h.down = 0; if (h.hp <= 0) this.afterDown(); }
      this.stepMobs(dt, false);
      return;
    }
    if (!this.frail()) h.hp = Math.min(S.maxHp, h.hp + S.regen * S.maxHp * dt);
    if (this.buffs.prayer > 0) this.heal(this.prayerHps * dt, false);

    const f = this.front();
    if (this.phase === 'march') {
      this.phaseT += dt;
      const sp = RUN_SPEED * (1 + S.runSpeed) * dt;
      for (const m of this.mobs) m.x -= sp;
      for (const z of this.zones) z.x -= sp;
      if (!f || f.x <= Math.max(ENGAGE_AT, Math.min(S.reach, 175))) {
        this.phase = 'fight'; this.phaseT = 0;
        if (this.boss) this.ev.emit('bossStart', this.boss);
      }
      return;
    }
    if (this.phase === 'clear') { this.phaseT += dt; this.stepMobs(dt, false); this.stepArrows(dt); return; }

    // fight
    this.phaseT += dt;
    if (this.boss && !this.boss.dead) {
      this.bossT -= dt; this.bossClock += dt;
      if (this.bossT <= 0) { this.bossT = 0; this.bossFail('time'); return; }
    }
    if (h.pending) { h.pending.t -= dt; if (h.pending.t <= 0) { const m = h.pending.m; h.pending = null; this.strike(m); } }
    // walk up to targets that hold back (archers, rooted or slow walkers)
    h.walking = false;
    if (f && !this.inReach(f) && !h.pending && h.spin <= 0) {
      const sp = WALK_SPEED * (1 + S.runSpeed) * dt;
      for (const m of this.mobs) m.x -= sp;
      for (const z of this.zones) z.x -= sp;
      for (const sh of this.shots) sh.x -= sp;
      h.walking = true;
    }
    // auto attack (a spinning hunter keeps spinning)
    h.atkT -= dt;
    if (h.atkT <= 0) {
      if (f && this.inReach(f) && !h.pending && h.spin <= 0) { this.attack(f); h.atkT += 1 / this.aspdNow(); }
      else h.atkT = 0;
    }
    // hydra heads
    if (this.buffs.hydra > 0) {
      h.hydraT -= dt;
      if (h.hydraT <= 0) {
        const heads = 1 + (S.lg.hydraking ? 2 : 0);
        h.hydraT = 0.5 / heads;
        const t = this.front();
        if (t && t.x < 220) this.fire(t, { kind: 'hydra', spd: 320, elem: 'fire', mult: this.hydraMul, opt: { skill: true, kind: 'skill', elem: 'fire' } });
      }
    }
    // skills
    const n = Math.min(4, S.skillSlots);
    for (let i = 0; i < n; i++) {
      const id = s.skills.slots[i];
      if (!id || !skillUsable(s, id)) continue;
      this.cds[id] = Math.max(0, (this.cds[id] || 0) - dt);
      if (this.cds[id] <= 0 && this.castReady(id)) { this.cast(id); this.cds[id] = SKILLS[id].cd * (1 - S.cdr); }
    }
    this.stepMobs(dt, true);
    // the hunter's snares
    for (const z of this.zones) {
      z.t -= dt; z.cd -= dt;
      if (z.cd > 0) continue;
      for (const m of this.alive()) if (!m.y && Math.abs(m.x - z.x) < 10 && z.n > 0) {
        z.n--; z.cd = 0.25; this.ev.emit('fx', 'snap', z);
        this.hit(m, z.mul, z.o);
        if (!m.dead) m.root = 2;
        break;
      }
    }
    this.zones = this.zones.filter(z => z.t > 0 && z.n > 0);
    this.stepArrows(dt);
    // monster projectiles
    for (const sh of this.shots) {
      sh.x += sh.vx * dt;
      if (sh.x <= 6) { sh.done = true; this.hurtHero(sh.dmg, sh.src && !sh.src.dead ? sh.src : null, { kind: 'shot' }); }
    }
    this.shots = this.shots.filter(sh => !sh.done);
    // wave over?
    if (this.phase === 'fight' && this.mode.kind !== 'mine' && !this.alive().length) {
      if (this.boss && !this.boss.dead) return;
      if (!this.boss) this.waveCleared();
    }
  }
  stepArrows(dt) {
    for (const a of this.arrows) {
      let m = a.tgt;
      if (!m || m.dead) { m = a.tgt = this.front(); if (!m) { a.done = true; continue; } }
      a.x += a.spd * dt;
      if (a.x >= m.x - m.w / 3) {
        a.done = true;
        if (a.onHit) a.onHit(m);
        else if (a.basic) this.rangedImpact(m, a);
        else this.hit(m, a.mult, a.opt);
      }
    }
    if (this.arrows.length) this.arrows = this.arrows.filter(a => !a.done);
  }
  stepMobs(dt, active) {
    const h = this.hero;
    // ground monsters queue behind each other; fliers drift freely
    const ground = this.mobs.filter(m => !m.dead && !m.y).sort((a, b) => a.x - b.x);
    let prev = null;
    for (const m of ground) {
      m.stopX = m.d.rng && !m.boss ? m.d.rng : 18 + m.w / 2;
      if (prev) m.stopX = Math.max(m.stopX, prev.x + (prev.w + m.w) / 2 - 2);
      prev = m;
    }
    for (const m of this.mobs) {
      if (m.dead) { m.deathT += dt; continue; }
      m.flash = Math.max(0, m.flash - dt);
      m.act = Math.max(0, m.act - dt);
      m.bob += dt;
      if (m.burn > 0) {
        m.burn -= dt;
        m.burnTick = (m.burnTick || 0) + dt;
        if (m.burnTick >= 0.5) { m.burnTick = 0; this.hit(m, 1, { base: m.burnDps * 0.5, pure: true, kind: 'burn', noCrit: true, elem: 'fire' }); if (m.dead) continue; }
      }
      if (m.champ && m.champ.aura === 'vigor') m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.02 * dt);
      if (m.harden > 0) m.harden -= dt;
      if (m.stun > 0) { m.stun -= dt; continue; }
      if (!active) continue;
      if (m.d.flee && m.flee > 0) {
        m.flee -= dt; m.x += 46 * dt;
        if (m.x > 400) { m.dead = true; m.escaped = true; m.deathT = 1; this.ev.emit('escape', m); }
        continue;
      }
      const stop = m.y ? (m.d.rng || 18 + m.w / 2) : m.stopX;
      if (m.root > 0) m.root -= dt;
      else if (m.x > stop) m.x = Math.max(stop, m.x - m.spd * dt * (m.boss ? 1.4 : 1));
      if (m.boss) {
        this.bossThresholds(m);
        for (const k in m.sk) { if (m.tele) break; m.sk[k] -= dt; if (m.sk[k] <= 0 && m.x <= stop + 4) m.sk[k] = this.bossSkill(m, k); }
      }
      if (m.champ && m.champ.aura === 'arcane' && m.x < 260) {
        m.arcT -= dt;
        if (m.arcT <= 0) {
          m.arcT = 6; m.tele = { k: 'arcane', t: 0.5 }; this.ev.emit('telegraph', m, 'arcane');
          this.later.push({ t: 0.5, fn: () => { m.tele = null; if (!m.dead && m.stun <= 0) { this.ev.emit('fx', 'arcane', m); this.hurtHero(m.atk * 2, m, { kind: 'bolt' }); } } });
        }
      }
      if (m.d.atk === 0 || m.flee > 0) continue;
      const reach = m.d.rng && !m.boss ? m.d.rng + 4 : 22 + m.w / 2;
      if (m.x <= reach && !m.tele) {
        m.atkT -= dt;
        if (m.atkT <= 0 && h.down <= 0) { m.atkT = m.cd * (0.9 + this.rng.next() * 0.2); this.mobAttack(m); }
      }
    }
    // let corpses linger long enough for the death animation
    if (this.mobs.length > 16 || this.mobs.some(m => m.dead && m.deathT > 1.2)) this.mobs = this.mobs.filter(m => !m.dead || m.deathT <= 1.2);
  }
}

// ---------- the guild's bounty board ----------
const Board = (() => {
  function rollReward(s, rng) {
    const d = topDiff(s), L = topLevel(s), r = rng.next();
    if (r < 0.3) return { wanted: 1 + (rng.chance(0.3) ? 1 : 0) };
    if (r < 0.6) return { chest: [rng.chance(0.25) ? 2 : 1, 1 + rng.int(0, 1)] };
    if (r < 0.8) return { mat: [`gem_${rng.pick(GEM_IDS)}_${clamp(d * 2 + rng.int(0, 1), 0, 9)}`, 2 + rng.int(0, 2)] };
    return { gold: Math.ceil(600 * CURVE.gold(L) * DIFFS[d].gold) };
  }
  function make(s, rng) {
    const k = rng.pick(CONTRACT_IDS), c = { k, p: 0, done: false, claimed: false };
    c.goal = CONTRACTS[k].goal(rng);
    if (k === 'hunt') { const d = topDiff(s), i = Math.min(FULL - 1, s.prog.best[d]); c.mob = rng.pick(ACTS[Math.floor(i / STAGES)].mobs); }
    c.rw = rollReward(s, rng);
    return c;
  }
  function refresh(s, now = Date.now(), force = false) {
    if (!modeOpen(s, 'board')) return false;
    const period = MODES.board.refreshH * 3600e3;
    if (!force && s.board.list.length && now - s.board.t < period) return false;
    const rng = RNG((s.seed + Math.floor(now / period)) >>> 0);
    s.board.t = now;
    s.board.list = [0, 1, 2].map(() => make(s, rng));
    return true;
  }
  function progress(s, kind, arg, n = 1) {
    for (const c of s.board.list) {
      if (c.done || c.k !== kind) continue;
      if (kind === 'hunt' && arg !== c.mob) continue;
      c.p = Math.min(c.goal, c.p + n);
      if (c.p >= c.goal) c.done = true;
    }
  }
  function claim(s, i, ev) {
    const c = s.board.list[i];
    if (!c || !c.done || c.claimed) return false;
    c.claimed = true; s.board.done++;
    Loot.grant(s, c.rw, ev);
    return true;
  }
  const rewardText = rw => rw.wanted ? `通缉令 ×${rw.wanted}` : rw.chest ? `${CHESTS[rw.chest[0]].name} ×${rw.chest[1]}` : rw.mat ? `${MATS[rw.mat[0]].name} ×${rw.mat[1]}` : `${fmt(rw.gold || 0)} 金币`;
  return { refresh, progress, claim, rewardText };
})();

// run a quiet copy of the hunter on the current stage to measure income per second
function measureRates(save, seconds = 90) {
  const copy = normalizeSave(JSON.parse(JSON.stringify(save)));
  copy.prog.farm = true; copy.prog.auto = false; copy.opts.autoEquip = 0; copy.opts.autoSkill = 0;
  if (copy.prog.s === STAGES) copy.prog.s = STAGES - 1;
  copy.tray = []; copy.inv = [];
  delete copy.runes.autoN; delete copy.runes.autoB; delete copy.runes.autoalch;
  const b = new Battle(copy, { headless: true, seed: 12345 });
  const g0 = copy.gold, k0 = copy.stats.kills;
  const chests = [0, 0, 0];
  let exp = 0;
  b.ev.on('chestDrop', ch => chests[ch.k]++);
  b.ev.on('exp', x => (exp += x));
  const n = Math.round(seconds / STEP);
  for (let i = 0; i < n; i++) b.step(STEP);
  return {
    gold: (copy.gold - g0) / seconds, exp: exp / seconds, kills: (copy.stats.kills - k0) / seconds,
    chests: chests.map(c => c / seconds), d: copy.prog.d, a: copy.prog.a, s: copy.prog.s,
  };
}
