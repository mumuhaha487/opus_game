'use strict';
// =====================================================================
//  HEROES (4/5) — LAN, the wandering spear of the jade tide
//  Spear angle w: 0 = level forward, -90 = straight up, 90 = straight down
// =====================================================================
const LAN_C = '#3ee0b0', LAN_C2 = '#d6fff2', LAN_W = '#5ac8e8', LAN_FOAM = '#e6fff8', LAN_RED = '#e8334f';
// stance snippets
const L_BACK = { lean: 14, aF: [110, 165], aB: [95, 140], w: 2 };                                  // drawn back before a thrust
const L_THRUST = { lean: 24, aF: [4, 0], aB: [30, 8], w: 0, lF: [15, 88], lB: [155, 145] };       // fully extended
const L_EASE = { lean: 10, aF: [30, 10], aB: [60, 25], w: -6 };                                     // recovering to guard
const L_RAISE = { lean: -10, aF: [-115, -100], aB: [-95, -80], w: -115 };                          // spear lifted overhead
const L_SMASH = { lean: 34, aF: [40, 62], aB: [55, 72], w: 58, lF: [25, 110], lB: [150, 110] };   // brought down in front
const L_PLANT = { lean: 10, aF: [60, 90], aB: [70, 95], w: 90 };                                    // spear driven into the ground
const L_CROUCH = { lF: [18, 122], lB: [158, 98] };
const L_AIR = { gl: 0, lF: [60, 120], lB: [110, 140] };
const L_UP0 = { lean: 18, aF: [100, 150], aB: [90, 130], w: 150, lF: [35, 125], lB: [140, 105] };
const L_UP1 = { gl: 0.4, lean: -8, aF: [-75, -90], aB: [-60, -80], w: -85, lF: [80, 110], lB: [100, 130] };
const L_UPE = { gl: 0, lean: 0, aF: [-50, -70], aB: [-40, -60], w: -65, lF: [60, 120], lB: [100, 150] };
const L_SWEEP0 = { lean: 10, aF: [140, 170], aB: [120, 150], w: -170 };                            // swung back, about to sweep over the top
const L_DIVE = { lean: 40, aF: [42, 45], aB: [60, 55], w: 45 };                                     // spear angled down-forward
const L_SPIN_A = { lean: 4, aF: [5, 0], aB: [175, 180], w: 0 }, L_SPIN_B = { lean: 4, aF: [175, 180], aB: [5, 0], w: 180 };

