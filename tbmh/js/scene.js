'use strict';
// =====================================================================
//  SCENE — parallax biomes painted at 1× with hard pixels, plus the
//  hunter, monsters, projectiles and their status effects
// =====================================================================
const SH = 150, GY = 122, TW = 768;
const Paint2 = {
  circle(c, cx, cy, r, col) {
    c.fillStyle = col;
    for (let y = -r; y <= r; y++) { const w = Math.floor(Math.sqrt(r * r - y * y + r * 0.6)); c.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1); }
  },
  ellipse(c, cx, cy, rx, ry, col) {
    c.fillStyle = col;
    for (let y = -ry; y <= ry; y++) { const w = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry + 0.5)))); c.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1); }
  },
  tri(c, x0, y0, x1, x2, y1, col) { // apex (x0,y0), base from x1..x2 at y1
    c.fillStyle = col;
    for (let y = y0; y <= y1; y++) { const t = (y - y0) / Math.max(1, y1 - y0); const a = Math.round(lerp(x0, x1, t)), b = Math.round(lerp(x0, x2, t)); c.fillRect(a, y, b - a + 1, 1); }
  },
  line(c, x0, y0, x1, y1, col, w = 1) {
    c.fillStyle = col;
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) c.fillRect(Math.round(lerp(x0, x1, i / n)), Math.round(lerp(y0, y1, i / n)), w, w);
  },
  dither(c, x, y, w, h, col, phase = 0) {
    c.fillStyle = col;
    for (let yy = 0; yy < h; yy++) for (let xx = (yy + phase) & 1; xx < w; xx += 2) c.fillRect(x + xx, y + yy, 1, 1);
  },
};
// periodic value noise for seamless layers
function pnoise(x, period, seed, oct = 3) {
  let v = 0, amp = 1, tot = 0, f = 1;
  for (let o = 0; o < oct; o++) {
    const p = Math.max(1, Math.round(period / (16 * f))), xi = x / (TW / p);
    const i = Math.floor(xi), t = smooth(xi - i);
    const a = hash1(((i % p) + p) % p, seed + o * 31), b = hash1((((i + 1) % p) + p) % p, seed + o * 31);
    v += lerp(a, b, t) * amp; tot += amp; amp *= 0.5; f *= 2;
  }
  return v / tot;
}

const BIOME_LOOK = {
  meadow: { sky: [PAL.blue, PAL.blue, PAL.cyan, PAL.cyan], far: [PAL.steel, PAL.mist, PAL.white], mid: [PAL.moss, PAL.leaf, PAL.green], ground: [PAL.green, PAL.leaf, PAL.bark, PAL.soil], sun: PAL.yellow },
  grove: { sky: [PAL.night, PAL.plum, PAL.magenta, PAL.pink], far: [PAL.pine, PAL.moss, PAL.leaf], mid: [PAL.ink, PAL.pine, PAL.moss], ground: [PAL.leaf, PAL.moss, PAL.soil, PAL.ink], moon: PAL.pink },
  desert: { sky: [PAL.rust, PAL.orange, PAL.amber, PAL.yellow], far: [PAL.clay, PAL.tan, PAL.cream], mid: [PAL.bark, PAL.brown, PAL.tan], ground: [PAL.cream, PAL.tan, PAL.clay, PAL.brown], sun: PAL.white },
  tundra: { sky: [PAL.ink, PAL.night, PAL.dusk, PAL.slate], far: [PAL.slate, PAL.steel, PAL.white], mid: [PAL.ink, PAL.pine, PAL.white], ground: [PAL.white, PAL.mist, PAL.steel, PAL.slate], aurora: true },
  caldera: { sky: [PAL.soil, PAL.wine, PAL.rust, PAL.orange], far: [PAL.ink, PAL.soil, PAL.wine], mid: [PAL.ink, PAL.night, PAL.dusk], ground: [PAL.dusk, PAL.night, PAL.ink, PAL.ink], lava: true },
  marsh: { sky: [PAL.ink, PAL.night, PAL.pine, PAL.moss], far: [PAL.night, PAL.dusk, PAL.slate], mid: [PAL.ink, PAL.soil, PAL.bark], ground: [PAL.moss, PAL.pine, PAL.ink, PAL.ink], moon: PAL.cream, water: true },
  cavern: { sky: [PAL.ink, PAL.ink, PAL.night, PAL.night], far: [PAL.night, PAL.dusk, PAL.plum], mid: [PAL.ink, PAL.dusk, PAL.slate], ground: [PAL.slate, PAL.dusk, PAL.night, PAL.ink], cave: true },
  isles: { sky: [PAL.blue, PAL.cyan, PAL.cyan, PAL.white], far: [PAL.mist, PAL.white, PAL.white], mid: [PAL.steel, PAL.mist, PAL.white], ground: [PAL.white, PAL.mist, PAL.steel, PAL.slate], sun: PAL.yellow },
  abyss: { sky: [PAL.ink, PAL.ink, PAL.plum, PAL.wine], far: [PAL.ink, PAL.plum, PAL.magenta], mid: [PAL.ink, PAL.night, PAL.plum], ground: [PAL.dusk, PAL.night, PAL.ink, PAL.ink], moon: PAL.red, rift: true },
};
// each difficulty paints the same regions in its own light
const DIFF_TINT = [null, [PAL.plum, 0.2], [PAL.wine, 0.24], [PAL.ink, 0.32]];

