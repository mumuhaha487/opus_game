'use strict';
// =====================================================================
//  UI — immediate-mode widgets on the pixel canvas: buttons, toggles,
//  scroll areas (wheel + drag), clipping and tooltips
// =====================================================================
const UI = (() => {
  const I = { x: -1, y: -1, down: false, pressed: false, released: false, wheel: 0, startX: 0, startY: 0, moved: false, touch: false, keys: [] };
  let active = null, drag = null, tip = null, cursor = 'default', clips = [], ctx = null, t = 0;
  const scrolls = new Map();

  function begin(c, time) { ctx = c; t = time; tip = null; cursor = 'default'; clips.length = 0; }
  function end() {
    if (tip) drawTip();
    if (I.released) { active = null; drag = null; }
    I.pressed = false; I.released = false; I.wheel = 0; I.keys.length = 0;
    return cursor;
  }
  function clipOk() {
    for (const c of clips) if (I.x < c.x || I.y < c.y || I.x >= c.x + c.w || I.y >= c.y + c.h) return false;
    return true;
  }
  const over = (x, y, w, h) => I.x >= x && I.y >= y && I.x < x + w && I.y < y + h && clipOk();
  // returns { hover, down, click }
  function hit(id, x, y, w, h, o = {}) {
    const ov = over(x, y, w, h) && !o.disabled;
    if (ov && I.pressed) active = id;
    const click = ov && I.released && active === id && !I.moved;
    if (ov) cursor = 'pointer';
    return { hover: ov && (!I.touch || I.down), down: ov && I.down && active === id, click };
  }
  // a framed button with a text or icon label
  function button(id, x, y, w, h, label, o = {}) {
    const st = hit(id, x, y, w, h, o);
    Frame.button(ctx, x, y, w, h, { hover: st.hover, down: st.down, disabled: o.disabled, on: o.on }, o.kind);
    const dy = st.down ? 1 : 0;
    let tx = x + w / 2;
    if (o.icon) {
      const img = typeof o.icon === 'string' ? Spr.get(o.icon) : o.icon;
      const iw = img.width, lw = label ? Text.width(label, o.size || 12) + 3 : 0;
      const ix = Math.round(x + (w - iw - lw) / 2);
      ctx.globalAlpha = o.disabled ? 0.45 : 1;
      ctx.drawImage(img, ix, Math.round(y + (h - img.height) / 2) + dy);
      ctx.globalAlpha = 1;
      tx = ix + iw + 3 + lw / 2 - 1.5;
    }
    if (label) Text.draw(ctx, label, Math.round(tx), Math.round(y + (h - (o.size || 12)) / 2) + dy - (o.size === 8 ? 0 : 1), { align: 'center', size: o.size || 12, color: o.disabled ? PAL.slate : o.color || (o.kind === 'gold' ? PAL.soil : PAL.cream) });
    if (st.click) Sound.play(o.sound || 'click');
    if (o.tip && st.hover) setTip(o.tip);
    return st.click;
  }
  function toggle(id, x, y, w, h, label, on, o = {}) { return button(id, x, y, w, h, label, { ...o, on, kind: on ? (o.kindOn || 'blue') : o.kind }); }
  function checkbox(id, x, y, label, on, o = {}) {
    const w = 12 + Text.width(label, 12) + 4;
    const st = hit(id, x, y, w, 12);
    ctx.fillStyle = PAL.ink; ctx.fillRect(x, y + 1, 10, 10);
    ctx.fillStyle = st.hover ? PAL.dusk : PAL.night; ctx.fillRect(x + 1, y + 2, 8, 8);
    if (on) { ctx.fillStyle = o.color || PAL.green; ctx.fillRect(x + 2, y + 3, 6, 6); ctx.fillStyle = PAL.white; ctx.fillRect(x + 2, y + 3, 2, 1); }
    Text.draw(ctx, label, x + 13, y, { color: o.color && on ? o.color : PAL.cream });
    if (st.click) Sound.play('click');
    if (o.tip && st.hover) setTip(o.tip);
    return st.click;
  }
  // horizontal slider 0..1; returns the new value
  function slider(id, x, y, w, v) {
    const st = hit(id, x - 2, y - 3, w + 4, 11);
    if (active === id && I.down) v = clamp((I.x - x) / w, 0, 1);
    ctx.fillStyle = PAL.ink; ctx.fillRect(x, y + 1, w, 4);
    ctx.fillStyle = PAL.blue; ctx.fillRect(x + 1, y + 2, Math.round((w - 2) * v), 2);
    const kx = Math.round(x + v * (w - 1));
    Frame.button(ctx, kx - 3, y - 2, 7, 10, { hover: st.hover || active === id }, 'gold');
    return v;
  }
  // scroll area; draw content inside fn(offsetY). Returns nothing.
  function scroll(id, x, y, w, h, contentH, fn) {
    let s = scrolls.get(id); if (!s) { s = { y: 0, v: 0 }; scrolls.set(id, s); }
    const max = Math.max(0, contentH - h);
    const inside = over(x, y, w, h);
    if (inside && I.wheel) { s.y += I.wheel * 0.5; s.v = 0; }
    if (inside && I.pressed) drag = { id, y0: I.y, s0: s.y };
    if (drag && drag.id === id && I.down) { const d = drag.y0 - I.y; if (Math.abs(d) > 3) I.moved = true; if (I.moved) s.y = drag.s0 + d; }
    s.y = clamp(s.y, 0, max);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    clips.push({ x, y, w, h });
    fn(Math.round(s.y));
    clips.pop();
    ctx.restore();
    if (max > 0) {
      const bh = Math.max(10, Math.round(h * h / contentH)), by = y + Math.round((h - bh) * (s.y / max));
      ctx.fillStyle = rgba(PAL.ink, 0.6); ctx.fillRect(x + w - 3, y, 3, h);
      ctx.fillStyle = PAL.slate; ctx.fillRect(x + w - 3, by, 3, bh);
    }
  }
  // horizontal strip (swipe or wheel); fn(offsetX)
  function hscroll(id, x, y, w, h, contentW, fn) {
    let s = scrolls.get(id); if (!s) { s = { y: 0 }; scrolls.set(id, s); }
    const max = Math.max(0, contentW - w);
    const inside = over(x, y, w, h);
    if (inside && I.wheel) s.y += I.wheel * 0.5;
    if (inside && I.pressed) drag = { id, x0: I.x, s0: s.y };
    if (drag && drag.id === id && I.down && drag.x0 !== undefined) { const d = drag.x0 - I.x; if (Math.abs(d) > 4) I.moved = true; if (I.moved) s.y = drag.s0 + d; }
    s.y = clamp(s.y, 0, max);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    clips.push({ x, y, w, h });
    fn(Math.round(s.y));
    clips.pop();
    ctx.restore();
    if (max > 0) {
      const bw = Math.max(12, Math.round(w * w / contentW)), bx = x + Math.round((w - bw) * (s.y / max));
      ctx.fillStyle = rgba(PAL.ink, 0.6); ctx.fillRect(x, y + h - 2, w, 2);
      ctx.fillStyle = PAL.slate; ctx.fillRect(bx, y + h - 2, bw, 2);
    }
  }
  function resetScroll(id) { scrolls.delete(id); }
  function setTip(content) { tip = content; }
  // tooltip: array of lines [{text, color}] or a function(ctx, x, y) with .w/.h
  function drawTip() {
    let w, h, lines = null;
    if (typeof tip === 'function') { w = tip.w; h = tip.h; }
    else {
      lines = (Array.isArray(tip) ? tip : [tip]).map(l => (typeof l === 'string' ? { text: l } : l));
      const wrapped = [];
      for (const l of lines) for (const s of Text.wrap(l.text, l.wrap || 220, 12)) wrapped.push({ ...l, text: s });
      lines = wrapped;
      w = Math.max(...lines.map(l => Text.width(l.text, 12))) + 12; h = lines.length * 14 + 6;
    }
    const W = ctx.canvas.width, H = ctx.canvas.height;
    let x = I.x + 10, y = I.y + 10;
    if (x + w > W - 2) x = I.x - w - 6;
    if (y + h > H - 2) y = H - h - 2;
    x = Math.max(2, x); y = Math.max(2, y);
    Frame.panel(ctx, x, y, w, h, { fill: PAL.ink, edge: PAL.slate, hi: PAL.dusk });
    if (lines) lines.forEach((l, i) => Text.draw(ctx, l.text, x + 6, y + 4 + i * 14, { color: l.color || PAL.cream }));
    else tip(ctx, x, y);
  }
  // pointer plumbing (coordinates already mapped to logical pixels)
  function pointer(type, x, y, touch) {
    I.x = x; I.y = y; I.touch = touch;
    if (type === 'down') { I.down = true; I.pressed = true; I.startX = x; I.startY = y; I.moved = false; }
    else if (type === 'up') { I.down = false; I.released = true; if (touch) setTimeout(() => { if (!I.down) { I.x = -1; I.y = -1; } }, 0); }
    else if (type === 'move' && I.down && (Math.abs(x - I.startX) > 4 || Math.abs(y - I.startY) > 4) && drag) I.moved = true;
  }
  function wheel(d) { I.wheel += d; }
  return { I, begin, end, hit, button, toggle, checkbox, slider, scroll, hscroll, resetScroll, setTip, over, pointer, wheel, get ctx() { return ctx; } };
})();
