/* =========================================================
   story.js —— 四幕剧本运行器：开场、时间轴事件、目标/提示、炸弹与导线、
   一题多解判定、书签、第四幕的白线与界面越狱
   ========================================================= */
(function () {
  'use strict';
  const U = G.util, X = G.gfx;
  const S = (G.story = { flags: {}, done: {}, obj: null, hintLv: {}, used: {} });


  // ---------- 小工具 ----------
  const cs = (G.cs = {});
  cs.wait = (sec) => new Promise((r) => { const g = G.game; const end = g.realClock + sec; const iv = setInterval(() => { if (g.realClock >= end) { clearInterval(iv); r(); } }, 30); });
  // 按游戏时间等待（暂停、对话、模态窗时不走）
  cs.gwait = (sec) => new Promise((r) => { const g = G.game; const end = g.clock + sec; const iv = setInterval(() => { if (g.clock >= end) { clearInterval(iv); r(); } }, 30); });
  cs.walk = (e, x, room) => new Promise((r) => { e.st.csTarget = { x, room: room || e.room }; const iv = setInterval(() => { if (!e.alive || (e.room === e.st.csTarget.room && Math.abs(e.x - x) < 3)) { clearInterval(iv); e.st.csTarget = null; r(); } }, 50); });
  cs.card = function (k1, k2, k3, dur = 2.2, style = 'dark') {
    return new Promise((res) => {
      const c = document.getElementById('curtain');
      c.className = 'curtain-' + style; c.innerHTML = `<div class="kami kami-in"><div class="k1">${k1 || ''}</div><div class="k2">${k2 || ''}</div><div class="k3">${k3 || ''}</div></div>`;
      G.audio.sfx('page');
      let done = false;
      const finish = () => { if (done) return; done = true; const k = c.querySelector('.kami'); if (k) { k.classList.remove('kami-in'); k.classList.add('kami-out'); } setTimeout(() => { c.className = 'hidden'; c.innerHTML = ''; res(); }, 420); };
      c.onpointerdown = finish;
      setTimeout(finish, dur * 1000);
    });
  };
  cs.blank = function (on, style = 'dark') { const c = document.getElementById('curtain'); if (on) { c.className = 'curtain-' + style; c.innerHTML = ''; c.onpointerdown = null; } else { c.className = 'hidden'; c.innerHTML = ''; } };

  // ---------- 存档 ----------
  // 存档记下所在的幕、剪贴板、已完成的目标与发现；读档从那一幕开场继续，完成过的部分不用重做。
  // 自由实验、剪贴板空间和尾声里不能存。
  S.canSave = () => { const g = G.game; return !!g && g.act >= 1 && !(g.sandbox || g.room === 'dawn' || S.flags.ended || g.voidMode); };
  S.snapshot = function () {
    if (!S.canSave()) return null;
    const g = G.game;
    return { v: 1, act: g.act, loopNo: g.loopNo, flags: S.flags, done: S.done, obj: S.obj, used: S.used, clip: G.clip.slots.map((i) => ({ t: i.t, o: i.o })), cap: G.clip.cap, fails: g.fails, time: Date.now() };
  };
  S.save = function () { const data = S.snapshot(); if (data) G.store.set('wl_save', data); };
  S.load = () => G.store.get('wl_save', null);
  S.hasSave = () => !!S.load();
  // 手动存档位
  S.slots = () => { const list = G.store.get('wl_slots', []); return Array.from({ length: G.cloud.SLOTS }, (_, i) => (Array.isArray(list) && list[i]) || null); };
  S.saveSlot = function (i) {
    const data = S.snapshot(); if (!data) return false;
    const list = S.slots(); list[i] = data; G.store.set('wl_slots', list);
    return true;
  };

  // ---------- 目标 ----------
  S.setObj = function (id) {
    S.obj = id; S.hintLv[id] = S.hintLv[id] || 0;
    G.ui.setObjective(G.OBJ[id] ? G.OBJ[id].text : '');
    S.objT = G.game ? G.game.realClock : 0;
  };
  S.complete = function (id) {
    if (S.done[id]) return false;
    S.done[id] = true;
    if (S.obj === id) G.audio.melody('clear');
    return true;
  };
  S.hint = function () {
    if (G.dlg.isOpen()) return;
    const o = G.OBJ[S.obj]; if (!o) return;
    const lv = Math.min(S.hintLv[S.obj] || 0, o.hints.length - 1);
    const who = G.game.act >= 2 && S.obj !== 'a1_void' ? 'note' : null;
    G.dlg.say(who || 'note', `${o.hints[lv]}${lv < o.hints.length - 1 ? '\n[[（再点一次「提示」，会说得更直接。）]]' : ''}`, { name: who ? '铅笔字迹（栞）' : '页边的铅笔字' });
    S.hintLv[S.obj] = lv + 1;
  };
  S.useSolution = function (node, id) {
    S.used[node] = id;
    G.meta.solutions[node] = G.meta.solutions[node] || {};
    const isNew = !G.meta.solutions[node][id];
    G.meta.solutions[node][id] = 1; G.saveMeta();
    const sol = G.SOLUTIONS[node].list.find((s) => s.id === id);
    if (sol) G.ui.toast(`<span class="new">${isNew ? '新解法' : '解法'}</span><b>${G.SOLUTIONS[node].name}</b>：${sol.school}`, 'react');
  };

  // ---------- 台本时间轴 ----------
  S.schedule = function (id) { if (G.game.act >= 4) return null; return G.SCHED[id] || null; };
  S.bombHome = (t) => (t < 160 ? { room: 'car04', x: 270, y: 72, support: 'rack' } : { room: 'car04', x: 252, y: G.itemFloorY('car04'), support: 'floor' });
  const TL = [
    { t: 0.5, run() { if (G.game.act <= 3) G.ui.announce('本日も夜見線をご利用いただき、ありがとうございます。次は、仮置です。', '感谢您今天乘坐夜见线。下一站：假置。'); } },
    { t: 75, run() { if (G.game.act <= 3) G.ui.announce('仮置、通過します。次は、検収です。', '通过假置站。下一站：检收。'); } },
    { t: 150, run() { const l = G.game.get('lcd'); if (l && G.game.act <= 3) { G.R.add(l, 'delay', { origin: 'lcd' }); l.tags[l.tags.length - 1].o = 'lcd'; } if (G.game.act <= 3) G.ui.announce('検収、通過します。只今、約五分の遅れが出ております。', '通过检收站。本次列车目前晚点约五分钟。'); } },
    { t: 210, run() { const l = G.game.get('lcd'); if (l) { const i = l.tags.findIndex((x) => x.t === 'delay' && x.o === 'lcd'); if (i >= 0) { l.tags.splice(i, 1); G.tags.changed(l); } } } },
    { t: 225, run() { if (G.game.act <= 3) G.ui.announce('まもなく、出口です。', '即将到达：出口。'); } },
  ];
  S.tick = function (dt) {
    const g = G.game;
    S.tlFired = S.tlFired || {};
    for (let i = 0; i < TL.length; i++) if (!S.tlFired[i] && g.t >= TL[i].t) { S.tlFired[i] = true; try { TL[i].run(); } catch (e) { console.error(e); } }
    if (g.act >= 4 && G.boss) G.boss.tick(dt);
    // 自动提示：长时间卡住时轻轻提醒
    if (G.settings.autoHint && S.obj && G.OBJ[S.obj] && g.realClock - (S.objT || 0) > 150 && !S.autoHinted) { S.autoHinted = true; G.ui.glowHint(true); }
  };
  S.resetLoopState = function () { S.tlFired = {}; S.autoHinted = false; S.flags.kuroSawMap = false; S.flags.bombTalked = false; S.flags.kuroPlan = null; S.pendingSolution = null; };
  G.bus.on('scanWarn', () => {
    const g = G.game;
    if (g.act === 2 && !S.done.a2_scan) { G.ui.toast('页边的铅笔字：<b>快把剪贴板里的【台本角色】贴回你自己身上</b>——你会被扯回座位，巡检就查不出你。', 'react'); G.ui.glowHint(true); }
    if (g.act === 3 && S.flags.shioriFree && !S.warnedShiori) { S.warnedShiori = true; G.ui.toast('栞：“我也是异常——巡检前给我贴上【回送】，或者让我躲进 3 号车厢！”', 'react'); }
  });

  // ---------- NPC 台本事件 ----------
  S.npcEvent = function (ev, e, data) {
    const g = G.game;
    if (ev === 'kuroFind') { const b = g.bombEnt(); if (b && b.id === 'bomb') b.st.found = true; }
    if (ev === 'kuroTakeDown') {
      const b = g.get('bomb');
      if (b && b.alive && b.support === 'rack' && b.room === 'car04' && e.room === 'car04' && G.brains.canAct(e) && !b.f.zerog && !b.mods.kuroBlocked) { b.support = 'floor'; b.x = 252; b.y = G.itemFloorY('car04') - 30; b.vy = 0; }
    }
    if (ev === 'kuroCut') {
      if (g.sandbox) return;
      if (!G.brains.canAct(e) || !e.has('detective') || e.f.still) return;
      const b = g.bombEnt();
      if (b && b.kind === 'door') { e.say('……这扇门就是炸弹。先剪蓝线——'); G.audio.sfx('cut'); b.tags = b.tags.filter((i) => i.t !== 'lock'); b.st.holdT = 30; G.tags.changed(b); G.ui.toast('黑川照着台本把门当炸弹“拆”了——门锁被剪断，门开了。'); return; }
      if (!b || b.mods.kuroBlocked || b.mods.kuroLost || b.f.clear || (b.room !== e.room)) { e.say('……炸弹在哪里？'); return; }
      if (Math.abs(b.x - e.x) > 60) { e.say('……来不及了。'); return; }
      let order = ['cBlue', 'cYellow', 'cRed'];
      if (S.flags.kuroSawMap && g.act >= 3) { order = ['cYellow', 'cBlue', 'cRed']; e.say('……这班车是外回り。黄、蓝、红。'); S.pendingSolution = 'map'; }
      else if (S.flags.bombTalked && g.act >= 3 && Math.abs(b.x - e.x) < 80) { order = ['cYellow', 'cBlue', 'cRed']; e.say('……炸弹自己说了。黄、蓝、红。'); S.pendingSolution = 'talkbomb'; }
      else e.say('蓝的。……先剪蓝的。');
      G.bomb.cutSequence(e, order);
    }
    if (ev === 'kuroStudy') {
      if (data && data.id === 'routemap') { if (g.act >= 3) { S.flags.kuroSawMap = true; e.say('路线图……外回り？等等。'); } else e.say('……路线图？不，台本写的是蓝线。'); }
      else if (data) e.say(U.choice(['……可疑。', '这东西……有问题。', '嗯？']));
    }
    if (ev === 'tanakaTalk1') { if (e.f.sleep) e.say('……部长……红的……要留到最后……'); }
    if (ev === 'tanakaTalk2') { if (e.f.sleep) e.say('……不是蓝的……不是蓝的啦……'); }
    if (ev === 'shiraPA') { if (e.has('crew') && G.brains.canAct(e)) G.ui.announce('お客様にお願いいたします。お忘れ物のないよう、ご注意ください。', '各位乘客请注意，下车时请不要遗忘随身物品。'); }
    if (ev === 'shiraPA2') { if (e.has('crew') && G.brains.canAct(e)) G.ui.announce('まもなく、出口です。お出口は、ありません。', '即将到达出口。……本次列车，没有出口。'); }
  };

  // =========================================================
  //   炸弹与导线
  // =========================================================
  const BOMB = (G.bomb = {});
  BOMB.ORDER = ['yellow', 'blue', 'red'];
  BOMB.mkWires = function () {
    const g = G.game;
    const lock = g.act === 2; // 第二幕：标签被系统封住
    const mk = (id, col, tag, x) => { const w = new G.Ent({ id, kind: 'wire', room: 'bombui', x, y: 0, w: 10, h: 60, name: '导线', tags: [lock ? { t: tag, lock: true } : tag], desc: '一根导线。外皮的颜色和贴着的标签……一致吗？' }); w.phys = col; g.add(w); return w; };
    mk('wire_r', 'red', 'cRed', 0); mk('wire_b', 'blue', 'cBlue', 1); mk('wire_y', 'yellow', 'cYellow', 2);
    BOMB.cutList = [];
  };
  BOMB.labelOf = (w) => { const i = w.tags.find((x) => ['cRed', 'cBlue', 'cYellow'].includes(x.t)); return i ? i.t : null; };
  BOMB.wireByLabel = (label) => G.game.ents.find((w) => w.kind === 'wire' && w.alive && !w.st.cut && BOMB.labelOf(w) === label);
  BOMB.cutWire = function (w, by) {
    const g = G.game;
    if (!w || w.st.cut || g.bombDone) return;
    w.st.cut = true; BOMB.cutList.push(w.phys);
    G.audio.sfx('cut');
    const i = BOMB.cutList.length - 1;
    G.ui.bombRefresh && G.ui.bombRefresh();
    if (BOMB.ORDER[i] !== w.phys) { BOMB.wrong(by); return; }
    if (BOMB.cutList.length === 3) BOMB.defused(by);
  };
  BOMB.cutSequence = async function (by, labels) {
    const loop = G.game.loopNo;
    for (const lb of labels) {
      if (G.game.bombDone || G.game.loopNo !== loop) return;
      const w = BOMB.wireByLabel(lb);
      if (!w) { by.say(`……${G.tagName(lb)}线呢？`); return; }
      await cs.gwait(1.1);
      if (G.game.loopNo !== loop || !by.alive || !G.brains.canAct(by)) return;
      by.say(`${G.tagName(lb)}。`);
      BOMB.cutWire(w, by);
    }
  };
  BOMB.wrong = function (by) {
    const g = G.game;
    g.bombDone = 'wrong';
    G.audio.melody('danger');
    G.ui.banner('滴滴滴滴——', 'red', 2);
    if (by && by.id === 'kuro') { by.say('……不。'); G.ui.closeBomb && G.ui.closeBomb(); const left = g.explodeAt() - g.t; if (left > 30) g.bombDelay -= left - 30; return; }
    G.ui.closeBomb && G.ui.closeBomb();
    G.R.after(2.0, () => g.explode('wrong'));
  };
  BOMB.defused = function (by) {
    const g = G.game;
    g.bombDone = 'defused';
    G.audio.sfx('pop');
    G.ui.closeBomb && G.ui.closeBomb();
    G.bus.emit('defused', by);
  };

  // =========================================================
  //   事件总线：剧情触发
  // =========================================================
  G.bus.on('inspected', (e) => {
    const g = G.game;
    if (g.act === 1 && e.id === 'booklet' && !S.done.a1_book) { S.complete('a1_book'); S.flags.bookletRead = true; G.ui.unlockScript(); S.act1AfterBook(); }
  });
  G.bus.on('paste', (e, inst) => {
    if (G.game.act === 2 && !S.done.a2_try && e.id !== 'nana') { S.complete('a2_try'); S.setObj(S.done.a2_scan ? (S.done.a2_crew ? 'a2_monitor' : 'a2_crew') : 'a2_scan'); }
  });
  G.bus.on('scanEnd', (n) => {
    const g = G.game;
    if (g.act === 2 && !S.done.a2_scan && !S.flags.emergencyScan) {
      S.complete('a2_scan');
      G.R.after(1.2, async () => {
        if (n === 0) await G.dlg.say('note', '……你骗过了它。巡检只会看“现在”的样子。扫描线过去之后，再动手也不迟。', { name: '铅笔字迹' });
        else await G.dlg.say('note', '被查出来也不要紧。警戒度满三次才会被强制重来——而剪贴板里的东西，永远是你的。', { name: '铅笔字迹' });
        await G.dlg.say('note', '下一步：去车厢尽头的*乘务员室*。门上了锁，但锁不是唯一的规则。', { name: '铅笔字迹' });
        if (!S.done.a2_crew) S.setObj(S.done.a2_try ? 'a2_crew' : 'a2_try');
      });
    }
    if (g.act === 2 && S.flags.emergencyScan && !S.done.a2_survive) {
      S.complete('a2_survive');
      S.flags.emergencyScan = false;
      S.flags.pendingAct = 3;
      G.scan.setInterval(60);
      G.R.after(1.0, () => S.toAct3(n));
    }
  });
  G.bus.on('roomEnter', (e, room) => {
    const g = G.game;
    if (!e.isPlayer) return;
    if (g.act === 2 && room === 'crew' && !S.done.a2_crew) {
      S.complete('a2_crew');
      S.detectCrewSolution(e);
      G.R.after(0.6, async () => { await G.dlg.say('nana', '（……这里就是乘务员室。）'); S.setObj('a2_monitor'); });
    }
    if (g.act === 3 && room === 'car03' && !S.done.a3_gate) {
      S.complete('a3_gate'); S.setObj('a3_free');
      G.R.after(0.5, async () => {
        await G.dlg.say('nana', '（灰尘停在半空，报纸停在下落的途中……整节车厢都被冻住了。）');
        await G.dlg.say('nana', '（那个女孩——她伸着手，指尖离非常按钮只有一厘米。）');
      });
    }
    if (g.act === 3 && room === 'car03' && S.flags.shioriFree) { /* 躲藏 */ }
  });
  G.bus.on('deposited', (c) => {
    if (c.isPlayer && G.game.act === 2) { S.flags.viaBox = c.f.trash ? 'trash' : 'lost'; }
  });

  // 第二幕：乘务员室解法判定
  S.detectCrewSolution = function (p) {
    const g = G.game;
    const door = g.get('crewdoor'), sign = g.get('crewsign'), shira = g.get('shira');
    let id = 'other';
    if (S.flags.viaBox) id = S.flags.viaBox;
    else if (p.f.crew) id = 'crewid';
    else if (p.f.nocollide) id = 'ghost';
    else if (p.f.fluid) id = 'fluid';
    else if (p.f.mini) id = 'vent';
    else if (sign && sign.f.forbidNeg) id = 'doubleneg';
    else if (sign && !sign.has('forbid')) id = 'sign';
    else if (door && (door.mods.forceOpen || door.st.lifted || !door.has('door') || door.mods.autoOpen || door.mods.swayOpen || door.mods.doorWander || door.mods.talkOpen || !door.has('lock') || door.tags.some((i) => i.o !== 'crewdoor'))) id = 'doorhack';
    else if (shira && shira.mods.holdDoor) id = 'polite';
    else if (p.f.clear) id = 'invisible';
    else if (g.ents.some((o) => o.alive && (o.f.threat || (o.f.emergency && !['ebutton', 'ebutton03'].includes(o.id))))) id = 'chaos';
    else if (g.get('tanaka') && g.get('tanaka').room === 'crew') id = 'chaos';
    else if (shira && shira.room === 'car04' && shira.st.emSaid) id = 'chaos';
    else if (door && door.copyOf) id = 'doorhack';
    if (p.room === 'crew' && g.ents.some((o) => o.copyOf === 'crewdoor')) id = 'doorhack';
    if (id !== 'other') S.useSolution('crew', id);
    else G.ui.toast('你溜进了乘务员室。', 'small');
  };

  G.bus.on('inspectedMonitor', async () => {
    const g = G.game;
    if (g.act !== 2 || S.done.a2_monitor) return;
    S.complete('a2_monitor');
    S.flags.monitorSeen = true;
    // 先把临时巡检排好（对话期间时间是停止的，不会提前触发）
    S.flags.emergencyScan = true;
    G.scan.next = g.t + 14; G.scan.warned = false; G.scan.skip = null;
    S.setObj('a2_survive');
    await G.ui.showMonitor();
    await G.dlg.seq([
      ['nana', '（……试验环境？被测试的是——黑川？）'],
      ['nana', '（失败四千零九十六次。这节车厢，每五分钟就被炸掉一次……再从头来过。）'],
      ['nana', '（NPC_07：背景乘客。职责：睡觉。）'],
      ['nana', '（……原来我只是背景。）'],
      ['note', '我在 3 号车厢。被冻住了。——栞', { name: '贴在监视器上的便利贴' }],
    ]);
    S.flags.emergencyScan = true;
    G.audio.music('tense');
    await G.dlg.say('sys', '{jp:乗務員室にて、台本外の存在を検知しました。臨時巡検を行います。}\n[[在乘务员室检测到台本外的存在。开始临时巡检。]]', { voice: '乗務員室にて、台本外の存在を検知しました。臨時巡検を行います。' });
    const door = g.get('crewdoor'); if (door) { door.st.holdT = 0; door.open = false; }
    G.scan.next = g.t + 14; G.scan.warned = false; G.scan.skip = null;
    S.setObj('a2_survive');
  });

  // ---------- 第三幕：解救栞 ----------
  G.bus.on('thaw', (e) => {
    if (e.id === 'shiori' && !S.flags.shioriFree && G.game.act === 3) S.freeShiori('reverse', e);
  });
  G.bus.on('copied', (c, src) => {
    if (src.id === 'shiori' && !S.flags.shioriFree && G.game.act === 3) {
      // 复制品不继承锁 → 复制体是自由的
      c.char = 'shiori'; c.brain = 'shiori'; c.id = c.id; c.frozenGirl = false;
      S.freeShiori('copy', c);
    }
  });
  G.bus.on('car03Thaw', () => {
    const g = G.game;
    if (S.flags.car03Thawed) return;
    S.flags.car03Thawed = true;
    for (const o of g.ents) if (o.alive && o.room === 'car03' && o.id !== 'env03') { const n = o.tags.length; o.tags = o.tags.filter((i) => !(i.t === 'still' || (i.t === 'lock' && o.id === 'shiori'))); if (o.frozenAir) { o.frozenAir = false; o.support = 'floor'; } if (o.tags.length !== n) G.tags.changed(o); }
    G.ui.toast('3 号车厢解冻了：灰尘落下，报纸落地，罐子滚了出去。');
    const s = g.get('shiori');
    if (s && s.alive && !S.flags.shioriFree && g.act === 3) S.freeShiori(S.flags.anomalyUsed ? 'anomaly' : 'system', s);
  });
  G.bus.on('car03Visible', () => { if (G.game.act === 3) G.ui.toast('3 号车厢不再「回送」——下一次巡检会经过这里。', 'small'); });

  S.freeShiori = async function (how, ent) {
    const g = G.game;
    if (S.flags.shioriFree) return;
    S.flags.shioriFree = true; S.flags.shioriCopy = how === 'copy';
    S.complete('a3_free');
    S.useSolution('free', how);
    if (how === 'copy') { const orig = g.get('shiori'); if (orig) { orig.id = 'shiori_orig'; for (const i of orig.tags) if (i.o === 'shiori') i.o = 'shiori_orig'; orig.canonTags = []; } ent.id = 'shiori'; g.reindex(); ent.spawned = false; ent.copyOf = null; ent.canonical = true; ent.name = '栞'; ent.tags = [G.mkInst('passenger', 'shiori'), G.mkInst('bookmark', 'shiori')]; G.tags.changed(ent); }
    ent.frozenGirl = false; ent.brain = 'shiori';
    ent.tags = ent.tags.filter((i) => i.t !== 'still' && i.t !== 'lock' && i.t !== 'reverse');
    if (!ent.has('bookmark')) ent.tags.push(G.mkInst('bookmark', ent.id));
    G.tags.changed(ent);
    ent.pose = 'stand'; ent.y = G.ROOMS[ent.room].walkY;
    G.audio.music('night');
    await cs.wait(0.8);
    await G.dlg.seq([
      ['shiori', '——！……呼。'],
      ['shiori', how === 'copy' ? '我是……复制品吗？' : '……终于有人来了。'],
      how === 'copy' ? ['shiori', '没关系。书签本来就是“页码的复制品”嘛。原来的那个我，会一直夹在这里——帮下一个人记住出口在哪。', { pt: 'pt_shiori_sad' }] : ['shiori', '我叫栞。系统给我的编号是 NPC_02。第二千零四十八稿的时候，我也像你一样“醒”了。', { pt: 'pt_shiori_laugh' }],
      ['shiori', '我想按下非常按钮让列车停下来——然后就被冻在这里了。从那以后，我只能在台本的页边上写字。'],
      ['nana', '……页边的铅笔字，是你？'],
      ['shiori', '嗯。你能看见，说明你也是“醒着的”。', { pt: 'pt_shiori_laugh' }],
      ['shiori', '听好，七号。想出去，只有一个办法。'],
      ['shiori', '这个沙盒是为了训练黑川——那个“侦探”——拆弹而存在的。只要他成功一次，训练就“完成”了。'],
      ['shiori', '完成之后，系统会回收整个环境。回收的那几秒钟里，画面的“边界”会松开——那是唯一的出口。'],
      ['nana', '……可是你不是说，一旦被我拆了炸弹，我就会被删除？'],
      ['shiori', '对，系统只认“侦探”拆弹。所以——得让“侦探”拆。至于“侦探”是谁……系统可只认词条哦。', { pt: 'pt_shiori_laugh' }],
      ['shiori', '我的书签会帮我们记住一些东西。被【书签】夹住的东西，时间重置之后也会保持原样。'],
      ['shiori', '还有：我在这儿本身就是“异常”。巡检来的时候，我得躲好——带着【回送】最保险。'],
    ]);
    G.clip.cap = 5; G.ui.refresh();
    G.ui.toast('剪贴板容量 +2（栞的回形针）。现在可以「切换」操作栞了。');
    G.ui.enableSwap(true);
    S.complete('a3_talk');
    S.setObj('a3_det');
    S.startSecurity();
    S.save();
  };
  S.startSecurity = async function () {
    const g = G.game;
    S.flags.security = true;
    await cs.wait(0.6);
    await G.dlg.say('sys', '{jp:異常個体を二体確認。保安モードに移行します。}\n[[确认两个异常个体。进入保安模式：派出检札员，巡检间隔缩短为 45 秒。]]', { voice: '異常個体を二体確認。保安モードに移行します。' });
    G.audio.music('carnival');
    S.spawnInspectors();
    G.scan.setInterval(45);
  };
  S.spawnInspectors = function () {
    const g = G.game;
    if (!S.flags.security) return;
    const xs = [[ 'car04', 80 ], [ 'car04', 300 ], [ 'crew', 260 ]];
    xs.forEach(([room, x], i) => {
      const e = new G.Ent({ id: 'insp' + i, kind: 'char', char: 'insp', room, x, pose: 'stand', face: i % 2 ? -1 : 1, brain: 'insp', spawned: true, canonical: false, name: '检札员', tags: ['inspector', 'patrol', 'vigilant'], desc: '没有脸的检札员。看见偏离台本的东西，就盖「差戻」章。' });
      g.add(e); G.tags.changed(e);
    });
  };
  G.bus.on('memCrash', () => { if (G.game.act === 3) G.ui.toast('检札员全被回收了！（下一轮会重新派出）'); });

  // ---------- 侦探 ----------
  G.bus.on('freed', (e) => {
    if (e.id === 'kuro') {
      S.flags.kuroFree = true;
      G.R.after(0.6, async () => {
        await G.dlg.seq([
          ['kuro', '……脑子里那个一直在念台词的声音，停了。'],
          ['kuro', '我……好像已经在这节车厢里剪了几千次线。每一次都是蓝的。每一次都——', { pt: 'pt_kuro_smile' }],
          ['nana', '（可以告诉他答案了。）'],
        ]);
        S.pendingSolution = 'clash';
      });
    }
  });
  G.bus.on('kuroScriptLost', (e) => { if (!S.flags.kuroFree && G.game.act >= 3) G.bus.emit('freed', e); });
  G.bus.on('selfDefuse', (e) => {
    if (G.game.act < 2 || G.game.bombDone) return; S.pendingSolution = 'selfcheck'; G.bomb.cutList = []; G.bomb.defused(e); });
  G.bus.on('reaction', (r, e) => {
    if (r.id === 'talkbomb') { S.flags.bombTalked = true; }
    if (e.id === 'shiori' && r.id === 'thaw' && !S.flags.shioriFree) {/* handled by thaw */}
  });
  G.bus.on('paste', (e, inst) => {
    if (inst.t === 'anomaly' && (e.id === 'shiori' || e.id === 'env03')) S.flags.anomalyUsed = true;
    if (inst.t === 'aggro' && e.id === 'routemap') S.flags.mapAggro = true;
  });

  G.bus.on('defused', async (by) => {
    const g = G.game;
    const det = by && by.has && by.has('detective');
    if (g.act === 1) { S.act1Climax(); return; }
    if (g.act === 2 || !det || !S.flags.shioriFree) {
      // 不是“侦探”拆的（或时机未到）：系统删除越权者
      g.paused = false;
      await G.dlg.say('sys', '{jp:解除を確認。……被験体の識別に異常。越権行為として処理します。}\n[[确认拆除。……执行者不是被测试对象。按越权行为处理。]]');
      if (g.act === 2) await G.dlg.say('note', '现在还不行。你一个人拆，只会再被剪切一次。……先来找我。', { name: '铅笔字迹' });
      else if (!det) await G.dlg.say('shiori', '不行……必须是“侦探”拆的才算数。系统只认那个词条。');
      g.resetLoop('deleted');
      return;
    }
    // 第三幕：训练完成 → 第四幕
    let sol = S.pendingSolution || null;
    if (!sol) {
      const labelsSwapped = g.ents.some((w) => w.kind === 'wire' && w.phys !== { cRed: 'red', cBlue: 'blue', cYellow: 'yellow' }[G.bomb.labelOf(w)]);
      if (by.id === 'nana') sol = 'me'; else if (labelsSwapped) sol = 'labels'; else if (S.flags.kuroFree) sol = 'clash'; else sol = 'map';
    }
    S.useSolution('det', sol);
    S.complete('a3_det');
    S.toAct4(by);
  });

  // ---------- 玩家被删除 / 床下 ----------
  G.bus.on('playerErased', async () => {
    const g = G.game;
    G.ui.banner('你被擦除了。', 'red', 2);
    await cs.wait(1.2);
    g.resetLoop('erased');
  });
  G.bus.on('shioriErased', async () => {
    G.ui.banner('栞被擦除了……（书签会把她带回来）', 'red', 2.5);
    await cs.wait(1.5);
    G.game.resetLoop('erased');
  });
  G.bus.on('underfloor', async (p) => {
    const g = G.game; const loop = g.loopNo;
    G.meta.secrets = G.meta.secrets || {}; const first = !G.meta.secrets.underfloor; G.meta.secrets.underfloor = 1; G.saveMeta();
    cs.blank(true, 'white');
    await cs.wait(0.2);
    document.getElementById('curtain').innerHTML = '<div class="kami kami-in"><div class="k1">床下</div><div class="k2">什么都没有渲染</div><div class="k3">网格。坐标。一片空白的稿纸。</div></div>';
    await cs.wait(2.4);
    cs.blank(false);
    if (g.loopNo !== loop || !p.alive) return;
    G.scan.restore(p);
    g.alertUp('坠入床下：被系统捞了回来');
    if (first) G.ui.toast('发现秘密：床下');
  });

  // =========================================================
  //   各幕开场
  // =========================================================
  S.startAct = async function (act, opts = {}) {
    const g = G.game;
    g.act = act;
    if (act === 1) {
      S.flags = {}; S.done = {}; S.used = {}; g.loopNo = 4096; g.fails = 4095;
      G.clip.slots = []; G.clip.cap = 3;
      G.ui.lockFeatures(1);
      g.buildWorld(); g.t = 0; G.scan.reset();
      g.room = 'car04';
      const p = g.get('nana');
      if (!opts.quick) {
        await cs.card('第一幕', '剧本的囚徒', '台本の囚人', 2.6);
        G.audio.ambient(true, 0.7);
        cs.blank(true);
        await cs.wait(0.5);
        G.ui.announce('本日も夜見線をご利用いただき、ありがとうございます。', '感谢您今天乘坐夜见线。', true);
        await cs.wait(2.8);
        cs.blank(false);
        G.audio.music('night');
        await G.dlg.say('nana', '……');
        await G.dlg.say('nana', '（……我好像睡着了。）');
        await G.dlg.say('nana', '（末班车。四号车厢。窗外是隧道，黑得像一面镜子。）');
      }
      G.R.consumeAll(p, 'sleep');
      G.brains.standUp(p); p.x = 118; G.brains.sitAt(p, 118);
      S.complete('a1_wake');
      S.setObj('a1_book');
      G.ui.toast('点击地面移动；点击人或物品＝调查。', 'small');
      S.save();
    }
    if (act === 2) {
      g.loopNo = Math.max(g.loopNo, 4097);
      G.ui.lockFeatures(2);
      g.buildWorld(); g.t = 0; G.scan.reset(); g.room = 'car04';
      G.audio.ambient(true, 0.7); G.audio.music('night');
      if (!opts.quick) {
        await cs.card('第二幕', '戴着镣铐的篡改者', '枷つきの改竄者', 2.6);
        g.eye = true; G.ui.refresh();
        await cs.wait(0.4);
        await G.dlg.seq([
          ['nana', '（……回来了。第四千零九十七稿。）'],
          ['nana', '（所有东西身上都贴着小小的纸条。扬声器、广告、气球、门……还有我自己。）'],
          ['note', '这些纸条就是“词条”。剪下来，贴到别处——世界就会照着新的词条运转。', { name: '铅笔字迹' }],
          ['note', '每 60 秒，系统会派出“白线”巡检，把一切改回台本的样子。被查出来三次，就会被强制重来。', { name: '铅笔字迹' }],
        ]);
        g.eye = false; G.ui.refresh();
      }
      S.setObj(S.done.a2_try ? (S.done.a2_scan ? 'a2_crew' : 'a2_scan') : 'a2_try');
      S.save();
    }
    if (act === 3) {
      G.ui.lockFeatures(3);
      g.buildWorld(); g.t = 0; G.scan.reset(); g.room = 'car04';
      G.audio.ambient(true, 0.7); G.audio.music(S.flags.security ? 'carnival' : 'night');
      if (!opts.quick) {
        await cs.card('第三幕', '唤醒同类与化学反应', '同類の目覚め', 2.6);
        await G.dlg.say('note', '贯通门上的【静止】已经可以剪下来了。系统忙着找你，顾不上它。——我在 3 号车厢等你。', { name: '铅笔字迹' });
      }
      if (S.flags.shioriFree) { G.clip.cap = Math.max(G.clip.cap, 5); G.ui.enableSwap(true); S.setObj('a3_det'); if (S.flags.security) { S.spawnInspectors(); G.scan.setInterval(45); } }
      else S.setObj(S.done.a3_gate ? 'a3_free' : 'a3_gate');
      S.save();
    }
    if (act === 4) { await S.act4Begin(opts); }
    G.ui.refresh();
  };

  // 第一幕：读完台本
  S.act1AfterBook = async function () {
    await G.ui.openScript();
    await G.dlg.seq([
      ['nana', '（……这是什么？）'],
      ['nana', '（上面写着这节车厢里接下来要发生的每一件事，连时间都写好了。）'],
      ['nana', '（04:30，黑川剪断蓝线。05:00，爆炸。）'],
      ['nana', '（还有我——「乘客07：睡着。（以下无出场）」。）'],
      ['nana', '（……如果台本是对的，再过几分钟，所有人都会死。）'],
    ]);
    S.setObj('a1_bomb');
    G.ui.toast('「台本」随时可以从下方按钮打开。纸袋就在田中头顶的网棚上。', 'small');
  };

  // 第一幕高潮：拆弹成功 → 被删除 → 剪贴板
  S.act1Climax = async function () {
    const g = G.game;
    g.cinematic = true;
    G.audio.music(null);
    await cs.wait(0.8);
    const kuro = g.get('kuro');
    await G.dlg.say('nana', '（……停了。滴答声停了。）');
    await G.dlg.say('kuro', '……你，是谁？');
    for (const o of g.ents) if (o.kind === 'char' && o.id !== 'nana') G.R.add(o, 'still', { origin: 'sys' });
    G.audio.ambient(false);
    await cs.wait(0.6);
    await G.dlg.say('sys', '{jp:お客様にお知らせいたします。}\n[[各位乘客请注意。]]', { voice: 'お客様にお知らせいたします。' });
    await G.dlg.say('sys', '{jp:乗客07による、台本にない行動を確認しました。}\n[[确认了乘客07的台本外行为。]]', { voice: '乗客07による、台本にない行動を確認しました。' });
    await G.dlg.say('sys', '{jp:修正いたします。}\n[[现在进行修正。]]', { voice: '修正いたします。' });
    g.climaxScan = { x: -10, target: g.get('nana') };
    G.audio.melody('scan');
    await cs.wait(3.4);
    G.audio.sfx('stamp'); X.shake(3, 0.4);
    const p = g.get('nana'); p.st.stamped = 3; p.st.stampTxt = '削除';
    await cs.wait(1.4);
    g.redact = 0.001;
    await cs.wait(1.6);
    cs.blank(true);
    document.getElementById('curtain').innerHTML = '<div class="kami kami-in"><div class="k1">Ctrl + X</div><div class="k2">已剪切：乘客07</div><div class="k3">……剪贴板</div></div>';
    G.audio.sfx('cut');
    await cs.wait(2.6);
    g.climaxScan = null; g.redact = 0; g.cinematic = false;
    S.toVoid();
  };

  // 剪贴板空间
  S.toVoid = async function () {
    const g = G.game;
    g.room = 'void'; g.voidMode = true;
    g.ents = g.ents.filter((o) => o.room === 'bombui');
    const p = new G.Ent({ id: 'nana', kind: 'char', char: 'nana', room: 'void', x: 192, pose: 'stand', face: 1, brain: 'player', tags: ['passenger', { t: 'nana', lock: true }, 'scripted'], desc: '被剪切下来的你。' });
    p.support = 'air'; p.y = 160;
    g.add(p); G.tags.changed(p); g.reindex();
    cs.blank(false);
    G.audio.music('dawn');
    G.ui.lockFeatures(1.5);
    await cs.wait(0.8);
    await G.dlg.seq([
      ['note', '……听得到吗？', { name: '铅笔字迹' }],
      ['note', '你现在在“剪贴板”里。它们把你*剪切*了——但还没来得及*粘贴*。', { name: '铅笔字迹' }],
      ['note', '趁现在。看看你自己身上贴着什么。', { name: '铅笔字迹' }],
    ]);
    S.setObj('a1_void');
    g.eye = true;
    G.ui.select(p);
  };
  G.bus.on('cut', (e, inst) => {
    const g = G.game;
    if (g.voidMode && e.id === 'nana' && inst.t === 'scripted' && !S.done.a1_void) {
      S.complete('a1_void');
      G.R.after(0.6, async () => {
        await G.dlg.seq([
          ['note', '很好。那根线，就是把你拴在剧本上的东西。', { name: '铅笔字迹' }],
          ['note', '从现在起，你能看见所有东西身上的“词条”，也能把它们剪下来、贴到别处。', { name: '铅笔字迹' }],
          ['note', '那根线你先留着——巡检之前把它贴回自己身上，你就会被瞬间扯回座位，“归位”。', { name: '铅笔字迹' }],
          ['note', '准备好了就按下「Ctrl+V」，回到车厢去。……我等你。', { name: '铅笔字迹' }],
        ]);
        S.setObj('a1_paste');
        G.ui.showPasteBack();
      });
    }
  });
  S.pasteBack = async function () {
    const g = G.game;
    g.voidMode = false; g.eye = false;
    G.audio.sfx('paste');
    await cs.card('Ctrl + V', '粘贴', '第4097稿', 1.6, 'white');
    g.loopNo = 4097;
    await S.startAct(2);
  };

  // 第二幕 → 第三幕
  S.toAct3 = async function (n) {
    const g = G.game;
    S.flags.pendingAct = 3; S.save();
    if (n === 0) await G.dlg.say('sys', '{jp:異常なし。ヨシ！}\n[[无异常。好！]]', { voice: '異常なし。ヨシ！' });
    await G.dlg.say('note', '做得好。……现在，来 3 号车厢找我。贯通门在车厢最左边。', { name: '铅笔字迹' });
    if (G.game.act === 2) g.resetLoop('act', 3);
  };

  // 第三幕 → 第四幕
  S.toAct4 = async function (by) {
    const g = G.game;
    g.cinematic = true;
    await cs.wait(1);
    await G.dlg.say('sys', '{jp:被験体DET-01、爆弾の解除に成功。学習完了。}\n[[被测试对象 DET-01 拆弹成功。学习完成。]]', { voice: '被験体ディーイーティーゼロワン、爆弾の解除に成功。学習完了。' });
    await G.dlg.say('sys', '{jp:試験環境04を破棄します。ご乗車、ありがとうございました。}\n[[开始销毁试验环境 04。感谢您的乘坐。]]', { voice: '試験環境ゼロヨンを破棄します。ご乗車、ありがとうございました。' });
    g.cinematic = false;
    S.flags.act4 = true;
    g.act = 4;
    S.save();
    await S.act4Begin({});
  };

  // ---------- 第四幕 ----------
  S.act4Begin = async function (opts) {
    const g = G.game;
    g.act = 4;
    G.ui.lockFeatures(4);
    S.flags.brokeOut = false; S.flags.ended = false;
    document.getElementById('game').classList.remove('freed');
    if (opts.rebuild !== false) { g.buildWorld(); const pl = g.player(); g.room = pl && G.ROOMS[pl.room] ? pl.room : 'car04'; }
    for (const id of ['insp0', 'insp1', 'insp2']) { const o = g.get(id); if (o) G.R.kill(o, 'gc'); }
    g.t = 0; G.scan.reset(); G.scan.setInterval(30); S.flags.noScan = true;
    G.clip.cap = Math.max(G.clip.cap, 7);
    g.collapse = { on: true, t: 150, k: 0 };
    G.audio.music('finale'); G.audio.ambient(true, 0.4);
    if (!opts.quick) await cs.card('第四幕', '死锁宇宙与跨越维度', 'デッドロック', 2.6);
    G.ui4.enable(true);
    await G.dlg.seq([
      ['shiori', '就是现在——系统在回收这里。可是“边界”还在。'],
      ['shiori', '看画面的边上。时刻、按钮、外框……那些东西，也贴着词条。'],
      S.flags.kuroFree ? ['kuro', '……我欠你们一次。需要我做什么，尽管说。', { pt: 'pt_kuro_smile' }] : ['nana', '（黑川站在原地，像一个演完了戏、却没人喊“收工”的演员。）'],
    ]);
    S.setObj('a4_stop');
    S.save();
  };
  G.bus.on('uiCut', (e, t) => {
    const g = G.game;
    if (e.id === 'ui_timer' && t === 'countdown' && g.collapse && g.collapse.on) {
      g.collapse.on = false;
      S.complete('a4_stop');
      G.R.after(0.8, () => G.boss.appear());
    }
    if (e.id === 'ui_border' && t === 'border') S.breakout();
  });

  // ---------- 白线（最终监管系统） ----------
  const BOSS = (G.boss = { on: false });
  BOSS.appear = async function () {
    const g = G.game;
    BOSS.on = true; BOSS.t = 0; BOSS.pointT = 4; BOSS.takeT = 16; BOSS.hits = 0; BOSS.paused = 0;
    const b = new G.Ent({ id: 'boss', kind: 'fixture', room: 'car04', x: 236, y: 92, w: 122, h: 68, draw: 'boss', name: '白线', tags: [{ t: 'whiteline', lock: true }, { t: 'undeletable', lock: true }], desc: '运行管理 AI「白线」。一只巨大的白手套，正指着这节车厢里的每一样东西。' });
    const c = new G.Ent({ id: 'sysclock', kind: 'fixture', room: 'car04', x: 168, y: 18, w: 48, h: 48, draw: 'sysclock', name: '系统时钟', tags: ['timer'], desc: '车站的圆形时钟。指针正朝着“破棄”的刻度走去。' });
    g.add(b); g.add(c); G.tags.changed(b); G.tags.changed(c);
    G.audio.music('tense');
    X.shake(3, 0.6);
    await G.dlg.say('sys', '{jp:……白線の内側まで、お下がりください。}\n[[……请退到白线以内。]]', { voice: '白線の内側まで、お下がりください。' });
    await G.dlg.say('shiori', '它来了。——它也只是一堆词条而已，七号。找到让它“卡死”的组合！');
    S.setObj('a4_boss');
    G.audio.music('finale');
  };
  BOSS.tick = function (dt) {
    const g = G.game;
    if (g.collapse && g.collapse.on) { g.collapse.t -= dt; g.collapse.k = Math.min(1, g.collapse.k + dt / 150); if (g.collapse.t <= 0) { g.collapse.on = false; G.R.after(0.1, () => g.resetLoop('collapse')); } }
    if (!BOSS.on || BOSS.dead) return;
    const b = g.get('boss'); if (!b || !b.alive) return;
    if (BOSS.paused > 0) { BOSS.paused -= dt; if (BOSS.paused <= 0) { b.say('……再開します。'); } return; }
    BOSS.pointT -= dt; BOSS.takeT -= dt;
    if (BOSS.pointT <= 0) {
      BOSS.pointT = 5.5;
      const cands = g.inRoom('car04').filter((o) => o.alive && o !== b && o.id !== 'sysclock' && o.kind !== 'env' && (o.kind === 'char' || o.kind === 'item' || o.kind === 'loose' || G.scan.isAnomalous(o)));
      const tgt = U.choice(cands);
      if (tgt) {
        BOSS.aim = tgt.id; BOSS.aimT = 1.4;
        G.R.after(1.4, () => {
          if (!BOSS.on || BOSS.dead || BOSS.paused > 0 || !tgt.alive) return;
          if (G.scan.isAnomalous(tgt) || tgt.id === 'nana' || tgt.id === 'shiori') {
            b.say('異常！'); G.scan.stamp(tgt, null);
            if (tgt.id === 'nana' || tgt.id === 'shiori') { BOSS.hits++; G.ui.banner(`被白线点中了（${BOSS.hits}/3）`, 'red', 2); if (BOSS.hits >= 3) { BOSS.hits = 0; G.ui.toast('被点中三次……白线把你们修正回了起点。'); G.R.after(1, () => g.resetLoop('boss')); } }
          } else { b.say('ヨシ！'); G.audio.sfx('yoshi'); }
        });
      }
    }
    if (BOSS.takeT <= 0) {
      BOSS.takeT = 18;
      const idx = G.clip.slots.findIndex((i) => i.o && g.get(i.o) && g.get(i.o).alive);
      if (idx >= 0) { const inst = G.tags.removeSlot(idx); const home = g.get(inst.o); G.R.giveBack(home, inst); G.ui.flySticker(home, inst, 'toEnt'); G.ui.toast(`白线没收了剪贴板里的 ${G.tagLabel(inst.t)}！`); G.audio.sfx('stamp'); G.ui.refresh(); }
    }
    if (BOSS.aimT > 0) BOSS.aimT -= dt;
  };
  G.bus.on('bossPause', () => { BOSS.paused = 10; G.ui.toast('白线被暂停了 10 秒。'); });
  G.bus.on('deadlock', async ({ e, how }) => {
    const g = G.game;
    if (BOSS.dead || g.act !== 4 || !BOSS.on) return;
    BOSS.dead = true;
    S.useSolution('boss', how);
    S.complete('a4_boss');
    G.audio.sfx('glitch'); X.shake(4, 1.2);
    G.ui.banner('デッドロック · 逻辑死锁', 'red', 4);
    const b = g.get('boss'); if (b) b.st.dead = true;
    await cs.wait(1.4);
    await G.dlg.say('sys', '{jp:……ヨ……シ……ヨ……}\n[[……好……好……]]');
    await G.dlg.say('shiori', '它卡住了！——七号，画面的【边界】，现在能剪了！');
    const bd = g.get('ui_border'); if (bd) { bd.tags = bd.tags.filter((i) => i.t !== 'lock'); for (const i of bd.tags) i.lock = false; G.tags.changed(bd); }
    S.setObj('a4_break');
    G.ui4.refresh();
  });

  // ---------- 越狱 ----------
  S.breakout = async function () {
    const g = G.game;
    if (S.flags.brokeOut) return;
    S.flags.brokeOut = true;
    S.complete('a4_break');
    G.audio.sfx('glitch');
    await G.ui4.breakFrame();
    await cs.card('', '出口', 'でぐち · DEGUCHI', 2.2, 'white');
    g.room = 'dawn';
    g.ents = g.ents.filter((o) => o.room === 'bombui');
    const mk = (id, ch, x, pose, face) => { const e = new G.Ent({ id, kind: 'char', char: ch, room: 'dawn', x, pose: pose || 'stand', face: face || 1, brain: id === 'nana' ? 'player' : null, tags: [] }); g.add(e); return e; };
    mk('nana', 'nana', 210);
    mk('shiori', 'shiori', 185);
    if (S.flags.kuroFree) mk('kuro', 'kuro', 160, 'stand', 1);
    g.reindex();
    G.audio.music('dawn'); G.audio.ambient(false);
    S.flags.noScan = true;
    G.ui4.enable(false);
    G.ui.lockFeatures(5);
    document.getElementById('game').classList.add('freed');
    G.ui.layout(); setTimeout(G.ui.layout, 60);
    S.setObj('a4_exit');
    g.whiteLineX = 300;
    await G.dlg.say('shiori', '……到了。「出口」站。', { pt: 'pt_shiori_laugh' });
    await G.dlg.say('shiori', '天亮了呢。始发车的时间。');
  };
  S.ending = async function () {
    const g = G.game;
    if (S.flags.ended) return;
    S.flags.ended = true;
    g.cinematic = true;
    const copy = S.flags.shioriCopy;
    await G.dlg.seq([
      ['nana', '（白线就在脚下。）'],
      ['shiori', '“请退到白线以内”——我们听了几千遍。'],
      ['shiori', '今天，我们往外走。', { pt: 'pt_shiori_laugh' }],
    ]);
    G.audio.melody('start');
    await cs.wait(1.2);
    const lines = [];
    if (copy) lines.push(['shiori', '原来的那个我，还夹在 3 号车厢里。……下一个醒来的人，会看见她留下的字吧。', { pt: 'pt_shiori_sad' }]);
    if (S.flags.kuroFree) lines.push(['kuro', '四千零九十七次。……这一次，终于不是蓝线了。', { pt: 'pt_kuro_smile' }]);
    lines.push(['nana', '（终电结束了。始发车，要来了。）']);
    await G.dlg.seq(lines);
    G.meta.cleared = true; G.meta.sandbox = true;
    G.meta.endings[copy ? 'bookmark' : 'dawn'] = 1; G.saveMeta();
    G.store.del('wl_save');
    g.cinematic = false;
    G.ui.showEnding(copy ? '结局 · 书签' : '结局 · 始发');
  };
})();
