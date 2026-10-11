'use strict';
// =====================================================================
//  BATTLE — the auto-fight simulation. World x is measured from the
//  front of the formation (x = 0, looking right); the second and third
//  heroes stand behind it. y is height above the ground.
//  Pure logic: renderers and sound subscribe to its events.
// =====================================================================
const RUN_SPEED = 230, WALK_SPEED = 70;
const SPAWN_AT = 480, SPAWN_GAP = 26, ENGAGE_AT = 150;
const BOSS_W = 52, SLOT_X = [0, -22, -44];
const MOB_W = {
  slime: 16, bigslime: 24, rabbit: 16, wasp: 14, gobthief: 18, gobarcher: 18, gobshaman: 18, goblin: 22, shroom: 16, bat: 16, sapling: 18, spiderling: 18,
  fox: 20, troll: 26, scorpion: 22, cobra: 18, mummy: 20, mummypriest: 20, rat: 18, ratbomber: 18, scarab: 14, cactus: 18, wolf: 28, yeti: 26, wisp: 12,
  skeleton: 18, penguin: 16, bear: 28, ghost: 18, zombie: 20, ghoul: 20, skelarcher: 18, frogman: 20, golem: 26, mole: 20, minegob: 20, imp: 16,
  salamander: 28, demon: 24, worm: 26, harpy: 24, hawk: 22, gargoyle: 24, knight: 22, eye: 22, drake: 30, cultist: 20,
};
const ELEM_STATUS = { fire: 'ignite', cold: 'chill', lightning: 'shock', chaos: null, phys: null };

class Battle {
  constructor(save, o = {}) {
    this.s = save;
    this.headless = !!o.headless;
    this.rng = RNG(o.seed ?? ((save.seed ^ (Date.now() & 0x7fffffff)) >>> 0));
    this.ev = Emitter();
    this.mobs = []; this.shots = []; this.arrows = []; this.zones = []; this.summons = []; this.later = [];
    this.t = 0; this.uid = 1; this.achT = 0; this.openT = 0; this.wipeT = 0;
    this.team = [];
    this.buffs = { aegis: 0, sanct: 0, cry: 0 }; this.sanctHps = 0; this.cryV = 0;
    this.debuff = { slow: 0, slowMul: 1, curse: 0 };
    this.phase = 'march'; this.phaseT = 0;
    this.bossT = 0; this.bossMax = 0; this.boss = null; this.bossClock = 0;
    this.where = { d: 0, a: 1, s: 1, L: 1 };
    this.danger = { hp: 1, atk: 1 };
    this.recalc(true);
    this.startStage();
  }

  // ---------- the party ----------
  newMember(cls) {
    return { cls, S: null, slot: 0, x: 0, hp: 1, shield: 0, atkT: 0.2 + this.rng.next() * 0.3, down: false, swing: 0, swingT: 0, cast: 0, hurt: 0, count: 0, spin: 0,
      pending: null, inv: 0, cds: {}, acts: [], b: { blade: 0, swift: 0, quick: 0, blood: 0, wrath: 0 }, bladeV: 0, swiftV: 0, bloodV: 0, wrathMul: 0,
      will: false, phoenix: false, undying: false, prism: {}, focus: new Set(), lunge: 0 };
  }
  recalc(full) {
    const s = this.s, list = partyList(s), A = acctStats(s), aura = partyAura(s, list), n = skillSlots(s);
    this.A = A;
    const old = new Map(this.team.map(h => [h.cls, h]));
    this.team = list.map((cls, i) => {
      const S = heroStats(s, cls, { acct: A, aura });
      let h = old.get(cls);
      if (!h) { h = this.newMember(cls); h.hp = S.maxHp; }
      else h.hp = full ? S.maxHp : clamp(h.hp / h.S.maxHp, 0, 1) * S.maxHp;
      if (full) { h.down = false; h.shield = 0; }
      h.S = S; h.slot = i; h.x = SLOT_X[i];
      h.acts = s.heroes[cls].act.slice(0, n).filter(id => id && s.heroes[cls].sk[id]);
      for (const id of h.acts) if (h.cds[id] === undefined) h.cds[id] = 1.2 + i * 0.4;
      return h;
    });
    this.P = partyStats(s, this.team.map(h => h.S), A);
  }
  get L() { return this.where.L; }
  living() { return this.team.filter(h => !h.down); }
  frontHero() { return this.team.find(h => !h.down) || null; }
  backHero() { const l = this.living(); return l[l.length - 1] || null; }
  frontX() { const f = this.frontHero(); return f ? f.x : 0; }
  heroById(cls) { return this.team.find(h => h.cls === cls) || null; }
  aspdOf(h) {
    let p = h.S.aspdPct;
    if (h.b.swift > 0) p += h.swiftV;
    if (h.b.quick > 0) p += 0.5;
    let a = Math.min(ASPD_CAP, Math.max(0.25, h.S.aspdBase * (1 + p)));
    if (this.debuff.slow > 0) a *= this.debuff.slowMul;
    return a;
  }
  armOf(h) { return h.S.arm; }
  // the first regions of 普通 are gentler so a brand-new hero learns the ropes
  soft(d, L) { return d === 0 ? 0.3 + 0.7 * Math.min(1, (L - 1) / 12) : 1; }

