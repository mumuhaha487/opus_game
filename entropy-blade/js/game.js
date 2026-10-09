'use strict';
// =====================================================================
//  GAME — global state, run flow, rooms, waves, interactables, render
// =====================================================================
// each scene: rooms 1–5, a rest / shop stop at 6, the boss at 7
const BOSS_DEPTH = 7;
// rooms grew from 6 to 8 per scene (incl. the entrance): scale per-room growth so a scene ramps as before
const ROOM_PACE = 6 / (BOSS_DEPTH + 1);
const G = {
  state: 'boot', time: 0, rtime: 0,
  room: null, player: null,
  enemies: [], projs: [], zones: [], pickups: [], timers: [], inters: [],
  run: null, stats: null, rs: null,
  freeze: 0, slowT: 0, slowS: 1, cine: 0, dim: 0, witchT: 0,
  overlay: null, trans: null, toasts: [], banner: null, boss: null, bossIntro: null, bossPhaseText: null,
  deathT: 0,
  hitstop(n) { if (n > this.freeze) this.freeze = Math.min(n, 12); },
  slowmo(t, s) { this.slowT = t; this.slowS = s; },
  cinematic(t) { this.cine = Math.max(this.cine, t); },
  toast(title, col, sub) { this.toasts.push({ title, col: col || '#fff', sub, t: 0 }); if (this.toasts.length > 3) this.toasts.shift(); },
};

// monster pools per biome index: mostly scene-specific, plus a couple of shared vermin
const POOLS = {
  0: [{ t: 'soldier', w: 2.6 }, { t: 'lantern', w: 2 }, { t: 'tengu', w: 1.6 }, { t: 'kitsune', w: 1.5 }, { t: 'ninja', w: 1.8 }, { t: 'crawler', w: 1.4 }, { t: 'bomber', w: 1 }],
  3: [{ t: 'yukiko', w: 2.4 }, { t: 'icebat', w: 2 }, { t: 'monk', w: 1.3 }, { t: 'wolf', w: 1.8 }, { t: 'sniper', w: 1.4 }, { t: 'crawler', w: 1 }],
  1: [{ t: 'spider', w: 2.2 }, { t: 'prism', w: 1.2 }, { t: 'drone', w: 2 }, { t: 'knight', w: 1.3 }, { t: 'charger', w: 1.5 }, { t: 'bomber', w: 1 }],
  2: [{ t: 'caster', w: 2 }, { t: 'soldier', w: 1.6 }, { t: 'sniper', w: 1.4 }, { t: 'shade', w: 2 }, { t: 'tentacle', w: 1.4 }, { t: 'crawler', w: 1 }, { t: 'bomber', w: 1 }],
};
const REWARD_INFO = {
  sigil: { name: '刻印', icon: 'star', col: '#c46aff' },
  'sigil+': { name: '稀有刻印', icon: 'crown', col: '#ffc83a' },
  art: { name: '武学', icon: 'sword', col: '#ff8a5a' },
  gold: { name: '金币', icon: 'coin', col: '#ffd23f' },
  heal: { name: '生命回复', icon: 'heart', col: '#ff3b5c' },
  maxhp: { name: '生命上限', icon: 'shield', col: '#ff7a9a' },
  upgrade: { name: '淬炼', icon: 'burst', col: '#5aa8ff' },
  crystal: { name: '熵晶', icon: 'shard', col: '#b46cff' },
};
const ROOM_INFO = {
  combat: { name: '战斗', col: '#e8e0ff' }, elite: { name: '精英战', col: '#ffc83a' }, shop: { name: '黑市商人', col: '#ffd23f', icon: 'coin' },
  rest: { name: '休憩之泉', col: '#6aff8a', icon: 'drop' }, event: { name: '混沌祭坛', col: '#ff3048', icon: 'eye' }, boss: { name: '首领', col: '#ff3048', icon: 'skull' },
  start: { name: '入口', col: '#ffffff' },
};

// =====================================================================
//  RUN
// =====================================================================
function newStats() { return { kills: 0, dmgTaken: 0, gold: 0, maxCombo: 0, rooms: 0, blessings: 0, skills: 0, ults: 0, bosses: 0 }; }
function startRun(heroId, weaponId, trialSel, mode = 'normal') {
  const T = Talents.values();
  if (!WEAPONS[weaponId] || WEAPONS[weaponId].hero !== heroId) weaponId = heroWeapons(heroId)[0].id;
  if (!SPR[heroId] || SPR[heroId].weapon !== weaponId) bakeHero(heroId, weaponId);
  const hard = trialSel || mode === 'trial' ? trialConfig(trialSel || {}) : null;
  mode = hard ? 'trial' : mode === 'hard' ? 'hard' : 'normal';
  G.run = {
    heroId, weaponId, seed: (Math.random() * 1e9) | 0, scene: 0, biome: SCENES[0].bi, depth: 0, globalRoom: 0,
    gold: T.start + (hard ? hard.startGold : 0), crystals: 0, rerolls: T.reroll + (hard ? hard.rerolls : 0), diff: { hp: 1, dmg: 1 }, dmgTakenMult: 1, bossHpMul: 1,
    shopSeen: {}, eventSeen: {}, time: 0, extraBless: T.bless, hard, mode,
    layouts: [], artDepths: [],
  };
  planArtDepths(G.run);
  G.stats = newStats();
  G.player = new Player(heroId, 80, 100, weaponId);
  G.player.revives = (hard && hard.noRevive ? 0 : T.revive) + (hard ? hard.revives : 0);
  Save.data.stats.runs++;
  Save.data.lastChar = HERO_ORDER.indexOf(heroId);
  Save.data.lastWeapon = Object.assign({}, Save.data.lastWeapon, { [heroId]: weaponId });
  if (!hard) Save.data.lastMode = mode;
  Save.write();
  G.state = 'play';
  G.overlay = null;
  enterRoom({ type: 'start' }, true);
}
function endRun(win) {
  const r = G.run;
  const st = Save.data.stats;
  r.crystals += win ? 40 : 0;
  if (r.hard) r.crystals = Math.round(r.crystals * r.hard.crystalMul);
  Save.data.crystals += r.crystals;
  st.crystalsTotal += r.crystals;
  st.kills += G.stats.kills;
  st.deepest = Math.max(st.deepest, r.scene * 10 + r.depth);
  if (win) { st.wins++; if (!st.bestTime || r.time < st.bestTime) st.bestTime = r.time; if (r.hard) st.bestTrial = Math.max(st.bestTrial || 0, r.hard.pts); }
  // 评分 per hero (shown as 最高评分 on the select card)
  const score = runScore(r, G.stats, win), hb = Save.data.heroBest || (Save.data.heroBest = {});
  const best = score > (hb[r.heroId] || 0);
  if (best) hb[r.heroId] = score;
  let titleAwarded = null;
  if (win && r.hard && r.hard.pts >= 40 && !Save.data.titles.includes('劫主')) {
    Save.data.titles.push('劫主');
    titleAwarded = '劫主';
  }
  Save.write();
  G.state = win ? 'victory' : 'gameover';
  G.overlay = null;
  UI.endScreen = { t: 0, win, sel: 0, score, best, titleAwarded };
  Sound.music(win ? 'victory' : 'gameover');
}

