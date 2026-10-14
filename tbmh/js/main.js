'use strict';
// =====================================================================
//  MAIN — the game controller: save, offline gains, actions, dialogs,
//  layout, input, the frame loop, background ticking, the mini window
// =====================================================================
function Monitor(clock) {
  // one bucket per second of hunting time (simulation clock), last 10 minutes
  const N = 600, k = new Float64Array(N), g = new Float64Array(N), x = new Float64Array(N), c = new Float64Array(N);
  let head = Math.floor(clock()), born = clock();
  const roll = () => { const now = Math.floor(clock()); if (now - head > N) head = now - N; while (head < now) { head++; const i = head % N; k[i] = g[i] = x[i] = c[i] = 0; } return head % N; };
  const sum = (arr, secs) => { const h = roll(); let tot = 0; for (let j = 0; j < secs; j++) tot += arr[(h - j + N) % N]; return tot; };
  const per = arr => { const span = Math.min(60, Math.max(5, clock() - born)); return sum(arr, Math.ceil(span)) * 60 / span; };
  return {
    kill() { k[roll()]++; }, gold(v) { g[roll()] += v; }, exp(v) { x[roll()] += v; }, chest() { c[roll()]++; },
    kpm: () => per(k), gpm: () => per(g), xpm: () => per(x), cpm: () => per(c),
    bars(n) { const h = roll(), out = []; for (let m = n - 1; m >= 0; m--) { let tot = 0; for (let j = 0; j < 60; j++) tot += k[(h - m * 60 - j + N * 2) % N]; out.push(tot); } return out; },
    reset() { k.fill(0); g.fill(0); x.fill(0); c.fill(0); born = clock(); },
  };
}

