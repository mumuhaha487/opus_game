'use strict';
// =====================================================================
//  LOOT — items, chests, materials and the cube
// =====================================================================
const Loot = (() => {
  const SLOT_WEIGHTS = { weapon: 12, offhand: 10, helm: 10, armor: 10, gloves: 10, boots: 10, amulet: 8, earring: 8, ring: 9, bracer: 8 };
  const slotPick = rng => SLOTS[rng.weighted(SLOTS.map(k => SLOT_WEIGHTS[k]))];

  // ---------- making items ----------
  function rollAffix(rng, id, g, l) {
    const [a, b] = AFFIXES[id].r;
    return Math.round(lerp(a, b, rng.next()) * (1 + 0.12 * g) * (1 + l / 150) * 10000) / 10000;
  }
  // weapons and off-hands lean toward the classes in the party
  function typePick(s, rng, slot) {
    const list = TYPES_BY_SLOT[slot];
    if (list.length === 1) return list[0];
    const mine = list.filter(t => s.party.includes(TYPES[t].cls));
    return mine.length && rng.chance(0.6) ? rng.pick(mine) : rng.pick(list);
  }
  function make(s, rng, ilvl, o = {}) {
    const type = o.type || typePick(s, rng, o.slot || slotPick(rng));
    const g = clamp(o.grade ?? 0, 0, GRADE_MAX), l = clamp(Math.floor(ilvl), 1, 100);
    const it = newItem(s, type, g, l);
    it.q = Math.round(rng.range(0.9, 1.1) * 1000) / 1000;
    const pool = AFFIX_IDS.slice();
    for (let i = 0; i < GRADES[g].affixes; i++) {
      const id = pool.splice(Math.floor(rng.next() * pool.length), 1)[0];
      it.s.push([id, rollAffix(rng, id, g, l)]);
    }
    if (g >= LEGEND_GRADE) { const list = legendsFor(type); if (list.length) it.lg = rng.pick(list); }
    if (TYPES[type].elemRoll) it.el = rng.pick(TYPES[type].elemRoll);
    return it;
  }
  const name = it => (it.lg ? `${LEGENDS[it.lg].item}·` : '') + itemTypeName(it.t, it.l);
  const typeLabel = it => TYPES[it.t].name + (it.el ? '·' + ELEM[it.el].name : '');
  const slotOf = it => TYPES[it.t].slot;

  // ---------- comparing ----------
  function gain(s, cls, it, S0) {
    if (!s.heroes[cls] || !canWear(cls, it.t)) return null;
    const aura = partyAura(s), L = stageLevel(s.prog.d, s.prog.a, s.prog.s), d = s.prog.d;
    const now = powerOf(S0 || heroStats(s, cls, { aura }), L, d), next = powerOf(heroStats(s, cls, { aura, swap: { slot: slotOf(it), item: it } }), L, d);
    return next / now - 1;
  }
  // the party member this item helps the most (or null)
  function bestFor(s, it) {
    let best = null, bg = 0.0005;
    for (const cls of partyList(s)) { const g = gain(s, cls, it); if (g !== null && g > bg) { bg = g; best = cls; } }
    return best;
  }
  const isUpgrade = (s, it) => !!bestFor(s, it);

  // ---------- the bag ----------
  function note(s, it) {
    s.stats.items++;
    s.codex.n[it.t] = (s.codex.n[it.t] || 0) | (1 << tierOf(it.l, tiersFor(it.t)));
    if (it.g > s.stats.bestGrade) s.stats.bestGrade = it.g;
    if (it.lg) { s.stats.legends++; s.codex.l[it.lg] = 1; }
  }
  // a new item goes into the bag; a full bag turns it into gold
  function receive(s, it, ev) {
    note(s, it);
    if (s.inv.length >= bagSize(s)) { alch(s, it, ev, 'full'); return false; }
    s.inv.push(it);
    if (ev) ev.emit('item', it);
    if (s.opts.autoEquip) { const cls = bestFor(s, it); if (cls) equip(s, cls, it.u); }
    return true;
  }
  function equip(s, cls, u) {
    const h = s.heroes[cls], i = s.inv.findIndex(x => x.u === u);
    if (!h || i < 0 || !canWear(cls, s.inv[i].t)) return false;
    const it = s.inv[i], slot = slotOf(it);
    s.inv.splice(i, 1);
    if (h.eq[slot]) s.inv.push(h.eq[slot]);
    h.eq[slot] = it;
    return true;
  }
  function unequip(s, cls, slot) {
    const h = s.heroes[cls];
    if (!h || !h.eq[slot] || slot === 'weapon' || s.inv.length >= bagSize(s)) return false;
    s.inv.push(h.eq[slot]); h.eq[slot] = null;
    return true;
  }
  // best item per slot by 战力
  function autoEquip(s, cls) {
    let changed = 0;
    for (const slot of SLOTS) {
      let best = null, bestG = 0.0005;
      const S0 = heroStats(s, cls, { aura: partyAura(s) });
      for (const it of s.inv) if (slotOf(it) === slot) { const g = gain(s, cls, it, S0); if (g !== null && g > bestG) { bestG = g; best = it; } }
      if (best) { equip(s, cls, best.u); changed++; }
    }
    return changed;
  }

  // ---------- alchemy ----------
  function cubeGain(s, x, ev) {
    if (s.cube.lv >= CUBE_MAX) return;
    s.cube.exp += x;
    while (s.cube.lv < CUBE_MAX && s.cube.exp >= cubeNeed(s.cube.lv)) {
      s.cube.exp -= cubeNeed(s.cube.lv); s.cube.lv++;
      if (ev) ev.emit('cubeLv', s.cube.lv);
    }
  }
  const alchOf = (s, it, A = acctStats(s)) => ({ gold: alchGoldOf(it.g, it.l) * (1 + A.alchGold), exp: cubeXpOf(it.g, it.l) * (1 + A.cubeExp) });
  function alch(s, it, ev, why) {
    const v = alchOf(s, it);
    s.gold += v.gold; s.stats.gold += v.gold; s.stats.alch++;
    if (cubeUnlocked(s)) cubeGain(s, v.exp, ev);
    if (ev) ev.emit('alch', it, v.gold, why);
    return v.gold;
  }
  function alchMany(s, pred, ev) {
    let n = 0, gold = 0;
    s.inv = s.inv.filter(it => { if (it.k || !pred(it)) return true; n++; gold += alch(s, it, null); return false; });
    if (n && ev) ev.emit('alchMany', n, gold);
    return { n, gold };
  }
  // materials: gold and cube experience by grade
  function matValue(id) {
    const M = MATS[id], g = M.grade || 0;
    const base = { gem: 15, part: 12, scroll: 40, ore: 10, coin: 400, stone: 3000 }[M.kind] || 10;
    return base * Math.pow(3, g);
  }
  function alchMat(s, id, n, ev) {
    n = Math.min(n, s.mats[id] || 0);
    if (n <= 0 || MATS[id].kind === 'stone') return 0;
    const A = acctStats(s), v = matValue(id) * n;
    useMat(s, id, n);
    const gold = v * (1 + A.alchGold);
    s.gold += gold; s.stats.gold += gold;
    if (cubeUnlocked(s)) cubeGain(s, (v / 20) * (1 + A.cubeExp), ev);
    if (ev) ev.emit('alchMany', n, gold);
    return gold;
  }

  // ---------- materials ----------
  const addMat = (s, id, n = 1) => { if (MATS[id] && n > 0) s.mats[id] = (s.mats[id] || 0) + n; };
  const hasMat = (s, id, n = 1) => (s.mats[id] || 0) >= n;
  const useMat = (s, id, n = 1) => { if (!hasMat(s, id, n)) return false; s.mats[id] -= n; if (!s.mats[id]) delete s.mats[id]; return true; };
  // material grade follows the monster level; boss chests reach one grade higher
  const matGrade = (rng, L, bonus = 0) => clamp(Math.floor((L - 1) / 10) + (rng.chance(0.2) ? 1 : 0) - (rng.chance(0.2) ? 1 : 0) + bonus, 0, 9);
  function pickOf(rng, kind, g) { for (let k = g; k >= 0; k--) { const list = matsOf(kind, k); if (list.length) return rng.pick(list); } return null; }
  function rollMat(rng, ch) {
    const r = rng.next(), g = matGrade(rng, ch.L, ch.k);
    if (r < 0.32) return pickOf(rng, 'gem', g);
    if (r < 0.58) return pickOf(rng, 'part', g);
    if (r < 0.9) return pickOf(rng, 'ore', clamp(Math.floor((ch.L - 1) / 10), 0, 9));
    return pickOf(rng, 'scroll', Math.max(0, g - 1));
  }

  // ---------- chests ----------
  // a chest remembers where it dropped: difficulty, act and monster level
  function addChest(s, ch, ev) {
    if (chestCount(s, ch.k) >= chestCap(s, ch.k)) { s.stats.lost++; if (ev) ev.emit('chestLost', ch); return false; }
    s.tray.push(ch);
    if (ev) ev.emit('chest', ch);
    return true;
  }
  // grade weights of a chest at a difficulty: deeper difficulties tilt toward the top grades
  function chestWeights(ch) {
    const W = CHESTS[ch.k].weights, n = W.length, cap = DIFF_MAX_GRADE[ch.d], w = [];
    for (let g = 0; g <= GRADE_MAX; g++) {
      // past the table the odds keep falling by a quarter per grade
      const base = g < n ? W[g] : W[n - 1] * Math.pow(0.25, g - n + 1);
      w.push(g > cap ? 0 : base * Math.pow(1 + 0.7 * ch.d, g / 2));
    }
    return w;
  }
  const chestGrade = (rng, ch) => rng.weighted(chestWeights(ch));
  function open(s, ch, ev, rng = RNG((s.seed + s.stats.opened * 7919 + s.uid) >>> 0), P) {
    const C = CHESTS[ch.k], A = acctStats(s), res = { ch, items: [], mats: [], gold: 0 };
    s.stats.opened++;
    const seeker = P && P.lg.seeker ? 0.15 * P.lg.seeker : 0;
    for (let i = 0; i < C.items; i++) {
      let g = chestGrade(rng, ch);
      if (seeker && g < DIFF_MAX_GRADE[ch.d] && rng.chance(seeker)) g++;
      const it = make(s, rng, ch.L - rng.int(0, 2), { grade: g });
      res.items.push({ it, kept: receive(s, it, null) });
    }
    const nm = C.mats[0] < 1 ? (rng.chance(C.mats[0]) ? 1 : 0) : rng.int(C.mats[0], C.mats[1]);
    for (let i = 0; i < nm; i++) { const id = rollMat(rng, ch); if (id) { addMat(s, id); res.mats.push(id); } }
    if (C.stone && rng.chance(C.stone)) { addMat(s, `stone${ch.d}`); res.mats.push(`stone${ch.d}`); }
    if (C.coin && rng.chance(C.coin)) { const id = `coin${clamp(Math.floor((ch.L - 1) / 10), 0, 9)}`; addMat(s, id); res.mats.push(id); }
    res.gold = C.gold * CURVE.gold(ch.L) * DIFFS[ch.d].gold * (P ? P.gold : 1 + A.gold) * (1 + A.chestGold);
    s.gold += res.gold; s.stats.gold += res.gold;
    if (ev) ev.emit('open', res);
    return res;
  }

  // ---------- the cube ----------
  const cubeHas = (s, id) => cubeUnlocked(s) && s.cube.lv >= CUBE_FUNCS.find(f => f.id === id).lv;
  // synthesis: nine items of one grade from the bag, lowest level first
  const synthPick = (s, g) => s.inv.filter(it => it.g === g && !it.k).sort((a, b) => a.l - b.l).slice(0, 9);
  const recipeOk = (s, r) => s.cube.lv >= SYNTH_RECIPES[r][2] && s.gold >= SYNTH_RECIPES[r][3];
  const synthOk = (s, g, r = 0) => cubeHas(s, 'synth') && g < GRADE_MAX && recipeOk(s, r) && synthPick(s, g).length >= 9;
  function synth(s, g, r, rng, ev) {
    if (!synthOk(s, g, r)) return null;
    const [lo, hi, , cost] = SYNTH_RECIPES[r];
    const used = synthPick(s, g), ids = new Set(used.map(x => x.u));
    s.inv = s.inv.filter(x => !ids.has(x.u));
    s.gold -= cost;
    const [stay, up] = SYNTH_ODDS[g], roll = rng.next() * 100;
    const to = roll < stay ? g : roll < stay + up ? g + 1 : Math.min(GRADE_MAX, g + 2);
    const it = make(s, rng, rng.int(lo, hi), { type: rng.pick(used).t, grade: to });
    note(s, it);
    s.inv.push(it);
    s.stats.synth++;
    const A = acctStats(s);
    cubeGain(s, cubeXpOf(g, it.l) * 3 * (1 + A.cubeExp), ev);
    if (ev) ev.emit('synth', it, to - g);
    return it;
  }
  // crafting: ore of the tier's grade + gold → an item of the chosen type in the tier's level band
  function craftCost(t) {
    const C = CRAFT_TIERS[t];
    return { ores: matsOf('ore', C.ore), n: 3 + t, gold: Math.ceil(40 * SC(C.lo)) };
  }
  const oreFor = (s, c) => c.ores.find(id => hasMat(s, id, c.n)) || null;
  const craftMaxTier = s => { let t = 0; const L = maxHeroLv(s); CRAFT_TIERS.forEach((C, i) => { if (C.lo <= L + 5) t = i; }); return t; };
  function craft(s, type, t, rng, ev) {
    if (!cubeHas(s, 'craft') || !TYPES[type] || t > craftMaxTier(s) || s.inv.length >= bagSize(s)) return null;
    const c = craftCost(t), ore = oreFor(s, c);
    if (s.gold < c.gold || !ore) return null;
    s.gold -= c.gold; useMat(s, ore, c.n);
    const C = CRAFT_TIERS[t];
    const it = make(s, rng, rng.int(C.lo, C.hi), { type, grade: rng.weighted(C.odds) });
    note(s, it);
    s.inv.push(it);
    cubeGain(s, cubeXpOf(it.g, it.l) * (1 + acctStats(s).cubeExp), ev);
    if (ev) ev.emit('craft', it);
    return it;
  }
  // sockets: 'sd' decoration gems, 'se' engraving parts, 'si' inscription scrolls
  const SOCK = { sd: { fn: 'deco', kind: 'gem' }, se: { fn: 'engrave', kind: 'part' }, si: { fn: 'inscribe', kind: 'scroll' } };
  function socket(s, it, key, matId, rng) {
    const K = SOCK[key];
    if (!K || !cubeHas(s, K.fn) || MATS[matId]?.kind !== K.kind || !hasMat(s, matId)) return false;
    const i = it[key].indexOf(null);
    if (i < 0) return false;
    useMat(s, matId);
    if (key === 'si') {
      const k = rng.pick(INSCRIBE_POOL);
      it.si[i] = [k, Math.round(inscribeValue(k, MATS[matId].grade) * rng.range(0.8, 1.2) * 10000) / 10000];
    } else it[key][i] = matId;
    cubeGain(s, 2 * Math.pow(2, MATS[matId].grade));
    return true;
  }
  const removeCost = (it, key) => REMOVE_COST[Math.min(9, Math.floor(tierOf(it.l, tiersFor(it.t)) / 2))] * { sd: 1, se: 2, si: 4 }[key];
  // removal works on bag items only; whatever sat in the socket breaks
  function unsocket(s, it, key, i) {
    if (!cubeHas(s, 'remove') || !it[key] || !it[key][i] || !s.inv.includes(it)) return false;
    const c = removeCost(it, key);
    if (s.gold < c) return false;
    s.gold -= c;
    it[key][i] = null;
    return true;
  }
  // offering: a coin and a gold fee → an item with the coin's grade odds at the deepest level reached
  const offerFee = (s, g) => Math.ceil(MATS[`coin${g}`].fee * Math.sqrt(SC(topLevel(s))));
  function offer(s, g, rng, ev) {
    const id = `coin${g}`;
    if (!cubeHas(s, 'offer') || !hasMat(s, id) || s.inv.length >= bagSize(s) || s.gold < offerFee(s, g)) return null;
    s.gold -= offerFee(s, g);
    useMat(s, id);
    const it = make(s, rng, topLevel(s), { grade: rng.weighted(MATS[id].odds) });
    note(s, it);
    s.inv.push(it);
    cubeGain(s, cubeXpOf(it.g, it.l), ev);
    if (ev) ev.emit('offer', it);
    return it;
  }

  // ---------- rewards from achievements ----------
  function grant(s, rw, ev) {
    if (!rw) return;
    if (rw.gold) { s.gold += rw.gold; s.stats.gold += rw.gold; }
    if (rw.chest !== undefined) {
      const d = topDiff(s), L = topLevel(s), a = Math.min(ACT_COUNT, Math.floor(Math.min(FULL - 1, s.prog.best[d]) / STAGES) + 1);
      for (let i = 0; i < (rw.n || 1); i++) addChest(s, { k: rw.chest, d, L, a }, ev);
    }
  }

  return {
    make, name, typeLabel, slotOf, gain, bestFor, isUpgrade, receive, equip, unequip, autoEquip, note,
    alch, alchMany, alchOf, matValue, alchMat, cubeGain, addMat, hasMat, useMat, rollMat,
    addChest, open, chestWeights, chestGrade, cubeHas, synthPick, recipeOk, synthOk, synth, craftCost, oreFor, craftMaxTier, craft,
    socket, removeCost, unsocket, offerFee, offer, grant,
  };
})();