// progress, bosses, kills and combo, scaled up by 劫难值
function runScore(r, st, win) {
  const base = r.scene * 1000 + r.depth * 150 + st.bosses * 800 + st.kills * 5 + st.maxCombo * 8 + (win ? 2000 : 0);
  return Math.round(base * (1 + (r.hard ? r.hard.pts * 0.03 : 0)));
}

function clearWorld() {
  G.enemies.length = 0; G.projs.length = 0; G.zones.length = 0; G.pickups.length = 0; G.timers.length = 0; G.inters.length = 0;
  Combat.clear(); FX.clear();
  G.boss = null; G.bossIntro = null; G.cine = 0; G.dim = 0; G.slowT = 0; G.freeze = 0; G.witchT = 0;
}

// 武学 windows: two guaranteed per scene before the boss (one early, one late; +1 with the 劫难 boon),
// and the boss always drops a third. They come on top of the door's own reward.
function planArtDepths(r) {
  const rng = RNG(r.seed + r.scene * 977 + 31);
  const last = BOSS_DEPTH - 2;
  r.artDepths = [rng.int(1, 2), rng.int(4, last)];
  if (r.hard && r.hard.artBonus) r.artDepths.push(3);
}
// pick a room layout for this scene; the first three rooms of a scene never repeat a layout
function pickLayout(r) {
  const S = SCENES[r.scene];
  const rng = RNG(r.seed + r.globalRoom * 53);
  const used = r.layouts;
  let opts = Object.keys(S.layouts).filter(k => !used.includes(k));
  if (!opts.length) opts = Object.keys(S.layouts).filter(k => k !== used[used.length - 1]);
  const l = rng.weighted(opts.map(k => ({ w: S.layouts[k], v: k })));
  used.push(l);
  return l;
}
function enterRoom(door, first) {
  const r = G.run;
  if (door.type === 'start') { r.depth = 0; r.layouts = []; } else r.depth++;
  if (!first) r.globalRoom++;
  const H = r.hard;
  r.diff = { hp: (1 + r.globalRoom * 0.13 * ROOM_PACE + r.scene * 0.4) * (H ? H.enemyHp : 1), dmg: (1 + r.globalRoom * 0.05 * ROOM_PACE + r.scene * 0.2) * (H ? H.enemyDmg : 1) };
  const seed = r.seed + r.globalRoom * 7919 + r.scene * 104729;
  const type = door.type;
  clearWorld();
  const layout = type === 'combat' || type === 'elite' ? pickLayout(r) : null;
  G.room = genRoom(seed, r.biome, type === 'elite' ? 'combat' : type, layout);
  const p = G.player;
  p.x = G.room.spawnX; p.y = G.room.spawnY; p.vx = 0; p.vy = 0;
  p.state = 'normal'; p.move = null; p.hidden = false; p.inv = Math.max(p.inv, 0.6);
  p.dashes = p.stats.dashes;
  Cam.follow(p.x, p.y - 30, G.room.pw, G.room.ph, 0, true);
  G.rs = { type, reward: door.reward, cleared: false, started: false, delay: 1.0, waves: [], waveIdx: 0, waveT: 0, pending: 0 };
  const B = BIOMES[r.biome];
  let music = B.music;
  if (type === 'combat' || type === 'elite') {
    G.rs.waves = planWaves(r.biome, r.depth, type === 'elite');
  } else if (type === 'start') {
    setupStart(first);
  } else if (type === 'shop') {
    r.shopSeen[r.scene] = true; setupShop(); music = 'rest';
  } else if (type === 'rest') {
    setupRest(); music = 'rest';
  } else if (type === 'event') {
    r.eventSeen[r.scene] = true; setupEvent();
  } else if (type === 'boss') {
    setupBoss(); music = null;
  }
  if (music) Sound.music(music);
  // a scheduled 武学 window: waiting at the entrance of shops / altars, dropped on clear in fights
  if (type !== 'start' && type !== 'boss' && r.artDepths.includes(r.depth)) {
    G.rs.bonusArt = true;
    if (G.rs.cleared) { G.inters.push(new Orb(G.room.pw * 0.3, G.room.floorBelow(G.room.pw * 0.3, G.room.base * TILE - 30) - 20, 'art')); G.rs.bonusArt = false; }
  }
  const info = ROOM_INFO[type];
  G.banner = {
    t: 0,
    title: type === 'start' ? B.name : info.name,
    sub: type === 'start' ? `${SCENES[r.scene].label} · ${B.en}` : `${B.name} · ${r.depth}/${BOSS_DEPTH}${layout ? ' · ' + LAYOUT_NAMES[layout] : ''}`,
    col: type === 'start' ? B.accent : info.col,
    big: type === 'start',
  };
  p.fire('onRoomStart');
  const difficulty = curDifficulty();
  if (difficulty && ['combat', 'elite', 'boss'].includes(type)) {
    p.shield = Math.max(p.shield, Math.round(p.maxHp * difficulty.roomShield));
  }
  G.stats.rooms++;
}

function planWaves(bi, depth, elite) {
  const r = G.run, H = r.hard;
  const rng = RNG(r.seed + r.globalRoom * 31);
  const pool = POOLS[bi] || POOLS[0];
  const costOf = t => ENEMY_DEFS[t].cost;
  const nW = (depth <= 1 ? 2 : 3) + (H ? H.extraWave : 0);
  const waves = [];
  // depth runs 1–5 now; budget it on the old 1–3 scale so late rooms don't balloon
  const dk = 1 + (depth - 1) * 2 / (BOSS_DEPTH - 3);
  for (let w = 0; w < nW; w++) {
    let budget = 3.8 + dk * 1.1 + r.scene * 1.5 + Math.min(w, 2) * 0.8;
    const list = [];
    let guard = 0;
    while (budget > 0.4 && guard++ < 30) {
      const cands = pool.filter(c => costOf(c.t) <= budget + 0.6);
      if (!cands.length) break;
      const t = rng.weighted(cands.map(c => ({ w: c.w, v: c.t })));
      list.push({ type: t });
      budget -= costOf(t);
    }
    waves.push(list);
  }
  const nE = (elite ? (r.scene >= 1 ? 2 : 1) : 0) + (H ? H.eliteExtra : 0);
  const strong = pool.filter(c => !['bomber', 'crawler', 'icebat', 'yukiko'].includes(c.t));
  for (let i = 0; i < nE; i++) waves[waves.length - 1].push({ type: rng.pick(strong).t, elite: true });
  return waves;
}
function spawnWave() {
  const rs = G.rs, p = G.player;
  const wave = rs.waves[rs.waveIdx++];
  rs.waveT = 0;
  if (!wave) return;
  const R = G.room;
  wave.forEach((s, i) => {
    rs.pending++;
    later(i * 0.18, () => {
      rs.pending--;
      if (G.state !== 'play' || G.rs !== rs) return;
      const D = ENEMY_DEFS[s.type];
      let x, y;
      if (D.flying) {
        const cands = R.airSpots.filter(a => Math.abs(a.x - p.x) > 100);
        const a = cands.length ? pick(cands) : pick(R.airSpots);
        x = a.x; y = a.y;
      } else {
        const cands = R.spots.filter(a => Math.abs(a.x - p.x) > 90 && Math.abs(a.x - p.x) < 380);
        const a = cands.length ? pick(cands) : pick(R.spots);
        x = a.x; y = a.y;
      }
      G.enemies.push(new Enemy(s.type, x, y, { elite: s.elite }));
    });
  });
}

