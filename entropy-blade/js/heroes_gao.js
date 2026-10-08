'use strict';
// =====================================================================
//  HEROES (3/4) — GAO, the mountain-breaking monk
// =====================================================================
const G_GUARD = { lean: 8, aF: [70, -25], aB: [85, -30] };
const G_SQUAT = { lF: [25, 125], lB: [155, 100] };
const G_LUNGE = { lF: [20, 90], lB: [150, 140] };
const G_AIR = { gl: 0, lF: [50, 120], lB: [110, 140] };
const GAO_C = '#ffb347';

function gaoQuake(p, r, dmg, src, skill) {
  explodeP(p.x, p.y - 10, r, dmg, { c: GAO_C, heavy: true, ky: -330, kx: 220, hs: 7, shake: 0.6, src, noProc: false, skill });
  FX.shock(p.x, p.y, GAO_C, r + 20);
  FX.debris(p.x, p.y - 2, [GAO_C, '#a08a6a', '#ffffff'], 16);
  Sound.play('stomp', { x: p.x });
}
// rising rock spike (Gao's earth skills)
function rockSpike(p, x, mult, skill, h = 26) {
  const gy = G.room.floorBelow(x, p.y - 30);
  if (Math.abs(gy - p.y) > 60) return;
  FX.customDraw(x, gy, 0.45, (ctx, gctx, X, Y, t) => {
    const hh = h * (t < 0.15 ? t / 0.15 : 1) * (t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1);
    ctx.fillStyle = '#7a6448'; ctx.beginPath(); ctx.moveTo(X - 7, Y); ctx.lineTo(X - 1, Y - hh); ctx.lineTo(X + 6, Y); ctx.fill();
    ctx.fillStyle = '#b89a6a'; ctx.beginPath(); ctx.moveTo(X - 1, Y); ctx.lineTo(X - 1, Y - hh); ctx.lineTo(X + 3, Y); ctx.fill();
    gctx.fillStyle = GAO_C; gctx.globalAlpha = 0.5; gctx.fillRect(X - 3, Y - 3, 6, 3); gctx.globalAlpha = 1;
  }, 0);
  FX.debris(x, gy - 2, ['#7a6448', '#b89a6a'], 3);
  for (const e of enemiesInRect(x - 9, gy - h, 18, h)) hitEnemy(p, e, p.makeHit({ dmg: mult, kx: 30, ky: -320, launch: true, stun: 0.6, hs: 2, dir: p.face, src: 'skill', skill }));
  Sound.play('stomp', { x, pitch: 1.6 });
}

