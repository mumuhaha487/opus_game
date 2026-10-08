'use strict';
// =====================================================================
//  GFX — canvases, presentation, bloom, lighting, text, sprite helpers
// =====================================================================
const Gfx = (() => {
  const screen = document.getElementById('screen');
  const sctx = screen.getContext('2d', { alpha: false });
  const world = makeCanvas(W, H), wctx = world.getContext('2d');
  const glow = makeCanvas(W, H), gctx = glow.getContext('2d');
  const b1 = makeCanvas(W / 2, H / 2), b1x = b1.getContext('2d');
  const b2 = makeCanvas(W / 4, H / 4), b2x = b2.getContext('2d');
  const ui = makeCanvas(UW, UH), uctx = ui.getContext('2d');
  // painted art (立绘) is drawn at full screen resolution between the world and the UI;
  // callers use UI coordinates and punch a hole in the UI canvas where the art should show
  const art = makeCanvas(1, 1), actx = art.getContext('2d');
  let artUsed = false;
  const filterOK = typeof wctx.filter === 'string';
  let view = { x: 0, y: 0, w: W, h: H, s: 1, dpr: 1 };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = Math.max(1, Math.floor(window.innerWidth * dpr)), ch = Math.max(1, Math.floor(window.innerHeight * dpr));
    screen.width = cw; screen.height = ch;
    screen.style.width = window.innerWidth + 'px'; screen.style.height = window.innerHeight + 'px';
    let s = Math.min(cw / W, ch / H);
    if (Save.data.settings.pixelPerfect && s >= 1) s = Math.floor(s);
    const vw = Math.round(W * s), vh = Math.round(H * s);
    view = { x: Math.floor((cw - vw) / 2), y: Math.floor((ch - vh) / 2), w: vw, h: vh, s, dpr };
  }
  window.addEventListener('resize', resize);
  resize();

  function toUI(clientX, clientY) {
    const r = screen.getBoundingClientRect();
    const px = (clientX - r.left) * view.dpr, py = (clientY - r.top) * view.dpr;
    return [(px - view.x) / view.w * UW, (py - view.y) / view.h * UH];
  }
  window.addEventListener('mousemove', e => { const [x, y] = toUI(e.clientX, e.clientY); Input.setMouse(x, y); });
  window.addEventListener('mousedown', e => { const [x, y] = toUI(e.clientX, e.clientY); Input.setMouse(x, y); });

  function present(glowAmt) {
    sctx.globalCompositeOperation = 'source-over';
    sctx.globalAlpha = 1;
    sctx.imageSmoothingEnabled = false;
    sctx.fillStyle = '#000';
    sctx.fillRect(0, 0, screen.width, screen.height);
    sctx.drawImage(world, view.x, view.y, view.w, view.h);
    if (glowAmt > 0) {
      b1x.globalCompositeOperation = 'copy';
      b1x.imageSmoothingEnabled = true;
      if (filterOK) b1x.filter = 'blur(1px)';
      b1x.drawImage(glow, 0, 0, W / 2, H / 2);
      if (filterOK) b1x.filter = 'none';
      b2x.globalCompositeOperation = 'copy';
      b2x.imageSmoothingEnabled = true;
      if (filterOK) b2x.filter = 'blur(2px)';
      b2x.drawImage(b1, 0, 0, W / 4, H / 4);
      if (filterOK) b2x.filter = 'none';
      sctx.globalCompositeOperation = 'lighter';
      sctx.imageSmoothingEnabled = true;
      sctx.globalAlpha = 0.75 * glowAmt;
      sctx.drawImage(b1, view.x, view.y, view.w, view.h);
      sctx.globalAlpha = 1.0 * glowAmt;
      sctx.drawImage(b2, view.x, view.y, view.w, view.h);
      sctx.globalAlpha = 1;
      sctx.globalCompositeOperation = 'source-over';
    }
    if (artUsed) sctx.drawImage(art, view.x, view.y);
    sctx.imageSmoothingEnabled = false;
    sctx.drawImage(ui, view.x, view.y, view.w, view.h);
    if (typeof TouchUI !== 'undefined') { TouchUI.draw(sctx); TouchUI.drawPortrait(sctx); }
  }
  // start of a UI frame: forget last frame's art
  function artBegin() {
    if (art.width !== view.w || art.height !== view.h) { art.width = view.w; art.height = view.h; }
    else if (artUsed) { actx.setTransform(1, 0, 0, 1, 0, 0); actx.clearRect(0, 0, art.width, art.height); }
    artUsed = false;
  }
  // the art context, mapped to UI coordinates
  function artCtx() {
    artUsed = true;
    actx.setTransform(view.w / UW, 0, 0, view.h / UH, 0, 0);
    actx.globalAlpha = 1; actx.globalCompositeOperation = 'source-over';
    actx.imageSmoothingEnabled = true; actx.imageSmoothingQuality = 'high';
    return actx;
  }

  // vignette overlay
  const vignette = makeCanvas(W, H);
  {
    const v = vignette.getContext('2d');
    const g = v.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(4,0,12,0.65)');
    v.fillStyle = g; v.fillRect(0, 0, W, H);
  }
  const hurtVig = makeCanvas(W, H);
  {
    const v = hurtVig.getContext('2d');
    const g = v.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.85);
    g.addColorStop(0, 'rgba(255,0,40,0)');
    g.addColorStop(1, 'rgba(255,0,40,0.75)');
    v.fillStyle = g; v.fillRect(0, 0, W, H);
  }

  return { screen, sctx, world, wctx, glow, gctx, ui, uctx, present, resize, vignette, hurtVig, artBegin, artCtx, get view() { return view; }, get artScale() { return view.w / UW; }, filterOK };
})();

