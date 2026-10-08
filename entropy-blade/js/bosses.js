'use strict';
// =====================================================================
//  BOSSES — Oni Warlord, Crystal Empress, Entropy King
// =====================================================================
// 荒鬼武将 — oni warlord (boss of the first region)
const WARDEN_LOOK = {
  build: BUILDS.hulk, outline: '#0a0406',
  col: { pants: '#2c2230', boot: '#18121a', sleeve: '#c8443a', hand: '#b03a30' },
  kneePad: '#3a1e22', shinCol: '#3a1e22',
  stance: { lean: 6, aF: [60, 10], aB: [80, 10], w: 30, w2: 10, lF: [65, 100], lB: [112, 92] },
  runArms: s => ({ aF: [60 + 15 * s, 10], aB: [80 - 15 * s, 10], w: 30, w2: 10 }),
  airArms: { aF: [-20, -40], aB: [120, 140], w: -40, w2: 140 },
  preBack(x, J, B, p) {
    // sashimono war banner on the back
    local(x, J.chest, p.lean, () => {
      x.line(-5, 2, -7, -30, 1.4, '#3a2a1a');
      x.rect(-16, -30, 9, 15, '#e8dcc0'); x.rect(-16, -30, 9, 1.4, '#b8342a');
      x.circ(-11.5, -22, 2.6, '#b8342a');
    });
  },
  torso(x, J, B, p) {
    drawTorsoBase(x, J, B, this, p, '#2e1c20', '#1e1014');
    local(x, J.chest, p.lean, () => {
      for (let k = 0; k < 4; k++) x.rect(-6, -4 + k * 3, 13, 1, '#b83a2a');
      x.rect(-6, 8, 13, 1.6, '#e0a84a');
      x.circ(1.5, -6, 2, '#c8443a');
    });
    // big shoulder guard (sode)
    local(x, J.sF, p.lean, () => { x.rect(-4, -2, 8, 7, '#3a1e22'); x.rect(-4, -2, 8, 1.2, '#e0a84a'); x.rect(-4, 2, 8, 0.8, '#b83a2a'); });
  },
  head(x, J, B, p) {
    local(x, J.head, J.headA / DEG, () => {
      // wild white mane
      x.poly([[-2, -4], [-9, -2], [-12, 3], [-8, 2], [-10, 7], [-5, 4], [-2, 4]], '#e8e0d8');
      x.circ(0, 0, 4.6, '#c8443a');
      x.rect(0.5, 1.5, 4.5, 3, '#c8443a');
      // horns
      x.poly([[-1, -3.5], [-3, -8], [-2, -12], [0.5, -7], [1, -3.5]], '#efe2c8');
      x.poly([[2.5, -3.5], [4, -8], [6.5, -11], [5, -6], [4.2, -3]], '#efe2c8');
      // brow, eyes, fangs
      x.rect(1, -1.8, 4.5, 1, '#5a1a14');
      x.rect(2, -0.8, 1.6, 1.2, p.eye ? '#ffd23f' : '#5a3a10'); x.rect(4.2, -0.8, 1.2, 1.2, p.eye ? '#ffd23f' : '#5a3a10');
      x.rect(2.5, 3, 1, 1.4, '#ffffff'); x.rect(4.2, 3, 1, 1.4, '#ffffff');
    });
  },
  weapon(x, J, B, p) {
    // giant nodachi with a fiery edge
    local(x, J.hF, p.w, () => {
      x.line(-6, 0, 2, 0, 2.2, '#3a2418');
      x.rect(1.5, -3, 1.6, 6, '#e0a84a');
      x.poly([[3, -2.4], [24, -2.6], [33, -1], [36, 1], [24, 2.2], [3, 2.2]], '#dcd8d0');
      x.line(4, 1.6, 33, 0.6, 0.8, '#ffa040');
    });
  },
  weapon2(x, J, B, p) {
    // sake gourd (fire breath vessel)
    local(x, J.hB, p.w2, () => { x.circ(5, 0, 3.4, '#c88a3a'); x.circ(10, 0, 4.4, '#c88a3a'); x.rect(6.8, -1.2, 1.4, 2.4, '#b8342a'); x.circ(9, -1.5, 1.2, '#e8b870'); });
  },
};

const KING_LOOK = {
  build: BUILDS.hulk, outline: '#050106',
  col: { pants: '#2a1c36', boot: '#140c1c', sleeve: '#3a2648', hand: '#1e1028' },
  shinCol: '#3a2648',
  stance: { lean: 6, aF: [75, 40], aB: [100, 80], w: 70, lF: [62, 102], lB: [114, 92], scarf: 160, coat: 120 },
  runArms: s => ({ aF: [75 + 20 * s, 40], aB: [100 - 20 * s, 70], w: 80 }),
  airArms: { aF: [-60, -90], aB: [140, 120], w: -100 },
  back(x, J, B, p) {
    const n = 7;
    const pts = [[J.neck.x - 2, J.neck.y]];
    let px = J.neck.x - 2, py = J.neck.y;
    for (let i = 1; i <= n; i++) {
      const a = (p.scarf - 70) + Math.sin(p.wave * TAU + i * 0.8) * 10 * i / n;
      px += Math.cos(a * DEG) * 4; py += Math.sin(a * DEG) * 4;
      pts.push([px, py]);
    }
    const hem = pts.slice().reverse().map(([qx, qy], i) => [qx + 8 + (i % 2) * 2, qy + 1]);
    x.poly(pts.concat(hem), '#4a0e22');
    x.poly(pts.slice(0, 5).concat(pts.slice(0, 5).reverse().map(([qx, qy]) => [qx + 3, qy])), '#6a1630');
    for (let i = 2; i < pts.length; i++) x.rect(hem[pts.length - 1 - i][0] - 1, hem[pts.length - 1 - i][1] - 1, 1.5, 1.5, '#ff3048');
  },
  torso(x, J, B, p) {
    drawTorsoBase(x, J, B, this, p, '#3a2648', '#1e1028');
    local(x, J.chest, p.lean, () => {
      x.poly([[-2, -6], [6, -5], [5, 4], [-1, 6]], '#4e3460');
      x.line(1, -4, 2, 4, 1, '#ff3048'); x.line(-1, 0, 4, 0, 1, '#ff3048');
      x.line(5.5, -5, 5, 4, 0.8, '#8a6aa0');
    });
    vPoly(x, [[J.sF.x - 4, J.sF.y + 1], [J.sF.x + 4, J.sF.y - 1], [J.sF.x + 3, J.sF.y - 7], [J.sF.x - 1, J.sF.y - 3]], '#4e3460');
    vLine(x, { x: J.sF.x + 3, y: J.sF.y - 7 }, { x: J.sF.x + 4, y: J.sF.y - 1 }, 0.8, '#ff3048');
  },
  head(x, J, B, p) {
    local(x, J.head, J.headA / DEG, () => {
      // swept-back demon horns
      x.poly([[-1, -3], [-4, -6], [-9, -8], [-13, -11], [-10, -7], [-6, -3.5], [-3, -1]], '#d8c8b8');
      x.poly([[-9, -8], [-13, -11], [-10, -7.4]], '#ff3048');
      x.poly([[2, -3.5], [1, -7], [-2, -10], [-5, -14], [-3, -9], [-1.5, -5.5], [-0.5, -2.5]], '#b8a898');
      x.circ(0, 0, 4.8, '#2e1e38');
      x.poly([[-4, -3], [4, -4], [5.5, 0], [4, 3.5], [-3, 3]], '#3e2a4c');
      x.rect(1.5, -1, 4, 1.8, '#07020a');
      x.rect(2, -0.8, 1.5, 1.3, p.eye ? '#ff3048' : '#3a1020'); x.rect(4.3, -0.8, 1.1, 1.3, p.eye ? '#ff3048' : '#3a1020');
      x.line(-3.5, -3.5, 4, -4.2, 0.8, '#ffb347');
    });
  },
  weapon(x, J, B, p) {
    local(x, J.hF, p.w, () => {
      x.line(-5, 0, 1, 0, 2.4, '#3a2a20');
      x.rect(1, -4, 2, 8, '#8a6420');
      x.poly([[3, -2.4], [30, -2], [35, 0.2], [30, 2.2], [3, 2.4]], '#3a3448');
      x.line(4, 0, 30, 0.1, 1, '#ff3048');
    });
  },
};

