'use strict';

// 闪避冷却、见切连段与新角色「澜」：在真实源码与游戏循环里跑一遍
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const gameDir = path.join(__dirname, '..', 'entropy-blade');
const logicFiles = new Set([
  'core', 'sprites', 'world', 'combat', 'heroes', 'heroes_eve', 'heroes_gao', 'heroes_lan',
  'movekit', 'moves_rin', 'moves_eve', 'moves_gao', 'moves_lan', 'moves_u', 'arts', 'player',
  'enemies', 'enemies2', 'bosses', 'bosses2', 'upgrades', 'trials', 'game', 'ui',
]);

function game() {
  const noop = () => {};
  const errors = [];
  const storage = new Map();
  const rendering = new Proxy({}, { get: (target, key) => key in target ? target[key] : noop });
  const canvas = () => ({ getContext: () => rendering });
  const context = vm.createContext({
    console: { ...console, error: (...args) => errors.push(args.join(' ')) },
    Math: Object.create(Math), window: { addEventListener: noop }, navigator: {},
    document: { createElement: canvas },
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    FX: rendering, Cam: new Proxy({ x: 0, y: 0, rx: 0, ry: 0 }, { get: (target, key) => key in target ? target[key] : noop }),
    Light: rendering, Sound: rendering, bakeSprite: canvas,
    Gfx: { uctx: rendering, artBegin: noop }, TouchUI: { enabled: false },
    Text: { draw: noop, wrap: text => [text], measure: text => String(text).length * 8 },
  });
  const run = code => vm.runInContext(code, context);
  const entry = fs.readFileSync(path.join(gameDir, 'index.html'), 'utf8');
  let loaded = 0;
  for (const match of entry.matchAll(/<script src="js\/([^"/]+)\.js"><\/script>/g)) {
    if (!logicFiles.has(match[1])) continue;
    vm.runInContext(fs.readFileSync(path.join(gameDir, 'js', match[1] + '.js'), 'utf8'), context, { filename: match[1] + '.js' });
    loaded++;
  }
  assert.equal(loaded, logicFiles.size, 'every gameplay module loads from the entry page');
  run(`
    bakeHero = (id, weapon) => (SPR[id] = { weapon, ox: 0, oy: 0, anims: { idle: { frames: [{}] } } });
    animFrame = () => ({});
    for (const D of Object.values(ENEMY_DEFS)) for (let bi = 0; bi < 4; bi++) SPR[D.spr + bi] = { ox: 0, oy: 0 };
    for (const D of Object.values(BOSS_DEFS)) SPR[D.spr] = { ox: 0, oy: 0 };
    Math.random = () => 0.9;
    function fixtureEnemy(type = 'crawler', x = 150, y = 288) {
      const e = new Enemy(type, x, y, { noSpawn: true });
      e.hp = e.maxHp = 10000;
      G.enemies.push(e);
      return e;
    }
    function step(n = 1) { for (let i = 0; i < n; i++) { updatePlay(1 / 60); Input.endStep(); } }
    function press(key) { Input.virt(key, true); step(); Input.virt(key, false); }
  `);
  return { run, errors, json: code => JSON.parse(JSON.stringify(run(code))) };
}

function begin(g, hero) {
  g.run(`
    startRun(${JSON.stringify(hero)}, null, {}, 'trial');
    clearWorld();
    G.room = new Room(100, 24, 0);
    for (let x = 0; x < G.room.w; x++) for (let y = 18; y < G.room.h; y++) G.room.set(x, y, 1);
    G.rs = { type: 'start', cleared: true };
    G.player.x = 400; G.player.y = 288; G.player.onGround = true; G.player.face = 1;
    G.time = 10;
    for (const key of ['KeyL', 'KeyJ', 'KeyK', 'KeyU', 'KeyI', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) Input.virt(key, false);
    Input.endStep();
  `);
}

