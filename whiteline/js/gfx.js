/* =========================================================
   gfx.js —— 像素渲染：精灵/派生精灵缓存、像素文字、气泡、图标、粒子、缩放
   所有绘制都在 384×256 的缓冲上完成，最后整数（或近整数）放大到屏幕。
   ========================================================= */
(function () {
  'use strict';
  const U = G.util;
  const X = (G.gfx = {});
  const W = G.W, H = G.H;
  let cv, ctx, buf, b;
  X.K = 3;

  X.PAL = {
    ink: '#2b2620', ink2: '#5b5044', paper: '#f4f1e8', paper2: '#ece3cb', red: '#b5432e', red2: '#d9614a', amber: '#f0a83a', yellow: '#d8b24a',
    navy: '#26324a', white: '#f4f1e8', black: '#14161c', green: '#6f9a58', blue: '#5c86b3', gray: '#8a8a90', pale: '#cfe0ea', pink: '#e8a6a0',
  };

  // ---------- 资源 ----------
  X.img = {};
  X.meta = window.ASSET_META || {};
  X.load = function () {
    const names = Object.keys(window.ASSET_DATA || {});
    if (window.BITFONT) { window.ASSET_DATA.__bitfont = window.BITFONT.img; names.push('__bitfont'); }
    return Promise.all(names.map((n) => new Promise((res) => {
      const im = new Image();
      im.onload = () => { X.img[n] = im; res(); };
      im.onerror = () => { console.warn('img fail', n); res(); };
      im.src = window.ASSET_DATA[n];
    })));
  };

  X.init = function (canvas) {
    cv = canvas; ctx = cv.getContext('2d');
    buf = document.createElement('canvas'); buf.width = W; buf.height = H;
    b = buf.getContext('2d'); b.imageSmoothingEnabled = false;
    X.b = b; X.buf = buf;
  };

  // ---------- 缩放到屏幕 ----------
  X.fit = function (cssW, cssH) {
    const dpr = window.devicePixelRatio || 1;
    let s = Math.min(cssW / W, cssH / H);
    if (s <= 0) s = 0.5;
    let K = s * dpr;
    // 整数倍最锐利；但若取整会损失太多面积（高 DPR 手机），改用 1/8 精度的近整数倍
    if (K >= 1 && Math.floor(K) / K >= 0.9) K = Math.floor(K);
    else if (K >= 1) K = Math.max(1, Math.floor(K * 8) / 8);
    X.K = K;
    cv.width = Math.round(W * K); cv.height = Math.round(H * K);
    const cw = cv.width / dpr, ch = cv.height / dpr;
    cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
    ctx.imageSmoothingEnabled = false;
    return { w: cw, h: ch };
  };
  X.present = function () {
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(buf, 0, 0, cv.width, cv.height);
  };
  // 屏幕坐标 → 逻辑坐标
  X.toLogic = function (clientX, clientY) {
    const r = cv.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * W, y: ((clientY - r.top) / r.height) * H };
  };
  X.toClient = function (x, y) {
    const r = cv.getBoundingClientRect();
    return { x: r.left + (x / W) * r.width, y: r.top + (y / H) * r.height };
  };

  // ---------- 派生精灵缓存 ----------
  const vcache = new Map();
  function canvasOf(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  X.canvasOf = canvasOf;
  // kind: 'flip' | 'dither' | 'dither2' | 'sil:#hex' | 'outline:#hex' | 'tint:#hex' | 'crack' | 'gray' | 'blank'
  let vid = 0;
  X.variant = function (name, kind) {
    if (typeof name !== 'string' && name && !name.__vid) name.__vid = 'c' + (++vid);
    const key = (typeof name === 'string' ? name : name && name.__vid) + '|' + kind;
    let c = vcache.get(key);
    if (c) return c;
    const src = typeof name === 'string' ? X.img[name] : name;
    if (!src) return null;
    const w = src.width, h = src.height;
    c = canvasOf(w + (kind.startsWith('outline') ? 2 : 0), h + (kind.startsWith('outline') ? 2 : 0));
    const x = c.getContext('2d');
    if (kind === 'flip') { x.translate(w, 0); x.scale(-1, 1); x.drawImage(src, 0, 0); vcache.set(key, c); return c; }
    x.drawImage(src, kind.startsWith('outline') ? 1 : 0, kind.startsWith('outline') ? 1 : 0);
    const id = x.getImageData(0, 0, c.width, c.height), d = id.data, cw = c.width;
    const hex = kind.includes(':') ? kind.split(':')[1] : '#ffffff';
    const rr = parseInt(hex.slice(1, 3), 16), gg = parseInt(hex.slice(3, 5), 16), bb = parseInt(hex.slice(5, 7), 16);
    if (kind.startsWith('outline')) {
      const a = new Uint8Array(c.width * c.height);
      for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3] > 0 ? 1 : 0;
      for (let y = 0; y < c.height; y++) for (let xx = 0; xx < cw; xx++) {
        const i = y * cw + xx; if (a[i]) { d[i * 4 + 3] = 0; continue; }
        if ((xx > 0 && a[i - 1]) || (xx < cw - 1 && a[i + 1]) || (y > 0 && a[i - cw]) || (y < c.height - 1 && a[i + cw])) { d[i * 4] = rr; d[i * 4 + 1] = gg; d[i * 4 + 2] = bb; d[i * 4 + 3] = 255; }
      }
    } else {
      for (let y = 0; y < c.height; y++) for (let xx = 0; xx < cw; xx++) {
        const i = (y * cw + xx) * 4; if (!d[i + 3]) continue;
        if (kind === 'dither') { if ((xx + y) % 2) d[i + 3] = 0; }
        else if (kind === 'dither2') { if ((xx + y) % 2 || y % 2) d[i + 3] = 0; }
        else if (kind.startsWith('sil')) { d[i] = rr; d[i + 1] = gg; d[i + 2] = bb; }
        else if (kind.startsWith('tint')) { d[i] = (d[i] + rr) >> 1; d[i + 1] = (d[i + 1] + gg) >> 1; d[i + 2] = (d[i + 2] + bb) >> 1; }
        else if (kind === 'gray') { const l = (d[i] * 0.3 + d[i + 1] * 0.55 + d[i + 2] * 0.15) * 0.9 + 18; d[i] = l; d[i + 1] = l; d[i + 2] = l + 6; }
        else if (kind === 'placeholder') { const l = (d[i] * 0.3 + d[i + 1] * 0.55 + d[i + 2] * 0.15); const v = l < 60 ? 70 : l < 120 ? 128 : 170; d[i] = v; d[i + 1] = v; d[i + 2] = v + 8; }
        else if (kind === 'crack') {
          const hsh = ((xx * 7 + y * 13) ^ (xx * y)) % 23;
          if (hsh === 0 || ((xx + y * 2) % 11 === 0 && (y % 5) < 2)) { d[i] = 250; d[i + 1] = 250; d[i + 2] = 255; }
        }
      }
    }
    x.putImageData(id, 0, 0);
    vcache.set(key, c);
    return c;
  };
  // 取精灵平均色（用于液化水洼等）
  const avgCache = new Map();
  X.avgColor = function (name) {
    if (avgCache.has(name)) return avgCache.get(name);
    const src = X.img[name]; if (!src) return '#888';
    const c = canvasOf(src.width, src.height), x = c.getContext('2d'); x.drawImage(src, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data; let r = 0, g = 0, bl = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3]) { r += d[i]; g += d[i + 1]; bl += d[i + 2]; n++; }
    const col = n ? `rgb(${(r / n) | 0},${(g / n) | 0},${(bl / n) | 0})` : '#888';
    avgCache.set(name, col); return col;
  };

  // ---------- 基础图元 ----------
  X.rect = (x, y, w, h, c) => { b.fillStyle = c; b.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  X.px = (x, y, c) => { b.fillStyle = c; b.fillRect(Math.round(x), Math.round(y), 1, 1); };
  X.frame = (x, y, w, h, c) => { x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h); b.fillStyle = c; b.fillRect(x + 1, y, w - 2, 1); b.fillRect(x + 1, y + h - 1, w - 2, 1); b.fillRect(x, y + 1, 1, h - 2); b.fillRect(x + w - 1, y + 1, 1, h - 2); };
  X.box = (x, y, w, h, fill, border) => { X.rect(x + 1, y + 1, w - 2, h - 2, fill); X.frame(x, y, w, h, border); };
  X.line = function (x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy; b.fillStyle = c; let n = 0;
    for (;;) { b.fillRect(x0, y0, 1, 1); if ((x0 === x1 && y0 === y1) || n++ > 2000) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
  };
  X.dline = function (x0, y0, x1, y1, c, on = 2, off = 2) { // 虚线
    const len = Math.hypot(x1 - x0, y1 - y0); const n = Math.max(1, Math.floor(len));
    b.fillStyle = c;
    for (let i = 0; i <= n; i++) if (i % (on + off) < on) b.fillRect(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), 1, 1);
  };
  X.circle = function (cx, cy, r, c, fill = false) {
    b.fillStyle = c; cx = Math.round(cx); cy = Math.round(cy);
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      const d = x * x + y * y;
      if (fill ? d <= r * r + r * 0.6 : d <= r * r + r * 0.6 && d >= (r - 1) * (r - 1) + (r - 1) * 0.6) b.fillRect(cx + x, cy + y, 1, 1);
    }
  };
  X.ellipse = function (cx, cy, rx, ry, c, dither = false) {
    b.fillStyle = c;
    for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) { if (dither && (x + y) & 1) continue; b.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1); }
    }
  };
  X.ditherRect = function (x, y, w, h, c, phase = 0) {
    b.fillStyle = c;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if ((i + j + phase) % 2 === 0) b.fillRect(x + i, y + j, 1, 1);
  };
  X.spr = function (name, x, y, opts = {}) {
    let im = X.img[name];
    if (!im) return;
    let src = im;
    if (opts.variant) src = X.variant(name, opts.variant) || im;
    if (opts.flip) src = X.variant(opts.variant ? src : name, 'flip') || src;
    const sc = opts.scale || 1;
    if (sc === 1 && !opts.sw) b.drawImage(src, Math.round(x), Math.round(y));
    else b.drawImage(src, Math.round(x), Math.round(y), Math.round((opts.sw || src.width) * sc), Math.round((opts.sh || src.height) * sc));
  };
  X.draw = function (src, x, y, w, h) { if (!src) return; b.drawImage(src, Math.round(x), Math.round(y), w == null ? src.width : Math.round(w), h == null ? src.height : Math.round(h)); };

  // ---------- 像素文字（阈值化，严格对齐像素格） ----------
  const tcache = new Map();
  const mctx = canvasOf(8, 8).getContext('2d');
  X.FONT = 'PixelZH';
  const BF = window.BITFONT;
  const bfHas = (str) => { if (!BF || !X.img.__bitfont) return false; for (const ch of str) if (!BF.g[ch]) return false; return true; };
  X.measure = function (str, size = 12) {
    str = String(str);
    if (bfHas(str)) { let w = 0; for (const ch of str) w += BF.g[ch][1]; return Math.round(w * size / 12); }
    mctx.font = size + 'px ' + X.FONT; return Math.ceil(mctx.measureText(str).width);
  };
  const tinted = new Map();
  function atlasOf(color) {
    let c = tinted.get(color); if (c) return c;
    const im = X.img.__bitfont; c = canvasOf(im.width, im.height); const x = c.getContext('2d');
    x.drawImage(im, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
    tinted.set(color, c); return c;
  }
  X.textImg = function (str, color = '#2b2620', size = 12) {
    str = String(str);
    const key = size + '|' + color + '|' + str;
    let c = tcache.get(key);
    if (c) return c;
    if (bfHas(str)) {
      const k = Math.max(1, Math.round(size / 12));
      const w = X.measure(str, 12);
      c = canvasOf(Math.max(1, w * k + 1), 14 * k);
      const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
      const at = atlasOf(color); let cx = 0;
      for (const ch of str) { const [i, adv] = BF.g[ch]; if (ch !== ' ') x.drawImage(at, (i % BF.cols) * 12, Math.floor(i / BF.cols) * 12, 12, 12, cx * k, 0, 12 * k, 12 * k); cx += adv; }
      if (tcache.size > 600) tcache.clear();
      tcache.set(key, c); return c;
    }
    const w = Math.max(1, X.measure(str, size));
    c = canvasOf(w + 1, size + 2);
    const x = c.getContext('2d');
    x.font = `${size}px ${X.FONT}`; x.textBaseline = 'top'; x.fillStyle = color;
    x.fillText(str, 0, 0);
    const id = x.getImageData(0, 0, c.width, c.height), d = id.data;
    const r = parseInt(color.slice(1, 3), 16), g = parseInt(color.slice(3, 5), 16), bb = parseInt(color.slice(5, 7), 16);
    for (let i = 0; i < d.length; i += 4) { if (d[i + 3] > 100) { d[i] = r; d[i + 1] = g; d[i + 2] = bb; d[i + 3] = 255; } else d[i + 3] = 0; }
    x.putImageData(id, 0, 0);
    if (tcache.size > 600) tcache.clear();
    tcache.set(key, c);
    return c;
  };
  X.text = function (str, x, y, color, align = 'left', size = 12) {
    const im = X.textImg(String(str), color || X.PAL.ink, size);
    let dx = x; if (align === 'center') dx = x - im.width / 2; else if (align === 'right') dx = x - im.width;
    b.drawImage(im, Math.round(dx), Math.round(y));
    return im.width;
  };
  X.wrap = function (str, maxW, size = 12) {
    const out = []; let line = '';
    for (const para of String(str).split('\n')) {
      line = '';
      for (const ch of para) {
        const t = line + ch;
        if (X.measure(t, size) > maxW && line) { out.push(line); line = /[，。、！？」』）…]/.test(ch) ? '' : ch; if (!line) { out[out.length - 1] += ch; } }
        else line = t;
      }
      out.push(line);
    }
    return out.filter((l, i) => l !== '' || i < out.length - 1);
  };

  // ---------- 对话气泡 ----------
  X.bubble = function (str, ax, ay, opts = {}) {
    const maxW = opts.maxW || 110;
    const lines = X.wrap(str, maxW);
    const tw = Math.max(...lines.map((l) => X.measure(l))) || 8;
    const w = tw + 8, h = lines.length * 13 + 5;
    let x = Math.round(ax - w / 2), y = Math.round(ay - h - 5);
    x = U.clamp(x, 2, W - w - 2); if (y < 2) y = 2;
    const fill = opts.fill || X.PAL.paper, border = opts.border || X.PAL.ink, col = opts.color || X.PAL.ink;
    X.rect(x + 2, y + 2, w, h, 'rgba(0,0,0,0.25)');
    X.box(x, y, w, h, fill, border);
    // 尾巴
    const tx = U.clamp(Math.round(ax), x + 4, x + w - 5);
    if (opts.tail !== false) {
      X.rect(tx - 2, y + h - 1, 5, 1, fill); X.rect(tx - 1, y + h, 3, 1, fill); X.px(tx, y + h + 1, fill);
      X.px(tx - 3, y + h - 1, border); X.px(tx + 3, y + h - 1, border); X.px(tx - 2, y + h, border); X.px(tx + 2, y + h, border); X.px(tx - 1, y + h + 1, border); X.px(tx + 1, y + h + 1, border); X.px(tx, y + h + 2, border);
    }
    lines.forEach((l, i) => X.text(l, x + 4, y + 3 + i * 13, col));
    return { x, y, w, h };
  };

  // ---------- 像素图标（7×7 为主） ----------
  const ICOL = { '#': '#2b2620', r: '#c0432c', R: '#8f2f22', w: '#f4f1e8', y: '#e2b84a', b: '#5c86b3', B: '#26324a', g: '#6f9a58', o: '#e48a3a', k: '#14161c', p: '#e8a6a0', c: '#cfe0ea', s: '#a9adb8', l: '#7fb2d6', m: '#9a6fb0' };
  X.ICONS = {
    lock: ['..##...', '.#..#..', '.#..#..', '######.', '##yy##.', '##yy##.', '######.'],
    zz: ['####...', '...#...', '..#....', '.#.....', '####...'],
    anger: ['r.r.r', '.r.r.', 'rr.rr', '.r.r.', 'r.r.r'],
    target: ['..rrr..', '.r...r.', 'r..r..r', 'r.rrr.r', 'r..r..r', '.r...r.', '..rrr..'],
    pause: ['bb.bb', 'bb.bb', 'bb.bb', 'bb.bb', 'bb.bb'],
    rew: ['...#..#', '..##.##', '.######', '#######', '.######', '..##.##', '...#..#'],
    ff: ['#..#...', '##.##..', '######.', '#######', '######.', '##.##..', '#..#...'],
    loop: ['.###.', '#...#', '#....', '#..#.', '.###.'],
    magnet: ['r...b', 'r...b', 'r...b', 'r...b', '.rbb.'],
    weight: ['..#..', '.###.', '#####', '#####', '#####'],
    eye: ['.###.', '#.#.#', '#####', '.###.'],
    clock: ['.###.', '#.#.#', '#.###', '#...#', '.###.'],
    bang: ['.r.', '.r.', '.r.', '...', '.r.'],
    ques: ['.##.', '#..#', '..#.', '....', '..#.'],
    note: ['..##', '..#.', '..#.', '###.', '##..'],
    drop: ['..l..', '.lll.', 'lllll', 'lllll', '.lll.'],
    copy: ['###..', '#.###', '###.#', '..#.#', '..###'],
    erase: ['..www', '.www#', 'www##', 'ww##.', '.##..'],
    ribbon: ['rr.rr', 'rrrrr', '.rrr.', '.r.r.', 'r...r'],
    cap: ['.BBB.', 'BBBBB', 'yyyyy', '.kkk.'],
    glass: ['.##..', '#..#.', '#..#.', '.###.', '...##'],
    ban: ['.rrr.', 'r..rr', 'r.r.r', 'rr..r', '.rrr.'],
    exit: ['ggggg', 'gwg.g', 'g#wwg', 'gw#.g', 'ggggg'],
    wave: ['#...', '.#..', '..#.', '.#..', '#...'],
    star: ['..y..', '.yyy.', 'yyyyy', '.y.y.'],
    tag: ['.####', '#yyyy', '#y.yy', '#yyyy', '.####'],
    heart: ['r.r', 'rrr', '.r.'],
    hic: ['.p.p.', 'pp.pp'],
    feet: ['#..#', '#..#', '....', '.#..#'],
    plus: ['.r.', 'rrr', '.r.'],
    sweat: ['.l', 'll', 'll'],
  };
  const icache = new Map();
  X.icon = function (name, scale = 1) {
    const key = name + scale; let c = icache.get(key); if (c) return c;
    const map = X.ICONS[name]; if (!map) return null;
    const w = Math.max(...map.map((r) => r.length)), h = map.length;
    c = canvasOf(w * scale, h * scale); const x = c.getContext('2d');
    map.forEach((row, j) => [...row].forEach((ch, i) => { if (ICOL[ch]) { x.fillStyle = ICOL[ch]; x.fillRect(i * scale, j * scale, scale, scale); } }));
    icache.set(key, c); return c;
  };
  X.drawIcon = function (name, x, y, scale = 1) { const c = X.icon(name, scale); if (c) b.drawImage(c, Math.round(x), Math.round(y)); return c ? c.width : 0; };
  // 供 DOM 使用的像素 SVG
  X.svgIcon = function (map, color = '#f4f1e8') {
    const w = Math.max(...map.map((r) => r.length)), h = map.length; let rects = '';
    map.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.' && ch !== ' ') rects += `<rect x="${i}" y="${j}" width="1" height="1" fill="${ch === '#' ? color : ICOL[ch] || color}"/>`; }));
    return `<svg viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
  };

  // ---------- 粒子 ----------
  const parts = (X.parts = []);
  X.emit = function (type, x, y, n = 1, opt = {}) {
    for (let i = 0; i < n; i++) {
      if (parts.length > 500) parts.shift();
      parts.push(Object.assign({ type, x, y, vx: U.rand(-1, 1) * (opt.spread ?? 20), vy: U.rand(-1, 0.2) * (opt.up ?? 30), life: opt.life ?? U.rand(0.5, 1.2), age: 0, c: opt.c || '#f4f1e8', g: opt.g ?? 60, room: opt.room || (G.game && G.game.room), txt: opt.txt, size: opt.size || 1 }, opt.fixed || {}));
    }
  };
  X.updateParts = function (dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.age += dt;
      if (p.age >= p.life) { parts.splice(i, 1); continue; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.type === 'z') { p.vx = Math.sin(p.age * 4) * 6; }
    }
  };
  X.drawParts = function (room) {
    for (const p of parts) {
      if (p.room && p.room !== room) continue;
      const k = 1 - p.age / p.life;
      if (p.type === 'z') { if (k > 0.15) X.text('z', p.x, p.y, '#e8e4d8', 'left', 12); }
      else if (p.type === 'txt') { if (k > 0.1) X.text(p.txt, p.x, p.y, p.c, 'center'); }
      else if (p.type === 'icon') { X.drawIcon(p.txt, p.x, p.y); }
      else if (p.type === 'paper') { X.rect(p.x, p.y, 2, 2, p.c); X.px(p.x + 1, p.y, '#2b2620'); }
      else if (p.type === 'smoke') { X.ellipse(p.x, p.y, 2 + (1 - k) * 4, 1 + (1 - k) * 3, p.c, true); }
      else { if (p.size > 1) X.rect(p.x, p.y, p.size, p.size, p.c); else X.px(p.x, p.y, p.c); }
    }
  };

  // ---------- 屏幕震动 ----------
  X.shakeT = 0; X.shakeA = 0;
  X.shake = function (a = 2, t = 0.3) { if (!G.settings.shake) return; X.shakeA = Math.max(X.shakeA, a); X.shakeT = Math.max(X.shakeT, t); };
})();
