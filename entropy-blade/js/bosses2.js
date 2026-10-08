'use strict';
// =====================================================================
//  BOSSES (2/2) — 雪女·白霜 (new), and the signature traits of every boss:
//   荒鬼武将 鬼怒 · 雪女 寒气 · 晶核女皇 晶壁 · 熵之王 熵蚀
// =====================================================================

// ---------------- 雪女 sprite ----------------
function drawYukionna(x, o) {
  const t = o.t, cy = -44 + Math.sin(t * TAU) * 2;
  // long black hair streaming behind
  for (let i = 0; i < 6; i++) x.line(-1, cy - 18, -6 - i * 2.4, cy + 6 + i * 4 + Math.sin(t * TAU + i) * 2, 2.6, i % 2 ? '#1a2238' : '#2c3654');
  // white kimono dissolving into mist
  x.poly([[-6, cy - 2], [6, cy - 2], [12, cy + 30], [4, cy + 34], [-4, cy + 32], [-12, cy + 30]], '#e8f0fc');
  x.poly([[-6, cy - 2], [-2, cy - 2], [-8, cy + 30], [-12, cy + 30]], '#b8c8e4');
  for (let k = 0; k < 4; k++) x.ell(Math.sin(t * TAU * 2 + k) * 3, cy + 33 + k * 3, 9 - k * 2, 2, 0, k % 2 ? '#dfe8f8' : '#c8d6ee');
  x.line(1, cy + 6, 6, cy + 28, 0.8, '#c8d6ee');
  x.rect(-6, cy + 2, 12, 3, '#5a7ac0'); x.rect(-1, cy + 2, 2, 3, '#bfe6ff');
  x.line(-3, cy - 2, 2, cy + 3, 1, '#5a7ac0'); x.line(3, cy - 2, -1, cy + 3, 1, '#9ab8e8');
  // wide furisode sleeves
  const sa = (o.cast ? -70 : o.point ? -8 : 65) * DEG;
  const ex = 3 + Math.cos(sa) * 8, ey = cy - 10 + Math.sin(sa) * 8;
  x.poly([[1, cy - 11], [5, cy - 12], [ex + 4, ey + 2], [ex + 2, ey + 12], [ex - 3, ey + 10], [ex - 2, ey]], '#f2f7ff');
  x.line(ex - 3, ey + 10, ex + 2, ey + 12, 0.8, '#9ab8e8');
  x.circ(ex + Math.cos(sa) * 4, ey + Math.sin(sa) * 4, o.cast || o.point ? 2.4 : 1.4, o.cast || o.point ? '#ffffff' : '#dfefff');
  x.poly([[-4, cy - 11], [-1, cy - 12], [-5, cy + 4], [-9, cy + 2]], '#d8e4f6');
  // head
  x.circ(1, cy - 17, 4.6, '#eaf4ff');
  x.poly([[-4, cy - 15], [-3.5, cy - 21], [1, cy - 23], [5.5, cy - 20.5], [5.8, cy - 17.5], [3.6, cy - 19], [0, cy - 19.5], [-1.5, cy - 13]], '#1e2840');
  x.rect(2.6, cy - 17.6, 1.6, 1, '#4ad8ff');
  x.rect(3.2, cy - 15, 1.2, 0.6, '#9ab8e8');
  // ice kanzashi
  x.poly([[-3, cy - 22], [-1.5, cy - 27], [0, cy - 22]], '#bfe6ff'); x.poly([[-5, cy - 21], [-6.5, cy - 25], [-3.5, cy - 21.5]], '#dff4ff');
  x.rect(-2, cy - 24, 1, 1, '#ffffff');
}
function bakeBosses2() {
  const s = (x, o) => { x.scale(1.3, 1.3); drawYukionna(x, o); };
  bakeCustom('yukionna', 120, 124, 60, 118, {
    idle: { n: 8, loop: true, fps: 8, draw: (x, t) => s(x, { t }) },
    cast: { n: 4, loop: true, fps: 8, draw: (x, t) => s(x, { t, cast: true }) },
    point: { n: 4, loop: true, fps: 8, draw: (x, t) => s(x, { t, point: true }) },
    hurt: { n: 1, draw: x => s(x, { t: 0.25 }) },
  });
}
BOSS_DEFS.yukionna = {
  name: '雪女·白霜', en: 'YUKI-ONNA', title: '寒山雪夜的游魂', hp: 1750, w: 22, h: 64, dmg: 13, gold: [70, 90], spr: 'yukionna', speed: 105, kb: 0.1, poise: 22, flying: true,
  stars: 3, style: '远程消耗', trait: '寒气', traitDesc: '始终与你保持距离；冰系攻击叠加寒气，满 5 层冻结并受到伤害',
  music: 'bossSnow',
};