function roomLogic(dt) {
  const rs = G.rs;
  if (!rs) return;
  if (rs.type === 'combat' || rs.type === 'elite') {
    if (!rs.started) { rs.delay -= dt; if (rs.delay <= 0) { rs.started = true; spawnWave(); } return; }
    if (rs.cleared) return;
    rs.waveT += dt;
    const alive = G.enemies.filter(e => !e.dead).length;
    if (rs.waveIdx < rs.waves.length) {
      if (rs.pending === 0 && (alive === 0 || (alive <= 1 && rs.waveT > 5))) spawnWave();
    } else if (alive === 0 && rs.pending === 0) roomClear();
  }
}

G.onEnemyKilled = function (e) {
  G.stats.kills++;
  const rs = G.rs;
  if (!rs || rs.cleared) return;
  if ((rs.type === 'combat' || rs.type === 'elite') && rs.waveIdx >= rs.waves.length && rs.pending === 0) {
    const alive = G.enemies.filter(x => !x.dead).length;
    if (alive === 0) {
      G.slowmo(0.7, 0.2);
      FX.screenFlash('#ffffff', 0.35, 0.25);
      Cam.shake(0.3);
      rs.lastPos = { x: e.x, y: e.y };
    }
  }
};

function healClearedRoom() {
  const difficulty = curDifficulty(), rs = G.rs, p = G.player;
  if (!difficulty || !rs || rs.modeHealApplied || !['combat', 'elite', 'boss'].includes(rs.type)) return;
  rs.modeHealApplied = true;
  p.heal((p.maxHp - p.hp) * difficulty.clearHeal, false, 1);
}
function roomClear() {
  const rs = G.rs, r = G.run, p = G.player;
  if (!rs || rs.cleared) return;
  rs.cleared = true;
  healClearedRoom();
  Sound.play('clear');
  G.toast('区域净化完成', '#7ff7ff');
  r.crystals += rs.type === 'elite' ? 3 : 1;
  const pos = rs.lastPos || { x: p.x + p.face * 40, y: p.y };
  const gx = clamp(pos.x, 4 * TILE, G.room.pw - 4 * TILE);
  const gy = G.room.floorBelow(gx, pos.y - 30);
  if (rs.bonusArt) {
    rs.bonusArt = false;
    const ax = clamp(gx + (gx > G.room.pw / 2 ? -40 : 40), 4 * TILE, G.room.pw - 4 * TILE);
    spawnReward('art', ax, G.room.floorBelow(ax, pos.y - 30));
    G.toast('武学现世', WX_FAM.art.col, '参悟一次武学：武技 / 技能 / 秘技');
  }
  spawnReward(rs.reward, gx, gy);
  p.fire('onRoomClear');
  openDoors();
}
function spawnReward(kind, x, y) {
  const p = G.player;
  switch (kind) {
    case 'sigil': G.inters.push(new Orb(x, y - 20, 'sigil')); break;
    case 'art': G.inters.push(new Orb(x, y - 20, 'art')); break;
    case 'sigil+': G.inters.push(new Orb(x, y - 20, 'sigil+')); dropCoins(x, y - 20, 20 + G.run.scene * 8); break;
    case 'upgrade': G.inters.push(new Orb(x, y - 20, 'upgrade')); break;
    case 'gold': dropCoins(x, y - 20, Math.round(45 + G.run.globalRoom * 4 + rand(0, 20))); Sound.play('chest'); break;
    case 'heal': G.inters.push(new Orb(x, y - 20, 'heal')); break;
    case 'maxhp': G.inters.push(new Orb(x, y - 20, 'maxhp')); break;
    case 'crystal': G.inters.push(new Orb(x, y - 20, 'crystal')); break;
  }
}
function genDoors(nextDepth) {
  const r = G.run;
  const rng = RNG(r.seed + r.globalRoom * 13 + 7);
  if (nextDepth === BOSS_DEPTH) return [{ type: 'boss' }];
  if (nextDepth === BOSS_DEPTH - 1) return [{ type: 'rest' }, { type: 'shop' }];
  const opts = [];
  const add = (w, d) => opts.push({ w, v: d });
  // 武学 never sits behind a door: it comes on the scheduled depths (planArtDepths) whichever door you take
  add(4.4, { type: 'combat', reward: 'sigil' });
  add(2.4, { type: 'combat', reward: 'gold' });
  if (Object.keys(G.player.mods).length) add(1.8, { type: 'combat', reward: 'upgrade' });
  add(1.2, { type: 'combat', reward: 'heal' });
  add(1.0, { type: 'combat', reward: 'maxhp' });
  add(1.0, { type: 'combat', reward: 'crystal' });
  if (nextDepth >= 2) add(2.0, { type: 'elite', reward: 'sigil+' });
  if (nextDepth >= 1 && !r.shopSeen[r.scene]) add(1.4, { type: 'shop' });
  if (nextDepth >= 2 && !r.eventSeen[r.scene]) add(1.2, { type: 'event' });
  const n = nextDepth === 1 ? 2 : rng.chance(0.55) ? 3 : 2;
  const out = [];
  let guard = 0;
  while (out.length < n && guard++ < 50) {
    const d = rng.weighted(opts);
    if (!out.some(o => o.type === d.type && o.reward === d.reward)) out.push(d);
  }
  if (!out.some(o => ['sigil', 'sigil+'].includes(o.reward))) out[0] = { type: 'combat', reward: 'sigil' };
  if (r.artDepths.includes(nextDepth)) for (const d of out) d.wx = true;
  return out;
}
function openDoors() {
  const R = G.room;
  let doors;
  if (G.rs.type === 'boss') {
    doors = SCENES[G.run.scene].final ? [] : [{ type: 'start', next: true }];
  } else doors = genDoors(G.run.depth + 1);
  const n = doors.length;
  doors.forEach((d, i) => {
    const x = R.pw - 4 * TILE - (n - 1 - i) * 5 * TILE - 8;
    const y = R.floorBelow(x, R.base * TILE - 40);
    G.inters.push(new Door(x, y, d));
  });
  if (n) Sound.play('door');
}

