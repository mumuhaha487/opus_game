/* =========================================================
   scan.js —— 每 60 秒的“白线巡检”
   预告（发车旋律＋广播）→ 黄色导盲砖扫描线从左到右扫过 → 盖「差戻」章、恢复原状
   规则：【回送】跳过；【乘务员】受信任；【异常】必查；带外来【最高仇恨】的东西会把扫描线“吸”过去，
        处理完它就提前收工（诱饵）；同时带【最高仇恨】与【回送】会卡死整次扫描。
   ========================================================= */
(function () {
  'use strict';
  const U = G.util, X = G.gfx;
  const S = (G.scan = {});
  S.reset = function () {
    S.state = 'idle'; S.next = G.SCAN_EVERY; S.x = -20; S.found = []; S.checked = new Set(); S.skip = null; S.stallT = 0; S.warned = false; S.interval = G.SCAN_EVERY; S.doneCount = 0; S.decoy = null;
  };
  S.reset();
  S.enabled = () => G.game.act >= 2 && !G.game.sandboxNoScan && !G.story.flags.noScan;
  S.skipNext = function (why) { S.skip = why || '巡检取消。'; };
  S.setInterval = function (sec) { S.interval = sec; if (S.state === 'idle') S.next = Math.min(S.next, G.game.t + sec); };

  // ---------- 异常判定 ----------
  S.isAnomalous = function (e, opts = {}) {
    if (!e || !e.alive) return false;
    const g = G.game;
    if (e.room === 'bombui' || e.kind === 'ui') return false;
    if (e.kind === 'loose') return true;
    const env = g.get({ car04: 'env04', crew: 'envcrew', car03: 'env03' }[e.room]);
    const fa = e.tags.some((i) => i.t === 'anomaly' && i.o !== e.id);
    if (env && env.has('oos') && e !== env && !fa) return false;
    if (e.has('oos') && !fa) return false;
    if (e.f.reflection && e.kind === 'char') return false;
    if (e.id === 'reflection') return false;
    if (e.has('inspector')) return !!(e.mods.framed || e.has('anomaly') || e.has('aggro')) && opts.insp;
    const foreignAnom = e.tags.some((i) => i.t === 'anomaly' && i.o !== e.id);
    if (foreignAnom) return true;
    if (e.has('crew') && !e.mods.leaveCar) return false; // 乘務員、ヨシ！
    if (e.spawned || e.copyOf) return true;
    if (e.st.inBox && e.kind === 'item') return true;
    if (e.placeholder) return false;
    // 词条比对
    const now = e.tags.map((i) => i.t).sort().join(',');
    const canon = S.canonTags(e).slice().sort().join(',');
    if (now !== canon) return true;
    // 位置
    const tgt = S.canonPos(e);
    if (tgt) {
      if (e.room !== tgt.room) return true;
      if (e.kind === 'char') {
        if (Math.abs(e.x - tgt.x) > 16) return true;
        if (tgt.pose === 'sit' && e.pose !== 'sit' && e.st.stime > 2) return true;
        if (e.support === 'air') return true;
      } else if (e.kind === 'item') {
        const nativeRoll = e.tags.some((i) => i.t === 'roll' && i.o === e.id);
        if (!nativeRoll && (Math.abs(e.x - tgt.x) > 14 || Math.abs(e.y - tgt.y) > 14)) return true;
        if (nativeRoll && Math.abs(e.y - tgt.y) > 20) return true;
      }
    }
    if (e.kind === 'door' && e.open && !(e.st.holdT > 0 && e.st.legit) && !e.mods.forceOpen) return e.has('door') && !e.st.holdT;
    if (e.kind === 'door' && (e.mods.forceOpen || e.st.lifted)) return true;
    return false;
  };
  S.canonTags = function (e) {
    if (e.id === 'lcd') { const base = ['fast', 'exit']; if (G.game.inDelayWindow()) base.push('delay'); return base; }
    if (e.id === 'shiori') return ['passenger', 'bookmark'];
    if (e.id === 'env03') return [];
    if (e.id === 'nana' && G.game.act >= 2) return ['passenger', 'nana', 'scripted'];
    return e.canonTags;
  };
  S.canonPos = function (e) {
    if (e.kind === 'char') {
      if (e.id === 'nana') return { room: 'car04', x: 118, pose: 'sit' };
      if (e.id === 'shiori') return { room: 'car03', x: 292, pose: 'sit' };
      const tgt = G.brains.scriptTarget(Object.assign(Object.create(e), { st: { stime: G.game.t } }));
      return tgt || e.home;
    }
    if (e.kind === 'item') {
      if (e.id === 'bomb') return G.story.bombHome(G.game.t);
      return { room: e.home.room, x: e.home.x, y: e.home.y };
    }
    return null;
  };

  // ---------- 恢复（差戻） ----------
  S.restore = function (e) {
    const g = G.game;
    if (!e || !e.alive) return;
    if (e.kind === 'loose') { const inst = e.tags[0]; const home = inst && g.get(inst.o); if (home) G.R.giveBack(home, inst); G.R.kill(e, 'scan'); return; }
    if (e.spawned || e.copyOf) { G.R.kill(e, 'scan'); return; }
    if (e.st.inBox && e.kind === 'item') { e.st.inBox = false; }
    // 外来词条送回
    for (const inst of e.tags.slice()) if (inst.o !== e.id && inst.o !== 'sys') { G.R.homeInst(e, inst); }
    e.tags = e.tags.filter((i) => i.o === e.id || i.o === 'sys' ? (i.o === e.id) : true);
    // 缺失的原生词条找回来
    const canon = S.canonTags(e);
    const have = {}; for (const i of e.tags) have[i.t] = (have[i.t] || 0) + 1;
    const need = {}; for (const t of canon) need[t] = (need[t] || 0) + 1;
    // 多余的原生词条去掉（例如被系统临时添加的）
    for (const t in have) { let extra = have[t] - (need[t] || 0); while (extra-- > 0) { const i = e.tags.findIndex((x) => x.t === t); if (i >= 0) e.tags.splice(i, 1); } }
    for (const t in need) {
      let miss = need[t] - (have[t] || 0);
      while (miss-- > 0) {
        let inst = null;
        const si = G.clip.slots.findIndex((x) => x.t === t && x.o === e.id);
        if (si >= 0) { inst = G.tags.removeSlot(si); G.ui.toast(`剪贴板里的 ${G.tagLabel(t)} 被系统没收，送回了 ${e.name}。`, 'small'); G.ui.flySticker(e, inst, 'toEnt'); G.ui.refresh(); }
        if (!inst) for (const o of g.ents) { if (o === e || !o.alive) continue; const k = o.tags.findIndex((x) => x.t === t && x.o === e.id); if (k >= 0) { inst = o.tags.splice(k, 1)[0]; G.tags.changed(o); if (o.kind === 'loose') G.R.kill(o, 'scan'); break; } }
        if (!inst) inst = G.mkInst(t, e.id, S.lockedCanon(e, t));
        inst.pend = 0; inst.temp = 0;
        e.tags.push(inst);
      }
    }
    // 锁状态复原
    for (const i of e.tags) if (S.lockedCanon(e, i.t)) i.lock = true;
    // 位置
    const pos = S.canonPos(e);
    if (pos) {
      if (e.room !== pos.room) g.moveRoom(e, pos.room, pos.x);
      e.x = pos.x;
      if (e.kind === 'char') { if (pos.pose === 'sit') G.brains.sitAt(e, pos.x); else { e.pose = pos.pose || 'stand'; e.y = G.ROOMS[e.room].walkY; } e.held = null; e.st = { stime: G.game.t, fired: e.st.fired }; e.support = null; }
      if (e.kind === 'item') { e.y = pos.y; e.support = pos.support || e.home.support; e.vx = 0; e.vy = 0; e.held = null; e.st = {}; }
    }
    if (e.kind === 'door') { e.open = false; e.st.holdT = 0; e.mods.forceOpen = false; e.st.lifted = false; }
    if (e.id === 'env03') G.bus.emit('car03Thaw');
    e.hist = [];
    G.tags.changed(e);
    X.emit('paper', e.cx(), e.cy(), 8, { c: '#f4f1e8' });
  };
  S.lockedCanon = function (e, t) {
    const spec = G.game.specOf(e.id);
    if (!spec) return false;
    return (spec.tags || []).some((x) => typeof x === 'object' && x.t === t && x.lock);
  };

  // 盖章（检札员或扫描线）
  S.stamp = function (e, by) {
    if (!e || !e.alive) return;
    G.audio.sfx('stamp'); X.shake(1, 0.15);
    e.st.stamped = 1.4; e.st.stampTxt = '差戻';
    const isAwake = e.id === 'nana' || (e.id === 'shiori' && G.story.flags.shioriFree);
    if (by && by.has && by.has('inspector') && e.has('inspector') && !isAwake) { G.R.after(0.4, () => G.R.kill(e, 'stamp')); G.ui.toast('检札员给同伴盖了「差戻」——它被回收了！'); G.bus.emit('inspKilled', e); return; }
    if (isAwake && by && by.has && by.has('inspector')) { G.ui.toast(e.id === 'nana' ? '你被检札员「差戻」回了座位（剪贴板里的【台本角色】被贴回了你身上）。' : '栞被检札员「差戻」回了 3 号车厢。'); G.ui.banner('差戻', 'red', 1.5); }
    S.restore(e);
  };

  // ---------- 更新 ----------
  S.update = function (dt) {
    const g = G.game;
    if (!S.enabled()) { S.state = 'idle'; return; }
    if (S.state === 'idle') {
      const until = S.next - g.t;
      if (until <= 10 && !S.warned) {
        S.warned = true;
        if (S.skip) { G.ui.banner(S.skip, '', 3); }
        else {
          const drown = g.ents.some((o) => o.alive && o.mods.drownWarn);
          if (!drown) { G.audio.melody('scan'); G.ui.announce('まもなく、巡検です。白線の内側まで、お下がりください。', '巡检即将开始，请退到白线以内。'); }
          G.bus.emit('scanWarn');
        }
      }
      if (g.t >= S.next) {
        S.warned = false;
        if (S.skip) { S.skip = null; S.next += S.interval; S.doneCount++; G.bus.emit('scanSkipped'); return; }
        S.begin();
      }
    } else if (S.state === 'sweep') {
      if (S.stallT > 0) { S.stallT -= dt; return; }
      const speed = 384 / 3.4;
      S.x += speed * dt;
      // 当前房间：逐个检查
      const roomEnts = g.inRoom(g.room).slice();
      // 诱饵：带外来【最高仇恨】的异常物体
      if (!S.decoy) {
        const d = roomEnts.find((o) => o.alive && o.f.aggro && o.id !== 'bomb' && !o.has('oos') && S.isAnomalous(o));
        if (d) { S.decoy = d; G.ui.banner('巡检线被【最高仇恨】吸引了过去', '', 2); }
      }
      if (S.decoy) {
        const tx = S.decoy.cx();
        S.x = U.approach(S.x, tx, speed * 2.5 * dt);
        if (Math.abs(S.x - tx) < 2) { S.mark(S.decoy); S.finish(true); }
        return;
      }
      for (const o of roomEnts) {
        if (S.checked.has(o.id)) continue;
        if (o.cx() <= S.x) {
          S.checked.add(o.id);
          if (o.mods.scanJam || (o.f.aggro && o.f.oos && o.id !== 'bomb')) { G.ui.banner('判定不能：最需要关注的东西「回送中」……本次巡检中止', 'red', 3); S.finish(true, true); return; }
          if (o.mods.scanStall) { S.stallT = 5; G.ui.banner('巡检线卡住了（自相矛盾）', '', 2.5); }
          if (S.isAnomalous(o)) S.mark(o);
          else if (o.kind === 'char' && !o.placeholder && o.alive && o.has('crew') && !o.has('anomaly')) { X.emit('txt', o.cx(), o.top() - 8, 1, { txt: 'ヨシ！', c: '#f0a83a', up: 10, g: -6, life: 1 }); }
        }
      }
      if (S.x > 400) S.finish(false);
    }
  };
  S.begin = function () {
    const g = G.game;
    S.state = 'sweep'; S.x = -10; S.found = []; S.checked = new Set(); S.decoy = null;
    G.audio.sfx('pinpon');
    G.ui.banner('巡检中', '', 3.6);
    G.bus.emit('scanStart');
  };
  S.mark = function (o) {
    if (S.found.includes(o)) return;
    S.found.push(o);
    G.audio.sfx('stamp'); X.shake(1, 0.1);
    o.st.stamped = 1.6; o.st.stampTxt = '差戻';
  };
  S.finish = function (early, aborted) {
    const g = G.game;
    S.state = 'idle'; S.x = -20;
    S.next = g.t + S.interval;
    S.next = Math.ceil(S.next / S.interval) * S.interval;
    if (S.next - g.t < 20) S.next += S.interval;
    S.doneCount++;
    if (aborted) { G.bus.emit('scanEnd', 0); return; }
    // 其它房间（瞬间检查）
    if (!early) {
      for (const o of g.ents) {
        if (!o.alive || o.room === g.room || ['roof', 'underfloor', 'bombui'].includes(o.room)) continue;
        if (S.isAnomalous(o)) S.found.push(o);
      }
      // 缺失的原生对象
      for (const id of g.canonIds) {
        const o = g.get(id);
        if (o && o.alive) { if (['roof', 'underfloor'].includes(o.room)) S.found.push(o); continue; }
        if (['roof', 'underfloor'].includes(o && o.room)) { S.found.push(o); continue; }
        const resp = g.respawn(id); if (resp) S.found.push(resp);
      }
    }
    const found = S.found.filter((o) => o);
    for (const o of found) { if (o.alive && !['roof', 'underfloor'].includes(o.room)) S.restore(o); else if (o.alive) { const pos = S.canonPos(o) || o.home; g.moveRoom(o, pos.room, pos.x); S.restore(o); } }
    const n = found.length;
    if (n > 0) {
      G.ui.announce('異常を確認。修正しました。', `发现异常 ${n} 处，已修正（差戻）。`);
      g.alertUp(`巡检发现 ${n} 处异常`);
    } else {
      G.audio.sfx('yoshi');
      G.ui.announce('異常なし。ヨシ！', '无异常。好！');
    }
    G.bus.emit('scanEnd', n);
  };

  // ---------- 绘制扫描线 ----------
  S.draw = function () {
    const g = G.game;
    if (S.state !== 'sweep') {
      // 预告：画面边缘闪烁的导盲砖
      if (S.enabled() && S.warned && Math.floor(g.clock * 3) % 2 === 0 && !S.skip) { for (let y = 0; y < G.H; y += 8) { X.rect(0, y, 3, 6, '#d8b24a'); X.rect(G.W - 3, y, 3, 6, '#d8b24a'); } }
      return;
    }
    const x = Math.round(S.x);
    // 黄色导盲砖带
    X.rect(x - 9, 0, 9, G.H, 'rgba(216,178,74,0.55)');
    for (let y = 0; y < G.H; y += 5) { X.rect(x - 8, y + 1, 2, 2, '#f0d27a'); X.rect(x - 4, y + 3, 2, 2, '#f0d27a'); }
    X.rect(x, 0, 2, G.H, '#f4f1e8');
    X.ditherRect(x - 30, 0, 21, G.H, 'rgba(244,241,232,0.18)', Math.floor(g.clock * 10) % 2);
    // 已发现的异常：红圈
    for (const o of S.found) { if (!o.alive || o.room !== g.room) continue; const bb = o.bbox(); X.frame(bb.x - 3, bb.y - 3, bb.w + 6, bb.h + 6, '#c0432c'); X.frame(bb.x - 2, bb.y - 2, bb.w + 4, bb.h + 4, '#c0432c'); }
  };
})();
