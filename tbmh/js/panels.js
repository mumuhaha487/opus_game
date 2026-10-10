'use strict';
// =====================================================================
//  PANELS — the eight tabs under the battle strip. Every layout is
//  computed from the panel rect, so desktop, sideways phones and
//  upright phones share one code path.
// =====================================================================
const TABS = [
  { id: 'gear', name: '装备', icon: 'i_atk' },
  { id: 'skill', name: '技能', icon: 'i_cdmg' },
  { id: 'cube', name: '魔方', icon: 'i_cube' },
  { id: 'rune', name: '符文', icon: 'i_tree' },
  { id: 'map', name: '地图', icon: 'i_map' },
  { id: 'hunt', name: '悬赏', icon: 'i_board' },
  { id: 'codex', name: '图鉴', icon: 'i_book' },
  { id: 'set', name: '设置', icon: 'i_gear' },
];
const Panels = (() => {
  const T = (ctx, s, x, y, o) => Text.draw(ctx, s, x, y, o);
  const icon = (ctx, name, x, y, alpha = 1) => { const img = typeof name === 'string' ? Spr.get(name) : name; ctx.globalAlpha = alpha; ctx.drawImage(img, Math.round(x), Math.round(y)); ctx.globalAlpha = 1; return img; };
  const money = (ctx, v, x, y, ok = true) => { icon(ctx, 'i_gold', x, y + 1, ok ? 1 : 0.5); return 13 + T(ctx, fmt(v), x + 13, y, { color: ok ? PAL.yellow : PAL.slate }); };
  // a row of small chips; returns the picked id (or null)
  function chips(id, x, y, list, cur, o = {}) {
    let cx = x, picked = null;
    for (const c of list) {
      const w = c.w || Text.width(c.name) + 12;
      if (UI.toggle(id + c.id, cx, y, w, o.h || 15, c.name, cur === c.id, { kindOn: c.kind || 'blue', disabled: c.locked, tip: c.tip, color: c.color })) picked = c.id;
      cx += w + 2;
    }
    return picked;
  }
  const matIcon = id => {
    const M = MATS[id];
    if (M.kind === 'gem') return Spr.get('i_gem', 0, M.gem);
    if (M.kind === 'part') { const L = ART.PART_LOOK[M.part]; return Spr.get(L[0], 0, M.part); }
    if (M.kind === 'scroll') return Spr.icon('i_scroll', M.grade);
    if (M.kind === 'ore') return id === 'chaos' ? Spr.get('i_chaos') : Spr.get('i_ore', 0, String(M.tier));
    if (M.kind === 'coin') return Spr.icon('i_coin', M.grade);
    return Spr.get('i_wanted', 0, String(M.diff));
  };
  const matTip = id => {
    const M = MATS[id], lines = [{ text: M.name, color: GRADES[M.grade || 0].color }, { text: `${GRADES[M.grade || 0].name} · ${{ gem: '宝石', part: '怪物素材', scroll: '铭文卷轴', ore: '锻造材料', coin: '纪念币', wanted: '通缉令' }[M.kind]}`, color: PAL.steel }];
    if (M.kind === 'gem') { const st = gemStats(M.gem, M.grade); for (const k in st) lines.push({ text: '镶嵌：' + statText(k, st[k]), color: PAL.green }); }
    if (M.kind === 'part') lines.push({ text: '铭刻：' + statText(M.stat, partValue(M.stat, M.grade)), color: PAL.green });
    if (M.kind === 'scroll') lines.push({ text: '铭文：随机写入一条强力铭文', color: PAL.green });
    if (M.kind === 'ore') lines.push({ text: id === 'chaos' ? '重铸装备词条' : '制作装备、部位强化', color: PAL.green });
    if (M.kind === 'coin') lines.push({ text: `供奉：换一件${GRADES[M.grade].name}装备`, color: PAL.green });
    if (M.kind === 'wanted') lines.push({ text: '再次挑战已击败的悬赏首领，打赢才消耗', color: PAL.green });
    return lines;
  };
  function matCell(ctx, id, n, x, y, t, o = {}) {
    const st = UI.hit('mat' + (o.key || '') + id, x, y, 22, 22);
    Frame.rarity(ctx, x, y, 22, 22, Math.min(9, MATS[id].grade || 0), t);
    const img = matIcon(id);
    ctx.drawImage(img, Math.round(x + 11 - img.width / 2), Math.round(y + 11 - img.height / 2));
    if (n !== undefined) T(ctx, n > 999 ? fmt(n) : String(n), x + 21, y + 13, { size: 8, align: 'right', color: PAL.white, outline: PAL.ink });
    if (o.sel) { ctx.fillStyle = PAL.white; Frame.ring(ctx, x - 1, y - 1, 24, 24); }
    if (st.hover) UI.setTip(matTip(id));
    return st;
  }

  // ---------------- items ----------------
  const UI_ST = { gear: { view: 'bag', sel: null, slot: null, res: null }, skill: { fam: null, sel: null }, cube: { fn: 'synth', type: 'sword', tier: 0, slot: 'main', key: 'sd', mat: null, grades: [true, true, false, false, false, false, false, false, false, false] }, rune: { ox: 0, oy: 0, sel: 'heart', drag: null }, map: { d: null, sel: null }, codex: { view: 'mob' } };
  function itemCell(ctx, id, it, x, y, t, o = {}) {
    const st = UI.hit(id, x, y, 22, 22);
    if (!it) { Frame.panel(ctx, x, y, 22, 22, { fill: PAL.ink, hi: PAL.night }); if (o.ph) icon(ctx, o.ph, x + 3, y + 3, 0.25); if (o.sel) { ctx.fillStyle = PAL.white; Frame.ring(ctx, x - 1, y - 1, 24, 24); } return st; }
    Frame.rarity(ctx, x, y, 22, 22, it.g, t);
    const img = Spr.item(it);
    ctx.drawImage(img, Math.round(x + 11 - img.width / 2), Math.round(y + 11 - img.height / 2));
    if (it.k) icon(ctx, 'i_lock', x + 13, y + 1);
    if (o.sel) { ctx.fillStyle = PAL.white; Frame.ring(ctx, x - 1, y - 1, 24, 24); }
    if (o.up) icon(ctx, 'i_up', x + 13, y + 12);
    if (st.hover) { ctx.fillStyle = rgba(PAL.white, 0.15); ctx.fillRect(x + 2, y + 2, 18, 18); }
    return st;
  }
  const MAIN_NAME = { atk: '攻击', hp: '生命', arm: '护甲' };
  function itemLines(it, s, o = {}) {
    const Tp = TYPES[it.t], G = GRADES[it.g], slot = Tp.slot, fam = famOf(s);
    const res = slot === 'off' && Tp.fam === fam;
    const main = itemMain(it, s.enh[slot], res);
    const lines = [{ text: Loot.name(it), color: G.color }, { text: `${G.name} · ${Loot.typeLabel(it)} · 等级 ${it.l}`, color: PAL.steel }];
    for (const k in main) lines.push({ text: MAIN_NAME[k] ? `${MAIN_NAME[k]} +${fmt(main[k])}` : statText(k, main[k]), color: PAL.white });
    if (s.enh[slot]) lines.push({ text: `${SLOT_NAME[slot]}强化 +${s.enh[slot]}`, color: PAL.cyan });
    if (res) lines.push({ text: `流派共鸣：副手主属性 +25%`, color: PAL.cyan });
    if (Tp.impText) lines.push({ text: (slot === 'main' ? '流派：' : '同流派：') + Tp.impText, color: slot === 'main' || res ? PAL.tan : PAL.slate, wrap: 230 });
    for (const [k, v] of it.s) lines.push({ text: '· ' + statText(k, v), color: PAL.green });
    for (const id of it.sd) lines.push(id ? { text: `◆ ${MATS[id].name}：${Object.entries(gemStats(MATS[id].gem, MATS[id].grade)).map(([k, v]) => statText(k, v)).join('，')}`, color: GEM_KINDS[MATS[id].gem].color } : { text: '◇ 空宝石孔', color: PAL.slate });
    for (const id of it.se) lines.push(id ? { text: `▲ ${MATS[id].name}：${statText(MATS[id].stat, partValue(MATS[id].stat, MATS[id].grade))}`, color: PAL.pink } : { text: '△ 空铭刻孔', color: PAL.slate });
    for (const x of it.si) lines.push(x ? { text: `■ ${INSCRIPTIONS[x[0]].name}：${statText(x[0], x[1])}`, color: PAL.yellow } : { text: '□ 空铭文孔', color: PAL.slate });
    if (it.lg) {
      const L = LEGENDS[it.lg], on = !L.fam || L.fam === fam;
      lines.push({ text: `「${L.name}」${L.text}${it.g >= 6 ? '（效果 ×1.5）' : ''}`, color: on ? PAL.amber : PAL.slate, wrap: 230 });
      if (!on) lines.push({ text: `需要${FAMS[L.fam].name}流派`, color: PAL.red });
    }
    if (!o.equipped) {
      const g = Loot.gain(s, it);
      lines.push({ text: `换上后战力 ${g >= 0 ? '+' : ''}${(g * 100).toFixed(1)}%`, color: g > 0.0005 ? PAL.green : g < -0.0005 ? PAL.red : PAL.steel });
      lines.push({ text: `炼金得 ${fmt(Loot.alchOf(it, Game.S()).gold)} 金币`, color: PAL.yellow });
    }
    return lines;
  }

  // ---------------- 装备 ----------------
  const DOLL = [['head', 'neck', 'ear'], ['main', 'chest', 'off'], ['hands', 'ring', 'wrist'], ['feet', 'medal', null]];
  const SLOT_ICON = { main: 'w_sword', off: 'o_shield', head: 'a_helm', chest: 'a_chest', hands: 'a_gloves', feet: 'a_boots', neck: 'c_amulet', ear: 'c_earring', ring: 'c_ring', wrist: 'c_bracer', medal: 'm_hunter' };
  function gear(ctx, R, s, t) {
    const S = Game.S(), wide = R.w >= 500, U = UI_ST.gear;
    const cardW = wide ? 186 : R.w - 8;
    const detW = wide ? Math.max(132, Math.min(176, R.w - cardW - 230)) : R.w - 8;
    const L = wide
      ? { card: { x: R.x + 4, y: R.y + 4, w: cardW, h: R.h - 8 }, bag: { x: R.x + cardW + 8, y: R.y + 4, w: R.w - cardW - detW - 16, h: R.h - 8 }, det: { x: R.x + R.w - detW - 4, y: R.y + 4, w: detW, h: R.h - 8 } }
      : { card: { x: R.x + 4, y: R.y + 4, w: cardW, h: 126 }, bag: { x: R.x + 4, y: R.y + 134, w: R.w - 8, h: Math.max(120, R.h - 134 - 140) }, det: { x: R.x + 4, y: R.y + R.h - 136, w: R.w - 8, h: 132 } };
    // ---- the hunter card: portrait, numbers, the eleven slots ----
    const C = L.card;
    Frame.panel(ctx, C.x, C.y, C.w, C.h);
    const small = C.h < 170 && wide;
    const fs = small ? 32 : 48;
    Frame.rarity(ctx, C.x + 4, C.y + 4, fs + 4, fs + 4, 4, t);
    const face = small ? Portraits.mini(Game.sex()) : Portraits.face(Game.sex());
    if (face) ctx.drawImage(face, C.x + 6, C.y + 6, fs, fs);
    const tx = C.x + fs + 12;
    T(ctx, Game.heroName(), tx, C.y + 4, { color: PAL.white });
    T(ctx, `Lv.${s.hero.lv} · ${FAMS[S.fam].name}`, tx + Text.width(Game.heroName()) + 6, C.y + 4, { color: PAL.cyan });
    T(ctx, '战力', tx, C.y + 19, { color: PAL.amber });
    T(ctx, fmt(Game.power()), tx + 28, C.y + 19, { color: PAL.yellow });
    if (!small) Frame.bar(ctx, tx, C.y + 36, C.w - fs - 18, 4, s.hero.lv >= HERO.maxLevel ? 1 : s.hero.exp / expNeed(s.hero.lv), PAL.cyan);
    const stats = [['攻击', fmt(S.atk)], ['生命', fmt(S.maxHp)], ['攻速', S.aspd.toFixed(2)], ['暴击', pct(S.crit, 1)], ['爆伤', pct(S.cdmg)], ['护甲', fmt(S.arm)], ['技能', pct(S.skill - 1)], ['格挡', pct(S.block)]];
    const statTop = C.y + fs + 10, rowsShown = wide ? (C.h >= 180 ? 3 : 2) : 4, sw = wide ? (C.w - 10) / 2 : (C.w - 6 * 24 - 20) / 2;
    stats.slice(0, rowsShown * 2).forEach(([k, v], i) => {
      const sx = C.x + 6 + (i % 2) * sw, sy = statTop + Math.floor(i / 2) * 13;
      T(ctx, k, sx, sy, { color: PAL.steel }); T(ctx, v, sx + sw - 8, sy, { color: PAL.cream, align: 'right' });
    });
    if (UI.over(C.x, statTop, sw * 2, rowsShown * 13)) UI.setTip(statSheet(S, s));
    // slots
    const cell = 24, gx = wide ? C.x + Math.round((C.w - 6 * cell) / 2) : C.x + C.w - 6 * cell - 6, gy = wide ? C.y + C.h - 2 * cell - 4 : C.y + C.h - 2 * cell - 6;
    const order = ['head', 'neck', 'ear', 'main', 'chest', 'off', 'hands', 'ring', 'wrist', 'feet', 'medal'];
    order.forEach((slot, i) => {
      const x = gx + (i % 6) * cell, y = gy + Math.floor(i / 6) * cell, it = s.eq[slot];
      const st = itemCell(ctx, 'eq' + slot, it, x, y, t, { sel: U.slot === slot, ph: SLOT_ICON[slot] });
      if (s.enh[slot]) T(ctx, '+' + s.enh[slot], x + 22, y + 13, { size: 8, align: 'right', color: PAL.cyan, outline: PAL.ink });
      if (st.click) { U.slot = slot; U.sel = null; Sound.play('click'); }
      if (st.hover) UI.setTip(it ? itemLines(it, s, { equipped: true }) : [SLOT_NAME[slot] + '（空）']);
    });
    // ---- bag / materials / chests ----
    const V = L.bag;
    Frame.panel(ctx, V.x, V.y, V.w, V.h);
    const pick = chips('gv', V.x + 4, V.y + 3, [{ id: 'bag', name: `背包 ${s.inv.length}/${bagSize(s)}` }, { id: 'mat', name: '材料' }, { id: 'chest', name: `宝箱 ${s.tray.length}`, kind: s.tray.length ? 'gold' : 'blue' }], U.view);
    if (pick) { U.view = pick; UI.resetScroll('inv'); }
    const top = V.y + 21, h = V.h - 24;
    if (U.view === 'bag') bagGrid(ctx, V, top, h, s, t, S);
    else if (U.view === 'mat') matGrid(ctx, V, top, h, s, t);
    else chestTray(ctx, V, top, h, s, t);
    // ---- details ----
    const D = L.det;
    Frame.panel(ctx, D.x, D.y, D.w, D.h);
    const selIt = U.sel !== null ? s.inv.find(x => x.u === U.sel) : null;
    if (U.res && U.view === 'chest') openResult(ctx, D, s, t);
    else if (U.slot) detailSlot(ctx, D, s, t, U.slot);
    else if (selIt) detailItem(ctx, D, s, t, selIt);
    else if (U.mat) detailMat(ctx, D, s, t, U.mat);
    else {
      T(ctx, '选中装备或材料', D.x + D.w / 2, D.y + D.h / 2 - 14, { align: 'center', color: PAL.slate });
      T(ctx, '查看详情与操作', D.x + D.w / 2, D.y + D.h / 2, { align: 'center', color: PAL.slate });
    }
  }
  function statSheet(S, s) {
    const el = ELEMENTS.filter(e => S.el[e] > 1.001).map(e => `${ELEM[e].name} +${pct(S.el[e] - 1)}`).join(' ');
    return [{ text: '猎人属性', color: PAL.amber },
      `攻击 ${fmt(S.atk)} · 生命 ${fmt(S.maxHp)} · 护甲 ${fmt(S.arm)}`,
      `攻速 ${S.aspd.toFixed(2)}/秒 · 暴击 ${pct(S.crit, 1)} · 爆伤 ${pct(S.cdmg)}`,
      `全伤害 +${pct(S.dmg - 1)} · 技能 +${pct(S.skill - 1)} · 首领 +${pct(S.boss - 1)} · 精英 +${pct(S.elite - 1)}`,
      `攻击元素 ${ELEM[S.elem].name}${el ? ' · ' + el : ''}`,
      `吸血 ${pct(S.ls, 1)} · 回复 ${pct(S.regen, 2)}/秒 · 荆棘 ${pct(S.thorns)} · 格挡 ${pct(S.block)}`,
      `冷却缩减 ${pct(S.cdr)} · 护甲穿透 ${pct(S.pen)}`,
      `金币 +${pct(S.gold - 1)} · 经验 +${pct(S.exp - 1)} · 宝箱 +${pct(S.chest - 1)}`];
  }
  function bagGrid(ctx, V, top, h, s, t, S) {
    const U = UI_ST.gear, foot = 34, cols = Math.max(4, Math.floor((V.w - 10) / 23)), gh = h - foot;
    const ups = new Set(s.inv.filter(it => Loot.isUpgrade(s, it, S)).map(it => it.u));
    const n = bagSize(s);
    UI.scroll('inv', V.x + 3, top, V.w - 6, gh, Math.ceil(n / cols) * 23, oy => {
      for (let i = 0; i < n; i++) {
        const x = V.x + 5 + (i % cols) * 23, y = top - oy + Math.floor(i / cols) * 23, it = s.inv[i];
        if (y > top + gh || y + 22 < top) continue;
        const st = itemCell(ctx, 'inv' + (it ? it.u : 'e' + i), it, x, y, t, { sel: it && U.sel === it.u, up: it && ups.has(it.u) });
        if (it && st.click) { U.sel = U.sel === it.u ? null : it.u; U.slot = null; U.mat = null; }
        if (it && st.hover) UI.setTip(itemLines(it, s));
      }
    });
    const fy = top + gh + 3;
    ctx.fillStyle = PAL.dusk; ctx.fillRect(V.x + 4, fy - 2, V.w - 8, 1);
    const bw = Math.floor((V.w - 16) / 3);
    if (UI.button('autoeq', V.x + 4, fy, bw, 14, '换装', { tip: '每个部位换上战力最高的装备' })) Game.autoEquip();
    if (UI.button('sortinv', V.x + 8 + bw, fy, bw, 14, '整理')) Game.sortInv();
    if (UI.button('alchall', V.x + 12 + bw * 2, fy, bw, 14, '炼金', { kind: 'gold', tip: ['把背包里勾选品质、未锁定、不比身上强的装备炼成金币', '勾选在下面一行'] })) Game.alchFiltered();
    let gx = V.x + 4;
    const gyy = fy + 16;
    for (let g = 0; g < Math.min(6, GRADES.length); g++) {
      const st = UI.hit('ag' + g, gx, gyy, 14, 12);
      ctx.fillStyle = PAL.ink; ctx.fillRect(gx, gyy + 1, 12, 10);
      ctx.fillStyle = UI_ST.cube.grades[g] ? GRADES[g].color : PAL.night; ctx.fillRect(gx + 1, gyy + 2, 10, 8);
      if (st.click) UI_ST.cube.grades[g] = !UI_ST.cube.grades[g];
      if (st.hover) UI.setTip([`${GRADES[g].name}：${UI_ST.cube.grades[g] ? '炼金时包含' : '炼金时跳过'}`]);
      gx += 14;
    }
    if (UI.checkbox('keepup', gx + 6, gyy, '保留战力提升', s.keepUp, { tip: '比身上更强的装备不会被炼金' })) s.keepUp = !s.keepUp;
  }
  function matGrid(ctx, V, top, h, s, t) {
    const U = UI_ST.gear, ids = MAT_IDS.filter(id => s.mats[id] > 0);
    const cols = Math.max(4, Math.floor((V.w - 10) / 23));
    if (!ids.length) { T(ctx, '打开宝箱获得宝石、怪物素材、矿石与通缉令', V.x + V.w / 2, top + 30, { align: 'center', color: PAL.slate }); return; }
    UI.scroll('inv', V.x + 3, top, V.w - 6, h, Math.ceil(ids.length / cols) * 23, oy => {
      ids.forEach((id, i) => {
        const x = V.x + 5 + (i % cols) * 23, y = top - oy + Math.floor(i / cols) * 23;
        if (y > top + h || y + 22 < top) return;
        const st = matCell(ctx, id, s.mats[id], x, y, t, { sel: U.mat === id });
        if (st.click) { U.mat = U.mat === id ? null : id; U.sel = null; U.slot = null; }
      });
    });
  }
  function chestTray(ctx, V, top, h, s, t) {
    const U = UI_ST.gear, cap = traySize(s);
    const counts = [0, 0, 0];
    for (const c of s.tray) counts[c.k]++;
    T(ctx, `托盘 ${s.tray.length}/${cap}`, V.x + 6, top + 1, { color: s.tray.length >= cap ? PAL.red : PAL.steel });
    if (UI.button('openall', V.x + V.w - 74, top - 1, 70, 15, '全部打开', { kind: 'gold', disabled: !s.tray.length, sound: 'open' })) U.res = Game.openAll();
    const cw = Math.min(110, Math.floor((V.w - 16) / 3));
    CHESTS.forEach((C, k) => {
      const x = V.x + 6 + k * (cw + 3), y = top + 18, ch = Math.min(h - 22, 92);
      Frame.panel(ctx, x, y, cw, ch, { fill: counts[k] ? '#2c3150' : PAL.ink });
      const img = Spr.get('chest', counts[k] ? Math.floor(t * 1.5) % 2 === 0 ? 0 : 0 : 0, String(k));
      Spr.draw(ctx, img, x + cw / 2, y + 30 + (counts[k] && Math.floor(t * 3 + k) % 4 === 0 ? -1 : 0));
      T(ctx, C.name, x + cw / 2, y + 34, { align: 'center', color: [PAL.cream, PAL.pink, PAL.amber][k] });
      T(ctx, '×' + counts[k], x + cw / 2, y + 48, { align: 'center', color: counts[k] ? PAL.white : PAL.slate });
      if (ch >= 84 && UI.button('open' + k, x + 4, y + ch - 20, cw - 8, 16, '打开', { kind: 'green', disabled: !counts[k], sound: 'open' })) U.res = Game.openKind(k);
      if (UI.hit('chtip' + k, x, y, cw, 46).hover) UI.setTip([{ text: C.name, color: PAL.amber }, `${C.items} 件装备${C.floor ? `（${GRADES[C.floor].name}起）` : ''}`, `材料 ${C.mats[0] < 1 ? '50% 几率 1' : C.mats.join('–')} 份`, C.wanted ? `${pct(C.wanted)} 几率通缉令` : '', C.coin ? `${pct(C.coin)} 几率纪念币` : ''].filter(Boolean));
    });
    const auto = [Game.S().autoN ? '怪物' : '', Game.S().autoB ? '首领、地域' : ''].filter(Boolean).join('、');
    T(ctx, auto ? '自动开箱：' + auto : '符文树可解锁自动开箱', V.x + 6, V.y + V.h - 15, { color: auto ? PAL.green : PAL.slate });
  }
  function openResult(ctx, D, s, t) {
    const res = UI_ST.gear.res;
    T(ctx, `开箱 ${res.n} 个`, D.x + 6, D.y + 4, { color: PAL.amber });
    money(ctx, res.gold, D.x + D.w - 6 - Text.width(fmt(res.gold)) - 13, D.y + 4);
    const cols = Math.floor((D.w - 10) / 23);
    const shown = res.items.slice(0, cols * 3);
    shown.forEach((x, i) => {
      const cx = D.x + 5 + (i % cols) * 23, cy = D.y + 20 + Math.floor(i / cols) * 23;
      const st = itemCell(ctx, 'res' + i, x.it, cx, cy, t);
      if (!x.kept) { ctx.fillStyle = rgba(PAL.ink, 0.55); ctx.fillRect(cx + 1, cy + 1, 20, 20); }
      if (st.hover) UI.setTip([...itemLines(x.it, s, { equipped: true }), x.kept ? { text: '已放入背包', color: PAL.green } : { text: '已自动炼金', color: PAL.yellow }]);
    });
    const my = D.y + 20 + Math.ceil(shown.length / cols) * 23 + 2;
    const mats = Object.entries(res.mats).slice(0, cols);
    mats.forEach(([id, n], i) => matCell(ctx, id, n, D.x + 5 + i * 23, my, t, { key: 'r' }));
    if (UI.button('resok', D.x + 4, D.y + D.h - 20, D.w - 8, 16, '好', { kind: 'blue' })) UI_ST.gear.res = null;
  }
  function detailItem(ctx, D, s, t, it) {
    const G = GRADES[it.g];
    Frame.rarity(ctx, D.x + 5, D.y + 5, 22, 22, it.g, t);
    const img = Spr.item(it); ctx.drawImage(img, D.x + 16 - (img.width >> 1), D.y + 16 - (img.height >> 1));
    T(ctx, Loot.name(it), D.x + 31, D.y + 4, { color: G.color });
    T(ctx, `${G.name} · ${Loot.typeLabel(it)} · ${it.l}级`, D.x + 31, D.y + 17, { color: PAL.steel });
    const lines = itemLines(it, s).slice(2);
    let y = D.y + 31;
    const maxY = D.y + D.h - 24;
    for (const l of lines) for (const w of Text.wrap(l.text, D.w - 12)) { if (y > maxY - 12) break; T(ctx, w, D.x + 6, y, { color: l.color }); y += 12; }
    const by = D.y + D.h - 20, bw = Math.floor((D.w - 14) / 3);
    if (UI.button('equip', D.x + 4, by, bw, 16, '装备', { kind: 'green', sound: 'equip' })) Game.equip(it.u);
    if (UI.button('lock', D.x + 7 + bw, by, bw, 16, it.k ? '解锁' : '锁定')) { if (it.k) delete it.k; else it.k = 1; }
    if (UI.button('alch1', D.x + 10 + bw * 2, by, bw, 16, '炼金', { kind: 'gold', disabled: !!it.k, tip: `得到 ${fmt(Loot.alchOf(it, Game.S()).gold)} 金币与魔方经验` })) Game.alchOne(it.u);
  }
  function detailMat(ctx, D, s, t, id) {
    const n = s.mats[id] || 0;
    if (!n) { UI_ST.gear.mat = null; return; }
    matCell(ctx, id, n, D.x + 5, D.y + 5, t, { key: 'd' });
    T(ctx, MATS[id].name, D.x + 31, D.y + 4, { color: GRADES[MATS[id].grade || 0].color });
    T(ctx, `拥有 ${fmt(n)}`, D.x + 31, D.y + 17, { color: PAL.steel });
    let y = D.y + 31;
    for (const l of matTip(id).slice(2)) for (const w of Text.wrap(l.text, D.w - 12)) { T(ctx, w, D.x + 6, y, { color: l.color }); y += 12; }
    if (MATS[id].kind === 'wanted') return;
    const v = Loot.matValue(id) * Game.S().alchGold, by = D.y + D.h - 20, bw = Math.floor((D.w - 11) / 2);
    T(ctx, `炼金 ${fmt(v)} 金币/个`, D.x + 6, by - 15, { color: PAL.yellow });
    if (UI.button('am1', D.x + 4, by, bw, 16, '炼金 1 个', { kind: 'gold' })) Game.alchMat(id, 1);
    if (UI.button('amall', D.x + 7 + bw, by, bw, 16, '全部炼金', { kind: 'gold' })) Game.alchMat(id, n);
  }
  function detailSlot(ctx, D, s, t, slot) {
    const it = s.eq[slot], lvl = s.enh[slot];
    T(ctx, SLOT_NAME[slot], D.x + 6, D.y + 4, { color: PAL.amber });
    T(ctx, '强化 +' + lvl, D.x + D.w - 6, D.y + 4, { color: PAL.cyan, align: 'right' });
    let y = D.y + 19;
    if (it) {
      const lines = itemLines(it, s, { equipped: true });
      for (const l of lines) for (const w of Text.wrap(l.text, D.w - 12)) { if (y > D.y + D.h - 58) break; T(ctx, w, D.x + 6, y, { color: l.color }); y += 12; }
    } else T(ctx, '空着。背包里选一件装备点「装备」', D.x + 6, y, { color: PAL.slate });
    const by = D.y + D.h - 38;
    if (lvl < ENH_MAX) {
      const c = enhCost(lvl), ore = Loot.enhOre(s, lvl), can = s.gold >= c.gold && !!ore;
      if (UI.button('enh', D.x + 4, by, D.w - 8, 16, '', { kind: 'blue', disabled: !can, sound: 'forge', tip: [`强化 +${lvl} → +${lvl + 1}：主属性 +${ENH_BONUS * 100}%`, '强化绑定部位，换装备不丢失', `需要 ${fmt(c.gold)} 金币 + ${MATS['ore_' + c.ore].name}（或更高级矿石）×${c.oreN}`] })) Game.enhance(slot);
      let x = D.x + 10;
      x += money(ctx, c.gold, x, by + 2, s.gold >= c.gold) + 6;
      const oid = ore || 'ore_' + c.ore, img = matIcon(oid);
      ctx.globalAlpha = ore ? 1 : 0.45; ctx.drawImage(img, x, by + 2, 12, 10); ctx.globalAlpha = 1;
      T(ctx, '×' + c.oreN, x + 14, by + 2, { color: ore ? PAL.white : PAL.slate });
    } else T(ctx, '已强化到上限', D.x + D.w / 2, by + 2, { align: 'center', color: PAL.amber });
    if (it && slot !== 'main' && UI.button('uneq', D.x + 4, D.y + D.h - 20, D.w - 8, 16, '卸下', { disabled: s.inv.length >= bagSize(s) })) Game.unequip(slot);
  }

  // ---------------- 技能 ----------------
  function skills(ctx, R, s, t) {
    const U = UI_ST.skill, S = Game.S(), wide = R.w >= 500;
    const fam = U.fam || famOf(s);
    const free = skillFree(s);
    // header: points, respec, auto plan
    T(ctx, '技能点', R.x + 8, R.y + 5, { color: PAL.steel });
    T(ctx, `${free} / ${skillPoints(s)}`, R.x + 52, R.y + 5, { color: free ? PAL.yellow : PAL.cream });
    if (UI.button('skreset', R.x + 100, R.y + 3, 44, 15, '洗点', { tip: '免费退回全部技能点' })) Game.skillReset();
    if (UI.checkbox('skauto', R.x + 150, R.y + 4, '自动加点', !!s.opts.autoSkill, { tip: ['升级时自动给当前流派的技能加点', '换武器流派时自动洗点重配'] })) { s.opts.autoSkill = s.opts.autoSkill ? 0 : 1; if (s.opts.autoSkill) Game.skillAuto(); }
    // skill slots
    const nSlots = S.skillSlots;
    const sx0 = R.x + R.w - 4 * 30 - 6;
    for (let i = 0; i < 4; i++) {
      const x = sx0 + i * 30, y = R.y + 2, id = s.skills.slots[i], locked = i >= nSlots;
      const st = UI.hit('ss' + i, x, y, 26, 26, { disabled: locked });
      Frame.rarity(ctx, x, y, 26, 26, locked ? 0 : id ? (skillUsable(s, id) ? 2 : 0) : 0, t);
      if (locked) icon(ctx, 'i_lock', x + 8, y + 8);
      else if (id) { ctx.globalAlpha = skillUsable(s, id) ? 1 : 0.35; ctx.drawImage(Spr.get(SKILLS[id].icon), x + 5, y + 5); ctx.globalAlpha = 1; T(ctx, String(skillLevel(s, id)), x + 25, y + 16, { size: 8, color: PAL.yellow, align: 'right', outline: PAL.ink }); }
      if (st.click) { if (U.sel && !SKILLS[U.sel].passive && s.skills.lv[U.sel]) Game.skillSlot(U.sel, i); else if (id) Game.skillUnslot(i); }
      if (st.hover) UI.setTip(locked ? [`第 ${i + 1} 技能槽`, { text: '符文树「觉醒」方向解锁', color: PAL.red }] : id ? [...skillTip(id, s), { text: '点击卸下', color: PAL.steel }] : ['空技能槽：选中一个已加点的主动技能，再点这里']);
    }
    // family chips
    const famList = [...FAM_IDS.map(f => ({ id: f, name: FAMS[f].name, color: f === famOf(s) ? PAL.yellow : undefined })), { id: 'any', name: '通用' }];
    const pick = chips('fam', R.x + 6, R.y + 30, famList, fam, { h: 15 });
    if (pick) { U.fam = pick; U.sel = null; }
    // skill cards
    const list = SKILL_IDS.filter(id => SKILLS[id].fam === fam);
    const listW = wide ? Math.floor(R.w * 0.58) : R.w - 12;
    const cols = wide ? 2 : 2, cw = Math.floor((listW - 4) / cols), ch = 30;
    list.forEach((id, i) => {
      const k = SKILLS[id], x = R.x + 6 + (i % cols) * (cw + 4), y = R.y + 50 + Math.floor(i / cols) * (ch + 3);
      const lv = skillLevel(s, id), open = s.hero.lv >= k.req;
      const st = UI.hit('sk' + id, x, y, cw - 44, ch);
      Frame.panel(ctx, x, y, cw, ch, { fill: U.sel === id ? PAL.navy : open ? PAL.ink : '#141020', hi: PAL.night });
      ctx.globalAlpha = open ? 1 : 0.35; ctx.drawImage(Spr.get(k.icon), x + 6, y + 7); ctx.globalAlpha = 1;
      T(ctx, k.name, x + 26, y + 3, { color: open ? PAL.white : PAL.slate });
      T(ctx, k.passive ? '被动' : `${k.cd} 秒`, x + 26 + Text.width(k.name) + 5, y + 4, { size: 8, color: k.passive ? PAL.green : PAL.steel });
      T(ctx, open ? `Lv.${lv}/${k.max}` : `${k.req} 级解锁`, x + 26, y + 16, { color: open ? (lv ? PAL.yellow : PAL.steel) : PAL.red });
      if (s.skills.slots.includes(id)) { ctx.fillStyle = PAL.green; ctx.fillRect(x + 2, y + 2, 2, ch - 4); }
      if (open && UI.button('skdn' + id, x + cw - 42, y + 7, 18, 16, '-', { disabled: !lv })) Game.skillLower(id);
      if (open && UI.button('skup' + id, x + cw - 21, y + 7, 18, 16, '+', { kind: 'gold', disabled: !Skills.canRaise(s, id), sound: 'level' })) Game.skillRaise(id);
      if (st.click) U.sel = U.sel === id ? null : id;
      if (st.hover) UI.setTip(skillTip(id, s));
    });
    // details of the selected skill
    const D = wide ? { x: R.x + listW + 10, y: R.y + 50, w: R.w - listW - 16, h: R.h - 54 } : { x: R.x + 6, y: R.y + 50 + Math.ceil(list.length / cols) * (ch + 3) + 2, w: R.w - 12, h: 0 };
    D.h = wide ? D.h : R.y + R.h - D.y - 4;
    if (D.h < 30) return;
    Frame.panel(ctx, D.x, D.y, D.w, D.h);
    const id = U.sel;
    if (!id) {
      let y = D.y + 6;
      for (const l of Text.wrap(`主手武器决定流派：现在是${FAMS[famOf(s)].name}。选中技能查看详情，装进技能槽的主动技能冷却好了自动释放，被动技能加点即生效。`, D.w - 12)) { T(ctx, l, D.x + 6, y, { color: PAL.steel }); y += 13; }
      return;
    }
    const k = SKILLS[id], lv = skillLevel(s, id);
    T(ctx, k.name, D.x + 6, D.y + 4, { color: PAL.amber });
    T(ctx, k.fam === 'any' ? '通用' : FAMS[k.fam].name, D.x + D.w - 6, D.y + 4, { align: 'right', color: PAL.steel });
    let y = D.y + 19;
    const desc = Text.wrap(lv ? `Lv.${lv}：${k.desc(lv)}` : `未加点：${k.desc(1)}`, D.w - 12);
    for (const l of desc) { T(ctx, l, D.x + 6, y, { color: PAL.cream }); y += 12; }
    if (lv < k.max) for (const l of Text.wrap(`下一级：${k.desc(lv + 1)}`, D.w - 12)) { if (y > D.y + D.h - 32) break; T(ctx, l, D.x + 6, y, { color: PAL.steel }); y += 12; }
    if (!k.passive && lv && D.h > 60 && UI.button('skslot', D.x + 4, D.y + D.h - 20, D.w - 8, 16, s.skills.slots.includes(id) ? '已装备' : '装进技能槽', { kind: 'green', disabled: s.skills.slots.includes(id) || k.fam !== 'any' && k.fam !== famOf(s) })) Game.skillSlot(id);
  }
  function skillTip(id, s) {
    const k = SKILLS[id], l = skillLevel(s, id);
    return [{ text: `${k.name}  Lv.${l}/${k.max}`, color: PAL.amber }, { text: k.desc(Math.max(1, l)), wrap: 220 }, { text: k.passive ? '被动' : `冷却 ${k.cd} 秒`, color: PAL.steel }];
  }

  // ---------------- 魔方 ----------------
  function cube(ctx, R, s, t) {
    const U = UI_ST.cube, wide = R.w >= 500;
    Frame.rarity(ctx, R.x + 6, R.y + 4, 22, 22, Math.min(9, Math.floor(s.cube.lv / 11)), t);
    icon(ctx, 'i_cube', R.x + 12, R.y + 10);
    T(ctx, `魔方 Lv.${s.cube.lv}`, R.x + 34, R.y + 4, { color: PAL.magenta });
    Frame.bar(ctx, R.x + 34, R.y + 18, 110, 5, s.cube.lv >= CUBE_MAX ? 1 : s.cube.exp / cubeNeed(s.cube.lv), PAL.magenta);
    if (UI.over(R.x + 34, R.y + 16, 110, 9)) UI.setTip([`魔方经验 ${fmt(s.cube.exp)} / ${fmt(cubeNeed(s.cube.lv))}`, '炼金、合成、制作都会积累魔方经验']);
    const list = CUBE_FUNCS.map(f => ({ id: f.id, name: f.name, locked: s.cube.lv < f.lv, tip: [f.name, { text: f.text, wrap: 220 }, s.cube.lv < f.lv ? { text: `魔方 ${f.lv} 级解锁`, color: PAL.red } : ''].filter(Boolean), kind: 'blue' }));
    const fx = wide ? R.x + 152 : R.x + 6, fy = wide ? R.y + 6 : R.y + 30;
    let cx = fx, cy = fy;
    let picked = null;
    for (const c of list) {
      const w = Text.width(c.name) + 10;
      if (cx + w > R.x + R.w - 6) { cx = fx; cy += 17; }
      if (UI.toggle('cf' + c.id, cx, cy, w, 15, c.name, U.fn === c.id, { kindOn: 'blue', disabled: c.locked, tip: c.tip })) picked = c.id;
      cx += w + 2;
    }
    if (picked) U.fn = picked;
    const top = Math.max(R.y + 30, cy + 20);
    const B = { x: R.x + 4, y: top, w: R.w - 8, h: R.y + R.h - top - 4 };
    Frame.panel(ctx, B.x, B.y, B.w, B.h);
    ({ synth: cubeSynth, alch: cubeAlch, craft: cubeCraft, gem: cubeSocket, engrave: cubeSocket, inscribe: cubeSocket, remove: cubeRemove, offer: cubeOffer, reroll: cubeReroll })[U.fn](ctx, B, s, t);
  }
  function cubeSynth(ctx, B, s, t) {
    T(ctx, '9 件同品质 → 1 件高一品质（5% 再跳一级），等级取平均。锁定的装备不参与。', B.x + 6, B.y + 4, { color: PAL.steel });
    const cols = B.w >= 480 ? 3 : 2, cw = Math.floor((B.w - 8) / cols), rh = 22;
    for (let g = 0; g < GRADE_MAX; g++) {
      const x = B.x + 4 + (g % cols) * cw, y = B.y + 20 + Math.floor(g / cols) * rh;
      if (y + rh > B.y + B.h) break;
      const n = s.inv.filter(it => it.g === g && !it.k).length, need = SYNTH_REQ[g + 1], open = s.cube.lv >= need;
      Frame.rarity(ctx, x, y, 18, 18, g, t);
      T(ctx, `${GRADES[g].name}→${GRADES[g + 1].name}`, x + 22, y + 3, { color: open ? GRADES[g + 1].color : PAL.slate });
      T(ctx, `${n}/9`, x + cw - 92, y + 3, { color: n >= 9 ? PAL.green : PAL.steel });
      if (!open) T(ctx, `魔方${need}级`, x + cw - 6, y + 3, { align: 'right', color: PAL.red });
      else {
        if (UI.button('sy' + g, x + cw - 64, y + 1, 30, 16, '1次', { kind: 'gold', disabled: n < 9, sound: 'forge' })) Game.synth(g, 1);
        if (UI.button('sya' + g, x + cw - 32, y + 1, 28, 16, '全部', { disabled: n < 9, sound: 'forge' })) Game.synth(g, 99);
      }
    }
  }
  function cubeAlch(ctx, B, s, t) {
    const U = UI_ST.cube, S = Game.S();
    T(ctx, '装备与材料换成金币和魔方经验。勾选要炼金的品质：', B.x + 6, B.y + 4, { color: PAL.steel });
    let gx = B.x + 6;
    for (let g = 0; g < GRADES.length; g++) {
      const w = Text.width(GRADES[g].name) + 16;
      if (UI.checkbox('ca' + g, gx, B.y + 20, GRADES[g].name, U.grades[g], { color: GRADES[g].color })) U.grades[g] = !U.grades[g];
      gx += w; if (gx > B.x + B.w - 50) { gx = B.x + 6; }
    }
    const n = s.inv.filter(it => !it.k && U.grades[it.g] && !(s.keepUp && Loot.isUpgrade(s, it, S))).length;
    if (UI.button('alchgo', B.x + 6, B.y + 40, 150, 17, `炼金 ${n} 件装备`, { kind: 'gold', disabled: !n, sound: 'salvage' })) Game.alchFiltered();
    T(ctx, s.keepUp ? '比身上更强的装备会保留' : '', B.x + 162, B.y + 42, { color: PAL.steel });
    let y = B.y + 64;
    T(ctx, '自动炼金', B.x + 6, y, { color: S.autoAlch ? PAL.amber : PAL.slate });
    y += 15;
    if (!S.autoAlch) { T(ctx, '符文树「行囊」方向的「自动炼金」解锁：开箱时按下面的勾选直接炼掉', B.x + 6, y, { color: PAL.slate }); return; }
    gx = B.x + 6;
    for (let g = 0; g < GRADES.length; g++) {
      const w = Text.width(GRADES[g].name) + 16;
      if (UI.checkbox('cf2' + g, gx, y, GRADES[g].name, s.cube.filter[g], { color: GRADES[g].color, tip: '开箱时这个品质的装备直接炼金（传说词条装备与战力提升除外）' })) s.cube.filter[g] = !s.cube.filter[g];
      gx += w; if (gx > B.x + B.w - 50) gx = B.x + 6;
    }
  }
  function cubeCraft(ctx, B, s, t) {
    const U = UI_ST.cube, maxT = Loot.craftMaxTier(s);
    U.tier = Math.min(U.tier, maxT);
    const cols = Math.max(6, Math.floor((B.w - 180) / 23));
    TYPE_IDS.forEach((id, i) => {
      const x = B.x + 4 + (i % cols) * 23, y = B.y + 4 + Math.floor(i / cols) * 23;
      const fake = { t: id, g: 2, l: ILVL_TIERS[U.tier], el: TYPES[id].elemRoll ? TYPES[id].elemRoll[0] : undefined, k: 0 };
      const st = UI.hit('ct' + id, x, y, 22, 22);
      Frame.rarity(ctx, x, y, 22, 22, U.type === id ? 4 : 0, t);
      const img = Spr.item(fake); ctx.drawImage(img, x + 11 - (img.width >> 1), y + 11 - (img.height >> 1));
      if (st.click) U.type = id;
      if (st.hover) UI.setTip([TYPES[id].name, { text: SLOT_NAME[TYPES[id].slot], color: PAL.steel }]);
    });
    const P = { x: B.x + B.w - 172, y: B.y + 4, w: 168 };
    const name = itemTypeName(U.type, ILVL_TIERS[U.tier]);
    T(ctx, name, P.x, P.y, { color: PAL.white });
    T(ctx, `${TYPES[U.type].name} · ${ILVL_TIERS[U.tier]}–${ILVL_TIERS[U.tier] + 4}级`, P.x, P.y + 14, { color: PAL.steel });
    if (UI.button('ctl', P.x, P.y + 30, 18, 16, '◀', { disabled: U.tier <= 0 })) U.tier--;
    T(ctx, `等级段 ${U.tier + 1}/${maxT + 1}`, P.x + 84, P.y + 32, { align: 'center', color: PAL.cream });
    if (UI.button('ctr', P.x + 150, P.y + 30, 18, 16, '▶', { disabled: U.tier >= maxT })) U.tier++;
    const c = Loot.craftCost(U.tier), ore = Loot.oreFor(s, c.ore, c.n) || c.ore, have = s.mats[ore] || 0, can = s.gold >= c.gold && have >= c.n && s.inv.length < bagSize(s);
    let x = P.x;
    x += money(ctx, c.gold, x, P.y + 52, s.gold >= c.gold) + 8;
    ctx.drawImage(matIcon(ore), x, P.y + 52, 12, 10);
    T(ctx, `${have}/${c.n}`, x + 14, P.y + 52, { color: have >= c.n ? PAL.white : PAL.red });
    if (UI.button('craftgo', P.x, P.y + 70, P.w, 17, '制作', { kind: 'gold', disabled: !can, sound: 'forge', tip: ['随机品质（优秀起），随机词条', `${MATS[c.ore].name}或更高级的矿石，来自宝箱`] })) Game.craft(U.type, U.tier);
  }
  const SOCK_KEY = { gem: 'sd', engrave: 'se', inscribe: 'si' }, SOCK_KIND = { sd: 'gem', se: 'part', si: 'scroll' }, SOCK_NAME = { sd: '宝石孔', se: '铭刻孔', si: '铭文孔' };
  function slotPicker(ctx, B, s, t, y) {
    const U = UI_ST.cube;
    T(ctx, '装备', B.x + 6, y + 5, { color: PAL.steel });
    SLOTS.forEach((slot, i) => {
      const x = B.x + 34 + i * 23, it = s.eq[slot];
      const st = itemCell(ctx, 'cs' + slot, it, x, y, t, { sel: U.slot === slot, ph: SLOT_ICON[slot] });
      if (st.click) U.slot = slot;
      if (st.hover && it) UI.setTip(itemLines(it, s, { equipped: true }));
    });
    return s.eq[U.slot];
  }
  function cubeSocket(ctx, B, s, t) {
    const U = UI_ST.cube, key = SOCK_KEY[U.fn], kind = SOCK_KIND[key];
    const it = slotPicker(ctx, B, s, t, B.y + 4);
    let y = B.y + 30;
    if (!it) { T(ctx, '这个部位没有装备', B.x + 6, y, { color: PAL.slate }); return; }
    T(ctx, `${Loot.name(it)} · ${SOCK_NAME[key]}`, B.x + 6, y, { color: GRADES[it.g].color });
    let sx = B.x + 6 + Text.width(`${Loot.name(it)} · ${SOCK_NAME[key]}`) + 8;
    if (!it[key].length) T(ctx, `${GRADES[it.g].name}品质没有${SOCK_NAME[key]}`, sx, y, { color: PAL.slate });
    it[key].forEach((v, i) => {
      if (key === 'si') { const w = v ? Text.width(statText(v[0], v[1])) + 10 : 34; Frame.panel(ctx, sx, y - 1, w, 14, { fill: v ? PAL.bark : PAL.ink }); T(ctx, v ? statText(v[0], v[1]) : '空', sx + 5, y, { color: v ? PAL.yellow : PAL.slate }); sx += w + 3; }
      else { if (v) matCell(ctx, v, undefined, sx, y - 5, t, { key: 'so' + i }); else Frame.panel(ctx, sx, y - 5, 22, 22, { fill: PAL.ink }); sx += 25; }
    });
    y += 22;
    const ids = MAT_IDS.filter(id => MATS[id].kind === kind && s.mats[id] > 0).sort((a, b) => MATS[b].grade - MATS[a].grade);
    if (!ids.length) { T(ctx, `没有可用的${{ gem: '宝石', part: '怪物素材', scroll: '铭文卷轴' }[kind]}`, B.x + 6, y, { color: PAL.slate }); return; }
    const cols = Math.max(4, Math.floor((B.w - 12) / 23));
    UI.scroll('cubemat', B.x + 3, y, B.w - 6, B.y + B.h - y - 24, Math.ceil(ids.length / cols) * 23, oy => {
      ids.forEach((id, i) => { const x = B.x + 5 + (i % cols) * 23, yy = y - oy + Math.floor(i / cols) * 23; const st = matCell(ctx, id, s.mats[id], x, yy, t, { sel: U.mat === id, key: 'cm' }); if (st.click) U.mat = id; });
    });
    const ok = U.mat && MATS[U.mat]?.kind === kind && s.mats[U.mat] > 0 && it[key].includes(null);
    if (UI.button('sockgo', B.x + 4, B.y + B.h - 20, B.w - 8, 16, ok ? `把${MATS[U.mat].name}放进${SOCK_NAME[key]}` : '选中材料，放进空孔', { kind: 'gold', disabled: !ok, sound: 'forge' })) Game.socket(U.slot, key, U.mat);
  }
  function cubeRemove(ctx, B, s, t) {
    const it = slotPicker(ctx, B, s, t, B.y + 4);
    let y = B.y + 32;
    if (!it) return;
    T(ctx, '取下插槽里的东西，取下的材料会碎掉', B.x + 6, y, { color: PAL.steel }); y += 16;
    for (const key of ['sd', 'se', 'si']) it[key].forEach((v, i) => {
      if (!v || y > B.y + B.h - 18) return;
      const label = key === 'si' ? `${INSCRIPTIONS[v[0]].name}：${statText(v[0], v[1])}` : MATS[v].name;
      T(ctx, `${SOCK_NAME[key]} ${i + 1} · ${label}`, B.x + 6, y + 1, { color: PAL.cream });
      if (UI.button('rm' + key + i, B.x + B.w - 54, y, 50, 15, '拆除', { kind: 'red' })) Game.unsocket(UI_ST.cube.slot, key, i);
      y += 17;
    });
  }
  function cubeOffer(ctx, B, s, t) {
    T(ctx, `献上纪念币，换一件对应品质的随机装备（${topLevel(s)} 级）`, B.x + 6, B.y + 4, { color: PAL.steel });
    const cols = B.w >= 480 ? 5 : 3, cw = Math.floor((B.w - 8) / cols);
    GRADES.forEach((G, g) => {
      const x = B.x + 4 + (g % cols) * cw, y = B.y + 20 + Math.floor(g / cols) * 26, id = 'coin_' + g, n = s.mats[id] || 0;
      matCell(ctx, id, n, x, y, t, { key: 'of' });
      if (UI.button('of' + g, x + 25, y + 3, cw - 30, 16, G.name, { kind: n ? 'gold' : 'plain', disabled: !n, color: n ? undefined : PAL.slate })) Game.offer(g);
    });
  }
  function cubeReroll(ctx, B, s, t) {
    const it = slotPicker(ctx, B, s, t, B.y + 4);
    let y = B.y + 32;
    if (!it) return;
    const c = Loot.rerollCost(it), chaos = s.mats.chaos || 0;
    T(ctx, `每次：${fmt(c.gold)} 金币 + 混沌碎片 ×1（有 ${chaos}）`, B.x + 6, y, { color: chaos ? PAL.steel : PAL.red }); y += 16;
    it.s.forEach(([k, v], i) => {
      if (y > B.y + B.h - 18) return;
      T(ctx, statText(k, v), B.x + 6, y + 1, { color: PAL.green });
      if (UI.button('rr' + i, B.x + B.w - 54, y, 50, 15, '重铸', { kind: 'gold', disabled: s.gold < c.gold || !chaos, sound: 'forge' })) Game.reroll(UI_ST.cube.slot, i);
      y += 17;
    });
  }

  // ---------------- 符文树 ----------------
  function runes(ctx, R, s, t) {
    const U = UI_ST.rune, wide = R.w >= 500;
    const infoW = wide ? 170 : R.w - 8, G = wide ? { x: R.x + 4, y: R.y + 4, w: R.w - infoW - 12, h: R.h - 8 } : { x: R.x + 4, y: R.y + 4, w: R.w - 8, h: R.h - 100 };
    const I = wide ? { x: R.x + R.w - infoW - 4, y: R.y + 4, w: infoW, h: R.h - 8 } : { x: R.x + 4, y: R.y + R.h - 92, w: R.w - 8, h: 88 };
    Frame.panel(ctx, G.x, G.y, G.w, G.h, { fill: PAL.ink });
    const DX = 30, DY = 26;
    // drag to pan
    const inside = UI.over(G.x, G.y, G.w, G.h);
    if (inside && UI.I.pressed) U.drag = { x: UI.I.x, y: UI.I.y, ox: U.ox, oy: U.oy };
    if (U.drag && UI.I.down) { const dx = UI.I.x - U.drag.x, dy = UI.I.y - U.drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) UI.I.moved = true; U.ox = clamp(U.drag.ox + dx, -200, 200); U.oy = clamp(U.drag.oy + dy, -120, 120); }
    if (!UI.I.down) U.drag = null;
    const cx = G.x + G.w / 2 - 15 + U.ox, cy = G.y + G.h / 2 - 8 + U.oy;
    const pos = n => [Math.round(cx + n.x * DX), Math.round(cy + n.y * DY)];
    ctx.save(); ctx.beginPath(); ctx.rect(G.x + 1, G.y + 1, G.w - 2, G.h - 2); ctx.clip();
    // connections
    for (const n of RUNE_NODES) if (n.p) {
      const [x0, y0] = pos(RUNE[n.p]), [x1, y1] = pos(n);
      Paint2.line(ctx, x0, y0, x1, y1, s.runes[n.id] ? n.color : s.runes[n.p] ? PAL.dusk : PAL.night, 1);
    }
    for (const n of RUNE_NODES) {
      const [x, y] = pos(n), lv = s.runes[n.id] || 0, open = runeOpen(s, n), maxed = lv >= n.max;
      const can = open && !maxed && s.gold >= runeCost(n, lv);
      const sz = n.max === 1 ? 14 : 12;
      gem(ctx, x, y, sz, lv ? n.color : open ? PAL.dusk : PAL.night, can && Math.sin(t * 6) > 0, n.max === 1);
      if (lv && n.max > 1) T(ctx, String(lv), x, y - 4, { align: 'center', size: 8, color: PAL.white, outline: PAL.ink });
      if (U.sel === n.id) { ctx.fillStyle = PAL.white; Frame.ring(ctx, x - sz / 2 - 3, y - sz / 2 - 3, sz + 7, sz + 7); }
      const st = UI.hit('rn' + n.id, x - 8, y - 8, 16, 16);
      if (st.click) U.sel = n.id;
      if (st.hover) UI.setTip(runeTip(n, s));
    }
    ctx.restore();
    T(ctx, '拖动查看', G.x + 6, G.y + G.h - 15, { color: PAL.dusk });
    // info
    Frame.panel(ctx, I.x, I.y, I.w, I.h);
    const n = RUNE[U.sel], lv = s.runes[n.id] || 0;
    T(ctx, n.name, I.x + 6, I.y + 4, { color: n.color });
    T(ctx, `${lv}/${n.max}`, I.x + I.w - 6, I.y + 4, { align: 'right', color: PAL.cream });
    let y = I.y + 19;
    for (const l of Text.wrap(runeEffText(n), I.w - 12)) { T(ctx, l, I.x + 6, y, { color: PAL.green }); y += 12; }
    if (lv) for (const l of Text.wrap('当前：' + runeEffText(n, lv), I.w - 12)) { if (y > I.y + I.h - 40) break; T(ctx, l, I.x + 6, y, { color: PAL.steel }); y += 12; }
    const open = runeOpen(s, n), maxed = lv >= n.max, cost = runeCost(n, lv);
    const by = I.y + I.h - 20;
    if (maxed) T(ctx, '已点满', I.x + I.w / 2, by + 2, { align: 'center', color: PAL.amber });
    else if (!open) T(ctx, `先点亮「${RUNE[n.p].name}」`, I.x + I.w / 2, by + 2, { align: 'center', color: PAL.red });
    else {
      if (UI.button('runebuy', I.x + 4, by, I.w - 8, 16, '', { kind: 'gold', disabled: s.gold < cost, sound: 'level' })) Game.runeBuy(n.id);
      const w = Text.width(fmt(cost)) + 13;
      money(ctx, cost, I.x + I.w / 2 - w / 2, by + 2, s.gold >= cost);
    }
  }
  function runeEffText(n, lv = 1) {
    if (n.text) return lv > 1 ? n.text.replace(/\d+(\.\d+)?/, m => String(+m * lv)) : n.text;
    return Object.entries(n.eff).map(([k, v]) => statText(k, v * lv)).join('，') + (lv === 1 && n.max > 1 ? ' / 级' : '');
  }
  function runeTip(n, s) {
    const lv = s.runes[n.id] || 0;
    const lines = [{ text: `${n.name}  ${lv}/${n.max}`, color: n.color }, { text: runeEffText(n), wrap: 220 }];
    if (lv < n.max) lines.push({ text: `下一级 ${fmt(runeCost(n, lv))} 金币`, color: s.gold >= runeCost(n, lv) ? PAL.yellow : PAL.red });
    if (!runeOpen(s, n)) lines.push({ text: `需要先点亮「${RUNE[n.p].name}」`, color: PAL.red });
    return lines;
  }
  function gem(ctx, x, y, sz, col, glow, big) {
    const h = sz >> 1;
    ctx.fillStyle = PAL.ink;
    for (let i = -h; i <= h; i++) { const w = h - Math.abs(i); ctx.fillRect(x - w - 1, y + i, w * 2 + 3, 1); }
    ctx.fillStyle = col;
    for (let i = -h + 1; i <= h - 1; i++) { const w = h - 1 - Math.abs(i); ctx.fillRect(x - w, y + i, w * 2 + 1, 1); }
    ctx.fillStyle = mixHex(col, '#ffffff', 0.45); ctx.fillRect(x - 2, y - h + 3, 2, 2);
    if (glow) { ctx.fillStyle = PAL.yellow; ctx.fillRect(x - 1, y - h - 2, 3, 1); ctx.fillRect(x - 1, y + h + 1, 3, 1); }
    if (big) { ctx.fillStyle = PAL.amber; ctx.fillRect(x - h - 2, y, 1, 1); ctx.fillRect(x + h + 2, y, 1, 1); }
  }

  // ---------------- 地图 ----------------
  function map(ctx, R, s, t) {
    const U = UI_ST.map, wide = R.w >= 500;
    const d = U.d ?? s.prog.d;
    const pick = chips('md', R.x + 6, R.y + 3, DIFFS.map((D, i) => ({ id: i, name: D.name, locked: !diffOpen(s, i), color: diffOpen(s, i) ? D.color : PAL.slate, tip: diffOpen(s, i) ? [`${D.name}：怪物 ${D.lv[0]}–${D.lv[1]} 级`, `掉落最高${GRADES[D.maxGrade].name}`] : ['击败上一个难度的深渊执政官解锁'] })), d);
    if (pick !== null) { U.d = pick; U.sel = null; }
    T(ctx, `已通关 ${s.prog.best[d]}/${FULL}`, R.x + R.w - 6, R.y + 4, { align: 'right', color: PAL.steel });
    const nameW = 62, cell = wide ? 20 : 26, gridW = nameW + STAGES * cell;
    const top = R.y + 22, rowH = Math.max(15, Math.min(20, Math.floor((R.h - 26 - (wide ? 0 : 96)) / ACT_COUNT)));
    ACTS.forEach((A, ai) => {
      const a = ai + 1, y = top + ai * rowH;
      const actOpen = stageOpen(s, d, a, 1);
      T(ctx, A.name, R.x + 6, y + Math.floor((rowH - 12) / 2), { color: actOpen ? PAL.cream : PAL.dusk });
      for (let st = 1; st <= STAGES; st++) {
        const x = R.x + 4 + nameW + (st - 1) * cell, open = stageOpen(s, d, a, st), done = stageCleared(s, d, a, st);
        const here = s.prog.d === d && s.prog.a === a && s.prog.s === st, boss = st === STAGES;
        const h = UI.hit('st' + a + '-' + st, x, y, cell - 2, rowH - 2, { disabled: !open });
        const fill = here ? PAL.amber : done ? (boss ? PAL.wine : PAL.moss) : open ? PAL.dusk : PAL.ink;
        Frame.panel(ctx, x, y, cell - 2, rowH - 2, { fill: h.hover ? mixHex(fill, '#ffffff', 0.2) : fill, hi: open ? PAL.slate : PAL.night });
        if (boss) { ctx.globalAlpha = open ? 1 : 0.25; ctx.drawImage(Spr.get('i_skull'), Math.round(x + (cell - 2) / 2 - 5), Math.round(y + (rowH - 2) / 2 - 5)); ctx.globalAlpha = 1; }
        else if (U.sel && U.sel[0] === a && U.sel[1] === st) { ctx.fillStyle = PAL.white; Frame.ring(ctx, x - 1, y - 1, cell, rowH); }
        if (h.click) U.sel = [a, st];
        if (h.hover) UI.setTip(stageTip(s, d, a, st));
      }
    });
    // details of the picked stage
    const I = wide ? { x: R.x + gridW + 10, y: R.y + 22, w: R.w - gridW - 14, h: R.h - 26 } : { x: R.x + 4, y: R.y + R.h - 92, w: R.w - 8, h: 88 };
    if (I.w < 100) return;
    Frame.panel(ctx, I.x, I.y, I.w, I.h);
    const [a, st] = U.sel || (s.prog.d === d ? [s.prog.a, s.prog.s] : [1, 1]);
    const L = stageLevel(d, a, st), A = ACTS[a - 1];
    T(ctx, `${DIFFS[d].name} ${a}-${st}`, I.x + 6, I.y + 4, { color: DIFFS[d].color });
    T(ctx, `怪物 ${L} 级`, I.x + I.w - 6, I.y + 4, { align: 'right', color: PAL.cream });
    let y = I.y + 19;
    if (st === STAGES) {
      const B = BOSSES[A.boss];
      T(ctx, `悬赏首领 · ${B.name}`, I.x + 6, y, { color: PAL.red }); y += 13;
      T(ctx, `${B.title} · 限时 ${B.time} 秒`, I.x + 6, y, { color: PAL.steel }); y += 13;
      const cleared = stageCleared(s, d, a, st);
      T(ctx, cleared ? `再战需要${DIFFS[d].name}通缉令（有 ${s.mats['wanted_' + d] || 0}）` : '第一次挑战免费', I.x + 6, y, { color: cleared ? PAL.amber : PAL.green }); y += 13;
    } else {
      const [mob, name, aura] = champOf(a, st);
      T(ctx, `${waveCount(d, a, st)} 波 · 头目 ${name}`, I.x + 6, y, { color: PAL.cream }); y += 13;
      T(ctx, `头目光环：${AURAS[aura].name}`, I.x + 6, y, { color: View.AURA_COLOR[aura] || PAL.amber }); y += 13;
    }
    // the region's monsters
    const cols = Math.max(4, Math.floor((I.w - 10) / 22));
    A.mobs.forEach((id, i) => {
      const M = MONSTERS[id], x = I.x + 6 + (i % cols) * 22, yy = y + 2 + Math.floor(i / cols) * 22;
      if (yy + 20 > I.y + I.h - 22) return;
      Frame.panel(ctx, x, yy, 20, 20, { fill: PAL.ink, hi: PAL.night });
      ctx.save(); ctx.beginPath(); ctx.rect(x + 1, yy + 1, 18, 18); ctx.clip();
      const img = Spr.get(M.spr, 0, M.pal);
      const k = Math.min(1, 16 / Math.max(img.width, img.height));
      if (k < 1) ctx.drawImage(img, x + 10 - img.width * k / 2, yy + 10 - img.height * k / 2, img.width * k, img.height * k);
      else ctx.drawImage(img, x + 10 - img.width / 2, yy + 10 - img.height / 2);
      ctx.restore();
      if (UI.hit('mm' + id, x, yy, 20, 20).hover) UI.setTip(mobTip(id, s));
    });
    const open = stageOpen(s, d, a, st), here = s.prog.d === d && s.prog.a === a && s.prog.s === st;
    if (UI.button('travel', I.x + 4, I.y + I.h - 20, I.w - 8, 16, here ? '正在这里' : '前往', { kind: 'gold', disabled: !open || here })) Game.travel(d, a, st);
  }
  function stageTip(s, d, a, st) {
    const lines = [{ text: `${DIFFS[d].name} ${a}-${st} · ${ACTS[a - 1].name}`, color: DIFFS[d].color }, `怪物 ${stageLevel(d, a, st)} 级`];
    if (!stageOpen(s, d, a, st)) lines.push({ text: '通关前一关后开放', color: PAL.red });
    else if (stageCleared(s, d, a, st)) lines.push({ text: '已通关', color: PAL.green });
    return lines;
  }
  function mobTip(id, s) {
    const M = MONSTERS[id], F = FAMILIES[M.fam], n = s.codex.m[id] || 0;
    const lines = [{ text: M.name, color: PAL.amber }, { text: `${F.name}系${M.elem ? ' · ' + ELEM[M.elem].name + '攻击' : ''}${M.rng ? ' · 远程' : ''}${M.fly ? ' · 飞行' : ''}`, color: PAL.steel }];
    lines.push({ text: `弱点：${ELEM[F.weak].name}${F.resist ? ` · 抗性：${ELEM[F.resist].name}` : ''}`, color: PAL.green });
    lines.push({ text: n ? `击杀 ${fmt(n)}` : '尚未击杀', color: n ? PAL.cream : PAL.slate });
    const pet = PET_IDS.find(p => PETS[p].mob === id);
    if (pet) lines.push({ text: `击杀 ${fmt(PETS[pet].kills)} 只得到宠物「${PETS[pet].name}」`, color: PAL.pink });
    return lines;
  }

  // ---------------- 悬赏 ----------------
  function hunt(ctx, R, s, t) {
    const b = Game.battle(), wide = R.w >= 500;
    if (b.mode.kind !== 'main') {
      Frame.panel(ctx, R.x + 4, R.y + 4, R.w - 8, R.h - 8);
      const m = b.mode;
      T(ctx, MODES[m.kind].name + ' 进行中', R.x + R.w / 2, R.y + 30, { align: 'center', color: PAL.amber });
      const info = m.kind === 'mine' ? `剩余 ${clock(m.t)} · 已采得 ${fmt(m.gold)} 金币` : m.kind === 'rush' ? `已击败 ${m.n} 个首领` : `第 ${Math.min(m.wave, TRIAL_WAVES + 1)}/${TRIAL_WAVES + 1} 波 · 奖励 +${pct(m.bonus)}`;
      T(ctx, info, R.x + R.w / 2, R.y + 50, { align: 'center', color: PAL.cream });
      if (UI.button('leave', R.x + R.w / 2 - 50, R.y + 74, 100, 18, '撤退', { kind: 'red' })) Game.leaveMode();
      return;
    }
    const BW = wide ? Math.floor(R.w * 0.56) : R.w - 8;
    const Bd = { x: R.x + 4, y: R.y + 4, w: BW, h: wide ? R.h - 8 : Math.min(200, R.h - 200) };
    Frame.wood(ctx, Bd.x, Bd.y, Bd.w, Bd.h);
    T(ctx, '公会告示板', Bd.x + 8, Bd.y + 5, { color: PAL.yellow, outline: PAL.soil });
    if (!modeOpen(s, 'board')) T(ctx, '通关普通 1-10 后开放', Bd.x + Bd.w / 2, Bd.y + Bd.h / 2, { align: 'center', color: PAL.cream, outline: PAL.soil });
    else {
      Board.refresh(s);
      const left = s.board.t + MODES.board.refreshH * 3600e3 - Date.now();
      T(ctx, `${fmtTime(left / 1000)}后换新`, Bd.x + Bd.w - 8, Bd.y + 5, { align: 'right', color: PAL.cream, outline: PAL.soil });
      const ch = Math.floor((Bd.h - 26) / 3) - 3;
      s.board.list.forEach((c, i) => {
        const x = Bd.x + 6, y = Bd.y + 22 + i * (ch + 3), w = Bd.w - 12;
        Frame.parchment(ctx, x, y, w, ch);
        T(ctx, CONTRACTS[c.k].text(c), x + 6, y + 4, { color: c.done ? PAL.leaf : PAL.soil });
        Frame.bar(ctx, x + 6, y + 19, w - 92, 6, c.p / c.goal, c.done ? PAL.green : PAL.amber, { back: PAL.tan });
        T(ctx, `${Math.min(c.p, c.goal)}/${c.goal}`, x + w - 84, y + 16, { color: PAL.bark, size: 8 });
        if (ch > 34) T(ctx, '奖励：' + Board.rewardText(c.rw), x + 6, y + ch - 14, { color: PAL.rust });
        if (c.claimed) T(ctx, '已领取', x + w - 8, y + 4, { align: 'right', color: PAL.slate });
        else if (UI.button('claim' + i, x + w - 50, y + ch - 20, 44, 16, '领取', { kind: 'green', disabled: !c.done, sound: 'buy' })) Game.claim(i);
      });
    }
    const M = wide ? { x: R.x + BW + 8, y: R.y + 4, w: R.w - BW - 12 } : { x: R.x + 4, y: Bd.y + Bd.h + 4, w: R.w - 8 };
    const mh = wide ? Math.floor((R.h - 8 - 6) / 3) : Math.floor((R.y + R.h - M.y - 8) / 3);
    ['mine', 'rush', 'trial'].forEach((k, i) => {
      const D = MODES[k], y = M.y + i * (mh + 3);
      Frame.panel(ctx, M.x, y, M.w, mh);
      icon(ctx, D.icon, M.x + 5, y + 5);
      T(ctx, D.name, M.x + 17, y + 3, { color: PAL.white });
      const open = modeOpen(s, k);
      const desc = { mine: '60 秒地下城，矿石魔像与宝箱哥布林，每一下都掉金币', rush: '已击败的悬赏首领接连登场，各掉一个首领宝箱', trial: '自选突变挑战 6 波，突变越多地域宝箱越多' }[k];
      Text.wrap(desc, M.w - 10).slice(0, mh > 56 ? 2 : 1).forEach((l, j) => T(ctx, l, M.x + 5, y + 17 + j * 12, { color: PAL.steel }));
      if (!open) { const [d, a, st] = D.unlock; T(ctx, `通关${DIFFS[d].name} ${a}-${st}`, M.x + M.w - 6, y + 3, { align: 'right', color: PAL.red }); return; }
      const tk = Game.tickets(k), cap = ticketCap(s, k);
      for (let j = 0; j < cap; j++) { ctx.fillStyle = PAL.ink; ctx.fillRect(M.x + M.w - 8 - (cap - j) * 8, y + 5, 6, 8); ctx.fillStyle = j < tk.n ? PAL.amber : PAL.night; ctx.fillRect(M.x + M.w - 7 - (cap - j) * 8, y + 6, 4, 6); }
      if (tk.n < cap) T(ctx, clock(tk.next / 1000), M.x + M.w - 10 - cap * 8, y + 3, { align: 'right', color: PAL.slate, size: 8 });
      if (UI.button('go' + k, M.x + M.w - 56, y + mh - 20, 50, 16, k === 'trial' ? '选择' : '出发', { kind: 'gold', disabled: tk.n <= 0 })) Game.startMode(k);
    });
  }

  // ---------------- 图鉴 ----------------
  function codex(ctx, R, s, t) {
    const U = UI_ST.codex;
    const pick = chips('cx', R.x + 6, R.y + 3, [{ id: 'mob', name: '怪物' }, { id: 'boss', name: '首领' }, { id: 'pet', name: '宠物' }, { id: 'gear', name: '装备' }, { id: 'ach', name: '成就' }, { id: 'stat', name: '统计' }], U.view);
    if (pick) { U.view = pick; UI.resetScroll('codex'); }
    const B = { x: R.x + 4, y: R.y + 22, w: R.w - 8, h: R.h - 26 };
    ({ mob: codexMobs, boss: codexBosses, pet: codexPets, gear: codexGear, ach: codexAch, stat: codexStats })[U.view](ctx, B, s, t);
  }
  function codexMobs(ctx, B, s, t) {
    const ids = Object.keys(MONSTERS), found = ids.filter(id => s.codex.m[id]).length;
    T(ctx, `${found}/${ids.length} 种 · 每种金币 +0.3%`, B.x + B.w - 4, B.y - 18, { align: 'right', color: PAL.amber });
    const cw = 40, cols = Math.max(4, Math.floor((B.w - 8) / cw));
    UI.scroll('codex', B.x, B.y, B.w, B.h, Math.ceil(ids.length / cols) * 38, oy => {
      ids.forEach((id, i) => {
        const x = B.x + 2 + (i % cols) * cw, y = B.y - oy + Math.floor(i / cols) * 38, M = MONSTERS[id], n = s.codex.m[id];
        if (y > B.y + B.h || y + 36 < B.y) return;
        Frame.panel(ctx, x, y, cw - 3, 35, { fill: PAL.ink, hi: PAL.night });
        ctx.save(); ctx.beginPath(); ctx.rect(x + 1, y + 1, cw - 5, 33); ctx.clip();
        const img = Spr.get(M.spr, 0, M.pal), k = Math.min(1, 32 / img.width, 30 / img.height), iw = img.width * k, ih = img.height * k;
        ctx.drawImage(n ? img : Spr.tint(img, PAL.night), Math.round(x + (cw - 3) / 2 - iw / 2), Math.round(y + 32 - ih), Math.round(iw), Math.round(ih));
        ctx.restore();
        T(ctx, n ? fmt(n) : '?', x + cw - 5, y + 23, { size: 8, align: 'right', color: n ? PAL.cream : PAL.dusk, outline: PAL.ink });
        if (UI.hit('cx' + id, x, y, cw - 3, 35).hover) UI.setTip(n ? mobTip(id, s) : ['尚未遇到']);
      });
    });
  }
  function codexBosses(ctx, B, s, t) {
    const bc = Math.max(1, Math.floor((B.w - 4) / 66));
    const content = Math.ceil(BOSS_IDS.length / bc) * 64 + 20 + ACTS.length * 14 + 10;
    UI.scroll('codex', B.x, B.y, B.w, B.h, content, oy => {
      let y = B.y - oy;
      BOSS_IDS.forEach((id, i) => {
        const x = B.x + 2 + (i % bc) * 66, yy = y + Math.floor(i / bc) * 64, d = BOSSES[id], rec = s.codex.b[id];
        Frame.parchment(ctx, x, yy, 62, 60);
        ctx.save(); ctx.beginPath(); ctx.rect(x + 1, yy + 1, 60, 46); ctx.clip();
        const img = Spr.get(d.spr, 0), k = Math.min(1, 58 / img.width, 46 / img.height);
        if (rec) ctx.drawImage(img, x + 31 - img.width * k / 2, yy + 46 - img.height * k, img.width * k, img.height * k);
        else ctx.drawImage(Spr.tint(img, PAL.tan), x + 31 - img.width * k / 2, yy + 46 - img.height * k, img.width * k, img.height * k);
        ctx.restore();
        const best = rec ? rec.filter(Boolean) : [];
        T(ctx, best.length ? Math.min(...best).toFixed(1) + 's' : '???', x + 31, yy + 47, { align: 'center', size: 8, color: PAL.bark });
        if (UI.hit('cb' + id, x, yy, 62, 60).hover) UI.setTip(rec ? [{ text: d.name, color: PAL.amber }, d.title, ...DIFFS.map((D, di) => ({ text: `${D.name}：${rec[di] ? rec[di].toFixed(1) + ' 秒' : '未击败'}`, color: rec[di] ? PAL.cream : PAL.slate }))] : ['尚未击败']);
      });
      y += Math.ceil(BOSS_IDS.length / bc) * 64 + 4;
      T(ctx, '头目', B.x + 4, y, { color: PAL.amber }); y += 15;
      ACTS.forEach((A, ai) => {
        let x = B.x + 4;
        A.champs.forEach(([mob, name, aura], ci) => {
          const n = s.codex.c[`${ai + 1}-${ci}`] || 0;
          const w = T(ctx, name, x, y, { color: n ? View.AURA_COLOR[aura] || PAL.cream : PAL.dusk });
          if (UI.hit('cc' + ai + ci, x, y, w, 12).hover) UI.setTip(n ? [{ text: name, color: PAL.amber }, `${AURAS[aura].name}：${AURAS[aura].text}`, `击败 ${n} 次`] : ['尚未击败']);
          x += w + 10;
        });
        y += 14;
      });
    });
  }
  function codexPets(ctx, B, s, t) {
    const cols = B.w >= 480 ? 3 : 2, cw = Math.floor((B.w - 4) / cols), ch = 34;
    UI.scroll('codex', B.x, B.y, B.w, B.h, Math.ceil(PET_IDS.length / cols) * (ch + 3), oy => {
      PET_IDS.forEach((id, i) => {
        const P = PETS[id], x = B.x + 2 + (i % cols) * cw, y = B.y - oy + Math.floor(i / cols) * (ch + 3);
        const own = s.pets.own[id], n = s.codex.m[P.mob] || 0, cur = s.pets.cur === id;
        const st = UI.hit('pt' + id, x, y, cw - 3, ch, { disabled: !own });
        Frame.panel(ctx, x, y, cw - 3, ch, { fill: cur ? PAL.plum : own ? '#2c3150' : PAL.ink });
        const img = Spr.get(P.spr, Math.floor(t * 3) % Math.max(1, Spr.frames(P.spr)));
        Spr.draw(ctx, own ? img : Spr.tint(img, PAL.night), x + 14, y + 24);
        T(ctx, P.name, x + 28, y + 3, { color: own ? PAL.white : PAL.slate });
        const eff = Object.entries(P.eff).map(([k, v]) => statText(k, v)).join('，');
        T(ctx, own ? eff : `${MONSTERS[P.mob].name} ${fmt(Math.min(n, P.kills))}/${fmt(P.kills)}`, x + 28, y + 17, { color: own ? PAL.green : PAL.steel });
        if (st.click) Game.setPet(cur ? null : id);
        if (st.hover) UI.setTip([{ text: P.name, color: PAL.pink }, `${eff}（拥有即生效）`, own ? (cur ? '点击让它休息' : '点击让它跟在身边') : `击杀 ${MONSTERS[P.mob].name} ${fmt(P.kills)} 只`]);
      });
    });
  }
  function codexGear(ctx, B, s, t) {
    let total = 0;
    for (const id of TYPE_IDS) { let m = s.codex.n[id] || 0; while (m) { total += m & 1; m >>= 1; } }
    T(ctx, `已发现 ${total}/${TYPE_IDS.length * ILVL_TIERS.length}`, B.x + B.w - 4, B.y - 18, { align: 'right', color: PAL.amber });
    const cell = Math.max(8, Math.min(14, Math.floor((B.w - 90) / ILVL_TIERS.length)));
    UI.scroll('codex', B.x, B.y, B.w, B.h, TYPE_IDS.length * 16 + 4, oy => {
      TYPE_IDS.forEach((id, i) => {
        const y = B.y - oy + i * 16, m = s.codex.n[id] || 0;
        if (y > B.y + B.h || y + 14 < B.y) return;
        T(ctx, TYPES[id].name, B.x + 4, y + 1, { color: m ? PAL.cream : PAL.dusk });
        ILVL_TIERS.forEach((L, ti) => {
          const x = B.x + 80 + ti * cell, got = m & (1 << ti);
          ctx.fillStyle = PAL.ink; ctx.fillRect(x, y + 2, cell - 2, 10);
          ctx.fillStyle = got ? METAL_COLORS[MATERIAL_GROUP(ti)] : PAL.night; ctx.fillRect(x + 1, y + 3, cell - 4, 8);
          if (UI.hit('cg' + id + ti, x, y + 2, cell - 2, 10).hover) UI.setTip([got ? TYPES[id].names[ti] : '？？？', { text: `${TYPES[id].name} · ${L} 级起`, color: PAL.steel }]);
        });
      });
    });
  }
  const METAL_COLORS = [PAL.brown, PAL.slate, PAL.mist, PAL.amber, PAL.cyan, PAL.magenta, PAL.orange];
  function codexAch(ctx, B, s, t) {
    const done = ACHIEVEMENTS.filter(a => s.ach[a.id]).length;
    T(ctx, `${done}/${ACHIEVEMENTS.length}`, B.x + B.w - 4, B.y - 18, { align: 'right', color: PAL.amber });
    const cols = B.w >= 480 ? 2 : 1, cw = Math.floor((B.w - 4) / cols);
    UI.scroll('codex', B.x, B.y, B.w, B.h, Math.ceil(ACHIEVEMENTS.length / cols) * 28, oy => {
      ACHIEVEMENTS.forEach((a, i) => {
        const x = B.x + 2 + (i % cols) * cw, y = B.y - oy + Math.floor(i / cols) * 28, ok = s.ach[a.id];
        if (y > B.y + B.h || y + 26 < B.y) return;
        Frame.panel(ctx, x, y, cw - 3, 25, { fill: ok ? '#2c3150' : PAL.ink });
        icon(ctx, ok ? 'i_star' : 'i_lock', x + 5, y + 8, ok ? 1 : 0.4);
        T(ctx, a.name, x + 18, y + 1, { color: ok ? PAL.yellow : PAL.steel });
        T(ctx, a.text, x + 18, y + 12, { color: ok ? PAL.cream : PAL.slate });
        const rw = a.reward.gold ? `${fmt(a.reward.gold)} 金币` : `${CHESTS.find(c => c.id === a.reward.chest).name} ×${a.reward.n}`;
        T(ctx, rw, x + cw - 8, y + 6, { align: 'right', color: ok ? PAL.slate : PAL.amber });
      });
    });
  }
  function codexStats(ctx, B, s, t) {
    const st = s.stats;
    const rows = [['击杀', fmt(st.kills)], ['精英', fmt(st.elites)], ['头目', fmt(st.champs)], ['悬赏首领', fmt(st.bosses)], ['通关', fmt(st.stages)], ['金币', fmt(st.gold)], ['装备', fmt(st.items)], ['传说词条', fmt(st.legends)], ['开箱', fmt(st.opened)], ['合成', fmt(st.synth)], ['炼金', fmt(st.alch)], ['最高品质', GRADES[st.bestGrade].name], ['暴击', fmt(st.crits)], ['施法', fmt(st.casts)], ['倒下', fmt(st.deaths)], ['游玩', fmtTime(st.play)]];
    const rc = B.w >= 480 ? 4 : 2, rw = (B.w - 8) / rc;
    rows.forEach(([k, v], i) => { const x = B.x + 4 + (i % rc) * rw, y = B.y + 2 + Math.floor(i / rc) * 15; T(ctx, k, x, y, { color: PAL.steel }); T(ctx, v, x + rw - 10, y, { color: PAL.cream, align: 'right' }); });
  }

  // ---------------- 设置 ----------------
  function settings(ctx, R, s, t) {
    const wide = R.w >= 500, cw = wide ? Math.floor((R.w - 12) / 2) : R.w - 8;
    const A = { x: R.x + 4, y: R.y + 4, w: cw, h: wide ? R.h - 8 : 190 };
    const B = wide ? { x: R.x + 8 + cw, y: R.y + 4, w: cw, h: R.h - 8 } : { x: R.x + 4, y: R.y + 198, w: cw, h: R.h - 202 };
    Frame.panel(ctx, A.x, A.y, A.w, A.h);
    let y = A.y + 5;
    T(ctx, '音乐', A.x + 6, y, { color: PAL.cream });
    const m = UI.slider('vmus', A.x + 44, y + 3, A.w - 90, s.opts.music);
    T(ctx, Math.round(m * 100) + '%', A.x + A.w - 6, y, { align: 'right', color: PAL.steel });
    y += 16;
    T(ctx, '音效', A.x + 6, y, { color: PAL.cream });
    const f = UI.slider('vsfx', A.x + 44, y + 3, A.w - 90, s.opts.sfx);
    T(ctx, Math.round(f * 100) + '%', A.x + A.w - 6, y, { align: 'right', color: PAL.steel });
    if (m !== s.opts.music || f !== s.opts.sfx) { s.opts.music = m; s.opts.sfx = f; Sound.setVolume(f, m); }
    y += 20;
    const checks = [['shake', '暴击震屏'], ['nums', '伤害跳字'], ['fx', '完整粒子特效'], ['autoEquip', '捡到更强的装备自动换上'], ['autoSkill', '自动加点']];
    checks.forEach(([k, label], i) => { if (UI.checkbox('opt' + k, A.x + 6 + (i % 2) * Math.floor(A.w / 2), y + Math.floor(i / 2) * 15, label, !!s.opts[k])) { s.opts[k] = s.opts[k] ? 0 : 1; Game.applyOpts(); if (k === 'autoSkill' && s.opts.autoSkill) Game.skillAuto(); } });
    y += 50;
    T(ctx, '猎人', A.x + 6, y + 2, { color: PAL.cream });
    if (UI.toggle('sexm', A.x + 44, y, 56, 16, '洛恩', Game.sex() === 'm')) Game.setSex('m');
    if (UI.toggle('sexf', A.x + 104, y, 56, 16, '希娅', Game.sex() === 'f')) Game.setSex('f');
    y += 22;
    if (UI.button('pip', A.x + 6, y, A.w - 12, 17, '挂件小窗', { icon: 'i_pip', tip: ['把战斗画面放进置顶小窗', '工作时猎人在屏幕角落继续打怪', '快捷键 M'] })) Game.toggleMini();
    Frame.panel(ctx, B.x, B.y, B.w, B.h);
    y = B.y + 5;
    T(ctx, 'GAME.INC.RE 账号', B.x + 6, y, { color: PAL.amber });
    y += 15;
    const acc = Cloud.status();
    for (const l of Text.wrap(acc.text, B.w - 12).slice(0, 2)) { T(ctx, l, B.x + 6, y, { color: acc.color }); y += 13; }
    y += 2;
    const bw = Math.floor((B.w - 16) / 2);
    if (!acc.logged) { if (UI.button('login', B.x + 6, y, B.w - 12, 16, '登录 / 注册', { kind: 'blue', disabled: Cloud.file })) Cloud.openLogin(); }
    else {
      if (UI.button('sync', B.x + 6, y, bw, 16, '立即同步', { kind: 'blue' })) Cloud.syncNow();
      if (UI.button('logout', B.x + 10 + bw, y, bw, 16, '退出登录')) Cloud.logout();
    }
    y += 24;
    T(ctx, '存档', B.x + 6, y, { color: PAL.amber });
    y += 15;
    if (UI.button('export', B.x + 6, y, bw, 16, '导出存档码')) Game.exportSave();
    if (UI.button('import', B.x + 10 + bw, y, bw, 16, '导入存档码')) Game.importSave();
    y += 20;
    if (UI.button('reset', B.x + 6, y, B.w - 12, 16, '清空进度，从头开始', { kind: 'red' })) Game.askReset();
    y += 22;
    if (y + 16 < B.y + B.h && UI.button('hub', B.x + 6, y, B.w - 12, 16, '返回游戏汇总', { tip: '回到 GAME.INC.RE 首页' })) location.href = '../index.html';
  }

  const DRAW = { gear, skill: skills, cube, rune: runes, map, hunt, codex, set: settings };
  function draw(ctx, tab, R, s, t) { DRAW[tab](ctx, R, s, t); }
  return { draw, UI_ST, gem, itemLines, matIcon };
})();
