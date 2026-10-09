'use strict';
// =====================================================================
//  技能 (U) MOVES — U / ↑U / ↓U / 冲刺U for every hero, three stages each
//  (which level opens which stage is set per skill in WX_LEVELS, arts.js).
//  Stage moves reuse existing animations (anim:) and the shared move kit.
//  Hits made while a stage runs pick up its level scaling from the move;
//  anything that lands later passes `uskill` explicitly.
// =====================================================================
const uDmg = (p, id) => p.uPow(id);                       // for blasts that bypass makeHit
// does this 技能 have that signature effect yet?
const uHas = (p, id, key) => (p.wxPerksOf({ fam: 'u', id }) || []).includes(WX_PERKS[key]);
const uStage = (id, stage, o) => Object.assign({ uskill: id, ustage: stage, noAtkSpeed: true, grav: 0.3 }, o);
// upward hop of a rising stage: full from the ground, once per airtime in the air
// (技能 have no cooldown, so an unlimited air lift would mean flying)
const uLift = (p, ground, air) => {
  if (p.onGround) p.vy = ground;
  else if (!(p.uLifts > 0)) { p.uLifts = 1; p.vy = Math.min(p.vy, air); }
};
// ground height under x (falls back to the caster's feet)
const uFloor = (p, x) => { const gy = G.room.floorBelow(x, p.y - 30); return Math.abs(gy - p.y) > 120 ? p.y : gy; };
// delayed cuts on everything inside a horizontal path (技能 version of pathCuts)
function uCuts(p, x0, x1, n, mult, col, id, gap = 0.07) {
  const lo = Math.min(x0, x1) - 16, hi = Math.max(x0, x1) + 16;
  const targets = enemiesInRect(lo, p.y - 64, hi - lo, 76);
  for (let k = 0; k < n; k++) later(k * gap, () => {
    for (const e of targets) {
      if (e.dead) continue;
      const a = rand(-60, 60);
      FX.slash(e.x, e.cy, { r: 18, a0: a - 70, a1: a + 70, th: 5, c: col, f: k % 2 ? 1 : -1, dur: 0.16, sy: 0.4, rot: rand(-40, 40) });
      hitEnemy(p, e, p.makeHit({ dmg: mult, kx: 20, ky: -60, stun: 0.5, hs: 2, dir: p.face, src: 'skill', fxc: col, uskill: id }));
    }
    if (targets.length) Sound.play('slash', { x: p.x, pitch: 1.2 + k * 0.08 });
  });
}