test('a dodge waits 0.5 s before the next one, a press just before that still comes out', () => {
  const g = game();
  begin(g, 'rin');
  g.run("press('KeyL');");
  assert.equal(g.run('G.player.state'), 'dash');
  assert.equal(g.run('G.player.dashes'), 1, 'two charges, one spent');
  g.run('step(15);');                                         // 0.27 s: the dash itself is over
  assert.equal(g.run('G.player.state'), 'normal');
  g.run("press('KeyL'); step(6);");                           // 0.38 s: still cooling down, and the press expires
  assert.notEqual(g.run('G.player.state'), 'dash', 'second dodge refused inside the cooldown');
  assert.equal(g.run('G.player.dashes'), 1, 'the refused press costs nothing');
  g.run('step(4);');                                          // 0.45 s
  g.run("press('KeyL');");                                    // buffered…
  g.run('step(5);');                                          // …and fires as the cooldown ends at 0.5 s
  assert.ok(['dash', 'normal'].includes(g.run('G.player.state')));
  assert.equal(g.run('G.player.dashes'), 0, 'the buffered press dodges as soon as the cooldown ends');
  assert.ok(g.run('G.player.dodgeCD') > 0.35, 'and starts a fresh cooldown');
});

test('a perfect dodge clears the cooldown and returns the charge, so perfect timing can dodge every hit', () => {
  const g = game();
  begin(g, 'rin');
  fixtureLine(g);
  for (let k = 0; k < 6; k++) {
    g.run("press('KeyL');");
    assert.equal(g.run('G.player.state'), 'dash', 'dodge ' + k + ' comes out');
    g.run('var hp0 = G.player.hp; hurtPlayer(30, G.player.x + 40);');
    assert.equal(g.run('G.player.hp'), g.run('hp0'), 'the hit is dodged');
    assert.equal(g.run('G.player.dodgeCD'), 0, 'cooldown cleared');
    assert.equal(g.run('G.player.dashes'), g.run('G.player.stats.dashes'), 'charge returned');
    g.run('G.player.counterT = 0; G.player.inv = 0; step(13);');   // the dash ends; no waiting for a cooldown
  }
  assert.equal(g.run('G.stats.perfects'), 6);
});
function fixtureLine(g) { g.run("fixtureEnemy('soldier', 440);"); }

test('every hero turns a 见切 into a three-link counter chain by pressing attack', () => {
  const g = game();
  for (const hero of ['rin', 'eve', 'gao', 'lan']) {
    begin(g, hero);
    g.run(`
      G.player.stats.crit = 0;
      var foe = fixtureEnemy('soldier', 450);
      press('KeyL'); hurtPlayer(20, foe.x);
      var seen = [];
      for (let f = 0; f < 200; f++) {
        if (f % 4 === 0) Input.virt('KeyJ', true); else Input.virt('KeyJ', false);
        step();
        const n = G.player.move && G.player.move.name;
        if (n && seen[seen.length - 1] !== n) seen.push(n);
      }
      Input.virt('KeyJ', false);
    `);
    const seen = g.json('seen');
    const chain = seen.filter(n => /^counter/.test(n));
    assert.deepEqual(chain, ['counter', 'counter2', 'counter3'], hero + ' chain: ' + seen.join(' → '));
    assert.deepEqual(g.errors, [], hero + ' chain runs cleanly');
    assert.ok(g.run('foe.hp < foe.maxHp'), hero + ' chain lands');
    assert.deepEqual(g.json('counterChain(G.player.hero.moves)').length, 3, hero + ' move list shows the chain');
  }
});

