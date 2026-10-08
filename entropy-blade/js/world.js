'use strict';
// =====================================================================
//  WORLD — biomes, parallax backgrounds, room generation, tiles, collision
// =====================================================================
const BIOMES = [
  {
    id: 'sakura', name: '落樱古道', en: 'SAKURA PASS', music: 'bamboo', ambient: '#c8a8a8', boss: 'warden',
    accent: '#ffb070', accent2: '#ff9ab8',
    tile: { base: '#33261f', dark: '#1f1714', line: '#45342a', top: '#8cc850', topD: '#4f8030', topB: '#3c2e22', edge: '#120c0a', plat: '#6e4c2e', platTop: '#d8a466', platD: '#3c2818' },
  },
  {
    id: 'crystal', name: '晶渊回廊', en: 'CRYSTAL ABYSS', music: 'crystal', ambient: '#7f8fc4', boss: 'empress',
    accent: '#45f0ff', accent2: '#b26cff',
    tile: { base: '#152338', dark: '#0c1626', line: '#1d3150', top: '#3fe6c4', topD: '#1c7d72', topB: '#22405a', edge: '#060c16', plat: '#2a3d5a', platTop: '#7ff7ff', platD: '#16253a' },
  },
  {
    id: 'core', name: '熵能核心', en: 'ENTROPY CORE', music: 'core', ambient: '#a07c8c', boss: 'king',
    accent: '#ff3048', accent2: '#ffb347',
    tile: { base: '#1a0b14', dark: '#10060c', line: '#2a1220', top: '#e8b84a', topD: '#8a5a1e', topB: '#3a1424', edge: '#070205', plat: '#2c1420', platTop: '#ff3048', platD: '#1a0a12' },
  },
  {
    id: 'snow', name: '苍雪寒山', en: 'FROSTPEAK TEMPLE', music: 'snow', ambient: '#a8b8d8', boss: 'yukionna',
    accent: '#bfe6ff', accent2: '#ffb070',
    tile: { base: '#2a3044', dark: '#181c2a', line: '#3a4258', top: '#f4f9ff', topD: '#b8c8e2', topB: '#5a6682', edge: '#0c0e16', plat: '#5a4636', platTop: '#eef5ff', platD: '#2e231c' },
  },
];
// a run = 第一大关 (three scenes, each its own map type, monsters and boss) + 终章
const SCENES = [
  { bi: 0, chapter: 1, label: '第一大关 · 其一', layouts: { field: 3, tiers: 2.4, trench: 1.6, tall: 1.2 } },
  { bi: 3, chapter: 1, label: '第一大关 · 其二', layouts: { tiers: 3, field: 1.6, trench: 2, tall: 1.4 } },
  { bi: 1, chapter: 1, label: '第一大关 · 其三', layouts: { cave: 3, tall: 2, trench: 1.6, field: 1 } },
  { bi: 2, chapter: 2, label: '终章', layouts: { field: 2, tall: 2, trench: 2, tiers: 1.2 }, final: true },
];
const LAYOUT_NAMES = { field: '平野', tiers: '阶台', trench: '断沟', tall: '高阁', cave: '洞窟' };

