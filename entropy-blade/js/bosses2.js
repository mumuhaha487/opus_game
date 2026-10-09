'use strict';
// =====================================================================
//  BOSSES (2/2) — 雪女·白霜, the bosses of the alternative maps, and the
//  signature traits of every boss:
//   荒鬼武将 鬼怒 · 雪女 寒气 · 晶核女皇 晶壁 · 熵之王 熵蚀
//   蟾仙·大蟇 蟾毒 · 流沙蝎后 流沙 · 炎铸巨像 过热
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
  bakeMapBosses();
}
BOSS_DEFS.yukionna = {
  name: '雪女·白霜', en: 'YUKI-ONNA', title: '寒山雪夜的游魂', hp: 1750, tier: 1, w: 22, h: 64, dmg: 13, gold: [70, 90], spr: 'yukionna', speed: 105, kb: 0.1, poise: 22, flying: true,
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

// =====================================================================
//  BOSSES OF THE ALTERNATIVE MAPS
//   瘴雨沼泽 蟾仙·大蟇   — crushing leaps, a grabbing tongue, venom that pools
//   黄沙废城 流沙蝎后   — claws, a spear-like tail, tunnels that open quicksand
//   熔铸炉城 炎铸巨像   — hammer, furnace breath, molten pours; overheats and kneels
// =====================================================================
function drawToad(x, o) {
  const t = o.t, br = Math.sin(t * TAU) * 0.6, cr = o.crouch ? 3 : 0, air = o.air;
  const cy = -14 + cr - (air ? 4 : 0);
  if (air) { x.line(-12, cy + 4, -24, cy + 14, 5, '#4a6a2e'); x.line(-24, cy + 14, -30, cy + 16, 4, '#4a6a2e'); }
  else { x.ell(-12, cy + 9, 11, 7, 0, '#4a6a2e'); x.ell(-14, cy + 13, 8, 2.6, 0, '#3a5424'); }
  // a broad warty body with a pale belly
  x.ell(0, cy, 22, 15 + br, 0, '#5e8a3a');
  x.ell(2, cy + 5, 16, 8, 0, '#d8d49a');
  for (const [wx, wy] of [[-12, -8], [-4, -12], [6, -10], [-16, 0], [10, -4]]) x.circ(wx, cy + wy, 1.8, '#7aa64a');
  x.line(12, cy + 6, 15, -1, 4, '#4e7a30'); x.ell(16, -1, 4, 1.6, 0, '#4e7a30');
  // a sage's sash and prayer beads
  x.poly([[-14, cy - 6], [10, cy + 8], [8, cy + 11], [-16, cy - 3]], '#6a3a8a');
  for (let k = 0; k < 6; k++) x.circ(-10 + k * 4, cy - 2 + k * 2.2, 1.4, '#e8c070');
  // head: a wide mouth, a throat sac that swells before it spits
  const hy = cy - 10;
  x.ell(10, hy + 2, 13, 9, 0, '#5e8a3a');
  if (o.throat || o.spit) x.ell(12, hy + 9, 7 + (o.spit ? 2 : 0), 5 + (o.spit ? 2 : 0), 0, '#e8d8a0');
  if (o.mouth) { x.poly([[2, hy + 3], [23, hy + 1], [23, hy + 7], [3, hy + 6]], '#3a1418'); x.ell(14, hy + 5, 4, 1.6, 0, '#d86a7a'); }
  else x.line(2, hy + 4, 22, hy + 3, 1, '#2a4418');
  x.circ(5, hy - 6, 4, '#5e8a3a'); x.circ(15, hy - 6, 4, '#5e8a3a');
  const eye = o.glow ? '#ffffff' : '#ffd23f';
  x.ell(5.5, hy - 6.5, 2.4, 2, 0, eye); x.rect(5, hy - 7.5, 1, 2.6, '#1a1008');
  x.ell(15.5, hy - 6.5, 2.4, 2, 0, eye); x.rect(15, hy - 7.5, 1, 2.6, '#1a1008');
  // long white brows and beard of an old hermit
  x.poly([[1, hy - 9], [-6, hy - 14], [-1, hy - 8]], '#efe8d8'); x.poly([[19, hy - 9], [24, hy - 15], [19, hy - 7]], '#efe8d8');
  x.poly([[16, hy + 6], [20, hy + 16], [14, hy + 9]], '#efe8d8');
  // a gourd slung on its back
  x.circ(-16, cy - 14, 4, '#c88a3a'); x.circ(-16, cy - 20, 3, '#c88a3a'); x.rect(-17, cy - 25, 2, 2, '#8a5a20');
}
function drawScorpQueen(x, o) {
  const ph = o.t * TAU, walk = o.walk, cy = -14 + (o.burrow ? 8 : 0);
  for (let i = 0; i < 4; i++) {
    const lx = -12 + i * 7, s = walk ? Math.sin(ph * 2 + i * 1.7) * 3 : Math.sin(ph + i) * 0.4;
    x.line(lx, cy + 3, lx - 6 + s, cy + 8, 2.4, '#5a3a1a'); x.line(lx - 6 + s, cy + 8, lx - 8 + s, 0, 2, '#5a3a1a');
    x.line(lx, cy + 3, lx + 6 - s, cy + 8, 2.4, '#6a4422'); x.line(lx + 6 - s, cy + 8, lx + 8 - s, 0, 2, '#6a4422');
  }
  // segmented golden carapace
  x.ell(0, cy, 22, 8, 0, '#c8903a');
  for (let k = -16; k <= 14; k += 6) { x.rect(k, cy - 7, 2, 13, '#8a5a20'); x.rect(k + 2, cy - 7, 3, 2, '#f0c060'); }
  x.ell(0, cy + 4, 18, 3, 0, '#7a4a1c');
  // head with a crown-like crest and a turquoise gem
  x.ell(21, cy - 1, 8, 6, 0, '#c8903a');
  x.poly([[16, cy - 6], [18, cy - 13], [21, cy - 7], [24, cy - 14], [26, cy - 6]], '#ffd36a');
  x.rect(21, cy - 10, 2, 2, '#45d8c8');
  for (const ex of [22, 25]) x.rect(ex, cy - 3, 1.6, 1.6, o.glow ? '#ffffff' : '#ff3a2a');
  // pincers, open when she strikes
  const op = o.claw ? 1 : 0;
  for (const side of [-1, 1]) {
    const by = cy + side * 2;
    x.line(26, by, 34 + op * 6, by - 3 + side * 2, 3, '#b8803a');
    x.ell(38 + op * 6, by - 4 + side * 2, 6, 3.4, side * 0.3, '#c8903a');
    x.poly([[42 + op * 6, by - 6 + side * 2], [48 + op * 8, by - 8 + side * (2 + op * 3)], [44 + op * 6, by - 3 + side * 2]], '#f0c060');
  }
  // the tail: a high arc, or thrown forward over her head to stab
  const pts = o.stab ? [[-20, cy - 2], [-26, cy - 14], [-20, cy - 28], [-6, cy - 36], [10, cy - 36], [24, cy - 30], [32, cy - 20]]
    : [[-20, cy - 2], [-30, cy - 12], [-32, cy - 26], [-24, cy - 38], [-12, cy - 42], [-4, cy - 38], [-2, cy - 30]];
  for (let k = 0; k < pts.length - 1; k++) { x.line(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], 6 - k * 0.6, k % 2 ? '#c8903a' : '#a87030'); x.circ(pts[k][0], pts[k][1], 3.4 - k * 0.3, '#f0c060'); }
  const tp = pts[pts.length - 1];
  x.poly([[tp[0] - 3, tp[1] - 2], [tp[0] + 3, tp[1] - 2], [tp[0] + 1, tp[1] + 7]], '#ff5a3a');
  x.circ(tp[0], tp[1] - 1, 2, o.glow ? '#ffffff' : '#ffd36a');
}
// 炎铸巨像: a bronze furnace-golem with a forge hammer
const COLOSSUS_LOOK = {
  build: BUILDS.hulk, outline: '#0a0606',
  col: { pants: '#5a4030', boot: '#3a2a20', sleeve: '#8a5a2a', hand: '#6a4422' },
  kneePad: '#b8803a', shinCol: '#6a4a2a', gauntlet: '#4a3a30',
  stance: { lean: 4, aF: [70, 30], aB: [95, 60], w: 40, lF: [66, 100], lB: [112, 92] },
  runArms: s => ({ aF: [70 + 12 * s, 30], aB: [95 - 12 * s, 60], w: 40 }),
  airArms: { aF: [-60, -90], aB: [130, 120], w: -100 },
  torso(x, J, B, p) {
    drawTorsoBase(x, J, B, this, p, '#8a5a2a', '#5a3a1c');
    local(x, J.chest, p.lean, () => {
      // furnace chest behind a grille (white-hot while it vents)
      x.rect(-6, -6, 12, 11, '#2a1a12');
      x.rect(-5, -5, 10, 9, p.fx > 0.5 ? '#ffffff' : '#ff7a2a'); x.rect(-5, -1, 10, 3, '#ffd36a');
      if (p.fx <= 0.5) for (let k = -4; k <= 4; k += 3) x.rect(k, -5, 1, 9, '#2a1a12');
      x.rect(-8, -8, 16, 2, '#c8903a'); x.rect(-8, 6, 16, 2, '#c8903a');
    });
    local(x, J.sF, p.lean, () => { x.rect(-5, -3, 10, 7, '#b8803a'); x.rect(-5, -3, 10, 1.4, '#f0c060'); for (const rx of [-3, 2]) x.rect(rx, 0, 1.2, 1.2, '#5a3a1c'); });
  },
  head(x, J, B, p) {
    local(x, J.head, J.headA / DEG, () => {
      x.rect(-4.5, -5, 9.5, 9, '#8a5a2a'); x.rect(-4.5, -5, 9.5, 1.6, '#c8903a');
      x.rect(0, -2, 5, 2, '#1a0e0a'); x.rect(1, -1.6, 3.4, 1.2, p.eye ? '#ffd36a' : '#5a3010');
      x.rect(-4.5, 2, 9.5, 2, '#5a3a1c');
      x.rect(-3, -9, 3, 4, '#5a3a1c'); x.rect(1.5, -10, 3, 5, '#5a3a1c');
    });
  },
  weapon(x, J, B, p) {
    local(x, J.hF, p.w, () => {
      x.line(-8, 0, 26, 0, 2.4, '#3a2418');
      x.rect(24, -8, 11, 16, '#4a4448'); x.rect(24, -8, 11, 2.4, '#8a8088'); x.rect(33, -8, 2, 16, '#2a2628');
      x.rect(26, -3, 6, 6, '#ff7a2a');
    });
  },
};

