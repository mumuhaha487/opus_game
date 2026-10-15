/* =========================================================
   core.js —— 全局命名空间、工具函数、事件总线、存档
   ========================================================= */
(function () {
  'use strict';
  const G = (window.G = {});
  G.W = 384; // 逻辑分辨率
  G.H = 256;
  G.LOOP = 300; // 一轮循环（秒）
  G.SCAN_EVERY = 60;
  G.DEBUG = /[?&]debug/.test(location.search);

  // ---------- 工具 ----------
  const U = (G.util = {
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    rand: (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a)),
    randi: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
    choice: (arr) => arr[Math.floor(Math.random() * arr.length)],
    sign: (v) => (v < 0 ? -1 : v > 0 ? 1 : 0),
    approach: (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t)),
    uid: (() => { let n = 0; return (p = 'u') => p + (++n).toString(36); })(),
    fmt: (s) => { if (!isFinite(s)) return '--:--'; s = Math.max(0, Math.floor(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); },
    clock: (s) => { const t = 24 * 60 + Math.floor(s); const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), x = t % 60; return `0:${String(Math.floor(t / 60) % 60).padStart(2, '0')}:${String(x).padStart(2, '0')}`; },
    esc: (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
    shuffle: (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
    dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
    hash: (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; },
    wait: (ms) => new Promise((r) => setTimeout(r, ms)),
    el: (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; },
  });
  // 时钟显示：游戏内时刻从 0:24:00 开始
  U.clock = (s) => { const total = 24 * 60 + Math.floor(s); const m = Math.floor(total / 60), x = total % 60; return `0:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`; };

  // ---------- 事件总线 ----------
  const handlers = {};
  G.bus = {
    on(ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); return () => G.bus.off(ev, fn); },
    off(ev, fn) { const a = handlers[ev]; if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } },
    emit(ev, ...args) { const a = handlers[ev]; if (a) for (const fn of a.slice()) { try { fn(...args); } catch (e) { console.error('bus', ev, e); } } },
  };

  // ---------- 本地存储（全部 try/catch，隐私模式下也能玩） ----------
  G.store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };

  // ---------- 设置 ----------
  const DEF = { sfx: 0.8, bgm: 0.5, voice: true, textSpeed: 2, shake: true, slowmo: true, autoHint: true };
  G.settings = Object.assign({}, DEF, G.store.get('wl_settings', {}));
  G.saveSettings = () => G.store.set('wl_settings', G.settings);

  // ---------- 全局持久数据（图鉴等，跨存档） ----------
  // 登录 / 退出账号时由 cloud.js 重新载入（账号与本机各有一份）
  G.loadMeta = () => { G.meta = Object.assign({ dex: {}, combos: {}, tagsSeen: {}, endings: {}, sandbox: false, solutions: {}, cleared: false }, G.store.get('wl_meta', {})); };
  G.loadMeta();
  G.saveMeta = () => G.store.set('wl_meta', G.meta);

  window.addEventListener('error', (e) => { if (G.DEBUG) console.error('ERR', e.message, e.filename, e.lineno); });
})();
