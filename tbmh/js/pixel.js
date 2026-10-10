'use strict';
// =====================================================================
//  PIXEL — canvases from ART grids, palette swaps, flash, rotations,
//  bitmap text, 8-bit damage digits, rarity frames
// =====================================================================
const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; };
const _hexRGB = new Map();
function rgb(hex) {
  let c = _hexRGB.get(hex);
  if (!c) { const n = parseInt(hex.slice(1), 16); c = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; _hexRGB.set(hex, c); }
  return c;
}
function rgba(hex, a) { const c = rgb(hex); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }
function mixHex(a, b, t) { const A = rgb(a), B = rgb(b); return '#' + [0, 1, 2].map(i => Math.round(A[i] + (B[i] - A[i]) * t).toString(16).padStart(2, '0')).join(''); }

// equipment colors: metal and cloth follow the item-level tier group (MATERIAL_GROUP), the gem follows the grade
const METAL = [ART.RAMP.brown, ART.RAMP.steel, ART.RAMP.silver, ART.RAMP.gold, ART.RAMP.ice, ART.RAMP.purple, ART.RAMP.fire];
const CLOTH = [ART.RAMP.wood, ART.RAMP.brown, ART.RAMP.red, ART.RAMP.navy, ART.RAMP.teal, ART.RAMP.purple, ART.RAMP.gold];
const ELEM_RAMP = { fire: ART.RAMP.fire, ice: ART.RAMP.ice, light: ART.RAMP.gold, poison: ART.RAMP.green, holy: ART.RAMP.bone, phys: ART.RAMP.silver };