// ---------- dithered gradient ----------
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function ditherGrad(w, h, cols) {
  const c = makeCanvas(w, h), x = c.getContext('2d');
  const img = x.createImageData(w, h), d = img.data;
  const rgb = cols.map(hex2rgb);
  for (let py = 0; py < h; py++) {
    const t = py / (h - 1) * (cols.length - 1);
    const i = Math.min(cols.length - 2, Math.floor(t)), f = t - i;
    for (let px = 0; px < w; px++) {
      const th = (BAYER[(py & 3) * 4 + (px & 3)] + 0.5) / 16;
      const cc = f > th ? rgb[i + 1] : rgb[i];
      const j = (py * w + px) * 4;
      d[j] = cc[0]; d[j + 1] = cc[1]; d[j + 2] = cc[2]; d[j + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  return c;
}
function pixLayer(w, h, fn) { return bakeSprite(w, h, fn, { outline: null }); }
// wrap-aware draw helper: run fn at x, x-w, x+w so layers tile seamlessly
function wrapDo(x, w, lw, fn) { fn(x); if (x + w > lw) fn(x - lw); if (x < 0) fn(x + lw); }

// =====================================================================
//  BACKGROUNDS
// =====================================================================
const BG = {};
function buildBackground(bi) {
  if (BG[bi]) return BG[bi];
  const rng = RNG(1000 + bi * 77);
  const b = { layers: [] };
  if (bi === 0) {
    // 落樱古道 — sunset mountain pass: ridges, pagoda & torii, bamboo and cherry blossoms
    b.sky = ditherGrad(W, H, ['#1c1236', '#3a1c4a', '#7a2c56', '#cc5a52', '#f89a62', '#ffc884']);
    const sx = b.sky.getContext('2d');
    for (let i = 0; i < 40; i++) { sx.fillStyle = pick(['#ffffff', '#ffd8e8', '#c8b8ff']); sx.fillRect(rng.int(0, W), rng.int(0, 70), 1, 1); }
    const g = sx.createRadialGradient(330, 168, 20, 330, 168, 150);
    g.addColorStop(0, 'rgba(255,220,150,0.55)'); g.addColorStop(1, 'rgba(255,160,120,0)');
    sx.fillStyle = g; sx.fillRect(150, 30, 330, 240);
    const sun = pixLayer(90, 90, x => { x.circ(45, 45, 36, '#ffd89a'); x.circ(45, 45, 32, '#ffe6b8'); });
    sx.drawImage(sun, 285, 124);
    // thin cloud bands across the sun
    for (let i = 0; i < 7; i++) { sx.fillStyle = i % 2 ? 'rgba(122,44,86,0.55)' : 'rgba(204,90,82,0.45)'; sx.fillRect(rng.int(-40, 380), 100 + i * 14 + rng.int(-3, 3), rng.int(90, 200), 2 + (i % 3)); }
    // far: layered mountain ridges with mist
    const far = pixLayer(480, 270, x => {
      const ridge = (base, amp, col, seed, step) => {
        const pts = [[0, 270]];
        for (let px = 0; px <= 480; px += step) {
          const h = Math.sin(px * 0.013 + seed) * amp + Math.sin(px * 0.041 + seed * 2) * amp * 0.35 + Math.sin(px * 0.11 + seed) * 4;
          pts.push([px, base - h]);
        }
        pts.push([480, 270]);
        x.poly(pts, col);
      };
      ridge(150, 34, '#6a3456', 1.3, 6);
      ridge(176, 28, '#52284a', 3.1, 6);
      for (let i = 0; i < 3; i++) x.rect(0, 186 + i * 10, 480, 2, '#7a3a5a');
      ridge(206, 20, '#3e1e3e', 5.7, 5);
    });
    // mid: pagoda, torii and pines in silhouette, with warm lantern dots
    const glowDots = [];
    const mid = pixLayer(640, 270, x => {
      const S = '#2a1430';
      x.poly([[0, 270], [0, 230], [120, 214], [260, 226], [400, 210], [520, 224], [640, 230], [640, 270]], S);
      // pagoda
      const pg = (cx, base) => {
        for (let k = 0; k < 4; k++) {
          const w = 46 - k * 9, y = base - k * 18;
          x.rect(cx - w / 2 + 6, y - 12, w - 12, 12, S);
          x.poly([[cx - w / 2 - 6, y - 12], [cx + w / 2 + 6, y - 12], [cx + w / 2 - 2, y - 17], [cx - w / 2 + 2, y - 17]], S);
          glowDots.push([cx - 3, y - 6], [cx + 3, y - 6]);
        }
        x.rect(cx - 1, base - 92, 2, 20, S);
      };
      pg(150, 222);
      // torii gate
      const torii = (cx, base) => {
        x.rect(cx - 16, base - 34, 3, 34, S); x.rect(cx + 13, base - 34, 3, 34, S);
        x.poly([[cx - 24, base - 36], [cx + 24, base - 36], [cx + 20, base - 40], [cx - 20, base - 40]], S);
        x.rect(cx - 18, base - 30, 36, 3, S);
      };
      torii(420, 214); torii(560, 226);
      // pines
      for (let i = 0; i < 10; i++) {
        const tx = rng.int(0, 639), th = rng.int(26, 52), base = 232;
        wrapDo(tx, 24, 640, X => {
          x.rect(X - 1, base - th, 2, th, S);
          for (let k = 0; k < 3; k++) { const w = 18 - k * 4, y = base - th + k * 8; x.ell(X + (k % 2 ? 3 : -3), y, w / 2, 4, 0, S); }
        });
      }
    });
    const midGlow = pixLayer(640, 270, x => { for (const [dx, dy] of glowDots) x.rect(dx, dy, 2, 2, '#ffb060'); x.rect(417, 182, 6, 2, '#ff8a4a'); });
    mid.getContext('2d').drawImage(midGlow, 0, 0);
    // near: bamboo grove and blossoming cherry branches
    const near = pixLayer(720, 270, x => {
      for (let i = 0; i < 15; i++) {
        const bx = rng.int(0, 719), bw = rng.int(3, 5), lean = rng.range(-0.05, 0.05);
        const col = pick(['#1a261c', '#1e2e20', '#162218']);
        for (let y = 270; y > -10; y -= 1) x.rect(bx + (270 - y) * lean, y, bw, 1, col);
        for (let y = 250; y > 0; y -= rng.int(22, 30)) { x.rect(bx + (270 - y) * lean - 1, y, bw + 2, 1.4, '#2e4a2a'); if (rng.chance(0.4)) x.poly([[bx + (270 - y) * lean + bw, y], [bx + (270 - y) * lean + bw + 12, y - 4], [bx + (270 - y) * lean + bw + 9, y + 1]], '#2a4428'); }
      }
      for (let i = 0; i < 5; i++) {
        const cx = rng.int(0, 719), cy = rng.int(10, 70);
        let px = cx - 60, py = cy + 30;
        for (let k = 0; k < 60; k++) { px += 2; py += Math.sin(k * 0.2 + i) * 0.8 - 0.3; x.rect(px, py, 2.2, 2.2, '#2a1820'); if (k % 6 === 0) for (let q = 0; q < 6; q++) x.circ(px + rng.int(-6, 6), py + rng.int(-6, 4), rng.range(1.5, 3), pick(['#e87a9a', '#ffa8c4', '#c85a7a'])); }
      }
    });
    b.layers.push({ c: far, f: 0.06, y: 6 }, { c: mid, f: 0.18, y: 18, glow: midGlow }, { c: near, f: 0.4, y: 10 });
    b.petals = true;
  } else if (bi === 1) {
    b.sky = ditherGrad(W, H, ['#010309', '#020b17', '#051a2b', '#0a2b40']);
    const sx = b.sky.getContext('2d');
    for (let i = 0; i < 40; i++) { sx.fillStyle = pick(['#1f5a7a', '#2a7a9a', '#3a2f6a']); sx.fillRect(rng.int(0, W), rng.int(0, H), 1, 1); }
    const far = pixLayer(480, 270, x => {
      const pts = [[0, 270]];
      for (let px = 0; px <= 480; px += 20) pts.push([px, 140 + Math.sin(px * 0.031) * 30 + rng.int(-14, 14)]);
      pts.push([480, 270]);
      x.poly(pts, '#071626');
      for (let i = 0; i < 9; i++) {
        const cx = rng.int(0, 479), cw = rng.int(8, 18), ch = rng.int(50, 130);
        wrapDo(cx, cw, 480, X => {
          x.poly([[X, 270], [X + cw * 0.5, 270 - ch], [X + cw, 270]], '#0f3550');
          x.poly([[X + cw * 0.5, 270 - ch], [X + cw, 270], [X + cw * 0.62, 270]], '#1a5a7a');
        });
      }
    });
    const midGlow = pixLayer(640, 270, x => {
      for (let i = 0; i < 14; i++) {
        const cx = rng.int(0, 639), base = rng.int(170, 260), col = pick(['#45f0ff', '#b26cff', '#45f0ff', '#6affc8']);
        wrapDo(cx, 20, 640, X => {
          for (let k = 0; k < rng.int(2, 4); k++) {
            const ox = X + rng.int(-6, 10), h = rng.int(10, 26), w = rng.int(4, 7), lean = rng.int(-5, 5);
            x.poly([[ox, base], [ox + w / 2 + lean, base - h], [ox + w, base]], col);
            x.poly([[ox + w / 2 + lean, base - h], [ox + w, base], [ox + w * 0.6, base]], shade(col, -0.35));
          }
        });
      }
    });
    const mid = pixLayer(640, 270, x => {
      for (let i = 0; i < 22; i++) {
        const sxp = rng.int(0, 639), sw = rng.int(8, 22), sl = rng.int(20, 100);
        wrapDo(sxp, sw, 640, X => { x.poly([[X, 0], [X + sw, 0], [X + sw * 0.5 + rng.int(-3, 3), sl]], '#0a1d2e'); x.poly([[X, 0], [X + 3, 0], [X + sw * 0.5, sl]], '#12304a'); });
      }
      for (let i = 0; i < 14; i++) {
        const sxp = rng.int(0, 639), sw = rng.int(14, 36), sl = rng.int(40, 110);
        wrapDo(sxp, sw, 640, X => x.poly([[X, 270], [X + sw * 0.5, 270 - sl], [X + sw, 270]], '#0a1d2e'));
      }
    });
    mid.getContext('2d').drawImage(midGlow, 0, 0);
    const near = pixLayer(720, 270, x => {
      for (let i = 0; i < 18; i++) {
        let px = rng.int(0, 719), py = 0; const len = rng.int(30, 120);
        for (let k = 0; k < len; k++) { px += Math.sin(k * 0.15 + i) * 0.6; py++; x.rect(px, py, 2, 1, '#04111c'); if (rng.chance(0.06)) x.rect(px + 1, py, 3, 2, '#0b2a2a'); }
      }
      for (let i = 0; i < 8; i++) {
        const rx = rng.int(0, 719), rw = rng.int(40, 90), rh = rng.int(20, 50);
        wrapDo(rx, rw, 720, X => x.ell(X + rw / 2, 270, rw / 2, rh, 0, '#040d16'));
      }
    });
    b.layers.push({ c: far, f: 0.08, y: 10 }, { c: mid, f: 0.22, y: 15, glow: midGlow }, { c: near, f: 0.45, y: 20 });
    b.shafts = true; b.spores = true;
  } else if (bi === 3) {
    // 苍雪寒山 — moonlit snow peaks, aurora, a mountain temple and snow-laden pines
    b.sky = ditherGrad(W, H, ['#050816', '#0b1630', '#16294e', '#28477a', '#5878a8', '#8ea8cc']);
    const sx = b.sky.getContext('2d');
    for (let i = 0; i < 70; i++) { sx.fillStyle = pick(['#ffffff', '#cfe0ff', '#9fc0ff']); sx.fillRect(rng.int(0, W), rng.int(0, 120), 1, 1); }
    // aurora ribbons
    for (let k = 0; k < 3; k++) {
      const y0 = 30 + k * 16, col = ['rgba(90,255,200,0.16)', 'rgba(120,200,255,0.14)', 'rgba(170,140,255,0.12)'][k];
      sx.fillStyle = col;
      for (let px = 0; px < W; px += 2) { const y = y0 + Math.sin(px * 0.02 + k * 1.7) * 12 + Math.sin(px * 0.007 + k) * 8; sx.fillRect(px, y, 2, 10 + Math.sin(px * 0.05 + k) * 5); }
    }
    const moon = pixLayer(60, 60, x => { x.circ(30, 30, 18, '#e8f0ff'); x.circ(26, 26, 4, '#c8d8f0'); x.circ(36, 34, 3, '#d0dcf2'); x.circ(24, 36, 2, '#c8d8f0'); });
    sx.drawImage(moon, 340, 26);
    const mg = sx.createRadialGradient(370, 56, 10, 370, 56, 90);
    mg.addColorStop(0, 'rgba(220,235,255,0.35)'); mg.addColorStop(1, 'rgba(160,190,255,0)');
    sx.fillStyle = mg; sx.fillRect(270, 0, 200, 160);
    // far: jagged snow peaks with caps
    const far = pixLayer(480, 270, x => {
      const peaks = (base, n, hmin, hmax, col, cap, seed) => {
        const r2 = RNG(seed);
        const pts = [[0, 270]]; const tops = [];
        for (let i = 0; i <= n; i++) {
          const px = i * 480 / n, hh = r2.int(hmin, hmax);
          pts.push([px - 480 / n / 2, base]); pts.push([px, base - hh]); tops.push([px, base - hh, 480 / n]);
        }
        pts.push([480, base], [480, 270]);
        x.poly(pts, col);
        for (const [px, py, sw] of tops) x.poly([[px, py], [px + sw * 0.22, py + sw * 0.32], [px + sw * 0.08, py + sw * 0.26], [px - sw * 0.06, py + sw * 0.36], [px - sw * 0.2, py + sw * 0.3]], cap);
      };
      peaks(170, 6, 60, 110, '#34466c', '#b8cae6', 11);
      for (let i = 0; i < 3; i++) x.rect(0, 160 + i * 9, 480, 2, '#4a5e86');
      peaks(200, 9, 30, 70, '#24324f', '#8ea4c8', 23);
    });
    // mid: temple on the cliff, stairs, snowy pines, warm lanterns
    const glowDots = [];
    const mid = pixLayer(640, 270, x => {
      const S = '#141c30', SN = '#c8d6ee';
      x.poly([[0, 270], [0, 228], [90, 220], [200, 196], [300, 192], [360, 214], [470, 226], [640, 222], [640, 270]], S);
      // temple hall with two snow-capped roofs
      const hall = (cx, base) => {
        x.rect(cx - 30, base - 22, 60, 22, S);
        x.poly([[cx - 44, base - 22], [cx + 44, base - 22], [cx + 34, base - 32], [cx - 34, base - 32]], S);
        x.poly([[cx - 44, base - 22], [cx - 34, base - 32], [cx + 34, base - 32], [cx + 44, base - 22], [cx + 40, base - 24], [cx - 40, base - 24]], SN);
        x.rect(cx - 20, base - 44, 40, 12, S);
        x.poly([[cx - 30, base - 44], [cx + 30, base - 44], [cx + 22, base - 52], [cx - 22, base - 52]], S);
        x.poly([[cx - 30, base - 44], [cx - 22, base - 52], [cx + 22, base - 52], [cx + 30, base - 44], [cx + 26, base - 46], [cx - 26, base - 46]], SN);
        for (let k = -2; k <= 2; k++) glowDots.push([cx + k * 10 - 1, base - 14]);
        glowDots.push([cx - 1, base - 40]);
      };
      hall(250, 194);
      // stairs down the cliff
      for (let k = 0; k < 9; k++) x.rect(300 + k * 6, 194 + k * 3, 8, 2, '#2a3654');
      // snowy pines
      for (let i = 0; i < 16; i++) {
        const tx = rng.int(0, 639), th = rng.int(22, 46), base = 230;
        wrapDo(tx, 24, 640, X => {
          for (let k = 0; k < 4; k++) {
            const w = 16 - k * 3.5, y = base - th + k * (th / 5);
            x.poly([[X - w / 2, y + th / 5], [X, y - 2], [X + w / 2, y + th / 5]], S);
            x.poly([[X - w / 2, y + th / 5], [X, y - 2], [X + w / 2, y + th / 5], [X + w / 3, y + th / 5 - 2], [X - w / 3, y + th / 5 - 2]], k === 0 ? SN : '#9aaccb');
          }
          x.rect(X - 1, base - 4, 2, 4, S);
        });
      }
    });
    const midGlow = pixLayer(640, 270, x => { for (const [dx, dy] of glowDots) x.rect(dx, dy, 2, 3, '#ffb070'); });
    mid.getContext('2d').drawImage(midGlow, 0, 0);
    // near: frosted branches and icicles hanging from the top edge
    const near = pixLayer(720, 270, x => {
      for (let i = 0; i < 6; i++) {
        const cx = rng.int(0, 719), cy = rng.int(6, 40);
        let px = cx - 70, py = cy;
        for (let k = 0; k < 70; k++) { px += 2; py += Math.sin(k * 0.18 + i) * 0.7 + 0.15; x.rect(px, py, 2.4, 2.4, '#10141f'); if (k % 3 === 0) x.rect(px - 1, py - 1.6, 4, 1.4, '#dfe8f8'); if (k % 9 === 0) for (let q = 0; q < 5; q++) x.rect(px + rng.int(-6, 6), py + rng.int(-5, 3), 2, 1, '#2a3a2c'); }
      }
      for (let i = 0; i < 40; i++) { const ix = rng.int(0, 719), il = rng.int(4, 16); x.poly([[ix, 0], [ix + 3, 0], [ix + 1.5, il]], '#a8c4e4'); x.rect(ix + 1, 0, 1, il * 0.6, '#e8f4ff'); }
    });
    b.layers.push({ c: far, f: 0.06, y: 4 }, { c: mid, f: 0.18, y: 16, glow: midGlow }, { c: near, f: 0.42, y: 0 });
    b.snow = true;
  } else {
    b.sky = ditherGrad(W, H, ['#030003', '#0e0207', '#200510', '#3a0a18']);
    const sx = b.sky.getContext('2d');
    for (let i = 0; i < 60; i++) { sx.fillStyle = pick(['#5a1020', '#ff6a6a', '#3a0a18', '#ffb347']); sx.fillRect(rng.int(0, W), rng.int(0, H), 1, 1); }
    const far = pixLayer(480, 270, x => {
      for (let i = 0; i < 12; i++) {
        const mx = rng.int(0, 479), mw = rng.int(10, 26), mh = rng.int(24, 70), my = rng.int(60, 200);
        wrapDo(mx, mw, 480, X => {
          x.poly([[X, my], [X + mw, my - 4], [X + mw - 2, my + mh], [X + 3, my + mh + 6]], '#13040b');
          x.poly([[X + mw, my - 4], [X + mw - 2, my + mh], [X + mw - 4, my + mh]], '#4a0d1c');
        });
      }
    });
    const midGlow = pixLayer(640, 270, x => {
      for (let i = 0; i < 10; i++) {
        const px = rng.int(0, 639), py = rng.int(120, 230);
        wrapDo(px, 8, 640, X => { x.rect(X, py, 2, 6, '#ff3048'); x.rect(X - 2, py + 2, 6, 1, '#ff3048'); x.rect(X + 4, py + 5, 2, 2, '#ffb347'); });
      }
    });
    const mid = pixLayer(640, 270, x => {
      for (let i = 0; i < 7; i++) {
        const ax = rng.int(0, 639), aw = rng.int(50, 90), ah = rng.int(110, 180);
        wrapDo(ax, aw, 640, X => {
          x.rect(X, 270 - ah, 12, ah, '#0c0307'); x.rect(X + aw - 12, 270 - ah, 12, ah, '#0c0307');
          x.rect(X - 2, 270 - ah - 6, aw + 4, 8, '#0c0307');
          x.rect(X - 2, 270 - ah - 6, aw + 4, 1, '#8a6420');
          x.rect(X, 270 - ah, 1, ah, '#3a1424');
          if (rng.chance(0.5)) x.poly([[X + aw - 12, 270 - ah - 6], [X + aw + 6, 270 - ah - 20], [X + aw, 270 - ah + 10]], '#0c0307');
        });
      }
    });
    mid.getContext('2d').drawImage(midGlow, 0, 0);
    const near = pixLayer(720, 270, x => {
      for (let i = 0; i < 10; i++) {
        const cx = rng.int(0, 719), len = rng.int(40, 150);
        for (let k = 0; k < len; k += 4) { x.rect(cx, k, 3, 3, '#1a0810'); x.rect(cx + 1, k + 3, 1, 1, '#120509'); }
      }
      for (let i = 0; i < 8; i++) {
        const cx = rng.int(0, 719), cy = rng.int(60, 220), s = rng.int(8, 18);
        x.save(); x.translate(cx, cy); x.rotate(rng.range(0, 1.5)); x.rect(-s / 2, -s / 2, s, s, '#0a0205'); x.rect(-s / 2, -s / 2, s, 1, '#5a1020'); x.restore();
      }
    });
    b.layers.push({ c: far, f: 0.07, y: 0 }, { c: mid, f: 0.2, y: 15, glow: midGlow }, { c: near, f: 0.45, y: 10 });
    b.vortex = true; b.embers = true;
  }
  // screen-space ambient particles
  b.drops = [];
  for (let i = 0; i < 110; i++) b.drops.push({ x: rand(0, W), y: rand(0, H), s: rand(0.6, 1.4), p: rand(0, 1) });
  BG[bi] = b;
  return b;
}

function drawBackground(ctx, gctx, bi, camx, camy, t, roomH) {
  const b = buildBackground(bi);
  const vy = Math.max(0, roomH - H);
  const syOff = vy > 0 ? -(camy / vy) * 10 : 0;
  ctx.drawImage(b.sky, 0, Math.round(syOff));
  if (b.vortex) drawVortex(ctx, gctx, 300 - camx * 0.03, 92 + syOff, t);
  for (const L of b.layers) {
    const lw = L.c.width;
    const ox = -Math.round(camx * L.f) % lw;
    const oy = Math.round(L.y - camy * L.f * 0.6 + (vy > 0 ? vy * L.f * 0.3 : 0));
    for (let x = ox - (ox > 0 ? lw : 0); x < W; x += lw) {
      ctx.drawImage(L.c, x, oy);
      if (L.glow) {
        gctx.globalAlpha = bi === 0 ? 0.55 + 0.15 * Math.sin(t * 7 + x) * (Math.sin(t * 1.3) > 0.9 ? 1 : 0) : 0.45;
        gctx.drawImage(L.glow, x, oy);
        gctx.globalAlpha = 1;
      }
    }
    // haze between layers
    ctx.fillStyle = bi === 0 ? 'rgba(150,70,90,0.12)' : bi === 1 ? 'rgba(5,30,50,0.2)' : bi === 3 ? 'rgba(60,80,130,0.14)' : 'rgba(40,5,15,0.2)';
    ctx.fillRect(0, 0, W, H);
  }
  if (b.shafts) {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const x0 = ((i * 150 - camx * 0.3) % 700 + 700) % 700 - 120;
      const a = 0.05 + 0.03 * Math.sin(t * 0.7 + i * 2);
      ctx.fillStyle = `rgba(110,220,255,${a})`;
      ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + 30, 0); ctx.lineTo(x0 + 130, H); ctx.lineTo(x0 + 70, H); ctx.closePath(); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}
function drawVortex(ctx, gctx, cx, cy, t) {
  for (let i = 7; i >= 0; i--) {
    const r = 14 + i * 13;
    const col = mix('#ff3048', '#ffb347', i / 7);
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    gctx.strokeStyle = col; gctx.lineWidth = 3;
    const rot = t * (0.25 + (7 - i) * 0.06) * (i % 2 ? 1 : -1);
    for (let k = 0; k < 3; k++) {
      const a0 = rot + k * TAU / 3, a1 = a0 + 1.3;
      ctx.globalAlpha = 0.25 + 0.06 * (7 - i);
      ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.42, -0.2, a0, a1); ctx.stroke();
      gctx.globalAlpha = 0.3;
      gctx.beginPath(); gctx.ellipse(cx, cy, r, r * 0.42, -0.2, a0, a1); gctx.stroke();
    }
  }
  ctx.globalAlpha = 1; gctx.globalAlpha = 1;
  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(cx, cy, 10, 5, -0.2, 0, TAU); ctx.fill();
  gctx.fillStyle = '#ff3048'; gctx.beginPath(); gctx.ellipse(cx, cy, 16, 8, -0.2, 0, TAU); gctx.fill();
}
// screen-space weather in front of background (behind entities) or foreground
function drawWeather(ctx, gctx, bi, camx, camy, t, dt, front) {
  const b = buildBackground(bi);
  if (b.rain) {
    ctx.strokeStyle = front ? 'rgba(170,200,255,0.45)' : 'rgba(140,170,255,0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = front ? 0 : 50; i < (front ? 50 : 110); i++) {
      const d = b.drops[i];
      d.y += (front ? 520 : 380) * d.s * dt; d.x -= 90 * d.s * dt;
      if (d.y > H) { d.y -= H + 10; d.x = rand(0, W + 60); }
      if (d.x < -10) d.x += W + 20;
      const x = ((d.x - camx * (front ? 0.3 : 0.1)) % W + W) % W;
      ctx.moveTo(x, d.y); ctx.lineTo(x - 2 * d.s, d.y + (front ? 7 : 4) * d.s);
    }
    ctx.stroke();
  }
  if (b.snow) {
    for (let i = front ? 0 : 35; i < (front ? 35 : 110); i++) {
      const d = b.drops[i];
      d.y += (front ? 42 : 22) * d.s * dt; d.p += dt * 0.7;
      d.x -= (front ? 16 : 8) * dt;
      if (d.y > H + 4) { d.y = -4; d.x = rand(0, W + 40); }
      const x = ((d.x + Math.sin(d.p * 1.5 + i) * 7 - camx * (front ? 0.5 : 0.15)) % W + W) % W;
      ctx.globalAlpha = front ? 0.9 : 0.55;
      ctx.fillStyle = i % 5 === 0 ? '#cfe0ff' : '#ffffff';
      const s = front ? (d.s > 1.1 ? 3 : 2) : (d.s > 1.2 ? 2 : 1);
      ctx.fillRect(Math.round(x), Math.round(d.y), s, s);
      if (front && s === 3) { gctx.globalAlpha = 0.3; gctx.fillStyle = '#cfe0ff'; gctx.fillRect(Math.round(x) - 1, Math.round(d.y) - 1, 5, 5); gctx.globalAlpha = 1; }
    }
    ctx.globalAlpha = 1;
  }
  if (b.petals) {
    for (let i = front ? 0 : 30; i < (front ? 30 : 100); i++) {
      const d = b.drops[i];
      d.y += (front ? 34 : 20) * d.s * dt; d.p += dt * (0.8 + d.s * 0.4);
      d.x -= (front ? 22 : 12) * d.s * dt;
      if (d.y > H + 4) { d.y = -4; d.x = rand(0, W + 40); }
      const x = ((d.x + Math.sin(d.p * 2 + i) * 10 - camx * (front ? 0.5 : 0.15)) % W + W) % W;
      const flip = Math.sin(d.p * 4 + i) > 0;
      ctx.fillStyle = i % 4 === 0 ? '#ffffff' : i % 3 === 0 ? '#ff8ab0' : '#ffc0d8';
      ctx.globalAlpha = front ? 0.95 : 0.6;
      ctx.fillRect(Math.round(x), Math.round(d.y), front ? (flip ? 3 : 2) : (flip ? 2 : 1), front ? 2 : 1);
    }
    ctx.globalAlpha = 1;
  }
  if (b.spores || b.embers) {
    for (let i = front ? 0 : 40; i < (front ? 25 : 90); i++) {
      const d = b.drops[i];
      d.y -= (b.embers ? 26 : 12) * d.s * dt; d.p += dt * 0.5;
      if (d.y < -4) { d.y = H + 4; d.x = rand(0, W); }
      const x = ((d.x + Math.sin(d.p * 3 + i) * 8 - camx * (front ? 0.5 : 0.15)) % W + W) % W;
      const col = b.embers ? (i % 3 ? '#ff7a3a' : '#ffd36a') : (i % 3 ? '#5ff2e0' : '#b98aff');
      const a = 0.4 + 0.5 * Math.abs(Math.sin(d.p * 2 + i));
      ctx.globalAlpha = a; ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(d.y), front ? 2 : 1, front ? 2 : 1);
      gctx.globalAlpha = a; gctx.fillStyle = col; gctx.fillRect(Math.round(x) - 1, Math.round(d.y) - 1, 3, 3);
    }
    ctx.globalAlpha = 1; gctx.globalAlpha = 1;
  }
}

