'use strict';
// =====================================================================
//  PLAYER — controller: combos & 派生, 武技 direction arts, 秘技 (I + direction,
//  mana), charge, dash attacks, 见切 counters, wall jumps, weapon, sigil hooks
// =====================================================================
const JUMP_V = 400, JUMP2_V = 360, MAX_FALL = 470;
const CHARGE_START = 0.24, CHARGE_L1 = 0.42, CHARGE_L2 = 1.05;
const FOLLOW_WINDOW = 0.55;
const HOOK_NAMES = ['onHit', 'onCrit', 'onKill', 'onDash', 'onDashEnd', 'onSkill', 'onUlt', 'onHurt', 'onRoomStart', 'onRoomClear', 'tick', 'modDmg', 'modHit', 'onPlunge', 'onPerfect', 'onCounter', 'onJump', 'onFinisher', 'onMove', 'onCharge', 'draw'];

class Player extends Ent {
  constructor(heroId, x, y, weaponId) {
    const h = HEROES[heroId];
    super(x, y, h.hurt[0], h.hurt[1]);
    this.hero = h; this.heroId = heroId; this.spr = SPR[heroId];
    this.weaponId = WEAPONS[weaponId] ? weaponId : heroWeapons(heroId)[0].id;
    this.wpn = WEAPONS[this.weaponId];
    this.state = 'normal'; this.move = null;
    this.mods = {}; this.flags = {}; this.counters = {};
    this.secrets = {};
    for (const id in SKILLS) { const S = SKILLS[id]; if (S.hero === heroId && S.def) this.secrets[S.slot] = { id, lv: 1 }; }
    // 技能 (U + direction): every slot known from the start, each on its own cooldown
    this.uskills = {}; this.ucd = {}; this.lastU = null;
    for (const id in USKILLS) { const U = USKILLS[id]; if (U.hero === heroId) { this.uskills[U.slot] = { id, lv: 1 }; this.ucd[U.slot] = 0; } }
    this.arts = { up: null, down: null, dash: null };
    this.tech = {};
    this.recalc();
    this.hp = this.maxHp;
    this.mana = this.stats.maxMana; this.shield = 0; this.manaFlash = 0;
    this.lastSkill = null; this.lastSkillT = -9;
    this.dashes = this.stats.dashes; this.dashRegen = 0;
    this.riseCD = 0;
    this.jumpsLeft = 0; this.coyote = 0; this.jumpBuf = 0; this.jumpHeld = false;
    this.inv = 0; this.hurtT = 0; this.hurtFlash = -1; this.armorT = 0; this.ironT = 0;
    this.combo = 0; this.comboT = 0; this.maxCombo = 0;
    this.anim = 'idle'; this.animT = 0; this.airChains = 0; this.airRises = 0;
    this.dealt = 0; this.trail = 0; this.hidden = false; this.squash = 0; this.landT = 0;
    this.lastMove = null; this.chainT = 0; this.dropT = 0; this.deadT = 0;
    this.revives = 0; this.ghostT = 0;
    this.holding = false; this.holdT = 0; this.chargeT = 0; this.chargeLv = 0;
    this.counterT = 0; this.postDashT = 0; this.dashT0 = -9; this.pdDone = true; this.dashBrakePending = false;
    this.wallT = 0; this.wallDir = 0; this.wallLock = 0; this.airRefill = false;
    this.onLandOnce = null;
    this.dyn = { atk: 1, spd: 1 };
  }