// =====================================================================
//  ROOM SETUPS
// =====================================================================
function setupStart(first) {
  const R = G.room, r = G.run;
  if (first) {
    const o = new Orb(R.pw * 0.34, R.base * TILE - 20, 'art');
    o.first = true;
    G.inters.push(o);
    G.inters.push(new Orb(R.pw * 0.46, R.base * TILE - 20, 'sigil'));
    let ox = 0.58;
    if (r.extraBless) { G.inters.push(new Orb(R.pw * ox, R.base * TILE - 20, 'sigil')); ox += 0.1; }
    // 劫难 boons
    if (r.hard && r.hard.startArt) { G.inters.push(new Orb(R.pw * ox, R.base * TILE - 20, 'art')); ox += 0.1; }
    G.showHints = 14;
  } else {
    G.inters.push(new Fountain(R.pw * 0.45, R.base * TILE, 0.3));
  }
  G.rs.cleared = true;
  openDoors();
}
function priceMul() { const H = G.run.hard; return (1 + G.run.scene * 0.25) * (H ? H.price : 1); }
function setupShop() {
  const R = G.room, p = G.player;
  G.rs.cleared = true;
  G.inters.push(new Merchant(7 * TILE, R.base * TILE));
  const items = [];
  const bl = rollSigils(p, 2, { rarityBonus: 3 });
  for (const u of bl) items.push({ kind: 'sigil', u, price: Math.round([0, 80, 120, 170, 250][u.rarity] * priceMul()) });
  if (Math.random() < 0.45) items.push({ kind: 'art', price: Math.round(170 * priceMul()) });
  items.push({ kind: 'potion', price: Math.round(50 * priceMul()) });
  items.push({ kind: 'maxhp', price: Math.round(100 * priceMul()) });
  if (upgradeTargets(p).length) items.push({ kind: 'upgrade', price: Math.round(110 * priceMul()) });
  const H = G.run.hard;
  const bargains = items.map(() => !!(H && H.shopBargainChance && Math.random() < H.shopBargainChance));
  if (bargains.every(Boolean)) bargains[bargains.length - 1] = false;
  items.forEach((it, i) => {
    it.originalPrice = it.price;
    it.discount = bargains[i] ? 0.1 : H ? H.discount : 1;
    it.price = Math.max(1, Math.round(it.originalPrice * it.discount));
    G.inters.push(new Pedestal(Math.round((10 + i * 3.5) * TILE), R.base * TILE, it));
  });
  openDoors();
}
function setupRest() {
  const R = G.room;
  G.rs.cleared = true;
  const f = new Fountain(R.pw * 0.38, R.base * TILE, 0.4 + Talents.values().heal);
  const a = new ForgeAltar(R.pw * 0.58, R.base * TILE);
  f.pair = a; a.pair = f;
  G.inters.push(f, a);
  openDoors();
}
function setupEvent() {
  const R = G.room;
  G.rs.cleared = true;
  G.inters.push(new ChaosAltar(R.pw * 0.5, R.base * TILE));
  openDoors();
}
function setupBoss() {
  const R = G.room, bi = G.run.biome, H = G.run.hard;
  const id = BIOMES[bi].boss;
  G.run.bossHpMul = H ? H.bossHp : 1;
  const b = new Boss(id, R.pw * 0.72, R.base * TILE - (BOSS_DEFS[id].flying ? 30 : 0));
  b.face = -1;
  if (H) { b.haste = H.bossHaste; b.phase2At = H.bossPhase2; }
  G.enemies.push(b);
  G.boss = b;
  G.bossIntro = { t: 0, dur: 3.0 };
  G.cine = 3.0;
  Sound.stopMusic();
  later(0.6, () => Sound.play('roar'));
  later(0.6, () => Cam.shake(0.5));
}
G.onBossKilled = function (b) {
  G.stats.bosses++;
  Save.data.stats.bossKills++;
  G.slowmo(2.2, 0.25);
  G.cine = 2.5;
  Sound.stopMusic();
  Sound.play('bossDie');
  const fr = b.frame();
  for (let i = 0; i < 8; i++) later(i * 0.12, () => {
    const x = b.x + rand(-b.w, b.w), y = b.y - rand(0, b.h);
    FX.flash(x, y, 20, BIOME_GLOW[b.bi], 0.2);
    FX.ring(x, y, 4, 40, BIOME_GLOW[b.bi], 0.4, 3);
    FX.burst(x, y, { n: 20, c: [BIOME_GLOW[b.bi], '#ffffff', '#ffd36a'], sp: [60, 240], glow: true });
    Cam.shake(0.4);
  });
  later(1.0, () => {
    FX.disintegrate(fr, b.spr.ox, b.spr.oy, b.x, b.y, b.face < 0, BIOME_GLOW[b.bi], 2);
    FX.screenFlash('#ffffff', 0.9, 0.8);
    b.hidden = true;
    G.boss = null;
  });
  const r = G.run;
  const gain = 12 + r.scene * 5;
  r.crystals += gain;
  if (SCENES[r.scene].final) {
    later(2.6, () => {
      G.rs.cleared = true;
      healClearedRoom();
      G.toast(`${b.D.name} 已陨落`, '#ff3048', '世界的熵归于平静……');
    });
    later(5.0, () => endRun(true));
    return;
  }
  later(2.4, () => {
    G.toast(`${b.D.name} 被击败`, BIOME_GLOW[b.bi], `获得 ${gain} 熵晶 · 武学与稀有刻印`);
    G.rs.cleared = true;
    const x = b.x, y = G.room.floorBelow(b.x, b.y - 20);
    const ox = clamp(x, 7 * TILE, G.room.pw - 8 * TILE);
    G.inters.push(new Orb(ox - 22, y - 20, 'sigil+'));
    G.inters.push(new Orb(ox + 22, y - 20, 'art'));
    if (r.hard && r.hard.bossSigil) G.inters.push(new Orb(ox + 66, y - 20, 'sigil+'));
    healClearedRoom();
    dropCoins(x, y - 20, 60 + r.scene * 25);
    openDoors();
    Sound.music(BIOMES[r.biome].music);
  });
};
G.onPlayerDeath = function () {
  const p = G.player;
  G.slowmo(1.8, 0.25);
  G.overlay = null;
  FX.screenFlash('#ff1030', 0.6, 0.9);
  Cam.shake(0.8);
  Sound.stopMusic();
  Sound.play('roar');
  later(0.5, () => {
    FX.disintegrate(p.frame(), p.spr.ox, p.spr.oy, p.x, p.y, p.face < 0, p.hero.color, 1.4);
    FX.ring(p.x, p.cy, 4, 60, p.hero.color, 0.6, 3);
    p.hidden = true;
  });
};
function goThrough(door) {
  if (G.trans) return;
  Sound.play('door');
  transition(() => {
    if (door.next) {
      const r = G.run;
      r.scene = Math.min(SCENES.length - 1, r.scene + 1);
      r.biome = SCENES[r.scene].bi;
      planArtDepths(r);
      enterRoom({ type: 'start' });
    } else enterRoom(door);
  });
}
function transition(cb) { G.trans = { t: 0, phase: 'out', cb }; }

