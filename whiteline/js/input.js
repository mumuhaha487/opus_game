/* =========================================================
   input.js —— 触屏/鼠标/键盘输入
   轻触对象＝选中（再点一次＝走过去）；轻触空地＝走过去；拿着词条时轻触对象＝贴上
   ========================================================= */
(function () {
  'use strict';
  const U = G.util, X = G.gfx;
  const I = (G.input = {});
  let down = null;

  // 命中测试：从最上层往下找；小物件给足点击余量
  I.hit = function (x, y) {
    const g = G.game;
    const list = g.inRoom(g.room).filter((e) => e.kind !== 'wire');
    const order = (e) => (e.kind === 'env' ? 0 : e.kind === 'fixture' ? 1 : e.kind === 'door' ? 2 : e.kind === 'loose' ? 9 : e.support === 'rack' || e.support === 'hook' ? 3 : e.kind === 'char' && e.pose === 'sit' ? 4 : e.kind === 'char' ? 5 + e.y / 1000 : e.support === 'air' ? 8 : 6 + e.y / 1000);
    list.sort((a, b) => order(b) - order(a));
    let best = null, bestScore = 1e9;
    for (const e of list) {
      const bb = e.bbox();
      const minW = 16, minH = 16;
      let x0 = bb.x, y0 = bb.y, w = bb.w, h = bb.h;
      if (w < minW) { x0 -= (minW - w) / 2; w = minW; }
      if (h < minH) { y0 -= (minH - h) / 2; h = minH; }
      if (x >= x0 && x <= x0 + w && y >= y0 && y <= y0 + h) {
        // 小东西、前景优先：分数＝面积 × 层级权重
        const area = bb.w * bb.h;
        const score = area / (1 + order(e) * 0.6) + (e.kind === 'fixture' && area > 2000 ? 4000 : 0) + (e.kind === 'door' ? 2500 : 0);
        if (score < bestScore) { bestScore = score; best = e; }
      }
    }
    return best;
  };

  I.init = function () {
    const cv = document.getElementById('cv');
    cv.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      G.audio.init();
      down = { x: ev.clientX, y: ev.clientY, t: performance.now(), id: ev.pointerId };
    });
    cv.addEventListener('pointermove', (ev) => {
      const g = G.game;
      if (ev.pointerType === 'mouse' && !G.ui.dragging) { const p = X.toLogic(ev.clientX, ev.clientY); const h = I.hit(p.x, p.y); g.hover = h ? h.id : null; cv.style.cursor = h ? 'pointer' : 'default'; }
    });
    cv.addEventListener('pointerleave', () => { G.game.hover = null; });
    cv.addEventListener('pointerup', (ev) => {
      if (!down) return;
      const moved = Math.hypot(ev.clientX - down.x, ev.clientY - down.y);
      down = null;
      if (moved > 14) return;
      I.tap(ev.clientX, ev.clientY);
    });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('contextmenu', (e) => { if (e.target.closest('#app')) e.preventDefault(); });
    window.addEventListener('keydown', I.key);
    window.addEventListener('keyup', (ev) => { const k = ev.key.toLowerCase(); if (['arrowleft', 'arrowright', 'a', 'd'].includes(k)) { G.game.keyDir = 0; } });
    // 阻止 iOS 双击缩放
    // 双击缩放由 CSS 的 touch-action: manipulation 阻止，这里不再拦截 touchend（否则会吞掉快速连点）
  };

  I.tap = function (cx, cy) {
    const g = G.game;
    if (!g.running) return;
    if (G.dlg.isOpen()) { G.dlg.advance(); return; }
    if (g.cinematic || g.resetting) return;
    const p = X.toLogic(cx, cy);
    const e = I.hit(p.x, p.y);
    const c = G.clip;
    if (c.sel >= 0 && c.slots[c.sel]) {
      if (e) { G.tags.paste(c.sel, e); return; }
      c.sel = -1; G.ui.renderClip(); return;
    }
    const pl = g.player();
    if (e) {
      if (g.sel === e.id && pl && e !== pl) {
        // 再点一次：走过去
        const tx = e.kind === 'char' || e.kind === 'item' || e.kind === 'loose' ? e.x : e.x + e.w / 2;
        if (e.kind === 'door' && e.exit) g.moveTarget = { x: e.exit === 'left' ? 0 : 400 };
        else g.moveTarget = { x: U.clamp(tx + (pl.x < tx ? -14 : 14), 0, 400) };
        return;
      }
      if (e.kind === 'loose' && (g.act >= 2 || g.sandbox)) { G.tags.cut(e, e.tags[0]); return; }
      G.ui.select(e);
      return;
    }
    // 空地：走过去（点在座位上则坐下）
    if (g.sel) G.ui.select(null);
    if (!pl || g.voidMode) return;
    const seats = G.SEATS[pl.room] || [];
    const R = G.ROOMS[pl.room];
    if (!R) return;
    const onSeat = p.y > R.sitY - 40 && p.y < R.sitY + 4 && seats.find((s) => Math.abs(s - p.x) < 10 && G.brains.seatFree(pl.room, s, pl));
    g.moveTarget = onSeat != null && onSeat !== undefined ? { x: onSeat, sit: true } : { x: p.x };
    X.emit('dot', p.x, Math.max(p.y, R.walkY - 2), 4, { c: '#f0a83a', up: 10, g: 20, life: 0.4, spread: 8 });
  };

  I.key = function (ev) {
    const g = G.game;
    if (!g || !g.running) return;
    const k = ev.key.toLowerCase();
    if (G.ui.modalOpen) { if (k === 'escape') G.ui.closeTop(); return; }
    if (G.dlg.isOpen()) { if ([' ', 'enter', 'z', 'e'].includes(k)) { ev.preventDefault(); G.dlg.advance(); } return; }
    if (k === 'arrowleft' || k === 'a') { g.keyDir = -1; g.moveTarget = null; ev.preventDefault(); }
    else if (k === 'arrowright' || k === 'd') { g.keyDir = 1; g.moveTarget = null; ev.preventDefault(); }
    else if (k === ' ') { ev.preventDefault(); G.ui.togglePause(); }
    else if (k === 'f') G.ui.toggleFF();
    else if (k === 'escape') { if (G.clip.sel >= 0) { G.clip.sel = -1; G.ui.renderClip(); } else if (g.sel) G.ui.select(null); else G.ui.openMenu(); }
    else if (k === 'tab') {
      ev.preventDefault();
      const list = g.inRoom(g.room).filter((e) => e.kind !== 'wire');
      if (!list.length) return;
      const i = list.findIndex((e) => e.id === g.sel);
      G.ui.select(list[(i + (ev.shiftKey ? -1 : 1) + list.length) % list.length]);
    }
    else if (k === 'x' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); const e = g.get(g.sel); if (e) { const inst = e.tags.find((i) => G.tags.canCut(e, i).ok); if (inst) G.tags.cut(e, inst); else G.ui.toast('没有能剪下的词条。', 'small'); } }
    else if (k === 'v' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); const e = g.get(g.sel); const s = G.clip.sel >= 0 ? G.clip.sel : 0; if (e && G.clip.slots[s]) G.tags.paste(s, e); else if (g.voidMode && G.story.done.a1_void) G.story.pasteBack(); }
    else if (/^[1-7]$/.test(k)) { const i = +k - 1; if (G.clip.slots[i]) G.ui.clickSlot(i); }
    else if (k === 'e') { const e = g.get(g.sel); if (e) G.ui.inspect(e); }
    else if (k === 't') G.ui.openScript();
    else if (k === 'h') G.story.hint();
    else if (k === 'q') G.ui.swapChar();
    else if (k === 'v' && !ev.ctrlKey) { g.eye = !g.eye; document.getElementById('btn-eye').classList.toggle('on', g.eye); }
  };
})();
