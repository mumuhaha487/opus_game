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
  const G = { tab: 'gear', dialog: null, toast: null, monitor: Monitor(() => simT), mini: false, badge: {} };
  const canvas = document.getElementById('screen');
  const buf = mkCanvas(640, 360), bctx = buf.getContext('2d');
  let scr = canvas.getContext('2d', { alpha: false });
  let L = null, lastWall = Date.now(), lastSave = Date.now(), pipWin = null, muteMem = null, lastFull = 0;

  // ---------- save ----------
  function persist() { if (!s) return; s.t = Date.now(); Cloud.persist(s); lastSave = Date.now(); }
  const S = () => b.S;
  const power = () => powerNow(s, b.S);
  function say(text, color = PAL.cream) { G.toast = { text, color, life: 2.6 }; }

  // swap in a different save (cloud, account switch, import, reset)
  function adopt(next, reason) {
    s = next || newSave();
    const rep = settleOffline(false);
    newBattle();
    if (reason === 'cloud') say('已载入云端进度', PAL.green);
    if (rep && s.flags.chose) G.dialog = offlineDialog(rep);
    persist();
  }
  function newBattle() {
    b = new Battle(s);
    FX.clear(); FX.attach(b, View.v);
    attachHooks();
    applyOpts();
  }
  function applyOpts() { FX.opts = { shake: s.opts.shake, nums: s.opts.nums, fx: s.opts.fx }; Sound.setVolume(s.opts.sfx, s.opts.music); }

  // ---------- offline: replay the current stage headless, then pay out by the hour ----------
  function settleOffline(show) {
    const gap = (Date.now() - (s.t || Date.now())) / 1000;
    if (gap < 60) return null;
    const S0 = computeStats(s), secs = Math.min(gap, S0.offlineH * 3600), eff = S0.offlineGain;
    const r = measureRates(s, 90);
    const gold = r.gold * secs * eff, exp = r.exp * secs * eff, kills = Math.floor(r.kills * secs * eff);
    const lv0 = s.hero.lv, items0 = s.stats.items, tray0 = s.tray.length;
    s.gold += gold; s.stats.gold += gold; s.stats.kills += kills; s.stats.play += secs;
    gainExp(s, exp, null);
    // chests: each kind by its rate; the tray and auto-open runes decide what is kept
    const where = { d: r.d, a: r.a, L: stageLevel(r.d, r.a, r.s) };
    const got = [0, 0, 0];
    let lost = 0, lostGold = 0;
    r.chests.forEach((rate, k) => {
      const n = Math.min(300, Math.floor(rate * secs * eff));
      for (let i = 0; i < n; i++) {
        if (Loot.addChest(s, { k, d: where.d, L: where.L, a: where.a }, null, S0)) got[k]++;
        else { lost++; lostGold += CHESTS[k].gold * CURVE.gold(where.L) * DIFFS[where.d].gold * S0.gold; }
      }
    });
    // chests that did not fit in the tray still bring back their gold
    s.gold += lostGold; s.stats.gold += lostGold;
    checkPets(s, null); checkAch(s, null);
    const rep = { gap, secs, gold: gold + lostGold, exp, kills, got, lost, items: s.stats.items - items0, tray: s.tray.length - tray0, lv: s.hero.lv - lv0, capped: gap > secs, capH: S0.offlineH, eff };
    s.t = Date.now();
    if (show) G.dialog = offlineDialog(rep);
    return rep;
  }
  function offlineDialog(r) {
    const lines = [
      { text: `离开了 ${fmtTime(r.gap)}${r.capped ? `（按上限 ${r.capH} 小时结算）` : ''} · 离线收益 ${pct(r.eff)}`, color: PAL.steel },
      { text: `金币 +${fmt(r.gold)} · 经验 +${fmt(r.exp)}`, color: PAL.yellow },
      { text: `击杀 ${fmt(r.kills)}${r.lv ? ` · 升了 ${r.lv} 级` : ''}`, color: PAL.cream },
      { text: `宝箱 ${CHESTS.map((C, k) => r.got[k] ? `${C.name} ${r.got[k]}` : '').filter(Boolean).join(' · ') || '无'}`, color: PAL.amber },
    ];
    if (r.items) lines.push({ text: `自动开箱得到 ${r.items} 件装备`, color: PAL.cyan });
    if (r.lost) lines.push({ text: `托盘满了，另有 ${r.lost} 个宝箱只带回了里面的金币`, color: PAL.amber });
    return { title: '离线收益', lines, buttons: [{ label: '收下', kind: 'gold', fn: () => { G.dialog = null; Sound.play('fanfare'); } }] };
  }

  // ---------- event hooks: monitor, bounty board, red dots, autosave ----------
  function attachHooks() {
    const ev = b.ev;
    ev.on('kill', m => {
      G.monitor.kill();
      if (b.mode.kind === 'mine') return;
      Board.progress(s, 'hunt', m.type);
      if (m.elite) Board.progress(s, 'elite');
      if (m.champ) Board.progress(s, 'champ');
    });
    ev.on('gold', g => G.monitor.gold(g));
    ev.on('exp', x => G.monitor.exp(x));
    ev.on('chestDrop', () => G.monitor.chest());
    ev.on('crit', () => Board.progress(s, 'crit'));
    ev.on('bossKill', () => { Board.progress(s, 'boss'); persist(); });
    ev.on('open', res => { Board.progress(s, 'open', null, res.n || 1); if (res.items.some(x => x.kept && Loot.isUpgrade(s, x.it))) G.badge.gear = true; });
    ev.on('alch', (it, g, why) => { Board.progress(s, 'alch'); if (why === 'full' && Date.now() - lastFull > 20000) { lastFull = Date.now(); say('背包满了，新装备自动炼成金币', PAL.amber); } });
    ev.on('trayFull', () => { if (Date.now() - lastFull > 20000) { lastFull = Date.now(); say('宝箱托盘满了，打开一些吧', PAL.red); } });
    ev.on('stageClear', () => Board.progress(s, 'stage'));
    ev.on('levelUp', () => { if (!s.opts.autoSkill) G.badge.skill = true; });
    ev.on('record', (d, a, st) => { if (st === STAGES) persist(); for (const k in MODES) if (MODES[k].unlock[0] === d && stageIndex(MODES[k].unlock[1], MODES[k].unlock[2]) + 1 === s.prog.best[d]) say(`${MODES[k].name}开放了`, PAL.amber); });
    ev.on('modeEnd', res => { modeResult(res); persist(); });
  }

  // ---------- actions ----------
  const after = sound => { b.recalc(); persist(); if (sound) Sound.play(sound); };
  const sel = () => Panels.UI_ST.gear;
  function equip(u) { if (Loot.equip(s, u)) { sel().sel = null; after('equip'); } }
  function unequip(slot) { if (Loot.unequip(s, slot)) after('equip'); }
  function autoEquip() { const n = Loot.autoEquip(s); after(n ? 'equip' : 'nope'); say(n ? `换上了 ${n} 件更强的装备` : '身上已经是最强的组合', n ? PAL.green : PAL.steel); }
  function sortInv() { s.inv.sort((a, c) => c.g - a.g || c.l - a.l || SLOTS.indexOf(TYPES[a.t].slot) - SLOTS.indexOf(TYPES[c.t].slot)); Sound.play('click'); }
  function alchOne(u) { const i = s.inv.findIndex(x => x.u === u); if (i < 0) return; const it = s.inv.splice(i, 1)[0]; const g = Loot.alch(s, it, b.ev, b.S); sel().sel = null; say(`炼成 ${fmt(g)} 金币`, PAL.yellow); after('salvage'); }
  function alchFiltered() {
    const grades = Panels.UI_ST.cube.grades, S0 = b.S;
    const r = Loot.alchMany(s, it => grades[it.g] && !(s.keepUp && Loot.isUpgrade(s, it, S0)), b.ev);
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
      const r = Loot.open(s, ch, null, b.S, b.rng);
      res.n++; res.gold += r.gold; res.items.push(...r.items);
      for (const id of r.mats) res.mats[id] = (res.mats[id] || 0) + 1;
    }
    s.tray.push(...keep);
    res.items.sort((a, c) => c.it.g - a.it.g);
    if (res.n) { b.ev.emit('open', res); after('open'); } else Sound.play('nope');
    return res.n ? res : null;
  }
  const openKind = k => openWhere(ch => ch.k === k);
  const openAll = () => openWhere(() => true);
  function enhance(slot) { if (Loot.enhance(s, slot)) { after('forge'); FX.burst(View.v.hx, GY - 12, 12, [PAL.cyan, PAL.white, PAL.blue], { speed: 70 }); } else Sound.play('nope'); }
  function synth(g, n) {
    let made = 0, best = null;
    for (let i = 0; i < n && Loot.synthOk(s, g); i++) { const it = Loot.synth(s, g, b.rng, b.ev); if (it) { made++; if (!best || it.g > best.g) best = it; } }
    if (made) { say(`合成 ${made} 次${best.g > g + 1 ? '，跳了两级！' : ''}`, GRADES[best.g].color); after('forge'); } else Sound.play('nope');
  }
  function craft(type, tier) { const it = Loot.craft(s, type, tier, b.rng, b.ev); if (it) { say('制作出 ' + Loot.name(it), GRADES[it.g].color); after('forge'); } else Sound.play('nope'); }
  function socket(slot, key, matId) { const it = s.eq[slot]; if (it && Loot.socket(s, it, key, matId, b.rng)) after('forge'); else Sound.play('nope'); }
  function unsocket(slot, key, i) { const it = s.eq[slot]; if (it && Loot.unsocket(s, it, key, i)) after('salvage'); }
  function offer(g) { const it = Loot.offer(s, g, b.rng, b.ev); if (it) { say('供奉得到 ' + Loot.name(it), GRADES[it.g].color); after('fanfare'); } else Sound.play('nope'); }
  function reroll(slot, i) { const it = s.eq[slot]; if (it && Loot.reroll(s, it, i, b.rng)) after('forge'); else Sound.play('nope'); }
  function runeBuy(id) {
    const n = RUNE[id], lv = s.runes[id] || 0, c = runeCost(n, lv);
    if (lv >= n.max || !runeOpen(s, n) || s.gold < c) { Sound.play('nope'); return; }
    s.gold -= c; s.runes[id] = lv + 1;
    after('level');
  }
  const skillDo = fn => { fn(); after(); };
  const skillRaise = id => skillDo(() => Skills.raise(s, id));
  const skillLower = id => skillDo(() => Skills.lower(s, id));
  const skillReset = () => { skillDo(() => Skills.reset(s)); say('技能点已全部退回', PAL.cyan); };
  const skillAuto = () => skillDo(() => Skills.auto(s));
  const skillSlot = (id, i) => skillDo(() => Skills.slot(s, id, i));
  const skillUnslot = i => skillDo(() => Skills.unslot(s, i));
  function setFarm(v) {
    if (b.mode.kind !== 'main' || s.prog.farm === v) return;
    s.prog.farm = v; s.prog.auto = false; s.prog.clears = 0;
    Sound.play('tab');
    say(v ? '刷关：反复刷当前这一关' : '推进：清完一关自动前往下一关', v ? PAL.cyan : PAL.green);
  }
  function travel(d, a, st) {
    if (!stageOpen(s, d, a, st) || b.mode.kind !== 'main') { Sound.play('nope'); return; }
    s.prog.d = d; s.prog.a = a; s.prog.s = st; s.prog.fails = 0; s.prog.auto = false;
    s.prog.farm = stageCleared(s, d, a, st) && st !== STAGES ? s.prog.farm : false;
    newBattle(); persist(); Sound.play('tab');
    G.sheet = false;
  }
  function setPet(id) { s.pets.cur = id; persist(); Sound.play('click'); }
  function askReset() {
    G.dialog = { title: '清空进度', lines: [{ text: '所有进度、装备与符文都会清除，从普通 1-1 重新开始。', color: PAL.red }, { text: '这一步无法撤回。', color: PAL.cream }],
      buttons: [{ label: '清空', kind: 'red', fn: () => { G.dialog = null; const keep = s.opts; s = newSave(); s.opts = keep; s.flags.chose = 1; newBattle(); persist(); say('进度已清空', PAL.red); } }, { label: '取消', fn: () => { G.dialog = null; } }] };
  }

  // ---------- tickets and side modes ----------
  function tickets(k) {
    const tk = s.tickets[k], cap = ticketCap(s, k), per = MODES[k].regenH * 3600e3, now = Date.now();
    if (tk.n >= cap) { tk.n = cap; tk.t = now; return { n: cap, next: 0 }; }
    const got = Math.floor((now - tk.t) / per);
    if (got > 0) { tk.n = Math.min(cap, tk.n + got); tk.t += got * per; if (tk.n >= cap) tk.t = now; }
    return { n: tk.n, next: tk.n >= cap ? 0 : per - (now - tk.t) };
  }
  function spend(k) { const tk = tickets(k); if (tk.n <= 0) return false; if (s.tickets[k].n >= ticketCap(s, k)) s.tickets[k].t = Date.now(); s.tickets[k].n--; return true; }
  function startMode(k) {
    if (b.mode.kind !== 'main' || !modeOpen(s, k)) return;
    if (k === 'trial') { G.dialog = trialDialog(); return; }
    if (!spend(k)) { Sound.play('nope'); return; }
    if (k === 'mine') b.startMine(); else b.startRush();
    G.sheet = false;
    persist();
  }
  function trialDialog() {
    const sel = new Set(s.trial.sel);
    return {
      title: '突变试炼', w: 300, lines: [{ text: `${DIFFS[topDiff(s)].name}最前线强度，挑战 5 波和一个悬赏首领。勾选突变，每 50% 奖励多一个地域宝箱。`, color: PAL.steel }],
      custom(ctx, x, y, w) {
        MUTATOR_IDS.forEach((k, i) => {
          const M = MUTATORS[k], cx = x + (i % 2) * (w / 2), cy = y + Math.floor(i / 2) * 16;
          if (UI.checkbox('mut' + k, cx, cy, `${M.name} +${pct(M.bonus)}`, sel.has(k), { color: PAL.magenta, tip: M.text })) { if (sel.has(k)) sel.delete(k); else sel.add(k); }
        });
        const bonus = [...sel].reduce((a, k) => a + MUTATORS[k].bonus, 0);
        Text.draw(ctx, `奖励 +${pct(bonus)} · 地域宝箱 ×${1 + Math.floor(bonus * 2)}`, x, y + 52, { color: PAL.yellow });
        return 68;
      },
      buttons: [{ label: '开始', kind: 'gold', fn: () => { if (!spend('trial')) { Sound.play('nope'); return; } s.trial.sel = [...sel]; G.dialog = null; G.sheet = false; b.startTrial([...sel]); persist(); } }, { label: '取消', fn: () => { G.dialog = null; } }],
    };
  }
  function leaveMode() { if (b.mode.kind === 'trial') b.endTrial(false); else if (b.mode.kind !== 'main') b.endMode(); }
  function modeResult(res) {
    let lines;
    if (res.kind === 'mine') lines = [{ text: `采得 ${fmt(res.gold)} 金币`, color: PAL.yellow }];
    else if (res.kind === 'rush') lines = [{ text: `击败了 ${res.n} 个悬赏首领`, color: PAL.cream }, { text: `首领宝箱 +${res.n}`, color: PAL.pink }];
    else if (res.kind === 'trial') lines = res.win ? [{ text: '试炼通过', color: PAL.green }, { text: `地域宝箱 +${res.chests}`, color: PAL.amber }] : [{ text: `止步第 ${res.wave} 波`, color: PAL.red }];
    else lines = [{ text: '已返回主线', color: PAL.cream }];
    G.dialog = { title: MODES[res.kind] ? MODES[res.kind].name : '结算', lines, buttons: [{ label: '好', kind: 'gold', fn: () => { G.dialog = null; } }] };
  }
  function claim(i) { if (Board.claim(s, i, b.ev)) after('buy'); }

  // ---------- hunter look ----------
  const sex = () => (s && s.opts.hero === 'f' ? 'f' : 'm');
  const heroName = () => (sex() === 'f' ? '希娅' : '洛恩');
  function setSex(x) { s.opts.hero = x; s.flags.chose = 1; persist(); }
  function chooseDialog() {
    return {
      title: '选择你的猎人', w: 312,
      custom(ctx, x, y, w) {
        const big = L.H >= 300, ph = big ? 128 : 48;
        const cards = [['m', '洛恩', '宽檐帽下目光如刀'], ['f', '希娅', '笑起来比赏金还亮']];
        cards.forEach(([k, name, line], i) => {
          const cx = x + i * (w / 2), cw = w / 2 - 4, chh = ph + 46;
          const st = UI.hit('pick' + k, cx, y, cw, chh);
          Frame.panel(ctx, cx, y, cw, chh, { fill: st.hover ? PAL.dusk : PAL.night });
          Frame.rarity(ctx, Math.round(cx + cw / 2 - ph / 2 - 2), y + 3, ph + 4, ph + 4, st.hover ? 4 : 3, t);
          const img = big ? Portraits.full(k) : Portraits.face(k);
          if (img) ctx.drawImage(img, Math.round(cx + cw / 2 - ph / 2), y + 5, ph, ph);
          Text.draw(ctx, name, cx + cw / 2, y + ph + 11, { align: 'center', color: st.hover ? PAL.yellow : PAL.white });
          Text.draw(ctx, line, cx + cw / 2, y + ph + 26, { align: 'center', color: PAL.steel });
          if (st.click) { setSex(k); G.dialog = null; Sound.play('fanfare'); }
        });
        return ph + 50;
      },
      buttons: [],
    };
  }
  // the first save of a new account: bring the guest progress along?
  function firstAccountSave() {
    const guest = Cloud.readGuest();
    const deep = guest && guest.v === SAVE_VERSION && (guest.prog?.best?.[0] || 0) >= 1;
    if (!deep) return Promise.resolve();
    return new Promise(res => {
      G.dialog = {
        title: '带入本机进度', lines: [{ text: `这台设备上有猎人 ${guest.hero?.lv || 1} 级的游客进度。`, color: PAL.cream }, { text: '带入这个账号吗？', color: PAL.steel }],
        buttons: [
          { label: '带入', kind: 'gold', fn: () => { G.dialog = null; adopt(normalizeSave(guest), 'import'); res(); } },
          { label: '从零开始', fn: () => { G.dialog = null; const o = s.opts; s = newSave(); s.opts = o; s.flags.chose = 1; newBattle(); res(); } },
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
        adopt(normalizeSave(data), 'import'); say('存档已导入', PAL.green); return true;
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
  // compact mode, sheet folded: the chest tray and the hunter at a glance + a grid that opens each panel
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
    // chest tray card
    const ch = Math.min(76, D.h - 6), tw = Math.min(196, gx - 112);
    const counts = [0, 0, 0]; for (const c of s.tray) counts[c.k]++;
    Frame.panel(ctx, 3, D.y + 3, tw, ch, { fill: s.tray.length ? '#2c3150' : PAL.ink, hi: PAL.dusk });
    Text.draw(ctx, `宝箱 ${s.tray.length}/${traySize(s)}`, 8, D.y + 5, { color: s.tray.length >= traySize(s) ? PAL.red : PAL.amber });
    const cwid = Math.floor((tw - 10) / 3);
    CHESTS.forEach((C, k) => { const x = 6 + k * cwid + cwid / 2; Spr.draw(ctx, Spr.get('chest', 0, String(k)), x - 10, D.y + 30); Text.draw(ctx, '×' + counts[k], x + 1, D.y + 21, { color: counts[k] ? PAL.white : PAL.slate }); });
    if (ch >= 60 && UI.button('dockopen', 6, D.y + ch - 18, tw - 6, 16, '全部打开', { kind: 'gold', disabled: !s.tray.length, sound: 'open' })) { const r = openAll(); if (r) { Panels.UI_ST.gear.view = 'chest'; Panels.UI_ST.gear.res = r; openTab('gear'); } }
    // the hunter card: level, experience, free points, power
    const hx = tw + 7, hw = gx - hx - 4;
    if (hw > 90) {
      Frame.panel(ctx, hx, D.y + 3, hw, ch, { fill: PAL.ink, hi: PAL.dusk });
      Text.draw(ctx, `${heroName()} Lv.${s.hero.lv}`, hx + 5, D.y + 5, { color: PAL.white });
      Frame.bar(ctx, hx + 5, D.y + 20, hw - 10, 4, s.hero.lv >= HERO.maxLevel ? 1 : s.hero.exp / expNeed(s.hero.lv), PAL.cyan);
      Text.draw(ctx, `战力 ${fmt(power())}`, hx + 5, D.y + 27, { color: PAL.yellow });
      const free = skillFree(s);
      if (ch >= 60 && UI.button('dockskill', hx + 3, D.y + ch - 18, hw - 6, 16, free ? `技能点 ${free}` : `${DIFFS[s.prog.d].name} ${s.prog.a}-${s.prog.s}`, { kind: free ? 'green' : 'plain' })) openTab(free ? 'skill' : 'map');
    }
  }
  function drawSheetHead(ctx) {
    const H = L.head;
    ctx.fillStyle = PAL.ink; ctx.fillRect(H.x, H.y, H.w, H.h);
    drawTabs(ctx);
    if (UI.button('fold', H.w - 48, H.y + 2, 46, H.h - 4, '收起', { icon: 'i_down', kind: 'blue', tip: ['收起面板，回到战斗画面'] })) { G.sheet = false; Sound.play('tab'); }
  }
  function dot(id) {
    if (id === 'gear') return !!G.badge.gear || s.tray.length >= traySize(s) * 0.8;
    if (id === 'skill') return skillFree(s) > 0 && SKILL_IDS.some(x => Skills.canRaise(s, x) && (SKILLS[x].fam === famOf(s) || SKILLS[x].fam === 'any'));
    if (id === 'rune') return RUNE_NODES.some(n => (s.runes[n.id] || 0) < n.max && runeOpen(s, n) && s.gold >= runeCost(n, s.runes[n.id] || 0) * 2);
    if (id === 'hunt') return s.board.list.some(c => c.done && !c.claimed);
    if (id === 'cube') return GRADES.some((g, i) => i < GRADE_MAX && Loot.synthOk(s, i) && i >= 1);
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
    const boss = b.boss && !b.boss.dead && b.phase !== 'march';
    Sound.setMusic(b.mode.kind === 'mine' ? 'mine' : boss || b.mode.kind === 'rush' ? 'boss' : ACTS[b.where.a - 1].id);
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
    if (!s.flags.chose) G.dialog = chooseDialog();
    const rep = settleOffline(false);
    newBattle();
    if (rep && s.flags.chose) G.dialog = offlineDialog(rep);
    if (s.flags.v1 && !s.flags.v2seen) { s.flags.v2seen = 1; if (s.flags.chose) G.dialog = { title: '悬赏怪物猎人 2.0', lines: [{ text: '世界扩展成 4 个难度 × 9 个地域 × 10 关，装备、宝箱、魔方和符文树全部重做。', color: PAL.cream }, { text: '猎人的外观保留，旅程从普通 1-1 重新开始。', color: PAL.steel }], buttons: [{ label: '出发', kind: 'gold', fn: () => { G.dialog = null; } }] }; }
    resize();
    ready = true;
    persist();
    document.getElementById('boot')?.remove();
    requestAnimationFrame(frame);
    if (/[?&]debug\b/.test(location.search)) window.__tbmh = { get s() { return s; }, get b() { return b; }, G, advance, render: () => render(0), settleOffline };
  }

  Object.assign(G, {
    boot, persist, say, adopt, applyOpts, equip, unequip, autoEquip, sortInv, alchOne, alchFiltered, alchMat, openKind, openAll, enhance,
    synth, craft, socket, unsocket, offer, reroll, runeBuy, skillRaise, skillLower, skillReset, skillAuto, skillSlot, skillUnslot,
    setFarm, travel, setPet, askReset, tickets, startMode, leaveMode, claim, sex, heroName, setSex, firstAccountSave, exportSave, importSave,
    toggleMute, toggleMini, toggleFull, openTab, S, power, battle: () => b, save: () => s,
  });
  Object.defineProperties(G, { ready: { get: () => ready }, layout: { get: () => L } });
  return G;
})();
Game.boot();