function drawEmpress(x, o) {
  const t = o.t;
  const cy = -46 + Math.sin(t * TAU) * 2;
  const flap = Math.sin(t * TAU) * 6;
  const wc = ['#bff8ff', '#5ad8f0', '#b28cff'];
  // wings (behind)
  for (let i = 0; i < 3; i++) {
    const a = (-150 + i * 28 + flap * (i + 1) * 0.3) * DEG;
    const L = 30 - i * 5;
    const bx = -2, by = cy - 6;
    const tx = bx + Math.cos(a) * L, ty = by + Math.sin(a) * L;
    const nx = -Math.sin(a) * 4, ny = Math.cos(a) * 4;
    x.poly([[bx, by], [bx + nx + Math.cos(a) * L * 0.4, by + ny + Math.sin(a) * L * 0.4], [tx, ty], [bx - nx + Math.cos(a) * L * 0.5, by - ny + Math.sin(a) * L * 0.5]], wc[i]);
    x.line(bx, by, tx, ty, 0.8, '#ffffff');
  }
  // hair
  for (let i = 0; i < 4; i++) x.line(-1, cy - 18, -8 - i * 2, cy - 4 + i * 3 + Math.sin(t * TAU + i) * 2, 2, i % 2 ? '#d8f4ff' : '#a8d8f0');
  // dress
  x.poly([[-5, cy - 2], [6, cy - 2], [15, cy + 32], [6, cy + 30], [0, cy + 33], [-8, cy + 30], [-16, cy + 32]], '#2a6a9a');
  x.poly([[-5, cy - 2], [-1, cy - 2], [-8, cy + 30], [-16, cy + 32]], '#1c4a72');
  x.line(1, cy, 4, cy + 30, 1, '#7ff7ff'); x.line(-2, cy + 6, -9, cy + 28, 0.8, '#5ad8f0');
  for (let k = -14; k < 14; k += 5) x.poly([[k, cy + 31], [k + 2, cy + 37], [k + 4, cy + 31]], '#7ff7ff');
  // torso
  x.poly([[-4, cy - 2], [5, cy - 2], [4, cy - 14], [-3, cy - 14]], '#3a8ac0');
  x.circ(1, cy - 10, 2, '#bff8ff');
  // arms
  const fa = o.cast ? -70 : o.point ? -5 : 60;
  const ex = 3 + Math.cos(fa * DEG) * 7, ey = cy - 12 + Math.sin(fa * DEG) * 7;
  const hx = ex + Math.cos((fa + (o.cast ? -10 : 20)) * DEG) * 7, hy = ey + Math.sin((fa + (o.cast ? -10 : 20)) * DEG) * 7;
  x.line(-2, cy - 12, -4, cy - 2, 2.2, '#c8e8f8');
  x.line(3, cy - 12, ex, ey, 2.2, '#c8e8f8'); x.line(ex, ey, hx, hy, 2, '#c8e8f8');
  x.circ(hx, hy, o.cast || o.point ? 2.6 : 1.4, o.cast || o.point ? '#ffffff' : '#c8e8f8');
  // head
  x.circ(1, cy - 18, 4.6, '#e0f4ff');
  x.poly([[-3.5, cy - 20], [1, cy - 24], [5.5, cy - 20], [5, cy - 17], [1, cy - 20.5], [-3, cy - 15]], '#d8f4ff');
  x.rect(3, cy - 18.5, 1.6, 1.4, '#45f0ff');
  // crown
  x.poly([[-3, cy - 22], [-2, cy - 28], [0, cy - 23], [1.5, cy - 31], [3, cy - 23], [5, cy - 28], [5.5, cy - 22]], '#7ff7ff');
  x.rect(1, cy - 25, 1.4, 1.4, '#ffffff');
}