// ============================== RIN ==============================
(() => {
  const M = HEROES.rin.moves, RC = '#ff3b5c', PET = '#ffd0d8', VIO = '#c08aff';
  const air = p => !p.onGround;
  // a spinning shadow blade (影刃)
  const blade = (p, x, y, vx, vy, life) => {
    const pr = new Proj({
      team: 'p', x, y, vx, vy, kind: 'shard', r: 3.2, c: VIO, c2: '#ffffff', life, pierce: 99, ghost: true, spin: 30, light: 40, trail: 0.4,
      hit: p.makeHit({ dmg: 0.6, kx: 60, ky: -60, stun: 0.35, hs: 1, src: 'skill', fxc: VIO, uskill: 'rin_u_dash' }),
    });
    G.projs.push(pr);
    return pr;
  };
  Object.assign(M, {
    // ---------------- 飞刃 (U) ----------------
    u_rin_shot1: uStage('rin_u_shot', 0, {
      label: '飞刃', anim: 'sk_wave', dur: 0.38, cancel: 0.25,
      ev: [[0.05, p => {
        waveProj(p, { dmg: 1.0, ang: air(p) ? 16 : 0, sp: 470, hh: 13, r: 8, life: 0.75, c: RC, uskill: 'rin_u_shot' });
        hSlash(p, { x: 6, y: -20, r: 24, a0: -100, a1: 70, th: 8 });
        Sound.play('slashHeavy', { x: p.x, pitch: 1.35 });
      }]],
    }),
    u_rin_shot2: uStage('rin_u_shot', 1, {
      label: '交叉刃', anim: 'atk2', dur: 0.4, cancel: 0.26,
      ev: [[0.05, p => {
        for (const a of [-11, 11]) waveProj(p, { dmg: 0.65, ang: a + (air(p) ? 14 : 0), sp: 500, hh: 15, r: 9, life: 0.8, c: a < 0 ? RC : PET, uskill: 'rin_u_shot' });
        hSlash(p, { x: 8, y: -20, r: 28, a0: -60, a1: 60, th: 9, rot: 35 });
        hSlash(p, { x: 8, y: -20, r: 28, a0: -60, a1: 60, th: 9, rot: -35 });
        Sound.play('slashHeavy', { x: p.x, pitch: 1.15 });
      }]],
    }),
    u_rin_shot3: uStage('rin_u_shot', 2, {
      label: '千刃', anim: 'charge1', dur: 0.52, cancel: 0.36, grav: 0.2,
      onStart(p) { p.vx = -p.face * 160; if (p.onGround) p.vy = -120; },
      ev: [[0.06, p => {
        for (let i = 0; i < 5; i++) waveProj(p, { dmg: 0.55, ang: (i - 2) * 12 + (air(p) ? 10 : 0), sp: 520, hh: 16, r: 9, life: 0.85, c: i % 2 ? PET : RC, uskill: 'rin_u_shot' });
        hSlash(p, { x: 6, y: -20, r: 40, a0: -80, a1: 80, th: 12, dur: 0.28 });
        FX.screenFlash('#ffffff', 0.18, 0.12); Cam.shake(0.25);
        Sound.play('slashHeavy', { x: p.x, pitch: 0.85 }); Sound.play('swoosh', { x: p.x, pitch: 0.6 });
      }]],
    }),
    // ---------------- 升月 (↑U) ----------------
    u_rin_up1: uStage('rin_u_up', 0, {
      label: '升月斩', anim: 'rise', dur: 0.45, cancel: 0.3,
      hits: [{ t: 0.05, d: 0.1, box: [-6, -56, 44, 58], dmg: 0.8, kb: [30, -380], stun: 0.6, hs: 3, launch: true }],
      ev: [[0.05, p => {
        uLift(p, -260, -160);
        waveProj(p, { dmg: 1.3, ang: -42, sp: 430, hh: 18, r: 10, life: 0.7, c: RC, ky: -300, uskill: 'rin_u_up' });
        hSlash(p, { x: 4, y: -22, r: 26, a0: 70, a1: -120, th: 8, sy: 1.1 });
        Sound.play('slashHeavy', { x: p.x, pitch: 1.2 });
      }]],
    }),
    u_rin_up2: uStage('rin_u_up', 1, {
      label: '月轮', anim: 'airRise', dur: 0.42, cancel: 0.26,
      ev: [[0.05, p => {
        const R = 30 * p.reach(), f = p.face;
        Sound.play('swoosh', { x: p.x, pitch: 0.8 });
        addZone({
          x: p.x + f * 42, y: p.y - 62, life: 0.9, tick: 0.15,
          onTick(z) { for (const e of enemiesNear(z.x, z.y, R)) hitEnemy(p, e, p.makeHit({ dmg: 0.4, kx: 0, ky: -140, stun: 0.35, hs: 1, dir: sign(e.x - z.x) || 1, src: 'skill', energy: 0.4, fxc: RC, uskill: 'rin_u_up' })); },
          upd(z, dt) {
            z.x += f * 30 * dt; z.y -= 14 * dt;
            for (const e of enemiesNear(z.x, z.y, R * 1.8)) if (!e.boss) { e.vx += (z.x - e.x) * 3 * dt; e.vy += (z.y - e.cy) * 3 * dt; }
            Light.add(z.x, z.y, R * 3, RC, 0.6);
          },
          drawFn(ctx, gctx, x2, y2, z) {
            ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 3; i++) {
              const a0 = z.t * 18 + i * TAU / 3;
              ctx.strokeStyle = i ? RC : '#ffffff'; ctx.lineWidth = i ? 3 : 1.5;
              ctx.beginPath(); ctx.arc(x2, y2, R * 0.8, a0, a0 + 1.4); ctx.stroke();
            }
            ctx.globalCompositeOperation = 'source-over';
            gctx.fillStyle = RC; gctx.globalAlpha = 0.5; gctx.beginPath(); gctx.arc(x2, y2, R, 0, TAU); gctx.fill(); gctx.globalAlpha = 1;
          },
        });
      }]],
    }),
    u_rin_up3: uStage('rin_u_up', 2, {
      label: '坠月', anim: 'aatk3', dur: 0.6, cancel: 0.42, grav: 0.2,
      ev: [[0.08, p => {
        const k = p.reach(), x = p.x + p.face * 70, gy = uFloor(p, x), w = 46 * k;
        Sound.play('charge', { x, pitch: 1.6 });
        FX.customDraw(x, gy, 0.2, (ctx, gctx, X, Y, t) => {
          const yy = Y - 150 * (1 - Math.min(1, t / 0.18));
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = RC; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(X, yy - 18, w, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X, yy - 18, w - 2, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke();
          ctx.globalCompositeOperation = 'source-over';
          gctx.fillStyle = RC; gctx.fillRect(X - w, yy - 24, w * 2, 12);
        }, 1);
        later(0.18, () => {
          for (const e of enemiesInRect(x - w, gy - 70, w * 2, 74)) hitEnemy(p, e, p.makeHit({ dmg: 3.4, kx: 120, ky: -320, launch: true, stun: 0.8, hs: 8, heavy: true, dir: sign(e.x - x) || 1, src: 'skill', finisher: true, fxc: RC, uskill: 'rin_u_up' }));
          FX.shock(x, gy, RC, w + 16); FX.ring(x, gy - 6, 4, w + 20, RC, 0.35, 4, 0.35); FX.debris(x, gy - 2, [RC, '#ffffff'], 12);
          Cam.shake(0.5); Sound.play('slashHeavy', { x, pitch: 0.7 }); Sound.play('stomp', { x });
        });
      }]],
    }),
    // ---------------- 地走刃 (↓U) ----------------
    u_rin_down1: uStage('rin_u_down', 0, {
      label: '地走刃', anim: 'low', dur: 0.42, cancel: 0.28,
      ev: [[0.05, p => {
        const gy = uFloor(p, p.x), f = p.face, x0 = p.x;
        pShockwave(p, x0 + f * 10, gy, f, 1.1, RC, 'skill');
        hSlash(p, { x: 4, y: -8, r: 28, a0: -170, a1: 25, th: 6, sy: 0.3 });
        FX.dust(p.x + f * 18, gy, 6, f); Sound.play('slash', { x: p.x, pitch: 0.8 });
        // 刃迹: the wave scars the floor behind it for 1.5 s
        if (uHas(p, 'rin_u_down', 'renji')) for (let i = 0; i < 4; i++) later(i * 0.09, () => {
          const x = x0 + f * (30 + i * 36), y = uFloor(p, x);
          addZone({
            x, y, life: 1.5, tick: 0.25,
            onTick(z) { for (const e of enemiesInRect(z.x - 18, z.y - 22, 36, 24)) hitEnemy(p, e, p.makeHit({ dmg: 0.2, kx: 0, ky: -40, stun: 0.15, hs: 0, dir: f, src: 'skill', fxc: RC, uskill: 'rin_u_down', sfx: false, energy: 0.2 })); },
            drawFn(ctx, gctx, x2, y2, z) {
              const a = Math.min(1, z.life * 2);
              ctx.fillStyle = rgba(RC, 0.7 * a); ctx.fillRect(x2 - 16, y2 - 2, 32, 2);
              for (let k = 0; k < 3; k++) ctx.fillRect(x2 - 12 + k * 10, y2 - 5 - ((z.t * 40 + k * 7) % 6), 2, 4);
              gctx.fillStyle = RC; gctx.globalAlpha = 0.5 * a; gctx.fillRect(x2 - 16, y2 - 6, 32, 6); gctx.globalAlpha = 1;
            },
          });
        });
      }]],
    }),
    u_rin_down2: uStage('rin_u_down', 1, {
      label: '刃林', anim: 'low', dur: 0.5, cancel: 0.34,
      ev: [[0.06, p => {
        const x0 = p.x, f = p.face;
        for (let i = 0; i < 4; i++) later(i * 0.07, () => groundColumn(p, x0 + f * (30 + i * 30), 1.2, RC, { h: 60, w: 18, src: 'skill', uskill: 'rin_u_down' }));
      }]],
    }),
    u_rin_down3: uStage('rin_u_down', 2, {
      label: '断地', anim: 'plungeLand', dur: 0.55, cancel: 0.4,
      ev: [[0.06, p => {
        const x0 = p.x, f = p.face;
        FX.shock(p.x, uFloor(p, p.x), RC, 60); Cam.shake(0.4); Sound.play('stomp', { x: p.x });
        for (const d of [1, -1]) for (let i = 0; i < 6; i++) later(i * 0.06, () => groundColumn(p, x0 + d * f * (26 + i * 28), 1.0, RC, { h: 70, w: 20, src: 'skill', uskill: 'rin_u_down' }));
      }]],
    }),
    // ---------------- 影刃 (冲刺U) ----------------
    u_rin_dash1: uStage('rin_u_dash', 0, {
      label: '影刃', anim: 'dashAtk', dur: 0.36, cancel: 0.22, grav: 0,
      onStart(p) { p.vx = p.face * 200; p.vy = 0; },
      ev: [[0.04, p => {
        p.uMem = [-7, 0, 7].map(a => blade(p, p.x + p.face * 14, p.y - 20, Math.cos(a * DEG) * 620 * p.face, Math.sin(a * DEG) * 620, 0.5));
        FX.add({ k: 'streak', x: p.x + p.face * 40, y: p.y - 20, vx: p.face * 2400, vy: 0, life: 0.12, c: VIO, len: 0.03, w: 2 });
        Sound.play('swoosh', { x: p.x, pitch: 1.5 });
      }]],
    }),
    u_rin_dash2: uStage('rin_u_dash', 1, {
      label: '回刃', anim: 'atk3', dur: 0.42, cancel: 0.28, grav: 0.2,
      ev: [[0.05, p => {
        // the thrown blades turn around wherever they are and fly back through Rin's side
        const from = (p.uMem || []).map(pr => [pr.x, pr.y]);
        while (from.length < 3) from.push([p.x + p.face * (200 + from.length * 20), p.y - 20 + (from.length - 1) * 8]);
        for (const [x, y] of from) {
          const dx = p.x - x, sp = 680;
          blade(p, x, y, (sign(dx) || -p.face) * sp, (p.y - 20 - y) * 1.5, Math.min(0.75, Math.abs(dx) / sp + 0.15));
        }
        p.uMem = null;
        hSlash(p, { x: 0, y: -22, r: 30, a0: 170, a1: -20, th: 7, sy: 0.45 });
        Sound.play('swoosh', { x: p.x, pitch: 1.2 }); Sound.play('slash', { x: p.x, pitch: 1.4 });
      }]],
    }),
    u_rin_dash3: uStage('rin_u_dash', 2, {
      label: '影杀', anim: 'sk_shadow', dur: 0.5, cancel: 0.34, grav: 0,
      vel: [[0.03, 0.17, 760, 0]],
      onStart(p, mv) { mv.x0 = p.x; p.inv = Math.max(p.inv, 0.4); p.trail = 0.3; Sound.play('dash', { x: p.x, pitch: 0.8 }); },
      ev: [
        [0.04, p => FX.add({ k: 'streak', x: p.x + p.face * 30, y: p.y - 18, vx: p.face * 3000, vy: 0, life: 0.18, c: VIO, len: 0.04, w: 3 })],
        [0.2, (p, mv) => { G.dim = 0.4; uCuts(p, mv.x0, p.x, 5, 0.5, VIO, 'rin_u_dash'); }],
      ],
    }),
  });
})();

