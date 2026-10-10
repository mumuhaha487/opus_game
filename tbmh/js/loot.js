'use strict';
// =====================================================================
//  LOOT — items, chests, materials, the cube, slot enhancement
// =====================================================================
const Loot = (() => {
  const SLOT_WEIGHTS = { main: 14, off: 11, head: 9, chest: 9, hands: 9, feet: 9, neck: 8, ear: 8, ring: 9, wrist: 8, medal: 6 };
  const slotPick = rng => SLOTS[rng.weighted(SLOTS.map(k => SLOT_WEIGHTS[k]))];

  // ---------- grades ----------
  // boost tilts the weights toward the higher grades; the difficulty caps what can drop
  function rollGrade(rng, d, o = {}) {
    const cap = o.cap ?? DIFFS[d].maxGrade, floor = Math.min(o.floor || 0, cap), boost = o.boost || 1;
    const w = DROP_WEIGHTS[d].map((v, i) => (i < floor || i > cap ? 0 : v * Math.pow(boost, i / 2)));
    let g = rng.weighted(w);
    if (o.S && o.S.gradeUp && g < cap && rng.chance(o.S.gradeUp)) g++;
    return g;
  }
  function rollAffix(rng, id, g, l) {
    const [a, b] = AFFIXES[id].r;
    return Math.round(lerp(a, b, rng.next()) * (1 + 0.12 * g) * (1 + l / 150) * 10000) / 10000;
  }
  function make(s, rng, ilvl, o = {}) {
    const type = o.type || rng.pick(TYPES_BY_SLOT[o.slot || slotPick(rng)]);
    const g = clamp(o.grade ?? rollGrade(rng, o.d || 0, o), 0, GRADE_MAX), l = clamp(Math.floor(ilvl), 1, 100);
    const it = newItem(s, type, g, l);
    it.q = Math.round(rng.range(0.9, 1.1) * 1000) / 1000;
    const pool = AFFIX_IDS.slice();
    for (let i = 0; i < GRADES[g].affixes; i++) {
      const id = pool.splice(Math.floor(rng.next() * pool.length), 1)[0];
      it.s.push([id, rollAffix(rng, id, g, l)]);
    }
    if (g >= 4) { const list = legendsFor(type); if (list.length) it.lg = rng.pick(list); }
    if (TYPES[type].elemRoll) it.el = rng.pick(TYPES[type].elemRoll);
    return it;
  }
  const name = it => (it.lg ? `${LEGENDS[it.lg].item}·` : '') + itemTypeName(it.t, it.l);
  const typeLabel = it => TYPES[it.t].name + (it.el ? '·' + ELEM[it.el].name : '');

  // ---------- comparing ----------
  const slotOf = it => TYPES[it.t].slot;
  function gain(s, it, S0) {
    const L = stageLevel(s.prog.d, s.prog.a, s.prog.s), d = s.prog.d;
    const now = powerOf(S0 || computeStats(s), L, d), next = powerOf(computeStats(s, { swap: { slot: slotOf(it), item: it } }), L, d);
    return next / now - 1;
  }
  const isUpgrade = (s, it, S0) => gain(s, it, S0) > 0.0005;

  // ---------- the bag ----------
  function note(s, it) {
    s.stats.items++;
    s.codex.n[it.t] = (s.codex.n[it.t] || 0) | (1 << tierOf(it.l));
    if (it.g > s.stats.bestGrade) s.stats.bestGrade = it.g;
    if (it.lg) { s.stats.legends++; s.codex.l[it.lg] = 1; }
  }
  // a new item: keep it, or turn it into gold through the auto-alchemy filter
  function receive(s, it, ev, S) {
    note(s, it);
    S = S || computeStats(s);
    const up = s.keepUp && isUpgrade(s, it, S);
    if (S.autoAlch && s.cube.filter[it.g] && !up && !it.lg) { alch(s, it, ev, S); return false; }
    if (s.inv.length >= bagSize(s)) { alch(s, it, ev, S, 'full'); return false; }
    s.inv.push(it);
    if (ev) ev.emit('item', it);
    if (s.opts.autoEquip && up) equip(s, it.u);
    return true;
  }
  function equip(s, u) {
    const i = s.inv.findIndex(x => x.u === u);
    if (i < 0) return false;
    const it = s.inv[i], slot = slotOf(it), oldFam = famOf(s);
    s.inv.splice(i, 1);
    if (s.eq[slot]) s.inv.push(s.eq[slot]);
    s.eq[slot] = it;
    if (slot === 'main' && famOf(s) !== oldFam && s.opts.autoSkill) Skills.refit(s);
    return true;
  }
  function unequip(s, slot) {
    if (!s.eq[slot] || slot === 'main' || s.inv.length >= bagSize(s)) return false;
    s.inv.push(s.eq[slot]); s.eq[slot] = null;
    return true;
  }
  // best item per slot by 战力
  function autoEquip(s) {
    let changed = 0;
    for (const slot of SLOTS) {
      let best = null, bestG = 0.0005;
      const S0 = computeStats(s);
      for (const it of s.inv) if (slotOf(it) === slot) { const g = gain(s, it, S0); if (g > bestG) { bestG = g; best = it; } }
      if (best) { equip(s, best.u); changed++; }
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
  // gold grows with item level; cube experience follows the grade table (alchValue in data.js)
  const alchOf = (it, S) => ({ gold: alchGoldOf(it.g, it.l) * S.alchGold, exp: (alchValue(it.g, it.l) / 4) * S.cubeExp });
  function alch(s, it, ev, S, why) {
    S = S || computeStats(s);
    const v = alchOf(it, S);
    s.gold += v.gold; s.stats.gold += v.gold; s.stats.alch++;
    cubeGain(s, v.exp, ev);
    if (ev) ev.emit('alch', it, v.gold, why);
    return v.gold;
  }
  function alchMany(s, pred, ev) {
    const S = computeStats(s);
    let n = 0, gold = 0;
    s.inv = s.inv.filter(it => { if (it.k || !pred(it)) return true; n++; gold += alch(s, it, null, S); return false; });
    if (n && ev) ev.emit('alchMany', n, gold);
    return { n, gold };
  }
  // materials: gold and cube experience by grade
  function matValue(id) {
    const M = MATS[id], g = M.grade || 0;
    const base = { gem: 15, part: 10, scroll: 40, ore: 20, coin: 500, wanted: 2000 }[M.kind] || 10;
    return base * Math.pow(3, g);
  }
  function alchMat(s, id, n, ev) {
    n = Math.min(n, s.mats[id] || 0);
    if (n <= 0) return 0;
    const S = computeStats(s), v = matValue(id) * n;
    useMat(s, id, n);
    const gold = v * S.alchGold;
    s.gold += gold; s.stats.gold += gold;
    cubeGain(s, (v / 20) * S.cubeExp, ev);
    if (ev) ev.emit('alchMany', n, gold);
    return gold;
  }

  // ---------- materials ----------
  const addMat = (s, id, n = 1) => { if (MATS[id] && n > 0) s.mats[id] = (s.mats[id] || 0) + n; };
  const hasMat = (s, id, n = 1) => (s.mats[id] || 0) >= n;
  const useMat = (s, id, n = 1) => { if (!hasMat(s, id, n)) return false; s.mats[id] -= n; if (!s.mats[id]) delete s.mats[id]; return true; };
  const matGrade = (rng, d, a, bonus = 0) => clamp(d * 2 + Math.floor((a - 1) / 4) + (rng.chance(0.25) ? 1 : 0) + bonus, 0, 9);
  const oreTier = L => clamp(Math.floor((L - 1) / 10), 0, 9);
  function rollMat(rng, ch) {
    const r = rng.next(), g = matGrade(rng, ch.d, ch.a, ch.k === 2 ? 1 : 0);
    if (r < 0.38) return `gem_${rng.pick(GEM_IDS)}_${g}`;
    if (r < 0.68) { const fams = ACTS[ch.a - 1].mobs.map(id => MONSTERS[id].fam); return `${FAMILIES[rng.pick(fams)].part}_${g}`; }
    if (r < 0.88 || ch.k === 0) return `ore_${clamp(oreTier(ch.L) - (rng.chance(0.3) ? 1 : 0), 0, 9)}`;
    if (r < 0.95) return `scroll_${Math.max(0, g - 1)}`;
    return 'chaos';
  }

  // ---------- chests ----------
  // a chest remembers where it dropped: difficulty, region and monster level
  function addChest(s, ch, ev, S) {
    S = S || computeStats(s);
    const auto = ch.k === 0 ? S.autoN : S.autoB;
    if (auto) { open(s, ch, ev, S); return true; }
    if (s.tray.length >= S.tray) { if (ev) ev.emit('trayFull', ch); return false; }
    s.tray.push(ch);
    if (ev) ev.emit('chest', ch);
    return true;
  }
  function open(s, ch, ev, S, rng = RNG((s.seed + s.stats.opened * 7919 + s.uid) >>> 0)) {
    S = S || computeStats(s);
    const C = CHESTS[ch.k], res = { ch, items: [], mats: [], gold: 0 };
    s.stats.opened++;
    for (let i = 0; i < C.items; i++) {
      const it = make(s, rng, ch.L - rng.int(0, 2), { d: ch.d, floor: C.floor, boost: C.boost, S });
      if (S.lg.seeker && it.g < DIFFS[ch.d].maxGrade && rng.chance(0.15 * S.lg.seeker)) regrade(it, it.g + 1);
      res.items.push({ it, kept: receive(s, it, null, S) });
    }
    const nm = C.mats[0] < 1 ? (rng.chance(C.mats[0]) ? 1 : 0) : rng.int(C.mats[0], C.mats[1]);
    for (let i = 0; i < nm; i++) { const id = rollMat(rng, ch); addMat(s, id); res.mats.push(id); }
    if (C.wanted && rng.chance(C.wanted * (1 + S.wantedDrop))) { addMat(s, `wanted_${ch.d}`); res.mats.push(`wanted_${ch.d}`); }
    if (C.coin && rng.chance(C.coin)) { const id = `coin_${matGrade(rng, ch.d, ch.a)}`; addMat(s, id); res.mats.push(id); }
    res.gold = C.gold * CURVE.gold(ch.L) * DIFFS[ch.d].gold * S.gold;
    s.gold += res.gold; s.stats.gold += res.gold;
    if (ev) ev.emit('open', res);
    return res;
  }
  function openAt(s, i, ev) { const ch = s.tray[i]; if (!ch) return null; s.tray.splice(i, 1); return open(s, ch, ev); }
  // regrade keeps the item's identity and fills the new grade's affixes and sockets
  function regrade(it, g) {
    const rng = RNG((it.u * 2654435761 + g) >>> 0);
    it.g = g;
    const pool = AFFIX_IDS.filter(id => !it.s.some(a => a[0] === id));
    while (it.s.length < GRADES[g].affixes && pool.length) { const id = pool.splice(Math.floor(rng.next() * pool.length), 1)[0]; it.s.push([id, rollAffix(rng, id, g, it.l)]); }
    const K = GRADES[g].sockets;
    while (it.sd.length < K[0]) it.sd.push(null);
    while (it.se.length < K[1]) it.se.push(null);
    while (it.si.length < K[2]) it.si.push(null);
    if (g >= 4 && !it.lg) { const list = legendsFor(it.t); if (list.length) it.lg = rng.pick(list); }
  }

  // ---------- the cube ----------
  const cubeHas = (s, id) => s.cube.lv >= CUBE_FUNCS.find(f => f.id === id).lv;
  // 9 items of one grade become one of the next grade (5%: two grades up)
  function synthPick(s, g) {
    return s.inv.filter(it => it.g === g && !it.k).sort((a, b) => a.l - b.l).slice(0, 9);
  }
  function synthOk(s, g) { return g < GRADE_MAX && s.cube.lv >= SYNTH_REQ[g + 1] && synthPick(s, g).length >= 9; }
  function synth(s, g, rng, ev) {
    if (!synthOk(s, g)) return null;
    const used = synthPick(s, g), ids = new Set(used.map(x => x.u));
    s.inv = s.inv.filter(x => !ids.has(x.u));
    let to = g + 1;
    if (to < GRADE_MAX && s.cube.lv >= SYNTH_REQ[to + 1] && rng.chance(0.05)) to++;
    const l = Math.ceil(used.reduce((a, x) => a + x.l, 0) / used.length);
    const it = make(s, rng, l, { type: rng.pick(used).t, grade: to });
    note(s, it);
    s.inv.push(it);
    s.stats.synth++;
    const S = computeStats(s);
    cubeGain(s, (alchValue(to, l) / 4) * S.cubeExp, ev);
    if (ev) ev.emit('synth', it, to - g);
    return it;
  }
  // crafting: ore + gold → a random item of a chosen type and level band
  function craftCost(tier) {
    const l = ILVL_TIERS[tier];
    return { ore: `ore_${Math.min(9, Math.floor(tier / 2))}`, n: 3 + Math.floor(tier / 3), gold: Math.ceil(30 * SC(l)) };
  }
  // the lowest ore of the required tier or better that covers the cost
  function oreFor(s, id, n) { for (let t = +id.split('_')[1]; t < 10; t++) if (hasMat(s, `ore_${t}`, n)) return `ore_${t}`; return null; }
  const craftMaxTier = s => tierOf(topLevel(s));
  function craft(s, type, tier, rng, ev) {
    if (!cubeHas(s, 'craft') || !TYPES[type] || tier > craftMaxTier(s) || s.inv.length >= bagSize(s)) return null;
    const c = craftCost(tier), ore = oreFor(s, c.ore, c.n);
    if (s.gold < c.gold || !ore) return null;
    s.gold -= c.gold; useMat(s, ore, c.n);
    const S = computeStats(s);
    const it = make(s, rng, ILVL_TIERS[tier] + rng.int(0, 4), { type, d: topDiff(s), floor: 1, S });
    note(s, it);
    s.inv.push(it);
    cubeGain(s, (c.gold / 50) * S.cubeExp, ev);
    if (ev) ev.emit('craft', it);
    return it;
  }
  // sockets: kind 'sd' gems, 'se' monster parts, 'si' inscription scrolls
  const SOCK = { sd: { fn: 'gem', kind: 'gem' }, se: { fn: 'engrave', kind: 'part' }, si: { fn: 'inscribe', kind: 'scroll' } };
  function socket(s, it, key, matId, rng) {
    const K = SOCK[key];
    if (!K || !cubeHas(s, K.fn) || MATS[matId]?.kind !== K.kind || !hasMat(s, matId)) return false;
    const i = it[key].indexOf(null);
    if (i < 0) return false;
    useMat(s, matId);
    if (key === 'si') {
      const g = MATS[matId].grade, k = rng.pick(INSCRIPTION_IDS);
      it.si[i] = [k, Math.round(INSCRIPTIONS[k].v(g) * rng.range(0.8, 1.2) * 10000) / 10000];
    } else it[key][i] = matId;
    return true;
  }
  function unsocket(s, it, key, i) {
    if (!cubeHas(s, 'remove') || !it[key] || !it[key][i]) return false;
    it[key][i] = null;
    return true;
  }
  // offering: a commemorative coin → an item of that grade at your current level
  function offer(s, g, rng, ev) {
    const id = `coin_${g}`;
    if (!cubeHas(s, 'offer') || !hasMat(s, id) || s.inv.length >= bagSize(s)) return null;
    useMat(s, id);
    const it = make(s, rng, topLevel(s), { grade: g });
    note(s, it);
    s.inv.push(it);
    cubeGain(s, alchValue(g, it.l) / 8, ev);
    if (ev) ev.emit('offer', it);
    return it;
  }
  const rerollCost = it => ({ gold: Math.ceil(200 * SC(it.l) * (1 + it.g)), chaos: 1 });
  function reroll(s, it, idx, rng) {
    const c = rerollCost(it);
    if (!cubeHas(s, 'reroll') || !it.s[idx] || s.gold < c.gold || !hasMat(s, 'chaos', c.chaos)) return false;
    s.gold -= c.gold; useMat(s, 'chaos', c.chaos);
    const taken = new Set(it.s.map(a => a[0]));
    const pool = AFFIX_IDS.filter(id => !taken.has(id) || id === it.s[idx][0]);
    const id = rng.pick(pool);
    it.s[idx] = [id, rollAffix(rng, id, it.g, it.l)];
    return true;
  }

  // ---------- slot enhancement ----------
  // any ore of the required tier or better will do; the lowest one that suffices is used
  function enhOre(s, n) {
    const c = enhCost(n);
    for (let t = c.ore; t < 10; t++) if (hasMat(s, `ore_${t}`, c.oreN)) return `ore_${t}`;
    return null;
  }
  function enhance(s, slot) {
    const n = s.enh[slot];
    if (n >= ENH_MAX) return false;
    const c = enhCost(n), ore = enhOre(s, n);
    if (s.gold < c.gold || !ore) return false;
    s.gold -= c.gold; useMat(s, ore, c.oreN); s.enh[slot]++;
    return true;
  }

  // ---------- rewards from achievements and contracts ----------
  function grant(s, rw, ev) {
    if (!rw) return;
    if (rw.gold) { s.gold += rw.gold; s.stats.gold += rw.gold; }
    const d = topDiff(s), L = topLevel(s), a = Math.min(ACT_COUNT, Math.floor(Math.min(FULL - 1, s.prog.best[d]) / STAGES) + 1);
    if (rw.chest) {
      const [k, n] = Array.isArray(rw.chest) ? rw.chest : [CHESTS.findIndex(c => c.id === rw.chest), rw.n || 1];
      const S = computeStats(s);
      for (let i = 0; i < n; i++) addChest(s, { k, d, L, a }, ev, S);
    }
    if (rw.mat) addMat(s, rw.mat[0], rw.mat[1]);
    if (rw.wanted) addMat(s, `wanted_${d}`, rw.wanted);
  }

  return {
    make, name, typeLabel, slotOf, gain, isUpgrade, receive, equip, unequip, autoEquip, rollGrade, regrade,
    alch, alchMany, alchOf, matValue, alchMat, cubeGain, addMat, hasMat, useMat, rollMat, oreTier,
    addChest, open, openAt, cubeHas, synthPick, synthOk, synth, craftCost, oreFor, craftMaxTier, craft, socket, unsocket, offer, rerollCost, reroll,
    enhOre, enhance, grant,
  };
})();
