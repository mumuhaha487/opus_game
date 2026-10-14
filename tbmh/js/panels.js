'use strict';
// =====================================================================
//  PANELS — the eight tabs under the battle strip. Every layout is
//  computed from the panel rect, so desktop, sideways phones and
//  upright phones share one code path.
// =====================================================================
const TABS = [
  { id: 'party', name: '队伍', icon: 'i_party' },
  { id: 'gear', name: '装备', icon: 'i_atk' },
  { id: 'skill', name: '技能', icon: 'i_cdmg' },
  { id: 'cube', name: '魔方', icon: 'i_cube' },
  { id: 'rune', name: '符文', icon: 'i_tree' },
  { id: 'map', name: '地图', icon: 'i_map' },
  { id: 'codex', name: '图鉴', icon: 'i_book' },
  { id: 'set', name: '设置', icon: 'i_gear' },
];
const Panels = (() => {
  const T = (ctx, s, x, y, o) => Text.draw(ctx, s, x, y, o);
  const icon = (ctx, name, x, y, alpha = 1) => { const img = typeof name === 'string' ? Spr.get(name) : name; ctx.globalAlpha = alpha; ctx.drawImage(img, Math.round(x), Math.round(y)); ctx.globalAlpha = 1; return img; };
  const money = (ctx, v, x, y, ok = true) => { icon(ctx, 'i_gold', x, y + 1, ok ? 1 : 0.5); return 13 + T(ctx, fmt(v), x + 13, y, { color: ok ? PAL.yellow : PAL.slate }); };
  const lines = (ctx, list, x, y, w, maxY) => { for (const l of list) for (const s of Text.wrap(l.text, w)) { if (y > maxY - 12) return y; T(ctx, s, x, y, { color: l.color || PAL.cream }); y += 12; } return y; };
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
  const UI_ST = {
    hero: null,
    party: { sel: null, slot: 0 },
    gear: { view: 'bag', sel: null, slot: null, res: null, mat: null },
    skill: { sel: null },
    cube: { fn: 'synth', recipe: 0, type: 'sword', tier: 0, pick: null, key: 'sd', mat: null, grades: [true, true, false, false, false, false, false, false, false, false] },
    rune: { ox: 0, oy: 0, sel: 1, drag: null },
    map: { d: null, sel: null },
    codex: { view: 'mob' },
  };
  // the hero the gear / skill / cube tabs are looking at
  function curHero(s) {
    let c = UI_ST.hero;
    if (!c || !s.heroes[c]) c = UI_ST.hero = partyList(s)[0] || Object.keys(s.heroes)[0];
    return c;
  }
  // chips for every recruited hero, the formation first
  function heroChips(ctx, id, x, y, s, maxW) {
    const list = partyList(s).concat(Object.keys(s.heroes).filter(c => !s.party.includes(c)));
    const cur = curHero(s);
    let cx = x;
    for (const cls of list) {
      const name = CLASSES[cls].hero, w = Text.width(name) + 12;
      if (cx + w > x + maxW) break;
      const inParty = partyList(s).includes(cls);
      if (UI.toggle(id + cls, cx, y, w, 15, name, cur === cls, { kindOn: 'gold', color: inParty ? undefined : PAL.steel, tip: [`${CLASSES[cls].name} ${name} · Lv.${s.heroes[cls].lv}`, inParty ? '在队伍里' : { text: '休息中', color: PAL.steel }] })) { UI_ST.hero = cls; UI_ST.skill.sel = null; UI_ST.cube.pick = null; }
      cx += w + 2;
    }
    return cx;
  }

  // ---------------- materials ----------------
  const KIND_NAME = { gem: '装饰宝石', part: '雕刻素材', scroll: '铭文卷轴', ore: '制作矿石', coin: '纪念币', stone: '通缉令' };
  const matIcon = id => {
    const M = MATS[id];
    if (M.kind === 'gem') return Spr.get('i_gem', 0, M.color);
    if (M.kind === 'part') return Spr.get(M.shape, 0, id);
    if (M.kind === 'scroll') return Spr.icon('i_scroll', M.grade);
    if (M.kind === 'ore') return Spr.get('i_ore', 0, id);
    if (M.kind === 'coin') return Spr.icon('i_coin', M.grade);
    return Spr.get('i_wanted', 0, String(M.diff));
  };
  const matTip = id => {
    const M = MATS[id], lines = [{ text: M.name, color: GRADES[M.grade || 0].color }, { text: `${GRADES[M.grade || 0].name} · ${KIND_NAME[M.kind]}`, color: PAL.steel }];
    if (M.kind === 'gem') lines.push({ text: '镶嵌：' + statText(M.stat, M.value), color: PAL.green });
    if (M.kind === 'part') lines.push({ text: '雕刻：' + M.stats.map(k => statText(k, partValue(k, M.grade))).join('，'), color: PAL.green });
    if (M.kind === 'scroll') lines.push({ text: '铭文：随机写入一条强力属性，品级越高数值越大', color: PAL.green });
    if (M.kind === 'ore') { const t = CRAFT_TIERS.findIndex(C => C.ore === M.grade); lines.push({ text: t >= 0 ? `制作 ${CRAFT_TIERS[t].lo}–${CRAFT_TIERS[t].hi} 级装备` : '制作装备', color: PAL.green }); }
    if (M.kind === 'coin') lines.push({ text: `供奉：换一件随机装备，最高${GRADES[M.odds.length - 1].name}`, color: PAL.green });
    if (M.kind === 'stone') lines.push({ text: `再次挑战${DIFFS[M.diff].name}的悬赏首领，打赢才消耗`, color: PAL.green });
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
  function itemCell(ctx, id, it, x, y, t, o = {}) {
    const st = UI.hit(id, x, y, 22, 22);
    if (!it) { Frame.panel(ctx, x, y, 22, 22, { fill: PAL.ink, hi: PAL.night }); if (o.ph) icon(ctx, o.ph, x + 3, y + 3, 0.25); if (o.sel) { ctx.fillStyle = PAL.white; Frame.ring(ctx, x - 1, y - 1, 24, 24); } return st; }
    Frame.rarity(ctx, x, y, 22, 22, it.g, t);
    const img = Spr.item(it);
    ctx.drawImage(img, Math.round(x + 11 - img.width / 2), Math.round(y + 11 - img.height / 2));
    if (it.k) icon(ctx, 'i_lock', x + 13, y + 1);
    if (o.sel) { ctx.fillStyle = PAL.white; Frame.ring(ctx, x - 1, y - 1, 24, 24); }
    if (o.up) icon(ctx, 'i_up', x + 13, y + 12);
    if (o.dim) { ctx.fillStyle = rgba(PAL.ink, 0.5); ctx.fillRect(x + 1, y + 1, 20, 20); }
    if (st.hover) { ctx.fillStyle = rgba(PAL.white, 0.15); ctx.fillRect(x + 2, y + 2, 18, 18); }
    return st;
  }
  const MAIN_NAME = { atk: '攻击', hp: '生命', arm: '护甲' };
  function itemLines(it, s, cls, o = {}) {
    const Tp = TYPES[it.t], G = GRADES[it.g];
    const main = itemMain(it);
    const out = [{ text: Loot.name(it), color: G.color }, { text: `${G.name} · ${Loot.typeLabel(it)} · 等级 ${it.l}`, color: PAL.steel }];
    if (Tp.cls) out.push({ text: `${CLASSES[Tp.cls].name}专用`, color: cls && cls !== Tp.cls ? PAL.red : PAL.tan });
    for (const k in main) out.push({ text: MAIN_NAME[k] ? `${MAIN_NAME[k]} +${fmt(main[k])}` : statText(k, main[k]), color: PAL.white });
    if (Tp.impText) out.push({ text: Tp.impText, color: PAL.tan, wrap: 230 });
    for (const [k, v] of it.s) out.push({ text: '· ' + statText(k, v), color: PAL.green });
    for (const id of it.sd) out.push(id ? { text: `◆ ${MATS[id].name}：${statText(MATS[id].stat, MATS[id].value)}`, color: PAL.cyan } : { text: '◇ 空装饰孔', color: PAL.slate });
    for (const id of it.se) out.push(id ? { text: `▲ ${MATS[id].name}：${MATS[id].stats.map(k => statText(k, partValue(k, MATS[id].grade))).join('，')}`, color: PAL.pink } : { text: '△ 空雕刻孔', color: PAL.slate });
    for (const x of it.si) out.push(x ? { text: `■ 铭文：${statText(x[0], x[1])}`, color: PAL.yellow } : { text: '□ 空铭文孔', color: PAL.slate });
    if (it.lg) {
      const L = LEGENDS[it.lg];
      out.push({ text: `「${L.name}」${L.text}${it.g >= 5 ? '（效果 ×1.5）' : ''}`, color: PAL.amber, wrap: 230 });
    }
    if (!o.equipped) {
      if (cls) {
        const g = Loot.gain(s, cls, it);
        if (g === null) out.push({ text: `${CLASSES[cls].hero}不能装备`, color: PAL.slate });
        else out.push({ text: `${CLASSES[cls].hero}换上后战力 ${g >= 0 ? '+' : ''}${(g * 100).toFixed(1)}%`, color: g > 0.0005 ? PAL.green : g < -0.0005 ? PAL.red : PAL.steel });
      }
      const best = Loot.bestFor(s, it);
      if (best && best !== cls) out.push({ text: `更适合${CLASSES[best].hero}`, color: PAL.cyan });
      out.push({ text: `炼金得 ${fmt(Loot.alchOf(s, it).gold)} 金币`, color: PAL.yellow });
    }
    return out;
  }

  // ---------------- 队伍 ----------------
  function party(ctx, R, s, t) {
    const U = UI_ST.party, wide = R.w >= 500, n = partySize(s), b = Game.battle();
    const formW = wide ? Math.min(300, Math.floor(R.w * 0.52)) : R.w - 8;
    const F = { x: R.x + 4, y: R.y + 4, w: formW, h: wide ? R.h - 8 : 118 };
    Frame.wood(ctx, F.x, F.y, F.w, F.h);
    T(ctx, '出战阵型', F.x + 8, F.y + 4, { color: PAL.yellow, outline: PAL.soil });
    const cool = Party.coolLeft(s);
    T(ctx, cool > 0 ? `换人冷却 ${clock(cool / 1000)}` : '前排承受大部分攻击', F.x + F.w - 8, F.y + 4, { align: 'right', color: cool > 0 ? PAL.amber : PAL.cream, outline: PAL.soil });
    const cw = Math.floor((F.w - 16) / 3), ch = F.h - 26;
    for (let i = 0; i < 3; i++) {
      const x = F.x + 6 + i * (cw + 2), y = F.y + 20, cls = s.party[i], locked = i >= n;
      const st = UI.hit('slot' + i, x, y, cw, ch, { disabled: locked });
      Frame.panel(ctx, x, y, cw, ch, { fill: U.slot === i && !locked ? PAL.navy : locked ? PAL.ink : PAL.night });
      T(ctx, ['前排', '中排', '后排'][i], x + cw / 2, y + 2, { align: 'center', color: locked ? PAL.dusk : PAL.steel });
      if (locked) {
        icon(ctx, 'i_lock', x + cw / 2 - 4, y + ch / 2 - 10);
        T(ctx, '符文「统率」', x + cw / 2, y + ch / 2 + 2, { align: 'center', color: PAL.slate });
        T(ctx, `${fmt(RUNE_PRICE[i === 1 ? 21 : 24])} 金币`, x + cw / 2, y + ch / 2 + 15, { align: 'center', color: PAL.slate });
        continue;
      }
      if (cls && s.heroes[cls]) {
        const H = s.heroes[cls], ps = Math.min(48, ch - 46);
        Frame.rarity(ctx, Math.round(x + cw / 2 - ps / 2 - 2), y + 15, ps + 4, ps + 4, i === 0 ? 3 : 2, t);
        ctx.drawImage(Portraits.face(cls), Math.round(x + cw / 2 - ps / 2), y + 17, ps, ps);
        T(ctx, CLASSES[cls].hero, x + cw / 2, y + ps + 21, { align: 'center', color: PAL.white });
        T(ctx, `${CLASSES[cls].name} Lv.${H.lv}`, x + cw / 2, y + ps + 34, { align: 'center', color: PAL.cyan });
        const m = b && b.heroById(cls);
        if (m && ch > ps + 56) Frame.bar(ctx, x + 6, y + ps + 48, cw - 12, 4, m.down ? 0 : m.hp / m.S.maxHp, PAL.green, { back: PAL.wine });
      } else T(ctx, '空位', x + cw / 2, y + ch / 2 - 6, { align: 'center', color: PAL.slate });
      if (st.click) { U.slot = i; if (cls) U.sel = cls; }
      if (st.hover && cls) UI.setTip(heroTip(s, cls));
    }
    // roster
    const Rr = wide ? { x: F.x + F.w + 6, y: R.y + 4, w: R.w - F.w - 14, h: R.h - 8 } : { x: R.x + 4, y: F.y + F.h + 4, w: R.w - 8, h: R.y + R.h - F.y - F.h - 8 };
    Frame.panel(ctx, Rr.x, Rr.y, Rr.w, Rr.h);
    T(ctx, '英雄名册', Rr.x + 6, Rr.y + 4, { color: PAL.amber });
    const cols = Rr.w >= 260 ? 3 : 2, rw = Math.floor((Rr.w - 8) / cols), rh = 30;
    CLASS_IDS.forEach((cls, i) => {
      const x = Rr.x + 4 + (i % cols) * rw, y = Rr.y + 19 + Math.floor(i / cols) * (rh + 2);
      const open = heroUnlocked(s, cls), H = s.heroes[cls], inParty = partyList(s).includes(cls);
      const st = UI.hit('ros' + cls, x, y, rw - 2, rh);
      Frame.panel(ctx, x, y, rw - 2, rh, { fill: U.sel === cls ? PAL.navy : inParty ? '#2c3150' : PAL.ink, hi: PAL.night });
      ctx.globalAlpha = open ? 1 : 0.3; ctx.drawImage(Portraits.mini(cls), x + 2, y + 2, 26, 26); ctx.globalAlpha = 1;
      T(ctx, CLASSES[cls].hero, x + 31, y + 2, { color: open ? PAL.white : PAL.slate });
      T(ctx, open ? (H ? `${CLASSES[cls].name} ${H.lv}` : CLASSES[cls].name) : CLASSES[cls].name, x + 31, y + 15, { color: open ? (inParty ? PAL.green : PAL.steel) : PAL.dusk });
      if (!open) icon(ctx, 'i_lock', x + rw - 13, y + 3);
      if (st.click) U.sel = cls;
      if (st.hover) UI.setTip(heroTip(s, cls));
    });
    // the picked hero
    const sel = U.sel, by = Rr.y + Rr.h - 20, dy = Rr.y + 19 + Math.ceil(CLASS_IDS.length / cols) * (rh + 2) + 2;
    if (!sel) { if (by - dy > 12) T(ctx, '选一名英雄，再点阵型里的位置', Rr.x + 6, dy, { color: PAL.slate }); return; }
    const C = CLASSES[sel], open = heroUnlocked(s, sel), idx = s.party.indexOf(sel), inParty = idx >= 0 && idx < n;
    if (by - dy > 24) lines(ctx, [{ text: `${C.name} · ${C.role}`, color: PAL.amber }, { text: open ? C.line : unlockText(sel), color: open ? PAL.steel : PAL.red }], Rr.x + 6, dy, Rr.w - 12, by);
    const bw = Math.floor((Rr.w - 14) / 3);
    if (inParty) {
      if (UI.button('pl', Rr.x + 4, by, bw, 16, '往前', { disabled: idx === 0 })) Game.partyMove(idx, -1);
      if (UI.button('pr', Rr.x + 7 + bw, by, bw, 16, '往后', { disabled: idx >= n - 1 || !s.party[idx + 1] })) Game.partyMove(idx, 1);
      if (UI.button('pout', Rr.x + 10 + bw * 2, by, bw, 16, '下阵', { kind: 'red', disabled: partyList(s).length <= 1 })) Game.partyRemove(idx);
    } else {
      const slot = U.slot < n ? U.slot : 0, label = s.party[slot] ? `换下${CLASSES[s.party[slot]].hero}` : `上阵到${['前排', '中排', '后排'][slot]}`;
      if (UI.button('pin', Rr.x + 4, by, Rr.w - 8, 16, label, { kind: 'gold', disabled: !open || cool > 0, tip: cool > 0 ? [`换人冷却还剩 ${clock(cool / 1000)}`, '调整前后顺序不受冷却影响'] : ['新英雄从 1 级开始，各自升级、装备和加点'] })) Game.partyDeploy(sel, slot);
    }
  }
  const unlockText = cls => { const u = CLASSES[cls].unlock; return `通关${DIFFS[u[0]].name} ${u[1]}-${u[2]} 后可以招募`; };
  function heroTip(s, cls) {
    const C = CLASSES[cls], H = s.heroes[cls];
    const out = [{ text: `${C.hero} · ${C.name}`, color: PAL.amber }, { text: C.role, color: PAL.steel }, { text: C.line, color: PAL.cream }];
    out.push(`基础：攻击 ×${C.atk} · 攻速 ${C.aspd} · 暴击 ${pct(C.crit, 1)} · 爆伤 ${pct(C.cdmg)} · 生命 ${C.hp} · 护甲 ${C.arm}`);
    out.push({ text: `武器：${TYPES[C.weapon].name} + ${TYPES[C.off].name}`, color: PAL.tan });
    if (H) out.push({ text: `Lv.${H.lv} · 战力 ${fmt(powerHero(s, cls))}`, color: PAL.yellow });
    else if (!heroUnlocked(s, cls)) out.push({ text: unlockText(cls), color: PAL.red });
    return out;
  }

  // ---------------- 装备 ----------------
  const DOLL = ['weapon', 'offhand', 'helm', 'armor', 'gloves', 'boots', 'amulet', 'earring', 'ring', 'bracer'];
  const SLOT_ICON = { weapon: 'w_sword', offhand: 'o_shield', helm: 'a_helm', armor: 'a_chest', gloves: 'a_gloves', boots: 'a_boots', amulet: 'c_amulet', earring: 'c_earring', ring: 'c_ring', bracer: 'c_bracer' };
  function gear(ctx, R, s, t) {
    const cls = curHero(s), H = s.heroes[cls], S = heroStats(s, cls, { aura: partyAura(s) }), wide = R.w >= 500, U = UI_ST.gear;
    const cardW = wide ? 196 : R.w - 8;
    const detW = wide ? Math.max(132, Math.min(176, R.w - cardW - 230)) : R.w - 8;
    const L = wide
      ? { card: { x: R.x + 4, y: R.y + 4, w: cardW, h: R.h - 8 }, bag: { x: R.x + cardW + 8, y: R.y + 4, w: R.w - cardW - detW - 16, h: R.h - 8 }, det: { x: R.x + R.w - detW - 4, y: R.y + 4, w: detW, h: R.h - 8 } }
      : { card: { x: R.x + 4, y: R.y + 4, w: cardW, h: 140 }, bag: { x: R.x + 4, y: R.y + 148, w: R.w - 8, h: Math.max(120, R.h - 148 - 140) }, det: { x: R.x + 4, y: R.y + R.h - 136, w: R.w - 8, h: 132 } };
    // ---- the hero card: chips, numbers, the ten slots ----
    const C = L.card;
    Frame.panel(ctx, C.x, C.y, C.w, C.h);
    heroChips(ctx, 'gh', C.x + 4, C.y + 3, s, C.w - 8);
    const top = C.y + 21, small = C.h < 170 && wide, fs = small ? 32 : 40;
    Frame.rarity(ctx, C.x + 4, top, fs + 4, fs + 4, 3, t);
    ctx.drawImage(small ? Portraits.mini(cls) : Portraits.face(cls), C.x + 6, top + 2, fs, fs);
    const tx = C.x + fs + 12;
    T(ctx, `${CLASSES[cls].name} Lv.${H.lv}`, tx, top, { color: PAL.cyan });
    T(ctx, '战力', tx, top + 14, { color: PAL.amber });
    T(ctx, fmt(powerHero(s, cls, S)), tx + 28, top + 14, { color: PAL.yellow });
    Frame.bar(ctx, tx, top + 29, C.w - fs - 18, 4, H.lv >= HERO_MAX_LEVEL ? 1 : H.exp / expNeed(H.lv), PAL.cyan);
    const stats = [['攻击', fmt(S.atk)], ['生命', fmt(S.maxHp)], ['攻速', S.aspd.toFixed(2)], ['暴击', pct(S.crit, 1)], ['爆伤', pct(S.cdmg)], ['护甲', fmt(S.arm)], ['闪避', pct(S.dodge)], ['格挡', pct(S.block)]];
    const statTop = top + fs + 6, cell = 24, slotsH = 2 * cell + 4;
    const rowsShown = Math.max(1, Math.min(4, Math.floor((C.y + C.h - slotsH - statTop - 2) / 13)));
    const sw = (C.w - 10) / 2;
    stats.slice(0, rowsShown * 2).forEach(([k, v], i) => {
      const sx = C.x + 6 + (i % 2) * sw, sy = statTop + Math.floor(i / 2) * 13;
      T(ctx, k, sx, sy, { color: PAL.steel }); T(ctx, v, sx + sw - 8, sy, { color: PAL.cream, align: 'right' });
    });
    if (UI.over(C.x, statTop, sw * 2, rowsShown * 13)) UI.setTip(statSheet(S));
    const gx = C.x + Math.round((C.w - 5 * cell) / 2), gy = C.y + C.h - 2 * cell - 4;
    DOLL.forEach((slot, i) => {
      const x = gx + (i % 5) * cell, y = gy + Math.floor(i / 5) * cell, it = H.eq[slot];
      const ph = slot === 'weapon' ? TYPES[CLASSES[cls].weapon].icon : slot === 'offhand' ? TYPES[CLASSES[cls].off].icon : SLOT_ICON[slot];
      const st = itemCell(ctx, 'eq' + slot, it, x, y, t, { sel: U.slot === slot, ph });
      if (st.click) { U.slot = slot; U.sel = null; U.mat = null; U.res = null; Sound.play('click'); }
      if (st.hover) UI.setTip(it ? itemLines(it, s, cls, { equipped: true }) : [SLOT_NAME[slot] + '（空）']);
    });
    // ---- bag / materials / chests ----
    const V = L.bag;
    Frame.panel(ctx, V.x, V.y, V.w, V.h);
    const nCh = s.tray.length;
    const pick = chips('gv', V.x + 4, V.y + 3, [{ id: 'bag', name: `背包 ${s.inv.length}/${bagSize(s)}` }, { id: 'mat', name: '材料' }, { id: 'chest', name: `宝箱 ${nCh}`, kind: nCh ? 'gold' : 'blue' }], U.view);
    if (pick) { U.view = pick; UI.resetScroll('inv'); U.res = null; }
    const vt = V.y + 21, h = V.h - 24;
    if (U.view === 'bag') bagGrid(ctx, V, vt, h, s, t, cls);
    else if (U.view === 'mat') matGrid(ctx, V, vt, h, s, t);
    else chestTray(ctx, V, vt, h, s, t);
    // ---- details ----
    const D = L.det;
    Frame.panel(ctx, D.x, D.y, D.w, D.h);
    const selIt = U.sel !== null ? s.inv.find(x => x.u === U.sel) : null;
    if (U.res && U.view === 'chest') openResult(ctx, D, s, t, cls);
    else if (U.slot) detailSlot(ctx, D, s, t, cls, U.slot);
    else if (selIt) detailItem(ctx, D, s, t, cls, selIt);
    else if (U.mat) detailMat(ctx, D, s, t, U.mat);
    else {
      T(ctx, '选中装备或材料', D.x + D.w / 2, D.y + D.h / 2 - 14, { align: 'center', color: PAL.slate });
      T(ctx, '查看详情与操作', D.x + D.w / 2, D.y + D.h / 2, { align: 'center', color: PAL.slate });
    }
  }
  function statSheet(S) {
    const el = ELEMENTS.filter(e => S.el[e] > 1.001).map(e => `${ELEM[e].name} +${pct(S.el[e] - 1)}`).join(' ');
    const res = RES_IDS.map(e => `${ELEM[e].name} ${pct(S.res[e])}`).join(' ');
    return [{ text: `${CLASSES[S.cls].hero}的属性`, color: PAL.amber },
      `攻击 ${fmt(S.atk)} · 生命 ${fmt(S.maxHp)} · 护甲 ${fmt(S.arm)}`,
      `攻速 ${S.aspd.toFixed(2)}/秒 · 暴击 ${pct(S.crit, 1)} · 爆伤 ${pct(S.cdmg)}`,
      `攻击元素 ${ELEM[S.elem].name}${el ? ' · ' + el : ''}`,
      `技能 +${pct(S.skill - 1)} · 范围伤害 +${pct(S.aoeDmg - 1)} · 投射物 +${pct(S.proj - 1)} · 冷却缩减 ${pct(S.cdr)}`,
      `闪避 ${pct(S.dodge)} · 格挡 ${pct(S.block)} · 伤害减免 ${pct(S.dr)} · 吸血 ${pct(S.ls, 1)}`,
      `抗性：${res}`,
      `装备加成：金币 +${pct(S.gold)} · 经验 +${pct(S.exp)} · 宝箱 +${pct(S.chestN)}`];
  }
  function bagGrid(ctx, V, top, h, s, t, cls) {
    const U = UI_ST.gear, foot = 34, cols = Math.max(4, Math.floor((V.w - 10) / 23)), gh = h - foot;
    const n = bagSize(s);
    UI.scroll('inv', V.x + 3, top, V.w - 6, gh, Math.ceil(n / cols) * 23, oy => {
      for (let i = 0; i < n; i++) {
        const x = V.x + 5 + (i % cols) * 23, y = top - oy + Math.floor(i / cols) * 23, it = s.inv[i];
        if (y > top + gh || y + 22 < top) continue;
        const up = it && canWear(cls, it.t) && (Loot.gain(s, cls, it) || 0) > 0.0005;
        const st = itemCell(ctx, 'inv' + (it ? it.u : 'e' + i), it, x, y, t, { sel: it && U.sel === it.u, up, dim: it && !canWear(cls, it.t) });
        if (it && st.click) { U.sel = U.sel === it.u ? null : it.u; U.slot = null; U.mat = null; }
        if (it && st.hover) UI.setTip(itemLines(it, s, cls));
      }
    });
    const fy = top + gh + 3;
    ctx.fillStyle = PAL.dusk; ctx.fillRect(V.x + 4, fy - 2, V.w - 8, 1);
    const bw = Math.floor((V.w - 16) / 3);
    if (UI.button('autoeq', V.x + 4, fy, bw, 14, '换装', { tip: `给${CLASSES[cls].hero}的每个部位换上战力最高的装备` })) Game.autoEquip(cls);
    if (UI.button('sortinv', V.x + 8 + bw, fy, bw, 14, '整理')) Game.sortInv();
    if (UI.button('alchall', V.x + 12 + bw * 2, fy, bw, 14, '炼金', { kind: 'gold', tip: ['把背包里勾选品质、未锁定、对队伍没有提升的装备炼成金币', '勾选在下面一行'] })) Game.alchFiltered();
    let gx = V.x + 4;
    const gyy = fy + 16;
    for (let g = 0; g < 6; g++) {
      const st = UI.hit('ag' + g, gx, gyy, 14, 12);
      ctx.fillStyle = PAL.ink; ctx.fillRect(gx, gyy + 1, 12, 10);
      ctx.fillStyle = UI_ST.cube.grades[g] ? GRADES[g].color : PAL.night; ctx.fillRect(gx + 1, gyy + 2, 10, 8);
      if (st.click) UI_ST.cube.grades[g] = !UI_ST.cube.grades[g];
      if (st.hover) UI.setTip([`${GRADES[g].name}：${UI_ST.cube.grades[g] ? '炼金时包含' : '炼金时跳过'}`]);
      gx += 14;
    }
    if (UI.checkbox('keepup', gx + 6, gyy, '保留提升', s.keepUp, { tip: '对任何上阵英雄有提升的装备不会被炼金' })) s.keepUp = !s.keepUp;
  }
  function matGrid(ctx, V, top, h, s, t) {
    const U = UI_ST.gear, ids = MAT_IDS.filter(id => s.mats[id] > 0);
    const cols = Math.max(4, Math.floor((V.w - 10) / 23));
    if (!ids.length) { T(ctx, '打开宝箱获得宝石、雕刻素材、矿石与通缉令', V.x + V.w / 2, top + 30, { align: 'center', color: PAL.slate }); return; }
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
    const U = UI_ST.gear, A = acctStats(s);
    if (UI.button('openall', V.x + V.w - 74, top - 1, 70, 15, '全部打开', { kind: 'gold', disabled: !s.tray.length, sound: 'open' })) U.res = Game.openAll();
    T(ctx, `共 ${s.tray.length} 个`, V.x + 6, top + 1, { color: PAL.steel });
    const cw = Math.min(110, Math.floor((V.w - 16) / 3));
    CHESTS.forEach((C, k) => {
      const x = V.x + 6 + k * (cw + 3), y = top + 18, ch = Math.min(h - 36, 92), n = chestCount(s, k), cap = chestCap(s, k);
      Frame.panel(ctx, x, y, cw, ch, { fill: n ? '#2c3150' : PAL.ink });
      Spr.draw(ctx, Spr.get('chest', 0, String(k)), x + cw / 2, y + 30 + (n && Math.floor(t * 3 + k) % 4 === 0 ? -1 : 0));
      T(ctx, C.name, x + cw / 2, y + 34, { align: 'center', color: [PAL.cream, PAL.blue, PAL.red][k] });
      T(ctx, `${n}/${cap}`, x + cw / 2, y + 48, { align: 'center', color: n >= cap ? PAL.red : n ? PAL.white : PAL.slate });
      if (ch >= 84 && UI.button('open' + k, x + 4, y + ch - 20, cw - 8, 16, '打开', { kind: 'green', disabled: !n, sound: 'open' })) U.res = Game.openKind(k);
      if (UI.hit('chtip' + k, x, y, cw, 46).hover) UI.setTip([{ text: C.name, color: PAL.amber }, ['来自普通怪物', '来自关卡首领', '必定来自悬赏首领'][k], `${C.items} 件装备 · 材料 ${C.mats[0] < 1 ? '50% 几率 1' : C.mats.join('–')} 份`, C.stone ? `${pct(C.stone)} 几率通缉令` : '', C.coin ? `${pct(C.coin)} 几率纪念币` : '', `容量 ${cap}：装满后新掉落的会丢失`].filter(Boolean));
    });
    const auto = [A.autoN > 0 ? '普通' : '', A.autoB > 0 ? '首领' : '', A.autoA > 0 ? '悬赏' : ''].filter(Boolean).join('、');
    T(ctx, auto ? `发条自动开箱：${auto}宝箱` : '符文树的「发条」可以自动开箱', V.x + 6, V.y + V.h - 15, { color: auto ? PAL.green : PAL.slate });
  }
  function openResult(ctx, D, s, t, cls) {
    const res = UI_ST.gear.res;
    T(ctx, `开箱 ${res.n} 个`, D.x + 6, D.y + 4, { color: PAL.amber });
    money(ctx, res.gold, D.x + D.w - 6 - Text.width(fmt(res.gold)) - 13, D.y + 4);
    const cols = Math.floor((D.w - 10) / 23);
    const shown = res.items.slice(0, cols * 3);
    shown.forEach((x, i) => {
      const cx = D.x + 5 + (i % cols) * 23, cy = D.y + 20 + Math.floor(i / cols) * 23;
      const st = itemCell(ctx, 'res' + i, x.it, cx, cy, t);
      if (!x.kept) { ctx.fillStyle = rgba(PAL.ink, 0.55); ctx.fillRect(cx + 1, cy + 1, 20, 20); }
      if (st.hover) UI.setTip([...itemLines(x.it, s, cls, { equipped: true }), x.kept ? { text: '已放入背包', color: PAL.green } : { text: '背包满了，已炼成金币', color: PAL.yellow }]);
    });
    const my = D.y + 20 + Math.ceil(shown.length / cols) * 23 + 2;
    const mats = Object.entries(res.mats).slice(0, cols);
    mats.forEach(([id, n], i) => matCell(ctx, id, n, D.x + 5 + i * 23, my, t, { key: 'r' }));
    if (UI.button('resok', D.x + 4, D.y + D.h - 20, D.w - 8, 16, '好', { kind: 'blue' })) UI_ST.gear.res = null;
  }
  function detailItem(ctx, D, s, t, cls, it) {
    const G = GRADES[it.g];
    Frame.rarity(ctx, D.x + 5, D.y + 5, 22, 22, it.g, t);
    const img = Spr.item(it); ctx.drawImage(img, D.x + 16 - (img.width >> 1), D.y + 16 - (img.height >> 1));
    T(ctx, Loot.name(it), D.x + 31, D.y + 4, { color: G.color });
    T(ctx, `${G.name} · ${Loot.typeLabel(it)} · ${it.l}级`, D.x + 31, D.y + 17, { color: PAL.steel });
    lines(ctx, itemLines(it, s, cls).slice(2), D.x + 6, D.y + 31, D.w - 12, D.y + D.h - 22);
    const by = D.y + D.h - 20, bw = Math.floor((D.w - 14) / 3), ok = canWear(cls, it.t);
    if (UI.button('equip', D.x + 4, by, bw, 16, '装备', { kind: 'green', sound: 'equip', disabled: !ok, tip: ok ? `给${CLASSES[cls].hero}换上` : `${CLASSES[TYPES[it.t].cls].name}专用` })) Game.equip(cls, it.u);
    if (UI.button('lock', D.x + 7 + bw, by, bw, 16, it.k ? '解锁' : '锁定')) { if (it.k) delete it.k; else it.k = 1; }
    if (UI.button('alch1', D.x + 10 + bw * 2, by, bw, 16, '炼金', { kind: 'gold', disabled: !!it.k, tip: `得到 ${fmt(Loot.alchOf(s, it).gold)} 金币与魔方经验` })) Game.alchOne(it.u);
  }
  function detailMat(ctx, D, s, t, id) {
    const n = s.mats[id] || 0;
    if (!n) { UI_ST.gear.mat = null; return; }
    matCell(ctx, id, n, D.x + 5, D.y + 5, t, { key: 'd' });
    T(ctx, MATS[id].name, D.x + 31, D.y + 4, { color: GRADES[MATS[id].grade || 0].color });
    T(ctx, `拥有 ${fmt(n)}`, D.x + 31, D.y + 17, { color: PAL.steel });
    lines(ctx, matTip(id).slice(2), D.x + 6, D.y + 31, D.w - 12, D.y + D.h - 36);
    if (MATS[id].kind === 'stone') return;
    const v = Loot.matValue(id) * (1 + acctStats(s).alchGold), by = D.y + D.h - 20, bw = Math.floor((D.w - 11) / 2);
    T(ctx, `炼金 ${fmt(v)} 金币/个`, D.x + 6, by - 15, { color: PAL.yellow });
    if (UI.button('am1', D.x + 4, by, bw, 16, '炼金 1 个', { kind: 'gold' })) Game.alchMat(id, 1);
    if (UI.button('amall', D.x + 7 + bw, by, bw, 16, '全部炼金', { kind: 'gold' })) Game.alchMat(id, n);
  }
  function detailSlot(ctx, D, s, t, cls, slot) {
    const it = s.heroes[cls].eq[slot];
    T(ctx, `${CLASSES[cls].hero} · ${SLOT_NAME[slot]}`, D.x + 6, D.y + 4, { color: PAL.amber });
    if (it) lines(ctx, itemLines(it, s, cls, { equipped: true }), D.x + 6, D.y + 19, D.w - 12, D.y + D.h - 22);
    else lines(ctx, [{ text: '空着。背包里选一件装备点「装备」', color: PAL.slate }], D.x + 6, D.y + 19, D.w - 12, D.y + D.h - 22);
    if (it && slot !== 'weapon' && UI.button('uneq', D.x + 4, D.y + D.h - 20, D.w - 8, 16, '卸下', { disabled: s.inv.length >= bagSize(s) })) Game.unequip(cls, slot);
  }

  // ---------------- 技能 ----------------
  const TYPE_TEXT = k => (k.type === 'cd' ? `冷却 ${k.cd} 秒` : k.type === 'ac' ? `每 ${k.every} 次攻击` : k.type === 'cont' ? '装备时常驻' : '每关一次');
  const skillName = id => (ACTIVES[id] ? ACTIVES[id].name : PASSIVE_NAME[PASSIVES[id].stat]);
  const skillIcon = id => (ACTIVES[id] ? ACTIVES[id].icon : PASSIVE_ICON[PASSIVES[id].stat]);
  const skillDesc = (id, l) => (ACTIVES[id] ? ACTIVES[id].desc(Math.max(1, l)) : statText(PASSIVES[id].stat, PASSIVES[id].per * Math.max(1, l)));
  function skills(ctx, R, s, t) {
    const U = UI_ST.skill, cls = curHero(s), H = s.heroes[cls], wide = R.w >= 500;
    const free = Skills.free(H), nSlots = skillSlots(s);
    const hx = heroChips(ctx, 'sh', R.x + 6, R.y + 3, s, wide ? R.w * 0.45 : R.w - 12);
    const row2 = wide ? R.y + 3 : R.y + 21;
    let x = wide ? hx + 8 : R.x + 6;
    T(ctx, '技能点', x, row2 + 2, { color: PAL.steel });
    T(ctx, `${free}/${H.lv}`, x + 40, row2 + 2, { color: free ? PAL.yellow : PAL.cream });
    x += 84;
    if (UI.button('skreset', x, row2, 40, 15, '洗点', { tip: '免费退回这名英雄的全部技能点' })) Game.skillReset(cls);
    x += 46;
    if (UI.checkbox('skauto', x, row2 + 1, '自动', !!s.opts.autoSkill, { tip: ['升级时按职业的推荐路线自动加点'] })) { s.opts.autoSkill = s.opts.autoSkill ? 0 : 1; if (s.opts.autoSkill) Game.skillAuto(cls); }
    // active slots
    const sx0 = R.x + R.w - 2 * 30 - 6;
    for (let i = 0; i < 2; i++) {
      const sx = sx0 + i * 30, sy = R.y + 2, id = H.act[i], locked = i >= nSlots;
      const st = UI.hit('ss' + i, sx, sy, 26, 26, { disabled: locked });
      Frame.rarity(ctx, sx, sy, 26, 26, locked ? 0 : id ? 2 : 0, t);
      if (locked) icon(ctx, 'i_lock', sx + 8, sy + 8);
      else if (id) { ctx.drawImage(Spr.get(ACTIVES[id].icon), sx + 5, sy + 5); T(ctx, String(H.sk[id] || 0), sx + 25, sy + 16, { size: 8, color: PAL.yellow, align: 'right', outline: PAL.ink }); }
      if (st.click) { if (U.sel && ACTIVES[U.sel] && H.sk[U.sel]) Game.skillSlot(cls, U.sel, i); else if (id) Game.skillUnslot(cls, i); }
      if (st.hover) UI.setTip(locked ? [`第 ${i + 1} 个主动技能槽`, { text: '符文树「觉醒」解锁', color: PAL.red }] : id ? [...skillTip(id, H), { text: '点击卸下', color: PAL.steel }] : ['空技能槽：选中一个已学会的主动技能，再点这里']);
    }
    // the tree: nine tiers, each opens after 10 points below it
    const top = wide ? R.y + 30 : R.y + 40, treeW = wide ? Math.floor(R.w * 0.56) : R.w - 12;
    const tree = skillTree(cls), rowH = 21;
    const TH = wide ? R.y + R.h - top - 4 : Math.min(9 * rowH + 2, R.h - (top - R.y) - 110);
    UI.scroll('skilltree', R.x + 4, top, treeW + 4, TH, TIER_COUNT * rowH + 2, oy => {
      for (let tier = 0; tier < TIER_COUNT; tier++) {
        const y = top - oy + tier * rowH, open = Skills.tierOpen(H, tier);
        if (y > top + TH || y + rowH < top) continue;
        Frame.panel(ctx, R.x + 6, y, treeW, rowH - 2, { fill: open ? PAL.ink : '#141020', hi: PAL.night });
        T(ctx, `${tier + 1}`, R.x + 12, y + 3, { color: open ? PAL.amber : PAL.dusk });
        if (!open) T(ctx, `需 ${tier * TIER_STEP} 点`, R.x + 6 + treeW - 6, y + 3, { align: 'right', size: 12, color: PAL.dusk });
        const list = tree.filter(id => SKILLS[id].tier === tier);
        const cw = Math.floor((treeW - 70) / 4);
        list.forEach((id, j) => {
          const cx = R.x + 24 + j * cw, l = H.sk[id] || 0, act = !!ACTIVES[id];
          const st = UI.hit('sk' + id, cx, y + 1, cw - 2, rowH - 4);
          if (U.sel === id) { ctx.fillStyle = PAL.navy; ctx.fillRect(cx, y + 1, cw - 2, rowH - 4); }
          ctx.globalAlpha = open ? (l ? 1 : 0.6) : 0.25;
          const img = Spr.get(skillIcon(id));
          ctx.drawImage(img, cx + 1, y + 1 + Math.round((rowH - 4 - img.height) / 2));
          ctx.globalAlpha = 1;
          if (act) { ctx.fillStyle = H.act.includes(id) ? PAL.green : PAL.amber; ctx.fillRect(cx, y + 1, 1, rowH - 4); }
          T(ctx, `${l}/${SKILLS[id].max}`, cx + 19, y + 3, { color: l ? (l >= SKILLS[id].max ? PAL.yellow : PAL.cream) : open ? PAL.steel : PAL.dusk });
          if (st.click) U.sel = id;
          if (st.hover) UI.setTip(skillTip(id, H));
        });
      }
    });
    // details of the selected skill
    const D = wide ? { x: R.x + treeW + 14, y: top, w: R.w - treeW - 18, h: R.y + R.h - top - 4 } : { x: R.x + 4, y: top + TH + 4, w: R.w - 8, h: R.y + R.h - top - TH - 8 };
    if (D.h < 40) return;
    Frame.panel(ctx, D.x, D.y, D.w, D.h);
    const id = U.sel && SKILLS[U.sel] && SKILLS[U.sel].cls === cls ? U.sel : null;
    if (!id) { lines(ctx, [{ text: `${CLASSES[cls].hero}每升一级得 1 个技能点。第 n 层技能要在下面几层累计投入 10×(n-1) 点后才能学习。主动技能装进技能槽后自动释放，被动技能加点即生效。`, color: PAL.steel }], D.x + 6, D.y + 6, D.w - 12, D.y + D.h); return; }
    const k = SKILLS[id], l = H.sk[id] || 0, act = !!ACTIVES[id];
    T(ctx, skillName(id), D.x + 6, D.y + 4, { color: PAL.amber });
    T(ctx, act ? TYPE_TEXT(k) : '被动', D.x + D.w - 6, D.y + 4, { align: 'right', color: PAL.steel });
    let y = lines(ctx, [{ text: l ? `Lv.${l}：${skillDesc(id, l)}` : `未学习：${skillDesc(id, 1)}`, color: PAL.cream }], D.x + 6, D.y + 19, D.w - 12, D.y + D.h - 22);
    if (l < k.max) lines(ctx, [{ text: `下一级：${skillDesc(id, l + 1)}`, color: PAL.steel }], D.x + 6, y, D.w - 12, D.y + D.h - 22);
    const by = D.y + D.h - 20, bw = act ? Math.floor((D.w - 14) / 3) : Math.floor((D.w - 11) / 2);
    if (UI.button('skdn', D.x + 4, by, bw, 16, '-', { disabled: !Skills.canLower(s, cls, id) })) Game.skillLower(cls, id);
    if (UI.button('skup', D.x + 7 + bw, by, bw, 16, '+', { kind: 'gold', disabled: !Skills.canRaise(s, cls, id), sound: 'level', tip: !Skills.tierOpen(H, k.tier) ? `下面几层还要再投入 ${k.tier * TIER_STEP - Skills.below(H, k.tier)} 点` : undefined })) Game.skillRaise(cls, id);
    if (act && UI.button('skslot', D.x + 10 + bw * 2, by, bw, 16, H.act.includes(id) ? '已装' : '装上', { kind: 'green', disabled: !l || H.act.slice(0, nSlots).includes(id) })) Game.skillSlot(cls, id);
  }
  function skillTip(id, H) {
    const k = SKILLS[id], l = H.sk[id] || 0;
    return [{ text: `${skillName(id)}  Lv.${l}/${k.max}`, color: PAL.amber }, { text: skillDesc(id, l), wrap: 220 }, { text: ACTIVES[id] ? TYPE_TEXT(k) : '被动', color: PAL.steel }];
  }

  // ---------------- 魔方 ----------------
  function cube(ctx, R, s, t) {
    const U = UI_ST.cube, wide = R.w >= 500;
    if (!cubeUnlocked(s)) {
      Frame.panel(ctx, R.x + 4, R.y + 4, R.w - 8, R.h - 8);
      icon(ctx, 'i_cube', R.x + R.w / 2 - 4, R.y + R.h / 2 - 24);
      T(ctx, `任意英雄达到 ${CUBE_UNLOCK_LEVEL} 级后，魔方开放`, R.x + R.w / 2, R.y + R.h / 2 - 6, { align: 'center', color: PAL.cream });
      return;
    }
    Frame.rarity(ctx, R.x + 6, R.y + 4, 22, 22, Math.min(9, Math.floor(s.cube.lv / 11)), t);
    icon(ctx, 'i_cube', R.x + 12, R.y + 10);
    T(ctx, `魔方 Lv.${s.cube.lv}`, R.x + 34, R.y + 4, { color: PAL.magenta });
    Frame.bar(ctx, R.x + 34, R.y + 18, 110, 5, s.cube.lv >= CUBE_MAX ? 1 : s.cube.exp / cubeNeed(s.cube.lv), PAL.magenta);
    if (UI.over(R.x + 34, R.y + 16, 110, 9)) UI.setTip([`魔方经验 ${fmt(s.cube.exp)} / ${fmt(cubeNeed(s.cube.lv))}`, '炼金、合成、制作、镶嵌都会积累魔方经验']);
    const fx = wide ? R.x + 152 : R.x + 6, fy = wide ? R.y + 6 : R.y + 30;
    let cx = fx, cy = fy, picked = null;
    for (const f of CUBE_FUNCS) {
      const w = Text.width(f.name) + 10;
      if (cx + w > R.x + R.w - 6) { cx = fx; cy += 17; }
      if (UI.toggle('cf' + f.id, cx, cy, w, 15, f.name, U.fn === f.id, { kindOn: 'blue', disabled: s.cube.lv < f.lv, tip: [f.name, { text: f.text, wrap: 220 }, s.cube.lv < f.lv ? { text: `魔方 ${f.lv} 级解锁`, color: PAL.red } : ''].filter(Boolean) })) picked = f.id;
      cx += w + 2;
    }
    if (picked) { U.fn = picked; U.pick = null; U.mat = null; }
    const top = Math.max(R.y + 30, cy + 20);
    const B = { x: R.x + 4, y: top, w: R.w - 8, h: R.y + R.h - top - 4 };
    Frame.panel(ctx, B.x, B.y, B.w, B.h);
    ({ synth: cubeSynth, alch: cubeAlch, craft: cubeCraft, deco: cubeSocket, engrave: cubeSocket, inscribe: cubeSocket, remove: cubeRemove, offer: cubeOffer })[U.fn](ctx, B, s, t);
  }
  function cubeSynth(ctx, B, s, t) {
    const U = UI_ST.cube, r = U.recipe, [lo, hi, clv, gold] = SYNTH_RECIPES[r];
    // recipe picker: the output level band
    T(ctx, '产出等级', B.x + 6, B.y + 5, { color: PAL.steel });
    if (UI.button('rl', B.x + 64, B.y + 3, 18, 15, '◀', { disabled: r <= 0 })) U.recipe--;
    T(ctx, `${lo}–${hi} 级`, B.x + 112, B.y + 5, { align: 'center', color: s.cube.lv >= clv ? PAL.cream : PAL.red });
    if (UI.button('rr', B.x + 142, B.y + 3, 18, 15, '▶', { disabled: r >= SYNTH_RECIPES.length - 1 })) U.recipe++;
    let x = B.x + 168;
    if (s.cube.lv < clv) T(ctx, `魔方 ${clv} 级可用`, x, B.y + 5, { color: PAL.red });
    else if (gold) money(ctx, gold, x, B.y + 5, s.gold >= gold); else T(ctx, '免费', x, B.y + 5, { color: PAL.green });
    const cols = B.w >= 480 ? 3 : 2, cw = Math.floor((B.w - 8) / cols), rh = 22;
    for (let g = 0; g < GRADE_MAX; g++) {
      const gx = B.x + 4 + (g % cols) * cw, gy = B.y + 22 + Math.floor(g / cols) * rh;
      if (gy + rh > B.y + B.h) break;
      const n = s.inv.filter(it => it.g === g && !it.k).length, [stay, up, up2] = SYNTH_ODDS[g];
      Frame.rarity(ctx, gx, gy, 18, 18, g, t);
      T(ctx, `${GRADES[g].name}→${GRADES[g + 1].name}`, gx + 22, gy + 3, { color: GRADES[g + 1].color });
      T(ctx, `${Math.min(n, 99)}/9`, gx + cw - 66, gy + 3, { align: 'right', color: n >= 9 ? PAL.green : PAL.steel });
      if (UI.hit('sytip' + g, gx, gy, cw - 70, 18).hover) UI.setTip([{ text: `9 件${GRADES[g].name} → 1 件随机`, color: PAL.amber }, stay ? { text: `${stay}% 保持${GRADES[g].name}`, color: PAL.red } : '', `${up}% 升为${GRADES[g + 1].name}`, up2 ? `${up2}% 大成功：升为${GRADES[Math.min(GRADE_MAX, g + 2)].name}` : '', `产出 ${lo}–${hi} 级，部位取自投入的装备`, '锁定的装备不参与'].filter(Boolean));
      if (UI.button('sy' + g, gx + cw - 62, gy + 1, 28, 16, '1次', { kind: 'gold', disabled: !Loot.synthOk(s, g, r), sound: 'forge' })) Game.synth(g, r, 1);
      if (UI.button('sya' + g, gx + cw - 32, gy + 1, 28, 16, '全部', { disabled: !Loot.synthOk(s, g, r), sound: 'forge' })) Game.synth(g, r, 99);
    }
  }
  function cubeAlch(ctx, B, s, t) {
    const U = UI_ST.cube;
    T(ctx, '装备换成金币和魔方经验。勾选要炼金的品质：', B.x + 6, B.y + 4, { color: PAL.steel });
    let gx = B.x + 6, gy = B.y + 20;
    for (let g = 0; g < GRADES.length; g++) {
      const w = Text.width(GRADES[g].name) + 16;
      if (gx + w > B.x + B.w - 6) { gx = B.x + 6; gy += 15; }
      if (UI.checkbox('ca' + g, gx, gy, GRADES[g].name, U.grades[g], { color: GRADES[g].color })) U.grades[g] = !U.grades[g];
      gx += w;
    }
    const n = s.inv.filter(it => !it.k && U.grades[it.g] && !(s.keepUp && Loot.isUpgrade(s, it))).length;
    if (UI.button('alchgo', B.x + 6, gy + 20, 150, 17, `炼金 ${n} 件装备`, { kind: 'gold', disabled: !n, sound: 'salvage' })) Game.alchFiltered();
    T(ctx, s.keepUp ? '对上阵英雄有提升的装备会保留' : '', B.x + 162, gy + 22, { color: PAL.steel });
    lines(ctx, [{ text: '材料的炼金在「装备 → 材料」里选中材料进行。', color: PAL.slate }], B.x + 6, gy + 44, B.w - 12, B.y + B.h);
  }
  function cubeCraft(ctx, B, s, t) {
    const U = UI_ST.cube, maxT = Loot.craftMaxTier(s);
    U.tier = Math.min(U.tier, maxT);
    const C = CRAFT_TIERS[U.tier];
    const cols = Math.max(6, Math.floor((B.w - 186) / 23));
    UI.scroll('crafttypes', B.x + 2, B.y + 2, cols * 23 + 4, B.h - 4, Math.ceil(TYPE_IDS.length / cols) * 23, oy => {
      TYPE_IDS.forEach((id, i) => {
        const x = B.x + 4 + (i % cols) * 23, y = B.y + 4 - oy + Math.floor(i / cols) * 23;
        const fake = { t: id, g: 2, l: C.lo, el: TYPES[id].elemRoll ? TYPES[id].elemRoll[0] : undefined, k: 0 };
        const st = UI.hit('ct' + id, x, y, 22, 22);
        Frame.rarity(ctx, x, y, 22, 22, U.type === id ? 3 : 0, t);
        const img = Spr.item(fake); ctx.drawImage(img, x + 11 - (img.width >> 1), y + 11 - (img.height >> 1));
        if (st.click) U.type = id;
        if (st.hover) UI.setTip([TYPES[id].name + (TYPES[id].cls ? ` · ${CLASSES[TYPES[id].cls].name}` : ''), { text: SLOT_NAME[TYPES[id].slot], color: PAL.steel }]);
      });
    });
    const P = { x: B.x + B.w - 178, y: B.y + 4, w: 172 };
    T(ctx, itemTypeName(U.type, C.lo), P.x, P.y, { color: PAL.white });
    T(ctx, `${TYPES[U.type].name} · ${C.lo}–${C.hi} 级`, P.x, P.y + 14, { color: PAL.steel });
    if (UI.button('ctl', P.x, P.y + 30, 18, 16, '◀', { disabled: U.tier <= 0 })) U.tier--;
    T(ctx, `等级段 ${U.tier + 1}/${maxT + 1}`, P.x + 86, P.y + 32, { align: 'center', color: PAL.cream });
    if (UI.button('ctr', P.x + 154, P.y + 30, 18, 16, '▶', { disabled: U.tier >= maxT })) U.tier++;
    const c = Loot.craftCost(U.tier), ore = Loot.oreFor(s, c) || c.ores[0], have = s.mats[ore] || 0, can = s.gold >= c.gold && have >= c.n && s.inv.length < bagSize(s);
    let x = P.x;
    x += money(ctx, c.gold, x, P.y + 52, s.gold >= c.gold) + 8;
    ctx.drawImage(matIcon(ore), x, P.y + 52, 12, 10);
    T(ctx, `${have}/${c.n}`, x + 14, P.y + 52, { color: have >= c.n ? PAL.white : PAL.red });
    const odds = C.odds.map((w, g) => (w ? `${GRADES[g].name} ${w}%` : '')).filter(Boolean);
    if (UI.button('craftgo', P.x, P.y + 70, P.w, 17, '制作', { kind: 'gold', disabled: !can, sound: 'forge', tip: ['品质几率：', ...odds, `需要${c.ores.map(id => MATS[id].name).join('或')} ×${c.n}`] })) Game.craft(U.type, U.tier);
  }
  const SOCK_KEY = { deco: 'sd', engrave: 'se', inscribe: 'si' }, SOCK_KIND = { sd: 'gem', se: 'part', si: 'scroll' }, SOCK_NAME = { sd: '装饰孔', se: '雕刻孔', si: '铭文孔' };
  // pick an item: the selected hero's equipment first, then the bag; o.bagOnly for removal
  function itemPicker(ctx, B, s, t, y, pred, o = {}) {
    const U = UI_ST.cube, cls = curHero(s), H = s.heroes[cls];
    const eqList = o.bagOnly ? [] : DOLL.map(slot => H.eq[slot]).filter(it => it && pred(it));
    const bagList = s.inv.filter(pred);
    const list = eqList.concat(bagList);
    heroChips(ctx, 'cph', B.x + 6, y, s, B.w - 12);
    y += 18;
    if (!list.length) { T(ctx, o.empty || '没有合适的装备', B.x + 6, y + 4, { color: PAL.slate }); return null; }
    const cols = Math.max(4, Math.floor((B.w - 12) / 23));
    UI.hscroll('cubepick', B.x + 4, y, B.w - 8, 25, list.length * 23 + 4, ox => {
      list.forEach((it, i) => {
        const x = B.x + 6 + i * 23 - ox;
        const st = itemCell(ctx, 'cp' + it.u, it, x, y, t, { sel: U.pick === it.u });
        if (i === eqList.length - 1 && bagList.length) { ctx.fillStyle = PAL.amber; ctx.fillRect(x + 23, y + 2, 1, 18); }
        if (st.click) { U.pick = it.u; U.mat = null; }
        if (st.hover) UI.setTip([...itemLines(it, s, cls, { equipped: true }), { text: eqList.includes(it) ? `${CLASSES[cls].hero}身上` : '背包里', color: PAL.steel }]);
      });
    });
    if (cols && !list.some(it => it.u === U.pick)) U.pick = list[0].u;
    return list.find(it => it.u === U.pick) || null;
  }
  function cubeSocket(ctx, B, s, t) {
    const U = UI_ST.cube, key = SOCK_KEY[U.fn], kind = SOCK_KIND[key];
    const it = itemPicker(ctx, B, s, t, B.y + 4, x => x[key].length > 0, { empty: `没有带${SOCK_NAME[key]}的装备（${key === 'sd' ? '优秀' : key === 'se' ? '稀有' : '不朽'}品质起才有）` });
    let y = B.y + 50;
    if (!it) return;
    T(ctx, `${Loot.name(it)} · ${SOCK_NAME[key]}`, B.x + 6, y, { color: GRADES[it.g].color });
    let sx = B.x + 6 + Text.width(`${Loot.name(it)} · ${SOCK_NAME[key]}`) + 8;
    it[key].forEach((v, i) => {
      if (key === 'si') { const w = v ? Text.width(statText(v[0], v[1])) + 10 : 34; Frame.panel(ctx, sx, y - 1, w, 14, { fill: v ? PAL.bark : PAL.ink }); T(ctx, v ? statText(v[0], v[1]) : '空', sx + 5, y, { color: v ? PAL.yellow : PAL.slate }); sx += w + 3; }
      else { if (v) matCell(ctx, v, undefined, sx, y - 5, t, { key: 'so' + i }); else Frame.panel(ctx, sx, y - 5, 22, 22, { fill: PAL.ink }); sx += 25; }
    });
    y += 22;
    const ids = MAT_IDS.filter(id => MATS[id].kind === kind && s.mats[id] > 0).sort((a, b) => MATS[b].grade - MATS[a].grade);
    if (!ids.length) { T(ctx, `没有可用的${KIND_NAME[kind]}`, B.x + 6, y, { color: PAL.slate }); return; }
    const cols = Math.max(4, Math.floor((B.w - 12) / 23));
    UI.scroll('cubemat', B.x + 3, y, B.w - 6, B.y + B.h - y - 24, Math.ceil(ids.length / cols) * 23, oy => {
      ids.forEach((id, i) => { const x = B.x + 5 + (i % cols) * 23, yy = y - oy + Math.floor(i / cols) * 23; const st = matCell(ctx, id, s.mats[id], x, yy, t, { sel: U.mat === id, key: 'cm' }); if (st.click) U.mat = id; });
    });
    const ok = U.mat && MATS[U.mat]?.kind === kind && s.mats[U.mat] > 0 && it[key].includes(null);
    const label = !it[key].includes(null) ? `${SOCK_NAME[key]}都满了，先在「拆除」里取下` : ok ? `把${MATS[U.mat].name}放进${SOCK_NAME[key]}` : '选中材料，放进空孔';
    if (UI.button('sockgo', B.x + 4, B.y + B.h - 20, B.w - 8, 16, label, { kind: 'gold', disabled: !ok, sound: 'forge' })) Game.socket(it.u, key, U.mat);
  }
  function cubeRemove(ctx, B, s, t) {
    const it = itemPicker(ctx, B, s, t, B.y + 4, x => x.sd.some(Boolean) || x.se.some(Boolean) || x.si.some(Boolean), { bagOnly: true, empty: '背包里没有可以拆的装备（拆除前先把装备卸下）' });
    let y = B.y + 50;
    if (!it) return;
    T(ctx, '花金币取下插槽内容，取下的材料会碎掉', B.x + 6, y, { color: PAL.steel }); y += 16;
    for (const key of ['sd', 'se', 'si']) it[key].forEach((v, i) => {
      if (!v || y > B.y + B.h - 18) return;
      const label = key === 'si' ? `铭文：${statText(v[0], v[1])}` : MATS[v].name, c = Loot.removeCost(it, key);
      T(ctx, `${SOCK_NAME[key]} ${i + 1} · ${label}`, B.x + 6, y + 1, { color: PAL.cream });
      money(ctx, c, B.x + B.w - 130, y + 1, s.gold >= c);
      if (UI.button('rm' + key + i, B.x + B.w - 54, y, 50, 15, '拆除', { kind: 'red', disabled: s.gold < c })) Game.unsocket(it.u, key, i);
      y += 17;
    });
  }
  function cubeOffer(ctx, B, s, t) {
    T(ctx, `献上纪念币并付一笔金币，换一件 ${topLevel(s)} 级的随机装备`, B.x + 6, B.y + 4, { color: PAL.steel });
    const cols = B.w >= 480 ? 5 : 3, cw = Math.floor((B.w - 8) / cols);
    for (let g = 0; g < 10; g++) {
      const x = B.x + 4 + (g % cols) * cw, y = B.y + 20 + Math.floor(g / cols) * 26, id = 'coin' + g, n = s.mats[id] || 0, fee = Loot.offerFee(s, g);
      matCell(ctx, id, n, x, y, t, { key: 'of' });
      const odds = MATS[id].odds.map((w, k) => (w ? `${GRADES[k].name} ${w}%` : '')).filter(Boolean);
      if (UI.button('of' + g, x + 25, y + 3, cw - 30, 16, fmt(fee), { kind: n ? 'gold' : 'plain', disabled: !n || s.gold < fee, icon: 'i_gold', tip: [MATS[id].name, ...odds] })) Game.offer(g);
    }
  }

  // ---------------- 符文树 ----------------
  function runes(ctx, R, s, t) {
    const U = UI_ST.rune, wide = R.w >= 500;
    if (!runesUnlocked(s)) {
      Frame.panel(ctx, R.x + 4, R.y + 4, R.w - 8, R.h - 8);
      icon(ctx, 'i_tree', R.x + R.w / 2 - 4, R.y + R.h / 2 - 24);
      T(ctx, `任意英雄达到 ${RUNE_UNLOCK_LEVEL} 级后，符文树开放`, R.x + R.w / 2, R.y + R.h / 2 - 6, { align: 'center', color: PAL.cream });
      return;
    }
    const infoW = wide ? 170 : R.w - 8, G = wide ? { x: R.x + 4, y: R.y + 4, w: R.w - infoW - 12, h: R.h - 8 } : { x: R.x + 4, y: R.y + 4, w: R.w - 8, h: R.h - 100 };
    const I = wide ? { x: R.x + R.w - infoW - 4, y: R.y + 4, w: infoW, h: R.h - 8 } : { x: R.x + 4, y: R.y + R.h - 92, w: R.w - 8, h: 88 };
    Frame.panel(ctx, G.x, G.y, G.w, G.h, { fill: PAL.ink });
    const DX = 22, DY = 20;
    // drag to pan
    const inside = UI.over(G.x, G.y, G.w, G.h);
    if (inside && UI.I.pressed) U.drag = { x: UI.I.x, y: UI.I.y, ox: U.ox, oy: U.oy };
    if (U.drag && UI.I.down) { const dx = UI.I.x - U.drag.x, dy = UI.I.y - U.drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) UI.I.moved = true; U.ox = clamp(U.drag.ox + dx, -30 * DX, 16 * DX); U.oy = clamp(U.drag.oy + dy, -6 * DY, 16 * DY); }
    if (inside && UI.I.wheel) U.oy = clamp(U.oy - UI.I.wheel * 0.4, -6 * DY, 16 * DY);
    if (!UI.I.down) U.drag = null;
    const cx = G.x + G.w / 2 + U.ox, cy = G.y + G.h / 2 + U.oy;
    const pos = n => [Math.round(cx + n.x * DX), Math.round(cy + n.y * DY)];
    ctx.save(); ctx.beginPath(); ctx.rect(G.x + 1, G.y + 1, G.w - 2, G.h - 2); ctx.clip();
    for (const n of RUNE_SPEC) if (n.p) {
      const [x0, y0] = pos(RUNE[n.p]), [x1, y1] = pos(n);
      if (Math.max(x0, x1) < G.x - 4 || Math.min(x0, x1) > G.x + G.w + 4 || Math.max(y0, y1) < G.y - 4 || Math.min(y0, y1) > G.y + G.h + 4) continue;
      Paint2.line(ctx, x0, y0, x1, y1, s.runes[n.id] ? RUNE_KINDS[n.kind].color : s.runes[n.p] ? PAL.dusk : PAL.night, 1);
    }
    for (const n of RUNE_SPEC) {
      const [x, y] = pos(n);
      if (x < G.x - 10 || x > G.x + G.w + 10 || y < G.y - 10 || y > G.y + G.h + 10) continue;
      const K = RUNE_KINDS[n.kind], lv = s.runes[n.id] || 0, open = runeOpen(s, n), maxed = lv >= n.max;
      const can = open && !maxed && s.gold >= runeCost(n, lv);
      const special = n.max === 1 && (K.eff.party || K.eff.skillSlot || K.eff.offline || K.eff.stash || K.eff.autoN || K.eff.autoB || K.eff.autoA);
      const sz = special ? 14 : n.max === 1 ? 12 : 10;
      gem(ctx, x, y, sz, lv ? K.color : open ? PAL.dusk : PAL.night, can && Math.sin(t * 6) > 0, special);
      if (lv && n.max > 1) T(ctx, String(lv), x, y - 4, { align: 'center', size: 8, color: PAL.white, outline: PAL.ink });
      if (U.sel === n.id) { ctx.fillStyle = PAL.white; Frame.ring(ctx, x - sz / 2 - 3, y - sz / 2 - 3, sz + 7, sz + 7); }
      const st = UI.hit('rn' + n.id, x - 7, y - 7, 14, 14);
      if (st.click) U.sel = n.id;
      if (st.hover) UI.setTip(runeTip(n, s));
    }
    ctx.restore();
    T(ctx, `已点亮 ${Object.keys(s.runes).length}/${RUNE_SPEC.length} · 拖动查看`, G.x + 6, G.y + G.h - 15, { color: PAL.slate });
    if (UI.button('runehome', G.x + G.w - 44, G.y + 4, 40, 15, '回中心')) { U.ox = 0; U.oy = 0; }
    // info
    Frame.panel(ctx, I.x, I.y, I.w, I.h);
    const n = RUNE[U.sel] || RUNE[1], K = RUNE_KINDS[n.kind], lv = s.runes[n.id] || 0;
    T(ctx, K.name, I.x + 6, I.y + 4, { color: K.color });
    T(ctx, `${lv}/${n.max}`, I.x + I.w - 6, I.y + 4, { align: 'right', color: PAL.cream });
    let y = lines(ctx, [{ text: runeEffText(n), color: PAL.green }], I.x + 6, I.y + 19, I.w - 12, I.y + I.h - 22);
    if (lv && n.max > 1) lines(ctx, [{ text: '当前：' + runeEffText(n, lv), color: PAL.steel }], I.x + 6, y, I.w - 12, I.y + I.h - 22);
    const open = runeOpen(s, n), maxed = lv >= n.max, cost = runeCost(n, lv);
    const by = I.y + I.h - 20;
    if (maxed) T(ctx, '已点满', I.x + I.w / 2, by + 2, { align: 'center', color: PAL.amber });
    else if (!open) T(ctx, `先点亮相连的「${RUNE_KINDS[RUNE[n.p].kind].name}」`, I.x + I.w / 2, by + 2, { align: 'center', color: PAL.red });
    else {
      if (UI.button('runebuy', I.x + 4, by, I.w - 8, 16, '', { kind: 'gold', disabled: s.gold < cost, sound: 'level' })) Game.runeBuy(n.id);
      const w = Text.width(fmt(cost)) + 13;
      money(ctx, cost, I.x + I.w / 2 - w / 2, by + 2, s.gold >= cost);
    }
  }
  function runeEffText(n, lv = 1) {
    const K = RUNE_KINDS[n.kind];
    return Object.entries(K.eff).map(([k, v]) => (RUNE_TEXT[k] ? RUNE_TEXT[k](v * lv) : statText(k, v * lv))).join('，') + (lv === 1 && n.max > 1 ? ' / 级' : '');
  }
  function runeTip(n, s) {
    const K = RUNE_KINDS[n.kind], lv = s.runes[n.id] || 0;
    const out = [{ text: `${K.name}  ${lv}/${n.max}`, color: K.color }, { text: runeEffText(n), wrap: 220 }];
    if (lv < n.max) out.push({ text: `下一级 ${fmt(runeCost(n, lv))} 金币`, color: s.gold >= runeCost(n, lv) ? PAL.yellow : PAL.red });
    if (!runeOpen(s, n)) out.push({ text: '需要先点亮相连的符文', color: PAL.red });
    return out;
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
    const pick = chips('md', R.x + 6, R.y + 3, DIFFS.map((D, i) => ({ id: i, name: D.name, locked: !diffOpen(s, i), color: diffOpen(s, i) ? D.color : PAL.slate, tip: diffOpen(s, i) ? [`${D.name}：怪物 ${LEVELS[i][0][0]}–${LEVELS[i][2][9]} 级`, `宝箱最高${GRADES[DIFF_MAX_GRADE[i]].name}`] : ['通关上一个难度的 3-10 解锁'] })), d);
    if (pick !== null) { U.d = pick; U.sel = null; }
    T(ctx, `已通关 ${s.prog.best[d]}/${FULL}`, R.x + R.w - 6, R.y + 4, { align: 'right', color: PAL.steel });
    const nameW = 30, cell = wide ? 21 : 30, gridW = nameW + STAGES * cell;
    const top = R.y + 22, rowH = Math.max(18, Math.min(26, Math.floor((R.h - 26 - (wide ? 0 : 96)) / ACT_COUNT)));
    ACTS.forEach((A, ai) => {
      const a = ai + 1, y = top + ai * rowH;
      const actOpen = stageOpen(s, d, a, 1);
      T(ctx, `第${a}幕`, R.x + 6, y + Math.floor((rowH - 14) / 2), { color: actOpen ? PAL.cream : PAL.dusk });
      if (UI.hit('act' + a, R.x + 4, y, nameW, rowH - 2).hover) UI.setTip([{ text: `第 ${a} 幕 · ${A.name}`, color: PAL.amber }]);
      for (let st = 1; st <= STAGES; st++) {
        const x = R.x + 4 + nameW + (st - 1) * cell, open = stageOpen(s, d, a, st), done = stageCleared(s, d, a, st);
        const here = s.prog.d === d && s.prog.a === a && s.prog.s === st, def = stageDef(a, st), boss = st === STAGES, big = def.boss.kind === 'boss';
        const h = UI.hit('st' + a + '-' + st, x, y, cell - 2, rowH - 2, { disabled: !open });
        const fill = here ? PAL.amber : done ? (boss ? PAL.wine : PAL.moss) : open ? PAL.dusk : PAL.ink;
        Frame.panel(ctx, x, y, cell - 2, rowH - 2, { fill: h.hover ? mixHex(fill, '#ffffff', 0.2) : fill, hi: open ? PAL.slate : PAL.night });
        if (boss || big) { ctx.globalAlpha = open ? 1 : 0.25; ctx.drawImage(boss ? Spr.get('i_skull') : Spr.tint(Spr.get('i_skull'), PAL.amber), Math.round(x + (cell - 2) / 2 - 5), Math.round(y + (rowH - 2) / 2 - 5)); ctx.globalAlpha = 1; }
        else T(ctx, String(st), x + (cell - 2) / 2, y + Math.floor((rowH - 14) / 2), { align: 'center', size: 8, color: open ? PAL.cream : PAL.dusk });
        if (U.sel && U.sel[0] === a && U.sel[1] === st) { ctx.fillStyle = PAL.white; Frame.ring(ctx, x - 1, y - 1, cell, rowH); }
        if (h.click) U.sel = [a, st];
        if (h.hover) UI.setTip(stageTip(s, d, a, st));
      }
    });
    // details of the picked stage
    const I = wide ? { x: R.x + gridW + 10, y: R.y + 22, w: R.w - gridW - 14, h: R.h - 26 } : { x: R.x + 4, y: R.y + R.h - 92, w: R.w - 8, h: 88 };
    if (I.w < 100) return;
    Frame.panel(ctx, I.x, I.y, I.w, I.h);
    const [a, st] = U.sel || (s.prog.d === d ? [s.prog.a, s.prog.s] : [1, 1]);
    const L = stageLevel(d, a, st), def = stageDef(a, st), W = stageWaves(d, a, st);
    T(ctx, `${DIFFS[d].name} ${a}-${st} ${def.name}`, I.x + 6, I.y + 4, { color: DIFFS[d].color });
    T(ctx, `${L} 级`, I.x + I.w - 6, I.y + 4, { align: 'right', color: PAL.cream });
    let y = I.y + 19;
    const dg = stageDanger(a, st);
    if (st === STAGES) {
      const B = BOSSES[def.boss.id];
      T(ctx, `悬赏首领 · ${B.name}`, I.x + 6, y, { color: PAL.red }); y += 13;
      T(ctx, `${B.title} · 限时 ${B.time} 秒`, I.x + 6, y, { color: PAL.steel }); y += 13;
      const cleared = stageCleared(s, d, a, st);
      T(ctx, cleared ? `再战需要${DIFFS[d].name}通缉令（有 ${s.mats['stone' + d] || 0}）` : '第一次挑战免费', I.x + 6, y, { color: cleared ? PAL.amber : PAL.green }); y += 13;
    } else {
      T(ctx, `${W.waves} 波 · ${W.kills} 只怪物${dg > 1.001 ? ` · 凶险 +${pct(dg - 1)}` : ''}`, I.x + 6, y, { color: dg > 1.001 ? PAL.orange : PAL.cream }); y += 13;
      if (def.boss.kind === 'boss') { T(ctx, `关卡首领 · ${BOSSES[def.boss.id].name}`, I.x + 6, y, { color: PAL.amber }); y += 13; }
      else { T(ctx, `关卡首领 · ${def.boss.name}`, I.x + 6, y, { color: View.AURA_COLOR[def.boss.aura] || PAL.amber }); y += 13; T(ctx, `光环「${AURAS[def.boss.aura].name}」${AURAS[def.boss.aura].text}`, I.x + 6, y, { color: PAL.steel }); y += 13; }
    }
    const cols = Math.max(4, Math.floor((I.w - 10) / 22));
    def.mobs.forEach((id, i) => {
      const M = MONSTERS[id], x = I.x + 6 + (i % cols) * 22, yy = y + 2 + Math.floor(i / cols) * 22;
      if (yy + 20 > I.y + I.h - 22) return;
      Frame.panel(ctx, x, yy, 20, 20, { fill: PAL.ink, hi: PAL.night });
      ctx.save(); ctx.beginPath(); ctx.rect(x + 1, yy + 1, 18, 18); ctx.clip();
      const img = Spr.get(M.spr, 0, M.pal);
      const k = Math.min(1, 16 / Math.max(img.width, img.height));
      ctx.drawImage(img, x + 10 - img.width * k / 2, yy + 10 - img.height * k / 2, img.width * k, img.height * k);
      ctx.restore();
      if (UI.hit('mm' + id, x, yy, 20, 20).hover) UI.setTip(mobTip(id, s));
    });
    const open = stageOpen(s, d, a, st), here = s.prog.d === d && s.prog.a === a && s.prog.s === st;
    if (UI.button('travel', I.x + 4, I.y + I.h - 20, I.w - 8, 16, here ? '正在这里' : '前往', { kind: 'gold', disabled: !open || here })) Game.travel(d, a, st);
  }
  function stageTip(s, d, a, st) {
    const def = stageDef(a, st);
    const out = [{ text: `${DIFFS[d].name} ${a}-${st} · ${def.name}`, color: DIFFS[d].color }, `怪物 ${stageLevel(d, a, st)} 级`];
    if (st === STAGES) out.push({ text: `悬赏首领 ${BOSSES[def.boss.id].name}`, color: PAL.red });
    else out.push({ text: `关卡首领 ${def.boss.kind === 'boss' ? BOSSES[def.boss.id].name : def.boss.name}`, color: PAL.amber });
    if (!stageOpen(s, d, a, st)) out.push({ text: '通关前一关后开放', color: PAL.red });
    else if (stageCleared(s, d, a, st)) out.push({ text: '已通关', color: PAL.green });
    return out;
  }
  function mobTip(id, s) {
    const M = MONSTERS[id], F = FAMILIES[M.fam], n = s.codex.m[id] || 0;
    const out = [{ text: M.name, color: PAL.amber }, { text: `${F.name}系 · ${ELEM[M.elem].name}攻击${M.rng ? ' · 远程' : ''}${M.fly ? ' · 飞行' : ''}`, color: PAL.steel }];
    out.push({ text: `弱点：${ELEM[F.weak].name}${F.resist ? ` · 抗性：${ELEM[F.resist].name}` : ''}`, color: PAL.green });
    out.push({ text: n ? `击杀 ${fmt(n)}` : '尚未击杀', color: n ? PAL.cream : PAL.slate });
    const pet = PET_IDS.find(p => PETS[p].kill && PETS[p].kill.includes(id));
    if (pet) out.push({ text: `击杀 ${fmt(PETS[pet].need)} 只得到宠物「${PETS[pet].name}」`, color: PAL.pink });
    return out;
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
    T(ctx, `${found}/${ids.length} 种`, B.x + B.w - 4, B.y - 18, { align: 'right', color: PAL.amber });
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
    const champs = [];
    STAGE_DEFS.forEach(A => A.forEach(st => { if (st.boss.kind === 'champ') champs.push(st); }));
    const content = Math.ceil(BOSS_IDS.length / bc) * 64 + 20 + Math.ceil(champs.length / 3) * 14 + 10;
    UI.scroll('codex', B.x, B.y, B.w, B.h, content, oy => {
      let y = B.y - oy;
      BOSS_IDS.forEach((id, i) => {
        const x = B.x + 2 + (i % bc) * 66, yy = y + Math.floor(i / bc) * 64, d = BOSSES[id], rec = s.codex.b[id];
        Frame.parchment(ctx, x, yy, 62, 60);
        ctx.save(); ctx.beginPath(); ctx.rect(x + 1, yy + 1, 60, 46); ctx.clip();
        const img = Spr.get(d.spr, 0), k = Math.min(1, 58 / img.width, 46 / img.height);
        ctx.drawImage(rec ? img : Spr.tint(img, PAL.tan), x + 31 - img.width * k / 2, yy + 46 - img.height * k, img.width * k, img.height * k);
        ctx.restore();
        const best = rec ? rec.filter(v => v > 0) : [];
        T(ctx, best.length ? Math.min(...best).toFixed(1) + 's' : rec ? '已击败' : '???', x + 31, yy + 47, { align: 'center', size: best.length ? 8 : 12, color: PAL.bark });
        if (UI.hit('cb' + id, x, yy, 62, 60).hover) UI.setTip(rec ? [{ text: d.name, color: PAL.amber }, d.title, d.time ? '悬赏首领（第 10 关）' : '关卡首领', ...DIFFS.map((D, di) => ({ text: `${D.name}：${rec[di] > 0 ? rec[di].toFixed(1) + ' 秒' : rec[di] ? '已击败' : '未击败'}`, color: rec[di] ? PAL.cream : PAL.slate }))] : ['尚未击败']);
      });
      y += Math.ceil(BOSS_IDS.length / bc) * 64 + 4;
      T(ctx, '关卡首领', B.x + 4, y, { color: PAL.amber }); y += 15;
      const cw = Math.floor((B.w - 8) / 3);
      champs.forEach((st, i) => {
        const x = B.x + 4 + (i % 3) * cw, yy = y + Math.floor(i / 3) * 14, n = s.codex.c[st.boss.key] || 0;
        T(ctx, st.boss.name, x, yy, { color: n ? View.AURA_COLOR[st.boss.aura] || PAL.cream : PAL.dusk });
        if (UI.hit('cc' + st.boss.key, x, yy, cw - 4, 12).hover) UI.setTip(n ? [{ text: st.boss.name, color: PAL.amber }, `${st.a}-${st.s} ${st.name}`, `${AURAS[st.boss.aura].name}：${AURAS[st.boss.aura].text}`, `击败 ${n} 次`] : ['尚未击败']);
      });
    });
  }
  function codexPets(ctx, B, s, t) {
    const cols = B.w >= 480 ? 3 : 2, cw = Math.floor((B.w - 4) / cols), ch = 34;
    UI.scroll('codex', B.x, B.y, B.w, B.h, Math.ceil(PET_IDS.length / cols) * (ch + 3), oy => {
      PET_IDS.forEach((id, i) => {
        const P = PETS[id], x = B.x + 2 + (i % cols) * cw, y = B.y - oy + Math.floor(i / cols) * (ch + 3);
        const own = s.pets.own[id], cur = s.pets.cur === id, p = petProgress(s, id);
        const st = UI.hit('pt' + id, x, y, cw - 3, ch, { disabled: !own });
        Frame.panel(ctx, x, y, cw - 3, ch, { fill: cur ? PAL.plum : own ? '#2c3150' : PAL.ink });
        const img = Spr.get(P.spr, Math.floor(t * 3) % Math.max(1, Spr.frames(P.spr)));
        Spr.draw(ctx, own ? img : Spr.tint(img, PAL.night), x + 14, y + 24);
        T(ctx, P.name, x + 28, y + 3, { color: own ? PAL.white : PAL.slate });
        const eff = Object.entries(P.eff).map(([k, v]) => statText(k, v)).join('，');
        const how = P.kill ? `${P.kill.map(m => MONSTERS[m].name).join('/')} ${fmt(Math.min(p.n, p.need))}/${fmt(p.need)}` : `通关${DIFFS[P.clear[0]].name} 第 ${P.clear[1]} 幕`;
        T(ctx, own ? eff : how, x + 28, y + 17, { color: own ? PAL.green : PAL.steel });
        if (st.click) Game.setPet(cur ? null : id);
        if (st.hover) UI.setTip([{ text: P.name, color: PAL.pink }, `${eff}（拥有即生效）`, own ? (cur ? '点击让它休息' : '点击让它跟在队伍后面') : P.kill ? `击杀 ${P.kill.map(m => MONSTERS[m].name).join(' 或 ')} 共 ${fmt(P.need)} 只` : how]);
      });
    });
  }
  function codexGear(ctx, B, s, t) {
    let total = 0, all = 0;
    for (const id of TYPE_IDS) { all += tiersFor(id).length; let m = s.codex.n[id] || 0; while (m) { total += m & 1; m >>= 1; } }
    T(ctx, `已发现 ${total}/${all}`, B.x + B.w - 4, B.y - 18, { align: 'right', color: PAL.amber });
    const cell = Math.max(8, Math.min(14, Math.floor((B.w - 90) / ILVL_TIERS.length)));
    UI.scroll('codex', B.x, B.y, B.w, B.h, TYPE_IDS.length * 16 + 4, oy => {
      TYPE_IDS.forEach((id, i) => {
        const y = B.y - oy + i * 16, m = s.codex.n[id] || 0, tiers = tiersFor(id);
        if (y > B.y + B.h || y + 14 < B.y) return;
        T(ctx, TYPES[id].name, B.x + 4, y + 1, { color: m ? PAL.cream : PAL.dusk });
        tiers.forEach((L, ti) => {
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
        const rw = a.reward.gold ? `${fmt(a.reward.gold)} 金币` : `${CHESTS[a.reward.chest].name} ×${a.reward.n}`;
        T(ctx, rw, x + cw - 8, y + 6, { align: 'right', color: ok ? PAL.slate : PAL.amber });
      });
    });
  }
  function codexStats(ctx, B, s, t) {
    const st = s.stats;
    const rows = [['击杀', fmt(st.kills)], ['精英', fmt(st.elites)], ['光环首领', fmt(st.champs)], ['首领', fmt(st.bosses)], ['通关', fmt(st.stages)], ['金币', fmt(st.gold)], ['装备', fmt(st.items)], ['传说词条', fmt(st.legends)], ['开箱', fmt(st.opened)], ['丢失宝箱', fmt(st.lost)], ['合成', fmt(st.synth)], ['炼金', fmt(st.alch)], ['最高品质', GRADES[st.bestGrade].name], ['暴击', fmt(st.crits)], ['施法', fmt(st.casts)], ['倒下', fmt(st.deaths)], ['游玩', fmtTime(st.play)]];
    const rc = B.w >= 480 ? 4 : 2, rw = (B.w - 8) / rc;
    rows.forEach(([k, v], i) => { const x = B.x + 4 + (i % rc) * rw, y = B.y + 2 + Math.floor(i / rc) * 15; T(ctx, k, x, y, { color: PAL.steel }); T(ctx, v, x + rw - 10, y, { color: PAL.cream, align: 'right' }); });
  }

  // ---------------- 设置 ----------------
  function settings(ctx, R, s, t) {
    const wide = R.w >= 500, cw = wide ? Math.floor((R.w - 12) / 2) : R.w - 8;
    const A = { x: R.x + 4, y: R.y + 4, w: cw, h: wide ? R.h - 8 : 170 };
    const B = wide ? { x: R.x + 8 + cw, y: R.y + 4, w: cw, h: R.h - 8 } : { x: R.x + 4, y: R.y + 178, w: cw, h: R.h - 182 };
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
    checks.forEach(([k, label], i) => { if (UI.checkbox('opt' + k, A.x + 6 + (i % 2) * Math.floor(A.w / 2), y + Math.floor(i / 2) * 15, label, !!s.opts[k])) { s.opts[k] = s.opts[k] ? 0 : 1; Game.applyOpts(); if (k === 'autoSkill' && s.opts.autoSkill) for (const c in s.heroes) Game.skillAuto(c); } });
    y += 50;
    if (UI.button('pip', A.x + 6, y, A.w - 12, 17, '挂件小窗', { icon: 'i_pip', tip: ['把战斗画面放进置顶小窗', '工作时队伍在屏幕角落继续打怪', '快捷键 M'] })) Game.toggleMini();
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
    if (y + 16 < B.y + B.h && UI.button('hub', B.x + 6, y, B.w - 12, 16, '返回主页',
      { tip: '回到 GAME.INC.RE 主页' })) Game.askHome();
  }

  const DRAW = { party, gear, skill: skills, cube, rune: runes, map, codex, set: settings };
  function draw(ctx, tab, R, s, t) { DRAW[tab](ctx, R, s, t); }
  return { draw, UI_ST, gem, itemLines, matIcon, curHero };
})();