// =====================================================================
//  ROOM
// =====================================================================
class Room {
  constructor(w, h, biome) {
    this.w = w; this.h = h; this.bi = biome; this.biome = BIOMES[biome];
    this.tiles = new Uint8Array(w * h);
    this.props = []; this.lights = []; this.spots = []; this.airSpots = [];
  }
  get pw() { return this.w * TILE; }
  get ph() { return this.h * TILE; }
  tile(tx, ty) { if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return 1; return this.tiles[ty * this.w + tx]; }
  set(tx, ty, v) { if (tx >= 0 && ty >= 0 && tx < this.w && ty < this.h) this.tiles[ty * this.w + tx] = v; }
  solid(tx, ty) { return this.tile(tx, ty) === 1; }
  solidPx(x, y) { return this.solid(Math.floor(x / TILE), Math.floor(y / TILE)); }
  // y (px) of the first walkable surface at or below y0 for column x
  floorBelow(x, y0) {
    const tx = Math.floor(x / TILE);
    for (let ty = Math.max(0, Math.floor(y0 / TILE)); ty < this.h; ty++) {
      const t = this.tile(tx, ty);
      if (t === 1 || t === 2) return ty * TILE;
    }
    return this.ph;
  }
  // line of sight between two points (solid tiles only)
  los(x0, y0, x1, y1) {
    const d = dist(x0, y0, x1, y1), n = Math.ceil(d / 8);
    for (let i = 1; i < n; i++) { const u = i / n; if (this.solidPx(lerp(x0, x1, u), lerp(y0, y1, u))) return false; }
    return true;
  }
}