HEROES.gao = {
  id: 'gao', name: '罡', en: 'GAO', title: '崩山拳豪', role: '近战 · 重装',
  color: GAO_C, color2: '#ff6a2a',
  desc: '下山历练的武僧，铁拳可裂山石。投技、霸体与震地拳法，硬桥硬马。',
  hp: 130, atk: 12, speed: 122, crit: 0.06, armor: 0.15, energyRate: 1.6, procMul: 1.15,
  hurt: [16, 32],
  startSkill: 'gao_charge',
  ultName: '霸王崩拳', ultDesc: '凝聚全身气劲，打出贯穿全屏的巨拳并震撼大地。',
  combo: 'jab', air: 'aatk1',
  look: 'gao',
  holdPose: s => ({ lean: 2 - s, aF: [150, -70], aB: [60, -60], ...G_SQUAT, scarf: 170 + s * 8 }),
  wallPose: { gl: 0, lean: -4, aF: [60, -40], aB: [175, 170], lF: [80, 130], lB: [120, 160], scarf: 120 },
  moves: {
    // ---------------- ground combo ----------------
    jab: {
      label: '刺拳', dur: 0.24, cancel: 0.15, light: true,
      keys: [[0, { aF: [60, -40] }], [0.05, { lean: 14, aF: [0, 0] }, 'outCubic'], [0.12, { lean: 12, aF: [2, 2] }], [0.24, { aF: [70, -25] }]],
      hits: [{ t: 0.04, d: 0.06, box: [0, -38, 30, 24], dmg: 0.9, kb: [60, -20], stun: 0.32, hs: 3 }],
      vel: [[0.02, 0.08, 110]],
      ev: [[0.04, p => { Sound.play('swoosh', { x: p.x, pitch: 0.7 }); hPunchFx(p, 22, -26, false); }]],
      next: 'straight',
    },
    straight: {
      label: '直拳', dur: 0.3, cancel: 0.18, light: true,
      keys: [[0, { aB: [70, -40], lean: 6 }], [0.06, { lean: 22, aB: [0, 0], aF: [90, -20], ...G_LUNGE }, 'outCubic'], [0.3, { lean: 10 }]],
      hits: [{ t: 0.05, d: 0.06, box: [0, -38, 34, 24], dmg: 1.1, kb: [70, -30], stun: 0.34, hs: 4 }],
      vel: [[0.02, 0.1, 120]],
      ev: [[0.05, p => { Sound.play('swoosh', { x: p.x, pitch: 0.6 }); hPunchFx(p, 24, -26, false); }]],
      next: 'hook', delay: 'elbow',
    },
    hook: {
      label: '摆拳·二连', dur: 0.4, cancel: 0.28, light: true,
      keys: [
        [0, { aF: [150, -60], lean: -5 }], [0.06, { aF: [20, -30], lean: 18 }, 'outCubic'], [0.12, { aF: [-20, -50], lean: 12 }],
        [0.17, { aF: [30, 20], lean: 22, aB: [100, -20] }, 'outCubic'], [0.4, { lean: 10 }],
      ],
      hits: [
        { t: 0.05, d: 0.06, box: [-4, -44, 34, 32], dmg: 0.8, kb: [30, -90], stun: 0.36, hs: 3 },
        { t: 0.16, d: 0.06, box: [-4, -38, 36, 28], dmg: 1.0, kb: [70, -40], stun: 0.4, hs: 4 },
      ],
      vel: [[0.02, 0.18, 90]],
      ev: [
        [0.05, p => { Sound.play('swoosh', { x: p.x, pitch: 0.8 }); hSlash(p, { x: 4, y: -24, r: 16, a0: 120, a1: -40, th: 5, c: GAO_C, dur: 0.15 }); }],
        [0.16, p => { Sound.play('swoosh', { x: p.x, pitch: 0.6 }); hPunchFx(p, 24, -24, true); }],
      ],
      next: 'smash',
    },
    smash: {
      label: '崩捶', dur: 0.66, cancel: 0.5, armor: true,
      keys: [
        [0, { lean: -14, aF: [-110, -90], aB: [-100, -80], lF: [70, 100], lB: [110, 95] }],
        [0.2, { lean: -18, aF: [-120, -95], aB: [-110, -90] }],
        [0.26, { lean: 40, aF: [70, 90], aB: [80, 95], lF: [30, 120], lB: [150, 110] }, 'outCubic'],
        [0.66, { lean: 12 }],
      ],
      hits: [{ t: 0.25, d: 0.08, box: [-10, -48, 58, 50], dmg: 2.6, kb: [270, -290], stun: 0.65, hs: 8, heavy: true, launch: true, finisher: true, src: 'heavy' }],
      ev: [
        [0.05, p => { FX.ring(p.x, p.y - 40, 20, 4, GAO_C, 0.2, 2); Sound.play('charge', { x: p.x }); }],
        [0.25, p => {
          const x = p.x + p.face * 24;
          FX.shock(x, p.y, GAO_C, 50); FX.debris(x, p.y - 2, [GAO_C, '#a08a6a', '#ffffff'], 12);
          Sound.play('stomp', { x }); Sound.play('hitHeavy', { x }); Cam.shake(0.5);
          pShockwave(p, x, p.y, 1, 0.9, GAO_C); pShockwave(p, x, p.y, -1, 0.9, GAO_C);
        }],
      ],
      next: 'quake', nextReq: 'combo5',
    },
    quake: {
      label: '终式·崩山', dur: 0.78, cancel: 0.6, armor: true, grav: 1.3,
      keys: [
        [0, { lean: -12, aF: [-120, -100], aB: [-110, -95], lF: [60, 110], lB: [120, 100] }],
        [0.14, { gl: 0, lean: -16, aF: [-130, -110], aB: [-120, -105], lF: [40, 120], lB: [110, 150] }],
        [0.24, { gl: 0.6, lean: 45, aF: [80, 95], aB: [85, 98], lF: [25, 120], lB: [150, 110] }, 'outCubic'],
        [0.78, { lean: 12 }],
      ],
      ev: [[0.02, p => { p.vy = -260; Sound.play('charge', { x: p.x, pitch: 0.7 }); }], [0.18, p => { p.vy = 640; }]],
      update(p, mv) {
        if (mv.t > 0.16 && p.onGround && !mv.landed) {
          mv.landed = true;
          gaoQuake(p, 66, 3.0, 'heavy');
          pShockwave(p, p.x, p.y, 1, 1.2, GAO_C); pShockwave(p, p.x, p.y, -1, 1.2, GAO_C);
          p.fire('onFinisher', null, { finisher: true });
        }
      },
    },
    // ---------------- delayed branch ----------------
    elbow: {
      label: '派生·顶肘', dur: 0.36, cancel: 0.24,
      keys: [[0, { lean: 4, aF: [80, -60] }], [0.06, { lean: 24, aF: [10, -165], aB: [100, -40], ...G_LUNGE }, 'outCubic'], [0.36, { lean: 12 }]],
      vel: [[0.02, 0.12, 170]],
      hits: [{ t: 0.05, d: 0.07, box: [0, -40, 30, 28], dmg: 1.2, kb: [90, -30], stun: 0.5, hs: 5, breakGuard: true }],
      ev: [[0.05, p => { Sound.play('hitHeavy', { x: p.x, pitch: 1.2 }); hPunchFx(p, 18, -28, true); }]],
      next: 'shoulder',
    },
    shoulder: {
      label: '派生·铁山靠', dur: 0.56, cancel: 0.42, armor: true,
      keys: [[0, { lean: -6, aF: [100, -40], aB: [110, -50] }], [0.06, { lean: 36, aF: [100, -40], aB: [110, -50], lF: [10, 85], lB: [160, 150] }, 'outCubic'], [0.3, { lean: 30, aF: [100, -40], aB: [110, -50], lF: [10, 85], lB: [160, 150] }], [0.56, { lean: 10 }]],
      vel: [[0.04, 0.15, 330]],
      hits: [{ t: 0.07, d: 0.09, box: [0, -42, 32, 42], dmg: 2.3, kb: [430, -160], stun: 0.7, hs: 9, heavy: true, finisher: true, breakGuard: true, src: 'heavy' }],
      ev: [[0.07, p => { Sound.play('hitHeavy', { x: p.x, pitch: 0.7 }); Sound.play('stomp', { x: p.x }); FX.ring(p.x + p.face * 18, p.cy, 4, 34, GAO_C, 0.3, 4); Cam.shake(0.45); Cam.push(p.face * 4, 0); }]],
    },
    // ---------------- directional / special ----------------
    low: {
      label: '扫堂腿', dur: 0.5, cancel: 0.36,
      keys: [
        [0, { lean: 25, ...G_SQUAT, aF: [100, 60], aB: [110, 70] }],
        [0.08, { lean: 30, lF: [-5, 5], lB: [155, 110], aF: [100, 60], aB: [110, 70] }, 'outCubic'],
        [0.18, { lean: 30, lF: [175, 180], lB: [30, 110], aF: [80, 60], aB: [90, 70] }],
        [0.5, { lean: 12 }],
      ],
      hits: [{ t: 0.07, d: 0.14, box: [-42, -18, 84, 20], dmg: 1.2, kb: [90, -310], stun: 0.7, hs: 4, launch: true, radial: true }],
      ev: [[0.07, p => { Sound.play('swoosh', { x: p.x, pitch: 0.6 }); hSlash(p, { x: 0, y: -6, r: 36, a0: -180, a1: 180, th: 5, c: GAO_C, sy: 0.2, dur: 0.22 }); FX.dust(p.x, p.y, 10, 0); }]],
    },
    rise: {
      label: '升龙', dur: 0.5, cancel: 0.36, armor: true,
      keys: [
        [0, { lean: 20, aF: [100, 60], lF: [35, 125], lB: [140, 105] }],
        [0.08, { gl: 0.4, lean: -10, aF: [-80, -95], aB: [110, 60], lF: [85, 110], lB: [100, 130] }, 'outCubic'],
        [0.5, { gl: 0, aF: [-70, -85], lF: [60, 120], lB: [100, 150] }],
      ],
      hits: [{ t: 0.06, d: 0.14, box: [-4, -62, 34, 64], dmg: 1.6, kb: [40, -440], stun: 0.7, hs: 5, launch: true }],
      ev: [[0.06, p => {
        p.vy = -370; Sound.play('hitHeavy', { x: p.x, pitch: 1.3 });
        hSlash(p, { x: 6, y: -24, r: 22, a0: 60, a1: -100, th: 8, c: '#ff6a2a', c2: '#ffd36a' });
        FX.fire(p.x + p.face * 8, p.y - 20, 8, true);
      }]],
    },
    dashAtk: {
      label: '冲拳', dur: 0.4, cancel: 0.28, armor: true, grav: 0,
      keys: [[0, { lean: 30, aF: [100, -40], aB: [60, -40], ...G_LUNGE }], [0.05, { lean: 36, aF: [0, 0], aB: [140, 150], ...G_LUNGE }, 'outCubic'], [0.4, { lean: 14 }]],
      vel: [[0, 0.15, 420, 0]],
      hits: [{ t: 0.04, d: 0.11, box: [-4, -40, 38, 30], dmg: 1.6, kb: [320, -90], stun: 0.5, hs: 6, heavy: true }],
      ev: [[0.04, p => { Sound.play('hitHeavy', { x: p.x, pitch: 1.1 }); hPunchFx(p, 26, -26, true); FX.add({ k: 'streak', x: p.x + p.face * 30, y: p.y - 26, vx: p.face * 1800, vy: 0, life: 0.12, c: GAO_C, len: 0.03, w: 3 }); }]],
      next: 'dashAtk2', nextReq: 'dashChain',
    },
    dashAtk2: {
      label: '追风·飞膝', dur: 0.46, cancel: 0.32,
      keys: [[0, { lean: 10, ...G_SQUAT }], [0.06, { gl: 0.3, lean: -10, lF: [-40, 60], lB: [110, 130], aF: [60, -60], aB: [80, -50] }, 'outCubic'], [0.46, { gl: 0, lean: 6 }]],
      hits: [{ t: 0.05, d: 0.1, box: [-2, -48, 32, 46], dmg: 1.4, kb: [60, -410], stun: 0.7, hs: 5, launch: true }],
      ev: [[0.05, p => { p.vy = -280; Sound.play('hitHeavy', { x: p.x, pitch: 1.2 }); hPunchFx(p, 12, -30, true); }]],
    },
    charge1: {
      label: '蓄力·崩拳', dur: 0.55, cancel: 0.4, armor: true, noAtkSpeed: true,
      keys: [[0, { lean: -4, aF: [150, -80], aB: [60, -60], ...G_SQUAT }], [0.06, { lean: 32, aF: [0, 0], aB: [140, 160], ...G_LUNGE }, 'outCubic'], [0.55, { lean: 12 }]],
      vel: [[0.03, 0.1, 200]],
      hits: [{ t: 0.06, d: 0.08, box: [0, -42, 42, 34], dmg: 2.8, kb: [380, -160], stun: 0.7, hs: 9, heavy: true, finisher: true, src: 'charge' }],
      ev: [[0.06, p => {
        Sound.play('hitHeavy', { x: p.x, pitch: 0.7 }); Sound.play('explode', { x: p.x, pitch: 1.6 });
        hPunchFx(p, 28, -26, true);
        const hit = p.makeHit({ dmg: 1.3, kx: 260, ky: -120, stun: 0.5, hs: 2, src: 'charge' });
        G.projs.push(new Proj({ team: 'p', x: p.x + p.face * 30, y: p.y - 24, vx: p.face * 440, vy: 0, r: 10, kind: 'fist', c: GAO_C, life: 0.35, pierce: 99, ghost: true, hit, light: 80 }));
        Cam.shake(0.4); Cam.push(p.face * 4, 0);
      }]],
    },
    charge2: {
      label: '极·震天', dur: 0.95, cancel: 0.75, armor: true, noAtkSpeed: true, grav: 1.2,
      keys: [
        [0, { lean: 0, aF: [150, -70], aB: [60, -60], ...G_SQUAT }],
        [0.12, { gl: 0, lean: -16, aF: [-130, -110], aB: [-120, -105], lF: [40, 120], lB: [110, 150] }],
        [0.34, { gl: 0, lean: -16, aF: [-130, -110], aB: [-120, -105], lF: [40, 120], lB: [110, 150] }],
        [0.42, { gl: 0.6, lean: 48, aF: [85, 95], aB: [88, 98], lF: [25, 120], lB: [150, 110] }, 'outCubic'],
        [0.95, { lean: 12 }],
      ],
      ev: [[0.03, p => { p.vy = -440; Sound.play('jump', { x: p.x, pitch: 0.6 }); FX.dust(p.x, p.y, 10, 0); }], [0.34, p => { p.vy = 760; }]],
      update(p, mv) {
        if (mv.t > 0.3 && p.onGround && !mv.landed) {
          mv.landed = true;
          gaoQuake(p, 92, 3.6, 'charge');
          for (const d of [-1, 1]) { pShockwave(p, p.x + d * 20, p.y, d, 1.4, GAO_C, 'charge'); }
          FX.screenFlash(GAO_C, 0.3, 0.3);
          p.fire('onFinisher', null, { finisher: true });
        }
      },
    },
    counter: {
      label: '反击·铁拳', dur: 0.52, cancel: 0.36, grav: 0, noAtkSpeed: true,
      keys: [[0, { lean: -2, aF: [150, -80], aB: [60, -60], ...G_SQUAT }], [0.06, { lean: 34, aF: [0, 0], aB: [140, 160], ...G_LUNGE }, 'outCubic'], [0.52, { lean: 12 }]],
      onStart(p) { teleportBehind(p, 190); p.inv = Math.max(p.inv, 0.45); },
      hits: [{ t: 0.06, d: 0.08, box: [-4, -44, 44, 38], dmg: 3.4, kb: [420, -260], stun: 0.8, hs: 11, heavy: true, launch: true, critBonus: 1, src: 'counter', finisher: true }],
      ev: [[0.06, p => {
        Sound.play('hitHeavy', { x: p.x, pitch: 0.6 }); Sound.play('crit', { x: p.x });
        hPunchFx(p, 28, -24, true, '#ffffff');
        pShockwave(p, p.x + p.face * 20, p.y, p.face, 1.2, GAO_C, 'counter');
        FX.screenFlash('#ffffff', 0.35, 0.15);
      }]],
    },
    // ---------------- air ----------------
    aatk1: {
      label: '空·冲拳', dur: 0.24, cancel: 0.15, air: true, grav: 0.12,
      keys: [[0, { ...G_AIR, aF: [60, -40] }], [0.05, { ...G_AIR, lean: 14, aF: [10, 10] }, 'outCubic'], [0.24, { ...G_AIR, aF: [60, -20] }]],
      hits: [{ t: 0.04, d: 0.06, box: [0, -38, 32, 30], dmg: 1.0, kb: [50, -160], stun: 0.42, hs: 3 }],
      ev: [[0.04, p => { Sound.play('swoosh', { x: p.x, pitch: 0.7 }); hPunchFx(p, 22, -24, false); }]],
      next: 'aatk2',
    },
    aatk2: {
      label: '空·二连拳', dur: 0.26, cancel: 0.16, air: true, grav: 0.12,
      keys: [[0, { ...G_AIR, aB: [60, -40] }], [0.05, { ...G_AIR, lean: 18, aB: [10, 10], aF: [100, -10] }, 'outCubic'], [0.26, { ...G_AIR }]],
      hits: [{ t: 0.04, d: 0.06, box: [0, -38, 32, 30], dmg: 1.1, kb: [50, -170], stun: 0.42, hs: 3 }],
      ev: [[0.04, p => { Sound.play('swoosh', { x: p.x, pitch: 0.6 }); hPunchFx(p, 22, -24, false); }]],
      next: 'aatk3',
    },
    aatk3: {
      label: '空·落斧腿', dur: 0.44, cancel: 0.34, air: true, grav: 0.25,
      keys: [[0, { gl: 0, lean: -20, lF: [-80, -60], lB: [100, 120], aF: [100, 60] }], [0.08, { gl: 0, lean: 20, lF: [70, 95], lB: [110, 130] }, 'outCubic'], [0.44, { gl: 0, lean: 10 }]],
      hits: [{ t: 0.07, d: 0.08, box: [-4, -40, 38, 50], dmg: 1.8, kb: [120, 400], stun: 0.5, hs: 7, heavy: true, finisher: true, src: 'heavy' }],
      ev: [[0.07, p => { Sound.play('hitHeavy', { x: p.x }); hSlash(p, { x: 6, y: -18, r: 22, a0: -120, a1: 90, th: 8, c: GAO_C }); }]],
    },
    airRise: {
      label: '空·腾空膝', dur: 0.42, cancel: 0.3, air: true, grav: 1,
      keys: [[0, { ...G_AIR, lean: 8 }], [0.06, { gl: 0, lean: -12, lF: [-50, 50], lB: [110, 140], aF: [60, -60], aB: [80, -50] }, 'outCubic'], [0.42, { ...G_AIR }]],
      hits: [{ t: 0.05, d: 0.1, box: [-4, -50, 34, 50], dmg: 1.1, kb: [40, -400], stun: 0.6, hs: 4, launch: true }],
      ev: [[0.05, p => { p.vy = -320; Sound.play('hitHeavy', { x: p.x, pitch: 1.3 }); hPunchFx(p, 10, -32, false); }]],
    },
    plunge: plungeMove({
      label: '陨星坠', fallDmg: 1.0, armor: true, fallSpeed: 680,
      keys: [
        [0, { gl: 0, lean: -10, aF: [-100, -90], aB: [-90, -85], lF: [60, 110], lB: [110, 140] }],
        [0.1, { gl: 0, lean: 20, aF: [90, 90], aB: [85, 90], lF: [50, 120], lB: [110, 140] }, 'outCubic'],
        [0.3, { gl: 0, lean: 20, aF: [90, 90], aB: [85, 90], lF: [50, 120], lB: [110, 140] }],
      ],
    }),
    plungeLand: plungeLand({
      r: 58, dmg: 2.6, armor: true,
      keys: [[0, { lean: 40, aF: [80, 90], aB: [85, 95], lF: [30, 130], lB: [150, 100] }], [0.34, { lean: 10 }]],
    }),

    // =============== SKILLS ===============
    sk_charge: {
      label: '震地冲锋', dur: 0.62, cancel: 0.52, armor: true, noAtkSpeed: true, skill: 'gao_charge',
      keys: [
        [0, { lean: 20, aF: [60, -40], aB: [70, -40] }],
        [0.05, { lean: 38, aF: [20, -50], aB: [30, -50], lF: [30, 100], lB: [140, 120] }, 'outCubic'],
        [0.45, { lean: 38, aF: [20, -50], aB: [30, -50], lF: [40, 110], lB: [140, 130] }],
        [0.5, { lean: 30, aF: [0, 0], aB: [140, 160], ...G_LUNGE }, 'outCubic'],
        [0.62, { lean: 14 }],
      ],
      vel: [[0.05, 0.46, 340]],
      onStart(p) { Sound.play('charge', { x: p.x }); },
      ev: [
        [0.05, p => p.hitbox([0, -40, 30, 40], { dmg: 0.45, kx: 360, ky: -40, stun: 0.4, hs: 1 }, 0.41, { multi: 0.1 })],
        [0.48, p => {
          const lv = p.skillLv('gao_charge');
          explodeP(p.x + p.face * 22, p.y - 18, lv >= 2 ? 54 : 42, 2.0 * skMul(p, 'gao_charge'), { c: GAO_C, heavy: true, kx: 300, ky: -260, hs: 6, shake: 0.4, noProc: false, src: 'skill' });
          hPunchFx(p, 24, -22, true);
          if (lv >= 3) { pShockwave(p, p.x + p.face * 20, p.y, p.face, 1.5, GAO_C, 'skill', 'gao_charge'); }
        }],
      ],
      update(p, mv) { if (mv.t > 0.05 && mv.t < 0.46) { FX.dust(p.x - p.face * 6, p.y, 1, -p.face); if (Math.random() < 0.5) FX.fire(p.x + p.face * 10, p.y - 20, 1); } },
    },
    sk_grab: {
      label: '山崩投', dur: 1.0, cancel: 0.85, skill: 'gao_grab', armor: true, noAtkSpeed: true,
      keys: [
        [0, { lean: 20, aF: [10, 0], aB: [20, 10], ...G_LUNGE }],
        [0.12, { lean: 10, aF: [-40, -60], aB: [-30, -50] }],
        [0.3, { gl: 0, lean: -40, aF: [-100, -110], aB: [-90, -100], lF: [40, 120], lB: [110, 150] }],
        [0.55, { gl: 0, lean: -70, aF: [-140, -150], aB: [-130, -140], lF: [20, 110], lB: [100, 150] }],
        [0.64, { lean: 30, aF: [80, 90], aB: [85, 95], ...G_SQUAT }, 'outCubic'],
        [1.0, { lean: 10 }],
      ],
      vel: [[0.02, 0.1, 160]],
      ev: [[0.08, (p, mv) => {
        const box = { x: p.face > 0 ? p.x : p.x - 36, y: p.y - 40, w: 36, h: 40 };
        const e = G.enemies.find(en => !en.dead && !en.spawning && !en.boss && overlap(box, en.hurtbox()));
        if (e) { mv.held = e; e.held = true; e.cancelAttack && e.cancelAttack(); Sound.play('clank', { x: p.x, pitch: 0.7 }); p.inv = Math.max(p.inv, 0.7); }
        else {
          const b = G.enemies.find(en => !en.dead && en.boss && overlap(box, en.hurtbox()));
          if (b) hitEnemy(p, b, p.makeHit({ dmg: 2.4, kx: 0, ky: 0, stun: 0.2, hs: 6, heavy: true, src: 'skill' }));
          mv.whiff = true; mv.t = Math.max(mv.t, 0.62);
        }
      }], [0.32, (p, mv) => { if (mv.held) { p.vy = -300; Sound.play('jump', { x: p.x, pitch: 0.6 }); } }]],
      update(p, mv) {
        const e = mv.held;
        if (e && !mv.slammed) {
          if (e.dead) { mv.held = null; return; }
          const k = clamp((mv.t - 0.1) / 0.5, 0, 1);
          const a = (-90 - k * 120) * DEG;
          e.x = p.x + Math.cos(a) * 20 * p.face; e.y = p.y - 20 + Math.sin(a) * 26 + 10;
          e.vx = 0; e.vy = 0;
          if (mv.t > 0.55 && (p.onGround || mv.t > 0.8)) {
            mv.slammed = true; e.held = false;
            e.x = p.x - p.face * 14; e.y = G.room.floorBelow(e.x, p.y - 20);
            hitEnemy(p, e, p.makeHit({ dmg: 3.8, kx: -p.face * 120, ky: -260, stun: 0.9, hs: 10, heavy: true, launch: true, dir: -p.face, src: 'skill' }));
            gaoQuake(p, p.skillLv('gao_grab') >= 2 ? 64 : 48, 1.5 * skMul(p, 'gao_grab'), 'skill');
            if (p.skillLv('gao_grab') >= 3) later(0.25, () => gaoQuake(p, 80, 1.8 * skMul(p, 'gao_grab'), 'skill'));
          }
        }
      },
      onEnd(p, mv) { if (mv.held) mv.held.held = false; },
    },
    sk_iron: {
      label: '金刚身', dur: 0.5, cancel: 0.36, skill: 'gao_iron', noAtkSpeed: true,
      keys: [[0, { lean: 0, aF: [100, -60], aB: [110, -70], ...G_SQUAT }], [0.12, { lean: -6, aF: [40, -100], aB: [50, -110], ...G_SQUAT }, 'outCubic'], [0.5, { lean: 4, aF: [40, -100], aB: [50, -110], ...G_SQUAT }]],
      ev: [[0.12, p => {
        const lv = p.skillLv('gao_iron');
        p.ironT = lv >= 2 ? 4.5 : 3.2; p.ironLv = lv;
        Sound.play('gong', { x: p.x }); FX.ring(p.x, p.cy, 6, 46, '#ffd36a', 0.5, 4);
        FX.screenFlash('#ffd36a', 0.25, 0.25);
      }]],
    },
    sk_ki: {
      label: '气功波', dur: 0.6, cancel: 0.46, skill: 'gao_ki', noAtkSpeed: true,
      keys: [[0, { lean: -10, aF: [150, 120], aB: [160, 130], ...G_SQUAT }], [0.24, { lean: -12, aF: [160, 130], aB: [165, 140], ...G_SQUAT }], [0.29, { lean: 26, aF: [0, 0], aB: [5, 5], ...G_LUNGE }, 'outCubic'], [0.6, { lean: 10 }]],
      update(p, mv) { if (mv.t < 0.25) { const a = rand(0, TAU); FX.add({ k: 'px', x: p.x - p.face * 6 + Math.cos(a) * 18, y: p.cy + Math.sin(a) * 18, vx: -Math.cos(a) * 70, vy: -Math.sin(a) * 70, life: 0.25, s: 2, c: pick([GAO_C, '#ffffff']), glow: true, add: true }); Light.add(p.x, p.cy, 70, GAO_C, 0.7); } },
      ev: [[0.28, p => {
        const lv = p.skillLv('gao_ki');
        const hit = p.makeHit({ dmg: 2.6, kx: 240, ky: -120, stun: 0.6, hs: 4, heavy: true, src: 'skill' });
        const ball = (vy, size, dmgMul, split) => G.projs.push(new Proj({
          team: 'p', x: p.x + p.face * 22, y: p.y - 22, vx: p.face * 300, vy, kind: 'orb', r: size, c: GAO_C, c2: '#fff6d0', life: 1.4, hit: Object.assign({}, hit, { dmg: hit.dmg * dmgMul }), pierce: lv >= 2 ? 4 : 2, light: 90, trail: 0.7,
          onDie: q => {
            explodeP(q.x, q.y, 40, 1.2 * skMul(p, 'gao_ki') * dmgMul, { c: GAO_C, src: 'skill', shake: 0.25 });
            if (split) for (const a of [-0.5, 0, 0.5]) G.projs.push(new Proj({ team: 'p', x: q.x, y: q.y, vx: p.face * Math.cos(a) * 280, vy: Math.sin(a) * 280, kind: 'orb', r: 4, c: GAO_C, life: 0.6, hit: Object.assign({}, hit, { dmg: hit.dmg * 0.35 }), light: 40 }));
          },
        }));
        ball(0, lv >= 2 ? 10 : 8, 1, lv >= 3);
        Sound.play('explode', { x: p.x, pitch: 1.5 }); Sound.play('void', { x: p.x, pitch: 1.5 });
        p.vx = -p.face * 80; Cam.shake(0.3);
      }]],
    },
    sk_kick: {
      label: '旋风腿', dur: 1.3, cancel: 9, skill: 'gao_kick', grav: 0,
      durFn: p => p.skillLv('gao_kick') >= 3 ? 1.3 : 0.9,
      keys: [
        [0, { lean: 10, ...G_SQUAT }],
        ...altKeys(12, 0.1, { gl: 0, lean: 6, lF: [0, 5], lB: [120, 150], aF: [60, -40], aB: [80, -40] }, { gl: 0, lean: 6, lF: [100, 140], lB: [180, 185], aF: [60, -40], aB: [80, -40] }).map(([t, k, e]) => [t + 0.05, k, e]),
      ],
      onStart(p, mv) {
        p.vy = -200;
        mv.box = p.hitbox([-28, -44, 56, 44], { dmg: 0.5, kx: 120, ky: -120, stun: 0.35, hs: 1, radial: true, energy: 0.5 }, p.skillLv('gao_kick') >= 3 ? 1.25 : 0.85, { multi: 0.1 });
      },
      update(p, mv, dt) {
        p.vx = p.face * (p.skillLv('gao_kick') >= 2 ? 200 : 160);
        if (mv.t > 0.12) p.vy = approach(p.vy, 0, 1200 * dt);
        mv.ft = (mv.ft || 0) - dt;
        if (mv.ft <= 0) { mv.ft = 0.1; FX.slash(p.x, p.y - 22, { r: 28, a0: -180, a1: 180, th: 5, c: GAO_C, f: (mv.k = -(mv.k || 1)), sy: 0.4, dur: 0.14 }); Sound.play('swoosh', { x: p.x, pitch: rand(0.7, 0.9) }); }
      },
      onEnd(p, mv) { if (mv.box) mv.box.life = 0; },
    },
    sk_split: {
      label: '地裂', dur: 0.55, cancel: 0.42, skill: 'gao_split', armor: true,
      keys: [[0, { lean: -12, aF: [-110, -90], aB: [-100, -80] }], [0.1, { lean: 46, aF: [85, 95], aB: [88, 98], lF: [25, 120], lB: [150, 110] }, 'outCubic'], [0.55, { lean: 12 }]],
      ev: [[0.1, p => {
        const lv = p.skillLv('gao_split');
        const n = lv >= 2 ? 9 : 6;
        const dirs = lv >= 3 ? [1, -1] : [1];
        Cam.shake(0.35); Sound.play('stomp', { x: p.x });
        for (const d of dirs) for (let i = 0; i < n; i++) {
          const x0 = p.x, f = p.face * d;
          later(i * 0.06, () => rockSpike(p, x0 + f * (22 + i * 22), 1.0, 'gao_split', 22 + i * 1.5));
        }
      }]],
    },
    sk_dragon: {
      label: '升龙拳', dur: 0.95, cancel: 0.8, skill: 'gao_dragon', armor: true, grav: 0.8, noAtkSpeed: true,
      keys: [
        [0, { lean: 24, aF: [110, 70], ...G_SQUAT }],
        [0.08, { gl: 0, lean: -14, aF: [-85, -95], aB: [110, 60], lF: [80, 110], lB: [100, 140] }, 'outCubic'],
        [0.5, { gl: 0, lean: -14, aF: [-85, -95], aB: [110, 60], lF: [80, 110], lB: [100, 140] }],
        [0.95, { gl: 0, lean: 8, aF: [60, -20] }],
      ],
      onStart(p, mv) { p.inv = Math.max(p.inv, 0.4); },
      ev: [
        [0.06, (p, mv) => {
          p.vy = -540; p.vx = p.face * 60;
          mv.box = p.hitbox([-6, -66, 38, 72], { dmg: 0.5, kx: 20, ky: -480, stun: 0.6, hs: 1, launch: true, energy: 0.5 }, 0.32, { multi: 0.08 });
          Sound.play('hitHeavy', { x: p.x, pitch: 0.9 }); Sound.play('fire', { x: p.x });
        }],
        [0.4, p => {
          for (const e of enemiesInRect(p.x - 26, p.y - 80, 52, 90)) hitEnemy(p, e, p.makeHit({ dmg: 2.0, kx: 160 * p.face, ky: -300, stun: 0.8, hs: 8, heavy: true, launch: true, dir: p.face }));
          FX.ring(p.x, p.y - 50, 4, 40, '#ff6a2a', 0.3, 3); Cam.shake(0.4);
          if (p.skillLv('gao_dragon') >= 3) { p.vy = 700; p.onLandOnce = pp => gaoQuake(pp, 64, 2.2 * skMul(pp, 'gao_dragon'), 'skill'); }
        }],
      ],
      update(p, mv) {
        if (mv.t > 0.06 && mv.t < 0.5) { FX.fire(p.x + p.face * 8, p.y - 40, 2, true); Light.add(p.x, p.y - 30, 90, '#ff6a2a', 0.8); }
      },
    },
    sk_fists: {
      label: '百裂拳', dur: 0.95, cancel: 0.82, skill: 'gao_fists', armor: true,
      keys: [
        ...altKeys(10, 0.06, { lean: 20, aF: [0, 0], aB: [80, -40], ...G_LUNGE }, { lean: 22, aB: [0, 0], aF: [80, -40], ...G_LUNGE }),
        [0.66, { lean: -6, aF: [150, -80], aB: [60, -60], ...G_SQUAT }],
        [0.74, { lean: 34, aF: [0, 0], aB: [140, 160], ...G_LUNGE }, 'outCubic'],
        [0.95, { lean: 10 }],
      ],
      vel: [[0, 0.66, 35], [0.72, 0.8, 180]],
      onStart(p, mv) { mv.box = p.hitbox([0, -42, 42, 32], { dmg: 0.28, kx: 30, ky: -10, stun: 0.3, hs: 1, energy: 0.5 }, 0.66, { multi: p.skillLv('gao_fists') >= 3 ? 0.04 : 0.055 }); },
      update(p, mv) {
        if (mv.t < 0.66 && Math.random() < 0.6) {
          const ox = rand(18, 34), oy = -rand(18, 34);
          FX.add({ k: 'star', x: p.x + p.face * ox, y: p.y + oy, r: rand(5, 9), c: pick([GAO_C, '#ffffff']), life: 0.08, add: true });
          if (Math.random() < 0.3) Sound.play('hit', { x: p.x, pitch: rand(1.2, 1.6) });
        }
      },
      hits: [{ t: 0.74, d: 0.08, box: [0, -44, 48, 36], dmg: 1.9, kb: [360, -180], stun: 0.7, hs: 8, heavy: true, launch: true }],
      ev: [[0.74, p => { Sound.play('hitHeavy', { x: p.x, pitch: 0.7 }); hPunchFx(p, 30, -26, true); Cam.shake(0.35); if (p.skillLv('gao_fists') >= 2) G.projs.push(new Proj({ team: 'p', x: p.x + p.face * 30, y: p.y - 24, vx: p.face * 420, vy: 0, r: 9, kind: 'fist', c: GAO_C, life: 0.3, pierce: 99, ghost: true, hit: p.makeHit({ dmg: 1.2, kx: 220, ky: -100, stun: 0.4, src: 'skill', skill: 'gao_fists' }), light: 60 })); }]],
    },

    // =============== ULTIMATE ===============
    ult: {
      label: '霸王崩拳', dur: 1.55, cancel: 99, ult: true, grav: 0, noAtkSpeed: true,
      keys: [
        [0, { lean: -15, aF: [170, 150], aB: [150, 140], lF: [50, 110], lB: [130, 100] }],
        [0.5, { lean: -18, aF: [175, 160], aB: [155, 150], lF: [50, 110], lB: [130, 100] }],
        [0.56, { lean: 30, aF: [0, 0], aB: [150, 170], ...G_LUNGE }, 'outCubic'],
        [1.2, { lean: 30, aF: [0, 0], aB: [150, 170], ...G_LUNGE }],
        [1.55, { lean: 10 }],
      ],
      onStart(p) { p.vx = 0; p.vy = 0; G.cinematic(0.5); Sound.play('ultCharge'); },
      update(p, mv) {
        if (mv.t < 0.5) {
          const a = rand(0, TAU), r = rand(24, 46);
          FX.add({ k: 'px', x: p.x + Math.cos(a) * r, y: p.cy + Math.sin(a) * r, vx: -Math.cos(a) * r * 4, vy: -Math.sin(a) * r * 4, life: 0.24, s: 2, c: pick([GAO_C, '#ff6a2a', '#ffffff']), glow: true, add: true });
          Light.add(p.x, p.cy, 80 + mv.t * 100, GAO_C, 1);
        }
      },
      ev: [[0.55, p => {
        Sound.play('ultBoom');
        FX.screenFlash('#ffd36a', 0.6, 0.3);
        Cam.shake(1); G.hitstop(6); G.dim = 0.8;
        const f = p.face;
        const hit = p.makeHit({ dmg: 6, kx: 420, ky: -260, stun: 1.0, hs: 4, heavy: true, launch: true, src: 'ult', energy: 0 });
        G.projs.push(new Proj({ team: 'p', x: p.x + f * 20, y: p.y - 22, vx: f * 560, vy: 0, r: 22, kind: 'fist', c: GAO_C, life: 1.2, pierce: 99, ghost: true, hit, light: 160, trail: 1, tc: '#ff6a2a' }));
        for (const e of liveEnemies().filter(onScreen)) if (e.onGround) hitEnemy(p, e, p.makeHit({ dmg: 1.5, kx: 0, ky: -320, stun: 0.8, launch: true, dir: 1, src: 'ult', energy: 0, sfx: false }));
        FX.shock(p.x, p.y, GAO_C, 120);
        FX.debris(p.x, p.y, [GAO_C, '#a08a6a'], 18);
      }]],
    },
  },
};