function bakeMapBosses() {
  const ts = (x, o) => { x.scale(1.6, 1.6); drawToad(x, o); };
  bakeCustom('toad', 160, 120, 80, 116, {
    idle: { n: 6, loop: true, fps: 6, draw: (x, t) => ts(x, { t, throat: Math.sin(t * TAU) > 0.3 }) },
    crouch: { n: 2, loop: true, fps: 10, draw: (x, t, i) => ts(x, { t, crouch: true, glow: i === 0 }) },
    air: { n: 1, draw: x => ts(x, { t: 0.25, air: true }) },
    mouth: { n: 1, draw: x => ts(x, { t: 0, mouth: true }) },
    spit: { n: 2, loop: true, fps: 8, draw: (x, t, i) => ts(x, { t, spit: true, throat: true, glow: i === 0 }) },
    hurt: { n: 1, draw: x => ts(x, { t: 0.5, crouch: true }) },
  });
  const qs = (x, o) => { x.scale(1.5, 1.5); drawScorpQueen(x, o); };
  bakeCustom('scorpqueen', 172, 116, 74, 110, {
    idle: { n: 6, loop: true, fps: 6, draw: (x, t) => qs(x, { t }) },
    walk: { n: 6, loop: true, fps: 12, draw: (x, t) => qs(x, { t, walk: true }) },
    claw: { n: 2, loop: true, fps: 12, draw: (x, t, i) => qs(x, { t, claw: true, glow: i === 0 }) },
    stab: { n: 1, draw: x => qs(x, { t: 0, stab: true, glow: true }) },
    burrow: { n: 2, loop: true, fps: 10, draw: (x, t) => qs(x, { t, burrow: true, walk: true }) },
    hurt: { n: 1, draw: x => qs(x, { t: 0.3 }) },
  });
  bakeRig('colossus', COLOSSUS_LOOK, {
    idle: { n: 6, gen: 'idle', loop: true, fps: 5 },
    walk: { n: 8, gen: 'run', loop: true, fps: 7 },
    hurt: { n: 1, gen: 'hurt' },
    raise: { n: 1, gen: L => fullPose(L, { lean: -10, aF: [-150, -160], aB: [-130, -150], w: -170 }) },
    slam: { n: 3, fps: 16, gen: (L, t) => fullPose(L, { lean: lerp(-6, 28, t), aF: [lerp(-120, 60, t), lerp(-120, 80, t)], aB: [lerp(-100, 70, t), lerp(-100, 90, t)], w: lerp(-150, 95, t), lF: [40, 100], lB: [130, 100] }) },
    sweepW: { n: 1, gen: L => fullPose(L, { lean: -14, aF: [170, 160], aB: [150, 140], w: 175, lF: [70, 100], lB: [115, 95] }) },
    sweep: { n: 3, fps: 18, gen: (L, t) => fullPose(L, { lean: lerp(-10, 20, t), aF: [lerp(170, 10, t), lerp(160, 0, t)], aB: [lerp(150, 40, t), lerp(140, 30, t)], w: lerp(175, -10, t), lF: [40, 100], lB: [130, 100] }) },
    breath: { n: 2, fps: 8, loop: true, gen: (L, t) => fullPose(L, { lean: 14, aF: [110, 80], aB: [120, 90], w: 110, fx: 1, y: t * 0.5 }) },
    vent: { n: 2, fps: 6, loop: true, gen: (L, t) => fullPose(L, { lean: 26, y: 4, aF: [80, 95], aB: [100, 95], w: 95, lF: [10, 100], lB: [170, 90], head: 25, fx: t < 0.5 ? 1 : 0 }) },
    throw: { n: 2, fps: 10, gen: (L, t) => fullPose(L, { lean: lerp(-8, 10, t), aB: [lerp(-140, -60, t), lerp(-150, -50, t)], aF: [70, 30], w: 40 }) },
  }, 170, 140, 85, 134, 2.1);
}