// ---------------- 寒气 frost stacks on the player ----------------
function addFrost(n) {
  const p = G.player;
  if (!p || p.dead || G.god) return;
  const c = p.counters;
  c.frost = Math.min(5, (c.frost || 0) + n); c.frostT = G.time;
  p.chill(1.0 + c.frost * 0.3);
  if (c.frost >= 5) {
    c.frost = 0;
    const dmg = Math.round(12 * (G.boss ? G.boss.dmgMul : 1));
    p.hp = Math.max(1, p.hp - dmg);
    FX.num(p.x, p.y - p.h, dmg, { c: '#9fd8ff', big: true });
    FX.text(p.x, p.y - p.h - 14, '冻结', '#bfe6ff', { size: 12, life: 0.9 });
    FX.burst(p.x, p.cy, { n: 26, c: ['#ffffff', '#bfe6ff', '#7fb8e8'], sp: [40, 160], glow: true });
    FX.ring(p.x, p.cy, 4, 34, '#bfe6ff', 0.4, 3);
    Sound.play('shatter', { x: p.x, pitch: 0.8 });
    p.state = 'hurt'; p.hurtT = 0.65; p.move = null; p.vx = 0;
    p.chill(2.4); p.inv = Math.max(p.inv, 0.9);
  }
}
function blizzardZone(b, x, y) {
  addZone({
    x, y, life: 4.5, tick: 0.5, r: 44,
    onTick(z) { const p = G.player; if (p && !p.dead && Math.abs(p.x - z.x) < z.r && p.y > z.y - 70 && p.y <= z.y + 4) { addFrost(1); hurtPlayer(6 * b.dmgMul, z.x, { noStagger: true }); } },
    upd(z) {
      for (let i = 0; i < 3; i++) { const a = z.t * 6 + i * 2.1, r = rand(4, z.r); FX.add({ k: 'px', x: z.x + Math.cos(a) * r, y: z.y - rand(0, 60), vx: -Math.sin(a) * 80, vy: rand(-20, 40), life: 0.4, s: rand(1, 2.4), c: pick(['#ffffff', '#dff4ff', '#9fd8ff']), glow: true }); }
      Light.add(z.x, z.y - 20, 90, '#9fd8ff', 0.5);
    },
    drawFn(ctx, gctx, X, Y, z) {
      const a = Math.min(1, z.t * 3) * Math.min(1, z.life * 2);
      ctx.globalAlpha = 0.22 * a; ctx.fillStyle = '#dff4ff'; ctx.fillRect(X - z.r, Y - 70, z.r * 2, 70);
      ctx.globalAlpha = 0.6 * a; ctx.fillStyle = '#bfe6ff'; ctx.beginPath(); ctx.ellipse(X, Y, z.r, 4, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      gctx.globalAlpha = 0.25 * a; gctx.fillStyle = '#9fd8ff'; gctx.fillRect(X - z.r, Y - 6, z.r * 2, 6); gctx.globalAlpha = 1;
    },
  });
}
function iceSpear(b, sx, sy, sp = 420) {
  const p = G.player, a = Math.atan2(p.cy - sy, p.x - sx);
  G.projs.push(new Proj({ team: 'e', x: sx, y: sy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, kind: 'shard', r: 4, c: '#bfe6ff', c2: '#ffffff', dmg: 13 * b.dmgMul, life: 2.2, ghost: true, light: 40, onHitP: () => addFrost(1) }));
  Sound.play('ice', { x: sx, pitch: rand(1.2, 1.5) });
}

// ---------------- 雪女 AI ----------------
BOSS_AI.yukionna = function (b, dt) {
  const p = G.player, d = Math.abs(p.x - b.x), R = G.room;
  const fast = b.phase > 1 ? 0.78 : 1;
  const col = '#9fd8ff';
  const homeY = R.base * TILE - 46;
  const glide = () => {
    // keep a wide berth — she wants to whittle you down from afar
    const want = clamp(p.x + (b.x < p.x ? -175 : 175), 4 * TILE, R.pw - 4 * TILE);
    b.vx = approach(b.vx, clamp((want - b.x) * 1.4, -b.D.speed, b.D.speed), 260 * dt);
    b.vy = approach(b.vy, clamp((homeY + Math.sin(G.time * 1.3) * 14 - b.y) * 2, -90, 90), 300 * dt);
    if (Math.random() < 0.3) FX.add({ k: 'px', x: b.x + rand(-8, 8), y: b.y - rand(0, 10), vx: rand(-10, 10), vy: rand(10, 30), life: 0.6, s: 1.5, c: '#dff4ff', glow: true });
  };
  const stop = () => { b.vx = approach(b.vx, 0, 300 * dt); b.vy = approach(b.vy, 0, 300 * dt); };
  const done = (cd) => { b.fired = false; b.setState('idle', 'idle'); b.cd = cd * fast; };
  switch (b.state) {
    case 'idle': {
      b.faceTarget(); glide(); b.setAnim('idle');
      if (d < 85 && G.time - (b.tpT || -9) > 2.6) { b.tpT = G.time; b.setState('tpout', 'idle'); Sound.play('teleport', { x: b.x, pitch: 1.4 }); break; }
      if (b.cd <= 0) {
        const a = b.pickAttack([
          { id: 'spears', w: 3 }, { id: 'icicles', w: 2.2 }, { id: 'ring', w: 2 }, { id: 'blizzard', w: 1.6 },
          { id: 'mirror', w: 1.5 }, { id: 'breath', w: 2.2, ok: b.phase > 1 },
        ]);
        b.n = 0; b.fired = false;
        if (a === 'spears') { b.setState('spears', 'cast'); b.spears = []; Sound.play('ice', { x: b.x, pitch: 0.8 }); }
        else if (a === 'icicles') { b.setState('icicles', 'cast'); Sound.play('warn', { x: b.x }); }
        else if (a === 'ring') { b.setState('ring', 'point'); b.telegraph(0.4); }
        else if (a === 'blizzard') { b.setState('blizzard', 'cast'); Sound.play('swoosh', { x: b.x, pitch: 0.5 }); }
        else if (a === 'mirror') { b.setState('mirror', 'cast'); Sound.play('void', { x: b.x, pitch: 1.6 }); }
        else if (a === 'breath') { b.setState('breath', 'point'); b.telegraph(0.7); b.bdir = sign(p.x - b.x) || b.face; Sound.play('charge', { x: b.x, pitch: 0.6 }); }
      }
      break;
    }
    case 'spears': {
      stop(); b.faceTarget();
      const n = b.phase > 1 ? 5 : 3;
      if (!b.fired) { b.fired = true; for (let i = 0; i < n; i++) b.spears.push({ ox: (i - (n - 1) / 2) * 16, oy: -92 - Math.abs(i - (n - 1) / 2) * 6, shot: false }); }
      b.spears.forEach((s, i) => { if (!s.shot && b.stT > 0.75 + i * 0.22 * fast) { s.shot = true; iceSpear(b, b.x + s.ox, b.y + s.oy, 430); } });
      if (b.stT > 0.75 + n * 0.22 + 0.45) { b.spears = []; done(rand(0.8, 1.3)); }
      break;
    }
    case 'icicles':
      stop();
      if (!b.fired) {
        b.fired = true;
        const n = b.phase > 1 ? 12 : 8;
        for (let i = 0; i < n; i++) later(i * 0.13, () => {
          if (b.dead) return;
          const rx = clamp(p.x + rand(-110, 110), 3 * TILE, R.pw - 3 * TILE), ry = R.floorBelow(rx, p.y - 60);
          let top = ry - 40; while (top > 18 && !R.solidPx(rx, top)) top -= 8;
          FX.tline(rx, top + 8, rx, ry, col, 0.6, 1);
          later(0.6, () => G.projs.push(new Proj({ team: 'e', x: rx, y: top + 10, vx: 0, vy: 540, kind: 'shard', r: 3.5, c: '#dff4ff', c2: '#ffffff', dmg: 12 * b.dmgMul, life: 1.6, ghost: true, onHitP: () => addFrost(1),
            upd: q => { if (q.y >= ry - 2) { q.life = 0; FX.burst(rx, ry - 2, { n: 6, c: ['#ffffff', col], sp: [40, 120], life: [0.2, 0.4], glow: true }); } } })));
        });
      }
      if (b.stT > 2.2) done(rand(0.7, 1.1));
      break;
    case 'ring': {
      stop();
      const rings = b.phase > 1 ? 3 : 2;
      if (b.stT > 0.4 + b.n * 0.5 && b.n < rings) {
        b.n++;
        const k = 16, off = b.n * 0.2;
        for (let i = 0; i < k; i++) { const a = off + i * TAU / k; G.projs.push(new Proj({ team: 'e', x: b.x, y: b.y - 40, vx: Math.cos(a) * 105, vy: Math.sin(a) * 105, kind: 'shard', r: 3, c: '#bfe6ff', c2: '#ffffff', dmg: 11 * b.dmgMul, life: 4, ghost: true, light: 0, onHitP: () => addFrost(1) })); }
        FX.ring(b.x, b.y - 40, 6, 46, col, 0.3, 3); Sound.play('ice', { x: b.x, pitch: 1 });
      }
      if (b.stT > 0.5 + rings * 0.5 + 0.3) done(rand(0.7, 1.1));
      break;
    }
    case 'blizzard':
      stop();
      if (b.stT > 0.5 && !b.fired) {
        b.fired = true;
        const xs = b.phase > 1 ? [p.x, p.x - 90, p.x + 90] : [p.x, p.x + (chance(0.5) ? -80 : 80)];
        for (const x of xs) { const cx = clamp(x, 3 * TILE, R.pw - 3 * TILE); blizzardZone(b, cx, R.floorBelow(cx, p.y - 40)); }
        Sound.play('swoosh', { x: b.x, pitch: 0.4 });
      }
      if (b.stT > 1.0) done(rand(0.5, 0.9));
      break;
    case 'mirror':
      stop();
      if (b.stT > 0.5 && !b.fired) {
        b.fired = true;
        // two ice mirror images flank you and fire spears before shattering
        for (const side of [-1, 1]) {
          const cx = clamp(p.x + side * 140, 4 * TILE, R.pw - 4 * TILE);
          const fr = animFrame(b.spr, 'point', 0);
          addZone({
            x: cx, y: homeY, life: 1.5, fired: 0,
            upd(z) {
              if (z.t > 0.6 + z.fired * 0.2 && z.fired < (b.phase > 1 ? 3 : 2)) { z.fired++; iceSpear(b, z.x, z.y - 50, 380); }
              Light.add(z.x, z.y - 40, 60, col, 0.5);
            },
            drawFn(ctx, gctx, X, Y, z) { drawFrame(ctx, fr, b.spr.ox, b.spr.oy, X, Y, G.player.x < z.x, { tint: '#bfe6ff', alpha: 0.45 + 0.25 * Math.sin(z.t * 20) }); },
            onEnd(z) { FX.burst(z.x, z.y - 40, { n: 20, c: ['#ffffff', '#bfe6ff'], sp: [40, 150], glow: true }); Sound.play('shatter', { x: z.x }); },
          });
          FX.burst(cx, homeY - 40, { n: 12, c: ['#ffffff', col], sp: [30, 90], glow: true });
        }
      }
      if (b.stT > 1.7) done(rand(0.6, 1.0));
      break;
    case 'breath': {
      // freezing gale: shoves you back and stacks frost while it lasts
      stop(); b.face = b.bdir;
      if (b.stT > 0.7 && b.stT < 2.1) {
        const x0 = b.x + b.bdir * 10, y0 = b.y - 56;
        for (let i = 0; i < 4; i++) FX.add({ k: 'streak', x: x0 + b.bdir * rand(0, 200), y: y0 + rand(0, 50), vx: b.bdir * rand(500, 800), vy: rand(-20, 20), life: 0.15, c: pick(['#ffffff', '#bfe6ff', col]), len: 0.03 });
        Light.add(x0 + b.bdir * 100, y0 + 25, 160, col, 0.6);
        if (Math.random() < 0.3) Sound.play('swoosh', { x: b.x, pitch: rand(0.4, 0.6) });
        const pl = G.player, rel = (pl.x - x0) * b.bdir;
        if (!pl.dead && rel > 0 && rel < 260 && pl.y > y0 && pl.y - pl.h < y0 + 56 && pl.state !== 'dash') {
          pl.x += b.bdir * 140 * dt;
          b.btick = (b.btick || 0) - dt;
          if (b.btick <= 0) { b.btick = 0.45; addFrost(1); hurtPlayer(5 * b.dmgMul, x0, { noStagger: true }); }
        }
      }
      if (b.stT > 2.4) done(rand(0.6, 1.0));
      break;
    }
    case 'tpout':
      b.blink = 1 - b.stT / 0.35; b.intangible = true; b.vx = 0; b.vy = 0;
      if (b.stT > 0.35) {
        b.x = clamp(p.x + (p.x > R.pw / 2 ? -1 : 1) * rand(180, 230), 4 * TILE, R.pw - 4 * TILE);
        b.y = homeY;
        b.setState('tpin'); Sound.play('teleport', { x: b.x, pitch: 1.6 });
        FX.burst(b.x, b.y - 40, { n: 24, c: ['#ffffff', col, '#dff4ff'], sp: [40, 140], glow: true });
      }
      break;
    case 'tpin':
      b.blink = b.stT / 0.35; b.intangible = false;
      if (b.stT > 0.35) { b.blink = 1; b.setState('idle', 'idle'); b.cd = Math.min(b.cd, 0.3); }
      break;
    default: b.setState('idle', 'idle');
  }
};

// ---------------- 荒鬼武将 (reworked: pure brawler with a rage cycle) ----------------
BOSS_AI.warden = function (b, dt) {
  const p = G.player, dx = p.x - b.x, d = Math.abs(dx);
  const oni = b.oni > 0;
  const fast = (b.phase > 1 ? 0.82 : 1) * (oni ? 0.65 : 1);
  const col = oni ? '#ff4a2a' : '#ffa040';
  const dmg = b.D.dmg * (oni ? 1.25 : 1);
  switch (b.state) {
    case 'idle': {
      b.faceTarget();
      if (d > 70) { b.vx = approach(b.vx, b.face * b.D.speed * (b.phase > 1 ? 1.2 : 1) * (oni ? 1.35 : 1), 400 * dt); b.setAnim('walk'); }
      else { b.vx = approach(b.vx, 0, 600 * dt); b.setAnim('idle'); }
      if (b.cd <= 0) {
        const a = b.pickAttack([
          { id: 'combo', w: d < 100 ? 4 : 0.6 },
          { id: 'dash', w: d > 90 ? 3 : 1 },
          { id: 'boulder', w: 2 },
          { id: 'slam', w: 1.6 },
          { id: 'breath', w: 2.4, ok: b.phase > 1 || oni },
        ]);
        b.vx = 0; b.n = 0; b.fired = false;
        if (a === 'combo') { b.setState('windSlash', 'windSlash'); b.telegraph(0.55 * fast); }
        else if (a === 'dash') { b.setState('windDash', 'crouch'); b.telegraph(0.5 * fast); Sound.play('charge', { x: b.x, pitch: 0.6 }); }
        else if (a === 'boulder') { b.setState('throw', 'pods'); b.telegraph(0.45); }
        else if (a === 'slam') { b.setState('crouch', 'crouch'); b.telegraph(0.4); }
        else if (a === 'breath') { b.setState('drink', 'aim'); Sound.play('charge', { x: b.x, pitch: 0.45 }); }
      }
      break;
    }
    case 'windSlash':
      b.faceTarget();
      if (b.stT > (b.n ? 0.3 : 0.55) * fast) {
        b.setState('slash', 'slash'); b.vx = b.face * (b.n === 2 ? 260 : 150);
        bossBox(b, [-14, -74, 96, 74], dmg * (b.n === 2 ? 1.25 : 1), 0.16);
        FX.slash(b.x + b.face * 14, b.y - 36, { r: 50, a0: b.n % 2 ? 90 : -120, a1: b.n % 2 ? -120 : 80, th: 12, c: col, f: b.face, dur: 0.25, sy: 0.9 });
        Sound.play('slashHeavy', { x: b.x, pitch: 0.6 + b.n * 0.08 }); Cam.shake(0.3);
        if (b.n === 2) eShockwave(b, b.x + b.face * 40, b.y, b.face, 12 * b.dmgMul);
      }
      break;
    case 'slash':
      b.vx = approach(b.vx, 0, 700 * dt);
      if (b.stT > 0.34 * fast) {
        b.n++;
        if (b.n < 3) { b.setState('windSlash', 'windSlash'); b.tele = 0.2; }
        else { b.setState('recover', 'idle'); }
      }
      break;
    case 'windDash':
      b.faceTarget();
      if (b.stT > 0.5 * fast) { b.setState('dash', 'dash'); b.dx0 = b.x; b.dbox = bossBox(b, [-10, -60, 60, 60], dmg, 3); Sound.play('dash', { x: b.x, pitch: 0.5 }); }
      break;
    case 'dash':
      b.vx = b.face * (oni ? 460 : b.phase > 1 ? 410 : 360);
      FX.ghost(b.frame(), b.spr.ox, b.spr.oy, b.x, b.y, b.face < 0, col, 0.25, 0.4);
      if (Math.random() < 0.5) FX.sparks(b.x - b.face * 10, b.y - 2, b.face > 0 ? Math.PI : 0, '#ffd36a', 2);
      if (b.hitWall || Math.abs(b.x - b.dx0) > 320 || b.stT > 1.2) {
        if (b.dbox) b.dbox.life = 0;
        if (b.hitWall) { Cam.shake(0.35); Sound.play('stomp', { x: b.x }); }
        b.setState('recover', 'idle'); b.vx = 0;
      }
      break;
    case 'throw':
      // hurls burning boulders that leave fire on the ground
      b.vx = 0;
      if (b.stT > 0.45 && !b.fired) {
        b.fired = true;
        const n = b.phase > 1 || oni ? 3 : 2;
        for (let i = 0; i < n; i++) {
          const tx = clamp(p.x + (i - (n - 1) / 2) * 60 + rand(-14, 14), 3 * TILE, G.room.pw - 3 * TILE);
          const ty = G.room.floorBelow(tx, p.y - 30), T = 0.85 + i * 0.12;
          const sx = b.x + b.face * 10, sy = b.y - 70;
          warnMarker(tx, ty, 22, col, T);
          const pr = new Proj({ team: 'e', x: sx, y: sy, vx: (tx - sx) / T, vy: (ty - sy - 0.5 * 700 * T * T) / T, grav: 700, kind: 'fireball', r: 6, c: col, dmg: 14 * b.dmgMul, life: 3, light: 70, ghost: true });
          pr.upd = q => { if (q.t > 0.2 && q.vy > 0 && q.y >= ty - 4) { q.life = 0; explodeE(q.x, ty - 6, 26, 14 * b.dmgMul, { c: col }); firePatch({ D: { dmg: 10 }, dmgMul: b.dmgMul }, q.x, ty); } };
          G.projs.push(pr);
        }
        Sound.play('swoosh', { x: b.x, pitch: 0.5 });
      }
      if (b.stT > 1.2) { b.setState('idle', 'idle'); b.cd = rand(0.7, 1.2) * fast; }
      break;
    case 'drink':
      b.vx = 0; b.faceTarget();
      if (Math.random() < 0.4) FX.fire(b.x + b.face * 14, b.y - 52, 1);
      if (b.stT > 0.6) { b.setState('breath', 'aim'); b.bdir = b.face; Sound.play('fire', { x: b.x, pitch: 0.6 }); }
      break;
    case 'breath': {
      // oni fire breath: a long cone in front for over a second
      b.vx = 0; b.face = b.bdir;
      const x0 = b.x + b.bdir * 22, y0 = b.y - 58;
      for (let i = 0; i < 5; i++) { const a = rand(-0.3, 0.45); FX.add({ k: 'px', x: x0, y: y0, vx: Math.cos(a) * rand(220, 380) * b.bdir, vy: Math.sin(a) * rand(220, 380), life: rand(0.3, 0.5), s: rand(2, 4), c: pick(['#ff8a3a', '#ffd23f', '#ff4a1a']), shrink: true, glow: true, add: true }); }
      Light.add(x0 + b.bdir * 70, y0 + 20, 150, '#ff7a2a', 1);
      b.btick = (b.btick || 0) - dt;
      if (b.btick <= 0) {
        b.btick = 0.18;
        const lo = b.bdir > 0 ? x0 : x0 - 150;
        Combat.area('e', lo, y0 - 4, 150, 64, { dmg: 9 * b.dmgMul }, 0.12, { owner: b });
        if (Math.random() < 0.5) Sound.play('fire', { x: b.x, pitch: rand(0.7, 1) });
      }
      if (b.stT > 1.3) { b.setState('recover', 'idle'); }
      break;
    }
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
    case 'roarOni':
      b.vx = 0;
      if (Math.random() < 0.6) FX.fire(b.x + rand(-20, 20), b.y - rand(10, 60), 2, true);
      if (b.stT > 0.9) { b.setState('idle', 'idle'); b.cd = 0.1; }
      break;
    case 'exhaust':
      b.vx = approach(b.vx, 0, 600 * dt);
      if (Math.random() < 0.2) FX.add({ k: 'px', x: b.x + rand(-10, 10), y: b.y - b.h - rand(0, 6), vx: 0, vy: -20, life: 0.5, s: 2, c: '#a8a0a0' });
      if (b.exhaust <= 0) { b.setState('idle', 'idle'); b.cd = 0.4; }
      break;
    case 'recover':
      b.vx = approach(b.vx, 0, 800 * dt);
      if (b.stT > 0.75 * fast) { b.setState('idle', 'idle'); b.cd = rand(0.4, 0.9) * fast; }
      break;
    default: b.setState('idle', 'idle');
  }
};

// ---------------- traits ----------------
Object.assign(BOSS_TRAITS, {
  // 鬼怒: hits build rage → 鬼化 (super armor, faster, harder) → 力竭 (vulnerable)
  warden: {
    hurt(b, h) {
      if (b.oni > 0 || b.exhaust > 0 || h.dot) return;
      b.rage = Math.min(100, (b.rage || 0) + (h.heavy ? 6 : 3.2));
      if (b.rage >= 100) {
        b.rage = 0; b.oni = 6.5; b.noStagger = true;
        b.cancelAttack(); b.noGrav = false; b.setState('roarOni', 'pods'); b.vx = 0;
        Sound.play('roar', { x: b.x, pitch: 0.8 }); Cam.shake(0.7);
        FX.screenFlash('#ff3a1a', 0.35, 0.4); FX.ring(b.x, b.cy, 10, 120, '#ff4a2a', 0.6, 4);
        G.bossPhaseText = { t: 1.6, text: '鬼化' };
      }
    },
    taken(b) { return b.exhaust > 0 ? 1.5 : 1; },
    update(b, dt) {
      if (b.oni > 0) {
        b.oni -= dt;
        if (Math.random() < 0.5) FX.fire(b.x + rand(-16, 16), b.y - rand(10, 64), 1, true);
        if (b.oni <= 0) {
          b.noStagger = false; b.exhaust = 2.6; b.cancelAttack(); b.noGrav = false;
          b.setState('exhaust', 'crouch'); b.vx = 0;
          FX.text(b.x, b.y - b.h - 12, '力竭', '#ffd36a', { size: 12, life: 1.2 });
          Sound.play('clank', { x: b.x, pitch: 0.5 });
        }
      }
      if (b.exhaust > 0) b.exhaust -= dt;
    },
    phase(b, n) {
      // calls two 落武者 to his side once
      if (b.summoned) return;
      b.summoned = true;
      for (const side of [-1, 1]) later(0.6, () => {
        if (b.dead) return;
        const x = clamp(b.x + side * 120, 4 * TILE, G.room.pw - 4 * TILE);
        const m = new Enemy('soldier', x, G.room.floorBelow(x, b.y - 30));
        m.hp = m.maxHp = Math.round(m.maxHp * 1.2);
        G.enemies.push(m); b.minions.push(m);
      });
    },
    draw(b, ctx, gctx, x, y) {
      if (b.oni > 0) {
        const fr = b.frame(), a = 0.45 + 0.25 * Math.sin(G.time * 14);
        drawFrame(gctx, fr, b.spr.ox, b.spr.oy, x, y, b.face < 0, { tint: '#ff3a1a', alpha: a });
        Light.add(b.x, b.cy, 150, '#ff4a2a', 1);
      }
    },
  },
  // 寒气: frost stacks on the player fade slowly
  yukionna: {
    update(b) {
      const c = G.player && G.player.counters;
      if (c && c.frost > 0 && G.time - (c.frostT || 0) > 2.6) { c.frost--; c.frostT = G.time; }
    },
    draw(b, ctx, gctx, x, y) {
      const p = G.player, c = p && p.counters;
      if (!c || !(c.frost > 0)) return;
      const px = p.x - (b.x - x), py = p.y - (b.y - y) - p.h - 12;
      for (let i = 0; i < 5; i++) {
        const on = i < c.frost, sx = Math.round(px - 12 + i * 6);
        ctx.fillStyle = on ? '#dff4ff' : 'rgba(80,100,140,0.6)';
        ctx.fillRect(sx, py, 4, 4); ctx.fillRect(sx + 1, py - 1, 2, 6); ctx.fillRect(sx - 1, py + 1, 6, 2);
        if (on) { gctx.fillStyle = '#9fd8ff'; gctx.fillRect(sx - 1, py - 1, 6, 6); }
      }
    },
  },
  // 晶壁: crystal pylons shield her until all are shattered
  empress: {
    update(b) {
      const thr = [0.66, 0.33];
      b.wall = b.wall || 0;
      if (b.wall < 2 && !b.pylons && b.hp < b.maxHp * thr[b.wall]) {
        b.wall++;
        b.shielded = true; b.pylons = [];
        const R = G.room;
        [0.18, 0.5, 0.82].forEach((f, i) => later(i * 0.25, () => {
          if (b.dead) return;
          const x = R.pw * f, m = new Enemy('prism', x, R.floorBelow(x, R.base * TILE - 30));
          m.hp = m.maxHp = Math.round(m.maxHp * 0.85); m.pylon = true;
          G.enemies.push(m); b.minions.push(m); b.pylons.push(m);
        }));
        G.bossPhaseText = { t: 1.8, text: '晶壁' };
        Sound.play('shatter', { x: b.x, pitch: 0.5 }); FX.ring(b.x, b.y - 64, 10, 80, '#7ff7ff', 0.6, 3);
      }
      if (b.pylons && b.stT >= 0 && b.pylons.length && b.pylons.every(m => m.dead) && b.pylons.length === 3) {
        b.pylons = null; b.shielded = false;
        b.cancelAttack(); b.lasersOn = false; b.setState('stagger', 'hurt'); b.stT = -1.4;
        FX.text(b.x, b.y - b.h - 12, '晶壁崩塌', '#7ff7ff', { size: 12, life: 1.2 });
        FX.screenFlash('#7ff7ff', 0.3, 0.3); Sound.play('shatter', { x: b.x, pitch: 0.4 });
      }
    },
    taken(b) { return b.shielded ? 0.1 : 1; },
    draw(b, ctx, gctx, x, y) {
      if (!b.shielded) return;
      const r = 42 + Math.sin(G.time * 4) * 2;
      ctx.globalAlpha = 0.5; ctx.strokeStyle = '#7ff7ff'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = 0; k <= 6; k++) { const a = k * TAU / 6 + G.time * 0.5; const px = x + Math.cos(a) * r, py = y - 60 + Math.sin(a) * r * 0.9; if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
      ctx.stroke(); ctx.globalAlpha = 1;
      gctx.globalAlpha = 0.25; gctx.fillStyle = '#45f0ff'; gctx.beginPath(); gctx.arc(x, y - 60, r, 0, TAU); gctx.fill(); gctx.globalAlpha = 1;
      for (const m of b.pylons || []) if (!m.dead && !m.spawning) {
        const mx = m.x - (b.x - x), my = m.y - 22 - (b.y - y);
        ctx.globalAlpha = 0.4 + 0.3 * Math.sin(G.time * 10); ctx.strokeStyle = '#bff8ff';
        ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(x, y - 60); ctx.stroke(); ctx.globalAlpha = 1;
      }
    },
  },
  // 熵蚀: in the final phase the void eats the arena from both sides
  king: {
    update(b, dt) {
      if (b.phase < 3) return;
      const R = G.room;
      b.voidW = Math.min(R.pw * 0.2, (b.voidW || 2 * TILE) + dt * 14);
      b.voidTick = (b.voidTick || 0) - dt;
      const p = G.player;
      if (b.voidTick <= 0 && p && !p.dead && (p.x < b.voidW || p.x > R.pw - b.voidW)) { b.voidTick = 0.5; hurtPlayer(9 * b.dmgMul, p.x < b.voidW ? 0 : R.pw, { noStagger: true }); }
    },
    draw(b, ctx, gctx, x, y) {
      if (!(b.voidW > 0)) return;
      const camX = b.x - x, camY = b.y - y, R = G.room;
      for (const side of [0, 1]) {
        const x0 = side ? R.pw - b.voidW - camX : -camX, w = b.voidW;
        ctx.fillStyle = 'rgba(8,0,5,0.8)'; ctx.fillRect(x0, -camY, w, R.ph);
        const ex = side ? x0 : x0 + w - 2;
        ctx.fillStyle = '#ff3048'; ctx.fillRect(ex, -camY, 2, R.ph);
        gctx.fillStyle = '#ff3048'; gctx.globalAlpha = 0.6; gctx.fillRect(ex - 3, -camY, 8, R.ph); gctx.globalAlpha = 1;
        if (Math.random() < 0.8) FX.add({ k: 'px', x: (side ? R.pw - b.voidW : b.voidW) + rand(-4, 4), y: b.y - rand(0, 160), vx: (side ? -1 : 1) * rand(5, 30), vy: -rand(10, 40), life: 0.6, s: 2, c: pick(['#ff3048', '#000000', '#ffd0d8']), glow: true });
      }
    },
  },
});
