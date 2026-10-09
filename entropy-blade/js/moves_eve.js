'use strict';
// =====================================================================
//  EVE — 武技 (direction arts), 秘技 派生 follow-ups, 天狼星陨
// =====================================================================
(() => {
const M = HEROES.eve.moves;
const Y = EVE_C, B = EVE_C2, FIRE = '#ff8a3a', PH = '#b8a8ff';
const AIM_UP = { aF: [-45, -45], aB: [-40, -40], w: -45, w2: -40 };
const AIM_DN = { aF: [60, 60], aB: [70, 70], w: 60, w2: 70 };
const air = o => Object.assign({}, E_AIR, o);
const RECOIL = (o = {}) => Object.assign({ aF: [-22, -30], aB: [-18, -26], w: -30, w2: -26, lean: -14 }, o);
// bullet from an arbitrary point with a world-space angle (degrees)
function shotFrom(p, x, y, ang, o = {}) {
  const a = ang * DEG, sp = o.sp || 560;
  const hit = p.makeHit({ dmg: o.dmg || 0.6, kx: o.kx || 50, ky: o.ky || -20, stun: o.stun || 0.2, hs: 0, src: o.src, energy: 0.5, proj: true, fxc: o.c || Y, art: o.art, skill: o.skill, wx: o.wx, status: o.status });
  const pr = new Proj({ team: 'p', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: o.r || 1.6, kind: 'bullet', c: o.c || Y, c2: '#ffffff', life: o.life || 0.6, hit, len: o.len || 11, pierce: (o.pierce || 0) + (p.stats.pierce || 0), light: 26, ghost: !!o.ghost, onDie: o.onDie });
  G.projs.push(pr);
  FX.flash(x, y, 4, '#ffe9a0', 0.06);
  if (!o.silent) Sound.play('shoot', { x, pitch: o.pitch || 1 });
  return pr;
}
function aimAt(x, y, e) { return Math.atan2(e.cy - y, e.x - x) / DEG; }
// 火花雷: a thrown charge that sticks where it lands and bursts on contact
function sparkMine(p, vx, vy, o = {}) {
  const hit = p.makeHit({ dmg: 0.4, kx: 30, ky: -40, stun: 0.2, src: 'light' });
  G.projs.push(new Proj({
    team: 'p', x: p.x + p.face * 10, y: p.y - 24, vx: vx * p.face, vy, grav: 760, kind: 'orb', r: 2.5, c: FIRE, c2: '#ffe0a0', life: 2, hit, light: 30, trail: 0.4, tc: '#8a8aa8',
    onDie: q => {
      const gy = G.room.floorBelow(q.x, q.y - 8);
      const z = addZone({
        x: q.x, y: Math.min(gy, q.y + 6), life: 5, tick: 0.08, spark: true, armed: 0.15, mult: o.mult || 1.4, r: o.r || 34,
        onTick(z) { if (z.t > z.armed && !z.done && enemiesNear(z.x, z.y - 8, 20).length) sparkBoom(p, z, 1); },
        onEnd(z) { if (!z.done) sparkBoom(p, z, 0.7); },
        drawFn(ctx, gctx, x2, y2, z) {
          const bl = Math.floor(z.t * 10) % 2;
          ctx.fillStyle = '#3a2a2a'; ctx.fillRect(Math.round(x2 - 3), Math.round(y2 - 3), 6, 3);
          ctx.fillStyle = bl ? '#ffe0a0' : FIRE; ctx.fillRect(Math.round(x2 - 1), Math.round(y2 - 5), 2, 2);
          if (bl) { gctx.fillStyle = FIRE; gctx.fillRect(Math.round(x2 - 3), Math.round(y2 - 7), 6, 5); }
        },
      });
      if (o.onPlace) o.onPlace(z);
    },
  }));
}
function sparkBoom(p, z, k, o = {}) {
  if (z.done) return;
  z.done = true; z.life = Math.min(z.life, 0.01);
  explodeP(z.x, z.y - 6, z.r * (o.rMul || 1), z.mult * k * artMul(p, 'eve_trap') * (o.dMul || 1), { c: FIRE, ky: -260, kx: 120, shake: 0.25, src: 'light', noProc: false, status: o.stun ? ['stun', o.stun] : null, wx: { fam: 'art', id: 'eve_trap' } });
  if (o.burn) addZone({ x: z.x, y: z.y, life: 2.2, tick: 0.3, onTick(zz) { for (const e of enemiesNear(zz.x, zz.y - 6, 36)) { hitEnemy(p, e, p.makeHit({ dmg: 0.3, kx: 0, ky: 0, stun: 0.1, dot: true, numc: '#ff9a3a', art: 'eve_trap' })); applyStatus(e, 'burn', 2, 0.15); } }, upd(zz) { if (Math.random() < 0.8) FX.fire(zz.x + rand(-26, 26), zz.y + rand(-3, 3), 1); Light.add(zz.x, zz.y, 70, '#ff7a2a', 0.6); } });
}
// gun-wielding afterimage that shoots on its own
function phantom(p, x, y, face, shots, o = {}) {
  const fr = p.frame(), wx = p.moveWx(p.move && p.move.m, o);
  return addZone({
    x, y, life: o.life || 0.7, tick: o.tick || 0.12, phantom: true, n: 0,
    onTick(z) {
      if (z.t < (o.delay || 0.08) || z.n >= shots) return;
      z.n++;
      const e = nearestEnemy(z.x, z.y - 21, 260);
      const ang = e ? aimAt(z.x + face * 12, z.y - 21, e) : (face > 0 ? 0 : 180);
      shotFrom(p, z.x + face * 12, z.y - 21, ang + rand(-3, 3), { dmg: o.dmg || 0.6, c: PH, wx, silent: z.n % 2 === 0, pitch: 1.3 });
    },
    drawFn(ctx, gctx, x2, y2, z) { drawFrame(ctx, fr, p.spr.ox, p.spr.oy, x2, y2, face < 0, { tint: PH, alpha: 0.6 * Math.min(1, z.life * 4) }); },
    onEnd(z) { FX.burst(z.x, z.y - 16, { n: 10, c: [PH, '#ffffff'], sp: [30, 100], glow: true }); if (o.boom) explodeP(z.x, z.y - 16, 34, o.boom, { c: PH, src: 'light', shake: 0.15, sound: 'void', pitch: 1.6, wx }); },
  });
}

Object.assign(M, {
  // ================= 天穹射击 (↑) =================
  sky1: {
    label: '升空连射', dur: 0.5, cancel: 0.34, art: 'eve_sky',
    keys: M.rise.keys,
    hits: [{ t: 0.06, d: 0.1, box: [-4, -52, 32, 54], dmg: 1.1, kb: [40, -430], stun: 0.7, hs: 4, launch: true }],
    ev: [
      [0.06, p => { p.vy = -380; Sound.play('swoosh', { x: p.x, pitch: 1.3 }); hSlash(p, { x: 6, y: -16, r: 20, a0: 90, a1: -100, th: 6, c: B }); }],
      ...[0.13, 0.18, 0.23].map((t, i) => [t, p => hShoot(p, { ox: 8, oy: -30, ang: -50 - i * 8, dmg: 0.6, silent: i > 0 })]),
    ],
    next: 'sky2', nextLv: 2,
  },
  sky2: {
    label: '倒挂射击', dur: 0.4, cancel: 0.28, air: true, grav: 0.08, art: 'eve_sky',
    keys: [[0, air({ lean: -20, ...E_AIM })], [0.06, air({ lean: 20, ...AIM_DN, lF: [-40, 20], lB: [110, 150] }), 'outCubic'], [0.4, air({ lean: 14, ...AIM_DN })]],
    onStart(p) { p.vy = Math.min(p.vy, -80); },
    ev: [0.06, 0.1, 0.14, 0.18, 0.22, 0.26].map((t, i) => [t, p => hShoot(p, { ox: 10, oy: -14, ang: 30 + i * 9, dmg: 0.55, silent: i % 2 === 1, kx: 40, ky: 140 })]),
    next: 'sky3', nextLv: 3,
  },
  sky3: {
    label: '星轮', dur: 0.46, cancel: 0.34, air: true, grav: 0.05, art: 'eve_sky',
    keys: altKeys(6, 0.07, air({ lean: 0, aF: [0, 0], aB: [180, 180], w: 0, w2: 180 }), air({ lean: 0, aF: [-90, -90], aB: [90, 90], w: -90, w2: 90 })),
    onStart(p) { p.vy = Math.min(p.vy, -60); },
    ev: Array.from({ length: 12 }, (_, i) => [0.04 + i * 0.025, p => hShoot(p, { ox: 0, oy: -20, ang: i * 30 * p.face, dmg: 0.5, sp: 480, silent: i % 3 > 0, c: i % 2 ? Y : B })]),
    hits: [{ t: 0.05, d: 0.3, box: [-22, -44, 44, 46], dmg: 0.5, kb: [80, -120], stun: 0.4, hs: 1, radial: true }],
    next: 'sky4', nextLv: 4,
  },
  sky4: diveMove({
    label: '流星踵', art: 'eve_sky', dur: 0.72, cancel: 0.56, hop: -120, vx: 150, fall: 620, hold: 0.26, fallDmg: 0.9, col: B,
    keys: [[0, air({ lean: -16, lF: [-60, -40], lB: [110, 130], aF: [-60, -70], aB: [130, 110], w: -70, w2: 110 })], [0.1, air({ lean: 24, lF: [40, 60], lB: [100, 120], aF: [150, 160], aB: [170, 175], w: 160, w2: 175 }), 'outCubic'], [0.26, air({ lean: 24, lF: [40, 60], lB: [100, 120], aF: [150, 160], aB: [170, 175], w: 160, w2: 175 })], [0.32, { lean: 20, lF: [20, 120], lB: [150, 100], aF: [120, 140], w: 140 }, 'outCubic'], [0.72, { lean: 2 }]],
    onLand(p) {
      landImpact(p, 40, 1.8, B, { finisher: false });
      explodeP(p.x, p.y - 10, 62, 2.4 * artMul(p, 'eve_sky'), { c: B, c2: Y, ky: -320, kx: 200, shake: 0.5, src: 'heavy', noProc: false, sound: 'explode', pitch: 1.2 });
      for (let i = 0; i < 6; i++) hShoot(p, { ox: 0, oy: -6, ang: -20 - i * 28, dmg: 0.4, sp: 420, silent: true, c: Y });
      p.fire('onFinisher', null, { finisher: true });
    },
  }),

  // ================= 魔导升炮 (↑) =================
  cannon1: {
    label: '对空魔弹', dur: 0.46, cancel: 0.3, art: 'eve_cannon', noAtkSpeed: true,
    keys: [[0, { ...AIM_UP, lean: 2, lF: [55, 115], lB: [125, 95] }], [0.06, RECOIL({ aF: [-62, -70], aB: [-58, -64], w: -70, w2: -64, lean: -18 }), 'outCubic'], [0.46, { ...AIM_UP }]],
    ev: [[0.05, p => {
      eveOrbShot(p, { dmg: 0.8, boom: 1.6 * artMul(p, 'eve_cannon'), r: 44, c: B, sp: 250, vy: -260, size: 5, fuse: 0.75, src: 'light' });
      Sound.play('shotgun', { x: p.x, pitch: 1.6 }); p.vx = -p.face * 80; Cam.push(-p.face * 2, 2);
    }]],
    next: 'cannon2', nextLv: 2,
  },
  cannon2: {
    label: '追加弹', dur: 0.44, cancel: 0.3, art: 'eve_cannon', noAtkSpeed: true,
    keys: [[0, { ...AIM_UP }], [0.05, RECOIL({ aF: [-30, -36], w: -36, aB: [-70, -76], w2: -76 }), 'outCubic'], [0.44, { ...AIM_UP }]],
    ev: [[0.05, p => {
      eveOrbShot(p, { dmg: 0.7, boom: 1.3 * artMul(p, 'eve_cannon'), r: 38, c: Y, sp: 300, vy: -110, size: 4, fuse: 0.7, src: 'light' });
      eveOrbShot(p, { dmg: 0.7, boom: 1.3 * artMul(p, 'eve_cannon'), r: 38, c: Y, sp: 170, vy: -340, size: 4, fuse: 0.75, src: 'light' });
      Sound.play('shotgun', { x: p.x, pitch: 1.8 });
    }]],
    next: 'cannon3', nextLv: 3,
  },
  cannon3: {
    label: '雷枪', dur: 0.5, cancel: 0.34, art: 'eve_cannon', noAtkSpeed: true,
    keys: [[0, { ...E_AIM, aF: [-20, -20], w: -20, lean: 4, big: true }], [0.06, RECOIL({ aF: [-34, -40], w: -40, big: true }), 'outCubic'], [0.5, { ...E_AIM }]],
    ev: [[0.06, p => {
      const x = p.x + p.face * 16, y = p.y - 24, a = -22 * DEG;
      hShoot(p, { ox: 16, oy: -24, ang: -22, dmg: 1.7, r: 3, len: 34, sp: 900, pierce: 99, ghost: true, c: '#bff8ff', kx: 160, ky: -120, stun: 0.9, life: 0.5 });
      FX.bolt(x, y, x + Math.cos(a) * 260 * p.face, y + Math.sin(a) * 260, '#bff8ff', 0.2, 2, 8);
      Sound.play('zap', { x: p.x }); Sound.play('laser', { x: p.x, pitch: 1.4 }); Cam.shake(0.2);
    }]],
    next: 'cannon4', nextLv: 4,
  },
  cannon4: {
    label: '星爆', dur: 0.62, cancel: 0.46, art: 'eve_cannon', noAtkSpeed: true,
    keys: [[0, { ...E_AIM, aF: [-25, -25], w: -25, aB: [-20, -20], w2: -20, lean: 6, big: true }], [0.08, RECOIL({ aF: [-40, -46], aB: [-36, -42], w: -46, w2: -42, lean: -20, big: true }), 'outCubic'], [0.62, { ...E_AIM }]],
    ev: [[0.08, p => {
      eveOrbShot(p, { dmg: 1.4, boom: 3.2 * artMul(p, 'eve_cannon'), r: 72, c: B, sp: 230, vy: -110, size: 9, shards: 10, fuse: 0.7, src: 'heavy', kind: 'orb' });
      Sound.play('explode', { x: p.x, pitch: 1.8 }); p.vx = -p.face * 200; Cam.shake(0.3);
      p.fire('onFinisher', null, { finisher: true });
    }]],
  },

  // ================= 滑铲连击 (↓) =================
  slide1: {
    label: '滑铲射击', dur: 0.52, cancel: 0.38, art: 'eve_slide',
    keys: [[0, { lean: -30, lF: [0, 8], lB: [60, 120], aF: [10, 10], aB: [20, 20], w: 10, w2: 20 }], [0.34, { lean: -30, lF: [0, 8], lB: [60, 120], aF: [10, 10], aB: [20, 20], w: 10, w2: 20 }], [0.4, { gl: 0.3, lean: -20, lF: [-20, 60], lB: [110, 100] }, 'outCubic'], [0.52, { lean: 2 }]],
    vel: [[0, 0.32, 310]],
    hits: [{ t: 0.03, d: 0.3, box: [0, -14, 30, 16], dmg: 0.6, kb: [120, -60], stun: 0.5, hs: 1 }, { t: 0.36, d: 0.07, box: [-4, -40, 32, 40], dmg: 1.0, kb: [40, -380], stun: 0.7, hs: 4, launch: true }],
    ev: [[0, p => Sound.play('dash', { x: p.x, pitch: 0.9 })], ...[0.06, 0.13, 0.2, 0.27].map((t, i) => [t, p => hShoot(p, { ox: 14, oy: -9, ang: rand(-3, 1), dmg: 0.45, silent: i % 2 === 1 })])],
    update(p, mv) { if (mv.t < 0.32 && Math.random() < 0.7) FX.dust(p.x + p.face * 6, p.y, 1, -p.face); },
    next: 'slide2', nextLv: 2,
  },
  slide2: {
    label: '倒钩踢', dur: 0.44, cancel: 0.3, art: 'eve_slide',
    keys: M.shotB2.keys,
    vel: [[0.02, 0.1, 140]],
    hits: [{ t: 0.05, d: 0.08, box: [-2, -46, 32, 38], dmg: 1.3, kb: [50, -420], stun: 0.7, hs: 5, launch: true }],
    ev: [[0.05, p => { p.vy = -260; Sound.play('hitHeavy', { x: p.x, pitch: 1.3 }); hPunchFx(p, 12, -28, true, B); }]],
    next: 'slide3', nextLv: 3,
  },
  slide3: {
    label: '旋踢连射', dur: 0.5, cancel: 0.36, air: true, grav: 0.15, art: 'eve_slide',
    keys: M.shot5.keys,
    hits: [{ t: 0.08, d: 0.14, box: [-30, -46, 60, 48], dmg: 1.1, kb: [120, -220], stun: 0.6, hs: 4, radial: true }],
    ev: [[0.03, p => { p.vy = Math.min(p.vy, -140); Sound.play('swoosh', { x: p.x, pitch: 0.9 }); }], [0.1, p => { for (let i = 0; i < 8; i++) hShoot(p, { ox: 0, oy: -22, ang: i * 45, dmg: 0.45, silent: i > 0, sp: 460 }); FX.ring(p.x, p.cy, 4, 36, Y, 0.3, 2); }]],
    next: 'slide4', nextLv: 4,
  },
  slide4: diveMove({
    label: '炸裂踵落', art: 'eve_slide', dur: 0.7, cancel: 0.54, hop: -200, fall: 640, hold: 0.24, diveAt: 0.14, col: FIRE,
    keys: [[0, air({ lean: -26, lF: [-80, -60], lB: [100, 130], aF: [100, 60], aB: [120, 80], w: 60, w2: 80 })], [0.14, air({ lean: 20, lF: [70, 95], lB: [110, 130], aF: [60, 30], aB: [80, 40] }), 'outCubic'], [0.24, air({ lean: 20, lF: [70, 95], lB: [110, 130] })], [0.3, { lean: 16, lF: [30, 120], lB: [150, 100] }, 'outCubic'], [0.7, { lean: 2 }]],
    onLand(p) {
      landImpact(p, 34, 1.4, FIRE, { finisher: false });
      explodeP(p.x + p.face * 10, p.y - 8, 56, 2.4 * artMul(p, 'eve_slide'), { c: FIRE, c2: Y, ky: -300, kx: 200, shake: 0.5, src: 'heavy', noProc: false });
      p.fire('onFinisher', null, { finisher: true });
    },
  }),

  // ================= 火花雷 (↓) =================
  trap1: {
    label: '火花雷', dur: 0.36, cancel: 0.22, art: 'eve_trap',
    keys: [[0, { lean: -10, aF: [160, 120], w: 120, aB: [60, 20] }], [0.07, { lean: 14, aF: [-40, -50], w: -50 }, 'outCubic'], [0.36, { lean: 2 }]],
    ev: [[0.07, p => { sparkMine(p, 230, -220); Sound.play('swoosh', { x: p.x, pitch: 1.2 }); }]],
    next: 'trap2', nextLv: 2,
  },
  trap2: {
    label: '连锁雷', dur: 0.4, cancel: 0.26, art: 'eve_trap',
    keys: [[0, { lean: -12, aF: [170, 130], aB: [150, 120], w: 130, w2: 120 }], [0.08, { lean: 16, aF: [-50, -60], aB: [-30, -40], w: -60, w2: -40 }, 'outCubic'], [0.4, { lean: 2 }]],
    ev: [[0.08, p => { for (const [vx, vy] of [[140, -300], [240, -240], [340, -180]]) sparkMine(p, vx, vy); Sound.play('swoosh', { x: p.x, pitch: 0.9 }); }]],
    next: 'trap3', nextLv: 3,
  },
  trap3: {
    label: '引爆', dur: 0.44, cancel: 0.3, art: 'eve_trap', noAtkSpeed: true,
    keys: [[0, { ...AIM_DN, aF: [30, 30], w: 30, lean: 6 }], [0.05, RECOIL({ aF: [10, 10], w: 10, aB: [20, 20], w2: 20, lean: -6 }), 'outCubic'], [0.44, { ...E_AIM }]],
    ev: [[0.05, p => {
      hShoot(p, { ox: 16, oy: -20, ang: 30, dmg: 0.6, r: 2.5, len: 16, sp: 700, c: FIRE });
      Sound.play('shotgun', { x: p.x, pitch: 1.4 });
      const ms = G.zones.filter(z => z.spark && !z.done);
      ms.forEach((z, i) => later(0.05 + i * 0.05, () => sparkBoom(p, z, 1, { rMul: 1.35, dMul: 1.5, stun: 1.0 })));
      if (!ms.length) later(0.06, () => explodeP(p.x + p.face * 46, p.y - 10, 36, 1.4 * artMul(p, 'eve_trap'), { c: FIRE, src: 'light', shake: 0.2, noProc: false, wx: { fam: 'art', id: 'eve_trap' } }));
    }]],
    next: 'trap4', nextLv: 4,
  },
  trap4: {
    label: '焰狱', dur: 0.6, cancel: 0.44, art: 'eve_trap', noAtkSpeed: true,
    keys: [[0, { ...E_AIM, lean: 8, big: true }], [0.08, RECOIL({ big: true, lean: -18 }), 'outCubic'], [0.6, { ...E_AIM }]],
    ev: [[0.08, p => {
      const ms = G.zones.filter(z => z.spark && !z.done);
      ms.forEach((z, i) => later(i * 0.05, () => sparkBoom(p, z, 1, { rMul: 1.4, dMul: 1.6, burn: true, stun: 0.6 })));
      const x = p.x + p.face * 52;
      explodeP(x, p.y - 12, 64, 2.8 * artMul(p, 'eve_trap'), { c: FIRE, c2: Y, ky: -320, kx: 220, shake: 0.55, src: 'heavy', noProc: false, status: ['burn', 3, 0.25] });
      addZone({ x, y: G.room.floorBelow(x, p.y - 10), life: 2.4, tick: 0.3, onTick(z) { for (const e of enemiesNear(z.x, z.y - 6, 44)) { hitEnemy(p, e, p.makeHit({ dmg: 0.35, kx: 0, ky: 0, stun: 0.1, dot: true, numc: '#ff9a3a', art: 'eve_trap' })); applyStatus(e, 'burn', 2, 0.15); } }, upd(z) { if (Math.random() < 0.9) FX.fire(z.x + rand(-34, 34), z.y + rand(-3, 3), 1); Light.add(z.x, z.y, 90, '#ff7a2a', 0.7); } });
      Sound.play('explode', { x: p.x, pitch: 0.8 }); FX.screenFlash('#ff8a3a', 0.25, 0.2);
      p.fire('onFinisher', null, { finisher: true });
    }]],
  },

  // ================= 幻影步 (冲刺) =================
  phantom1: {
    label: '幻影射击', dur: 0.4, cancel: 0.26, grav: 0, art: 'eve_phantom', noAtkSpeed: true,
    keys: [[0, { ...E_AIM, lean: 24, lF: [40, 100], lB: [140, 130] }], [0.4, { ...E_AIM, lean: 8 }]],
    onStart(p, mv) { phantom(p, p.x, p.y, p.face, 3, { art: 'eve_phantom', dmg: 0.6 }); p.inv = Math.max(p.inv, 0.25); p.trail = 0.2; Sound.play('teleport', { x: p.x, pitch: 1.4 }); },
    vel: [[0, 0.16, 560, 0]],
    hits: [{ t: 0.02, d: 0.14, box: [-10, -34, 34, 32], dmg: 0.7, kb: [60, -60], stun: 0.4, hs: 2 }],
    ev: [[0.18, p => hShoot(p, { ox: 14, oy: -21, dmg: 0.7 })], [0.24, p => hShoot(p, { ox: 14, oy: -21, dmg: 0.7, silent: true })]],
    next: 'phantom2', nextLv: 2,
  },
  phantom2: {
    label: '回身射', dur: 0.42, cancel: 0.28, art: 'eve_phantom', noAtkSpeed: true,
    keys: [[0, { ...E_AIM, lean: 4, big: true }], [0.05, RECOIL({ big: true }), 'outCubic'], [0.42, { ...E_AIM }]],
    onStart(p) { p.face = -p.face; },
    ev: [[0.05, p => {
      hShoot(p, { ox: 18, oy: -21, dmg: 1.6, r: 3.5, len: 24, sp: 760, pierce: 99, ghost: true, kx: 200, ky: -60, c: PH, life: 0.6 });
      Sound.play('shotgun', { x: p.x, pitch: 1.6 }); p.vx = -p.face * 160;
    }]],
    next: 'phantom3', nextLv: 3,
  },
  phantom3: {
    label: '交叉火力', dur: 0.5, cancel: 0.36, art: 'eve_phantom',
    keys: altKeys(6, 0.06, { ...E_AIM, lean: 6, aB: [5, 5], w2: 5 }, { aF: [-10, -14], w: -14, aB: [-6, -10], w2: -10, lean: 2 }),
    onStart(p) {
      const e = nearestEnemy(p.x, p.cy, 240);
      const px = e ? e.x + (e.x > p.x ? 50 : -50) : p.x - p.face * 60;
      phantom(p, clamp(px, 3 * TILE, G.room.pw - 3 * TILE), G.room.floorBelow(px, p.y - 30), e ? -sign(e.x - p.x) || -p.face : -p.face, 5, { art: 'eve_phantom', dmg: 0.5, life: 0.75, tick: 0.1, boom: 1.2 });
      Sound.play('teleport', { x: p.x, pitch: 1.5 });
    },
    ev: Array.from({ length: 5 }, (_, i) => [0.04 + i * 0.07, p => {
      const e = nearestEnemy(p.x, p.cy, 260);
      let a = rand(-3, 3);
      if (e) { const w = aimAt(p.x, p.y - 21, e); a = p.face > 0 ? w : 180 - w; a = ((a + 540) % 360) - 180; a = clamp(a, -40, 40); }
      hShoot(p, { ox: 16, oy: -21, ang: a, dmg: 0.5, silent: i % 2 === 1 });
    }]),
    next: 'phantom4', nextLv: 4,
  },
  phantom4: {
    label: '幻影乱舞', dur: 0.9, cancel: 0.7, grav: 0, art: 'eve_phantom', noAtkSpeed: true,
    keys: [[0, { lean: -6, ...AIM_UP }], [0.2, { lean: 0, aF: [-90, -90], aB: [90, 90], w: -90, w2: 90 }], [0.9, { ...E_AIM }]],
    onStart(p) { p.vx = 0; p.vy = 0; p.inv = Math.max(p.inv, 0.5); Sound.play('ultCharge'); G.dim = 0.4; },
    ev: [[0.15, p => {
      const e = nearestEnemy(p.x, p.cy, 260);
      const cx = e ? e.x : p.x + p.face * 70, cy = e ? e.y : p.y;
      [[-70, 0], [70, 0], [-46, -60], [46, -60]].forEach(([dx, dy], i) => later(i * 0.05, () => {
        const x = clamp(cx + dx, 3 * TILE, G.room.pw - 3 * TILE);
        phantom(p, x, Math.min(cy + dy, G.room.floorBelow(x, cy - 30)), dx > 0 ? -1 : 1, 5, { art: 'eve_phantom', dmg: 0.55, life: 0.8, tick: 0.11, boom: 1.6 });
        FX.ring(x, cy + dy - 16, 4, 20, PH, 0.25, 2);
      }));
      Sound.play('teleport', { x: p.x, pitch: 1.2 });
      later(0.9, () => p.fire('onFinisher', null, { finisher: true }));
    }]],
  },

  // ================= 霰弹冲锋 (冲刺) =================
  buck1: {
    label: '贴身霰弹', dur: 0.46, cancel: 0.32, grav: 0, art: 'eve_buck', noAtkSpeed: true,
    keys: [[0, { lean: 20, ...E_AIM, lF: [40, 100], lB: [140, 130] }], [0.12, { lean: 10, aF: [10, 5], aB: [15, 10], w: 5, w2: 10 }], [0.16, { lean: -12, aF: [-25, -35], aB: [-20, -30], w: -35, w2: -30, lF: [75, 100], lB: [105, 95] }, 'outCubic'], [0.46, { lean: 2 }]],
    vel: [[0, 0.12, 440, 0]],
    hits: [{ t: 0.14, d: 0.07, box: [4, -40, 52, 36], dmg: 1.7, kb: [340, -120], stun: 0.55, hs: 6, heavy: true }],
    ev: [[0.14, p => {
      const x = p.x + p.face * 18, y = p.y - 22;
      Sound.play('shotgun', { x });
      FX.flash(x, y, 10, '#ffe9a0', 0.1); FX.sparks(x, y, p.face > 0 ? 0 : Math.PI, Y, 14, [260, 520], 0.35);
      for (const a of [-12, -4, 4, 12]) hShoot(p, { ox: 18, oy: -22, ang: a, dmg: 0.35, sp: 520, life: 0.25, silent: true });
      p.vx = -p.face * 170; Cam.push(-p.face * 3, 0);
    }]],
    next: 'buck2', nextLv: 2,
  },
  buck2: {
    label: '枪托', dur: 0.42, cancel: 0.28, art: 'eve_buck',
    keys: [[0, { lean: -8, aF: [-100, -60], w: -60, aB: [60, 30] }], [0.06, { lean: 26, aF: [40, 80], w: 90, lF: [40, 100], lB: [135, 100] }, 'outCubic'], [0.42, { lean: 4 }]],
    vel: [[0.02, 0.1, 160]],
    hits: [{ t: 0.05, d: 0.07, box: [0, -40, 34, 36], dmg: 1.3, kb: [120, -60], stun: 0.9, hs: 6, breakGuard: true, status: ['stun', 0.9] }],
    ev: [[0.05, p => { Sound.play('hitHeavy', { x: p.x, pitch: 1.1 }); Sound.play('clank', { x: p.x, pitch: 0.9 }); hPunchFx(p, 18, -26, true, Y); }]],
    next: 'buck3', nextLv: 3,
  },
  buck3: {
    label: '双管齐发', dur: 0.5, cancel: 0.36, art: 'eve_buck', noAtkSpeed: true,
    keys: [[0, { lean: 0, aF: [0, 0], aB: [180, 180], w: 0, w2: 180, lF: [65, 105], lB: [115, 95] }], [0.06, { lean: 0, aF: [-20, -26], aB: [200, 206], w: -26, w2: 206 }, 'outCubic'], [0.5, { lean: 2 }]],
    hits: [{ t: 0.05, d: 0.07, box: [-56, -40, 112, 36], dmg: 1.6, kb: [320, -140], stun: 0.6, hs: 6, heavy: true, radial: true }],
    ev: [[0.05, p => {
      Sound.play('shotgun', { x: p.x }); Sound.play('shotgun', { x: p.x, pitch: 0.8 });
      for (const d of [-1, 1]) { const x = p.x + d * 18; FX.flash(x, p.y - 22, 10, '#ffe9a0', 0.1); FX.sparks(x, p.y - 22, d > 0 ? 0 : Math.PI, Y, 12, [260, 520], 0.35); }
      Cam.shake(0.3);
    }]],
    next: 'buck4', nextLv: 4,
  },
  buck4: {
    label: '龙息', dur: 0.85, cancel: 0.66, art: 'eve_buck', noAtkSpeed: true, armor: true,
    keys: [[0, { ...E_AIM, lean: 8, big: true, lF: [55, 115], lB: [125, 95] }], [0.1, { ...E_AIM, lean: -4, big: true, lF: [55, 115], lB: [125, 95] }], [0.6, { ...E_AIM, lean: -4, big: true }], [0.66, RECOIL({ big: true, lean: -22 }), 'outCubic'], [0.85, { ...E_AIM }]],
    onStart(p, mv) { p.vx = 0; Sound.play('fire', { x: p.x }); },
    update(p, mv, dt) {
      if (mv.t < 0.1 || mv.t > 0.6) return;
      mv.ft = (mv.ft || 0) - dt;
      const x0 = p.x + p.face * 14, y = p.y - 22;
      for (let i = 0; i < 4; i++) { const a = rand(-0.35, 0.35); FX.add({ k: 'px', x: x0, y, vx: Math.cos(a) * rand(200, 360) * p.face, vy: Math.sin(a) * rand(200, 360), life: rand(0.2, 0.32), s: rand(2, 4), c: pick([FIRE, '#ffd23f', '#ff4a1a']), shrink: true, glow: true, add: true }); }
      Light.add(x0 + p.face * 40, y, 110, FIRE, 0.9);
      if (mv.ft <= 0) {
        mv.ft = 0.1;
        const lo = p.face > 0 ? x0 : x0 - 96;
        for (const e of enemiesInRect(lo, y - 26, 96, 52)) { hitEnemy(p, e, p.makeHit({ dmg: 0.32, kx: 40, ky: -10, stun: 0.25, hs: 0, dir: p.face, sfx: false, energy: 0.4, fxc: FIRE })); applyStatus(e, 'burn', 2, 0.12); }
        if (Math.random() < 0.5) Sound.play('fire', { x: p.x, pitch: rand(0.9, 1.2) });
      }
    },
    hits: [{ t: 0.64, d: 0.08, box: [4, -44, 64, 44], dmg: 2.6, kb: [380, -160], stun: 0.7, hs: 8, heavy: true, finisher: true, src: 'heavy' }],
    ev: [[0.64, p => { Sound.play('shotgun', { x: p.x, pitch: 0.7 }); Sound.play('explode', { x: p.x, pitch: 1.2 }); FX.burst(p.x + p.face * 30, p.y - 22, { n: 24, c: [FIRE, Y, '#ffffff'], sp: [100, 300], ang: p.face > 0 ? 0 : Math.PI, spread: 0.5, glow: true }); p.vx = -p.face * 220; Cam.shake(0.45); }]],
  },

  // ================= 秘技 派生 =================
  f_snipe: {
    label: '追击狙', dur: 0.5, cancel: 0.36, skill: 'eve_snipe', isFollow: true, noAtkSpeed: true,
    keys: [[0, { ...E_AIM, lean: 2, big: true }], [0.14, { ...E_AIM, lean: 2, big: true }], [0.18, RECOIL({ big: true, lean: -16 }), 'outCubic'], [0.5, { ...E_AIM }]],
    ev: [[0.16, p => {
      const f = p.face, x0 = p.x + f * 16, y = p.y - 21;
      let x1 = x0;
      for (let d = 0; d < 440; d += 6) { const nx = x0 + f * d; if (G.room.solidPx(nx, y)) break; x1 = nx; }
      const lo = Math.min(x0, x1), hi = Math.max(x0, x1);
      for (const e of enemiesInRect(lo, y - 8, hi - lo, 16)) hitEnemy(p, e, p.makeHit({ dmg: 3.0, kx: 220, ky: -100, stun: 0.7, hs: 0, heavy: true, critBonus: 0.3, dir: f, skill: 'eve_snipe' }));
      FX.add({ k: 'beam', x: lo, y, len: hi - lo, w: 4, ang: 0, c: Y, life: 0.25 });
      FX.add({ k: 'beam', x: lo, y, len: hi - lo, w: 1, ang: 0, c: '#ffffff', life: 0.35 });
      G.hitstop(4); Cam.shake(0.35); Sound.play('shotgun', { x: p.x, pitch: 0.8 }); Sound.play('laser', { x: p.x, pitch: 0.7 });
      p.vx = -f * 160;
    }]],
  },
  f_turret: {
    label: '齐射', dur: 0.36, cancel: 0.24, skill: 'eve_turret', isFollow: true,
    keys: [[0, { lean: -6, aF: [-70, -90], w: -90 }], [0.36, { lean: 2 }]],
    ev: [[0.06, p => {
      const tz = G.zones.find(z => z.turret && z.life > 0);
      const x = tz ? tz.x : p.x, y = tz ? tz.y : p.y - 30;
      for (let i = 0; i < 8; i++) later(i * 0.04, () => {
        const a = (-90 + rand(-50, 50)) * DEG;
        G.projs.push(new Proj({ team: 'p', x, y, vx: Math.cos(a) * 220, vy: Math.sin(a) * 220, r: 3, kind: 'missile', c: B, homing: 7, homeDelay: 0.15, accel: 0.8, life: 2, hit: p.makeHit({ dmg: 0.8, kx: 60, ky: -60, stun: 0.3, skill: 'eve_turret' }), light: 30, onDie: pr => explodeP(pr.x, pr.y, 24, 0.5 * skMul(p, 'eve_turret'), { c: B, sound: 'explode', pitch: 1.7, shake: 0.05, src: 'skill', wx: pr.hit.wx }) }));
        Sound.play('shoot', { x, pitch: 0.7 });
      });
      Sound.play('clank', { x: p.x, pitch: 1.5 });
    }]],
  },
  f_backflip: diveMove({
    label: '流星踢', skill: 'eve_backflip', isFollow: true, dur: 0.66, cancel: 0.5, hop: -60, vx: 320, fall: 520, hold: 0.22, diveAt: 0.06, fallDmg: 1.0, col: Y,
    keys: [[0, air({ lean: 20, lF: [10, 30], lB: [110, 130], aF: [140, 150], w: 150 })], [0.22, air({ lean: 30, lF: [20, 30], lB: [110, 140], aF: [140, 150], w: 150 })], [0.28, { lean: 16, lF: [30, 120], lB: [150, 100] }, 'outCubic'], [0.66, { lean: 2 }]],
    onLand(p) { explodeP(p.x + p.face * 8, p.y - 8, 50, 1.8 * skMul(p, 'eve_backflip'), { c: Y, ky: -280, kx: 180, shake: 0.4, src: 'skill', noProc: false }); FX.shock(p.x, p.y, Y, 50); },
  }),
  f_grenade: {
    label: '引信', dur: 0.4, cancel: 0.26, skill: 'eve_grenade', isFollow: true, noAtkSpeed: true,
    keys: [[0, { ...AIM_UP, lean: 0 }], [0.05, RECOIL({ aF: [-60, -66], w: -66 }), 'outCubic'], [0.4, { ...E_AIM }]],
    ev: [[0.05, p => {
      const gs = G.projs.filter(q => q.grenade && !q.dead);
      for (const q of gs) { FX.bolt(p.x + p.face * 16, p.y - 24, q.x, q.y, Y, 0.1, 1, 4); q.boost = 1.5; q.kill(true); }
      if (!gs.length) { const q = new Proj({ team: 'p', x: p.x + p.face * 14, y: p.y - 26, vx: p.face * 260, vy: -260, grav: 700, kind: 'orb', r: 4, c: '#ff8a3a', life: 2, light: 40, hit: p.makeHit({ dmg: 0.6, skill: 'eve_grenade' }), onDie: q2 => explodeP(q2.x, q2.y, 60, 2.4 * skMul(p, 'eve_grenade'), { c: '#ff8a3a', ky: -300, kx: 180, shake: 0.45, src: 'skill', noProc: false, wx: q2.hit.wx }) }); G.projs.push(q); }
      hShoot(p, { ox: 16, oy: -24, ang: -50, dmg: 0.3, silent: false });
    }]],
  },
  f_rain: diveMove({
    label: '坠星', skill: 'eve_rain', isFollow: true, dur: 0.7, cancel: 0.54, hop: -60, fall: 760, hold: 0.22, diveAt: 0.08, col: B, inv: 0.8,
    keys: [[0, air({ lean: 10, ...AIM_DN })], [0.22, air({ lean: 30, lF: [40, 60], lB: [100, 120], ...AIM_DN })], [0.28, { lean: 20, lF: [20, 120], lB: [150, 100] }, 'outCubic'], [0.7, { lean: 2 }]],
    onLand(p) { explodeP(p.x, p.y - 10, 74, 3.0 * skMul(p, 'eve_rain'), { c: B, c2: Y, ky: -340, kx: 220, shake: 0.6, src: 'skill', noProc: false }); FX.shock(p.x, p.y, B, 90); FX.screenFlash(B, 0.25, 0.2); },
  }),
  f_missile: {
    label: '二次齐射', dur: 0.46, cancel: 0.36, noAtkSpeed: true, skill: 'eve_missile', isFollow: true,
    keys: M.sk_missile.keys,
    ev: Array.from({ length: 8 }, (_, i) => [0.04 + i * 0.03, p => {
      const a = (-70 + rand(-30, 30)) * DEG;
      G.projs.push(new Proj({ team: 'p', x: p.x + p.face * 4, y: p.y - 28, vx: Math.cos(a) * 240 * p.face, vy: Math.sin(a) * 240, r: 3, kind: 'missile', c: Y, homing: 7, homeDelay: 0.15, accel: 0.8, life: 2.2, hit: p.makeHit({ dmg: 1.0, kx: 80, ky: -80, stun: 0.35, hs: 1, fxc: Y, skill: 'eve_missile' }), light: 30, onDie: pr => explodeP(pr.x, pr.y, 26, 0.6 * skMul(p, 'eve_missile'), { c: Y, sound: 'explode', pitch: 1.6, shake: 0.06, src: 'skill', wx: pr.hit.wx }) }));
      Sound.play('shoot', { x: p.x, pitch: 0.8 });
    }]),
  },
  f_kata: {
    label: '终幕', dur: 0.5, cancel: 0.36, skill: 'eve_kata', isFollow: true, grav: 0.1, armor: true, noAtkSpeed: true,
    keys: [[0, { lean: 0, aF: [-90, -90], aB: [90, 90], w: -90, w2: 90 }], [0.08, { lean: 0, aF: [0, 0], aB: [180, 180], w: 0, w2: 180, big: true }, 'outCubic'], [0.5, { lean: 2 }]],
    ev: [[0.08, p => {
      for (let i = 0; i < 16; i++) { const pr = hShoot(p, { ox: 0, oy: -20, ang: i * 22.5, dmg: 0.7, r: 3, len: 14, sp: 420, silent: i > 0, skill: 'eve_kata', src: 'skill', c: i % 2 ? Y : B }); pr.onDie = q => explodeP(q.x, q.y, 20, 0.5 * skMul(p, 'eve_kata'), { c: Y, sound: false, shake: 0.03, src: 'skill', wx: q.hit.wx }); }
      FX.ring(p.x, p.cy, 6, 56, Y, 0.35, 3); Sound.play('shotgun', { x: p.x, pitch: 1.2 }); Cam.shake(0.3);
    }]],
  },
  f_mine: {
    label: '雷暴', dur: 0.36, cancel: 0.22, skill: 'eve_mine', isFollow: true, grav: 0.3,
    keys: [[0, { lean: -4, aF: [-60, -80], w: -80 }], [0.08, { lean: 6, aF: [20, 10], w: 10 }, 'outCubic'], [0.36, { lean: 2 }]],
    ev: [[0.06, p => {
      const ms = G.zones.filter(z => z.mine && !z.done);
      const r = p.skillLv('eve_mine') >= 3 ? 60 : 46;
      ms.forEach((z, i) => later(i * 0.06, () => {
        z.done = true; z.life = 0.01;
        explodeP(z.x, z.y - 6, r, 2.4 * skMul(p, 'eve_mine'), { c: B, ky: -260, kx: 100, shake: 0.35, src: 'skill', noProc: false, status: ['stun', 1.5], wx: { fam: 'sk', id: 'eve_mine' } });
        FX.ring(z.x, z.y - 6, 4, r, '#bff8ff', 0.4, 3);
      }));
      Sound.play('blip', { x: p.x, pitch: 1.4 });
      if (!ms.length) explodeP(p.x, p.cy, 40, 1.2 * skMul(p, 'eve_mine'), { c: B, src: 'skill', status: ['stun', 1] });
    }]],
  },

  // ================= 天狼星陨 (↓I 2) =================
  ult2: {
    label: '天狼星陨', dur: 2.3, cancel: 99, ult: true, grav: 0, noAtkSpeed: true, skill: 'eve_meteor',
    keys: [[0, { lean: 4, ...E_AIM }], [0.25, { lean: -10, aF: [-80, -85], w: -85, aB: [40, 20], w2: 20, big: true }, 'outCubic'], [0.32, { lean: -16, aF: [-95, -100], w: -100, aB: [40, 20], w2: 20, big: true }], [2.0, { lean: -10, aF: [-85, -90], w: -90 }], [2.3, { ...E_AIM }]],
    onStart(p) { p.vx = 0; p.vy = 0; G.cinematic(0.4); Sound.play('ultCharge'); },
    ev: [
      [0.3, p => {
        Sound.play('shotgun', { x: p.x, pitch: 1.4 }); Sound.play('laser', { x: p.x, pitch: 0.6 });
        FX.add({ k: 'beam', x: p.x + p.face * 8, y: p.y - 40, len: 260, w: 3, ang: -Math.PI / 2, c: Y, life: 0.4 });
        FX.flash(p.x + p.face * 8, p.y - 44, 14, '#ffffff', 0.2);
        G.dim = 2.0;
      }],
      ...Array.from({ length: 16 }, (_, i) => [0.6 + i * 0.085, p => {
        if (i >= (p.skillLv('eve_meteor') >= 3 ? 16 : 12)) return;
        const list = liveEnemies().filter(onScreen);
        const e = list.length ? list[i % list.length] : null;
        const tx = e ? e.x + rand(-10, 10) : Cam.x + rand(40, W - 40), sx = tx + rand(-60, 60) - 80;
        const hit = p.makeHit({ dmg: 0.6, kx: 60, ky: -60, stun: 0.4, src: 'ult', energy: 0 });
        G.projs.push(new Proj({
          team: 'p', x: sx, y: Cam.y - 20, vx: (tx - sx) * 1.4, vy: 520, r: 5, kind: 'orb', c: i % 2 ? Y : B, c2: '#ffffff', life: 2, hit, light: 90, trail: 0.9, tc: '#ffe0a0', ghost: true,
          upd: q => { if (q.t > 0.12 && G.room.solidPx(q.x, q.y)) { q.kill(true); q.life = 0; } },
          onDie: q => { explodeP(q.x, q.y, 46, 1.4 * skMul(p, 'eve_meteor'), { c: i % 2 ? Y : B, c2: '#ffffff', src: 'ult', shake: 0.25, ky: -260, kx: 140, pitch: 1.0 + rand(0, 0.4), wx: q.hit.wx }); FX.shock(q.x, q.y + 4, Y, 40); },
        }));
        Sound.play('swoosh', { x: tx, pitch: 0.5 });
      }]),
    ],
  },
});

// ---------- patches to base moves ----------
delete M.dashAtk.next; delete M.dashAtk.nextReq;
delete M.dashAtk2;
M.ult.skill = 'eve_ult';
M.ult.ev.push([2.02, p => {
  if (p.skillLv('eve_ult') < 3) return;
  const f = p.face, y = p.y - 22;
  for (let i = 0; i < 7; i++) later(i * 0.06, () => explodeP(p.x + f * (40 + i * 66), y + rand(-8, 8), 42, 1.6 * skMul(p, 'eve_ult'), { c: Y, c2: '#ff9a2e', src: 'ult', shake: 0.25, pitch: 1.2 + i * 0.05, wx: { fam: 'sk', id: 'eve_ult' } }));
}]);
M.sk_kata.grav = 0.12;
M.sk_mine.grav = 0.3;
// grenades are tagged so 引信 can detonate them in flight (and boost their blast)
M.sk_grenade.ev[0][1] = p => {
  const lv = p.skillLv('eve_grenade');
  const throwOne = (vx, vy, big) => {
    const hit = p.makeHit({ dmg: 0.6, kx: 60, ky: -60, stun: 0.3, src: 'skill', skill: 'eve_grenade' });
    G.projs.push(new Proj({
      team: 'p', x: p.x + p.face * 10, y: p.y - 26, vx: vx * p.face, vy, grav: 700, kind: 'orb', r: big ? 4 : 3, c: '#ff8a3a', c2: '#ffe0a0', life: 2.5, hit, light: 40, trail: 0.5, tc: '#8a8aa8', grenade: true,
      onDie: q => {
        const k = q.boost || 1;
        explodeP(q.x, q.y, (big ? 56 : 34) * k, (big ? 2.6 : 1.2) * skMul(p, 'eve_grenade') * (k > 1 ? 1.25 : 1), { c: '#ff8a3a', ky: -300, kx: 180, shake: big ? 0.45 : 0.15, src: 'skill', noProc: false, wx: q.hit.wx });
        if (lv >= 3 && big) addZone({ x: q.x, y: q.y, life: 2, tick: 0.3, onTick(z) { for (const e of enemiesNear(z.x, z.y, 40)) hitEnemy(p, e, p.makeHit({ dmg: 0.35, kx: 0, ky: 0, stun: 0.1, dot: true, src: 'skill', skill: 'eve_grenade', numc: '#ff9a3a' })); }, upd(z) { if (Math.random() < 0.8) FX.fire(z.x + rand(-30, 30), z.y + rand(-4, 4), 1); Light.add(z.x, z.y, 80, '#ff7a2a', 0.6); } });
      },
    }));
  };
  throwOne(230, -280, true);
  if (lv >= 2) { throwOne(150, -320, false); throwOne(310, -240, false); }
  Sound.play('swoosh', { x: p.x, pitch: 0.7 });
};
M.sk_turret.followAt = 0.1;
})();