  // ---------- stages and waves ----------
  bossAccess(d, a) { return !stageCleared(this.s, d, a, STAGES) || Loot.hasMat(this.s, `stone${d}`); }
  startStage() {
    const P = this.s.prog;
    P.w = 1;
    for (const h of this.team) { h.will = false; h.phoenix = false; h.down = false; h.hp = h.S.maxHp; h.shield = 0; }
    if (P.s === STAGES && !this.bossAccess(P.d, P.a)) {
      P.s = STAGES - 1; P.farm = true; P.auto = true; P.clears = 0;
      this.ev.emit('needStone', P.d);
    }
    const dg = stageDanger(P.a, P.s);
    this.danger = { hp: dg, atk: 1 + (dg - 1) / 2 };
    this.ev.emit('stage', P.d, P.a, P.s);
    this.startWave();
  }
  clearField() {
    this.mobs = []; this.shots = []; this.arrows = []; this.zones = []; this.summons = []; this.boss = null;
    for (const h of this.team) { h.undying = false; h.spin = 0; h.pending = null; }
    this.phase = 'march'; this.phaseT = 0;
  }
  // waves of a stage after 简短; the last wave is the stage boss
  wavePlan() {
    const P = this.s.prog, W = stageWaves(P.d, P.a, P.s);
    if (P.s === STAGES) return { waves: 1, kills: 1 };
    const cut = Math.min(Math.max(0, W.waves - 3), Math.round(this.A.brevity || 0));
    const waves = W.waves - cut;
    return { waves, kills: Math.max(waves - 1, Math.round(W.kills * waves / W.waves)) };
  }
  waveSize(w, plan) { const m = plan.waves - 1, k = plan.kills; return Math.max(1, Math.floor(k * w / m) - Math.floor(k * (w - 1) / m)); }
  startWave() {
    this.clearField();
    for (const h of this.team) if (h.down) { h.down = false; h.hp = h.S.maxHp * 0.3; h.inv = 1; this.ev.emit('revive', h); }
    const P = this.s.prog, def = stageDef(P.a, P.s);
    this.where = { d: P.d, a: P.a, s: P.s, L: stageLevel(P.d, P.a, P.s) };
    this.bossWave = false;
    if (P.s === STAGES) { this.spawnBoss(def.boss.id, 'act'); return; }
    const plan = this.wavePlan();
    this.bossWave = P.w >= plan.waves;
    if (this.bossWave) this.spawnStageBoss(def);
    else this.spawnWave(def, this.waveSize(P.w, plan), P.w >= 3 ? ELITE_CHANCE : 0);
    this.ev.emit('wave', P.w, plan.waves);
  }
  spawnWave(def, n, elite) {
    for (let i = 0; i < n; i++) this.addMob(this.rng.pick(def.mobs), SPAWN_AT + i * SPAWN_GAP + this.rng.int(0, 8), { elite: this.rng.chance(elite) });
  }
  spawnStageBoss(def) {
    const B = def.boss;
    if (B.kind === 'boss') { this.spawnBoss(B.id, 'stage'); return; }
    for (let i = 0; i < 2; i++) this.addMob(this.rng.pick(def.mobs), SPAWN_AT + i * SPAWN_GAP);
    const c = this.addMob(B.mob, SPAWN_AT + 2 * SPAWN_GAP + 14, { champ: { name: B.name, aura: B.aura, key: B.key } });
    if (B.aura === 'rally') for (let i = 0; i < 2; i++) this.addMob(B.mob, c.x + 24 + i * 22, { summoned: true });
    this.ev.emit('champ', c);
  }
  addMob(type, x, o = {}) {
    const T = MONSTERS[type], { d, L } = this.where, D = DIFFS[d], soft = this.soft(d, L);
    const k = o.elite ? ELITE : o.champ ? CHAMP : null, aura = o.champ ? o.champ.aura : null;
    const quick = aura === 'swift' ? 1.4 : 1;
    const m = {
      id: this.uid++, type, d: T, fam: FAMILIES[T.fam], boss: false, elite: !!o.elite, champ: o.champ || null, L, x, y: T.fly || 0, w: (T.w || MOB_W[T.spr] || 18) + (o.champ ? 4 : 0),
      maxHp: CURVE.hp(L) * T.hp * D.hp * (k ? k.hp : 1) * soft * this.danger.hp,
      atk: CURVE.atk(L) * T.atk * D.atk * (k ? k.atk : 1) * soft * this.danger.atk,
      dfn: CURVE.def(L) * T.def * (aura === 'stone' ? 3 : 1),
      spd: T.spd * quick, cd: T.cd / quick, elem: T.elem,
      gold: CURVE.gold(L) * T.gold * D.gold * (k ? k.gold : 1), exp: CURVE.exp(L) * T.exp * D.exp * (k ? k.exp : 1),
      atkT: 0.6 + this.rng.next() * 0.6, stun: 0, root: 0, chill: 0, shock: 0, frozen: 0, burn: 0, burnDps: 0, bleed: 0, bleedDps: 0, dotT: 0, skewer: 0,
      flash: 0, dead: false, deathT: 0, act: 0, bob: this.rng.next() * TAU, summoned: !!o.summoned, arcT: 6, tele: null,
    };
    if (o.summoned) { m.gold *= 0.5; m.exp *= 0.5; }
    m.hp = m.maxHp;
    this.mobs.push(m);
    this.ev.emit('spawn', m);
    return m;
  }
  // kind: 'stage' (X-3, X-6 stage bosses) or 'act' (X-10, needs a 通缉令 after the first win)
  spawnBoss(id, kind) {
    const b = BOSSES[id], { d, L } = this.where, D = DIFFS[d], soft = this.soft(d, L), M = kind === 'act' ? ACT_BOSS_MUL : BOSS_MUL;
    const m = {
      id: this.uid++, type: id, d: b, fam: FAMILIES[b.fam], boss: true, bossKind: kind, elite: false, champ: null, L, x: SPAWN_AT + 20, y: 0, w: BOSS_W,
      maxHp: CURVE.hp(L) * M.hp * b.hp * D.hp * soft * this.danger.hp,
      atk: CURVE.atk(L) * M.atk * b.atk * D.atk * soft * this.danger.atk,
      dfn: CURVE.def(L) * M.def * b.def, spd: 34, cd: b.cd, elem: 'phys',
      gold: CURVE.gold(L) * M.gold * D.gold, exp: CURVE.exp(L) * M.exp * D.exp,
      atkT: 1.2, stun: 0, root: 0, chill: 0, shock: 0, frozen: 0, burn: 0, burnDps: 0, bleed: 0, bleedDps: 0, dotT: 0, skewer: 0,
      flash: 0, dead: false, deathT: 0, act: 0, bob: 0, sk: {}, tele: null, harden: 0, phase2: false, phase3: false,
    };
    for (const k of b.skills) m.sk[k] = 3 + this.rng.next() * 2;
    m.hp = m.maxHp;
    this.mobs.push(m);
    this.boss = m;
    this.bossMax = kind === 'act' ? Math.max(10, (b.time || 60) + this.P.bossTime) : 0;
    this.bossT = this.bossMax; this.bossClock = 0;
    const bounty = m.gold * this.P.gold * (1 + this.A.bossGold) * (this.P.lg.bounty ? 2 : 1);
    if (kind === 'act') this.ev.emit('bossIntro', m, bounty);
    else this.ev.emit('stageBoss', m);
  }

