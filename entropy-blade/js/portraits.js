'use strict';
// =====================================================================
//  PORTRAITS — painted character art (立绘) loaded from art/<hero>.webp,
//  resampled once per needed size and drawn on Gfx's hi-res art layer.
//  To swap a portrait, drop a square image over art/<hero>.webp
//  (art/<hero>.png / .jpg also work if the .webp is removed).
// =====================================================================
const PORTRAIT_EXT = ['webp', 'png', 'jpg'];
// per hero, normalized to the square art: where the panel crops center, and the HUD face window [x, y, size]
const PORTRAIT_META = {
  rin: { focus: [0.56, 0.4], face: [0.42, 0.19, 0.36], fx: 'petal' },
  eve: { focus: [0.5, 0.4], face: [0.31, 0.2, 0.38], fx: 'star' },
  gao: { focus: [0.52, 0.38], face: [0.31, 0.16, 0.4], fx: 'ember' },
};
const Portraits = {
  img: {}, cache: {},
  load() {
    // deployed builds stamp window.BUILD so a new build never shows yesterday's cached art
    const v = window.BUILD ? '?v=' + window.BUILD : '';
    return Promise.all(HERO_ORDER.map(id => new Promise(done => {
      const img = new Image();
      let k = 0;
      img.onload = () => { this.img[id] = img; done(); };
      img.onerror = () => { if (++k < PORTRAIT_EXT.length) img.src = `art/${id}.${PORTRAIT_EXT[k]}${v}`; else done(); };
      img.src = `art/${id}.${PORTRAIT_EXT[0]}${v}`;
    })));
  },
  // the source: the painting, or a stand-in card built from the sprite if the file is missing
  src(id) {
    if (this.img[id]) return this.img[id];
    if (!this.img['_' + id]) {
      const c = makeCanvas(256, 256), x = c.getContext('2d'), h = HEROES[id];
      const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, shade(h.color, -0.55)); g.addColorStop(1, '#05030a');
      x.fillStyle = g; x.fillRect(0, 0, 256, 256);
      const spr = SPR[id], fr = spr && spr.anims.idle.frames[0];
      if (fr) { x.imageSmoothingEnabled = false; x.drawImage(fr, 128 - spr.ox * 4, 236 - spr.oy * 4, fr.width * 4, fr.height * 4); }
      this.img['_' + id] = c;
    }
    return this.img['_' + id];
  },
  // a square window [x, y, size] (normalized, default the whole art) resampled to px × px
  get(id, win, px) {
    px = Math.max(8, Math.round(px));
    const w = win || [0, 0, 1], key = id + '|' + w.join(',') + '|' + px + (this.img[id] ? '' : '?');
    if (this.cache[key]) return this.cache[key];
    const img = this.src(id), S = Math.min(img.width, img.height);
    let src = img, sx = w[0] * S, sy = w[1] * S, sw = w[2] * S;
    // halve with smoothing until close, then one final high-quality step: no shimmer, no mush
    while (sw / 2 >= px) {
      const c = makeCanvas(Math.round(sw / 2), Math.round(sw / 2)), x = c.getContext('2d');
      x.imageSmoothingQuality = 'high';
      x.drawImage(src, sx, sy, sw, sw, 0, 0, c.width, c.height);
      src = c; sx = 0; sy = 0; sw = c.width;
    }
    const out = makeCanvas(px, px), o = out.getContext('2d');
    o.imageSmoothingQuality = 'high';
    o.drawImage(src, sx, sy, sw, sw, 0, 0, px, px);
    return (this.cache[key] = out);
  },
};

// hero-themed motes drifting over a portrait: petals for 凛, stars for 伊芙, embers for 罡
function portraitMotes(c, kind, x0, y0, w, h, t, n = 16, alpha = 1) {
  for (let k = 0; k < n; k++) {
    const r1 = (Math.sin(k * 91.7) * 43758.5) % 1, r2 = (Math.sin(k * 37.3 + 4.1) * 24634.6) % 1;
    const u = Math.abs(r1), v = Math.abs(r2);
    const ph = (t * (0.07 + v * 0.06) + u) % 1;
    const a = Math.sin(ph * Math.PI) * alpha;
    if (a <= 0.02) continue;
    let px, py;
    c.save();
    c.globalAlpha = a;
    if (kind === 'petal') {
      // drifting down and sideways with the wind
      px = x0 + ((u + ph * 0.5) % 1) * w; py = y0 + ph * h;
      c.translate(px, py); c.rotate(t * (1 + v) + k); c.scale(1, 0.55 + 0.45 * Math.sin(t * 3 + k));
      c.fillStyle = k % 3 ? '#ffb3c8' : '#ff6a8a';
      c.beginPath(); c.ellipse(0, 0, 3.2, 1.8, 0, 0, TAU); c.fill();
    } else if (kind === 'star') {
      // twinkling in place, slowly rising
      px = x0 + u * w; py = y0 + h - ((v + ph * 0.25) % 1) * h;
      const s = (1.5 + v * 2.5) * (0.6 + 0.4 * Math.sin(t * 5 + k * 2));
      c.translate(px, py);
      c.fillStyle = k % 4 ? '#ffe7a0' : '#ffffff';
      c.beginPath(); c.moveTo(0, -s * 2); c.lineTo(s * 0.45, -s * 0.45); c.lineTo(s * 2, 0); c.lineTo(s * 0.45, s * 0.45);
      c.lineTo(0, s * 2); c.lineTo(-s * 0.45, s * 0.45); c.lineTo(-s * 2, 0); c.lineTo(-s * 0.45, -s * 0.45); c.closePath(); c.fill();
    } else {
      // embers rising and flickering
      px = x0 + u * w + Math.sin(t * 2 + k) * 6; py = y0 + h - ph * h;
      const s = 1.2 + v * 2;
      c.fillStyle = Math.sin(t * 20 + k) > 0 ? '#ffb040' : '#ff5a20';
      c.fillRect(px - s / 2, py - s / 2, s, s);
    }
    c.restore();
  }
}