// ---------- spear helpers ----------
// world angle (radians) of a direction given relative to facing (degrees: 0 forward, -90 up, 90 down)
function lanAng(p, deg) { return p.face > 0 ? deg * DEG : Math.PI - deg * DEG; }
function lanBeam(p, x, y, deg, len, w, c, life) { FX.add({ k: 'beam', x, y, len, w, ang: lanAng(p, deg), c, life }); }
// the line a thrust leaves: a jade needle of light along the spear and a white glint off the tip
function lanThrustFx(p, o = {}) {
  const deg = o.deg || 0, len = o.len || 46, x = p.x + p.face * (o.x || 8), y = p.y + (o.y || -21), a = lanAng(p, deg);
  FX.add({ k: 'beam', x, y, len, w: o.w || 3, ang: a, c: o.c || LAN_C, life: o.life || 0.14 });
  const tx = x + Math.cos(a) * len, ty = y + Math.sin(a) * len;
  FX.add({ k: 'streak', x: tx, y: ty, vx: Math.cos(a) * 2400, vy: Math.sin(a) * 2400, life: 0.1, c: '#ffffff', len: 0.02, w: 1.5 });
  FX.sparks(tx, ty, a, o.c || LAN_C, 3, [120, 260], 0.3);
}
function lanSplash(x, y, n = 10) {
  FX.burst(x, y, { n, c: [LAN_C, LAN_FOAM, LAN_W], sp: [40, 150], ang: -Math.PI / 2, spread: 1.1, g: 420, life: [0.3, 0.6], s: [1, 2.5], glow: true });
}
// a needle of spear-light: thin, fast, piercing
function lanNeedle(p, o = {}) {
  const a = (o.ang || 0) * DEG, sp = o.sp || 620, dir = o.dir || p.face;
  const hit = p.makeHit({ dmg: o.dmg || 0.8, kx: o.kx || 90, ky: o.ky || -40, stun: o.stun || 0.3, hs: o.hs === undefined ? 1 : o.hs, src: o.src, proj: true, fxc: o.c || LAN_C, art: o.art, skill: o.skill, uskill: o.uskill, wx: o.wx, critBonus: o.critBonus, energy: o.energy });
  const pr = new Proj({
    team: 'p', x: o.x !== undefined ? o.x : p.x + dir * 16, y: o.y !== undefined ? o.y : p.y - 21, vx: Math.cos(a) * sp * dir, vy: Math.sin(a) * sp,
    kind: 'bullet', r: o.r || 2, len: o.len || 26, c: o.c || LAN_C, c2: '#ffffff', life: o.life || 0.5, pierce: o.pierce === undefined ? 3 : o.pierce,
    ghost: o.ghost !== false, light: 40, hit, onDie: o.onDie, upd: o.upd, trail: o.trail || 0, grav: o.grav || 0,
  });
  G.projs.push(pr);
  return pr;
}
// a jade water-dragon: a segmented body trailing a head that cuts whatever it passes
function lanDragon(p, o) {
  const wx = o.wx !== undefined ? o.wx : p.moveWx(p.move && p.move.m, o);
  const segs = [], n = o.segs || 10, size = o.size || 1, R = (o.r || 18) * size;
  const z = addZone({
    x: o.x, y: o.y, y0: o.y, life: o.life || 0.9, tick: o.tick || 0.06, dragon: true, vx: o.vx, segs, size, hitT: {},
    onTick(z) {
      for (const e of enemiesNear(z.x, z.y, R)) {
        if (G.time - (z.hitT[e.id] || -9) < (o.rehit || 0.25)) continue;
        z.hitT[e.id] = G.time;
        hitEnemy(p, e, p.makeHit({ dmg: o.dmg * (z.mul || 1), kx: (o.kx || 120) * (sign(z.vx) || 1), ky: o.ky || -220, launch: true, stun: 0.5, hs: o.hs === undefined ? 2 : o.hs, dir: sign(z.vx) || 1, src: o.src, fxc: LAN_C, wx, energy: o.energy }));
      }
    },
    upd(z, dt) {
      z.x += z.vx * dt;
      // along the ground it hugs the floor; in the air it weaves
      if (o.ground) { const gy = G.room.floorBelow(z.x, z.y0 - 20); z.y = lerp(z.y, (Math.abs(gy - z.y0) < 60 ? gy : z.y0) - 10 * size + Math.sin(z.t * (o.freq || 9)) * (o.amp || 6), 0.35); }
      else z.y = z.y0 + Math.sin(z.t * (o.freq || 9)) * (o.amp || 10);
      segs.unshift([z.x, z.y]); if (segs.length > n * 2) segs.pop();
      Light.add(z.x, z.y, 70 * size, LAN_C, 0.6);
      if (Math.random() < 0.7) FX.add({ k: 'px', x: z.x + rand(-6, 6) * size, y: z.y + rand(-6, 6) * size, vx: -z.vx * 0.2 + rand(-20, 20), vy: rand(-50, 10), g: 260, life: 0.35, s: 2, c: pick([LAN_C, LAN_FOAM, LAN_W]), shrink: true, glow: true });
      if (o.upd) o.upd(z, dt);
    },
    drawFn(ctx, gctx, x2, y2, z) {
      const ox = x2 - z.x, oy = y2 - z.y, f = sign(z.vx) || 1, a = Math.min(1, z.life * 4, z.t * 10);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = segs.length - 1; i >= 1; i -= 2) {
        const [sx, sy] = segs[i], u = i / (n * 2), r = (5.5 - u * 3.8) * size;
        ctx.globalAlpha = a * (0.9 - u * 0.5); ctx.fillStyle = (i >> 1) % 2 ? LAN_C : LAN_W;
        ctx.beginPath(); ctx.arc(sx + ox, sy + oy, r, 0, TAU); ctx.fill();
        gctx.globalAlpha = a * 0.45; gctx.fillStyle = LAN_C; gctx.beginPath(); gctx.arc(sx + ox, sy + oy, r * 1.8, 0, TAU); gctx.fill();
      }
      // head: foam snout, two swept horns, a white eye
      ctx.globalAlpha = a; ctx.fillStyle = LAN_FOAM;
      ctx.beginPath(); ctx.ellipse(x2 + f * 3 * size, y2, 7 * size, 4.5 * size, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = LAN_C;
      ctx.beginPath(); ctx.moveTo(x2 - f * 2 * size, y2 - 3 * size); ctx.lineTo(x2 - f * 10 * size, y2 - 9 * size); ctx.lineTo(x2 - f * 1 * size, y2 - 5 * size); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x2 + f * 9 * size, y2 + 1 * size); ctx.lineTo(x2 + f * 13 * size, y2 + 3 * size); ctx.lineTo(x2 + f * 7 * size, y2 + 3 * size); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x2 + f * 4 * size), Math.round(y2 - 2 * size), Math.max(1, Math.round(size * 1.4)), Math.max(1, Math.round(size * 1.4)));
      gctx.globalAlpha = a * 0.7; gctx.fillStyle = LAN_C; gctx.beginPath(); gctx.arc(x2, y2, 12 * size, 0, TAU); gctx.fill();
      ctx.globalAlpha = 1; gctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    },
  });
  return z;
}
// a column of jade water bursting from the floor below x
function lanGeyser(p, x, mult, o = {}) {
  const gy = G.room.floorBelow(x, p.y - 30);
  if (gy - p.y > 90 || x < 2 * TILE || x > G.room.pw - 2 * TILE) return false;
  const h = o.h || 58, w = o.w || 18;
  FX.customDraw(x, gy, 0.5, (ctx, gctx, X, Y, t) => {
    const k = t < 0.15 ? t / 0.15 : t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1, hh = h * k;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgba(LAN_W, 0.75); ctx.fillRect(X - w / 2, Y - hh, w, hh);
    ctx.fillStyle = rgba(LAN_C, 0.85); ctx.fillRect(X - w / 3, Y - hh, w * 2 / 3, hh);
    ctx.fillStyle = LAN_FOAM; ctx.fillRect(X - 1, Y - hh, 2, hh);
    for (let i = 0; i < 4; i++) { const yy = Y - ((t * 220 + i * 17) % Math.max(1, hh)); ctx.fillRect(X - w / 2 + ((i * 5) % w), yy, 2, 3); }
    ctx.beginPath(); ctx.ellipse(X, Y - hh, w * 0.7, 4, 0, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    gctx.fillStyle = LAN_C; gctx.globalAlpha = 0.5 * k; gctx.fillRect(X - w / 2 - 2, Y - hh, w + 4, hh); gctx.globalAlpha = 1;
  }, 1);
  lanSplash(x, gy - h, 8);
  Light.add(x, gy - h / 2, h * 1.4, LAN_C, 0.8);
  Sound.play('splash', { x, pitch: 1 + rand(0, 0.3) });
  for (const e of enemiesInRect(x - w / 2, gy - h, w, h)) hitEnemy(p, e, p.makeHit({ dmg: mult, kx: 30, ky: o.ky || -360, launch: true, stun: 0.6, hs: 2, dir: p.face, src: o.src || 'light', art: o.art, skill: o.skill, uskill: o.uskill, wx: o.wx, fxc: LAN_C, status: o.status }));
  return true;
}
// a wave of water rolling along the floor
function lanSurge(p, x, y, dir, mult, o = {}) {
  const hit = p.makeHit({ dmg: mult, kx: 160, ky: -260, stun: 0.45, hs: 2, dir, launch: true, src: o.src || 'light', fxc: LAN_C, art: o.art, skill: o.skill, uskill: o.uskill, wx: o.wx });
  const h = o.h || 20, b = Combat.area('p', x - 10, y - h, 20, h, hit, o.life || 0.5, { owner: p, face: dir });
  addZone({
    x, y, life: o.life || 0.5, dir,
    upd(z, dt) {
      z.x += dir * (o.sp || 300) * dt; b.x = z.x - 10;
      if (Math.random() < 0.9) FX.add({ k: 'px', x: z.x + rand(-6, 4) * dir, y: y - rand(0, h), vx: dir * rand(20, 80), vy: -rand(40, 160), g: 500, life: rand(0.2, 0.4), s: rand(1.5, 3), c: pick([LAN_C, LAN_FOAM, LAN_W]), shrink: true, glow: true });
      if (G.room.solidPx(z.x + dir * 8, y - 4) || !G.room.solidPx(z.x, y + 4)) { z.life = 0; b.life = 0; }
    },
    drawFn(ctx, gctx, x2, y2, z) {
      const a = Math.min(1, z.life / 0.15);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = rgba(LAN_W, 0.7 * a);
      ctx.beginPath(); ctx.moveTo(x2 - dir * 16, y2); ctx.quadraticCurveTo(x2 - dir * 6, y2 - h * 1.1, x2 + dir * 6, y2 - h * 0.7); ctx.lineTo(x2 + dir * 2, y2 - h * 0.45); ctx.lineTo(x2 + dir * 8, y2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = rgba(LAN_FOAM, 0.85 * a); ctx.fillRect(x2 + dir * 2 - 2, y2 - h * 0.8, 4, 3);
      ctx.globalCompositeOperation = 'source-over';
      gctx.fillStyle = LAN_C; gctx.globalAlpha = 0.6 * a; gctx.fillRect(x2 - 10, y2 - h, 20, h); gctx.globalAlpha = 1;
    },
  });
}

HEROES.lan = {
  id: 'lan', name: '澜', en: 'LAN', title: '游龙枪客', role: '中距 · 控场',
  color: LAN_C, color2: LAN_C2,
  desc: '游龙枪门的少年传人，一杆长枪挑、扫、掷、回如游龙出水。出手距离长，擅长挑空与追击。',
  hp: 110, atk: 11, speed: 132, crit: 0.08, armor: 0.05, energyRate: 1.3, procMul: 1,
  hurt: [12, 31],
  range: 0.7, atkIcon: 'spear', sprBox: [96, 72, 48, 64],
  startSkill: 'lan_pierce',
  ultName: '苍龙破', ultDesc: '长枪化作苍龙横贯画面，最后一声龙吟震荡所有敌人。',
  combo: 'atk1', air: 'aatk1',
  look: 'lan',
  holdPose: s => ({ ...L_BACK, lean: 18 + s, ...L_CROUCH, scarf: 168 + s * 8 }),
  wallPose: { gl: 0, lean: -6, aF: [100, 60], aB: [175, 165], w: 110, lF: [80, 130], lB: [120, 160], scarf: 120 },
  moves: {
    // ---------------- ground combo ----------------
    atk1: {
      label: '点枪', dur: 0.28, cancel: 0.16, light: true,
      keys: [[0, { ...L_BACK, lean: 8, aF: [80, 150] }], [0.05, { lean: 18, aF: [5, 0], aB: [40, 15], w: 0, lF: [40, 95], lB: [130, 100] }, 'outCubic'], [0.28, L_EASE]],
      hits: [{ t: 0.05, d: 0.07, box: [4, -30, 50, 16], dmg: 0.95, kb: [70, -30], stun: 0.32, hs: 3 }],
      vel: [[0.02, 0.09, 110]],
      ev: [[0.04, p => { Sound.play('thrust', { x: p.x }); lanThrustFx(p, { len: 40, y: -22 }); }]],
      next: 'atk2',
    },
    atk2: {
      label: '拦枪', dur: 0.32, cancel: 0.18, light: true,
      keys: [[0, { ...L_SWEEP0, lF: [60, 98], lB: [120, 96] }], [0.06, { lean: 16, aF: [20, 10], aB: [50, 30], w: 12 }, 'outCubic'], [0.32, { lean: 8, aF: [40, 20], aB: [60, 30], w: 20 }]],
      hits: [{ t: 0.06, d: 0.07, box: [-8, -44, 54, 38], dmg: 1.05, kb: [80, -60], stun: 0.36, hs: 3 }],
      vel: [[0.02, 0.1, 90]],
      ev: [[0.05, p => { Sound.play('swoosh', { x: p.x, pitch: 0.9 }); hSlash(p, { x: 4, y: -22, r: 30, a0: -150, a1: 40, th: 6, sy: 0.6, c: LAN_C }); }]],
      next: 'atk3', delay: 'atkB1',
    },
    atk3: {
      label: '连环刺', dur: 0.42, cancel: 0.3, light: true,
      keys: [[0, L_BACK], [0.05, { ...L_THRUST, lean: 18, lF: [40, 95], lB: [130, 100] }, 'outCubic'], [0.12, { ...L_BACK, lean: 12 }], [0.18, L_THRUST, 'outCubic'], [0.42, L_EASE]],
      hits: [
        { t: 0.05, d: 0.06, box: [4, -28, 54, 14], dmg: 0.7, kb: [40, -20], stun: 0.32, hs: 2 },
        { t: 0.18, d: 0.07, box: [4, -30, 58, 16], dmg: 0.85, kb: [110, -40], stun: 0.38, hs: 3 },
      ],
      vel: [[0.02, 0.2, 80]],
      ev: [
        [0.04, p => { Sound.play('thrust', { x: p.x }); lanThrustFx(p, { len: 42, y: -20 }); }],
        [0.17, p => { Sound.play('thrust', { x: p.x, pitch: 1.2 }); lanThrustFx(p, { len: 48, y: -22 }); }],
      ],
      next: 'atk4',
    },
    atk4: {
      label: '崩枪', dur: 0.56, cancel: 0.42,
      keys: [[0, { ...L_RAISE, lF: [70, 100], lB: [110, 95] }], [0.12, { ...L_RAISE, lean: -14, w: -125 }], [0.18, L_SMASH, 'outCubic'], [0.56, { lean: 10, aF: [40, 20], aB: [60, 30], w: 20 }]],
      hits: [{ t: 0.17, d: 0.08, box: [0, -46, 56, 48], dmg: 2.0, kb: [240, -260], stun: 0.6, hs: 7, heavy: true, launch: true, finisher: true, src: 'heavy' }],
      ev: [
        [0.05, p => Sound.play('swoosh', { x: p.x, pitch: 0.6 })],
        [0.17, p => {
          const x = p.x + p.face * 36;
          hSlash(p, { x: 6, y: -24, r: 34, a0: -130, a1: 70, th: 8, c: LAN_C });
          FX.shock(x, p.y, LAN_C, 44); lanSplash(x, p.y - 2, 14);
          Sound.play('slashHeavy', { x: p.x, pitch: 0.75 }); Sound.play('splash', { x }); Cam.shake(0.4);
        }],
      ],
      next: 'atk5', nextReq: 'combo5',
    },
    atk5: {
      label: '终式·游龙出海', dur: 0.72, cancel: 0.54, grav: 1.2,
      keys: [
        [0, { ...L_BACK, ...L_CROUCH }],
        [0.1, { gl: 0.3, lean: 30, aF: [4, 0], aB: [30, 8], w: 0, lF: [20, 100], lB: [150, 140] }, 'outCubic'],
        [0.4, { gl: 0.3, lean: 30, aF: [4, 0], aB: [30, 8], w: 0, lF: [20, 100], lB: [150, 140] }],
        [0.72, L_EASE],
      ],
      vel: [[0.06, 0.24, 420]],
      hits: [{ t: 0.1, d: 0.16, box: [-4, -36, 60, 26], dmg: 2.2, kb: [300, -200], stun: 0.7, hs: 8, heavy: true, launch: true, finisher: true, src: 'heavy' }],
      ev: [
        [0.04, p => { p.vy = -200; Sound.play('jump', { x: p.x }); }],
        [0.1, p => {
          Sound.play('thrust', { x: p.x, pitch: 0.8 }); Sound.play('splash', { x: p.x });
          lanThrustFx(p, { len: 60, w: 5 });
          lanDragon(p, { x: p.x + p.face * 20, y: p.y - 22, vx: p.face * 380, life: 0.8, dmg: 1.2, r: 18, amp: 8, src: 'heavy' });
        }],
      ],
    },
    // ---------------- delayed branch: 挑枪 → 穿云刺 ----------------
    atkB1: {
      label: '派生·挑枪', dur: 0.42, cancel: 0.28,
      keys: [[0, { ...L_UP0, ...L_CROUCH }], [0.06, { ...L_UP1, gl: 0.6, lean: -10 }, 'outCubic'], [0.42, { lean: 0, aF: [-50, -70], aB: [-40, -60], w: -65 }]],
      hits: [{ t: 0.05, d: 0.09, box: [0, -58, 46, 58], dmg: 1.0, kb: [30, -400], stun: 0.65, hs: 4, launch: true }],
      vel: [[0.02, 0.1, 80]],
      ev: [[0.05, p => { Sound.play('slashHeavy', { x: p.x, pitch: 1.3 }); hSlash(p, { x: 6, y: -24, r: 30, a0: 80, a1: -110, th: 7, sy: 1.1, c: LAN_C }); }]],
      next: 'atkB2',
    },
    atkB2: {
      label: '派生·穿云刺', dur: 0.56, cancel: 0.42, grav: 0,
      keys: [
        [0, { ...L_AIR, ...L_BACK, lean: -10 }], [0.14, { ...L_AIR, lean: -14, aF: [-40, -50], aB: [-20, -30], w: -45 }],
        [0.22, { ...L_AIR, ...L_DIVE }, 'outCubic'], [0.56, { lean: 12, aF: [40, 30], aB: [60, 40], w: 30 }],
      ],
      ev: [
        [0.02, p => { p.vy = -360; p.vx = p.face * 80; Sound.play('jump', { x: p.x, pitch: 1.1 }); }],
        [0.2, p => { p.vy = 380; p.vx = p.face * 300; Sound.play('thrust', { x: p.x, pitch: 0.9 }); lanBeam(p, p.x + p.face * 8, p.y - 18, 40, 46, 3, LAN_C, 0.16); }],
      ],
      update(p, mv) {
        if (mv.t < 0.2) p.vy *= 0.9;
        if (mv.t > 0.2 && p.onGround && !mv.landed) { mv.landed = true; p.vx = 0; FX.shock(p.x + p.face * 12, p.y, LAN_C, 36); lanSplash(p.x + p.face * 16, p.y - 2, 10); Sound.play('splash', { x: p.x }); }
      },
      hits: [{ t: 0.2, d: 0.16, box: [0, -40, 48, 48], dmg: 1.8, kb: [180, 300], stun: 0.6, hs: 6, heavy: true, finisher: true, src: 'heavy' }],
    },
    // ---------------- directional / special ----------------
    low: {
      label: '扫腿枪', dur: 0.42, cancel: 0.28,
      keys: [[0, { lean: 22, aF: [120, 150], aB: [110, 140], w: 160, ...L_CROUCH }], [0.07, { lean: 30, aF: [40, 60], aB: [60, 70], w: 30, lF: [12, 118], lB: [162, 96] }, 'outCubic'], [0.42, { lean: 16, aF: [50, 30], aB: [60, 40], w: 20, lF: [40, 110], lB: [140, 96] }]],
      hits: [{ t: 0.06, d: 0.07, box: [-6, -16, 58, 18], dmg: 1.0, kb: [60, -260], stun: 0.65, hs: 4, launch: true }],
      vel: [[0.02, 0.1, 120]],
      ev: [[0.05, p => { Sound.play('swoosh', { x: p.x, pitch: 0.7 }); hSlash(p, { x: 4, y: -8, r: 34, a0: -170, a1: 30, th: 5, sy: 0.28, c: LAN_C }); FX.dust(p.x + p.face * 24, p.y, 6, p.face); }]],
    },
    rise: {
      label: '挑天', dur: 0.46, cancel: 0.32,
      keys: [[0, L_UP0], [0.07, L_UP1, 'outCubic'], [0.46, L_UPE]],
      hits: [{ t: 0.05, d: 0.12, box: [-4, -64, 40, 66], dmg: 1.15, kb: [30, -430], stun: 0.7, hs: 4, launch: true }],
      ev: [[0.05, p => {
        p.vy = -380; Sound.play('slashHeavy', { x: p.x, pitch: 1.2 });
        hSlash(p, { x: 4, y: -26, r: 30, a0: 70, a1: -120, th: 7, sy: 1.15, c: LAN_C });
        lanBeam(p, p.x + p.face * 6, p.y - 30, -72, 34, 2, '#ffffff', 0.12);
      }]],
    },
    dashAtk: {
      label: '飞枪突', dur: 0.38, cancel: 0.25, grav: 0,
      keys: [[0, { ...L_BACK, lean: 30 }], [0.05, { ...L_THRUST, lean: 38 }, 'outCubic'], [0.38, { ...L_EASE, lean: 16 }]],
      vel: [[0, 0.15, 520, 0]],
      hits: [{ t: 0.03, d: 0.13, box: [0, -32, 60, 20], dmg: 1.35, kb: [220, -80], stun: 0.45, hs: 4 }],
      ev: [[0.03, p => { Sound.play('thrust', { x: p.x, pitch: 0.9 }); lanThrustFx(p, { len: 56, w: 4 }); }]],
    },
    charge1: {
      label: '蓄力·破甲刺', dur: 0.52, cancel: 0.38, grav: 0, noAtkSpeed: true,
      keys: [[0, { ...L_BACK, lean: 20, ...L_CROUCH }], [0.06, { ...L_THRUST, lean: 40 }, 'outCubic'], [0.52, { ...L_EASE, lean: 14 }]],
      onStart(p) { p.inv = Math.max(p.inv, 0.18); },
      vel: [[0.03, 0.14, 600, 0]],
      hits: [{ t: 0.04, d: 0.12, box: [-10, -34, 84, 24], dmg: 2.5, kb: [300, -120], stun: 0.7, hs: 8, heavy: true, finisher: true, breakGuard: true, src: 'charge' }],
      ev: [[0.04, p => {
        Sound.play('thrust', { x: p.x, pitch: 0.7 }); Sound.play('slashHeavy', { x: p.x, pitch: 0.8 });
        lanThrustFx(p, { len: 90, w: 6 });
        lanNeedle(p, { dmg: 1.0, sp: 720, len: 34, r: 3, life: 0.45, src: 'charge', pierce: 9 });
        Cam.shake(0.3);
      }]],
    },
    charge2: {
      label: '极·百步穿杨', dur: 0.9, cancel: 0.7, grav: 0, noAtkSpeed: true,
      keys: [[0, { ...L_BACK, lean: 24, ...L_CROUCH }], [0.3, { ...L_BACK, lean: 28, ...L_CROUCH }], [0.36, { ...L_THRUST, lean: 42 }, 'outCubic'], [0.9, { ...L_EASE, lean: 14 }]],
      onStart(p) { p.inv = Math.max(p.inv, 0.6); p.armorT = 0.4; p.vx = 0; Sound.play('ultCharge'); },
      update(p, mv) {
        if (mv.t > 0.3) return;
        const a = rand(0, TAU), r = rand(18, 34);
        FX.add({ k: 'px', x: p.x + Math.cos(a) * r, y: p.cy + Math.sin(a) * r, vx: -Math.cos(a) * r * 4, vy: -Math.sin(a) * r * 4, life: 0.22, s: 1.5, c: pick([LAN_C, LAN_FOAM]), glow: true, add: true });
        Light.add(p.x, p.cy, 60 + mv.t * 100, LAN_C, 0.8);
      },
      ev: [[0.36, p => {
        // a spear of light across the screen, carrying a dragon behind it
        const f = p.face, y = p.y - 22, x0 = p.x + f * 12, len = 300, lo = f > 0 ? x0 : x0 - len;
        for (const e of enemiesInRect(lo, y - 12, len, 24)) hitEnemy(p, e, p.makeHit({ dmg: 2.4, kx: 260, ky: -160, stun: 0.8, hs: 6, heavy: true, launch: true, dir: f, src: 'charge', finisher: true }));
        FX.add({ k: 'beam', x: lo, y, len, w: 6, ang: 0, c: LAN_C, life: 0.3 });
        FX.add({ k: 'beam', x: lo, y, len, w: 1.5, ang: 0, c: '#ffffff', life: 0.4 });
        FX.screenFlash(LAN_FOAM, 0.4, 0.2); Cam.shake(0.5); G.hitstop(6);
        Sound.play('ultBoom'); Sound.play('thrust', { x: p.x, pitch: 0.6 });
        lanDragon(p, { x: x0, y, vx: f * 460, life: 0.75, dmg: 1.4, r: 22, size: 1.3, amp: 12, src: 'charge' });
      }]],
    },
    counter: {
      label: '见切·回马枪', dur: 0.5, cancel: 0.32, grav: 0, noAtkSpeed: true, counter: true,
      keys: [[0, { ...L_SWEEP0, lean: 20 }], [0.06, { ...L_THRUST, lean: 34 }, 'outCubic'], [0.5, { ...L_EASE, lean: 12 }]],
      onStart(p) { teleportBehind(p, 190); p.inv = Math.max(p.inv, 0.45); },
      hits: [{ t: 0.05, d: 0.09, box: [-6, -40, 64, 34], dmg: 2.9, kb: [80, -330], stun: 0.8, hs: 10, heavy: true, launch: true, critBonus: 1, src: 'counter', finisher: true }],
      ev: [[0.05, p => {
        Sound.play('thrust', { x: p.x, pitch: 0.8 }); Sound.play('crit', { x: p.x });
        lanThrustFx(p, { len: 64, w: 5, c: '#ffffff' });
        hSlash(p, { x: 6, y: -22, r: 34, a0: -160, a1: 20, th: 8, c: LAN_C });
        FX.screenFlash('#ffffff', 0.35, 0.15);
      }]],
      next: 'counter2',
    },
    // ---------------- air ----------------
    aatk1: {
      label: '空·点枪', dur: 0.26, cancel: 0.16, air: true, grav: 0.12,
      keys: [[0, { ...L_AIR, ...L_BACK, lean: 4 }], [0.05, { ...L_AIR, lean: 16, aF: [4, 0], aB: [30, 8], w: 0 }, 'outCubic'], [0.26, { ...L_AIR, ...L_EASE }]],
      hits: [{ t: 0.05, d: 0.07, box: [4, -30, 50, 16], dmg: 0.9, kb: [50, -150], stun: 0.42, hs: 3 }],
      ev: [[0.04, p => { Sound.play('thrust', { x: p.x, pitch: 1.1 }); lanThrustFx(p, { len: 40 }); }]],
      next: 'aatk2',
    },
    aatk2: {
      label: '空·扫枪', dur: 0.3, cancel: 0.18, air: true, grav: 0.12,
      keys: [[0, { ...L_AIR, ...L_SWEEP0 }], [0.06, { ...L_AIR, lean: 14, aF: [20, 10], aB: [50, 30], w: 15 }, 'outCubic'], [0.3, { ...L_AIR, lean: 8, aF: [40, 20], w: 20 }]],
      hits: [{ t: 0.06, d: 0.07, box: [-10, -46, 54, 46], dmg: 1.0, kb: [60, -170], stun: 0.42, hs: 3 }],
      ev: [[0.05, p => { Sound.play('swoosh', { x: p.x, pitch: 1.0 }); hSlash(p, { x: 2, y: -24, r: 30, a0: -150, a1: 50, th: 6, sy: 0.7, c: LAN_C }); }]],
      next: 'aatk3',
    },
    aatk3: {
      label: '空·坠枪', dur: 0.44, cancel: 0.32, air: true, grav: 0.3,
      keys: [[0, { ...L_AIR, lean: -12, aF: [-40, -60], aB: [-20, -40], w: -50 }], [0.08, { ...L_AIR, ...L_DIVE, lean: 34 }, 'outCubic'], [0.44, { ...L_AIR, lean: 20, aF: [45, 40], w: 40 }]],
      hits: [{ t: 0.07, d: 0.08, box: [0, -30, 50, 50], dmg: 1.6, kb: [160, 380], stun: 0.5, hs: 6, heavy: true, finisher: true, src: 'heavy' }],
      ev: [[0.06, p => { p.vy = Math.min(p.vy, -60); Sound.play('thrust', { x: p.x, pitch: 0.9 }); lanThrustFx(p, { deg: 45, len: 46 }); }]],
    },
    airRise: {
      label: '空·升枪', dur: 0.4, cancel: 0.27, air: true, grav: 1,
      keys: [[0, { ...L_AIR, lean: 12, aF: [90, 130], aB: [90, 120], w: 140 }], [0.06, { ...L_AIR, lean: -8, aF: [-75, -90], aB: [-60, -80], w: -85 }, 'outCubic'], [0.4, { ...L_AIR, aF: [-50, -70], w: -65 }]],
      hits: [{ t: 0.04, d: 0.12, box: [-6, -66, 48, 68], dmg: 1.0, kb: [30, -400], stun: 0.6, hs: 3, launch: true }],
      ev: [[0.04, p => { p.vy = -340; Sound.play('slash', { x: p.x, pitch: 1.3 }); hSlash(p, { x: 4, y: -26, r: 30, a0: 80, a1: -120, th: 7, sy: 1.1, c: LAN_C }); }]],
    },
    plunge: plungeMove({
      label: '坠枪', fallDmg: 0.85,
      keys: [
        [0, { gl: 0, lean: 0, aF: [-60, -90], aB: [-80, -95], w: -90, lF: [60, 110], lB: [110, 140] }],
        [0.1, { gl: 0, lean: 6, aF: [70, 88], aB: [80, 92], w: 90, lF: [70, 100], lB: [100, 110] }, 'outCubic'],
        [0.3, { gl: 0, lean: 6, aF: [70, 88], aB: [80, 92], w: 90, lF: [70, 100], lB: [100, 110] }],
      ],
    }),
    plungeLand: plungeLand({
      r: 46, dmg: 1.8,
      keys: [[0, { lean: 26, ...L_PLANT, lF: [30, 130], lB: [150, 100] }], [0.34, { lean: 10, aF: [40, 20], aB: [60, 30], w: 20 }]],
    }),

    // =============== 秘技 ===============
    sk_hundred: {
      label: '百鸟朝凤', dur: 0.9, cancel: 0.8, skill: 'lan_hundred',
      keys: [
        ...altKeys(10, 0.055, { ...L_THRUST, lean: 22 }, { ...L_BACK, lean: 16, aF: [60, 120] }),
        [0.62, { ...L_BACK, lean: 18 }], [0.68, { ...L_THRUST, lean: 40 }, 'outCubic'], [0.9, { ...L_EASE, lean: 14 }],
      ],
      vel: [[0, 0.6, 40], [0.66, 0.74, 240]],
      onStart(p, mv) { mv.box = p.hitbox([4, -38, 58, 30], { dmg: 0.3, kx: 40, ky: -20, stun: 0.3, hs: 1, src: 'skill', energy: 0.5 }, 0.6, { multi: p.skillLv('lan_hundred') >= 2 ? 0.045 : 0.065 }); },
      update(p, mv) {
        if (mv.t >= 0.6 || Math.random() > 0.8) return;
        const y = p.y - rand(12, 34), a = rand(-12, 12);
        lanBeam(p, p.x + p.face * 10, y, a, rand(36, 58), 1.5, Math.random() < 0.5 ? '#ffffff' : LAN_C, 0.07);
        if (Math.random() < 0.3) Sound.play('thrust', { x: p.x, pitch: rand(1.1, 1.5) });
      },
      hits: [{ t: 0.68, d: 0.08, box: [0, -40, 68, 32], dmg: 1.6, kb: [300, -120], stun: 0.6, hs: 6, heavy: true }],
      ev: [[0.68, p => {
        Sound.play('slashHeavy', { x: p.x, pitch: 0.9 }); lanThrustFx(p, { len: 72, w: 6 });
        // 进化: the last thrust sends three phoenix needles flying
        if (p.skillLv('lan_hundred') >= 3) for (const a of [-16, 0, 16]) lanNeedle(p, { ang: a, dmg: 0.9, src: 'skill', skill: 'lan_hundred', pierce: 6, life: 0.5, len: 30, c: '#ffd36a' });
      }]],
      onEnd(p, mv) { if (mv.box) mv.box.life = 0; },
    },
    sk_tide: {
      label: '镇海', dur: 0.6, cancel: 0.5, skill: 'lan_tide', noAtkSpeed: true,
      keys: [[0, L_RAISE], [0.12, { ...L_PLANT, ...L_CROUCH }, 'outCubic'], [0.6, L_PLANT]],
      onStart(p) { p.vx = 0; },
      ev: [[0.12, p => {
        const lv = p.skillLv('lan_tide'), R = lv >= 3 ? 74 : 60;
        Sound.play('splash', { x: p.x, pitch: 0.7 }); Sound.play('shield', { x: p.x }); FX.shock(p.x, p.y, LAN_C, R);
        if (p.counters.tide && p.counters.tide.life > 0) p.counters.tide.life = 0;
        p.counters.tide = addZone({
          x: p.x, y: p.cy, life: lv >= 3 ? 3.2 : 2.4, tick: 0.3, tide: true, R,
          onTick(z) {
            for (const e of enemiesNear(z.x, z.y, R)) {
              hitEnemy(p, e, p.makeHit({ dmg: 0.35, kx: 0, ky: 0, stun: 0.15, hs: 0, dir: sign(e.x - z.x) || 1, src: 'skill', skill: 'lan_tide', sfx: false, energy: 0.3, fxc: LAN_C }));
              applyStatus(e, 'slow', 0.5, 0.6);
            }
          },
          upd(z) {
            // enemy projectiles that reach the dome are washed away
            for (const pr of G.projs) if (pr.team === 'e' && !pr.dead && dist(pr.x, pr.y, z.x, z.y) < R) { pr.dead = true; FX.burst(pr.x, pr.y, { n: 5, c: [LAN_C, LAN_FOAM], sp: [30, 90], glow: true }); }
            if (Math.random() < 0.5) FX.add({ k: 'px', x: z.x + rand(-R, R) * 0.8, y: z.y + rand(0, R * 0.4), vx: 0, vy: -rand(20, 50), life: 0.6, s: 1.5, c: pick([LAN_C, LAN_FOAM]), glow: true, shrink: true });
            Light.add(z.x, z.y, R * 2, LAN_C, 0.5);
          },
          drawFn(ctx, gctx, x2, y2, z) {
            const a = Math.min(1, z.life * 3, z.t * 8), wob = Math.sin(z.t * 5) * 1.5;
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.12 * a; ctx.fillStyle = LAN_C; ctx.beginPath(); ctx.ellipse(x2, y2, R, R * 0.8 + wob, 0, Math.PI, TAU); ctx.fill();
            ctx.globalAlpha = 0.7 * a; ctx.strokeStyle = LAN_C; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(x2, y2, R, R * 0.8 + wob, 0, Math.PI, TAU); ctx.stroke();
            ctx.globalAlpha = 0.4 * a; ctx.strokeStyle = LAN_FOAM; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x2, y2, R - 4, R * 0.8 - 4 + wob, 0, Math.PI * 1.15, Math.PI * 1.45); ctx.stroke();
            ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
            gctx.globalAlpha = 0.25 * a; gctx.fillStyle = LAN_C; gctx.beginPath(); gctx.ellipse(x2, y2, R, R * 0.8, 0, Math.PI, TAU); gctx.fill(); gctx.globalAlpha = 1;
          },
        });
      }]],
    },
    sk_pierce: {
      label: '破阵', dur: 0.62, cancel: 0.5, grav: 0, skill: 'lan_pierce', noAtkSpeed: true,
      keys: [[0, { ...L_BACK, lean: 30, ...L_CROUCH }], [0.06, { ...L_THRUST, lean: 40 }, 'outCubic'], [0.42, { ...L_THRUST, lean: 36 }], [0.5, { lean: 4, aF: [-40, -60], aB: [-30, -40], w: -60 }, 'outCubic'], [0.62, L_EASE]],
      vel: [[0.04, 0.42, 480, 0]],
      onStart(p, mv) { p.armorT = 0.5; mv.held = []; Sound.play('dash', { x: p.x, pitch: 0.8 }); },
      update(p, mv) {
        if (mv.t < 0.04 || mv.t >= 0.42) return;
        // skewer: foes in front ride the spear tip until the fling
        for (const e of enemiesInRect(p.face > 0 ? p.x + 6 : p.x - 50, p.y - 36, 44, 30)) {
          if (e.boss || mv.held.includes(e) || mv.held.length >= 6) continue;
          mv.held.push(e);
          hitEnemy(p, e, p.makeHit({ dmg: 0.6, kx: 0, ky: 0, stun: 0.9, hs: 1, dir: p.face, src: 'skill' }));
        }
        mv.held.forEach((e, i) => { if (e.dead) return; e.x = clamp(p.x + p.face * (34 + i * 6), 2.5 * TILE, G.room.pw - 2.5 * TILE); e.vx = p.vx; e.vy = 0; });
        if (Math.random() < 0.8) FX.add({ k: 'streak', x: p.x + p.face * rand(0, 30), y: p.y - rand(10, 34), vx: p.face * 900, vy: 0, life: 0.1, c: pick([LAN_C, '#ffffff']), len: 0.03, w: 1 });
      },
      hits: [{ t: 0.05, d: 0.36, box: [0, -36, 52, 30], dmg: 0.9, kb: [120, -40], stun: 0.4, hs: 2 }],
      ev: [[0.46, (p, mv) => {
        const lv = p.skillLv('lan_pierce');
        for (const e of mv.held) if (!e.dead) hitEnemy(p, e, p.makeHit({ dmg: 2.0, kx: 260, ky: -340, launch: true, stun: 0.8, hs: 4, heavy: true, dir: p.face, src: 'skill' }));
        hSlash(p, { x: 6, y: -26, r: 32, a0: 60, a1: -120, th: 8, c: LAN_C });
        Sound.play('slashHeavy', { x: p.x, pitch: 0.8 }); Cam.shake(0.35);
        // 进化: the fling bursts into a water column where the spear points
        if (lv >= 3) lanGeyser(p, p.x + p.face * 40, 1.6, { h: 72, w: 24, skill: 'lan_pierce', src: 'skill' });
      }]],
    },
    sk_jiao: {
      label: '蛟龙出海', dur: 0.5, cancel: 0.36, skill: 'lan_jiao',
      keys: [[0, L_RAISE], [0.1, { ...L_SMASH, lean: 30 }, 'outCubic'], [0.5, { lean: 10, aF: [40, 20], aB: [60, 30], w: 20 }]],
      ev: [[0.1, p => {
        const lv = p.skillLv('lan_jiao'), f = p.face;
        Sound.play('splash', { x: p.x, pitch: 0.8 }); Sound.play('roar', { x: p.x, pitch: 1.7 });
        FX.shock(p.x + f * 24, p.y, LAN_C, 40);
        const mk = d => lanDragon(p, { x: p.x + d * 20, y: p.y - 12, vx: d * (lv >= 2 ? 300 : 240), life: lv >= 2 ? 1.4 : 1.1, dmg: 0.9, r: 20, size: 1.2, amp: 6, ground: true, src: 'skill', rehit: 0.3, skill: 'lan_jiao' });
        p.counters.jiao = [mk(f)];
        if (lv >= 3) p.counters.jiao.push(mk(-f));
      }]],
    },
    sk_vault: {
      label: '凌霄', dur: 0.7, cancel: 0.56, grav: 0, skill: 'lan_vault', noAtkSpeed: true,
      keys: [
        [0, { ...L_RAISE, ...L_CROUCH }], [0.08, { ...L_PLANT, ...L_CROUCH }, 'outCubic'],
        ...altKeys(5, 0.08, { ...L_AIR, ...L_SPIN_A }, { ...L_AIR, ...L_SPIN_B }).map(([t, k, e]) => [t + 0.16, k, e]),
        [0.7, { ...L_AIR, ...L_UPE }],
      ],
      onStart(p) { p.inv = Math.max(p.inv, 0.6); p.vx = 0; p.vy = 0; },
      ev: [[0.1, p => {
        const H = p.skillLv('lan_vault') >= 2 ? 120 : 90, x = p.x, gy = p.y;
        Sound.play('stomp', { x }); Sound.play('swoosh', { x, pitch: 0.5 });
        // a cyclone rises from where the spear was planted
        addZone({
          x, y: gy, life: 0.62, tick: 0.1,
          onTick(z) { for (const e of enemiesInRect(z.x - 26, z.y - H, 52, H)) hitEnemy(p, e, p.makeHit({ dmg: 0.45, kx: 0, ky: -320, launch: true, stun: 0.5, hs: 1, dir: sign(e.x - z.x) || 1, src: 'skill', skill: 'lan_vault', energy: 0.4, fxc: LAN_C })); },
          upd(z, dt) {
            for (const e of enemiesNear(z.x, z.y - H / 2, H * 0.7)) if (!e.boss) e.vx += (z.x - e.x) * 5 * dt;
            for (let i = 0; i < 3; i++) { const a = z.t * 18 + i * 2.1, hh = (z.t * 160 + i * 30) % H; FX.add({ k: 'px', x: z.x + Math.cos(a) * (6 + hh * 0.18), y: z.y - hh, vx: 0, vy: -90, life: 0.22, s: 2, c: pick([LAN_C, LAN_FOAM, '#ffffff']), glow: true, add: true }); }
            Light.add(z.x, z.y - H / 2, H, LAN_C, 0.6);
          },
        });
        p.vy = -470;
      }]],
      update(p, mv) { if (mv.t > 0.1 && mv.t < 0.56) p.vy *= 0.94; },
    },
    sk_rainbow: {
      label: '长虹贯日', dur: 0.56, cancel: 0.42, skill: 'lan_rainbow',
      keys: [[0, { ...L_BACK, ...L_CROUCH, w: -60 }], [0.08, { lean: -14, aF: [-80, -95], aB: [-60, -80], w: -90 }, 'outCubic'], [0.56, L_UPE]],
      ev: [[0.08, p => {
        const lv = p.skillLv('lan_rainbow'), n = lv >= 3 ? 12 : 8, f = p.face, x0 = p.x;
        FX.add({ k: 'beam', x: p.x + f * 4, y: p.y - 30, len: 220, w: 4, ang: -Math.PI / 2, c: LAN_C, life: 0.25 });
        Sound.play('thrust', { x: p.x, pitch: 0.7 }); Sound.play('charge', { x: p.x, pitch: 1.6 });
        for (let i = 0; i < n; i++) later(0.3 + i * 0.05, () => {
          const x = x0 + f * (30 + i * (190 / n)) + rand(-8, 8), gy = G.room.floorBelow(x, p.y - 40);
          if (Math.abs(gy - p.y) > 120) return;
          G.projs.push(new Proj({
            team: 'p', x, y: gy - 180, vx: 0, vy: 660, kind: 'bullet', r: 2.2, len: 26, c: LAN_C, c2: '#ffffff', life: 0.4, pierce: 9, ghost: true, light: 40,
            hit: p.makeHit({ dmg: 0.9, kx: 0, ky: -160, stun: 0.4, hs: 1, src: 'skill', skill: 'lan_rainbow', fxc: LAN_C }),
            upd(q) {
              if (q.y < gy - 4 || q.stuck) return;
              q.stuck = true; q.life = 0;
              // the spear of light stays planted until it fades (虹落 can set them off)
              addZone({ x, y: gy, life: 3, rainbow: true, drawFn(ctx, gctx, x2, y2, z) {
                const a = Math.min(1, z.life * 2);
                ctx.globalAlpha = a; ctx.fillStyle = LAN_C; ctx.fillRect(Math.round(x2) - 1, Math.round(y2) - 16, 2, 16);
                ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x2), Math.round(y2) - 16, 1, 6); ctx.globalAlpha = 1;
                gctx.globalAlpha = 0.4 * a; gctx.fillStyle = LAN_C; gctx.fillRect(Math.round(x2) - 3, Math.round(y2) - 18, 6, 18); gctx.globalAlpha = 1;
              } });
              FX.burst(x, gy - 2, { n: 5, c: [LAN_C, '#ffffff'], sp: [30, 90], ang: -Math.PI / 2, spread: 1, life: [0.15, 0.3], glow: true });
            },
          }));
          if (i % 3 === 0) Sound.play('thrust', { x, pitch: 1.4 });
        });
      }]],
    },
    sk_dive: {
      label: '游龙', dur: 0.62, cancel: 0.42, air: true, grav: 0, skill: 'lan_dive', noAtkSpeed: true,
      keys: [[0, { ...L_AIR, ...L_BACK, lean: -6 }], [0.06, { ...L_AIR, ...L_DIVE }, 'outCubic'], [0.62, { ...L_AIR, ...L_DIVE, lean: 30 }]],
      onStart(p, mv) { lanDiveStart(p, mv, p.face * 0.75, 0.66); },
      update(p, mv, dt) { lanDiveUpdate(p, mv, dt); },
      onEnd(p, mv) { if (mv.box) mv.box.life = 0; },
    },
    sk_windmill: {
      label: '风车', dur: 1.4, cancel: 9, air: true, grav: 0.05, steer: 60, skill: 'lan_windmill',
      durFn: p => p.skillLv('lan_windmill') >= 3 ? 1.4 : 1.0,
      keys: altKeys(14, 0.1, { ...L_AIR, ...L_SPIN_A }, { ...L_AIR, ...L_SPIN_B }),
      onStart(p, mv) {
        const big = p.skillLv('lan_windmill') >= 3;
        p.vy = Math.min(p.vy, -40);
        mv.box = p.hitbox(big ? [-44, -50, 88, 54] : [-36, -46, 72, 48], { dmg: 0.38, kx: 0, ky: -60, stun: 0.3, hs: 0, src: 'skill', radial: true, energy: 0.4 }, big ? 1.4 : 1.0, { multi: 0.1 });
      },
      update(p, mv, dt) {
        p.vy *= 0.9;
        mv.ft = (mv.ft || 0) - dt;
        if (mv.ft <= 0) { mv.ft = 0.1; FX.slash(p.x, p.y - 22, { r: 34, a0: -180, a1: 180, th: 4, c: LAN_C, f: (mv.k = -(mv.k || 1)), sy: 0.5, dur: 0.14 }); Sound.play('swoosh', { x: p.x, pitch: rand(0.9, 1.2) }); }
        // the spinning shaft knocks enemy projectiles out of the air
        for (const pr of G.projs) if (pr.team === 'e' && !pr.dead && dist(pr.x, pr.y, p.x, p.cy) < 40) { pr.dead = true; FX.sparks(pr.x, pr.y, rand(0, TAU), '#ffffff', 4, [60, 140], 0.4); }
      },
      onEnd(p, mv) { if (mv.box) mv.box.life = 0; },
    },

    // =============== 奥义 ===============
    ult: {
      label: '苍龙破', dur: 2.1, cancel: 99, ult: true, grav: 0, noAtkSpeed: true,
      keys: [[0, { ...L_BACK, lean: 10, ...L_CROUCH }], [0.5, { ...L_BACK, lean: 16, ...L_CROUCH }], [0.6, { ...L_THRUST, lean: 44 }, 'outCubic'], [1.9, { ...L_THRUST, lean: 40 }], [2.1, { ...L_EASE, lean: 10 }]],
      onStart(p) { p.vx = 0; p.vy = 0; G.cinematic(0.45); Sound.play('ultCharge'); },
      update(p, mv) {
        if (mv.t > 0.55) return;
        const a = rand(0, TAU), r = rand(24, 44);
        FX.add({ k: 'px', x: p.x + Math.cos(a) * r, y: p.cy + Math.sin(a) * r, vx: -Math.cos(a) * r * 3, vy: -Math.sin(a) * r * 3, life: 0.3, s: 2, c: pick([LAN_C, LAN_FOAM, LAN_W]), glow: true, add: true });
        Light.add(p.x, p.cy, 80 + mv.t * 120, LAN_C, 0.9);
      },
      ev: [
        [0.58, p => {
          G.dim = 1.6; FX.screenFlash(LAN_FOAM, 0.5, 0.25); Cam.shake(0.6);
          Sound.play('ultBoom'); Sound.play('roar', { x: p.x, pitch: 0.7 }); Sound.play('splash', { x: p.x, pitch: 0.6 });
          lanThrustFx(p, { len: 120, w: 8 });
          // a giant jade dragon surges across the screen from the spear tip
          lanDragon(p, { x: p.x + p.face * 24, y: p.y - 34, vx: p.face * 520, life: 1.25, dmg: 0.7, r: 34, size: 2.4, amp: 22, freq: 6, segs: 16, src: 'ult', rehit: 0.12, energy: 0, hs: 0 });
        }],
        [1.85, p => {
          // the dragon's roar: everything on screen takes the last blow
          FX.screenFlash('#ffffff', 0.6, 0.3); Sound.play('ultBoom'); Sound.play('roar', { x: p.x, pitch: 0.55 }); Cam.shake(0.8); G.hitstop(10);
          for (const e of liveEnemies().filter(onScreen)) {
            lanSplash(e.x, e.y - 4, 10);
            hitEnemy(p, e, p.makeHit({ dmg: 3.2, kx: 240, ky: -300, stun: 1.0, hs: 0, heavy: true, launch: true, dir: sign(e.x - p.x) || 1, src: 'ult', energy: 0 }));
          }
        }],
      ],
    },
  },
};