// =====================================================================
//  INTERACTABLES
// =====================================================================
class Inter {
  constructor(x, y, w, h) { this.x = x; this.y = y; this.w = w; this.h = h; this.t = rand(0, 5); this.active = true; this.near = false; }
  box() { return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h }; }
  update(dt) { this.t += dt; }
  prompt() { return null; }
  use() { }
}
class Door extends Inter {
  constructor(x, y, d) { super(x, y, 26, 40); this.d = d; this.open = 0; }
  update(dt) { super.update(dt); this.open = Math.min(1, this.open + dt * 1.5); }
  prompt() { return '进入'; }
  label() {
    const d = this.d;
    if (d.next) { const nb = BIOMES[SCENES[Math.min(SCENES.length - 1, G.run.scene + 1)].bi]; return { name: '前往 · ' + nb.name, col: '#ffffff', icon: 'star', icol: nb.accent }; }
    const ri = ROOM_INFO[d.type];
    if (d.reward && G.run.hard && G.run.hard.fog) return { name: d.type === 'elite' ? '精英 · ？' : '？？？', col: d.type === 'elite' ? '#ffc83a' : '#9a8acb', icon: 'eye', icol: '#9a8acb' };
    const wx = d.wx ? ' + 武学' : '';
    if (d.reward) { const rw = REWARD_INFO[d.reward]; return { name: (d.type === 'elite' ? '精英 · ' : '') + rw.name + wx, col: d.type === 'elite' ? '#ffc83a' : rw.col, icon: rw.icon, icol: rw.col }; }
    return { name: ri.name + wx, col: ri.col, icon: ri.icon || 'star', icol: ri.col };
  }
  use() { this.active = false; goThrough(this.d); }
  draw(ctx, gctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
    const B = BIOMES[G.room.bi], L = this.label();
    const col = this.d.type === 'boss' ? '#ff3048' : this.d.type === 'elite' ? '#ffc83a' : B.accent;
    const k = Ease.outBack(this.open);
    // frame
    ctx.fillStyle = '#120c20';
    ctx.fillRect(x - 15, y - 42, 4, 42); ctx.fillRect(x + 11, y - 42, 4, 42); ctx.fillRect(x - 17, y - 46, 34, 5);
    ctx.fillStyle = col;
    ctx.fillRect(x - 15, y - 42, 1, 42); ctx.fillRect(x + 14, y - 42, 1, 42); ctx.fillRect(x - 17, y - 46, 34, 1);
    // portal swirl
    const h = 38 * k;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const a = 0.12 + i * 0.05;
      ctx.fillStyle = rgba(col, a);
      const ww = 22 - i * 3 + Math.sin(this.t * 3 + i) * 1.5;
      ctx.fillRect(x - ww / 2, y - h + i * 3, ww, h - i * 3);
    }
    for (let i = 0; i < 3; i++) {
      const py = y - ((this.t * 30 + i * 13) % 38);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 6 + ((i * 7 + Math.floor(this.t * 2)) % 12), py, 1, 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    gctx.fillStyle = col; gctx.globalAlpha = 0.6 * k; gctx.fillRect(x - 12, y - h, 24, h); gctx.globalAlpha = 1;
    Light.add(this.x, this.y - 20, 90, col, 0.9);
    // reward icon
    const ic = iconOf(L.icon, L.icol);
    const by = y - 64 + Math.sin(this.t * 3) * 2;
    ctx.fillStyle = '#0a0612'; ctx.fillRect(x - 10, by - 2, 20, 20);
    ctx.fillStyle = L.col; ctx.fillRect(x - 10, by - 2, 20, 1); ctx.fillRect(x - 10, by + 17, 20, 1);
    ctx.drawImage(ic, x - 8, by);
    gctx.drawImage(ic, x - 8, by);
    // scheduled 武学 window behind this door (hidden under the 迷雾 curse)
    if (this.d.wx && !(G.run.hard && G.run.hard.fog)) {
      const sy = by - 20, sc = iconOf('scroll', WX_FAM.art.col);
      ctx.fillStyle = '#0a0612'; ctx.fillRect(x - 8, sy - 1, 16, 16);
      ctx.drawImage(sc, x - 8, sy - 1, 16, 16);
      gctx.globalAlpha = 0.5 + 0.3 * Math.sin(this.t * 4); gctx.drawImage(sc, x - 8, sy - 1, 16, 16); gctx.globalAlpha = 1;
    }
  }
}
class Orb extends Inter {
  constructor(x, y, kind) { super(x, y, 18, 20); this.kind = kind; this.y0 = y; this.appear = 0; }
  update(dt) {
    super.update(dt); this.appear = Math.min(1, this.appear + dt * 2);
    const p = G.player;
    if (['heal', 'maxhp', 'crystal'].includes(this.kind) && p && !p.dead && overlap(this.box(), p.hurtbox()) && this.appear >= 1) this.use();
  }
  info() { return REWARD_INFO[this.kind]; }
  prompt() { return { upgrade: '淬炼', sigil: '铭刻刻印', 'sigil+': '铭刻刻印', art: '参悟武学' }[this.kind] || null; }
  use() {
    const p = G.player;
    this.active = false;
    FX.ring(this.x, this.y - 8, 4, 40, this.info().col, 0.4, 3);
    FX.burst(this.x, this.y - 8, { n: 24, c: [this.info().col, '#ffffff'], sp: [40, 160], glow: true });
    switch (this.kind) {
      case 'sigil': openSigils({ rarityBonus: G.run.scene * 2 }, '铭刻一枚刻印'); Sound.play('upgrade'); break;
      case 'sigil+': openSigils({ minRarity: 2, rarityBonus: 6 }, '稀有刻印'); Sound.play('upgrade'); break;
      case 'art': openArts(this.first ? '初悟武技 · 选择第一门方向武技' : '参悟武学', this.first); Sound.play('upgrade'); break;
      case 'upgrade': openUpgrade(); Sound.play('upgrade'); break;
      case 'heal': p.heal(p.maxHp * 0.35); break;
      case 'maxhp': {
        const gain = p.maxHpGain(15);
        p.counters.bonusHp = (p.counters.bonusHp || 0) + 15; p.recalc(); G.toast(`生命上限 +${gain}`, '#ff7a9a'); Sound.play('pickup'); break;
      }
      case 'crystal': G.run.crystals += 6; G.toast('熵晶 +6', '#b46cff'); Sound.play('pickup'); break;
    }
  }
  draw(ctx, gctx, cx, cy) {
    const inf = this.info();
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy + Math.sin(this.t * 2.5) * 3);
    const s = Ease.outBack(this.appear);
    Light.add(this.x, this.y - 6, 110, inf.col, 1);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const a = this.t * (1.5 + i) + i;
      ctx.strokeStyle = rgba(inf.col, 0.5); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(x, y - 8, 13 * s, 5 * s, a, 0, TAU); ctx.stroke();
    }
    ctx.fillStyle = rgba(inf.col, 0.5); ctx.beginPath(); ctx.arc(x, y - 8, 9 * s, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    gctx.fillStyle = inf.col; gctx.beginPath(); gctx.arc(x, y - 8, 14 * s, 0, TAU); gctx.fill();
    if (s > 0.5) ctx.drawImage(iconOf(inf.icon, inf.col), x - 8, y - 16);
    if (Math.random() < 0.3) FX.add({ k: 'px', x: this.x + rand(-8, 8), y: this.y - 8 + rand(-8, 8), vx: 0, vy: -30, life: 0.5, s: 1, c: inf.col, glow: true, add: true });
  }
}
class Pedestal extends Inter {
  constructor(x, y, item) { super(x, y, 24, 36); this.item = item; this.sold = false; }
  name() { const it = this.item; return it.kind === 'sigil' ? it.u.name : { art: '武学秘卷', potion: '回春丹', maxhp: '血玉', upgrade: '淬炼石' }[it.kind]; }
  desc() {
    const it = this.item;
    if (it.kind === 'sigil') return `【${SCHOOLS[it.u.school].name}】` + it.u.desc((G.player.mods[it.u.id] || 0) + 1);
    const p = G.player;
    return { art: '参悟一次武学：习得或精进武技（↑/↓/冲刺 + 攻击）、精进或转修秘技、解锁招式', potion: `回复 ${Math.round(40 * p.stats.supplyHealMul * p.stats.healMul)}% 最大生命`, maxhp: `最大生命 +${p.maxHpGain(20)}`, upgrade: '将一枚刻印、一个武技或一个秘技提升一级' }[it.kind];
  }
  icon() { const it = this.item; return it.kind === 'sigil' ? iconOf(it.u.icon, SCHOOLS[it.u.school].col) : it.kind === 'art' ? iconOf('scroll', '#ff8a5a') : it.kind === 'potion' ? iconOf('drop', '#ff3b5c') : it.kind === 'maxhp' ? iconOf('heart', '#ff7a9a') : iconOf('burst', '#5aa8ff'); }
  prompt() { return this.sold ? null : `购买 ${this.item.price}金`; }
  use() {
    const p = G.player, it = this.item;
    if (G.run.gold < it.price) { Sound.play('error'); G.toast('金币不足', '#ff5a5a'); return; }
    G.run.gold -= it.price;
    this.sold = true; this.active = false;
    Sound.play('buy');
    if (it.kind === 'sigil') { takeSigil(p, it.u); G.toast(`铭刻：${it.u.name}`, SCHOOLS[it.u.school].col); }
    else if (it.kind === 'art') openArts('武学秘卷');
    else if (it.kind === 'potion') p.heal(p.maxHp * 0.4 * p.stats.supplyHealMul);
    else if (it.kind === 'maxhp') { const gain = p.maxHpGain(20); p.counters.bonusHp = (p.counters.bonusHp || 0) + 20; p.recalc(); G.toast(`生命上限 +${gain}`, '#ff7a9a'); }
    else if (it.kind === 'upgrade') openUpgrade();
  }
  draw(ctx, gctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
    ctx.fillStyle = '#1a1430'; ctx.fillRect(x - 8, y - 10, 16, 10);
    ctx.fillStyle = '#2c2450'; ctx.fillRect(x - 10, y - 12, 20, 3);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(x - 10, y - 12, 20, 1);
    if (this.sold) return;
    const iy = y - 34 + Math.sin(this.t * 2) * 2;
    const ic = this.icon();
    ctx.drawImage(ic, x - 8, iy);
    gctx.globalAlpha = 0.6; gctx.drawImage(ic, x - 8, iy); gctx.globalAlpha = 1;
    Light.add(this.x, this.y - 26, 50, '#ffd23f', 0.5);
    Text.draw(ctx, String(this.item.price), x, y - 9, { size: 8, color: G.run.gold >= this.item.price ? '#ffd23f' : '#ff5a5a', outline: '#0a0612', align: 'center' });
  }
}
class Fountain extends Inter {
  constructor(x, y, amt) { super(x, y, 30, 30); this.amt = amt; this.used = false; }
  prompt() { const p = G.player; return this.used ? null : `休憩（回复 ${Math.round(this.amt * p.stats.supplyHealMul * p.stats.healMul * 100)}% 生命）`; }
  use() {
    const p = G.player;
    this.used = true; this.active = false;
    p.heal(p.maxHp * this.amt * p.stats.supplyHealMul);
    FX.ring(this.x, this.y - 10, 4, 50, '#6aff8a', 0.5, 3);
    if (this.pair) { this.pair.active = false; this.pair.used = true; }
  }
  draw(ctx, gctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
    ctx.fillStyle = '#1e2a3a'; ctx.fillRect(x - 16, y - 8, 32, 8);
    ctx.fillStyle = '#2e4258'; ctx.fillRect(x - 16, y - 9, 32, 2);
    ctx.fillStyle = '#1e2a3a'; ctx.fillRect(x - 3, y - 26, 6, 18); ctx.fillRect(x - 8, y - 28, 16, 3);
    if (!this.used) {
      ctx.fillStyle = '#4affb0'; ctx.fillRect(x - 14, y - 7, 28, 3);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) { const ph = (this.t * 2 + i / 5) % 1; ctx.fillStyle = rgba('#6aff8a', 1 - ph); ctx.fillRect(x - 2 + Math.sin(i * 7) * 6 * ph, y - 30 - Math.sin(ph * Math.PI) * 8 + ph * 22, 1, 2); }
      ctx.globalCompositeOperation = 'source-over';
      gctx.fillStyle = '#4affb0'; gctx.fillRect(x - 14, y - 8, 28, 5);
      Light.add(this.x, this.y - 10, 90, '#6aff8a', 0.9);
    }
  }
}
class ForgeAltar extends Inter {
  constructor(x, y) { super(x, y, 26, 30); this.used = false; }
  prompt() { return this.used ? null : (upgradeTargets(G.player).length ? '淬炼（提升刻印 / 武技 / 秘技）' : '淬炼（暂无可提升对象）'); }
  use() {
    if (!upgradeTargets(G.player).length) { Sound.play('error'); return; }
    this.used = true; this.active = false;
    if (this.pair) { this.pair.active = false; this.pair.used = true; }
    openUpgrade();
  }
  draw(ctx, gctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
    ctx.fillStyle = '#20182e'; ctx.fillRect(x - 12, y - 14, 24, 14);
    ctx.fillStyle = '#3a2c50'; ctx.fillRect(x - 14, y - 16, 28, 3);
    ctx.fillStyle = '#5aa8ff'; ctx.fillRect(x - 14, y - 16, 28, 1);
    if (!this.used) {
      const iy = y - 34 + Math.sin(this.t * 2) * 2;
      ctx.drawImage(iconOf('burst', '#5aa8ff'), x - 8, iy);
      gctx.fillStyle = '#5aa8ff'; gctx.fillRect(x - 8, iy, 16, 16);
      Light.add(this.x, this.y - 20, 80, '#5aa8ff', 0.8);
    }
  }
}
class ChaosAltar extends Inter {
  constructor(x, y) { super(x, y, 30, 40); this.used = false; }
  prompt() { return this.used ? null : '与混沌对话'; }
  use() {
    const p = G.player;
    const sac = Math.round(p.maxHp * 0.3);
    openDialog('混沌祭坛', '低语自裂隙深处传来：“以你之物，换取力量……”', [
      { label: `献祭生命：失去 ${sac} 点生命（不致死），获得史诗及以上刻印`, ok: true, fn: () => { p.hp = Math.max(1, p.hp - sac); FX.screenFlash('#ff1030', 0.4, 0.4); Sound.play('hurt'); this.done(); openSigils({ minRarity: 3, rarityBonus: 8 }, '混沌的馈赠'); } },
      { label: '混沌契约：本局受到伤害 +20%，获得传说刻印', ok: true, fn: () => { G.run.dmgTakenMult *= 1.2; this.done(); openSigils({ minRarity: 4 }, '混沌的馈赠'); } },
      { label: '以血换技：失去 20% 生命（不致死），参悟一次武学', ok: true, fn: () => { p.hp = Math.max(1, p.hp - Math.round(p.maxHp * 0.2)); Sound.play('hurt'); this.done(); openArts('混沌的馈赠 · 武学'); } },
      { label: `金币献礼：支付 ${Math.round(80 * priceMul())} 金币，获得 10 熵晶`, ok: G.run.gold >= Math.round(80 * priceMul()), fn: () => { G.run.gold -= Math.round(80 * priceMul()); G.run.crystals += 10; Sound.play('buy'); G.toast('熵晶 +10', '#b46cff'); this.done(); } },
      { label: '离开', ok: true, fn: () => { } },
    ]);
  }
  done() { this.used = true; this.active = false; }
  draw(ctx, gctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
    ctx.fillStyle = '#14060c';
    ctx.beginPath(); ctx.moveTo(x - 16, y); ctx.lineTo(x - 10, y - 30); ctx.lineTo(x + 10, y - 30); ctx.lineTo(x + 16, y); ctx.fill();
    ctx.fillStyle = '#2a0e18'; ctx.fillRect(x - 12, y - 32, 24, 3);
    const open = this.used ? 0.2 : 0.7 + 0.3 * Math.sin(this.t * 3);
    ctx.fillStyle = '#ff3048'; ctx.fillRect(x - 5, y - 20, 10, 3); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y - 20, 2, 3);
    gctx.globalAlpha = open; gctx.fillStyle = '#ff3048'; gctx.fillRect(x - 8, y - 23, 16, 9); gctx.globalAlpha = 1;
    Light.add(this.x, this.y - 20, 100, '#ff3048', open);
    if (!this.used && Math.random() < 0.3) FX.add({ k: 'px', x: this.x + rand(-14, 14), y: this.y - 30, vx: 0, vy: -rand(10, 40), life: 0.8, s: 1.5, c: pick(['#ff3048', '#000000']), glow: true });
  }
}
class Merchant extends Inter {
  constructor(x, y) { super(x, y, 20, 30); this.said = false; }
  prompt() { return '交谈'; }
  use() { G.toast(pick(['“熵潮汹涌，金币却永不贬值。”', '“看中什么尽管拿——付钱就行。”', '“我曾见过那位熵之王……不说也罢。”']), '#ffd23f'); }
  draw(ctx, gctx, cx, cy) {
    const spr = SPR.merchant;
    const fr = animFrame(spr, 'idle', this.t);
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
    drawFrame(ctx, fr, spr.ox, spr.oy, x, y, false);
    gctx.fillStyle = '#ffd23f'; gctx.fillRect(x + 1, y - 27, 5, 2);
    Light.add(this.x, this.y - 20, 70, '#ffd23f', 0.7);
  }
}
function bakeMisc() {
  bakeCustom('merchant', 40, 44, 20, 42, {
    idle: { n: 6, loop: true, fps: 6, draw: (x, t) => {
      const b = Math.sin(t * TAU) * 0.6;
      x.rect(-11, -26 + b, 8, 18, '#5a3a2a'); x.rect(-12, -27 + b, 10, 3, '#7a5a3a');
      x.poly([[-7, 0], [-8, -20 + b], [-2, -28 + b], [6, -26 + b], [9, -10], [8, 0]], '#3a2c50');
      x.poly([[-8, -20 + b], [-2, -28 + b], [-1, -18], [-6, 0], [-7, 0]], '#2a2040');
      x.circ(1, -26 + b, 6, '#3a2c50');
      x.rect(0, -28 + b, 7, 4, '#0a0612');
      x.rect(1, -27 + b, 5, 2, '#ffd23f');
      x.rect(6, -14, 4, 3, '#c8a070');
      x.line(9, -12, 12, -4, 1, '#8a6a4a');
      x.circ(12, -3, 2, '#ffd23f');
    } },
  });
}