// =====================================================================
//  LIGHTING — half-res multiply light map
// =====================================================================
const Light = (() => {
  const lc = makeCanvas(W / 2, H / 2), lx = lc.getContext('2d');
  const list = [];
  const tex = new Map();
  function texFor(color) {
    let t = tex.get(color);
    if (t) return t;
    t = makeCanvas(64, 64);
    const x = t.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, rgba(color, 1));
    g.addColorStop(0.35, rgba(color, 0.55));
    g.addColorStop(1, rgba(color, 0));
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    tex.set(color, t);
    return t;
  }
  return {
    add(x, y, r, color = '#ffffff', a = 1) { if (list.length < 160) list.push({ x, y, r, color, a }); },
    clear() { list.length = 0; },
    apply(ctx, ambient, camx, camy) {
      lx.globalCompositeOperation = 'source-over';
      lx.globalAlpha = 1;
      lx.fillStyle = ambient;
      lx.fillRect(0, 0, W / 2, H / 2);
      lx.globalCompositeOperation = 'lighter';
      for (const l of list) {
        const sx = (l.x - camx) / 2, sy = (l.y - camy) / 2, r = l.r / 2;
        if (sx + r < 0 || sy + r < 0 || sx - r > W / 2 || sy - r > H / 2) continue;
        lx.globalAlpha = clamp(l.a, 0, 1);
        lx.drawImage(texFor(l.color), sx - r, sy - r, r * 2, r * 2);
      }
      lx.globalAlpha = 1;
      list.length = 0;
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(lc, 0, 0, W, H);
      ctx.restore();
    },
  };
})();