// 游龙 / 再游: the shared dive (direction given as facing-scaled x/y fractions of the dive speed);
// hitting a foe bounces Lan back up for the next move
function lanDiveStart(p, mv, fx, fy) {
  const sp = p.skillLv('lan_dive') >= 2 ? 540 : 450;
  p.inv = Math.max(p.inv, 0.3);
  mv.dvx = fx * sp; mv.dvy = fy * sp;
  mv.box = p.hitbox([0, -36, 46, 46], { dmg: 1.5, kx: 120, ky: -200, stun: 0.6, hs: 5, heavy: true, launch: true, src: 'skill' }, 0.5, {
    onHit(e) {
      if (mv.bounced || p.move !== mv) return;
      mv.bounced = true; p.vy = -380; p.vx = -sign(mv.dvx || 1) * 60;
      mv.t = Math.max(mv.t, mv.m.cancel);
      lanSplash(e.x, e.cy, 10); Sound.play('splash', { x: e.x, pitch: 1.2 });
      if (p.skillLv('lan_dive') >= 3) lanGeyser(p, e.x, 1.2, { skill: 'lan_dive', src: 'skill' });
    },
  });
  Sound.play('thrust', { x: p.x, pitch: 0.8 });
}
function lanDiveUpdate(p, mv, dt) {
  if (mv.t < 0.06 || mv.bounced || mv.landed) { if (mv.bounced) p.vy = Math.min(p.vy + GRAV * dt, MAX_FALL); return; }
  p.vx = mv.dvx; p.vy = mv.dvy;
  if (Math.random() < 0.8) FX.add({ k: 'streak', x: p.x + rand(-4, 4), y: p.y - rand(4, 30), vx: -mv.dvx * 0.6, vy: -mv.dvy * 0.6, life: 0.1, c: pick([LAN_C, '#ffffff']), len: 0.03 });
  if (p.onGround) {
    mv.landed = true; p.vx = 0; p.vy = 0;
    if (mv.box) mv.box.life = 0;
    FX.shock(p.x, p.y, LAN_C, 40); lanSplash(p.x + p.face * 10, p.y - 2, 12); Sound.play('splash', { x: p.x });
    pHit(p, [-30, -24, 60, 26], { dmg: 1.0, kx: 160, ky: -260, stun: 0.5, hs: 4, launch: true, radial: true, src: 'skill' });
    mv.t = Math.max(mv.t, p.move.m.cancel);
  }
}