  // ---------- damage ----------
  dmgTo(h, m, mult, o) {
    const S = h.S;
    const atk = (o.base ?? S.atk) * (this.debuff.curse > 0 ? 0.75 : 1) * (h.b.blade > 0 ? 1 + h.bladeV : 1) * (h.b.blood > 0 ? 1 + h.bloodV : 1);
    const def = m.dfn * (m.harden > 0 ? 3 : 1) * (S.lg.sunder ? 0.4 : 1);
    let dmg = (o.pure ? atk : atk * defMul(atk, def)) * mult;
    if (o.skill) dmg *= S.skill;
    if (o.aoe) dmg *= S.aoeDmg;
    if (o.proj) dmg *= S.proj;
    const elem = o.elem || S.elem;
    dmg *= S.el[elem];
    if (m.fam) { if (m.fam.weak === elem) dmg *= WEAK_MUL; else if (m.fam.resist === elem) dmg *= RESIST_MUL; }
    if (m.shock > 0) dmg *= 1.15;
    if (m.stun > 0) dmg *= 1.1;
    if (m.skewer && h.cls === 'ranger') dmg *= 1 + 0.1 * Math.min(10, m.skewer);
    if (m.boss && S.lg.verdict) dmg *= 1 + 0.6 * S.lg.verdict;
    if (S.lg.prism) {
      h.prism[elem] = 5;
      let n = 0; for (const k in h.prism) if (h.prism[k] > 0) n++;
      dmg *= 1 + 0.06 * S.lg.prism * Math.min(5, n);
    }
    if (m.champ) {
      if (m.champ.aura === 'stone') dmg *= 0.75;
      if (m.champ.aura === 'ward' && this.mobs.some(x => !x.dead && x !== m)) dmg *= 0.5;
    }
    let crit = false;
    if (!o.noCrit) {
      if (S.lg.focus && !h.focus.has(m.id)) { h.focus.add(m.id); crit = true; }
      else crit = this.rng.next() < S.crit + (o.critAdd || 0);
    }
    if (crit) dmg *= S.cdmg + (this.buffs.cry > 0 ? this.cryV : 0);
    return { dmg, crit, elem };
  }
  hit(h, m, mult, o = {}) {
    if (!m || m.dead || !h) return 0;
    let { dmg, crit, elem } = this.dmgTo(h, m, mult, o);
    const kind = o.kind || 'atk';
    if (m.d.block && this.rng.chance(m.d.block)) { dmg *= 0.4; this.ev.emit('fx', 'mobBlock', m); }
    m.hp -= dmg; m.flash = 2 / 60;
    this.ev.emit('hit', m, dmg, crit, kind, elem, h);
    const S = h.S;
    if (crit) {
      this.s.stats.crits++;
      this.ev.emit('crit', m, kind);
      if (S.lg.sand) for (const id in h.cds) h.cds[id] = Math.max(0, h.cds[id] - 0.25 * S.lg.sand);
      if (S.lg.thunderclap && kind === 'atk') {
        this.ev.emit('fx', 'boom', m);
        for (const x of this.alive()) if (x !== m && Math.abs(x.x - m.x) < 40) this.hit(h, x, 0.5 * S.lg.thunderclap, { kind: 'proc', noCrit: true });
      }
    }
    // statuses
    if (!m.dead) {
      const st = o.status || (kind === 'atk' && ELEM_STATUS[elem] && this.rng.chance(0.15) ? ELEM_STATUS[elem] : null);
      if (st) this.applyStatus(m, st, dmg, o);
      if (o.stun) m.stun = Math.max(m.stun, o.stun);
    }
    if (kind === 'atk' || kind === 'skill') {
      if (S.ls > 0) this.heal(h, dmg * S.ls, true);
      if (S.hpHit > 0) this.heal(h, S.maxHp * S.hpHit, true);
      if (h.b.blade > 0) this.heal(h, S.maxHp * 0.01, true);
    }
    if (m.champ && m.champ.aura === 'thorny' && kind !== 'burn') this.hurtHero(this.frontHero(), dmg * 0.05, null, { pure: true, kind: 'thorns' });
    if (m.hp <= 0) this.kill(m, h);
    return dmg;
  }
  applyStatus(m, st, dmg, o = {}) {
    if (st === 'ignite') { m.burn = 4; m.burnDps = Math.max(m.burnDps, dmg * 0.25); }
    else if (st === 'chill') m.chill = Math.max(m.chill, 3);
    else if (st === 'freeze') { if (!m.boss) { m.stun = Math.max(m.stun, o.freeze || 1.5); m.frozen = Math.max(m.frozen, o.freeze || 1.5); } else m.chill = Math.max(m.chill, 3); }
    else if (st === 'shock') m.shock = Math.max(m.shock, 6);
    else if (st === 'bleed') { m.bleed = 5; m.bleedDps = Math.max(m.bleedDps, dmg * 0.12); }
  }
  // damage over time skips hero stats: it was settled when the status landed
  tick(m, amount, kind, elem) {
    if (m.dead || amount <= 0) return;
    m.hp -= amount;
    this.ev.emit('hit', m, amount, false, kind, elem, null);
    if (m.hp <= 0) this.kill(m, null);
  }
  heal(h, amt, steal) {
    if (!h || amt <= 0 || h.down) return;
    const room = h.S.maxHp - h.hp;
    if (amt <= room) { h.hp += amt; return; }
    h.hp = h.S.maxHp;
    if (h.S.lg.pact) h.shield = Math.min(h.S.maxHp * 0.3 * h.S.lg.pact, h.shield + (amt - room));
  }
  // TBH order: dodge → block (half) → resistance or armor → damage reduction → absorption
  hurtHero(h, raw, src, o = {}) {
    if (!h || h.down || h.inv > 0) return;
    const S = h.S, elem = o.elem || 'phys';
    if (!o.pure && S.dodge > 0 && this.rng.chance(S.dodge)) { this.ev.emit('dodge', h); return; }
    let dmg = raw, blocked = false;
    if (!o.pure && S.block > 0 && this.rng.chance(S.block)) {
      blocked = true; dmg *= 0.5;
      this.ev.emit('block', h);
      if (S.lg.bulwark) h.shield = Math.min(S.maxHp * 0.5, h.shield + S.maxHp * 0.05 * S.lg.bulwark);
      if (S.lg.kingshield && src && !src.dead) this.hit(h, src, S.lg.kingshield, { kind: 'atk' });
    }
    if (!o.pure) {
      dmg *= elem === 'phys' ? armMul(this.armOf(h), raw) : 1 - (S.res[elem] || 0);
      dmg *= 1 - S.dr;
      dmg = Math.max(dmg * 0.1, dmg - S.absorb * S.maxHp);
    }
    if (h.shield > 0) { const a = Math.min(h.shield, dmg); h.shield -= a; dmg -= a; }
    h.hp -= dmg; h.hurt = 0.14;
    this.ev.emit('hurt', h, dmg, src, o.kind || 'melee', blocked);
    if (src && !src.dead && src.d.drain) src.hp = Math.min(src.maxHp, src.hp + dmg * src.d.drain);
    if (src && !src.dead && src.champ && src.champ.aura === 'vampiric') src.hp = Math.min(src.maxHp, src.hp + dmg * 3);
    if (S.lg.crown && src && !src.dead && o.kind !== 'thorns') this.hit(h, src, S.lg.crown, { kind: 'thorns' });
    if (h.hp <= 0) {
      if (S.lg.undying && !h.undying) { h.undying = true; h.hp = 1; h.inv = 2; this.ev.emit('undying', h); return; }
      if (h.acts.includes('k_will') && !h.will) {
        h.will = true; h.hp = S.maxHp * lv(ACTIVES.k_will.v, skillLv(this.s, h.cls, 'k_will')); h.inv = 1;
        this.ev.emit('cast', h, 'k_will'); this.ev.emit('fx', 'will', h);
        return;
      }
      this.heroDown(h);
    }
  }