test('澜 registers a full kit: 6 arts, 4 U skills, 10 secrets, 3 weapons, all backed by real moves', () => {
  const g = game();
  const kit = g.json(`({
    arts: Object.values(ARTS).filter(a => a.hero === 'lan').map(a => ({ id: a.id, slot: a.slot, moves: a.moves })),
    us: Object.values(USKILLS).filter(u => u.hero === 'lan').map(u => ({ id: u.id, slot: u.slot, moves: u.moves })),
    sk: Object.values(SKILLS).filter(s => s.hero === 'lan').map(s => ({ id: s.id, slot: s.slot, move: s.move, follow: s.follow || null, def: !!s.def })),
    wp: heroWeapons('lan').map(w => w.id),
    moves: Object.keys(HEROES.lan.moves),
  })`);
  assert.equal(kit.arts.length, 6);
  for (const slot of ['up', 'down', 'dash']) assert.equal(kit.arts.filter(a => a.slot === slot).length, 2, 'two arts on ' + slot);
  assert.deepEqual(kit.us.map(u => u.slot).sort(), ['dash', 'down', 'shot', 'up']);
  assert.equal(kit.sk.length, 10);
  for (const slot of ['stand', 'move', 'up', 'down', 'air']) {
    assert.equal(kit.sk.filter(s => s.slot === slot).length, 2, 'two secrets on ' + slot);
    assert.equal(kit.sk.filter(s => s.slot === slot && s.def).length, 1, 'one starting secret on ' + slot);
  }
  assert.equal(kit.wp.length, 3);
  const need = [...kit.arts.flatMap(a => a.moves), ...kit.us.flatMap(u => u.moves), ...kit.sk.map(s => s.move), ...kit.sk.map(s => s.follow).filter(Boolean)];
  for (const m of need) assert.ok(kit.moves.includes(m), 'move exists: ' + m);
  const others = g.json("['rin', 'eve', 'gao'].map(h => Object.keys(HEROES[h].moves).length)");
  assert.ok(kit.moves.length >= Math.min(...others), `as many moves as the other heroes (${kit.moves.length} vs ${others.join('/')})`);
  // no move shares another move's object (each one is authored, not aliased in code)
  assert.equal(g.run("new Set(Object.values(HEROES.lan.moves)).size"), kit.moves.length);
});

test('every signature effect belongs to exactly one 武学, and 澜 brings six of its own', () => {
  const g = game();
  const used = g.json("Object.values(WX_LEVELS).flatMap(l => l.map(x => x.perk).filter(Boolean))");
  assert.equal(new Set(used).size, used.length, 'no perk is reused');
  const lan = g.json("Object.entries(WX_LEVELS).filter(([id]) => id.startsWith('lan_')).flatMap(([, l]) => l.map(x => x.perk).filter(Boolean))");
  assert.equal(lan.length, 6);
  assert.deepEqual(g.json("Object.keys(SKILLS).filter(id => id.startsWith('lan_') && WX_LEVELS[id].some(l => l.t === 2) && !SK_BOOST[id])"), [], '强化 tiers describe themselves');
  g.run("startRun('lan', null, {}, 'trial');");
  const text = g.json('heroMoveList(HEROES.lan, G.player).map(r => r.join(" "))').join('\n');
  assert.ok(!/undefined|NaN/.test(text), text);
});

test('every 澜 move runs to the end in the game loop at full level without errors', () => {
  const g = game();
  const list = g.json(`(() => {
    const out = [];
    for (const a of Object.values(ARTS)) if (a.hero === 'lan') a.moves.forEach(m => out.push({ kind: 'art', id: a.id, slot: a.slot, move: m }));
    for (const s of Object.values(SKILLS)) if (s.hero === 'lan') { out.push({ kind: 'sk', id: s.id, slot: s.slot, move: s.move }); if (s.follow) out.push({ kind: 'sk', id: s.id, slot: s.slot, move: s.follow, follow: true }); }
    for (const u of Object.values(USKILLS)) if (u.hero === 'lan') u.moves.forEach((m, k) => out.push({ kind: 'u', id: u.id, slot: u.slot, move: m, stage: k }));
    for (const m of ['atk1', 'atk2', 'atk3', 'atk4', 'atk5', 'atkB1', 'atkB2', 'low', 'rise', 'dashAtk', 'charge1', 'charge2', 'counter', 'counter2', 'counter3', 'aatk1', 'aatk2', 'aatk3', 'airRise', 'plunge']) out.push({ kind: 'base', move: m });
    return out;
  })()`);
  assert.ok(list.length >= 70);
  let damaging = 0;
  const missed = [];
  for (const it of list) {
    begin(g, 'lan');
    g.run(`
      var foes;
      {
        const p = G.player, it = ${JSON.stringify(it)};
        if (it.kind === 'art') p.arts[it.slot] = { id: it.id, lv: wxMax(ARTS[it.id]) };
        if (it.kind === 'sk') p.secrets[it.slot] = { id: it.id, lv: wxMax(SKILLS[it.id]) };
        if (it.kind === 'u') p.uskills[it.slot].lv = wxMax(USKILLS[it.id]);
        p.recalc(); p.inv = 99;
        foes = [fixtureEnemy('soldier', 430), fixtureEnemy('crawler', 470), fixtureEnemy('drone', 520, 245), fixtureEnemy('soldier', 360)];
        // air moves start in the air with a flyer at the same height
        if (/^(aatk|airRise|plunge|sk_dive|sk_windmill|f_dive|f_windmill|f_vault|counter3)/.test(it.move)) { p.y = 220; p.onGround = false; foes.push(fixtureEnemy('drone', 445, 214)); }
        // 虹落 sets off spears that 长虹贯日 planted first
        if (it.move === 'f_rainbow') { p.startMove('sk_rainbow'); step(60); }
        if (it.kind === 'u') p.startUStage(USKILLS[it.id], it.stage); else p.startMove(it.move);
      }
      step(240);
    `);
    assert.deepEqual(g.errors, [], it.move + ': no errors');
    assert.ok(g.run('Number.isFinite(G.player.x) && Number.isFinite(G.player.y)'), it.move + ': hero stays in the world');
    assert.equal(g.run('G.player.move'), null, it.move + ': completes');
    assert.equal(g.run('G.timers.length'), 0, it.move + ': every delayed callback ran');
    assert.ok(g.run('G.enemies.every(e => Number.isFinite(e.x) && Number.isFinite(e.y) && Number.isFinite(e.hp))'), it.move + ': foes stay valid');
    if (g.run('foes.some(e => e.hp < e.maxHp)')) damaging++; else missed.push(it.move);
  }
  assert.deepEqual(missed, [], `every move connects (${damaging}/${list.length})`);
});