// =====================================================================
//  OVERLAY OPENERS
// =====================================================================
// generic "pick one of N cards" overlay. items = [{ view, take() }]
function openPick(title, items, o = {}) {
  if (!items.length) { G.toast('没有可选的项目', '#aaa'); return; }
  G.overlay = { kind: 'pick', title, items, sel: 0, t: 0, reroll: o.reroll || null };
}
function openSigils(opts, title) {
  const p = G.player;
  const mk = () => rollSigils(p, 3, opts).map(u => ({ view: sigilView(u, p), take: () => { takeSigil(p, u); G.toast(`铭刻：${u.name} Lv${p.mods[u.id]}`, SCHOOLS[u.school].col); } }));
  const items = mk();
  if (!items.length) { G.toast('已无可铭刻的刻印', '#aaa'); return; }
  openPick(title, items, { reroll: mk });
}
function openArts(title, first) {
  const p = G.player;
  // the very first scroll offers one fresh art for each direction slot
  const roll = () => first
    ? ART_SLOTS.map(sl => pick(Object.values(ARTS).filter(a => a.hero === p.heroId && a.slot === sl.id && !p.arts[sl.id]))).filter(Boolean).map(a => ({ kind: 'art', id: a.id }))
    : rollArts(p, 3);
  const mk = () => roll().map(a => ({ view: artView(a, p), take: () => takeArt(p, a) }));
  const items = mk();
  if (!items.length) { G.toast('已参透所有武学', '#aaa'); return; }
  openPick(title, items, { reroll: mk });
}
function upgradeTargets(p) {
  const out = [];
  for (const id in p.mods) if (UPG[id] && p.mods[id] < UPG[id].max) out.push({ kind: 'sigil', u: UPG[id] });
  for (const k in p.arts) { const a = p.arts[k]; if (a && a.lv < wxMax(ARTS[a.id])) out.push({ kind: 'artUp', id: a.id }); }
  for (const k in p.uskills) { const s = p.uskills[k]; if (s && s.lv < wxMax(USKILLS[s.id])) out.push({ kind: 'uUp', id: s.id }); }
  for (const k in p.secrets) { const s = p.secrets[k]; if (s && s.lv < wxMax(SKILLS[s.id])) out.push({ kind: 'skillUp', id: s.id }); }
  return out;
}
function openUpgrade() {
  const p = G.player;
  const pool = upgradeTargets(p);
  if (!pool.length) { G.toast('没有可以淬炼的对象', '#aaa'); return; }
  const list = [];
  while (list.length < 3 && pool.length) list.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  openPick('淬炼 · 选择要提升的对象', list.map(t => (t.kind === 'sigil'
    ? { view: sigilView(t.u, p), take: () => { takeSigil(p, t.u); G.toast(`淬炼：${t.u.name} Lv${p.mods[t.u.id]}`, SCHOOLS[t.u.school].col); } }
    : { view: artView(t, p), take: () => takeArt(p, t) })));
}
function openDialog(title, text, choices) { G.overlay = { kind: 'dialog', title, text, choices, sel: 0, t: 0 }; }