const Game = (() => {
  let s = null, b = null, t = 0, ready = false, simT = 0;
  const G = { tab: 'party', dialog: null, toast: null, monitor: Monitor(() => simT), mini: false, badge: {} };
  const canvas = document.getElementById('screen');
  const buf = mkCanvas(640, 360), bctx = buf.getContext('2d');
  let scr = canvas.getContext('2d', { alpha: false });
  let L = null, lastWall = Date.now(), lastSave = Date.now(), pipWin = null, muteMem = null, lastFull = 0, lastLost = 0;

  // ---------- save ----------
  function persist() { if (!s) return; s.t = Date.now(); Cloud.persist(s); lastSave = Date.now(); }
  function say(text, color = PAL.cream) { G.toast = { text, color, life: 2.6 }; }

  // swap in a different save (cloud, account switch, import, reset)
  function adopt(next, reason) {
    s = next || newSave();
    const rep = settleOffline(false);
    newBattle();
    if (reason === 'cloud') say('已载入云端进度', PAL.green);
    if (rep && s.flags.chose) G.dialog = offlineDialog(rep);
    else if (s.flags.chose) upgradeNotice();
    persist();
  }
  function newBattle() {
    b = new Battle(s);
    FX.clear(); FX.attach(b, View.v);
    attachHooks();
    applyOpts();
  }
  function applyOpts() { FX.opts = { shake: s.opts.shake, nums: s.opts.nums, fx: s.opts.fx }; Sound.setVolume(s.opts.sfx, s.opts.music); }

  // ---------- offline (TBH): only with the 安眠 rune, up to 8 hours, gold and experience ----------
  function settleOffline(show) {
    const gap = (Date.now() - (s.t || Date.now())) / 1000;
    if (gap < 60) return null;
    const A = acctStats(s);
    if (!A.offline) { s.t = Date.now(); return null; }
    const secs = Math.min(gap, OFFLINE_H * 3600);
    const r = measureRates(s, 90);
    const gold = r.gold * secs * OFFLINE_RATE * (1 + A.offGold), exp = r.exp * secs * OFFLINE_RATE * (1 + A.offExp);
    const kills = Math.floor(r.kills * secs * OFFLINE_RATE);
    const lv0 = {};
    for (const cls of partyList(s)) lv0[cls] = s.heroes[cls].lv;
    s.gold += gold; s.stats.gold += gold; s.stats.kills += kills; s.stats.play += secs;
    const L0 = stageLevel(r.d, r.a, r.s);
    // the measured party experience is per hero already
    for (const cls of partyList(s)) gainExp(s, cls, exp * expPenalty(s.heroes[cls].lv, L0), null);
    checkPets(s, null); checkAch(s, null);
    const ups = partyList(s).map(cls => [cls, s.heroes[cls].lv - lv0[cls]]).filter(([, n]) => n > 0);
    const rep = { gap, secs, gold, exp, kills, ups, capped: gap > secs };
    s.t = Date.now();
    if (show) G.dialog = offlineDialog(rep);
    return rep;
  }
  function offlineDialog(r) {
    const lines = [
      { text: `离开了 ${fmtTime(r.gap)}${r.capped ? `（按上限 ${OFFLINE_H} 小时结算）` : ''} · 离线收益 ${pct(OFFLINE_RATE)}`, color: PAL.steel },
      { text: `金币 +${fmt(r.gold)} · 每名英雄经验 +${fmt(r.exp)}`, color: PAL.yellow },
      { text: `击杀 ${fmt(r.kills)}`, color: PAL.cream },
    ];
    for (const [cls, n] of r.ups) lines.push({ text: `${CLASSES[cls].hero}升了 ${n} 级`, color: PAL.cyan });
    lines.push({ text: '宝箱只在在线狩猎时掉落', color: PAL.slate });
    return { title: '离线收益', lines, buttons: [{ label: '收下', kind: 'gold', fn: () => { G.dialog = null; Sound.play('fanfare'); upgradeNotice(); } }] };
  }
  // the second-edition hunter arrives in the third edition
  function upgradeNotice() {
    if (!s.flags.v2 || s.flags.v3seen) return;
    s.flags.v3seen = 1;
    const cls = partyList(s)[0];
    G.dialog = {
      title: '悬赏怪物猎人 3.0', w: 320,
      lines: [
        { text: '世界改成 3 幕 × 10 关 × 4 难度，每关结尾都有首领；最多 3 名英雄组队出战。', color: PAL.cream },
        { text: `你的猎人以${CLASSES[cls].name}${CLASSES[cls].hero}的身份带着等级、装备和金币加入。`, color: PAL.green },
        { text: s.flags.refund ? '原来的符文按花费全数退回成金币；装备插槽清空，宝石等材料换算到新的材料表。' : '装备插槽清空，宝石等材料换算到新的材料表。', color: PAL.steel },
      ],
      buttons: [{ label: '出发', kind: 'gold', fn: () => { G.dialog = null; } }],
    };
  }

  // ---------- event hooks: monitor, red dots, autosave ----------
  function attachHooks() {
    const ev = b.ev;
    ev.on('kill', () => G.monitor.kill());
    ev.on('gold', g => G.monitor.gold(g));
    ev.on('exp', x => G.monitor.exp(x));
    ev.on('chestDrop', () => G.monitor.chest());
    ev.on('bossKill', m => { if (m.bossKind === 'act') persist(); });
    ev.on('alch', (it, g, why) => { if (why === 'full' && Date.now() - lastFull > 20000) { lastFull = Date.now(); say('背包满了，新装备自动炼成金币', PAL.amber); } });
    ev.on('chestLost', ch => { if (Date.now() - lastLost > 20000) { lastLost = Date.now(); say(`${CHESTS[ch.k].name}装满了，新掉落的会丢失`, PAL.red); } });
    ev.on('levelUp', () => { if (!s.opts.autoSkill) G.badge.skill = true; });
    ev.on('record', (d, a, st) => { if (st === STAGES) persist(); });
    ev.on('heroUnlock', () => { G.badge.party = true; persist(); });
  }

  // ---------- actions ----------
  const after = sound => { b.recalc(); persist(); if (sound) Sound.play(sound); };
  const sel = () => Panels.UI_ST.gear;
  const findItem = u => { const it = s.inv.find(x => x.u === u); if (it) return it; for (const cls in s.heroes) for (const slot of SLOTS) { const e = s.heroes[cls].eq[slot]; if (e && e.u === u) return e; } return null; };
  function selectHero(cls) { if (s.heroes[cls]) Panels.UI_ST.hero = cls; }
  function equip(cls, u) { if (Loot.equip(s, cls, u)) { sel().sel = null; after('equip'); } }
  function unequip(cls, slot) { if (Loot.unequip(s, cls, slot)) after('equip'); }
  function autoEquip(cls) { const n = Loot.autoEquip(s, cls); after(n ? 'equip' : 'nope'); say(n ? `${CLASSES[cls].hero}换上了 ${n} 件更强的装备` : '身上已经是最强的组合', n ? PAL.green : PAL.steel); }
  function sortInv() { s.inv.sort((a, c) => c.g - a.g || c.l - a.l || SLOTS.indexOf(TYPES[a.t].slot) - SLOTS.indexOf(TYPES[c.t].slot)); Sound.play('click'); }
  function alchOne(u) { const i = s.inv.findIndex(x => x.u === u); if (i < 0) return; const it = s.inv.splice(i, 1)[0]; const g = Loot.alch(s, it, b.ev); sel().sel = null; say(`炼成 ${fmt(g)} 金币`, PAL.yellow); after('salvage'); }
  function alchFiltered() {
    const grades = Panels.UI_ST.cube.grades;
    const r = Loot.alchMany(s, it => grades[it.g] && !(s.keepUp && Loot.isUpgrade(s, it)), b.ev);
    say(r.n ? `炼金 ${r.n} 件，得到 ${fmt(r.gold)} 金币` : '没有符合条件的装备', r.n ? PAL.yellow : PAL.steel);
    after(r.n ? 'salvage' : 'nope');
  }
  function alchMat(id, n) { const g = Loot.alchMat(s, id, n, b.ev); if (g) { say(`炼成 ${fmt(g)} 金币`, PAL.yellow); after('salvage'); } }
  // opening: everything that came out is gathered for the result card
  function openWhere(pred) {
    const res = { n: 0, gold: 0, items: [], mats: {} };
    const keep = [];
    for (const ch of s.tray.splice(0)) {
      if (!pred(ch) || res.n >= 200) { keep.push(ch); continue; }
      const r = Loot.open(s, ch, null, b.rng, b.P);
      res.n++; res.gold += r.gold; res.items.push(...r.items);
      for (const id of r.mats) res.mats[id] = (res.mats[id] || 0) + 1;
    }
    s.tray.push(...keep);
    res.items.sort((a, c) => c.it.g - a.it.g);
    if (res.n) { b.ev.emit('open', res); if (res.items.some(x => x.kept && Loot.isUpgrade(s, x.it))) G.badge.gear = true; after('open'); } else Sound.play('nope');
    return res.n ? res : null;
  }
  const openKind = k => openWhere(ch => ch.k === k);
  const openAll = () => openWhere(() => true);
  function synth(g, r, n) {
    let made = 0, best = null, stay = 0;
    for (let i = 0; i < n && Loot.synthOk(s, g, r); i++) { const it = Loot.synth(s, g, r, b.rng, b.ev); if (it) { made++; if (it.g === g) stay++; if (!best || it.g > best.g) best = it; } }
    if (made) { say(`合成 ${made} 次${best.g > g + 1 ? '，大成功！' : stay ? `，${stay} 次保持原品质` : ''}`, GRADES[best.g].color); after('forge'); } else Sound.play('nope');
  }
  function craft(type, tier) { const it = Loot.craft(s, type, tier, b.rng, b.ev); if (it) { say('制作出 ' + Loot.name(it), GRADES[it.g].color); after('forge'); } else Sound.play('nope'); }
  function socket(u, key, matId) { const it = findItem(u); if (it && Loot.socket(s, it, key, matId, b.rng)) after('forge'); else Sound.play('nope'); }
  function unsocket(u, key, i) { const it = findItem(u); if (it && Loot.unsocket(s, it, key, i)) after('salvage'); else Sound.play('nope'); }
  function offer(g) { const it = Loot.offer(s, g, b.rng, b.ev); if (it) { say('供奉得到 ' + Loot.name(it), GRADES[it.g].color); after('fanfare'); } else Sound.play('nope'); }
  function runeBuy(id) {
    const n = RUNE[id], lv = s.runes[id] || 0, c = runeCost(n, lv);
    if (lv >= n.max || !runeOpen(s, n) || s.gold < c) { Sound.play('nope'); return; }
    const size0 = partySize(s);
    s.gold -= c; s.runes[id] = lv + 1;
    if (partySize(s) > size0) { say('队伍多了一个位置，去「队伍」页让新英雄上阵', PAL.yellow); G.badge.party = true; }
    else if (RUNE_KINDS[n.kind].eff.skillSlot) { for (const cls in s.heroes) if (s.opts.autoSkill) Skills.auto(s, cls); say('每名英雄多了一个主动技能槽', PAL.yellow); }
    after('level');
  }
  const skillDo = fn => { fn(); after(); };
  const skillRaise = (cls, id) => skillDo(() => Skills.raise(s, cls, id));
  const skillLower = (cls, id) => skillDo(() => Skills.lower(s, cls, id));
  const skillReset = cls => { skillDo(() => Skills.reset(s, cls)); say(`${CLASSES[cls].hero}的技能点已全部退回`, PAL.cyan); };
  const skillAuto = cls => skillDo(() => Skills.auto(s, cls));
  const skillSlot = (cls, id, i) => skillDo(() => Skills.slot(s, cls, id, i));
  const skillUnslot = (cls, i) => skillDo(() => Skills.unslot(s, cls, i));
  function partyDeploy(cls, i) {
    const r = Party.deploy(s, cls, i);
    if (r === 'cool') { say(`换人冷却还剩 ${clock(Party.coolLeft(s) / 1000)}`, PAL.amber); Sound.play('nope'); return; }
    if (r !== 'ok') { Sound.play('nope'); return; }
    Panels.UI_ST.hero = cls; G.badge.party = false;
    after('fanfare');
    say(`${CLASSES[cls].hero}加入了队伍`, PAL.green);
  }
  function partyRemove(i) { if (Party.remove(s, i)) after('tab'); }
  function partyMove(i, dir) { if (Party.move(s, i, dir)) { Panels.UI_ST.party.slot = i + dir; after('tab'); } }
  function setFarm(v) {
    if (s.prog.farm === v) return;
    s.prog.farm = v; s.prog.auto = false; s.prog.clears = 0;
    Sound.play('tab');
    say(v ? '刷关：反复刷当前这一关' : '推进：清完一关自动前往下一关', v ? PAL.cyan : PAL.green);
  }
  function travel(d, a, st) {
    if (!stageOpen(s, d, a, st)) { Sound.play('nope'); return; }
    s.prog.d = d; s.prog.a = a; s.prog.s = st; s.prog.fails = 0; s.prog.auto = false;
    s.prog.farm = stageCleared(s, d, a, st) && st !== STAGES ? s.prog.farm : false;
    newBattle(); persist(); Sound.play('tab');
    G.sheet = false;
  }
  function setPet(id) { s.pets.cur = id; persist(); Sound.play('click'); }
  function askHome() {
    const previous = G.dialog;
    G.dialog = { title: '返回主页', lines: [
      { text: '返回主页？进度已自动保存，离线收益照常累计。', color: PAL.cream },
    ], buttons: [{ label: '返回', kind: 'gold', fn: async () => {
      if (G.leavingHome) return;
      G.leavingHome = true; persist();
      let timeout;
      try {
        await Promise.race([Cloud.sync(), new Promise(resolve => { timeout = setTimeout(resolve, 1500); })]);
      } catch { /* 本地已保存；离线时仍可离开。 */ }
      finally { clearTimeout(timeout); location.href = '/'; }
    } }, { label: '取消', fn: () => { G.dialog = previous; } }] };
  }
  function askReset() {
    G.dialog = { title: '清空进度', lines: [{ text: '所有英雄、进度、装备与符文都会清除，从普通 1-1 重新开始。', color: PAL.red }, { text: '这一步无法撤回。', color: PAL.cream }],
      buttons: [{ label: '清空', kind: 'red', fn: () => { const keep = s.opts; s = newSave(); s.opts = keep; newBattle(); persist(); G.dialog = chooseDialog(); say('进度已清空', PAL.red); } }, { label: '取消', fn: () => { G.dialog = null; } }] };
  }

  // ---------- the first hero ----------
  function setStarter(cls) {
    const keep = s.opts, play = s.stats.play, flags = s.flags;
    s = newSave(Date.now(), cls); s.opts = keep; s.stats.play = play; s.flags = { ...flags, chose: 1 };
    Panels.UI_ST.hero = cls;
    newBattle(); persist();
  }
  function chooseDialog() {
    return {
      title: '选择第一名英雄', w: 360,
      custom(ctx, x, y, w) {
        const big = L.H >= 300, ph = big ? 96 : 40, n = STARTERS.length;
        STARTERS.forEach((cls, i) => {
          const C = CLASSES[cls], cx = x + i * (w / n), cw = w / n - 4, chh = ph + 46;
          const st = UI.hit('pick' + cls, cx, y, cw, chh);
          Frame.panel(ctx, cx, y, cw, chh, { fill: st.hover ? PAL.dusk : PAL.night });
          Frame.rarity(ctx, Math.round(cx + cw / 2 - ph / 2 - 2), y + 3, ph + 4, ph + 4, st.hover ? 4 : 3, t);
          ctx.drawImage(big ? Portraits.full(cls) : Portraits.face(cls), Math.round(cx + cw / 2 - ph / 2), y + 5, ph, ph);
          Text.draw(ctx, `${C.name} ${C.hero}`, cx + cw / 2, y + ph + 11, { align: 'center', color: st.hover ? PAL.yellow : PAL.white });
          Text.draw(ctx, C.role, cx + cw / 2, y + ph + 26, { align: 'center', color: PAL.steel });
          if (st.hover) UI.setTip([{ text: `${C.name} ${C.hero}`, color: PAL.amber }, C.line, `${TYPES[C.weapon].name} + ${TYPES[C.off].name}`]);
          if (st.click) { setStarter(cls); G.dialog = null; Sound.play('fanfare'); }
        });
        return ph + 50;
      },
      lines: [{ text: '牧师可以随时免费招募；更多英雄随着冒险加入', color: PAL.steel }],
      buttons: [],
    };
  }
  // the first save of a new account: bring the guest progress along?
  function firstAccountSave() {
    const guest = Cloud.readGuest();
    const g = guest && (guest.v === SAVE_VERSION || guest.v === 2) ? normalizeSave(guest) : null;
    if (!g || (g.prog.best[0] || 0) < 1) return Promise.resolve();
    return new Promise(res => {
      G.dialog = {
        title: '带入本机进度', lines: [{ text: `这台设备上有 ${maxHeroLv(g)} 级英雄的游客进度。`, color: PAL.cream }, { text: '带入这个账号吗？', color: PAL.steel }],
        buttons: [
          { label: '带入', kind: 'gold', fn: () => { G.dialog = null; adopt(g, 'import'); res(); } },
          { label: '从零开始', fn: () => { const o = s.opts; s = newSave(); s.opts = o; newBattle(); G.dialog = chooseDialog(); res(); } },
        ],
      };
    });
  }

  // ---------- save codes ----------
  function exportSave() {
    persist();
    const code = btoa(unescape(encodeURIComponent(JSON.stringify(s))));
    domDialog('导出存档码', '复制下面的存档码，在任意设备的「导入存档码」里粘贴即可恢复进度。', code, null);
  }
  function importSave() {
    domDialog('导入存档码', '粘贴存档码。导入后当前进度会被替换。', '', code => {
      try {
        const data = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
        if (!data || typeof data !== 'object' || !data.v) throw new Error('bad');
        const next = normalizeSave(data); next.flags.chose = 1;
        adopt(next, 'import'); say('存档已导入', PAL.green); return true;
      } catch { return false; }
    });
  }
  function domDialog(title, text, value, onOk) {
    const dlg = document.getElementById('code'), ta = dlg.querySelector('textarea'), msg = dlg.querySelector('.msg');
    dlg.querySelector('h2').textContent = title; dlg.querySelector('p').textContent = text;
    ta.value = value; ta.readOnly = !onOk; msg.textContent = '';
    const ok = dlg.querySelector('.ok');
    ok.textContent = onOk ? '导入' : '复制';
    ok.onclick = async () => {
      if (!onOk) { ta.select(); try { await navigator.clipboard.writeText(ta.value); msg.textContent = '已复制'; } catch { msg.textContent = '请手动复制'; } return; }
      if (onOk(ta.value)) dlg.close(); else msg.textContent = '存档码无法识别';
    };
    dlg.querySelector('.x').onclick = () => dlg.close();
    dlg.showModal();
    if (onOk) ta.focus(); else ta.select();
  }

  // ---------- sound / mini window ----------
  function toggleMute() {
    if (s.opts.music + s.opts.sfx > 0) { muteMem = [s.opts.music, s.opts.sfx]; s.opts.music = 0; s.opts.sfx = 0; }
    else { [s.opts.music, s.opts.sfx] = muteMem || [0.45, 0.7]; }
    applyOpts();
  }
  async function toggleMini() {
    if (pipWin) { pipWin.close(); return; }
    if (!('documentPictureInPicture' in window)) { say('这个浏览器暂不支持置顶小窗，Chrome / Edge 可用', PAL.amber); return; }
    try {
      pipWin = await documentPictureInPicture.requestWindow({ width: 640, height: 168 });
      const st = pipWin.document.createElement('style');
      st.textContent = 'html,body{margin:0;height:100%;background:#181425;overflow:hidden}body{display:flex;align-items:center;justify-content:center}canvas{image-rendering:pixelated;touch-action:none}';
      pipWin.document.head.append(st);
      pipWin.document.body.append(canvas);
      pipWin.document.title = 'TBMH 挂件';
      G.mini = true; scr = canvas.getContext('2d', { alpha: false });
      pipWin.addEventListener('resize', resize);
      pipWin.addEventListener('keydown', onKey);
      pipWin.addEventListener('pagehide', () => {
        document.getElementById('stage').append(canvas);
        pipWin = null; G.mini = false; resize();
        requestAnimationFrame(frame);
      });
      resize();
      pipWin.requestAnimationFrame(frame);
    } catch (e) { pipWin = null; say('无法打开小窗', PAL.red); }
  }

  // ---------- layout ----------
  // four shapes: 'wide' 640×360 (desktop, tablet), 'tall' 360×640 (phone upright),
  // 'compact' for a phone held sideways (battle + dock, panels slide up as a sheet), 'mini' (pinned window)
  function viewport() {
    const win = pipWin || window, dpr = win.devicePixelRatio || 1;
    let w = win.innerWidth, h = win.innerHeight;
    if (!pipWin) {
      const st = getComputedStyle(document.getElementById('stage'));
      w -= parseFloat(st.paddingLeft) + parseFloat(st.paddingRight); h -= parseFloat(st.paddingTop) + parseFloat(st.paddingBottom);
    }
    return { w: Math.max(1, w), h: Math.max(1, h), dpr };
  }
  function layout() {
    const vp = viewport(), tabs = [];
    if (G.mini) return { mode: 'mini', W: 640, H: 168, tabs, panel: null };
    if (vp.h > vp.w * 1.1) {
      const W = 360, H = 640, th = 30, tw = W / TABS.length;
      TABS.forEach((tb, i) => tabs.push({ ...tb, x: Math.round(i * tw), y: H - th, w: Math.round((i + 1) * tw) - Math.round(i * tw), h: th }));
      return { mode: 'tall', portrait: true, W, H, tabs, panel: { x: 0, y: 168, w: W, h: H - 168 - th } };
    }
    if (vp.h < 500) {
      // sideways phone: pick the integer scale that keeps 12 px text and buttons comfortable to tap
      const dw = vp.w * vp.dpr, dh = vp.h * vp.dpr;
      const sc = Math.max(1, Math.min(Math.floor(dw / 500), Math.floor(dh / 234)));
      const W = clamp(Math.floor(dw / sc), 500, 760), H = clamp(Math.floor(dh / sc), 234, 330);
      const head = { x: 0, y: 18, w: W, h: 24 }, tw = Math.floor((W - 52) / TABS.length);
      TABS.forEach((tb, i) => tabs.push({ ...tb, x: 2 + i * tw, y: head.y + 1, w: tw - 2, h: head.h - 2 }));
      return { mode: 'compact', W, H, sc, tabs, head, dock: { x: 0, y: 168, w: W, h: H - 168 }, panel: { x: 0, y: 42, w: W, h: H - 42 } };
    }
    TABS.forEach((tb, i) => tabs.push({ ...tb, x: 0, y: 168 + i * 24, w: 64, h: 24 }));
    return { mode: 'wide', W: 640, H: 360, tabs, panel: { x: 64, y: 168, w: 576, h: 192 } };
  }
  function resize() {
    L = layout();
    if (buf.width !== L.W || buf.height !== L.H) { buf.width = L.W; buf.height = L.H; }
    const vp = viewport();
    const aw = vp.w * vp.dpr, ah = vp.h * vp.dpr;
    let sc = L.sc || Math.min(aw / L.W, ah / L.H);
    sc = sc >= 1 ? Math.floor(sc) : sc;
    canvas.width = Math.round(L.W * Math.max(1, sc)); canvas.height = Math.round(L.H * Math.max(1, sc));
    canvas.style.width = (L.W * sc / vp.dpr) + 'px'; canvas.style.height = (L.H * sc / vp.dpr) + 'px';
    scr = canvas.getContext('2d', { alpha: false }); scr.imageSmoothingEnabled = false;
  }
  async function toggleFull() {
    try {
      if (document.fullscreenElement) { await document.exitFullscreen(); return; }
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape').catch(() => {});
    } catch { say('这个浏览器不支持全屏', PAL.amber); }
  }
  G.touch = matchMedia('(pointer: coarse)').matches;

  // ---------- input ----------
  function toLogical(e) { const r = canvas.getBoundingClientRect(); return [Math.floor((e.clientX - r.left) / r.width * L.W), Math.floor((e.clientY - r.top) / r.height * L.H)]; }
  canvas.addEventListener('pointerdown', e => { Sound.unlock(); const [x, y] = toLogical(e); UI.pointer('down', x, y, e.pointerType === 'touch'); canvas.setPointerCapture?.(e.pointerId); e.preventDefault(); });
  canvas.addEventListener('pointermove', e => { const [x, y] = toLogical(e); UI.pointer('move', x, y, e.pointerType === 'touch'); });
  canvas.addEventListener('pointerup', e => { const [x, y] = toLogical(e); UI.pointer('up', x, y, e.pointerType === 'touch'); });
  canvas.addEventListener('pointercancel', () => { UI.pointer('up', -1, -1, true); });
  canvas.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch' && !UI.I.down) { UI.I.x = -1; UI.I.y = -1; } });
  canvas.addEventListener('wheel', e => { UI.wheel(e.deltaY); e.preventDefault(); }, { passive: false });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  function onKey(e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    Sound.unlock();
    if (e.key === 'Escape' && G.dialog && G.dialog.buttons.length) { G.dialog.buttons[G.dialog.buttons.length - 1].fn(); return; }
    if (G.dialog) return;
    const n = Number(e.key);
    if (n >= 1 && n <= TABS.length) openTab(TABS[n - 1].id);
    else if (e.key === 'p' || e.key === 'P') setFarm(!s.prog.farm);
    else if (e.key === 'm' || e.key === 'M') toggleMini();
  }
  window.addEventListener('keydown', onKey);
  window.addEventListener('resize', () => resize());

  // ---------- drawing ----------
  function openTab(id) { if (G.tab !== id) { UI.resetScroll('inv'); UI.resetScroll('codex'); } G.tab = id; G.sheet = true; G.badge[id] = false; Sound.play('tab'); }
  function drawTabs(ctx) {
    for (const tb of L.tabs) {
      const on = G.tab === tb.id, st = UI.hit('tab' + tb.id, tb.x, tb.y, tb.w, tb.h);
      if (on) Frame.wood(ctx, tb.x, tb.y, tb.w, tb.h);
      else Frame.panel(ctx, tb.x, tb.y, tb.w, tb.h, { fill: st.hover ? PAL.dusk : PAL.ink, hi: PAL.night });
      const img = Spr.get(tb.icon);
      if (L.mode === 'tall') { ctx.drawImage(img, Math.round(tb.x + tb.w / 2 - 5), tb.y + 3); Text.draw(ctx, tb.name, tb.x + tb.w / 2, tb.y + 14, { align: 'center', color: on ? PAL.yellow : PAL.steel }); }
      else if (L.mode === 'compact') { const lw = 13 + Text.width(tb.name); ctx.drawImage(img, Math.round(tb.x + tb.w / 2 - lw / 2), tb.y + 6); Text.draw(ctx, tb.name, Math.round(tb.x + tb.w / 2 - lw / 2) + 13, tb.y + 4, { color: on ? PAL.yellow : st.hover ? PAL.cream : PAL.steel, outline: on ? PAL.soil : null }); }
      else { ctx.drawImage(img, tb.x + 7, tb.y + 7); Text.draw(ctx, tb.name, tb.x + 21, tb.y + 5, { color: on ? PAL.yellow : st.hover ? PAL.cream : PAL.steel, outline: on ? PAL.soil : null }); }
      if (!on && dot(tb.id) && Math.floor(t * 2) % 2) { ctx.fillStyle = PAL.red; ctx.fillRect(tb.x + tb.w - 7, tb.y + 4, 4, 4); }
      if (st.click && !on) openTab(tb.id);
    }
  }
  // compact mode, sheet folded: the chests and the party at a glance + a grid that opens each panel
  function drawDock(ctx) {
    const D = L.dock;
    ctx.fillStyle = PAL.night; ctx.fillRect(D.x, D.y, D.w, D.h);
    ctx.fillStyle = PAL.dusk; ctx.fillRect(D.x, D.y, D.w, 1);
    const cols = 4, cw = 40, gap = 2, gw = cols * (cw + gap), gx = D.w - gw - 2;
    const bh = Math.min(34, Math.floor((D.h - 6) / 2));
    TABS.forEach((tb, i) => {
      const x = gx + (i % cols) * (cw + gap), y = D.y + 3 + Math.floor(i / cols) * (bh + 2);
      const st = UI.hit('dock' + tb.id, x, y, cw, bh);
      Frame.button(ctx, x, y, cw, bh, { hover: st.hover, down: st.down }, 'plain');
      const dy = st.down ? 1 : 0, img = Spr.get(tb.icon);
      if (bh >= 28) { ctx.drawImage(img, Math.round(x + cw / 2 - img.width / 2), y + 3 + dy); Text.draw(ctx, tb.name, x + cw / 2, y + bh - 15 + dy, { align: 'center', color: PAL.cream }); }
      else Text.draw(ctx, tb.name, x + cw / 2, y + (bh - 12) / 2 - 1 + dy, { align: 'center', color: PAL.cream });
      if (dot(tb.id) && Math.floor(t * 2) % 2) { ctx.fillStyle = PAL.red; ctx.fillRect(x + cw - 6, y + 3, 4, 4); }
      if (st.click) openTab(tb.id);
    });
    // chest card
    const ch = Math.min(76, D.h - 6), tw = Math.min(196, gx - 112);
    Frame.panel(ctx, 3, D.y + 3, tw, ch, { fill: s.tray.length ? '#2c3150' : PAL.ink, hi: PAL.dusk });
    Text.draw(ctx, `宝箱 ${s.tray.length}`, 8, D.y + 5, { color: PAL.amber });
    const cwid = Math.floor((tw - 10) / 3);
    CHESTS.forEach((C, k) => { const x = 6 + k * cwid + cwid / 2, n = chestCount(s, k), cap = chestCap(s, k); Spr.draw(ctx, Spr.get('chest', 0, String(k)), x - 10, D.y + 30); Text.draw(ctx, `${n}/${cap}`, x + 1, D.y + 21, { color: n >= cap ? PAL.red : n ? PAL.white : PAL.slate }); });
    if (ch >= 60 && UI.button('dockopen', 6, D.y + ch - 18, tw - 6, 16, '全部打开', { kind: 'gold', disabled: !s.tray.length, sound: 'open' })) { const r = openAll(); if (r) { Panels.UI_ST.gear.view = 'chest'; Panels.UI_ST.gear.res = r; openTab('gear'); } }
    // the party card: levels and free points
    const hx = tw + 7, hw = gx - hx - 4;
    if (hw > 90) {
      Frame.panel(ctx, hx, D.y + 3, hw, ch, { fill: PAL.ink, hi: PAL.dusk });
      partyList(s).forEach((cls, i) => { const H = s.heroes[cls]; Text.draw(ctx, `${CLASSES[cls].hero} ${H.lv}`, hx + 5, D.y + 5 + i * 13, { color: Skills.free(H) ? PAL.yellow : PAL.white }); });
      const free = partyList(s).find(cls => Skills.free(s.heroes[cls]) > 0);
      if (ch >= 60 && UI.button('dockskill', hx + 3, D.y + ch - 18, hw - 6, 16, free ? `${CLASSES[free].hero}有技能点` : `${DIFFS[s.prog.d].name} ${s.prog.a}-${s.prog.s}`, { kind: free ? 'green' : 'plain' })) { if (free) { Panels.UI_ST.hero = free; openTab('skill'); } else openTab('map'); }
    }
  }
  function drawSheetHead(ctx) {
    const H = L.head;
    ctx.fillStyle = PAL.ink; ctx.fillRect(H.x, H.y, H.w, H.h);
    drawTabs(ctx);
    if (UI.button('fold', H.w - 48, H.y + 2, 46, H.h - 4, '收起', { icon: 'i_down', kind: 'blue', tip: ['收起面板，回到战斗画面'] })) { G.sheet = false; Sound.play('tab'); }
  }
  function dot(id) {
    if (id === 'party') return !!G.badge.party || (partyList(s).length < partySize(s) && CLASS_IDS.some(c => heroUnlocked(s, c) && !s.party.includes(c)));
    if (id === 'gear') return !!G.badge.gear || CHESTS.some((C, k) => chestCount(s, k) >= chestCap(s, k));
    if (id === 'skill') return !s.opts.autoSkill && partyList(s).some(cls => skillTree(cls).some(x => Skills.canRaise(s, cls, x)));
    if (id === 'rune') return runesUnlocked(s) && RUNE_SPEC.some(n => (s.runes[n.id] || 0) < n.max && runeOpen(s, n) && s.gold >= runeCost(n, s.runes[n.id] || 0) * 2);
    if (id === 'cube') return cubeUnlocked(s) && GRADES.some((g, i) => i >= 1 && i < GRADE_MAX && Loot.synthOk(s, i, 0));
    return false;
  }
  function drawDialog(ctx) {
    const d = G.dialog;
    ctx.fillStyle = rgba(PAL.ink, 0.72); ctx.fillRect(0, 0, L.W, L.H);
    const w = Math.min(L.W - 20, d.w || 260), lineH = 15, wrapped = [];
    for (const l of d.lines || []) for (const s2 of Text.wrap(l.text, w - 20)) wrapped.push({ ...l, text: s2 });
    let h = 30 + wrapped.length * lineH + (d.buttons.length ? 30 : 6);
    h += d.customH || 0;
    const x = Math.round(L.W / 2 - w / 2), y = Math.round(L.H / 2 - h / 2);
    Frame.wood(ctx, x - 3, y - 3, w + 6, h + 6);
    Frame.panel(ctx, x, y, w, h, { fill: PAL.night });
    Text.draw(ctx, d.title, x + w / 2, y + 6, { align: 'center', color: PAL.yellow });
    ctx.fillStyle = PAL.dusk; ctx.fillRect(x + 10, y + 21, w - 20, 1);
    wrapped.forEach((l, i) => Text.draw(ctx, l.text, x + w / 2, y + 27 + i * lineH, { align: 'center', color: l.color || PAL.cream }));
    if (d.custom) d.customH = d.custom(ctx, x + 10, y + 28 + wrapped.length * lineH, w - 20) + 4;
    const bw = 76, n = d.buttons.length, bx0 = Math.round(x + w / 2 - (n * bw + (n - 1) * 6) / 2);
    d.buttons.forEach((bt, i) => { if (UI.button('dlg' + i, bx0 + i * (bw + 6), y + h - 24, bw, 18, bt.label, { kind: bt.kind })) bt.fn(); });
  }
  function render(dt) {
    const ctx = bctx;
    ctx.imageSmoothingEnabled = false;
    UI.begin(ctx, t);
    const real = { x: UI.I.x, y: UI.I.y, p: UI.I.pressed, r: UI.I.released, w: UI.I.wheel };
    if (G.dialog) { UI.I.x = -1; UI.I.y = -1; UI.I.pressed = false; UI.I.released = false; UI.I.wheel = 0; }
    ctx.fillStyle = PAL.ink; ctx.fillRect(0, 0, L.W, L.H);
    View.topBar(ctx, L.W, s, t, dt);
    if (L.mode === 'compact') {
      if (G.sheet) {
        View.idle(dt);
        ctx.fillStyle = PAL.night; ctx.fillRect(L.panel.x, L.panel.y, L.panel.w, L.panel.h);
        Panels.draw(ctx, G.tab, L.panel, s, t);
        drawSheetHead(ctx);
      } else {
        View.strip(ctx, 0, 18, L.W, b, s, t, dt);
        drawDock(ctx);
      }
    } else {
      View.strip(ctx, 0, 18, L.W, b, s, t, dt);
      if (!G.mini) {
        ctx.fillStyle = PAL.night; ctx.fillRect(L.panel.x, L.panel.y, L.panel.w, L.panel.h);
        Panels.draw(ctx, G.tab, L.panel, s, t);
        drawTabs(ctx);
      }
    }
    if (G.dialog) { UI.I.x = real.x; UI.I.y = real.y; UI.I.pressed = real.p; UI.I.released = real.r; UI.I.wheel = real.w; drawDialog(ctx); }
    const cur = UI.end();
    canvas.style.cursor = cur;
    scr.imageSmoothingEnabled = false;
    scr.drawImage(buf, 0, 0, canvas.width, canvas.height);
  }

  // ---------- loop ----------
  let last = performance.now(), acc = 0;
  function advance(seconds) {
    acc += seconds;
    let n = 0;
    while (acc >= STEP && n < 40000) { b.step(STEP); acc -= STEP; simT += STEP; n++; }
    if (acc > STEP) acc = 0;
  }
  function frame(now) {
    const win = pipWin || window;
    const dt = Math.min(0.25, Math.max(0, (now - last) / 1000)); last = now;
    t += dt;
    lastWall = Date.now();
    if (FX.st.hitstop > 0) FX.st.hitstop -= dt; else advance(dt);
    FX.tickPending(dt);
    FX.update(dt, View.v.hx, GY);
    if (G.toast) { G.toast.life -= dt; if (G.toast.life <= 0) G.toast = null; }
    const boss = b.boss && !b.boss.dead && b.phase !== 'march' && b.boss.bossKind === 'act';
    Sound.setMusic(boss ? 'boss' : stageDef(b.where.a, b.where.s).scene);
    if (Date.now() - lastSave > 10000) persist();
    render(dt);
    win.requestAnimationFrame(frame);
  }
  // hidden tabs: rAF stops, so a slow timer keeps the hunt going by wall time
  setInterval(() => {
    if (!ready) return;
    const gap = Date.now() - lastWall;
    if (gap < 1500) return;
    lastWall = Date.now();
    if (gap > 10 * 60e3) { s.t = Date.now() - gap; settleOffline(true); newBattle(); }
    else advance(gap / 1000);
    if (Date.now() - lastSave > 10000) persist();
  }, 1000);

  async function boot() {
    await Promise.all([Text.load(), Portraits.load()]);
    s = Cloud.boot() || newSave();
    if (s.flags.v2) s.flags.chose = 1;
    resize();
    const rep = settleOffline(false);
    newBattle();
    if (!s.flags.chose) G.dialog = chooseDialog();
    else if (rep) G.dialog = offlineDialog(rep);
    else upgradeNotice();
    Panels.UI_ST.hero = partyList(s)[0];
    ready = true;
    persist();
    document.getElementById('boot')?.remove();
    requestAnimationFrame(frame);
    if (/[?&]debug\b/.test(location.search)) window.__tbmh = { get s() { return s; }, get b() { return b; }, G, advance, render: () => render(0), settleOffline };
  }

  Object.assign(G, {
    boot, persist, say, adopt, applyOpts, selectHero, equip, unequip, autoEquip, sortInv, alchOne, alchFiltered, alchMat, openKind, openAll,
    synth, craft, socket, unsocket, offer, runeBuy, skillRaise, skillLower, skillReset, skillAuto, skillSlot, skillUnslot,
    partyDeploy, partyRemove, partyMove, setFarm, travel, setPet, askReset, askHome, firstAccountSave, exportSave, importSave,
    toggleMute, toggleMini, toggleFull, openTab, battle: () => b, save: () => s,
  });
  Object.defineProperties(G, { ready: { get: () => ready }, layout: { get: () => L } });
  return G;
})();
Game.boot();