// ============================== EVE ==============================
(() => {
  const M = HEROES.eve.moves, Y = EVE_C, B = EVE_C2, FIRE = '#ff8a3a';
  const air = p => !p.onGround;
  // a flare that bursts into falling star bullets
  const flare = (p, vx, vy, n) => {
    const id = 'eve_u_up';
    G.projs.push(new Proj({
      team: 'p', x: p.x + p.face * 8, y: p.y - 28, vx: vx * p.face, vy, grav: 300, kind: 'orb', r: 3, c: Y, c2: '#ffffff', life: 1.2, noHit: true, ghost: true, light: 90, trail: 0.7,
      upd(q) {
        if (q.t < 0.45 || q.burst) return;
        q.burst = true; q.life = 0;
        FX.flash(q.x, q.y, 18, '#fff6c0', 0.15); FX.ring(q.x, q.y, 4, 30, Y, 0.3, 2); Sound.play('explode', { x: q.x, pitch: 2.0 });
        for (let i = 0; i < n; i++) G.projs.push(new Proj({
          team: 'p', x: q.x + rand(-26, 26), y: q.y + rand(-6, 6), vx: rand(-40, 40), vy: rand(240, 330), kind: 'bullet', r: 2.2, len: 10, c: Y, c2: '#ffffff', life: 1.0, light: 36, trail: 0.4,
          hit: p.makeHit({ dmg: 0.6, kx: 20, ky: 80, stun: 0.3, hs: 1, src: 'skill', fxc: Y, uskill: id }),
        }));
      },
    }));
    Sound.play('shoot', { x: p.x, pitch: 0.6 });
  };
  // a grenade that skips along the floor and bursts on the first enemy it touches
  const bouncer = (p, vx, vy) => {
    const id = 'eve_u_down', k = uDmg(p, id), r = 44 * p.reach();
    const boom = q => { if (q.boomed) return; q.boomed = true; explodeP(q.x, q.y - 4, r, 0.9 * k, { c: FIRE, c2: Y, ky: -280, kx: 180, shake: 0.3, src: 'skill', noProc: false, wx: { fam: 'u', id } }); };
    G.projs.push(new Proj({
      team: 'p', x: p.x + p.face * 10, y: p.y - 18, vx: vx * p.face, vy, grav: 760, kind: 'orb', r: 3.5, c: FIRE, c2: '#ffe0a0', life: 2.2, ghost: true, light: 40, trail: 0.5, tc: '#8a8aa8',
      hit: p.makeHit({ dmg: 0.3, kx: 40, ky: -40, stun: 0.3, src: 'skill', uskill: id }),
      onDie: boom,
      upd(q) {
        if (G.room.solidPx(q.x, q.y + q.r) && q.vy > 0) { q.y -= 2; q.vy = -Math.max(140, Math.abs(q.vy) * 0.55); q.vx *= 0.92; Sound.play('clank', { x: q.x, pitch: 1.8 }); }
        if (G.room.solidPx(q.x + sign(q.vx) * 5, q.y - 2)) q.vx *= -0.6;
        if (q.t > 2.0) { boom(q); q.life = 0; }
      },
    }));
  };
  // a ghost of Eve that keeps shooting forward
  const phantom = (p, dx, dy, delay) => {
    const fr = p.frame(), f = p.face, id = 'eve_u_dash';
    addZone({
      x: p.x - f * dx, y: p.y - dy, life: 0.75, tick: 0.1, tt: delay,
      onTick(z) {
        if (z.t > 0.6) return;
        G.projs.push(new Proj({ team: 'p', x: z.x + f * 12, y: z.y - 21, vx: f * 640, vy: rand(-18, 18), kind: 'bullet', r: 1.8, len: 12, c: B, c2: '#ffffff', life: 0.5, light: 24, hit: p.makeHit({ dmg: 0.35, kx: 50, ky: -20, stun: 0.2, src: 'skill', fxc: B, uskill: id }) }));
        Sound.play('shoot', { x: z.x, pitch: 1.4 });
      },
      drawFn(ctx, gctx, x2, y2, z) { drawFrame(ctx, fr, p.spr.ox, p.spr.oy, x2, y2, f < 0, { tint: B, alpha: 0.55 * Math.min(1, z.life * 4) }); },
    });
    FX.burst(p.x - f * dx, p.y - dy - 16, { n: 8, c: [B, '#ffffff'], sp: [30, 90], glow: true });
  };
  Object.assign(M, {
    // ---------------- 魔弹 (U) ----------------
    u_eve_shot1: uStage('eve_u_shot', 0, {
      label: '魔弹', anim: 'charge1', dur: 0.36, cancel: 0.24,
      ev: [[0.04, p => {
        hShoot(p, { ox: 18, oy: -21, ang: air(p) ? 12 : 0, dmg: 1.0, r: 3.2, len: 22, sp: 760, pierce: 2, ghost: true, kx: 160, ky: -60, src: 'skill', c: B, life: 0.6, hs: 3, uskill: 'eve_u_shot' });
        Sound.play('shotgun', { x: p.x, pitch: 1.7 }); p.vx = -p.face * 60;
      }]],
    }),
    u_eve_shot2: uStage('eve_u_shot', 1, {
      label: '三连魔弹', anim: 'shot3', dur: 0.36, cancel: 0.24,
      ev: [0.03, 0.09, 0.15].map((t, i) => [t, p => {
        hShoot(p, { ox: 16, oy: -21, ang: (i - 1) * 4 + (air(p) ? 12 : 0), dmg: 0.5, r: 2.6, len: 18, sp: 760, pierce: 2, ghost: true, kx: 120, src: 'skill', c: B, life: 0.6, silent: i > 0, uskill: 'eve_u_shot' });
        if (!i) Sound.play('shotgun', { x: p.x, pitch: 1.9 });
      }]),
    }),
    u_eve_shot3: uStage('eve_u_shot', 2, {
      label: '星爆弹', anim: 'charge2', dur: 0.5, cancel: 0.36,
      ev: [[0.06, p => {
        eveOrbShot(p, { dmg: 0.5, boom: 1.0 * uDmg(p, 'eve_u_shot'), r: 56, c: B, sp: 340, size: 6, shards: 8, shardDmg: 0.2, fuse: 0.7, src: 'skill', vy: air(p) ? 90 : 0, uskill: 'eve_u_shot' });
        Sound.play('explode', { x: p.x, pitch: 1.8 }); p.vx = -p.face * 160; Cam.shake(0.2);
      }]],
    }),
    // ---------------- 照明星 (↑U) ----------------
    u_eve_up1: uStage('eve_u_up', 0, { label: '照明星', anim: 'sk_missile', dur: 0.4, cancel: 0.26, ev: [[0.05, p => flare(p, 110, -330, 7)]] }),
    u_eve_up2: uStage('eve_u_up', 1, { label: '双星', anim: 'sk_missile', dur: 0.42, cancel: 0.28, ev: [[0.04, p => flare(p, 190, -300, 6)], [0.12, p => flare(p, 270, -280, 6)]] }),
    u_eve_up3: uStage('eve_u_up', 2, {
      label: '流星雨', anim: 'sk_missile', dur: 0.62, cancel: 0.42,
      ev: [[0.05, p => {
        const f = p.face, x0 = p.x, k = p.reach();
        Sound.play('charge', { x: p.x, pitch: 1.8 });
        for (let i = 0; i < 14; i++) later(i * 0.035, () => {
          // each star drops from well above the floor under its landing point, through platforms and ceilings
          const x = x0 + f * rand(30, 180 * k), gy = G.room.floorBelow(x, p.y - 40), fall = rand(170, 210);
          G.projs.push(new Proj({
            team: 'p', x: x - f * fall * 0.23, y: gy - fall, vx: f * 120, vy: 520, kind: 'bullet', r: 3, len: 24, c: Y, c2: '#ffffff', life: 0.75, light: 50, trail: 0.6, ghost: true,
            hit: p.makeHit({ dmg: 0.8, kx: 40, ky: 120, stun: 0.3, hs: 1, src: 'skill', fxc: Y, uskill: 'eve_u_up' }),
            upd(q) { if (q.y >= gy - 2 && !q.landed) { q.landed = true; q.life = 0; FX.flash(q.x, gy - 4, 9, Y, 0.1); FX.burst(q.x, gy - 2, { n: 4, c: [Y, '#ffffff'], sp: [30, 90], ang: -Math.PI / 2, spread: 1.2, life: [0.15, 0.3], glow: true }); } },
          }));
          if (i % 3 === 0) Sound.play('shoot', { x, pitch: 1.8 });
        });
      }]],
    }),
    // ---------------- 跳雷 (↓U) ----------------
    u_eve_down1: uStage('eve_u_down', 0, { label: '弹跳雷', anim: 'sk_grenade', dur: 0.4, cancel: 0.26, ev: [[0.08, p => { bouncer(p, 240, -160); Sound.play('swoosh', { x: p.x, pitch: 0.8 }); }]] }),
    u_eve_down2: uStage('eve_u_down', 1, { label: '连锁雷', anim: 'sk_grenade', dur: 0.42, cancel: 0.28, ev: [[0.08, p => { bouncer(p, 170, -240); bouncer(p, 320, -120); Sound.play('swoosh', { x: p.x, pitch: 0.7 }); }]] }),
    u_eve_down3: uStage('eve_u_down', 2, {
      label: '雷阵', anim: 'sk_mine', dur: 0.5, cancel: 0.34,
      ev: [[0.1, p => {
        const id = 'eve_u_down', k = uDmg(p, id), r = 40 * p.reach();
        Sound.play('clank', { x: p.x, pitch: 1.5 });
        [-80, -40, 0, 40, 80].forEach((dx, i) => {
          const x = p.x + p.face * dx, y = uFloor(p, x);
          addZone({
            x, y, life: 0.3 + i * 0.12,
            drawFn(ctx, gctx, x2, y2, z) { const b = Math.floor(z.t * 12) % 2; ctx.fillStyle = '#2a3048'; ctx.fillRect(x2 - 5, y2 - 3, 10, 3); ctx.fillStyle = b ? B : '#1a6a8a'; ctx.fillRect(x2 - 1, y2 - 5, 3, 2); if (b) { gctx.fillStyle = B; gctx.fillRect(x2 - 3, y2 - 7, 6, 5); } },
            onEnd(z) { explodeP(z.x, z.y - 6, r, 0.7 * k, { c: B, c2: Y, ky: -260, kx: 120, shake: 0.2, src: 'skill', noProc: false, status: ['stun', 0.4], wx: { fam: 'u', id } }); },
          });
        });
      }]],
    }),
    // ---------------- 回旋射击 (冲刺U) ----------------
    u_eve_dash1: uStage('eve_u_dash', 0, {
      label: '回旋射击', anim: 'dashAtk', dur: 0.38, cancel: 0.24, grav: 0,
      onStart(p) { p.vx = p.face * 220; p.vy = 0; },
      ev: [[0.05, p => {
        for (let i = 0; i < 8; i++) hShoot(p, { ox: 0, oy: -20, ang: i * 45, dmg: 0.5, sp: 520, life: 0.45, src: 'skill', silent: i > 0, c: Y, uskill: 'eve_u_dash' });
        FX.ring(p.x, p.cy, 4, 30, Y, 0.25, 2);
      }]],
    }),
    u_eve_dash2: uStage('eve_u_dash', 1, {
      label: '交叉火力', anim: 'counter', dur: 0.5, cancel: 0.34, grav: 0.2,
      ev: [0.04, 0.08, 0.12, 0.16, 0.2, 0.24].map((t, i) => [t, p => hShoot(p, { ox: 14, oy: -21, ang: i % 2 ? 22 : -22, dmg: 0.45, sp: 700, pierce: 2, life: 0.55, src: 'skill', silent: i > 1, c: B, uskill: 'eve_u_dash' })]),
    }),
    u_eve_dash3: uStage('eve_u_dash', 2, {
      label: '幻影齐射', anim: 'charge1', dur: 0.5, cancel: 0.34,
      ev: [[0.04, p => { phantom(p, 26, 0, 0); phantom(p, 12, 22, 0.05); Sound.play('teleport', { x: p.x, pitch: 1.4 }); }]],
    }),
  });
})();