const Scene = (() => {
  const layers = new Map();
  // ---------- prop painters (background silhouettes) ----------
  const prop = {
    roundTree(c, x, base, s, col) {
      c.fillStyle = PAL.bark; c.fillRect(x - 1, base - 8 * s, 3, 8 * s);
      Paint2.circle(c, x, base - 12 * s, 6 * s, col[0]);
      Paint2.circle(c, x - 1, base - 13 * s, 5 * s, col[1]);
      Paint2.circle(c, x - 2, base - 15 * s, 2 * s, col[2]);
    },
    pine(c, x, base, s, col, snow) {
      c.fillStyle = PAL.soil; c.fillRect(x - 1, base - 4, 2, 4);
      for (let i = 0; i < 3; i++) {
        const y0 = base - 6 - i * 6 * s - 4 * s, y1 = base - 4 - i * 6 * s;
        Paint2.tri(c, x, y0, x - (7 - i * 2) * s, x + (7 - i * 2) * s, y1, col[0]);
        Paint2.tri(c, x - 1, y0 + 1, x - (6 - i * 2) * s, x, y1 - 1, col[1]);
        if (snow) { c.fillStyle = PAL.white; c.fillRect(x - (4 - i) * s, y1 - 1, (5 - i) * s, 1); c.fillRect(x - 1, y0, 2, 1); }
      }
    },
    mushroom(c, x, base, s) {
      c.fillStyle = PAL.cream; c.fillRect(x - 2 * s, base - 14 * s, 4 * s, 14 * s);
      c.fillStyle = PAL.tan; c.fillRect(x + s, base - 14 * s, s, 14 * s);
      Paint2.ellipse(c, x, base - 15 * s, 10 * s, 5 * s, PAL.wine);
      Paint2.ellipse(c, x - s, base - 16 * s, 9 * s, 4 * s, PAL.red);
      c.fillStyle = PAL.cream;
      for (const [dx, dy] of [[-5, -2], [2, -3], [6, -1], [-2, 0]]) c.fillRect(x + dx * s, base - 16 * s + dy * s, 2 * s, s + 1);
      c.fillStyle = PAL.ink; c.fillRect(x - 9 * s, base - 11 * s, 18 * s, 1);
    },
    cactus(c, x, base, s) {
      const g = [PAL.moss, PAL.leaf, PAL.green];
      c.fillStyle = g[1]; c.fillRect(x - 2, base - 16 * s, 4, 16 * s);
      c.fillRect(x - 7, base - 11 * s, 3, 5 * s); c.fillRect(x - 7, base - 7 * s, 6, 3);
      c.fillRect(x + 4, base - 13 * s, 3, 6 * s); c.fillRect(x + 1, base - 8 * s, 6, 3);
      c.fillStyle = g[2]; c.fillRect(x - 2, base - 16 * s, 1, 16 * s); c.fillRect(x - 7, base - 11 * s, 1, 5 * s);
      c.fillStyle = g[0]; c.fillRect(x + 1, base - 16 * s, 1, 16 * s);
    },
    pillar(c, x, base, s, broken) {
      const h = (broken ? 20 : 30) * s;
      c.fillStyle = PAL.brown; c.fillRect(x - 4 * s, base - h, 8 * s, h);
      c.fillStyle = PAL.tan; c.fillRect(x - 4 * s, base - h, 2 * s, h);
      c.fillStyle = PAL.bark; c.fillRect(x + 2 * s, base - h, 2 * s, h);
      c.fillStyle = PAL.tan; c.fillRect(x - 6 * s, base - h - 3 * s, 12 * s, 3 * s);
      if (broken) { c.fillStyle = 'rgba(0,0,0,0)'; c.clearRect(x + s, base - h - 3 * s, 5 * s, 3 * s); }
      c.fillStyle = PAL.bark; c.fillRect(x - s, base - h + 6 * s, 1, 4 * s); c.fillRect(x, base - h + 10 * s, 2, 1);
    },
    deadTree(c, x, base, s, col) {
      Paint2.line(c, x, base, x, base - 22 * s, col, 2);
      Paint2.line(c, x, base - 14 * s, x - 7 * s, base - 22 * s, col, 1);
      Paint2.line(c, x, base - 18 * s, x + 6 * s, base - 26 * s, col, 1);
      Paint2.line(c, x - 4 * s, base - 18 * s, x - 9 * s, base - 19 * s, col, 1);
      Paint2.line(c, x + 3 * s, base - 22 * s, x + 8 * s, base - 21 * s, col, 1);
    },
    crystal(c, x, base, s, cols) {
      const shards = [[0, 14, 3], [-4, 9, 2], [4, 10, 2], [-7, 6, 2], [7, 6, 2]];
      for (const [dx, h, w] of shards) {
        Paint2.tri(c, x + dx * s, base - h * s, x + (dx - w) * s, x + (dx + w) * s, base, cols[0]);
        Paint2.tri(c, x + dx * s, base - h * s + 1, x + (dx - w) * s + 1, x + dx * s, base - 1, cols[1]);
        c.fillStyle = cols[2]; c.fillRect(x + dx * s - 1, base - h * s + 2, 1, 2);
      }
    },
    rock(c, x, base, s, cols) {
      Paint2.ellipse(c, x, base - 3 * s, 7 * s, 4 * s, cols[0]);
      Paint2.ellipse(c, x - s, base - 4 * s, 5 * s, 3 * s, cols[1]);
      c.fillStyle = cols[2]; c.fillRect(x - 4 * s, base - 6 * s, 3 * s, 1);
    },
    cloud(c, x, y, s, cols) {
      Paint2.ellipse(c, x, y, 14 * s, 4 * s, cols[1]);
      Paint2.circle(c, x - 6 * s, y - 3 * s, 5 * s, cols[1]);
      Paint2.circle(c, x + 4 * s, y - 4 * s, 6 * s, cols[1]);
      Paint2.circle(c, x + 4 * s, y - 5 * s, 4 * s, cols[2]);
      Paint2.circle(c, x - 7 * s, y - 4 * s, 3 * s, cols[2]);
      c.fillStyle = cols[0]; c.fillRect(x - 13 * s, y + 3 * s, 26 * s, 1);
    },
    island(c, x, y, s, top, rock) {
      Paint2.tri(c, x, y + 12 * s, x - 12 * s, x + 12 * s, y, rock[0]);
      Paint2.tri(c, x - 1, y + 10 * s, x - 11 * s, x, y + 1, rock[1]);
      c.fillStyle = top[0]; c.fillRect(x - 13 * s, y - 2, 26 * s, 3);
      c.fillStyle = top[1]; c.fillRect(x - 12 * s, y - 2, 20 * s, 1);
      prop.roundTree(c, x + 4 * s, y - 1, s * 0.7, [PAL.moss, PAL.leaf, PAL.green]);
    },
    // the abyss: black spires with violet runes and the chains that hold the floating throne
    spire(c, x, base, s, h) {
      Paint2.tri(c, x, base - h * s, x - 6 * s, x + 6 * s, base, PAL.ink);
      Paint2.tri(c, x - 1, base - h * s + 3, x - 5 * s, x - 1, base - 1, PAL.night);
      c.fillStyle = PAL.magenta;
      for (let y = base - h * s + 8; y < base - 4; y += 7) c.fillRect(x - 1, y, 2, 2);
      c.fillStyle = PAL.pink; c.fillRect(x, base - h * s + 1, 1, 2);
    },
    chain(c, x, y0, y1) { c.fillStyle = PAL.dusk; for (let y = y0; y < y1; y += 3) { c.fillRect(x, y, 1, 2); c.fillRect(x - 1 + ((y / 3) & 1) * 2, y + 1, 1, 1); } },
    grave(c, x, base, s) {
      c.fillStyle = PAL.slate; c.fillRect(x - 3 * s, base - 8 * s, 6 * s, 8 * s); Paint2.circle(c, x, base - 8 * s, 3 * s, PAL.slate);
      c.fillStyle = PAL.steel; c.fillRect(x - 3 * s, base - 8 * s, s, 8 * s);
      c.fillStyle = PAL.dusk; c.fillRect(x - s, base - 7 * s, 2 * s, 1); c.fillRect(x - 0.5 * s, base - 8 * s, 1, 4 * s);
    },
  };

  // ---------- layer builders ----------
  function build(bid) {
    const L = BIOME_LOOK[bid], seed = ACTS.findIndex(b => b.id === bid) * 97 + 13;
    const sky = mkCanvas(1, SH), sx = sky.getContext('2d');
    // banded sky with dithered seams
    const bands = L.sky, bh = Math.ceil(GY / bands.length);
    bands.forEach((col, i) => { sx.fillStyle = col; sx.fillRect(0, i * bh, 1, bh + 1); });
    const skyW = mkCanvas(TW, SH), sw = skyW.getContext('2d');
    sw.drawImage(sky, 0, 0, TW, SH);
    sw.imageSmoothingEnabled = false;
    bands.forEach((col, i) => { if (i) Paint2.dither(sw, 0, i * bh - 2, TW, 2, bands[i - 1], i); if (i) Paint2.dither(sw, 0, i * bh, TW, 1, col, i + 1); });
    if (L.aurora) for (let k = 0; k < 2; k++) {
      // a soft ribbon: bright crest, dithered glow, then faint curtain streaks hanging below
      for (let x = 0; x < TW; x++) {
        const y = 14 + k * 14 + Math.round(Math.sin((x / TW) * TAU * 2 + k * 1.7) * 6 + Math.sin((x / TW) * TAU * 5 + k) * 2);
        sw.fillStyle = k ? PAL.cyan : PAL.green;
        if ((x + k) % 2 === 0) sw.fillRect(x, y, 1, 1);
        sw.fillStyle = k ? PAL.blue : PAL.leaf;
        sw.fillRect(x, y + 1, 1, 1);
        if (x % 2 === 0) sw.fillRect(x, y + 2, 1, 1);
        sw.fillStyle = PAL.pine;
        if (x % 3 === 0) sw.fillRect(x, y + 3, 1, 4 + Math.round(pnoise(x, TW, seed + k, 2) * 6));
      }
    }
    if (L.cave) {
      for (let x = 0; x < TW; x += 1) {
        const h = 6 + Math.floor(pnoise(x, TW, seed + 9, 3) * 14) + (hash1(x >> 2, seed) > 0.86 ? 10 : 0);
        sw.fillStyle = PAL.ink; sw.fillRect(x, 0, 1, h);
        sw.fillStyle = PAL.night; sw.fillRect(x, h, 1, 1);
      }
      for (let i = 0; i < 26; i++) { const x = Math.floor(hash1(i, seed + 3) * TW), y = 26 + Math.floor(hash1(i, seed + 5) * 50); sw.fillStyle = i % 2 ? PAL.magenta : PAL.cyan; sw.fillRect(x, y, 1, 1); }
    }
    // stars for night skies
    if (L.rift) {
      // a slow violet tear across the night sky
      for (let x = 0; x < TW; x++) {
        const y = 24 + Math.round(Math.sin((x / TW) * TAU * 1.5) * 8 + pnoise(x, TW, seed + 4, 2) * 6);
        const th = 1 + Math.round(pnoise(x, TW, seed + 5, 2) * 3);
        sw.fillStyle = PAL.plum; sw.fillRect(x, y - th - 1, 1, th * 2 + 3);
        sw.fillStyle = PAL.magenta; sw.fillRect(x, y - th, 1, th * 2 + 1);
        if (th > 2) { sw.fillStyle = PAL.pink; sw.fillRect(x, y, 1, 1); }
      }
    }
    if (bid === 'tundra' || bid === 'marsh' || bid === 'grove' || bid === 'abyss') for (let i = 0; i < 60; i++) {
      const x = Math.floor(hash1(i, seed) * TW), y = Math.floor(hash1(i, seed + 1) * 60);
      sw.fillStyle = i % 7 ? PAL.mist : PAL.yellow; sw.fillRect(x, y, 1, 1);
    }
    // far ridge
    const far = mkCanvas(TW, SH), fx = far.getContext('2d');
    const fh = x => GY - 22 - Math.floor(pnoise(x, TW, seed + 1, 3) * (L.cave ? 30 : 44));
    for (let x = 0; x < TW; x++) {
      const top = fh(x);
      fx.fillStyle = L.far[0]; fx.fillRect(x, top, 1, GY - top);
      if (L.far[2] && (bid === 'meadow' || bid === 'tundra') && top < GY - 50) { fx.fillStyle = L.far[2]; fx.fillRect(x, top, 1, Math.max(1, Math.floor((GY - 50 - top) * 0.6))); }
      if (fh(x - 1) > top) { fx.fillStyle = L.far[1]; fx.fillRect(x, top, 1, 2); }
    }
    if (bid === 'caldera') for (let v = 0; v < 3; v++) {
      const cx = 120 + v * 260, top = GY - 70 - v * 6;
      Paint2.tri(fx, cx, top, cx - 60, cx + 60, GY, PAL.ink);
      fx.fillStyle = PAL.orange; for (let y = top + 2; y < GY - 6; y += 1) if (hash1(y, v) > 0.35) fx.fillRect(cx - 1 + Math.round(Math.sin(y * 0.3 + v) * 2), y, 2, 1);
      fx.fillStyle = PAL.amber; fx.fillRect(cx - 4, top, 8, 2);
    }
    if (bid === 'isles') for (let i = 0; i < 4; i++) prop.island(fx, 90 + i * 190, 40 + (i % 2) * 18, 1.2, [PAL.green, PAL.yellow], [PAL.steel, PAL.mist]);
    if (bid === 'abyss') {
      // the far throne floating on its chains
      const tx = 380, ty = 52;
      Paint2.tri(fx, tx, ty + 30, tx - 40, tx + 40, ty + 4, PAL.ink);
      fx.fillStyle = PAL.ink; fx.fillRect(tx - 12, ty - 22, 24, 26); fx.fillRect(tx - 18, ty - 6, 36, 10);
      fx.fillStyle = PAL.plum; fx.fillRect(tx - 9, ty - 19, 18, 2); fx.fillRect(tx - 1, ty - 30, 2, 8);
      fx.fillStyle = PAL.magenta; fx.fillRect(tx - 2, ty - 12, 4, 4);
      prop.chain(fx, tx - 34, 0, ty + 6); prop.chain(fx, tx + 34, 0, ty + 6);
    }
    // mid props
    const mid = mkCanvas(TW, SH), mx = mid.getContext('2d');
    const base = GY - 4;
    if (bid === 'meadow') {
      for (let x = 0; x < TW; x++) { const t = base - 6 - Math.floor(pnoise(x, TW, seed + 2, 2) * 14); mx.fillStyle = L.mid[0]; mx.fillRect(x, t, 1, GY - t); if (x % 2) { mx.fillStyle = L.mid[1]; mx.fillRect(x, t, 1, 1); } }
      for (let i = 0; i < 14; i++) prop.roundTree(mx, Math.floor((i + hash1(i, seed)) * TW / 14), base - 4, 1 + (i % 3 === 0 ? 0.4 : 0), [L.mid[0], L.mid[1], L.mid[2]]);
      for (let i = 0; i < 5; i++) prop.cloud(sw, 80 + i * 150, 20 + (i % 3) * 10, 1, [PAL.mist, PAL.white, PAL.white]);
    } else if (bid === 'grove') {
      for (let i = 0; i < 16; i++) prop.pine(mx, Math.floor((i + hash1(i, seed)) * TW / 16), base, 1.4, [PAL.ink, PAL.pine]);
      for (let i = 0; i < 6; i++) prop.mushroom(mx, Math.floor((i + 0.5 + hash1(i, seed + 4) * 0.4) * TW / 6), base + 2, i % 2 ? 1 : 2);
    } else if (bid === 'desert') {
      for (let x = 0; x < TW; x++) { const t = base - 2 - Math.floor(pnoise(x, TW, seed + 2, 2) * 18); mx.fillStyle = L.far[1]; mx.fillRect(x, t, 1, GY - t); }
      for (let i = 0; i < 6; i++) prop.pillar(mx, Math.floor((i + hash1(i, seed)) * TW / 6), base + 2, 1.3, i % 2);
      for (let i = 0; i < 7; i++) prop.cactus(mx, Math.floor((i + 0.5) * TW / 7), base + 2, 1);
    } else if (bid === 'tundra') {
      for (let i = 0; i < 18; i++) prop.pine(mx, Math.floor((i + hash1(i, seed)) * TW / 18), base + 2, 1.2 + (i % 3) * 0.3, [PAL.ink, PAL.pine], true);
    } else if (bid === 'caldera') {
      for (let x = 0; x < TW; x++) { const t = base - 4 - Math.floor(pnoise(x, TW, seed + 2, 3) * 22); mx.fillStyle = PAL.ink; mx.fillRect(x, t, 1, GY - t); if (hash1(x, seed) > 0.97) { mx.fillStyle = PAL.orange; mx.fillRect(x, t + 3, 1, GY - t - 3); } }
    } else if (bid === 'marsh') {
      for (let i = 0; i < 10; i++) prop.deadTree(mx, Math.floor((i + hash1(i, seed)) * TW / 10), base + 2, 1.3, PAL.soil);
      for (let i = 0; i < 7; i++) prop.grave(mx, Math.floor((i + 0.4) * TW / 7), base + 2, 1);
    } else if (bid === 'cavern') {
      for (let x = 0; x < TW; x++) { const t = base - Math.floor(pnoise(x, TW, seed + 2, 3) * 26); mx.fillStyle = PAL.ink; mx.fillRect(x, t, 1, GY - t); }
      for (let i = 0; i < 9; i++) prop.crystal(mx, Math.floor((i + hash1(i, seed)) * TW / 9), base + 2, 1 + (i % 2) * 0.5, i % 3 ? [PAL.blue, PAL.cyan, PAL.white] : [PAL.plum, PAL.magenta, PAL.pink]);
    } else if (bid === 'isles') {
      for (let i = 0; i < 7; i++) prop.cloud(mx, Math.floor((i + 0.5) * TW / 7), base - 6 - (i % 2) * 8, 1.6, [PAL.mist, PAL.white, PAL.white]);
    } else if (bid === 'abyss') {
      for (let x = 0; x < TW; x++) { const t = base - 2 - Math.floor(pnoise(x, TW, seed + 2, 3) * 12); mx.fillStyle = PAL.ink; mx.fillRect(x, t, 1, GY - t); }
      for (let i = 0; i < 10; i++) prop.spire(mx, Math.floor((i + hash1(i, seed)) * TW / 10), base + 2, 1 + (i % 3) * 0.3, 22 + (i % 4) * 6);
    }
    // ground strip
    const gh = SH - GY + 2;
    const ground = mkCanvas(TW, gh), gx = ground.getContext('2d');
    const G = L.ground;
    gx.fillStyle = G[2]; gx.fillRect(0, 0, TW, gh);
    gx.fillStyle = G[3]; for (let y = 8; y < gh; y += 6) for (let x = (y * 7) % 11; x < TW; x += 11) gx.fillRect(x, y, 2, 1);
    for (let x = 0; x < TW; x++) {
      const h = 3 + Math.floor(pnoise(x, TW, seed + 7, 2) * 3);
      gx.fillStyle = G[1]; gx.fillRect(x, 0, 1, h + 2);
      gx.fillStyle = G[0]; gx.fillRect(x, 0, 1, h);
      if (bid === 'meadow' || bid === 'grove') { if (hash1(x, seed + 8) > 0.82) { gx.fillStyle = G[0]; gx.fillRect(x, -1, 1, 1); } }
    }
    if (L.water) { gx.fillStyle = PAL.pine; for (let y = 6; y < gh; y += 4) for (let x = (y * 5) % 9; x < TW; x += 9) gx.fillRect(x, y, 4, 1); gx.fillStyle = PAL.cyan; for (let i = 0; i < 40; i++) gx.fillRect(Math.floor(hash1(i, seed + 2) * TW), 8 + Math.floor(hash1(i, seed + 6) * (gh - 10)), 2, 1); }
    if (L.lava) { for (let i = 0; i < 12; i++) { const x = Math.floor(hash1(i, seed + 3) * TW), y = 10 + Math.floor(hash1(i, seed + 4) * 12); gx.fillStyle = PAL.rust; gx.fillRect(x - 1, y - 1, 14, 4); gx.fillStyle = PAL.orange; gx.fillRect(x, y, 12, 2); gx.fillStyle = PAL.yellow; gx.fillRect(x + 3, y, 4, 1); } }
    if (bid === 'meadow') for (let i = 0; i < 70; i++) { const x = Math.floor(hash1(i, seed + 5) * TW), y = 2 + Math.floor(hash1(i, seed + 6) * 6); gx.fillStyle = i % 3 ? PAL.yellow : PAL.pink; gx.fillRect(x, y, 1, 1); }
    if (bid === 'desert') { gx.fillStyle = PAL.clay; for (let y = 7; y < gh; y += 5) for (let x = 0; x < TW; x++) if (Math.sin(x * 0.15 + y) > 0.6) gx.fillRect(x, y, 1, 1); }
    if (bid === 'cavern') { gx.fillStyle = PAL.bark; gx.fillRect(0, 12, TW, 1); gx.fillRect(0, 16, TW, 1); gx.fillStyle = PAL.brown; for (let x = 0; x < TW; x += 8) gx.fillRect(x, 11, 3, 7); }
    if (bid === 'isles') { gx.fillStyle = PAL.white; for (let i = 0; i < 30; i++) { const x = Math.floor(hash1(i, seed + 9) * TW); Paint2.circle(gx, x, 2, 3, PAL.white); } }
    if (bid === 'abyss') { for (let i = 0; i < 16; i++) { const x = Math.floor(hash1(i, seed + 3) * TW), y = 9 + Math.floor(hash1(i, seed + 4) * 14); gx.fillStyle = PAL.plum; gx.fillRect(x - 1, y - 1, 10, 3); gx.fillStyle = PAL.magenta; gx.fillRect(x, y, 8, 1); } }
    // foreground tufts that sweep past in front of everything
    const front = mkCanvas(TW, 30), fr = front.getContext('2d');
    for (let i = 0; i < 9; i++) {
      const x = Math.floor((i + hash1(i, seed + 11)) * TW / 9), sz = 1 + (i % 2);
      if (bid === 'meadow' || bid === 'grove' || bid === 'marsh') { for (let k = -4 * sz; k <= 4 * sz; k += 2) Paint2.line(fr, x + k, 29, x + k + (k >> 1), 29 - (8 - Math.abs(k)) * sz, k % 4 ? G[0] : G[1], 1); }
      else if (bid === 'tundra' || bid === 'isles') prop.rock(fr, x, 30, sz, [PAL.mist, PAL.white, PAL.white]);
      else if (bid === 'cavern') prop.crystal(fr, x, 30, 0.8, [PAL.navy, PAL.blue, PAL.cyan]);
      else if (bid === 'abyss') prop.crystal(fr, x, 30, 0.8, [PAL.ink, PAL.plum, PAL.magenta]);
      else prop.rock(fr, x, 30, sz, [G[3], G[2], G[1]]);
    }
    return { sky: skyW, far, mid, ground, front, look: L };
  }
  function layersFor(bid) { let l = layers.get(bid); if (!l) { l = build(bid); layers.set(bid, l); } return l; }
  const tile = (ctx, img, off, y, w) => { const o = ((Math.round(off) % TW) + TW) % TW; ctx.drawImage(img, -o, y); if (TW - o < w) ctx.drawImage(img, TW - o, y); };

  // ---------- ambient motes ----------
  const motes = [];
  function moteStep(dt, kind, w) {
    const want = { firefly: 14, spore: 22, sand: 30, snow: 50, ember: 30, wisp: 12, shard: 18, cloud: 8, ash: 34 }[kind] || 10;
    while (motes.length < want) motes.push({ x: Math.random() * w, y: Math.random() * GY, t: Math.random() * 10, s: Math.random() });
    if (motes.length > want) motes.length = want;
    for (const m of motes) {
      m.t += dt;
      if (kind === 'snow') { m.y += (12 + m.s * 14) * dt; m.x += Math.sin(m.t + m.s * 6) * 8 * dt - 6 * dt; }
      else if (kind === 'sand') { m.x -= (60 + m.s * 60) * dt; m.y += Math.sin(m.t * 3) * 4 * dt; }
      else if (kind === 'ember') { m.y -= (14 + m.s * 16) * dt; m.x += Math.sin(m.t * 2 + m.s) * 10 * dt; }
      else if (kind === 'cloud') { m.x -= (8 + m.s * 10) * dt; }
      else if (kind === 'ash') { m.y += (6 + m.s * 10) * dt; m.x += Math.sin(m.t * 0.8 + m.s * 7) * 6 * dt - 4 * dt; }
      else { m.x += Math.sin(m.t * 0.7 + m.s * 9) * 6 * dt; m.y += Math.cos(m.t * 0.5 + m.s * 5) * 4 * dt; }
      if (m.y > GY + 20) m.y = -4; if (m.y < -6) m.y = GY; if (m.x < -10) m.x = w + 8; if (m.x > w + 10) m.x = -8;
    }
  }
  function moteDraw(ctx, kind, t) {
    for (const m of motes) {
      const x = Math.round(m.x), y = Math.round(m.y), blink = Math.sin(m.t * 3 + m.s * 10) > 0;
      switch (kind) {
        case 'firefly': ctx.fillStyle = blink ? PAL.pink : PAL.white; ctx.fillRect(x, y, 2, 1); break;
        case 'spore': ctx.fillStyle = blink ? PAL.cyan : PAL.green; ctx.fillRect(x, y, 1, 1); if (blink) { ctx.fillStyle = rgba(PAL.cyan, 0.35); ctx.fillRect(x - 1, y - 1, 3, 3); } break;
        case 'sand': ctx.fillStyle = m.s > 0.5 ? PAL.cream : PAL.tan; ctx.fillRect(x, y, 2, 1); break;
        case 'snow': ctx.fillStyle = PAL.white; ctx.fillRect(x, y, m.s > 0.7 ? 2 : 1, m.s > 0.7 ? 2 : 1); break;
        case 'ember': ctx.fillStyle = blink ? PAL.yellow : PAL.orange; ctx.fillRect(x, y, 1, m.s > 0.6 ? 2 : 1); break;
        case 'wisp': ctx.fillStyle = rgba(PAL.cyan, 0.4); ctx.fillRect(x - 1, y - 1, 3, 3); ctx.fillStyle = PAL.white; ctx.fillRect(x, y, 1, 1); break;
        case 'shard': if (blink) { ctx.fillStyle = m.s > 0.5 ? PAL.cyan : PAL.pink; ctx.fillRect(x, y - 1, 1, 3); ctx.fillRect(x - 1, y, 3, 1); } break;
        case 'cloud': ctx.fillStyle = rgba(PAL.white, 0.7); ctx.fillRect(x, y, 12 + m.s * 10, 1); break;
        case 'ash': ctx.fillStyle = blink ? PAL.magenta : m.s > 0.5 ? PAL.slate : PAL.dusk; ctx.fillRect(x, y, 1, 1); break;
      }
    }
  }

  // ---------- background ----------
  let scroll = 0;
  function background(ctx, w, bid, diff, dt, moving, t) {
    const L = layersFor(bid);
    if (moving) scroll += moving * dt;
    tile(ctx, L.sky, scroll * 0.02, 0, w);
    const look = L.look;
    if (look.sun) { const sx = w - 110; Paint2.circle(ctx, sx, 28, 11, look.sun); Paint2.circle(ctx, sx - 2, 26, 7, PAL.white); }
    if (look.moon) { Paint2.circle(ctx, w - 120, 30, 10, look.moon); ctx.fillStyle = PAL.tan; ctx.fillRect(w - 124, 26, 3, 2); ctx.fillRect(w - 116, 33, 2, 2); }
    tile(ctx, L.far, scroll * 0.12, 0, w);
    tile(ctx, L.mid, scroll * 0.35, 0, w);
    const tint = DIFF_TINT[diff];
    if (tint) { ctx.fillStyle = rgba(tint[0], tint[1]); ctx.fillRect(0, 0, w, GY); }
    tile(ctx, L.ground, scroll, GY - 2, w);
    const kind = ACTS.find(b => b.id === bid).mote;
    moteStep(dt, kind, w);
    moteDraw(ctx, kind, t);
  }
  function foreground(ctx, w, bid) { tile(ctx, layersFor(bid).front, scroll * 1.3, SH - 30, w); }

  // ---------- actors ----------
  const SPR_OF = {};
  function mobSprite(m, t) {
    const d = m.d, name = d.spr;
    const n = Spr.frames(name);
    const speed = m.boss ? 2.2 : 5;
    const f = n > 1 ? Math.floor((t * speed + m.id * 0.37) % n) : 0;
    return Spr.get(name, f, d.pal);
  }
  return { background, foreground, mobSprite, layersFor, get scroll() { return scroll; } };
})();