  // ---------- stats ----------
  recalc() {
    const h = this.hero, T = Talents.values();
    const s = this.stats = {
      maxHp: h.hp + T.hp, atkMul: 1 + T.atk, crit: h.crit + T.crit, critDmg: 1.6, armor: h.armor, speedMul: 1, atkSpeed: 1,
      dashes: 2 + T.dash, dashCD: 0.75, jumps: 2, costMul: 1, manaMul: 1, maxMana: 100, manaRegen: 2.2, skillDmg: 1, ultDmg: 1, chargeDmg: 1, chargeSpeed: 0,
      counterDmg: 1, pdWindow: 0.17, witch: 1.3, airDmg: 1, dmgMul: 1, goldMul: 1 + T.gold, pierce: 0, healMul: 1, comboTime: 2.4,
      charge2: false, chargeArmor: false, echo: 0, chargeTimeMul: 1, supplyHealMul: 1,
    };
    s.maxHp += (this.counters && this.counters.bonusHp) || 0;
    this.hooks = {};
    for (const n of HOOK_NAMES) this.hooks[n] = [];
    this.flags = {};
    if (this.wpn && this.wpn.apply) this.wpn.apply(this, s);
    for (const id in this.mods) { const u = UPG[id]; if (u && u.apply) u.apply(this, this.mods[id], s); }
    applyResonance(this, s);
    if (this.tech && this.tech.counterPlus) { s.pdWindow *= 1.6; s.witch += 0.8; s.counterDmg += 0.5; }
    if (this.tech && this.tech.manaFlow) { s.maxMana += 30; s.manaRegen *= 1.5; }
    const difficulty = curDifficulty();
    if (difficulty) {
      s.maxHp *= difficulty.maxHpMul;
      s.armor = 1 - (1 - s.armor) * difficulty.damageTakenMul;
      s.pdWindow *= difficulty.pdWindowMul;
      s.supplyHealMul = difficulty.supplyHealMul;
      s.chargeTimeMul = difficulty.chargeTimeMul;
      this.on('onKill', p => p.heal(difficulty.killHeal, true, 1));
    }
    const H = G.run && G.run.hard;
    if (H) {
      s.maxHp *= H.maxHpMul; s.healMul *= H.healMul; s.manaRegen *= H.manaRegen; s.manaMul *= H.manaGain;
      s.dmgMul *= H.dmgMul; s.goldMul += H.goldMul;
    }
    if (this.mana > s.maxMana) this.mana = s.maxMana;
    const old = this.maxHp || s.maxHp;
    this.maxHp = Math.max(1, Math.round(s.maxHp));
    if (this.hp !== undefined && this.maxHp > old) this.hp += this.maxHp - old;
    if (this.hp > this.maxHp) this.hp = this.maxHp;
    this.atk = h.atk * s.atkMul;
    s.crit = Math.min(0.95, s.crit);
  }
  on(ev, fn) { this.hooks[ev].push(fn); }
  maxHpGain(amount) {
    const difficulty = curDifficulty(), hard = G.run && G.run.hard;
    const multiplier = (difficulty ? difficulty.maxHpMul : 1) * (hard ? hard.maxHpMul : 1);
    return Math.max(1, Math.round(this.stats.maxHp + amount * multiplier)) - this.maxHp;
  }
  fire(ev, a, b, c, d) { const l = this.hooks[ev]; if (l) for (let i = 0; i < l.length; i++) l[i](this, a, b, c, d); }
  damageMult(e, h) {
    const s = this.stats;
    let m = s.dmgMul;
    if (h.src === 'skill') m *= s.skillDmg;
    else if (h.src === 'ult') m *= s.ultDmg;
    else if (h.src === 'charge') m *= s.chargeDmg;
    else if (h.src === 'counter') m *= s.counterDmg;
    if (!this.onGround && !h.dot && h.src !== 'ult') m *= s.airDmg;
    if (this.counters.wxAtkT > G.time) m *= 1.2;                     // 龙威
    for (const f of this.hooks.modDmg) m *= f(this, e, h);
    return m;
  }
  modHit(hit) { for (const f of this.hooks.modHit) f(this, hit); }
  // picks taken in a 秘技 (1..its own cap)
  skillRaw(id) { for (const k in this.secrets) { const s = this.secrets[k]; if (s && s.id === id) return s.lv; } return 1; }
  // the content tier its moves read (1 base, 2 强化, 3 进化) — each 秘技 maps its picks onto tiers its own way
  skillLv(id) { const S = SKILLS[id]; return S && S.lvs ? wxAt(S, this.skillRaw(id)).t : this.skillRaw(id); }
  skFollow(id) { const S = SKILLS[id]; return !!(S && S.follow && S.lvs && wxAt(S, this.skillRaw(id)).f); }
  artLv(id) { for (const k in this.arts) { const s = this.arts[k]; if (s && s.id === id) return s.lv; } return 0; }
  uLv(id) { for (const k in this.uskills) { const s = this.uskills[k]; if (s && s.id === id) return s.lv; } return 1; }
  artPow(id) { const lv = this.artLv(id); return lv ? wxAt(ARTS[id], lv).pow || 1 : 1; }
  uPow(id) { return wxAt(USKILLS[id], this.uLv(id)).pow || 1; }
  // which 武学 a move (or a hit spec) belongs to
  moveWx(m, spec = {}) {
    if (spec.wx !== undefined) return spec.wx;
    const source = spec.uskill !== undefined || spec.skill !== undefined || spec.art !== undefined ? spec : m;
    const us = source && source.uskill;
    if (us) return { fam: 'u', id: us };
    const sk = source && source.skill;
    if (sk && SKILLS[sk]) return { fam: 'sk', id: sk };
    const ar = source && source.art;
    if (ar && ARTS[ar]) return { fam: 'art', id: ar };
    return null;
  }
  // the signature effects a 武学 has earned so far
  wxPerksOf(wx) {
    if (!wx) return null;
    const E = wx.fam === 'u' ? USKILLS[wx.id] : wx.fam === 'art' ? ARTS[wx.id] : SKILLS[wx.id];
    const lv = wx.fam === 'u' ? this.uLv(wx.id) : wx.fam === 'art' ? this.artLv(wx.id) : this.skillRaw(wx.id);
    if (!E || !E.lvs || !lv) return null;
    const list = wxPerksAt(E, lv);
    return list.length ? list : null;
  }
  // A supplied source keeps delayed attacks tied to their own signature effects.
  wxMod(name, wx = this.move && this.moveWx(this.move.m)) {
    const list = this.wxPerksOf(wx);
    let v = name === 'reach' ? 1 : 0;
    if (list) for (const pk of list) if (pk.mods && pk.mods[name] !== undefined) v = name === 'reach' ? v * pk.mods[name] : Math.max(v, +pk.mods[name]);
    return v;
  }
  reach(wx) { return this.wxMod('reach', wx); }
  // build a hit description; damage = atk * dmg * (skill / art level scaling)
  makeHit(spec) {
    const m = this.move && this.move.m;
    const wx = this.moveWx(m, spec);
    let mul = spec.dmg;
    if (wx && wx.fam === 'u') mul *= this.uPow(wx.id);
    else if (wx && wx.fam === 'sk') mul *= skMul(this, wx.id);
    else if (wx && wx.fam === 'art') mul *= this.artPow(wx.id);
    const hit = Object.assign({ kx: 0, ky: 0, stun: 0.3, hs: 2, fxc: this.hero.color, energy: 1 }, spec, { dmg: this.atk * mul, wx });
    if (!spec.src) hit.src = wx && (wx.fam === 'u' || wx.fam === 'sk') ? 'skill' : 'light';
    this.modHit(hit);
    return hit;
  }
  hitbox(rel, spec, dur, opts) { return Combat.box(this, 'p', rel, this.makeHit(spec), dur, opts); }
  heal(v, silent, multiplier = this.stats.healMul) {
    if (this.dead) return;
    const a = Math.min(this.maxHp - this.hp, Math.round(v * multiplier));
    if (a <= 0) return;
    this.hp += a;
    if (!silent) {
      FX.text(this.x, this.y - this.h - 6, '+' + a, '#6aff8a');
      FX.burst(this.x, this.cy, { n: 10, c: ['#6aff8a', '#c8ffd8'], sp: [20, 60], g: -80, life: [0.4, 0.8], glow: true });
      Sound.play('heal');
    }
  }
  gainMana(v) {
    if (this.dead) return;
    const before = this.mana, max = this.stats.maxMana;
    this.mana = Math.min(max, this.mana + v * this.stats.manaMul);
    const ult = this.secrets.down && SKILLS[this.secrets.down.id];
    if (ult) {
      const c = skillCost(this, ult);
      if (before < c && this.mana >= c) {
        Sound.play('pickup', { pitch: 1.5 });
        FX.ring(this.x, this.cy, 4, 30, '#5ad8ff', 0.4, 2);
        FX.text(this.x, this.y - this.h - 8, '奥义就绪', '#7fd8ff', { size: 8 });
      }
    }
  }
  addCombo() { this.combo++; this.comboT = this.stats.comboTime; if (this.combo > this.maxCombo) this.maxCombo = this.combo; G.stats.maxCombo = Math.max(G.stats.maxCombo, this.combo); }
  resetCombo() { if (this.flags.keepCombo) { this.combo = Math.floor(this.combo / 2); return; } this.combo = 0; this.comboT = 0; }
  superArmor() { return (this.move && (this.move.m.armor || this.move.m.ult || this.wxMod('armor'))) || this.armorT > 0 || this.ironT > 0 || (this.state === 'charge' && this.stats.chargeArmor); }