const Spr = (() => {
  const cache = new Map();
  function toCanvas(g) {
    const c = mkCanvas(g.w, g.h);
    const img = new ImageData(g.px, g.w, g.h);
    c.getContext('2d').putImageData(img, 0, 0);
    c.ox = g.ox; c.oy = g.oy; if (g.hand) c.hand = g.hand;
    return c;
  }
  // a sprite frame as a canvas (with .ox/.oy anchor)
  function get(name, frame = 0, variant) {
    const key = name + '|' + frame + '|' + (variant || '');
    let c = cache.get(key);
    if (c) return c;
    const over = variant !== undefined && variant !== null && variant !== '' ? ART.VARIANTS[name]?.[variant] || null : null;
    c = toCanvas(ART.grid(name, frame, over));
    cache.set(key, c);
    return c;
  }
  function frames(name) { return ART.S[name] ? ART.S[name].frames.length : 0; }
  function hero(pose, coat, sex) {
    const key = 'hero|' + pose + '|' + coat + '|' + sex;
    let c = cache.get(key);
    if (!c) { c = toCanvas(ART.heroGrid(pose, coat, sex)); cache.set(key, c); }
    return c;
  }
  // weapon in one of 4 lossless orientations: 0 up-right, 1 down-right (90° cw), 2 up-left (mirror), 3 down-left
  function weapon(name, grade, group, turn) {
    const key = 'wpn|' + name + '|' + grade + '|' + group + '|' + turn;
    let c = cache.get(key);
    if (c) return c;
    const src = icon(name, grade, group);
    const w = src.width, h = src.height;
    c = mkCanvas(turn === 1 || turn === 3 ? h : w, turn === 1 || turn === 3 ? w : h);
    const x = c.getContext('2d');
    x.save();
    if (turn === 1) { x.translate(h, 0); x.rotate(Math.PI / 2); }
    else if (turn === 2) { x.translate(w, 0); x.scale(-1, 1); }
    else if (turn === 3) { x.translate(0, w); x.rotate(-Math.PI / 2); }
    x.drawImage(src, 0, 0);
    x.restore();
    const gp = ART.GRIP[name] || [3, 12], gx = gp[0] + 1, gy = gp[1] + 1; // +1 outline pad
    if (turn === 0) { c.ox = gx; c.oy = gy; }
    else if (turn === 1) { c.ox = h - 1 - gy; c.oy = gx; }
    else if (turn === 2) { c.ox = w - 1 - gx; c.oy = gy; }
    else { c.ox = gy; c.oy = w - 1 - gx; }
    cache.set(key, c);
    return c;
  }
  // equipment art: metal / cloth by tier group, gem by grade, orb by element
  function overFor(name, grade, group, el) {
    const o = { m: METAL[group] || METAL[0], l: CLOTH[group] || CLOTH[0], e: GRADES[grade] ? GRADES[grade].color : PAL.steel };
    if (/^(c_|m_)/.test(name)) o.g = METAL[group] || METAL[0];
    if (el) o.o = ELEM_RAMP[el];
    return o;
  }
  function icon(name, grade = 0, group = 0, el) {
    const key = 'icon|' + name + '|' + grade + '|' + group + '|' + (el || '');
    let c = cache.get(key);
    if (c) return c;
    c = toCanvas(ART.grid(name, 0, overFor(name, grade, group, el)));
    cache.set(key, c);
    return c;
  }
  const item = it => icon(TYPES[it.t].icon, it.g, MATERIAL_GROUP(tierOf(it.l)), it.el);
  // the hunter's held weapons and off-hands (h_*), same recolor rules
  const held = (name, it) => icon(name, it ? it.g : 0, it ? MATERIAL_GROUP(tierOf(it.l)) : 0, it && it.el);
  // solid silhouette of a sprite in one color (hit flash, shadows, ghosts)
  const tints = new WeakMap();
  function tint(img, color) {
    let m = tints.get(img);
    if (!m) { m = new Map(); tints.set(img, m); }
    let c = m.get(color);
    if (c) return c;
    c = mkCanvas(img.width, img.height);
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
    c.ox = img.ox; c.oy = img.oy;
    m.set(color, c);
    return c;
  }
  // per-pixel colors of a sprite, used to shatter it into particles on death
  const pixels = new WeakMap();
  function pixelsOf(img) {
    let p = pixels.get(img);
    if (p) return p;
    const d = img.getContext('2d').getImageData(0, 0, img.width, img.height).data;
    p = [];
    for (let y = 0; y < img.height; y += 2) for (let x = 0; x < img.width; x += 2) {
      const i = (y * img.width + x) * 4;
      if (d[i + 3]) p.push([x, y, '#' + [d[i], d[i + 1], d[i + 2]].map(v => v.toString(16).padStart(2, '0')).join('')]);
    }
    pixels.set(img, p);
    return p;
  }
  // draw anchored at (x, y); flip mirrors around the anchor
  function draw(ctx, img, x, y, o) {
    if (!img) return;
    let src = img;
    if (o && o.white) src = tint(img, '#ffffff');
    else if (o && o.tint) src = tint(img, o.tint);
    const a = o && o.alpha !== undefined ? o.alpha : 1;
    if (a <= 0) return;
    const pa = ctx.globalAlpha;
    if (a < 1) ctx.globalAlpha = pa * a;
    const ox = img.ox || 0, oy = img.oy || 0;
    if (o && o.flip) {
      ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(-1, 1);
      ctx.drawImage(src, -ox, -oy); ctx.restore();
    } else ctx.drawImage(src, Math.round(x - ox), Math.round(y - oy));
    ctx.globalAlpha = pa;
  }
  return { get, frames, hero, weapon, icon, item, held, tint, pixelsOf, draw, cache };
})();

// hunter portraits (portraits.js): full = 立绘 128 px, face = avatar 48 px, mini = HUD avatar 32 px
const Portraits = (() => {
  const img = {};
  function load() {
    const P = window.TBMH_PORTRAITS || {};
    return Promise.all(Object.entries(P).map(([k, src]) => new Promise(res => { const i = new Image(); i.onload = () => { img[k] = i; res(); }; i.onerror = res; i.src = src; })));
  }
  const key = (sex, kind) => (sex === 'f' ? 'sia' : 'loen') + '_' + kind;
  const get = (sex, kind) => img[key(sex, kind)] || null;
  return { load, full: sex => get(sex, 'full'), face: sex => get(sex, 'face'), mini: sex => get(sex, 'mini') };
})();

