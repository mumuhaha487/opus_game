/* =========================================================
   game.js —— 主循环、世界构建、房间切换、循环重置、渲染
   ========================================================= */
(function () {
  'use strict';
  const U = G.util, X = G.gfx;
  const g = (G.game = {
    act: 1, loopNo: 4096, fails: 4095, t: 0, clock: 0, realClock: 0, room: 'car04', ctrlId: 'nana',
    ents: [], byId: {}, specs: {}, canonIds: [], timers: [], bubbles: [], deleted: [], voidHoles: [], floodRooms: {},
    eye: false, sel: null, hover: null, moveTarget: null, keyDir: 0, sway: 0, tilt: 0, memory: 0, memCrash: false,
    bombDelay: 0, bombBoost: 0, alert: 0, paused: false, ff: false, dlgOpen: false, cinematic: false, running: false,
    bombDone: null, lcdColor: null, redact: 0, sandbox: false,
  });

  // ---------- 实体管理 ----------
  g.add = function (e) { if (!e.u0) e.u0 = Math.random() * 6.28; g.ents.push(e); g.byId[e.id] = e; return e; };
  g.remove = function (e) { const i = g.ents.indexOf(e); if (i >= 0) g.ents.splice(i, 1); if (g.byId[e.id] === e) delete g.byId[e.id]; if (g.sel === e.id) g.sel = null; };
  g.get = (id) => g.byId[id];
  g.reindex = function () { g.byId = {}; for (const e of g.ents) g.byId[e.id] = e; };
  g.inRoom = (room) => g.ents.filter((e) => e.alive && e.room === room);
  g.player = () => g.get(g.ctrlId) || g.get('nana');
  g.specOf = (id) => g.specs[id];
  g.bombEnt = () => g.ents.find((e) => e.alive && e.has('bomb') && e.kind !== 'wire') || null;
  g.moveRoom = function (e, room, x) {
    const prev = e.room;
    e.room = room;
    if (x != null) e.x = x;
    if (e.kind === 'char') { e.pose = e.pose === 'sit' ? 'stand' : e.pose; if (e.support !== 'air') e.y = G.ROOMS[room] ? G.ROOMS[room].walkY : e.y; }
    if (e.kind === 'item' && e.support !== 'air' && e.support !== 'held') { e.y = G.itemFloorY(room); e.support = 'floor'; }
    e.hist = [];
    if (e.id === g.ctrlId && room !== 'bombui' && prev !== room && G.ROOMS[room]) { g.room = room; g.sel = null; g.moveTarget = null; g.roomFlash = 0.2; }
    if (prev !== room) G.bus.emit('roomEnter', e, room, prev);
  };
  g.changeRoom = function (e, room, x) {
    g.moveRoom(e, room, x);
    e.face = x < 192 ? 1 : -1;
    if (e.id === g.ctrlId) { g.room = room; g.sel = null; G.ui.refresh(); G.audio.sfx('door'); g.roomFlash = 0.25; }
  };

  // ---------- 构建世界 ----------
  g.buildWorld = function () {
    const S = { act: g.act, flags: G.story.flags };
    const specs = [].concat(G.WORLD.car04(S), G.WORLD.crew(S), g.act >= 2 ? G.WORLD.car03(S) : []);
    // 栞（被解救后）
    if (G.story.flags.shioriFree) specs.push({ id: 'shiori', kind: 'char', char: 'shiori', room: 'car04', x: 156, pose: 'stand', face: -1, brain: 'shiori', tags: ['passenger', 'bookmark'], desc: '栞。醒着的 NPC_02。她的书签让她记得每一次重来。' });
    g.ents = []; g.byId = {}; g.specs = {}; g.canonIds = [];
    for (const sp of specs) { g.specs[sp.id] = sp; const e = new G.Ent(sp); g.add(e); if (e.kind !== 'env') g.canonIds.push(e.id); }
    G.bomb.mkWires();
    // 书签恢复
    const bm = g.bookmarkSnap || {};
    for (const id in bm) {
      const s = bm[id]; const e = g.get(id);
      if (!e) continue;
      e.tags = s.tags.map((t) => Object.assign(G.mkInst(t.t, t.o, t.lock), {}));
      e.room = s.room; e.x = s.x; e.y = s.y; e.pose = s.pose; e.support = s.support;
    }
    g.bookmarkSnap = null;
    g.building = true;
    for (const e of g.ents) G.tags.changed(e);
    g.building = false;
    g.deleted = []; g.voidHoles = []; g.floodRooms = {}; g.memory = 0; g.bombDelay = 0; g.bombBoost = 0; g.bombDone = null; g.timers = [];
    g.alert = 0; g.tilt = 0; g.sel = null; g.ctrlId = g.ctrlId === 'shiori' && g.get('shiori') ? 'shiori' : 'nana';
    G.story.resetLoopState();
    G.ui.refresh();
  };
  g.respawn = function (id) {
    const sp = g.specs[id]; if (!sp) return null;
    const S = { act: g.act, flags: G.story.flags };
    if (id === 'shiori' && G.story.flags.shioriFree) return null;
    const e = new G.Ent(sp); g.add(e); G.tags.changed(e);
    return e;
  };

  // ---------- 炸弹计时 ----------
  g.explodeAt = () => (g.sandbox ? Infinity : G.LOOP + g.bombDelay);
  g.inDelayWindow = () => g.t >= 150 && g.t < 210;
  g.bombSecs = function () { return Math.max(0, g.explodeAt() - g.t); };
  g.lcdText = function () {
    const l = g.get('lcd');
    if (g.act >= 4) return g.collapse && g.collapse.on ? '破棄中…… 破棄中……' : '次は 出口 · でぐち';
    const fast = l && l.has('fast') ? '快速' : '各停';
    const exit = l && l.has('exit') ? '出口行' : '行先不明';
    if (g.ents.some((o) => o.alive && o.f.emergency && !['ebutton', 'ebutton03'].includes(o.id))) { g.lcdColor = '#ff6a4a'; return '非常停止信号 受信中'; }
    g.lcdColor = null;
    if (g.floodRooms.car04) return '故障中';
    if (l && l.has('delay')) return '遅延5分 · 次は 出口';
    if (g.t < 75) return `${fast} ${exit} · 次は 仮置`;
    if (g.t < 150) return `${fast} ${exit} · 次は 検収`;
    if (g.t < 225) return `${fast} ${exit} · 次は 出口`;
    return 'まもなく 出口';
  };

  // ---------- 警戒度 ----------
  g.alertUp = function (why) {
    if (g.act < 2) return;
    g.alert++;
    G.audio.sfx('alert');
    G.ui.stampAlert(g.alert, why);
    if (g.alert >= 3) { G.R.after(1.2, () => g.resetLoop('forced')); }
  };

  // ---------- 爆炸 & 循环重置 ----------
  g.explode = function (why) {
    if (g.exploding) return;
    g.exploding = true;
    const host = g.bombEnt();
    const fizzle = host && host.mods.fizzle;
    const inClip = !host && G.clip.slots.some((i) => i.t === 'bomb');
    if (fizzle) { G.audio.sfx('pop'); X.emit('smoke', host.cx(), host.top(), 12, { c: '#cfc8b8', up: 20, g: -10, life: 1.5 }); G.ui.banner('噗。（炸弹没有炸——但系统还是照常重置了）', '', 2.5); }
    else {
      G.audio.sfx('boom'); X.shake(6, 1.0);
      if (inClip) G.ui.banner('剪贴板里的【炸弹】爆炸了！', 'red', 2.5);
      g.flash = 1;
    }
    if (G.game.act === 1 && why !== 'wrong') g.fails++;
    if (why === 'wrong') g.fails++;
    setTimeout(() => { g.exploding = false; g.resetLoop('boom'); }, fizzle ? 1600 : 1300);
  };
  g.resetLoop = async function (reason, toAct) {
    if (g.resetting) return;
    g.resetting = true;
    G.ui.closeAll && G.ui.closeAll();
    G.dlg.flush();
    g.cinematic = false; g.climaxScan = null; g.redact = 0; g.moveTarget = null; g.keyDir = 0;
    if (!toAct && G.story.flags.pendingAct) toAct = G.story.flags.pendingAct;
    G.story.flags.pendingAct = null;
    // 书签：记录被夹住的对象
    const snap = {};
    for (const e of g.ents) if (e.alive && e.has('bookmark') && e.kind !== 'wire' && e.id !== 'nana') snap[e.id] = { tags: e.tags.map((i) => ({ t: i.t, o: i.o, lock: i.lock })), room: e.room, x: e.x, y: e.y, pose: e.pose, support: e.support };
    g.bookmarkSnap = snap;
    g.loopNo++;
    if (reason === 'boom' || reason === 'forced' || reason === 'deleted' || reason === 'erased' || reason === 'boss' || reason === 'collapse') g.fails = Math.max(g.fails, g.loopNo - 1);
    const sub = { boom: '爆炸。全员重置。', forced: '警戒度已满：强制重置。', deleted: '越权者已被删除。', erased: '删除完成。', act: '……', boss: '白线修正了一切。', collapse: '环境已破棄……然后被重新生成。', manual: '你选择了重来。' }[reason] || '';
    await G.cs.card(sub, `第${g.loopNo}稿`, g.act >= 2 ? `剪贴板保留了 ${G.clip.slots.length} 个词条` : '', 1.8);
    g.resetting = false;
    if (toAct) { await G.story.startAct(toAct); return; }
    if (g.act === 4) { await G.story.act4Begin({ quick: true }); G.boss.on = false; G.boss.dead = false; return; }
    g.buildWorld(); g.t = 0; G.scan.reset(); g.room = g.player() && G.ROOMS[g.player().room] ? g.player().room : 'car04';
    if (g.sandbox) g.bombDelay = 1e6;
    if (g.act === 3 && G.story.flags.security) { G.story.spawnInspectors(); G.scan.setInterval(45); }
    if (g.act === 1 && G.story.flags.bookletRead) G.R.after(1, () => G.ui.toast(['台本的页边上，多了一行铅笔字：「列车往哪个方向开？」', '页边的铅笔字：「颜色……要看车站的颜色。」', '页边的铅笔字：「黄、蓝、红。」'][Math.min(2, Math.max(0, g.fails - 4096))]));
    G.audio.ambient(true, 0.7);
    if (!g.sandbox) G.story.save();
  };

  // ---------- 主循环 ----------
  let last = 0, acc = 0;
  const STEP = 1 / 60;
  g.start = function () { if (g.running) return; g.running = true; last = performance.now(); requestAnimationFrame(frame); };
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = Math.min(0.1, (now - last) / 1000); last = now;
    g.realClock += dt;
    if (document.hidden) return;
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 6) { update(STEP); acc -= STEP; steps++; }
    if (steps >= 6) acc = 0;
    render();
  }
  g.timeScale = function () {
    if (g.paused || g.dlgOpen || g.resetting || G.ui.modalOpen) return 0;
    if (g.cinematic) return 1;
    let s = g.ff ? 4 : 1;
    if (G.settings.slowmo && g.sel && !g.ff && g.act >= 2 && !g.voidMode) s *= 0.5;
    return s;
  };
  function update(dt) {
    X.updateParts(dt);
    if (X.shakeT > 0) { X.shakeT -= dt; if (X.shakeT <= 0) X.shakeA = 0; }
    const ts = g.timeScale();
    G.ui.tickToasts(dt);
    if (g.roomFlash > 0) g.roomFlash -= dt;
    if (ts === 0) return;
    const sdt = dt * ts;
    g.clock += sdt;
    if (!g.voidMode && g.room !== 'dawn') {
      g.t += sdt;
      g.sway = Math.sin(g.clock * 0.7) * 0.6 + Math.sin(g.clock * 2.3) * 0.15;
      // 千斤：倾斜
      const tiltSrc = g.ents.find((e) => e.alive && e.mods.tiltSource && e.room === g.room);
      g.tilt = U.approach(g.tilt, tiltSrc ? U.sign(tiltSrc.x - 192) * 1.2 : 0, sdt * 0.8);
      // 轨缝的“咣当、咣当”：声音与画面的轻微颠簸同步
      g.clackT = (g.clackT == null ? 1 : g.clackT) - sdt;
      if (g.clackT <= 0 && !(g.act >= 4 && g.collapse && !g.collapse.on)) { g.clackT = 1.55 + Math.random() * 0.25; g.bumps = [g.clock, g.clock + 0.17]; G.audio.clack(); }
    }
    // 定时器
    for (let i = g.timers.length - 1; i >= 0; i--) { const tm = g.timers[i]; if (g.clock >= tm.at) { g.timers.splice(i, 1); if (tm.loop === g.loopNo || tm.loop == null) { try { tm.fn(); } catch (e) { console.error(e); } } } }
    // 实体
    for (const e of g.ents.slice()) {
      if (e.kind === 'loose') { looseUpdate(e, sdt); continue; }
      if (e.kind === 'wire' || e.kind === 'ui' || e.room === 'roof' || e.room === 'underfloor') continue;
      try {
        if (e.st.csTarget) G.brains.goTo(e, e.st.csTarget.room, e.st.csTarget.x, sdt);
        else if (e.st.fleeT > 0 && e.kind === 'char') { e.st.fleeT -= sdt; G.brains.step(e, e.st.fleeX, sdt * 1.5); }
        else G.updateEnt(e, sdt);
        G.trackWalk(e);
      } catch (err) { console.error('update', e.id, err); e.st = { stime: g.t }; }
    }
    // 炸弹计时
    if (!g.voidMode && g.act <= 3 && g.room !== 'dawn' && !g.cinematic) {
      const host = g.bombEnt();
      let rate = 0;
      if (host) { rate = host.mods.timerDir != null ? host.mods.timerDir : 1; if (host.mods.timerLoop) rate = 0; if (host.mods.timerWobble) rate = 1 + Math.sin(g.clock * 3) * 0.8; }
      g.bombDelay += sdt * (1 - rate); // 停摆/倒流 → 爆炸时间推后；加速 → 提前
      g.bombDelay -= g.bombBoost; g.bombBoost = 0;
      // 台本用尽后强制重置（最长 7 分钟）
      if (g.bombDone !== 'defused' && g.t >= g.explodeAt()) g.explode('time');
      else if (g.t >= 420 && !g.exploding && !g.sandbox) { G.ui.banner('台本已经用尽——系统强制重置。', 'red', 2); g.explode('script'); }
      if (host && host.room === g.room && Math.floor(g.t * 2) !== Math.floor((g.t - sdt) * 2) && g.bombSecs() < 60 && !g.bombDone) G.audio.sfx('tick');
    }
    G.scan.update(sdt);
    G.story.tick(sdt);
    if (g.climaxScan) { g.climaxScan.x = Math.min(g.climaxScan.target.x, g.climaxScan.x + 40 * sdt); }
    if (g.redact > 0) g.redact = Math.min(1, g.redact + sdt * 0.6);
    // 黎明：跨过白线
    if (g.room === 'dawn' && g.whiteLineX) { const p = g.player(); if (p && p.x >= g.whiteLineX && !G.story.flags.ended) G.story.ending(); }
  }
  function looseUpdate(e, dt) {
    const fl = G.itemFloorY(e.room);
    if (e.y < fl) { e.vy += 400 * dt; e.y = Math.min(fl, e.y + e.vy * dt); } else { e.y = fl; e.vy = 0; }
  }

  // ---------- 渲染 ----------
  function render() {
    const b = X.b;
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.fillStyle = '#0d0f14'; b.fillRect(0, 0, G.W, G.H);
    let sx = 0, sy = 0;
    if (G.settings.shake && g.bumps && ['car04', 'car03', 'crew'].includes(g.room) && g.bumps.some((t) => g.clock >= t && g.clock < t + 0.07)) sy += 1;
    if (X.shakeA > 0) { sx = Math.round(U.rand(-X.shakeA, X.shakeA)); sy = Math.round(U.rand(-X.shakeA, X.shakeA) * 0.6); }
    b.setTransform(1, 0, 0, 1, sx, sy);
    const room = G.ROOMS[g.room];
    if (g.room === 'void') drawVoid();
    else if (room && room.bg) {
      if (room.diorama) drawDiorama(room);
      else X.spr(room.bg, 0, 0);
      if (g.room === 'car04' || g.room === 'car03') drawTunnelLights();
    }
    if (g.act >= 4 && g.collapse && g.room === 'car04') drawCollapse();
    if (g.room === 'dawn') drawDawn();
    drawVoidHoles();
    // 实体分层
    const list = g.inRoom(g.room).slice();
    const order = (e) => (e.kind === 'env' ? 0 : e.kind === 'fixture' ? 1 : e.kind === 'door' ? 2 : e.kind === 'loose' ? 7 : e.support === 'rack' || e.support === 'hook' ? 3 : e.kind === 'char' && e.pose === 'sit' ? 4 : e.kind === 'char' ? 5 + e.y / 1000 : e.support === 'air' ? 8 : 5 + e.y / 1000);
    list.sort((a, c) => order(a) - order(c));
    g.bubbles = [];
    const pasteMode = G.clip.sel >= 0 || G.ui.dragging;
    for (const e of list) {
      if (e.kind === 'loose') { drawLoose(e); continue; }
      G.drawEnt(e, { hover: g.hover === e.id || (pasteMode && Math.floor(g.realClock * 3) % 2 === 0 && e.kind !== 'env' && G.tags.canPaste(G.clip.slots[G.clip.sel] || { t: 'x' }, e).ok && e.kind === 'char') });
    }
    // 选中框
    const sel = g.get(g.sel);
    if (sel && sel.alive && sel.room === g.room) drawSel(sel);
    if (g.hover && g.hover !== g.sel) { const h = g.get(g.hover); if (h && h.alive && h.room === g.room && h.kind !== 'char' && h.kind !== 'item') { const bb = h.bbox(); X.frame(bb.x - 1, bb.y - 1, bb.w + 2, bb.h + 2, 'rgba(246,231,163,0.9)'); } }
    if (pasteMode) for (const e of list) { if (e.kind === 'char' || e.kind === 'loose' || e === sel) continue; if (Math.floor(g.realClock * 3) % 2) continue; const inst = G.clip.slots[G.clip.sel]; if (inst && !G.tags.canPaste(inst, e).ok) continue; const bb = e.bbox(); X.dline(bb.x, bb.y, bb.x + bb.w, bb.y, '#f0a83a'); X.dline(bb.x, bb.y + bb.h, bb.x + bb.w, bb.y + bb.h, '#f0a83a'); }
    X.drawParts(g.room);
    G.scan.draw();
    if (g.climaxScan) drawClimaxScan();
    if (G.boss && G.boss.on && G.boss.aimT > 0) { const t = g.get(G.boss.aim); if (t && t.alive && t.room === g.room) { const bb = t.bbox(); X.circle(bb.x + bb.w / 2, bb.y + bb.h / 2, Math.max(8, bb.w / 2 + 3), '#f4f1e8'); } }
    // 气泡
    for (const bu of g.bubbles) X.bubble(bu.text, bu.x, bu.y, bu.ent && bu.ent.char === 'insp' ? { fill: '#3a3f4c', color: '#f4f1e8', border: '#14161c' } : {});
    // 涂黑（第一幕高潮）
    if (g.redact > 0) { const h = Math.round(g.redact * G.H / 2); X.rect(0, 0, G.W, h, '#0b0c10'); X.rect(0, G.H - h, G.W, h, '#0b0c10'); for (let i = 0; i < 6; i++) X.rect(U.randi(0, G.W), U.randi(h, G.H - h), U.randi(20, 90), 6, '#0b0c10'); }
    if (g.flash > 0) { b.fillStyle = `rgba(250,246,236,${Math.min(1, g.flash)})`; b.fillRect(-10, -10, G.W + 20, G.H + 20); g.flash -= 0.02; }
    if (g.roomFlash > 0) { X.ditherRect(0, 0, G.W, G.H, '#0d0f14', Math.floor(g.roomFlash * 20) % 2); }
    // 暂停遮罩
    if (g.paused && !G.ui.modalOpen) { X.ditherRect(0, 0, G.W, G.H, 'rgba(13,15,20,0.55)'); X.rect(G.W / 2 - 34, G.H / 2 - 10, 68, 18, '#26324a'); X.text('一時停止', G.W / 2, G.H / 2 - 8, '#f0a83a', 'center'); }
    b.setTransform(1, 0, 0, 1, 0, 0);
    X.present();
  }
  g.render = render;

  function drawDawn() {
    // 站名牌
    X.rect(183, 29, 82, 41, '#f4f1e8'); X.frame(183, 29, 82, 41, '#5b5044');
    X.rect(184, 54, 80, 2, '#c0432c');
    X.text('出口', 224, 30, '#2b2620', 'center', 24);
    X.text('でぐち·DEGUCHI', 224, 57, '#5b5044', 'center');
    // 白线：脉动的标记
    if (G.story.obj === 'a4_exit' && !G.story.flags.ended) {
      const k = Math.floor(g.realClock * 3) % 2;
      X.rect(g.whiteLineX - 1, 196, 3, 46, k ? '#f4f1e8' : '#d8b24a');
      X.text('白线', g.whiteLineX + 6, 200, '#f4f1e8');
      X.text('→', g.whiteLineX - 18 + k * 3, 214, '#f4f1e8');
    }
  }
  function drawTunnelLights() {
    // 窗外飞驰而过的隧道灯
    const room = g.room;
    const wins = room === 'car04' ? [[52, 88, 95, 44], [237, 88, 95, 44], [354, 87, 19, 35], [168, 87, 22, 46], [197, 87, 22, 46]] : [[20, 92, 108, 46], [206, 92, 112, 46], [120, 92, 25, 46], [160, 92, 25, 46]];
    const speed = g.act >= 4 && g.collapse && !g.collapse.on ? 0 : 160;
    const off = (g.clock * speed) % 140;
    for (const [x, y, w, h] of wins) {
      for (let k = -1; k < 4; k++) {
        const lx = x + w - ((off + k * 140) % (w + 140));
        if (lx < x || lx > x + w - 6) continue;
        X.rect(lx, y + h * 0.42, 6, 1, 'rgba(240,200,120,0.75)');
        X.rect(lx + 1, y + h * 0.42 - 1, 4, 1, 'rgba(240,200,120,0.35)');
      }
    }
  }
  function drawDiorama(room) {
    const o = room.bgOff;
    X.rect(0, 0, G.W, G.H, '#0b0d12');
    // 未渲染的空间：稀疏网格
    for (let x = 0; x < G.W; x += 16) for (let y = 0; y < G.H; y += 16) X.px(x, y, '#1d2230');
    X.spr(room.bg, o.x, o.y);
    X.frame(o.x - 1, o.y - 1, 309, 207, '#39404f');
    X.text('乗務員室 · 断面', o.x, o.y + 207, '#39404f');
  }
  function drawVoid() {
    // 原稿用纸
    X.rect(0, 0, G.W, G.H, '#f2ede0');
    for (let x = 12; x < G.W; x += 16) for (let y = 12; y < G.H; y += 16) { X.frame(x, y, 14, 14, '#e2c9bf'); }
    X.rect(G.W - 30, 0, 2, G.H, '#e2c9bf');
    X.text('剪贴板', G.W - 40, 8, '#c9a59a', 'right');
    const sx = Math.round(Math.sin(g.realClock * 0.6) * 2);
    for (let i = 0; i < 12; i++) { const px = (i * 53 + g.realClock * 6) % G.W, py = (i * 37 + Math.sin(g.realClock + i) * 6) % G.H; X.rect(px, py, 3, 2, '#d8cbb0'); }
  }
  function drawVoidHoles() {
    for (const h of g.voidHoles) {
      if (h.room !== g.room) continue;
      X.ellipse(h.x, h.y, h.r, h.ceil ? h.r * 0.6 : h.r * 0.4, '#f2ede0');
      X.ellipse(h.x, h.y, h.r, h.ceil ? h.r * 0.6 : h.r * 0.4, '#e2c9bf', true);
    }
  }
  function drawCollapse() {
    const k = g.collapse.k || 0;
    const n = Math.floor(k * 40);
    for (let i = 0; i < n; i++) {
      const hx = (U.hash('c' + i) % 384), hy = (U.hash('d' + i) % 256), w = 8 + (U.hash('w' + i) % 30), hh = 4 + (U.hash('h' + i) % 8);
      X.rect(hx, hy, w, hh, i % 3 === 0 ? '#0b0c10' : '#f2ede0');
    }
    if (g.collapse.on) { const fall = (g.clock * 40) % 256; X.rect((U.hash('f' + Math.floor(g.clock)) % 360), fall, 10, 6, '#f2ede0'); }
  }
  function drawLoose(e) {
    const inst = e.tags[0]; if (!inst) return;
    const cat = G.TAGS[inst.t] ? G.TAGS[inst.t].cat : 'id';
    const x = Math.round(e.x - 7), y = Math.round(e.y - 9);
    X.rect(x + 1, y + 1, 14, 9, 'rgba(0,0,0,0.3)');
    X.box(x, y, 14, 9, G.CAT_COL[cat], '#2b2620');
    if (G.TAG_ICON[inst.t]) X.drawIcon(G.TAG_ICON[inst.t], x + 4, y + 1);
    if (Math.floor(g.realClock * 2) % 4 === 0) X.px(x + 12, y + 1, '#ffffff');
  }
  function drawSel(e) {
    const bb = e.bbox();
    const ph = Math.floor(g.realClock * 8) % 4;
    const x0 = Math.round(bb.x) - 2, y0 = Math.round(bb.y) - 2, w = Math.round(bb.w) + 4, h = Math.round(bb.h) + 4;
    const b = X.b; b.fillStyle = '#f0a83a';
    const per = 2 * (w + h);
    for (let i = 0; i < per; i++) {
      if ((i + ph) % 4 >= 2) continue;
      let x, y;
      if (i < w) { x = x0 + i; y = y0; } else if (i < w + h) { x = x0 + w; y = y0 + i - w; } else if (i < 2 * w + h) { x = x0 + w - (i - w - h); y = y0 + h; } else { x = x0; y = y0 + h - (i - 2 * w - h); }
      b.fillRect(x, y, 1, 1);
    }
    // 名字标签
    const name = e.name.length > 10 ? e.name.slice(0, 10) + '…' : e.name;
    const tw = X.measure(name);
    const ly = Math.max(0, y0 - 14);
    X.rect(U.clamp(x0 + w / 2 - tw / 2 - 3, 0, G.W - tw - 6), ly, tw + 6, 13, '#26324a');
    X.text(name, U.clamp(x0 + w / 2 - tw / 2, 3, G.W - tw - 3), ly, '#f0a83a');
  }
  function drawClimaxScan() {
    const x = Math.round(g.climaxScan.x);
    X.rect(x - 9, 0, 9, G.H, 'rgba(216,178,74,0.55)');
    for (let y = 0; y < G.H; y += 5) { X.rect(x - 8, y + 1, 2, 2, '#f0d27a'); X.rect(x - 4, y + 3, 2, 2, '#f0d27a'); }
    X.rect(x, 0, 2, G.H, '#f4f1e8');
  }

  // 炸弹/系统时钟/白线 的绘制
  G.DRAW.boss = function (e) {
    const t = G.game.clock;
    const bob = e.st.dead ? 0 : Math.round(Math.sin(t * 1.5) * 3);
    const aim = G.boss.aim ? G.game.get(G.boss.aim) : null;
    const im = X.img.glove; if (!im) return;
    X.spr('glove', e.x, e.y + bob);
    if (e.st.dead) { X.text('処理中…', e.x + 40, e.y + 70, '#f0a83a'); const k = Math.floor(t * 8) % 8; X.circle(e.x + 30, e.y + 76, 4, '#f0a83a'); X.px(e.x + 30 + Math.round(Math.cos(k) * 4), e.y + 76 + Math.round(Math.sin(k) * 4), '#14161c'); }
    if (G.boss.paused > 0) X.text('一時停止', e.x + 30, e.y - 12, '#f0a83a');
  };
  G.DRAW.sysclock = function (e) {
    const cx = e.x + 24, cy = e.y + 24;
    X.circle(cx, cy, 22, '#2b2620', true); X.circle(cx, cy, 20, '#f4f1e8', true);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; X.px(cx + Math.round(Math.cos(a) * 17), cy + Math.round(Math.sin(a) * 17), '#2b2620'); }
    const t = G.game.clock * (e.f.rev ? -1 : 1) * (e.f.still ? 0 : 1);
    const a1 = t * 0.5 - Math.PI / 2, a2 = t * 6 - Math.PI / 2;
    X.line(cx, cy, cx + Math.cos(a1) * 10, cy + Math.sin(a1) * 10, '#2b2620');
    X.line(cx, cy, cx + Math.cos(a2) * 15, cy + Math.sin(a2) * 15, '#c0432c');
    X.text('破棄', cx, cy + 6, '#c0432c', 'center');
  };
})();