// =====================================================================
//  TEXT — embedded pixel font, thresholded to crisp pixels, cached
// =====================================================================
const Text = (() => {
  const cache = new Map();
  let ready = false;
  const FAM = { 12: 'FP12', 8: 'FP8' };
  const scratch = makeCanvas(8, 8).getContext('2d', { willReadFrequently: true });
  const mctx = makeCanvas(4, 4).getContext('2d');
  function b64ToBuf(b64) {
    const bin = atob(b64); const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u.buffer;
  }
  async function load() {
    try {
      if (window.FONT_DATA && window.FontFace) {
        const f12 = new FontFace('FP12', b64ToBuf(window.FONT_DATA.fp12));
        const f8 = new FontFace('FP8', b64ToBuf(window.FONT_DATA.fp8));
        await Promise.all([f12.load(), f8.load()]);
        document.fonts.add(f12); document.fonts.add(f8);
      }
    } catch (e) { console.warn('pixel font failed to load, using fallback', e); }
    ready = true;
    cache.clear();
  }
  const fontStr = size => `${size}px ${FAM[size] || 'FP12'}, "Microsoft YaHei", "PingFang SC", monospace`;
  function measure(str, size = 12) { mctx.font = fontStr(size); return Math.ceil(mctx.measureText(str).width); }
  function sprite(str, size, color, outline) {
    const key = size + '|' + color + '|' + (outline || '') + '|' + str;
    let c = cache.get(key);
    if (c) return c;
    const pad = outline ? 1 : 0;
    const w = Math.max(1, measure(str, size) + pad * 2 + 1), h = size + 3 + pad * 2;
    const sc = scratch.canvas;
    if (sc.width < w || sc.height < h) { sc.width = Math.max(sc.width, w); sc.height = Math.max(sc.height, h); }
    scratch.clearRect(0, 0, sc.width, sc.height);
    scratch.font = fontStr(size);
    scratch.textBaseline = 'top';
    scratch.fillStyle = '#fff';
    scratch.fillText(str, pad, pad + (size === 12 ? 1 : 0));
    const img = scratch.getImageData(0, 0, w, h), d = img.data;
    const mask = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) mask[i] = d[i * 4 + 3] > 110 ? 1 : 0;
    const [r, g, b] = hex2rgb(color);
    const oc = outline ? hex2rgb(outline) : null;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, j = i * 4;
      if (mask[i]) { d[j] = r; d[j + 1] = g; d[j + 2] = b; d[j + 3] = 255; continue; }
      if (oc) {
        let n = false;
        for (let oy = -1; oy <= 1 && !n; oy++) for (let ox = -1; ox <= 1; ox++) {
          const xx = x + ox, yy = y + oy;
          if (xx >= 0 && yy >= 0 && xx < w && yy < h && mask[yy * w + xx]) { n = true; break; }
        }
        if (n) { d[j] = oc[0]; d[j + 1] = oc[1]; d[j + 2] = oc[2]; d[j + 3] = 255; continue; }
      }
      d[j + 3] = 0;
    }
    c = makeCanvas(w, h);
    c.getContext('2d').putImageData(img, 0, 0);
    if (cache.size > 2500) cache.clear();
    cache.set(key, c);
    return c;
  }
  // draw text; returns drawn width
  function draw(ctx, str, x, y, o = {}) {
    str = String(str);
    if (!str.length) return 0;
    const size = o.size || 12, scale = o.scale || 1;
    const spr = sprite(str, size, o.color || '#ffffff', o.outline);
    const w = spr.width * scale, h = spr.height * scale;
    let dx = x, dy = y;
    if (o.align === 'center') dx -= w / 2; else if (o.align === 'right') dx -= w;
    if (o.valign === 'middle') dy -= h / 2; else if (o.valign === 'bottom') dy -= h;
    dx = Math.round(dx); dy = Math.round(dy);
    const pa = ctx.globalAlpha;
    if (o.alpha !== undefined) ctx.globalAlpha = pa * o.alpha;
    if (o.shadow) {
      const sh = sprite(str, size, o.shadow, o.outline ? o.shadow : null);
      ctx.drawImage(sh, dx + scale, dy + scale, w, h);
    }
    ctx.drawImage(spr, dx, dy, w, h);
    ctx.globalAlpha = pa;
    return w;
  }
  function wrap(str, maxW, size = 12) {
    const lines = [];
    for (const para of String(str).split('\n')) {
      let cur = '';
      for (const ch of para) {
        const test = cur + ch;
        if (measure(test, size) > maxW && cur.length) {
          // avoid starting a line with punctuation
          if (/[，。、；：！？）」』,.;:!?)]/.test(ch)) { lines.push(test); cur = ''; continue; }
          lines.push(cur); cur = ch;
        } else cur = test;
      }
      lines.push(cur);
    }
    return lines;
  }
  return { load, draw, measure, wrap, sprite, get ready() { return ready; } };
})();