  // ---------- update ----------
  update(dt) {
    this.inv -= dt; this.riseCD -= dt; this.hurtFlash -= dt; this.chainT -= dt; this.counterT -= dt; this.postDashT -= dt;
    this.dropT -= dt; this.armorT -= dt; this.landT -= dt; this.wallT -= dt; this.wallLock -= dt;
    this.squash = Math.max(0, this.squash - dt * 6);
    if (this.ironT > 0) {
      this.ironT -= dt;
      if (Math.random() < 0.4) FX.add({ k: 'px', x: this.x + rand(-8, 8), y: this.y - rand(0, 30), vx: 0, vy: -30, life: 0.4, s: 1.5, c: '#ffd36a', glow: true, add: true });
      if (this.ironT <= 0 && this.ironLv >= 3) explodeP(this.x, this.cy, 70, 2.5 * skMul(this, 'gao_iron'), { c: '#ffd36a', heavy: true, src: 'skill', wx: { fam: 'sk', id: 'gao_iron' }, shake: 0.5, noProc: false });
    }
    this.manaFlash -= dt;
    for (const k in this.ucd) if (this.ucd[k] > 0) this.ucd[k] -= dt;
    if (this.chillT > 0) { this.chillT -= dt; if (Math.random() < 0.25) FX.add({ k: 'px', x: this.x + rand(-6, 6), y: this.y - rand(4, 28), vx: 0, vy: -12, life: 0.4, s: 1.5, c: '#bfe6ff', glow: true }); }
    if (!this.dead && !(this.move && this.move.m.ult) && this.mana < this.stats.maxMana) this.mana = Math.min(this.stats.maxMana, this.mana + this.stats.manaRegen * dt);
    if (this.comboT > 0 && !(this.flags.comboFreeze && G.enemies.some(e => !e.dead))) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }
    if (this.dashes < this.stats.dashes) { this.dashRegen += dt; if (this.dashRegen >= this.stats.dashCD) { this.dashes++; this.dashRegen = 0; } }
    else this.dashRegen = 0;
    if (this.trail > 0) {
      this.trail -= dt; this.ghostT -= dt;
      if (this.ghostT <= 0) { this.ghostT = 0.03; FX.ghost(this.frame(), this.spr.ox, this.spr.oy, this.x, this.y, this.face < 0, this.hero.color, 0.25); }
    }
    if (this.dead) {
      this.deadT += dt;
      this.vx = approach(this.vx, 0, 400 * dt);
      this.vy = Math.min(this.vy + GRAV * dt, MAX_FALL);
      moveBody(this, dt, G.room);
      this.anim = 'dead'; this.animT += dt;
      return;
    }
    this.dyn = { atk: 1, spd: 1 };
    this.fire('tick', dt);
    const ix = this.wallLock > 0 ? 0 : Input.axisX();
    if (Input.hit('jump')) this.jumpBuf = 0.13; else this.jumpBuf -= dt;
    // hold-to-charge tracking
    if (Input.hit('attack')) { this.holding = true; this.holdT = 0; }
    if (this.holding) { if (Input.down('attack')) this.holdT += dt; else this.holding = false; }
    switch (this.state) {
      case 'normal': this.updNormal(dt, ix); break;
      case 'move': this.updMove(dt, ix); break;
      case 'dash': this.updDash(dt); break;
      case 'charge': this.updCharge(dt, ix); break;
      case 'hurt':
        this.hurtT -= dt;
        this.vx = approach(this.vx, 0, 500 * dt);
        if (this.tech.recover && Input.hit('dash') && this.dashes > 0) {
          this.dashes--; this.state = 'normal'; this.inv = Math.max(this.inv, 0.45); this.vy = Math.min(this.vy, -120);
          FX.ring(this.x, this.cy, 4, 24, '#ffffff', 0.25, 2); FX.text(this.x, this.y - this.h - 6, '受身', '#ffffff');
          Sound.play('dash', { x: this.x, pitch: 1.3 });
        } else if (this.hurtT <= 0) this.state = 'normal';
        break;
    }
    // gravity
    let gm = 1;
    if (this.state === 'dash') gm = 0;
    else if (this.state === 'move') { const m = this.move.m; gm = m.grav !== undefined ? m.grav : 1; }
    else if (this.state === 'normal' && !this.onGround && Math.abs(this.vy) < 60 && Input.down('jump')) gm = 0.7;
    if (gm > 0) this.vy = Math.min(this.vy + GRAV * gm * dt, MAX_FALL * (gm < 0.5 ? 0.4 : 1));
    if (this.wallT > 0 && this.state === 'normal' && this.vy > 60) this.vy = 60;
    const fallV = this.vy;
    const wasGround = this.onGround;
    moveBody(this, dt, G.room);
    if (this.onGround) {
      this.coyote = 0.1; this.jumpsLeft = this.stats.jumps - 1; this.airChains = 0; this.airRises = 0; this.airRefill = false; this.wallT = 0;
      if (!wasGround) this.onLand(fallV);
      if (this.onLandOnce) { const f = this.onLandOnce; this.onLandOnce = null; f(this); }
    } else {
      this.coyote -= dt;
      // wall slide: pressing into a wall while falling
      const ixr = Input.axisX();
      if (this.hitWall && ixr === this.hitWall && this.state === 'normal' && this.vy > -40) { this.wallT = 0.12; this.wallDir = this.hitWall; }
      if (this.wallT > 0 && Math.random() < 0.3) FX.dust(this.x + this.wallDir * this.w / 2, this.y - rand(4, 20), 1, -this.wallDir, '#a89ab8');
    }
    this.updAnim(dt);
  }
  onIce() { return this.onGround && this.groundT === 1 && G.room && G.room.ice && G.room.ice.has(Math.floor(this.x / TILE)); }
  approachVelocity(target, acc, dt) {
    this.vx = approach(this.vx, target, Math.max(acc, this.dashBrakePending ? 2200 : 0) * dt);
    // Keep braking armed through windup and later authored velocity tracks.
    if (this.state !== 'move' && this.vx === target) this.dashBrakePending = false;
  }
  // 寒冷: frost attacks slow the player for a while
  chill(t) {
    if (this.dead || G.god) return;
    if (!(this.chillT > 0)) FX.text(this.x, this.y - this.h - 8, '寒冷', '#9fd8ff', { size: 8, life: 0.6 });
    this.chillT = Math.max(this.chillT || 0, t);
  }
  updNormal(dt, ix) {
    const sp = this.hero.speed * this.stats.speedMul * this.dyn.spd * (this.chillT > 0 ? 0.62 : 1) * (this.counters.wxSpdT > G.time ? 1.25 : 1);   // 虎踞
    const ice = this.onIce();
    const acc = this.onGround ? (ice ? (ix ? 420 : 160) : 2400) : 1600;
    if (ice && Math.abs(this.vx) > 60 && Math.random() < 0.2) FX.add({ k: 'px', x: this.x - sign(this.vx) * 4, y: this.y - 1, vx: -this.vx * 0.2, vy: -rand(10, 30), life: 0.3, s: 1.5, c: '#dff4ff', glow: true });
    this.approachVelocity(ix * sp, acc, dt);
    if (ix) this.face = ix;
    if (this.wallT > 0) this.face = -this.wallDir;
    if (this.tryActions()) return;
    if (this.holding && this.holdT >= CHARGE_START * this.stats.chargeTimeMul && this.onGround) { this.enterCharge(); return; }
    if (this.wallT > 0 && this.jumpBuf > 0) { this.wallJump(); return; }
    this.tryJump();
    if (this.jumpHeld && !Input.down('jump')) { if (this.vy < -120) this.vy *= 0.5; this.jumpHeld = false; }
    if (this.onGround && ix && Math.random() < 0.08) FX.dust(this.x - ix * 4, this.y, 1, -ix);
  }
  tryActions() {
    if (Input.hit('dash') && this.doDash()) return true;
    if (Input.hit('ult') && this.trySecret()) return true;
    if (Input.hit('skill') && this.trySkill()) return true;
    if (Input.hit('attack')) {
      const m = this.pickAttack(this.chainT > 0 ? this.lastMove : null, true);
      if (m) { this.startMove(m); return true; }
    }
    return false;
  }
  tryJump() {
    if (this.jumpBuf <= 0) return false;
    if (Input.down('down') && this.onGround && this.groundT === 2) {
      this.dropT = 0.25; this.jumpBuf = 0; this.y += 2; this.onGround = false;
      return true;
    }
    if (this.coyote > 0) {
      this.vy = -JUMP_V; this.coyote = 0; this.jumpHeld = true;
      Sound.play('jump', { x: this.x });
      FX.dust(this.x, this.y, 5, 0);
    } else if (this.jumpsLeft > 0) {
      this.jumpsLeft--; this.vy = -JUMP2_V; this.jumpHeld = true;
      Sound.play('djump', { x: this.x });
      FX.ring(this.x, this.y, 3, 16, this.hero.color, 0.25, 2, 0.4);
      FX.burst(this.x, this.y, { n: 6, c: [this.hero.color, '#ffffff'], sp: [30, 80], ang: Math.PI / 2, spread: 1.2, life: [0.2, 0.4], glow: true });
    } else return false;
    this.jumpBuf = 0;
    this.state = 'normal'; this.move = null;
    this.fire('onJump');
    return true;
  }
  wallJump() {
    const d = this.wallDir || this.face;
    this.vy = -(this.tech.wallRun ? 430 : 385);
    this.vx = -d * 230; this.face = -d;
    this.wallT = 0; this.wallLock = 0.14; this.jumpBuf = 0; this.jumpHeld = true;
    this.airChains = 0; this.airRises = 0;
    if (this.tech.wallRun) this.jumpsLeft = this.stats.jumps - 1; else this.jumpsLeft = Math.max(this.jumpsLeft, 1);
    Sound.play('jump', { x: this.x, pitch: 1.2 });
    FX.dust(this.x + d * this.w / 2, this.y - 10, 6, -d);
    FX.ring(this.x + d * 6, this.y - 12, 2, 12, '#ffffff', 0.2, 1);
    this.fire('onJump');
  }
  onLand(fallV) {
    if (fallV > 250) {
      this.squash = Math.min(1, fallV / 500);
      this.landT = 0.08;
      Sound.play('land', { x: this.x });
      FX.dust(this.x, this.y, 6, 0);
    }
  }
  // choose the attack for the current context (direction, air, dash, counter, chain)
  pickAttack(chainFrom, delayed) {
    const h = this.hero, M = h.moves, up = Input.down('up'), down = Input.down('down');
    if (this.counterT > 0) { this.counterT = 0; return 'counter'; }
    const cm = chainFrom ? M[chainFrom] : null;
    // 武技 chain: 起手 → 派生 → 连段 → 终式; how many links are open is set per art and level
    if (cm && cm.art && cm.next && M[cm.next] && ARTS[cm.art]) {
      const A = ARTS[cm.art], lv = this.artLv(cm.art);
      if (lv && A.moves.indexOf(cm.next) >= 0 && A.moves.indexOf(cm.next) < wxAt(A, lv).n) return cm.next;
    }
    const nextOf = m => {
      if (!m) return null;
      if (delayed && m.delay) return m.delay;
      if (m.next && !m.art && (!m.nextReq || this.tech[m.nextReq])) return m.next;
      return null;
    };
    const opener = (slot, def) => { const a = this.arts[slot]; return a ? ARTS[a.id].moves[0] : def; };
    if (!this.onGround) {
      if (this.state === 'dash' || this.postDashT > 0) return opener('dash', 'dashAtk');
      if (down) return 'plunge';
      if (up && this.airRises < (this.tech.airRise2 ? 2 : 1)) { this.airRises++; return 'airRise'; }
      if (cm && cm.air) { const n = nextOf(cm); if (n) return n; }
      if (this.airChains < 2) { this.airChains++; return h.air; }
      return null;
    }
    if (this.state === 'dash' || this.postDashT > 0) return opener('dash', 'dashAtk');
    if (up && this.riseCD <= 0) { this.riseCD = 0.45; return opener('up', 'rise'); }
    if (down) return opener('down', 'low');
    if (cm && !cm.air) { const n = nextOf(cm); if (n) return n; }
    return h.combo;
  }
  startMove(name) {
    const m = this.hero.moves[name];
    if (!m) return;
    if (this.postDashT > 0) this.dashBrakePending = true;
    if (this.move && this.move.m.onEnd) this.move.m.onEnd(this, this.move);
    const ix = Input.axisX();
    if (ix && !m.ult && name !== 'counter') this.face = ix;
    this.state = 'move';
    this.move = { name, m, t: 0, ei: 0, hi: 0, buf: null };
    this.anim = name; this.animT = 0;
    if (name === 'rise') this.airChains = 0;
    if (m.air && this.vy > 20) this.vy = 20;
    if (m.air && this.vy < -150 && name !== 'plunge' && name !== 'airRise') this.vy *= 0.5;
    if (m.onStart) m.onStart(this, this.move);
    this.fire('onMove', name);
  }
  endMove() {
    if (this.move && this.move.m.onEnd) this.move.m.onEnd(this, this.move);
    if (this.move && this.move.m.skill && !this.move.m.isFollow) { this.lastSkill = this.move.m.skill; this.lastSkillT = G.time; }
    if (this.move && this.move.m.uskill) this.lastU = { id: this.move.m.uskill, stage: this.move.m.ustage, t: G.time };
    this.lastMove = this.move ? this.move.name : null;
    this.chainT = 0.5;
    this.move = null; this.state = 'normal';
  }
  updMove(dt, ix) {
    const mv = this.move, m = mv.m;
    mv.t += dt * (m.noAtkSpeed ? 1 : this.stats.atkSpeed * this.dyn.atk);
    const dur = m.durFn ? m.durFn(this) : m.dur;
    // signature effects that act while the move runs (e.g. 卷刃)
    const perks = this.wxPerksOf(this.moveWx(m));
    if (perks) for (const pk of perks) if (pk.during) pk.during(this, mv, dt);
    if (this.move !== mv) return;
    if (m.ev) while (mv.ei < m.ev.length && m.ev[mv.ei][0] <= mv.t) { m.ev[mv.ei][1](this, mv); mv.ei++; if (this.move !== mv) return; }
    if (m.hits) while (mv.hi < m.hits.length && m.hits[mv.hi].t <= mv.t) { this.spawnHit(m.hits[mv.hi]); mv.hi++; }
    let velSet = false;
    if (m.vel) for (const v of m.vel) if (mv.t >= v[0] && mv.t < v[1]) { this.vx = v[2] * this.face; if (v[3] !== undefined && v[3] !== null) this.vy = v[3]; velSet = true; }
    if (!velSet) {
      if (m.steer) this.approachVelocity(ix * m.steer, 900, dt);
      else if (this.onGround) this.approachVelocity(0, this.onIce() ? 260 : 1700, dt);
      else this.approachVelocity(ix * 55, 500, dt);
    }
    if (m.update) m.update(this, mv, dt);
    if (this.move !== mv) return;
    // 秘技 派生: press I again during the skill (or its follow-on moves)
    if (Input.hit('ult') && !m.ult && this.followOf(m) && mv.t >= (m.followAt !== undefined ? m.followAt : Math.min(m.cancel, 0.2)) && this.tryFollow(m.skill)) return;
    // 技能 stages: press U again during a stage for the next one
    if (Input.hit('skill') && m.uskill) { const nx = this.uNext(); if (nx) { this.startUStage(nx.U, nx.stage); return; } }
    // a buffered 秘技 / 技能 press wins over later attack presses
    if (Input.hit('ult')) { mv.buf = 'ult'; mv.bufSlot = this.secretSlot(); }
    else if (Input.hit('skill')) { mv.buf = 'skill'; mv.bufSlot = this.uSlot(); }
    else if (mv.buf !== 'ult' && mv.buf !== 'skill') {
      if (Input.hit('attack')) mv.buf = 'attack';
      else if (Input.hit('jump')) mv.buf = 'jump';
    }
    if (m.ult) { if (mv.t >= dur) this.endMove(); return; }
    // roll a held light attack into a charge
    if (m.light && this.holding && this.holdT >= CHARGE_START * this.stats.chargeTimeMul && this.onGround && mv.t >= m.cancel * 0.6) { this.enterCharge(); return; }
    const firstHit = m.hits && m.hits.length ? m.hits[0].t : 0.04;
    if (Input.hit('dash') && mv.t >= Math.min(m.cancel, firstHit + 0.03) && this.doDash()) return;
    if (mv.t >= m.cancel) {
      if (mv.buf === 'attack') {
        const nm = this.pickAttack(mv.name, false);
        if (nm) { this.startMove(nm); return; }
      }
      if (mv.buf === 'jump') {
        this.move = null; this.state = 'normal'; this.jumpBuf = 0.13;
        if (m.onEnd) m.onEnd(this, mv);
        if (this.wallT > 0) this.wallJump(); else if (!this.tryJump()) this.endMove();
        return;
      }
      if (mv.buf === 'ult') { mv.buf = null; if (this.trySecret(mv.bufSlot)) return; }
      if (mv.buf === 'skill') { mv.buf = null; if (this.trySkill(mv.bufSlot)) return; }
      if (ix && this.onGround && mv.t >= m.cancel + 0.05 && !m.loop && !m.steer) { this.endMove(); return; }
    }
    if (mv.t >= dur && !m.loop) this.endMove();
  }
  spawnHit(h) {
    const m = this.move ? this.move.m : null;
    const hit = this.makeHit({
      dmg: h.dmg, kx: h.kb[0], ky: h.kb[1], stun: h.stun, hs: h.hs === undefined ? 3 : h.hs,
      heavy: h.heavy, launch: h.launch, src: h.src || (m && (m.skill || m.uskill) ? 'skill' : 'light'), finisher: h.finisher, radial: h.radial,
      critBonus: h.critBonus, breakGuard: h.breakGuard, status: h.status,
    });
    Combat.box(this, 'p', h.box, hit, h.d || 0.08, { onHit: e => this.onMeleeHit(e, hit) });
  }
  onMeleeHit(e, hit) {
    if (!this.onGround && this.move && this.move.m.air) {
      this.vy = Math.min(this.vy, -30);
      if (this.tech.airRise2 && !this.airRefill && this.dashes < this.stats.dashes) { this.airRefill = true; this.dashes++; }
    }
    if (hit.finisher && !hit._fin) { hit._fin = true; this.fire('onFinisher', e, hit); }
  }
  // ---------- charge ----------
  enterCharge() {
    if (this.move && this.move.m.onEnd) this.move.m.onEnd(this, this.move);
    this.state = 'charge'; this.move = null; this.chargeT = 0; this.chargeLv = 0;
    this.anim = 'hold'; this.animT = 0;
    Sound.play('charge', { x: this.x, pitch: 1.2 });
  }
  updCharge(dt, ix) {
    this.chargeT += dt * (1 + this.stats.chargeSpeed) / this.stats.chargeTimeMul;
    this.approachVelocity(ix * 26, 700, dt);
    const can2 = this.tech.charge2 || this.stats.charge2;
    if (this.chargeLv === 0 && this.chargeT >= CHARGE_L1) {
      this.chargeLv = 1;
      FX.ring(this.x, this.cy, 20, 4, this.hero.color, 0.2, 2); FX.flash(this.x, this.cy, 10, '#ffffff', 0.1);
      Sound.play('chargeLv', { x: this.x });
    }
    if (this.chargeLv === 1 && can2 && this.chargeT >= CHARGE_L2) {
      this.chargeLv = 2;
      FX.ring(this.x, this.cy, 30, 4, '#ffffff', 0.25, 3); FX.flash(this.x, this.cy, 16, this.hero.color, 0.15);
      Sound.play('chargeLv', { x: this.x, pitch: 1.5 });
      Cam.shake(0.1);
    }
    const a = rand(0, TAU), r = rand(16, 30);
    if (Math.random() < 0.6) FX.add({ k: 'px', x: this.x + Math.cos(a) * r, y: this.cy + Math.sin(a) * r, vx: -Math.cos(a) * r * 4, vy: -Math.sin(a) * r * 4, life: 0.22, s: this.chargeLv === 2 ? 2 : 1.5, c: this.chargeLv ? this.hero.color : '#ffffff', glow: true, add: true });
    Light.add(this.x, this.cy, 50 + this.chargeLv * 30, this.hero.color, 0.6);
    if (this.stats.chargeArmor) this.armorT = 0.05;
    if (Input.hit('dash') && this.doDash()) return;
    if (Input.hit('jump')) { this.state = 'normal'; this.jumpBuf = 0.13; this.tryJump(); return; }
    if (!this.onGround) { this.state = 'normal'; return; }
    if (!Input.down('attack')) {
      this.holding = false;
      if (this.chargeLv >= 1) { const lv = this.chargeLv; this.startMove(lv === 2 ? 'charge2' : 'charge1'); this.fire('onCharge', lv); }
      else this.state = 'normal';
    }
  }
  // ---------- dash & 见切 ----------
  doDash() {
    if (this.dashes <= 0 || this.state === 'dash') return false;
    if (this.move && this.move.m.onEnd) this.move.m.onEnd(this, this.move);
    this.dashes--;
    const ix = Input.axisX();
    if (ix) this.face = ix;
    this.state = 'dash'; this.dashT = 0.19; this.move = null; this.dashBrakePending = false;
    this.inv = Math.max(this.inv, 0.22);
    this.dashT0 = G.time; this.pdDone = false;
    this.vx = this.face * 450; this.vy = 0;
    this.dashX0 = this.x;
    Sound.play('dash', { x: this.x });
    FX.dust(this.x, this.y, 4, -this.face);
    FX.ring(this.x - this.face * 4, this.cy, 2, 14, this.hero.color, 0.2, 2);
    this.fire('onDash');
    return true;
  }
  endDash() {
    this.state = 'normal'; this.dashBrakePending = true;
    this.fire('onDashEnd');
  }
  updDash(dt) {
    this.dashT -= dt; this.vy = 0;
    this.ghostT -= dt;
    if (this.ghostT <= 0) { this.ghostT = 0.025; FX.ghost(this.frame(), this.spr.ox, this.spr.oy, this.x, this.y, this.face < 0, this.hero.color, 0.22); }
    if (Input.hit('attack')) { const m = this.pickAttack(null); if (m) { this.endDash(); this.startMove(m); return; } }
    // 冲刺 + U: the dash 技能
    if (Input.hit('skill')) {
      if (this.uReady('dash')) { this.endDash(); this.trySkill('dash'); return; }
      this.uDenied();
    }
    if (Input.hit('jump')) { this.endDash(); this.jumpBuf = 0.13; this.tryJump(); return; }
    if (this.dashT <= 0) {
      this.postDashT = 0.14;
      this.vx = this.face * Math.min(120, this.hero.speed * this.stats.speedMul * 0.65);
      this.endDash();
    }
  }
  // called by hurtPlayer when an attack lands during the opening frames of a dash
  perfectDodge(srcX) {
    this.pdDone = true;
    this.inv = Math.max(this.inv, 0.5);
    this.counterT = 1.3;
    G.witchT = Math.max(G.witchT, this.stats.witch);
    this.gainMana(15);
    G.stats.perfects = (G.stats.perfects || 0) + 1;
    FX.text(this.x, this.y - this.h - 10, '见切!', '#ffffff', { size: 12, life: 0.9 });
    FX.ring(this.x, this.cy, 4, 46, '#ffffff', 0.4, 3);
    FX.ring(this.x, this.cy, 4, 30, this.hero.color, 0.5, 2);
    for (let i = 0; i < 4; i++) FX.ghost(this.frame(), this.spr.ox, this.spr.oy, this.x - this.face * i * 8, this.y, this.face < 0, '#9ab8ff', 0.4, 0.5);
    Sound.play('perfect', { x: this.x });
    this.fire('onPerfect', srcX);
  }
  isPerfectWindow() {
    const elapsed = G.time - this.dashT0;
    // Mode assists extend the timing window without extending dash movement.
    const assisted = curDifficulty() && !this.dead && this.state !== 'hurt';
    return (this.state === 'dash' || assisted) && !this.pdDone && elapsed >= 0 && elapsed <= this.stats.pdWindow;
  }
  // ---------- 秘技 (I + direction) ----------
  secretSlot() {
    if (!this.onGround) return 'air';
    if (Input.down('up')) return 'up';
    if (Input.down('down')) return 'down';
    if (Input.axisX()) return 'move';
    return 'stand';
  }
  // the follow-up (派生) a skill move offers, if its level allows it
  followOf(m) {
    if (!m || !m.skill || m.isFollow) return null;
    const S = SKILLS[m.skill];
    return S && this.skFollow(m.skill) ? S : null;
  }
  tryFollow(id) {
    const S = SKILLS[id];
    if (!S || !S.follow) return false;
    this.lastSkill = null;
    this.startMove(S.follow);
    FX.text(this.x, this.y - this.h - 10, S.fname, '#7fd8ff', { size: 8 });
    Sound.play('chargeLv', { x: this.x, pitch: 1.6 });
    this.fire('onSkill', { id, lv: this.skillLv(id), follow: true }, S.slot);
    return true;
  }
  trySecret(slotOverride) {
    // during / just after a skill → I again = its 派生
    if (this.state === 'move' && this.followOf(this.move.m)) return this.tryFollow(this.move.m.skill);
    if (this.lastSkill && G.time - this.lastSkillT < FOLLOW_WINDOW) {
      const S = SKILLS[this.lastSkill];
      if (S && this.skFollow(S.id)) return this.tryFollow(S.id);
    }
    const slot = slotOverride || this.secretSlot();
    const s = this.secrets[slot];
    if (!s) { Sound.play('error'); return false; }
    const S = SKILLS[s.id];
    const cost = skillCost(this, S);
    if (this.mana < cost) {
      Sound.play('error'); this.manaFlash = 0.5;
      if (G.time - (this.counters.manaT || -9) > 0.8) { this.counters.manaT = G.time; FX.text(this.x, this.y - this.h - 10, '灵力不足', '#7fa8ff', { size: 8 }); }
      return false;
    }
    this.mana -= cost;
    if (S.ult) this.inv = Math.max(this.inv, this.hero.moves[S.move].dur + 0.4);
    this.startMove(S.move);
    this.lastSkill = null;
    const perks = this.wxPerksOf({ fam: 'sk', id: S.id });
    if (perks) for (const pk of perks) if (pk.cast) pk.cast(this, S);
    this.fire('onSkill', s, slot, cost);
    if (S.ult) { this.fire('onUlt'); G.stats.ults++; } else G.stats.skills++;
    return true;
  }
  // ---------- 技能 (U + direction, free, per-slot cooldown) ----------
  uSlot() {
    if (this.state === 'dash' || this.postDashT > 0) return 'dash';
    if (Input.down('up')) return 'up';
    if (Input.down('down')) return 'down';
    return 'shot';
  }
  uReady(slot) { return !!this.uskills[slot] && !(this.ucd[slot] > 0); }
  uDenied() {
    Sound.play('error');
    if (G.time - (this.counters.ucdT || -9) > 0.6) { this.counters.ucdT = G.time; FX.text(this.x, this.y - this.h - 10, '技能冷却中', '#9fe8c8', { size: 8 }); }
  }
  // the next stage of the 技能 being cast (or just finished), if its level has opened it
  uNext() {
    const m = this.state === 'move' && this.move.m;
    let id, stage;
    if (m && m.uskill) {
      if (this.move.t < (m.followAt !== undefined ? m.followAt : Math.min(m.cancel, 0.16))) return null;
      id = m.uskill; stage = m.ustage;
    } else if (this.lastU && G.time - this.lastU.t < FOLLOW_WINDOW) { id = this.lastU.id; stage = this.lastU.stage; }
    else return null;
    const U = USKILLS[id], nx = stage + 1;
    if (!U || nx >= wxAt(U, this.uLv(id)).n) return null;
    return { U, stage: nx };
  }
  startUStage(U, stage) {
    this.lastU = null;
    this.startMove(U.moves[stage]);
    if (stage > 0) {
      FX.text(this.x, this.y - this.h - 10, uLabel(U, stage), WX_FAM.u.col, { size: 8 });
      Sound.play('chargeLv', { x: this.x, pitch: 1.3 + stage * 0.2 });
    }
  }
  trySkill(slotOverride) {
    const nx = this.uNext();
    if (nx) { this.startUStage(nx.U, nx.stage); return true; }
    const slot = slotOverride || this.uSlot();
    const s = this.uskills[slot];
    if (!s) return false;
    if (!this.uReady(slot)) { this.uDenied(); return false; }
    const U = USKILLS[s.id];
    this.ucd[slot] = uCooldown(U);
    this.startUStage(U, 0);
    G.stats.uskills = (G.stats.uskills || 0) + 1;
    return true;
  }
  die() {
    if (this.dead) return;
    for (const f of (this.reviveFns || [])) if (f(this)) return;
    if (this.revives > 0) {
      this.revives--;
      this.hp = Math.round(this.maxHp * 0.4);
      this.inv = 2.5;
      FX.screenFlash('#ffffff', 0.8, 0.6);
      FX.ring(this.x, this.cy, 4, 80, '#ffe14a', 0.6, 4);
      FX.text(this.x, this.y - 40, '不屈之志 · 复苏', '#ffe14a', { size: 12, life: 1.6 });
      Sound.play('upgrade');
      return;
    }
    this.dead = true; this.hp = 0; this.state = 'dead'; this.move = null; this.deadT = 0;
    this.vy = -200; this.vx = -this.face * 80;
    G.onPlayerDeath();
  }

  // ---------- animation / render ----------
  updAnim(dt) {
    let a;
    if (this.state === 'move') { this.anim = this.move.name; this.animT = this.move.t; return; }
    if (this.state === 'dash') a = 'dash';
    else if (this.state === 'charge') a = 'hold';
    else if (this.state === 'hurt') a = 'hurt';
    else if (!this.onGround) a = this.wallT > 0 ? 'wall' : this.vy < -40 ? 'jump' : 'fall';
    else if (Math.abs(this.vx) > 20) a = 'run';
    else a = this.landT > 0 ? 'land' : 'idle';
    if (a !== this.anim) { this.anim = a; this.animT = 0; }
    else this.animT += dt * (a === 'run' ? Math.abs(this.vx) / this.hero.speed : 1);
  }
  frame() {
    const A = this.spr.anims[this.anim] || this.spr.anims.idle;
    if (A.timed) { const i = Math.min(A.frames.length - 1, Math.floor(this.animT * ANIM_FPS)); return A.frames[Math.max(0, i)]; }
    return animFrame(this.spr, this.anim, this.animT);
  }
  draw(ctx, gctx, cx, cy) {
    if (this.hidden) return;
    const fr = this.frame();
    const x = this.x - cx, y = this.y - cy;
    Light.add(this.x, this.y - 16, 150, '#fff2e6', 0.75);
    Light.add(this.x, this.y - 16, 60, this.hero.color, 0.5);
    let alpha = 1;
    if (this.inv > 0 && this.state !== 'dash' && !(this.move && this.move.m.ult) && this.hurtFlash > -0.8) alpha = Math.floor(G.time * 20) % 2 ? 0.35 : 1;
    const sq = this.squash;
    const gy = G.room.floorBelow(this.x, this.y - 2);
    const sd = clamp((gy - this.y) / 120, 0, 1);
    ctx.globalAlpha = 0.35 * (1 - sd);
    ctx.fillStyle = '#000';
    ctx.fillRect(Math.round(x - 7 + sd * 3), Math.round(gy - cy - 1), Math.round(14 - sd * 6), 2);
    ctx.globalAlpha = 1;
    const armored = this.armorT > 0 || this.ironT > 0 || (this.move && (this.move.m.armor || this.wxMod('armor')));
    if (armored || this.state === 'charge') {
      const col = this.ironT > 0 ? '#ffd36a' : this.state === 'charge' ? (this.chargeLv === 2 ? '#ffffff' : this.hero.color) : '#ffb347';
      const a = this.state === 'charge' ? 0.3 + 0.25 * this.chargeLv + 0.15 * Math.sin(G.time * 30) : 0.5;
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) drawFrame(ctx, fr, this.spr.ox, this.spr.oy, x + ox, y + oy, this.face < 0, { tint: col, alpha: a });
    }
    if (this.counterT > 0 && Math.floor(G.time * 12) % 2) drawFrame(gctx, fr, this.spr.ox, this.spr.oy, x, y, this.face < 0, { tint: '#ffffff', alpha: 0.6 });
    drawFrame(ctx, fr, this.spr.ox, this.spr.oy, x, y, this.face < 0, { alpha, sx: 1 + sq * 0.18, sy: 1 - sq * 0.18, white: this.hurtFlash > 0.15, blend: this.chillT > 0 ? '#9fd8ff' : undefined, blendAmt: 0.3 });
    this.fire('draw', ctx, gctx, cx, cy);
    if (this.shield > 0) {
      const r = 20 + Math.sin(G.time * 6);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(140,240,255,0.6)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y - 16, r, 0, TAU); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      gctx.strokeStyle = '#7ff0ff'; gctx.lineWidth = 2; gctx.beginPath(); gctx.arc(x, y - 16, r, 0, TAU); gctx.stroke();
    }
  }
}