// =====================================================================
//  TEXT — Fusion Pixel rasterized and thresholded to hard pixels
// =====================================================================
const Text = (() => {
  const cache = new Map();
  const FAM = { 12: 'TB12', 8: 'TB8' };
  const scratch = mkCanvas(64, 32).getContext('2d', { willReadFrequently: true });
  const meas = mkCanvas(4, 4).getContext('2d');
  let ready = false;
  const b64 = s => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; };
  async function load() {
    try {
      if (window.TBMH_FONT && window.FontFace) {
        const fonts = [new FontFace('TB12', b64(TBMH_FONT.fp12)), new FontFace('TB8', b64(TBMH_FONT.fp8))];
        await Promise.all(fonts.map(f => f.load()));
        fonts.forEach(f => document.fonts.add(f));
      }
    } catch (e) { console.warn('pixel font', e); }
    ready = true; cache.clear();
  }
  const font = size => `${size}px ${FAM[size] || 'TB12'}, monospace`;
  // TB8 only carries ASCII; anything else falls back to the 12 px face
  const sizeFor = (str, size) => (size === 8 && /[^\x20-\x7e]/.test(str) ? 12 : size);
  function width(str, size = 12) { str = String(str); size = sizeFor(str, size); meas.font = font(size); return Math.round(meas.measureText(str).width); }
  function sprite(str, size, color, outline) {
    const key = size + color + (outline || '') + '|' + str;
    let c = cache.get(key);
    if (c) return c;
    const pad = outline ? 1 : 0;
    const w = Math.max(1, width(str, size) + pad * 2 + 1), h = size + 4 + pad * 2;
    const sc = scratch.canvas;
    if (sc.width < w || sc.height < h) { sc.width = Math.max(sc.width, w); sc.height = Math.max(sc.height, h); }
    scratch.clearRect(0, 0, sc.width, sc.height);
    scratch.font = font(size); scratch.textBaseline = 'top'; scratch.fillStyle = '#fff';
    scratch.fillText(str, pad, pad + (size === 12 ? 1 : 0));
    const img = scratch.getImageData(0, 0, w, h), d = img.data;
    const mask = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) mask[i] = d[i * 4 + 3] > 110 ? 1 : 0;
    const [r, g, b] = rgb(color), oc = outline ? rgb(outline) : null;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, j = i * 4;
      if (mask[i]) { d[j] = r; d[j + 1] = g; d[j + 2] = b; d[j + 3] = 255; continue; }
      if (oc && ((x > 0 && mask[i - 1]) || (x < w - 1 && mask[i + 1]) || (y > 0 && mask[i - w]) || (y < h - 1 && mask[i + w]) ||
        (x > 0 && y > 0 && mask[i - w - 1]) || (x < w - 1 && y > 0 && mask[i - w + 1]) || (x > 0 && y < h - 1 && mask[i + w - 1]) || (x < w - 1 && y < h - 1 && mask[i + w + 1]))) {
        d[j] = oc[0]; d[j + 1] = oc[1]; d[j + 2] = oc[2]; d[j + 3] = 255; continue;
      }
      d[j + 3] = 0;
    }
    c = mkCanvas(w, h);
    c.getContext('2d').putImageData(img, 0, 0);
    if (cache.size > 3000) cache.clear();
    cache.set(key, c);
    return c;
  }
  // draw text; returns its width
  function draw(ctx, str, x, y, o = {}) {
    str = String(str);
    if (!str) return 0;
    const size = sizeFor(str, o.size || 12);
    const spr = sprite(str, size, o.color || PAL.cream, o.outline);
    let dx = x, dy = y - (o.outline ? 1 : 0);
    const w = spr.width - 1 - (o.outline ? 2 : 0);
    if (o.align === 'center') dx -= Math.floor(w / 2); else if (o.align === 'right') dx -= w;
    if (o.outline) dx -= 1;
    const pa = ctx.globalAlpha;
    if (o.alpha !== undefined) ctx.globalAlpha = pa * o.alpha;
    if (o.shadow) ctx.drawImage(sprite(str, size, o.shadow, o.outline ? o.shadow : null), Math.round(dx) + 1, Math.round(dy) + 1);
    ctx.drawImage(spr, Math.round(dx), Math.round(dy));
    ctx.globalAlpha = pa;
    return w;
  }
  function wrap(str, maxW, size = 12) {
    const lines = [];
    for (const para of String(str).split('\n')) {
      let cur = '';
      for (const ch of para) {
        const t = cur + ch;
        if (width(t, size) > maxW && cur) {
          if (/[，。、；：！？）」』,.;:!?)%]/.test(ch)) { lines.push(t); cur = ''; continue; }
          lines.push(cur); cur = ch;
        } else cur = t;
      }
      lines.push(cur);
    }
    return lines;
  }
  return { load, draw, width, wrap, get ready() { return ready; } };
})();

