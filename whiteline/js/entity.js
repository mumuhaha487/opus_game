/* =========================================================
   entity.js —— 实体：词条实例、标志位计算、个体时间流（快/慢/静/倒放/循环）、
   物品物理（重力/漂浮/流体/磁力/易碎/滚动）、绘制（含每个词条的可视化图层）
   ========================================================= */
(function () {
  'use strict';
  const U = G.util, X = G.gfx;
  const TAGS = G.TAGS;

  // 额外的状态图标
  Object.assign(X.ICONS, {
    up: ['..b..', '.bbb.', 'b.b.b', '..b..', '..b..'],
    minus: ['.....', '.....', 'rrrrr', '.....'],
    crack: ['w...w', '.w.w.', '..w..', '.w...', 'w....'],
    ghost: ['.www.', 'wkwkw', 'wwwww', 'wwwww', 'w.w.w'],
    slow: ['.#.', '##.', '.##', '.#.'],
    oos: ['kkkkkkk', 'kyyyyyk', 'kkkkkkk'],
    stamp: ['.rrr.', 'r.r.r', 'rr.rr', 'r.r.r', '.rrr.'],
    bomb: ['...y', '..#.', '.###', '#####', '#####', '.###.'],
    strings: ['#...#', '#...#', '#...#', '.#.#.'],
    door: ['####', '#..#', '#.##', '#..#', '####'],
    seat: ['g...', 'g...', 'gggg', 'g..g'],
    wifi: ['.###.', '#...#', '..#..', '.....', '..#..'],
    key: ['yy...', 'y.yyy', 'yy.y.'],
  });
  const TAG_ICON = {
    zerog: 'up', fluid: 'drop', magnet: 'magnet', metal: 'key', fragile: 'crack', heavy: 'weight', giant: 'plus', mini: 'minus', roll: 'loop', clear: 'eye',
    nocollide: 'ghost', fast: 'ff', slow: 'slow', reverse: 'rew', still: 'pause', loop: 'loop', delay: 'clock', timer: 'clock', aggro: 'target', oos: 'oos',
    copy: 'copy', erase: 'erase', lock: 'lock', anomaly: 'stamp', emergency: 'bang', crewonly: 'cap', sleep: 'zz', drunk: 'hic', threat: 'anger',
    polite: 'heart', chatty: 'note', patrol: 'feet', vigilant: 'eye', forbid: 'ban', exit: 'exit', bookmark: 'ribbon', scripted: 'strings', crew: 'cap',
    detective: 'glass', bomb: 'bomb', door: 'door', passenger: 'seat', lost: 'tag', trash: 'tag', broadcast: 'wifi', reflection: 'ghost', inspector: 'stamp',
    nana: 'tag', whiteline: 'tag', undeletable: 'lock', title: 'star', pause: 'pause', close: 'ban', border: 'door', countdown: 'clock',
  };
  G.TAG_ICON = TAG_ICON;
  G.CAT_COL = { id: '#efe5c8', phys: '#c6d5df', time: '#ead99a', sys: '#e7bfb2', mind: '#cbdab6', rule: '#f6f2e6', ui: '#cfd0d8' };

  let instN = 0;
  G.mkInst = (t, origin, lock) => ({ u: 'i' + (++instN), t, o: origin || null, lock: !!lock, pend: 0, temp: 0 });

  // ---------- 实体 ----------
  class Ent {
    constructor(spec) {
      Object.assign(this, {
        kind: 'item', room: 'car04', x: 0, y: 0, w: 0, h: 0, face: 1, pose: 'stand', vx: 0, vy: 0, alive: true, spawned: false, canonical: true,
        mods: {}, react: new Map(), hist: [], histT: 0, st: {}, bark: null, z: 0, open: false, scaleNow: 1, t: 0, eraseCD: 0, copyT: 0, hitT: 0,
      }, spec);
      this.name = spec.name || (spec.char && G.CHARS[spec.char] ? G.CHARS[spec.char].name : spec.id);
      this.tags = (spec.tags || []).map((x) => (typeof x === 'string' ? G.mkInst(x, spec.id, false) : G.mkInst(x.t, spec.id, !!x.lock)));
      this.canonTags = spec.canon ? spec.canon.slice() : this.tags.map((i) => i.t);
      this.home = Object.assign({ room: this.room, x: this.x, y: this.y, pose: this.pose, support: spec.support || null, face: this.face }, spec.home || {});
      this.support = spec.support || (this.kind === 'item' ? 'floor' : null);
      if (this.kind === 'char') this.y = this.pose === 'sit' ? G.ROOMS[this.room].sitY : G.ROOMS[this.room].walkY;
      if (this.kind === 'item' && this.sprite) { const m = X.meta[this.sprite]; if (m) { this.w = m.w; this.h = m.h; } }
      if (this.frozenAir) this.support = 'air';
      this.f = {};
      this.computeFlags();
    }
    // ---------- 词条 ----------
    active() { const now = G.game ? G.game.clock : 0; return this.tags.filter((i) => !i.pend || i.pend <= now); }
    has(t) { const now = G.game ? G.game.clock : 0; for (const i of this.tags) if (i.t === t && (!i.pend || i.pend <= now)) return true; return false; }
    count(t) { const now = G.game ? G.game.clock : 0; let n = 0; for (const i of this.tags) if (i.t === t && (!i.pend || i.pend <= now)) n++; return n; }
    hasAny(...ts) { return ts.some((t) => this.has(t)); }
    get isPlayer() { return this.id === G.game.ctrlId; }
    get isChar() { return this.kind === 'char'; }
    computeFlags() {
      const f = (this.f = {});
      const now = G.game ? G.game.clock : 0;
      // 印刷类来源（广告、贴纸、显示屏…）上的原生词条只是“印着的字”，不产生行为
      const c = this.printed ? (t) => this.tags.filter((i) => i.t === t && i.o !== this.id && (!i.pend || i.pend <= now)).length : (t) => this.count(t);
      for (const k in TAGS) { const n = c(k); if (n) f[k] = n; }
      let ts = Math.pow(2, c('fast')) * Math.pow(0.5, c('slow'));
      if (c('still')) ts = 0;
      f.ts = ts;
      f.rev = c('reverse') % 2 === 1 && !this.mods.normalTime;
      f.scale = Math.pow(2, c('giant')) * Math.pow(0.5, c('mini'));
      if (this.mods.scaleOverride) f.scale = this.mods.scaleOverride;
      f.solid = !f.nocollide;
      f.forbidNeg = this.count('forbid') >= 2;
      return f;
    }
    // ---------- 几何 ----------
    spriteName() {
      if (this.kind === 'char') {
        const ch = G.CHARS[this.char]; let p = this.pose;
        if (this.mods.fightPose && ch.pose.fight) p = 'fight';
        if (this.st && this.st.bowing && ch.pose.bow) p = 'bow';
        let s = ch.pose[p] || ch.pose.stand;
        return s;
      }
      return this.sprite;
    }
    dims() {
      if (this.kind === 'char' || (this.kind === 'item' && this.sprite)) {
        const m = X.meta[this.spriteName()] || { w: 16, h: 16 };
        const s = this.scaleNow || 1;
        return { w: Math.round(m.w * s), h: Math.round(m.h * s) };
      }
      return { w: this.w, h: this.h };
    }
    bbox() {
      if (this.kind === 'char' || this.kind === 'item') {
        if (this.f.fluid && !this.mods.waterball && !this.mods.ice) { const d = this.dims(); const w = Math.max(14, d.w * 1.3); return { x: this.x - w / 2, y: this.y - 7, w, h: 8 }; }
        const d = this.dims(); return { x: this.x - d.w / 2, y: this.y - d.h, w: d.w, h: d.h };
      }
      return { x: this.x, y: this.y, w: this.w, h: this.h };
    }
    cx() { const b = this.bbox(); return b.x + b.w / 2; }
    cy() { const b = this.bbox(); return b.y + b.h / 2; }
    top() { return this.bbox().y; }
    say(text, dur) {
      if (!text) return;
      this.bark = { text, t: dur || Math.min(5, 1.6 + text.length * 0.12) };
      if (G.game && this.room === G.game.room && this.isChar && !this.isPlayer) G.audio.sfx('blip');
    }
    snapshot() { return { room: this.room, x: this.x, y: this.y, pose: this.pose, face: this.face, sup: this.support, open: this.open }; }
    restoreSnap(s) { if (!s) return; if (s.room !== this.room) G.game.moveRoom(this, s.room, s.x); this.x = s.x; this.y = s.y; this.pose = s.pose; this.face = s.face; this.support = s.sup; this.open = s.open; }
  }
  G.Ent = Ent;

  // ---------- 每帧更新（时间流） ----------
  G.updateEnt = function (e, dt) {
    if (!e.alive) return;
    const f = e.f;
    if (e.bark) { e.bark.t -= dt; if (e.bark.t <= 0) e.bark = null; }
    // 临时词条过期
    for (let i = e.tags.length - 1; i >= 0; i--) { const it = e.tags[i]; if (it.temp && G.game.clock > it.temp) { e.tags.splice(i, 1); G.tags.changed(e); } }
    // 尺寸平滑
    let target = f.scale || 1;
    if (e.mods.flickerScale) target = Math.floor(G.game.clock * 1.5) % 2 ? 2 : 0.5;
    if (e.mods.grow) { e.st.growK = (e.st.growK || 1) + dt * 0.12; target = 2 * e.st.growK; if (e.st.growK > 1.8) { e.st.growK = 1; G.R.shatter(e, '模型破损！'); return; } }
    e.scaleNow = target;
    let ts = f.ts == null ? 1 : f.ts;
    if (e.mods.speedMul) ts *= e.mods.speedMul;
    const ldt = dt * ts;
    e.t += ldt;
    // 系统类效果按“系统时间”运行：被冻结的东西也会被复制
    if (ts === 0 && f.copy) { e.copyT += dt * (e.mods.copyRate || 1) * f.copy; if (e.copyT > 6) { e.copyT = 0; G.R.copy(e); } }
    // 冻结：不更新
    if (ts === 0) { if (e.kind === 'char') e.st.walking = false; return; }
    // 倒放：从历史回放
    if (f.rev) {
      e.histT += Math.abs(ldt);
      while (e.histT >= 0.1) { e.histT -= 0.1; const s = e.hist.pop(); if (s) e.restoreSnap(s); else { e.st.revDone = true; break; } }
      if (e.kind === 'char') e.st.walking = e.hist.length > 0;
      return;
    }
    // 循环：重放最近一段
    if (f.loop && !e.mods.pingpong && !e.mods.echo) {
      if (!e.st.loopSeg) { const n = Math.max(2, Math.round((e.mods.loopLen || 2) * 10)); e.st.loopSeg = e.hist.slice(-n); e.st.loopI = 0; if (e.st.loopSeg.length < 2) e.st.loopSeg = [e.snapshot(), e.snapshot()]; }
      e.histT += ldt;
      while (e.histT >= 0.1) { e.histT -= 0.1; e.st.loopI = (e.st.loopI + 1) % e.st.loopSeg.length; e.restoreSnap(e.st.loopSeg[e.st.loopI]); }
      if (e.kind === 'char') e.st.walking = true;
      return;
    } else e.st.loopSeg = null;
    if (e.mods.pingpong) {
      if (!e.st.ppSeg) { e.st.ppSeg = e.hist.slice(-20); if (e.st.ppSeg.length < 2) e.st.ppSeg = [e.snapshot(), Object.assign(e.snapshot(), { x: e.x + 20 })]; e.st.ppI = 0; e.st.ppD = 1; }
      e.histT += ldt;
      while (e.histT >= 0.1) { e.histT -= 0.1; e.st.ppI += e.st.ppD; if (e.st.ppI >= e.st.ppSeg.length - 1 || e.st.ppI <= 0) e.st.ppD *= -1; e.restoreSnap(e.st.ppSeg[U.clamp(e.st.ppI, 0, e.st.ppSeg.length - 1)]); }
      return;
    } else e.st.ppSeg = null;
    // 记录历史
    e.histT += ldt;
    if (e.histT >= 0.1) { e.histT = 0; e.hist.push(e.snapshot()); if (e.hist.length > 300) e.hist.shift(); }
    // 实际行为
    if (e.kind === 'item') G.itemPhysics(e, ldt);
    else if (e.kind === 'char') G.brains.update(e, ldt);
    else if (e.kind === 'door') G.doorUpdate(e, ldt);
    // 通用系统效果
    G.sysEffects(e, ldt);
  };

  // ---------- 物品物理 ----------
  G.itemFloorY = (room) => ({ car04: 232, car03: 236, crew: 206, void: 176, dawn: 240 }[room] || 230);
  G.itemPhysics = function (e, dt) {
    const R = G.ROOMS[e.room]; const f = e.f; const floor = G.itemFloorY(e.room);
    const d = e.dims();
    if (e.held) { const h = e.held; if (!h.alive) { e.held = null; e.support = 'floor'; } else { e.room = h.room; e.x = h.x + h.face * 8; e.y = h.y - 30; return; } }
    if (e.support === 'stuck' && e.st.stuckTo) { const m = G.game.get(e.st.stuckTo); if (m && m.alive && (m.f.magnet || m.mods.stickWall) && m.room === e.room) { e.x = m.cx() + e.st.sx; e.y = m.cy() + e.st.sy; return; } e.support = 'floor'; e.st.stuckTo = null; }
    if (e.mods.stickWall) { e.support = 'wall'; e.x = e.x < 192 ? Math.max(e.x - 60 * dt, 38) : Math.min(e.x + 60 * dt, 340); e.y = U.approach(e.y, 120, 40 * dt); return; }
    const floating = (f.zerog && !f.heavy) || e.mods.fallUp || e.mods.waterball;
    const hovering = (f.zerog && f.heavy) || e.mods.hover != null;
    if (e.support === 'air' && !f.zerog && f.ts > 0 && !e.frozenAir) e.support = 'floor';
    if (e.frozenAir && !f.still) { e.frozenAir = false; e.support = 'floor'; e.vy = 0; }
    if (e.frozenAir) return;
    if (hovering) {
      const hy = R.ceilY + (floor - R.ceilY) * (e.mods.hover != null ? 1 - e.mods.hover : 0.45);
      e.support = 'air'; e.vy = 0; e.y = U.approach(e.y, hy + d.h, 20 * dt) + Math.sin(e.t * 1.6) * 0.15; return;
    }
    if (floating) {
      if (e.tether && e.id === 'balloon' && !e.st.cut) { e.support = 'tether'; e.y = U.approach(e.y, e.tether.y - 46 + Math.sin(e.t * 1.4) * 2, 30 * dt); e.x = e.tether.x + 2 + Math.sin(e.t * 0.9) * 2; return; }
      e.support = 'air';
      const topLimit = R.ceilY + d.h + (e.mods.rocket ? 0 : 2);
      if (e.mods.rocket) { e.vy -= 400 * dt; } else e.vy = U.approach(e.vy, -26, 40 * dt);
      e.y += e.vy * dt;
      if (e.y < topLimit) { e.y = topLimit; if (e.mods.rocket && e.vy < -80) { G.audio.sfx('punch'); X.shake(1, 0.15); e.vy = 60; if (f.fragile && !e.mods.unbreakable) G.R.shatter(e, '咚！'); } else e.vy = 0; }
      e.x += Math.sin(e.t * 0.7 + e.u0) * 4 * dt + G.game.sway * 2 * dt;
      e.x = U.clamp(e.x, R.minX, R.maxX);
      if (e.mods.bounce) { e.st.bt = (e.st.bt || 0) + dt; e.y = floor - (Math.abs(Math.sin(e.st.bt * 1.6)) * (floor - topLimit)); }
      return;
    }
    if (['rack', 'seat', 'hook', 'desk', 'tether'].includes(e.support)) {
      if (e.support === 'tether') e.support = 'floor';
      else if (f.heavy && e.support === 'rack' && !e.st.heavyWarned) { e.st.heavyWarned = true; e.support = 'floor'; e.vy = 0; G.R.toastSmall(`${e.name} 太重了，从网棚上掉了下来！`); }
      else return;
    }
    // 重力与落地
    const g = f.heavy ? 900 : 420;
    if (e.y < floor - 0.5 || e.vy < 0) {
      e.vy += g * dt; e.y += e.vy * dt;
      if (e.y >= floor) {
        const impact = e.vy; e.y = floor; e.vy = 0; e.support = 'floor';
        if (impact > 150) { G.audio.sfx(f.heavy ? 'punch' : 'step'); if (f.heavy) { X.shake(2, 0.25); G.R.crushAt(e); } if (f.fragile && !e.mods.unbreakable) { G.R.shatter(e, '啪嚓'); return; } }
        if (impact > 150 && e.mods.unbreakable) { X.emit('spark', e.x, e.y - 4, 6, { c: '#f4f1e8' }); G.audio.sfx('rewind'); }
      }
    } else e.y = floor;
    // 滚动
    const tilt = G.game.tilt + (f.roll ? G.game.sway * 14 : 0);
    if (f.roll || e.mods.bowling || G.game.tilt) {
      const k = e.mods.rollUp ? -1 : 1;
      e.vx += tilt * k * 22 * dt;
      e.vx *= Math.pow(0.6, dt);
      if (e.mods.bowling || e.mods.torrent) e.vx = U.clamp(e.vx * 1.02 + U.sign(e.vx || 1) * 30 * dt, -90, 90);
      e.x += e.vx * dt;
      if (e.x < R.minX + 8) { e.x = R.minX + 8; e.vx = Math.abs(e.vx) * 0.6; if (e.mods.rollToBreak || (f.fragile && Math.abs(e.vx) > 30)) G.R.shatter(e, '哐！'); }
      if (e.x > R.maxX - 8) { e.x = R.maxX - 8; e.vx = -Math.abs(e.vx) * 0.6; if (e.mods.rollToBreak || (f.fragile && Math.abs(e.vx) > 30)) G.R.shatter(e, '哐！'); }
      if (e.mods.bowling && Math.abs(e.vx) > 25) for (const o of G.game.inRoom(e.room)) if (o.kind === 'char' && o !== e && Math.abs(o.x - e.x) < 10 && !o.st.knocked && o.f.ts > 0) G.R.knock(o, U.sign(e.vx), 40);
    }
    // 流体：流向倾斜方向、可从门缝钻过
    if (f.fluid && !e.mods.ice && !e.mods.waterball) {
      let dir = e.mods.flowTo === 'right' ? 1 : e.mods.flowTo === 'left' ? -1 : U.sign(G.game.tilt) || 0;
      if (e.mods.slosh) dir = Math.sin(e.t * 0.8) > 0 ? 1 : -1;
      if (e.mods.pingpong) dir = 0;
      e.x += (dir * (e.mods.torrent ? 50 : 10) + Math.sin(e.t * 0.5 + e.u0) * 3) * dt;
      // 门缝
      for (const ex of R.exits) {
        if ((ex.side === 'right' && e.x >= ex.x - 4) || (ex.side === 'left' && e.x <= ex.x + 4)) {
          const door = G.game.get(ex.door);
          if (!(ex.to === 'car03' && G.game.act === 2)) { G.game.moveRoom(e, ex.to, ex.toX); G.R.toastSmall(`${e.name} 从门缝下面流了过去。`); return; }
        }
      }
    }
    e.x = U.clamp(e.x, R.minX, R.maxX);
  };

  // ---------- 门 ----------
  G.doorUpdate = function (e, dt) {
    if (e.st.lifted) { e.open = true; return; }
    if (e.mods.forceOpen || !e.has('door') || e.mods.noDoor) { e.open = true; return; }
    if (e.mods.swayOpen) { e.open = Math.sin(e.t * 1.3) > 0.3; return; }
    if (e.mods.doorWander) { e.st.wx = Math.sin(e.t * 0.5) * 30; e.open = Math.abs(e.st.wx) > 18; return; }
    if (e.st.holdT > 0) { e.st.holdT -= dt; e.open = true; return; }
    e.open = false;
  };
  // 通行判定：返回 true/false，并可写入 reason
  G.doorPassable = function (door, w, why) {
    if (!door) return true;
    if (!door.alive) return true;
    if (door.id === 'gangway04' && G.game.act === 2) { if (why) why.r = '3 号车厢被系统隔离了——门那边像有一堵看不见的墙。'; return false; }
    if (door.open || door.mods.forceOpen || door.st.lifted || !door.has('door')) return true;
    const wf = w.f;
    if (wf.nocollide || (wf.fluid && !w.mods.ice) || w.mods.waterball) return true;
    if (wf.mini && door.vent && (wf.scale || 1) <= 0.5) return true;
    if (wf.giant) { if (why) why.r = '太大了，挤不过去。'; return false; }
    if (door.f.still) { if (why) why.r = '门被冻住了，纹丝不动。'; return false; }
    const rule = door.rule ? G.game.get(door.rule) : null;
    const ruleOn = !rule || (rule.has('forbid') && !rule.f.forbidNeg);
    const crewonly = door.has('crewonly') && ruleOn;
    const locked = door.has('lock') && ruleOn;
    if (wf.crew && !w.has('anomaly')) return true;
    if (door.mods.autoOpen || door.mods.talkOpen && door.st.talked) return true;
    if (!locked && !crewonly) return true;
    if (why) why.r = crewonly ? '「关系者以外禁止入内」——门锁着。' : '锁着。';
    return false;
  };

  // ---------- 通用系统效果（磁力、删除、复制、流体漫延……） ----------
  G.sysEffects = function (e, dt) {
    const f = e.f; const room = e.room;
    // 磁力
    if (f.magnet && !e.mods.magFreeze) {
      const range = e.mods.magRange || (f.giant ? 400 : 120), pw = (e.mods.magPower || 1) * (e.mods.repel ? -1 : 1);
      const pulseOn = !e.mods.magPulse || Math.sin(e.t * 2) > 0;
      if (pulseOn) for (const o of G.game.ents) {
        if (o === e || !o.alive || !o.f.metal || o.f.ts === 0) continue;
        if (o.room !== room && !e.mods.magnetThroughWalls) continue;
        if (o.room !== room) { if (Math.random() < dt * 0.3) { G.game.moveRoom(o, room, U.clamp(e.x, 60, 330)); G.R.toastSmall(`${o.name} 被磁力从隔壁吸了过来！`); } continue; }
        const dx = e.cx() - o.cx(), dy = e.cy() - o.cy(), dist = Math.hypot(dx, dy);
        if (dist > range) continue;
        if (o.kind === 'char') { if (o.f.heavy) continue; o.st.pulled = { x: e.x, y: e.cy(), p: pw }; continue; }
        if (o.support === 'stuck' && o.st.stuckTo === e.id) continue;
        if (dist < 8 && pw > 0) { o.support = 'stuck'; o.st.stuckTo = e.id; o.st.sx = o.cx() - e.cx(); o.st.sy = o.cy() - e.cy(); if (e.mods.swallowMetal) { if (e.mods.eraseSwallow || e.f.erase) G.R.destroy(o, 'erase'); } G.audio.sfx('magnet'); continue; }
        const sp = 70 * pw * dt;
        o.support = o.f.zerog ? 'air' : 'floor';
        o.x += (dx / dist) * sp; o.y += (dy / dist) * sp * (o.f.zerog || e.cy() < o.cy() ? 1 : 0.3);
        if (e.mods.orbit) { o.x = e.cx() + Math.cos(e.t * 2 + o.u0) * 22; o.y = e.cy() + Math.sin(e.t * 2 + o.u0) * 12 + o.dims().h / 2; o.support = 'air'; }
        if (e.mods.magPower > 1 && o.f.fragile && dist < 14) G.R.shatter(o, '哐');
      }
    }
    // 触碰即删除
    if (f.erase && !e.mods.eraseOff && !f.sleep) {
      e.eraseCD -= dt;
      if (e.eraseCD <= 0) {
        e.eraseCD = 0.2;
        const bb = e.bbox();
        for (const o of G.game.inRoom(room)) {
          if (o === e || !o.alive || o.kind === 'env' || o.kind === 'fixture' && !e.mods.eraseSweep || o.f.title || o.has('undeletable')) continue;
          if (o.f.erase) continue;
          const ob = o.bbox();
          if (bb.x < ob.x + ob.w && bb.x + bb.w > ob.x && bb.y < ob.y + ob.h && bb.y + bb.h > ob.y) {
            if (o.kind === 'door' && !e.mods.eraseSweep && e.kind !== 'char') continue;
            G.R.destroy(o, 'erase', '被擦除了');
            if (e.mods.voidSpread) G.game.voidHoles.push({ room, x: o.cx(), y: G.itemFloorY(room), r: 8 });
          }
        }
      }
      if (e.mods.voidSpread && Math.random() < dt * 0.6) G.game.voidHoles.push({ room, x: e.x + U.rand(-20, 20), y: G.itemFloorY(room) + U.rand(-4, 12), r: U.randi(4, 9) });
    }
    // 复制增殖
    if (f.copy && f.ts > 0) {
      e.copyT += dt * (e.mods.copyRate || 1) * f.copy * (f.loop ? 3 : 1);
      if (e.copyT > 6) { e.copyT = 0; G.R.copy(e); }
    }
    // 唠叨：附近的人被吸引
    if (f.chatty && e.kind === 'char' && Math.random() < dt * 0.4) {
      const k = U.hash(e.id + Math.floor(e.t)) % 3;
      const pool = e.mods.rant ? ['我们课长那个混蛋……', '周末又要加班……', '我当年可是……'] : e.mods.sleepTalk ? null : e.mods.monologue ? ['线一共三根。', '台本上说，先剪蓝的。', '这起案件的关键在于路线图……'] : e.mods.trapTalk ? ['哪里哪里～', '不敢当不敢当～'] : ['我跟你说啊——', '对了对了——', '……然后呢？'];
      if (pool) e.say(pool[k % pool.length]);
    }
    // 被拉扯（磁力作用在角色身上）
    if (e.st.pulled && e.kind === 'char') { const p = e.st.pulled; e.st.pulled = null; e.x += U.sign(p.x - e.x) * 50 * p.p * dt; if (p.y < e.y - 60 && !e.f.heavy) e.st.liftTo = p.y; }
    // 水球溅射
    if (e.mods.waterball) for (const o of G.game.inRoom(room)) if (o.kind === 'char' && o !== e && Math.abs(o.cx() - e.cx()) < 10 && Math.abs(o.cy() - e.cy()) < 30 && !o.st.splashT) { o.st.splashT = 3; o.say('哇，好冰！'); G.audio.sfx('splash'); X.emit('spark', o.cx(), o.top(), 8, { c: '#9ec3dc' }); }
    if (e.st.splashT) e.st.splashT = Math.max(0, e.st.splashT - dt);
    // 冰面滑倒
    if (e.mods.slippery) for (const o of G.game.inRoom(room)) if (o.kind === 'char' && o.st.walking && Math.abs(o.x - e.x) < 10 && !o.st.knocked) { G.R.knock(o, o.face, 20); o.say('哇！'); if (e.f.fragile) G.R.shatter(e, '咔嚓'); break; }
    // 水银压碎
    if (e.mods.crushFragile) for (const o of G.game.inRoom(room)) if (o !== e && o.f.fragile && !o.mods.unbreakable && Math.abs(o.x - e.x) < 10 && o.y > G.itemFloorY(room) - 20) G.R.shatter(o, '压碎了');
    // 炸弹：防拆
    if (e.mods.tamper && e.has('bomb')) { const p = G.game.player(); if (p && p.room === room && Math.abs(p.x - e.x) < 40) G.game.bombBoost += dt * 1.0; }
  };

  // ---------- 绘制 ----------
  const DRAW = (G.DRAW = {});
  G.drawEnt = function (e, opts = {}) {
    if (!e.alive) return;
    const f = e.f, game = G.game;
    if (e.kind === 'fixture' || e.kind === 'env' || e.kind === 'door') { if (DRAW[e.draw]) DRAW[e.draw](e); drawOverlays(e); return; }
    const sname = e.spriteName();
    if (!sname) { if (DRAW[e.draw]) DRAW[e.draw](e); drawOverlays(e); return; }
    const m = X.meta[sname]; if (!m) return;
    const s = e.scaleNow || 1;
    // 选择帧：走路时用“行走帧条”，否则用普通精灵
    const sh = G.pickSheet(e, sname, m);
    let flip = (sh.face || 1) !== e.face;
    let face = e.face;
    // 坐着/站着发呆时偶尔左右张望（非玩家、没睡着、没被冻住）
    if (e.kind === 'char' && !e.isPlayer && !sh.walk && !f.sleep && !f.still && f.ts !== 0 && !e.placeholder && !e.mods.fightPose && Math.sin(game.clock * 0.37 + (e.u0 || 0) * 3) > 0.93) { flip = !flip; face = -face; }
    let w = Math.round(sh.fw * s), h = Math.round(sh.fh * s);
    const ax = (flip ? sh.fw - sh.ax : sh.ax) * s;
    // 行走时把身体画在“本帧开始时”的位置：支撑脚在整个支撑期都停在同一个地板像素上（脚步与位移严格对齐）
    let walkLag = 0;
    if (sh.walk) { const dir = Math.sign(e.st.lastDx || e.face); walkLag = dir * (dir === e.face ? sh.lag : sh.step - sh.lag); }
    let x = Math.round(e.x - ax - walkLag), y = Math.round(e.y - h);
    // 坐下/站起的过渡
    if (e.st.poseAnim) { const k = (game.clock - e.st.poseAnim.at) / 0.2; if (k >= 1 || k < 0) e.st.poseAnim = null; else y += Math.round(e.st.poseAnim.dy * (1 - k)); }
    // 醉意摇晃 / 漂浮
    if (f.drunk && f.ts !== 0) x += Math.round(Math.sin(e.t * 3) * 1.4);
    if (e.kind === 'char' && e.st.walking && f.ts !== 0 && !f.zerog && !sh.walk) y += Math.floor(e.t * 8) % 2;
    if (e.mods.jitter && Math.random() < 0.08) x += U.randi(-2, 2);
    if (e.mods.tumble) { y += Math.round(Math.sin(e.t * 3) * 2); }
    if (e.mods.dust) { w = Math.max(2, w >> 1); h = Math.max(2, h >> 1); }
    if (e.mods.doorSits) return;
    let variant = null;
    if (e.placeholder) variant = 'placeholder';
    if (f.clear && !f.nocollide) variant = 'dither';
    if (f.nocollide || f.reflection) variant = 'dither2';
    if (e.mods.ice) variant = 'tint:#bfe0f0';
    if (e.st.stamped > 0) variant = 'tint:#e06a50';
    // 液化：水洼形态
    if (f.fluid && !e.mods.waterball && !e.mods.ice) { drawPuddle(e, sname, Math.round(m.w * s)); drawOverlays(e); return; }
    if (e.mods.waterball) { const r = Math.max(5, Math.round(Math.max(w, h) / 3)); X.circle(e.cx(), e.cy(), r, '#6f9fc4', true); X.circle(e.cx(), e.cy(), r, '#2b4f6e'); X.px(e.cx() - r / 2, e.cy() - r / 2, '#e9f4fb'); X.px(e.cx() - r / 2 + 1, e.cy() - r / 2, '#e9f4fb'); const head = X.img[sname]; if (head) { const hh = Math.min(head.height, 18); G.gfx.b.save(); G.gfx.b.globalAlpha = 0.65; G.gfx.b.drawImage(flip ? X.variant(sname, 'flip') : head, 0, 0, head.width, hh, Math.round(e.cx() - head.width / 4), Math.round(e.cy() - hh / 4), Math.round(head.width / 2), Math.round(hh / 2)); G.gfx.b.restore(); } drawOverlays(e); return; }
    const bb = G.gfx.b;
    // 从（可能是帧条的）图上取当前帧画出；pad=1 用于带 1px 描边的派生图
    const blit = (img, dx, dy, dw, dh, pad = 0, rows) => {
      if (!img) return;
      const idx = flip ? sh.total - 1 - sh.fx : sh.fx;
      const sx = idx * sh.fw;
      if (!rows) { bb.drawImage(img, sx, 0, sh.fw + pad * 2, sh.fh + pad * 2, Math.round(dx), Math.round(dy), Math.round(dw), Math.round(dh)); return; }
      // rows=[r0,r1)：只画一段行（用于呼吸、鞠躬）
      const [r0, r1, oy, ox2] = rows; const k = dh / (sh.fh + pad * 2);
      bb.drawImage(img, sx, r0, sh.fw + pad * 2, r1 - r0, Math.round(dx + (ox2 || 0)), Math.round(dy + r0 * k + (oy || 0)), Math.round(dw), Math.round((r1 - r0) * k));
    };
    const varOf = (kind) => { let v = X.variant(sh.name, kind); if (flip) v = X.variant(v, 'flip'); return v; };
    const base = () => { let v = variant ? X.variant(sh.name, variant) : X.img[sh.name]; if (flip) v = X.variant(variant ? v : sh.name, 'flip'); return v; };
    // 快速残影
    if (f.ts > 1.5 && e.hist.length > 3 && e.kind === 'char') {
      for (let k = 1; k <= 2; k++) { const sn = e.hist[e.hist.length - 1 - k * 2]; if (!sn || sn.room !== e.room) continue; blit(varOf('dither2'), Math.round(sn.x - ax), y, w, h); }
    }
    // 投影
    if (e.kind === 'char' && !f.zerog && e.support !== 'air' && e.pose !== 'sit') X.ellipse(e.x, e.y, Math.round(m.w * s * 0.38), 2, 'rgba(30,24,18,0.35)', true);
    // 提线（台本角色）
    if (f.scripted && e.kind === 'char' && (game.act >= 2)) { const top = y + 2; const cxs = e.x; for (const dx of [-m.w * s * 0.3, m.w * s * 0.3]) X.dline(cxs + dx, 0, cxs + dx, top + 8, 'rgba(240,236,220,0.55)', 1, 2); }
    // 主体
    const src = base();
    if (opts.hover) blit(varOf('outline:#f6e7a3'), x - Math.round(s), y - Math.round(s), w + 2 * Math.round(s), h + 2 * Math.round(s), 1);
    const H0 = sh.fh;
    if (e.kind === 'char' && e.st.bowing && !(G.CHARS[e.char] && G.CHARS[e.char].pose.bow)) {
      // 通用鞠躬：上半身向前折下
      const cut = Math.round(H0 * 0.46);
      blit(src, x, y, w, h, 0, [cut, H0, 0]);
      blit(src, x, y, w, h, 0, [0, cut, 4, face * 3]);
    } else if (e.kind === 'char' && !sh.walk && f.ts !== 0 && !f.still && !e.placeholder && (e.pose === 'stand' || e.pose === 'sit')) {
      // 呼吸：上半身每隔一会儿下沉 1px（睡着的人更慢、更深）
      const slow = f.sleep ? 0.55 : 1;
      const breath = Math.sin(game.clock * 2.1 * slow + (e.u0 || 0)) > (f.sleep ? 0.2 : 0.55) ? 1 : 0;
      const cut = Math.round(H0 * (e.pose === 'sit' ? 0.5 : 0.56));
      blit(src, x, y, w, h, 0, [cut, H0, 0]);
      blit(src, x, y, w, h, 0, [0, cut, breath * Math.max(1, Math.round(s))]);
    } else blit(src, x, y, w, h);
    if (f.fragile && !e.mods.unbreakable) { bb.globalAlpha = 0.6; blit(varOf('crack'), x, y, w, h); bb.globalAlpha = 1; }
    if (f.still) blit(varOf('outline:#cfe6f2'), x - Math.round(s), y - Math.round(s), w + 2 * Math.round(s), h + 2 * Math.round(s), 1);
    if (f.metal && e.kind === 'char') { if (Math.floor(e.t * 2) % 4 === 0) X.rect(e.x - m.w * s * 0.2, y + 4, 1, h - 8, 'rgba(255,255,255,0.6)'); }
    drawOverlays(e, { x: Math.round(e.x - m.w * s / 2), y, w: Math.round(m.w * s), h });
  };
  // 选帧：行走帧条（按走过的距离推进，脚步与位移对齐）或普通精灵
  G.pickSheet = function (e, sname, m) {
    const plain = { name: sname, fx: 0, total: 1, fw: m.w, fh: m.h, ax: m.w / 2, face: m.face || 1, walk: false };
    if (e.kind !== 'char' || e.placeholder || e.pose !== 'stand') return plain;
    const ch = G.CHARS[e.char]; if (!ch) return plain;
    const charging = e.mods.fightPose && sname === ch.pose.fight; // 醉拳冲锋时用行走帧条（跑起来），停下出拳时才摆架势
    if (sname !== ch.pose.stand && !charging) return plain;
    const wm = X.meta['walk_' + e.char]; if (!wm || !X.img['walk_' + e.char]) return plain;
    const moving = G.game.clock - (e.st.movedAt == null ? -9 : e.st.movedAt) < 0.14;
    if (!moving || e.f.zerog || e.support === 'air' || e.held) return plain;
    const stride = wm.stride * (e.scaleNow || 1);
    const ph = (((e.st.walkPhase || 0) / stride) % 1 + 1) % 1;
    const fx = Math.floor(ph * wm.frames) % wm.frames;
    const frac = ph * wm.frames - Math.floor(ph * wm.frames);
    return { name: 'walk_' + e.char, fx, total: wm.frames + (wm.idle != null ? 1 : 0), fw: wm.fw, fh: wm.fh, ax: wm.ax, face: 1, walk: true, lag: frac * (stride / wm.frames), step: stride / wm.frames };
  };
  // 每帧在移动之后调用：累计行走相位；跨过“着地帧”时播放脚步声、扬起一点灰
  G.trackWalk = function (e) {
    const g = G.game;
    if (e.kind === 'char') {
      if (e.st.lastX != null && e.st.lastRoom === e.room && e.pose === 'stand' && e.support !== 'air' && !e.held && !e.f.zerog) {
        const dx = e.x - e.st.lastX;
        if (Math.abs(dx) > 0.01 && Math.abs(dx) < 12) {
          const wm = X.meta['walk_' + e.char];
          let before = e.st.walkPhase || 0;
          // 起步：从“经过帧”（双脚并拢、一只脚刚离地）开始，而不是从站姿直接跳到大跨步
          if (wm && (e.st.movedAt == null || g.clock - e.st.movedAt > 0.3)) before = wm.stride * (e.scaleNow || 1) * (3 / wm.frames);
          e.st.walkPhase = before + dx * e.face;
          e.st.lastDx = Math.sign(dx);
          e.st.movedAt = g.clock;
          if (wm) {
            const stride = wm.stride * (e.scaleNow || 1), n = wm.frames;
            const f0 = Math.floor(((before / stride) % 1 + 1) % 1 * n), f1 = Math.floor((((e.st.walkPhase / stride) % 1 + 1) % 1) * n);
            if (f0 !== f1 && wm.contacts.includes(f1) && e.room === g.room && !e.f.fluid) {
              G.audio.sfx(e.f.heavy ? 'punch' : 'step');
              const footX = e.x + e.face * stride * 0.22 * (f1 === wm.contacts[0] ? 1 : 0.6);
              X.emit('dot', footX, e.y - 1, 2, { c: 'rgba(200,190,170,0.9)', up: 6, g: 30, life: 0.35, spread: 6 });
            }
          }
        }
      }
      e.st.lastX = e.x; e.st.lastRoom = e.room;
    } else if (e.kind === 'item' && e.f.roll) {
      if (e.st.lastX != null) e.st.rollDist = (e.st.rollDist || 0) + (e.x - e.st.lastX);
      e.st.lastX = e.x;
    }
  };
  function drawPuddle(e, sname, w) {
    const col = X.avgColor(sname);
    const rx = Math.max(7, Math.round(w * 0.65)), ry = 3;
    X.ellipse(e.x, e.y - 2, rx, ry, col);
    X.ellipse(e.x, e.y - 2, rx, ry, 'rgba(160,200,230,0.35)', true);
    X.rect(e.x - rx / 2, e.y - 4, 3, 1, 'rgba(255,255,255,0.7)');
    if (e.kind === 'char') { // 眼睛
      X.rect(e.x - 3, e.y - 4, 1, 2, '#14161c'); X.rect(e.x + 2, e.y - 4, 1, 2, '#14161c');
    }
    if (Math.random() < 0.03) X.emit('dot', e.x + U.rand(-rx, rx), e.y - 3, 1, { c: '#cfe6f2', up: 10, g: 20, life: 0.4 });
  }
  // 头顶状态图标与特效
  function drawOverlays(e, box) {
    const f = e.f, game = G.game;
    const bb = box || e.bbox();
    const cx = Math.round(bb.x + bb.w / 2);
    let top = Math.round(bb.y);
    // 睡眠 Z
    if (f.sleep && f.ts > 0 && Math.random() < 0.02) X.emit('z', cx + 4, top - 2, 1, { up: 6, g: -6, life: 1.6, spread: 2 });
    // 打嗝
    if (f.drunk && Math.random() < 0.004) { X.emit('icon', cx + 6, top - 4, 1, { txt: 'hic', up: 8, g: -6, life: 1 }); }
    // 计时器
    if (f.bomb && e.id !== 'bomb' && game.act >= 2) { const s = Math.max(0, game.explodeAt() - game.t); X.rect(cx - 13, top - 11, 26, 9, '#14161c'); X.text(U.fmt(s), cx, top - 12, '#ff6a4a', 'center'); top -= 12; }
    // 回送牌
    if (f.oos && e.kind !== 'env') { X.rect(cx - 13, top - 12, 26, 11, '#14161c'); X.text('回送', cx, top - 12, '#f0a83a', 'center'); top -= 13; }
    // 状态图标（外来词条 / 透视模式）
    const show = [];
    const seen = new Set();
    for (const it of e.tags) {
      if (seen.has(it.t)) continue; seen.add(it.t);
      const foreign = it.o !== e.id;
      if (!(foreign || game.eye) || !TAG_ICON[it.t]) continue;
      if (e.kind === 'env') continue;
      show.push(it);
    }
    if (show.length && game.act >= 2) {
      const n = show.length, totalW = n * 8 - 1;
      let x0 = cx - Math.floor(totalW / 2);
      const y0 = Math.max(1, top - 10);
      for (const it of show) {
        const cat = TAGS[it.t] ? TAGS[it.t].cat : 'id';
        X.rect(x0 - 1, y0 - 1, 9, 9, it.pend && it.pend > game.clock ? '#8a8a90' : G.CAT_COL[cat]);
        X.frame(x0 - 1, y0 - 1, 9, 9, it.o !== e.id ? '#b5432e' : '#2b2620');
        X.drawIcon(TAG_ICON[it.t], x0, y0);
        x0 += 9;
      }
    }
    // 最高仇恨：头顶靶心
    if (f.aggro && e.id !== 'bomb') X.drawIcon('target', cx - 3, Math.max(0, top - 20));
    // 高威胁：青筋
    if (f.threat && e.kind === 'char' && Math.floor(e.t * 3) % 2 === 0) X.drawIcon('anger', bb.x + bb.w - 4, top + 2);
    // 非常：红灯闪烁
    if (f.emergency && e.id !== 'ebutton' && e.id !== 'ebutton03' && Math.floor(game.clock * 4) % 2 === 0) X.circle(cx, top - 4, 2, '#e04a2a', true);
    // 盖章残影
    if (e.st.stamped > 0) { e.st.stamped -= 1 / 60; drawStamp(cx, Math.round(bb.y + bb.h / 2), e.st.stampTxt || '差戻'); }
    // 书签缎带
    if (f.bookmark && e.kind !== 'env' && e.id !== 'shiori') X.drawIcon('ribbon', bb.x + bb.w - 3, top - 2);
    // 倒放 / 循环 指示
    if (f.rev && f.ts !== 0) X.drawIcon('rew', cx - 3, top - 22);
    if (e.mods.replayBanner && f.rev) X.text('REPLAY', cx, top - 34, '#e04a2a', 'center');
    // 气泡
    if (e.bark && e.room === game.room) {
      const by = e.kind === 'char' ? top - (show.length ? 12 : 2) : top - 2;
      game.bubbles.push({ text: e.bark.text, x: cx, y: by, ent: e });
    }
  }
  function drawStamp(cx, cy, txt) {
    X.circle(cx, cy, 11, '#c0432c'); X.circle(cx, cy, 10, '#c0432c');
    X.text(txt.slice(0, 2), cx, cy - 6, '#c0432c', 'center');
  }
  G.drawStamp = drawStamp;

  // ---------- 固定物绘制 ----------
  DRAW.none = () => {};
  DRAW.plate = (e) => { const tw = X.measure(e.plate) + 8; X.box(e.x, e.y, tw, 14, '#f4f1e8', '#2b2620'); X.text(e.plate, e.x + 4, e.y + 1, '#26324a'); e.w = tw; e.h = 14; };
  DRAW.speaker = (e) => {
    X.ellipse(e.x + 7, e.y + 4, 7, 3, '#c9c3b2'); X.ellipse(e.x + 7, e.y + 4, 6, 2, '#8f8a7c', true);
    if (e.f.chatty && Math.floor(G.game.clock * 2) % 3 === 0) X.drawIcon('wave', e.x + 15, e.y + 1);
  };
  DRAW.lcd = (e) => {
    X.rect(e.x, e.y, e.w, e.h, '#9a958a'); X.rect(e.x + 2, e.y + 2, e.w - 4, e.h - 4, '#16120e');
    const txt = G.game.lcdText();
    const t = String(txt);
    const tw = X.measure(t);
    G.gfx.b.save(); G.gfx.b.beginPath(); G.gfx.b.rect(e.x + 3, e.y + 2, e.w - 6, e.h - 4); G.gfx.b.clip();
    let tx = e.x + 4;
    if (tw > e.w - 8) tx = e.x + e.w - 4 - ((G.game.clock * 18) % (tw + e.w)) + tw * 0;
    if (tw > e.w - 8) tx = e.x + e.w - ((G.game.clock * 18) % (tw + e.w - 6));
    X.text(t, tx, e.y + 1, G.game.lcdColor || '#f0a83a');
    G.gfx.b.restore();
  };
  DRAW.lcd03 = (e) => { X.rect(e.x, e.y, e.w, e.h, '#16120e'); X.text('各停', e.x + 3, e.y, '#7fd36a'); X.text('白紙', e.x + 26, e.y, '#f0a83a'); };
  DRAW.routemap = (e) => {
    X.box(e.x, e.y, e.w, e.h, '#f4f1e8', '#5b5044');
    const cx = e.x + 8, cy = e.y + 6;
    X.circle(cx, cy, 4, '#7a8a6a');
    X.px(cx, cy - 4, '#ffffff'); X.rect(cx - 1, cy - 5, 3, 2, '#d8d8d8'); // 白紙（上）
    X.rect(cx + 3, cy - 1, 2, 2, '#e2b84a'); // 仮置（右）
    X.rect(cx - 1, cy + 3, 2, 2, '#5c86b3'); // 検収（下）
    X.rect(cx - 5, cy - 1, 2, 2, '#c0432c'); // 出口（左）
    X.text('→', e.x + 13, e.y, e.f.reverse ? '#2b2620' : '#c9c3b2');
    if (!e.has('reverse')) X.rect(e.x + 14, e.y + 3, 10, 6, '#f4f1e8');
  };
  DRAW.danger = (e) => { X.box(e.x, e.y, e.w, e.h, '#e2b84a', '#5b4a20'); if (e.has('threat')) { X.rect(e.x + 6, e.y + 2, 3, 5, '#b5432e'); X.rect(e.x + 6, e.y + 8, 3, 1, '#b5432e'); } else X.rect(e.x + 3, e.y + 4, e.w - 6, 2, '#c9b06a'); };
  DRAW.yusen = (e) => { X.box(e.x, e.y, e.w, e.h, '#e48a3a', '#6b3a14'); X.drawIcon('seat', e.x + 4, e.y + 3); if (e.has('polite')) X.drawIcon('heart', e.x + 4, e.y + 10); };
  DRAW.ebutton = (e) => { X.box(e.x, e.y, e.w, e.h, '#d9d4c6', '#5b5044'); X.circle(e.x + 3, e.y + 4, 2, e.has('emergency') ? '#d23a24' : '#8a6a60', true); X.rect(e.x + 1, e.y + 8, 5, 1, '#5b5044'); };
  DRAW.crewsign = (e) => {
    X.box(e.x, e.y, e.w, e.h, '#f4f1e8', '#5b5044');
    const neg = e.f.forbidNeg;
    if (e.has('forbid') && !neg) { X.drawIcon('ban', e.x + 3, e.y + 3); X.text('禁', e.x + 11, e.y - 1, '#b5432e'); }
    else { X.text(neg ? '禁禁' : '　', e.x + 3, e.y - 1, '#8a8a90'); if (!e.has('forbid')) { X.rect(e.x + 3, e.y + 3, 7, 7, '#e8e2d0'); X.text('入', e.x + 11, e.y - 1, '#5b8a4a'); } }
  };
  DRAW.ad = (e) => {
    const ad = e.ad; const has = (t) => e.has(t);
    X.line(e.x + 4, e.y - 3, e.x + 4, e.y, '#8c8576'); X.line(e.x + e.w - 5, e.y - 3, e.x + e.w - 5, e.y, '#8c8576');
    if (ad === 'big') { X.box(e.x, e.y, e.w, e.h, has('giant') ? '#c0432c' : '#c9a196', '#5b2a20'); X.rect(e.x + 2, e.y + 2, e.w - 4, 3, '#f0d27a'); X.text('BIG', e.x + e.w / 2, e.y + 7, has('giant') ? '#f6f0de' : '#e6d6cf', 'center'); X.rect(e.x + 3, e.y + e.h - 6, e.w - 6, 2, '#f0d27a'); }
    if (ad === 'copy') { X.box(e.x, e.y, e.w, e.h, '#eef0f2', '#4a5468'); X.text(has('copy') ? '複写' : '……', e.x + e.w / 2, e.y + 1, '#26324a', 'center'); X.rect(e.x + 6, e.y + 17, e.w - 12, 7, '#a9adb8'); X.rect(e.x + 8, e.y + 15, e.w - 16, 2, '#f4f1e8'); if (has('copy')) { X.rect(e.x + 3, e.y + 15, 3, 4, '#f4f1e8'); X.rect(e.x + e.w - 6, e.y + 15, 3, 4, '#f4f1e8'); } }
    if (ad === 'sleep') { X.box(e.x, e.y, e.w, e.h, '#26324a', '#14161c'); X.circle(e.x + 9, e.y + 9, 4, '#f0d890', true); X.circle(e.x + 11, e.y + 8, 3, '#26324a', true); X.px(e.x + 18, e.y + 6, '#f0d890'); X.px(e.x + 21, e.y + 11, '#f0d890'); if (has('sleep')) X.text('熟睡', e.x + e.w / 2, e.y + 17, '#f0d890', 'center'); }
    if (ad === 'mini') { X.box(e.x, e.y, e.w, e.h, '#f6f0de', '#5b5044'); X.text(has('mini') ? '小さく' : '……', e.x + e.w / 2, e.y + 2, '#5c86b3', 'center'); X.rect(e.x + 15, e.y + 18, 14, 9, '#cfd0d8'); X.frame(e.x + 15, e.y + 18, 14, 9, '#5b5044'); }
  };
  DRAW.crewdoor = (e) => {
    if (e.open || !e.has('door') || e.mods.forceOpen) {
      if (e.mods.liftable && e.st.lifted) {}
      X.rect(e.x + 4, e.y + 4, e.w - 8, e.h - 4, '#1a1c22');
      X.rect(e.x + 6, e.y + 30, e.w - 12, 50, '#2c303a');
      X.ditherRect(e.x + 4, e.y + e.h - 20, e.w - 8, 16, '#3a3f4c');
    }
    if (e.mods.doorWander && e.st.wx) { X.rect(e.x + 4, e.y + 4, e.w - 8, e.h - 4, '#1a1c22'); X.box(e.x + e.st.wx, e.y, e.w, e.h, '#d6cdb6', '#5b5044'); }
    if (e.f.clear && !e.open) X.ditherRect(e.x + 4, e.y + 4, e.w - 8, e.h - 8, 'rgba(26,28,34,0.6)');
    if (e.vent) X.rect(e.x + 9, e.y + e.h - 14, e.w - 18, 1, 'rgba(60,50,40,0.5)');
  };
  DRAW.gangway = (e) => {
    if (e.open || !e.has('door') || e.mods.forceOpen) { X.rect(e.x + 2, e.y + 2, e.w - 4, e.h - 2, '#2a2f3c'); X.ditherRect(e.x + 2, e.y + 2, e.w - 4, e.h - 2, '#4a5468'); }
    if (e.f.still) { X.frame(e.x + 4, e.y + 16, 18, 44, '#cfe6f2'); X.drawIcon('pause', e.x + 10, e.y + 6); }
  };
  DRAW.reflection = (e) => {
    const game = G.game; const b = G.gfx.b;
    b.save(); b.beginPath(); b.rect(e.x, e.y, e.w, e.h); b.clip();
    b.globalAlpha = 0.13;
    for (const id of ['kuro', 'nana']) {
      const c = game.get(id); if (!c || !c.alive || c.room !== 'car04' || c.x > 160) continue;
      const sn = c.spriteName(); const src = X.variant(X.variant(sn, 'sil:#b8c8dc'), 'dither');
      if (src) b.drawImage(src, Math.round(c.x - src.width / 2), Math.round(e.y + e.h - src.height + 8));
    }
    b.restore();
    if (!e.has('reflection')) X.ditherRect(e.x + 2, e.y + 2, e.w - 4, e.h - 4, 'rgba(20,24,34,0.4)');
  };
  DRAW.monitor = (e) => {
    const t = G.game.clock;
    X.rect(e.x + 2, e.y + 2, e.w - 4, e.h - 4, '#1c2a22');
    for (let i = 0; i < 4; i++) { const w = 6 + ((U.hash('m' + i + Math.floor(t)) % 14)); X.rect(e.x + 4, e.y + 4 + i * 4, w, 1, i === 1 && Math.floor(t * 2) % 2 ? '#e8826b' : '#8fd48a'); }
  };
  DRAW.lostbox = (e) => { X.rect(e.x + 5, e.y + 6, 17, 6, '#f4f1e8'); X.text('忘', e.x + 8, e.y + 3, '#5b5044'); };
  DRAW.puddle = (e) => {
    const n = e.f.fluid ? 1 : 0;
    if (n) { X.ellipse(e.x, e.y - 2, 9, 2, '#8fb4cf'); X.ellipse(e.x, e.y - 2, 9, 2, 'rgba(255,255,255,0.3)', true); }
    else { X.rect(e.x - 4, e.y - 2, 8, 2, '#c8c2b0'); }
    // 空调冷凝水的滴落
    const ph = (G.game.clock + 0.3) % 2.4;
    if (ph < 1.2 && e.room === 'car04' && e.home && Math.abs(e.x - e.home.x) < 3) { const yy = 16 + ph * ph * 150; if (yy < e.y - 3) X.rect(e.x, yy, 1, 2, '#9ec3dc'); }
  };
  DRAW.signroll = () => {};
})();