function genRoom(seed, bi, type, layout) {
  const rng = RNG(seed);
  const fight = type === 'combat' || type === 'elite';
  layout = fight ? (layout || 'field') : null;
  let w, h;
  if (type === 'boss') { w = 40; h = 18; }
  else if (type === 'shop') { w = 44; h = 17; }
  else if (type === 'rest' || type === 'start' || type === 'event') { w = 36; h = 17; }
  else if (layout === 'tall') { w = rng.int(40, 50); h = 25; }
  else if (layout === 'cave') { w = rng.int(52, 64); h = 17; }
  else { w = rng.int(48, 64); h = rng.pick([17, 17, 18, 21]); }
  const R = new Room(w, h, bi);
  R.type = type; R.seed = seed; R.layout = layout;
  const base = h - 3;
  const gy = new Array(w).fill(base);
  if (layout === 'field') {
    let x = 9;
    while (x < w - 22) {
      const len = rng.int(5, 11);
      const off = rng.pick([0, 0, -1, -1, -2, 1]);
      for (let i = x; i < Math.min(w - 22, x + len); i++) gy[i] = clamp(base + off, base - 3, base + 1);
      x += len;
    }
  } else if (layout === 'tiers') {
    // a terraced hill: climbs in 2-tile steps, plateaus, then descends
    const top = rng.int(2, 3), run = rng.int(5, 7);
    for (let i = 9; i < w - 22; i++) {
      const lvl = Math.min(top, Math.floor(Math.min(i - 9, w - 23 - i) / run));
      gy[i] = base - lvl * 2;
    }
  } else if (layout === 'trench') {
    // deep trenches crossed by platforms
    let x = 11;
    while (x < w - 26) {
      const len = rng.int(5, 8), depth = rng.int(2, 3);
      for (let i = x; i < x + len; i++) gy[i] = base + depth;
      x += len + rng.int(7, 12);
    }
  } else if (layout === 'cave') {
    let x = 9;
    while (x < w - 22) {
      const len = rng.int(3, 7);
      const off = rng.pick([0, 0, -1, 1, 1]);
      for (let i = x; i < Math.min(w - 22, x + len); i++) gy[i] = clamp(base + off, base - 2, base + 1);
      x += len;
    }
  }
  if (fight) for (let i = 1; i < w; i++) if (gy[i] - gy[i - 1] > 2) gy[i] = gy[i - 1] + 2;
  for (let tx = 0; tx < w; tx++) for (let ty = gy[tx]; ty < h; ty++) R.set(tx, ty, 1);
  for (let ty = 0; ty < h; ty++) { R.set(0, ty, 1); R.set(1, ty, 1); R.set(w - 1, ty, 1); R.set(w - 2, ty, 1); }
  for (let tx = 0; tx < w; tx++) R.set(tx, 0, 1);
  // ceiling chunks / cave stalactites
  if (fight) {
    const nC = layout === 'cave' ? rng.int(5, 8) : rng.int(1, 3);
    for (let i = 0; i < nC; i++) {
      const cx = rng.int(6, w - 10), cw = rng.int(3, 7), ch = layout === 'cave' ? rng.int(2, 4) : rng.int(1, 2);
      for (let tx = cx; tx < cx + cw; tx++) for (let ty = 1; ty <= ch - (tx === cx || tx === cx + cw - 1 ? 1 : 0); ty++) R.set(tx, ty, 1);
    }
    if (layout === 'cave') for (let tx = 2; tx < w - 2; tx++) if (rng.chance(0.5)) R.set(tx, 1, 1);
  }
  // 苍雪寒山: slippery ice sheets on the ground
  R.ice = new Set();
  if (bi === 3 && (fight || type === 'boss')) {
    for (let k = 0; k < (type === 'boss' ? 2 : rng.int(1, 3)); k++) {
      const ix = type === 'boss' ? (k ? w - 16 : 6) : rng.int(10, w - 26), il = type === 'boss' ? 10 : rng.int(5, 10);
      for (let i = ix; i < Math.min(w - 4, ix + il); i++) R.ice.add(i);
    }
  }
  // platforms
  const plats = [];
  const tryPlat = (px, py, pw) => {
    if (px < 3 || px + pw > w - 3 || py < 3) return false;
    for (let tx = px - 2; tx < px + pw + 2; tx++) for (let ty = py - 2; ty <= py + 2; ty++) { const t = R.tile(tx, ty); if (t === 1 && ty >= py - 1 || t === 2) return false; }
    for (let tx = px; tx < px + pw; tx++) if (gy[tx] - py < 3) return false;
    for (let tx = px; tx < px + pw; tx++) R.set(tx, py, 2);
    plats.push({ x: px, y: py, w: pw });
    return true;
  };
  if (type === 'boss') {
    tryPlat(6, base - 4, 6); tryPlat(w - 12, base - 4, 6); tryPlat(Math.floor(w / 2) - 3, base - 8, 6);
  } else if (type === 'combat' || type === 'elite') {
    const n = Math.floor(w / 9);
    for (let i = 0; i < n * 3 && plats.length < n; i++) {
      const pw = rng.int(3, 7), px = rng.int(6, w - 10 - pw);
      let mg = 99; for (let tx = px; tx < px + pw; tx++) mg = Math.min(mg, gy[tx]);
      tryPlat(px, mg - rng.int(4, 5), pw);
    }
    if (h > 18) for (let i = 0; i < 12; i++) {
      const pw = rng.int(4, 7), px = rng.int(6, w - 10 - pw);
      let mg = 99; for (let tx = px; tx < px + pw; tx++) mg = Math.min(mg, gy[tx]);
      tryPlat(px, mg - rng.int(8, 9), pw);
    }
    if (h >= 24) for (let i = 0; i < 14; i++) {
      const pw = rng.int(4, 8), px = rng.int(6, w - 10 - pw);
      let mg = 99; for (let tx = px; tx < px + pw; tx++) mg = Math.min(mg, gy[tx]);
      tryPlat(px, mg - rng.int(12, 13), pw);
    }
  }
  R.plats = plats;
  R.gy = gy;
  R.base = base;
  R.spawnX = 5 * TILE; R.spawnY = gy[5] * TILE;
  // spawn spots
  for (let tx = 8; tx < w - 6; tx++) R.spots.push({ x: tx * TILE + 8, y: gy[tx] * TILE });
  for (const p of plats) for (let tx = p.x; tx < p.x + p.w; tx++) R.spots.push({ x: tx * TILE + 8, y: p.y * TILE, plat: true });
  for (let tx = 10; tx < w - 8; tx += 2) R.airSpots.push({ x: tx * TILE, y: Math.max(3 * TILE, (gy[tx] - rng.int(5, 8)) * TILE) });
  R.airSpots = R.airSpots.filter(a => !R.solidPx(a.x, a.y) && !R.solidPx(a.x, a.y - 16) && !R.solidPx(a.x, a.y + 12));
  if (!R.airSpots.length) R.airSpots.push({ x: w * TILE / 2, y: (base - 5) * TILE });
  // exit region: flat area near the right end
  R.exitX = (w - 8) * TILE; R.exitY = base * TILE;
  // props
  genProps(R, rng);
  renderRoomTiles(R);
  return R;
}

