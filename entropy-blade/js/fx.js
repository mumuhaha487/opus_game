'use strict';
// =====================================================================
//  FX — particles, slashes, rings, lightning, damage numbers, ghosts
// =====================================================================
const FX = (() => {
  const L = [];
  const MAX = 2200;
  let flashCol = '#fff', flashA = 0, flashMax = 0;

  function P(o) {
    if (L.length >= MAX) return o;
    o.max = o.max || o.life;
    if (o.layer === undefined) o.layer = 1;
    L.push(o);
    return o;
  }
  const rr = v => (Array.isArray(v) ? rand(v[0], v[1]) : v);

  function update(dt) {
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.life -= dt;
      if (p.life <= 0) { L[i] = L[L.length - 1]; L.pop(); continue; }
      if (p.upd) p.upd(p, dt);
      if (p.drag) { const d = Math.pow(p.drag, dt * 60); p.vx *= d; p.vy *= d; }
      if (p.g) p.vy += p.g * dt;
      if (p.vx) p.x += p.vx * dt;
      if (p.vy) p.y += p.vy * dt;
      if (p.coll && G.room && G.room.solidPx(p.x, p.y)) {
        p.y -= p.vy * dt; p.vy *= -0.35; p.vx *= 0.6;
        if (Math.abs(p.vy) < 20) { p.vy = 0; p.g = 0; p.vx *= 0.5; }
      }
    }
    if (flashA > 0) flashA = Math.max(0, flashA - dt / Math.max(0.01, flashMax));
  }

  function crescent(ctx, cx, cy, r, a0, a1, th, f, sy, rot, taperHead) {
    const n = 18;
    const cr = Math.cos(rot), sr = Math.sin(rot);
    const pt = (a, rad) => {
      let ex = Math.cos(a) * rad * f, ey = Math.sin(a) * rad * sy;
      return [cx + ex * cr - ey * sr, cy + ex * sr + ey * cr];
    };
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * i / n;
      const [x, y] = pt(a, r);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    for (let i = n; i >= 0; i--) {
      const u = i / n;
      const a = a0 + (a1 - a0) * u;
      const tp = taperHead ? Math.pow(Math.sin(Math.min(1, u * 1.15) * Math.PI * 0.5), 1.4) : Math.sin(u * Math.PI);
      const [x, y] = pt(a, r - th * tp);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  function draw(ctx, gctx, cx, cy, layer) {
    for (let i = 0; i < L.length; i++) {
      const p = L[i];
      if (p.layer !== layer) continue;
      const x = p.x - cx, y = p.y - cy;
      if (x < -120 || x > W + 120 || y < -120 || y > H + 120) continue;
      const t = 1 - p.life / p.max;
      ctx.globalCompositeOperation = p.add ? 'lighter' : 'source-over';
      switch (p.k) {
        case 'px': {
          const s = Math.max(1, p.s * (p.shrink ? 1 - t : 1));
          const a = p.fade ? 1 - t * t : 1;
          ctx.globalAlpha = a;
          ctx.fillStyle = p.c;
          const sx = Math.round(x - s / 2), sy = Math.round(y - s / 2), si = Math.round(s);
          ctx.fillRect(sx, sy, si, si);
          if (p.glow) { gctx.globalAlpha = a; gctx.fillStyle = p.c; gctx.fillRect(sx - 1, sy - 1, si + 2, si + 2); }
          break;
        }
        case 'streak': {
          const len = p.len || 0.03;
          const a = 1 - t;
          ctx.globalAlpha = a;
          ctx.strokeStyle = p.c; ctx.lineWidth = p.w || 1; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - p.vx * len, y - p.vy * len); ctx.stroke();
          if (p.glow !== false) { gctx.globalAlpha = a; gctx.strokeStyle = p.c; gctx.lineWidth = (p.w || 1) + 1; gctx.beginPath(); gctx.moveTo(x, y); gctx.lineTo(x - p.vx * len, y - p.vy * len); gctx.stroke(); }
          break;
        }
        case 'ring': {
          const r = lerp(p.r0, p.r1, Ease.outCubic(t));
          const w = Math.max(0.5, p.w * (1 - t));
          ctx.globalAlpha = 1 - t * 0.6;
          ctx.strokeStyle = p.c; ctx.lineWidth = w;
          ctx.beginPath(); ctx.ellipse(x, y, r, r * (p.sy || 1), 0, 0, TAU); ctx.stroke();
          gctx.globalAlpha = 1 - t; gctx.strokeStyle = p.c; gctx.lineWidth = w + 2;
          gctx.beginPath(); gctx.ellipse(x, y, r, r * (p.sy || 1), 0, 0, TAU); gctx.stroke();
          break;
        }
        case 'flash': {
          const r = p.r * (1 - t * 0.6);
          ctx.globalAlpha = 1 - t;
          ctx.fillStyle = p.c;
          ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
          gctx.globalAlpha = 1 - t; gctx.fillStyle = p.c;
          gctx.beginPath(); gctx.arc(x, y, r * 1.6, 0, TAU); gctx.fill();
          break;
        }
        case 'star': { // 4-point hit star
          const s = p.r * (t < 0.25 ? t / 0.25 : 1 - (t - 0.25) / 0.75);
          ctx.globalAlpha = 1;
          ctx.fillStyle = p.c;
          ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot || 0);
          ctx.beginPath();
          ctx.moveTo(0, -s); ctx.lineTo(s * 0.22, -s * 0.22); ctx.lineTo(s * 1.4, 0); ctx.lineTo(s * 0.22, s * 0.22);
          ctx.lineTo(0, s); ctx.lineTo(-s * 0.22, s * 0.22); ctx.lineTo(-s * 1.4, 0); ctx.lineTo(-s * 0.22, -s * 0.22);
          ctx.closePath(); ctx.fill();
          ctx.restore();
          gctx.globalAlpha = 1; gctx.fillStyle = p.c; gctx.beginPath(); gctx.arc(x, y, s * 1.2, 0, TAU); gctx.fill();
          break;
        }
        case 'slash': {
          const rev = Math.min(1, t / (p.rev || 0.3));
          const tail = Math.max(0, (t - 0.18) / 0.82);
          const a0 = p.a0 * DEG, a1 = p.a1 * DEG;
          const aE = a0 + (a1 - a0) * Ease.outCubic(rev);
          const aS = a0 + (aE - a0) * Ease.inQuad(tail);
          if (Math.abs(aE - aS) < 0.02) break;
          const th = p.th * (1 - t * 0.55);
          const al = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
          ctx.globalAlpha = al;
          ctx.fillStyle = p.c;
          crescent(ctx, x, y, p.r, aS, aE, th, p.f, p.sy || 1, (p.rot || 0) * DEG * p.f, true);
          ctx.fillStyle = p.c2 || '#ffffff';
          crescent(ctx, x, y, p.r - th * 0.05, aS, aE, th * 0.42, p.f, p.sy || 1, (p.rot || 0) * DEG * p.f, true);
          gctx.globalAlpha = al * 0.9; gctx.fillStyle = p.c;
          crescent(gctx, x, y, p.r + 1, aS, aE, th + 2, p.f, p.sy || 1, (p.rot || 0) * DEG * p.f, true);
          break;
        }
        case 'num': {
          const pop = t < 0.12 ? 1 + (0.12 - t) * 6 : 1;
          const a = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
          ctx.globalAlpha = 1;
          Text.draw(ctx, p.str, x, y, { size: p.big ? 12 : 8, color: p.c, outline: '#12081c', align: 'center', valign: 'middle', alpha: a, scale: pop > 1.3 && p.big ? 1 : 1 });
          break;
        }
        case 'text': {
          const a = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
          ctx.globalAlpha = 1;
          Text.draw(ctx, p.str, x, y, { size: p.size || 8, color: p.c, outline: p.o || '#12081c', align: 'center', valign: 'middle', alpha: a });
          break;
        }
        case 'ghost': {
          const a = (1 - t) * (p.a || 0.55);
          ctx.globalCompositeOperation = 'lighter';
          drawFrame(ctx, p.img, p.ox, p.oy, x, y, p.flip, { tint: p.c, alpha: a });
          break;
        }
        case 'bolt': {
          if (!p.pts || p.jt <= 0) {
            p.jt = 0.04; p.pts = [];
            const n = Math.max(3, Math.floor(dist(p.x, p.y, p.x2, p.y2) / 9));
            const nx = -(p.y2 - p.y), ny = p.x2 - p.x, nl = Math.hypot(nx, ny) || 1;
            for (let j = 0; j <= n; j++) {
              const u = j / n, off = (j === 0 || j === n) ? 0 : rand(-1, 1) * (p.jag || 7);
              p.pts.push([lerp(p.x, p.x2, u) + nx / nl * off, lerp(p.y, p.y2, u) + ny / nl * off]);
            }
          }
          p.jt -= 1 / 60;
          const a = 1 - t;
          for (const [c2, w] of [[p.c, (p.w || 2) + 1], ['#ffffff', Math.max(1, (p.w || 2) - 1)]]) {
            ctx.globalAlpha = a; ctx.strokeStyle = c2; ctx.lineWidth = w; ctx.lineJoin = 'round';
            ctx.beginPath();
            p.pts.forEach(([px, py], j) => { if (j === 0) ctx.moveTo(px - cx, py - cy); else ctx.lineTo(px - cx, py - cy); });
            ctx.stroke();
          }
          gctx.globalAlpha = a; gctx.strokeStyle = p.c; gctx.lineWidth = (p.w || 2) + 4;
          gctx.beginPath();
          p.pts.forEach(([px, py], j) => { if (j === 0) gctx.moveTo(px - cx, py - cy); else gctx.lineTo(px - cx, py - cy); });
          gctx.stroke();
          break;
        }
        case 'beam': { // horizontal / angled beam
          const a = t < 0.15 ? t / 0.15 : 1 - Math.max(0, (t - 0.7) / 0.3);
          const w = p.w * (0.75 + 0.25 * Math.sin(p.life * 60));
          ctx.save(); ctx.translate(x, y); ctx.rotate(p.ang || 0);
          ctx.globalAlpha = a; ctx.fillStyle = p.c; ctx.fillRect(0, -w / 2, p.len, w);
          ctx.fillStyle = '#ffffff'; ctx.fillRect(0, -w / 5, p.len, w / 2.5);
          ctx.restore();
          gctx.save(); gctx.translate(x, y); gctx.rotate(p.ang || 0);
          gctx.globalAlpha = a; gctx.fillStyle = p.c; gctx.fillRect(0, -w, p.len, w * 2);
          gctx.restore();
          break;
        }
        case 'circle': {
          const a = (p.a || 0.35) * (p.pulse ? 0.6 + 0.4 * Math.sin(t * 30) : 1) * (1 - t * (p.fadeOut ? 1 : 0));
          ctx.globalAlpha = a; ctx.fillStyle = p.c;
          ctx.beginPath(); ctx.ellipse(x, y, p.r, p.r * (p.sy || 1), 0, 0, TAU); ctx.fill();
          break;
        }
        case 'tline': { // telegraph line
          const a = (p.a || 0.6) * (0.5 + 0.5 * Math.sin(t * 40));
          ctx.globalAlpha = a; ctx.strokeStyle = p.c; ctx.lineWidth = p.w || 1;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(p.x2 - cx, p.y2 - cy); ctx.stroke();
          break;
        }
        case 'shard': { // spinning diamond debris
          const a = 1 - t;
          ctx.save(); ctx.translate(x, y); ctx.rotate((p.rot || 0) + t * (p.spin || 8));
          ctx.globalAlpha = a; ctx.fillStyle = p.c;
          ctx.beginPath(); ctx.moveTo(0, -p.s); ctx.lineTo(p.s * 0.5, 0); ctx.lineTo(0, p.s); ctx.lineTo(-p.s * 0.5, 0); ctx.closePath(); ctx.fill();
          ctx.restore();
          if (p.glow) { gctx.globalAlpha = a; gctx.fillStyle = p.c; gctx.fillRect(x - 2, y - 2, 4, 4); }
          break;
        }
        case 'fn': p.draw(ctx, gctx, x, y, t, p); break;
      }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    gctx.globalAlpha = 1;
  }

  // ---------- emitters ----------
  const api = {
    list: L,
    add: P,
    update,
    draw,
    clear() { L.length = 0; flashA = 0; },
    screenFlash(c, a = 0.6, dur = 0.25) { flashCol = c; flashA = Math.max(flashA, a); flashMax = dur; },
    drawFlash(ctx) {
      if (flashA <= 0) return;
      ctx.globalAlpha = flashA; ctx.fillStyle = flashCol; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    },
    burst(x, y, o = {}) {
      const n = o.n || 8;
      for (let i = 0; i < n; i++) {
        const a = (o.ang !== undefined ? o.ang : rand(0, TAU)) + rand(-(o.spread || Math.PI), o.spread || Math.PI);
        const sp = rr(o.sp || [40, 120]);
        P({ k: o.k || 'px', x: x + rand(-(o.jx || 0), o.jx || 0), y: y + rand(-(o.jy || 0), o.jy || 0), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rr(o.life || [0.3, 0.6]), s: rr(o.s || [1, 2]), c: Array.isArray(o.c) ? pick(o.c) : (o.c || '#fff'), g: o.g || 0, drag: o.drag, glow: o.glow, add: o.add, shrink: o.shrink !== false, fade: o.fade, coll: o.coll, layer: o.layer, len: o.len, w: o.w, spin: o.spin, rot: rand(0, TAU) });
      }
    },
    sparks(x, y, ang, c, n = 6, sp = [140, 320], spread = 0.6) {
      for (let i = 0; i < n; i++) {
        const a = ang + rand(-spread, spread), s = rr(sp);
        P({ k: 'streak', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.1, 0.25), c, drag: 0.86, len: 0.035, w: 1 });
      }
    },
    hitSpark(x, y, dir, c, big) {
      P({ k: 'flash', x, y, r: big ? 12 : 7, c: '#ffffff', life: 0.08 });
      P({ k: 'star', x, y, r: big ? 18 : 11, c: '#ffffff', life: big ? 0.16 : 0.11, rot: rand(-0.3, 0.3) });
      P({ k: 'star', x, y, r: big ? 14 : 8, c, life: big ? 0.2 : 0.14, rot: rand(0.4, 1.2), add: true });
      api.sparks(x, y, dir > 0 ? 0 : Math.PI, c, big ? 9 : 5, big ? [200, 420] : [140, 300], 0.9);
      api.burst(x, y, { n: big ? 8 : 4, c: [c, '#ffffff'], sp: [40, 160], life: [0.2, 0.45], s: [1, 2], g: 300, glow: true });
      if (big) P({ k: 'ring', x, y, r0: 4, r1: 26, w: 3, c, life: 0.22 });
    },
    slash(x, y, o) {
      return P({ k: 'slash', x, y, r: o.r || 22, a0: o.a0, a1: o.a1, th: o.th || 7, c: o.c || '#ff4d6d', c2: o.c2 || '#ffffff', f: o.f || 1, sy: o.sy || 1, rot: o.rot || 0, life: o.dur || 0.2, rev: o.rev, add: o.add, layer: 1, follow: o.follow });
    },
    ring(x, y, r0, r1, c, dur = 0.3, w = 2, sy = 1) { P({ k: 'ring', x, y, r0, r1, c, life: dur, w, sy }); },
    flash(x, y, r, c, dur = 0.12) { P({ k: 'flash', x, y, r, c, life: dur, add: true }); },
    num(x, y, v, o = {}) {
      if (!Save.data.settings.numbers) return;
      const crit = !!o.crit;
      const str = crit ? Math.round(v) + '!' : String(Math.max(1, Math.round(v)));
      P({ k: 'num', x: x + rand(-6, 6), y: y - 6, vx: rand(-15, 15), vy: crit ? -95 : -70, g: 160, drag: 0.94, life: crit ? 0.85 : 0.6, str, big: crit || o.big, c: o.c || (crit ? '#ffd23f' : '#ffffff'), layer: 2 });
    },
    text(x, y, str, c = '#fff', o = {}) {
      P({ k: 'text', x, y, vx: 0, vy: o.vy !== undefined ? o.vy : -24, drag: 0.95, life: o.life || 1.0, str, c, size: o.size || 8, o: o.outline, layer: 2 });
    },
    ghost(img, ox, oy, x, y, flip, c, dur = 0.25, a = 0.55) { P({ k: 'ghost', img, ox, oy, x, y, flip, c, life: dur, a, layer: 0 }); },
    bolt(x, y, x2, y2, c = '#ffe14a', dur = 0.18, w = 2, jag = 7) { P({ k: 'bolt', x, y, x2, y2, c, life: dur, w, jag, layer: 1 }); },
    dust(x, y, n = 5, dir = 0, c = '#b9a9c9') {
      for (let i = 0; i < n; i++) {
        P({ k: 'px', x: x + rand(-4, 4), y: y - rand(0, 2), vx: dir * rand(20, 70) + rand(-30, 30), vy: -rand(10, 45), drag: 0.9, life: rand(0.25, 0.5), s: rand(2, 4), c, shrink: true, fade: true, layer: 0 });
      }
    },
    shock(x, y, c, r = 40) {
      P({ k: 'ring', x, y, r0: 4, r1: r, c, life: 0.35, w: 3, sy: 0.28 });
      api.dust(x, y, 10, 0);
    },
    beam(x, y, len, w, ang, c, dur) { return P({ k: 'beam', x, y, len, w, ang, c, life: dur, layer: 1 }); },
    tline(x, y, x2, y2, c, dur, w = 1) { return P({ k: 'tline', x, y, x2, y2, c, life: dur, w }); },
    circle(x, y, r, c, dur, o = {}) { return P(Object.assign({ k: 'circle', x, y, r, c, life: dur, layer: 0 }, o)); },
    debris(x, y, c, n = 6) {
      for (let i = 0; i < n; i++) P({ k: 'shard', x, y, vx: rand(-120, 120), vy: rand(-220, -60), g: 600, life: rand(0.5, 0.9), s: rand(2, 4), c: Array.isArray(c) ? pick(c) : c, spin: rand(-12, 12), rot: rand(0, 6), coll: true });
    },
    fire(x, y, n = 2, big) {
      for (let i = 0; i < n; i++) {
        P({ k: 'px', x: x + rand(-4, 4), y: y + rand(-3, 3), vx: rand(-15, 15), vy: rand(-60, -25), life: rand(0.3, 0.6), s: big ? rand(2, 4) : rand(1, 3), c: pick(['#ffdd55', '#ff9a2e', '#ff5a1f', '#ffd23f']), shrink: true, glow: true, add: true });
      }
    },
    // break a sprite frame into pixel particles
    disintegrate(img, ox, oy, x, y, flip, tint, force = 1) {
      const data = pixelsOf(img);
      const step = data.length > 500 ? 3 : 2;
      for (let i = 0; i < data.length; i += step) {
        const [px, py, col] = data[i];
        const lx = flip ? ox - px : px - ox;
        const wx = x + lx, wy = y + (py - oy);
        const dx = wx - x, dy = wy - (y - 14);
        const d = Math.hypot(dx, dy) || 1;
        const sp = rand(40, 160) * force;
        P({ k: 'px', x: wx, y: wy, vx: dx / d * sp + rand(-30, 30), vy: dy / d * sp - rand(40, 120), g: 420, drag: 0.96, life: rand(0.45, 1.0), s: rand(1, 2.2), c: tint && chance(0.5) ? tint : col, shrink: true, coll: true, glow: chance(0.2) });
      }
    },
    customDraw(x, y, life, draw, layer = 1) { return P({ k: 'fn', x, y, life, draw, layer }); },
  };
  return api;
})();

const _pixCache = new WeakMap();
function pixelsOf(img) {
  let d = _pixCache.get(img);
  if (d) return d;
  d = [];
  const c = makeCanvas(img.width, img.height);
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0);
  const id = x.getImageData(0, 0, img.width, img.height).data;
  for (let y = 0; y < img.height; y++) for (let xx = 0; xx < img.width; xx++) {
    const j = (y * img.width + xx) * 4;
    if (id[j + 3] > 0) d.push([xx, y, rgb2hex(id[j], id[j + 1], id[j + 2])]);
  }
  _pixCache.set(img, d);
  return d;
}
