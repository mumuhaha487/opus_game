'use strict';
// =====================================================================
//  CORE — constants, math helpers, RNG, colors, input, save data
// =====================================================================
const W = 480, H = 270;          // world render resolution (pixel art)
const UW = 960, UH = 540;        // UI render resolution (2x world)
const TILE = 16;
const STEP = 1 / 60;
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const approach = (v, t, s) => (v < t ? Math.min(v + s, t) : Math.max(v - s, t));
const sign = v => (v < 0 ? -1 : v > 0 ? 1 : 0);
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const chance = p => Math.random() < p;
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const smooth = t => t * t * (3 - 2 * t);

const Ease = {
  linear: t => t,
  inQuad: t => t * t,
  outQuad: t => 1 - (1 - t) * (1 - t),
  inOutQuad: t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inCubic: t => t * t * t,
  outQuart: t => 1 - Math.pow(1 - t, 4),
  outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outElastic: t => (t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1),
  inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
};

// Deterministic RNG (mulberry32)
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
    range: (a, b) => a + next() * (b - a),
    int: (a, b) => Math.floor(a + next() * (b - a + 1)),
    pick: arr => arr[Math.floor(next() * arr.length)],
    chance: p => next() < p,
    shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; },
    weighted(list) { // [{w, v}]
      let tot = 0; for (const it of list) tot += it.w;
      let r = next() * tot;
      for (const it of list) { r -= it.w; if (r <= 0) return it.v; }
      return list[list.length - 1].v;
    },
  };
}
function hash2(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---------- colors ----------
const _rgbCache = new Map();
function hex2rgb(hex) {
  let c = _rgbCache.get(hex);
  if (c) return c;
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  _rgbCache.set(hex, c);
  return c;
}
function rgb2hex(r, g, b) {
  return '#' + ((1 << 24) | (clamp(Math.round(r), 0, 255) << 16) | (clamp(Math.round(g), 0, 255) << 8) | clamp(Math.round(b), 0, 255)).toString(16).slice(1);
}
function shade(hex, amt) { // amt -1..1 (negative darkens toward a cool dark, positive brightens)
  const [r, g, b] = hex2rgb(hex);
  if (amt < 0) { const k = 1 + amt; return rgb2hex(r * k + 12 * -amt, g * k + 6 * -amt, b * k + 28 * -amt); }
  return rgb2hex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
}
function mix(a, b, t) {
  const A = hex2rgb(a), B = hex2rgb(b);
  return rgb2hex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t));
}
function rgba(hex, a) { const [r, g, b] = hex2rgb(hex); return `rgba(${r},${g},${b},${a})`; }
function hueShift(hex, deg) {
  let [r, g, b] = hex2rgb(hex).map(v => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = (g - b) / d + (g < b ? 6 : 0); else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h /= 6;
  }
  h = (h + deg / 360 + 1) % 1;
  const f = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
  if (s === 0) return rgb2hex(l * 255, l * 255, l * 255);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  return rgb2hex(f(p, q, h + 1 / 3) * 255, f(p, q, h) * 255, f(p, q, h - 1 / 3) * 255);
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  return c;
}
function overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