  // ---------- rewards ----------
  payGold(m, base) {
    let g = base * this.P.gold;
    if (m.boss) g *= (1 + this.A.bossGold) * (this.P.lg.bounty ? 2 : 1);
    this.s.gold += g; this.s.stats.gold += g;
    const coins = clamp(Math.round(Math.log2(1 + g / Math.max(1, CURVE.gold(this.L) * this.P.gold))) + 2, 2, m.boss ? 14 : 6);
    if (this.P.lg.midas) for (const h of this.living()) this.heal(h, h.S.maxHp * 0.005 * coins, false);
    this.ev.emit('gold', g, m, coins);
  }
  // every hero in the formation earns the experience; heroes far above the area learn less
  giveExp(x, boss) {
    const s = this.s;
    x *= this.P.exp * (boss ? 1 + this.A.bossExp : 1);
    this.ev.emit('exp', x);
    let up = false;
    for (const h of this.team) if (gainExp(s, h.cls, x * expPenalty(s.heroes[h.cls].lv, this.L), this.ev)) up = true;
    if (up) { this.recalc(); for (const h of this.living()) h.hp = h.S.maxHp; }
  }
  dropChest(m, k) {
    const ch = { k, d: this.where.d, L: Math.max(1, Math.round(this.where.L)), a: this.where.a };
    this.ev.emit('chestDrop', ch, m);
    Loot.addChest(this.s, ch, this.ev);
  }
  kill(m, h) {
    if (m.dead) return;
    m.dead = true; m.deathT = 0;
    const s = this.s;
    s.stats.kills++;
    if (!m.boss) s.codex.m[m.type] = (s.codex.m[m.type] || 0) + 1;
    if (m.elite) s.stats.elites++;
    this.ev.emit('kill', m);
    if (h && h.S.lg.ember) {
      const blast = m.maxHp * 0.4 * h.S.lg.ember;
      this.ev.emit('fx', 'ember', m);
      for (const o of this.mobs) if (!o.dead && o !== m && Math.abs(o.x - m.x) < 60) this.hit(h, o, 1, { base: blast, pure: true, kind: 'ember', noCrit: true });
    }
    if (h && h.S.hpKill) this.heal(h, h.S.maxHp * h.S.hpKill, true);
    this.payGold(m, m.gold);
    this.giveExp(m.exp, m.boss);
    if (m.d.split && !m.summoned) for (let i = 0; i < 2; i++) this.addMob(m.d.split, m.x + 6 + i * 14, { summoned: true });
    if (m.boss) { this.bossDown(m); return; }
    if (m.champ) {
      s.stats.champs++; s.codex.c[m.champ.key] = (s.codex.c[m.champ.key] || 0) + 1;
      this.stageBossChest(m);
    } else if (!m.summoned && this.rng.next() < CHEST_N_BASE * this.P.chestN * (m.elite ? 5 : 1)) this.dropChest(m, 0);
    checkPets(s, this.ev);
  }
  stageBossChest(m) {
    if (this.rng.next() < CHEST_B_BASE[this.where.d] * this.P.chestB) this.dropChest(m, 1);
    if (this.P.lg.bounty && this.rng.chance(0.5)) this.dropChest(m, 1);
  }
  bossDown(m) {
    const s = this.s, time = this.bossClock, d = this.where.d;
    s.stats.bosses++;
    const rec = s.codex.b[m.type] || (s.codex.b[m.type] = DIFFS.map(() => 0));
    if (m.bossKind === 'act') rec[d] = rec[d] ? Math.min(rec[d], time) : Math.max(0.1, time);
    else if (!rec[d]) rec[d] = -1; // stage bosses are marked as met without a time
    this.ev.emit('bossKill', m, time);
    for (const o of this.mobs) if (!o.dead && o.summoned) { o.dead = true; o.deathT = 0; }
    checkPets(s, this.ev);
    if (m.bossKind !== 'act') {
      this.stageBossChest(m);
      // a stage boss that falls before its adds still ends the stage once the field is clear
      return;
    }
    this.dropChest(m, 2);
    if (this.P.lg.bounty) this.dropChest(m, 1);
    const P = s.prog;
    if (stageCleared(s, P.d, P.a, STAGES)) Loot.useMat(s, `stone${P.d}`);
    this.stageClear();
  }
  stageClear() {
    const s = this.s, P = s.prog;
    s.stats.stages++; P.fails = 0;
    let first = false;
    if (stageIndex(P.a, P.s) === s.prog.best[P.d]) {
      s.prog.best[P.d]++; first = true;
      // the first win on X-9 hands over the 通缉令 for the act boss rematch
      if (P.s === STAGES - 1) { Loot.addMat(s, `stone${P.d}`); this.ev.emit('stoneGift', P.d); }
      this.ev.emit('record', P.d, P.a, P.s);
      checkUnlocks(s, this.ev);
      checkPets(s, this.ev);
    }
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
    for (const o of this.mobs) if (!o.dead) { o.dead = true; o.escaped = true; o.deathT = 0; }
    const P = this.s.prog;
    P.s = STAGES - 1; P.farm = true; P.auto = true; P.clears = 0;
    this.phase = 'clear'; this.phaseT = 0;
    this.later.push({ t: 1.2, fn: () => this.startStage() });
  }
  giveUp() {
    this.ev.emit('stall');
    for (const o of this.mobs) if (!o.dead) { o.dead = true; o.escaped = true; o.deathT = 0; }
    const P = this.s.prog;
    if (++P.fails >= 2) this.retreat();
    this.phase = 'clear'; this.phaseT = 0;
    this.later.push({ t: 1.2, fn: () => this.startStage() });
  }
  heroDown(h) {
    h.hp = 0; h.down = true; h.shield = 0; h.spin = 0; h.pending = null;
    this.s.stats.deaths++;
    this.ev.emit('down', h);
    if (h.S.lg.phoenix && !h.phoenix) {
      h.phoenix = true;
      this.later.push({ t: 0.9, fn: () => { if (!h.down || !this.team.includes(h)) return; h.down = false; h.hp = h.S.maxHp * 0.4 * h.S.lg.phoenix; h.inv = 1.5; this.ev.emit('revive', h, 'phoenix'); } });
      return;
    }
    if (!this.living().length && this.wipeT <= 0) { this.wipeT = 2.4; this.ev.emit('wipe'); }
  }
  afterWipe() {
    this.wipeT = 0;
    for (const h of this.team) { h.down = false; h.hp = h.S.maxHp; h.shield = 0; h.inv = 1; }
    if (this.boss && !this.boss.dead && this.boss.bossKind === 'act') { this.bossFail('down'); return; }
    const P = this.s.prog;
    if (++P.fails >= 2) this.retreat();
    this.startStage();
  }
  waveCleared() {
    const P = this.s.prog;
    this.ev.emit('cleared');
    if (P.s === STAGES || P.w >= this.wavePlan().waves) { this.stageClear(); return; }
    P.w++;
    this.startWave();
  }

  // ---------- targeting ----------
  alive() { return this.mobs.filter(m => !m.dead); }
  front() {
    let best = null;
    for (const m of this.mobs) if (!m.dead && (!best || m.x < best.x)) best = m;
    return best;
  }
  // melee heroes step up to the front line; ranged heroes shoot from where they stand
  inReach(h, m, extra = 0) {
    if (!m) return false;
    const from = h.S.melee ? this.frontX() + 6 : h.x;
    return m.x - m.w / 2 <= from + h.S.reach + extra;
  }
  behind(m, n, gap = Infinity) { return this.mobs.filter(o => !o.dead && o !== m && o.x > m.x && o.x - m.x < gap).sort((a, b) => a.x - b.x).slice(0, n); }
  near(x, r) { return this.alive().filter(m => Math.abs(m.x - x) < r + m.w / 2); }
  randomHero() { const l = this.living(); return l.length ? this.rng.pick(l) : null; }
  // monsters mostly go for the front of the formation
  pickVictim() { return this.rng.chance(0.7) ? this.frontHero() : this.randomHero(); }

  // ---------- hero attacks ----------
  attack(h, m) {
    const S = h.S;
    h.count++; h.swing = 1; h.swingT = 0;
    if (h.b.quick > 0) h.b.quick--;
    this.ev.emit('swing', h);
    for (const id of h.acts) { const k = ACTIVES[id]; if (k.type === 'ac' && h.count % k.every === 0) this.cast(h, id); }
    if (h.b.wrath > 0) this.later.push({ t: 0.15, fn: () => this.wrathBolt(h, m) });
    if (S.melee) { h.pending = { t: 0.07, m }; h.lunge = h.slot ? 0.3 : 0; return; }
    let n = 1;
    if (S.lg.chain && h.count % 4 === 0) n += 2;
    for (let i = 0; i < n; i++) this.later.push({ t: 0.06 + i * 0.07, fn: () => this.fire(h, m) });
  }
  fire(h, m, o = {}) {
    if (!m || m.dead) m = this.front();
    if (!m || h.down) return;
    const S = h.S;
    const a = { h, x: (o.from ?? h.x) + 14, y: 14 + this.rng.int(-2, 2), tgt: m, spd: o.spd || S.shotSpeed || 360, kind: o.kind || S.shot, elem: o.elem || S.elem,
      mult: o.mult ?? 1, opt: o.opt || null, onHit: o.onHit || null, basic: !o.onHit && !o.opt };
    this.arrows.push(a);
    this.ev.emit('arrow', a);
  }
  // a basic ranged hit with the class's legendary extras
  rangedImpact(h, m, a) {
    const S = h.S;
    this.hit(h, m, a.mult, { kind: 'atk', proj: true });
    if (S.lg.elemchain && h.cls === 'sorcerer') {
      let from = m;
      for (let i = 0; i < 2; i++) {
        const nx = this.alive().filter(o => o !== m && o !== from).sort((p, q) => Math.abs(p.x - from.x) - Math.abs(q.x - from.x))[0];
        if (!nx) break;
        this.ev.emit('fx', 'zap', { from: from.x, to: nx.x });
        this.hit(h, nx, 0.5 * S.lg.elemchain, { kind: 'proc', noCrit: true });
        from = nx;
      }
    }
    if (h.cls === 'hunter' && S.lg.sunpierce) { const list = this.behind(m, 99); list.forEach(b => this.hit(h, b, 0.8 * S.lg.sunpierce, { kind: 'atk', noCrit: true, proj: true })); if (list.length) this.ev.emit('fx', 'pierce', m); }
    if (h.cls === 'ranger' && S.lg.splitarrow) {
      const others = this.alive().filter(o => o !== m);
      for (let i = 0; i < 2 && others.length; i++) { const o = others.splice(this.rng.int(0, others.length - 1), 1)[0]; this.ev.emit('fx', 'split', { from: m.x, to: o.x }); this.hit(h, o, 0.4 * S.lg.splitarrow, { kind: 'proc', noCrit: true }); }
    }
    if (S.lg.pierce) this.behind(m, 2).forEach(b => this.hit(h, b, 0.5 * S.lg.pierce, { kind: 'atk', noCrit: true }));
  }
  strike(h, m) {
    const S = h.S;
    if (!m || m.dead) m = this.front();
    if (!m || !this.inReach(h, m, 8)) return;
    let hits = 1;
    if (S.lg.chain && h.count % 4 === 0) hits += 2;
    for (let i = 0; i < hits; i++) {
      this.hit(h, m, 1, { kind: 'atk' });
      if (S.lg.swordwave) { const list = this.behind(m, 2); if (list.length) { this.ev.emit('fx', 'wave', m); list.forEach(b => this.hit(h, b, 0.6 * S.lg.swordwave, { kind: 'atk', noCrit: true })); } }
      if (S.lg.pierce) this.behind(m, 2).forEach(b => this.hit(h, b, 0.5 * S.lg.pierce, { kind: 'atk', noCrit: true }));
      if (m.dead) { m = this.front(); if (!m || !this.inReach(h, m, 8)) break; }
    }
  }
  wrathBolt(h, m) {
    if (!m || m.dead) m = this.front();
    if (!m || h.down) return;
    const judge = h.S.lg.judgement ? 1 + 0.5 * h.S.lg.judgement : 1;
    this.ev.emit('fx', 'thunder', { x: m.x, y: m.y });
    for (const x of this.near(m.x, 60 * h.S.aoe)) this.hit(h, x, h.wrathMul * judge, { skill: true, aoe: true, kind: 'skill', elem: 'lightning', status: 'shock', stun: h.S.lg.judgement ? 1 : 0 });
  }