function genProps(R, rng) {
  const bi = R.bi, gy = R.gy;
  const used = new Set();
  const place = (tx, kind, extra) => {
    if (used.has(tx) || used.has(tx - 1) || used.has(tx + 1)) return;
    if (gy[tx - 1] !== gy[tx] || gy[tx + 1] !== gy[tx]) return;
    if (R.tile(tx, gy[tx] - 1) !== 0 || R.tile(tx, gy[tx] - 2) !== 0) return;
    used.add(tx);
    R.props.push(Object.assign({ kind, x: tx * TILE + 8, y: gy[tx] * TILE, seed: rng.int(0, 9999) }, extra || {}));
  };
  const n = Math.floor(R.w / 5);
  for (let i = 0; i < n; i++) {
    const tx = rng.int(3, R.w - 4);
    if (bi === 0) place(tx, rng.weighted([{ w: 3, v: 'toro' }, { w: 3, v: 'bamboo' }, { w: 1.2, v: 'shrine' }, { w: 1.5, v: 'jizo' }, { w: 2.5, v: 'bush' }]), { col: '#ffb060' });
    else if (bi === 1) place(tx, rng.weighted([{ w: 4, v: 'crystal' }, { w: 3, v: 'shroom' }, { w: 2, v: 'rock' }]), { col: rng.pick(['#45f0ff', '#b26cff', '#6affc8']) });
    else if (bi === 3) place(tx, rng.weighted([{ w: 3.5, v: 'snowpine' }, { w: 2.5, v: 'toroSnow' }, { w: 1.6, v: 'jizoSnow' }, { w: 2, v: 'icespike' }, { w: 1.4, v: 'flags' }]), { col: '#ffb070' });
    else place(tx, rng.weighted([{ w: 3, v: 'brazier' }, { w: 2, v: 'obelisk' }, { w: 3, v: 'rubble' }, { w: 1, v: 'statue' }]), { col: '#ff3048' });
  }
}