// =====================================================================
//  PIXEL RASTERIZER — hard-edged shapes (no antialiasing) with an affine
//  transform stack; used to bake every sprite as crisp pixel art.
// =====================================================================
class PixCtx {
  constructor(w, h) { this.w = w; this.h = h; this.buf = new Uint8ClampedArray(w * h * 4); this.m = [1, 0, 0, 1, 0, 0]; this.stack = []; this.alpha = 255; }
  reset(w, h) {
    if (w * h * 4 > this.buf.length) this.buf = new Uint8ClampedArray(w * h * 4);
    this.w = w; this.h = h; this.buf.fill(0, 0, w * h * 4); this.m = [1, 0, 0, 1, 0, 0]; this.stack.length = 0; this.alpha = 255;
  }
  save() { this.stack.push(this.m.slice()); }
  restore() { if (this.stack.length) this.m = this.stack.pop(); }
  translate(x, y) { const m = this.m; m[4] += m[0] * x + m[2] * y; m[5] += m[1] * x + m[3] * y; }
  scale(sx, sy) { const m = this.m; m[0] *= sx; m[1] *= sx; m[2] *= sy; m[3] *= sy; }
  rotate(a) {
    const c = Math.cos(a), s = Math.sin(a), m = this.m;
    const a0 = m[0], b0 = m[1], c0 = m[2], d0 = m[3];
    m[0] = a0 * c + c0 * s; m[1] = b0 * c + d0 * s; m[2] = -a0 * s + c0 * c; m[3] = -b0 * s + d0 * c;
  }
  tx(x, y) { const m = this.m; return m[0] * x + m[2] * y + m[4]; }
  ty(x, y) { const m = this.m; return m[1] * x + m[3] * y + m[5]; }
  get sc() { const m = this.m; return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])); }
  _set(i, c) { const j = i * 4; this.buf[j] = c[0]; this.buf[j + 1] = c[1]; this.buf[j + 2] = c[2]; this.buf[j + 3] = this.alpha; }
  _box(x0, y0, x1, y1) {
    return [Math.max(0, Math.floor(x0)), Math.max(0, Math.floor(y0)), Math.min(this.w - 1, Math.ceil(x1)), Math.min(this.h - 1, Math.ceil(y1))];
  }
  line(ax, ay, bx, by, w, col) {
    const c = hex2rgb(col);
    const x0 = this.tx(ax, ay), y0 = this.ty(ax, ay), x1 = this.tx(bx, by), y1 = this.ty(bx, by);
    const r = Math.max(0.62, w * this.sc / 2), r2 = r * r;
    const [bx0, by0, bx1, by1] = this._box(Math.min(x0, x1) - r, Math.min(y0, y1) - r, Math.max(x0, x1) + r, Math.max(y0, y1) + r);
    const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1e-6;
    for (let py = by0; py <= by1; py++) for (let px = bx0; px <= bx1; px++) {
      const cx = px + 0.5, cy = py + 0.5;
      let t = ((cx - x0) * dx + (cy - y0) * dy) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = x0 + dx * t - cx, ey = y0 + dy * t - cy;
      if (ex * ex + ey * ey <= r2) this._set(py * this.w + px, c);
    }
  }
  circ(cx, cy, r, col) {
    const c = hex2rgb(col);
    const x0 = this.tx(cx, cy), y0 = this.ty(cx, cy), R = Math.max(0.55, r * this.sc), R2 = R * R;
    const [bx0, by0, bx1, by1] = this._box(x0 - R, y0 - R, x0 + R, y0 + R);
    for (let py = by0; py <= by1; py++) for (let px = bx0; px <= bx1; px++) {
      const ex = px + 0.5 - x0, ey = py + 0.5 - y0;
      if (ex * ex + ey * ey <= R2) this._set(py * this.w + px, c);
    }
  }
  ell(cx, cy, rx, ry, rot, col) {
    const c = hex2rgb(col);
    this.save(); this.translate(cx, cy); this.rotate(rot || 0); this.scale(Math.max(0.1, rx), Math.max(0.1, ry));
    const m = this.m, det = m[0] * m[3] - m[1] * m[2];
    const ia = m[3] / det, ib = -m[1] / det, ic = -m[2] / det, id = m[0] / det;
    const ox = m[4], oy = m[5];
    const ext = Math.max(Math.abs(m[0]) + Math.abs(m[2]), Math.abs(m[1]) + Math.abs(m[3]));
    this.restore();
    const [bx0, by0, bx1, by1] = this._box(ox - ext - 1, oy - ext - 1, ox + ext + 1, oy + ext + 1);
    for (let py = by0; py <= by1; py++) for (let px = bx0; px <= bx1; px++) {
      const qx = px + 0.5 - ox, qy = py + 0.5 - oy;
      const u = ia * qx + ic * qy, v = ib * qx + id * qy;
      if (u * u + v * v <= 1) this._set(py * this.w + px, c);
    }
  }
  poly(pts, col) {
    const c = hex2rgb(col);
    const P = pts.map(p => [this.tx(p[0], p[1]), this.ty(p[0], p[1])]);
    let mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9;
    for (const p of P) { mnx = Math.min(mnx, p[0]); mny = Math.min(mny, p[1]); mxx = Math.max(mxx, p[0]); mxy = Math.max(mxy, p[1]); }
    const [bx0, by0, bx1, by1] = this._box(mnx, mny, mxx, mxy);
    const n = P.length;
    for (let py = by0; py <= by1; py++) {
      const cy = py + 0.5;
      for (let px = bx0; px <= bx1; px++) {
        const cx = px + 0.5;
        let inside = false;
        for (let i = 0, j = n - 1; i < n; j = i++) {
          const xi = P[i][0], yi = P[i][1], xj = P[j][0], yj = P[j][1];
          if ((yi > cy) !== (yj > cy) && cx < (xj - xi) * (cy - yi) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) this._set(py * this.w + px, c);
      }
    }
  }
  rect(x, y, w, h, col) { this.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], col); }
  // simple pixel set in local coords
  dot(x, y, col) {
    const px = Math.floor(this.tx(x, y)), py = Math.floor(this.ty(x, y));
    if (px >= 0 && py >= 0 && px < this.w && py < this.h) this._set(py * this.w + px, hex2rgb(col));
  }
}
const _pix = new PixCtx(256, 256);

