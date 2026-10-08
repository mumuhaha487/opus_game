'use strict';
// =====================================================================
//  TOUCH — mobile controls. A floating joystick and icon buttons rendered
//  as pixel-art discs at the game's own pixel scale (they live in the
//  letterbox margins on wide phones), taps for menus, safe-area aware
//  layout, a landscape prompt and fullscreen on first touch.
// =====================================================================
const TouchUI = (() => {
  const T = { enabled: false, joy: null, btns: [], touches: new Map(), portrait: false, joyKeys: {}, unit: 4 };
  const has = 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;
  // d = disc diameter in game pixels
  const BTN_DEFS = [
    { id: 'attack', code: 'KeyJ', d: 34 },
    { id: 'jump', code: 'KeyK', d: 27 },
    { id: 'dash', code: 'KeyL', d: 27 },
    { id: 'ult', code: 'KeyI', d: 27 },
    { id: 'interact', code: 'KeyE', d: 23 },
    { id: 'pause', code: 'Escape', d: 21 },
  ];
  const ACCENT = { jump: '#7fe8c8', dash: '#7ff0ff', ult: '#5ad8ff', interact: '#ffd36a', pause: '#c8c0e0' };
  const dpr = () => Gfx.view.dpr || 1;
  const live = () => G.state === 'play' && !G.overlay && !G.trans && G.player && !G.player.dead;

  // ---------- safe-area insets (notches, rounded corners) ----------
  let probe = null;
  function insets() {
    if (!probe) {
      probe = document.createElement('div');
      probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
      document.body.appendChild(probe);
    }
    const s = getComputedStyle(probe), k = dpr();
    return { t: parseFloat(s.paddingTop) * k || 0, r: parseFloat(s.paddingRight) * k || 0, b: parseFloat(s.paddingBottom) * k || 0, l: parseFloat(s.paddingLeft) * k || 0 };
  }

  // ---------- pixel-art disc sprites (cached) ----------
  const discCache = {};
  function disc(d, accent, state) {
    const key = d + accent + state;
    if (discCache[key]) return discCache[key];
    const c = makeCanvas(d, d), x = c.getContext('2d');
    const img = x.createImageData(d, d), px = img.data, r = d / 2;
    const ac = hex2rgb(accent), lite = hex2rgb(mix(accent, '#ffffff', 0.55));
    const pressed = state === 'down', dim = state === 'dim';
    const put = (i, col, a) => { px[i] = col[0]; px[i + 1] = col[1]; px[i + 2] = col[2]; px[i + 3] = Math.round(a * 255); };
    for (let yy = 0; yy < d; yy++) for (let xx = 0; xx < d; xx++) {
      const dx = xx + 0.5 - r, dy = yy + 0.5 - r, dd = Math.hypot(dx, dy), i = (yy * d + xx) * 4;
      if (dd > r) continue;
      if (dd > r - 1) put(i, [10, 6, 18], 0.85);
      else if (dd > r - 2) put(i, dx + dy < -r * 0.5 ? lite : ac, dim ? 0.35 : pressed ? 1 : 0.85);
      else if (dd > r - 3) put(i, [10, 6, 18], 0.55);
      else if (dd > r - 4 && !dim) put(i, ac, pressed ? 0.45 : 0.16);
      else {
        // body: deep night fill, warmer toward the top-left like the UI panels
        const k = (dy + dx) / (2 * r);
        const base = pressed ? hex2rgb(mix('#0b0716', accent, 0.38)) : [11 + Math.round(-k * 8), 7 + Math.round(-k * 4), 22 + Math.round(-k * 10)];
        put(i, base, dim ? 0.32 : pressed ? 0.78 : 0.56);
      }
    }
    x.putImageData(img, 0, 0);
    if (!dim) {
      // four corner studs on the ring, a nod to lacquered tsuba fittings
      x.fillStyle = pressed ? '#ffffff' : mix(accent, '#ffffff', 0.35);
      for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2; x.fillRect(Math.round(r + Math.cos(a) * (r - 1.5) - 1), Math.round(r + Math.sin(a) * (r - 1.5) - 1), 2, 2); }
    }
    discCache[key] = c;
    return c;
  }
  // a pixel ring segment (mana / charge gauges)
  const arcCache = {};
  function arc(d, col, frac) {
    const steps = 24, f = Math.round(clamp(frac, 0, 1) * steps);
    const key = d + col + f;
    if (arcCache[key]) return arcCache[key];
    const c = makeCanvas(d + 4, d + 4), x = c.getContext('2d'), r = d / 2 + 1, cx = (d + 4) / 2;
    x.fillStyle = col;
    for (let s = 0; s < f; s++) {
      const a0 = -Math.PI / 2 + s / steps * Math.PI * 2;
      for (let t = 0; t < 4; t++) { const a = a0 + t / 4 * Math.PI * 2 / steps; x.fillRect(Math.round(cx + Math.cos(a) * r - 0.5), Math.round(cx + Math.sin(a) * r - 0.5), 1, 1); }
    }
    arcCache[key] = c;
    return c;
  }
  // tiny 5x5 badge glyphs for the 秘技 direction
  const BADGE = {
    stand: ['.....', '.###.', '.###.', '.###.', '.....'],
    move: ['..#..', '...#.', '#####', '...#.', '..#..'],
    up: ['..#..', '.###.', '#.#.#', '..#..', '..#..'],
    down: ['..#..', '..#..', '#.#.#', '.###.', '..#..'],
    air: ['#...#', '##.##', '.###.', '..#..', '.....'],
  };
  const badgeCache = {};
  function badge(slot) {
    if (badgeCache[slot]) return badgeCache[slot];
    const c = makeCanvas(9, 9), x = c.getContext('2d');
    x.fillStyle = '#0a0612'; x.fillRect(0, 0, 9, 9);
    x.fillStyle = '#5ad8ff'; x.fillRect(1, 1, 7, 7);
    x.fillStyle = '#0a0612'; x.fillRect(2, 2, 5, 5);
    x.fillStyle = '#ffffff';
    BADGE[slot].forEach((row, yy) => { for (let xx = 0; xx < 5; xx++) if (row[xx] === '#') x.fillRect(2 + xx, 2 + yy, 1, 1); });
    badgeCache[slot] = c;
    return c;
  }

  // ---------- layout ----------
  function layout() {
    const cv = Gfx.screen, w = cv.width, h = cv.height, S = Math.min(w, h), I = insets();
    T.unit = Math.max(2, Math.round(S * 0.22 / 34));
    const u = T.unit;
    const R = id => BTN_DEFS.find(b => b.id === id).d * u / 2;
    const right = w - I.r, bottom = h - I.b;
    const ax = right - R('attack') - S * 0.05, ay = bottom - R('attack') - S * 0.06;
    const pos = {
      attack: [ax, ay],
      jump: [ax - R('attack') - R('jump') - S * 0.035, ay + S * 0.035],
      dash: [ax + S * 0.01, ay - R('attack') - R('dash') - S * 0.035],
      ult: [ax - R('attack') - R('ult') - S * 0.01, ay - R('attack') - R('ult') + S * 0.02],
      interact: [ax - R('attack') * 2 - R('jump') * 2 - R('interact') * 0.2 - S * 0.04, ay - S * 0.11],
      pause: [right - R('pause') - S * 0.035, I.t + R('pause') + S * 0.035],
    };
    T.btns = BTN_DEFS.map(b => ({ ...b, x: pos[b.id][0], y: pos[b.id][1], r: b.d * u / 2 }));
    T.joyR = 28 * u; T.joyZone = Math.max(w * 0.45, I.l + S * 0.5); T.S = S; T.I = I;
    T.joyHome = [I.l + T.joyR + S * 0.08, bottom - T.joyR - S * 0.08];
  }
  function hitBtn(px, py) {
    let best = null, bd = Infinity;
    for (const b of T.btns) { const d = Math.hypot(px - b.x, py - b.y); if (d <= b.r * 1.22 && d < bd) { bd = d; best = b; } }
    return best;
  }
  function setJoy(dx, dy) {
    const R = T.joyR, dead = 0.3, nx = dx / R, ny = dy / R;
    const want = { ArrowLeft: nx < -dead, ArrowRight: nx > dead, ArrowUp: ny < -0.5, ArrowDown: ny > 0.5 };
    for (const k in want) if (want[k] !== !!T.joyKeys[k]) { T.joyKeys[k] = want[k]; Input.virt(k, want[k]); }
  }
  function releaseJoy() { for (const k in T.joyKeys) if (T.joyKeys[k]) { T.joyKeys[k] = false; Input.virt(k, false); } T.joy = null; }
  function devPos(t) { const r = Gfx.screen.getBoundingClientRect(); return [(t.clientX - r.left) * dpr(), (t.clientY - r.top) * dpr()]; }
  function uiPos(px, py) { const v = Gfx.view; return [(px - v.x) / v.w * UW, (py - v.y) / v.h * UH]; }
  const buzz = ms => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* unsupported */ } };

  let wentFull = false;
  function goFull() {
    if (wentFull) return; wentFull = true;
    try {
      const el = document.documentElement, req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req && !document.fullscreenElement) {
        const pr = req.call(el, { navigationUI: 'hide' });
        if (pr && pr.then) pr.then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* unsupported */ } }).catch(() => {});
      }
    } catch (e) { /* not allowed */ }
  }

  // ---------- events ----------
  function onStart(e) {
    if (!T.enabled) { T.enabled = true; document.body.classList.add('touch'); }
    e.preventDefault();
    layout();
    for (const t of e.changedTouches) {
      const [px, py] = devPos(t);
      if (live()) {
        const b = hitBtn(px, py);
        if (b) { T.touches.set(t.identifier, { kind: 'btn', b }); Input.virt(b.code, true); if (b.id === 'ult' || b.id === 'dash') buzz(8); continue; }
        if (px < T.joyZone && !T.joy) { T.joy = { id: t.identifier, x0: px, y0: py, x: px, y: py }; T.touches.set(t.identifier, { kind: 'joy' }); continue; }
      } else if (G.state === 'play' && !G.trans && !G.overlay) {
        const b = hitBtn(px, py);
        if (b && b.id === 'pause') { T.touches.set(t.identifier, { kind: 'btn', b }); Input.virt(b.code, true); continue; }
      }
      const [ux, uy] = uiPos(px, py);
      T.touches.set(t.identifier, { kind: 'tap' });
      Input.tap(ux, uy);
    }
  }
  function onMove(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const rec = T.touches.get(t.identifier);
      if (!rec) continue;
      const [px, py] = devPos(t);
      if (rec.kind === 'joy' && T.joy) {
        let dx = px - T.joy.x0, dy = py - T.joy.y0;
        const d = Math.hypot(dx, dy), R = T.joyR;
        // the base trails the thumb so the stick never "runs out"
        if (d > R * 1.25) { T.joy.x0 += dx * (1 - R * 1.25 / d); T.joy.y0 += dy * (1 - R * 1.25 / d); dx = px - T.joy.x0; dy = py - T.joy.y0; }
        T.joy.x = px; T.joy.y = py;
        setJoy(dx, dy);
      } else if (rec.kind === 'tap') {
        const [ux, uy] = uiPos(px, py);
        Input.setMouse(ux, uy);
      }
    }
  }
  function onEnd(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const rec = T.touches.get(t.identifier);
      T.touches.delete(t.identifier);
      if (!rec) continue;
      if (rec.kind === 'btn') Input.virt(rec.b.code, false);
      else if (rec.kind === 'joy') releaseJoy();
      else Input.mouse.down = false;
    }
    goFull();
  }
  if (has) {
    const opt = { passive: false };
    window.addEventListener('touchstart', onStart, opt);
    window.addEventListener('touchmove', onMove, opt);
    window.addEventListener('touchend', onEnd, opt);
    window.addEventListener('touchcancel', onEnd, opt);
    window.addEventListener('gesturestart', e => e.preventDefault());
  }
  // drop stuck inputs whenever play is interrupted (overlays, transitions, death)
  function sanitize() {
    if (live()) return;
    if (T.joy) releaseJoy();
    for (const [id, rec] of T.touches) if (rec.kind === 'btn' && rec.b.id !== 'pause') { Input.virt(rec.b.code, false); T.touches.delete(id); }
  }

  // ---------- drawing ----------
  function blit(ctx, img, cx, cy, scale) {
    const w = img.width * scale, h = img.height * scale;
    ctx.drawImage(img, Math.round(cx - w / 2), Math.round(cy - h / 2), w, h);
  }
  function attackIcon(p) { return p.heroId === 'eve' ? 'gun' : p.heroId === 'gao' ? 'fist' : 'sword'; }
  T.draw = function (ctx) {
    T.portrait = has && window.innerHeight > window.innerWidth * 1.05;
    if (!T.enabled) return;
    sanitize();
    if (!live()) return;
    layout();
    const u = T.unit, p = G.player, hc = p.hero.color;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    // joystick
    {
      const j = T.joy, base = disc(56, hc, j ? 'up' : 'dim');
      const [bx, by] = j ? [j.x0, j.y0] : T.joyHome;
      ctx.globalAlpha = j ? 1 : 0.7;
      blit(ctx, base, bx, by, u);
      // direction chevrons around the ring, lit when that direction is held
      const dirs = [['ArrowUp', 0, -1], ['ArrowRight', 1, 0], ['ArrowDown', 0, 1], ['ArrowLeft', -1, 0]];
      for (const [k, dx, dy] of dirs) {
        const on = T.joyKeys[k];
        ctx.fillStyle = on ? '#ffffff' : 'rgba(220,210,240,0.45)';
        const cx = bx + dx * 22 * u, cy = by + dy * 22 * u;
        for (let s = 0; s < 3; s++) {
          const off = (1 - s) * u;
          if (dx) ctx.fillRect(Math.round(cx + dx * off - u / 2), Math.round(cy - (s + 0.5) * u), u, (2 * s + 1) * u);
          else ctx.fillRect(Math.round(cx - (s + 0.5) * u), Math.round(cy + dy * off - u / 2), (2 * s + 1) * u, u);
        }
      }
      const kx = j ? clamp(j.x - j.x0, -T.joyR, T.joyR) : 0, ky = j ? clamp(j.y - j.y0, -T.joyR, T.joyR) : 0;
      const m = Math.hypot(kx, ky) > T.joyR ? T.joyR / Math.hypot(kx, ky) : 1;
      blit(ctx, disc(22, hc, j ? 'down' : 'up'), bx + kx * m, by + ky * m, u);
      ctx.globalAlpha = 1;
    }
    // buttons
    const near = G.near && G.near.prompt && G.near.prompt();
    const slot = p.secretSlot(), sec = p.secrets[slot], SK = sec && SKILLS[sec.id];
    const cost = SK ? skillCost(p, SK) : 0, manaOk = SK && p.mana >= cost;
    for (const b of T.btns) {
      const down = [...T.touches.values()].some(r => r.kind === 'btn' && r.b.id === b.id);
      const accent = b.id === 'attack' ? hc : ACCENT[b.id];
      let state = down ? 'down' : 'up';
      if ((b.id === 'interact' && !near) || (b.id === 'dash' && p.dashes <= 0) || (b.id === 'ult' && !manaOk)) state = down ? 'down' : 'dim';
      const sink = down ? u : 0;
      blit(ctx, disc(b.d, accent, state), b.x, b.y + sink, u);
      // icon
      let icon, col;
      if (b.id === 'attack') { icon = attackIcon(p); col = hc; }
      else if (b.id === 'ult') { icon = SK ? SK.icon : 'star'; col = SK && SK.ult ? hc : '#7fd8ff'; }
      else { icon = { jump: 'jump', dash: 'dash', interact: 'hand', pause: 'pause' }[b.id]; col = accent; }
      ctx.globalAlpha = state === 'dim' ? 0.45 : 1;
      blit(ctx, iconOf(icon, col), b.x, b.y + sink, b.id === 'attack' ? u * 1.25 : b.id === 'pause' ? Math.max(1, u * 0.75) : u);
      ctx.globalAlpha = 1;
      // live gauges
      if (b.id === 'ult' && SK) {
        blit(ctx, arc(b.d, manaOk ? '#bfe8ff' : '#3a8cff', manaOk ? 1 : p.mana / cost), b.x, b.y + sink, u);
        blit(ctx, badge(slot), b.x + b.r * 0.72, b.y - b.r * 0.72 + sink, u);
        if (manaOk && SK.ult) { ctx.globalAlpha = 0.25 + 0.2 * Math.sin(performance.now() / 160); blit(ctx, disc(b.d, hc, 'down'), b.x, b.y + sink, u); ctx.globalAlpha = 1; }
      }
      if (b.id === 'attack' && p.state === 'charge') {
        const can2 = p.tech.charge2 || p.stats.charge2;
        blit(ctx, arc(b.d, p.chargeLv === 2 ? '#ffffff' : hc, p.chargeT / (can2 ? CHARGE_L2 : CHARGE_L1)), b.x, b.y + sink, u);
      }
      if (b.id === 'dash') {
        const n = p.stats.dashes;
        for (let k = 0; k < n; k++) {
          const a = Math.PI / 2 + (k - (n - 1) / 2) * 0.32, rr = b.r + 3 * u;
          ctx.fillStyle = '#0a0612'; ctx.fillRect(Math.round(b.x + Math.cos(a) * rr - 1.5 * u), Math.round(b.y + Math.sin(a) * rr - 1.5 * u), 3 * u, 3 * u);
          ctx.fillStyle = k < p.dashes ? '#7ff0ff' : '#2a2244'; ctx.fillRect(Math.round(b.x + Math.cos(a) * rr - u), Math.round(b.y + Math.sin(a) * rr - u), 2 * u, 2 * u);
        }
      }
    }
    ctx.restore();
  };
  T.drawPortrait = function (ctx) {
    if (!T.portrait) return;
    const cv = Gfx.screen, w = cv.width, h = cv.height, S = Math.min(w, h), u = Math.max(2, Math.round(S / 120));
    ctx.save();
    ctx.fillStyle = 'rgba(5,2,12,0.9)'; ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;
    // a pixel phone tipping into landscape
    const a = (Math.sin(performance.now() / 600) * 0.5 + 0.5) * Math.PI / 2;
    ctx.translate(w / 2, h / 2 - S * 0.08); ctx.rotate(-a);
    ctx.fillStyle = '#ff8a9a'; ctx.fillRect(-7 * u, -12 * u, 14 * u, 24 * u);
    ctx.fillStyle = '#0b0716'; ctx.fillRect(-6 * u, -10 * u, 12 * u, 19 * u);
    ctx.fillStyle = '#ffd0d8'; ctx.fillRect(-2 * u, 10 * u, 4 * u, u);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    blit(ctx, iconOf('reroll', '#ff8a9a'), w / 2 + 16 * u, h / 2 - S * 0.08 - 12 * u, u);
    ctx.restore();
  };
  return T;
})();