Object.assign(BOSS_DEFS, {
  toad: {
    name: '蟾仙·大蟇', en: 'GAMA, THE MIRE SAGE', title: '瘴泽深处修行千年的老蟾', hp: 1400, tier: 0, w: 54, h: 46, dmg: 16, gold: [60, 80], spr: 'toad', speed: 60, kb: 0.1, poise: 30,
    stars: 2, style: '跳跃压制 · 毒沼', trait: '蟾毒', traitDesc: '吐出的毒涎落地化作毒沼，站在其中持续受伤；狂暴后长舌能把你卷进口中再吐出',
    music: 'bossMire',
  },
  scorpqueen: {
    name: '流沙蝎后', en: 'DUNE SCORPION QUEEN', title: '黄沙之下沉睡的女王', hp: 1750, tier: 1, w: 70, h: 40, dmg: 16, gold: [70, 90], spr: 'scorpqueen', speed: 80, kb: 0.1, poise: 26,
    stars: 3, style: '钻地 · 突袭', trait: '流沙', traitDesc: '钻入沙下时无法被攻击；破土之处化作流沙，陷进去会被拖慢、拖向中心',
    music: 'bossDune',
  },
  colossus: {
    name: '炎铸巨像', en: 'CINDER COLOSSUS', title: '炉城不熄的守门铁像', hp: 2300, tier: 2, w: 40, h: 72, dmg: 18, gold: [80, 100], spr: 'colossus', speed: 55, kb: 0.1, poise: 34,
    stars: 3, style: '重击 · 过热', trait: '过热', traitDesc: '每次出招都会积蓄炉温；炉温满时喷出蒸汽并跪地散热，此间炉心敞开，受到伤害 +60%',
    music: 'bossForge',
  },
});