// =====================================================================
//  UPDATE
// =====================================================================
function updatePlay(dt) {
  const p = G.player;
  let sdt = dt;
  if (G.slowT > 0) { G.slowT -= dt; sdt = dt * G.slowS; }
  G.time += sdt;
  G.run.time += dt;
  if (G.cine > 0) G.cine -= dt;
  if (G.dim > 0) G.dim -= dt;
  if (G.showHints > 0) G.showHints -= dt;
  for (let i = G.timers.length - 1; i >= 0; i--) {
    const tm = G.timers[i];
    tm.t -= sdt;
    if (tm.t <= 0) { G.timers.splice(i, 1); try { tm.fn(); } catch (e) { console.error(e); } }
  }
  // boss intro
  if (G.bossIntro) {
    G.bossIntro.t += dt;
    if (G.bossIntro.t >= G.bossIntro.dur) {
      G.bossIntro = null;
      if (G.boss) { G.boss.state = 'idle'; G.boss.stT = 0; G.boss.cd = 1; }
      Sound.music((G.boss && G.boss.D.music) || 'boss');
    }
  }
  const locked = G.cine > 0 && (G.bossIntro || G.rs.type === 'boss' && G.rs.cleared === true && G.boss === null && G.slowT > 0);
  if (!locked || p.dead) p.update(sdt);
  else { p.vx = approach(p.vx, 0, 800 * dt); p.vy = Math.min(p.vy + GRAV * dt, MAX_FALL); moveBody(p, sdt, G.room); p.updAnim(sdt); }
  // 见切 witch time: enemies and their projectiles crawl while the player moves freely
  if (G.witchT > 0) G.witchT -= dt;
  const edt = G.witchT > 0 ? sdt * 0.25 : sdt;
  for (const e of G.enemies) e.update(edt);
  Combat.update(sdt);
  for (let i = G.projs.length - 1; i >= 0; i--) { const pr = G.projs[i]; if (!pr.update(pr.team === 'e' ? edt : sdt)) G.projs.splice(i, 1); }
  for (let i = G.zones.length - 1; i >= 0; i--) if (!G.zones[i].update(sdt)) G.zones.splice(i, 1);
  for (let i = G.pickups.length - 1; i >= 0; i--) if (!G.pickups[i].update(sdt)) G.pickups.splice(i, 1);
  for (let i = G.enemies.length - 1; i >= 0; i--) if (G.enemies[i].dead && !(G.enemies[i] instanceof Boss && G.boss === G.enemies[i])) G.enemies.splice(i, 1);
  FX.update(sdt);
  roomLogic(sdt);
  // interactables
  let near = null;
  for (const it of G.inters) {
    it.update(sdt);
    it.near = false;
    if (it.active && !p.dead && it.prompt() && overlap(it.box(), p.hurtbox())) near = it;
  }
  if (near) {
    near.near = true;
    if (Input.hit('interact') && !G.overlay) near.use();
  }
  G.near = near;
  G.inters = G.inters.filter(it => it.active || it instanceof Pedestal || it instanceof Fountain || it instanceof ForgeAltar || it instanceof ChaosAltar);
  // camera
  let tx = p.x + p.face * 26, ty = p.y - 34;
  if (G.bossIntro && G.boss) { tx = G.boss.x; ty = G.boss.y - 40; }
  Cam.follow(tx, ty, G.room.pw, G.room.ph, dt);
  Cam.update(dt);
  Sound.setListener(Cam.x + W / 2);
  // death
  if (p.dead) {
    G.deathT += dt;
    if (G.deathT > 2.4 && G.state === 'play') endRun(false);
  } else G.deathT = 0;
  for (const t of G.toasts) t.t += dt;
  G.toasts = G.toasts.filter(t => t.t < 3.2);
  if (G.banner) { G.banner.t += dt; if (G.banner.t > 3.5) G.banner = null; }
  if (G.bossPhaseText) { G.bossPhaseText.t -= dt; if (G.bossPhaseText.t <= 0) G.bossPhaseText = null; }
}