// =====================================================================
//  DIGITS — hand-drawn 8-bit numerals for damage pop-ups
//  small 3×5 and big 5×7, outlined when baked
// =====================================================================
const Digits = (() => {
  const S3 = {
    '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001',
    '5': '111100111001111', '6': '111100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001111',
    '.': '000000000000010', '+': '000010111010000', '-': '000000111000000', '!': '010010010000010', '%': '101001010100101',
    K: '101101110101101', M: '101111111101101', B: '110101110101110', T: '111010010010010',
    A: '010101111101101', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100', G: '011100101101011',
    H: '101101111101101', I: '111010010010111', J: '001001001101010', L: '100100100100111', N: '110101101101101', O: '010101101101010',
    P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', U: '101101101101111', V: '101101101101010',
    W: '101101111111101', X: '101101010101101', Y: '101101010010010', Z: '111001010100111',
  };
  const S5 = {
    '0': ['01110', '10011', '10101', '10101', '11001', '10001', '01110'], '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
    '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'], '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
    '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'], '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
    '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'], '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
    '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'], '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
    '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'], '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
    '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'], '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
    K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'], M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
    B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'], T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  };
  const cache = new Map();
  function glyph(ch, big) {
    if (big && S5[ch]) return S5[ch];
    const s = S3[ch] || S3[ch.toUpperCase()];
    if (!s) return null;
    return [0, 1, 2, 3, 4].map(r => s.slice(r * 3, r * 3 + 3));
  }
  // number string -> outlined canvas
  function sprite(str, color, big, outline = PAL.ink, shade) {
    const key = str + color + (big ? 'B' : 's') + outline + (shade || '');
    let c = cache.get(key);
    if (c) return c;
    const chars = [...str].map(ch => glyph(ch, big && !!S5[ch]) || glyph(ch, false)).filter(Boolean);
    const gh = big ? 7 : 5, gap = 1;
    let w = 2, x = 1;
    for (const g of chars) w += g[0].length + gap;
    const h = gh + 2 + (big ? 1 : 0);
    c = mkCanvas(w + 1, h + 1);
    const ctx = c.getContext('2d'), ox = rgb(outline);
    const solid = new Uint8Array((w + 1) * (h + 1)), col = [];
    for (const g of chars) {
      const gw = g[0].length, top = 1 + (gh - g.length);
      g.forEach((row, ry) => [...row].forEach((b, rx) => { if (b === '1') { const px = x + rx, py = top + ry; solid[py * (w + 1) + px] = 1; col.push([px, py, ry]); } }));
      x += gw + gap;
    }
    const img = ctx.createImageData(w + 1, h + 1), d = img.data, cc = rgb(color), sc = rgb(shade || color);
    for (let i = 0; i < solid.length; i++) {
      if (solid[i]) continue;
      const px = i % (w + 1), py = (i / (w + 1)) | 0;
      let n = false;
      for (let dy = -1; dy <= 1 && !n; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = px + dx, yy = py + dy; if (xx >= 0 && yy >= 0 && xx <= w && yy <= h && solid[yy * (w + 1) + xx]) { n = true; break; } }
      if (n) { d[i * 4] = ox[0]; d[i * 4 + 1] = ox[1]; d[i * 4 + 2] = ox[2]; d[i * 4 + 3] = 255; }
    }
    for (const [px, py, ry] of col) {
      const i = (py * (w + 1) + px) * 4, c2 = ry >= gh - 2 ? sc : cc;
      d[i] = c2[0]; d[i + 1] = c2[1]; d[i + 2] = c2[2]; d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    if (cache.size > 800) cache.clear();
    cache.set(key, c);
    return c;
  }
  function draw(ctx, str, x, y, o = {}) {
    const c = sprite(String(str), o.color || PAL.white, !!o.big, o.outline || PAL.ink, o.shade);
    ctx.drawImage(c, Math.round(x - (o.align === 'left' ? 0 : c.width / 2)), Math.round(y - c.height / 2));
    return c.width;
  }
  return { draw, sprite };
})();