// ---------- tiles & props rendering ----------
function renderRoomTiles(R) {
  const T = R.biome.tile, bi = R.bi;
  const pw = R.pw, ph = R.ph;
  const canvas = pixLayer(pw, ph, x => {
    // depth map
    for (let ty = 0; ty < R.h; ty++) for (let tx = 0; tx < R.w; tx++) {
      const t = R.tile(tx, ty);
      const px = tx * TILE, py = ty * TILE;
      if (t === 1) {
        let depth = 4;
        for (let d = 1; d <= 4; d++) {
          if (R.tile(tx, ty - d) !== 1 || R.tile(tx - d, ty) !== 1 || R.tile(tx + d, ty) !== 1 || R.tile(tx, ty + d) !== 1) { depth = d - 1; break; }
        }
        const baseCol = depth >= 3 ? T.dark : depth === 2 ? mix(T.base, T.dark, 0.5) : T.base;
        x.rect(px, py, TILE, TILE, baseCol);
        const h = hash2(tx, ty, bi);
        if (depth < 3) {
          if (bi === 0) {
            // packed earth with embedded stones
            for (let k = 0; k < 3; k++) { const hx = hash2(tx * 5 + k, ty * 7, 11); x.rect(px + Math.floor(hx * 14), py + Math.floor(hash2(tx, ty * 3 + k, 13) * 14), 1, 1, hx < 0.5 ? T.line : T.dark); }
            if (h < 0.22) { const sx0 = px + 2 + Math.floor(hash2(tx, ty, 21) * 6), sy0 = py + 4 + Math.floor(hash2(tx, ty, 22) * 6); x.ell(sx0 + 3, sy0 + 2, 3.5, 2.2, 0, '#4a3c34'); x.rect(sx0 + 1, sy0, 3, 1, '#5e4e44'); }
          } else if (bi === 1) {
            for (let k = 0; k < 4; k++) { const hx = hash2(tx * 7 + k, ty * 3, 5); x.rect(px + Math.floor(hx * 15), py + Math.floor(hash2(tx, ty * 5 + k, 9) * 15), 2, 1, hx < 0.5 ? T.line : T.dark); }
            if (h < 0.06) { x.poly([[px + 5, py + 12], [px + 8, py + 4], [px + 10, py + 12]], '#2fb8d8'); }
          } else if (bi === 3) {
            // frost-bitten granite with pale cracks
            for (let k = 0; k < 3; k++) { const hx = hash2(tx * 3 + k, ty * 11, 17); x.rect(px + Math.floor(hx * 14), py + Math.floor(hash2(tx, ty * 7 + k, 19) * 14), 2, 1, hx < 0.4 ? T.line : '#46506a'); }
            if (h < 0.15) { let cx = px + 3 + Math.floor(hash2(tx, ty, 23) * 8), cy = py + 2; for (let k = 0; k < 7; k++) { x.rect(cx, cy, 1, 1, '#4e5a78'); cx += Math.round(hash2(tx + k, ty, 29) * 2 - 1); cy += 2; } }
          } else {
            if (h < 0.25) { let cx = px + Math.floor(hash2(tx, ty, 3) * 12) + 2, cy = py + 2; for (let k = 0; k < 10; k++) { x.rect(cx, cy, 1, 1, '#4a1424'); cx += Math.round(hash2(tx + k, ty, 7) * 2 - 1); cy += 1; } }
            if (h > 0.9) x.rect(px + 6, py + 6, 3, 3, '#2a0e18');
          }
        }
        const up = R.tile(tx, ty - 1) !== 1, lf = R.tile(tx - 1, ty) !== 1, rt = R.tile(tx + 1, ty) !== 1, dn = R.tile(tx, ty + 1) !== 1;
        if (lf) x.rect(px, py, 1, 16, T.edge);
        if (rt) x.rect(px + 15, py, 1, 16, T.edge);
        if (dn) {
          x.rect(px, py + 14, 16, 2, T.edge);
          if (bi === 3) for (let k = 1; k < 15; k += 3) { const ll = hash2(tx * 16 + k, ty, 41); if (ll < 0.5) { x.poly([[px + k, py + 16], [px + k + 2, py + 16], [px + k + 1, py + 17 + ll * 10]], '#a8c4e4'); } }
        }
        if (up && bi === 3) {
          const iced = R.ice && R.ice.has(tx) && R.tile(tx, ty - 1) === 0 && ty === R.gy[tx];
          if (iced) {
            // glassy ice sheet
            x.rect(px, py, 16, 5, '#7fb8e6'); x.rect(px, py, 16, 2, '#bfe6ff'); x.rect(px, py, 16, 1, '#ffffff');
            if (hash2(tx, ty, 51) < 0.6) x.rect(px + 3 + Math.floor(hash2(tx, ty, 52) * 8), py + 1, 4, 1, '#ffffff');
            x.rect(px, py + 5, 16, 1, '#4a78a8');
          } else {
            // thick snow cap with soft drifts
            x.rect(px, py, 16, 5, T.topD); x.rect(px, py, 16, 3, T.top);
            for (let k = 0; k < 16; k += 2) { const hh = hash2(tx * 16 + k, ty, 43); if (hh < 0.45) x.rect(px + k, py - 1 - Math.floor(hh * 2.5), 2, 1 + Math.floor(hh * 2.5), T.top); }
            x.rect(px, py + 5, 16, 1, T.topB);
          }
          if (lf) x.rect(px, py, 1, 5, T.top);
          if (rt) x.rect(px + 15, py, 1, 5, T.top);
        } else if (up) {
          x.rect(px, py, 16, 4, T.topB);
          x.rect(px, py, 16, 2, T.topD);
          x.rect(px, py, 16, 1, T.top);
          if (bi === 1) { // hanging moss
            for (let k = 0; k < 16; k += 2) if (hash2(tx * 16 + k, ty, 2) < 0.35) x.rect(px + k, py + 2, 1, 1 + Math.floor(hash2(tx * 16 + k, ty, 4) * 4), T.topD);
          } else if (bi === 0) {
            // grass blades poking up, the odd wildflower
            for (let k = 0; k < 16; k += 2) { const hh = hash2(tx * 16 + k, ty, 31); if (hh < 0.55) x.rect(px + k, py - 1 - Math.floor(hh * 3), 1, 1 + Math.floor(hh * 3), hh < 0.25 ? T.top : T.topD); }
            if (h < 0.12) { x.rect(px + 7, py - 3, 1, 3, T.topD); x.rect(px + 6, py - 4, 3, 1, pick(['#ff9ab8', '#ffe08a', '#ffffff'])); }
            for (let k = 0; k < 16; k += 3) if (hash2(tx * 16 + k, ty, 33) < 0.3) x.rect(px + k, py + 4, 1, 1 + Math.floor(hash2(tx * 16 + k, ty, 34) * 2), T.topD);
          } else {
            if (h < 0.5) x.rect(px + 7, py + 1, 2, 3, T.topD);
          }
          if (lf) x.rect(px, py, 1, 4, T.top);
          if (rt) x.rect(px + 15, py, 1, 4, T.top);
        }
      } else if (t === 2) {
        const l = R.tile(tx - 1, ty) !== 2, r = R.tile(tx + 1, ty) !== 2;
        x.rect(px, py, 16, 6, T.plat);
        x.rect(px, py + 5, 16, 1, T.platD);
        x.rect(px, py, 16, 1, T.platTop);
        if (bi === 0) { x.rect(px + (tx % 2 ? 7 : 11), py + 1, 1, 4, T.platD); x.rect(px + 2, py + 3, 3, 1, '#8a6440'); }
        if (bi === 2) x.rect(px + 4, py + 2, 8, 1, '#5a1a28');
        if (bi === 3) { x.rect(px, py, 16, 2, T.platTop); if (hash2(tx, ty, 61) < 0.5) x.rect(px + 4, py - 1, 6, 1, T.platTop); x.rect(px + (tx % 2 ? 7 : 11), py + 2, 1, 3, T.platD); }
        if (l) { x.rect(px, py, 1, 6, T.edge); x.poly([[px + 2, py + 6], [px + 6, py + 6], [px + 3, py + 11]], T.platD); }
        if (r) { x.rect(px + 15, py, 1, 6, T.edge); x.poly([[px + 10, py + 6], [px + 14, py + 6], [px + 13, py + 11]], T.platD); }
      }
    }
  });
  R.tileCanvas = canvas;
  // emissive edges for bloom
  R.tileGlow = pixLayer(pw, ph, x => {
    for (let ty = 0; ty < R.h; ty++) for (let tx = 0; tx < R.w; tx++) {
      const t = R.tile(tx, ty);
      if (t === 1 && R.tile(tx, ty - 1) !== 1) { if (bi !== 3) x.rect(tx * TILE, ty * TILE, 16, 1, R.biome.tile.top); else if (R.ice.has(tx)) x.rect(tx * TILE, ty * TILE, 16, 2, '#6ab8f0'); }
      if (t === 2 && bi !== 3) x.rect(tx * TILE, ty * TILE, 16, 1, R.biome.tile.platTop);
    }
  });
  // props
  R.propCanvas = pixLayer(pw, ph, x => { for (const p of R.props) drawProp(x, p, R); });
  R.propGlow = pixLayer(pw, ph, x => { for (const p of R.props) drawPropGlow(x, p); });
  for (const p of R.props) {
    if (p.kind === 'toro') R.lights.push({ x: p.x, y: p.y - 18, r: 100, c: '#ffb060', flick: true });
    if (p.kind === 'shrine') R.lights.push({ x: p.x, y: p.y - 10, r: 50, c: '#ff8a5a' });
    if (p.kind === 'crystal') R.lights.push({ x: p.x, y: p.y - 8, r: 80, c: p.col });
    if (p.kind === 'shroom') R.lights.push({ x: p.x, y: p.y - 8, r: 50, c: '#6affc8' });
    if (p.kind === 'brazier') R.lights.push({ x: p.x, y: p.y - 18, r: 110, c: '#ff8a3a', flick: true, fire: true });
    if (p.kind === 'obelisk') R.lights.push({ x: p.x, y: p.y - 20, r: 60, c: '#ff3048' });
    if (p.kind === 'toroSnow') R.lights.push({ x: p.x, y: p.y - 18, r: 100, c: '#ffb070', flick: true });
    if (p.kind === 'icespike') R.lights.push({ x: p.x, y: p.y - 8, r: 50, c: '#9fd8ff' });
  }
}
function drawProp(x, p, R) {
  const X = p.x, Y = p.y;
  const rng = RNG(p.seed);
  switch (p.kind) {
    case 'toro': // stone lantern
      x.rect(X - 6, Y - 3, 12, 3, '#5a5450'); x.rect(X - 2, Y - 12, 4, 9, '#6a6460');
      x.rect(X - 5, Y - 14, 10, 2, '#5a5450'); x.rect(X - 4, Y - 21, 8, 7, '#6a6460'); x.rect(X - 2, Y - 20, 4, 4, '#2a1e18');
      x.poly([[X - 8, Y - 21], [X + 8, Y - 21], [X + 2, Y - 26], [X - 2, Y - 26]], '#5a5450'); x.rect(X - 1, Y - 28, 2, 2, '#6a6460');
      break;
    case 'bamboo':
      for (let k = 0; k < 3; k++) {
        const bx = X - 5 + k * 4 + rng.int(-1, 1), hh = rng.int(30, 54);
        x.rect(bx, Y - hh, 2.4, hh, k % 2 ? '#3e6a30' : '#4e7e38');
        for (let y = Y - 8; y > Y - hh; y -= 9) x.rect(bx - 0.5, y, 3.4, 1, '#2e4e24');
        x.poly([[bx + 2, Y - hh + 4], [bx + 10, Y - hh], [bx + 8, Y - hh + 4]], '#5a8a3e');
      }
      break;
    case 'shrine': // small roadside hokora
      x.rect(X - 7, Y - 12, 14, 12, '#5a2a22'); x.rect(X - 5, Y - 10, 10, 8, '#2a1410');
      x.poly([[X - 10, Y - 12], [X + 10, Y - 12], [X + 6, Y - 18], [X - 6, Y - 18]], '#3a2a24');
      x.rect(X - 10, Y - 12, 20, 1, '#8a6a4a'); x.rect(X - 1, Y - 7, 2, 3, '#e8d8b0');
      break;
    case 'jizo': // little stone guardian with a red bib
      x.rect(X - 4, Y - 3, 8, 3, '#5a5450'); x.ell(X, Y - 9, 4, 6, 0, '#7a7470'); x.circ(X, Y - 16, 3.2, '#7a7470');
      x.poly([[X - 4, Y - 12], [X + 4, Y - 12], [X, Y - 7]], '#c83a2a');
      break;
    case 'bush':
      x.ell(X, Y - 5, 9, 5.5, 0, '#2e4a24'); x.ell(X - 4, Y - 7, 5, 4, 0, '#3e5e2e'); x.ell(X + 4, Y - 6, 5, 4, 0, '#365428');
      for (let k = 0; k < 5; k++) x.rect(X - 7 + rng.int(0, 14), Y - 9 + rng.int(0, 6), 1.5, 1.5, rng.pick(['#ff9ab8', '#ffffff', '#ffd08a']));
      break;
    case 'crystal':
      for (let k = 0; k < 3; k++) {
        const ox = X + (k - 1) * 4 + rng.int(-1, 1), hh = rng.int(8, 16), ww = rng.int(4, 6), ln = rng.int(-4, 4);
        x.poly([[ox - ww / 2, Y], [ox + ln, Y - hh], [ox + ww / 2, Y]], shade(p.col, -0.2));
        x.poly([[ox + ln, Y - hh], [ox + ww / 2, Y], [ox, Y]], shade(p.col, -0.5));
      }
      break;
    case 'shroom':
      x.rect(X - 1, Y - 7, 2, 7, '#3a5a6a'); x.ell(X, Y - 8, 5, 3, 0, '#2a8a8a');
      x.rect(X + 4, Y - 4, 1, 4, '#3a5a6a'); x.ell(X + 4, Y - 5, 3, 2, 0, '#2a8a8a');
      break;
    case 'rock':
      x.ell(X, Y - 3, 8, 5, 0, '#1d2e48'); x.ell(X - 2, Y - 5, 5, 3, 0, '#2a4060');
      break;
    case 'brazier':
      x.rect(X - 1, Y - 12, 3, 12, '#2a1418'); x.rect(X - 4, Y - 2, 9, 2, '#2a1418');
      x.poly([[X - 7, Y - 16], [X + 8, Y - 16], [X + 5, Y - 11], [X - 4, Y - 11]], '#3a1a20');
      x.rect(X - 7, Y - 16, 15, 1, '#8a6420');
      break;
    case 'obelisk':
      x.poly([[X - 5, Y], [X - 3, Y - 30], [X, Y - 34], [X + 3, Y - 30], [X + 5, Y]], '#14060c');
      x.poly([[X, Y - 34], [X + 3, Y - 30], [X + 5, Y], [X + 2, Y]], '#2a0e18');
      break;
    case 'rubble':
      for (let k = 0; k < 4; k++) x.rect(X - 8 + rng.int(0, 12), Y - rng.int(2, 5), rng.int(3, 6), 5, pick(['#1a0a12', '#2a1220', '#14060c']));
      break;
    case 'statue':
      x.rect(X - 5, Y - 6, 10, 6, '#1a0a12'); x.rect(X - 3, Y - 22, 6, 16, '#22101a'); x.circ(X, Y - 25, 3.5, '#22101a');
      x.rect(X - 6, Y - 18, 12, 3, '#22101a'); x.rect(X - 3, Y - 22, 6, 1, '#8a6420');
      break;
    case 'snowpine': {
      const th = rng.int(26, 40);
      x.rect(X - 1, Y - 6, 3, 6, '#3a2a22');
      for (let k = 0; k < 4; k++) {
        const w = 18 - k * 4, y = Y - 6 - k * (th / 5);
        x.poly([[X - w / 2, y], [X + 0.5, y - th / 4], [X + w / 2 + 1, y]], k % 2 ? '#1e3a34' : '#244640');
        x.poly([[X - w / 2, y], [X + 0.5, y - th / 4], [X + w / 2 + 1, y], [X + w / 3, y - 2], [X - w / 3, y - 2]], '#e6eefc');
      }
      break;
    }
    case 'toroSnow':
      x.rect(X - 6, Y - 3, 12, 3, '#5a5e6a'); x.rect(X - 2, Y - 12, 4, 9, '#6a6e7a');
      x.rect(X - 5, Y - 14, 10, 2, '#5a5e6a'); x.rect(X - 4, Y - 21, 8, 7, '#6a6e7a'); x.rect(X - 2, Y - 20, 4, 4, '#2a1e18');
      x.poly([[X - 8, Y - 21], [X + 8, Y - 21], [X + 2, Y - 26], [X - 2, Y - 26]], '#5a5e6a');
      x.poly([[X - 9, Y - 21], [X - 2, Y - 27], [X + 2, Y - 27], [X + 9, Y - 21], [X + 6, Y - 22], [X - 6, Y - 22]], '#f0f6ff');
      x.rect(X - 6, Y - 4, 12, 1, '#f0f6ff');
      break;
    case 'jizoSnow':
      x.rect(X - 4, Y - 3, 8, 3, '#5a5e6a'); x.ell(X, Y - 9, 4, 6, 0, '#7a7e8a'); x.circ(X, Y - 16, 3.2, '#7a7e8a');
      x.poly([[X - 4, Y - 12], [X + 4, Y - 12], [X, Y - 7]], '#c83a2a');
      x.ell(X, Y - 19, 5.5, 1.6, 0, '#c8a060'); x.poly([[X - 3, Y - 19], [X, Y - 23], [X + 3, Y - 19]], '#b08a50');
      x.rect(X - 4, Y - 21, 8, 1, '#f0f6ff');
      break;
    case 'icespike':
      for (let k = 0; k < 3; k++) {
        const ox = X + (k - 1) * 4 + rng.int(-1, 1), hh = rng.int(7, 14), ww = rng.int(3, 5), ln = rng.int(-3, 3);
        x.poly([[ox - ww / 2, Y], [ox + ln, Y - hh], [ox + ww / 2, Y]], '#9fc8ec');
        x.poly([[ox + ln, Y - hh], [ox + ww / 2, Y], [ox, Y]], '#d8f0ff');
      }
      break;
    case 'flags': // prayer-flag line between two poles
      x.rect(X - 10, Y - 26, 1.5, 26, '#4a3a2e'); x.rect(X + 9, Y - 22, 1.5, 22, '#4a3a2e');
      for (let k = 0; k < 6; k++) { const fx = X - 8 + k * 3, fy = Y - 25 + k * 0.6 + Math.abs(k - 2.5) * 0.6; x.rect(fx, fy, 2.4, 3.5, ['#e84a3a', '#f0c050', '#4a9ae8', '#f4f4f4', '#5ac85a', '#e84a3a'][k]); }
      x.rect(X - 11, Y - 27, 3, 1, '#f0f6ff'); x.rect(X + 8, Y - 23, 3, 1, '#f0f6ff');
      break;
  }
}
function drawPropGlow(x, p) {
  const X = p.x, Y = p.y;
  switch (p.kind) {
    case 'toro': x.rect(X - 2, Y - 20, 4, 4, '#ffb060'); break;
    case 'shrine': x.rect(X - 1, Y - 7, 2, 2, '#ff8a5a'); break;
    case 'crystal': x.rect(X - 1, Y - 10, 2, 6, p.col); break;
    case 'shroom': x.ell(X, Y - 8, 4, 2, 0, '#6affc8'); x.ell(X + 4, Y - 5, 2, 1, 0, '#6affc8'); break;
    case 'obelisk': for (let k = 0; k < 4; k++) x.rect(X - 1, Y - 28 + k * 6, 2, 3, '#ff3048'); break;
    case 'barrel': x.rect(X - 4, Y - 13, 8, 1, '#7dff6a'); break;
    case 'toroSnow': x.rect(X - 2, Y - 20, 4, 4, '#ffb070'); break;
    case 'icespike': x.rect(X - 1, Y - 8, 2, 5, '#9fd8ff'); break;
  }
}