// ---------------- hazards ----------------
// 毒沼: a venom pool on the floor
function toadPuddle(b, x, life = 4) {
  const R = G.room;
  if (x < 2.5 * TILE || x > R.pw - 2.5 * TILE) return;
  const y = R.floorBelow(x, b.y - 40);
  addZone({
    x, y, life, tick: 0.5, r: 24,
    onTick(z) { const p = G.player; if (p && !p.dead && Math.abs(p.x - z.x) < z.r && p.y > z.y - 8 && p.y <= z.y + 4) hurtPlayer(7 * b.dmgMul, z.x, { noStagger: true }); },
    upd(z) { if (Math.random() < 0.25) FX.add({ k: 'px', x: z.x + rand(-z.r, z.r), y: z.y - 1, vx: 0, vy: -rand(10, 30), life: 0.5, s: rand(1.5, 3), c: pick(['#b8f060', '#7aa848']), glow: true }); },
    drawFn(ctx, gctx, X, Y, z) {
      const a = Math.min(1, z.t * 5, z.life);
      ctx.globalAlpha = 0.75 * a; ctx.fillStyle = '#5a8a2a'; ctx.beginPath(); ctx.ellipse(X, Y - 1, z.r, 3, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#b8f060'; ctx.fillRect(Math.round(X - z.r * 0.6), Math.round(Y - 3), Math.round(z.r * 0.5), 1);
      ctx.globalAlpha = 1;
      gctx.globalAlpha = 0.4 * a; gctx.fillStyle = '#b8f060'; gctx.fillRect(X - z.r, Y - 4, z.r * 2, 4); gctx.globalAlpha = 1;
    },
  });
}
// 流沙: a sinkhole that halves your footing and drags you to its middle
function quicksand(b, x, life = 3.2) {
  const R = G.room, y = R.floorBelow(x, b.y - 40);
  addZone({
    x, y, life, r: 46,
    upd(z, dt) {
      const p = G.player;
      if (p && !p.dead && p.onGround && Math.abs(p.x - z.x) < z.r && Math.abs(p.y - z.y) < 6) {
        p.x -= p.vx * dt * 0.55;
        const pull = clamp(z.x - p.x, -1, 1) * 18 * dt;
        if (!R.solidPx(p.x + pull * 4, p.y - 4)) p.x += pull;
        if (!z.told) { z.told = true; FX.text(p.x, p.y - p.h - 8, '流沙', '#ffd070', { size: 8 }); }
      }
      if (Math.random() < 0.4) { const a = rand(0, TAU), r = rand(10, z.r); FX.add({ k: 'px', x: z.x + Math.cos(a) * r, y: z.y - 1, vx: -Math.cos(a) * 30, vy: -rand(0, 10), life: 0.5, s: 1.5, c: pick(['#f0c878', '#c8945c']) }); }
    },
    drawFn(ctx, gctx, X, Y, z) {
      const a = Math.min(1, z.t * 3, z.life * 1.5);
      ctx.globalAlpha = 0.8 * a; ctx.fillStyle = '#a87444'; ctx.beginPath(); ctx.ellipse(X, Y - 1, z.r, 4, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#f0c878'; ctx.lineWidth = 1;
      for (let k = 0; k < 3; k++) { const rr = (z.t * 18 + k * 15) % 45; ctx.beginPath(); ctx.ellipse(X, Y - 1, z.r - rr, Math.max(0.5, 4 - rr * 0.08), 0, 0, TAU); ctx.stroke(); }
      ctx.globalAlpha = 1;
    },
  });
}
// 沙暴: a dust devil that crosses the arena and shoves you along
function dustDevil(b, x0, dir) {
  const R = G.room, floor = x => R.floorBelow(x, R.base * TILE - 30);
  const box = Combat.area('e', x0 - 12, floor(x0) - 60, 24, 60, { dmg: 11 * b.dmgMul }, 6, { owner: b, multi: 0.6 });
  addZone({
    x: x0, y: floor(x0), life: 6,
    upd(z, dt) {
      z.x += dir * 120 * dt; z.y = floor(z.x); box.x = z.x - 12; box.y = z.y - 60;
      const p = G.player;
      if (p && !p.dead && Math.abs(p.x - z.x) < 30 && p.y > z.y - 66 && p.y <= z.y + 4 && !R.solidPx(p.x + dir * 10, p.y - 4)) p.x += dir * 70 * dt;
      for (let i = 0; i < 2; i++) { const h = rand(0, 60), a = z.t * 14 + h * 0.3; FX.add({ k: 'px', x: z.x + Math.cos(a) * (4 + h * 0.25), y: z.y - h, vx: dir * 40, vy: -20, life: 0.3, s: 2, c: pick(['#f0c878', '#e0b070', '#c8945c']) }); }
      if (z.x < 2.5 * TILE || z.x > R.pw - 2.5 * TILE) { z.life = 0; box.life = 0; }
    },
    onEnd() { box.life = 0; },
    drawFn(ctx, gctx, X, Y, z) {
      ctx.globalAlpha = 0.45; ctx.strokeStyle = '#e8c890'; ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) { const yy = Y - 6 - i * 10, w = 6 + i * 3 + Math.sin(z.t * 12 + i) * 2; ctx.beginPath(); ctx.ellipse(X + Math.sin(z.t * 8 + i) * 3, yy, w, 2.5, 0, 0, TAU); ctx.stroke(); }
      ctx.globalAlpha = 1;
    },
  });
}
// slag shaken loose from the foundry ceiling
function slagDrop(b, x) {
  const R = G.room, gy = R.floorBelow(x, R.base * TILE - 30);
  warnMarker(x, gy, 14, '#ff8a3a', 0.6);
  later(0.6, () => {
    const pr = new Proj({ team: 'e', x, y: gy - 190, vx: 0, vy: 520, kind: 'fireball', r: 4, dmg: 13 * b.dmgMul, life: 1.2, ghost: true, light: 40 });
    pr.upd = q => { if (q.y >= gy - 3) { q.life = 0; FX.burst(x, gy - 2, { n: 10, c: ['#ffd36a', '#ff8a2a', '#5a5258'], sp: [40, 120], life: [0.2, 0.5] }); Sound.play('clank', { x, pitch: 0.7 }); } };
    G.projs.push(pr);
  });
}

// ---------------- 蟾仙·大蟇 AI ----------------
BOSS_AI.toad = function (b, dt) {
  const p = G.player, dx = p.x - b.x, d = Math.abs(dx), R = G.room;
  const fast = b.phase > 1 ? 0.8 : 1, col = '#b8f060';
  const mx = b.x + b.face * 30, my = b.y - 32;
  switch (b.state) {
    case 'idle': {
      b.faceTarget(); b.vx = approach(b.vx, 0, 600 * dt); b.setAnim('idle');
      if (b.cd <= 0 && b.onGround) {
        const a = b.pickAttack([
          { id: 'leap', w: d > 120 ? 3 : 1.6 },
          { id: 'tongue', w: d < 240 ? 2.6 : 0.6 },
          { id: 'spit', w: 2.2 },
          { id: 'croak', w: 1.2, ok: b.minions.length < 2 },
          { id: 'rain', w: 2, ok: b.phase > 1 },
        ]);
        b.n = 0; b.fired = false;
        if (a === 'leap') { b.setState('crouch', 'crouch'); b.telegraph(0.5 * fast); b.leaps = b.phase > 1 ? 2 : 1; }
        else if (a === 'tongue') { b.setState('tongueW', 'mouth'); b.telegraph(0.55 * fast); Sound.play('charge', { x: b.x, pitch: 1.4 }); }
        else if (a === 'spit') { b.setState('spit', 'spit'); b.telegraph(0.5); Sound.play('void', { x: b.x, pitch: 0.7 }); }
        else if (a === 'croak') { b.setState('croak', 'spit'); Sound.play('roar', { x: b.x, pitch: 1.6 }); }
        else if (a === 'rain') { b.setState('rain', 'spit'); Sound.play('roar', { x: b.x, pitch: 1.3 }); }
      }
      break;
    }
    case 'crouch':
      b.vx = 0; b.faceTarget();
      if (b.stT > 0.5 * fast) {
        // an arcing leap that comes down where you stand
        const T = 0.85, tx = clamp(p.x, 4 * TILE, R.pw - 4 * TILE);
        b.vy = -0.5 * GRAV * T; b.vx = (tx - b.x) / T;
        b.setState('air', 'air'); Sound.play('jump', { x: b.x, pitch: 0.5 }); FX.dust(b.x, b.y, 14, 0);
      }
      break;
    case 'air':
      if (b.vy > 0 && Math.random() < 0.5) warnMarker(b.x, R.floorBelow(b.x, b.y), 40, col, 0.1);
      if (b.onGround && b.stT > 0.15) {
        b.vx = 0;
        Cam.shake(0.6); Sound.play('stomp', { x: b.x }); Sound.play('explode', { x: b.x, pitch: 0.5 });
        FX.shock(b.x, b.y, col, 70); FX.debris(b.x, b.y - 2, ['#4a5232', '#7a8a52', col], 16);
        if (Math.abs(p.x - b.x) < 56 && p.y > b.y - 40) hurtPlayer(20 * b.dmgMul, b.x);
        eShockwave(b, b.x + 24, b.y, 1, 13 * b.dmgMul); eShockwave(b, b.x - 24, b.y, -1, 13 * b.dmgMul);
        if (--b.leaps > 0) { b.setState('crouch', 'crouch'); b.stT = 0.2; } else b.setState('recover', 'crouch');
      }
      break;
    case 'tongueW':
      b.vx = 0;
      if (b.stT > 0.55 * fast) { b.setState('tongue', 'mouth'); b.tongue = 0; b.tAim = Math.atan2(p.cy - my, p.x - mx); b.caught = false; Sound.play('swoosh', { x: b.x, pitch: 1.2 }); }
      break;
    case 'tongue': {
      // shoots out up to 230 px along the locked angle, then reels back in
      const ext = b.stT < 0.22 ? b.stT / 0.22 : Math.max(0, 1 - (b.stT - 0.34) / 0.3);
      b.tongue = 230 * ext;
      const tx = mx + Math.cos(b.tAim) * b.tongue, ty = my + Math.sin(b.tAim) * b.tongue;
      if (!b.caught && b.stT < 0.4 && dist(tx, ty, p.x, p.cy) < 14) {
        b.caught = true;
        if (hurtPlayer(14 * b.dmgMul, b.x)) {
          if (b.phase > 1) {
            // 吞噬: reeled in and swallowed, then spat back out
            b.tongue = 0; b.setState('swallow', 'spit');
            p.hidden = true; p.state = 'hurt'; p.hurtT = 1.15; p.move = null; p.vx = 0; p.vy = 0; p.x = b.x; p.inv = Math.max(p.inv, 1.4);
            Sound.play('void', { x: b.x, pitch: 0.4 });
            later(1.0, () => {
              if (!p.hidden || p.dead) return;
              p.hidden = false; p.x = clamp(b.x + b.face * 36, 3 * TILE, R.pw - 3 * TILE);
              p.vx = b.face * 360; p.vy = -280; p.state = 'hurt'; p.hurtT = 0.35;
              hurtPlayer(16 * b.dmgMul, b.x, { unavoidable: true, nonlethal: true, noStagger: true, numc: '#b8f060' });
              p.inv = Math.max(p.inv, 0.8);
              FX.burst(p.x, p.cy, { n: 20, c: ['#b8f060', '#ffffff'], sp: [40, 160], glow: true }); Sound.play('explode', { x: p.x, pitch: 1.4 }); Cam.shake(0.4);
            });
            break;
          }
          p.vx = (b.x > p.x ? 1 : -1) * 320; p.vy = -160;
          FX.text(p.x, p.y - p.h - 8, '舌卷', '#ff8aa0', { size: 10 });
        }
      }
      if (b.stT > 0.7) { b.tongue = 0; b.setState('recover', 'idle'); }
      break;
    }
    case 'swallow':
      b.vx = 0;
      if (b.stT > 1.0) b.setState('recover', 'idle');
      break;
    case 'spit':
      b.vx = 0; b.faceTarget();
      if (b.n < (b.phase > 1 ? 3 : 2) && b.stT > 0.5 + b.n * 0.35) {
        b.n++;
        // three globs of venom; each becomes a 毒沼 where it lands
        for (let i = 0; i < 3; i++) {
          const T = 0.8 + i * 0.1, tx = clamp(p.x + (i - 1) * 46 + rand(-10, 10), 3 * TILE, R.pw - 3 * TILE);
          const pr = new Proj({ team: 'e', x: mx, y: my, kind: 'orb', r: 4, c: '#b8f060', c2: '#ffffff', grav: 500, life: 3, dmg: 12 * b.dmgMul, light: 40 });
          pr.vx = (tx - mx) / T; pr.vy = (R.floorBelow(tx, p.y - 20) - 4 - my - 0.5 * 500 * T * T) / T;
          pr.onDie = q => toadPuddle(b, q.x, 4.5);
          G.projs.push(pr);
        }
        Sound.play('shoot', { x: b.x, pitch: 0.6 });
      }
      if (b.stT > 1.6) b.setState('recover', 'idle');
      break;
    case 'croak':
      b.vx = 0;
      if (b.stT > 0.6 && !b.fired) {
        b.fired = true;
        // two 蛙武者 answer the call
        for (const side of [-1, 1]) {
          const x = clamp(b.x + side * 110, 4 * TILE, R.pw - 4 * TILE);
          const m = new Enemy('frogger', x, R.floorBelow(x, b.y - 30));
          G.enemies.push(m); b.minions.push(m);
        }
        FX.ring(b.x, b.cy, 10, 90, col, 0.5, 3);
      }
      if (b.stT > 1.2) b.setState('recover', 'idle');
      break;
    case 'rain':
      b.vx = 0;
      if (b.stT > 0.6 && !b.fired) {
        b.fired = true;
        // venom rains down around you: every drop marked, every drop a pool
        for (let i = 0; i < 7; i++) later(i * 0.16, () => {
          if (b.dead) return;
          const x = clamp(p.x + rand(-140, 140), 3 * TILE, R.pw - 3 * TILE), gy = R.floorBelow(x, p.y - 60);
          warnMarker(x, gy, 18, col, 0.7);
          later(0.7, () => {
            const pr = new Proj({ team: 'e', x, y: gy - 170, vx: 0, vy: 560, kind: 'orb', r: 3.6, c: '#b8f060', c2: '#ffffff', dmg: 12 * b.dmgMul, life: 1, ghost: true, light: 30 });
            pr.upd = q => { if (q.y >= gy - 3) { q.life = 0; toadPuddle(b, x, 3.5); FX.burst(x, gy - 2, { n: 8, c: ['#b8f060', '#7aa848'], sp: [30, 90], life: [0.2, 0.4] }); } };
            G.projs.push(pr);
          });
        });
      }
      if (b.stT > 1.8) b.setState('recover', 'idle');
      break;
    case 'recover':
      b.vx = approach(b.vx, 0, 800 * dt);
      if (b.stT > 0.75 * fast) { b.setState('idle', 'idle'); b.cd = rand(0.5, 1.0) * fast; }
      break;
    default: b.setState('idle', 'idle');
  }
};

// ---------------- 流沙蝎后 AI ----------------
BOSS_AI.scorpqueen = function (b, dt) {
  const p = G.player, d = Math.abs(p.x - b.x), R = G.room;
  const fast = b.phase > 1 ? 0.8 : 1, col = '#ffc850';
  const sand = (x, y) => FX.add({ k: 'px', x: x + rand(-24, 24), y: y - 1, vx: rand(-60, 60), vy: -rand(60, 160), g: 500, life: rand(0.3, 0.6), s: rand(2, 3), c: pick(['#e0b070', '#c8945c', '#f4d8a0']) });
  switch (b.state) {
    case 'idle': {
      b.faceTarget(); b.hidden = false; b.intangible = false;
      if (d > 110) { b.vx = approach(b.vx, b.face * b.D.speed * (b.phase > 1 ? 1.3 : 1), 400 * dt); b.setAnim('walk'); }
      else { b.vx = approach(b.vx, 0, 600 * dt); b.setAnim('idle'); }
      if (b.cd <= 0 && b.onGround) {
        const a = b.pickAttack([
          { id: 'claw', w: d < 120 ? 3.2 : 0.4 },
          { id: 'stab', w: d < 200 ? 2.4 : 1 },
          { id: 'burrow', w: d > 140 ? 2.6 : 1.2 },
          { id: 'spray', w: 2 },
          { id: 'brood', w: 1.1, ok: b.phase > 1 && b.minions.length < 2 },
          { id: 'storm', w: 1.6, ok: b.phase > 1 },
        ]);
        b.vx = 0; b.n = 0; b.fired = false;
        if (a === 'claw') { b.setState('clawW', 'claw'); b.telegraph(0.5 * fast); b.claws = b.phase > 1 ? 2 : 1; }
        else if (a === 'stab') { b.setState('stabW', 'stab'); b.sx = clamp(p.x, b.x - 170, b.x + 170); b.telegraph(0.5); Sound.play('charge', { x: b.x, pitch: 0.9 }); }
        else if (a === 'burrow') { b.setState('dig', 'burrow'); Sound.play('stomp', { x: b.x, pitch: 0.8 }); }
        else if (a === 'spray') { b.setState('spray', 'claw'); b.telegraph(0.45); }
        else if (a === 'brood') { b.setState('brood', 'burrow'); Sound.play('roar', { x: b.x, pitch: 1.5 }); }
        else if (a === 'storm') { b.setState('storm', 'idle'); Sound.play('swoosh', { x: b.x, pitch: 0.4 }); }
      }
      break;
    }
    case 'clawW':
      b.faceTarget();
      if (b.stT > 0.5 * fast) {
        b.setState('claw', 'claw'); b.vx = b.face * 260;
        bossBox(b, [10, -40, 80, 40], b.D.dmg, 0.16);
        FX.slash(b.x + b.face * 50, b.y - 22, { r: 40, a0: -80, a1: 60, th: 10, c: col, f: b.face, dur: 0.22, sy: 0.7 });
        Sound.play('slashHeavy', { x: b.x, pitch: 0.8 }); Cam.shake(0.25);
      }
      break;
    case 'claw':
      b.vx = approach(b.vx, 0, 800 * dt);
      if (b.stT > 0.45) { if (--b.claws > 0) { b.setState('clawW', 'claw'); b.stT = 0.25; } else b.setState('recover', 'idle'); }
      break;
    case 'stabW': {
      b.vx = 0;
      if (b.stT < 0.4) b.sx = lerp(b.sx, clamp(p.x, b.x - 170, b.x + 170), 0.1);
      const gy = R.floorBelow(b.sx, b.y - 20);
      if (Math.random() < 0.5) warnMarker(b.sx, gy, 18, col, 0.1);
      if (b.stT > 0.75 * fast) {
        // the tail comes down like a spear on the marked spot
        b.setState('stab', 'stab');
        Combat.area('e', b.sx - 12, gy - 60, 24, 60, { dmg: 20 * b.dmgMul }, 0.18, { owner: b });
        FX.shock(b.sx, gy, col, 34); FX.debris(b.sx, gy - 2, ['#e0b070', '#8a6438', col], 10);
        FX.add({ k: 'beam', x: b.sx, y: gy, len: 70, w: 8, ang: -Math.PI / 2, c: '#ff8a4a', life: 0.2 });
        Sound.play('stomp', { x: b.sx }); Cam.shake(0.35);
        if (b.phase > 1) { const sx = b.sx; later(0.12, () => { if (!b.dead) { eShockwave(b, sx + 14, gy, 1, 11 * b.dmgMul); eShockwave(b, sx - 14, gy, -1, 11 * b.dmgMul); } }); }
      }
      break;
    }
    case 'stab':
      if (b.stT > 0.6) b.setState('recover', 'idle');
      break;
    case 'dig':
      b.vx = 0;
      if (Math.random() < 0.7) sand(b.x, b.y);
      if (b.stT > 0.6) { b.hidden = true; b.intangible = true; b.setState('tunnel'); }
      break;
    case 'tunnel': {
      const dir = Math.sign(p.x - b.x) || b.face;
      b.face = dir; b.vx = dir * 210 * (b.phase > 1 ? 1.2 : 1);
      if (Math.random() < 0.8) sand(b.x, b.y);
      if (Math.abs(p.x - b.x) < 16 || b.stT > 2.2 || b.hitWall) {
        b.vx = 0; b.setState('surface'); b.telegraph(0.6);
        warnMarker(b.x, R.floorBelow(b.x, b.y - 20), 46, col, 0.6); Sound.play('warn', { x: b.x });
      }
      break;
    }
    case 'surface':
      b.vx = 0;
      if (Math.random() < 0.7) FX.debris(b.x + rand(-30, 30), b.y - 2, ['#e0b070', '#8a6438'], 1);
      if (b.stT > 0.6) {
        b.hidden = false; b.intangible = false;
        b.setState('erupt', 'claw'); b.vy = -380;
        bossBox(b, [-40, -60, 80, 62], 20, 0.25, { onHit: pl => { pl.vy = -420; } });
        quicksand(b, b.x, b.phase > 1 ? 4.5 : 3.2);
        for (let i = 0; i < 16; i++) sand(b.x, b.y);
        Sound.play('explode', { x: b.x, pitch: 0.6 }); Cam.shake(0.5);
      }
      break;
    case 'erupt':
      if (b.onGround && b.stT > 0.2) b.setState('recover', 'idle');
      break;
    case 'spray':
      b.vx = 0; b.faceTarget();
      if (b.n < (b.phase > 1 ? 3 : 2) && b.stT > 0.45 + b.n * 0.3) {
        b.n++;
        // a fan of venom-laced sand from the raised stinger
        const ox = b.x - b.face * 4, oy = b.y - 76, a0 = Math.atan2(p.cy - oy, p.x - ox);
        for (let i = 0; i < 5; i++) {
          const a = a0 + (i - 2) * 0.17 + (b.n % 2 ? 0.08 : 0);
          G.projs.push(new Proj({ team: 'e', x: ox, y: oy, vx: Math.cos(a) * 190, vy: Math.sin(a) * 190, kind: 'shard', r: 3, c: '#ffd070', c2: '#ffffff', dmg: 12 * b.dmgMul, life: 2.6, onHitP: () => venom(G.player, 2.6, 2.5 * b.dmgMul) }));
        }
        Sound.play('shoot', { x: b.x, pitch: 0.7 });
      }
      if (b.stT > 1.4) b.setState('recover', 'idle');
      break;
    case 'brood':
      b.vx = 0;
      if (b.stT > 0.6 && !b.fired) {
        b.fired = true;
        for (const s of [-1, 1]) { const x = clamp(b.x + s * 90, 4 * TILE, R.pw - 4 * TILE); const m = new Enemy('scorp', x, R.floorBelow(x, b.y - 30)); G.enemies.push(m); b.minions.push(m); }
      }
      if (b.stT > 1.1) b.setState('recover', 'idle');
      break;
    case 'storm':
      b.vx = 0;
      if (b.stT > 0.5 && !b.fired) {
        b.fired = true;
        // three dust devils sweep in from the far side
        const from = p.x < R.pw / 2 ? R.pw - 4 * TILE : 4 * TILE, dir = from < R.pw / 2 ? 1 : -1;
        for (let i = 0; i < 3; i++) later(i * 0.7, () => { if (!b.dead) dustDevil(b, from, dir); });
        G.bossPhaseText = { t: 1.4, text: '沙暴' };
      }
      if (b.stT > 2.4) b.setState('recover', 'idle');
      break;
    case 'recover':
      b.vx = approach(b.vx, 0, 800 * dt);
      if (b.stT > 0.7 * fast) { b.setState('idle', 'idle'); b.cd = rand(0.5, 1.0) * fast; }
      break;
    default: b.setState('idle', 'idle');
  }
};

// ---------------- 炎铸巨像 AI ----------------
BOSS_AI.colossus = function (b, dt) {
  const p = G.player, dx = p.x - b.x, d = Math.abs(dx), R = G.room;
  const fast = b.phase > 1 ? 0.82 : 1, col = '#ff8a3a';
  const heat = n => { b.heat = Math.min(100, (b.heat || 0) + n * (b.phase > 1 ? 1.25 : 1)); };
  switch (b.state) {
    case 'idle': {
      b.faceTarget();
      if ((b.heat || 0) >= 100) { b.fired = false; b.vx = 0; b.setState('ventIn', 'vent'); break; }
      if (d > 90) { b.vx = approach(b.vx, b.face * b.D.speed * (b.phase > 1 ? 1.3 : 1), 300 * dt); b.setAnim('walk'); }
      else { b.vx = approach(b.vx, 0, 500 * dt); b.setAnim('idle'); }
      if (b.cd <= 0) {
        const a = b.pickAttack([
          { id: 'slam', w: d < 130 ? 3 : 0.8 },
          { id: 'sweep', w: d < 150 ? 2.2 : 0.4 },
          { id: 'breath', w: d < 200 ? 2 : 0.8 },
          { id: 'rivets', w: d > 120 ? 2.6 : 1.2 },
          { id: 'charge', w: 1.8, ok: b.phase > 1 },
          { id: 'pour', w: 1.8, ok: b.phase > 1 },
        ]);
        b.vx = 0; b.n = 0; b.fired = false;
        if (a === 'slam') { b.setState('raise', 'raise'); b.telegraph(0.7 * fast); Sound.play('charge', { x: b.x, pitch: 0.5 }); }
        else if (a === 'sweep') { b.setState('sweepW', 'sweepW'); b.telegraph(0.55 * fast); }
        else if (a === 'breath') { b.setState('breathW', 'breath'); b.telegraph(0.6); Sound.play('charge', { x: b.x, pitch: 0.8 }); }
        else if (a === 'rivets') b.setState('rivets', 'throw');
        else if (a === 'charge') { b.setState('chargeW', 'raise'); b.telegraph(0.6); Sound.play('void', { x: b.x, pitch: 0.4 }); }
        else if (a === 'pour') { b.setState('pour', 'raise'); Sound.play('warn', { x: b.x }); }
      }
      break;
    }
    case 'raise':
      b.faceTarget();
      if (b.stT > 0.7 * fast) {
        b.setState('slam', 'slam'); heat(28);
        const fx = b.x + b.face * 50, gy = R.floorBelow(fx, b.y - 20);
        bossBox(b, [16, -60, 70, 62], b.D.dmg * 1.2, 0.16);
        FX.shock(fx, gy, col, 70); FX.debris(fx, gy - 2, ['#5a5258', col, '#ffd36a'], 18);
        Sound.play('stomp', { x: b.x }); Sound.play('explode', { x: fx, pitch: 0.5 }); Cam.shake(0.7);
        eShockwave(b, fx + 10, gy, 1, 14 * b.dmgMul); eShockwave(b, fx - 10, gy, -1, 14 * b.dmgMul);
        // the blow shakes slag loose from the ceiling
        for (let i = 0; i < (b.phase > 1 ? 4 : 2); i++) later(0.3 + i * 0.22, () => { if (!b.dead) slagDrop(b, clamp(p.x + rand(-90, 90), 3 * TILE, R.pw - 3 * TILE)); });
      }
      break;
    case 'slam':
      if (b.stT > 0.8 * fast) b.setState('recover', 'idle');
      break;
    case 'sweepW':
      b.vx = 0; b.faceTarget();
      if (b.stT > 0.55 * fast) {
        // low and wide: jump it
        b.setState('sweep', 'sweep'); heat(20); b.vx = b.face * 120;
        bossBox(b, [-20, -40, 120, 30], b.D.dmg, 0.2);
        FX.slash(b.x + b.face * 30, b.y - 22, { r: 70, a0: 170, a1: 0, th: 12, c: col, f: b.face, dur: 0.25, sy: 0.35 });
        Sound.play('slashHeavy', { x: b.x, pitch: 0.5 }); Cam.shake(0.3);
      }
      break;
    case 'sweep':
      b.vx = approach(b.vx, 0, 600 * dt);
      if (b.stT > 0.6) b.setState('recover', 'idle');
      break;
    case 'breathW':
      b.vx = 0; b.faceTarget();
      if (b.stT > 0.6) { b.setState('breath', 'breath'); heat(24); b.bdir = b.face; bossBox(b, [10, -60, 130, 40], 9, 1.0, { multi: 0.3 }); Sound.play('fire', { x: b.x, pitch: 0.6 }); }
      break;
    case 'breath': {
      // a roaring cone of furnace fire from the chest; the ground it licks keeps burning
      b.vx = 0;
      const ox = b.x + b.bdir * 16, oy = b.y - 48;
      for (let i = 0; i < 4; i++) FX.add({ k: 'px', x: ox, y: oy, vx: b.bdir * rand(160, 320), vy: rand(-40, 60), life: rand(0.25, 0.45), s: rand(3, 6), c: pick(['#ffd36a', '#ff8a2a', '#ff5a1a', '#ffffff']), glow: true, add: true, shrink: true });
      Light.add(b.x + b.bdir * 70, b.y - 40, 150, '#ff8a3a', 1);
      if (b.stT > 1.0) { for (let k = 0; k < 3; k++) { const fx = b.x + b.bdir * (50 + k * 36); firePatch(b, fx, R.floorBelow(fx, b.y - 20)); } b.setState('recover', 'idle'); }
      break;
    }
    case 'rivets':
      b.vx = 0; b.faceTarget();
      if (b.n < (b.phase > 1 ? 5 : 3) && b.stT > 0.4 + b.n * 0.18) {
        b.n++; heat(6);
        // red-hot rivets lobbed onto you, each leaving burning ground
        const T = 0.8 + rand(0, 0.15), tx = clamp(p.x + rand(-50, 50), 3 * TILE, R.pw - 3 * TILE), sx = b.x + b.face * 10, sy = b.y - 70;
        const pr = new Proj({ team: 'e', x: sx, y: sy, kind: 'fireball', r: 3.4, grav: 520, life: 3, dmg: 12 * b.dmgMul, light: 40 });
        pr.vx = (tx - sx) / T; pr.vy = (R.floorBelow(tx, p.y - 20) - 4 - sy - 0.5 * 520 * T * T) / T;
        pr.onDie = q => firePatch(b, q.x, R.floorBelow(q.x, q.y - 10));
        G.projs.push(pr); Sound.play('shoot', { x: b.x, pitch: 0.5 });
      }
      if (b.stT > 1.5) b.setState('recover', 'idle');
      break;
    case 'chargeW':
      b.faceTarget(); b.vx = 0;
      if (b.stT > 0.6) { b.setState('charge', 'slam'); heat(22); b.cx0 = b.x; b.lpx = b.x; b.cbox = bossBox(b, [-10, -66, 60, 66], b.D.dmg, 3); Sound.play('dash', { x: b.x, pitch: 0.4 }); }
      break;
    case 'charge':
      // a steam-driven rush across the hall, leaving burning tracks
      b.vx = b.face * 400;
      FX.ghost(b.frame(), b.spr.ox, b.spr.oy, b.x, b.y, b.face < 0, col, 0.25, 0.4);
      if (Math.abs(b.x - b.lpx) > 44) { b.lpx = b.x; firePatch(b, b.x - b.face * 20, R.floorBelow(b.x, b.y - 20)); }
      if (b.hitWall || Math.abs(b.x - b.cx0) > 340 || b.stT > 1.3) {
        if (b.cbox) b.cbox.life = 0;
        if (b.hitWall) { Cam.shake(0.5); Sound.play('stomp', { x: b.x }); }
        b.vx = 0; b.setState('recover', 'idle');
      }
      break;
    case 'pour':
      b.vx = 0;
      if (b.stT > 0.4 && !b.fired) {
        b.fired = true; heat(26);
        // molten metal pours from the gantries: three marked columns, then one on you
        const xs = [p.x - 90, p.x + 90, p.x - 180 * (Math.sign(dx) || 1), p.x].map(x => clamp(x, 3 * TILE, R.pw - 3 * TILE));
        xs.forEach((x, i) => later(i * 0.3, () => {
          if (b.dead) return;
          const gy = R.floorBelow(x, R.base * TILE - 30);
          warnMarker(x, gy, 20, col, 0.8); FX.tline(x, gy - 200, x, gy, col, 0.8, 1);
          later(0.8, () => {
            FX.add({ k: 'beam', x, y: gy, len: 220, w: 18, ang: -Math.PI / 2, c: '#ff8a2a', life: 0.45 });
            FX.add({ k: 'beam', x, y: gy, len: 220, w: 6, ang: -Math.PI / 2, c: '#ffe8a0', life: 0.5 });
            Combat.area('e', x - 10, gy - 220, 20, 220, { dmg: 18 * b.dmgMul }, 0.3, { owner: b });
            firePatch(b, x, gy); Sound.play('fire', { x }); Cam.shake(0.2);
          });
        }));
      }
      if (b.stT > 2.2) b.setState('recover', 'idle');
      break;
    case 'ventIn':
      // 过热: steam blasts out around it, then it kneels with the furnace open
      b.vx = 0;
      if (!b.fired) {
        b.fired = true; b.heat = 0;
        G.bossPhaseText = { t: 1.4, text: '过热' };
        Sound.play('void', { x: b.x, pitch: 0.4 }); Sound.play('explode', { x: b.x, pitch: 0.4 });
        Combat.area('e', b.x - 60, b.y - 70, 120, 72, { dmg: 14 * b.dmgMul }, 0.35, { owner: b });
        for (let i = 0; i < 24; i++) FX.add({ k: 'px', x: b.x + rand(-20, 20), y: b.y - rand(20, 70), vx: rand(-200, 200), vy: rand(-160, 40), life: rand(0.5, 1), s: rand(3, 6), c: pick(['#ffffff', '#e8e0e0', '#c8c0c0']), shrink: true });
        Cam.shake(0.5);
      }
      if (b.stT > 0.5) { b.fired = false; b.setState('vent', 'vent'); FX.text(b.x, b.y - b.h - 12, '炉心敞开', '#ffd36a', { size: 12, life: 1.2 }); }
      break;
    case 'vent':
      b.vx = 0;
      if (Math.random() < 0.5) FX.add({ k: 'px', x: b.x + rand(-14, 14), y: b.y - rand(50, 80), vx: rand(-20, 20), vy: -rand(40, 90), life: 0.7, s: rand(2, 5), c: pick(['#e8e0e0', '#c8c0c0']), shrink: true });
      if (b.stT > 3.0) b.setState('recover', 'idle');
      break;
    case 'recover':
      b.vx = approach(b.vx, 0, 800 * dt);
      if (b.stT > 0.75 * fast) { b.setState('idle', 'idle'); b.cd = rand(0.5, 1.0) * fast; }
      break;
    default: b.setState('idle', 'idle');
  }
};

Object.assign(BOSS_TRAITS, {
  // 蟾毒: the tongue (drawn here) and the swell of a swallowed hero
  toad: {
    canStagger(b) { return b.state !== 'air' && b.state !== 'swallow'; },
    draw(b, ctx, gctx, x, y) {
      if (b.tongue > 0) {
        const mx = x + b.face * 30, my = y - 32, tx = mx + Math.cos(b.tAim) * b.tongue, ty = my + Math.sin(b.tAim) * b.tongue;
        ctx.strokeStyle = '#c8506a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.strokeStyle = '#ff9ab0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(mx, my - 1); ctx.lineTo(tx, ty - 1); ctx.stroke();
        ctx.fillStyle = '#ff9ab0'; ctx.beginPath(); ctx.arc(tx, ty, 4, 0, TAU); ctx.fill();
      }
      if (b.state === 'swallow') {
        ctx.globalAlpha = 0.5 + 0.3 * Math.sin(G.time * 20); ctx.fillStyle = '#e8d8a0';
        ctx.beginPath(); ctx.ellipse(x + b.face * 18, y - 18, 12, 9, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      }
    },
  },
  // 流沙: untouchable while tunnelling; a wake of sand shows where she is
  scorpqueen: {
    canStagger(b) { return !['dig', 'tunnel', 'surface', 'erupt'].includes(b.state); },
    draw(b, ctx, gctx, x, y) {
      if (!b.hidden) return;
      const k = Math.sin(G.time * 14);
      ctx.fillStyle = '#c8945c'; ctx.beginPath(); ctx.ellipse(x, y, 26 + k * 2, 6, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#f0c878'; ctx.beginPath(); ctx.ellipse(x - 4, y - 2, 14, 3, 0, Math.PI, 0); ctx.fill();
      if (b.state === 'surface') { ctx.fillStyle = '#ff5a3a'; ctx.fillRect(Math.round(x - 2), Math.round(y - 10 - Math.abs(k) * 4), 4, 6); }
    },
  },
  // 过热: a heat gauge over its head; when it vents, the open furnace takes +60%
  colossus: {
    taken(b) { return b.state === 'vent' ? 1.6 : 1; },
    canStagger(b) { return !['charge', 'ventIn', 'vent'].includes(b.state); },
    draw(b, ctx, gctx, x, y) {
      const hv = b.heat || 0, bw = 36, bx = Math.round(x - bw / 2), by = Math.round(y - b.h - 16);
      ctx.fillStyle = '#1a0e0a'; ctx.fillRect(bx - 1, by - 1, bw + 2, 4);
      ctx.fillStyle = hv > 75 ? (Math.floor(G.time * 12) % 2 ? '#ffffff' : '#ff5a1a') : '#ff8a2a';
      ctx.fillRect(bx, by, Math.round(bw * hv / 100), 2);
      gctx.globalAlpha = 0.5; gctx.fillStyle = '#ff7a2a'; gctx.fillRect(bx, by - 1, Math.round(bw * hv / 100), 4); gctx.globalAlpha = 1;
      Light.add(b.x, b.y - 48, b.state === 'vent' ? 160 : 70, b.state === 'vent' ? '#ffd36a' : '#ff7a2a', 0.9);
    },
  },
});