test('poison ticks lose health without setting off 荆棘甲, the 金刚身 burst or 金身; real blows still do', () => {
  const g = game();
  begin(g, 'gao');
  g.run(`
    G.player.secrets.stand = { id: 'gao_iron', lv: wxMax(SKILLS.gao_iron) };
    takeSigil(G.player, UPG.guard_thorn);
    G.player.stats.manaRegen = 0; G.player.mana = 10; G.player.ironT = 3; G.player.inv = 0;
    var bursts = 0, blasts = 0, hurt = [];
    const sb = sigilBurst, ex = explodeP;
    sigilBurst = (...a) => { bursts++; return sb(...a); };
    explodeP = (...a) => { if (a[4] && a[4].wx && a[4].wx.id === 'gao_iron') blasts++; return ex(...a); };
    G.player.on('onHurt', (p, dmg) => hurt.push(dmg));
    var hp0 = G.player.hp;
    for (let i = 0; i < 4; i++) { G.time += 0.5; hurtPlayer(10, G.player.x, { dot: true, nonlethal: true }); }
  `);
  assert.ok(g.run('G.player.hp < hp0'), 'poison still costs health (softened by 金刚身)');
  assert.equal(g.json('hurt').length, 4, 'each tick is still reported as health lost');
  assert.equal(g.run('bursts'), 0, '荆棘甲 ignores poison ticks');
  assert.equal(g.run('blasts'), 0, '金刚身 does not burst on poison ticks');
  assert.equal(g.run('G.player.mana'), 10, '金身 does not feed on poison ticks');
  assert.equal(g.run('G.player.inv'), 0, 'poison ticks grant no invulnerability');
  g.run('G.time += 0.5; hurtPlayer(10, G.player.x + 20);');
  assert.equal(g.run('bursts'), 1, '荆棘甲 answers a real blow');
  assert.equal(g.run('blasts'), 1, '金刚身 bursts on a real blow');
  assert.equal(g.run('G.player.mana'), 14, '金身 feeds 4 灵力 on a real blow');
  assert.ok(g.run('G.player.inv') > 1, 'a real blow still grants invulnerability');
});

test('澜 weapons: 沧澜 lengthens reach, 照夜 crits after a 见切, 破军 armors after finishers', () => {
  const g = game();
  begin(g, 'lan');
  assert.ok(Math.abs(g.run("G.player.reach({ fam: 'art', id: 'lan_sweep' })") - 1.12) < 1e-9);
  g.run("startRun('lan', 'lan_zhaoye', {}, 'trial'); G.time = 10; G.player.fire('onPerfect', 0); var h = G.player.makeHit({ dmg: 1 });");
  assert.equal(g.run('h.critBonus'), 0.25);
  g.run("startRun('lan', 'lan_pojun', {}, 'trial'); G.player.armorT = 0; G.player.fire('onFinisher', null, { finisher: true });");
  assert.equal(g.run('G.player.armorT'), 1.2);
});