// ============================== GAO ==============================
(() => {
  const M = HEROES.gao.moves, C = GAO_C, FL = '#ff6a2a';
  const air = p => !p.onGround;
  const kiBall = (p, oy, size, dmg, vy = 0) => {
    const id = 'gao_u_shot', k = uDmg(p, id);
    G.projs.push(new Proj({
      team: 'p', x: p.x + p.face * 22, y: p.y + oy, vx: p.face * 340, vy, kind: 'orb', r: size, c: C, c2: '#fff6d0', life: 0.9, pierce: 2, light: 80, trail: 0.7,
      hit: p.makeHit({ dmg, kx: 260, ky: -100, stun: 0.5, hs: 3, heavy: true, src: 'skill', fxc: C, uskill: id }),
      onDie: q => explodeP(q.x, q.y, 30, 0.4 * k, { c: C, src: 'skill', shake: 0.15, wx: q.hit.wx }),
    }));
    Sound.play('explode', { x: p.x, pitch: 1.7 }); Sound.play('void', { x: p.x, pitch: 1.7 });
  };
  // a whirling ki column that drags enemies in and lifts them
  const twister = (p, x, life) => {
    const id = 'gao_u_up', gy = uFloor(p, x), big = uHas(p, id, 'qixuan'), R = 30 * p.reach() * (big ? 1.25 : 1);
    if (big) life *= 1.6;                                     // 气旋不散
    addZone({
      x, y: gy - 30, life, tick: 0.15,
      onTick(z) { for (const e of enemiesNear(z.x, z.y, R)) hitEnemy(p, e, p.makeHit({ dmg: 0.35, kx: 0, ky: -260, launch: true, stun: 0.4, hs: 1, dir: sign(e.x - z.x) || 1, src: 'skill', energy: 0.4, fxc: C, uskill: id })); },
      upd(z, dt) {
        for (const e of enemiesNear(z.x, z.y, R * 2)) if (!e.boss) e.vx += (z.x - e.x) * 5 * dt;
        for (let i = 0; i < 2; i++) {
          const a = z.t * 16 + i * Math.PI, hh = (z.t * 90 + i * 30) % 64;
          FX.add({ k: 'px', x: z.x + Math.cos(a) * (8 + hh * 0.3), y: z.y + 28 - hh, vx: 0, vy: -60, life: 0.25, s: 2, c: pick([C, '#ffffff', FL]), glow: true, add: true });
        }
        Light.add(z.x, z.y, R * 3, C, 0.6);
      },
      // a swaying funnel of ki rings, widening upward
      drawFn(ctx, gctx, x2, y2, z) {
        const a = Math.min(1, z.life * 3, z.t * 6), w0 = R / 30;
        ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 2;
        for (let i = 0; i < 7; i++) {
          const yy = y2 + 28 - i * 10, w = (6 + i * 3.4) * w0, off = Math.sin(z.t * 14 + i * 0.9) * (2 + i * 0.6);
          ctx.strokeStyle = rgba(i % 2 ? C : '#fff6d0', 0.55 * a);
          ctx.beginPath(); ctx.ellipse(x2 + off, yy, w, 3, 0, 0, TAU); ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
        gctx.fillStyle = C; gctx.globalAlpha = 0.3 * a; gctx.fillRect(x2 - 16 * w0, y2 - 40, 32 * w0, 70); gctx.globalAlpha = 1;
      },
    });
    FX.dust(x, gy, 8, 0);
  };
  Object.assign(M, {
    // ---------------- 气弹 (U) ----------------
    u_gao_shot1: uStage('gao_u_shot', 0, {
      label: '气弹', anim: 'dashAtk', dur: 0.4, cancel: 0.26,
      ev: [[0.05, p => { kiBall(p, -24, 7, 1.1, air(p) ? 120 : 0); hPunchFx(p, 22, -24, true); p.vx = -p.face * 60; }]],
    }),
    u_gao_shot2: uStage('gao_u_shot', 1, {
      label: '双掌气弹', anim: 'charge1', dur: 0.46, cancel: 0.3,
      ev: [[0.06, p => { kiBall(p, -32, 9, 0.8, air(p) ? 100 : -30); kiBall(p, -14, 9, 0.8, air(p) ? 160 : 30); hPunchFx(p, 24, -24, true); Cam.shake(0.25); }]],
    }),
    u_gao_shot3: uStage('gao_u_shot', 2, {
      label: '气功炮', anim: 'sk_ki', dur: 0.62, cancel: 0.46,
      update(p, mv) { if (mv.t < 0.26) { const a = rand(0, TAU); FX.add({ k: 'px', x: p.x - p.face * 6 + Math.cos(a) * 18, y: p.cy + Math.sin(a) * 18, vx: -Math.cos(a) * 70, vy: -Math.sin(a) * 70, life: 0.25, s: 2, c: pick([C, '#ffffff']), glow: true, add: true }); Light.add(p.x, p.cy, 70, C, 0.7); } },
      ev: [[0.28, p => {
        const len = 220 * p.reach(), y = p.y - 22, x0 = p.x + p.face * 14;
        const lo = p.face > 0 ? x0 : x0 - len;
        for (const e of enemiesInRect(lo, y - 16, len, 32)) hitEnemy(p, e, p.makeHit({ dmg: 2.2, kx: 320, ky: -140, stun: 0.7, hs: 8, heavy: true, dir: p.face, src: 'skill', finisher: true, fxc: C }));
        FX.add({ k: 'beam', x: x0, y, len, w: 14, ang: p.face > 0 ? 0 : Math.PI, c: C, life: 0.32 });
        FX.add({ k: 'beam', x: x0, y, len, w: 4, ang: p.face > 0 ? 0 : Math.PI, c: '#ffffff', life: 0.36 });
        FX.screenFlash('#ffd36a', 0.25, 0.15); Cam.shake(0.45); p.vx = -p.face * 140;
        Sound.play('explode', { x: p.x, pitch: 1.3 }); Sound.play('void', { x: p.x, pitch: 1.2 });
      }]],
    }),
    // ---------------- 升龙气 (↑U) ----------------
    u_gao_up1: uStage('gao_u_up', 0, {
      label: '气旋', anim: 'rise', dur: 0.48, cancel: 0.32,
      ev: [[0.06, p => { uLift(p, -200, -100); twister(p, p.x + p.face * 56, 0.6); hPunchFx(p, 8, -40, true); Sound.play('swoosh', { x: p.x, pitch: 0.5 }); }]],
    }),
    u_gao_up2: uStage('gao_u_up', 1, {
      label: '双气旋', anim: 'rise', dur: 0.48, cancel: 0.32,
      ev: [[0.06, p => { twister(p, p.x + p.face * 100, 0.6); later(0.08, () => twister(p, p.x + p.face * 150, 0.6)); Sound.play('swoosh', { x: p.x, pitch: 0.45 }); }]],
    }),
    u_gao_up3: uStage('gao_u_up', 2, {
      label: '炎龙', anim: 'sk_dragon', dur: 0.7, cancel: 0.5,
      ev: [[0.08, p => {
        const x0 = p.x, f = p.face;
        uLift(p, -240, -120);
        Sound.play('fire', { x: p.x }); Cam.shake(0.4);
        for (let i = 0; i < 3; i++) later(i * 0.08, () => groundColumn(p, x0 + f * (40 + i * 50), 1.6, FL, { h: 110, w: 26, bw: 10, ky: -420, src: 'skill', uskill: 'gao_u_up', status: ['burn', 3, 0.25], burst: [FL, '#ffd36a', '#ffffff'], sound: 'fire' }));
      }]],
    }),
    // ---------------- 震地 (↓U) ----------------
    u_gao_down1: uStage('gao_u_down', 0, {
      label: '震地波', anim: 'sk_split', dur: 0.5, cancel: 0.34,
      ev: [[0.1, p => {
        const gy = uFloor(p, p.x), x0 = p.x;
        pShockwave(p, x0, gy, 1, 1.4, C, 'skill'); pShockwave(p, x0, gy, -1, 1.4, C, 'skill');
        FX.shock(p.x, gy, C, 50); FX.debris(p.x, gy - 2, [C, '#a08a6a'], 8);
        Cam.shake(0.3); Sound.play('stomp', { x: p.x });
        // 裂地: the ground the waves crossed splits open half a second later
        if (uHas(p, 'gao_u_down', 'liedi')) later(0.5, () => {
          for (const d of [1, -1]) for (let i = 1; i <= 4; i++) {
            const x = x0 + d * i * 34;
            groundColumn(p, x, 0.8, C, { rock: true, h: 24, w: 18, src: 'skill', uskill: 'gao_u_down' });
          }
          Cam.shake(0.25);
        });
      }]],
    }),
    u_gao_down2: uStage('gao_u_down', 1, {
      label: '岩刺', anim: 'sk_split', dur: 0.52, cancel: 0.36,
      ev: [[0.1, p => {
        const x0 = p.x, f = p.face;
        Cam.shake(0.3); Sound.play('stomp', { x: p.x });
        for (const d of [1, -1]) for (let i = 0; i < 4; i++) later(i * 0.06, () => groundColumn(p, x0 + d * f * (24 + i * 24), 0.7, C, { rock: true, h: 30 + i * 4, w: 16, src: 'skill', uskill: 'gao_u_down' }));
      }]],
    }),
    u_gao_down3: uStage('gao_u_down', 2, {
      label: '地震', anim: 'sk_split', dur: 0.62, cancel: 0.46,
      ev: [[0.1, p => {
        const id = 'gao_u_down', R = 260 * p.reach();
        gaoQuake(p, 70, 0.8 * uDmg(p, id), 'skill');
        for (const e of liveEnemies()) {
          if (e.flying || Math.abs(e.x - p.x) > R || Math.abs(e.y - p.y) > 60) continue;
          hitEnemy(p, e, p.makeHit({ dmg: 1.6, kx: 0, ky: -260, launch: true, stun: 0.8, hs: 2, dir: sign(e.x - p.x) || 1, src: 'skill', fxc: C, uskill: id }));
          applyStatus(e, 'stun', 0.5);
          FX.debris(e.x, e.y - 2, [C, '#a08a6a'], 4);
        }
        FX.screenFlash('#ffd36a', 0.3, 0.2); Cam.shake(0.8);
      }]],
    }),
    // ---------------- 猛虎掌 (冲刺U) ----------------
    u_gao_dash1: uStage('gao_u_dash', 0, {
      label: '虎掌', anim: 'dashAtk', dur: 0.4, cancel: 0.26, grav: 0,
      onStart(p) { p.vx = p.face * 260; p.vy = 0; },
      ev: [[0.05, p => {
        G.projs.push(new Proj({ team: 'p', x: p.x + p.face * 24, y: p.y - 24, vx: p.face * 480, vy: 0, kind: 'fist', r: 10, c: C, life: 0.42, pierce: 99, ghost: true, light: 80, hit: p.makeHit({ dmg: 1.5, kx: 280, ky: -100, stun: 0.5, hs: 4, heavy: true, src: 'skill', fxc: C }) }));
        hPunchFx(p, 24, -24, true); Sound.play('hitHeavy', { x: p.x, pitch: 1.1 }); Cam.push(p.face * 3, 0);
      }]],
    }),
    u_gao_dash2: uStage('gao_u_dash', 1, {
      label: '双虎掌', anim: 'charge1', dur: 0.48, cancel: 0.32,
      ev: [[0.06, p => {
        G.projs.push(new Proj({ team: 'p', x: p.x + p.face * 26, y: p.y - 24, vx: p.face * 440, vy: 0, kind: 'fist', r: 14, c: FL, life: 0.48, pierce: 99, ghost: true, light: 100, hit: p.makeHit({ dmg: 1.6, kx: 380, ky: -140, stun: 0.7, hs: 6, heavy: true, breakGuard: true, src: 'skill', fxc: FL }) }));
        hPunchFx(p, 28, -24, true, FL); Sound.play('hitHeavy', { x: p.x, pitch: 0.8 }); Cam.shake(0.3);
      }]],
    }),
    u_gao_dash3: uStage('gao_u_dash', 2, {
      label: '虎啸', anim: 'sk_iron', dur: 0.6, cancel: 0.44,
      ev: [[0.12, p => {
        const R = 90 * p.reach();
        for (const e of enemiesNear(p.x, p.cy, R)) { hitEnemy(p, e, p.makeHit({ dmg: 1.8, kx: 260, ky: -220, stun: 0.6, hs: 6, heavy: true, radial: true, dir: sign(e.x - p.x) || 1, src: 'skill', fxc: C })); applyStatus(e, 'stun', 0.6); }
        for (let i = 0; i < 3; i++) later(i * 0.07, () => FX.ring(p.x, p.cy, 6, R + i * 10, i ? C : '#ffffff', 0.35, 4 - i));
        FX.screenFlash('#ffb347', 0.25, 0.2); Cam.shake(0.55);
        Sound.play('roar', { x: p.x }); Sound.play('stomp', { x: p.x });
      }]],
    }),
  });
})();
