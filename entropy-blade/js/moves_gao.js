'use strict';
// =====================================================================
//  GAO — 武技 (direction arts), 秘技 派生 follow-ups, 镇岳
// =====================================================================
(() => {
const M = HEROES.gao.moves;
const C = GAO_C, FL = '#ff6a2a', ROCK = '#b89a6a';
const air = o => Object.assign({}, G_AIR, o);
const PUNCH0 = { lean: 4, aF: [150, -80], aB: [60, -60] }, PUNCH1 = { lean: 30, aF: [0, 0], aB: [140, 160] };
const UPC0 = { lean: 20, aF: [100, 60], ...G_SQUAT }, UPC1 = { gl: 0.4, lean: -10, aF: [-80, -95], aB: [110, 60], lF: [85, 110], lB: [100, 130] };
const RAISE = { lean: -14, aF: [-110, -90], aB: [-100, -80] }, SLAM = { lean: 44, aF: [80, 95], aB: [85, 98], lF: [25, 120], lB: [150, 110] };
const KICK_A = { lF: [0, 5], lB: [120, 150] }, KICK_B = { lF: [100, 140], lB: [180, 185] };
function rockShard(p, ang, o = {}) {
  const a = ang * DEG;
  G.projs.push(new Proj({ team: 'p', x: p.x + p.face * 30, y: p.y - (o.oy || 18), vx: Math.cos(a) * (o.sp || 420) * p.face, vy: Math.sin(a) * (o.sp || 420), grav: o.grav || 300, kind: 'shard', r: o.r || 3, spin: 12, c: ROCK, c2: '#fff0c8', life: o.life || 0.7, hit: p.makeHit({ dmg: o.dmg || 0.6, kx: 120, ky: -120, stun: 0.4, hs: 1, art: o.art }), light: 0 }));
}

Object.assign(M, {
  // ================= 炎龙 (↑) =================
  flame1: {
    label: '炎升拳', dur: 0.52, cancel: 0.36, armor: true, art: 'gao_flame',
    keys: [[0, UPC0], [0.08, UPC1, 'outCubic'], [0.52, { gl: 0, aF: [-70, -85], lF: [60, 120], lB: [100, 150] }]],
    hits: [{ t: 0.06, d: 0.14, box: [-6, -64, 38, 66], dmg: 1.5, kb: [40, -450], stun: 0.7, hs: 5, launch: true, status: ['burn', 2, 0.2] }],
    ev: [[0.06, p => {
      p.vy = -410; Sound.play('hitHeavy', { x: p.x, pitch: 1.2 }); Sound.play('fire', { x: p.x });
      hSlash(p, { x: 6, y: -26, r: 24, a0: 60, a1: -100, th: 9, c: FL, c2: '#ffd36a' });
    }]],
    update(p, mv) { if (mv.t > 0.06 && mv.t < 0.36) { FX.fire(p.x + p.face * 8, p.y - 30, 2, true); Light.add(p.x, p.y - 30, 80, FL, 0.7); } },
    next: 'flame2', nextLv: 2,
  },
  flame2: {
    label: '空中连拳', dur: 0.46, cancel: 0.32, air: true, grav: 0.1, art: 'gao_flame',
    keys: [
      [0, air({ aF: [60, -40] })], [0.05, air({ lean: 14, aF: [10, 10] }), 'outCubic'], [0.12, air({ aB: [60, -40], aF: [80, -20] })],
      [0.17, air({ lean: 18, aB: [10, 10], aF: [100, -10] }), 'outCubic'], [0.24, air({ aF: [150, -60] })], [0.3, air({ lean: 24, aF: [0, 0], aB: [140, 150] }), 'outCubic'], [0.46, air({})],
    ],
    hits: [0.05, 0.17, 0.3].map((t, i) => ({ t, d: 0.06, box: [0, -40, 34, 32], dmg: 0.7 + i * 0.2, kb: [50, i === 2 ? -120 : -170], stun: 0.45, hs: 3 })),
    ev: [0.05, 0.17, 0.3].map((t, i) => [t, p => { Sound.play(i === 2 ? 'hitHeavy' : 'swoosh', { x: p.x, pitch: 0.8 }); hPunchFx(p, 24, -24, i === 2, i === 2 ? FL : C); }]),
    next: 'flame3', nextLv: 3,
  },
  flame3: {
    label: '飞燕踢', dur: 0.44, cancel: 0.3, air: true, grav: 0.05, art: 'gao_flame',
    keys: altKeys(5, 0.07, air({ lean: 6, ...KICK_A, aF: [60, -40], aB: [80, -40] }), air({ lean: 6, ...KICK_B, aF: [60, -40], aB: [80, -40] })),
    onStart(p) { p.vy = Math.min(p.vy, -100); },
    hits: [0.06, 0.18].map(t => ({ t, d: 0.08, box: [-30, -46, 60, 46], dmg: 0.95, kb: [140, -160], stun: 0.5, hs: 3, radial: true })),
    ev: [0.06, 0.18].map(t => [t, p => { Sound.play('swoosh', { x: p.x, pitch: 0.75 }); FX.slash(p.x, p.y - 22, { r: 30, a0: -180, a1: 180, th: 5, c: FL, f: 1, sy: 0.4, dur: 0.14 }); }]),
    next: 'flame4', nextLv: 4,
  },
  flame4: diveMove({
    label: '坠龙击', art: 'gao_flame', dur: 0.78, cancel: 0.6, hop: -120, vx: 90, fall: 700, hold: 0.26, armor: true, fallDmg: 1.0, col: FL,
    keys: [[0, air({ lean: -16, aF: [-130, -110], aB: [-120, -105] })], [0.1, air({ lean: 40, aF: [85, 95], aB: [88, 98] }), 'outCubic'], [0.26, air({ lean: 40, aF: [85, 95], aB: [88, 98] })], [0.32, { ...SLAM }, 'outCubic'], [0.78, { lean: 12 }]],
    onDive(p) { Sound.play('fire', { x: p.x, pitch: 0.8 }); },
    onLand(p) {
      gaoQuake(p, 60, 2.6 * artMul(p, 'gao_flame'), 'heavy');
      explodeP(p.x, p.y - 12, 52, 1.6 * artMul(p, 'gao_flame'), { c: FL, c2: '#ffd36a', src: 'heavy', shake: 0.3, sound: 'fire', status: ['burn', 3, 0.25] });
      for (let i = 0; i < 6; i++) FX.fire(p.x + rand(-40, 40), p.y - rand(0, 10), 3, true);
      p.fire('onFinisher', null, { finisher: true });
    },
  }),

  // ================= 擎天 (↑) =================
  pillar1: {
    label: '擎天柱', dur: 0.5, cancel: 0.34, armor: true, art: 'gao_pillar',
    keys: [[0, { ...RAISE }], [0.1, { ...SLAM }, 'outCubic'], [0.5, { lean: 12 }]],
    ev: [[0.1, p => { Cam.shake(0.3); Sound.play('stomp', { x: p.x }); FX.dust(p.x + p.face * 14, p.y, 6, p.face); groundColumn(p, p.x + p.face * 44, 1.5, C, { rock: true, h: 62, w: 22 }); }]],
    hits: [{ t: 0.1, d: 0.06, box: [0, -30, 34, 30], dmg: 0.6, kb: [60, -200], stun: 0.4, hs: 3, launch: true }],
    next: 'pillar2', nextLv: 2,
  },
  pillar2: {
    label: '双柱', dur: 0.5, cancel: 0.34, armor: true, art: 'gao_pillar',
    keys: [[0, { ...RAISE, aF: [-100, -80] }], [0.1, { ...SLAM, lean: 40 }, 'outCubic'], [0.5, { lean: 12 }]],
    ev: [[0.1, p => {
      Cam.shake(0.35); Sound.play('stomp', { x: p.x, pitch: 0.9 });
      const x0 = p.x, f = p.face;
      groundColumn(p, x0 + f * 80, 1.4, C, { rock: true, h: 70, w: 22 });
      later(0.09, () => groundColumn(p, x0 + f * 118, 1.4, C, { rock: true, h: 78, w: 24, art: 'gao_pillar' }));
    }]],
    next: 'pillar3', nextLv: 3,
  },
  pillar3: {
    label: '碎岩拳', dur: 0.48, cancel: 0.32, armor: true, art: 'gao_pillar',
    keys: [[0, { ...PUNCH0, ...G_SQUAT }], [0.06, { ...PUNCH1, ...G_LUNGE }, 'outCubic'], [0.48, { lean: 12 }]],
    vel: [[0.03, 0.1, 180]],
    hits: [{ t: 0.06, d: 0.07, box: [0, -42, 40, 34], dmg: 1.4, kb: [300, -120], stun: 0.6, hs: 6, heavy: true }],
    ev: [[0.06, p => {
      Sound.play('hitHeavy', { x: p.x, pitch: 0.8 }); Sound.play('shatter', { x: p.x, pitch: 0.7 }); hPunchFx(p, 28, -26, true);
      for (let i = 0; i < 6; i++) rockShard(p, -26 + i * 9, { dmg: 0.6, sp: 380 + i * 20, oy: 22, art: 'gao_pillar' });
      FX.debris(p.x + p.face * 30, p.y - 22, ['#7a6448', ROCK], 8);
      Cam.shake(0.3);
    }]],
    next: 'pillar4', nextLv: 4,
  },
  pillar4: {
    label: '山岳崩', dur: 0.75, cancel: 0.56, armor: true, art: 'gao_pillar', noAtkSpeed: true,
    keys: [[0, { lean: -4, aF: [100, -60], aB: [110, -70], lF: [-10, 60], lB: [120, 95] }], [0.2, { lean: -4, aF: [100, -60], aB: [110, -70], lF: [-20, 50], lB: [120, 95] }], [0.26, { lean: 16, aF: [70, -30], aB: [80, -40], ...G_SQUAT }, 'outCubic'], [0.75, { lean: 10 }]],
    ev: [[0.26, p => {
      gaoQuake(p, 48, 1.2 * artMul(p, 'gao_pillar'), 'heavy');
      const x0 = p.x, f = p.face;
      [50, 95, 140].forEach((d, i) => later(0.12 + i * 0.1, () => {
        const x = x0 + f * d;
        G.projs.push(new Proj({ team: 'p', x: x + rand(-8, 8), y: Cam.y - 10, vx: 0, vy: 380, grav: 900, kind: 'orb', r: 7, c: '#8a7458', c2: ROCK, life: 2, light: 30, trail: 0.4, tc: '#5a4a3a', ghost: true, upd: q => { if (q.t > 0.1 && G.room.solidPx(q.x, q.y)) { q.kill(true); q.life = 0; } }, hit: p.makeHit({ dmg: 0.8, kx: 60, ky: -100, stun: 0.5, art: 'gao_pillar' }), onDie: q => { explodeP(q.x, q.y, 46, 2.0 * artMul(p, 'gao_pillar'), { c: C, c2: ROCK, src: 'heavy', shake: 0.45, sound: 'stomp', ky: -300, wx: q.hit.wx }); FX.debris(q.x, q.y, ['#7a6448', ROCK], 10); } }));
      }));
      later(0.4, () => p.fire('onFinisher', null, { finisher: true }));
    }]],
  },

  // ================= 扫堂连环 (↓) =================
  whirl1: {
    label: '旋扫腿', dur: 0.56, cancel: 0.4, art: 'gao_whirl',
    keys: [
      [0, { lean: 25, ...G_SQUAT, aF: [100, 60], aB: [110, 70] }], [0.07, { lean: 30, lF: [-5, 5], lB: [155, 110], aF: [100, 60], aB: [110, 70] }, 'outCubic'],
      [0.16, { lean: 30, lF: [175, 180], lB: [30, 110], aF: [80, 60], aB: [90, 70] }], [0.24, { lean: 30, lF: [-5, 5], lB: [155, 110] }, 'outCubic'], [0.56, { lean: 12 }],
    ],
    hits: [
      { t: 0.07, d: 0.08, box: [-42, -18, 84, 20], dmg: 0.8, kb: [60, -120], stun: 0.5, hs: 3, radial: true },
      { t: 0.22, d: 0.08, box: [-46, -20, 92, 22], dmg: 1.1, kb: [90, -330], stun: 0.7, hs: 4, launch: true, radial: true },
    ],
    ev: [0.07, 0.22].map(t => [t, p => { Sound.play('swoosh', { x: p.x, pitch: 0.6 }); hSlash(p, { x: 0, y: -6, r: 38, a0: -180, a1: 180, th: 5, c: C, sy: 0.2, dur: 0.2 }); FX.dust(p.x, p.y, 8, 0); }]),
    next: 'whirl2', nextLv: 2,
  },
  whirl2: {
    label: '踏地', dur: 0.5, cancel: 0.34, armor: true, art: 'gao_whirl',
    keys: [[0, { lean: -4, aF: [100, -60], aB: [110, -70], lF: [-20, 50], lB: [120, 95] }], [0.12, { lean: 14, aF: [70, -30], aB: [80, -40], ...G_SQUAT }, 'outCubic'], [0.5, { lean: 10 }]],
    ev: [[0.12, p => { gaoQuake(p, 54, 1.4 * artMul(p, 'gao_whirl'), 'heavy'); for (const e of enemiesNear(p.x, p.y - 10, 60)) applyStatus(e, 'stun', 0.8); }]],
    next: 'whirl3', nextLv: 3,
  },
  whirl3: {
    label: '连环踢', dur: 0.56, cancel: 0.42, art: 'gao_whirl',
    keys: [
      [0, { lean: 6 }], [0.05, { lean: -18, lF: [-20, 10], lB: [110, 100], aF: [60, -40], aB: [100, -40] }, 'outCubic'], [0.12, { lean: 4, lF: [60, 110], lB: [120, 100] }],
      [0.16, { lean: -24, lF: [-40, -20], lB: [115, 100], aF: [60, -40], aB: [100, -40] }, 'outCubic'], [0.22, { lean: 4 }],
      [0.27, { gl: 0.3, lean: -30, lF: [-60, -40], lB: [110, 110], aF: [60, -40], aB: [100, -40] }, 'outCubic'], [0.56, { lean: 6 }],
    ],
    vel: [[0, 0.3, 120]],
    hits: [0.05, 0.16, 0.27].map((t, i) => ({ t, d: 0.06, box: [0, -38 - i * 6, 38, 30], dmg: 0.8 + i * 0.2, kb: [i === 2 ? 260 : 60, i === 2 ? -220 : -60], stun: 0.45, hs: 3 + i, heavy: i === 2 })),
    ev: [0.05, 0.16, 0.27].map((t, i) => [t, p => { Sound.play(i === 2 ? 'hitHeavy' : 'swoosh', { x: p.x, pitch: 0.7 + i * 0.1 }); hPunchFx(p, 26, -28 - i * 6, i === 2); }]),
    next: 'whirl4', nextLv: 4,
  },
  whirl4: {
    label: '天崩踵', dur: 0.8, cancel: 0.6, armor: true, grav: 1.3, art: 'gao_whirl',
    keys: [[0, { lean: -10, ...G_SQUAT }], [0.14, { gl: 0, lean: -30, lF: [-90, -80], lB: [110, 130], aF: [100, 60], aB: [120, 80] }], [0.24, { gl: 0.5, lean: 26, lF: [70, 95], lB: [130, 110] }, 'outCubic'], [0.8, { lean: 10 }]],
    ev: [[0.03, p => { p.vy = -280; Sound.play('jump', { x: p.x, pitch: 0.8 }); }], [0.2, p => { p.vy = 620; }]],
    update(p, mv) {
      if (mv.t > 0.18 && p.onGround && !mv.landed) {
        mv.landed = true;
        landImpact(p, 48, 2.4, C);
        for (const d of [-1, 1]) { pShockwave(p, p.x + d * 14, p.y, d, 1.3, C, 'heavy'); later(0.12, () => pShockwave(p, p.x + d * 14, p.y, d, 1.0, FL, 'heavy')); }
      }
    },
  },

  // ================= 铁桥 (↓) =================
  bridge1: {
    label: '沉肩', dur: 0.5, cancel: 0.34, armor: true, art: 'gao_bridge',
    keys: [[0, { lean: 10, aF: [100, -40], aB: [110, -50], ...G_SQUAT }], [0.06, { lean: 46, aF: [100, -40], aB: [110, -50], lF: [5, 80], lB: [165, 150] }, 'outCubic'], [0.28, { lean: 40, aF: [100, -40], aB: [110, -50], lF: [5, 80], lB: [165, 150] }], [0.5, { lean: 10 }]],
    vel: [[0.03, 0.16, 300]],
    hits: [{ t: 0.06, d: 0.1, box: [0, -30, 32, 30], dmg: 1.2, kb: [280, -100], stun: 0.6, hs: 6, breakGuard: true }],
    ev: [[0.06, p => { Sound.play('hitHeavy', { x: p.x, pitch: 1.0 }); FX.ring(p.x + p.face * 16, p.y - 16, 4, 26, C, 0.25, 3); FX.dust(p.x, p.y, 6, -p.face); }]],
    next: 'bridge2', nextLv: 2,
  },
  bridge2: {
    label: '顶心肘', dur: 0.4, cancel: 0.26, art: 'gao_bridge',
    keys: M.elbow.keys,
    vel: [[0.02, 0.12, 170]],
    hits: [{ t: 0.05, d: 0.07, box: [0, -40, 32, 28], dmg: 1.3, kb: [90, -30], stun: 0.9, hs: 6, breakGuard: true, status: ['stun', 0.9] }],
    ev: [[0.05, p => { Sound.play('hitHeavy', { x: p.x, pitch: 1.2 }); hPunchFx(p, 18, -28, true); }]],
    next: 'bridge3', nextLv: 3,
  },
  bridge3: {
    label: '贴山靠', dur: 0.58, cancel: 0.44, armor: true, art: 'gao_bridge',
    keys: M.shoulder.keys,
    vel: [[0.04, 0.16, 360]],
    hits: [{ t: 0.07, d: 0.09, box: [0, -42, 34, 42], dmg: 2.4, kb: [480, -180], stun: 0.8, hs: 9, heavy: true, breakGuard: true, src: 'heavy' }],
    ev: [[0.07, p => { Sound.play('hitHeavy', { x: p.x, pitch: 0.65 }); Sound.play('stomp', { x: p.x }); FX.ring(p.x + p.face * 18, p.cy, 4, 38, C, 0.3, 4); Cam.shake(0.5); Cam.push(p.face * 4, 0); }]],
    next: 'bridge4', nextLv: 4,
  },
  bridge4: {
    label: '崩天掌', dur: 0.66, cancel: 0.5, armor: true, art: 'gao_bridge', noAtkSpeed: true,
    keys: [[0, { lean: -10, aF: [150, 120], aB: [160, 130], ...G_SQUAT }], [0.2, { lean: -12, aF: [160, 130], aB: [165, 140], ...G_SQUAT }], [0.25, { lean: 28, aF: [0, -10], aB: [5, -5], ...G_LUNGE }, 'outCubic'], [0.66, { lean: 10 }]],
    update(p, mv) { if (mv.t < 0.22) Light.add(p.x, p.cy, 60, C, 0.6); },
    ev: [[0.24, p => {
      const hit = p.makeHit({ dmg: 2.4, kx: 360, ky: -160, stun: 0.7, hs: 5, heavy: true, finisher: true, src: 'heavy' });
      G.projs.push(new Proj({ team: 'p', x: p.x + p.face * 26, y: p.y - 24, vx: p.face * 460, vy: 0, r: 14, kind: 'fist', c: C, life: 0.45, pierce: 99, ghost: true, hit, light: 110, trail: 0.6, tc: FL }));
      Sound.play('hitHeavy', { x: p.x, pitch: 0.6 }); Sound.play('void', { x: p.x, pitch: 1.3 }); Cam.shake(0.45); Cam.push(p.face * 4, 0);
      p.fire('onFinisher', null, { finisher: true });
    }]],
  },

  // ================= 猛虎 (冲刺) =================
  tiger1: {
    label: '猛虎硬爬山', dur: 0.5, cancel: 0.34, armor: true, grav: 0, art: 'gao_tiger',
    keys: [[0, { ...PUNCH0, ...G_LUNGE, lean: 30 }], [0.05, { ...PUNCH1, ...G_LUNGE, lean: 36 }, 'outCubic'], [0.12, { lean: 34, aF: [100, -40], aB: [0, 0], ...G_LUNGE }, 'outCubic'], [0.5, { lean: 14 }]],
    vel: [[0, 0.18, 400, 0]],
    hits: [{ t: 0.04, d: 0.08, box: [-4, -40, 38, 30], dmg: 0.9, kb: [200, -60], stun: 0.45, hs: 3 }, { t: 0.14, d: 0.08, box: [-4, -44, 42, 34], dmg: 1.3, kb: [320, -120], stun: 0.55, hs: 6, heavy: true }],
    ev: [[0.04, p => { Sound.play('hitHeavy', { x: p.x, pitch: 1.2 }); hPunchFx(p, 24, -26, false); }], [0.14, p => { Sound.play('hitHeavy', { x: p.x, pitch: 0.9 }); hPunchFx(p, 28, -28, true); FX.add({ k: 'streak', x: p.x + p.face * 30, y: p.y - 26, vx: p.face * 1800, vy: 0, life: 0.12, c: C, len: 0.03, w: 3 }); }]],
    next: 'tiger2', nextLv: 2,
  },
  tiger2: {
    label: '虎抱', dur: 0.62, cancel: 0.46, armor: true, art: 'gao_tiger', noAtkSpeed: true,
    keys: [[0, { lean: 20, aF: [10, 0], aB: [20, 10], ...G_LUNGE }], [0.1, { lean: 6, aF: [-40, -60], aB: [-30, -50] }], [0.24, { lean: -30, aF: [-150, -160], aB: [-140, -150], lF: [60, 110], lB: [120, 100] }, 'outCubic'], [0.62, { lean: 6 }]],
    vel: [[0.02, 0.08, 160]],
    ev: [[0.07, (p, mv) => {
      const box = { x: p.face > 0 ? p.x : p.x - 38, y: p.y - 42, w: 38, h: 42 };
      const e = G.enemies.find(en => !en.dead && !en.spawning && !en.boss && overlap(box, en.hurtbox()));
      if (e) { mv.held = e; e.held = true; e.cancelAttack && e.cancelAttack(); Sound.play('clank', { x: p.x, pitch: 0.8 }); }
      else pHit(p, [0, -42, 36, 40], { dmg: 1.4, kx: 160, ky: -120, stun: 0.6, hs: 5, heavy: true });
    }], [0.24, (p, mv) => {
      const e = mv.held;
      if (!e) return;
      e.held = false; mv.held = null;
      e.x = p.x - p.face * 22; e.y = G.room.floorBelow(e.x, p.y - 20);
      hitEnemy(p, e, p.makeHit({ dmg: 2.2, kx: 260, ky: -280, stun: 0.9, hs: 8, heavy: true, launch: true, dir: -p.face }));
      FX.shock(e.x, p.y, C, 40); Sound.play('stomp', { x: e.x }); Cam.shake(0.4);
    }]],
    update(p, mv) { const e = mv.held; if (e && !e.dead) { const k = clamp((mv.t - 0.07) / 0.17, 0, 1), a = (-20 - k * 160) * DEG; e.x = p.x + Math.cos(a) * 18 * p.face; e.y = p.y - 6 + Math.sin(a) * 26; e.vx = 0; e.vy = 0; } },
    onEnd(p, mv) { if (mv.held) mv.held.held = false; },
    next: 'tiger3', nextLv: 3,
  },
  tiger3: {
    label: '虎尾脚', dur: 0.5, cancel: 0.36, art: 'gao_tiger',
    keys: [[0, { lean: 10, ...G_SQUAT }], [0.06, { lean: -26, lF: [170, 190], lB: [60, 100], aF: [60, -40], aB: [80, -40] }, 'outCubic'], [0.18, { lean: -20, lF: [-30, -10], lB: [110, 100] }, 'outCubic'], [0.5, { lean: 6 }]],
    hits: [{ t: 0.05, d: 0.06, box: [-40, -40, 40, 34], dmg: 1.0, kb: [200, -140], stun: 0.5, hs: 4, radial: true }, { t: 0.16, d: 0.07, box: [0, -44, 42, 36], dmg: 1.5, kb: [340, -200], stun: 0.6, hs: 6, heavy: true, launch: true }],
    ev: [[0.05, p => { Sound.play('swoosh', { x: p.x, pitch: 0.6 }); hSlash(p, { x: -6, y: -24, r: 26, a0: 180, a1: 20, th: 6, c: C, sy: 0.5 }); }], [0.16, p => { Sound.play('hitHeavy', { x: p.x, pitch: 0.8 }); hPunchFx(p, 26, -30, true); }]],
    next: 'tiger4', nextLv: 4,
  },
  tiger4: {
    label: '虎啸', dur: 0.8, cancel: 0.6, armor: true, art: 'gao_tiger', noAtkSpeed: true,
    keys: [[0, { lean: 6, aF: [100, -60], aB: [110, -70], ...G_SQUAT }], [0.2, { lean: -12, aF: [40, -100], aB: [50, -110], lF: [50, 110], lB: [130, 100] }, 'outCubic'], [0.6, { lean: -10, aF: [40, -100], aB: [50, -110], lF: [50, 110], lB: [130, 100] }], [0.8, { lean: 6 }]],
    ev: [[0.2, p => {
      Sound.play('roar', { x: p.x, pitch: 1.3 }); Sound.play('gong', { x: p.x, pitch: 0.8 });
      for (let i = 0; i < 3; i++) later(i * 0.08, () => FX.ring(p.x, p.cy, 10, 110 + i * 20, i % 2 ? '#ffffff' : C, 0.35, 4 - i));
      FX.screenFlash(C, 0.25, 0.2); Cam.shake(0.6);
      for (const e of enemiesNear(p.x, p.cy, 115)) {
        hitEnemy(p, e, p.makeHit({ dmg: 1.9, kx: 320, ky: -220, stun: 0.6, hs: 2, heavy: true, launch: true, dir: sign(e.x - p.x) || 1, finisher: true, src: 'heavy' }));
        applyStatus(e, 'stun', 1.2);
      }
      p.fire('onFinisher', null, { finisher: true });
    }]],
  },

  // ================= 飞膝 (冲刺) =================
  knee1: {
    label: '飞膝', dur: 0.48, cancel: 0.32, art: 'gao_knee',
    keys: M.dashAtk2.keys,
    vel: [[0.02, 0.18, 220]],
    hits: [{ t: 0.05, d: 0.12, box: [-2, -50, 34, 48], dmg: 1.4, kb: [80, -400], stun: 0.7, hs: 5, launch: true }],
    ev: [[0.05, p => { p.vy = -320; Sound.play('hitHeavy', { x: p.x, pitch: 1.2 }); hPunchFx(p, 12, -30, true); }]],
    next: 'knee2', nextLv: 2,
  },
  knee2: {
    label: '双峰贯耳', dur: 0.44, cancel: 0.3, air: true, grav: 0.1, art: 'gao_knee',
    keys: [[0, air({ lean: -16, aF: [-120, -100], aB: [-110, -95] })], [0.08, air({ lean: 30, aF: [40, 60], aB: [50, 70] }), 'outCubic'], [0.44, air({ lean: 10 })]],
    hits: [{ t: 0.07, d: 0.08, box: [-4, -46, 42, 48], dmg: 1.5, kb: [60, -100], stun: 0.8, hs: 6, heavy: true }],
    ev: [[0.07, p => { Sound.play('hitHeavy', { x: p.x, pitch: 0.9 }); hPunchFx(p, 22, -22, true); FX.ring(p.x + p.face * 22, p.y - 22, 3, 24, '#ffffff', 0.2, 2); }]],
    next: 'knee3', nextLv: 3,
  },
  knee3: diveMove({
    label: '落雷踵', art: 'gao_knee', dur: 0.66, cancel: 0.5, hop: -160, vx: 100, fall: 680, hold: 0.24, diveAt: 0.12, armor: true, fallDmg: 0.9,
    keys: [[0, air({ lean: -30, lF: [-90, -80], lB: [110, 130], aF: [100, 60], aB: [120, 80] })], [0.12, air({ lean: 24, lF: [70, 95], lB: [130, 110] }), 'outCubic'], [0.24, air({ lean: 24, lF: [70, 95], lB: [130, 110] })], [0.3, { lean: 18, ...G_SQUAT }, 'outCubic'], [0.66, { lean: 10 }]],
    onLand(p) { landImpact(p, 44, 1.9, C); },
    next: 'knee4', nextLv: 4,
  }),
  knee4: {
    label: '地动', dur: 0.78, cancel: 0.6, armor: true, art: 'gao_knee', noAtkSpeed: true,
    keys: [[0, { ...RAISE }], [0.12, { ...SLAM }, 'outCubic'], [0.78, { lean: 12 }]],
    ev: [[0.12, p => {
      const x0 = p.x, f = p.face;
      [24, 64, 104, 144].forEach((d, i) => later(i * 0.1, () => {
        const x = x0 + f * d, gy = G.room.floorBelow(x, p.y - 20);
        if (Math.abs(gy - p.y) > 50) return;
        explodeP(x, gy - 10, 34 + i * 4, (1.2 + i * 0.25) * artMul(p, 'gao_knee'), { c: C, c2: ROCK, heavy: true, ky: -330, kx: 160, hs: 3, shake: 0.35, src: 'heavy', sound: 'stomp', pitch: 1.1 - i * 0.1, wx: { fam: 'art', id: 'gao_knee' } });
        FX.shock(x, gy, C, 40); FX.debris(x, gy - 2, [C, '#a08a6a'], 8);
        if (i === 3) p.fire('onFinisher', null, { finisher: true });
      }));
    }]],
  },

  // ================= 秘技 派生 =================
  f_iron: {
    label: '金刚掌', dur: 0.5, cancel: 0.36, skill: 'gao_iron', isFollow: true, armor: true,
    keys: [[0, { lean: 0, aF: [100, -60], aB: [110, -70], ...G_SQUAT }], [0.1, { lean: 4, aF: [0, -10], aB: [180, 190], ...G_SQUAT }, 'outCubic'], [0.5, { lean: 4 }]],
    ev: [[0.1, p => {
      for (const d of [-1, 1]) pShockwave(p, p.x + d * 16, p.y, d, 1.6, '#ffd36a', 'skill', 'gao_iron');
      explodeP(p.x, p.cy, 52, 1.5 * skMul(p, 'gao_iron'), { c: '#ffd36a', kx: 280, ky: -200, src: 'skill', shake: 0.4, sound: 'gong', pitch: 1.3 });
    }]],
  },
  f_ki: {
    label: '连环气功', dur: 0.56, cancel: 0.42, skill: 'gao_ki', isFollow: true, noAtkSpeed: true,
    keys: [[0, { lean: -8, aF: [150, 120], aB: [160, 130], ...G_SQUAT }], [0.08, { lean: 24, aF: [0, 0], aB: [150, 160], ...G_LUNGE }, 'outCubic'], [0.2, { lean: 24, aB: [0, 0], aF: [150, 160], ...G_LUNGE }, 'outCubic'], [0.56, { lean: 10 }]],
    ev: [0.08, 0.2].map((t, i) => [t, p => {
      const hit = p.makeHit({ dmg: 1.6, kx: 200, ky: -100, stun: 0.5, hs: 3, heavy: true, skill: 'gao_ki' });
      G.projs.push(new Proj({ team: 'p', x: p.x + p.face * 22, y: p.y - 22 - (i ? 8 : -4), vx: p.face * 340, vy: i ? -30 : 20, kind: 'orb', r: 6, c: C, c2: '#fff6d0', life: 1.0, hit, pierce: 2, light: 70, trail: 0.6, onDie: q => explodeP(q.x, q.y, 34, 1.0 * skMul(p, 'gao_ki'), { c: C, src: 'skill', shake: 0.2, wx: q.hit.wx }) }));
      Sound.play('void', { x: p.x, pitch: 1.6 + i * 0.2 });
    }]),
  },
  f_charge: {
    label: '顶天', dur: 0.52, cancel: 0.36, skill: 'gao_charge', isFollow: true, armor: true,
    keys: [[0, UPC0], [0.08, UPC1, 'outCubic'], [0.52, { gl: 0, aF: [-70, -85], lF: [60, 120], lB: [100, 150] }]],
    hits: [{ t: 0.06, d: 0.14, box: [-24, -66, 60, 68], dmg: 1.9, kb: [60, -470], stun: 0.8, hs: 6, launch: true, radial: true }],
    ev: [[0.06, p => { p.vy = -360; Sound.play('hitHeavy', { x: p.x, pitch: 1.0 }); Sound.play('fire', { x: p.x }); hSlash(p, { x: 6, y: -26, r: 28, a0: 60, a1: -110, th: 10, c: FL, c2: '#ffd36a' }); FX.fire(p.x, p.y - 20, 10, true); }]],
  },
  f_grab: {
    label: '追身踏', dur: 0.6, cancel: 0.5, skill: 'gao_grab', isFollow: true, armor: true, grav: 1.1,
    keys: [[0, { lean: 10, ...G_SQUAT }], [0.1, { gl: 0, lean: -10, lF: [40, 120], lB: [100, 150], aF: [-100, -90], aB: [-90, -80] }], [0.4, { gl: 0, lean: 20, lF: [60, 110], lB: [110, 140], aF: [90, 90], aB: [85, 90] }], [0.6, { gl: 0, lean: 20, lF: [60, 110], lB: [110, 140], aF: [90, 90], aB: [85, 90] }]],
    onStart(p) {
      const e = nearestEnemy(p.x, p.cy, 220);
      const tx = e ? e.x : p.x + p.face * 80;
      p.face = sign(tx - p.x) || p.face;
      p.vy = -420; p.vx = clamp((tx - p.x) / 0.62, -340, 340);
      Sound.play('jump', { x: p.x, pitch: 0.6 }); FX.dust(p.x, p.y, 8, 0);
      p.onLandOnce = pp => { gaoQuake(pp, 62, 2.2 * skMul(pp, 'gao_grab'), 'skill'); for (const en of enemiesNear(pp.x, pp.y - 10, 62)) applyStatus(en, 'stun', 0.8); };
    },
    update(p) { p.vx = approach(p.vx, 0, 30 / 60); },
  },
  f_dragon: diveMove({
    label: '龙坠', skill: 'gao_dragon', isFollow: true, dur: 0.74, cancel: 0.58, hop: -60, fall: 780, hold: 0.24, armor: true, col: FL, fallDmg: 1.2,
    keys: [[0, air({ lean: -16, aF: [-130, -110], aB: [-120, -105] })], [0.1, air({ lean: 40, aF: [85, 95], aB: [88, 98] }), 'outCubic'], [0.24, air({ lean: 40, aF: [85, 95], aB: [88, 98] })], [0.3, { ...SLAM }, 'outCubic'], [0.74, { lean: 12 }]],
    onLand(p) { gaoQuake(p, 72, 2.6 * skMul(p, 'gao_dragon'), 'skill'); for (let i = 0; i < 8; i++) FX.fire(p.x + rand(-50, 50), p.y - rand(0, 10), 3, true); FX.screenFlash(FL, 0.2, 0.2); },
  }),
  f_split: {
    label: '岩崩', dur: 0.56, cancel: 0.42, skill: 'gao_split', isFollow: true, armor: true,
    keys: [[0, { ...RAISE }], [0.1, { ...SLAM }, 'outCubic'], [0.56, { lean: 12 }]],
    ev: [[0.1, p => {
      Cam.shake(0.5); Sound.play('stomp', { x: p.x, pitch: 0.7 });
      const x0 = p.x;
      for (const d of [-1, 1]) [36, 70, 104].forEach((o, i) => later(i * 0.07, () => groundColumn(p, x0 + d * o, 1.6, C, { rock: true, h: 70 + i * 12, w: 24, skill: 'gao_split', src: 'skill' })));
    }]],
  },
  f_kick: diveMove({
    label: '落雷脚', skill: 'gao_kick', isFollow: true, dur: 0.66, cancel: 0.5, hop: -200, fall: 720, hold: 0.24, diveAt: 0.12, armor: true, fallDmg: 1.0,
    keys: [[0, air({ lean: -30, lF: [-90, -80], lB: [110, 130], aF: [100, 60], aB: [120, 80] })], [0.12, air({ lean: 24, lF: [70, 95], lB: [130, 110] }), 'outCubic'], [0.24, air({ lean: 24, lF: [70, 95], lB: [130, 110] })], [0.3, { lean: 18, ...G_SQUAT }, 'outCubic'], [0.66, { lean: 10 }]],
    onLand(p) { landImpact(p, 52, 2.2 * skMul(p, 'gao_kick'), C, { src: 'skill' }); FX.bolt(p.x, p.y - 120, p.x, p.y, '#ffe14a', 0.2, 2, 8); Sound.play('thunder', { x: p.x }); },
  }),
  f_fists: {
    label: '崩山拳', dur: 0.6, cancel: 0.46, skill: 'gao_fists', isFollow: true, armor: true, grav: 0.1, noAtkSpeed: true,
    keys: [[0, { lean: -6, aF: [150, -80], aB: [60, -60], ...G_SQUAT }], [0.14, { lean: 36, aF: [0, 0], aB: [140, 160], ...G_LUNGE }, 'outCubic'], [0.6, { lean: 10 }]],
    ev: [[0.13, p => {
      const hit = p.makeHit({ dmg: 3.0, kx: 380, ky: -160, stun: 0.8, hs: 6, heavy: true, skill: 'gao_fists' });
      G.projs.push(new Proj({ team: 'p', x: p.x + p.face * 30, y: p.y - 24, vx: p.face * 480, vy: 0, r: 16, kind: 'fist', c: C, life: 0.5, pierce: 99, ghost: true, hit, light: 120, trail: 0.7, tc: FL }));
      Sound.play('hitHeavy', { x: p.x, pitch: 0.55 }); Sound.play('explode', { x: p.x, pitch: 1.5 }); Cam.shake(0.5); hPunchFx(p, 30, -26, true);
    }]],
  },

  // ================= 镇岳 (↓I 2) =================
  ult2: {
    label: '镇岳', dur: 1.6, cancel: 99, ult: true, grav: 0, noAtkSpeed: true, skill: 'gao_mountain',
    keys: [
      [0, { lean: 10, ...G_SQUAT, aF: [100, -60], aB: [110, -70] }],
      [0.12, { gl: 0, lean: -20, aF: [-150, -140], aB: [-140, -130], lF: [50, 120], lB: [110, 150] }],
      [0.82, { gl: 0, lean: -24, aF: [-160, -150], aB: [-150, -140], lF: [50, 120], lB: [110, 150] }],
      [0.9, { gl: 0, lean: 44, aF: [85, 95], aB: [88, 98], lF: [40, 110], lB: [110, 140] }, 'outCubic'],
      [1.05, { ...SLAM }], [1.6, { lean: 12 }],
    ],
    onStart(p, mv) { p.vx = 0; p.vy = 0; G.cinematic(0.45); Sound.play('ultCharge'); mv.x0 = p.x; },
    ev: [
      [0.08, (p, mv) => {
        p.vy = -430; Sound.play('jump', { x: p.x, pitch: 0.5 }); FX.dust(p.x, p.y, 12, 0); G.dim = 1.4;
        // looming mountain silhouette held overhead
        mv.mt = addZone({
          x: p.x, y: p.y - 40, life: 0.84,
          upd(z) { z.x = p.x; z.y = p.y - 40; Light.add(z.x, z.y - 20, 150, C, 0.8); },
          drawFn(ctx, gctx, X, Y, z) {
            const k = Math.min(1, z.t * 3), s = 32 * k;
            ctx.globalAlpha = 0.9;
            ctx.fillStyle = '#4a3c30'; ctx.beginPath(); ctx.moveTo(X - s * 1.6, Y); ctx.lineTo(X - s * 0.3, Y - s * 1.2); ctx.lineTo(X + s * 0.2, Y - s * 0.8); ctx.lineTo(X + s * 0.6, Y - s * 1.4); ctx.lineTo(X + s * 1.7, Y); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#8a7458'; ctx.beginPath(); ctx.moveTo(X - s * 0.3, Y - s * 1.2); ctx.lineTo(X - s * 0.1, Y - s * 0.6); ctx.lineTo(X + s * 0.2, Y - s * 0.8); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#e8f0ff'; ctx.beginPath(); ctx.moveTo(X + s * 0.6, Y - s * 1.4); ctx.lineTo(X + s * 0.4, Y - s * 1.1); ctx.lineTo(X + s * 0.8, Y - s * 1.12); ctx.closePath(); ctx.fill();
            ctx.globalAlpha = 1;
            gctx.fillStyle = C; gctx.globalAlpha = 0.4 * k; gctx.fillRect(X - s * 1.6, Y - s * 1.4, s * 3.3, s * 1.4); gctx.globalAlpha = 1;
          },
        });
      }],
      [0.86, p => { p.vy = 980; Sound.play('dash', { x: p.x, pitch: 0.4 }); }],
    ],
    update(p, mv) {
      if (mv.t > 0.12 && mv.t < 0.86) p.vy *= 0.86;
      if (mv.t > 0.88 && !mv.landed && (p.onGround || mv.t > 1.3)) this.slam(p, mv);
    },
    onEnd(p, mv) { if (!mv.landed) this.slam(p, mv); },
    slam(p, mv) {
      mv.landed = true; p.vy = 0;
      if (mv.mt) mv.mt.life = 0;
      const lv = p.skillLv('gao_mountain');
      FX.screenFlash('#ffd36a', 0.7, 0.35); Sound.play('ultBoom'); Sound.play('stomp', { x: p.x, pitch: 0.5 }); Cam.shake(1.1); G.hitstop(8);
      explodeP(p.x, p.y - 16, 92, 5 * skMul(p, 'gao_mountain'), { c: C, c2: ROCK, heavy: true, ky: -380, kx: 260, hs: 0, shake: 0.8, src: 'ult', noProc: true });
      for (const e of liveEnemies().filter(onScreen)) if (e.onGround || Math.abs(e.y - p.y) < 30) { hitEnemy(p, e, p.makeHit({ dmg: 2, kx: 0, ky: -300, stun: 0.8, launch: true, dir: 1, src: 'ult', energy: 0, sfx: false })); applyStatus(e, 'stun', 1.2); }
      FX.shock(p.x, p.y, C, 150); FX.debris(p.x, p.y, [C, ROCK, '#7a6448'], 26);
      if (lv >= 3) for (let i = 1; i <= 5; i++) for (const d of [-1, 1]) later(0.06 * i, () => groundColumn(p, p.x + d * i * 30, 1.4, C, { rock: true, h: 50 + i * 8, w: 22, src: 'ult', skill: 'gao_mountain' }));
    },
  },
});

// ---------- patches to base moves ----------
delete M.dashAtk.next; delete M.dashAtk.nextReq;
delete M.dashAtk2;
M.ult.skill = 'gao_ult';
M.ult.ev.push([0.95, p => {
  if (p.skillLv('gao_ult') < 3) return;
  const f = -p.face;
  const hit = p.makeHit({ dmg: 4, kx: 420, ky: -260, stun: 1.0, hs: 4, heavy: true, launch: true, src: 'ult', energy: 0 });
  G.projs.push(new Proj({ team: 'p', x: Cam.x + (f > 0 ? -20 : W + 20), y: p.y - 22, vx: f * 620, vy: 0, r: 20, kind: 'fist', c: '#ff6a2a', life: 1.2, pierce: 99, ghost: true, hit, light: 160, trail: 1, tc: GAO_C }));
  Sound.play('ultBoom'); Cam.shake(0.6);
}]);
M.sk_fists.grav = 0.1;
M.sk_fists.vel = [[0, 0.66, 35, 0], [0.72, 0.8, 180, 0]];
})();