function bakeBosses() {
  bakeRig('warden', WARDEN_LOOK, {
    idle: { n: 6, gen: 'idle', loop: true, fps: 6 },
    walk: { n: 8, gen: 'run', loop: true, fps: 8 },
    hurt: { n: 1, gen: 'hurt' },
    windSlash: { n: 1, gen: L => fullPose(L, { lean: -10, aF: [-140, -150], w: -160, aB: [100, 60], w2: 60 }) },
    slash: { n: 3, fps: 18, gen: (L, t) => fullPose(L, { lean: lerp(-4, 24, t), aF: [lerp(-90, 50, t), lerp(-80, 70, t)], w: lerp(-80, 90, t), lF: [45, 100], lB: [130, 100] }) },
    dash: { n: 1, gen: L => fullPose(L, { lean: 30, aF: [0, 0], w: 0, aB: [150, 160], w2: 160, lF: [25, 90], lB: [150, 140] }) },
    aim: { n: 1, gen: L => fullPose(L, { lean: 0, aB: [0, 0], w2: 0, aF: [80, 40], w: 60 }) },
    crouch: { n: 1, gen: L => fullPose(L, { lean: 20, aF: [100, 80], aB: [110, 90], w: 120, w2: 90, lF: [30, 130], lB: [150, 100] }) },
    air: { n: 1, gen: L => fullPose(L, { gl: 0, lean: 8, aF: [60, 90], aB: [80, 100], w: 90, w2: 100, lF: [60, 120], lB: [110, 140] }) },
    pods: { n: 2, fps: 6, loop: true, gen: (L, t) => fullPose(L, { lean: -6, aF: [-60, -80], aB: [-80, -100], w: -80, w2: -100 }) },
  }, 160, 128, 80, 122, 2);
  bakeRig('king', KING_LOOK, {
    idle: { n: 6, gen: 'idle', loop: true, fps: 6 },
    walk: { n: 8, gen: 'run', loop: true, fps: 9 },
    hurt: { n: 1, gen: 'hurt' },
    wind: { n: 1, gen: L => fullPose(L, { lean: -12, aF: [-150, -160], aB: [-120, -150], w: -170, scarf: 140 }) },
    slash: { n: 3, fps: 18, gen: (L, t) => fullPose(L, { lean: lerp(-6, 26, t), aF: [lerp(-100, 50, t), lerp(-90, 70, t)], aB: [lerp(-80, 60, t), lerp(-70, 80, t)], w: lerp(-90, 95, t), lF: [40, 100], lB: [130, 100], scarf: 175 }) },
    thrust: { n: 1, gen: L => fullPose(L, { lean: 30, aF: [0, 0], aB: [10, 5], w: 0, lF: [20, 88], lB: [150, 140], scarf: 180 }) },
    cast: { n: 2, fps: 6, loop: true, gen: (L, t) => fullPose(L, { lean: -4, aB: [-100, -110], aF: [80, 60], w: 90, scarf: 150 + t * 10, wave: t }) },
    kneel: { n: 1, gen: L => fullPose(L, { lean: 30, y: 4, aF: [80, 90], aB: [100, 90], w: 90, lF: [10, 100], lB: [170, 90], head: 20 }) },
  }, 160, 128, 80, 122, 1.8);
  const es = (x, o) => { x.scale(1.4, 1.4); drawEmpress(x, o); };
  bakeCustom('empress', 150, 136, 75, 128, {
    idle: { n: 8, loop: true, fps: 8, draw: (x, t) => es(x, { t }) },
    cast: { n: 4, loop: true, fps: 8, draw: (x, t) => es(x, { t, cast: true }) },
    point: { n: 4, loop: true, fps: 8, draw: (x, t) => es(x, { t, point: true }) },
    hurt: { n: 1, draw: x => es(x, { t: 0.25 }) },
  });
}

const BOSS_DEFS = {
  warden: { name: '荒鬼武将', en: 'ONI WARLORD', title: '镇守古道的鬼将', hp: 1400, w: 34, h: 66, dmg: 17, gold: [60, 80], spr: 'warden', speed: 70, kb: 0.1, poise: 30,
    stars: 2, style: '近战猛攻', trait: '鬼怒', traitDesc: '受击积攒怒气，满怒「鬼化」：霸体、加速、增伤；鬼化结束后力竭，受到伤害 +50%', music: 'boss' },
  empress: { name: '晶核女皇', en: 'CRYSTAL EMPRESS', title: '晶渊深处的歌者', hp: 2300, w: 30, h: 76, dmg: 15, gold: [80, 100], spr: 'empress', speed: 90, kb: 0.1, poise: 28, flying: true,
    stars: 3, style: '召唤 · 弹幕', trait: '晶壁', traitDesc: '生命降至 66% / 33% 时召唤三座晶柱护体（减伤 90%），击碎全部晶柱可使其失衡', music: 'boss' },
  king: { name: '熵之王', en: 'ENTROPY KING', title: '万物终结的回响', hp: 3400, w: 32, h: 62, dmg: 18, gold: [0, 0], spr: 'king', speed: 85, kb: 0.1, poise: 34,
    stars: 4, style: '全能 · 三阶段', trait: '熵蚀', traitDesc: '终焉形态下，虚空从两侧吞噬战场，站在虚空中会持续受到伤害', music: 'final' },
};

