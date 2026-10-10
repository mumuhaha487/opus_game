'use strict';
// =====================================================================
//  CORE — constants, math, seeded RNG, palette, number formatting
//  (no DOM here: the simulation also runs headless for offline gains)
// =====================================================================
const STEP = 1 / 60;
const TAU = Math.PI * 2;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const approach = (v, t, s) => (v < t ? Math.min(v + s, t) : Math.max(v - s, t));
const smooth = t => t * t * (3 - 2 * t);
const Ease = {
  outQuad: t => 1 - (1 - t) * (1 - t),
  inQuad: t => t * t,
  outCubic: t => 1 - Math.pow(1 - t, 3),
  outBack: t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
};

// mulberry32: one stream per simulation so a headless copy never disturbs the live game
function RNG(seed) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    get seed() { return s; },
    range: (a, b) => a + next() * (b - a),
    int: (a, b) => Math.floor(a + next() * (b - a + 1)),
    pick: arr => arr[Math.floor(next() * arr.length)],
    chance: p => next() < p,
    weighted(weights) { // [w0, w1, ...] -> index
      let tot = 0; for (const w of weights) tot += w;
      let r = next() * tot;
      for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r < 0) return i; }
      return weights.length - 1;
    },
  };
}
// stable hash -> [0, 1)
function hash1(n, s = 0) {
  let h = (n * 374761393 + s * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ENDESGA 32 — the whole game draws from these 32 colors
const PAL = {
  rust: '#be4a2f', clay: '#d77643', cream: '#ead4aa', tan: '#e4a672', brown: '#b86f50', bark: '#733e39', soil: '#3e2731',
  wine: '#a22633', red: '#e43b44', orange: '#f77622', amber: '#feae34', yellow: '#fee761',
  green: '#63c74d', leaf: '#3e8948', moss: '#265c42', pine: '#193c3e',
  navy: '#124e89', blue: '#0099db', cyan: '#2ce8f5',
  white: '#ffffff', mist: '#c0cbdc', steel: '#8b9bb4', slate: '#5a6988', dusk: '#3a4466', night: '#262b44', ink: '#181425',
  hot: '#ff0044', plum: '#68386c', magenta: '#b55088', pink: '#f6757a', skin: '#e8b796', skin2: '#c28569',
};

// ---------- big numbers: 999 / 1.23K / 45.6M ... / 1.00aa ----------
const NUM_UNITS = ['', 'K', 'M', 'B', 'T'];
function numUnit(i) {
  if (i < NUM_UNITS.length) return NUM_UNITS[i];
  const k = i - NUM_UNITS.length;
  return String.fromCharCode(97 + Math.floor(k / 26) % 26) + String.fromCharCode(97 + k % 26);
}
function fmt(n) {
  if (!Number.isFinite(n)) return n > 0 ? 'MAX' : '0';
  if (n < 0) return '-' + fmt(-n);
  if (n < 1000) return n < 10 && n % 1 ? (Math.floor(n * 10) / 10).toString() : Math.floor(n).toString();
  const i = Math.min(Math.floor(Math.log10(n) / 3), 700);
  const v = n / Math.pow(1000, i);
  const s = v >= 100 ? Math.floor(v).toString() : v >= 10 ? (Math.floor(v * 10) / 10).toFixed(1) : (Math.floor(v * 100) / 100).toFixed(2);
  return s + numUnit(i);
}
const pct = (v, digits = 0) => (v * 100).toFixed(digits).replace(/\.0+$/, '') + '%';
function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60;
  if (h) return `${h}小时${m ? m + '分' : ''}`;
  if (m) return `${m}分${s ? s + '秒' : ''}`;
  return s + '秒';
}
const clock = sec => { sec = Math.max(0, Math.ceil(sec)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); };

// day key in China Standard Time (bounty board, tickets)
const dayKey = (t = Date.now()) => new Date(t + 8 * 3600e3).toISOString().slice(0, 10);

// tiny event hub between the simulation and its listeners (fx, audio, ui)
function Emitter() {
  const map = new Map();
  return {
    on(type, fn) { if (!map.has(type)) map.set(type, []); map.get(type).push(fn); },
    emit(type, a, b, c) { const list = map.get(type); if (list) for (const fn of list) fn(a, b, c); },
  };
}
