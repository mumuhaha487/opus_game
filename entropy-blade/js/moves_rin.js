'use strict';
// =====================================================================
//  RIN — 武技 (direction arts), 秘技 派生 follow-ups, 八重樱
// =====================================================================
(() => {
const M = HEROES.rin.moves;
const RC = '#ff3b5c', PET = '#ffb7d0', VIO = '#c08aff', WIND = '#9ff0d0';
// pose snippets
const UP0 = { lean: 18, aF: [100, 150], w: 160, lF: [35, 125], lB: [140, 105] };
const UP1 = { gl: 0.4, lean: -6, aF: [-80, -95], w: -95, aB: [120, 140], lF: [80, 110], lB: [100, 130] };
const UPE = { gl: 0, lean: 0, aF: [-60, -80], w: -70, lF: [60, 120], lB: [100, 150] };
const HI = { aF: [-70, -110], aB: [120, 100], w: -140 };
const LO = { aF: [40, 50], w: 60, aB: [140, 120] };
const OVER0 = { lean: -10, aF: [-120, -130], aB: [-100, -120], w: -120 };
const OVER1 = { lean: 30, aF: [60, 90], aB: [70, 95], w: 100 };
const SPIN_A = { lean: 6, aF: [5, 0], aB: [175, 180], w: 0 }, SPIN_B = { lean: 6, aF: [175, 180], aB: [5, 0], w: 180 };
const AIRL = { gl: 0, lF: [60, 120], lB: [110, 140] };
const LOWC = { lF: [12, 115], lB: [162, 95] };
const air = o => Object.assign({}, AIRL, o);
const spinKeys = (n, step, extra, t0 = 0) => altKeys(n, step, Object.assign({}, SPIN_A, extra), Object.assign({}, SPIN_B, extra)).map(([t, k, e]) => [t + t0, k, e]);

Object.assign(M, {
  // ================= 飞燕连 (↑) =================
  swallow1: {
    label: '飞燕', dur: 0.5, cancel: 0.3, art: 'rin_swallow',
    keys: [[0, UP0], [0.06, { ...UP1, gl: 0, lean: -14 }, 'outCubic'], [0.5, UPE]],
    vel: [[0.04, 0.2, 170]],
    hits: [{ t: 0.05, d: 0.12, box: [-6, -56, 42, 58], dmg: 1.25, kb: [60, -420], stun: 0.7, hs: 4, launch: true }],
    ev: [[0.05, p => {
      p.vy = -380; Sound.play('slashHeavy', { x: p.x, pitch: 1.25 });
      hSlash(p, { x: 6, y: -24, r: 28, a0: 60, a1: -125, th: 8, sy: 1.1 });
      waveProj(p, { dmg: 0.8, ang: -38, sp: 380, hh: 11, src: 'light', life: 0.55, c: RC });
    }]],
    next: 'swallow2', nextLv: 2,
  },
  swallow2: {
    label: '燕回', dur: 0.42, cancel: 0.26, air: true, grav: 0.12, art: 'rin_swallow',
    keys: [
      [0, air({ lean: 2, ...HI })], [0.05, air({ lean: 18, ...LO }), 'outCubic'],
      [0.12, air({ lean: 14, aF: [80, 120], w: 150 })], [0.17, air({ lean: -6, aF: [-70, -85], w: -95 }), 'outCubic'], [0.42, air({ aF: [-50, -60], w: -60 })],
    ],
    hits: [
      { t: 0.05, d: 0.07, box: [-2, -44, 42, 42], dmg: 0.9, kb: [40, -170], stun: 0.45, hs: 3 },
      { t: 0.17, d: 0.07, box: [-16, -46, 56, 44], dmg: 1.0, kb: [50, -190], stun: 0.45, hs: 3, radial: true },
    ],
    ev: [
      [0.04, p => { Sound.play('slash', { x: p.x, pitch: 1.2 }); hSlash(p, { x: 4, y: -22, r: 24, a0: -115, a1: 80, th: 7 }); }],
      [0.16, p => { Sound.play('slash', { x: p.x, pitch: 1.4 }); hSlash(p, { x: 0, y: -22, r: 30, a0: 170, a1: -20, th: 7, sy: 0.45 }); }],
    ],
    next: 'swallow3', nextLv: 3,
  },
  swallow3: {
    label: '燕舞', dur: 0.56, cancel: 0.42, air: true, grav: 0.05, art: 'rin_swallow',
    keys: spinKeys(7, 0.07, AIRL),
    onStart(p, mv) { p.vy = Math.min(p.vy, -60); mv.box = pHit(p, [-34, -48, 68, 50], { dmg: 0.45, kx: 0, ky: -160, stun: 0.4, hs: 1, radial: true, energy: 0.5 }, 0.46, { multi: 0.09 }); },
    update(p, mv, dt) {
      mv.ft = (mv.ft || 0) - dt;
      if (mv.ft <= 0) { mv.ft = 0.08; FX.slash(p.x, p.y - 22, { r: 30, a0: -180, a1: 180, th: 5, c: RC, f: (mv.k = -(mv.k || 1)), sy: 0.4, dur: 0.12 }); Sound.play('swoosh', { x: p.x, pitch: rand(1.0, 1.3) }); }
      for (const e of enemiesNear(p.x, p.cy, 80)) if (!e.boss) { e.vx += (p.x - e.x) * 4 * dt; e.vy = Math.min(e.vy, -20); }
    },
    onEnd(p, mv) { if (mv.box) mv.box.life = 0; },
    next: 'swallow4', nextLv: 4,
  },
  swallow4: diveMove({
    label: '燕落·断空', art: 'rin_swallow', dur: 0.72, cancel: 0.56, hop: -160, vx: 230, fall: 560, hold: 0.3, fallDmg: 0.9,
    keys: [[0, air({ ...OVER0 })], [0.1, air({ lean: 40, aF: [40, 70], aB: [60, 80], w: 70 }), 'outCubic'], [0.3, air({ lean: 40, aF: [40, 70], aB: [60, 80], w: 70 })], [0.36, { lean: 30, ...OVER1, ...R_CROUCH }, 'outCubic'], [0.72, { lean: 12, aF: [70, 50], w: 40 }]],
    onDive(p) { Sound.play('slashHeavy', { x: p.x, pitch: 0.9 }); p.trail = 0.3; },
    onLand(p) {
      landImpact(p, 46, 2.6, RC);
      hSlash(p, { x: 6, y: -14, r: 44, a0: -160, a1: 40, th: 12, sy: 0.4, dur: 0.3 });
      for (const d of [-1, 1]) { const f = p.face; p.face = d; waveProj(p, { dmg: 1.0, sp: 420, hh: 14, oy: -12, src: 'heavy', c: RC, life: 0.6 }); p.face = f; }
      FX.screenFlash('#ffffff', 0.25, 0.15);
    },
  }),

  // ================= 昇樱 (↑) =================
  blossom1: {
    label: '樱升', dur: 0.46, cancel: 0.3, art: 'rin_blossom',
    keys: [[0, UP0], [0.06, { ...UP1, gl: 1, lean: -10 }, 'outCubic'], [0.46, { lean: 0, aF: [-60, -80], w: -70 }]],
    hits: [{ t: 0.05, d: 0.08, box: [-4, -50, 34, 52], dmg: 0.6, kb: [20, -300], stun: 0.5, hs: 3, launch: true }],
    ev: [[0.05, p => {
      Sound.play('slashHeavy', { x: p.x, pitch: 1.3 });
      hSlash(p, { x: 4, y: -22, r: 24, a0: 70, a1: -120, th: 7, sy: 1.1, c: PET });
      groundColumn(p, p.x + p.face * 52, 1.3, PET, { h: 84, w: 22, burst: [PET, '#ffffff', RC] });
      petalPuff(p.x + p.face * 52, p.y - 40, 12);
    }]],
    next: 'blossom2', nextLv: 2,
  },
  blossom2: {
    label: '樱返', dur: 0.48, cancel: 0.32, art: 'rin_blossom',
    keys: [
      [0, { lean: 12, aF: [100, 140], w: 160, ...R_CROUCH }], [0.06, { lean: -6, aF: [-70, -90], w: -100, lF: [70, 100], lB: [110, 95] }, 'outCubic'],
      [0.12, { lean: 8, aF: [70, 110], w: 140, lF: [50, 110], lB: [130, 100] }], [0.18, { lean: -8, aF: [-80, -100], w: -110, lF: [75, 100], lB: [105, 95] }, 'outCubic'], [0.48, { lean: 0, aF: [-50, -60], w: -60 }],
    ],
    vel: [[0.02, 0.14, 170]],
    hits: [
      { t: 0.05, d: 0.06, box: [-6, -48, 42, 50], dmg: 0.8, kb: [20, -250], stun: 0.55, hs: 3, launch: true },
      { t: 0.17, d: 0.07, box: [-6, -56, 44, 58], dmg: 0.95, kb: [30, -360], stun: 0.65, hs: 4, launch: true },
    ],
    ev: [
      [0.04, p => { Sound.play('slash', { x: p.x, pitch: 1.3 }); hSlash(p, { x: 4, y: -20, r: 24, a0: 90, a1: -115, th: 7, sy: 1.1, c: PET }); }],
      [0.16, p => { Sound.play('slash', { x: p.x, pitch: 1.5 }); hSlash(p, { x: 6, y: -24, r: 28, a0: 80, a1: -120, th: 8, sy: 1.2 }); petalPuff(p.x + p.face * 20, p.y - 34, 8); }],
    ],
    next: 'blossom3', nextLv: 3,
  },
  blossom3: {
    label: '樱乱', dur: 0.56, cancel: 0.42, air: true, grav: 0.2, art: 'rin_blossom',
    keys: [
      [0, { lean: 10, ...R_CROUCH, ...HI }], [0.08, air({ lean: -8, ...OVER0 })],
      [0.14, air({ lean: 28, ...OVER1 }), 'outCubic'], [0.2, air({ lean: -6, ...OVER0 })], [0.26, air({ lean: 28, ...OVER1 }), 'outCubic'],
      [0.32, air({ lean: -6, ...OVER0 })], [0.38, air({ lean: 34, ...OVER1 }), 'outCubic'], [0.56, air({ lean: 14, aF: [70, 60], w: 60 })],
    ],
    ev: [
      [0.02, p => { p.vy = Math.min(p.vy, -300); Sound.play('jump', { x: p.x, pitch: 1.2 }); }],
      ...[0.14, 0.26, 0.38].map((t, i) => [t, p => { Sound.play('slash', { x: p.x, pitch: 1.1 + i * 0.15 }); hSlash(p, { x: 6, y: -20, r: 26, a0: -140, a1: 90, th: 7, c: i === 2 ? RC : PET }); petalPuff(p.x + p.face * 18, p.y - 18, 6); }]),
    ],
    hits: [0.14, 0.26, 0.38].map((t, i) => ({ t, d: 0.06, box: [-4, -46, 46, 58], dmg: 0.7 + i * 0.1, kb: [40, i === 2 ? 200 : -60], stun: 0.45, hs: 3 })),
    next: 'blossom4', nextLv: 4,
  },
  blossom4: diveMove({
    label: '千本樱', art: 'rin_blossom', dur: 0.8, cancel: 0.62, hop: -90, fall: 600, hold: 0.24,
    keys: [[0, air({ ...OVER0 })], [0.1, air({ lean: 20, aF: [80, 90], aB: [85, 92], w: 90 }), 'outCubic'], [0.24, air({ lean: 20, aF: [80, 90], aB: [85, 92], w: 90 })], [0.3, { lean: 34, aF: [80, 95], aB: [85, 100], w: 90, lF: [20, 120], lB: [160, 100] }, 'outCubic'], [0.8, { lean: 10, aF: [70, 50], w: 40 }]],
    onLand(p) {
      landImpact(p, 36, 1.6, PET, { finisher: false });
      const x0 = p.x, f = p.face;
      for (let i = 0; i < 5; i++) later(0.08 + i * 0.08, () => { groundColumn(p, x0 + f * (34 + i * 30), 1.25, i === 4 ? RC : PET, { h: 70 + i * 6, w: 22, art: 'rin_blossom' }); petalPuff(x0 + f * (34 + i * 30), p.y - 40, 8); if (i === 4) p.fire('onFinisher', null, { finisher: true }); });
    },
  }),

  // ================= 地走 (↓) =================
  sweep1: {
    label: '地走', dur: 0.42, cancel: 0.27, art: 'rin_sweep',
    keys: [[0, { lean: 22, aF: [70, 110], w: 150, lF: [20, 125], lB: [155, 100] }], [0.06, { lean: 32, aF: [50, 20], w: 15, ...LOWC }, 'outCubic'], [0.42, { lean: 16, aF: [60, 40], w: 30, lF: [40, 110], lB: [140, 96] }]],
    vel: [[0.02, 0.12, 150]],
    hits: [{ t: 0.05, d: 0.07, box: [-6, -18, 48, 20], dmg: 0.9, kb: [50, -220], stun: 0.6, hs: 3, launch: true }],
    ev: [[0.05, p => {
      Sound.play('slash', { x: p.x, pitch: 0.85 }); hSlash(p, { x: 4, y: -8, r: 28, a0: -170, a1: 25, th: 6, sy: 0.3 }); FX.dust(p.x + p.face * 20, p.y, 6, p.face);
      pShockwave(p, p.x + p.face * 24, p.y, p.face, 0.8, RC, 'light');
    }]],
    next: 'sweep2', nextLv: 2,
  },
  sweep2: {
    label: '返燕扫', dur: 0.44, cancel: 0.3, art: 'rin_sweep',
    keys: [[0, { lean: 28, aF: [40, 20], w: 15, ...LOWC }], [0.08, { lean: 16, aF: [175, 195], aB: [10, 20], w: 200, ...LOWC }, 'outCubic'], [0.44, { lean: 14, aF: [60, 40], w: 30, lF: [40, 110], lB: [140, 96] }]],
    hits: [{ t: 0.05, d: 0.1, box: [-46, -20, 92, 22], dmg: 1.1, kb: [60, -300], stun: 0.65, hs: 4, launch: true, radial: true }],
    ev: [[0.05, p => { Sound.play('slash', { x: p.x, pitch: 0.75 }); hSlash(p, { x: 0, y: -8, r: 40, a0: -180, a1: 180, th: 6, sy: 0.22, dur: 0.22 }); FX.dust(p.x, p.y, 10, 0); }]],
    next: 'sweep3', nextLv: 3,
  },
  sweep3: {
    label: '刃轮', dur: 0.56, cancel: 0.44, art: 'rin_sweep',
    keys: spinKeys(7, 0.07, { lean: 20, ...LOWC }),
    vel: [[0, 0.46, 150]],
    onStart(p, mv) { mv.box = pHit(p, [-30, -26, 60, 28], { dmg: 0.42, kx: 40, ky: -140, stun: 0.45, hs: 1, radial: true, energy: 0.5 }, 0.46, { multi: 0.09 }); },
    update(p, mv, dt) {
      mv.ft = (mv.ft || 0) - dt;
      if (mv.ft <= 0 && mv.t < 0.46) { mv.ft = 0.09; FX.slash(p.x, p.y - 10, { r: 30, a0: -180, a1: 180, th: 5, c: RC, f: (mv.k = -(mv.k || 1)), sy: 0.25, dur: 0.12 }); Sound.play('swoosh', { x: p.x, pitch: rand(0.8, 1.0) }); FX.dust(p.x, p.y, 2, -p.face); }
    },
    onEnd(p, mv) { if (mv.box) mv.box.life = 0; },
    next: 'sweep4', nextLv: 4,
  },
  sweep4: {
    label: '断地', dur: 0.8, cancel: 0.62, grav: 1.4, art: 'rin_sweep',
    keys: [[0, { lean: -8, ...OVER0, lF: [55, 110], lB: [125, 100] }], [0.14, { gl: 0, lean: -14, aF: [-135, -155], aB: [-110, -130], w: -165, lF: [35, 120], lB: [110, 155] }], [0.22, { gl: 0.5, lean: 40, aF: [70, 95], aB: [80, 100], w: 100, lF: [20, 120], lB: [160, 100] }, 'outCubic'], [0.8, { lean: 12, aF: [70, 50], w: 40 }]],
    ev: [[0.02, p => { p.vy = -260; Sound.play('jump', { x: p.x }); }], [0.18, p => { p.vy = 560; }]],
    update(p, mv) {
      if (mv.t > 0.16 && p.onGround && !mv.landed) {
        mv.landed = true;
        landImpact(p, 40, 2.2, RC);
        hSlash(p, { x: 10, y: -12, r: 40, a0: -150, a1: 60, th: 12, dur: 0.3 });
        const x0 = p.x, f = p.face;
        for (let i = 0; i < 6; i++) later(0.05 + i * 0.06, () => groundColumn(p, x0 + f * (26 + i * 24), 0.9, RC, { h: 34 + i * 4, w: 18, bw: 4, art: 'rin_sweep' }));
      }
    },
  },

  // ================= 影缝 (↓) =================
  shade1: {
    label: '影缝', dur: 0.44, cancel: 0.28, art: 'rin_shade',
    keys: [[0, { lean: 28, aF: [140, 170], aB: [120, 160], w: 180, ...R_CROUCH }], [0.07, { lean: 42, aF: [8, 10], aB: [160, 175], w: 8, ...LOWC }, 'outCubic'], [0.44, { lean: 16, aF: [40, 20], w: 20, lF: [40, 110], lB: [140, 96] }]],
    vel: [[0.03, 0.14, 280]],
    hits: [{ t: 0.06, d: 0.09, box: [-6, -22, 54, 24], dmg: 1.0, kb: [40, -30], stun: 0.8, hs: 4, status: ['shade', 6] }],
    ev: [[0.06, p => {
      Sound.play('slashHeavy', { x: p.x, pitch: 1.4 });
      FX.add({ k: 'streak', x: p.x + p.face * 50, y: p.y - 12, vx: p.face * 1800, vy: 0, life: 0.12, c: VIO, len: 0.03, w: 2 });
      hSlash(p, { x: 12, y: -12, r: 26, a0: -25, a1: 25, th: 6, sy: 0.35, c: VIO });
    }]],
    next: 'shade2', nextLv: 2,
  },
  shade2: {
    label: '影踏', dur: 0.46, cancel: 0.3, art: 'rin_shade', grav: 0.9,
    keys: [[0, { lean: 20, ...LO }], [0.06, { gl: 0, lean: -24, aF: [40, 10], aB: [150, 140], w: 30, lF: [50, 120], lB: [100, 150] }, 'outCubic'], [0.46, { lean: 4, aF: [60, 40], w: 40 }]],
    hits: [{ t: 0.03, d: 0.06, box: [0, -38, 36, 36], dmg: 0.6, kb: [60, -60], stun: 0.5, hs: 2, status: ['shade', 6] }],
    onStart(p, mv) { mv.x0 = p.x; mv.y0 = p.y; p.inv = Math.max(p.inv, 0.25); },
    ev: [
      [0.03, p => { Sound.play('slash', { x: p.x, pitch: 1.5 }); hSlash(p, { x: 4, y: -20, r: 22, a0: -60, a1: 60, th: 5, c: VIO }); }],
      [0.06, (p, mv) => { ghostBomb(p, mv.x0, mv.y0, 0.38, 46, 1.8, VIO, { status: ['shade', 6] }); p.vy = -200; p.vx = -p.face * 230; Sound.play('teleport', { x: p.x, pitch: 1.3 }); }],
    ],
    next: 'shade3', nextLv: 3,
  },
  shade3: {
    label: '影刺', dur: 0.46, cancel: 0.32, grav: 0, art: 'rin_shade', noAtkSpeed: true,
    keys: [[0, { ...R_DRAW, lean: 30 }], [0.05, { ...R_CUT, lean: 44, aF: [0, 0], w: 0 }, 'outCubic'], [0.46, { lean: 14, aF: [40, 20], w: 20 }]],
    onStart(p, mv) {
      const e = nearestEnemy(p.x, p.cy, 260, en => en.st.shade > 0) || nearestEnemy(p.x, p.cy, 180);
      p.inv = Math.max(p.inv, 0.35);
      if (!e) return;
      FX.ghost(p.frame(), p.spr.ox, p.spr.oy, p.x, p.y, p.face < 0, VIO, 0.3, 0.7);
      const d = sign(e.x - p.x) || p.face;
      let nx = e.x - d * (e.w / 2 + 26);
      if (G.room.solidPx(nx, e.y - 12)) nx = e.x - d * (e.w / 2 + 6);
      p.x = clamp(nx, 2.5 * TILE, G.room.pw - 2.5 * TILE); p.y = Math.min(e.y, G.room.floorBelow(p.x, e.y - 30));
      p.face = d; p.vx = 0; p.vy = 0;
      Sound.play('teleport', { x: p.x });
    },
    vel: [[0.03, 0.14, 560, 0]],
    hits: [{ t: 0.04, d: 0.1, box: [-10, -36, 56, 32], dmg: 1.7, kb: [200, -120], stun: 0.7, hs: 7, heavy: true, critBonus: 0.3, status: ['shade', 6] }],
    ev: [[0.04, p => { Sound.play('slashHeavy', { x: p.x, pitch: 1.1 }); FX.add({ k: 'streak', x: p.x + p.face * 60, y: p.y - 18, vx: p.face * 2600, vy: 0, life: 0.14, c: VIO, len: 0.03, w: 3 }); hSlash(p, { x: 14, y: -18, r: 30, a0: -30, a1: 30, th: 9, sy: 0.4, c: VIO }); }]],
    next: 'shade4', nextLv: 4,
  },
  shade4: {
    label: '影葬', dur: 0.9, cancel: 0.7, grav: 0, art: 'rin_shade', noAtkSpeed: true,
    keys: [[0, { ...R_CUT }], [0.3, { lean: 6, aF: [100, 140], aB: [120, 150], w: 170, lF: [60, 105], lB: [120, 95] }], [0.6, { lean: 4, aF: [110, 150], aB: [120, 150], w: 178 }], [0.9, { lean: 6, aF: [72, 40], w: 28 }]],
    onStart(p) { p.vx = 0; p.vy = 0; p.armorT = 0.6; G.dim = 0.5; Sound.play('ultCharge'); },
    ev: [[0.32, p => {
      let list = liveEnemies().filter(e => onScreen(e) && e.st.shade > 0);
      if (!list.length) list = enemiesNear(p.x, p.cy, 160);
      Sound.play('clank', { x: p.x, pitch: 2 });
      for (const e of list) {
        for (let k = 0; k < 3; k++) later(k * 0.07, () => {
          if (e.dead) return;
          const a = rand(-70, 70);
          FX.slash(e.x, e.cy, { r: 20, a0: a - 70, a1: a + 70, th: 5, c: VIO, f: k % 2 ? 1 : -1, dur: 0.16, sy: 0.4, rot: rand(-40, 40) });
          hitEnemy(p, e, p.makeHit({ dmg: 0.6, kx: 10, ky: -40, stun: 0.6, hs: 1, dir: 1, art: 'rin_shade', sfx: k ? false : 'hit' }));
        });
        later(0.28, () => {
          if (e.dead) return;
          FX.add({ k: 'beam', x: e.x - 30, y: e.cy, len: 60, w: 4, ang: 0, c: VIO, life: 0.3 });
          hitEnemy(p, e, p.makeHit({ dmg: 2.2, kx: 80, ky: -260, stun: 0.9, hs: 4, heavy: true, launch: true, dir: sign(e.x - p.x) || 1, finisher: true, src: 'heavy', art: 'rin_shade' }));
          e.st.shade = 0;
        });
      }
      later(0.28, () => { FX.screenFlash('#c08aff', 0.3, 0.2); Cam.shake(0.4); Sound.play('slashHeavy', { x: p.x, pitch: 0.7 }); if (list.length) p.fire('onFinisher', list[0], { finisher: true }); });
    }]],
  },

  // ================= 紫电 (冲刺) =================
  raiden1: {
    label: '紫电一闪', dur: 0.46, cancel: 0.3, grav: 0, art: 'rin_raiden', noAtkSpeed: true,
    keys: [[0, R_DRAW], [0.04, { ...R_CUT, gl: 0.5, lean: 42, aF: [0, 0], w: 0 }, 'outCubic'], [0.46, { lean: 15, aF: [30, 10], w: 10 }]],
    onStart(p, mv) { mv.x0 = p.x; p.inv = Math.max(p.inv, 0.25); p.trail = 0.2; },
    vel: [[0.02, 0.16, 760, 0]],
    hits: [{ t: 0.03, d: 0.13, box: [-24, -34, 64, 32], dmg: 1.3, kb: [60, -60], stun: 0.6, hs: 3 }],
    ev: [
      [0.03, p => { Sound.play('dash', { x: p.x, pitch: 1.3 }); Sound.play('zap', { x: p.x }); FX.add({ k: 'streak', x: p.x + p.face * 40, y: p.y - 18, vx: p.face * 3000, vy: 0, life: 0.16, c: VIO, len: 0.04, w: 3 }); }],
      [0.24, (p, mv) => {
        const lo = Math.min(mv.x0, p.x) - 16, hi = Math.max(mv.x0, p.x) + 16;
        enemiesInRect(lo, p.y - 64, hi - lo, 76).slice(0, 5).forEach((e, i) => later(i * 0.05, () => !e.dead && skyBolt(p, e.x, e.cy, 0.8, VIO, { art: 'rin_raiden' })));
      }],
    ],
    next: 'raiden2', nextLv: 2,
  },
  raiden2: {
    label: '回闪', dur: 0.44, cancel: 0.28, grav: 0, art: 'rin_raiden', noAtkSpeed: true,
    keys: [[0, { ...R_DRAW, lean: 20 }], [0.04, { ...R_CUT, lean: 40, aF: [-10, 0], w: -10 }, 'outCubic'], [0.44, { lean: 15, aF: [30, 10], w: 10 }]],
    onStart(p, mv) { p.face = -p.face; mv.x0 = p.x; p.inv = Math.max(p.inv, 0.25); p.trail = 0.2; },
    vel: [[0.02, 0.14, 700, 0]],
    hits: [{ t: 0.03, d: 0.12, box: [-24, -36, 64, 34], dmg: 1.3, kb: [80, -140], stun: 0.6, hs: 4, launch: true }],
    ev: [
      [0.03, p => { Sound.play('slashHeavy', { x: p.x, pitch: 1.4 }); FX.add({ k: 'streak', x: p.x + p.face * 40, y: p.y - 22, vx: p.face * 3000, vy: 0, life: 0.16, c: '#ffffff', len: 0.04, w: 2 }); }],
      [0.2, (p, mv) => { const lo = Math.min(mv.x0, p.x) - 16, hi = Math.max(mv.x0, p.x) + 16; enemiesInRect(lo, p.y - 64, hi - lo, 76).slice(0, 4).forEach((e, i) => later(i * 0.05, () => !e.dead && skyBolt(p, e.x, e.cy, 0.7, VIO, { art: 'rin_raiden' }))); }],
    ],
    next: 'raiden3', nextLv: 3,
  },
  raiden3: {
    label: '雷切', dur: 0.5, cancel: 0.34, art: 'rin_raiden',
    keys: [[0, UP0], [0.06, { ...UP1, lean: -10 }, 'outCubic'], [0.5, UPE]],
    hits: [{ t: 0.05, d: 0.12, box: [-8, -58, 42, 60], dmg: 1.4, kb: [30, -430], stun: 0.7, hs: 5, launch: true }],
    ev: [
      [0.05, p => { p.vy = -330; Sound.play('slashHeavy', { x: p.x, pitch: 1.2 }); hSlash(p, { x: 4, y: -24, r: 28, a0: 70, a1: -120, th: 9, sy: 1.1, c: VIO }); }],
      ...[0.14, 0.22, 0.3].map((t, i) => [t, p => { const e = nearestEnemy(p.x + p.face * 40, p.cy, 150); skyBolt(p, e ? e.x : p.x + p.face * (40 + i * 30), e ? e.cy : p.y - 10, 0.7, VIO, { art: 'rin_raiden', r: 22 }); }]),
    ],
    next: 'raiden4', nextLv: 4,
  },
  raiden4: diveMove({
    label: '万雷', art: 'rin_raiden', dur: 0.85, cancel: 0.66, hop: -100, fall: 680, hold: 0.24,
    keys: [[0, air({ ...OVER0 })], [0.1, air({ lean: 20, aF: [80, 90], aB: [85, 92], w: 90 }), 'outCubic'], [0.24, air({ lean: 20, aF: [80, 90], aB: [85, 92], w: 90 })], [0.3, { lean: 34, aF: [80, 95], aB: [85, 100], w: 90, lF: [20, 120], lB: [160, 100] }, 'outCubic'], [0.85, { lean: 10, aF: [70, 50], w: 40 }]],
    onLand(p) {
      landImpact(p, 44, 2.0, VIO, { finisher: false });
      FX.screenFlash('#c08aff', 0.35, 0.25); G.dim = 0.6;
      const list = enemiesNear(p.x, p.cy, 200).slice(0, 8);
      list.forEach((e, i) => later(0.06 + i * 0.06, () => !e.dead && skyBolt(p, e.x, e.cy, 1.5, VIO, { art: 'rin_raiden', r: 26, stun: 0.9 })));
      for (let i = 0; i < 4; i++) later(0.08 + i * 0.07, () => skyBolt(p, p.x + rand(-120, 120), G.room.floorBelow(p.x, p.y - 20) - 4, 0.8, VIO, { art: 'rin_raiden', r: 26 }));
      later(0.1, () => p.fire('onFinisher', list[0] || null, { finisher: true }));
    },
  }),

  // ================= 追风 (冲刺) =================
  gale1: {
    label: '追风斩', dur: 0.42, cancel: 0.3, grav: 0, art: 'rin_gale',
    keys: [[0, { lean: 30, aF: [150, 170], w: 178, lF: [30, 100], lB: [150, 130] }], ...altKeys(3, 0.07, { lean: 36, aF: [10, 0], aB: [160, 175], w: 0, ...R_LUNGE }, { lean: 30, aF: [60, 80], aB: [160, 175], w: 100, ...R_LUNGE }).map(([t, k, e]) => [t + 0.03, k, e]), [0.42, { lean: 16, aF: [40, 20], w: 20 }]],
    vel: [[0, 0.3, 360, 0]],
    onStart(p, mv) { mv.box = pHit(p, [-6, -38, 50, 36], { dmg: 0.5, kx: 120, ky: -40, stun: 0.4, hs: 1, energy: 0.5 }, 0.3, { multi: 0.1 }); },
    update(p, mv) { if (mv.t < 0.3 && Math.random() < 0.8) FX.add({ k: 'streak', x: p.x + p.face * rand(10, 40), y: p.y - rand(10, 34), vx: p.face * 900, vy: 0, life: 0.1, c: pick([WIND, '#ffffff']), len: 0.03, w: 1 }); },
    hits: [{ t: 0.3, d: 0.07, box: [-6, -38, 50, 36], dmg: 1.0, kb: [200, -100], stun: 0.5, hs: 4 }],
    ev: [[0.03, p => { Sound.play('swoosh', { x: p.x, pitch: 0.9 }); }], [0.12, p => hSlash(p, { x: 10, y: -20, r: 24, a0: -40, a1: 40, th: 6, sy: 0.4, c: WIND })], [0.3, p => { Sound.play('slashHeavy', { x: p.x, pitch: 1.3 }); hSlash(p, { x: 12, y: -18, r: 28, a0: -60, a1: 50, th: 8, sy: 0.5 }); }]],
    onEnd(p, mv) { if (mv.box) mv.box.life = 0; },
    next: 'dashAtk2', nextLv: 2,
  },
  gale3: {
    label: '旋空', dur: 0.4, cancel: 0.28, air: true, grav: 0.1, art: 'rin_gale',
    keys: spinKeys(5, 0.06, AIRL),
    ev: [[0.02, p => { p.vy = Math.min(p.vy, -120); }], ...[0.06, 0.16].map(t => [t, p => { Sound.play('slash', { x: p.x, pitch: 1.3 }); FX.slash(p.x, p.y - 22, { r: 34, a0: -180, a1: 180, th: 6, c: WIND, f: 1, sy: 0.45, dur: 0.14 }); }])],
    hits: [0.06, 0.16].map(t => ({ t, d: 0.07, box: [-34, -46, 68, 50], dmg: 0.8, kb: [40, -160], stun: 0.45, hs: 3, radial: true })),
    next: 'gale4', nextLv: 4,
  },
  gale4: diveMove({
    label: '风神落', art: 'rin_gale', dur: 0.8, cancel: 0.6, hop: -120, vx: 120, fall: 600, hold: 0.26,
    keys: [[0, air({ ...OVER0 })], [0.1, air({ lean: 30, aF: [60, 80], aB: [70, 90], w: 80 }), 'outCubic'], [0.26, air({ lean: 30, aF: [60, 80], aB: [70, 90], w: 80 })], [0.32, { lean: 30, ...OVER1, ...R_CROUCH }, 'outCubic'], [0.8, { lean: 10, aF: [70, 50], w: 40 }]],
    onLand(p) {
      landImpact(p, 44, 1.8, WIND);
      windZone(p, p.x + p.face * 10, p.y - 18, 1.6, 50, 0.35, WIND, { art: 'rin_gale', pull: 5 });
      Sound.play('swoosh', { x: p.x, pitch: 0.5 });
    },
  }),

  // ================= 秘技 派生 =================
  f_parry: {
    label: '残月', dur: 0.46, cancel: 0.32, skill: 'rin_parry', isFollow: true, noAtkSpeed: true,
    keys: [[0, { lean: -6, ...HI, w: -150 }], [0.06, { lean: 24, aF: [30, 40], w: 50, lF: [40, 100], lB: [135, 100] }, 'outCubic'], [0.46, { lean: 10, aF: [60, 40], w: 40 }]],
    ev: [[0.05, p => {
      waveProj(p, { dmg: 2.2, sp: 360, hh: 26, life: 1.0, c: RC, skill: 'rin_parry' });
      hSlash(p, { x: 6, y: -22, r: 34, a0: -110, a1: 80, th: 12, dur: 0.3 });
      Sound.play('slashHeavy', { x: p.x, pitch: 0.8 }); Cam.shake(0.25);
    }]],
  },
  f_iai: {
    label: '纳刀', dur: 0.62, cancel: 0.48, grav: 0, skill: 'rin_iai', isFollow: true, noAtkSpeed: true,
    keys: [[0, { ...R_CUT }], [0.28, { lean: 6, aF: [100, 140], aB: [120, 150], w: 170, lF: [60, 105], lB: [120, 95] }], [0.62, { lean: 6, aF: [72, 40], w: 28 }]],
    ev: [[0.28, p => {
      const P = p.counters.iaiPath || { lo: p.x - 120, hi: p.x + 120, y: p.y };
      Sound.play('clank', { x: p.x, pitch: 2.2 }); FX.flash(p.x + p.face * 4, p.y - 18, 8, '#ffffff', 0.12);
      const list = enemiesInRect(P.lo, P.y - 60, P.hi - P.lo, 66);
      for (let k = 0; k < 4; k++) later(k * 0.07, () => {
        FX.add({ k: 'beam', x: P.lo, y: P.y - 22 + rand(-12, 12), len: P.hi - P.lo, w: 2, ang: rand(-0.05, 0.05), c: k % 2 ? '#ffffff' : RC, life: 0.2 });
        for (const e of list) if (!e.dead) hitEnemy(p, e, p.makeHit({ dmg: 0.8, kx: 10, ky: -60, stun: 0.6, hs: 1, dir: 1, skill: 'rin_iai', sfx: k ? false : 'hit' }));
        Sound.play('slash', { x: p.x, pitch: 1.3 + k * 0.1 });
      });
    }]],
  },
  f_shadow: {
    label: '影返', dur: 0.42, cancel: 0.32, grav: 0, noAtkSpeed: true, skill: 'rin_shadow', isFollow: true,
    keys: [[0, R_DRAW], [0.05, { ...R_CUT, gl: 0.5, lean: 40, aF: [0, 0], w: 0 }, 'outCubic'], [0.42, { lean: 15, aF: [30, 10], w: 10 }]],
    vel: [[0.03, 0.17, 700, 0]],
    onStart(p, mv) { p.face = -p.face; p.inv = Math.max(p.inv, 0.4); mv.x0 = p.x; p.trail = 0.25; Sound.play('dash', { x: p.x, pitch: 0.9 }); },
    ev: [
      [0.04, p => { Sound.play('slashHeavy', { x: p.x, pitch: 1.4 }); FX.add({ k: 'streak', x: p.x + p.face * 30, y: p.y - 18, vx: p.face * 3000, vy: 0, life: 0.18, c: '#ffffff', len: 0.04, w: 3 }); }],
      [0.2, (p, mv) => pathCuts(p, mv.x0, p.x, 4, 0.9, RC, 'skill', 0.08, 'rin_shadow')],
    ],
  },
  f_flurry: {
    label: '穿云', dur: 0.5, cancel: 0.36, skill: 'rin_flurry', isFollow: true,
    keys: [[0, { lean: 25, aF: [140, 170], aB: [120, 160], w: 180, lF: [40, 120], lB: [135, 110] }], [0.08, { lean: 35, aF: [0, 0], aB: [160, 175], w: 0, ...R_LUNGE }, 'outCubic'], [0.5, { lean: 12, aF: [60, 40], w: 40 }]],
    vel: [[0.05, 0.14, 300]],
    ev: [[0.07, p => {
      for (const a of [-14, 0, 14]) waveProj(p, { dmg: 1.2, ang: a, sp: 460, hh: 12, life: 0.7, c: RC, skill: 'rin_flurry' });
      Sound.play('slashHeavy', { x: p.x, pitch: 1.1 });
      FX.add({ k: 'streak', x: p.x + p.face * 70, y: p.y - 18, vx: p.face * 2400, vy: 0, life: 0.14, c: '#ffffff', len: 0.03, w: 3 });
    }]],
    hits: [{ t: 0.07, d: 0.1, box: [-8, -34, 58, 28], dmg: 1.4, kb: [300, -100], stun: 0.6, hs: 6, heavy: true }],
  },
  f_meteor: {
    label: '燕翔', dur: 0.5, cancel: 0.34, skill: 'rin_meteor', isFollow: true,
    keys: [[0, UP0], [0.06, { ...UP1, lean: -12 }, 'outCubic'], [0.5, UPE]],
    hits: [{ t: 0.05, d: 0.12, box: [-34, -64, 68, 66], dmg: 2.0, kb: [40, -460], stun: 0.8, hs: 6, launch: true, radial: true }],
    ev: [[0.05, p => { p.vy = -440; Sound.play('slashHeavy', { x: p.x, pitch: 1.1 }); hSlash(p, { x: 0, y: -26, r: 36, a0: 80, a1: -130, th: 10, sy: 1.2 }); FX.ring(p.x, p.y - 10, 6, 50, RC, 0.3, 3); petalPuff(p.x, p.y - 20, 12); }]],
  },
  f_whirl: {
    label: '风卷', dur: 0.56, cancel: 0.4, skill: 'rin_whirl', isFollow: true,
    keys: [[0, { lean: 10, ...SPIN_A, ...R_CROUCH }], [0.07, { ...UP1, lean: -12 }, 'outCubic'], [0.56, UPE]],
    hits: [{ t: 0.06, d: 0.14, box: [-50, -76, 100, 78], dmg: 1.8, kb: [0, -480], stun: 0.8, hs: 6, launch: true, radial: true }],
    ev: [[0.06, p => {
      p.vy = -300; Sound.play('swoosh', { x: p.x, pitch: 0.6 }); Sound.play('slashHeavy', { x: p.x, pitch: 1.2 });
      for (let i = 0; i < 4; i++) FX.slash(p.x, p.y - 12 - i * 14, { r: 26 + i * 4, a0: -180, a1: 180, th: 5, c: i % 2 ? '#ffffff' : RC, f: i % 2 ? 1 : -1, sy: 0.3, dur: 0.2 + i * 0.03 });
      for (const e of enemiesNear(p.x, p.cy, 110)) if (!e.boss) e.vx += (p.x - e.x) * 2;
    }]],
  },
  f_wave: {
    label: '双燕', dur: 0.44, cancel: 0.3, skill: 'rin_wave', isFollow: true, grav: 0.3,
    keys: [[0, { lean: -6, ...HI }], [0.06, { lean: 20, ...LO, lF: [40, 100], lB: [135, 100] }, 'outCubic'], [0.14, { lean: 10, aF: [80, 120], w: 150 }], [0.2, { lean: -6, aF: [-70, -85], w: -95 }, 'outCubic'], [0.44, { lean: 4, aF: [-40, -50], w: -50 }]],
    ev: [
      [0.05, p => { const d = p.onGround ? 0 : 22; waveProj(p, { dmg: 1.3, ang: 16 + d, sp: 440, hh: 14, oy: -30, skill: 'rin_wave' }); hSlash(p, { x: 6, y: -20, r: 26, a0: -110, a1: 70, th: 8 }); Sound.play('slashHeavy', { x: p.x, pitch: 1.3 }); }],
      [0.19, p => { const d = p.onGround ? 0 : 22; waveProj(p, { dmg: 1.3, ang: -16 + d, sp: 440, hh: 14, oy: -10, skill: 'rin_wave' }); hSlash(p, { x: 6, y: -20, r: 26, a0: 80, a1: -110, th: 8 }); Sound.play('slashHeavy', { x: p.x, pitch: 1.5 }); }],
    ],
  },
  f_petal: {
    label: '散华', dur: 0.42, cancel: 0.3, skill: 'rin_petal', isFollow: true, grav: 0.3,
    keys: [[0, { lean: 10, aF: [20, 0], w: -10 }], [0.08, { lean: -10, aF: [-100, -130], w: -150 }, 'outCubic'], [0.42, { aF: [60, 40], w: 40 }]],
    ev: [[0.08, p => {
      const zs = G.zones.filter(z => z.petal && z.life > 0);
      if (!zs.length) zs.push({ x: p.x + p.face * 50, y: p.cy, life: 0 });
      for (const z of zs) {
        z.life = Math.min(z.life, 0.01);
        explodeP(z.x, z.y, 58, 2.5 * skMul(p, 'rin_petal'), { c: PET, c2: RC, src: 'skill', shake: 0.35, noProc: false, sound: 'void', pitch: 1.6 });
        petalPuff(z.x, z.y, 30);
      }
      Sound.play('clank', { x: p.x, pitch: 2 });
    }]],
  },

  // ================= 八重樱·镇魂 (↓I 2) =================
  ult2: {
    label: '八重樱·镇魂', dur: 2.75, cancel: 99, ult: true, grav: 0, noAtkSpeed: true, skill: 'rin_sakura',
    keys: [
      [0, { lean: -4, aF: [-90, -90], aB: [-80, -85], w: -90 }],
      [0.32, { lean: -6, aF: [-95, -95], aB: [-85, -88], w: -92, lF: [55, 110], lB: [125, 100] }],
      [0.4, { lean: 34, aF: [80, 95], aB: [85, 100], w: 90, lF: [20, 120], lB: [160, 100] }, 'outCubic'],
      [2.4, { lean: 32, aF: [80, 95], aB: [85, 100], w: 90, lF: [20, 120], lB: [160, 100] }],
      [2.5, { lean: -4, ...HI }, 'outCubic'], [2.75, { lean: 8, aF: [70, 40], w: 30 }],
    ],
    onStart(p) { p.vx = 0; p.vy = 0; G.cinematic(0.4); Sound.play('ultCharge'); },
    ev: [
      [0.4, p => {
        const lv = p.skillLv('rin_sakura'), full = lv >= 3;
        Sound.play('stomp', { x: p.x }); Sound.play('ultBoom'); FX.shock(p.x, p.y, PET, 80); Cam.shake(0.5);
        G.dim = 2.2;
        const cx = full ? Cam.x + W / 2 : p.x + p.face * 90, r = full ? 260 : 110;
        p.counters.sakura = addZone({
          x: cx, y: p.y - 30, life: 2.0, tick: 0.12, sakura: true,
          onTick(z) {
            for (const e of enemiesNear(z.x, z.y, r)) {
              hitEnemy(p, e, p.makeHit({ dmg: 0.5, kx: 0, ky: -40, stun: 0.5, hs: 0, dir: sign(e.x - z.x) || 1, src: 'ult', sfx: false, energy: 0, fxc: PET, skill: 'rin_sakura' }));
              if (Math.random() < 0.4) FX.slash(e.x, e.cy, { r: 16, a0: -70, a1: 70, th: 4, c: pick([PET, RC, '#ffffff']), f: 1, rot: rand(0, 180), dur: 0.12 });
            }
            Sound.play('swoosh', { x: z.x, pitch: rand(1.0, 1.5) });
          },
          upd(z, dt) {
            for (const e of enemiesNear(z.x, z.y, r * 1.6)) if (!e.boss) { e.vx += (z.x - e.x) * 4 * dt; if (e.flying) e.vy += (z.y - e.cy) * 3 * dt; }
            for (let i = 0; i < 10; i++) {
              const a = rand(0, TAU), rr = rand(10, r);
              FX.add({ k: 'px', x: z.x + Math.cos(a) * rr, y: z.y + Math.sin(a) * rr * 0.55, vx: -Math.sin(a) * 180, vy: Math.cos(a) * 90, life: 0.5, s: rand(2, 3.5), c: pick([PET, '#ffe0ec', RC, '#ffffff']), shrink: true, glow: true });
            }
            if (Math.random() < 0.6) FX.slash(z.x + rand(-r, r) * 0.7, z.y + rand(-r, r) * 0.35, { r: rand(16, 32), a0: -80, a1: 80, th: 4, c: pick([PET, RC, '#ffffff']), f: 1, rot: rand(0, 360), dur: 0.16, sy: 0.5 });
            if (Math.random() < 0.12) FX.ring(z.x, z.y, r * 0.25, r, PET, 0.45, 2, 0.45);
            Light.add(z.x, z.y, r * 2.2, '#ff9ac0', 0.8);
          },
        });
      }],
      [2.42, p => {
        FX.screenFlash('#ffe0ec', 0.7, 0.35); Sound.play('ultBoom'); Cam.shake(0.8); G.hitstop(10);
        const z = p.counters.sakura, cx = z ? z.x : p.x, r = p.skillLv('rin_sakura') >= 3 ? 280 : 130;
        for (const e of enemiesNear(cx, p.y - 30, r)) {
          FX.slash(e.x, e.cy, { r: 30, a0: -80, a1: 80, th: 9, c: RC, f: 1, rot: rand(-50, 50), dur: 0.3 });
          hitEnemy(p, e, p.makeHit({ dmg: 3.0, kx: 200, ky: -320, stun: 1.0, hs: 0, heavy: true, launch: true, dir: sign(e.x - p.x) || 1, src: 'ult', energy: 0 }));
        }
        for (let i = 0; i < 6; i++) petalPuff(cx + rand(-r, r) * 0.6, p.y - rand(10, 80), 20);
      }],
    ],
  },
});

// ---------- patches to base moves ----------
M.dashAtk2.art = 'rin_gale'; M.dashAtk2.label = '燕返'; M.dashAtk2.next = 'gale3'; M.dashAtk2.nextLv = 3;
delete M.dashAtk.next; delete M.dashAtk.nextReq;
M.ult.skill = 'rin_ult';
M.ult.ev.push([1.9, p => {
  if (p.skillLv('rin_ult') < 3) return;
  later(0.25, () => {
    FX.screenFlash('#ff3b5c', 0.4, 0.25); Sound.play('ultBoom'); Cam.shake(0.5);
    for (const e of liveEnemies().filter(onScreen)) {
      FX.add({ k: 'beam', x: e.x - 40, y: e.cy, len: 80, w: 4, ang: rand(-0.6, 0.6), c: RC, life: 0.3 });
      hitEnemy(p, e, p.makeHit({ dmg: 2.0, kx: 0, ky: -200, stun: 0.6, hs: 0, heavy: true, launch: true, dir: 1, src: 'ult', energy: 0, skill: 'rin_ult' }));
    }
  });
}]);
M.ult.dur = 1.95;
// petal zones are tagged so 散华 can detonate them; 飞燕斩 angles down in the air
{
  const ev = M.sk_petal.ev[0][1];
  M.sk_petal.ev[0][1] = p => { const n0 = G.zones.length; ev(p); for (let i = n0; i < G.zones.length; i++) G.zones[i].petal = true; };
  M.sk_petal.grav = 0.3;
  M.sk_wave.grav = 0.3;
  M.sk_wave.ev[0][1] = p => {
    const lv = p.skillLv('rin_wave'), n = lv >= 3 ? 3 : 1, d = p.onGround ? 0 : 24;
    for (let i = 0; i < n; i++) waveProj(p, { dmg: 1.6, ang: (i - (n - 1) / 2) * 12 + d, sp: 430, hh: 16, skill: 'rin_wave' });
    if (lv >= 2) later(0.16, () => waveProj(p, { dmg: 1.2, ang: d, sp: 480, hh: 12, oy: -14, skill: 'rin_wave' }));
    hSlash(p, { x: 6, y: -20, r: 26, a0: -100, a1: 70, th: 9 });
    Sound.play('slashHeavy', { x: p.x, pitch: 1.2 });
  };
  const iai = M.sk_iai.ev[0][1];
  M.sk_iai.ev[0][1] = p => { const x0 = p.x; iai(p); p.counters.iaiPath = { lo: Math.min(x0, p.x) - 10, hi: Math.max(x0, p.x) + 10, y: p.y }; };
  M.sk_meteor.followAt = 0.55;
}

// ---------- 见切连段: 反击 → 燕追 (chase the launched foe upward) → 残月坠 (crescent dive) ----------
M.counter.counter = true; M.counter.next = 'counter2';
M.counter.hits[0].kb = [90, -330];
Object.assign(M, {
  counter2: {
    label: '见切·燕追', dur: 0.42, cancel: 0.26, grav: 0.35, noAtkSpeed: true, counter: true,
    keys: [[0, { ...R_DRAW, lean: 26 }], [0.06, { ...UP1, lean: -12 }, 'outCubic'], [0.42, UPE]],
    onStart(p) { p.inv = Math.max(p.inv, 0.3); p.trail = 0.15; const e = nearestEnemy(p.x, p.cy, 170); if (e) p.face = sign(e.x - p.x) || p.face; },
    vel: [[0.02, 0.12, 260]],
    hits: [{ t: 0.05, d: 0.1, box: [-6, -70, 48, 74], dmg: 1.5, kb: [50, -340], stun: 0.7, hs: 5, launch: true, critBonus: 0.5, src: 'counter' }],
    ev: [[0.05, p => {
      p.vy = Math.min(p.vy, -360);
      Sound.play('slashHeavy', { x: p.x, pitch: 1.3 });
      hSlash(p, { x: 4, y: -28, r: 32, a0: 70, a1: -125, th: 9, sy: 1.2 });
      FX.add({ k: 'streak', x: p.x + p.face * 10, y: p.y - 40, vx: p.face * 300, vy: -2200, life: 0.12, c: '#ffffff', len: 0.03, w: 2 });
    }]],
    next: 'counter3',
  },
  counter3: Object.assign(diveMove({
    label: '见切·残月坠', dur: 0.78, cancel: 0.6, hop: -120, vx: 140, fall: 640, hold: 0.28, fallDmg: 0.9,
    keys: [[0, air({ ...OVER0 })], [0.1, air({ lean: 36, aF: [50, 80], aB: [60, 85], w: 85 }), 'outCubic'], [0.28, air({ lean: 36, aF: [50, 80], aB: [60, 85], w: 85 })], [0.34, { lean: 32, ...OVER1, ...R_CROUCH }, 'outCubic'], [0.78, { lean: 12, aF: [70, 50], w: 40 }]],
    onDive(p) { Sound.play('slashHeavy', { x: p.x, pitch: 0.85 }); p.trail = 0.3; hSlash(p, { x: 6, y: -20, r: 36, a0: -150, a1: 100, th: 11, dur: 0.26 }); },
    onLand(p) {
      counterLand(p, 46, 2.8, RC);
      for (const d of [-1, 1]) { const f = p.face; p.face = d; waveProj(p, { dmg: 1.0, sp: 400, hh: 18, oy: -14, src: 'counter', c: '#ffffff', life: 0.55 }); p.face = f; }
    },
  }), { counter: true }),
});
})();