class Boss extends Enemy {
  constructor(type, x, y) {
    const D = BOSS_DEFS[type];
    super(type, x, y, { def: D, noSpawn: true });
    this.D = D;
    this.spr = SPR[D.spr];
    const diff = G.run ? G.run.diff : { hp: 1, dmg: 1 };
    this.maxHp = this.hp = Math.round(D.hp * (0.85 + diff.hp * 0.15) * (G.run ? G.run.bossHpMul : 1));
    this.dmgMul = 0.9 + diff.dmg * 0.1;
    this.phase = 1; this.state = 'intro'; this.cd = 1.2; this.flying = !!D.flying;
    this.last = null; this.stagger = 0;
    this.minions = [];
  }
  get boss() { return true; }
  takenMult(h) {
    let m = this.state === 'stagger' ? 1.3 : 1;
    const T = BOSS_TRAITS[this.type];
    if (T && T.taken) m *= T.taken(this, h);
    return m;
  }
  onHurt(h) {
    if (this.dead || this.state === 'intro') return;
    const T = BOSS_TRAITS[this.type];
    if (T && T.hurt) T.hurt(this, h);
    if (this.noStagger) return;
    this.poiseDmg += h.heavy ? 3 : 1;
    if (this.poiseDmg >= this.D.poise && this.state !== 'stagger' && this.canStagger()) {
      this.poiseDmg = 0;
      this.cancelAttack();
      this.setState('stagger', 'hurt');
      this.vx = (h.dir || 1) * 80;
      FX.text(this.x, this.y - this.h - 10, '破防!', '#ffd36a', { size: 12 });
      Sound.play('clank', { x: this.x, pitch: 0.6 });
      Cam.shake(0.3);
    }
  }
  canStagger() { return !['jump', 'hover', 'slam', 'tpout', 'tpin', 'roar'].includes(this.state); }
  die(h) {
    if (this.dead) return;
    this.dead = true; this.hp = 0;
    this.cancelAttack();
    for (const m of this.minions) if (!m.dead) { m.hp = 0; m.die({}); }
    G.onBossKilled(this);
  }
  update(dt) {
    if (this.dead) return;
    tickStatus(this, dt);
    if (this.dead) return;
    this.flash -= dt; this.tele -= dt;
    this.poiseDmg = Math.max(0, this.poiseDmg - dt * 2);
    const frozen = this.st.stun > 0;
    const slow = frozen ? 0.25 : 1 - Math.min(0.3, this.st.slow * 0.5);
    const sdt = dt * slow * (this.haste || 1);
    this.stT += sdt; this.cd -= sdt; this.animT += sdt;
    if (this.phase === 1 && this.hp < this.maxHp * (this.phase2At || 0.55)) this.enterPhase(2);
    if (this.phase === 2 && this.type === 'king' && this.hp < this.maxHp * 0.25) this.enterPhase(3);
    const T = BOSS_TRAITS[this.type];
    if (T && T.update && this.state !== 'intro') T.update(this, sdt);
    if (G.cine <= 0 && G.player && !G.player.dead) {
      if (this.state === 'stagger') { this.vx = approach(this.vx, 0, 300 * dt); if (this.stT > 1.3) { this.setState('idle', 'idle'); this.cd = 0.4; } }
      else if (this.state !== 'intro') this.bossAI(sdt);
    } else if (this.state !== 'intro' && G.player && G.player.dead) { this.vx = approach(this.vx, 0, 400 * dt); this.setAnim('idle'); }
    if (!this.flying || this.state === 'stagger') {
      if (!this.noGrav) this.vy = Math.min(this.vy + GRAV * dt * (this.gravMul || 1), 900);
    }
    moveBody(this, dt, G.room);
    this.minions = this.minions.filter(m => !m.dead);
  }
  enterPhase(n) {
    this.phase = n;
    this.cancelAttack();
    this.setState('roar', 'idle');
    this.vx = 0;
    Sound.play('roar');
    FX.screenFlash(BIOME_GLOW[this.bi], 0.4, 0.4);
    FX.ring(this.x, this.cy, 10, 160, BIOME_GLOW[this.bi], 0.6, 4);
    Cam.shake(0.6);
    G.bossPhaseText = { t: 2, text: n === 3 ? '终焉形态' : '狂暴化' };
    const T = BOSS_TRAITS[this.type];
    if (T && T.phase) T.phase(this, n);
  }
  pickAttack(list) {
    const opts = list.filter(a => a.ok === undefined || a.ok);
    let tot = 0; for (const a of opts) tot += a.w * (a.id === this.last ? 0.3 : 1);
    let r = Math.random() * tot;
    for (const a of opts) { r -= a.w * (a.id === this.last ? 0.3 : 1); if (r <= 0) { this.last = a.id; return a.id; } }
    return opts[0].id;
  }
  bossAI(dt) {
    if (this.state === 'roar') { if (this.stT > 1.2) { this.setState('idle', 'idle'); this.cd = 0.3; } return; }
    BOSS_AI[this.type](this, dt);
  }
  draw(ctx, gctx, cx, cy) {
    const x = this.x - cx, y = this.y - cy;
    const glow = BIOME_GLOW[this.bi];
    Light.add(this.x, this.cy, 130, glow, 0.6);
    if (this.hidden) return;
    const fr = this.frame();
    if (!this.flying) {
      ctx.globalAlpha = 0.35; ctx.fillStyle = '#000';
      const gy = G.room.floorBelow(this.x, this.y - 2) - cy;
      ctx.fillRect(Math.round(x - this.w * 0.7), Math.round(gy - 1), Math.round(this.w * 1.4), 3);
      ctx.globalAlpha = 1;
    } else {
      const gy = G.room.floorBelow(this.x, this.y) - cy;
      ctx.globalAlpha = 0.25; ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(x, gy, 16, 3, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (this.phase > 1) {
      const a = 0.35 + 0.2 * Math.sin(G.time * 8);
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) drawFrame(ctx, fr, this.spr.ox, this.spr.oy, x + ox, y + oy, this.face < 0, { tint: glow, alpha: a });
    }
    const o = {};
    if (this.flash > 0) { o.blend = '#ffffff'; o.blendAmt = 0.45; }
    else {
      if (this.st.stun > 0) { o.blend = '#ffe9a0'; o.blendAmt = 0.35; }
      else if (this.tele > 0 && Math.floor(G.time * 16) % 2) { o.blend = '#ff3048'; o.blendAmt = 0.4; }
      else if (this.state === 'stagger') { o.blend = '#ffd36a'; o.blendAmt = 0.25 + 0.15 * Math.sin(G.time * 20); }
    }
    if (this.blink !== undefined && this.blink < 1) o.alpha = this.blink;
    drawFrame(ctx, fr, this.spr.ox, this.spr.oy, x, y, this.face < 0, o);
    if (this.tele > 0) Text.draw(ctx, '!', x, y - this.h - 18 - Math.sin(G.time * 20) * 2, { size: 12, color: '#ff3048', outline: '#200008', align: 'center' });
    if (this.state === 'stagger') for (let i = 0; i < 3; i++) {
      const a = G.time * 6 + i * TAU / 3;
      ctx.fillStyle = '#ffe14a'; ctx.fillRect(Math.round(x + Math.cos(a) * 12), Math.round(y - this.h - 6 + Math.sin(a) * 3), 2, 2);
    }
    if (this.drawExtra) this.drawExtra(ctx, gctx, x, y);
  }
}

// ---------- boss helpers ----------
function bossBox(b, rel, dmg, dur, o) { return Combat.box(b, 'e', rel, { dmg: dmg * b.dmgMul }, dur, o); }
function warnMarker(x, y, r, col, dur) { FX.circle(x, y, r, col, dur, { sy: 0.3, a: 0.5, pulse: true, layer: 0 }); }

const BOSS_AI = {
  // ===================== ONI WARLORD =====================
  warden(b, dt) {
    const p = G.player, dx = p.x - b.x, d = Math.abs(dx);
    const fast = b.phase > 1 ? 0.8 : 1;
    const col = '#ffa040';
    switch (b.state) {
      case 'idle': {
        b.faceTarget();
        if (d > 70) { b.vx = approach(b.vx, b.face * b.D.speed * (b.phase > 1 ? 1.25 : 1), 400 * dt); b.setAnim('walk'); }
        else { b.vx = approach(b.vx, 0, 600 * dt); b.setAnim('idle'); }
        if (b.cd <= 0) {
          const a = b.pickAttack([
            { id: 'slash', w: d < 90 ? 4 : 0.5 },
            { id: 'dash', w: d > 90 ? 3 : 1 },
            { id: 'missiles', w: 2 },
            { id: 'slam', w: 1.6 },
            { id: 'laser', w: 2.2, ok: b.phase > 1 },
          ]);
          b.vx = 0;
          if (a === 'slash') { b.setState('windSlash', 'windSlash'); b.telegraph(0.55 * fast); }
          else if (a === 'dash') { b.setState('windDash', 'crouch'); b.telegraph(0.5 * fast); Sound.play('charge', { x: b.x, pitch: 0.6 }); }
          else if (a === 'missiles') { b.setState('pods', 'pods'); Sound.play('warn', { x: b.x }); }
          else if (a === 'slam') { b.setState('crouch', 'crouch'); b.telegraph(0.4); }
          else if (a === 'laser') { b.setState('aim', 'aim'); b.laserY = p.cy; Sound.play('charge', { x: b.x, pitch: 0.4 }); }
        }
        break;
      }
      case 'windSlash':
        b.faceTarget();
        if (b.stT > 0.55 * fast) {
          b.setState('slash', 'slash'); b.vx = b.face * 160;
          bossBox(b, [-14, -74, 96, 74], b.D.dmg, 0.16);
          FX.slash(b.x + b.face * 14, b.y - 36, { r: 50, a0: -120, a1: 80, th: 12, c: col, f: b.face, dur: 0.25, sy: 0.9 });
          Sound.play('slashHeavy', { x: b.x, pitch: 0.6 }); Cam.shake(0.3);
        }
        break;
      case 'slash':
        b.vx = approach(b.vx, 0, 600 * dt);
        if (b.stT > 0.7 * fast) { b.setState('idle', 'idle'); b.cd = rand(0.5, 1.0) * fast; }
        break;
      case 'windDash':
        b.faceTarget();
        if (b.stT > 0.5 * fast) { b.setState('dash', 'dash'); b.dx0 = b.x; b.dbox = bossBox(b, [-10, -60, 60, 60], b.D.dmg, 3); Sound.play('dash', { x: b.x, pitch: 0.5 }); }
        break;
      case 'dash':
        b.vx = b.face * (b.phase > 1 ? 420 : 360);
        FX.ghost(b.frame(), b.spr.ox, b.spr.oy, b.x, b.y, b.face < 0, col, 0.25, 0.4);
        if (Math.random() < 0.5) FX.sparks(b.x - b.face * 10, b.y - 2, b.face > 0 ? Math.PI : 0, '#ffd36a', 2);
        if (b.hitWall || Math.abs(b.x - b.dx0) > 320 || b.stT > 1.2) {
          if (b.dbox) b.dbox.life = 0;
          if (b.hitWall) { Cam.shake(0.35); Sound.play('stomp', { x: b.x }); }
          b.setState('recover', 'idle'); b.vx = 0;
        }
        break;
      case 'pods':
        if (b.stT > 0.4 && !b.fired) {
          b.fired = true;
          const n = b.phase > 1 ? 8 : 5;
          for (let i = 0; i < n; i++) {
            later(i * 0.12, () => {
              if (b.dead) return;
              const tx = clamp(p.x + rand(-90, 90) + (i === 0 ? 0 : 0), 3 * TILE, G.room.pw - 3 * TILE);
              const ty = G.room.floorBelow(tx, p.y - 30);
              warnMarker(tx, ty, 22, col, 1.1);
              const pr = new Proj({ team: 'e', x: b.x - b.face * 10, y: b.y - 70, vx: rand(-60, 60), vy: -420, kind: 'talisman', c: col, r: 3, life: 3, ghost: true, dmg: 0 });
              pr.upd = (q, ddt) => { if (q.t > 0.45 && !q.dive) { q.dive = true; q.x = tx; q.y = G.room.ph > 300 ? Cam.y - 20 : -20; q.vx = 0; q.vy = 520; } if (q.dive && q.y >= ty - 2) { q.life = 0; explodeE(tx, ty - 6, 24, 14 * b.dmgMul); } };
              pr.noHit = true;
              G.projs.push(pr);
              Sound.play('shoot', { x: b.x, pitch: 0.5 });
            });
          }
        }
        if (b.stT > 1.3) { b.fired = false; b.setState('idle', 'idle'); b.cd = rand(0.8, 1.4) * fast; }
        break;
      case 'crouch':
        b.vx = 0;
        if (b.stT > 0.45) { b.setState('jump', 'air'); b.vy = -760; b.noGrav = false; Sound.play('dash', { x: b.x, pitch: 0.4 }); FX.dust(b.x, b.y, 12, 0); }
        break;
      case 'jump':
        b.vx = approach(b.vx, clamp(dx * 2, -260, 260), 800 * dt);
        if (b.vy > -100) { b.setState('hover', 'air'); b.noGrav = true; b.vy = 0; }
        break;
      case 'hover': {
        b.vy = 0; b.vx = approach(b.vx, clamp(dx * 3, -300, 300), 900 * dt);
        const gy = G.room.floorBelow(b.x, b.y);
        if (Math.random() < 0.5) warnMarker(b.x, gy, 30, col, 0.12);
        if (b.stT > 0.55 * fast) { b.setState('slam', 'air'); b.noGrav = false; b.vy = 900; b.vx = 0; }
        break;
      }
      case 'slam':
        b.vx = 0;
        if (b.onGround) {
          b.setState('recover', 'crouch');
          Cam.shake(0.7); Sound.play('stomp', { x: b.x }); Sound.play('explode', { x: b.x, pitch: 0.6 });
          FX.shock(b.x, b.y, col, 70); FX.debris(b.x, b.y - 2, ['#a08a7a', col, '#ffffff'], 16);
          const pp = G.player; if (Math.abs(pp.x - b.x) < 50 && pp.y > b.y - 50) hurtPlayer(20 * b.dmgMul, b.x);
          eShockwave(b, b.x + 20, b.y, 1, 14 * b.dmgMul); eShockwave(b, b.x - 20, b.y, -1, 14 * b.dmgMul);
        }
        break;
      case 'aim': {
        b.vx = 0; b.faceTarget();
        if (b.stT < 0.65) b.laserY = lerp(b.laserY, p.cy, 0.12);
        if (b.stT > 0.95) {
          b.setState('fire', 'aim');
          Sound.play('beam', { x: b.x }); Cam.shake(0.3);
          const y0 = b.laserY, f = b.face, x0 = b.x + f * 30;
          FX.beam(x0, y0, 600, 12, f > 0 ? 0 : Math.PI, col, 0.55);
          const bx = f > 0 ? x0 : x0 - 600;
          Combat.area('e', bx, y0 - 6, 600, 12, { dmg: 20 * b.dmgMul }, 0.5, { owner: b });
        }
        break;
      }
      case 'fire':
        if (b.stT > 0.7) { b.setState('idle', 'idle'); b.cd = rand(0.6, 1.0); }
        break;
      case 'recover':
        b.vx = approach(b.vx, 0, 800 * dt);
        if (b.stT > 0.75 * fast) { b.setState('idle', 'idle'); b.cd = rand(0.4, 0.9) * fast; }
        break;
      default: b.setState('idle', 'idle');
    }
  },

  // ===================== CRYSTAL EMPRESS =====================
  empress(b, dt) {
    const p = G.player, dx = p.x - b.x;
    const fast = b.phase > 1 ? 0.8 : 1;
    const col = '#45f0ff';
    const homeY = G.room.base * TILE - 30;
    const hover = () => {
      const tx = clamp(p.x + (b.x < p.x ? -110 : 110), 4 * TILE, G.room.pw - 4 * TILE);
      b.vx = approach(b.vx, clamp((tx - b.x) * 1.2, -90, 90), 200 * dt);
      b.vy = approach(b.vy, clamp((homeY + Math.sin(G.time * 1.5) * 10 - b.y) * 2, -80, 80), 300 * dt);
    };
    switch (b.state) {
      case 'idle': {
        b.faceTarget(); hover(); b.setAnim('idle');
        if (b.cd <= 0) {
          const a = b.pickAttack([
            { id: 'fan', w: 3 }, { id: 'spikes', w: 2.4 }, { id: 'rain', w: 2 },
            { id: 'summon', w: 1.4, ok: b.minions.length < 2 },
            { id: 'tp', w: 1.2 }, { id: 'lasers', w: 2.4, ok: b.phase > 1 },
          ]);
          b.n = 0;
          if (a === 'fan') { b.setState('fan', 'point'); b.telegraph(0.4); }
          else if (a === 'spikes') { b.setState('spikes', 'cast'); b.telegraph(0.4); }
          else if (a === 'rain') { b.setState('rain', 'cast'); Sound.play('warn', { x: b.x }); }
          else if (a === 'summon') { b.setState('summon', 'cast'); }
          else if (a === 'tp') { b.setState('tpout', 'idle'); Sound.play('teleport', { x: b.x }); }
          else if (a === 'lasers') { b.setState('lasers', 'cast'); b.telegraph(0.6); b.lang = rand(0, TAU); Sound.play('charge', { x: b.x, pitch: 0.5 }); }
        }
        break;
      }
      case 'fan': {
        b.vx = approach(b.vx, 0, 300 * dt); b.vy = approach(b.vy, 0, 300 * dt); b.faceTarget();
        const vol = b.phase > 1 ? 3 : 2;
        if (b.stT > 0.4 + b.n * 0.45 && b.n < vol) {
          b.n++;
          const a0 = Math.atan2(p.cy - (b.y - 64), p.x - b.x);
          const k = b.phase > 1 ? 9 : 7;
          for (let i = 0; i < k; i++) {
            const a = a0 + (i - (k - 1) / 2) * 0.16 + (b.n % 2 ? 0.08 : 0);
            G.projs.push(new Proj({ team: 'e', x: b.x + b.face * 8, y: b.y - 64, vx: Math.cos(a) * 165, vy: Math.sin(a) * 165, kind: 'shard', r: 3, c: col, c2: '#ffffff', dmg: 13 * b.dmgMul, life: 3.5 }));
          }
          Sound.play('ice', { x: b.x }); Sound.play('laser', { x: b.x, pitch: 1.5 });
        }
        if (b.stT > 0.5 + vol * 0.45 + 0.4) { b.setState('idle', 'idle'); b.cd = rand(0.7, 1.3) * fast; }
        break;
      }
      case 'spikes': {
        b.vx = approach(b.vx, 0, 300 * dt); b.vy = approach(b.vy, 0, 300 * dt);
        if (b.stT > 0.4 && !b.fired) {
          b.fired = true;
          const dir = sign(dx) || 1;
          const n = b.phase > 1 ? 12 : 9;
          for (let i = 0; i < n; i++) {
            const sx = b.x + dir * (20 + i * 24);
            if (sx < 2.5 * TILE || sx > G.room.pw - 2.5 * TILE) continue;
            const sy = G.room.floorBelow(sx, b.y);
            later(i * 0.1, () => {
              FX.circle(sx, sy, 9, col, 0.45, { sy: 0.4, a: 0.6, pulse: true, layer: 0 });
              later(0.45, () => {
                Sound.play('shatter', { x: sx, pitch: 1.2 });
                FX.customDraw(sx, sy, 0.5, (ctx, gctx, x, y, t) => {
                  const h = 30 * (t < 0.2 ? t / 0.2 : 1) * (t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1);
                  ctx.fillStyle = '#5ad8f0'; ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x - 1, y - h); ctx.lineTo(x + 6, y); ctx.fill();
                  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(x - 1, y); ctx.lineTo(x - 1, y - h); ctx.lineTo(x + 2, y); ctx.fill();
                  gctx.fillStyle = col; gctx.fillRect(x - 4, y - h, 8, h);
                });
                Combat.area('e', sx - 6, sy - 30, 12, 30, { dmg: 16 * b.dmgMul }, 0.25, { owner: b });
              });
            });
          }
        }
        if (b.stT > 1.6) { b.fired = false; b.setState('idle', 'idle'); b.cd = rand(0.6, 1.1) * fast; }
        break;
      }
      case 'rain': {
        b.vx = approach(b.vx, 0, 300 * dt); b.vy = approach(b.vy, 0, 300 * dt);
        if (b.stT > 0.3 && !b.fired) {
          b.fired = true;
          const n = b.phase > 1 ? 14 : 10;
          for (let i = 0; i < n; i++) {
            later(i * 0.12, () => {
              const rx = clamp(p.x + rand(-120, 120), 3 * TILE, G.room.pw - 3 * TILE);
              const ry = G.room.floorBelow(rx, p.y - 60);
              FX.tline(rx, ry - 200, rx, ry, col, 0.7, 1);
              later(0.7, () => {
                G.projs.push(new Proj({ team: 'e', x: rx, y: ry - 180, vx: 0, vy: 600, kind: 'shard', r: 3.5, c: '#bff8ff', c2: '#ffffff', dmg: 14 * b.dmgMul, life: 1, ghost: true, upd: (q) => { if (q.y >= ry - 2) { q.life = 0; FX.burst(rx, ry - 2, { n: 6, c: ['#bff8ff', col], sp: [40, 120], life: [0.2, 0.4], glow: true }); } } }));
              });
            });
          }
        }
        if (b.stT > 2.0) { b.fired = false; b.setState('idle', 'idle'); b.cd = rand(0.6, 1.0) * fast; }
        break;
      }
      case 'summon':
        b.vx = approach(b.vx, 0, 300 * dt); b.vy = approach(b.vy, 0, 300 * dt);
        if (b.stT > 0.6 && !b.fired) {
          b.fired = true;
          for (let i = 0; i < 2; i++) {
            const m = new Enemy('drone', b.x + (i ? 40 : -40), b.y - 50);
            m.hp = m.maxHp = Math.round(m.maxHp * 0.8);
            G.enemies.push(m); b.minions.push(m);
          }
          Sound.play('upgrade');
        }
        if (b.stT > 1.0) { b.fired = false; b.setState('idle', 'idle'); b.cd = rand(0.8, 1.2); }
        break;
      case 'tpout':
        b.blink = 1 - b.stT / 0.35; b.intangible = true; b.vx = 0; b.vy = 0;
        if (b.stT > 0.35) {
          b.x = clamp(p.x + (p.x > G.room.pw / 2 ? -1 : 1) * rand(120, 170), 4 * TILE, G.room.pw - 4 * TILE);
          b.y = homeY;
          b.setState('tpin'); Sound.play('teleport', { x: b.x, pitch: 1.3 });
          FX.burst(b.x, b.y - 64, { n: 20, c: [col, '#ffffff', '#b28cff'], sp: [40, 140], glow: true });
        }
        break;
      case 'tpin':
        b.blink = b.stT / 0.35; b.intangible = false;
        if (b.stT > 0.35) { b.blink = 1; b.setState('idle', 'idle'); b.cd = rand(0.2, 0.5); }
        break;
      case 'lasers': {
        b.vx = approach(b.vx, 0, 300 * dt); b.vy = approach(b.vy, 0, 300 * dt);
        const on = b.stT > 0.7;
        b.lang += dt * (on ? 0.9 : 0.2);
        b.lasersOn = on;
        if (on) {
          Light.add(b.x, b.y - 64, 200, col, 0.8);
          const pl = G.player, ox = b.x, oy = b.y - 64;
          for (let k = 0; k < 4; k++) {
            const a = b.lang + k * Math.PI / 2;
            const vx = Math.cos(a), vy = Math.sin(a);
            const rx = pl.x - ox, ry = pl.cy - oy;
            const along = rx * vx + ry * vy;
            if (along > 0 && along < 260 && Math.abs(rx * vy - ry * vx) < 7) hurtPlayer(14 * b.dmgMul, ox);
          }
          if (Math.random() < 0.3) Sound.play('zap', { x: b.x, pitch: 0.6 });
        }
        if (b.stT > 3.6) { b.lasersOn = false; b.setState('idle', 'idle'); b.cd = rand(0.6, 1.0); }
        break;
      }
      default: b.setState('idle', 'idle');
    }
  },

