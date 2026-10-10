'use strict';
// =====================================================================
//  LAN — 武技 (direction arts), 秘技 派生 follow-ups, 见切连段, 天河倒挂
// =====================================================================
(() => {
const M = HEROES.lan.moves;
const C = LAN_C, FOAM = LAN_FOAM, WV = LAN_W;
const air = o => Object.assign({}, L_AIR, o);
const spinKeys = (n, step, extra, t0 = 0) => altKeys(n, step, Object.assign({}, L_SPIN_A, extra), Object.assign({}, L_SPIN_B, extra)).map(([t, k, e]) => [t + t0, k, e]);
const faceFoe = (p, r) => { const e = nearestEnemy(p.x, p.cy, r); if (e) p.face = sign(e.x - p.x) || p.face; return e; };
// throwing stance: arm cocked over the shoulder, then whipped forward
const THROW0 = { lean: -6, aF: [-150, -170], aB: [60, 80], w: -10 }, THROW1 = { lean: 26, aF: [10, 0], aB: [140, 160], w: 0, lF: [20, 95], lB: [150, 130] };
// a whirling spear: one multi-hit box and the jade rings it throws off
function spinBox(p, mv, rel, dmg, dur, ky = -140) { mv.box = pHit(p, rel, { dmg, kx: 0, ky, stun: 0.4, hs: 1, radial: true, energy: 0.5 }, dur, { multi: 0.08 }); }
function spinFx(p, mv, dt, y = -22, r = 32) {
  mv.ft = (mv.ft || 0) - dt;
  if (mv.ft > 0) return;
  mv.ft = 0.08;
  FX.slash(p.x, p.y + y, { r, a0: -180, a1: 180, th: 4, c: C, f: (mv.k = -(mv.k || 1)), sy: 0.4, dur: 0.12 });
  Sound.play('swoosh', { x: p.x, pitch: rand(1.0, 1.3) });
}
// 掷枪影 leaves a spear of light hanging where it stopped; 踏影 blinks to it
function stuckShade(p, x, y, f) {
  if (p.counters.cometShade) p.counters.cometShade.life = 0;
  p.counters.cometShade = addZone({
    x, y, life: 2.5,
    drawFn(ctx, gctx, x2, y2, z) {
      const a = Math.min(1, z.life * 2) * (0.7 + 0.3 * Math.sin(z.t * 12)), X = Math.round(x2), Y = Math.round(y2);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
      ctx.fillStyle = C; ctx.fillRect(f > 0 ? X - 22 : X, Y - 1, 22, 2);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(f > 0 ? X - 2 : X - 2, Y - 1, 4, 2);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      gctx.globalAlpha = 0.4 * a; gctx.fillStyle = C; gctx.fillRect(X - 24, Y - 3, 48, 6); gctx.globalAlpha = 1;
    },
  });
  FX.burst(x, y, { n: 6, c: [C, '#ffffff'], sp: [30, 90], glow: true });
}

Object.assign(M, {
  // ================= 游龙升 (↑) =================
  dragon1: {
    label: '龙抬头', dur: 0.5, cancel: 0.32, art: 'lan_dragon',
    keys: [[0, L_UP0], [0.06, { ...L_UP1, gl: 0.2, lean: -12 }, 'outCubic'], [0.5, L_UPE]],
    vel: [[0.03, 0.14, 140]],
    hits: [{ t: 0.05, d: 0.12, box: [-4, -66, 44, 68], dmg: 1.2, kb: [50, -420], stun: 0.7, hs: 4, launch: true }],
    ev: [[0.05, p => {
      p.vy = -340; Sound.play('thrust', { x: p.x, pitch: 1.1 }); Sound.play('slashHeavy', { x: p.x, pitch: 1.25 });
      lanThrustFx(p, { deg: -70, len: 44, y: -26 });
      // a small water-dragon spirals up beside the spear
      lanDragon(p, { x: p.x + p.face * 14, y: p.y - 30, vx: p.face * 50, life: 0.55, dmg: 0.6, r: 16, size: 0.8, amp: 4, freq: 14, src: 'light', upd(z, dt) { z.y0 -= 240 * dt; } });
    }]],
    next: 'dragon2',
  },
  dragon2: {
    label: '云中刺', dur: 0.46, cancel: 0.3, air: true, grav: 0.1, art: 'lan_dragon',
    keys: [
      [0, air({ ...L_BACK, lean: -6, w: -30 })],
      ...[0.05, 0.13, 0.21].flatMap(t => [[t, air({ lean: -10, aF: [-30, -35], aB: [-10, -20], w: -35 }), 'outCubic'], [t + 0.04, air({ lean: -4, aF: [60, 140], aB: [70, 120], w: -30 })]]),
      [0.46, air({ lean: 0, aF: [-20, -30], aB: [30, 10], w: -30 })],
    ],
    hits: [0.05, 0.13, 0.21].map((t, i) => ({ t, d: 0.06, box: [0, -64, 52, 46], dmg: 0.55 + i * 0.05, kb: [40, -200], stun: 0.45, hs: 2 })),
    ev: [0.05, 0.13, 0.21].map((t, i) => [t - 0.01, p => {
      if (!i) p.vy = Math.min(p.vy, -120);
      Sound.play('thrust', { x: p.x, pitch: 1.1 + i * 0.12 });
      lanThrustFx(p, { deg: -35, len: 46, y: -24 });
    }]),
    next: 'dragon3',
  },
  dragon3: {
    label: '盘龙', dur: 0.5, cancel: 0.36, air: true, grav: 0.05, art: 'lan_dragon',
    keys: spinKeys(6, 0.07, L_AIR),
    onStart(p, mv) { p.vy = Math.min(p.vy, -60); spinBox(p, mv, [-38, -52, 76, 54], 0.42, 0.42, -150); },
    update(p, mv, dt) {
      spinFx(p, mv, dt, -24, 36);
      for (const e of enemiesNear(p.x, p.cy, 80)) if (!e.boss) { e.vx += (p.x - e.x) * 4 * dt; e.vy = Math.min(e.vy, -20); }
    },
    onEnd(p, mv) { if (mv.box) mv.box.life = 0; },
    next: 'dragon4',
  },
  dragon4: diveMove({
    label: '游龙坠', art: 'lan_dragon', dur: 0.8, cancel: 0.62, hop: -150, vx: 120, fall: 620, hold: 0.28, fallDmg: 0.9,
    keys: [[0, air(L_RAISE)], [0.1, air({ ...L_DIVE, lean: 30 }), 'outCubic'], [0.28, air({ ...L_DIVE, lean: 30 })], [0.34, { ...L_PLANT, lean: 28, ...L_CROUCH }, 'outCubic'], [0.8, L_EASE]],
    onDive(p) { Sound.play('thrust', { x: p.x, pitch: 0.7 }); p.trail = 0.3; },
    onLand(p) {
      landImpact(p, 40, 2.2, C, { finisher: false });
      const x0 = p.x, f = p.face;
      [0, 1, 2].forEach(i => later(0.06 + i * 0.08, () => {
        lanGeyser(p, x0 + f * (22 + i * 30), 1.3, { h: 66 + i * 8, w: 20, art: 'lan_dragon' });
        if (i === 2) p.fire('onFinisher', null, { finisher: true });
      }));
    },
  }),

  // ================= 凌云 (↑) =================
  cloud1: {
    label: '撑杆踢', dur: 0.52, cancel: 0.34, grav: 0.6, art: 'lan_cloud',
    keys: [[0, { ...L_PLANT, lean: 4, ...L_CROUCH }], [0.08, { gl: 0, lean: -20, aF: [40, 70], aB: [50, 80], w: 75, lF: [-10, 20], lB: [100, 120] }, 'outCubic'], [0.52, air(L_UPE)]],
    vel: [[0.06, 0.22, 170]],
    ev: [[0.06, p => { p.vy = -360; Sound.play('jump', { x: p.x, pitch: 0.9 }); FX.dust(p.x, p.y, 8, 0); }]],
    hits: [{ t: 0.08, d: 0.1, box: [0, -50, 40, 40], dmg: 1.2, kb: [140, -320], stun: 0.6, hs: 4, launch: true }],
    next: 'cloud2',
  },
  cloud2: {
    label: '倒挂金钩', dur: 0.46, cancel: 0.3, air: true, grav: 0.15, art: 'lan_cloud',
    keys: [[0, air({ lean: 20, aF: [100, 140], aB: [90, 130], w: 150 })], [0.07, air({ lean: -30, aF: [-100, -120], aB: [-80, -110], w: -130, lF: [20, 60], lB: [80, 120] }), 'outCubic'], [0.46, air({ ...L_UPE, lean: -6 })]],
    // the hook draws foes toward Lan as it lifts them
    hits: [{ t: 0.06, d: 0.1, box: [-14, -64, 60, 70], dmg: 1.1, kb: [-140, -300], stun: 0.6, hs: 4, launch: true }],
    ev: [[0.06, p => { p.vy = Math.min(p.vy, -200); Sound.play('slashHeavy', { x: p.x, pitch: 1.2 }); hSlash(p, { x: 4, y: -26, r: 34, a0: 120, a1: -130, th: 8, sy: 1.1, c: C }); }]],
    next: 'cloud3',
  },
  cloud3: {
    label: '翻身劈枪', dur: 0.5, cancel: 0.36, air: true, grav: 0.2, art: 'lan_cloud',
    keys: [[0, air(L_RAISE)], [0.08, air({ ...L_SMASH, lean: 30 }), 'outCubic'], [0.16, air(L_RAISE)], [0.24, air({ ...L_SMASH, lean: 36 }), 'outCubic'], [0.5, air({ lean: 14, aF: [50, 40], aB: [60, 50], w: 40 })]],
    hits: [
      { t: 0.08, d: 0.06, box: [-6, -44, 54, 58], dmg: 0.8, kb: [60, -100], stun: 0.45, hs: 3 },
      { t: 0.24, d: 0.07, box: [-6, -40, 56, 60], dmg: 1.1, kb: [80, 260], stun: 0.5, hs: 5, heavy: true },
    ],
    ev: [0.08, 0.24].map((t, i) => [t - 0.01, p => {
      if (!i) p.vy = Math.min(p.vy, -160);
      Sound.play('slashHeavy', { x: p.x, pitch: 1.1 - i * 0.2 });
      hSlash(p, { x: 6, y: -22, r: 32, a0: -140, a1: 90, th: 8, c: i ? FOAM : C });
    }]),
    next: 'cloud4',
  },
  cloud4: diveMove({
    label: '落枪阵', art: 'lan_cloud', dur: 0.82, cancel: 0.62, hop: -100, fall: 640, hold: 0.24,
    keys: [[0, air(L_RAISE)], [0.1, air({ ...L_PLANT, lean: 20 }), 'outCubic'], [0.24, air({ ...L_PLANT, lean: 20 })], [0.3, { ...L_PLANT, lean: 30, ...L_CROUCH }, 'outCubic'], [0.82, L_EASE]],
    onLand(p) {
      landImpact(p, 36, 1.6, C, { finisher: false });
      const x0 = p.x, f = p.face;
      for (let i = 0; i < 5; i++) later(0.06 + i * 0.07, () => {
        groundColumn(p, x0 + f * (30 + i * 26), 1.2, i === 4 ? '#ffffff' : C, { h: 54 + i * 5, w: 16, bw: 4, art: 'lan_cloud', sound: 'thrust' });
        if (i === 4) p.fire('onFinisher', null, { finisher: true });
      });
    },
  }),

  // ================= 扫千军 (↓) =================
  sweep1: {
    label: '低扫', dur: 0.42, cancel: 0.27, art: 'lan_sweep',
    keys: [[0, { lean: 22, aF: [120, 150], aB: [110, 140], w: 160, ...L_CROUCH }], [0.07, { lean: 30, aF: [40, 60], aB: [60, 70], w: 25, lF: [12, 118], lB: [162, 96] }, 'outCubic'], [0.42, { lean: 16, aF: [50, 30], aB: [60, 40], w: 20, lF: [40, 110], lB: [140, 96] }]],
    vel: [[0.02, 0.12, 140]],
    hits: [{ t: 0.06, d: 0.07, box: [-8, -18, 62, 20], dmg: 0.95, kb: [60, -240], stun: 0.6, hs: 3, launch: true }],
    ev: [[0.05, p => {
      Sound.play('swoosh', { x: p.x, pitch: 0.75 });
      hSlash(p, { x: 4, y: -8, r: 36, a0: -170, a1: 30, th: 5, sy: 0.28, c: C });
      lanSurge(p, p.x + p.face * 30, p.y, p.face, 0.7, { art: 'lan_sweep', life: 0.4, h: 14 });
    }]],
    next: 'sweep2',
  },
  sweep2: {
    label: '回扫', dur: 0.46, cancel: 0.3, art: 'lan_sweep',
    keys: [[0, { lean: 28, aF: [40, 60], aB: [60, 70], w: 25, ...L_CROUCH }], [0.08, { lean: 16, aF: [175, 195], aB: [10, 20], w: 200, ...L_CROUCH }, 'outCubic'], [0.46, { lean: 14, aF: [60, 40], aB: [60, 40], w: 30, lF: [40, 110], lB: [140, 96] }]],
    hits: [{ t: 0.05, d: 0.1, box: [-56, -24, 112, 26], dmg: 1.1, kb: [60, -300], stun: 0.65, hs: 4, launch: true, radial: true }],
    ev: [[0.05, p => { Sound.play('swoosh', { x: p.x, pitch: 0.65 }); hSlash(p, { x: 0, y: -10, r: 46, a0: -180, a1: 180, th: 5, sy: 0.22, dur: 0.22, c: C }); FX.dust(p.x, p.y, 10, 0); }]],
    next: 'sweep3',
  },
  sweep3: {
    label: '车轮', dur: 0.6, cancel: 0.46, art: 'lan_sweep',
    keys: spinKeys(8, 0.07, { lean: 18, ...L_CROUCH }),
    vel: [[0, 0.5, 150]],
    onStart(p, mv) { spinBox(p, mv, [-40, -30, 80, 32], 0.4, 0.5, -150); },
    update(p, mv, dt) { if (mv.t < 0.5) { spinFx(p, mv, dt, -12, 40); if (Math.random() < 0.4) FX.dust(p.x, p.y, 2, -p.face); } },
    onEnd(p, mv) { if (mv.box) mv.box.life = 0; },
    next: 'sweep4',
  },
  sweep4: {
    label: '横扫千军', dur: 0.78, cancel: 0.6, art: 'lan_sweep',
    // one full turn of the spear: from behind, over the top, through the front and under
    keys: [[0, { ...L_SWEEP0, lean: -6, w: -178 }], [0.14, { lean: 0, aF: [-150, -170], aB: [-130, -160], w: -178 }], [0.24, { lean: 30, aF: [10, 20], aB: [30, 40], w: 182, ...L_CROUCH }, 'outCubic'], [0.78, L_EASE]],
    hits: [{ t: 0.22, d: 0.1, box: [-66, -44, 132, 48], dmg: 2.4, kb: [280, -300], stun: 0.8, hs: 8, heavy: true, launch: true, radial: true, finisher: true, src: 'heavy' }],
    ev: [
      [0.06, p => Sound.play('charge', { x: p.x, pitch: 1.1 })],
      [0.22, p => {
        Sound.play('slashHeavy', { x: p.x, pitch: 0.6 }); Sound.play('splash', { x: p.x, pitch: 0.8 }); Cam.shake(0.5);
        FX.slash(p.x, p.y - 20, { r: 58, a0: -180, a1: 180, th: 9, c: C, f: p.face, sy: 0.45, dur: 0.3 });
        FX.ring(p.x, p.y - 16, 8, 80, C, 0.35, 4, 0.4);
        for (const d of [-1, 1]) lanSurge(p, p.x + d * 26, p.y, d, 1.2, { art: 'lan_sweep', life: 0.65, h: 24, sp: 330 });
      }],
    ],
  },

  // ================= 地龙 (↓) =================
  ground1: {
    label: '刺地', dur: 0.46, cancel: 0.3, art: 'lan_ground',
    keys: [[0, L_RAISE], [0.08, { lean: 26, aF: [50, 70], aB: [60, 80], w: 70, ...L_CROUCH }, 'outCubic'], [0.46, L_EASE]],
    hits: [{ t: 0.08, d: 0.06, box: [8, -16, 44, 18], dmg: 0.6, kb: [40, -120], stun: 0.4, hs: 2 }],
    ev: [[0.08, p => {
      Sound.play('thrust', { x: p.x, pitch: 0.8 }); FX.dust(p.x + p.face * 30, p.y, 6, p.face);
      const x = p.x + p.face * 50;
      later(0.06, () => lanGeyser(p, x, 1.3, { h: 58, art: 'lan_ground' }));
    }]],
    next: 'ground2',
  },
  ground2: {
    label: '连刺地', dur: 0.5, cancel: 0.34, art: 'lan_ground',
    keys: [[0, { lean: 26, aF: [50, 70], aB: [60, 80], w: 70, ...L_CROUCH }], [0.06, { lean: 10, aF: [100, 150], aB: [90, 130], w: 140, ...L_CROUCH }], [0.1, { lean: 30, aF: [45, 65], aB: [55, 75], w: 65, ...L_CROUCH }, 'outCubic'], [0.5, L_EASE]],
    ev: [[0.1, p => {
      const x0 = p.x, f = p.face;
      Sound.play('thrust', { x: p.x, pitch: 0.9 });
      for (let i = 0; i < 3; i++) later(i * 0.08, () => lanGeyser(p, x0 + f * (40 + i * 32), 1.1, { h: 52 + i * 6, art: 'lan_ground' }));
    }]],
    next: 'ground3',
  },
  ground3: {
    label: '掀浪', dur: 0.52, cancel: 0.36, art: 'lan_ground',
    keys: [[0, { lean: 28, aF: [50, 70], aB: [60, 80], w: 70, ...L_CROUCH }], [0.08, { ...L_UP1, gl: 1, lean: -8 }, 'outCubic'], [0.52, { lean: 0, aF: [-50, -70], aB: [-40, -60], w: -65 }]],
    hits: [{ t: 0.07, d: 0.08, box: [0, -50, 44, 50], dmg: 0.8, kb: [40, -300], stun: 0.55, hs: 3, launch: true }],
    ev: [[0.07, p => {
      Sound.play('splash', { x: p.x, pitch: 0.7 });
      hSlash(p, { x: 4, y: -22, r: 30, a0: 80, a1: -110, th: 7, c: FOAM });
      lanSurge(p, p.x + p.face * 20, p.y, p.face, 1.4, { art: 'lan_ground', life: 0.75, h: 30, sp: 280 });
    }]],
    next: 'ground4',
  },
  ground4: {
    label: '龙吟', dur: 0.82, cancel: 0.62, art: 'lan_ground', noAtkSpeed: true,
    keys: [[0, L_RAISE], [0.14, { ...L_PLANT, lean: 30, ...L_CROUCH }, 'outCubic'], [0.82, L_PLANT]],
    onStart(p) { p.armorT = 0.5; },
    ev: [
      [0.14, p => { Sound.play('stomp', { x: p.x }); FX.shock(p.x + p.face * 10, p.y, C, 50); Cam.shake(0.35); }],
      [0.3, p => {
        Sound.play('roar', { x: p.x, pitch: 1.4 }); Sound.play('splash', { x: p.x, pitch: 0.6 });
        const f = p.face, x0 = p.x;
        // a dragon breaks out of the ground and runs the floor ahead
        lanDragon(p, { x: x0 + f * 20, y: p.y - 10, vx: f * 360, life: 0.8, dmg: 1.5, r: 22, size: 1.5, amp: 5, ground: true, art: 'lan_ground', rehit: 0.4, hs: 4 });
        for (let i = 0; i < 4; i++) later(0.12 + i * 0.1, () => lanGeyser(p, x0 + f * (60 + i * 60), 1.0, { h: 60, art: 'lan_ground' }));
        later(0.5, () => p.fire('onFinisher', null, { finisher: true }));
      }],
    ],
  },

  // ================= 突骑 (冲刺) =================
  rush1: {
    label: '突刺', dur: 0.42, cancel: 0.26, grav: 0, art: 'lan_rush', noAtkSpeed: true,
    keys: [[0, { ...L_BACK, lean: 30 }], [0.04, { ...L_THRUST, lean: 40 }, 'outCubic'], [0.42, { ...L_EASE, lean: 16 }]],
    onStart(p) { p.inv = Math.max(p.inv, 0.2); p.trail = 0.15; },
    vel: [[0.02, 0.16, 640, 0]],
    hits: [{ t: 0.03, d: 0.14, box: [-10, -32, 68, 22], dmg: 1.4, kb: [160, -60], stun: 0.5, hs: 4 }],
    ev: [[0.03, p => { Sound.play('dash', { x: p.x, pitch: 1.2 }); Sound.play('thrust', { x: p.x, pitch: 0.9 }); lanThrustFx(p, { len: 64, w: 4 }); }]],
    next: 'rush2',
  },
  rush2: {
    label: '再突', dur: 0.46, cancel: 0.3, grav: 0, art: 'lan_rush', noAtkSpeed: true,
    keys: [[0, { ...L_BACK, lean: 34, ...L_CROUCH }], [0.05, { ...L_THRUST, lean: 44 }, 'outCubic'], [0.46, { ...L_EASE, lean: 16 }]],
    onStart(p) { p.inv = Math.max(p.inv, 0.22); p.trail = 0.2; },
    vel: [[0.03, 0.2, 700, 0]],
    hits: [{ t: 0.04, d: 0.16, box: [-14, -34, 74, 24], dmg: 1.5, kb: [240, -100], stun: 0.55, hs: 5, heavy: true }],
    ev: [[0.04, p => {
      Sound.play('thrust', { x: p.x, pitch: 0.75 }); lanThrustFx(p, { len: 80, w: 5 });
      lanNeedle(p, { dmg: 0.6, sp: 760, len: 30, life: 0.3, pierce: 6, art: 'lan_rush' });
    }]],
    next: 'rush3',
  },
  rush3: {
    label: '回马枪', dur: 0.48, cancel: 0.32, grav: 0.3, art: 'lan_rush', noAtkSpeed: true,
    keys: [[0, { ...L_SWEEP0, lean: 18 }], [0.06, { ...L_THRUST, lean: 34 }, 'outCubic'], [0.48, { ...L_EASE, lean: 14 }]],
    onStart(p) { p.face = -p.face; p.inv = Math.max(p.inv, 0.2); },
    vel: [[0.04, 0.12, 260]],
    hits: [{ t: 0.05, d: 0.09, box: [-6, -38, 66, 30], dmg: 1.7, kb: [200, -260], stun: 0.6, hs: 6, heavy: true, launch: true, critBonus: 0.3 }],
    ev: [[0.05, p => { Sound.play('slashHeavy', { x: p.x, pitch: 1.1 }); lanThrustFx(p, { len: 62, w: 4, c: FOAM }); hSlash(p, { x: 4, y: -22, r: 32, a0: -150, a1: 20, th: 7, c: C }); }]],
    next: 'rush4',
  },
  rush4: {
    label: '七进七出', dur: 1.05, cancel: 0.86, grav: 0, art: 'lan_rush', noAtkSpeed: true,
    keys: [...altKeys(7, 0.12, { ...L_THRUST, lean: 42 }, { ...L_THRUST, lean: 38, aF: [0, -5], w: -4 }), [1.05, { ...L_EASE, lean: 14 }]],
    onStart(p, mv) {
      p.inv = Math.max(p.inv, 1.0); p.vy = 0; mv.lo = p.x; mv.hi = p.x;
      mv.box = pHit(p, [-24, -38, 48, 38], { dmg: 0.55, kx: 30, ky: -80, stun: 0.5, hs: 1, radial: true, energy: 0.4 }, 0.84, { multi: 0.11 });
      Sound.play('dash', { x: p.x, pitch: 0.8 });
    },
    update(p, mv) {
      if (mv.t >= 0.84) { p.vx = 0; return; }
      // seven passes: turn every 0.12 s (sooner at walls) and run back through the crowd
      const k = Math.floor(mv.t / 0.12);
      if (k !== mv.k) {
        mv.k = k; if (k) p.face = -p.face; p.trail = 0.15;
        Sound.play('thrust', { x: p.x, pitch: 1 + (k % 2) * 0.2 });
        FX.ghost(p.frame(), p.spr.ox, p.spr.oy, p.x, p.y, p.face < 0, C, 0.35, 0.6);
      }
      if (G.room.solidPx(p.x + p.face * 10, p.y - 12) || p.x < 3 * TILE || p.x > G.room.pw - 3 * TILE) p.face = sign(G.room.pw / 2 - p.x) || -p.face;
      p.vx = p.face * 620; p.vy = 0;
      mv.lo = Math.min(mv.lo, p.x); mv.hi = Math.max(mv.hi, p.x);
      if (Math.random() < 0.9) FX.add({ k: 'streak', x: p.x, y: p.y - rand(10, 34), vx: p.vx, vy: 0, life: 0.08, c: pick([C, '#ffffff']), len: 0.03, w: 1 });
    },
    ev: [[0.86, (p, mv) => {
      // every pass left its cut: the whole lane bursts at once
      const lo = mv.lo - 20, hi = mv.hi + 20;
      for (const e of enemiesInRect(lo, p.y - 64, hi - lo, 76)) hitEnemy(p, e, p.makeHit({ dmg: 2.2, kx: 0, ky: -320, launch: true, stun: 0.8, heavy: true, hs: 0, dir: p.face, src: 'heavy', finisher: true }));
      FX.add({ k: 'beam', x: lo, y: p.y - 22, len: hi - lo, w: 5, ang: 0, c: C, life: 0.3 });
      FX.add({ k: 'beam', x: lo, y: p.y - 22, len: hi - lo, w: 1.5, ang: 0, c: '#ffffff', life: 0.4 });
      FX.screenFlash(FOAM, 0.35, 0.2); Cam.shake(0.5); Sound.play('ultBoom'); G.hitstop(6);
      p.fire('onFinisher', null, { finisher: true });
    }]],
    onEnd(p, mv) { if (mv.box) mv.box.life = 0; },
  },

  // ================= 流星枪 (冲刺) =================
  comet1: {
    label: '掷枪影', dur: 0.44, cancel: 0.28, grav: 0.2, art: 'lan_comet',
    keys: [[0, THROW0], [0.06, THROW1, 'outCubic'], [0.44, L_EASE]],
    ev: [[0.06, p => {
      const f = p.face, y = p.y - 24, x0 = p.x + f * 14, max = 170 * p.reach({ fam: 'art', id: 'lan_comet' });
      let d0 = max;
      for (let d = 0; d < max; d += 8) if (G.room.solidPx(x0 + f * d, y)) { d0 = d; break; }
      const sp = 760, life = Math.max(0.05, d0 / sp);
      lanNeedle(p, { x: x0, y, dmg: 1.1, sp, len: 32, r: 2.6, life, pierce: 9, art: 'lan_comet' });
      Sound.play('thrust', { x: p.x, pitch: 0.8 }); Sound.play('swoosh', { x: p.x, pitch: 1.4 });
      later(life, () => stuckShade(p, x0 + f * d0, y, f));
    }]],
    next: 'comet2',
  },
  comet2: {
    label: '踏影', dur: 0.5, cancel: 0.34, grav: 0, art: 'lan_comet', noAtkSpeed: true,
    keys: [[0, air({ ...L_RAISE, lean: 20 })], [0.06, { ...L_SMASH, lean: 36 }, 'outCubic'], [0.5, L_EASE]],
    onStart(p) {
      const s = p.counters.cometShade && p.counters.cometShade.life > 0 ? p.counters.cometShade : null;
      FX.ghost(p.frame(), p.spr.ox, p.spr.oy, p.x, p.y, p.face < 0, C, 0.3, 0.7);
      const nx = clamp(s ? s.x : p.x + p.face * 110, 2.5 * TILE, G.room.pw - 2.5 * TILE), ny = s ? s.y + 24 : p.y;
      // blink only into open space
      if (!G.room.solidPx(nx, ny - 12) && !G.room.solidPx(nx, ny - 28)) { p.face = sign(nx - p.x) || p.face; p.x = nx; p.y = Math.min(ny, G.room.floorBelow(nx, ny - 30)); }
      if (s) s.life = 0;
      p.vx = 0; p.vy = 0; p.inv = Math.max(p.inv, 0.3);
      Sound.play('teleport', { x: p.x, pitch: 1.2 });
    },
    hits: [{ t: 0.06, d: 0.08, box: [-30, -48, 60, 56], dmg: 1.6, kb: [120, -280], stun: 0.6, hs: 6, heavy: true, launch: true, radial: true }],
    ev: [[0.06, p => { Sound.play('slashHeavy', { x: p.x, pitch: 0.9 }); Sound.play('splash', { x: p.x }); FX.ring(p.x, p.cy, 4, 46, C, 0.3, 3); lanSplash(p.x, p.cy, 14); }]],
    update(p, mv, dt) { if (mv.t > 0.1) p.vy = Math.min(p.vy + GRAV * dt, MAX_FALL); },
    next: 'comet3',
  },
  comet3: {
    label: '分光', dur: 0.48, cancel: 0.32, grav: 0.3, art: 'lan_comet',
    keys: [[0, THROW0], [0.06, THROW1, 'outCubic'], [0.48, L_EASE]],
    ev: [[0.06, p => {
      for (const a of [-18, 0, 18]) lanNeedle(p, { ang: a + (p.onGround ? 0 : 14), dmg: 0.9, sp: 700, len: 30, r: 2.4, life: 0.4, pierce: 9, art: 'lan_comet' });
      Sound.play('thrust', { x: p.x, pitch: 0.9 }); Sound.play('swoosh', { x: p.x, pitch: 1.2 });
    }]],
    next: 'comet4',
  },
  comet4: {
    label: '流星雨', dur: 0.8, cancel: 0.62, grav: 0, art: 'lan_comet', noAtkSpeed: true,
    keys: [[0, { ...L_BACK, ...L_CROUCH }], [0.1, air(L_RAISE)], [0.3, air(L_RAISE)], [0.36, air({ lean: 30, aF: [40, 50], aB: [140, 160], w: 45 }), 'outCubic'], [0.8, air(L_EASE)]],
    onStart(p) { p.inv = Math.max(p.inv, 0.5); },
    ev: [
      [0.04, p => { p.vy = -420; Sound.play('jump', { x: p.x, pitch: 0.8 }); }],
      [0.36, p => {
        Sound.play('thrust', { x: p.x, pitch: 0.6 }); Sound.play('charge', { x: p.x, pitch: 1.5 }); FX.screenFlash(FOAM, 0.2, 0.12);
        for (let i = 0; i < 8; i++) later(i * 0.035, () => lanNeedle(p, {
          x: p.x + p.face * 6, y: p.y - 24, ang: 28 + i * 7, dmg: 0.85, sp: 640, len: 30, r: 2.4, life: 0.6, pierce: 9, art: 'lan_comet',
          upd(q) {
            if (q.landed || !G.room.solidPx(q.x, q.y + 2)) return;
            q.landed = true; q.life = 0; lanSplash(q.x, q.y, 6);
            if (i % 2 === 0) lanGeyser(p, q.x, 0.8, { h: 40, w: 14, art: 'lan_comet' });
          },
        }));
        later(0.32, () => p.fire('onFinisher', null, { finisher: true }));
      }],
    ],
    update(p, mv, dt) { if (mv.t > 0.04 && mv.t < 0.36) p.vy *= 0.9; else if (mv.t >= 0.36) p.vy = Math.min(p.vy + GRAV * dt * 0.8, MAX_FALL); },
  },

  // ================= 秘技 派生 =================
  f_hundred: {
    label: '凤鸣', dur: 0.5, cancel: 0.36, skill: 'lan_hundred', isFollow: true, noAtkSpeed: true,
    keys: [[0, THROW0], [0.08, THROW1, 'outCubic'], [0.5, L_EASE]],
    ev: [[0.08, p => {
      lanNeedle(p, { dmg: 2.6, sp: 560, len: 64, r: 5, life: 0.9, pierce: 99, skill: 'lan_hundred', src: 'skill', c: '#ffd36a', kx: 260, ky: -160, hs: 4, trail: 0.8 });
      Sound.play('slashHeavy', { x: p.x, pitch: 0.7 }); Sound.play('thrust', { x: p.x, pitch: 0.6 }); Cam.shake(0.3); FX.screenFlash('#fff2c0', 0.2, 0.12);
    }]],
  },
  f_tide: {
    label: '潮涌', dur: 0.5, cancel: 0.36, skill: 'lan_tide', isFollow: true, noAtkSpeed: true,
    keys: [[0, L_PLANT], [0.08, { ...L_UP1, gl: 1, lean: -10 }, 'outCubic'], [0.5, L_UPE]],
    ev: [[0.08, p => {
      const z = p.counters.tide && p.counters.tide.life > 0 ? p.counters.tide : null;
      const x = z ? z.x : p.x, y = z ? z.y : p.cy, R = (z ? z.R : 56) * 1.25;
      if (z) z.life = 0;
      explodeP(x, y, R, 2.2 * skMul(p, 'lan_tide'), { c: C, c2: FOAM, kx: 300, ky: -300, shake: 0.5, src: 'skill', noProc: false, pitch: 0.7, wx: { fam: 'sk', id: 'lan_tide' } });
      const gy = G.room.floorBelow(x, y);
      for (const d of [-1, 1]) lanSurge(p, x + d * 20, gy, d, 1.2, { skill: 'lan_tide', src: 'skill', life: 0.6, h: 26 });
      lanSplash(x, y, 24); Sound.play('splash', { x, pitch: 0.6 });
    }]],
  },
  f_pierce: {
    label: '拔阵', dur: 0.5, cancel: 0.36, skill: 'lan_pierce', isFollow: true, noAtkSpeed: true,
    keys: [[0, { ...L_SWEEP0, lean: -4, w: -178 }], [0.1, { lean: 26, aF: [10, 20], aB: [30, 40], w: 182, ...L_CROUCH }, 'outCubic'], [0.5, L_EASE]],
    onStart(p) { p.face = -p.face; p.armorT = 0.4; },
    hits: [{ t: 0.08, d: 0.1, box: [-58, -46, 116, 50], dmg: 1.8, kb: [220, -340], stun: 0.7, hs: 6, heavy: true, launch: true, radial: true }],
    ev: [[0.08, p => {
      Sound.play('slashHeavy', { x: p.x, pitch: 0.7 }); Sound.play('swoosh', { x: p.x, pitch: 0.5 });
      FX.slash(p.x, p.y - 20, { r: 52, a0: -180, a1: 180, th: 8, c: C, f: p.face, sy: 0.45, dur: 0.26 });
      FX.ring(p.x, p.y - 16, 6, 60, C, 0.3, 3, 0.4); Cam.shake(0.35);
    }]],
  },
  f_jiao: {
    label: '龙摆尾', dur: 0.42, cancel: 0.3, skill: 'lan_jiao', isFollow: true,
    keys: [[0, L_RAISE], [0.08, { ...L_SWEEP0, lean: 20 }], [0.16, { lean: 24, aF: [20, 30], aB: [40, 50], w: 30 }, 'outCubic'], [0.42, L_EASE]],
    ev: [[0.1, p => {
      const list = (Array.isArray(p.counters.jiao) ? p.counters.jiao : []).filter(z => z.life > 0);
      // the dragons whip round and sweep back, harder
      for (const z of list) { z.vx = -z.vx * 1.15; z.life += 0.7; z.hitT = {}; z.mul = 1.5; }
      if (!list.length) lanDragon(p, { x: p.x + p.face * 20, y: p.y - 12, vx: p.face * 320, life: 0.8, dmg: 1.3, r: 20, size: 1.2, amp: 6, ground: true, src: 'skill', skill: 'lan_jiao' });
      Sound.play('roar', { x: p.x, pitch: 1.9 }); Sound.play('splash', { x: p.x, pitch: 1.1 });
    }]],
  },
  f_vault: diveMove({
    label: '坠枪', skill: 'lan_vault', isFollow: true, dur: 0.72, cancel: 0.56, hop: -60, vx: 0, fall: 780, hold: 0.24, fallDmg: 1.0, inv: 0.6,
    keys: [[0, air({ lean: 0, aF: [-60, -90], aB: [-80, -95], w: -90 })], [0.1, air({ ...L_PLANT, lean: 6 }), 'outCubic'], [0.24, air({ ...L_PLANT, lean: 6 })], [0.3, { ...L_PLANT, lean: 20, ...L_CROUCH }, 'outCubic'], [0.72, L_EASE]],
    onDive(p) { Sound.play('thrust', { x: p.x, pitch: 0.6 }); },
    onLand(p) {
      landImpact(p, 44, 2.0, C, { skill: 'lan_vault', src: 'skill' });
      for (const d of [-1, 0, 1]) later(0.05 + Math.abs(d) * 0.08, () => lanGeyser(p, p.x + d * 36, 1.2, { h: d ? 60 : 80, w: d ? 18 : 24, skill: 'lan_vault', src: 'skill' }));
    },
  }),
  f_rainbow: {
    label: '虹落', dur: 0.46, cancel: 0.32, skill: 'lan_rainbow', isFollow: true,
    keys: [[0, { lean: 10, aF: [-80, -95], aB: [-60, -80], w: -90 }], [0.08, { ...L_SMASH, lean: 30 }, 'outCubic'], [0.46, L_EASE]],
    ev: [[0.08, p => {
      const zs = G.zones.filter(z => z.rainbow && z.life > 0);
      Sound.play('clank', { x: p.x, pitch: 2 });
      zs.forEach((z, i) => later(i * 0.04, () => { z.life = 0; lanGeyser(p, z.x, 1.4, { h: 64, skill: 'lan_rainbow', src: 'skill' }); }));
      if (!zs.length) lanGeyser(p, p.x + p.face * 50, 1.4, { h: 64, skill: 'lan_rainbow', src: 'skill' });
    }]],
  },
  f_dive: {
    label: '再游', dur: 0.62, cancel: 0.42, air: true, grav: 0, skill: 'lan_dive', isFollow: true, noAtkSpeed: true,
    keys: [[0, air({ ...L_BACK, lean: -6 })], [0.06, air(L_DIVE), 'outCubic'], [0.62, air({ ...L_DIVE, lean: 30 })]],
    onStart(p, mv) {
      const e = nearestEnemy(p.x, p.cy, 220);
      let fx = p.face * 0.7, fy = 0.7;
      if (e) { const dx = e.x - p.x, dy = e.cy - p.cy, d = Math.hypot(dx, dy) || 1; fx = dx / d; fy = dy / d; p.face = sign(dx) || p.face; }
      lanDiveStart(p, mv, fx, fy);
    },
    update(p, mv, dt) { lanDiveUpdate(p, mv, dt); },
    onEnd(p, mv) { if (mv.box) mv.box.life = 0; },
  },
  f_windmill: {
    label: '掷轮', dur: 0.46, cancel: 0.3, air: true, grav: 0.2, skill: 'lan_windmill', isFollow: true,
    keys: [[0, air(THROW0)], [0.08, air(THROW1), 'outCubic'], [0.46, air(L_EASE)]],
    ev: [[0.08, p => {
      const f = p.face, hit = p.makeHit({ dmg: 1.1, kx: 120, ky: -160, stun: 0.5, hs: 3, src: 'skill', fxc: C });
      // a spinning wheel of spear that flies out and comes back to Lan's hand
      G.projs.push(new Proj({
        team: 'p', x: p.x + f * 14, y: p.y - 22, vx: f * 380, vy: 0, kind: 'shard', r: 7, spin: 40, c: C, c2: FOAM, life: 1.3, pierce: 99, ghost: true, light: 60, hit,
        upd(q) {
          if (q.t > 0.4 && !q.back) { q.back = true; q.hits.clear(); }
          if (q.back) {
            const a = Math.atan2(p.cy - q.y, p.x - q.x);
            q.vx = lerp(q.vx, Math.cos(a) * 460, 0.12); q.vy = lerp(q.vy, Math.sin(a) * 460, 0.12);
            if (dist(q.x, q.y, p.x, p.cy) < 14) q.life = 0;
          } else q.vx *= 0.97;
          if (Math.random() < 0.5) FX.slash(q.x, q.y, { r: 12, a0: -180, a1: 180, th: 3, c: C, f: 1, sy: 0.5, dur: 0.1 });
        },
      }));
      Sound.play('swoosh', { x: p.x, pitch: 0.7 }); Sound.play('thrust', { x: p.x, pitch: 1.2 });
    }]],
  },

  // ================= 见切连段: 回马枪 → 挑龙 → 坠龙枪 =================
  counter2: {
    label: '见切·挑龙', dur: 0.46, cancel: 0.28, grav: 0.35, noAtkSpeed: true, counter: true,
    keys: [[0, { ...L_UP0, lean: 20 }], [0.06, { ...L_UP1, lean: -12 }, 'outCubic'], [0.46, L_UPE]],
    onStart(p) { p.inv = Math.max(p.inv, 0.3); faceFoe(p, 170); p.trail = 0.15; },
    vel: [[0.02, 0.12, 240]],
    hits: [{ t: 0.05, d: 0.1, box: [-6, -72, 50, 76], dmg: 1.5, kb: [40, -350], stun: 0.7, hs: 5, launch: true, critBonus: 0.5, src: 'counter' }],
    ev: [[0.05, p => {
      p.vy = Math.min(p.vy, -360);
      Sound.play('thrust', { x: p.x, pitch: 1.2 }); Sound.play('slashHeavy', { x: p.x, pitch: 1.3 });
      lanThrustFx(p, { deg: -75, len: 50, y: -28, c: '#ffffff' });
      lanDragon(p, { x: p.x + p.face * 10, y: p.y - 30, vx: p.face * 40, life: 0.5, dmg: 0.5, r: 16, size: 0.8, amp: 4, freq: 14, src: 'counter', wx: null, upd(z, dt) { z.y0 -= 300 * dt; } });
    }]],
    next: 'counter3',
  },
  counter3: Object.assign(diveMove({
    label: '见切·坠龙枪', dur: 0.8, cancel: 0.6, hop: -120, vx: 130, fall: 660, hold: 0.28, fallDmg: 0.9,
    keys: [[0, air(L_RAISE)], [0.1, air({ ...L_DIVE, lean: 34 }), 'outCubic'], [0.28, air({ ...L_DIVE, lean: 34 })], [0.34, { ...L_PLANT, lean: 30, ...L_CROUCH }, 'outCubic'], [0.8, L_EASE]],
    onDive(p) { Sound.play('thrust', { x: p.x, pitch: 0.65 }); p.trail = 0.3; lanThrustFx(p, { deg: 45, len: 40 }); },
    onLand(p) {
      counterLand(p, 48, 3.0, C);
      for (const d of [-1, 1]) later(0.06, () => lanGeyser(p, p.x + d * 40, 1.2, { h: 64, src: 'counter', wx: null }));
      lanSplash(p.x, p.y - 4, 18);
    },
  }), { counter: true }),

  // ================= 天河倒挂 (↓I 2) =================
  ult2: {
    label: '天河倒挂', dur: 2.65, cancel: 99, ult: true, grav: 0, noAtkSpeed: true, skill: 'lan_heaven',
    keys: [
      [0, { ...L_BACK, ...L_CROUCH }],
      [0.28, { lean: -14, aF: [-85, -95], aB: [-70, -85], w: -90, lF: [55, 110], lB: [125, 100] }, 'outCubic'],
      [2.2, { lean: -14, aF: [-85, -95], aB: [-70, -85], w: -90, lF: [55, 110], lB: [125, 100] }],
      [2.32, { ...L_SMASH, lean: 30 }, 'outCubic'], [2.65, L_EASE],
    ],
    onStart(p) { p.vx = 0; p.vy = 0; G.cinematic(0.4); Sound.play('ultCharge'); },
    ev: [
      [0.3, p => {
        const full = p.skillLv('lan_heaven') >= 3, cx = full ? Cam.x + W / 2 : p.x + p.face * 110, half = full ? W / 2 : 130;
        FX.add({ k: 'beam', x: p.x + p.face * 4, y: p.y - 30, len: 300, w: 6, ang: -Math.PI / 2, c: C, life: 0.4 });
        Sound.play('ultBoom'); Sound.play('splash', { x: p.x, pitch: 0.5 }); G.dim = 2.2; Cam.shake(0.4);
        p.counters.heaven = { cx, half };
        // the river of heaven pours down as a storm of spear-light
        addZone({
          x: cx, y: p.y, life: 1.8, tick: 0.05,
          onTick() {
            for (let k = 0; k < 2; k++) {
              const x = cx + rand(-half, half), gy = G.room.floorBelow(x, p.y - 60);
              if (Math.abs(gy - p.y) > 140) continue;
              G.projs.push(new Proj({
                team: 'p', x, y: gy - 200, vx: rand(-30, 30), vy: 760, kind: 'bullet', r: 2.2, len: 30, c: pick([C, FOAM, WV]), c2: '#ffffff', life: 0.35, pierce: 99, ghost: true, light: 30,
                hit: p.makeHit({ dmg: 0.45, kx: 0, ky: -120, stun: 0.4, hs: 0, src: 'ult', energy: 0, fxc: C, skill: 'lan_heaven' }),
                upd(q) { if (q.y >= gy - 3 && !q.landed) { q.landed = true; q.life = 0; FX.burst(q.x, gy - 2, { n: 4, c: [C, FOAM], sp: [30, 90], ang: -Math.PI / 2, spread: 1.2, life: [0.15, 0.3], glow: true }); } },
              }));
            }
            if (Math.random() < 0.4) Sound.play('thrust', { x: cx + rand(-half, half), pitch: rand(1.2, 1.6) });
          },
          upd() { Light.add(cx, p.y - 60, half * 1.5, C, 0.5); },
        });
      }],
      [2.3, p => {
        const H = p.counters.heaven || { cx: p.x + p.face * 110, half: 130 };
        FX.screenFlash(FOAM, 0.7, 0.35); Sound.play('ultBoom'); Sound.play('stomp', { x: H.cx }); Cam.shake(0.9); G.hitstop(10);
        const gy = G.room.floorBelow(H.cx, p.y - 60);
        FX.add({ k: 'beam', x: H.cx, y: gy, len: 260, w: 16, ang: -Math.PI / 2, c: C, life: 0.4 });
        FX.add({ k: 'beam', x: H.cx, y: gy, len: 260, w: 5, ang: -Math.PI / 2, c: '#ffffff', life: 0.45 });
        FX.shock(H.cx, gy, C, H.half);
        for (const e of liveEnemies().filter(e => Math.abs(e.x - H.cx) < H.half + 20 && onScreen(e))) hitEnemy(p, e, p.makeHit({ dmg: 3.4, kx: 220, ky: -360, stun: 1.0, hs: 0, heavy: true, launch: true, dir: sign(e.x - H.cx) || 1, src: 'ult', energy: 0 }));
        for (let i = 0; i < 6; i++) lanSplash(H.cx + rand(-H.half, H.half) * 0.7, gy - 4, 12);
      }],
    ],
  },
});

// ---------- patches to base moves ----------
M.ult.skill = 'lan_ult';
M.ult.ev.push([1.3, p => {
  if (p.skillLv('lan_ult') < 3) return;
  // 进化: a second dragon turns back from the far side of the screen
  const f = -p.face, x0 = f > 0 ? Cam.x - 30 : Cam.x + W + 30;
  lanDragon(p, { x: x0, y: p.y - 46, vx: f * 520, life: 1.0, dmg: 0.7, r: 30, size: 2.0, amp: 18, freq: 6, segs: 14, src: 'ult', rehit: 0.12, energy: 0, hs: 0, skill: 'lan_ult' });
  Sound.play('roar', { x: p.x, pitch: 0.8 });
}]);
M.ult.ev.sort((a, b) => a[0] - b[0]);
M.plungeLand.ev.push([0.02, p => lanSplash(p.x, p.y - 2, 16)]);
// 派生 windows: zone skills accept the second I once their field is out
M.sk_hundred.followAt = 0.2; M.sk_tide.followAt = 0.2; M.sk_pierce.followAt = 0.3; M.sk_jiao.followAt = 0.15;
M.sk_vault.followAt = 0.3; M.sk_rainbow.followAt = 0.3; M.sk_dive.followAt = 0.1; M.sk_windmill.followAt = 0.1;
})();