// Bake a sprite: drawFn(pixctx) draws hard-edged shapes; then a 1px outline pass.
function bakeSprite(w, h, drawFn, opts = {}) {
  _pix.reset(w, h);
  drawFn(_pix);
  const img = new ImageData(w, h);
  img.data.set(_pix.buf.subarray(0, w * h * 4));
  outlineData(img, w, h, opts);
  const c = makeCanvas(w, h);
  c.getContext('2d').putImageData(img, 0, 0);
  return c;
}
function outlineData(img, w, h, o) {
  if (o.outline === null || o.outline === false) return;
  const d = img.data;
  const oc = hex2rgb(o.outline || '#0d0a16');
  const solid = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) solid[i] = d[i * 4 + 3] > 0 ? 1 : 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (solid[i]) continue;
    if ((x > 0 && solid[i - 1]) || (x < w - 1 && solid[i + 1]) || (y > 0 && solid[i - w]) || (y < h - 1 && solid[i + w])) {
      const j = i * 4; d[j] = oc[0]; d[j + 1] = oc[1]; d[j + 2] = oc[2]; d[j + 3] = 255;
    }
  }
}
const _tintCache = new WeakMap();
function tintOf(img, color) {
  let m = _tintCache.get(img);
  if (!m) { m = new Map(); _tintCache.set(img, m); }
  let c = m.get(color);
  if (c) return c;
  c = makeCanvas(img.width, img.height);
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
  m.set(color, c);
  return c;
}
// Blend sprite toward a color (keeps shading) for status effects
const _blendCache = new WeakMap();
function blendOf(img, color, amt) {
  let m = _blendCache.get(img);
  if (!m) { m = new Map(); _blendCache.set(img, m); }
  const key = color + amt;
  let c = m.get(key);
  if (c) return c;
  c = makeCanvas(img.width, img.height);
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = 'source-atop';
  x.globalAlpha = amt;
  x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
  m.set(key, c);
  return c;
}
// draw a sprite frame. fr = {img, ox, oy}; x,y in screen (camera-applied) coords
function drawFrame(ctx, img, ox, oy, x, y, flip, o) {
  let src = img;
  if (o) {
    if (o.white) src = tintOf(img, '#ffffff');
    else if (o.tint) src = tintOf(img, o.tint);
    else if (o.blend) src = blendOf(img, o.blend, o.blendAmt || 0.45);
  }
  const sx = (o && o.sx) || 1, sy = (o && o.sy) || 1;
  const a = o && o.alpha !== undefined ? o.alpha : 1;
  if (a <= 0) return;
  const pa = ctx.globalAlpha;
  ctx.globalAlpha = pa * a;
  if (!flip && sx === 1 && sy === 1 && !(o && o.rot)) {
    ctx.drawImage(src, Math.round(x - ox), Math.round(y - oy));
  } else {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    if (o && o.rot) ctx.rotate(o.rot);
    ctx.scale(flip ? -sx : sx, sy);
    ctx.drawImage(src, -ox, -oy);
    ctx.restore();
  }
  ctx.globalAlpha = pa;
}

// =====================================================================
//  CAMERA
// =====================================================================
const Cam = {
  x: 0, y: 0, trauma: 0, ox: 0, oy: 0, kick: { x: 0, y: 0 },
  shake(a) { this.trauma = Math.min(1, this.trauma + a * Save.data.settings.shake); },
  push(dx, dy) { this.kick.x += dx * Save.data.settings.shake; this.kick.y += dy * Save.data.settings.shake; },
  follow(tx, ty, rw, rh, dt, snap) {
    const cx = clamp(tx - W / 2, 0, Math.max(0, rw - W));
    const cy = clamp(ty - H / 2, 0, Math.max(0, rh - H));
    if (snap) { this.x = cx; this.y = cy; }
    else {
      this.x += (cx - this.x) * Math.min(1, dt * 7);
      this.y += (cy - this.y) * Math.min(1, dt * 5);
    }
  },
  update(dt) {
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const s = this.trauma * this.trauma;
    this.ox = (Math.random() * 2 - 1) * 9 * s + this.kick.x;
    this.oy = (Math.random() * 2 - 1) * 7 * s + this.kick.y;
    this.kick.x *= Math.pow(0.0005, dt); this.kick.y *= Math.pow(0.0005, dt);
  },
  get rx() { return Math.round(this.x + this.ox); },
  get ry() { return Math.round(this.y + this.oy); },
};
