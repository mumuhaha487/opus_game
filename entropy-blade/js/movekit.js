'use strict';
// =====================================================================
//  MOVE KIT — shared building blocks for 武技 (attack arts), 秘技 派生
//  follow-ups and the alternate ultimates (moves_rin / moves_eve / moves_gao)
// =====================================================================
// an art's damage multiplier at its current level (set per art in WX_LEVELS)
function artMul(p, id) { return p.artPow ? p.artPow(id) : 1; }
// melee box that reports finishers like a regular move hit
function pHit(p, rel, spec, dur = 0.08, o = {}) {
  const hit = p.makeHit(spec);
  return Combat.box(p, 'p', rel, hit, dur, Object.assign({ onHit: e => p.onMeleeHit(e, hit) }, o));
}
// vertical blade / rock / flame column erupting from the ground below x
function groundColumn(p, x, mult, col, o = {}) {
  const gy = G.room.floorBelow(x, p.y - 30);
  if (gy - p.y > 90 || x < 2 * TILE || x > G.room.pw - 2 * TILE) return false;
  const h = o.h || 64, w = o.w || 20;
  if (o.rock) {
    FX.customDraw(x, gy, 0.5, (ctx, gctx, X, Y, t) => {
      const hh = h * (t < 0.12 ? t / 0.12 : 1) * (t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1);
      ctx.fillStyle = '#6a5440'; ctx.beginPath(); ctx.moveTo(X - w / 2, Y); ctx.lineTo(X - 2, Y - hh); ctx.lineTo(X + 3, Y - hh * 0.9); ctx.lineTo(X + w / 2, Y); ctx.fill();
      ctx.fillStyle = '#b89a6a'; ctx.beginPath(); ctx.moveTo(X - 2, Y); ctx.lineTo(X - 2, Y - hh); ctx.lineTo(X + 3, Y - hh * 0.9); ctx.lineTo(X + 4, Y); ctx.fill();
      gctx.fillStyle = col; gctx.globalAlpha = 0.4; gctx.fillRect(X - w / 2, Y - 4, w, 4); gctx.globalAlpha = 1;
    }, 0);
    FX.debris(x, gy - 2, ['#7a6448', '#b89a6a', col], 5);
    Sound.play('stomp', { x, pitch: 1.4 + rand(0, 0.3) });
  } else {
    FX.add({ k: 'beam', x, y: gy, len: h, w: o.bw || 6, ang: -Math.PI / 2, c: col, life: 0.3 });
    FX.add({ k: 'beam', x, y: gy, len: h * 0.8, w: 1.5, ang: -Math.PI / 2, c: '#ffffff', life: 0.35 });
    FX.burst(x, gy - 4, { n: 8, c: o.burst || [col, '#ffffff'], sp: [40, 160], ang: -Math.PI / 2, spread: 0.6, life: [0.3, 0.6], glow: true });
    Sound.play(o.sound || 'slash', { x, pitch: 1.3 + rand(0, 0.3) });
  }
  Light.add(x, gy - h / 2, h * 1.4, col, 0.8);
  for (const e of enemiesInRect(x - w / 2, gy - h, w, h)) hitEnemy(p, e, p.makeHit({ dmg: mult, kx: 30, ky: o.ky || -340, launch: true, stun: 0.6, hs: 2, dir: p.face, src: o.src || 'light', art: o.art, skill: o.skill, uskill: o.uskill, fxc: col, status: o.status }));
  return true;
}
// lightning bolt from the sky onto an enemy (or a point)
function skyBolt(p, x, y, mult, col, o = {}) {
  FX.bolt(x + rand(-8, 8), y - 140, x, y, col, 0.22, o.w || 2, 9);
  FX.bolt(x + rand(-8, 8), y - 140, x, y, '#ffffff', 0.14, 1, 7);
  FX.flash(x, y, 14, '#ffffff', 0.12);
  Light.add(x, y, 90, col, 1);
  Sound.play('zap', { x, pitch: rand(0.9, 1.2) });
  for (const e of enemiesNear(x, y, o.r || 18)) hitEnemy(p, e, p.makeHit({ dmg: mult, kx: 20, ky: -160, stun: o.stun || 0.5, hs: 2, dir: sign(e.x - p.x) || 1, src: o.src || 'light', art: o.art, skill: o.skill, uskill: o.uskill, fxc: col, sfx: false }));
}
// whirlwind zone that pulls enemies in and keeps cutting
function windZone(p, x, y, life, r, mult, col, o = {}) {
  const wx = p.moveWx(p.move && p.move.m, o);
  return addZone({
    x, y, life, tick: o.tick || 0.2, wind: true,
    onTick(z) { for (const e of enemiesNear(z.x, z.y, r)) hitEnemy(p, e, p.makeHit({ dmg: mult, kx: 0, ky: -60, stun: 0.25, hs: 0, dir: sign(e.x - z.x) || 1, src: o.src || 'light', wx, sfx: false, energy: 0.3, fxc: col })); },
    upd(z, dt) {
      if (o.follow) { z.x = lerp(z.x, p.x, dt * 5); z.y = lerp(z.y, p.cy, dt * 5); }
      for (const e of enemiesNear(z.x, z.y, r * 1.8)) if (!e.boss) { e.vx += (z.x - e.x) * (o.pull || 4) * dt; if (e.flying) e.vy += (z.y - e.cy) * 3 * dt; }
      for (let i = 0; i < 3; i++) {
        const a = z.t * 14 + i * 2.1, rr = 6 + (z.t * 60 + i * 17) % r;
        FX.add({ k: 'px', x: z.x + Math.cos(a) * rr, y: z.y + Math.sin(a) * rr * 0.45 - rr * 0.5, vx: 0, vy: -40, life: 0.25, s: 1.5, c: pick(o.cols || [col, '#ffffff']), glow: true, add: true });
      }
      Light.add(z.x, z.y, r * 2, col, 0.5);
    },
  });
}
// plunge-style move: optional hop, dive (holding the dive pose until touchdown), landing callback
function diveMove(o) {
  const hold = o.hold || 0.3, diveAt = o.diveAt || 0.1;
  const m = {
    label: o.label, dur: o.dur || 0.7, cancel: o.cancel || 0.56, air: true, grav: 0, noAtkSpeed: true, armor: o.armor, art: o.art, skill: o.skill, isFollow: o.isFollow,
    keys: o.keys, hits: o.hits, ev: o.ev, next: o.next, nextLv: o.nextLv,
    onStart(p, mv) { p.vy = o.hop !== undefined ? o.hop : -140; p.vx = 0; if (o.inv) p.inv = Math.max(p.inv, o.inv); if (o.start) o.start(p, mv); },
    update(p, mv, dt) {
      if (mv.landed) { if (o.after) o.after(p, mv, dt); return; }
      if (mv.t < diveAt) { p.vy *= 0.88; return; }
      if (!mv.diving) {
        mv.diving = true;
        if (o.fallDmg) mv.box = pHit(p, o.fallBox || [-12, -40, 36, 46], { dmg: o.fallDmg, kx: 60, ky: 300, stun: 0.4, hs: 1, src: 'heavy' }, 3, { multi: 0.2 });
        if (o.onDive) o.onDive(p, mv);
        Sound.play('dash', { x: p.x, pitch: 0.7 });
      }
      p.vx = p.face * (o.vx || 0); p.vy = o.fall || 620;
      if (Math.random() < 0.8) FX.add({ k: 'streak', x: p.x + rand(-6, 6), y: p.y - rand(0, 30), vx: -p.vx * 0.3, vy: -500, life: 0.12, c: o.col || p.hero.color, len: 0.03 });
      mv.air = (mv.air || 0) + dt;
      if ((p.onGround && mv.air > 0.02) || mv.air > 1.6) {
        mv.landed = true; p.vx = 0; p.vy = 0;
        if (mv.box) { mv.box.life = 0; mv.box = null; }
        mv.t = Math.max(mv.t, hold);
        o.onLand(p, mv);
        p.fire('onPlunge');
      } else if (mv.t > hold) mv.t = hold;
    },
    onEnd(p, mv) { if (mv.box) mv.box.life = 0; },
  };
  return m;
}
// generic landing impact used by most dives
function landImpact(p, r, mult, col, o = {}) {
  pHit(p, [-r, -30, r * 2, 32], { dmg: mult, kx: 220, ky: o.ky || -280, stun: 0.6, hs: o.hs || 7, heavy: true, launch: true, radial: true, src: o.src || 'heavy', finisher: o.finisher !== false, skill: o.skill, art: o.art, status: o.status });
  FX.shock(p.x, p.y, col, r + 10);
  FX.ring(p.x, p.y - 4, 4, r + 16, col, 0.3, 4, 0.35);
  FX.debris(p.x, p.y - 2, [col, '#c8b8a0', '#ffffff'], 10);
  Sound.play('stomp', { x: p.x });
  Cam.shake(o.shake || 0.45);
}
function petalPuff(x, y, n = 14, cols = ['#ffb7d0', '#ffffff', '#ff7aa0']) {
  FX.burst(x, y, { n, c: cols, sp: [40, 180], g: 90, life: [0.4, 0.9], s: [1, 2] });
}
// afterimage that detonates (影踏 / 幻影)
function ghostBomb(p, x, y, delay, r, mult, col, o = {}) {
  const fr = p.frame(), f = p.face, wx = p.moveWx(p.move && p.move.m, o);
  addZone({
    x, y, life: delay,
    drawFn(ctx, gctx, x2, y2, z) { drawFrame(ctx, fr, p.spr.ox, p.spr.oy, x2, y2, f < 0, { tint: col, alpha: 0.45 + 0.35 * Math.sin(z.t * 30) }); },
    onEnd() { explodeP(x, y - 16, r, mult, { c: col, src: o.src || 'light', shake: 0.3, sound: 'void', pitch: 1.4, noProc: false, status: o.status, wx }); },
  });
}
