'use strict';
// =====================================================================
//  HEROES (1/4) — shared move helpers + RIN
//  Pose angles: 0 = forward, 90 = down, -90 = up, 180 = back (facing right)
//
//  Move fields:
//   dur, cancel           total time / earliest chain-cancel time
//   keys                  pose keyframes [t, pose, ease]
//   hits                  [{t, d, box:[x,y,w,h], dmg, kb:[x,y], stun, hs, heavy, launch, ...}]
//   ev                    [[t, fn(p, mv)]] timed events
//   vel                   [[t0, t1, vx, vy?]] forced velocity windows (vx in facing dir)
//   next / delay          chain on rhythm press / chain on delayed press (派生)
//   nextReq               technique flag needed for `next`
//   air, grav, armor, ult, light(=can roll into charge), steer, skill, parry, durFn
// =====================================================================

// ---------- move helpers ----------
function hSlash(p, o) {
  return FX.slash(p.x + p.face * (o.x || 0), p.y + (o.y || -20), {
    r: o.r || 22, a0: o.a0, a1: o.a1, th: o.th || 7, c: o.c || p.hero.color, c2: o.c2 || '#ffffff', f: p.face, sy: o.sy || 1, rot: o.rot || 0, dur: o.dur || 0.2, rev: o.rev,
  });
}
function hSound(name, o) { return p => Sound.play(name, Object.assign({ x: p.x }, o || {})); }
function skMul(p, id) { return id ? 1 + 0.35 * (p.skillLv(id) - 1) : 1; }
function hShoot(p, o) {
  // weapon traits only touch basic shots (combo / air / dash shots), never skills or arts
  const basic = !o.src && !o.skill && !o.uskill && !(p.move && (p.move.m.skill || p.move.m.uskill || p.move.m.art || p.move.m.ult));
  if (basic && p.flags.buck && !o.pellet) {
    let mid = null;
    for (const d of [-8, 0, 8]) {
      const pr = hShoot(p, Object.assign({}, o, { ang: (o.ang || 0) + d + rand(-2, 2), dmg: (o.dmg || 0.6) * 0.55, life: (o.life || 0.55) * 0.42, sp: (o.sp || 560) * rand(0.9, 1.05), pellet: true, silent: true }));
      if (!d) mid = pr;
    }
    if (!o.silent) Sound.play('shotgun', { x: p.x, pitch: rand(1.9, 2.2) });
    return mid;
  }
  const a = (o.ang || 0) * DEG;
  const sp = (o.sp || 560) * (basic && p.flags.frost ? 1.4 : 1);
  const x = p.x + p.face * (o.ox || 14), y = p.y + (o.oy || -21);
  const hit = p.makeHit({ dmg: o.dmg || 0.6, kx: o.kx || 50, ky: o.ky || -20, stun: o.stun || 0.2, hs: o.hs || 0, src: o.src, energy: 0.55, proj: true, fxc: o.c || '#ffd84a', sfx: 'hit', critBonus: o.critBonus, skill: o.skill, uskill: o.uskill });
  const pr = new Proj({ team: 'p', x, y, vx: Math.cos(a) * sp * p.face, vy: Math.sin(a) * sp, r: o.r || 1.6, kind: 'bullet', c: o.c || '#ffd84a', c2: '#ffffff', life: o.life || 0.55, hit, len: o.len || 11, pierce: (o.pierce || 0) + (p.stats.pierce || 0), light: 26, ghost: !!o.ghost, onDie: o.onDie });
  if (basic && p.flags.frost) { pr.c = '#bff8ff'; pr.onHit = (q, e) => applyStatus(e, 'slow', 0.35, 1.2); }
  G.projs.push(pr);
  FX.flash(x, y, o.r ? 6 : 4, '#ffe9a0', 0.06);
  FX.sparks(x, y, p.face > 0 ? a : Math.PI - a, o.c || '#ffd84a', 2, [80, 160], 0.4);
  if (!o.silent) Sound.play('shoot', { x, pitch: o.pitch || 1 });
  return pr;
}
function hPunchFx(p, ox, oy, big, col) {
  const x = p.x + p.face * ox, y = p.y + oy;
  FX.add({ k: 'star', x, y, r: big ? 16 : 10, c: col || '#ffd36a', life: 0.12, rot: rand(-0.4, 0.4), add: true });
  FX.ring(x, y, 2, big ? 18 : 11, col || '#ffb347', 0.16, 2);
  FX.sparks(x, y, p.face > 0 ? 0 : Math.PI, col || '#ffb347', big ? 6 : 3, [120, 260], 0.5);
}
function onScreen(e) { return e.x > Cam.x - 10 && e.x < Cam.x + W + 10 && e.y > Cam.y - 10 && e.y - e.h < Cam.y + H + 10; }
function liveEnemies() { return G.enemies.filter(e => !e.dead && !e.spawning); }
function nearestEnemy(x, y, maxD, filter) {
  let best = null, bd = maxD;
  for (const e of G.enemies) {
    if (e.dead || e.spawning || e.intangible || (filter && !filter(e))) continue;
    const d = dist(x, y, e.x, e.cy);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
// blink to the far side of the nearest enemy (used by counters / skills)
function teleportBehind(p, maxD) {
  const e = nearestEnemy(p.x, p.cy, maxD);
  if (!e) return null;
  const side = sign(p.x - e.x) || -p.face;
  let nx = e.x - side * (e.w / 2 + 12);
  if (G.room.solidPx(nx, e.y - 12) || nx < 2.5 * TILE || nx > G.room.pw - 2.5 * TILE) nx = e.x + side * (e.w / 2 + 12);
  FX.ghost(p.frame(), p.spr.ox, p.spr.oy, p.x, p.y, p.face < 0, p.hero.color, 0.3, 0.7);
  FX.burst(p.x, p.cy, { n: 10, c: [p.hero.color, '#ffffff'], sp: [40, 120], glow: true });
  p.x = clamp(nx, 2.5 * TILE, G.room.pw - 2.5 * TILE);
  p.y = e.y;
  if (G.room.solidPx(p.x, p.y - 4)) p.y = G.room.floorBelow(p.x, e.y - 30);
  p.face = sign(e.x - p.x) || p.face;
  p.vx = 0; p.vy = 0;
  Sound.play('teleport', { x: p.x });
  return e;
}
// several delayed cuts on every enemy inside a horizontal path
function pathCuts(p, x0, x1, n, mult, col, src, gap = 0.08, skill) {
  const lo = Math.min(x0, x1) - 16, hi = Math.max(x0, x1) + 16;
  const targets = enemiesInRect(lo, p.y - 64, hi - lo, 76);
  for (let k = 0; k < n; k++) later(k * gap, () => {
    for (const e of targets) {
      if (e.dead) continue;
      const a = rand(-60, 60);
      FX.slash(e.x, e.cy, { r: 18, a0: a - 70, a1: a + 70, th: 5, c: col, f: k % 2 ? 1 : -1, dur: 0.16, sy: 0.4, rot: rand(-40, 40) });
      hitEnemy(p, e, p.makeHit({ dmg: mult, kx: 20, ky: -60, stun: 0.5, hs: 2, dir: p.face, src, fxc: col, skill }));
    }
    if (targets.length) Sound.play('slash', { x: p.x, pitch: 1.2 + k * 0.08 });
  });
  return targets;
}
function waveProj(p, o) {
  const a = (o.ang || 0) * DEG, sp = o.sp || 400;
  const hit = p.makeHit({ dmg: o.dmg, kx: o.kx || 120, ky: o.ky || -60, stun: 0.45, hs: 1, src: o.src || 'skill', fxc: o.c, skill: o.skill, uskill: o.uskill });
  const pr = new Proj({
    team: 'p', x: (o.x !== undefined ? o.x : p.x + p.face * 14), y: (o.y !== undefined ? o.y : p.y + (o.oy || -20)), vx: Math.cos(a) * sp * (o.dir || p.face), vy: Math.sin(a) * sp, kind: 'wave', r: o.r || 6, hh: o.hh || 14,
    c: o.c || p.hero.color, c2: o.c2 || '#ffffff', life: o.life || 0.8, pierce: 99, ghost: true, hit, light: 60,
  });
  G.projs.push(pr);
  return pr;
}
// ground shockwave (player team)
function pShockwave(p, x, y, dir, dmgMult, col, src, skill) {
  const hit = p.makeHit({ dmg: dmgMult, kx: 140, ky: -220, stun: 0.45, hs: 2, dir, launch: true, src: src || 'heavy', fxc: col, skill });
  const b = Combat.area('p', x - 10, y - 18, 20, 18, hit, 0.45, { owner: p, face: dir });
  addZone({
    x, y, life: 0.45, dir,
    upd(z, dt) {
      z.x += dir * 360 * dt; b.x = z.x - 10;
      if (Math.random() < 0.9) FX.add({ k: 'px', x: z.x + rand(-4, 4), y: y - rand(0, 8), vx: dir * rand(10, 60), vy: -rand(40, 160), g: 500, life: rand(0.2, 0.4), s: rand(2, 3), c: pick([col, '#ffffff', '#c8b8a0']), shrink: true, glow: true });
      if (G.room.solidPx(z.x + dir * 8, y - 4) || !G.room.solidPx(z.x, y + 4)) { z.life = 0; b.life = 0; }
    },
    drawFn(ctx, gctx, x2, y2, z) {
      const a = z.life / 0.45;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = rgba(col, 0.8 * a);
      ctx.beginPath(); ctx.moveTo(x2 - dir * 14, y2); ctx.lineTo(x2, y2 - 16 * a); ctx.lineTo(x2 + dir * 6, y2); ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      gctx.fillStyle = col; gctx.globalAlpha = a; gctx.fillRect(x2 - 8, y2 - 14, 16, 14); gctx.globalAlpha = 1;
    },
  });
}
// alternating keyframes (spins, flurries)
function altKeys(n, step, a, b, ease) {
  const out = [];
  for (let i = 0; i <= n; i++) out.push([i * step, i % 2 ? b : a, ease || 'linear']);
  return out;
}

// ---------- shared plunge implementation ----------
function plungeMove(o) {
  return {
    label: o.label || '下劈', dur: 0.3, cancel: 9, air: true, loop: true, armor: o.armor, grav: 0,
    keys: o.keys,
    ev: [
      [0, p => { p.vy = -140; p.vx = 0; }],
      [0.1, p => {
        p.vy = o.fallSpeed || 620;
        p.plungeBox = p.hitbox([-12, -18, 24, 30], { dmg: o.fallDmg, kx: 0, ky: 380, stun: 0.4, hs: 2, src: 'heavy' }, 2, { multi: 0.2 });
        Sound.play('dash', { x: p.x, pitch: 0.7 });
      }],
    ],
    update(p, mv) {
      if (mv.t > 0.1) {
        p.vx = 0; p.vy = o.fallSpeed || 620;
        if (Math.random() < 0.8) FX.add({ k: 'streak', x: p.x + rand(-6, 6), y: p.y - rand(0, 30), vx: 0, vy: -500, life: 0.12, c: p.hero.color, len: 0.03 });
      }
      if (mv.t > 0.1 && p.onGround) {
        if (p.plungeBox) { p.plungeBox.life = 0; p.plungeBox = null; }
        p.startMove('plungeLand');
      }
      if (mv.t > 2.5) p.endMove();
    },
  };
}
function plungeLand(o) {
  return {
    label: '落地冲击', dur: 0.34, cancel: 0.22, armor: o.armor,
    keys: o.keys,
    hits: [{ t: 0, d: 0.08, box: [-o.r, -26, o.r * 2, 28], dmg: o.dmg, kb: [220, -240], stun: 0.55, hs: 6, heavy: true, launch: true, radial: true, src: 'heavy', finisher: true }],
    ev: [[0, p => {
      FX.shock(p.x, p.y, p.hero.color, o.r + 10);
      FX.ring(p.x, p.y - 4, 4, o.r + 16, p.hero.color, 0.3, 4, 0.35);
      FX.debris(p.x, p.y - 2, [p.hero.color, '#c8b8a0', '#ffffff'], 10);
      Sound.play('stomp', { x: p.x });
      Cam.shake(0.45);
      p.fire('onPlunge');
    }]],
  };
}

// =====================================================================
const HEROES = {};

// ----------------------------- RIN ----------------------------------
// stance helpers
const R_CROUCH = { lF: [22, 122], lB: [155, 100] };
const R_LUNGE = { lF: [15, 86], lB: [155, 145] };
const R_AIR = { gl: 0, lF: [60, 120], lB: [110, 140] };
const R_DRAW = { lean: 30, aF: [140, 170], aB: [120, 160], w: 180, lF: [25, 115], lB: [150, 110] };
const R_CUT = { lean: 42, aF: [-8, 0], aB: [160, 175], w: -4, lF: [10, 85], lB: [162, 150] };

HEROES.rin = {
  id: 'rin', name: '凛', en: 'RIN', title: '绯红刀姬', role: '近战 · 均衡',
  color: '#ff3b5c', color2: '#ffd0d8',
  desc: '游历诸国的流浪剑客，一柄绯刃斩断宿命。连段派生丰富，见切反击凌厉。',
  hp: 100, atk: 10, speed: 136, crit: 0.1, armor: 0, energyRate: 1.4, procMul: 1,
  hurt: [12, 30],
  startSkill: 'rin_shadow',
  ultName: '月华千斩', ultDesc: '化身月影，对画面内所有敌人施加无数斩击，最后一记横断天地。',
  combo: 'atk1', air: 'aatk1',
  look: 'rin',
  holdPose: s => ({ lean: 24 + s, aF: [132, 166], aB: [118, 158], w: 178, lF: [22, 116], lB: [152, 106], scarf: 168 + s * 8 }),
  wallPose: { gl: 0, lean: -6, aF: [100, 60], aB: [175, 165], w: 120, lF: [80, 130], lB: [120, 160], scarf: 120 },
  moves: {
    // ---------------- ground combo ----------------
    atk1: {
      label: '一之太刀', dur: 0.3, cancel: 0.17, light: true,
      keys: [
        [0, { lean: 0, aF: [-70, -110], aB: [120, 100], w: -140, lF: [75, 100], lB: [110, 95] }],
        [0.06, { lean: 10, aF: [-20, -10], w: -40, aB: [130, 110] }, 'linear'],
        [0.1, { lean: 16, aF: [40, 50], w: 60, lF: [55, 95], lB: [125, 100], aB: [140, 120] }],
        [0.3, { lean: 10, aF: [60, 40], w: 40, lF: [60, 98], lB: [118, 96] }],
      ],
      hits: [{ t: 0.06, d: 0.07, box: [-2, -38, 38, 36], dmg: 1.0, kb: [55, -30], stun: 0.34, hs: 3 }],
      vel: [[0.02, 0.1, 120]],
      ev: [[0.04, hSound('slash')], [0.05, p => hSlash(p, { x: 4, y: -20, r: 22, a0: -115, a1: 75, th: 7, sy: 0.85 })]],
      next: 'atk2',
    },
    atk2: {
      label: '二之太刀', dur: 0.32, cancel: 0.18, light: true,
      keys: [
        [0, { lean: 14, aF: [70, 110], w: 140, lF: [60, 98], lB: [120, 96], aB: [120, 100] }],
        [0.05, { lean: 8, aF: [30, 40], w: 60 }, 'linear'],
        [0.1, { lean: -4, aF: [-60, -80], w: -85, aB: [100, 70], lF: [70, 100], lB: [110, 95] }],
        [0.32, { lean: 2, aF: [-40, -50], w: -60 }],
      ],
      hits: [{ t: 0.06, d: 0.07, box: [-2, -44, 38, 44], dmg: 1.1, kb: [60, -70], stun: 0.36, hs: 3 }],
      vel: [[0.02, 0.1, 120]],
      ev: [[0.04, hSound('slash', { pitch: 1.1 })], [0.05, p => hSlash(p, { x: 4, y: -18, r: 23, a0: 80, a1: -112, th: 7, sy: 0.9 })]],
      next: 'atk3', delay: 'atkB1',
    },
    atk3: {
      label: '三之太刀·回', dur: 0.42, cancel: 0.3, light: true,
      keys: [
        [0, { lean: 4, aF: [-50, -40], w: -30 }],
        [0.05, { lean: 12, aF: [30, 20], w: 15 }],
        [0.12, { lean: 8, aF: [100, 150], w: 170, aB: [60, 30] }],
        [0.17, { lean: 14, aF: [10, -10], w: -5 }],
        [0.24, { lean: 18, aF: [60, 80], w: 100 }],
        [0.42, { lean: 10, aF: [70, 50], w: 40 }],
      ],
      hits: [
        { t: 0.05, d: 0.06, box: [-8, -36, 44, 28], dmg: 0.8, kb: [30, -30], stun: 0.34, hs: 2 },
        { t: 0.17, d: 0.07, box: [-8, -36, 46, 30], dmg: 0.95, kb: [70, -40], stun: 0.4, hs: 3 },
      ],
      vel: [[0.02, 0.2, 90]],
      ev: [
        [0.04, p => { Sound.play('slash', { x: p.x, pitch: 1.2 }); hSlash(p, { x: 0, y: -22, r: 28, a0: -170, a1: 20, th: 8, sy: 0.38 }); }],
        [0.16, p => { Sound.play('slash', { x: p.x, pitch: 0.95 }); hSlash(p, { x: 0, y: -18, r: 30, a0: 170, a1: -15, th: 8, sy: 0.38 }); }],
      ],
      next: 'atk4',
    },
    atk4: {
      label: '四之太刀·穿', dur: 0.55, cancel: 0.42,
      keys: [
        [0, { lean: 25, aF: [140, 170], aB: [120, 160], w: 180, lF: [40, 120], lB: [135, 110] }],
        [0.08, { lean: 35, aF: [0, 0], aB: [160, 175], w: 0, ...R_LUNGE }, 'outCubic'],
        [0.3, { lean: 30, aF: [5, 0], w: 0, ...R_LUNGE }],
        [0.55, { lean: 12, aF: [60, 40], w: 40 }],
      ],
      hits: [{ t: 0.07, d: 0.12, box: [-12, -32, 56, 26], dmg: 2.2, kb: [340, -130], stun: 0.55, hs: 7, heavy: true, finisher: true, src: 'heavy' }],
      vel: [[0.05, 0.17, 440]],
      ev: [[0.06, p => {
        Sound.play('slashHeavy', { x: p.x });
        hSlash(p, { x: 10, y: -18, r: 34, a0: -35, a1: 35, th: 10, sy: 0.45, dur: 0.26 });
        FX.add({ k: 'streak', x: p.x + p.face * 70, y: p.y - 18, vx: p.face * 2400, vy: 0, life: 0.14, c: '#ffffff', len: 0.03, w: 2 });
        Cam.push(p.face * 3, 0);
      }]],
      next: 'atk5', nextReq: 'combo5',
    },
    atk5: {
      label: '终式·樱落', dur: 0.66, cancel: 0.5, grav: 1.3,
      keys: [
        [0, { lean: -8, aF: [-120, -140], aB: [-100, -120], w: -150, lF: [55, 110], lB: [125, 100] }],
        [0.12, { gl: 0, lean: -14, aF: [-135, -155], aB: [-110, -130], w: -165, lF: [35, 120], lB: [110, 155] }],
        [0.2, { gl: 0.5, lean: 34, aF: [55, 85], aB: [65, 90], w: 95, lF: [25, 100], lB: [145, 130] }, 'outCubic'],
        [0.66, { lean: 12, aF: [70, 50], w: 40 }],
      ],
      vel: [[0.02, 0.17, 110]],
      ev: [
        [0.02, p => { p.vy = -280; Sound.play('jump', { x: p.x }); }],
        [0.17, p => { p.vy = 520; }],
        [0.18, p => {
          Sound.play('slashHeavy', { x: p.x, pitch: 0.75 });
          hSlash(p, { x: 8, y: -22, r: 42, a0: -140, a1: 100, th: 13, dur: 0.32 });
          FX.burst(p.x + p.face * 20, p.y - 20, { n: 24, c: ['#ffb7d0', '#ffffff', '#ff7aa0'], sp: [60, 220], g: 120, life: [0.5, 1.0], s: [1, 2] });
        }],
      ],
      hits: [{ t: 0.18, d: 0.14, box: [-8, -56, 66, 62], dmg: 2.9, kb: [270, -290], stun: 0.75, hs: 8, heavy: true, launch: true, finisher: true, src: 'heavy' }],
      update(p, mv) {
        if (mv.t > 0.2 && p.onGround && !mv.landed) { mv.landed = true; FX.shock(p.x + p.face * 12, p.y, p.hero.color, 50); Cam.shake(0.4); Sound.play('stomp', { x: p.x }); }
      },
    },
    // ---------------- delayed branch: 月轮 → 天坠 ----------------
    atkB1: {
      label: '派生·月轮', dur: 0.44, cancel: 0.3,
      keys: [
        [0, { lean: 12, aF: [100, 140], w: 160, ...R_CROUCH }],
        [0.06, { lean: -6, aF: [-70, -90], w: -100, lF: [70, 100], lB: [110, 95] }, 'outCubic'],
        [0.12, { lean: 8, aF: [70, 110], w: 140, lF: [50, 110], lB: [130, 100] }],
        [0.18, { lean: -8, aF: [-80, -100], w: -110, lF: [75, 100], lB: [105, 95] }, 'outCubic'],
        [0.44, { lean: 0, aF: [-50, -60], w: -60 }],
      ],
      hits: [
        { t: 0.05, d: 0.06, box: [-6, -48, 40, 48], dmg: 0.75, kb: [20, -210], stun: 0.55, hs: 2, launch: true },
        { t: 0.17, d: 0.07, box: [-6, -54, 42, 54], dmg: 0.85, kb: [30, -310], stun: 0.65, hs: 3, launch: true },
      ],
      vel: [[0.02, 0.2, 60]],
      ev: [
        [0.04, p => { Sound.play('slash', { x: p.x, pitch: 1.25 }); hSlash(p, { x: 4, y: -20, r: 24, a0: 90, a1: -115, th: 7, sy: 1.1 }); }],
        [0.16, p => { Sound.play('slash', { x: p.x, pitch: 1.45 }); hSlash(p, { x: 6, y: -24, r: 28, a0: 80, a1: -120, th: 8, sy: 1.2, c2: '#ffe0e8' }); }],
      ],
      next: 'atkB2',
    },
    atkB2: {
      label: '派生·天坠', dur: 0.6, cancel: 0.45,
      keys: [
        [0, { lean: 0, aF: [-60, -80], w: -90, ...R_CROUCH }],
        [0.16, { gl: 0, lean: -12, aF: [-140, -155], aB: [-120, -140], w: -165, lF: [40, 120], lB: [105, 155] }],
        [0.24, { gl: 0, lean: 32, aF: [60, 90], aB: [70, 95], w: 100, lF: [60, 110], lB: [120, 140] }, 'outCubic'],
        [0.6, { gl: 0, lean: 18, aF: [70, 80], w: 80 }],
      ],
      ev: [
        [0.02, p => { p.vy = -390; p.vx = p.face * 60; Sound.play('jump', { x: p.x }); }],
        [0.22, p => { p.vy = Math.max(p.vy, 140); Sound.play('slashHeavy', { x: p.x }); hSlash(p, { x: 6, y: -18, r: 30, a0: -150, a1: 100, th: 10 }); }],
      ],
      hits: [{ t: 0.22, d: 0.1, box: [-8, -42, 50, 60], dmg: 1.9, kb: [120, 440], stun: 0.6, hs: 7, heavy: true, finisher: true, src: 'heavy' }],
    },
    // ---------------- directional / special ----------------
    low: {
      label: '下段·燕扫', dur: 0.4, cancel: 0.27,
      keys: [
        [0, { lean: 22, aF: [70, 110], w: 150, lF: [20, 125], lB: [155, 100] }],
        [0.06, { lean: 32, aF: [50, 20], w: 15, lF: [12, 115], lB: [162, 95] }, 'outCubic'],
        [0.4, { lean: 16, aF: [60, 40], w: 30, lF: [40, 110], lB: [140, 96] }],
      ],
      hits: [{ t: 0.05, d: 0.07, box: [-6, -18, 48, 20], dmg: 1.1, kb: [50, -250], stun: 0.65, hs: 4, launch: true }],
      vel: [[0.02, 0.12, 140]],
      ev: [[0.04, p => { Sound.play('slash', { x: p.x, pitch: 0.9 }); hSlash(p, { x: 4, y: -8, r: 28, a0: -170, a1: 25, th: 6, sy: 0.3 }); FX.dust(p.x + p.face * 20, p.y, 6, p.face); }]],
    },
    rise: {
      label: '升龙斩', dur: 0.45, cancel: 0.32,
      keys: [
        [0, { lean: 18, aF: [100, 150], w: 160, lF: [35, 125], lB: [140, 105] }],
        [0.07, { gl: 0.4, lean: -6, aF: [-80, -95], w: -95, aB: [120, 140], lF: [80, 110], lB: [100, 130] }, 'outCubic'],
        [0.45, { gl: 0, lean: 0, aF: [-60, -80], w: -70, lF: [60, 120], lB: [100, 150] }],
      ],
      hits: [{ t: 0.05, d: 0.12, box: [-6, -54, 36, 56], dmg: 1.2, kb: [30, -430], stun: 0.7, hs: 4, launch: true }],
      ev: [[0.05, p => { p.vy = -400; Sound.play('slashHeavy', { x: p.x, pitch: 1.2 }); hSlash(p, { x: 4, y: -22, r: 26, a0: 70, a1: -120, th: 8, sy: 1.1 }); }]],
    },
    dashAtk: {
      label: '疾风刺', dur: 0.36, cancel: 0.24, grav: 0,
      keys: [
        [0, { lean: 30, aF: [150, 170], w: 178, lF: [30, 100], lB: [150, 130] }],
        [0.05, { lean: 40, aF: [0, 0], aB: [160, 175], w: 0, lF: [15, 85], lB: [158, 148] }, 'outCubic'],
        [0.36, { lean: 18, aF: [30, 10], w: 10 }],
      ],
      vel: [[0, 0.14, 500, 0]],
      hits: [{ t: 0.03, d: 0.12, box: [-8, -32, 50, 28], dmg: 1.4, kb: [200, -80], stun: 0.45, hs: 4 }],
      ev: [[0.03, p => {
        Sound.play('slashHeavy', { x: p.x, pitch: 1.3 });
        FX.add({ k: 'streak', x: p.x + p.face * 46, y: p.y - 18, vx: p.face * 2200, vy: 0, life: 0.12, c: '#ffffff', len: 0.03, w: 2 });
        hSlash(p, { x: 14, y: -18, r: 26, a0: -30, a1: 30, th: 8, sy: 0.4 });
      }]],
      next: 'dashAtk2', nextReq: 'dashChain',
    },
    dashAtk2: {
      label: '追风·燕返', dur: 0.44, cancel: 0.3,
      keys: [
        [0, { lean: 20, aF: [110, 150], w: 165, lF: [30, 115], lB: [150, 100] }],
        [0.07, { gl: 0.4, lean: -10, aF: [-85, -95], w: -95, aB: [130, 140], lF: [80, 110], lB: [100, 130] }, 'outCubic'],
        [0.44, { gl: 0, lean: 0, aF: [-60, -80], w: -70 }],
      ],
      hits: [{ t: 0.05, d: 0.1, box: [-10, -52, 44, 54], dmg: 1.4, kb: [40, -420], stun: 0.7, hs: 5, launch: true }],
      ev: [[0.05, p => { p.vy = -300; Sound.play('slashHeavy', { x: p.x, pitch: 1.1 }); hSlash(p, { x: 2, y: -22, r: 28, a0: 120, a1: -110, th: 9, sy: 1.1 }); }]],
    },
    charge1: {
      label: '蓄力·一闪', dur: 0.5, cancel: 0.36, grav: 0, noAtkSpeed: true,
      keys: [[0, R_DRAW], [0.06, R_CUT, 'outCubic'], [0.5, { lean: 16, aF: [40, 20], w: 20 }]],
      onStart(p, mv) { mv.x0 = p.x; p.inv = Math.max(p.inv, 0.2); },
      vel: [[0.03, 0.15, 620, 0]],
      hits: [{ t: 0.04, d: 0.12, box: [-40, -36, 82, 34], dmg: 2.6, kb: [240, -140], stun: 0.7, hs: 8, heavy: true, finisher: true, src: 'charge' }],
      ev: [[0.04, p => {
        Sound.play('slashHeavy', { x: p.x, pitch: 0.7 });
        FX.add({ k: 'beam', x: p.x - p.face * 60, y: p.y - 18, len: 130, w: 3, ang: p.face > 0 ? 0 : Math.PI, c: p.hero.color, life: 0.25 });
        hSlash(p, { x: -10, y: -18, r: 46, a0: -25, a1: 25, th: 10, sy: 0.35, dur: 0.3 });
        Cam.shake(0.3);
      }]],
    },
    charge2: {
      label: '极·绝影', dur: 0.85, cancel: 0.64, grav: 0, noAtkSpeed: true,
      keys: [
        [0, R_DRAW], [0.06, R_CUT, 'outCubic'], [0.5, { ...R_CUT, lean: 30 }],
        [0.6, { lean: 6, aF: [80, 120], aB: [100, 80], w: 160 }, 'outCubic'],
        [0.85, { lean: 6, aF: [72, 40], w: 28 }],
      ],
      onStart(p, mv) { mv.x0 = p.x; p.inv = Math.max(p.inv, 0.7); p.trail = 0.25; },
      vel: [[0.03, 0.2, 820, 0]],
      hits: [{ t: 0.04, d: 0.16, box: [-30, -38, 70, 36], dmg: 1.6, kb: [40, -60], stun: 1.0, hs: 4, heavy: true, src: 'charge' }],
      ev: [
        [0.04, p => { Sound.play('dash', { x: p.x, pitch: 0.6 }); Sound.play('slashHeavy', { x: p.x, pitch: 1.2 }); }],
        [0.3, (p, mv) => { G.dim = 0.6; pathCuts(p, mv.x0, p.x, 4, 0.7, p.hero.color, 'charge', 0.07); }],
        [0.62, (p, mv) => {
          const lo = Math.min(mv.x0, p.x) - 20, hi = Math.max(mv.x0, p.x) + 20;
          for (const e of enemiesInRect(lo, p.y - 64, hi - lo, 76)) hitEnemy(p, e, p.makeHit({ dmg: 2.3, kx: 0, ky: -320, launch: true, stun: 0.8, heavy: true, hs: 0, dir: p.face, src: 'charge' }));
          FX.screenFlash('#ffffff', 0.45, 0.2); Cam.shake(0.5); Sound.play('ultBoom');
          FX.add({ k: 'beam', x: lo, y: p.y - 20, len: hi - lo, w: 5, ang: 0, c: p.hero.color, life: 0.3 });
        }],
      ],
    },
    counter: {
      label: '见切·反击', dur: 0.48, cancel: 0.32, grav: 0, noAtkSpeed: true,
      keys: [[0, { ...R_DRAW, lean: 25 }], [0.06, { ...R_CUT, lean: 38, aF: [-20, -10], w: -20 }, 'outCubic'], [0.48, { lean: 12, aF: [50, 30], w: 30 }]],
      onStart(p) { teleportBehind(p, 190); p.inv = Math.max(p.inv, 0.45); },
      hits: [{ t: 0.05, d: 0.08, box: [-10, -48, 58, 50], dmg: 3.0, kb: [240, -220], stun: 0.8, hs: 10, heavy: true, launch: true, critBonus: 1, src: 'counter', finisher: true }],
      ev: [[0.05, p => {
        Sound.play('slashHeavy', { x: p.x, pitch: 0.9 }); Sound.play('crit', { x: p.x });
        hSlash(p, { x: 10, y: -22, r: 34, a0: -60, a1: 60, th: 10, rot: 35 });
        hSlash(p, { x: 10, y: -22, r: 34, a0: -60, a1: 60, th: 10, rot: -35 });
        FX.screenFlash('#ffffff', 0.35, 0.15);
      }]],
    },
    // ---------------- air ----------------
    aatk1: {
      label: '空·一', dur: 0.26, cancel: 0.16, air: true, grav: 0.12,
      keys: [
        [0, { ...R_AIR, lean: 2, aF: [-80, -110], w: -140 }],
        [0.05, { ...R_AIR, lean: 14, aF: [-10, 0], w: -20 }, 'linear'],
        [0.09, { ...R_AIR, lean: 18, aF: [50, 60], w: 70 }],
        [0.26, { ...R_AIR, lean: 12, aF: [60, 50], w: 50 }],
      ],
      hits: [{ t: 0.05, d: 0.07, box: [-2, -40, 38, 40], dmg: 0.95, kb: [40, -160], stun: 0.42, hs: 3 }],
      ev: [[0.04, hSound('slash')], [0.05, p => hSlash(p, { x: 4, y: -20, r: 22, a0: -115, a1: 80, th: 7, sy: 0.9 })]],
      next: 'aatk2',
    },
    aatk2: {
      label: '空·二', dur: 0.28, cancel: 0.17, air: true, grav: 0.12,
      keys: [
        [0, { ...R_AIR, lean: 16, aF: [80, 120], w: 140 }],
        [0.05, { ...R_AIR, lean: 8, aF: [20, 30], w: 40 }, 'linear'],
        [0.1, { ...R_AIR, lean: -4, aF: [-70, -80], w: -90 }],
        [0.28, { ...R_AIR, aF: [-50, -60], w: -60 }],
      ],
      hits: [{ t: 0.05, d: 0.07, box: [-2, -44, 38, 44], dmg: 1.0, kb: [40, -170], stun: 0.42, hs: 3 }],
      ev: [[0.04, hSound('slash', { pitch: 1.1 })], [0.05, p => hSlash(p, { x: 4, y: -20, r: 23, a0: 80, a1: -115, th: 7 })]],
      next: 'aatk3',
    },
    aatk3: {
      label: '空·坠月', dur: 0.42, cancel: 0.32, air: true, grav: 0.25,
      keys: [
        [0, { ...R_AIR, lean: -10, aF: [-120, -130], aB: [-100, -120], w: -120 }],
        [0.08, { ...R_AIR, lean: 30, aF: [60, 90], aB: [70, 95], w: 100 }, 'outCubic'],
        [0.42, { ...R_AIR, lean: 20, aF: [70, 80], w: 80 }],
      ],
      hits: [{ t: 0.07, d: 0.08, box: [-6, -46, 46, 56], dmg: 1.6, kb: [160, 380], stun: 0.5, hs: 6, heavy: true, finisher: true, src: 'heavy' }],
      ev: [[0.06, p => { Sound.play('slashHeavy', { x: p.x }); hSlash(p, { x: 4, y: -20, r: 28, a0: -150, a1: 100, th: 9 }); }]],
    },
    airRise: {
      label: '空·登龙', dur: 0.4, cancel: 0.27, air: true, grav: 1,
      keys: [
        [0, { ...R_AIR, lean: 12, aF: [90, 130], w: 150, lF: [50, 120] }],
        [0.06, { ...R_AIR, lean: -8, aF: [-80, -95], w: -95, lF: [85, 110], lB: [100, 130] }, 'outCubic'],
        [0.4, { ...R_AIR, aF: [-60, -80], w: -70 }],
      ],
      hits: [{ t: 0.04, d: 0.12, box: [-8, -54, 38, 56], dmg: 1.0, kb: [30, -400], stun: 0.6, hs: 3, launch: true }],
      ev: [[0.04, p => { p.vy = -340; Sound.play('slash', { x: p.x, pitch: 1.3 }); hSlash(p, { x: 4, y: -24, r: 26, a0: 80, a1: -120, th: 8, sy: 1.1 }); }]],
    },
    plunge: plungeMove({
      label: '坠刃', fallDmg: 0.8,
      keys: [
        [0, { gl: 0, lean: 0, aF: [-60, -90], aB: [-80, -95], w: -90, lF: [60, 110], lB: [110, 140] }],
        [0.1, { gl: 0, lean: 10, aF: [80, 90], aB: [85, 92], w: 90, lF: [70, 100], lB: [100, 110] }, 'outCubic'],
        [0.3, { gl: 0, lean: 10, aF: [80, 90], aB: [85, 92], w: 90, lF: [70, 100], lB: [100, 110] }],
      ],
    }),
    plungeLand: plungeLand({
      r: 44, dmg: 1.8,
      keys: [[0, { lean: 30, aF: [80, 90], w: 90, lF: [30, 130], lB: [150, 100] }], [0.34, { lean: 10, aF: [70, 50], w: 40 }]],
    }),

    // =============== SKILLS ===============
    sk_shadow: {
      label: '影闪', dur: 0.42, cancel: 0.32, grav: 0, noAtkSpeed: true, skill: 'rin_shadow',
      keys: [[0, R_DRAW], [0.05, { ...R_CUT, gl: 0.5, lean: 40, aF: [0, 0], w: 0 }, 'outCubic'], [0.42, { lean: 15, aF: [30, 10], w: 10 }]],
      vel: [[0.03, 0.17, 700, 0]],
      onStart(p, mv) { p.inv = Math.max(p.inv, 0.4); mv.x0 = p.x; p.trail = 0.25; Sound.play('dash', { x: p.x, pitch: 0.8 }); },
      ev: [
        [0.04, p => { Sound.play('slashHeavy', { x: p.x, pitch: 1.3 }); FX.add({ k: 'streak', x: p.x + p.face * 30, y: p.y - 18, vx: p.face * 3000, vy: 0, life: 0.18, c: '#ff3b5c', len: 0.04, w: 3 }); }],
        [0.2, (p, mv) => pathCuts(p, mv.x0, p.x, p.skillLv('rin_shadow') >= 3 ? 5 : 3, 1.0, '#ff3b5c', 'skill', 0.09, 'rin_shadow')],
      ],
    },
    sk_parry: {
      label: '燕返架势', dur: 0.78, cancel: 0.72, parry: [0.02, 0.6], noAtkSpeed: true, skill: 'rin_parry',
      keys: [
        [0, { lean: -6, aF: [40, -40], aB: [60, -30], w: -160, lF: [60, 105], lB: [120, 95] }],
        [0.6, { lean: -4, aF: [40, -40], aB: [60, -30], w: -160, lF: [60, 105], lB: [120, 95] }],
        [0.66, { lean: 24, aF: [20, 40], w: 60, lF: [40, 95], lB: [135, 100] }, 'outCubic'],
        [0.78, { lean: 12, aF: [60, 40], w: 40 }],
      ],
      onStart(p) { Sound.play('clank', { x: p.x, pitch: 1.4 }); },
      update(p, mv) { if (mv.t < 0.6 && Math.random() < 0.6) FX.add({ k: 'px', x: p.x + p.face * rand(4, 16), y: p.y - rand(10, 36), vx: 0, vy: -20, life: 0.25, s: 1, c: '#ffffff', glow: true }); },
      onParry(p, srcX) {
        p.face = sign(srcX - p.x) || p.face;
        const lv = p.skillLv('rin_parry');
        G.witchT = Math.max(G.witchT, lv >= 3 ? 1.5 : 0.7);
        Sound.play('parry', { x: p.x });
        FX.sparks(p.x + p.face * 10, p.cy, p.face > 0 ? 0 : Math.PI, '#ffffff', 14, [160, 360], 1.2);
        FX.ring(p.x, p.cy, 4, 40, '#ffffff', 0.3, 3);
        p.startMove('sk_parryHit');
      },
      ev: [[0.62, p => { Sound.play('slash', { x: p.x }); hSlash(p, { x: 4, y: -20, r: 24, a0: -100, a1: 60, th: 7 }); }]],
      hits: [{ t: 0.62, d: 0.06, box: [-4, -38, 42, 36], dmg: 1.2, kb: [100, -60], stun: 0.4, hs: 3 }],
    },
    sk_parryHit: {
      label: '燕返', dur: 0.5, cancel: 0.36, grav: 0, noAtkSpeed: true, skill: 'rin_parry',
      keys: [[0, { ...R_DRAW, lean: 20 }], [0.05, { ...R_CUT, aF: [-30, -20], w: -30 }, 'outCubic'], [0.5, { lean: 12, aF: [60, 40], w: 40 }]],
      onStart(p) { p.inv = Math.max(p.inv, 0.6); },
      hits: [{ t: 0.04, d: 0.1, box: [-14, -52, 76, 54], dmg: 3.2, kb: [300, -220], stun: 0.9, hs: 10, heavy: true, launch: true, critBonus: 1, src: 'skill' }],
      ev: [[0.04, p => {
        Sound.play('slashHeavy', { x: p.x, pitch: 0.8 }); Sound.play('crit', { x: p.x });
        hSlash(p, { x: 12, y: -24, r: 44, a0: -80, a1: 80, th: 12, rot: 20, dur: 0.3 });
        FX.screenFlash('#ffffff', 0.4, 0.15);
        if (p.skillLv('rin_parry') >= 3) { pShockwave(p, p.x, p.y, 1, 1.2, '#ff3b5c', 'skill', 'rin_parry'); pShockwave(p, p.x, p.y, -1, 1.2, '#ff3b5c', 'skill', 'rin_parry'); }
      }]],
    },
    sk_wave: {
      label: '飞燕斩', dur: 0.42, cancel: 0.3, skill: 'rin_wave',
      keys: [[0, { lean: -6, aF: [-90, -120], w: -140 }], [0.06, { lean: 20, aF: [30, 40], w: 50, lF: [40, 100], lB: [135, 100] }, 'outCubic'], [0.42, { lean: 10, aF: [60, 40], w: 40 }]],
      ev: [[0.05, p => {
        const lv = p.skillLv('rin_wave');
        const n = lv >= 3 ? 3 : 1;
        for (let i = 0; i < n; i++) waveProj(p, { dmg: 1.6, ang: (i - (n - 1) / 2) * 12, sp: 430, hh: 16, skill: 'rin_wave' });
        if (lv >= 2) later(0.16, () => waveProj(p, { dmg: 1.2, sp: 480, hh: 12, oy: -14, skill: 'rin_wave' }));
        hSlash(p, { x: 6, y: -20, r: 26, a0: -100, a1: 70, th: 9 });
        Sound.play('slashHeavy', { x: p.x, pitch: 1.2 });
      }]],
    },
    sk_whirl: {
      label: '旋风刃', dur: 1.45, cancel: 9, skill: 'rin_whirl', steer: 75,
      durFn: p => p.skillLv('rin_whirl') >= 3 ? 1.45 : 1.0,
      keys: altKeys(14, 0.1, { lean: 6, aF: [5, 0], aB: [175, 180], w: 0, lF: [65, 100], lB: [115, 95] }, { lean: 6, aF: [175, 180], aB: [5, 0], w: 180, lF: [75, 100], lB: [105, 95] }),
      onStart(p, mv) {
        const big = p.skillLv('rin_whirl') >= 3;
        mv.box = p.hitbox(big ? [-44, -46, 88, 50] : [-34, -42, 68, 46], { dmg: 0.42, kx: 0, ky: -40, stun: 0.3, hs: 0, src: 'skill', radial: true, energy: 0.4 }, big ? 1.4 : 0.95, { multi: 0.12 });
      },
      update(p, mv, dt) {
        mv.ft = (mv.ft || 0) - dt;
        if (mv.ft <= 0) {
          mv.ft = 0.1;
          FX.slash(p.x, p.y - 20, { r: 30, a0: -180, a1: 180, th: 6, c: p.hero.color, f: (mv.k = -(mv.k || 1)), sy: 0.35, dur: 0.14 });
          Sound.play('swoosh', { x: p.x, pitch: rand(0.8, 1.1) });
        }
        for (const e of enemiesNear(p.x, p.cy, 90)) if (!e.boss) e.vx += (p.x - e.x) * 3 * dt;
      },
      onEnd(p, mv) { if (mv.box) mv.box.life = 0; },
    },
    sk_petal: {
      label: '樱吹雪', dur: 0.45, cancel: 0.3, skill: 'rin_petal',
      keys: [[0, { lean: -4, aF: [-100, -120], w: -130 }], [0.08, { lean: 10, aF: [20, 0], w: -10 }, 'outCubic'], [0.45, { aF: [60, 40], w: 40 }]],
      ev: [[0.08, p => {
        const lv = p.skillLv('rin_petal');
        const r = lv >= 2 ? 64 : 50;
        Sound.play('swoosh', { x: p.x, pitch: 0.7 });
        addZone({
          x: p.x + p.face * 56, y: p.cy - 4, life: lv >= 2 ? 3.4 : 2.6, tick: 0.22,
          onTick(z) {
            for (const e of enemiesNear(z.x, z.y, r)) {
              hitEnemy(p, e, p.makeHit({ dmg: 0.4, kx: 0, ky: -30, stun: 0.2, hs: 0, dir: sign(e.x - z.x) || 1, src: 'skill', sfx: false, energy: 0.3, fxc: '#ffb7d0', skill: 'rin_petal' }));
              applyStatus(e, 'slow', 0.45, 0.6);
            }
          },
          upd(z, dt) {
            if (lv >= 3) { z.x = lerp(z.x, p.x, dt * 4); z.y = lerp(z.y, p.cy, dt * 4); }
            for (let i = 0; i < 3; i++) {
              const a = rand(0, TAU), rr = rand(10, r);
              FX.add({ k: 'px', x: z.x + Math.cos(a) * rr, y: z.y + Math.sin(a) * rr * 0.7, vx: -Math.sin(a) * 90, vy: Math.cos(a) * 60, life: 0.4, s: 2, c: pick(['#ffb7d0', '#ffe0ec', '#ff7aa0']), shrink: true });
            }
            Light.add(z.x, z.y, r * 2, '#ff9ac0', 0.4);
          },
        });
      }]],
    },
    sk_meteor: {
      label: '天降一闪', dur: 0.95, cancel: 0.82, grav: 0, noAtkSpeed: true, skill: 'rin_meteor',
      keys: [
        [0, { lean: 20, ...R_CROUCH, aF: [100, 150], w: 160 }],
        [0.1, { gl: 0, lean: -10, aF: [-140, -160], aB: [-120, -150], w: -170, lF: [40, 120], lB: [100, 160] }],
        [0.38, { gl: 0, lean: -10, aF: [-140, -160], aB: [-120, -150], w: -170, lF: [40, 120], lB: [100, 160] }],
        [0.46, { gl: 0, lean: 40, aF: [50, 80], aB: [60, 85], w: 90, lF: [30, 100], lB: [150, 140] }, 'outCubic'],
        [0.95, { lean: 15, aF: [70, 50], w: 40 }],
      ],
      onStart(p) { p.inv = Math.max(p.inv, 1.0); },
      ev: [
        [0.05, p => { p.vy = -600; Sound.play('jump', { x: p.x, pitch: 0.7 }); FX.dust(p.x, p.y, 10, 0); }],
        [0.36, (p, mv) => {
          const e = nearestEnemy(p.x, p.y, 280);
          const tx = e ? e.x : p.x + p.face * 90;
          const gy = G.room.floorBelow(tx, p.y);
          p.face = sign(tx - p.x) || p.face;
          p.vx = (tx - p.x) / 0.16; p.vy = Math.max(300, (gy - p.y) / 0.16);
          mv.diving = true;
          FX.tline(p.x, p.cy, tx, gy - 10, p.hero.color, 0.16, 2);
          Sound.play('dash', { x: p.x, pitch: 0.5 });
        }],
      ],
      update(p, mv) {
        if (mv.t > 0.12 && mv.t < 0.36) p.vy *= 0.88;
        if (mv.diving) FX.ghost(p.frame(), p.spr.ox, p.spr.oy, p.x, p.y, p.face < 0, p.hero.color, 0.2, 0.5);
        if (mv.diving && (p.onGround || mv.t > 0.7)) {
          mv.diving = false; p.vx = 0; p.vy = 0;
          const lv = p.skillLv('rin_meteor');
          explodeP(p.x, p.y - 10, lv >= 2 ? 72 : 60, 2.8 * skMul(p, 'rin_meteor'), { c: p.hero.color, heavy: true, ky: -320, kx: 200, hs: 8, shake: 0.6, src: 'skill', noProc: false });
          FX.shock(p.x, p.y, p.hero.color, 80);
          Sound.play('stomp', { x: p.x });
          if (lv >= 3) for (let i = -2; i <= 2; i++) if (i) later(0.1 + Math.abs(i) * 0.08, () => {
            const x = p.x + i * 34, gy = G.room.floorBelow(x, p.y - 30);
            FX.add({ k: 'beam', x, y: gy, len: 70, w: 6, ang: -Math.PI / 2, c: p.hero.color, life: 0.3 });
            for (const e of enemiesInRect(x - 12, gy - 70, 24, 70)) hitEnemy(p, e, p.makeHit({ dmg: 1.2, kx: 0, ky: -280, launch: true, stun: 0.6, src: 'skill', skill: 'rin_meteor' }));
            Sound.play('slash', { x, pitch: 1.4 });
          });
        }
      },
    },
    sk_iai: {
      label: '居合·断', dur: 0.95, cancel: 0.8, grav: 0, noAtkSpeed: true, skill: 'rin_iai',
      keys: [[0, { ...R_DRAW, lean: 20, aF: [130, 165], w: 178, lF: [25, 115], lB: [150, 108] }], [0.45, { ...R_DRAW, lean: 22 }], [0.5, R_CUT, 'outCubic'], [0.95, { lean: 12, aF: [70, 40], w: 30 }]],
      onStart(p) { p.armorT = 0.5; p.vx = 0; Sound.play('ultCharge'); },
      update(p, mv) {
        if (mv.t < 0.45) {
          const a = rand(0, TAU), r = rand(18, 34);
          FX.add({ k: 'px', x: p.x + Math.cos(a) * r, y: p.cy + Math.sin(a) * r, vx: -Math.cos(a) * r * 4, vy: -Math.sin(a) * r * 4, life: 0.22, s: 1.5, c: p.hero.color, glow: true, add: true });
          Light.add(p.x, p.cy, 60 + mv.t * 80, p.hero.color, 0.8);
        }
      },
      ev: [[0.46, p => {
        const f = p.face, x0 = p.x;
        let x1 = x0;
        for (let d = 0; d < 230; d += 8) { const nx = x0 + f * d; if (G.room.solidPx(nx, p.y - 12) || nx < 2.5 * TILE || nx > G.room.pw - 2.5 * TILE) break; x1 = nx; }
        const lo = Math.min(x0, x1) - 10, hi = Math.max(x0, x1) + 10;
        const list = enemiesInRect(lo, p.y - 58, hi - lo, 62);
        for (const e of list) hitEnemy(p, e, p.makeHit({ dmg: 3.6, kx: 120, ky: -160, stun: 0.9, hs: 0, heavy: true, launch: true, dir: f, src: 'skill' }));
        FX.ghost(p.frame(), p.spr.ox, p.spr.oy, p.x, p.y, p.face < 0, p.hero.color, 0.4, 0.7);
        p.x = x1;
        p.inv = Math.max(p.inv, 0.35);
        FX.add({ k: 'beam', x: lo, y: p.y - 22, len: hi - lo, w: 4, ang: 0, c: p.hero.color, life: 0.35 });
        FX.add({ k: 'beam', x: lo, y: p.y - 22, len: hi - lo, w: 1, ang: 0, c: '#ffffff', life: 0.5 });
        FX.screenFlash('#ffffff', 0.5, 0.2);
        G.hitstop(8); Cam.shake(0.5);
        Sound.play('slashHeavy', { x: p.x, pitch: 0.6 }); Sound.play('ultBoom');
        if (p.skillLv('rin_iai') >= 3) later(0.3, () => {
          for (const e of enemiesInRect(lo, p.y - 58, hi - lo, 62)) hitEnemy(p, e, p.makeHit({ dmg: 2.0, kx: 0, ky: -260, stun: 0.6, launch: true, dir: -f, src: 'skill', skill: 'rin_iai' }));
          FX.add({ k: 'beam', x: lo, y: p.y - 30, len: hi - lo, w: 3, ang: 0, c: '#ffffff', life: 0.3 });
          Sound.play('slashHeavy', { x: p.x, pitch: 1.1 });
        });
      }]],
    },
    sk_flurry: {
      label: '千鸟', dur: 0.85, cancel: 0.76, skill: 'rin_flurry',
      keys: [
        ...altKeys(9, 0.066, { lean: 26, aF: [5, 0], aB: [150, 160], w: 0, ...R_LUNGE }, { lean: 22, aF: [20, 30], aB: [150, 160], w: 25, lF: [25, 90], lB: [150, 140] }),
        [0.62, { lean: 20, aF: [150, 170], w: 180, lF: [30, 110], lB: [150, 110] }],
        [0.68, { lean: 40, aF: [0, 0], w: 0, ...R_LUNGE }, 'outCubic'],
        [0.85, { lean: 18, aF: [40, 20], w: 20 }],
      ],
      vel: [[0, 0.6, 55], [0.66, 0.74, 260]],
      onStart(p, mv) { mv.box = p.hitbox([0, -36, 48, 26], { dmg: 0.32, kx: 30, ky: -20, stun: 0.3, hs: 1, src: 'skill', energy: 0.5 }, p.skillLv('rin_flurry') >= 3 ? 0.62 : 0.6, { multi: p.skillLv('rin_flurry') >= 3 ? 0.05 : 0.07 }); },
      update(p, mv) {
        if (mv.t < 0.6 && Math.random() < 0.7) {
          const y = p.y - rand(14, 30);
          FX.add({ k: 'streak', x: p.x + p.face * rand(30, 50), y, vx: p.face * 1500, vy: 0, life: 0.06, c: Math.random() < 0.5 ? '#ffffff' : p.hero.color, len: 0.02, w: 1 });
          if (Math.random() < 0.25) Sound.play('swoosh', { x: p.x, pitch: rand(1.1, 1.5) });
        }
      },
      hits: [{ t: 0.68, d: 0.08, box: [-4, -36, 58, 28], dmg: 1.5, kb: [280, -100], stun: 0.6, hs: 6, heavy: true }],
      ev: [[0.68, p => { Sound.play('slashHeavy', { x: p.x }); FX.add({ k: 'streak', x: p.x + p.face * 70, y: p.y - 22, vx: p.face * 2400, vy: 0, life: 0.14, c: '#ffffff', len: 0.03, w: 3 }); }]],
    },

    // =============== ULTIMATE ===============
    ult: {
      label: '月华千斩', dur: 1.95, cancel: 99, ult: true, grav: 0, noAtkSpeed: true,
      keys: [
        [0, { lean: -5, aF: [-90, -90], aB: [-80, -85], w: -90 }],
        [0.4, { lean: -5, aF: [-90, -90], aB: [-80, -85], w: -90 }],
        [1.4, { lean: 30, aF: [10, 0], w: 0, ...R_LUNGE }],
        [1.6, { lean: 30, aF: [10, 0], w: 0, ...R_LUNGE }],
        [1.95, { lean: 10, aF: [70, 40], w: 30 }],
      ],
      onStart(p) { p.vx = 0; p.vy = 0; G.cinematic(0.45); Sound.play('ultCharge'); },
      ev: [
        [0.42, p => { p.hidden = true; FX.flash(p.x, p.cy, 30, '#ff3b5c', 0.2); Sound.play('teleport', { x: p.x }); G.dim = 1.0; }],
        ...Array.from({ length: 16 }, (_, i) => [0.48 + i * 0.055, p => {
          const list = liveEnemies().filter(onScreen);
          const e = list.length ? pick(list) : null;
          const x = e ? e.x : Cam.x + rand(60, W - 60), y = e ? e.cy : Cam.y + rand(60, H - 60);
          const a = rand(0, 180);
          FX.add({ k: 'streak', x: x + Math.cos(a * DEG) * 40, y: y + Math.sin(a * DEG) * 40, vx: -Math.cos(a * DEG) * 2600, vy: -Math.sin(a * DEG) * 2600, life: 0.1, c: '#ff3b5c', len: 0.03, w: 2 });
          FX.slash(x, y, { r: 22, a0: a - 60, a1: a + 60, th: 4, c: '#ff3b5c', f: 1, sy: 0.25, rot: a, dur: 0.15 });
          Sound.play('swoosh', { x, pitch: rand(0.9, 1.3) });
          if (e) hitEnemy(p, e, p.makeHit({ dmg: 0.65, kx: 0, ky: -40, stun: 0.6, hs: 1, dir: 1, src: 'ult', energy: 0 }));
        }]),
        [1.38, p => {
          p.hidden = false;
          FX.screenFlash('#ffffff', 0.7, 0.35);
          for (let k = 0; k < 3; k++) FX.add({ k: 'beam', x: Cam.x, y: p.y - 22 + (k - 1) * 6, len: W, w: k === 1 ? 6 : 2, ang: 0, c: '#ff3b5c', life: 0.4 });
          Sound.play('ultBoom');
          Cam.shake(0.8);
          G.hitstop(10);
          for (const e of liveEnemies().filter(onScreen)) hitEnemy(p, e, p.makeHit({ dmg: 3.5, kx: 260, ky: -260, stun: 0.9, hs: 0, heavy: true, launch: true, dir: sign(e.x - p.x) || 1, src: 'ult', energy: 0 }));
        }],
      ],
    },
  },
};