// =====================================================================
//  RENDER WORLD
// =====================================================================
function renderWorld() {
  const ctx = Gfx.wctx, gctx = Gfx.gctx;
  const R = G.room;
  const cx = Cam.rx, cy = Cam.ry;
  gctx.globalCompositeOperation = 'source-over';
  gctx.clearRect(0, 0, W, H);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.imageSmoothingEnabled = false; gctx.imageSmoothingEnabled = false;
  drawBackground(ctx, gctx, R.bi, cx, cy, G.time, R.ph);
  drawWeather(ctx, gctx, R.bi, cx, cy, G.time, 1 / 60, false);
  ctx.drawImage(R.tileCanvas, -cx, -cy);
  ctx.drawImage(R.propCanvas, -cx, -cy);
  gctx.globalAlpha = 0.8; gctx.drawImage(R.tileGlow, -cx, -cy); gctx.drawImage(R.propGlow, -cx, -cy); gctx.globalAlpha = 1;
  // room lights
  for (const l of R.lights) {
    let a = 0.85;
    if (l.flick) a *= 0.8 + 0.2 * Math.sin(G.time * 13 + l.x) * Math.sin(G.time * 7.3 + l.y);
    Light.add(l.x, l.y, l.r, l.c, a);
    if (l.fire && Math.random() < 0.5) FX.fire(l.x + rand(-4, 4), l.y + 2, 1);
  }
  for (const it of G.inters) it.draw(ctx, gctx, cx, cy);
  FX.draw(ctx, gctx, cx, cy, 0);
  for (const pk of G.pickups) pk.draw(ctx, gctx, cx, cy);
  for (const e of G.enemies) if (!e.dead || (e === G.boss)) e.draw(ctx, gctx, cx, cy);
  G.player.draw(ctx, gctx, cx, cy);
  if (Save.data.settings.lighting) Light.apply(ctx, BIOMES[R.bi].ambient, cx, cy); else Light.clear();
  for (const z of G.zones) z.draw(ctx, gctx, cx, cy);
  for (const pr of G.projs) pr.draw(ctx, gctx, cx, cy);
  FX.draw(ctx, gctx, cx, cy, 1);
  drawWeather(ctx, gctx, R.bi, cx, cy, G.time, 1 / 60, true);
  if (G.dim > 0) { ctx.globalAlpha = Math.min(0.55, G.dim * 1.5); ctx.fillStyle = '#05000c'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  if (G.witchT > 0) {
    const a = Math.min(1, G.witchT * 3);
    ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.55 * a; ctx.fillStyle = '#7a86d8'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.5 * a;
    ctx.strokeStyle = '#c8d4ff'; ctx.lineWidth = 2; ctx.strokeRect(3, 3, W - 6, H - 6);
    ctx.globalAlpha = 1;
    if (!G.player.hidden && !G.player.dead) { const pl = G.player, fr = pl.frame(); drawFrame(ctx, fr, pl.spr.ox, pl.spr.oy, pl.x - cx, pl.y - cy, pl.face < 0, { alpha: 0.9 }); }
  }
  FX.draw(ctx, gctx, cx, cy, 2);
  ctx.drawImage(Gfx.vignette, 0, 0);
  const p = G.player;
  if (p && !p.dead && p.hp < p.maxHp * 0.3) { ctx.globalAlpha = 0.35 + 0.25 * Math.sin(G.rtime * 5); ctx.drawImage(Gfx.hurtVig, 0, 0); ctx.globalAlpha = 1; }
  FX.drawFlash(ctx);
  if (G.cine > 0 && (G.bossIntro || G.slowT > 0)) {
    const k = Math.min(1, G.cine * 2);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, 22 * k); ctx.fillRect(0, H - 22 * k, W, 22 * k);
  }
}
