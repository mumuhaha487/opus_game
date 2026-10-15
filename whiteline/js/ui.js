/* =========================================================
   ui.js —— DOM 界面：布局/缩放、HUD、检视器、剪贴板、提示、模态窗、
   台本、对象列表、图鉴、设置、炸弹特写、监视器、结局、标题、第四幕界面词条
   ========================================================= */
(function () {
  'use strict';
  const U = G.util, X = G.gfx;
  const UI = (G.ui = { modalOpen: false, dragging: null, features: 1 });
  const $ = (id) => document.getElementById(id);
  let gameEl, hudEl, stageEl, panelEl, insEl, clipEl, objEl;

  // ---------- 图标 ----------
  const ICO = {
    book: ['.#####.', '#.....#', '#.###.#', '#.....#', '#.###.#', '#.....#', '.#####.'],
    list: ['#.####', '......', '#.####', '......', '#.####'],
    eye: ['..###..', '.#...#.', '#..#..#', '.#...#.', '..###..'],
    dex: ['#######', '#.#.#.#', '#######', '#.#.#.#', '#######'],
    swap: ['..#....', '.######', '..#....', '....#..', '######.', '....#..'],
    pause: ['##.##', '##.##', '##.##', '##.##', '##.##'],
    play: ['#....', '###..', '#####', '###..', '#....'],
    ff: ['#..#..', '##.##.', '######', '##.##.', '#..#..'],
    menu: ['#####', '.....', '#####', '.....', '#####'],
  };
  UI.icon = (n, c) => X.svgIcon(ICO[n], c);

  UI.init = function () {
    gameEl = $('game'); hudEl = $('hud'); stageEl = $('stage'); panelEl = $('panel'); insEl = $('inspector'); clipEl = $('clipboard'); objEl = $('obj-text');
    document.querySelectorAll('.ic[data-ic]').forEach((el) => { el.innerHTML = UI.icon(el.dataset.ic); });
    $('btn-ff').innerHTML = UI.icon('ff'); $('btn-pause').innerHTML = UI.icon('pause'); $('btn-menu').innerHTML = UI.icon('menu');
    $('btn-ff').onclick = () => UI.toggleFF();
    $('btn-pause').onclick = () => UI.togglePause();
    $('btn-menu').onclick = () => UI.openMenu();
    $('btn-hint').onclick = () => { G.audio.sfx('select'); UI.glowHint(false); G.story.hint(); };
    $('btn-script').onclick = () => UI.openScript();
    $('btn-list').onclick = () => UI.openObjects();
    $('btn-eye').onclick = () => { G.game.eye = !G.game.eye; $('btn-eye').classList.toggle('on', G.game.eye); G.audio.sfx('select'); };
    $('btn-dex').onclick = () => UI.openDex();
    $('btn-swap').onclick = () => UI.swapChar();
    window.addEventListener('resize', UI.layout);
    window.addEventListener('orientationchange', () => setTimeout(UI.layout, 200));
    UI.layout();
    setInterval(UI.hud, 100);
  };

  // ---------- 布局与像素缩放 ----------
  UI.layout = function () {
    const vw = window.innerWidth, vh = window.innerHeight, dpr = window.devicePixelRatio || 1;
    const small = Math.min(vw, vh) < 600;
    const target = small ? 15 : vw > 1700 ? 22 : 19;
    const k = Math.max(1, Math.round((target * dpr) / 12));
    const fs = (k * 12) / dpr, p = fs / 12;
    const root = document.documentElement.style;
    root.setProperty('--fs', fs + 'px'); root.setProperty('--p', p + 'px');
    const wide = vw >= vh * 1.15 && vw >= 640;
    gameEl.classList.toggle('wide', wide); gameEl.classList.toggle('tall', !wide);
    const panelW = wide ? Math.round(U.clamp(vw * 0.3, 300, 470)) : 0;
    root.setProperty('--panel-w', panelW + 'px');
    const hudH = hudEl.offsetHeight || 40;
    let aw, ah;
    if (gameEl.classList.contains('freed')) { aw = vw - 8; ah = vh - 8; }
    else if (wide) { aw = vw - panelW - 24; ah = vh - hudH - 20; }
    else { aw = vw - 10; ah = Math.max(160, Math.min(vh * 0.52, vh - hudH - 300)); }
    const sz = X.fit(aw, ah);
    stageEl.style.width = sz.w + 'px'; stageEl.style.height = sz.h + 'px';
    if (!wide) $('stage-wrap').style.height = sz.h + 12 + 'px'; else $('stage-wrap').style.height = '';
    UI.positionDialog();
    // 标题画面
    const tc = $('title-cv');
    if (tc) { const s = Math.max(vw / 384, vh / 256); const K = Math.max(1, Math.ceil(s * dpr)); tc.width = 384 * Math.min(K, 6); tc.height = 256 * Math.min(K, 6); tc.style.width = Math.ceil(384 * s) + 'px'; tc.style.height = Math.ceil(256 * s) + 'px'; UI.drawTitle && UI.drawTitle(); }
    UI.positionTitle && UI.positionTitle();
  };
  UI.positionDialog = function () {
    const d = $('dialog'); if (!d || !gameEl) return;
    const gr = gameEl.getBoundingClientRect(), sr = stageEl.getBoundingClientRect();
    if (gameEl.classList.contains('wide')) {
      d.style.left = sr.left - gr.left + 8 + 'px'; d.style.width = sr.width - 16 + 'px'; d.style.right = 'auto';
      d.style.top = 'auto'; d.style.bottom = gr.bottom - sr.bottom + 8 + 'px';
    } else {
      d.style.left = ''; d.style.right = ''; d.style.width = '';
      d.style.bottom = 'auto'; d.style.top = sr.bottom - gr.top + 8 + 'px';
    }
  };

  // ---------- HUD ----------
  UI.hud = function () {
    const g = G.game; if (!g || !g.running) return;
    $('hud-draft').textContent = `第${g.loopNo}稿`;
    if (g.act >= 4 && g.collapse) $('hud-clock').textContent = g.collapse.on ? `破棄 ${U.fmt(g.collapse.t)}` : '破棄 停止';
    else if (g.room === 'void') $('hud-clock').textContent = '--:--';
    else $('hud-clock').textContent = `${U.clock(g.t)}`;
    const sc = G.scan;
    const lbl = $('hud-scan-lbl'), val = $('hud-scan');
    if (!sc.enabled()) { lbl.textContent = g.act === 1 ? '爆炸' : '巡检'; val.textContent = g.act === 1 && g.room !== 'void' ? U.fmt(g.bombSecs()) : '--:--'; val.className = ''; }
    else if (sc.state === 'sweep') { lbl.textContent = '巡检'; val.textContent = '扫描中'; val.className = 'sweep'; }
    else { const s = sc.next - g.t; lbl.textContent = sc.skip ? '巡检取消' : '巡检'; val.textContent = U.fmt(s); val.className = s <= 10 && !sc.skip ? 'warn' : ''; }
    const dots = $('hud-scan-dots');
    const total = Math.round(G.LOOP / (sc.interval || 60)) - 1;
    if (dots.childElementCount !== total) { dots.innerHTML = ''; for (let i = 0; i < total; i++) dots.appendChild(document.createElement('span')); }
    [...dots.children].forEach((s, i) => { s.className = i < sc.doneCount ? 'done' : ''; });
    const al = $('hud-alert');
    if (al.childElementCount !== 3) { al.innerHTML = ''; for (let i = 0; i < 3; i++) al.appendChild(document.createElement('span')); }
    [...al.children].forEach((s, i) => s.classList.toggle('on', i < g.alert));
    $('hud-alert-cell').style.visibility = g.act >= 2 ? 'visible' : 'hidden';
    $('btn-pause').innerHTML = UI.icon(g.paused ? 'play' : 'pause');
    $('btn-pause').classList.toggle('on', g.paused);
    $('btn-ff').classList.toggle('on', g.ff);
    // 选中对象离开房间 → 清空
    if (g.sel) { const s = g.get(g.sel); if (!s || !s.alive || (s.room !== g.room && s.room !== 'bombui' && s.kind !== 'ui')) { g.sel = null; UI.refresh(); } }
    // 只在内容真的变了、且手指/鼠标没按着时重建检视器（避免吞掉点击与拖拽）
    if (!UI.pointerDown && !UI.dragging) { const sig = UI.insSig(); if (UI.insDirty || sig !== UI.lastSig) { UI.lastSig = sig; UI.renderInspector(); } }
  };
  UI.toggleFF = function () { const g = G.game; g.ff = !g.ff; G.audio.sfx('select'); if (g.ff) UI.toast('快进 ×4（再点一次恢复）', 'small'); };
  UI.togglePause = function () { const g = G.game; g.paused = !g.paused; G.audio.sfx('select'); };
  UI.glowHint = (on) => $('btn-hint').classList.toggle('glow', !!on);

  // ---------- 提示条 ----------
  const toasts = [];
  UI.toast = function (html, kind) {
    const box = $('toasts'); if (!box) return;
    const el = U.el('div', 'toast' + (kind === 'react' ? ' react' : ''), html);
    box.appendChild(el);
    toasts.push({ el, t: kind === 'small' ? 3.2 : kind === 'react' ? 5.5 : 4 });
    while (box.children.length > (G.game && G.game.act >= 2 ? 3 : 2)) { box.removeChild(box.firstChild); toasts.shift(); }
  };
  UI.tickToasts = function (dt) {
    for (let i = toasts.length - 1; i >= 0; i--) { const t = toasts[i]; t.t -= dt; if (t.t <= 0.3 && !t.out) { t.out = true; t.el.classList.add('out'); } if (t.t <= 0) { t.el.remove(); toasts.splice(i, 1); } }
    if (UI.bannerT > 0) { UI.bannerT -= dt; if (UI.bannerT <= 0) $('banner').classList.add('hidden'); }
    if (UI.subT > 0) { UI.subT -= dt; if (UI.subT <= 0) $('subtitle').classList.add('hidden'); }
  };
  UI.reactionToast = function (r, e, isNew) {
    const n = Object.keys(G.meta.dex).length, total = G.REACTIONS.length;
    UI.toast(`${isNew ? '<span class="new">新发现</span>' : ''}<b class="rt">化学反应「${U.esc(r.name)}」</b> ${r.t.map((t) => G.tagLabel(t)).join('＋')}<span class="rd">${U.esc(r.desc)}</span>${isNew ? `<span class="rd">图鉴 ${n}/${total}</span>` : ''}`, 'react');
  };
  UI.banner = function (text, kind, dur = 2.5) { const b = $('banner'); b.textContent = text; b.className = kind === 'red' ? 'red' : ''; UI.bannerT = dur; };
  UI.announce = function (jp, zh, noVoice) {
    const s = $('subtitle'); s.innerHTML = `<span class="jp">${U.esc(jp)}</span>${U.esc(zh)}`; s.classList.remove('hidden'); UI.subT = 5.5;
    if (!noVoice) G.audio.say(jp);
  };
  UI.stampAlert = function (n, why) { UI.banner(`警戒 ${n}/3${why ? ' · ' + why : ''}`, 'red', 2.6); const c = $('hud-alert-cell'); c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake'); };
  UI.setObjective = function (text) { objEl.textContent = text || '……'; UI.glowHint(false); };

  // ---------- 功能解锁 ----------
  UI.lockFeatures = function (lv) {
    UI.features = lv;
    const show = (id, on) => $(id).classList.toggle('hidden-soft', !on);
    show('btn-script', lv >= 1 && (G.story.flags.bookletRead || lv >= 2));
    show('btn-list', true);
    show('btn-eye', lv >= 1.5);
    show('btn-dex', lv >= 1.5);
    show('btn-swap', lv >= 3 && G.story.flags.shioriFree);
    clipEl.classList.toggle('hidden', lv < 1.5);
    UI.refresh();
  };
  UI.unlockScript = () => $('btn-script').classList.remove('hidden-soft');
  UI.enableSwap = (on) => $('btn-swap').classList.toggle('hidden-soft', !on);
  UI.insSig = function () {
    const g = G.game; const e = g.sel ? g.get(g.sel) : null;
    let s = (g.sel || '-') + '|' + G.clip.slots.length + '|' + G.clip.sel + '|' + g.room + '|' + g.act + '|' + (G.ui4 && G.ui4.on ? 1 : 0);
    if (e) s += '|' + e.alive + '|' + e.room + '|' + e.tags.map((i) => i.t + (i.lock ? 'L' : '') + (i.o === e.id ? '' : '*') + (i.pend && i.pend > g.clock ? 'P' : '')).join(',') + '|' + [...e.react.keys()].join(',') + '|' + (e.st && e.st.cut ? 1 : 0) + '|' + (G.story.flags.kuroFree ? 1 : 0) + (G.story.flags.follow ? 1 : 0);
    return s;
  };
  document.addEventListener('pointerdown', () => { UI.pointerDown = true; }, true);
  ['pointerup', 'pointercancel'].forEach((t) => document.addEventListener(t, () => { UI.pointerDown = false; }, true));
  UI.swapChar = function () {
    const g = G.game;
    if (!G.story.flags.shioriFree) return;
    const s = g.get('shiori'), n = g.get('nana');
    if (!s || !n) return;
    const other = g.ctrlId === 'nana' ? s : n;
    if (!G.ROOMS[other.room]) { UI.toast(`${other.name} 现在不在任何一节车厢里。`); return; }
    g.ctrlId = g.ctrlId === 'nana' ? 'shiori' : 'nana';
    const p = g.player();
    g.room = p.room; g.moveTarget = null; g.sel = null;
    UI.toast(`现在操作：${g.ctrlId === 'nana' ? '七号' : '栞'}`, 'small');
    G.audio.sfx('select');
    UI.refresh();
  };

  // ---------- 选择 ----------
  UI.select = function (e) {
    const g = G.game;
    g.sel = e ? e.id : null;
    if (e) G.audio.sfx('select');
    UI.refresh();
    if (e) G.bus.emit('selected', e);
  };
  UI.refresh = function () { UI.insDirty = true; UI.renderClip(); UI.renderInspector(); };
  UI.closeInspectorForDialog = function () {};

  // 词条 DOM
  UI.tagEl = function (inst, opts = {}) {
    const def = G.TAGS[inst.t] || { name: inst.t, cat: 'id' };
    const el = U.el('span', `tag c-${def.cat}` + (inst.lock ? ' locked' : '') + (opts.btn ? ' btn' : '') + (opts.foreign ? ' foreign' : '') + (opts.sel ? ' sel' : ''));
    el.innerHTML = `<span class="cat">${G.CATS[def.cat].g}</span>${U.esc(def.name)}` + (inst.lock ? `<i class="lk">${X.svgIcon(X.ICONS.lock, '#2b2620')}</i>` : '') + (inst.pend && inst.pend > G.game.clock ? '…' : '');
    el.title = def.desc || '';
    return el;
  };

  // ---------- 检视器 ----------
  UI.renderInspector = function () {
    UI.insDirty = false; UI.lastIns = G.game.realClock;
    const g = G.game;
    const e = g.sel ? g.get(g.sel) : null;
    insEl.innerHTML = '';
    if (!e) {
      const p = g.player();
      const tips = g.act >= 2 ? '点选场景里的东西查看它的词条。<br><b>点词条＝剪下</b>；选中目标后<b>点剪贴板＝贴上</b>；也可以直接拖拽。' : '点击地面移动，点击人或物品调查。';
      insEl.innerHTML = `<div class="sect-title"><span>检视</span><span>${U.esc(G.ROOMS[g.room] ? G.ROOMS[g.room].name : '')}</span></div><div class="ins-empty">${tips}</div>`;
      if (p && p.alive && g.act >= 2) {
        const row = U.el('div', 'ins-acts');
        const b = U.el('button', 'act-btn ghost', '查看自己'); b.onclick = () => UI.select(p); row.appendChild(b);
        insEl.appendChild(row);
      }
      return;
    }
    const head = U.el('div', 'ins-head');
    const ic = U.el('div', 'ins-icon');
    const cv = document.createElement('canvas');
    const sn = e.kind === 'char' ? G.CHARS[e.char].pt : e.spriteName && e.spriteName();
    if (sn && X.img[sn]) { const im = X.img[sn]; cv.width = im.width; cv.height = im.height; const c = cv.getContext('2d'); c.imageSmoothingEnabled = false; c.drawImage(im, 0, 0); cv.style.width = '100%'; cv.style.imageRendering = 'pixelated'; if (e.placeholder) cv.style.filter = 'grayscale(1) brightness(1.2)'; }
    else { cv.width = 8; cv.height = 8; const c = cv.getContext('2d'); const icn = X.icon(G.TAG_ICON[(e.tags[0] || {}).t] || 'tag'); if (icn) { cv.width = icn.width; cv.height = icn.height; c.drawImage(icn, 0, 0); } cv.style.width = '60%'; }
    ic.appendChild(cv);
    const nm = U.el('div', 'ins-name', `<b>${U.esc(e.name)}</b><span class="sub">${U.esc(kindName(e))}</span>`);
    head.appendChild(ic); head.appendChild(nm);
    if (g.act >= 4 && G.ui4.on) { const x = U.el('button', 'mini-btn', '×'); x.style.marginLeft = 'auto'; x.dataset.ui = 'ui_close'; x.onclick = () => UI.select(null); head.appendChild(x); G.ui4.attach(x, 'ui_close'); }
    insEl.appendChild(head);
    insEl.appendChild(U.el('div', 'ins-desc', U.esc(e.desc || '')));
    // 词条
    if (g.act >= 2 || g.voidMode || g.sandbox) {
      insEl.appendChild(U.el('div', 'sect-title', `<span>词条（点击剪下 · 可拖进剪贴板）</span><span>${e.tags.length}</span>`));
      const tw = U.el('div', 'ins-tags');
      if (!e.tags.length) tw.appendChild(U.el('span', 'ins-empty', '（没有词条）'));
      for (const inst of e.tags) {
        const el = UI.tagEl(inst, { btn: true, foreign: inst.o !== e.id });
        el.onclick = () => G.tags.cut(e, inst, true);
        UI.makeDraggable(el, { from: 'ent', ent: e, inst });
        tw.appendChild(el);
      }
      insEl.appendChild(tw);
      if (e.tags.length) { const dl = U.el('div', 'ins-desc'); dl.innerHTML = [...new Set(e.tags.map((i) => i.t))].map((t) => G.TAGS[t] ? '<b style="font-weight:normal;color:var(--navy)">' + G.tagLabel(t) + '</b>' + U.esc(G.TAGS[t].desc) : '').join('<br>'); insEl.appendChild(dl); }
      // 活跃的化学反应
      if (e.react.size) { const rs = [...e.react.values()].map((r) => `「${U.esc(r.name)}」`).join(' '); insEl.appendChild(U.el('div', 'ins-desc', `<span style="color:var(--red2)">反应中：</span>${rs}`)); }
    }
    // 动作
    const acts = U.el('div', 'ins-acts');
    for (const a of UI.actionsFor(e)) { const b = U.el('button', 'act-btn' + (a.red ? ' red' : '') + (a.ghost ? ' ghost' : ''), U.esc(a.label)); b.onclick = (ev) => { ev.stopPropagation(); G.audio.sfx('select'); a.fn(); }; acts.appendChild(b); }
    insEl.appendChild(acts);
    // 粘贴提示
    if (G.clip.slots.length && (g.act >= 2 || g.voidMode || g.sandbox) && e.kind !== 'loose') insEl.appendChild(U.el('div', 'cb-hint', '↓ 点剪贴板里的词条，贴到 <b>' + U.esc(e.name) + '</b> 身上'));
  };
  function kindName(e) {
    if (e.kind === 'char') return e.id === 'nana' ? '你自己' : e.placeholder ? '占位符' : '人物';
    return { item: '物品', fixture: '车内设施', door: '门', env: '车厢', loose: '掉落的词条', wire: '导线', ui: '界面元素' }[e.kind] || '';
  }
  UI.actionsFor = function (e) {
    const g = G.game, acts = [];
    const p = g.player();
    if (e.kind === 'loose') { acts.push({ label: '捡起（放进剪贴板）', fn: () => { if (e.tags[0]) G.tags.cut(e, e.tags[0]); } }); return acts; }
    if (e.kind === 'wire') {
      if (!e.st.cut) acts.push({ label: '剪断这根线', red: true, fn: () => UI.cutWireByPlayer(e) });
      return acts;
    }
    if (e.kind === 'ui') return acts;
    acts.push({ label: e.kind === 'char' && e.id !== 'nana' && !e.placeholder ? '交谈' : '调查', fn: () => UI.inspect(e) });
    if (e.id === 'bomb' || (e.has('bomb') && e.kind === 'item')) acts.push({ label: '打开纸袋', fn: () => UI.openBomb() });
    if (e.kind === 'door' && e.exit && p) acts.push({ label: '走过去', fn: () => { g.moveTarget = { x: e.exit === 'left' ? 0 : 400 }; } });
    if (e.id === 'nana' && p && p.id === 'nana' && p.pose !== 'sit' && p.room === 'car04') acts.push({ label: '回座位坐下', fn: () => { g.moveTarget = { x: 118, sit: true }; } });
    if (e.kind === 'char' && e.id === 'shiori' && G.story.flags.shioriFree) acts.push({ label: G.story.flags.follow ? '让她原地待命' : '让她跟着我', ghost: true, fn: () => { G.story.flags.follow = !G.story.flags.follow; UI.refresh(); } });
    if (e.id === 'kuro' && G.story.flags.kuroFree && g.act >= 3) acts.push({ label: '告诉他剪线顺序', red: true, fn: () => UI.tellKuro() });
    if (e.id === 'shiori' && g.ctrlId !== 'shiori' && G.story.flags.shioriFree) acts.push({ label: '切换为栞', ghost: true, fn: () => UI.swapChar() });
    return acts;
  };
  UI.tellKuro = async function () {
    const order = await G.dlg.choose('nana', '（先剪哪一根？）', [{ text: '黄 → 蓝 → 红', value: ['cYellow', 'cBlue', 'cRed'] }, { text: '蓝 → 黄 → 红', value: ['cBlue', 'cYellow', 'cRed'] }, { text: '红 → 蓝 → 黄', value: ['cRed', 'cBlue', 'cYellow'] }, { text: '……再想想', value: null }]);
    if (!order) return;
    await G.dlg.say('kuro', `${order.map((t) => G.tagName(t)).join('、')}……明白了。交给我。`, { pt: 'pt_kuro_smile' });
    G.story.flags.kuroPlan = order;
  };

  // 调查 / 交谈
  UI.inspect = async function (e) {
    const g = G.game;
    if (G.dlg.isOpen() || !e || !e.alive) return;
    G.bus.emit('inspected', e);
    if (e.inspect === 'booklet') return; // story 处理
    if (e.inspect === 'monitor') { if (g.act === 2 && !G.story.done.a2_monitor) { G.bus.emit('inspectedMonitor'); return; } await UI.showMonitor(); return; }
    if (e.inspect === 'routemap') { await UI.showRoutemap(); return; }
    if (e.inspect === 'bomb' && g.act === 1) { await UI.openBomb(); return; }
    if (e.inspect === 'rearwin') { await G.dlg.say('nana', g.act >= 2 ? '（隧道向后延伸了一百米左右……然后就断了。断口外面是一片空白，像没写完的稿纸。）' : '（隧道一直向后延伸，看不到尽头。）'); return; }
    if (e.inspect === 'crewbag') { await G.dlg.say('nana', '（时刻表、替换用的白手套、一本笔记。笔记上写满了同一句话：「本日も、異常なし。」）'); return; }
    if (e.kind === 'door' && e.mods.talkOpen) { e.st.talked = true; e.st.holdT = 8; e.say('好的好的，请进～'); G.audio.sfx('door'); return; }
    if (e.kind === 'door' && e.mods.guard) { e.say('关系者以外，禁止入内。'); return; }
    const talk = UI.talkLines(e);
    if (talk) { for (const l of talk) await G.dlg.say(l[0], l[1], l[2] || {}); return; }
    await G.dlg.say(null, e.desc || '……', { name: e.name });
  };
  UI.talkLines = function (e) {
    const g = G.game, f = e.f;
    if (e.kind !== 'char' || e.placeholder) return null;
    if (e.id === 'nana') return [['nana', '（乘客07。测试假人。胸口的黑黄标记，原来是这个意思。）']];
    if (f.sleep) return [[e.char, e.id === 'tanaka' ? '……呼……呼……课长……' : '……Zzz……']];
    if (f.still) return [[null, `${e.name} 一动不动。`, { name: e.name }]];
    if (e.id === 'kuro') {
      if (G.story.flags.kuroFree) return [['kuro', '……要剪哪根线，你告诉我就好。', { pt: 'pt_kuro_smile' }]];
      if (g.t < 120) return [['kuro', '……别碍事。'], ['nana', '（他一直盯着车厢里每一个人，像在等什么事情发生。）']];
      if (g.t < 270) return [['kuro', '退后。这是我的工作。'], ['kuro', '线有三根……红、蓝、黄。不会错的——先剪蓝的。']];
      return [['kuro', '……']];
    }
    if (e.id === 'tanaka') { if (f.drunk) return [['tanaka', '嗝……小哥，你也是末班车？……我们课长啊……']]; return [['tanaka', '……我、我刚才怎么了？']]; }
    if (e.id === 'shira') {
      if (!f.crew) return [['shira', '我……是谁来着？', { pt: 'pt_shira_confused' }]];
      if (g.act === 1) return [['shira', '终点？这班车的终点是……'], ['shira', '……咦？是哪里来着？', { pt: 'pt_shira_confused' }]];
      return [['shira', '这位乘客，请回到座位上。巡检时间快到了。']];
    }
    if (e.id === 'shiori') return [['shiori', U.choice(['需要我做什么？切换到我就好。', '别忘了——我在这里本身就是异常，巡检的时候得藏好。', '书签能夹住时间。好好用它。']), {}]];
    if (e.char === 'insp') return [['insp', '……差戻。']];
    return null;
  };

  // ---------- 剪贴板 ----------
  UI.renderClip = function () {
    const g = G.game; const c = G.clip;
    clipEl.innerHTML = '<div class="cb-clip"></div>';
    clipEl.appendChild(U.el('div', 'sect-title', `<span>剪贴板</span><span>${c.slots.length}/${c.cap}</span>`));
    const board = U.el('div', 'cb-board'); board.id = 'cb-board';
    for (let i = 0; i < c.cap; i++) {
      const slot = U.el('div', 'cb-slot' + (c.slots[i] ? '' : ' empty'));
      slot.dataset.slot = i;
      if (c.slots[i]) {
        const el = UI.tagEl(c.slots[i], { btn: true, sel: c.sel === i });
        el.onclick = (ev) => { ev.stopPropagation(); UI.clickSlot(i); };
        UI.makeDraggable(el, { from: 'clip', slot: i, inst: c.slots[i] });
        slot.appendChild(el);
      }
      board.appendChild(slot);
    }
    clipEl.appendChild(board);
    const sel = g.sel ? g.get(g.sel) : null;
    let hint = '';
    if (c.sel >= 0 && c.slots[c.sel]) hint = `已拿起 ${G.tagLabel(c.slots[c.sel].t)}：点场景里的目标贴上去。<button class="mini-btn" id="cb-drop">退回原处</button> <button class="mini-btn" id="cb-cancel">放下</button>`;
    else if (c.slots.length && sel) hint = `点词条 → 贴到 <b>${U.esc(sel.name)}</b>`;
    else if (c.slots.length) hint = '点词条拿起它，再点场景中的目标。';
    else hint = '剪下的词条会出现在这里。';
    const h = U.el('div', 'cb-hint', hint); clipEl.appendChild(h);
    const dropB = $('cb-drop'); if (dropB) dropB.onclick = (ev) => { ev.stopPropagation(); G.tags.discard(c.sel); };
    const canB = $('cb-cancel'); if (canB) canB.onclick = (ev) => { ev.stopPropagation(); c.sel = -1; UI.renderClip(); G.ui.holdTip(); };
    UI.holdTip();
  };
  UI.clickSlot = function (i) {
    const g = G.game, c = G.clip;
    const sel = g.sel ? g.get(g.sel) : null;
    if (sel && sel.alive && sel.kind !== 'loose' && c.sel !== i) { G.tags.paste(i, sel); return; }
    c.sel = c.sel === i ? -1 : i;
    G.audio.sfx('select');
    UI.renderClip();
  };
  UI.holdTip = function () {
    const c = G.clip, el = $('hold-tip');
    if (c.sel >= 0 && c.slots[c.sel]) { el.textContent = `拿着 ${G.tagLabel(c.slots[c.sel].t)} —— 点目标贴上`; el.classList.remove('hidden'); }
    else el.classList.add('hidden');
  };

  // ---------- 拖拽 ----------
  UI.makeDraggable = function (el, data) {
    el.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return;
      const sx = ev.clientX, sy = ev.clientY; let ghost = null; let moved = false;
      const mv = (e2) => {
        if (!moved && Math.hypot(e2.clientX - sx, e2.clientY - sy) > 8) {
          moved = true; UI.dragging = data;
          ghost = el.cloneNode(true); ghost.classList.add('drag-ghost'); $('fx-root').appendChild(ghost);
          el.style.opacity = '0.35';
        }
        if (moved) { ghost.style.transform = `translate(${e2.clientX - 20}px, ${e2.clientY - 14}px)`; UI.dragOver(e2.clientX, e2.clientY); }
      };
      const up = (e2) => {
        window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
        if (!moved) return;
        el.style.opacity = ''; if (ghost) ghost.remove(); UI.dragging = null; UI.dragOver(-1, -1);
        UI.drop(data, e2.clientX, e2.clientY);
        el._dragged = true; setTimeout(() => { el._dragged = false; }, 50);
      };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    });
    el.addEventListener('click', (ev) => { if (el._dragged) { ev.stopImmediatePropagation(); ev.preventDefault(); } }, true);
  };
  UI.dragOver = function (x, y) {
    const board = $('cb-board'); if (!board) return;
    const r = board.getBoundingClientRect();
    board.querySelectorAll('.cb-slot').forEach((s) => s.classList.toggle('drop', x >= r.left && x <= r.right && y >= r.top && y <= r.bottom && UI.dragging && UI.dragging.from === 'ent'));
    if (UI.dragging && UI.dragging.from === 'clip') { const cv = $('cv').getBoundingClientRect(); if (x >= cv.left && x <= cv.right && y >= cv.top && y <= cv.bottom) { const pt = X.toLogic(x, y); const h = G.input.hit(pt.x, pt.y); G.game.hover = h ? h.id : null; } }
  };
  UI.drop = function (data, x, y) {
    const g = G.game;
    const cvr = $('cv').getBoundingClientRect();
    const clipR = clipEl.getBoundingClientRect();
    if (data.from === 'ent') {
      if (x >= clipR.left && x <= clipR.right && y >= clipR.top && y <= clipR.bottom) G.tags.cut(data.ent, data.inst, true);
      else if (x >= cvr.left && x <= cvr.right && y >= cvr.top && y <= cvr.bottom) {
        // 直接拖到另一个对象 = 剪下并贴上
        const pt = X.toLogic(x, y); const t = G.input.hit(pt.x, pt.y);
        if (t && t !== data.ent && G.tags.cut(data.ent, data.inst, true)) { const idx = G.clip.slots.indexOf(data.inst); if (idx >= 0) G.tags.paste(idx, t); }
      } else { const uiT = G.ui4.hitDom(x, y); if (uiT && uiT !== data.ent && G.tags.cut(data.ent, data.inst, true)) { const idx = G.clip.slots.indexOf(data.inst); if (idx >= 0) G.tags.paste(idx, uiT); } }
    } else if (data.from === 'clip') {
      const idx = G.clip.slots.indexOf(data.inst);
      if (x >= cvr.left && x <= cvr.right && y >= cvr.top && y <= cvr.bottom) {
        const pt = X.toLogic(x, y); const t = G.input.hit(pt.x, pt.y);
        if (t) G.tags.paste(idx, t); else UI.toast('那里什么也没有。', 'small');
      } else {
        const uiT = G.ui4.hitDom(x, y);
        if (uiT) G.tags.paste(idx, uiT);
        else { const ins = insEl.getBoundingClientRect(); const sel = g.sel && g.get(g.sel); if (sel && x >= ins.left && x <= ins.right && y >= ins.top && y <= ins.bottom) G.tags.paste(idx, sel); }
      }
      g.hover = null;
    }
  };

  // ---------- 贴纸飞行动画 ----------
  UI.flySticker = function (e, inst, dir) {
    try {
      const board = $('cb-board'); if (!board) return;
      const br = board.getBoundingClientRect();
      let ep;
      if (e.kind === 'ui' && e.dom) { const r = e.dom.getBoundingClientRect(); ep = { x: r.left + r.width / 2, y: r.top }; }
      else if (e.room === 'bombui') { const bc = $('bomb-cv'); if (!bc) return; const r = bc.getBoundingClientRect(); ep = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
      else { if (e.room !== G.game.room) return; ep = X.toClient(e.cx(), e.top()); }
      const cp = { x: br.left + br.width / 2, y: br.top + 10 };
      const el = UI.tagEl(inst); el.classList.add('fly'); $('fx-root').appendChild(el);
      const a = dir === 'toClip' ? ep : cp, b = dir === 'toClip' ? cp : ep;
      const t0 = performance.now(), dur = 380;
      const step = (now) => {
        const k = Math.min(1, (now - t0) / dur);
        const kk = Math.round(k * 8) / 8; // 像素风：分段
        const x = a.x + (b.x - a.x) * kk, y = a.y + (b.y - a.y) * kk - Math.sin(kk * Math.PI) * 40;
        el.style.transform = `translate(${x - 20}px, ${y - 10}px)`;
        if (k < 1) requestAnimationFrame(step); else el.remove();
      };
      requestAnimationFrame(step);
    } catch (err) { /* ignore */ }
  };

  // ---------- 模态窗 ----------
  UI.modal = function (title, body, opts = {}) {
    return new Promise((res) => {
      UI.modalOpen = true;
      const root = $('modal-root');
      const back = U.el('div', 'modal-back');
      const m = U.el('div', 'modal' + (opts.wide ? ' wide' : ''));
      const head = U.el('div', 'modal-head', `<span>${title}</span>`);
      const x = U.el('button', 'x', '×'); head.appendChild(x);
      m.appendChild(head);
      if (opts.tabs) m.appendChild(opts.tabs);
      const bd = U.el('div', 'modal-body'); if (typeof body === 'string') bd.innerHTML = body; else if (body) bd.appendChild(body);
      m.appendChild(bd);
      if (opts.foot) m.appendChild(opts.foot);
      back.appendChild(m); root.appendChild(back);
      let closed = false;
      const close = (v) => { if (closed) return; closed = true; back.remove(); UI._closers = (UI._closers || []).filter((c) => c !== close); UI.modalOpen = root.children.length > 0; UI._closeTop = UI._closers[UI._closers.length - 1] || null; G.audio.sfx('page'); res(v); };
      (UI._closers = UI._closers || []).push(close);
      x.onclick = () => close();
      back.addEventListener('click', (ev) => { if (ev.target === back && !opts.sticky) close(); });
      UI._closeTop = close;
      if (opts.onOpen) opts.onOpen(bd, close, m);
      G.audio.sfx('page');
    });
  };
  UI.closeAll = function () { for (const c of (UI._closers || []).slice()) c(); $('modal-root').innerHTML = ''; UI.modalOpen = false; UI._closeTop = null; };
  UI.closeTop = function () { if (UI.modalOpen && UI._closeTop) { UI._closeTop(); return true; } return false; };

  // 台本
  UI.openScript = function () {
    const g = G.game;
    const wrap = U.el('div');
    wrap.appendChild(U.el('div', 'margin-note', g.act === 1 ? '「夜見線・終電」台本（第' + g.loopNo + '稿）' : `「夜見線・終電」台本（第${g.loopNo}稿）　——页边有铅笔写的小字。`));
    for (const l of G.SCRIPT_LINES) {
      const past = g.t >= l.t + 2, now = g.t >= l.t && g.t < l.t + 15;
      const row = U.el('div', 'script-line' + (past ? ' past' : '') + (now ? ' now' : '') + (l.scan ? ' scan' : ''));
      if (l.scan && g.act < 2) continue;
      let extra = '';
      if (l.who === 'nana' && g.act >= 2) { row.classList.add('redline'); extra = '<span class="redpen">（乘客07：已醒。台本外。）</span>'; }
      if (l.key === 'cut' && G.story.flags.kuroSawMap && g.act >= 3) extra = '<span class="redpen">（黑川研究过路线图了。）</span>';
      if (l.key === 'cut' && g.act >= 2) extra += '<span class="pencil">（铅笔）台本只认标签，不认颜色。</span>';
      if (l.t === 30 && g.act === 1 && g.fails > 4096) extra += '<span class="pencil">（铅笔）红色留到最后？</span>';
      if (l.t === 150 && g.act >= 2) extra += '<span class="pencil">（铅笔）显示屏这段时间会插播「遅延」——可以剪下来。</span>';
      if (l.t === 15 && g.act >= 2) extra += '<span class="pencil">（铅笔）车掌大约 01:30–02:15、03:30 以后待在乘务员室；其余时间乘务员室是空的。</span>';
      row.innerHTML = `<span class="t">${U.fmt(l.t)}</span><span class="tx">${U.esc(l.tx)}${extra}</span>`;
      wrap.appendChild(row);
    }
    if (g.act >= 2) {
      wrap.appendChild(U.el('h3', '', '巡检规则（页边的铅笔字）'));
      wrap.appendChild(U.el('div', 'margin-note', '· 每 60 秒一次，预告旋律响起后 10 秒开始。<br>· 扫描线从左扫到右，<b>只扫一遍</b>。与台本不符的东西会被盖「差戻」章、恢复原样；剪走的词条会被<b>从剪贴板里没收</b>。<br>· 发现异常＝警戒 +1；满 3 次，本轮强制重来。<br>· 带【回送】的跳过；【乘务员】受信任；【异常】必查。<br>· 带着外来【最高仇恨】的东西会把扫描线“吸”过去——处理完它，巡检就提前收工。<br>· 时间重置后，剪贴板里的东西都还在。'));
      wrap.appendChild(U.el('h3', '', '词条规则'));
      wrap.appendChild(U.el('div', 'margin-note', '· 带锁的词条剪不下来；带【锁定】的对象上的词条都剪不下（但仍能贴上新词条）。<br>· 同一个对象身上的词条会叠加生效；特定的组合会产生“化学反应”。<br>· 被打碎/删除的东西，词条会掉在地上，可以捡起来。<br>· 词条太多（7 个）会过载，全部散落。<br>· 剪贴板里的词条可以“退回原处”。'));
    }
    return UI.modal('台本', wrap, { wide: true });
  };

  // 对象列表（手机上点不中小东西时用）
  UI.openObjects = function () {
    const g = G.game;
    const wrap = U.el('div', 'objlist');
    const list = g.inRoom(g.room).filter((e) => e.kind !== 'wire');
    if (G.ui4.on) list.push(...G.ui4.ents());
    for (const e of list) {
      const b = U.el('button', 'obj-row', `<span>${U.esc(e.name)}</span><span class="tc">${g.act >= 2 ? e.tags.map((i) => G.tagName(i.t)).join('·') : ''}</span>`);
      b.onclick = () => { UI.closeTop(); UI.select(e); };
      wrap.appendChild(b);
    }
    if (!list.length) wrap.appendChild(U.el('div', 'ins-empty', '这里什么都没有。'));
    return UI.modal(`对象一览 · ${G.ROOMS[g.room] ? G.ROOMS[g.room].name : ''}`, wrap);
  };

  // 图鉴
  UI.openDex = function () {
    const tabs = U.el('div', 'tabs');
    const body = U.el('div');
    const show = (k) => {
      tabs.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.k === k));
      body.innerHTML = '';
      if (k === 'react') {
        const n = Object.keys(G.meta.dex).length;
        body.appendChild(U.el('p', '', `已发现的化学反应：<span class="dex-count">${n} / ${G.REACTIONS.length}</span>　（未登记的组合同样有效：它们按“系统规则”叠加生效）`));
        const grid = U.el('div', 'dex-grid');
        for (const r of G.REACTIONS) {
          const known = G.meta.dex[r.id];
          const it = U.el('div', 'dex-item' + (known ? '' : ' locked'));
          it.innerHTML = known ? `<b>「${U.esc(r.name)}」</b><div class="tg">${r.t.map((t) => G.tagLabel(t)).join('＋')}</div><div>${U.esc(r.desc)}</div>` : `<b>？？？</b><div class="tg">${r.t.map((t) => (G.meta.tagsSeen[t] ? G.tagLabel(t) : '【？】')).join('＋')}</div>`;
          grid.appendChild(it);
        }
        body.appendChild(grid);
      } else if (k === 'tags') {
        for (const c in G.CATS) {
          const tags = Object.values(G.TAGS).filter((t) => t.cat === c);
          if (!tags.length) continue;
          body.appendChild(U.el('div', 'lib-cat', `${G.CATS[c].g}　${G.CATS[c].name}`));
          const row = U.el('div', 'lib-tags');
          for (const t of tags) {
            const seen = G.meta.tagsSeen[t.id] || G.game.sandbox;
            const el = UI.tagEl({ t: t.id });
            if (!seen) { el.innerHTML = `<span class="cat">${G.CATS[c].g}</span>？？`; }
            el.title = seen ? `${t.desc}\n来源：${t.src}` : '尚未发现';
            if (seen) el.onclick = () => UI.toast(`<b>${G.tagLabel(t.id)}</b> ${U.esc(t.desc)}<span class="rd">来源：${U.esc(t.src)}</span>`, 'react');
            if (G.game.sandbox && seen) el.ondblclick = () => { if (G.clip.slots.length < G.clip.cap) { G.clip.slots.push(G.mkInst(t.id, null)); UI.refresh(); } };
            row.appendChild(el);
          }
          body.appendChild(row);
        }
        if (G.game.sandbox) body.appendChild(U.el('p', '', '自由实验：<b>双击</b>词条把它放进剪贴板。'));
      } else {
        for (const node in G.SOLUTIONS) {
          const s = G.SOLUTIONS[node];
          body.appendChild(U.el('h3', '', s.name));
          const ul = U.el('ul', 'sol-list');
          for (const it of s.list) { const used = G.meta.solutions[node] && G.meta.solutions[node][it.id]; ul.appendChild(U.el('li', used ? 'used' : 'unk', used ? `√ [${it.school}] ${U.esc(it.text)}` : `□ [${it.school}] ？？？`)); }
          body.appendChild(ul);
        }
      }
    };
    [['react', '化学反应'], ['tags', '词条库'], ['sol', '一题多解']].forEach(([k, n]) => { const t = U.el('button', 'tab', n); t.dataset.k = k; t.onclick = () => show(k); tabs.appendChild(t); });
    show('react');
    return UI.modal('图鉴', body, { wide: true, tabs });
  };

  // 菜单
  UI.openMenu = function () {
    const g = G.game;
    const wrap = U.el('div');
    const mk = (label, fn, cls = '') => { const b = U.el('button', 'tmenu-btn ' + cls, label); b.style.width = '100%'; b.style.margin = 'calc(var(--p)*3) 0'; b.onclick = () => { UI.closeTop(); fn(); }; wrap.appendChild(b); };
    mk('继续', () => {});
    mk('保存进度', () => UI.openSaves('save'));
    mk('读取存档', () => UI.openSaves('load'));
    if (g.act >= 1 && !g.voidMode && !g.cinematic && g.room !== 'dawn') mk('重来本轮（回到 00:00）', () => g.resetLoop('manual'));
    mk('玩法说明', () => UI.openHelp());
    mk('设置', () => UI.openSettings());
    mk('策划书（新窗口）', () => window.open('design.html', '_blank'));
    mk(g.sandbox ? '回到标题' : '保存并回到标题', () => { G.story.save(); location.reload(); });
    return UI.modal('菜单', wrap);
  };
  UI.openHelp = function () {
    const w = U.el('div');
    w.innerHTML = `<h3>基本</h3><p>点地面＝走过去；点人或物＝选中（下方检视器显示它的说明与<b>词条</b>）；再点一次＝走过去。小东西点不中时，用「对象」列表。</p>
<h3>剪与贴</h3><p>· 选中对象后，点它的词条＝<b>剪下</b>，放进剪贴板。<br>· 选中另一个对象后，点剪贴板里的词条＝<b>贴上</b>。<br>· 或者：先点剪贴板里的词条“拿起来”，再点场景里的目标。<br>· 也可以直接把词条拖来拖去。<br>· 剪贴板里的词条可以“退回原处”。时间重置后，剪贴板里的东西都还在。</p>
<h3>化学反应</h3><p>同一个对象身上的词条会叠加生效；特定组合会产生“化学反应”，记录在「图鉴」里。带锁的词条剪不下来。</p>
<h3>巡检</h3><p>每 60 秒，白线会扫过车厢，把一切改回“台本的样子”。预告旋律响起后有 10 秒：把东西复原，或者伪装起来。被查出异常＝警戒 +1，满 3 次本轮重来。规则详见「台本」的最后几页。</p>
<h3>小技巧</h3><p>· 选中东西时时间会放慢一半；右上角可以暂停、快进。<br>· 「透视」显示所有东西身上的词条。<br>· 卡住了就点「提示」，连点会越说越直白。</p>`;
    return UI.modal('玩法说明', w);
  };
  UI.openSettings = function () {
    const s = G.settings;
    const wrap = U.el('div');
    const row = (label, get, set, fmt) => {
      const r = U.el('div', 'set-row', `<span>${label}</span>`);
      const b = U.el('button', 'toggle', fmt(get())); b.classList.toggle('on', !!get());
      b.onclick = () => { set(); b.textContent = fmt(get()); b.classList.toggle('on', !!get()); G.saveSettings(); G.audio.applyVolume(); G.audio.sfx('select'); };
      r.appendChild(b); wrap.appendChild(r);
    };
    const cyc = (k, arr) => () => { const i = arr.indexOf(s[k]); s[k] = arr[(i + 1) % arr.length]; };
    row('音效音量', () => s.sfx, cyc('sfx', [0, 0.4, 0.8, 1]), (v) => ['关', '小', '中', '大'][[0, 0.4, 0.8, 1].indexOf(v)] || '中');
    row('音乐音量', () => s.bgm, cyc('bgm', [0, 0.3, 0.5, 0.8]), (v) => ['关', '小', '中', '大'][[0, 0.3, 0.5, 0.8].indexOf(v)] || '中');
    row('日语车内广播（系统语音）' + (G.audio.hasVoice() ? '' : '（本设备无日语语音）'), () => s.voice, () => { s.voice = !s.voice; }, (v) => (v ? '开' : '关'));
    row('文字速度', () => s.textSpeed + 1, () => { s.textSpeed = (s.textSpeed + 1) % 4; }, () => ['慢', '中', '快', '瞬间'][s.textSpeed]);
    row('选中物体时慢动作', () => s.slowmo, () => { s.slowmo = !s.slowmo; }, (v) => (v ? '开' : '关'));
    row('画面震动', () => s.shake, () => { s.shake = !s.shake; }, (v) => (v ? '开' : '关'));
    row('卡关时提示按钮闪烁', () => s.autoHint, () => { s.autoHint = !s.autoHint; }, (v) => (v ? '开' : '关'));
    wrap.appendChild(U.el('p', '', '键盘：←→/A D 移动 · 空格 暂停 · F 快进 · Tab 切换对象 · Ctrl+X 剪下 · Ctrl+V 粘贴 · 1–7 选剪贴板 · E 调查 · T 台本 · H 提示 · Q 切换角色 · Esc 关闭'));
    return UI.modal('设置', wrap);
  };

  // 路线图特写
  UI.showRoutemap = function () {
    const wrap = U.el('div');
    const cv = document.createElement('canvas'); cv.width = 160; cv.height = 110; cv.style.width = '100%'; cv.style.imageRendering = 'pixelated';
    const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
    c.fillStyle = '#f4f1e8'; c.fillRect(0, 0, 160, 110);
    const P = (x, y, col, n = 1) => { c.fillStyle = col; c.fillRect(x, y, n, n); };
    for (let a = 0; a < 360; a += 1) { const r = a * Math.PI / 180; P(Math.round(80 + Math.cos(r) * 40), Math.round(55 + Math.sin(r) * 34), '#7a8a6a', 2); }
    const st = [['白紙', 80, 21, '#c9c3b2'], ['仮置', 120, 55, '#e2b84a'], ['検収', 80, 89, '#5c86b3'], ['出口', 40, 55, '#c0432c']];
    for (const [n, x, y, col] of st) { c.fillStyle = '#2b2620'; c.fillRect(x - 5, y - 5, 10, 10); c.fillStyle = col; c.fillRect(x - 4, y - 4, 8, 8); }
    const tx = (s, x, y, col) => { const im = X.textImg(s, col); c.drawImage(im, Math.round(x - im.width / 2), y); };
    tx('白紙', 80, 2, '#2b2620'); tx('仮置', 140, 48, '#2b2620'); tx('検収', 80, 96, '#2b2620'); tx('出口', 20, 48, '#2b2620');
    tx('外回り→', 118, 20, '#26324a'); tx('←内回り', 42, 86, '#8c7b63');
    wrap.appendChild(cv);
    wrap.appendChild(U.el('p', '', '夜见线（环状线）。四座车站各有一种颜色：<b style="color:#8a7a50">白紙</b>（白）、<b style="color:#a7852a">仮置</b>（黄）、<b style="color:#3f6893">検収</b>（蓝）、<b style="color:#b5432e">出口</b>（红）。<br>这班车刚离开「白紙」，显示屏上写着：「次は 仮置」。'));
    return UI.modal('路线图', wrap);
  };

  // 监视器
  UI.showMonitor = function () {
    const g = G.game;
    const wrap = U.el('div');
    const cv = document.createElement('canvas'); cv.width = 384; cv.height = 256; cv.style.width = '100%'; cv.style.imageRendering = 'pixelated';
    const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
    if (X.img.bg_crew) c.drawImage(X.img.bg_crew, 0, 0);
    c.fillStyle = 'rgba(10,20,14,0.88)'; c.fillRect(150, 110, 230, 140);
    G.MONITOR_TEXT.forEach((l, i) => { const s = l.replace('{draft}', g.loopNo).replace('{fails}', g.fails); const im = X.textImg(s, i === 3 || i === 9 ? '#e8826b' : '#8fd48a'); c.drawImage(im, 156, 113 + i * 13); });
    wrap.appendChild(cv);
    return UI.modal('运行监视器', wrap, { wide: true });
  };

  // ---------- 炸弹特写 ----------
  UI.openBomb = function () {
    const g = G.game;
    const wrap = U.el('div');
    const cv = document.createElement('canvas'); cv.id = 'bomb-cv'; cv.width = 192; cv.height = 112; cv.style.width = '100%'; cv.style.imageRendering = 'pixelated'; cv.style.touchAction = 'none'; cv.style.cursor = 'pointer';
    wrap.appendChild(cv);
    const info = U.el('div', ''); wrap.appendChild(info);
    const wires = ['wire_y', 'wire_b', 'wire_r'].map((id) => g.get(id));
    const layout = { wire_r: 46, wire_b: 96, wire_y: 146 };
    let selW = null;
    const draw = () => {
      const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
      c.fillStyle = '#5a4430'; c.fillRect(0, 0, 192, 112);
      c.fillStyle = '#7a5c3c'; for (let y = 0; y < 112; y += 6) c.fillRect(0, y, 192, 1);
      // 盒子
      c.fillStyle = '#2b2620'; c.fillRect(20, 8, 152, 34); c.fillStyle = '#8a8a90'; c.fillRect(22, 10, 148, 30);
      c.fillStyle = '#14161c'; c.fillRect(70, 14, 52, 22);
      const secs = g.bombDone === 'defused' ? 0 : g.bombSecs();
      const im = X.textImg(g.bombDone === 'defused' ? '--:--' : U.fmt(secs), '#ff5a3a'); c.drawImage(im, 96 - im.width / 2, 18);
      // 字条
      c.fillStyle = '#f4f1e8'; c.fillRect(126, 14, 40, 22); const n1 = X.textImg('順番は', '#2b2620'); c.drawImage(n1, 128, 13); const n2 = X.textImg('駅の色', '#c0432c'); c.drawImage(n2, 128, 24);
      // 圆筒
      c.fillStyle = '#2b2620'; c.fillRect(30, 84, 132, 22); c.fillStyle = '#d8cfb8'; c.fillRect(32, 86, 128, 18);
      for (const w of wires) {
        if (!w) continue;
        const x = layout[w.id]; const col = { red: '#c0432c', blue: '#4f7fb5', yellow: '#e2b84a' }[w.phys];
        c.fillStyle = '#14161c'; c.fillRect(x - 1, 40, 6, 46);
        c.fillStyle = col;
        if (w.st.cut) { c.fillRect(x, 42, 4, 16); c.fillRect(x, 70, 4, 14); c.fillStyle = '#f4f1e8'; c.fillRect(x, 58, 4, 1); c.fillRect(x, 69, 4, 1); }
        else c.fillRect(x, 42, 4, 42);
        // 标签
        const lb = G.bomb.labelOf(w);
        c.fillStyle = lb ? '#f6f2e6' : '#8a8a90'; c.fillRect(x - 9, 60, 22, 13); c.fillStyle = '#2b2620'; c.strokeStyle = '#2b2620'; c.fillRect(x - 9, 60, 22, 1); c.fillRect(x - 9, 72, 22, 1); c.fillRect(x - 9, 60, 1, 13); c.fillRect(x + 12, 60, 1, 13);
        if (lb) { const t = X.textImg(G.tagName(lb), '#8f2f22'); c.drawImage(t, x + 2 - t.width / 2, 60); }
        if (selW === w) { c.fillStyle = '#f0a83a'; c.fillRect(x - 11, 38, 26, 1); c.fillRect(x - 11, 86, 26, 1); c.fillRect(x - 11, 38, 1, 48); c.fillRect(x + 14, 38, 1, 48); }
      }
    };
    const refreshInfo = () => {
      info.innerHTML = '';
      info.appendChild(U.el('p', '', '字条（日语）：「切る順番は、この列車がこれから通る駅の色。」——<b>剪断顺序＝这班列车接下来要经过的车站的颜色。</b>'));
      if (g.act >= 2 && !G.story.flags.kuroFree) info.appendChild(U.el('p', '', '<span style="color:var(--red2)">注意：</span>不是“侦探”亲手拆的，系统就会把拆弹的人当作越权者删除。'));
      if (selW) {
        const row = U.el('div', 'ins-acts');
        if (!selW.st.cut) { const b = U.el('button', 'act-btn red', '剪断这根线'); b.onclick = () => { UI.cutWireByPlayer(selW); }; row.appendChild(b); }
        info.appendChild(U.el('div', 'sect-title', '<span>选中的导线 — 它的词条见右侧检视器</span>'));
        info.appendChild(row);
      } else info.appendChild(U.el('p', '', '点一根导线选中它。'));
    };
    cv.addEventListener('pointerdown', (ev) => {
      const r = cv.getBoundingClientRect(); const x = ((ev.clientX - r.left) / r.width) * 192, y = ((ev.clientY - r.top) / r.height) * 112;
      let best = null, bd = 18;
      for (const w of wires) { const d = Math.abs(layout[w.id] + 2 - x); if (d < bd && y > 30 && y < 95) { bd = d; best = w; } }
      if (best) {
        if (UI.dragging) return;
        const cs = G.clip.sel;
        if (cs >= 0 && G.clip.slots[cs]) { G.tags.paste(cs, best); }
        selW = best; G.game.sel = best.id; G.audio.sfx('select'); UI.refresh(); refreshInfo(); draw();
      }
    });
    UI.bombRefresh = () => { draw(); refreshInfo(); };
    const iv = setInterval(draw, 250);
    draw(); refreshInfo();
    G.bus.emit('bombOpened');
    return UI.modal('纸袋里', wrap, { wide: true, onOpen: (bd, close) => { UI.closeBomb = () => { clearInterval(iv); close(); }; } }).then(() => { clearInterval(iv); UI.bombRefresh = null; UI.closeBomb = null; if (G.game.sel && G.game.get(G.game.sel) && G.game.get(G.game.sel).kind === 'wire') G.game.sel = null; UI.refresh(); });
  };
  UI.cutWireByPlayer = function (w) {
    const g = G.game;
    const p = g.player();
    G.bomb.cutWire(w, p);
  };

  // ---------- 结局 ----------
  UI.showEnding = function (title) {
    const g = G.game;
    const wrap = U.el('div');
    const n = Object.keys(G.meta.dex).length;
    wrap.appendChild(U.el('div', 'margin-note', '「白線の内側まで、お下がりください。」<br>——我们听了几千遍。今天，我们往外走。'));
    const st = U.el('div', 'end-stats');
    st.innerHTML = `<span class="k">稿数</span><span>第 ${g.loopNo} 稿</span><span class="k">发现的化学反应</span><span>${n} / ${G.REACTIONS.length}</span><span class="k">发现的词条</span><span>${Object.keys(G.meta.tagsSeen).length} / ${Object.keys(G.TAGS).length}</span>`;
    wrap.appendChild(st);
    wrap.appendChild(U.el('h3', '', '你的解法 · 其它解法'));
    for (const node in G.SOLUTIONS) {
      const s = G.SOLUTIONS[node]; const used = G.story.used[node];
      const found = Object.keys(G.meta.solutions[node] || {}).length;
      const it = used ? s.list.find((x) => x.id === used) : null;
      wrap.appendChild(U.el('p', '', `<b>${s.name}</b>：${it ? `${it.school} — ${U.esc(it.text)}` : '（未记录）'}<br><span style="color:var(--ink3)">已发现 ${found} / ${s.list.length} 种解法</span>`));
    }
    wrap.appendChild(U.el('p', '', '标题画面的「自由实验」已解锁：所有词条随意剪贴，没有巡检。'));
    const foot = U.el('div', 'modal-foot');
    const b1 = U.el('button', 'act-btn', '回到标题'); b1.onclick = () => location.reload();
    const b2 = U.el('button', 'act-btn ghost', '查看图鉴'); b2.onclick = () => UI.openDex();
    foot.appendChild(b2); foot.appendChild(b1);
    return UI.modal(title, wrap, { wide: true, foot, sticky: true });
  };

  // ---------- 第一幕：剪贴板里的“粘贴”按钮 ----------
  UI.showPasteBack = function () {
    const row = U.el('div', 'ins-acts');
    const b = U.el('button', 'act-btn red', 'Ctrl + V　粘贴回车厢');
    b.style.width = '100%'; b.style.padding = 'calc(var(--p)*4)';
    b.onclick = () => { b.disabled = true; G.story.pasteBack(); };
    clipEl.appendChild(row); row.appendChild(b);
    UI._pasteBtn = b;
    const reattach = () => { if (G.game.voidMode && !clipEl.contains(b)) { clipEl.appendChild(row); } };
    UI._pasteReattach = reattach;
  };
  const _renderClip = UI.renderClip;
  UI.renderClip = function () { _renderClip(); if (UI._pasteReattach && G.game.voidMode) { const row = U.el('div', 'ins-acts'); row.appendChild(UI._pasteBtn); clipEl.appendChild(row); } };

  // =========================================================
  //   第四幕：界面元素词条化
  // =========================================================
  const U4 = (G.ui4 = { on: false, map: {} });
  const UI_DEFS = [
    { id: 'ui_timer', el: () => document.querySelector('.hud-clock'), name: 'HUD · 时刻', tags: ['countdown', 'timer'], desc: '界面顶部的计时器，正在倒数“破棄”的时刻。' },
    { id: 'ui_pause', el: () => $('btn-pause'), name: '暂停按钮', tags: ['pause'], desc: '按下就停。' },
    { id: 'ui_alert', el: () => $('hud-alert-cell'), name: 'HUD · 警戒', tags: ['anomaly'], desc: '警戒度的格子。上面印着「異常」。' },
    { id: 'ui_title', el: () => $('objective'), name: '目标栏', tags: ['title'], desc: '这个故事的“标题”就写在这里。' },
    { id: 'ui_border', el: () => $('stage'), name: '画面边界', tags: [{ t: 'border', lock: true }, 'lock'], desc: '把整个世界框住的那个外框。' },
    { id: 'ui_close', el: () => document.querySelector('[data-ui="ui_close"]'), name: '关闭按钮「×」', tags: ['close'], desc: '检视器右上角的「×」。', dynamic: true },
  ];
  U4.enable = function (on) {
    U4.on = on;
    const g = G.game;
    if (on) {
      for (const d of UI_DEFS) {
        if (g.get(d.id)) continue;
        const e = new G.Ent({ id: d.id, kind: 'ui', room: 'ui', x: 0, y: 0, w: 1, h: 1, name: d.name, tags: d.tags, desc: d.desc });
        g.add(e); G.tags.changed(e);
      }
    }
    U4.refresh();
  };
  U4.ents = () => G.game.ents.filter((e) => e.kind === 'ui' && e.alive);
  U4.attach = function (el, id) { if (!U4.on || !el) return; const e = G.game.get(id); if (!e) return; e.dom = el; el.classList.add('ui-tagged'); el.dataset.uient = id; };
  U4.refresh = function () {
    document.querySelectorAll('.ui-tagged').forEach((el) => { el.classList.remove('ui-tagged', 'ui-sel'); const ch = el.querySelector('.ui-chip'); if (ch) ch.remove(); delete el.dataset.uient; });
    if (!U4.on) return;
    for (const d of UI_DEFS) {
      const e = G.game.get(d.id); const el = d.el(); if (!e || !el || !e.alive) continue;
      e.dom = el; el.classList.add('ui-tagged'); el.dataset.uient = d.id;
      if (G.game.sel === d.id) el.classList.add('ui-sel');
      const chip = U.el('span', 'ui-chip', e.tags.map((i) => G.tagName(i.t)).join('·') || '空'); el.appendChild(chip);
    }
  };
  U4.hitDom = function (x, y) {
    if (!U4.on) return null;
    const els = document.elementsFromPoint(x, y);
    for (const el of els) { const t = el.closest && el.closest('[data-uient]'); if (t) return G.game.get(t.dataset.uient); }
    return null;
  };
  // 捕获界面元素上的点击（第四幕）
  document.addEventListener('pointerdown', (ev) => {
    if (!U4.on) return;
    const t = ev.target.closest && ev.target.closest('[data-uient]');
    if (!t) return;
    if (t.id === 'stage' && ev.target.id === 'cv') return; // 画面内部照常
    ev.stopPropagation(); ev.preventDefault();
    const e = G.game.get(t.dataset.uient);
    const cs = G.clip.sel;
    if (cs >= 0 && G.clip.slots[cs]) G.tags.paste(cs, e); else UI.select(e);
    U4.refresh();
  }, true);
  U4.onTag = function (e, t, added) {
    const g = G.game;
    if (!added) G.bus.emit('uiCut', e, t);
    if (e.id === 'ui_pause' && t === 'pause' && !added) UI.toast('暂停按钮失去了【暂停】——它再也按不下去了。', 'small');
    if (e.id === 'ui_timer' && t === 'countdown' && added && g.collapse) { g.collapse.on = true; UI.toast('倒计时又开始了！', 'small'); }
    setTimeout(U4.refresh, 0);
  };
  U4.breakFrame = async function () {
    const stage = $('stage');
    stage.classList.add('borderless');
    UI.toast('画面的边界被剪掉了。');
    const parts = [...document.querySelectorAll('#hud .hud-cell, #hud .ibtn, #panel > *')];
    parts.forEach((el, i) => { el.classList.add('falling'); el.style.transform = `translateY(${120 + (i % 3) * 40}vh) rotate(${(i % 5) - 2}deg)`; el.style.opacity = '0'; });
    await G.cs.wait(1.4);
    parts.forEach((el) => { el.classList.remove('falling'); el.style.transform = ''; el.style.opacity = ''; });
  };

  // =========================================================
  //   标题画面
  // =========================================================
  UI.drawTitle = function () {
    const tc = $('title-cv'); if (!tc || !X.img.bg_title) return;
    const c = tc.getContext('2d'); c.imageSmoothingEnabled = false;
    const k = tc.width / 384;
    c.setTransform(k, 0, 0, k, 0, 0);
    c.drawImage(X.img.bg_title, 0, 0);
    // 站名牌：标题
    const sx = 300, sy = 28, sw = 48, sh = 162;
    c.fillStyle = '#f4f1e8'; c.fillRect(sx, sy, sw, sh);
    c.fillStyle = '#26324a'; c.fillRect(sx, sy + sh - 18, sw, 18);
    c.fillStyle = '#c0432c'; c.fillRect(sx, sy, sw, 3);
    const title = '白线以内';
    [...title].forEach((ch, i) => { const im = X.textImg(ch, '#2b2620', 24); c.drawImage(im, sx + sw / 2 - im.width / 2, sy + 12 + i * 28); });
    const sub = X.textImg('04号车厢', '#f4f1e8'); c.save(); c.translate(sx + sw / 2, sy + sh - 9); c.drawImage(sub, -sub.width / 2, -6); c.restore();
    const jp = X.textImg('はくせんいない', '#8c7b63'); c.save(); c.translate(sx - 3, sy + 40); c.rotate(Math.PI / 2); c.drawImage(jp, 0, 0); c.restore();
    c.setTransform(1, 0, 0, 1, 0, 0);
  };
  UI.positionTitle = function () {
    const m = $('title-menu'); if (!m) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    const tc = $('title-cv'); if (tc) { const r = tc.getBoundingClientRect(); const signR = r.left + (348 / 384) * r.width, signL = r.left + (300 / 384) * r.width; $('title-sign').classList.toggle('hidden', signR <= vw && signL >= 0); }
    if (vw > vh) { m.style.left = Math.round(vw * 0.04) + 'px'; m.style.top = 'auto'; m.style.bottom = Math.round(vh * 0.08) + 'px'; m.style.right = 'auto'; m.style.transform = ''; }
    else { m.style.left = '50%'; m.style.transform = 'translateX(-50%)'; m.style.bottom = Math.round(vh * 0.1) + 'px'; m.style.top = 'auto'; }
  };
  UI.showTitle = function () {
    $('title').classList.remove('hidden'); $('game').classList.add('hidden');
    UI.drawTitle(); UI.positionTitle();
    const m = $('title-menu'); m.innerHTML = '';
    const save = G.story.load();
    const btn = (label, fn, sub, dis) => { const b = U.el('button', 'tmenu-btn', `${label}${sub ? `<small>${sub}</small>` : ''}`); if (dis) b.disabled = true; b.onclick = () => { G.audio.init(); G.audio.sfx('select'); fn(); }; m.appendChild(b); };
    if (save) btn('继续', () => G.main.continueGame(save), `第${['', '一', '二', '三', '四'][save.act] || ''}幕`);
    btn(save ? '从头开始' : '开始', () => G.main.newGame());
    btn('存档', () => UI.openSaves('load'), G.cloud.name ? U.esc(G.cloud.name) : '读档 · 账号');
    btn('自由实验', () => G.main.sandbox(), G.meta.sandbox ? '' : '通关后解锁', !G.meta.sandbox && !G.DEBUG);
    btn('章节选择', () => UI.chapterSelect(), G.meta.cleared ? '' : '通关后解锁', !G.meta.cleared && !G.DEBUG);
    btn('设置', () => UI.openSettings());
    btn('策划书', () => window.open('design.html', '_blank'));
    btn('返回主页', () => { location.href = '../index.html'; }, 'GAME.INC.RE');
  };
  UI.chapterSelect = function () {
    const wrap = U.el('div');
    [[1, '第一幕 剧本的囚徒'], [2, '第二幕 戴着镣铐的篡改者'], [3, '第三幕 唤醒同类与化学反应'], [4, '第四幕 死锁宇宙与跨越维度']].forEach(([a, n]) => {
      const b = U.el('button', 'tmenu-btn', n); b.style.width = '100%'; b.style.margin = 'calc(var(--p)*3) 0';
      b.onclick = () => { UI.closeTop(); G.main.chapter(a); };
      wrap.appendChild(b);
    });
    return UI.modal('章节选择', wrap);
  };

  // ---------- 存档：自动存档 + 手动存档位；顶部是账号状态 ----------
  const ACTS = ['', '第一幕 剧本的囚徒', '第二幕 戴着镣铐的篡改者', '第三幕 唤醒同类与化学反应', '第四幕 死锁宇宙与跨越维度'];
  const stamp = (t) => { const d = new Date(+t || 0), p = (n) => String(n).padStart(2, '0'); return p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); };
  const objText = (id) => { const t = String((G.OBJ[id] && G.OBJ[id].text) || '').replace(/<[^>]*>/g, '').replace(/\[\[|\]\]/g, ''); return t.length > 30 ? t.slice(0, 30) + '…' : t; };
  UI.openSaves = function (mode = 'load') {
    const inGame = !$('game').classList.contains('hidden'), canSave = inGame && G.story.canSave();
    if (mode === 'save' && !canSave) mode = 'load';
    const wrap = U.el('div', 'saves'), acct = U.el('div', 'save-acct'), tabs = U.el('div', 'save-tabs'), list = U.el('div', 'save-list');
    wrap.append(acct, tabs, list, U.el('p', 'save-note', '存档记下所在的幕、剪贴板、已完成的目标与发现；读档后从那一幕的开场继续，完成过的部分不用重做。'));
    const renderAcct = () => {
      const st = G.cloud.status(); acct.innerHTML = '';
      acct.appendChild(U.el('span', 'save-acct-text' + (['error', 'rejected', 'expired'].includes(st.state) ? ' warn' : ''), U.esc(st.text)));
      if (G.cloud.file) return;
      const btns = U.el('span', 'save-acct-btns');
      const b = (label, fn) => { const x = U.el('button', 'mini-btn', label); x.onclick = () => { G.audio.sfx('select'); fn(); }; btns.appendChild(x); };
      if (!st.logged) b(st.state === 'expired' ? '重新登录' : '登录 / 注册', () => UI.openLogin());
      else {
        b('立即同步', () => G.cloud.syncNow());
        b('退出登录', async () => {
          try { const r = await G.cloud.logout(); UI.toast(r.kept.includes('whiteline') ? '已退出，没同步的存档留在这台设备上。' : '已退出，回到本机存档。', 'small'); }
          catch (e) { UI.toast(U.esc(G.cloud.errorText(e)), 'small'); }
        });
      }
      acct.appendChild(btns);
    };
    const renderTabs = () => {
      tabs.innerHTML = '';
      if (!inGame) return;
      [['load', '读取存档'], ['save', '保存进度']].forEach(([m, label]) => {
        const t = U.el('button', 'toggle' + (mode === m ? ' on' : ''), label);
        if (m === 'save' && !canSave) { t.disabled = true; t.textContent = '这里不能存档'; }
        t.onclick = () => { mode = m; G.audio.sfx('select'); renderTabs(); renderList(); };
        tabs.appendChild(t);
      });
    };
    const confirmLoad = (name, data) => {
      G.audio.sfx('select');
      if (!inGame) { UI.closeTop(); G.main.loadSave(data); return; }
      const box = U.el('div');
      box.appendChild(U.el('p', '', '读取「' + U.esc(name) + '」？当前还没保存的进度会丢失。'));
      const row = U.el('div', 'save-confirm'), yes = U.el('button', 'mini-btn', '读取'), no = U.el('button', 'toggle', '取消');
      row.append(no, yes); box.appendChild(row);
      UI.modal('读取存档', box, { onOpen: (bd, close) => { yes.onclick = () => { close(); G.main.loadSave(data); }; no.onclick = () => close(); } });
    };
    const renderList = () => {
      list.innerHTML = '';
      const rows = [['自动存档', G.story.load(), -1], ...G.story.slots().map((data, i) => ['存档 ' + (i + 1), data, i])];
      for (const [name, data, i] of rows) {
        const row = U.el('div', 'save-slot' + (data ? '' : ' empty')), info = U.el('div', 'save-info');
        info.appendChild(U.el('b', '', U.esc(name)));
        if (data) {
          info.appendChild(U.el('span', 'save-line', U.esc(ACTS[data.act] || ('第' + data.act + '幕'))));
          const o = objText(data.obj);
          if (o) info.appendChild(U.el('span', 'save-line dim', '目标：' + U.esc(o)));
          info.appendChild(U.el('span', 'save-line dim', stamp(data.time) + ' · 第' + (+data.loopNo || 0) + '稿 · 剪贴板 ' + (data.clip || []).length + ' 个词条'));
        } else info.appendChild(U.el('span', 'save-line dim', i < 0 ? '剧情推进时自动记录。' : '空'));
        row.appendChild(info);
        const action = (label, fn) => { const x = U.el('button', 'mini-btn', label); x.onclick = () => fn(x); row.appendChild(x); };
        if (mode === 'load' && data) action('读取', () => confirmLoad(name, data));
        if (mode === 'save' && i >= 0) action(data ? '覆盖' : '保存', (x) => {
          if (data && !x.classList.contains('glow')) { x.classList.add('glow'); x.textContent = '确认覆盖'; G.audio.sfx('select'); return; }
          if (G.story.saveSlot(i)) { G.audio.sfx('select'); UI.toast('已保存到「' + name + '」。', 'small'); renderList(); }
        });
        list.appendChild(row);
      }
    };
    renderAcct(); renderTabs(); renderList();
    const off = G.cloud.onChange(() => { renderAcct(); renderList(); });
    return UI.modal('存档', wrap, { wide: true }).then((v) => { off(); if (!$('title').classList.contains('hidden')) UI.showTitle(); return v; });
  };
  // 登录 / 注册（GAME.INC.RE 通用账号）
  UI.openLogin = function () {
    const form = U.el('form', 'login-form'); form.noValidate = true;
    form.innerHTML = '<div class="save-tabs"><button type="button" class="toggle on" data-m="0">登录</button><button type="button" class="toggle" data-m="1">注册</button></div>'
      + '<label class="fld">用户名<input name="username" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="16" placeholder="3–16 位字母、数字或下划线"></label>'
      + '<label class="fld">密码<input name="password" type="password" maxlength="64" autocomplete="current-password" placeholder="8–64 位"></label>'
      + '<label class="fld" hidden>确认密码<input name="confirm" type="password" maxlength="64" autocomplete="new-password" placeholder="再输入一次密码"></label>'
      + '<p class="login-msg" role="status"></p>'
      + '<div class="save-confirm"><button type="submit" class="mini-btn">登录</button></div>'
      + '<p class="save-note">GAME.INC.RE 账号在本站所有游戏通用。登录后，这里的存档会在你的所有设备间同步。</p>';
    const msg = form.querySelector('.login-msg'), submit = form.querySelector('[type=submit]'), confirm = form.elements.confirm;
    let mode = 0, busy = false;
    const setMode = (m) => {
      mode = m; msg.textContent = '';
      form.querySelectorAll('.save-tabs .toggle').forEach((t) => t.classList.toggle('on', +t.dataset.m === m));
      confirm.parentElement.hidden = !m; submit.textContent = m ? '注册并登录' : '登录';
      form.elements.password.autocomplete = m ? 'new-password' : 'current-password';
    };
    form.querySelectorAll('.save-tabs .toggle').forEach((t) => { t.onclick = () => { G.audio.sfx('select'); setMode(+t.dataset.m); }; });
    return UI.modal('GAME.INC.RE 账号', form, { onOpen: (bd, close) => {
      form.onsubmit = async (e) => {
        e.preventDefault(); if (busy) return;
        const u = form.elements.username.value.trim(), p = form.elements.password.value;
        if (!G.cloud.validName(u)) { msg.textContent = G.cloud.errorText({ data: { error: 'bad_username' } }); return; }
        if (!G.cloud.validPassword(p)) { msg.textContent = G.cloud.errorText({ data: { error: 'bad_password' } }); return; }
        if (mode && p !== confirm.value) { msg.textContent = '两次输入的密码不一致'; return; }
        busy = true; submit.disabled = true; msg.textContent = '正在连接…';
        try { await G.cloud.login(u, p, mode === 1); form.elements.password.value = ''; confirm.value = ''; close(); }
        catch (err) { msg.textContent = G.cloud.errorText(err); }
        finally { busy = false; submit.disabled = false; }
      };
      setTimeout(() => form.elements.username.focus(), 60);
    } });
  };
})();