// =====================================================================
//  INPUT — keyboard + gamepad + mouse, mapped to actions
// =====================================================================
const Input = (() => {
  const held = new Set();
  const pressed = new Set();
  const binds = {
    left: ['ArrowLeft', 'KeyA'],
    right: ['ArrowRight', 'KeyD'],
    up: ['ArrowUp', 'KeyW'],
    down: ['ArrowDown', 'KeyS'],
    jump: ['KeyK', 'Space', 'KeyZ'],
    attack: ['KeyJ', 'KeyX'],
    dash: ['KeyL', 'ShiftLeft', 'ShiftRight', 'KeyC'],
    skill: ['KeyU'],
    ult: ['KeyI', 'KeyO', 'KeyB', 'KeyV'],
    interact: ['KeyE', 'KeyF'],
    pause: ['Escape', 'KeyP'],
    ok: ['Enter', 'Space', 'KeyJ', 'KeyZ'],
    cancel: ['Escape', 'Backspace'],
    mleft: ['ArrowLeft', 'KeyA'], mright: ['ArrowRight', 'KeyD'], mup: ['ArrowUp', 'KeyW'], mdown: ['ArrowDown', 'KeyS'],
    tab: ['Tab'],
    alt: ['KeyR'],
  };
  // standard gamepad mapping
  const padBinds = {
    jump: [0], attack: [2], dash: [1, 5], skill: [4, 6], ult: [3, 7], interact: [12, 11], pause: [9],
    ok: [0], cancel: [1], up: [12], down: [13], left: [14], right: [15],
    mup: [12], mdown: [13], mleft: [14], mright: [15], tab: [8], alt: [3],
  };
  const padNow = new Set(), padPrev = new Set();
  let axes = [0, 0], axesPrev = [0, 0];
  const mouse = { x: 0, y: 0, down: false, clicked: false, moved: false, wheel: 0 };
  let lastDevice = 'kb';
  let anyPressed = false;
  const preventKeys = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Backspace']);
  let onFirstInput = null;

  window.addEventListener('keydown', e => {
    if (e.target && e.target.tagName === 'INPUT') return;
    if (preventKeys.has(e.code)) e.preventDefault();
    if (!e.repeat) { pressed.add(e.code); anyPressed = true; }
    held.add(e.code);
    lastDevice = 'kb';
    if (onFirstInput) onFirstInput();
  });
  window.addEventListener('keyup', e => { held.delete(e.code); });
  window.addEventListener('blur', () => { held.clear(); });
  window.addEventListener('mousedown', e => {
    mouse.down = true; mouse.clicked = true; mouse.button = e.button; anyPressed = true;
    if (onFirstInput) onFirstInput();
  });
  window.addEventListener('mouseup', () => { mouse.down = false; });
  window.addEventListener('wheel', e => { mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
  window.addEventListener('contextmenu', e => e.preventDefault());

  function setMouse(x, y) { if (Math.abs(x - mouse.x) + Math.abs(y - mouse.y) > 0.5) mouse.moved = true; mouse.x = x; mouse.y = y; }

  function pollPad() {
    padPrev.clear(); for (const b of padNow) padPrev.add(b);
    padNow.clear();
    axesPrev = axes;
    axes = [0, 0];
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (!gp || !gp.connected) continue;
      gp.buttons.forEach((b, i) => { if (b.pressed || b.value > 0.5) padNow.add(i); });
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      if (Math.abs(ax) > 0.3) axes[0] = ax;
      if (Math.abs(ay) > 0.3) axes[1] = ay;
      break;
    }
    if (padNow.size > padPrev.size || Math.abs(axes[0]) > 0.5 || Math.abs(axes[1]) > 0.5) {
      if (padNow.size || axes[0] || axes[1]) { lastDevice = 'pad'; if (onFirstInput) onFirstInput(); }
    }
    for (const b of padNow) if (!padPrev.has(b)) anyPressed = true;
  }
  function axisHeld(name) {
    if (name === 'left' || name === 'mleft') return axes[0] < -0.4;
    if (name === 'right' || name === 'mright') return axes[0] > 0.4;
    if (name === 'up' || name === 'mup') return axes[1] < -0.5;
    if (name === 'down' || name === 'mdown') return axes[1] > 0.5;
    return false;
  }
  function axisPressed(name) {
    if (name === 'left' || name === 'mleft') return axes[0] < -0.5 && !(axesPrev[0] < -0.5);
    if (name === 'right' || name === 'mright') return axes[0] > 0.5 && !(axesPrev[0] > 0.5);
    if (name === 'up' || name === 'mup') return axes[1] < -0.5 && !(axesPrev[1] < -0.5);
    if (name === 'down' || name === 'mdown') return axes[1] > 0.5 && !(axesPrev[1] > 0.5);
    return false;
  }
  function down(name) {
    const b = binds[name];
    if (b) for (const k of b) if (held.has(k)) return true;
    const pb = padBinds[name];
    if (pb) for (const k of pb) if (padNow.has(k)) return true;
    return axisHeld(name);
  }
  function hit(name) {
    const b = binds[name];
    if (b) for (const k of b) if (pressed.has(k)) return true;
    const pb = padBinds[name];
    if (pb) for (const k of pb) if (padNow.has(k) && !padPrev.has(k)) return true;
    return axisPressed(name);
  }
  function endStep() { pressed.clear(); mouse.clicked = false; mouse.wheel = 0; anyPressed = false; mouse.moved = false; }
  function axisX() { let v = 0; if (down('left')) v -= 1; if (down('right')) v += 1; return v; }
  function axisY() { let v = 0; if (down('up')) v -= 1; if (down('down')) v += 1; return v; }
  // virtual keys / taps from the touch layer
  function virt(code, isDown) {
    if (isDown) { if (!held.has(code)) { pressed.add(code); anyPressed = true; } held.add(code); }
    else held.delete(code);
    lastDevice = 'touch';
    if (isDown && onFirstInput) onFirstInput();
  }
  function tap(x, y) {
    setMouse(x, y); mouse.moved = true; mouse.down = true; mouse.clicked = true; anyPressed = true;
    lastDevice = 'touch';
    if (onFirstInput) onFirstInput();
  }
  function keyName(action) {
    if (lastDevice === 'touch') {
      const names = { jump: '跳跃键', attack: '攻击键', dash: '冲刺键', skill: '技能键', ult: '秘技键', interact: '互动键', pause: '暂停键', ok: '点按', cancel: '返回' };
      return names[action] || action;
    }
    if (lastDevice === 'pad') {
      const names = { jump: 'A', attack: 'X', dash: 'B', skill: 'LB', ult: 'Y', interact: '十字↑', pause: 'START', ok: 'A', cancel: 'B' };
      return names[action] || action;
    }
    const names = { jump: 'K', attack: 'J', dash: 'L', skill: 'U', ult: 'I', interact: 'E', pause: 'ESC', ok: 'ENTER', cancel: 'ESC' };
    return names[action] || action;
  }
  return {
    down, hit, endStep, pollPad, axisX, axisY, mouse, setMouse, keyName, virt, tap,
    get lastDevice() { return lastDevice; },
    get any() { return anyPressed; },
    set onFirstInput(f) { onFirstInput = f; },
    clear() { held.clear(); pressed.clear(); },
  };
})();

// =====================================================================
//  SAVE — localStorage persistence
// =====================================================================
const Save = {
  key: 'entropy_blade_save_v1',
  settingsKey: 'entropy_blade_settings_v1',
  backend: null,
  onWrite: null,
  data: null,
  defaults() {
    return {
      crystals: 0,
      talents: {},
      settings: { music: 0.55, sfx: 0.8, shake: 1, glow: 1, numbers: true, pixelPerfect: false, lighting: true },
      stats: { runs: 0, wins: 0, bestTime: 0, kills: 0, crystalsTotal: 0, bossKills: 0, deepest: 0, bestTrial: 0 },
      lastChar: 0,
      lastMode: 'normal',
      lastWeapon: {},
      heroBest: {},
      trialSel: {},
      titles: [],
      history: [],
      seenTutorial: false,
    };
  },
  normalize(s = {}) {
    if (!s || typeof s !== 'object' || Array.isArray(s)) s = {};
    const d = this.defaults();
    Object.assign(d, s);
    d.settings = Object.assign(this.defaults().settings, s.settings || {});
    d.stats = Object.assign(this.defaults().stats, s.stats || {});
    d.talents = s.talents || {};
    d.lastMode = d.lastMode === 'hard' ? 'hard' : 'normal';
    d.titles = Array.isArray(d.titles) ? [...new Set(d.titles.filter(t => typeof t === 'string'))] : [];
    d.history = Array.isArray(d.history) ? d.history : [];
    if (d.stats.bestTrial >= 40 && !d.titles.includes('劫主')) d.titles.push('劫主');
    return d;
  },
  load() {
    let s = {};
    try {
      const raw = localStorage.getItem(this.key);
      if (raw) s = JSON.parse(raw);
    } catch (e) { /* ignore corrupt saves */ }
    const d = this.normalize(s);
    try { const st = JSON.parse(localStorage.getItem(this.settingsKey)); if (st) Object.assign(d.settings, st); } catch (e) { /* storage unavailable */ }
    this.data = d;
  },
  write() {
    try { localStorage.setItem(this.settingsKey, JSON.stringify(this.data.settings)); } catch (e) { /* storage unavailable */ }
    try {
      if (this.backend) this.backend.write(this.data);
      else localStorage.setItem(this.key, JSON.stringify(this.data));
      if (this.onWrite) { try { this.onWrite(); } catch (e) { /* hook failed */ } }
    } catch (e) { /* storage unavailable */ }
  },
  reset() {
    const settings = this.data.settings;
    this.data = this.defaults();
    if (this.backend) { this.data.settings = settings; this.backend.reset(); }
    this.write();
  },
};
Save.load();