  // ===================== ENTROPY KING =====================
  king(b, dt) {
    const p = G.player, dx = p.x - b.x, d = Math.abs(dx);
    const fast = b.phase === 3 ? 0.65 : b.phase === 2 ? 0.8 : 1;
    const col = '#ff3048';
    switch (b.state) {
      case 'idle': {
        b.faceTarget();
        if (d > 80) { b.vx = approach(b.vx, b.face * b.D.speed * (1.2 - fast * 0.2), 500 * dt); b.setAnim('walk'); }
        else { b.vx = approach(b.vx, 0, 600 * dt); b.setAnim('idle'); }
        if (b.cd <= 0) {
          const a = b.pickAttack([
            { id: 'combo', w: d < 110 ? 4 : 1 },
            { id: 'waves', w: 2.2 },
            { id: 'tele', w: 1.8 },
            { id: 'orbs', w: 2 },
            { id: 'meteor', w: 1.6 },
            { id: 'clones', w: 2, ok: b.phase >= 2 },
            { id: 'sing', w: 2.2, ok: b.phase >= 3 },
          ]);
          b.vx = 0; b.n = 0; b.fired = false;
          if (a === 'combo') { b.setState('cwind', 'wind'); b.telegraph(0.5 * fast); }
          else if (a === 'waves') { b.setState('waves', 'wind'); b.telegraph(0.5); }
          else if (a === 'tele') { b.setState('tpout', 'idle'); Sound.play('teleport', { x: b.x, pitch: 0.6 }); }
          else if (a === 'orbs') { b.setState('orbs', 'cast'); Sound.play('void', { x: b.x }); }
          else if (a === 'meteor') { b.setState('meteor', 'cast'); Sound.play('warn', { x: b.x }); }
          else if (a === 'clones') { b.setState('clones', 'cast'); Sound.play('void', { x: b.x, pitch: 0.6 }); }
          else if (a === 'sing') { b.setState('sing', 'cast'); Sound.play('roar'); }
        }
        break;
      }
      case 'cwind':
        b.faceTarget();
        if (b.stT > (b.n === 0 ? 0.5 : 0.32) * fast) {
          b.setState('cslash', 'slash'); b.vx = b.face * 230;
          bossBox(b, [-12, -68, 88, 68], b.D.dmg, 0.15);
          FX.slash(b.x + b.face * 14, b.y - 32, { r: 46, a0: b.n % 2 ? 90 : -120, a1: b.n % 2 ? -120 : 80, th: 11, c: col, f: b.face, dur: 0.24 });
          Sound.play('slashHeavy', { x: b.x, pitch: 0.7 }); Cam.shake(0.25);
        }
        break;
      case 'cslash':
        b.vx = approach(b.vx, 0, 900 * dt);
        if (b.stT > 0.32 * fast) {
          b.n++;
          const max = b.phase >= 2 ? 4 : 3;
          if (b.n < max) { b.setState('cwind', 'wind'); b.tele = 0.2; }
          else { b.setState('recover', 'idle'); }
        }
        break;
      case 'waves': {
        b.vx = 0;
        const max = b.phase >= 2 ? 4 : 3;
        if (b.stT > 0.5 + b.n * 0.38 && b.n < max) {
          b.n++; b.faceTarget();
          const high = b.n % 2 === 0;
          b.setAnim('slash'); b.animT = 0;
          const wy = high ? b.y - 34 : b.y - 10;
          G.projs.push(new Proj({ team: 'e', x: b.x + b.face * 20, y: wy, vx: b.face * 270, vy: 0, kind: 'wave', r: 6, hh: high ? 10 : 12, c: col, c2: '#ffd0d8', dmg: 15 * b.dmgMul, life: 2.6, ghost: true, light: 60 }));
          Sound.play('slashHeavy', { x: b.x, pitch: 0.9 });
          FX.text(b.x + b.face * 30, wy - 16, high ? '▼' : '▲', '#ffd36a', { size: 8, life: 0.5 });
        }
        if (b.stT > 0.6 + max * 0.38 + 0.3) b.setState('recover', 'idle');
        break;
      }
      case 'tpout':
        b.blink = 1 - b.stT / 0.35; b.intangible = true; b.vx = 0;
        if (b.stT > 0.35) {
          const side = -p.face || 1;
          b.x = clamp(p.x + side * 46, 3 * TILE, G.room.pw - 3 * TILE);
          b.y = G.room.floorBelow(b.x, p.y - 20);
          b.face = sign(p.x - b.x) || 1;
          b.setState('tpin', 'wind'); b.telegraph(0.4 * fast);
          Sound.play('teleport', { x: b.x, pitch: 0.8 });
          FX.burst(b.x, b.cy, { n: 18, c: [col, '#000000', '#ffd0d8'], sp: [40, 140], glow: true });
        }
        break;
      case 'tpin':
        b.blink = Math.min(1, b.stT / 0.2); b.intangible = false;
        if (b.stT > 0.42 * fast) {
          b.blink = 1;
          b.setState('cslash', 'slash'); b.n = 99;
          bossBox(b, [-12, -68, 90, 68], b.D.dmg * 1.1, 0.15);
          FX.slash(b.x + b.face * 14, b.y - 32, { r: 48, a0: -130, a1: 85, th: 12, c: col, f: b.face, dur: 0.24 });
          Sound.play('slashHeavy', { x: b.x, pitch: 0.6 }); Cam.shake(0.3);
        }
        break;
      case 'orbs': {
        b.vx = 0;
        const rings = b.phase >= 2 ? 3 : 2;
        if (b.stT > 0.5 + b.n * 0.5 && b.n < rings) {
          b.n++;
          const k = 14 + b.phase * 2, off = b.n * 0.2;
          for (let i = 0; i < k; i++) {
            const a = off + i * TAU / k;
            G.projs.push(new Proj({ team: 'e', x: b.x, y: b.y - 40, vx: Math.cos(a) * 110, vy: Math.sin(a) * 110, kind: 'orb', r: 3, c: col, c2: '#ffd0d8', dmg: 12 * b.dmgMul, life: 4, ghost: true, light: 0 }));
          }
          Sound.play('void', { x: b.x, pitch: 1.2 });
          FX.ring(b.x, b.y - 40, 6, 40, col, 0.3, 3);
        }
        if (b.stT > 0.6 + rings * 0.5 + 0.3) b.setState('recover', 'idle');
        break;
      }
      case 'meteor':
        b.vx = 0;
        if (b.stT > 0.4 && !b.fired) {
          b.fired = true;
          const n = b.phase >= 2 ? 7 : 5;
          for (let i = 0; i < n; i++) {
            const mx = clamp(p.x + (i - (n - 1) / 2) * 44 + rand(-10, 10), 3 * TILE, G.room.pw - 3 * TILE);
            const my = G.room.floorBelow(mx, p.y - 40);
            later(i * 0.14, () => {
              warnMarker(mx, my, 20, col, 0.9);
              later(0.9, () => {
                FX.add({ k: 'streak', x: mx, y: my - 10, vx: 0, vy: 2400, life: 0.12, c: '#ffd0d8', len: 0.08, w: 4 });
                explodeE(mx, my - 8, 26, 16 * b.dmgMul, { c: col });
              });
            });
          }
        }
        if (b.stT > 1.8) b.setState('recover', 'idle');
        break;
      case 'clones':
        b.vx = 0;
        if (b.stT > 0.5 && !b.fired) {
          b.fired = true;
          const ys = [p.y, p.y];
          [-1, 1].forEach((side, i) => {
            const sx = side < 0 ? 3 * TILE + 10 : G.room.pw - 3 * TILE - 10;
            const sy = G.room.floorBelow(sx, ys[i] - 20);
            FX.tline(sx, sy - 20, side < 0 ? G.room.pw - 3 * TILE : 3 * TILE, sy - 20, col, 0.8, 2);
            later(0.85 + i * 0.35, () => {
              const dir = -side;
              addZone({
                x: sx, y: sy, life: 0.8,
                upd(z, ddt) {
                  z.x += dir * 600 * ddt;
                  FX.ghost(animFrame(b.spr, 'thrust', 0), b.spr.ox, b.spr.oy, z.x, z.y, dir < 0, col, 0.3, 0.6);
                  const pl = G.player;
                  if (!z.hit && Math.abs(pl.x - z.x) < 22 && pl.y > z.y - 66 && pl.y - pl.h < z.y) { z.hit = true; hurtPlayer(16 * b.dmgMul, z.x - dir * 10); }
                  if (z.x < 2 * TILE || z.x > G.room.pw - 2 * TILE) z.life = 0;
                },
              });
              Sound.play('dash', { x: sx, pitch: 0.5 }); Sound.play('slashHeavy', { x: sx });
            });
          });
        }
        if (b.stT > 2.0) b.setState('recover', 'idle');
        break;
      case 'sing': {
        b.vx = 0;
        const pl = G.player;
        if (b.stT < 3.2) {
          const pull = sign(b.x - pl.x) * 70;
          if (!pl.dead && pl.state !== 'dash') pl.x += pull * dt;
          if (Math.random() < 0.6) {
            const a = rand(0, TAU), r = rand(80, 160);
            FX.add({ k: 'px', x: b.x + Math.cos(a) * r, y: b.cy + Math.sin(a) * r * 0.6, vx: -Math.cos(a) * r * 1.5, vy: -Math.sin(a) * r, life: 0.6, s: 2, c: pick([col, '#000000', '#ffd0d8']), glow: true });
          }
          if (Math.floor(b.stT / 0.45) > b.n) {
            b.n++;
            const k = 10;
            for (let i = 0; i < k; i++) {
              const a = b.n * 0.37 + i * TAU / k;
              G.projs.push(new Proj({ team: 'e', x: b.x, y: b.y - 40, vx: Math.cos(a) * 95, vy: Math.sin(a) * 95, kind: 'orb', r: 3, c: '#ffd0d8', c2: col, dmg: 12 * b.dmgMul, life: 4, ghost: true, light: 0 }));
            }
            Sound.play('void', { x: b.x, pitch: 1.4 });
          }
        } else b.setState('recover', 'idle');
        break;
      }
      case 'recover':
        b.vx = approach(b.vx, 0, 900 * dt);
        if (b.stT > 0.7 * fast) { b.setState('idle', 'idle'); b.cd = rand(0.4, 0.9) * fast; }
        break;
      default: b.setState('idle', 'idle');
    }
  },
};
Boss.prototype.drawExtra = function (ctx, gctx, x, y) {
  if (this.type === 'warden' && this.state === 'aim') {
    const lx = x + this.face * 30, ly = this.laserY - Cam.ry;
    ctx.globalAlpha = Math.floor(G.time * 24) % 2 ? 0.8 : 0.35;
    ctx.strokeStyle = '#ffa040'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + this.face * 600, ly); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (this.type === 'empress') {
    // orbiting crystals
    for (let i = 0; i < 5; i++) {
      const a = G.time * 1.4 + i * TAU / 5;
      const ox = x + Math.cos(a) * 34, oy = y - 64 + Math.sin(a) * 12;
      ctx.fillStyle = Math.sin(a) > 0 ? '#bff8ff' : '#5ad8f0';
      ctx.beginPath(); ctx.moveTo(ox, oy - 4); ctx.lineTo(ox + 2, oy); ctx.lineTo(ox, oy + 4); ctx.lineTo(ox - 2, oy); ctx.fill();
      gctx.fillStyle = '#45f0ff'; gctx.fillRect(ox - 2, oy - 3, 4, 6);
    }
    if (this.lasersOn) {
      for (let k = 0; k < 4; k++) {
        const a = this.lang + k * Math.PI / 2;
        FX.add({ k: 'beam', x: this.x, y: this.y - 64, len: 260, w: 7, ang: a, c: '#45f0ff', life: 1 / 60 });
      }
    } else if (this.state === 'lasers') {
      ctx.globalAlpha = 0.5; ctx.strokeStyle = '#45f0ff';
      for (let k = 0; k < 4; k++) { const a = this.lang + k * Math.PI / 2; ctx.beginPath(); ctx.moveTo(x, y - 64); ctx.lineTo(x + Math.cos(a) * 260, y - 64 + Math.sin(a) * 260); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
  }
  if (this.type === 'king' && this.state === 'sing') {
    const r = 30 + Math.sin(G.time * 10) * 4;
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(x, y - 40, 10, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ff3048'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y - 40, r * 0.5, 0, TAU); ctx.stroke();
    gctx.fillStyle = '#ff3048'; gctx.beginPath(); gctx.arc(x, y - 40, r, 0, TAU); gctx.fill();
  }
  const T = BOSS_TRAITS[this.type];
  if (T && T.draw) T.draw(this, ctx, gctx, x, y);
};
// per-boss signature mechanics (filled in bosses2.js)
const BOSS_TRAITS = {};