// =====================================================================
//  FRAMES — beveled panels, buttons and rarity borders
// =====================================================================
const Frame = {
  // dark recessed panel with a lit top edge
  panel(ctx, x, y, w, h, o = {}) {
    const fill = o.fill || PAL.night, edge = o.edge || PAL.ink, hi = o.hi || PAL.dusk;
    ctx.fillStyle = edge; ctx.fillRect(x + 1, y, w - 2, h); ctx.fillRect(x, y + 1, w, h - 2);
    ctx.fillStyle = fill; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = hi; ctx.fillRect(x + 2, y + 1, w - 4, 1);
    if (o.lo !== false) { ctx.fillStyle = o.lo || 'rgba(0,0,0,0.25)'; ctx.fillRect(x + 2, y + h - 2, w - 4, 1); }
  },
  // wood-and-brass plate used for headers and the bounty board
  wood(ctx, x, y, w, h) {
    ctx.fillStyle = PAL.ink; ctx.fillRect(x + 1, y, w - 2, h); ctx.fillRect(x, y + 1, w, h - 2);
    ctx.fillStyle = PAL.bark; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = PAL.brown; ctx.fillRect(x + 2, y + 1, w - 4, 1);
    ctx.fillStyle = PAL.soil;
    for (let yy = y + 4; yy < y + h - 2; yy += 5) ctx.fillRect(x + 2, yy, w - 4, 1);
    ctx.fillStyle = PAL.amber;
    for (const [px, py] of [[x + 2, y + 2], [x + w - 4, y + 2], [x + 2, y + h - 4], [x + w - 4, y + h - 4]]) ctx.fillRect(px, py, 2, 2);
  },
  parchment(ctx, x, y, w, h) {
    ctx.fillStyle = PAL.bark; ctx.fillRect(x + 1, y, w - 2, h); ctx.fillRect(x, y + 1, w, h - 2);
    ctx.fillStyle = PAL.cream; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = PAL.tan; ctx.fillRect(x + 1, y + h - 3, w - 2, 2); ctx.fillRect(x + w - 3, y + 1, 2, h - 2);
    ctx.fillStyle = PAL.white; ctx.fillRect(x + 2, y + 1, w - 6, 1);
    // tiny tears at the corners
    ctx.fillStyle = PAL.tan; ctx.fillRect(x + 1, y + 1, 2, 1); ctx.fillRect(x + w - 3, y + h - 2, 2, 1);
  },
  // button: raised, hovered, pressed, disabled
  button(ctx, x, y, w, h, st, kind = 'plain') {
    const C = kind === 'gold' ? [PAL.amber, PAL.yellow, PAL.rust, PAL.bark] : kind === 'green' ? [PAL.leaf, PAL.green, PAL.moss, PAL.pine] : kind === 'red' ? [PAL.red, PAL.pink, PAL.wine, PAL.soil] : kind === 'blue' ? [PAL.navy, PAL.blue, PAL.night, PAL.ink] : [PAL.dusk, PAL.slate, PAL.night, PAL.ink];
    let [face, hi, lo, edge] = C;
    if (st.disabled) { face = PAL.night; hi = PAL.dusk; lo = PAL.ink; edge = PAL.ink; }
    else if (st.hover && !st.down) face = mixHex(face, hi, 0.35);
    const dy = st.down ? 1 : 0;
    ctx.fillStyle = edge; ctx.fillRect(x + 1, y, w - 2, h); ctx.fillRect(x, y + 1, w, h - 2);
    ctx.fillStyle = lo; ctx.fillRect(x + 1, y + 1 + dy, w - 2, h - 2 - dy);
    ctx.fillStyle = face; ctx.fillRect(x + 1, y + 1 + dy, w - 2, h - 3);
    if (!st.down) { ctx.fillStyle = hi; ctx.fillRect(x + 2, y + 1, w - 4, 1); }
    if (st.on) { ctx.fillStyle = PAL.yellow; ctx.fillRect(x + 2, y + h - 3, w - 4, 1); }
  },
  // item slot border by grade: every grade has its own pixel pattern, from 传说 on with a running shimmer
  rarity(ctx, x, y, w, h, r, t = 0) {
    if (r >= 5) return this.mythic(ctx, x, y, w, h, r, t);
    const R = RARITY[r];
    ctx.fillStyle = PAL.ink; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = R.deep; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    if (r === 0) { ctx.fillStyle = R.dark; this.ring(ctx, x + 1, y + 1, w - 2, h - 2); return; }
    if (r === 1) { ctx.fillStyle = R.dark; this.ring(ctx, x + 1, y + 1, w - 2, h - 2); ctx.fillStyle = R.color; this.ring(ctx, x + 2, y + 2, w - 4, h - 4, true); return; }
    if (r === 2) {
      ctx.fillStyle = R.color; this.ring(ctx, x + 1, y + 1, w - 2, h - 2);
      ctx.fillStyle = R.glow; for (const [px, py] of [[x + 1, y + 1], [x + w - 3, y + 1], [x + 1, y + h - 3], [x + w - 3, y + h - 3]]) ctx.fillRect(px, py, 2, 2);
      return;
    }
    if (r === 3) {
      ctx.fillStyle = R.dark; this.ring(ctx, x + 1, y + 1, w - 2, h - 2);
      ctx.fillStyle = R.color; this.ring(ctx, x + 2, y + 2, w - 4, h - 4, true);
      ctx.fillStyle = R.glow;
      for (const [px, py] of [[x, y], [x + w - 1, y], [x, y + h - 1], [x + w - 1, y + h - 1]]) { ctx.fillRect(px - 1, py, 3, 1); ctx.fillRect(px, py - 1, 1, 3); }
      return;
    }
    // legendary: gold double border, ruby corners and a shimmer running round the edge
    ctx.fillStyle = PAL.amber; this.ring(ctx, x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = PAL.yellow; this.ring(ctx, x + 2, y + 2, w - 4, h - 4, true);
    ctx.fillStyle = PAL.red; for (const [px, py] of [[x, y], [x + w - 2, y], [x, y + h - 2], [x + w - 2, y + h - 2]]) ctx.fillRect(px, py, 2, 2);
    const per = 2 * (w + h - 4), k = Math.floor((t * 40) % per);
    for (let j = 0; j < 3; j++) {
      const q = (k + j * 2) % per;
      let px, py;
      if (q < w - 2) { px = x + 1 + q; py = y + 1; } else if (q < w + h - 4) { px = x + w - 2; py = y + 1 + q - (w - 2); }
      else if (q < 2 * w + h - 6) { px = x + w - 2 - (q - (w + h - 4)); py = y + h - 2; } else { px = x + 1; py = y + h - 2 - (q - (2 * w + h - 6)); }
      ctx.fillStyle = PAL.white; ctx.fillRect(px, py, 1, 1);
    }
  },
  // 不朽 · 至宝 · 超凡 · 天界 · 宇宙: double border, jeweled corners, shimmer; 宇宙 cycles through every grade color
  mythic(ctx, x, y, w, h, r, t) {
    const R = GRADES[r];
    ctx.fillStyle = PAL.ink; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = R.deep; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    const pulse = r >= 7 ? 0.5 + 0.5 * Math.sin(t * 5) : 0;
    const col = r === 9 ? GRADES[Math.floor(t * 4) % 9].color : R.color;
    ctx.fillStyle = r >= 7 && pulse > 0.6 ? R.glow : R.dark; this.ring(ctx, x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = col; this.ring(ctx, x + 2, y + 2, w - 4, h - 4, true);
    ctx.fillStyle = R.glow;
    for (const [px, py] of [[x, y], [x + w - 3, y], [x, y + h - 3], [x + w - 3, y + h - 3]]) { ctx.fillRect(px, py + 1, 3, 1); ctx.fillRect(px + 1, py, 1, 3); }
    if (r >= 8) { ctx.fillStyle = PAL.white; ctx.fillRect(x + (w >> 1), y, 1, 2); ctx.fillRect(x + (w >> 1), y + h - 2, 1, 2); ctx.fillRect(x, y + (h >> 1), 2, 1); ctx.fillRect(x + w - 2, y + (h >> 1), 2, 1); }
    const per = 2 * (w + h - 4), k = Math.floor((t * (30 + r * 4)) % per), n = r - 2;
    for (let j = 0; j < n; j++) {
      const q = (k + j * Math.floor(per / n)) % per;
      let px, py;
      if (q < w - 2) { px = x + 1 + q; py = y + 1; } else if (q < w + h - 4) { px = x + w - 2; py = y + 1 + q - (w - 2); }
      else if (q < 2 * w + h - 6) { px = x + w - 2 - (q - (w + h - 4)); py = y + h - 2; } else { px = x + 1; py = y + h - 2 - (q - (2 * w + h - 6)); }
      ctx.fillStyle = r === 9 ? GRADES[(j + Math.floor(t * 6)) % 9].glow : PAL.white; ctx.fillRect(px, py, 1, 1);
    }
  },
  ring(ctx, x, y, w, h, gaps) {
    ctx.fillRect(x + (gaps ? 1 : 0), y, w - (gaps ? 2 : 0), 1); ctx.fillRect(x + (gaps ? 1 : 0), y + h - 1, w - (gaps ? 2 : 0), 1);
    ctx.fillRect(x, y + (gaps ? 1 : 0), 1, h - (gaps ? 2 : 0)); ctx.fillRect(x + w - 1, y + (gaps ? 1 : 0), 1, h - (gaps ? 2 : 0));
  },
  bar(ctx, x, y, w, h, v, color, o = {}) {
    ctx.fillStyle = PAL.ink; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = o.back || PAL.night; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    const fw = Math.round((w - 2) * clamp(v, 0, 1));
    if (fw > 0) {
      ctx.fillStyle = color; ctx.fillRect(x + 1, y + 1, fw, h - 2);
      ctx.fillStyle = o.hi || mixHex(color, '#ffffff', 0.35); ctx.fillRect(x + 1, y + 1, fw, 1);
      if (h > 4) { ctx.fillStyle = mixHex(color, '#000000', 0.25); ctx.fillRect(x + 1, y + h - 2, fw, 1); }
    }
    if (o.ghost !== undefined && o.ghost > v) { ctx.fillStyle = rgba(PAL.white, 0.55); const gw = Math.round((w - 2) * clamp(o.ghost, 0, 1)); ctx.fillRect(x + 1 + fw, y + 1, gw - fw, h - 2); }
  },
};