// =====================================================================
//  PHYSICS — tile collision for bodies (x = center, y = feet)
// =====================================================================
const GRAV = 1150;
function moveBody(e, dt, R) {
  let dx = e.vx * dt, dy = e.vy * dt;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 6));
  dx /= steps; dy /= steps;
  e.onGround = false; e.hitWall = 0; e.hitCeil = false;
  for (let i = 0; i < steps; i++) { moveX(e, dx, R); moveY(e, dy, R); }
  // keep inside room
  e.x = clamp(e.x, 2 * TILE + e.w / 2, R.pw - 2 * TILE - e.w / 2);
  if (e.y > R.ph + 40) { e.y = R.floorBelow(e.x, 0); e.vy = 0; }
}
function moveX(e, dx, R) {
  if (!dx) return;
  e.x += dx;
  const top = e.y - e.h + 0.5, bot = e.y - 0.5;
  const ty0 = Math.floor(top / TILE), ty1 = Math.floor(bot / TILE);
  if (dx > 0) {
    const tx = Math.floor((e.x + e.w / 2) / TILE);
    for (let ty = ty0; ty <= ty1; ty++) if (R.tile(tx, ty) === 1) { e.x = tx * TILE - e.w / 2 - 0.01; e.hitWall = 1; return; }
  } else {
    const tx = Math.floor((e.x - e.w / 2) / TILE);
    for (let ty = ty0; ty <= ty1; ty++) if (R.tile(tx, ty) === 1) { e.x = (tx + 1) * TILE + e.w / 2 + 0.01; e.hitWall = -1; return; }
  }
}
function moveY(e, dy, R) {
  if (!dy) return;
  const prev = e.y;
  e.y += dy;
  const l = e.x - e.w / 2 + 0.5, r = e.x + e.w / 2 - 0.5;
  const tx0 = Math.floor(l / TILE), tx1 = Math.floor(r / TILE);
  if (dy > 0) {
    const ty = Math.floor(e.y / TILE);
    for (let tx = tx0; tx <= tx1; tx++) {
      const t = R.tile(tx, ty);
      if (t === 1 || (t === 2 && !(e.dropT > 0) && prev <= ty * TILE + 0.5 && !e.noPlat)) {
        e.y = ty * TILE; e.vy = 0; e.onGround = true; e.groundT = t; return;
      }
    }
  } else {
    const ty = Math.floor((e.y - e.h) / TILE);
    for (let tx = tx0; tx <= tx1; tx++) if (R.tile(tx, ty) === 1) { e.y = (ty + 1) * TILE + e.h + 0.01; e.vy = 0; e.hitCeil = true; return; }
  }
}
// may a walker step forward? (ground ahead, or the target is below and we can drop down)
function canWalk(e, dir, R) {
  if (groundAhead(e, dir, R)) return true;
  const p = G.player;
  if (!p || p.y - e.y < 24) return false;
  const fx = e.x + dir * (e.w / 2 + 4);
  return R.tile(Math.floor(fx / TILE), Math.floor((e.y - 4) / TILE)) !== 1;
}
// is there ground right in front (for patrol AI)?
function groundAhead(e, dir, R) {
  const fx = e.x + dir * (e.w / 2 + 4);
  const t = R.tile(Math.floor(fx / TILE), Math.floor((e.y + 4) / TILE));
  const wall = R.tile(Math.floor(fx / TILE), Math.floor((e.y - 4) / TILE)) === 1;
  return (t === 1 || t === 2) && !wall;
}