  // ---------- skills ----------
  castReady(h, id) {
    const f = this.front();
    if (id === 'p_heal') return this.living().some(x => x.hp < x.S.maxHp * 0.8);
    if (id === 'p_rez') return this.team.some(x => x.down);
    if (id === 'p_sanct') return this.living().some(x => x.hp < x.S.maxHp * 0.9) || !!this.boss;
    if (id === 'k_aegis') return !!f && f.x < 160;
    if (!f) return false;
    switch (id) {
      case 'k_charge': case 'y_jump': return f.x - f.w / 2 < this.frontX() + 80;
      case 'y_spin': case 'y_cry': return f.x - f.w / 2 < this.frontX() + 70;
      case 's_storm': return f.x < this.frontX() + 150;
      case 'h_trap': return f.x > this.frontX() + 30 && f.x < 230;
      case 'k_blade': case 'r_swift': case 'y_blood': case 'h_quick': case 'p_wrath': return f.x < this.frontX() + 170;
    }
    return this.inReach(h, f);
  }
  cast(h, id) {
    const s = this.s, l = skillLv(s, h.cls, id), sk = ACTIVES[id], S = h.S;
    if (!l || h.down) return;
    const f = this.front(), mul = sk.mul ? lv(sk.mul, l) : 0, v = sk.v ? lv(sk.v, l) : 0;
    const el = sk.elem || S.elem, o = { skill: true, kind: 'skill', elem: el };
    const aoe = { ...o, aoe: true }, dur = (sk.dur || 0) * S.dur, fx0 = this.frontX();
    h.cast = 0.28;
    s.stats.casts++;
    this.ev.emit('cast', h, id);
    const ticks = (n, every, fn) => { for (let i = 0; i < n; i++) this.later.push({ t: i * every, fn: () => { if (!h.down) fn(i); } }); };
    switch (id) {
      // 骑士
      case 'k_thrust': this.ev.emit('fx', 'thrust', { x: fx0 }); for (const m of this.alive()) if (m.x - m.w / 2 < fx0 + 100 * S.aoe) this.hit(h, m, mul, o); break;
      case 'k_charge': this.ev.emit('fx', 'bash', { x: fx0 + 30 }); for (const m of this.near(fx0 + 35, 35 * S.aoe)) this.hit(h, m, mul, { ...aoe, stun: 1 }); break;
      case 'k_retri': {
        if (!f) break;
        const n = 3 + Math.floor((1 - h.hp / S.maxHp) / 0.25);
        this.ev.emit('fx', 'execute', f);
        for (let i = 0; i < n; i++) this.later.push({ t: i * 0.08, fn: () => { const t = f.dead ? this.front() : f; if (t && !h.down) this.hit(h, t, mul, o); } });
        break;
      }
      case 'k_aegis': this.buffs.aegis = 8 * S.dur; for (const x of this.living()) x.shield = Math.max(x.shield, S.maxHp * v); this.ev.emit('fx', 'aegis', h); break;
      case 'k_blade': h.b.blade = dur; h.bladeV = v; this.ev.emit('fx', 'blade', h); break;
      // 游侠
      case 'r_rapid': for (let i = 0; i < 3; i++) this.later.push({ t: 0.08 + i * 0.07, fn: () => { const t = this.front(); if (t) this.fire(h, t, { mult: mul, opt: { ...o, proj: true }, kind: 'arrow' }); } }); break;
      case 'r_scatter': for (const m of this.alive().sort((a, b) => a.x - b.x).slice(0, 5)) this.fire(h, m, { mult: mul, opt: { ...o, proj: true }, kind: 'arrow' }); break;
      case 'r_rain': {
        const x = f ? f.x : 120;
        this.ev.emit('fx', 'rain', { x, t: 2.5 });
        ticks(10, 0.25, () => { for (const m of this.near(x, 50 * S.aoe)) this.hit(h, m, mul, aoe); });
        break;
      }
      case 'r_swift': h.b.swift = dur; h.swiftV = v; this.ev.emit('fx', 'gale', h); break;
      case 'r_pierce': this.ev.emit('fx', 'beamArrow', h); for (const m of this.alive()) this.hit(h, m, mul, { ...o, proj: true }); break;
      case 'r_skewer': if (f) this.fire(h, f, { kind: 'arrow', spd: 520, onHit: m => { m.skewer = Math.min(10, (m.skewer || 0) + 1); this.hit(h, m, mul, { ...o, proj: true, status: m.skewer >= 3 ? 'bleed' : null }); } }); break;
      // 法师
      case 's_fireball': if (f) this.fire(h, f, { kind: 'fireball', spd: 260, elem: 'fire', onHit: m => { this.ev.emit('fx', 'blast', m); for (const x of this.near(m.x, 40 * S.aoe)) this.hit(h, x, mul, { ...aoe, status: 'ignite' }); } }); break;
      case 's_iceorb': this.zones.push({ kind: 'orb', h, x: h.x + 16, vx: 70, t: 3, every: 0.6, cd: 0.2, mul, o: { ...aoe, status: 'chill' }, r: 22 * S.aoe }); this.ev.emit('fx', 'orb', h); break;
      case 's_lightning': this.ev.emit('fx', 'zap', { from: h.x + 12, to: Math.min(260, f ? f.x + 120 : 200) }); for (const m of this.alive()) if (m.x < h.x + 260) this.hit(h, m, mul, { ...o, status: 'shock' }); break;
      case 's_hydra': {
        const heads = 1 + (S.lg.hydraking ? 2 : 0), t = 8 * S.dur + (S.lg.hydraking ? 4 : 0);
        this.summons.push({ kind: 'hydra', h, x: h.x - 14, t, every: 0.5 / heads, cd: 0.3, mul, o: { ...o, proj: true } });
        this.ev.emit('fx', 'hydra', h);
        break;
      }
      case 's_storm': {
        const x = fx0 + 80;
        this.ev.emit('fx', 'storm', { x, t: 5 * S.dur });
        ticks(Math.round(5 * S.dur), 1, () => { for (const m of this.near(x, 120 * S.aoe / 2 + 30)) this.hit(h, m, mul, { ...aoe, status: 'chill' }); });
        break;
      }
      case 's_meteor': {
        const x = f ? f.x + 10 : 120;
        this.ev.emit('fx', 'meteor', { x, delay: 0.25 });
        this.later.push({ t: 0.6, fn: () => { this.ev.emit('fx', 'meteorHit', { x }); for (const m of this.near(x, 70 * S.aoe / 2 + 15)) this.hit(h, m, mul, { ...aoe, status: 'ignite' }); } });
        break;
      }
      // 牧师
      case 'p_heal': {
        const t = this.living().sort((a, b) => a.hp / a.S.maxHp - b.hp / b.S.maxHp)[0];
        if (t) { this.heal(t, t.S.maxHp * v * S.heal * (S.lg.sainthood ? 2 : 1), false); this.ev.emit('fx', 'heal', t); }
        break;
      }
      case 'p_wrath': h.b.wrath = dur; h.wrathMul = mul; this.ev.emit('fx', 'wrath', h); break;
      case 'p_sanct': this.buffs.sanct = dur; this.sanctHps = v * S.heal * (S.lg.sainthood ? 2 : 1); this.ev.emit('fx', 'sanct', h); break;
      case 'p_rez': {
        const t = this.team.find(x => x.down);
        if (t) { t.down = false; t.hp = t.S.maxHp * v; t.inv = 1.5; this.ev.emit('revive', t, 'rez'); }
        if (!this.living().length) this.wipeT = 0;
        break;
      }
      // 猎手
      case 'h_blast': if (f) this.fire(h, f, { kind: 'bomb', onHit: m => { this.ev.emit('fx', 'blast', m); for (const x of this.near(m.x, 40 * S.aoe)) this.hit(h, x, mul, { ...aoe, status: 'ignite' }); } }); break;
      case 'h_frost': if (f) this.fire(h, f, { kind: 'bolt', spd: 520, elem: 'cold', onHit: m => { this.ev.emit('fx', 'frost', m); for (const x of this.near(m.x, 50 * S.aoe)) this.hit(h, x, mul, { ...aoe, status: 'freeze', freeze: 1.5 }); } }); break;
      case 'h_quick': h.b.quick = Math.round(v); this.ev.emit('fx', 'gale', h); break;
      case 'h_trap': {
        const x = clamp((f ? f.x : 120) - 24, fx0 + 30, 200);
        for (let i = 0; i < 2; i++) this.zones.push({ kind: 'trap', h, x: x + i * 22, n: 1, t: 12, mul, o: { ...aoe, status: 'shock' } });
        this.ev.emit('fx', 'snare', { x });
        break;
      }
      case 'h_turret': this.summons.push({ kind: 'turret', h, x: h.x + 10, t: 10 * S.dur, every: 0.5, cd: 0.4, mul, o: { ...o, proj: true } }); this.ev.emit('fx', 'turret', h); break;
      case 'h_shock': if (f) this.fire(h, f, { kind: 'bolt', spd: 520, onHit: m => {
        this.hit(h, m, mul, { ...o, status: 'shock' });
        for (const x of this.alive().filter(x => x !== m).sort((p, q) => Math.abs(p.x - m.x) - Math.abs(q.x - m.x)).slice(0, 3)) { this.ev.emit('fx', 'zap', { from: m.x, to: x.x }); this.hit(h, x, mul, { ...o, status: 'shock' }); }
      } }); break;
      // 屠戮者
      case 'y_jump': {
        const t = f;
        if (!t) break;
        this.ev.emit('fx', 'crush', t);
        for (const m of this.near(t.x, 50 * S.aoe)) this.hit(h, m, mul, aoe);
        if (t.dead) { this.ev.emit('fx', 'blast', t); for (const m of this.near(t.x, 80 * S.aoe)) this.hit(h, m, 3.5, aoe); }
        break;
      }
      case 'y_crush': if (f) { this.ev.emit('fx', 'crush', f); this.hit(h, f, mul, o); } break;
      case 'y_cry': for (const m of this.near(fx0 + 40, 40 * S.aoe)) m.stun = Math.max(m.stun, 1.5); this.buffs.cry = dur; this.cryV = v; this.ev.emit('fx', 'warcry', h); break;
      case 'y_quake': this.ev.emit('fx', 'quake', { x: fx0 + 40 }); for (const m of this.near(fx0 + 40, 90 * S.aoe / 2 + 20)) this.hit(h, m, mul, aoe); break;
      case 'y_spin': {
        const t = 3 * S.dur + (S.lg.tempest ? 2 * S.lg.tempest : 0), r = 60 * S.aoe * (S.lg.tempest ? 1.5 : 1);
        h.spin = t; this.ev.emit('fx', 'spin', { h, r, t });
        ticks(Math.round(t / 0.25), 0.25, () => {
          for (const m of this.near(this.frontX() + 10, r / 2 + 10)) {
            const d = this.hit(h, m, mul, { ...aoe, status: 'bleed' });
            if (S.lg.bloodaxe) this.heal(h, d * 0.1 * S.lg.bloodaxe, true);
          }
        });
        break;
      }
      case 'y_blood': h.hp = Math.max(1, h.hp * 0.5); h.b.blood = dur; h.bloodV = v; this.ev.emit('fx', 'rage', h); break;
    }
    if (S.lg.echo && sk.type === 'cd' && !this.echoing && this.rng.chance(0.3 * S.lg.echo)) {
      this.later.push({ t: 0.35, fn: () => { if (this.alive().length && !h.down) { this.echoing = true; this.cast(h, id); this.echoing = false; } } });
    }
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
      const tgt = this.pickVictim();
      if (!tgt) return;
      const sh = { x: m.x - 6, y: m.y || 10, vx: -170, dmg: atk, src: m, kind: d.shot, elem: m.elem, tgt, aoe: !!d.aoe };
      this.shots.push(sh);
      this.ev.emit('shot', sh);
      return;
    }
    this.later.push({ t: 0.12, fn: () => { if (!m.dead && m.stun <= 0) this.hurtHero(this.frontHero(), atk, m, { elem: m.elem }); } });
    this.ev.emit('mobSwing', m);
  }
  bossSkill(m, k) {
    const tele = (t, fn, kind) => { m.tele = { k: kind || k, t }; this.ev.emit('telegraph', m, kind || k); this.later.push({ t, fn: () => { m.tele = null; if (!m.dead && m.stun <= 0) fn(); } }); };
    const front = () => this.frontHero();
    this.ev.emit('bossSkill', m, k);
    switch (k) {
      case 'slam': tele(0.8, () => { this.ev.emit('fx', 'slam', { x: this.frontX() }); this.hurtHero(front(), m.atk * 2.5, m, { kind: 'slam' }); }); return 6.5;
      case 'split': return 99;
      case 'roots': tele(0.6, () => { this.debuff.slow = 2.2; this.debuff.slowMul = 0.5; this.ev.emit('fx', 'roots'); for (const h of this.living()) this.hurtHero(h, m.atk * 0.5, m); }); return 8;
      case 'drain': m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.05); this.ev.emit('fx', 'drain', m); return 10;
      case 'venom': tele(0.5, () => { const t = front(); this.hurtHero(t, m.atk * 1.2, m, { elem: 'chaos' }); for (let i = 1; i <= 3; i++) this.later.push({ t: i, fn: () => { if (!m.dead) this.hurtHero(t, m.atk * 0.3, m, { kind: 'poison', elem: 'chaos' }); } }); }); return 7;
      case 'flurry': for (let i = 0; i < 3; i++) this.later.push({ t: 0.25 + i * 0.18, fn: () => { if (!m.dead && m.stun <= 0) { this.ev.emit('mobSwing', m); this.hurtHero(front(), m.atk * 0.8, m); } } }); return 7;
      case 'howl': tele(0.7, () => { this.debuff.slow = 4; this.debuff.slowMul = 0.7; this.ev.emit('fx', 'howl', m); }); return 9;
      case 'pack': case 'legion': return 99;
      case 'erupt': tele(0.7, () => { for (let i = 0; i < 3; i++) this.later.push({ t: i * 0.2, fn: () => { if (m.dead) return; const tgt = this.randomHero(); if (!tgt) return; const sh = { x: m.x - 20, y: 34, vx: -150, dmg: m.atk * 1.2, src: m, kind: 'lava', arc: 1, elem: 'fire', tgt }; this.shots.push(sh); this.ev.emit('shot', sh); } }); }); return 8;
      case 'harden': m.harden = 4; this.ev.emit('fx', 'harden', m); return 12;
      case 'wisps': for (let i = 0; i < 2; i++) this.addMob('wisp', m.x - 20 + i * 30, { summoned: true }); this.ev.emit('fx', 'summon', m); return 10;
      case 'curse': tele(0.6, () => { this.debuff.curse = 5; this.ev.emit('fx', 'curse'); }); return 9;
      case 'spike': tele(0.8, () => { this.ev.emit('fx', 'spike', { x: this.frontX() }); this.hurtHero(front(), m.atk * 3, m, { kind: 'slam' }); }); return 7;
      case 'web': tele(0.5, () => { this.debuff.slow = 3; this.debuff.slowMul = 0.6; this.ev.emit('fx', 'web'); }); return 10;
      case 'bolt': { const t = this.randomHero(); tele(0.9, () => { const v = t && !t.down ? t : this.randomHero(); this.ev.emit('fx', 'bolt', v); this.hurtHero(v, m.atk * 3, m, { kind: 'bolt', elem: 'lightning' }); }); return 6; }
      // the griffin dives at the back of the formation
      case 'dive': tele(0.6, () => { const t = this.backHero(); this.ev.emit('fx', 'dive', t); this.hurtHero(t, m.atk * 2, m, { kind: 'slam' }); }); return 8;
      case 'rift': tele(0.9, () => { this.ev.emit('fx', 'rift', m); for (const h of this.living()) this.hurtHero(h, m.atk * 1.8, m, { kind: 'slam', elem: 'chaos' }); }); return 7;
      case 'darkbeam': { const t = this.randomHero(); tele(0.6, () => { this.ev.emit('fx', 'darkbeam', { m, h: t }); for (let i = 0; i < 5; i++) this.later.push({ t: i * 0.3, fn: () => { if (!m.dead && m.stun <= 0) this.hurtHero(t && !t.down ? t : this.frontHero(), m.atk * 0.7, m, { kind: 'bolt', elem: 'chaos' }); } }); }); return 9; }
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
    const s = this.s;
    s.stats.play += dt;
    if (this.later.length) {
      const due = [];
      for (const a of this.later) { a.t -= dt; if (a.t <= 0) due.push(a); }
      if (due.length) { this.later = this.later.filter(a => a.t > 0); for (const a of due) a.fn(); }
    }
    if ((this.achT += dt) >= 2) { this.achT = 0; checkAch(s, this.ev); }
    for (const k in this.buffs) if (this.buffs[k] > 0) this.buffs[k] = Math.max(0, this.buffs[k] - dt);
    if (this.debuff.slow > 0) this.debuff.slow = Math.max(0, this.debuff.slow - dt);
    if (this.debuff.curse > 0) this.debuff.curse = Math.max(0, this.debuff.curse - dt);
    for (const h of this.team) {
      for (const k in h.b) if (k !== 'quick' && h.b[k] > 0) h.b[k] = Math.max(0, h.b[k] - dt);
      for (const k in h.prism) if (h.prism[k] > 0) h.prism[k] -= dt;
      if (this.buffs.aegis <= 0 && h.shield > 0 && !h.S.lg.pact && !h.S.lg.bulwark) h.shield = Math.max(0, h.shield - h.S.maxHp * dt * 0.5);
      h.inv = Math.max(0, h.inv - dt); h.hurt = Math.max(0, h.hurt - dt); h.cast = Math.max(0, h.cast - dt); h.spin = Math.max(0, h.spin - dt); h.lunge = Math.max(0, h.lunge - dt);
      if (h.swing > 0) { h.swingT += dt; if (h.swingT > 0.3) h.swing = 0; }
      if (!h.down) {
        h.hp = Math.min(h.S.maxHp, h.hp + h.S.regen * h.S.maxHp * dt);
        if (this.buffs.sanct > 0) this.heal(h, h.S.maxHp * this.sanctHps * dt, false);
      }
    }
    this.autoOpen(dt);
    // the whole formation is down: regroup
    if (this.wipeT > 0) {
      this.wipeT -= dt;
      this.stepMobs(dt, false);
      if (this.wipeT <= 0) this.afterWipe();
      return;
    }
    const f = this.front(), moveMul = 1 + this.P.move;
    if (this.phase === 'march') {
      this.phaseT += dt;
      const sp = RUN_SPEED * moveMul * dt;
      for (const m of this.mobs) m.x -= sp;
      for (const z of this.zones) z.x -= sp;
      const reach = Math.max(...this.living().map(h => (h.S.melee ? 0 : h.x) + h.S.reach), 40);
      if (!f || f.x <= Math.max(ENGAGE_AT, Math.min(reach, 175))) {
        this.phase = 'fight'; this.phaseT = 0;
        if (this.boss) this.ev.emit('bossStart', this.boss);
      }
      return;
    }
    if (this.phase === 'clear') { this.phaseT += dt; this.stepMobs(dt, false); this.stepArrows(dt); return; }

    // fight
    this.phaseT += dt;
    if (this.boss && !this.boss.dead && this.boss.bossKind === 'act') {
      this.bossT -= dt; this.bossClock += dt;
      if (this.bossT <= 0) { this.bossT = 0; this.bossFail('time'); return; }
    } else {
      if (this.boss && !this.boss.dead) this.bossClock += dt;
      // a fight that drags on counts as a failed attempt
      if (this.phaseT > (this.bossWave ? STAGE_BOSS_LIMIT : WAVE_LIMIT)) { this.giveUp(); return; }
    }
    // walk up when nobody can reach the nearest monster
    const busy = this.team.some(h => !h.down && (h.pending || h.spin > 0));
    if (f && !busy && !this.living().some(h => this.inReach(h, f))) {
      const sp = WALK_SPEED * moveMul * dt;
      for (const m of this.mobs) m.x -= sp;
      for (const z of this.zones) z.x -= sp;
      for (const sh of this.shots) sh.x -= sp;
      this.walking = true;
    } else this.walking = false;
    for (const h of this.team) {
      if (h.down) continue;
      if (h.pending) { h.pending.t -= dt; if (h.pending.t <= 0) { const m = h.pending.m; h.pending = null; this.strike(h, m); } }
      for (const id of h.acts) {
        const k = ACTIVES[id];
        if (k.type !== 'cd') continue;
        h.cds[id] = Math.max(0, (h.cds[id] ?? 1.2) - dt);
        if (h.cds[id] <= 0 && this.castReady(h, id)) { this.cast(h, id); h.cds[id] = k.cd * (1 - h.S.cdr) / h.S.cast; }
      }
      h.atkT -= dt;
      if (h.atkT <= 0) {
        const t = this.front();
        if (t && this.inReach(h, t) && !h.pending && h.spin <= 0) { this.attack(h, t); h.atkT += 1 / this.aspdOf(h); }
        else h.atkT = 0;
      }
    }
    this.stepSummons(dt);
    this.stepMobs(dt, true);
    this.stepZones(dt);
    this.stepArrows(dt);
    // monster projectiles fly to the hero they were aimed at
    for (const sh of this.shots) {
      sh.x += sh.vx * dt;
      const tgt = sh.tgt && !sh.tgt.down && this.team.includes(sh.tgt) ? sh.tgt : this.frontHero();
      if (!tgt) { sh.done = true; continue; }
      if (sh.x <= tgt.x + 6) {
        sh.done = true;
        const src = sh.src && !sh.src.dead ? sh.src : null;
        if (sh.aoe) for (const h of this.living()) { if (Math.abs(h.x - tgt.x) <= 22) this.hurtHero(h, sh.dmg * (h === tgt ? 1 : 0.5), src, { kind: 'shot', elem: sh.elem }); }
        else this.hurtHero(tgt, sh.dmg, src, { kind: 'shot', elem: sh.elem });
      }
    }
    this.shots = this.shots.filter(sh => !sh.done);
    if (this.phase === 'fight' && !this.alive().length) this.waveCleared();
  }
  // 发条 runes open chests from the tray on their own; 润滑 makes it faster
  autoOpen(dt) {
    const A = this.A, kinds = [A.autoN > 0, A.autoB > 0, A.autoA > 0];
    if (!kinds.some(Boolean) || !this.s.tray.length) return;
    const every = AUTO_OPEN_EVERY * (1 - Math.min(0.75, A.openSpeed || 0));
    this.openT += dt;
    if (this.openT < every) return;
    const i = this.s.tray.findIndex(c => kinds[c.k]);
    if (i < 0) { this.openT = every; return; }
    this.openT = 0;
    const ch = this.s.tray.splice(i, 1)[0];
    const res = Loot.open(this.s, ch, null, this.rng, this.P);
    this.ev.emit('autoOpen', res);
  }
  stepSummons(dt) {
    for (const z of this.summons) {
      z.t -= dt; z.cd -= dt;
      if (z.cd > 0 || z.h.down) continue;
      const t = this.front();
      if (!t || t.x > z.x + 260) continue;
      z.cd = z.every;
      this.fire(z.h, t, { kind: z.kind === 'hydra' ? 'hydra' : 'bolt', spd: z.kind === 'hydra' ? 320 : 480, elem: z.kind === 'hydra' ? 'fire' : undefined, mult: z.mul, opt: z.o, from: z.x });
    }
    this.summons = this.summons.filter(z => z.t > 0 && !z.h.down);
  }
  stepZones(dt) {
    for (const z of this.zones) {
      z.t -= dt;
      if (z.kind === 'orb') {
        z.x += z.vx * dt; z.cd -= dt;
        if (z.cd <= 0) { z.cd = z.every; for (const m of this.near(z.x, z.r)) this.hit(z.h, m, z.mul, z.o); }
      } else if (z.kind === 'trap') {
        for (const m of this.alive()) if (!m.y && Math.abs(m.x - z.x) < 10 && z.n > 0) {
          z.n--; this.ev.emit('fx', 'snap', z);
          for (const x of this.near(z.x, 30)) this.hit(z.h, x, z.mul, z.o);
          break;
        }
      }
    }
    this.zones = this.zones.filter(z => z.t > 0 && (z.kind !== 'trap' || z.n > 0));
  }
  stepArrows(dt) {
    for (const a of this.arrows) {
      let m = a.tgt;
      if (!m || m.dead) { m = a.tgt = this.front(); if (!m) { a.done = true; continue; } }
      a.x += a.spd * dt;
      if (a.x >= m.x - m.w / 3) {
        a.done = true;
        if (a.onHit) a.onHit(m);
        else if (a.basic) this.rangedImpact(a.h, m, a);
        else this.hit(a.h, m, a.mult, a.opt || { kind: 'atk' });
      }
    }
    if (this.arrows.length) this.arrows = this.arrows.filter(a => !a.done);
  }
  stepMobs(dt, active) {
    const fx0 = this.frontX();
    // ground monsters queue behind each other; fliers drift freely
    const ground = this.mobs.filter(m => !m.dead && !m.y).sort((a, b) => a.x - b.x);
    let prev = null;
    for (const m of ground) {
      m.stopX = fx0 + (m.d.rng && !m.boss ? m.d.rng : 18 + m.w / 2);
      if (prev) m.stopX = Math.max(m.stopX, prev.x + (prev.w + m.w) / 2 - 2);
      prev = m;
    }
    for (const m of this.mobs) {
      if (m.dead) { m.deathT += dt; continue; }
      m.flash = Math.max(0, m.flash - dt);
      m.act = Math.max(0, m.act - dt);
      m.bob += dt;
      if (m.chill > 0) m.chill -= dt;
      if (m.shock > 0) m.shock -= dt;
      if (m.frozen > 0) m.frozen -= dt;
      if (m.burn > 0 || m.bleed > 0) {
        m.dotT += dt;
        if (m.dotT >= 0.5) {
          m.dotT = 0;
          if (m.burn > 0) { m.burn -= 0.5; this.tick(m, m.burnDps * 0.5, 'burn', 'fire'); if (m.burn <= 0) m.burnDps = 0; }
          if (!m.dead && m.bleed > 0) { m.bleed -= 0.5; this.tick(m, m.bleedDps * 0.5, 'bleed', 'phys'); if (m.bleed <= 0) m.bleedDps = 0; }
          if (m.dead) continue;
        }
      }
      if (m.champ && m.champ.aura === 'vigor') m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.01 * dt);
      if (m.harden > 0) m.harden -= dt;
      if (m.stun > 0) { m.stun -= dt; continue; }
      if (!active) continue;
      const slow = m.chill > 0 ? 0.7 : 1;
      const stop = m.y ? fx0 + (m.d.rng || 18 + m.w / 2) : m.stopX;
      if (m.root > 0) m.root -= dt;
      else if (m.x > stop) m.x = Math.max(stop, m.x - m.spd * slow * dt * (m.boss ? 1.4 : 1));
      if (m.boss) {
        this.bossThresholds(m);
        for (const k in m.sk) { if (m.tele) break; m.sk[k] -= dt * slow; if (m.sk[k] <= 0 && m.x <= stop + 4) m.sk[k] = this.bossSkill(m, k); }
      }
      if (m.champ && m.champ.aura === 'arcane' && m.x < fx0 + 260) {
        m.arcT -= dt;
        if (m.arcT <= 0) {
          m.arcT = 6; m.tele = { k: 'arcane', t: 0.5 }; this.ev.emit('telegraph', m, 'arcane');
          const tgt = this.randomHero();
          this.later.push({ t: 0.5, fn: () => { m.tele = null; if (!m.dead && m.stun <= 0) { this.ev.emit('fx', 'arcane', { x: tgt ? tgt.x : 0 }); this.hurtHero(tgt && !tgt.down ? tgt : this.frontHero(), m.atk * 2, m, { kind: 'bolt' }); } } });
        }
      }
      if (m.d.atk === 0) continue;
      const reach = fx0 + (m.d.rng && !m.boss ? m.d.rng + 4 : 22 + m.w / 2);
      if (m.x <= reach && !m.tele && this.frontHero()) {
        m.atkT -= dt * slow;
        if (m.atkT <= 0) { m.atkT = m.cd * (0.9 + this.rng.next() * 0.2); this.mobAttack(m); }
      }
    }
    // let corpses linger long enough for the death animation
    if (this.mobs.length > 24 || this.mobs.some(m => m.dead && m.deathT > 1.2)) this.mobs = this.mobs.filter(m => !m.dead || m.deathT <= 1.2);
  }
}

// run a quiet copy of the party on the current stage to measure income per second (offline: gold and experience)
function measureRates(save, seconds = 90) {
  const copy = normalizeSave(JSON.parse(JSON.stringify(save)));
  copy.prog.farm = true; copy.prog.auto = false; copy.opts.autoEquip = 0; copy.opts.autoSkill = 0;
  if (copy.prog.s === STAGES) copy.prog.s = STAGES - 1;
  copy.tray = []; copy.inv = [];
  const b = new Battle(copy, { headless: true, seed: 12345 });
  const g0 = copy.gold, k0 = copy.stats.kills;
  let exp = 0;
  b.ev.on('exp', x => (exp += x));
  const n = Math.round(seconds / STEP);
  for (let i = 0; i < n; i++) b.step(STEP);
  return { gold: (copy.gold - g0) / seconds, exp: exp / seconds, kills: (copy.stats.kills - k0) / seconds, d: copy.prog.d, a: copy.prog.a, s: copy.prog.s };
}
