/* =========================================================
   tagsys.js —— 剪贴板、剪切/粘贴、反应引擎、反应辅助 API（G.R）
   ========================================================= */
(function () {
  'use strict';
  const U = G.util, X = G.gfx;
  const T = (G.tags = {});
  const clip = (G.clip = { slots: [], cap: 3, sel: -1 });

  // ---------- 规则查询 ----------
  T.canCut = function (e, inst) {
    const g = G.game;
    if (g.act < 2 && !g.sandbox && !g.voidMode) return { ok: false, why: '你还不知道怎么做到这件事。' };
    if (!e || !e.alive) return { ok: false, why: '对象不存在。' };
    if (inst.lock) return { ok: false, why: `${G.tagLabel(inst.t)} 被系统锁住了，剪不下来。` };
    if (e.has('lock') && inst.t !== 'lock' && e.kind !== 'loose') return { ok: false, why: `${e.name} 带着【锁定】：上面的词条都剪不下来。` };
    if (inst.pend && inst.pend > g.clock) return { ok: false, why: '这个词条还在【延迟】中，尚未生效。' };
    if (clip.slots.length >= clip.cap) return { ok: false, why: '剪贴板满了。先贴出去或丢回原处一个。' };
    if (e.kind !== 'ui' && g.room !== e.room && e.room !== 'bombui') return { ok: false, why: '它不在你所在的车厢里。' };
    return { ok: true };
  };
  T.canPaste = function (inst, e) {
    const g = G.game;
    if (!e || !e.alive) return { ok: false, why: '对象不存在。' };
    if (e.kind === 'loose') return { ok: false, why: '不能贴在词条上。' };
    if (e.kind !== 'ui' && g.room !== e.room && e.room !== 'bombui') return { ok: false, why: '它不在你所在的车厢里。' };
    if (e.kind === 'env' && !['oos', 'still', 'anomaly', 'aggro', 'fast', 'slow', 'reverse', 'loop'].includes(inst.t) && g.act < 4) return { ok: false, why: '整节车厢只接受“时间”或“系统”类的词条。' };
    return { ok: true };
  };

  // ---------- 剪切 ----------
  T.cut = function (e, inst, fromUI) {
    const c = T.canCut(e, inst);
    if (!c.ok) { G.ui.toast(c.why); G.audio.sfx('deny'); return false; }
    const i = e.tags.indexOf(inst); if (i < 0) return false;
    e.tags.splice(i, 1);
    clip.slots.push(inst);
    G.audio.sfx('cut');
    if (e.kind !== 'ui') X.emit('paper', e.cx(), e.top() + 4, 6, { c: G.CAT_COL[G.TAGS[inst.t] ? G.TAGS[inst.t].cat : 'id'] });
    G.ui.flySticker(e, inst, 'toClip');
    T.onRemove(e, inst.t, inst);
    T.changed(e);
    G.meta.tagsSeen[inst.t] = 1;
    G.bus.emit('cut', e, inst);
    if (e.kind === 'loose') { e.alive = false; G.game.remove(e); }
    G.ui.refresh();
    return true;
  };
  // ---------- 粘贴 ----------
  T.paste = function (slot, e) {
    const inst = clip.slots[slot];
    if (!inst) return false;
    const c = T.canPaste(inst, e);
    if (!c.ok) { G.ui.toast(c.why); G.audio.sfx('deny'); return false; }
    clip.slots.splice(slot, 1);
    clip.sel = -1;
    T.attach(e, inst, true);
    G.ui.flySticker(e, inst, 'toEnt');
    G.audio.sfx('paste');
    G.bus.emit('paste', e, inst);
    G.ui.refresh();
    return true;
  };
  // 把实例挂到实体上（处理延迟、钩子、反应）
  T.attach = function (e, inst, byPlayer) {
    const g = G.game;
    if (e.has('delay') && inst.t !== 'delay' && !e.has('timer')) inst.pend = g.clock + 5; else inst.pend = 0;
    e.tags.push(inst);
    G.meta.tagsSeen[inst.t] = 1;
    if (inst.pend) {
      G.ui.toast(`${G.tagLabel(inst.t)} 被【延迟】了，5 秒后生效。`, 'small');
      G.R.after(5.05, () => { if (e.alive && e.tags.includes(inst)) { T.onAdd(e, inst.t, inst, byPlayer); T.changed(e, inst.t, byPlayer); } }, e);
    } else { T.onAdd(e, inst.t, inst, byPlayer); T.changed(e, inst.t, byPlayer); }
    // 过载
    if (e.tags.length >= 7 && e.kind !== 'ui' && e.kind !== 'env') G.R.after(0.4, () => { if (e.alive && e.tags.length >= 7) { G.R.toast('词条过载！'); G.R.scatter(e); } }, e);
  };
  // 从剪贴板移除一个槽位，并修正“拿在手里”的选择
  T.removeSlot = function (idx) {
    const inst = clip.slots.splice(idx, 1)[0];
    if (clip.sel === idx) clip.sel = -1; else if (clip.sel > idx) clip.sel--;
    return inst;
  };
  T.discard = function (slot) {
    const inst = clip.slots[slot]; if (!inst) return;
    T.removeSlot(slot); clip.sel = -1;
    const home = inst.o && G.game.get(inst.o);
    if (home && G.R.giveBack(home, inst)) { G.ui.toast(`${G.tagLabel(inst.t)} 回到了 ${home.name} 身上。`, 'small'); G.ui.flySticker(home, inst, 'toEnt'); }
    else G.ui.toast(`${G.tagLabel(inst.t)} 化成纸屑消失了。`, 'small');
    G.audio.sfx('page');
    G.ui.refresh();
  };

  // ---------- 钩子 ----------
  T.onAdd = function (e, t, inst, byPlayer) {
    const g = G.game;
    if (e.kind === 'char') {
      const lines = (G.LINES[e.char] && G.LINES[e.char][t]) || (e.char !== 'nana' ? G.LINES._[t] : null);
      if (lines && lines.length && !e.placeholder) e.say(U.choice(lines));
    }
    if (t === 'zerog') G.audio.sfx('float');
    if (t === 'fluid') G.audio.sfx('splash');
    if (t === 'copy') e.copyT = 4.5;
    if (t === 'emergency' && !['ebutton', 'ebutton03'].includes(e.id)) { G.audio.melody('danger'); G.ui.banner('非常通報', 'red', 2.5); }
    if (t === 'sleep' && e.kind === 'char' && e.pose === 'stand' && !e.f.zerog) { /* 大脑会找位子 */ }
    if (t === 'bookmark') G.story.flags.bookmarks = Object.assign(G.story.flags.bookmarks || {}, { [e.id]: true });
    if (t === 'metal' && e.kind === 'char') { const sp = g.get('speaker'); if (sp && sp.alive && sp.f.magnet && sp.room === e.room) { e.st.liftTo = sp.y + 10; } }
    // 广播：贴到【广播】宿主（麦克风）上的词条
    if (e.has('broadcast') && t !== 'broadcast' && e.kind === 'fixture') T.broadcast(e, t);
    if (e.kind === 'ui' && G.ui4) G.ui4.onTag(e, t, true);
    if (e.id === 'boss') G.bus.emit('bossTag', e, t);
  };
  T.onRemove = function (e, t, inst) {
    const g = G.game;
    if (e.kind === 'char' && !e.placeholder) {
      const lines = (G.LINES[e.char] && G.LINES[e.char]['-' + t]) || (e.char !== 'nana' ? G.LINES._['-' + t] : null);
      if (lines && lines.length) e.say(U.choice(lines));
      if (t === 'sleep' && e.pose === 'sit' && e.id !== 'nana') {/* 醒来 */}
    }
    // 门牌上的【禁止】被剪掉 → 门锁失效，【锁定】掉落
    if (e.id === 'crewsign' && t === 'forbid') {
      const d = g.get('crewdoor');
      if (d) { const li = d.tags.find((i) => i.t === 'lock'); if (li) { d.tags.splice(d.tags.indexOf(li), 1); li.lock = false; G.R.spawnLoose(li, d.room, d.x + d.w / 2 - 8, 238); T.changed(d); G.R.toast('「关系者以外立入禁止」→「关系者以外立入」。门上的【锁定】掉了下来！'); G.audio.sfx('door'); } }
    }
    if (e.kind === 'ui' && G.ui4) G.ui4.onTag(e, t, false);
    if (t === 'scripted' && e.id === 'kuro' && !e.has('scripted')) G.bus.emit('kuroScriptLost', e);
    if (t === 'oos' && e.id === 'env03') G.bus.emit('car03Visible');
    if (t === 'still' && e.id === 'gangway04') G.R.toast('贯通门解冻了。', 'small');
  };
  // 广播
  T.broadcast = function (mic, t) {
    const g = G.game;
    G.ui.announce('（ザザッ）……', `【广播】${G.tagLabel(t)} 正在通过扬声器播放！`);
    G.audio.sfx('pinpon');
    const targets = g.ents.filter((o) => o.alive && o.kind === 'char' && o.room === 'car04' && !o.placeholder);
    for (const o of targets) G.R.add(o, t, { temp: 12, origin: 'pa' });
    G.R.toast(`广播：4 号车厢里的 ${targets.length} 个人都获得了 ${G.tagLabel(t)}（12 秒）`);
    G.bus.emit('broadcast', t, targets);
  };

  // ---------- 反应引擎 ----------
  function matchOn(r, e) {
    if (!r.on) return true;
    if (typeof r.on === 'function') return r.on(e);
    if (r.on === 'char') return e.kind === 'char';
    if (r.on === 'npc') return e.kind === 'char' && !e.isPlayer;
    if (r.on === 'player') return e.id === 'nana';
    if (r.on === 'item') return e.kind === 'item';
    if (r.on === 'door') return e.kind === 'door';
    if (r.on === 'fixture') return e.kind === 'fixture';
    if (r.on[0] === '#') return e.id === r.on.slice(1);
    return true;
  }
  function tagsSatisfy(e, req) {
    const need = {};
    for (const t of req) need[t] = (need[t] || 0) + 1;
    const cnt = e.printed ? (t) => e.tags.filter((i) => i.t === t && i.o !== e.id && (!i.pend || i.pend <= G.game.clock)).length : (t) => e.count(t);
    for (const t in need) if (cnt(t) < need[t]) return false;
    return true;
  }
  const tagSig = (e) => e.tags.map((i) => i.t + (i.pend && i.pend > G.game.clock ? '~' : '')).join(',');
  T.changed = function (e, newTag, byPlayer, depth = 0) {
    if (!e || !e.alive) return;
    const sig0 = tagSig(e);
    e.computeFlags();
    // 匹配反应
    const cands = G.REACTIONS.filter((r) => tagsSatisfy(e, r.t) && matchOn(r, e)).sort((a, b) => b.prio - a.prio);
    // 同一组标签只保留优先级最高的一条
    const seenKeys = new Set(); const act = [];
    for (const r of cands) { if (seenKeys.has(r.key)) continue; seenKeys.add(r.key); act.push(r); }
    const actIds = new Set(act.map((r) => r.id));
    let fresh = null; const freshAll = [];
    for (const [id, r] of e.react) if (!actIds.has(id)) { e.react.delete(id); try { r.stop && r.stop(e, G.R); } catch (err) { console.error(err); } }
    e.mods = {};
    for (const r of act) if (r.mod) Object.assign(e.mods, r.mod);
    for (const r of act) {
      if (e.react.has(r.id)) continue;
      e.react.set(r.id, r);
      if (!fresh || r.t.length > fresh.t.length) fresh = r;
      freshAll.push(r);
      try { if (r.say && e.kind === 'char') e.say(U.choice(r.say)); r.start && r.start(e, G.R); } catch (err) { console.error('reaction', r.id, err); }
      if (r.sfx) G.audio.sfx(r.sfx);
    }
    e.computeFlags();
    // 某个反应在启动时改动了词条（例如醉拳暴走把【睡眠】吵醒）→ 先再结算一次，清掉已经不成立的反应
    if (depth < 3 && e.alive && tagSig(e) !== sig0) T.changed(e, null, false, depth + 1);
    // 只播报结算之后仍然成立的反应（一次性反应即使已结束也播报）
    const live = freshAll.filter((r) => r.once || e.react.has(r.id));
    if (live.length && !G.game.building) { live.sort((a, b) => b.t.length - a.t.length || b.prio - a.prio); for (const r of live.slice(0, 3)) T.announceReaction(e, r); for (const r of live.slice(3)) G.bus.emit('reaction', r, e); }
    if (depth > 0) return;
    if (!live.length && newTag && byPlayer && e.kind !== 'ui') T.composeNote(e, newTag);
    // 组合台词
    if (newTag && e.kind === 'char' && G.COMBO_LINES[e.char]) {
      for (const it of e.active()) { if (it.t === newTag) continue; const key = [it.t, newTag].sort().join('+'); const ln = G.COMBO_LINES[e.char][key]; if (ln) { e.say(U.choice(ln)); break; } }
    }
  };
  T.announceReaction = function (e, r) {
    const isNew = !G.meta.dex[r.id];
    G.meta.dex[r.id] = (G.meta.dex[r.id] || 0) + 1; G.saveMeta();
    G.audio.sfx(isNew ? 'discover' : 'react');
    G.ui.reactionToast(r, e, isNew);
    G.bus.emit('reaction', r, e);
  };
  // 未登记的组合：按形容词合成描述
  T.composeNote = function (e, newTag) {
    const others = [...new Set(e.active().map((i) => i.t))].filter((t) => t !== newTag && G.TAGS[t]);
    if (!others.length) return;
    const other = others[others.length - 1];
    const key = [newTag, other].sort().join('+');
    const isNew = !G.meta.combos[key];
    G.meta.combos[key] = 1; G.saveMeta();
    const a = G.TAGS[newTag], b = G.TAGS[other];
    const text = `${e.name} 现在是「${a.adj}又${b.adj}」的状态。`;
    G.ui.toast(`<b>${G.tagLabel(other)}×${G.tagLabel(newTag)}</b>　${text}`, 'small');
  };
  T.composeName = (a, b) => `${G.TAGS[a].adj}·${G.TAGS[b].adj}`;

  // =========================================================
  //   反应辅助 API
  // =========================================================
  const R = (G.R = {});
  R.get = (id) => G.game.get(id);
  Object.defineProperty(R, 'game', { get: () => G.game });
  R.say = (e, s) => e && e.alive && e.say(s);
  R.sayNear = (e, r, lines) => { const c = G.game.inRoom(e.room).filter((o) => o.kind === 'char' && o !== e && !o.placeholder && Math.abs(o.cx() - e.cx()) < r); if (c.length) U.choice(c).say(U.choice(lines)); };
  R.toast = (s) => G.ui.toast(s);
  R.toastSmall = (s) => G.ui.toast(s, 'small');
  R.sys = (s) => G.ui.banner(s, '', 2.5);
  R.annc = (jp, zh) => G.ui.announce(jp, zh);
  R.sfx = (n) => G.audio.sfx(n);
  R.shake = (a, t) => X.shake(a, t);
  R.emit = (ev, data) => G.bus.emit(ev, data);
  R.after = (sec, fn, owner) => G.game.timers.push({ at: G.game.clock + sec, fn, owner, loop: G.game.loopNo });
  R.add = function (e, t, o = {}) {
    if (!e || !e.alive) return null;
    const inst = G.mkInst(t, o.origin || 'sys', !!o.lock);
    if (o.temp) inst.temp = G.game.clock + o.temp;
    T.attach(e, inst, false);
    return inst;
  };
  R.consumeOne = (e, t) => { const i = e.tags.findIndex((x) => x.t === t); if (i >= 0) { e.tags.splice(i, 1); X.emit('paper', e.cx(), e.top(), 4); T.changed(e); } };
  R.consumeAll = (e, t) => { const n = e.tags.length; e.tags = e.tags.filter((x) => x.t !== t); if (e.tags.length !== n) { X.emit('paper', e.cx(), e.top(), 6); T.onRemove(e, t); T.changed(e); } };
  R.dropAll = (e, t) => { for (const inst of e.tags.filter((x) => x.t === t)) { e.tags.splice(e.tags.indexOf(inst), 1); inst.lock = false; R.spawnLoose(inst, e.room, e.cx(), G.itemFloorY(e.room)); } T.changed(e); };
  // 把词条实例还给它的原主；若原主已经拥有台本规定数量的该词条（例如时间重置后重新生成过），就丢弃，避免重复
  R.giveBack = function (home, inst) {
    if (!home || !home.alive || home.kind === 'loose') return false;
    const canon = G.scan.canonTags(home) || [];
    const need = canon.filter((t) => t === inst.t).length;
    const have = home.tags.filter((i) => i.t === inst.t).length;
    if (have >= need) return false;
    inst.pend = 0; inst.temp = 0;
    if (G.scan.lockedCanon(home, inst.t)) inst.lock = true;
    home.tags.push(inst); T.changed(home);
    return true;
  };
  R.homeInst = function (e, inst) {
    const i = e.tags.indexOf(inst); if (i >= 0) e.tags.splice(i, 1);
    const home = inst.o && G.game.get(inst.o);
    if (home && home !== e) R.giveBack(home, inst);
    T.changed(e);
  };
  R.spawnLoose = function (inst, room, x, y) {
    const L = new G.Ent({ id: U.uid('loose'), kind: 'loose', room, x: U.clamp(x, 20, 364), y: y || G.itemFloorY(room), w: 14, h: 9, name: '掉落的词条', spawned: true, canonical: false, tags: [], support: 'floor' });
    L.tags = [inst]; L.computeFlags(); L.vy = -60; L.y -= 6;
    G.game.add(L);
    return L;
  };
  R.scatter = function (e) {
    const list = e.tags.slice(); e.tags = list.filter((i) => i.lock);
    let k = 0;
    for (const inst of list) {
      if (inst.lock) continue;
      R.spawnLoose(inst, e.room, e.cx() + (k - list.length / 2) * 12, G.itemFloorY(e.room) + (k % 2) * 4); k++;
    }
    T.changed(e);
  };
  R.shatter = function (e, text) {
    if (!e || !e.alive) return;
    if (e.mods.unbreakable) { X.emit('spark', e.cx(), e.cy(), 8); G.audio.sfx('rewind'); return; }
    G.audio.sfx('shatter');
    X.emit('spark', e.cx(), e.cy(), 16, { c: '#f4f1e8', spread: 50, up: 60 });
    if (text) X.emit('txt', e.cx(), e.top() - 4, 1, { txt: text, c: '#f4f1e8', up: 20, g: -10, life: 1.2 });
    if (e.isPlayer || e.id === 'shiori') { R.scatter(e); e.st.knocked = 2; G.ui.toast(e.isPlayer ? '你碎了一地……词条都散落了。' : '栞碎了一地……'); return; }
    R.scatter(e);
    R.kill(e, 'shatter');
  };
  R.kill = function (e, how) {
    // 醒着的角色不能被直接抹掉：交给剧情处理（时间重置后回来）
    if (e.id === 'nana' && e.kind === 'char') { G.bus.emit('playerErased', e); return; }
    if (e.id === 'shiori' && G.story.flags.shioriFree) { G.bus.emit('shioriErased', e); return; }
    e.alive = false;
    G.game.deleted.push({ id: e.id, spec: e, how, room: e.room, x: e.x, y: e.y });
    if (e.held) e.held = null;
    for (const o of G.game.ents) if (o.held === e) { o.held = null; o.support = 'floor'; }
    G.game.remove(e);
    G.bus.emit('killed', e, how);
  };
  R.destroy = function (e, how = 'erase', text) {
    if (!e || !e.alive) return;
    if (e.f.title || e.has('undeletable')) { G.ui.toast(`${e.name} 不能被删除。`); return; }
    G.audio.sfx(how === 'erase' ? 'erase' : 'pop');
    const bb = e.bbox();
    for (let i = 0; i < 18; i++) X.emit('dot', bb.x + Math.random() * bb.w, bb.y + Math.random() * bb.h, 1, { c: '#f4f1e8', up: 20, g: -20, life: 0.8 });
    if (text && e.room === G.game.room) X.emit('txt', e.cx(), bb.y - 4, 1, { txt: text, c: '#f4f1e8', up: 16, g: -10, life: 1.3 });
    // 外来词条回家
    for (const inst of e.tags.slice()) if (inst.o && inst.o !== e.id) R.homeInst(e, inst);
    if (e.isPlayer || (e.id === 'nana')) { G.bus.emit('playerErased', e); return; }
    if (e.id === 'shiori' && G.story.flags.shioriFree) { G.bus.emit('shioriErased', e); return; }
    if (e.kind === 'door') { e.mods.forceOpen = true; e.tags = e.tags.filter((i) => i.t !== 'door'); T.changed(e); G.ui.toast(`${e.name} 被擦掉了——只剩一个门洞。`); return; }
    R.kill(e, how);
  };
  R.copy = function (e) {
    const g = G.game;
    if (g.memory >= 14) return null;
    const n = g.ents.filter((o) => o.copyOf === (e.copyOf || e.id)).length;
    if (n >= 8) return null;
    const spec = { id: U.uid(e.id + '_c'), kind: e.kind, char: e.char, sprite: e.sprite, draw: e.draw, name: e.name + '（复制）', room: e.room, x: U.clamp(e.x + U.rand(-26, 26), 20, 364), y: e.y, pose: e.pose === 'sit' ? 'stand' : e.pose, face: e.face, brain: e.kind === 'char' ? (e.isPlayer ? 'mimic' : (e.has('inspector') ? 'insp' : 'generic')) : null, spawned: true, canonical: false, w: e.w, h: e.h, ad: e.ad, plate: e.plate, desc: '复制品。不继承带锁的词条。', vent: e.vent };
    const c = new G.Ent(Object.assign(spec, { tags: [] }));
    c.copyOf = e.copyOf || e.id;
    c.tags = e.tags.filter((i) => !i.lock && !i.pend).map((i) => G.mkInst(i.t, c.id, false));
    if (e.kind === 'char') { c.y = G.ROOMS[e.room].walkY; c.pose = 'stand'; }
    if (e.kind === 'item') { c.support = e.f.zerog ? 'air' : 'floor'; c.y = e.f.zerog ? e.y : G.itemFloorY(e.room); }
    if (e.kind === 'door') { c.x = e.x - 40 - n * 38; c.exit = null; }
    c.st.stime = e.st.stime;
    g.add(c);
    T.changed(c);
    R.memory(1);
    G.audio.sfx('copy');
    X.emit('paper', c.cx(), c.top(), 6);
    G.bus.emit('copied', c, e);
    return c;
  };
  R.memory = function (n) {
    const g = G.game;
    g.memory += n;
    if (g.memory >= 14 && !g.memCrash) {
      g.memCrash = true;
      G.ui.banner('メモリ不足 · 系统内存不足', 'red', 3);
      G.audio.sfx('glitch'); X.shake(3, 0.6);
      R.after(1.2, () => {
        for (const o of g.ents.slice()) if (o.alive && (o.copyOf || (o.has('inspector') && o.spawned))) R.kill(o, 'gc');
        g.memory = 0; g.memCrash = false;
        G.scan.skipNext('系统重启中，下一次巡检取消。');
        G.R.toast('系统回收了所有复制品与检札员——下一次巡检被取消了！');
        G.bus.emit('memCrash');
      });
    }
  };
  R.knock = (e, dir, d) => G.brains.knock(e, dir, d);
  R.panic = function (room, src, r) {
    for (const o of G.game.inRoom(room)) if (o.kind === 'char' && o !== src && !o.isPlayer && !o.placeholder && Math.abs(o.x - src.cx()) < r && o.f.ts !== 0) {
      const R0 = G.ROOMS[room]; o.st.fleeX = src.cx() < 192 ? R0.maxX - 20 : R0.minX + 20; o.st.fleeT = 5;
      o.say(U.choice(['哇啊！', '快跑！', '救命！']));
    }
  };
  R.bowChain = function (room, sec) { for (const o of G.game.inRoom(room)) if (o.kind === 'char' && !o.isPlayer && !o.placeholder) { o.st.bowT = sec; o.st.restrained = sec; } G.ui.toast('一车人互相鞠躬，谁也动不了。', 'small'); };
  R.wakeNear = function (e, r) { for (const o of G.game.inRoom(e.room)) if (o !== e && o.kind === 'char' && o.has('sleep') && Math.abs(o.x - e.x) < r) R.consumeAll(o, 'sleep'); };
  R.toCeiling = function (e) { if (e.isPlayer) return; R.after(2.5, () => { if (e.alive && e.f.nocollide && e.f.zerog) { G.ui.toast(`${e.name} 穿过车顶，飘出了沙盒。`, 'small'); e.room = 'roof'; } }, e); };
  R.sinkFloor = function (e) {
    R.after(0.8, () => {
      if (!e.alive || !(e.f.nocollide && e.f.heavy)) return;
      if (e.isPlayer) { G.bus.emit('underfloor', e); return; }
      G.ui.toast(`${e.name} 沉进了地板下面。`, 'small'); e.room = 'underfloor';
    }, e);
  };
  R.flood = (room, on) => { G.game.floodRooms[room] = on; };
  R.keysFly = function (e) {
    const g = G.game;
    if (g.get('key') || G.story.flags.keyOut) return;
    G.story.flags.keyOut = true;
    const shira = g.get('shira'); const room = shira && shira.alive ? shira.room : e.room;
    const k = new G.Ent({ id: 'key', kind: 'item', sprite: 'key', room, x: shira ? shira.x : 200, y: shira ? shira.y - 30 : 200, name: '乘务员钥匙', tags: ['metal', 'crew'], desc: '车掌的钥匙。带着“乘务员”的身份。', spawned: true, canonical: false });
    g.add(k); T.changed(k);
    if (shira) shira.say('啊！钥匙——！');
  };
  R.backHome = function (e) { if (e.home && e.home.room === e.room) { e.st.homing = true; R.after(2, () => { if (e.alive) { e.x = e.home.x; e.y = e.home.y; e.support = e.home.support || e.support; } }, e); } };
  R.nearMetal = (e, r) => G.game.inRoom(e.room).some((o) => o !== e && o.f.metal && Math.abs(o.cx() - e.cx()) < r);
  R.holeInCeiling = function (e) { G.game.voidHoles.push({ room: e.room, x: e.cx(), y: 14, r: 12, ceil: true }); G.ui.toast('车顶被擦出了一个洞——外面是一片空白的稿纸。'); G.audio.sfx('erase'); R.kill(e, 'erase'); };
  R.undoDelete = function (e) {
    const g = G.game; const d = g.deleted.filter((x) => x.room === e.room).pop();
    if (!d) { G.ui.toast('没有可以撤销的删除。', 'small'); return; }
    g.deleted.splice(g.deleted.indexOf(d), 1);
    const o = d.spec; o.alive = true; o.room = d.room; o.x = d.x; o.y = d.y; g.add(o); T.changed(o);
    G.ui.toast(`撤销删除：${o.name} 回来了。`); G.audio.sfx('rewind');
  };
  R.crushAt = function (e) {
    for (const o of G.game.inRoom(e.room)) {
      if (o === e || !o.alive) continue;
      if (Math.abs(o.cx() - e.cx()) > 12) continue;
      if (o.f.fragile && o.kind === 'item') R.shatter(o, '压碎');
      else if (o.kind === 'char' && o.f.ts !== 0) { R.knock(o, 1, 6); o.say('好痛！'); }
    }
  };
})();
