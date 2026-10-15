/* =========================================================
   brains.js —— NPC 状态机。每个角色先看“词条覆盖”（物理/心智状态），
   再看“职责”（乘务员处理非常/威胁/失物），最后才照台本时间轴行动。
   ========================================================= */
(function () {
  'use strict';
  const U = G.util, X = G.gfx;
  const B = (G.brains = {});

  // 座位
  G.SEATS = {
    car04: [50, 72, 94, 118, 140, 242, 264, 286, 308, 330],
    car03: [24, 52, 80, 214, 240, 266, 292],
    crew: [], void: [], dawn: [],
  };
  B.seatFree = function (room, x, who) {
    return !G.game.inRoom(room).some((o) => o !== who && o.kind === 'char' && o.alive && o.pose === 'sit' && Math.abs(o.x - x) < 12);
  };
  B.nearestSeat = function (e) {
    const seats = G.SEATS[e.room] || [];
    let best = null, bd = 1e9;
    for (const s of seats) { if (!B.seatFree(e.room, s, e)) continue; const d = Math.abs(s - e.x); if (d < bd) { bd = d; best = s; } }
    return best;
  };

  // 房间路线：car03 ↔ car04 ↔ crew
  B.exitToward = function (from, to) {
    const R = G.ROOMS[from];
    if (!R || from === to) return null;
    if (R.exits.length === 1) return R.exits[0];
    if (from === 'car04') return R.exits.find((x) => x.to === (to === 'car03' ? 'car03' : 'crew'));
    return R.exits[0];
  };

  // 行走速度
  B.speed = function (e) {
    const ch = G.CHARS[e.char] || { speed: 40 };
    let s = ch.speed;
    const f = e.f;
    if (f.heavy) s *= 0.4;
    if (f.drunk) s *= 0.8;
    if (f.giant) s *= 0.8;
    if (f.mini) s *= 0.8;
    if (f.fluid) s *= 0.45;
    if (f.zerog) s *= 0.5;
    if (G.game.floodRooms[e.room]) s *= 0.5;
    if (e.mods.stumble || e.mods.rampage) s *= 1.8;
    return s;
  };

  // 走向 (room, x)。返回 true 表示到达
  B.goTo = function (e, room, x, dt, opts = {}) {
    if (e.room !== room) {
      const ex = B.exitToward(e.room, room);
      if (!ex) return false;
      const ax = ex.x + (ex.side === 'left' ? 2 : -2);
      if (Math.abs(e.x - ax) > 3) { B.step(e, ax, dt, opts); return false; }
      const door = G.game.get(ex.door);
      const why = {};
      if (G.doorPassable(door, e, why)) {
        if (door && door.has && door.has('door') && !door.open) { door.st.holdT = Math.max(door.st.holdT || 0, opts.leaveOpen ? 12 : 1.2); G.audio.sfx('door'); }
        G.game.moveRoom(e, ex.to, ex.toX);
        return false;
      }
      e.st.walking = false;
      if (!e.st.blockedSaid || G.game.clock - e.st.blockedSaid > 6) { e.st.blockedSaid = G.game.clock; if (e.isPlayer) G.ui.toast(why.r || '过不去。'); }
      return false;
    }
    if (Math.abs(e.x - x) <= 2) { e.st.walking = false; return true; }
    B.step(e, x, dt, opts);
    return false;
  };
  B.step = function (e, tx, dt, opts = {}) {
    if (e.pose === 'sit' || e.pose === 'crouch') { e.pose = 'stand'; e.y = G.ROOMS[e.room].walkY; }
    const sp = B.speed(e) * (opts.run ? 1.6 : 1);
    const d = tx - e.x;
    // 人墙：前方贴身站着两个以上的人（例如一车厢的醉汉复制品）→ NPC 过不去
    if (!e.isPlayer && !e.f.nocollide && !e.f.fluid && Math.abs(d) > 2 && !e.mods.rampage) {
      const dir = Math.sign(d);
      let wall = 0;
      for (const o of G.game.inRoom(e.room)) { if (o === e || o.kind !== 'char' || o.placeholder || o.f.nocollide || o.f.fluid || o.f.reflection || o.held) continue; const dx = (o.x - e.x) * dir; if (dx > 2 && dx < 14) wall++; }
      if (wall >= 2) { e.st.walking = false; if (!e.st.wallSaid || G.game.clock - e.st.wallSaid > 6) { e.st.wallSaid = G.game.clock; e.say(e.id === 'shira' ? '对不起，请让一让……过不去……' : '……过不去。'); } return; }
    }
    const mv = Math.sign(d) * Math.min(Math.abs(d), sp * dt);
    e.x += mv;
    if (Math.abs(d) > 0.5) e.face = Math.sign(d);
    e.st.walking = Math.abs(mv) > 0.01;
    const R = G.ROOMS[e.room];
    e.x = U.clamp(e.x, R.minX, R.maxX);
  };
  B.sitAt = function (e, x) {
    if (e.pose !== 'sit' && G.game) e.st.poseAnim = { at: G.game.clock, dy: (e.y || 0) - G.ROOMS[e.room].sitY };
    e.x = x; e.pose = 'sit'; e.y = G.ROOMS[e.room].sitY; e.st.walking = false; e.face = x < 192 ? 1 : -1;
  };
  B.standUp = function (e) { if (e.pose !== 'stand') { const oy = e.y; e.pose = 'stand'; e.y = G.ROOMS[e.room].walkY; if (G.game) e.st.poseAnim = { at: G.game.clock, dy: Math.round((oy - e.y) * 0.6) }; } };

  // 台本目标
  B.scriptTarget = function (e) {
    const sch = G.story.schedule(e.id);
    if (!sch) return null;
    const t = e.st.stime;
    let cur = null;
    for (const k of sch) { if (k.t <= t && k.room) cur = k; }
    return cur;
  };
  B.scriptEvents = function (e) {
    const sch = G.story.schedule(e.id);
    if (!sch) return;
    e.st.fired = e.st.fired || {};
    for (let i = 0; i < sch.length; i++) {
      const k = sch[i];
      if ((k.ev || k.say) && !e.st.fired[i] && e.st.stime >= k.t) {
        e.st.fired[i] = true;
        if (e.st.stime - k.t > 8) continue; // 错过太久的事件不补发
        if (k.say && B.canAct(e)) e.say(k.say);
        if (k.ev) G.story.npcEvent(k.ev, e);
      }
    }
  };
  B.canAct = function (e) { const f = e.f; return e.alive && !f.sleep && !f.still && !f.fluid && !f.lost && !e.held && !e.st.knocked; };

  // ---------- 主更新 ----------
  B.update = function (e, dt) {
    const f = e.f;
    const R = G.ROOMS[e.room];
    if (e.st.stime == null) e.st.stime = G.game.t;
    e.st.stime += dt * (e.mods.scriptRate || 1) * (e.mods.scriptRev ? -1 : 1);
    if (e.st.stime < 0) e.st.stime = 0;
    if (e.st.knocked) { e.st.knocked -= dt; e.st.walking = false; if (e.st.knocked <= 0) e.st.knocked = 0; return; }
    if (e.st.restrained) { e.st.restrained -= dt; e.st.walking = false; if (e.st.restrained <= 0) e.st.restrained = 0; return; }
    if (e.st.bowT) { e.st.bowT -= dt; e.st.bowing = e.st.bowT > 0; if (e.st.bowT <= 0) { e.st.bowT = 0; e.st.bowing = false; } }
    // 被磁力吸上车顶
    if (e.st.liftTo != null) { e.y = U.approach(e.y, e.st.liftTo + e.dims().h, 60 * dt); e.support = 'air'; e.st.walking = false; if (!f.metal) { e.st.liftTo = null; } return; }
    if (e.support === 'air' && !f.zerog && e.st.liftTo == null) { e.y = U.approach(e.y, e.pose === 'sit' ? R.sitY : R.walkY, 220 * dt); if (Math.abs(e.y - R.walkY) < 1 || Math.abs(e.y - R.sitY) < 1) e.support = null; }
    // 被搬运
    if (e.held) { const h = e.held; if (!h.alive) { e.held = null; } else { if (e.room !== h.room) G.game.moveRoom(e, h.room, h.x); e.x = h.x + h.face * 6; e.pose = 'stand'; e.y = h.y - 6; e.st.walking = false; return; } }
    // 漂浮
    if (f.zerog && !f.heavy) {
      B.standUp(e);
      e.support = 'air';
      const top = R.ceilY + e.dims().h + 2;
      e.y = U.approach(e.y, e.mods.hover != null ? R.walkY - 50 : top, 30 * dt);
      if (Math.random() < dt * 0.2 && !e.isPlayer) e.say(U.choice(G.LINES._.zerog));
      if (e.isPlayer) B.playerMove(e, dt, 0.5);
      else e.x += Math.sin(e.t * 0.6) * 6 * dt;
      e.x = U.clamp(e.x, R.minX, R.maxX);
      return;
    } else if (e.support === 'air' && f.heavy) { e.y = U.approach(e.y, R.walkY - 40, 20 * dt); }
    if (!f.zerog && e.support === 'air' && e.st.liftTo == null) {/* 下落中 */}
    // 玩家
    if (e.isPlayer) return B.player(e, dt);
    B.scriptEvents(e);
    const brain = B[e.brain] || B.generic;
    brain(e, dt);
  };

  // 通用“词条覆盖”处理：返回 true 表示已处理（本帧不再执行职责/台本）
  B.overrides = function (e, dt) {
    const f = e.f;
    if (f.sleep && !e.mods.sleepwalk && !e.mods.noSleep) {
      if (e.mods.dreamFight) { const t = B.nearestChar(e, 18); if (t && Math.random() < dt * 1.5) B.punch(e, t); }
      if (e.mods.sleepTalk && Math.random() < dt * 0.25) e.say(B.sleepTalk(e));
      if (e.pose !== 'sit') { const s = G.SEATS[e.room].find((x) => Math.abs(x - e.x) < 14 && B.seatFree(e.room, x, e)); if (s != null) B.sitAt(e, s); }
      e.st.walking = false; return true;
    }
    if (f.fluid) { // 液化：慢慢流向目标或原地
      e.pose = 'stand'; e.y = R_walk(e) ; if (f.lost) return true;
      if (Math.random() < dt * 0.15) e.say('咕嘟……');
      return true;
    }
    if (f.lost && !e.has('crew')) { e.st.walking = false; if (e.pose === 'sit') {} return true; }
    if (f.trash) { e.st.walking = false; return true; }
    if (f.door) { e.st.walking = false; if (Math.random() < dt * 0.05) e.say('（我是一扇门。）'); return true; }
    if (f.reflection && e.kind === 'char') { e.st.walking = false; return true; }
    if (f.forbid && (f.passenger || e.has('crew')) && !f.forbidNeg && !e.mods.leaveCar) { e.st.walking = false; return true; }
    if (f.threat && !e.mods.harmless) {
      const t = B.threatTarget(e);
      if (t) {
        if (e.mods.rampage) { B.rampage(e, dt); return true; }
        if (Math.abs(t.x - e.x) > 14 || t.room !== e.room) B.goTo(e, t.room, t.x - Math.sign(t.x - e.x) * 10, dt, { run: true });
        else { e.st.walking = false; e.face = Math.sign(t.x - e.x) || e.face; if (!e.st.punchCD || e.st.punchCD <= 0) { B.punch(e, t); e.st.punchCD = e.mods.politeHit ? 2.2 : 1.4; } }
        if (e.st.punchCD) e.st.punchCD -= dt;
        return true;
      }
    }
    if (e.mods.stumble) { B.wander(e, dt, 1.8); if (Math.random() < dt) { const t = B.nearestChar(e, 12); if (t) B.knock(t, e.face, 24); } return true; }
    if (e.mods.runAround) { B.wander(e, dt, 1.5); if (Math.random() < dt * 0.5) e.say('非常事态！非常事态！'); return true; }
    if ((e.mods.sitDown && !e.mods.goCrew) || (f.passenger && e.id === 'shira')) { B.sitSomewhere(e, dt); return true; }
    if (e.mods.pour) { B.pourSake(e, dt); return true; }
    if (f.chatty && f.polite && e.mods.trapTalk) { e.st.walking = false; return true; }
    return false;
  };
  function R_walk(e) { return G.ROOMS[e.room].walkY; }

  B.sitSomewhere = function (e, dt) {
    if (e.pose === 'sit') return;
    const s = e.st.seatX != null && B.seatFree(e.room, e.st.seatX, e) ? e.st.seatX : B.nearestSeat(e);
    if (s == null) { e.st.walking = false; return; }
    e.st.seatX = s;
    if (B.goTo(e, e.room, s, dt)) { B.sitAt(e, s); e.st.seatX = null; }
  };
  B.wander = function (e, dt, mul = 1) {
    if (!e.st.wx || Math.abs(e.st.wx - e.x) < 3 || Math.random() < dt * 0.2) { const R = G.ROOMS[e.room]; e.st.wx = U.rand(R.minX + 10, R.maxX - 10); }
    B.step(e, e.st.wx, dt * mul);
  };
  B.nearestChar = function (e, r, filter) {
    let best = null, bd = r;
    for (const o of G.game.inRoom(e.room)) { if (o === e || o.kind !== 'char' || !o.alive || o.f.reflection) continue; if (filter && !filter(o)) continue; const d = Math.abs(o.x - e.x); if (d < bd) { bd = d; best = o; } }
    return best;
  };
  B.threatTarget = function (e) {
    const ag = G.game.ents.find((o) => o.alive && o !== e && o.f.aggro && o.room === e.room && o.kind === 'char');
    if (ag) return ag;
    return B.nearestChar(e, 400, (o) => !(o.f.clear) && !o.placeholder && o.f.ts !== 0);
  };
  B.punch = function (e, t) {
    if (!t || !t.alive) return;
    G.audio.sfx('punch'); X.shake(1, 0.12);
    if (e.mods.politeHit) e.say('失礼します。');
    else if (e.id === 'tanaka') e.say(U.choice(['哈——！', '看拳！', '课长去死吧——！']));
    X.emit('spark', t.cx(), t.top() + 10, 6, { c: '#f4f1e8' });
    if (t.f.fragile && !t.mods.unbreakable) { G.R.shatter(t, '碎了！'); }
    else B.knock(t, e.face, 26);
    if (e.mods.breakOnHit) G.R.shatter(e, '自己也碎了');
    if (t.isPlayer) G.ui.toast('你被打倒了！（晕眩 2 秒）');
    else t.say(U.choice(['痛！', '干什么！', '呜哇！']));
  };
  B.knock = function (t, dir, dist = 20) {
    if (!t || t.f.heavy) return;
    t.st.knocked = 1.6; t.x += dir * dist; const R = G.ROOMS[t.room]; t.x = U.clamp(t.x, R.minX, R.maxX); B.standUp(t);
  };
  B.rampage = function (e, dt) {
    if (!e.st.rx || Math.abs(e.st.rx - e.x) < 4) { const R = G.ROOMS[e.room]; e.st.rx = e.x < 192 ? U.rand(250, R.maxX - 6) : U.rand(R.minX + 6, 130); if (Math.random() < 0.5) e.say(U.choice(['哈——！', '我还能喝！', '课长——！', '呀啊啊啊！'])); }
    B.step(e, e.st.rx, dt * 2.2);
    for (const o of G.game.inRoom(e.room)) {
      if (o === e || !o.alive || o.st.knocked) continue;
      if (Math.abs(o.x - e.x) < 10) {
        if (o.kind === 'char') B.knock(o, e.face, 30);
        else if (o.kind === 'item' && o.support !== 'rack') { o.vx = e.face * 120; o.vy = -80; o.y -= 1; if (o.f.fragile) G.R.shatter(o, '哐当'); }
      }
    }
    if (Math.random() < dt * 0.8) X.shake(1, 0.1);
  };
  B.pourSake = function (e, dt) {
    const t = B.nearestChar(e, 400, (o) => !o.has('drunk') && !o.placeholder && o.f.ts !== 0);
    if (!t) { B.sitSomewhere(e, dt); return; }
    if (B.goTo(e, t.room, t.x - 12 * Math.sign(t.x - e.x || 1), dt)) {
      if (!e.st.pourCD || e.st.pourCD <= 0) {
        e.st.bowT = 1.2; e.say('对不起对不起，来，满上！');
        G.R.add(t, 'drunk', { temp: 25, origin: 'sake' }); t.say('嗝……欸？');
        e.st.pourCD = 4;
      }
    }
    if (e.st.pourCD) e.st.pourCD -= dt;
  };
  B.sleepTalk = function (e) {
    const T = {
      tanaka: ['……部长……红的……要留到最后……', '……不是蓝的……不是蓝的啦……', '……黄、蓝、红……就跟咱们那条线的站一样……'],
      kuro: ['……第四千零九十六次……', '……为什么……每次都是蓝的……', '……这节车厢……只有这一节是真的……'],
      shira: ['……巡检的时候……贴着【回送】的……都不用查……', '……乘务员……大家都会说“ヨシ”……', '……失物箱……快满了……'],
      insp: ['……差戻……差戻……'],
    };
    return U.choice(T[e.id] || T[e.char] || ['……呼……']);
  };

  // ---------- 各角色 ----------
  B.generic = function (e, dt) {
    if (B.overrides(e, dt)) return;
    const tgt = B.scriptTarget(e);
    if (tgt) B.followTarget(e, tgt, dt);
  };
  B.followTarget = function (e, tgt, dt) {
    if (tgt.room !== e.room || Math.abs(tgt.x - e.x) > 2) {
      B.goTo(e, tgt.room, tgt.x, dt, { leaveOpen: false });
      return;
    }
    e.st.walking = false;
    if (tgt.pose === 'sit' && e.pose !== 'sit') B.sitAt(e, tgt.x);
    else if (tgt.pose === 'crouch' && G.CHARS[e.char].pose.crouch) { e.pose = 'crouch'; e.y = G.ROOMS[e.room].walkY; }
    else if (tgt.pose === 'stand') B.standUp(e);
    if (tgt.face) e.face = tgt.face;
  };

  // 田中（醉汉）
  B.tanaka = function (e, dt) {
    if (B.overrides(e, dt)) return;
    const f = e.f;
    if (e.mods.goCrew && f.crew) { if (B.goTo(e, 'crew', 160, dt)) { B.sitAt(e, 160); } const d = G.game.get('crewdoor'); if (d && e.room === 'crew') d.st.holdT = 2; return; }
    if (!f.sleep && f.drunk) {
      // 醒着的醉汉：嘀咕几句后起身晃荡
      e.st.awakeT = (e.st.awakeT || 0) + dt;
      if (e.st.awakeT < 6) { if (e.pose !== 'sit') B.sitSomewhere(e, dt); if (Math.random() < dt * 0.2) e.say(U.choice(['……这是哪……', '课长……我没睡……', '嗝。'])); return; }
      B.wander(e, dt, 0.6);
      if (Math.random() < dt * 0.15) e.say(U.choice(['再来一杯！', '我、我很清醒！', '嗝……']));
      return;
    }
    if (!f.drunk && !f.sleep) { // 清醒的田中
      if (e.pose !== 'sit') B.sitSomewhere(e, dt);
      if (Math.random() < dt * 0.05) e.say(U.choice(['……我怎么在这里……', '明天还要上班……']));
      return;
    }
    B.generic(e, dt);
  };

  // 车掌
  B.shira = function (e, dt) {
    const f = e.f;
    if (B.overrides(e, dt)) return;
    if (e.mods.selfLost) { if (B.goTo(e, 'crew', 315, dt)) { e.st.inBox = true; e.pose = 'sit'; e.y = G.ROOMS.crew.sitY; } return; }
    if (e.mods.leaveCar) { if (B.goTo(e, 'crew', 320, dt)) { e.st.walking = false; } return; }
    if (!f.crew) { // 失去身份
      if (!e.st.lostIdT) { e.st.lostIdT = 0; }
      e.st.lostIdT += dt;
      if (e.st.lostIdT < 4) { e.st.walking = false; if (!e.st.saidLost) { e.st.saidLost = 1; e.say(U.choice(G.LINES.shira['-crew'])); } return; }
      B.sitSomewhere(e, dt); return;
    }
    e.st.lostIdT = 0; e.st.saidLost = 0;
    // 1. 非常
    const em = G.game.ents.find((o) => o.alive && o.f.emergency && !['ebutton', 'ebutton03'].includes(o.id) && o !== e && (o.room === 'car04' || o.room === 'crew' || o.room === e.room));
    if (em) {
      if (!e.st.emSaid) { e.st.emSaid = 1; e.say('非常事态！请让一让！'); }
      const crewDoor = G.game.get('crewdoor');
      if (e.room === 'crew' && crewDoor) crewDoor.st.holdT = 14; // 慌忙中门没关
      const tx = em.kind === 'char' || em.kind === 'item' ? em.x : em.x + em.w / 2;
      if (B.goTo(e, em.room, U.clamp(tx, G.ROOMS[em.room].minX + 4, G.ROOMS[em.room].maxX - 4), dt, { run: true, leaveOpen: true })) {
        e.st.emT = (e.st.emT || 0) + dt;
        if (e.st.emT > 2.5) { e.st.emT = 0; const inst = em.tags.find((i) => i.t === 'emergency'); if (inst) { G.R.homeInst(em, inst); e.say('失礼しました。已经处理好了。'); } e.st.emSaid = 0; }
      }
      return;
    }
    // 2. 威胁
    const th = G.game.ents.find((o) => o.alive && o.kind === 'char' && o !== e && o.f.threat && !o.mods.harmless && o.room === e.room || (o.alive && o.kind === 'char' && o.f.threat && o.room === 'car04' && e.room === 'crew' && !o.mods.harmless));
    if (th && !f.clear) {
      const crewDoor = G.game.get('crewdoor');
      if (e.room === 'crew' && crewDoor) crewDoor.st.holdT = 14;
      if (!e.st.thSaid) { e.st.thSaid = 1; e.say(th.f.clear ? '谁？谁在那里？' : '这位乘客！请冷静！'); }
      if (B.goTo(e, th.room, th.x - 10 * Math.sign(th.x - e.x || 1), dt, { run: true, leaveOpen: true })) {
        e.st.subdueT = (e.st.subdueT || 0) + dt;
        if (e.st.subdueT > 2) { e.st.subdueT = 0; th.st.restrained = 4; th.say('放、放开我……'); e.say('请您冷静一下。'); }
      }
      return;
    }
    e.st.thSaid = 0;
    // 3. 失物 / 垃圾
    if (!f.sleep && e.held == null) {
      if (e.st.carrying) {
        const c = G.game.get(e.st.carrying);
        if (!c || !c.alive || c.held !== e) { e.st.carrying = null; }
        else {
          const dest = c.f.trash ? 295 : 316;
          if (B.goTo(e, 'crew', dest, dt)) {
            c.held = null; G.game.moveRoom(c, 'crew', dest); c.x = dest; c.st.inBox = true;
            if (c.kind === 'char') { c.pose = 'sit'; c.y = G.ROOMS.crew.sitY + 8; c.support = null; c.st.knocked = 0; } else { c.support = 'floor'; c.y = G.itemFloorY('crew'); }
            e.st.carrying = null; e.say(c.f.trash ? '打扫完毕。' : '失物，保管好了。');
            G.bus.emit('deposited', c);
          }
          return;
        }
      }
      const lost = G.game.ents.find((o) => o.alive && o !== e && (o.f.lost || o.f.trash) && o.tags.some((i) => (i.t === 'lost' || i.t === 'trash') && i.o !== o.id) && !o.st.inBox && !o.held && (o.room === e.room || (o.room === 'car04' && e.room === 'crew' && e.st.stime > 0)) && !(o.kind === 'fixture' || o.kind === 'env') && !(o.f.clear));
      if (lost && !(lost.f.heavy && e.st.heavyGiveUp)) {
        const tx = lost.kind === 'door' ? lost.x + lost.w / 2 : lost.x;
        if (B.goTo(e, lost.room, U.clamp(tx, G.ROOMS[lost.room].minX, G.ROOMS[lost.room].maxX), dt)) {
          if (lost.f.heavy || lost.mods.tooHeavy) { e.say('好、好重……搬不动……'); e.st.heavyGiveUp = 1; return; }
          if (lost.kind === 'door') { lost.st.lifted = true; lost.mods.forceOpen = true; e.say('这扇门……是哪位的失物呢？'); G.R.toastSmall('车掌把门卸了下来，当作失物抱走了。'); lost.tags = lost.tags.filter((i) => i.t !== 'lost'); G.tags.changed(lost); return; }
          lost.held = e; e.st.carrying = lost.id; lost.support = 'held';
          e.say(lost.kind === 'char' ? (lost.f.trash ? '……这是垃圾？' : '这位……是哪位的失物呢？') : (lost.f.trash ? '垃圾要好好分类。' : '是哪位的失物呢？'));
          if (lost.isPlayer) G.ui.toast('车掌把你当作失物抱了起来……');
        }
        return;
      }
    }
    // 4. 最高仇恨（非炸弹）→ 去看看
    const ag = G.game.ents.find((o) => o.alive && o.f.aggro && o.id !== 'bomb' && o !== e && (o.room === e.room) && !o.f.clear);
    if (ag && !f.clear) { const tx = ag.kind === 'char' || ag.kind === 'item' ? ag.x : ag.x + ag.w / 2; if (B.goTo(e, ag.room, U.clamp(tx - 12, 20, 360), dt)) { if (Math.random() < dt * 0.3) e.say('这是……？'); } return; }
    // 5. 礼让：扶门
    if (e.mods.holdDoor) {
      const door = G.game.get('crewdoor');
      if (B.goTo(e, 'car04', 338, dt)) { e.face = 1; const p = G.game.player(); if (door && door.alive && p && p.room === 'car04' && Math.abs(p.x - 345) < 50) { door.st.holdT = 2; if (!e.st.bowing) { e.st.bowT = 1.0; } } }
      return;
    }
    // 6. 看见玩家闯入乘务员室
    const p = G.game.player();
    if (p && p.room === 'crew' && e.room === 'crew' && !p.f.crew && !p.f.clear && !p.f.lost && !p.f.trash && !p.f.oos && !p.f.reflection && !f.blind && !e.mods.blind && !p.held && !p.st.inBox && !p.f.fluid && !(p.f.mini) && G.game.act >= 2) {
      if (!e.st.caughtT) { e.st.caughtT = 1.5; e.say('这位乘客，这里是乘务员室——非相关人员禁止入内。'); }
      e.st.caughtT -= dt;
      if (e.st.caughtT <= 0) { e.st.caughtT = 0; G.game.moveRoom(p, 'car04', 330); p.x = 330; G.ui.toast('你被车掌请出了乘务员室。'); G.bus.emit('escorted'); }
      return;
    }
    // 7. 照台本
    if (e.mods.sleepwalk) { B.generic(e, dt * 0.7); return; }
    const tgt = B.scriptTarget(e);
    if (tgt) {
      if (e.mods.leaveDoorOpen && e.room === 'crew') { const d = G.game.get('crewdoor'); if (d) d.st.holdT = 3; }
      if (f.patrol || tgt.act !== 'patrol') B.followTarget(e, tgt, dt); else { e.st.walking = false; }
      // 查票
      if (e.room === 'car04' && f.patrol && Math.random() < dt * 0.08) { const n = B.nearestChar(e, 16); if (n && !n.isPlayer && n.id !== 'kuro') e.say('打扰了，请出示车票。'); }
    }
  };

  // 侦探
  B.kuro = function (e, dt) {
    const f = e.f;
    if (B.overrides(e, dt)) return;
    const p = G.game.player();
    if (!f.detective) { if (e.pose !== 'sit') B.sitSomewhere(e, dt); if (Math.random() < dt * 0.03) e.say('我是……谁？'); return; }
    // 自由的黑川：听从玩家
    if (!f.scripted && G.story.flags.kuroFree) {
      const plan = G.story.flags.kuroPlan;
      const bomb = G.game.bombEnt();
      if (plan && bomb && bomb.alive) {
        if (B.goTo(e, bomb.room, bomb.x - 8, dt)) { e.pose = 'crouch'; e.st.workT = (e.st.workT || 0) + dt; if (e.st.workT > 3) { e.st.workT = 0; G.story.flags.kuroPlan = null; G.bomb.cutSequence(e, plan); } }
        return;
      }
      if (p && p.room === e.room && Math.abs(p.x - e.x) > 40) B.goTo(e, p.room, p.x - 20 * p.face, dt); else e.st.walking = false;
      return;
    }
    // 绅士：把调查让给你
    if (e.mods.yieldCase) { e.st.walking = false; if (Math.random() < dt * 0.05) e.say('请吧，你先来。'); return; }
    // 调查最高仇恨（不是炸弹的那个）
    const tgt = B.scriptTarget(e);
    const searching = tgt && (tgt.act === 'search');
    const ag = G.game.ents.find((o) => o.alive && o.f.aggro && o.id !== 'bomb' && o !== e && !(o.mods.unseen) && !o.f.clear && (o.room === e.room || o.room === 'car04'));
    if (ag && (!f.scripted || searching)) {
      const tx = ag.kind === 'char' || ag.kind === 'item' ? ag.x : ag.x + ag.w / 2;
      if (B.goTo(e, ag.room, U.clamp(tx - 10, 20, 360), dt)) {
        e.st.studyT = (e.st.studyT || 0) + dt; e.face = Math.sign(tx - e.x) || e.face;
        if (e.st.studyT > 3 && !e.st.studied) { e.st.studied = ag.id; G.story.npcEvent('kuroStudy', e, ag); }
      }
      return;
    }
    // 找不到炸弹
    const bomb = G.game.bombEnt();
    if ((e.mods.kuroLost || (bomb && (bomb.mods.kuroLost))) && tgt && tgt.act !== 'sit') { B.wander(e, dt, 0.8); if (Math.random() < dt * 0.2) e.say('炸弹……消失了？！'); return; }
    // 警惕：提醒离座的玩家
    if (f.vigilant && p && p.room === e.room && e.pose === 'sit' && p.pose !== 'sit' && Math.abs(p.x - e.x) < 50 && (!e.st.warnT || G.game.clock - e.st.warnT > 25) && !p.f.clear && G.game.act >= 2) { e.st.warnT = G.game.clock; e.say('……坐回去，小鬼。'); }
    // 台本：调查阶段跟随炸弹实际位置
    if (tgt) {
      let t2 = tgt;
      if ((tgt.act === 'examine' || tgt.act === 'crouchBomb') && bomb && bomb.alive) {
        if (bomb.room !== 'car04' && bomb.room !== e.room && !bomb.mods.kuroBlocked) t2 = Object.assign({}, tgt, { room: bomb.room, x: U.clamp(bomb.x - 10, 80, 330) });
        else if (!bomb.mods.kuroBlocked && Math.abs(bomb.x - tgt.x) > 30 && bomb.room === 'car04') t2 = Object.assign({}, tgt, { x: U.clamp(bomb.x - 10, 20, 360) });
      }
      B.followTarget(e, t2, dt);
    }
  };

  // 栞（被解救后的伙伴）
  B.shiori = function (e, dt) {
    const f = e.f;
    if (e.frozenGirl && (f.still || f.lock)) { e.st.walking = false; return; }
    if (B.overrides(e, dt)) return;
    if (!G.story.flags.shioriFree) { e.st.walking = false; return; }
    const p = G.game.get(G.game.ctrlId === 'shiori' ? 'nana' : 'nana');
    if (G.game.ctrlId === 'shiori') return; // 由玩家控制
    if (G.story.flags.follow && p && p.alive) {
      if (p.room !== e.room || Math.abs(p.x - e.x) > 30) B.goTo(e, p.room, p.x - 22 * (p.face || 1), dt);
      else e.st.walking = false;
    } else e.st.walking = false;
  };
  // 七号作为非控制角色时
  B.player = function (e, dt) {
    const f = e.f;
    if (G.game.ctrlId !== e.id) { // 被切换掉的角色
      if (G.story.flags.follow && e.id === 'nana') { const s = G.game.get('shiori'); if (s && (s.room !== e.room || Math.abs(s.x - e.x) > 30)) B.goTo(e, s.room, s.x - 22 * (s.face || 1), dt); else e.st.walking = false; }
      else e.st.walking = false;
      return;
    }
    if (f.scripted) { // 被扯回台本位置
      const h = e.home;
      e.st.walking = false;
      if (e.room !== h.room || Math.abs(e.x - h.x) > 1 || e.pose !== h.pose) {
        e.st.pullT = (e.st.pullT || 0) + dt;
        if (e.st.pullT > 0.35) { e.st.pullT = 0; if (e.room !== h.room) G.game.moveRoom(e, h.room, h.x); e.x = h.x; B.sitAt(e, h.x); e.face = 1; X.emit('paper', e.x, e.top(), 6, { c: '#f4f1e8' }); }
      }
      return;
    }
    if (f.sleep || f.still || f.lost || f.trash || f.door || e.held || (f.forbid && !f.forbidNeg)) { e.st.walking = false; G.game.moveTarget = null; return; }
    if (f.threat) { /* 玩家带威胁：NPC 会来制伏 */ }
    if (f.roll) { e.x += G.game.sway * 30 * dt; const R = G.ROOMS[e.room]; e.x = U.clamp(e.x, R.minX, R.maxX); }
    B.playerMove(e, dt, 1);
  };
  B.playerMove = function (e, dt, mul) {
    const g = G.game;
    let tx = null;
    if (g.keyDir) tx = e.x + g.keyDir * 30;
    else if (g.moveTarget) tx = g.moveTarget.x;
    if (tx == null) { e.st.walking = false; return; }
    const R = G.ROOMS[e.room];
    // 想离开房间？
    const ex = R.exits.find((x) => (x.side === 'left' && tx <= x.x + 4) || (x.side === 'right' && tx >= x.x - 4));
    if (ex && ((ex.side === 'left' && e.x <= ex.x + 6) || (ex.side === 'right' && e.x >= ex.x - 6))) {
      const door = g.get(ex.door);
      const why = {};
      if (G.doorPassable(door, e, why)) {
        if (door && door.has('door') && !door.open && !e.f.nocollide && !e.f.fluid && !(e.f.mini)) { door.st.holdT = 1.2; G.audio.sfx('door'); }
        g.moveTarget = null; g.keyDir = 0;
        g.changeRoom(e, ex.to, ex.toX);
        return;
      }
      e.st.walking = false; g.moveTarget = null;
      if (!e.st.blockT || g.clock - e.st.blockT > 1.5) { e.st.blockT = g.clock; G.ui.toast(why.r || '过不去。'); G.audio.sfx('deny'); }
      return;
    }
    const target = U.clamp(tx, R.minX, R.maxX);
    if (e.pose === 'sit' && Math.abs(target - e.x) < 3) {
      if (g.moveTarget && g.moveTarget.sit) { g.moveTarget = null; }
      e.st.walking = false; return;
    }
    if (Math.abs(target - e.x) < 1.5) {
      e.st.walking = false;
      if (g.moveTarget && g.moveTarget.sit && G.SEATS[e.room].some((s) => Math.abs(s - e.x) < 2)) B.sitAt(e, e.x);
      if (!g.keyDir) g.moveTarget = null;
      return;
    }
    const pre = e.speedMul;
    B.step(e, target, dt * (mul || 1) * (e.f.drunk && Math.random() < 0.02 ? -1 : 1));
  };

  // 玩家的复制品：模仿玩家的移动
  B.mimic = function (e, dt) {
    const g = G.game; const p = g.player();
    if (!p) return;
    const dir = g.keyDir || (g.moveTarget ? Math.sign(g.moveTarget.x - p.x) : 0);
    if (dir && p.st.walking) B.step(e, e.x + dir * 20, dt); else e.st.walking = false;
  };
  B.nana = B.player;

  // 检札员
  B.insp = function (e, dt) {
    const f = e.f;
    if (B.overrides(e, dt)) return;
    if (e.mods.inspectorOff || f.forbid && !f.forbidNeg) { e.st.walking = false; return; }
    e.st.stampCD = (e.st.stampCD || 0) - dt;
    // 被陷害：同伴来盖它
    const framed = G.game.ents.find((o) => o.alive && o !== e && o.has('inspector') && (o.mods.framed || o.f.anomaly || o.f.aggro) && o.room === e.room);
    let target = framed || null;
    if (!target && !e.mods.stampRandom) {
      // 视野内的异常
      const seeR = 110;
      for (const o of G.game.inRoom(e.room)) {
        if (o === e || !o.alive || o.has('inspector') && !o.mods.framed) continue;
        if (Math.abs(o.cx() - e.x) > seeR) continue;
        if (Math.sign(o.cx() - e.x) !== e.face && Math.abs(o.cx() - e.x) > 12) continue;
        if (o.mods.unseen) continue;
        if (G.scan.isAnomalous(o, { insp: true })) { target = o; break; }
      }
    }
    if (e.mods.stampRandom && !target && Math.random() < dt * 0.4) target = U.choice(G.game.inRoom(e.room).filter((o) => o !== e && o.kind !== 'env'));
    if (target) {
      if (!e.st.alerted || e.st.alerted !== target.id) { e.st.alerted = target.id; e.say(U.choice(G.LINES.insp._spot)); G.audio.sfx('alert'); }
      const tx = target.kind === 'char' || target.kind === 'item' ? target.x : target.x + target.w / 2;
      if (B.goTo(e, target.room, U.clamp(tx - 10 * Math.sign(tx - e.x || 1), 16, 368), dt, { run: true })) {
        if (e.st.stampCD <= 0) { e.st.stampCD = 1.6; G.scan.stamp(target, e); e.st.alerted = null; }
      }
      return;
    }
    e.st.alerted = null;
    // 巡逻
    if (!e.st.pt || Math.abs(e.st.pt - e.x) < 4) { const R = G.ROOMS[e.room]; e.st.pt = e.x < 192 ? R.maxX - 20 : R.minX + 20; if (Math.random() < 0.3) { const rooms = ['car04', 'car04', 'crew', 'car03']; e.st.goRoom = U.choice(rooms); } }
    if (e.st.goRoom && e.st.goRoom !== e.room && Math.random() < 0.5) { if (B.goTo(e, e.st.goRoom, 192, dt)) e.st.goRoom = null; return; }
    B.step(e, e.st.pt, dt * 0.8);
  };
})();
