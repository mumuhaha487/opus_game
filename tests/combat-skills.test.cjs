'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const gameDir = path.join(__dirname, '..', 'entropy-blade');
const logicFiles = new Set([
  'core', 'sprites', 'world', 'combat', 'heroes', 'heroes_eve', 'heroes_gao',
  'movekit', 'moves_rin', 'moves_eve', 'moves_gao', 'moves_u', 'arts', 'player',
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
  const loaded = [];
  // Follow the browser's actual script order; only presentation and the animation loop are stubbed.
  for (const match of entry.matchAll(/<script src="js\/([^"/]+)\.js"><\/script>/g)) {
    const name = match[1];
    if (!logicFiles.has(name)) continue;
    vm.runInContext(fs.readFileSync(path.join(gameDir, 'js', name + '.js'), 'utf8'), context, { filename: name + '.js' });
    loaded.push(name);
  }
  assert.equal(loaded.length, logicFiles.size, 'all gameplay modules must load from the entry page');
  run(`
    bakeHero = (id, weapon) => (SPR[id] = { weapon, ox: 0, oy: 0, anims: { idle: { frames: [{}] } } });
    animFrame = () => ({});
    for (const D of Object.values(ENEMY_DEFS)) for (let bi = 0; bi < 4; bi++) SPR[D.spr + bi] = { ox: 0, oy: 0 };
    for (const D of Object.values(BOSS_DEFS)) SPR[D.spr] = { ox: 0, oy: 0 };
    Math.random = () => 0.9;
    function fixtureEnemy(type = 'crawler', x = 150, y = 288, opts = {}) {
      const e = new Enemy(type, x, y, { noSpawn: true, ...opts });
      e.hp = e.maxHp = 10000;
      G.enemies.push(e);
      return e;
    }
    function fixtureAdvance(seconds) {
      for (let elapsed = 0; elapsed < seconds; elapsed += 1 / 60) {
        updatePlay(1 / 60);
        Input.endStep();
      }
    }
  `);
  return { run, errors, json: code => JSON.parse(JSON.stringify(run(code))) };
}

function begin(g, hero = 'rin') {
  g.run(`
    startRun(${JSON.stringify(hero)}, null, {}, 'trial');
    clearWorld();
    G.room = new Room(100, 24, 0);
    for (let x = 0; x < G.room.w; x++) for (let y = 18; y < G.room.h; y++) G.room.set(x, y, 1);
    G.rs = { type: 'start', cleared: true };
    G.player.x = 100; G.player.y = 288; G.player.onGround = true; G.player.face = 1;
    G.player.stats.crit = 0;
    G.player.stats.manaRegen = 0;
    G.time = 10;
  `);
}

function close(actual, expected, label) {
  assert.ok(Math.abs(actual - expected) < 1e-8, `${label}: ${actual} != ${expected}`);
}

test('explicit hit origins control damage, reach and projectile modifiers across a different running U', () => {
  const g = game();
  begin(g);
  g.run(`
    G.player.secrets.stand = { id: 'rin_iai', lv: 3 };
    G.player.arts.down = { id: 'rin_sweep', lv: 3 };
    G.player.uskills.shot.lv = 3; G.player.uskills.up.lv = 2;
    G.player.startMove('u_rin_shot3');
    var victim = fixtureEnemy();
    var skillHit = G.player.makeHit({ dmg: 2, skill: 'rin_iai', noCrit: true });
    var artHit = G.player.makeHit({ dmg: 2, art: 'rin_sweep', noCrit: true });
    var uHit = G.player.makeHit({ dmg: 2, uskill: 'rin_u_up', noCrit: true });
  `);
  for (const [name, family, id, scale] of [
    ['skillHit', 'sk', 'rin_iai', 1.7], ['artHit', 'art', 'rin_sweep', 1.4], ['uHit', 'u', 'rin_u_up', 1.25],
  ]) {
    assert.deepEqual(g.json(`${name}.wx`), { fam: family, id });
    close(g.run(`${name}.dmg`), g.run('G.player.atk') * 2 * scale, id);
    close(g.run(`hitEnemy(G.player, victim, ${name}, victim.x, victim.cy)`), g.run('G.player.atk') * 2 * scale, id + ' actual damage');
  }
  close(g.run("G.player.reach({ fam: 'art', id: 'rin_sweep' })"), 1.4, 'explicit reach');
  g.run(`
    var shot = new Proj({ team: 'p', r: 2, hh: 10, life: 1, hit: artHit });
    var box = Combat.box(G.player, 'p', [0, -20, 10, 10], artHit, 1);
  `);
  close(g.run('shot.life'), 1.4, 'projectile lifetime');
  close(g.run('shot.r'), 2.48, 'projectile radius');
  close(g.run('box.w'), 14, 'explicit hitbox reach');
  g.run(`
    G.enemies = []; victim = fixtureEnemy('crawler', 132, G.player.cy + 6);
    var hp = victim.hp;
    explodeP(G.player.x, G.player.cy, 20, 1, { wx: artHit.wx });
  `);
  assert.ok(g.run('victim.hp < hp'), 'blast uses its own reach after changing moves');
  g.run(`
    G.player.startMove(ARTS.rin_sweep.moves[0]);
    hp = victim.hp;
    explodeP(G.player.x, G.player.cy, 20, 1, { wx: null });
    var neutral = new Proj({ team: 'p', r: 2, life: 1, hit: { dmg: 1, wx: null } });
  `);
  assert.equal(g.run('victim.hp'), g.run('hp'), 'neutral blast does not inherit current reach');
  assert.equal(g.run('neutral.life'), 1);
  begin(g, 'eve');
  g.run(`
    G.player.arts.up = { id: 'eve_sky', lv: 2 };
    G.player.startMove('u_eve_dash1');
    var sky = new Proj({ team: 'p', hit: G.player.makeHit({ dmg: 1, art: 'eve_sky' }) });
    G.player.startMove(ARTS.eve_sky.moves[0]);
    var plain = new Proj({ team: 'p', hit: { dmg: 1, wx: null } });
  `);
  assert.equal(g.run('sky.homing'), 2.5);
  assert.equal(g.run('plain.homing'), 0);
});

test('Eve starburst retains shot scaling and origin in its blast and eight shards after ending or switching U', () => {
  for (const switchMove of [false, true]) {
    const g = game();
    begin(g, 'eve');
    g.run(`
      G.player.uskills.shot.lv = 3; G.player.uskills.up.lv = 3;
      var hits = [];
      G.player.on('onHit', (p, e, h, dmg) => hits.push({ wx: h.wx, dmg }));
      G.player.startMove('u_eve_shot3'); G.player.updMove(0.061, 0);
      var orb = G.projs[0];
      G.player.updMove(1, 0);
      ${switchMove ? "G.player.startMove('u_eve_up1');" : ''}
      orb.x = 200; orb.y = 220; orb.vx = 0; orb.vy = 0;
      var victim = fixtureEnemy('crawler', 225, 226);
      orb.update(0.71);
      var shards = G.projs.filter(pr => pr.kind === 'shard');
    `);
    assert.equal(g.run('orb.boomed'), true);
    assert.equal(g.run('shards.length'), 8);
    assert.deepEqual(g.json('hits[0].wx'), { fam: 'u', id: 'eve_u_shot' });
    close(g.run('hits[0].dmg'), g.run('G.player.atk') * 1.0 * 1.3, 'blast damage');
    for (const shard of g.json('shards.map(pr => ({ dmg: pr.hit.dmg, wx: pr.hit.wx }))')) {
      assert.deepEqual(shard.wx, { fam: 'u', id: 'eve_u_shot' });
      close(shard.dmg, g.run('G.player.atk') * 0.2 * 1.3, 'fragment damage');
    }
    g.run('shards[0].update(0.1);');
    close(g.run('hits[1].dmg'), g.run('G.player.atk') * 0.2 * 1.3, 'actual fragment collision');
    assert.deepEqual(g.json('hits[1].wx'), { fam: 'u', id: 'eve_u_shot' });
  }
});

test('upgraded meteor explosions still burn after the ultimate ends or a different U begins', () => {
  for (const switchMove of [false, true]) {
    const g = game();
    begin(g, 'eve');
    g.run(`
      G.player.secrets.down = { id: 'eve_meteor', lv: 2 };
      G.player.startMove('ult2'); G.player.updMove(0.61, 0);
      var meteor = G.projs[0];
      G.player.updMove(2, 0);
      ${switchMove ? "G.player.startMove('u_eve_up1');" : ''}
      var victim = fixtureEnemy('crawler', 220, 288);
      meteor.x = victim.x; meteor.y = 280; meteor.vx = 0; meteor.vy = 520; meteor.t = 0.2;
      var hp = victim.hp;
      meteor.update(0.03);
    `);
    assert.equal(g.run('meteor.dead'), true, 'real floor impact detonates the meteor');
    assert.equal(g.run('victim.st.burn'), 2);
    close(g.run('hp - victim.hp'), g.run('G.player.atk') * 1.4 * 1.7, 'meteor damage');
    g.run('tickStatus(victim, 0.51);');
    assert.ok(g.run('hp - victim.hp') > g.run('G.player.atk') * 1.4 * 1.7, 'the burn deals real damage');
  }
});

test('delayed shadow ghosts and pillar rocks keep the originating art and rock-armor perk', () => {
  const g = game();
  begin(g);
  g.run(`
    G.player.arts.down = { id: 'rin_shade', lv: 3 };
    G.player.uskills.shot.lv = 3;
    G.player.startMove('shade2'); G.player.updMove(0.061, 0);
    var ghost = G.zones[0];
    G.player.endMove(); G.player.startMove('u_rin_shot3');
    var victim = fixtureEnemy('crawler', ghost.x, ghost.y);
    var hits = [];
    G.player.on('onHit', (p, e, h) => hits.push(h.wx));
    ghost.update(0.4);
  `);
  assert.ok(g.run('victim.hp < victim.maxHp'));
  assert.equal(g.run('victim.st.shade'), 6);
  assert.deepEqual(g.json('hits[0]'), { fam: 'art', id: 'rin_shade' });
  begin(g, 'gao');
  g.run(`
    G.player.arts.up = { id: 'gao_pillar', lv: 2 };
    G.player.startMove('pillar4'); G.player.updMove(0.261, 0); G.player.updMove(0.5, 0);
    G.player.startMove('u_gao_shot1');
    for (const tm of G.timers.splice(0).sort((a, b) => a.t - b.t)) tm.fn();
    var rock = G.projs[0];
    var victim = fixtureEnemy('crawler', rock.x, 288);
    G.player.shield = 0;
    rock.y = 280; rock.t = 0.2; rock.update(0.04);
  `);
  assert.deepEqual(g.json('rock.hit.wx'), { fam: 'art', id: 'gao_pillar' });
  assert.equal(g.run('rock.dead'), true);
  assert.ok(g.run('victim.hp < victim.maxHp'));
  assert.equal(g.run('G.player.shield'), 3, 'late rock blast grants the originating art armor');
});

test('Shadow Burial executes marked low-health enemies through frontal guard and elite shields but excludes bosses', () => {
  const g = game();
  begin(g);
  g.run("G.player.arts.down = { id: 'rin_shade', lv: 3 }; G.player.startMove('u_rin_shot1');");
  for (const [type, opts] of [['crawler', {}], ['knight', {}], ['knight', { elite: true, affix: 'shield' }]]) {
    g.run(`
      var victim = new Enemy(${JSON.stringify(type)}, 150, 288, { noSpawn: true, ...${JSON.stringify(opts)} });
      victim.hp = victim.maxHp * 0.2; victim.st.shade = 6;
      G.enemies = [victim];
      hitEnemy(G.player, victim, G.player.makeHit({ dmg: 0.1, art: 'rin_shade', noCrit: true }), victim.x, victim.cy);
    `);
    assert.equal(g.run('victim.dead'), true, type + ' ' + JSON.stringify(opts));
    assert.equal(g.run('G.enemies.filter(e => !e.dead).length'), 0);
  }
  g.run(`
    var unmarked = new Enemy('knight', 150, 288, { noSpawn: true, elite: true, affix: 'shield' });
    unmarked.hp = unmarked.maxHp * 0.2;
    hitEnemy(G.player, unmarked, G.player.makeHit({ dmg: 0.1, art: 'rin_shade', noCrit: true }), unmarked.x, unmarked.cy);
    var boss = new Boss('warden', 200, 288); boss.hp = boss.maxHp * 0.2; boss.st.shade = 6;
    hitEnemy(G.player, boss, G.player.makeHit({ dmg: 0.1, art: 'rin_shade', noCrit: true }), boss.x, boss.cy);
  `);
  assert.equal(g.run('unmarked.dead'), false);
  assert.equal(g.run('boss.dead'), false);
  assert.ok(g.run('boss.hp > 0'));
});

test('all heroes start with four mana-free U slots without cooldowns, selected by real input', () => {
  const g = game();
  for (const hero of ['rin', 'eve', 'gao']) {
    begin(g, hero);
    assert.deepEqual(g.json('Object.keys(G.player.uskills).sort()'), ['dash', 'down', 'shot', 'up']);
    assert.equal(g.run("'ucd' in G.player"), false, 'U skills keep no cooldown state');
    g.run('G.player.mana = 0;');
    for (const pass of [1, 2]) {
      for (const slot of ['shot', 'up', 'down', 'dash']) {
        g.run(`
          if (G.player.move) G.player.endMove();
          G.player.lastU = null; G.player.postDashT = ${slot === 'dash' ? 1 : 0};
          Input.virt('ArrowUp', ${slot === 'up'}); Input.virt('ArrowDown', ${slot === 'down'}); Input.endStep();
        `);
        assert.equal(g.run('G.player.uSlot()'), slot);
        assert.equal(g.run('G.player.trySkill()'), true, hero + ' ' + slot + ' pass ' + pass);
        assert.equal(g.run('G.player.mana'), 0);
        assert.equal(g.run(`G.player.move.m.uskill`), hero + '_u_' + slot);
        assert.equal(g.run(`G.player.move.name`), g.run(`USKILLS['${hero}_u_${slot}'].moves[0]`));
        assert.equal(g.run(`G.player.trySkill('${slot}')`), false, 'a fresh cast waits for the current stage to recover');
      }
      // the second pass starts every slot again at once: nothing is on cooldown
      assert.equal(g.run('G.stats.uskills'), 4 * pass);
    }
    g.run("Input.virt('ArrowUp', false); Input.virt('ArrowDown', false); Input.endStep();");
  }
});

test('a different U direction stays buffered until recovery and starts its own skill for every hero', () => {
  const dt = 1 / 60;
  for (const hero of ['rin', 'eve', 'gao']) {
    for (const pressAt of [0.08, 0.18]) {
      const g = game();
      begin(g, hero);
      g.run(`takeArt(G.player, { kind: 'uUp', id: '${hero}_u_up' }); Input.virt('ArrowUp', true);`);
      controllerPress(g, 'KeyU', dt);
      controllerAdvance(g, pressAt, dt);
      g.run("Input.virt('ArrowUp', false); Input.virt('ArrowDown', true);");
      controllerPress(g, 'KeyU', dt);
      assert.equal(g.run('G.player.move.name'), `u_${hero}_up1`, hero + ' preserves the current stage');
      assert.deepEqual(g.json('({ action: G.player.move.buf, slot: G.player.move.bufSlot })'), { action: 'skill', slot: 'down' });
      g.run("Input.virt('ArrowDown', false);");
      while (g.run(`G.player.move.t + ${dt} < G.player.move.m.cancel`)) {
        controllerAdvance(g, dt, dt);
        assert.equal(g.run('G.player.move.name'), `u_${hero}_up1`, hero + ' waits through recovery');
      }
      controllerUntil(g, `G.player.move && G.player.move.name === 'u_${hero}_down1'`, dt, 3);
      assert.equal(g.run('G.stats.uskills'), 2, 'buffered input starts a new cast instead of continuing the up ladder');
    }
  }
});

test('rising U grants one extra lift per airtime and real landing and wall jumping restore it', () => {
  const dt = 1 / 60;
  for (const hero of ['rin', 'gao']) {
    const g = game();
    begin(g, hero);
    g.run(`
      G.room = new Room(100, 60, 0);
      for (let x = 0; x < G.room.w; x++) for (let y = 54; y < G.room.h; y++) G.room.set(x, y, 1);
      G.player.x = 200; G.player.y = 500; G.player.onGround = false; G.player.vy = 0;
      Input.virt('ArrowUp', true);
    `);
    const castUp = () => {
      controllerPress(g, 'KeyU', dt);
      assert.equal(g.run('G.player.move.name'), `u_${hero}_up1`);
      controllerAdvance(g, 0.1, dt);
    };
    castUp();
    assert.ok(g.run('G.player.vy < -50 && G.player.y < 500'), hero + ' first airborne cast lifts the player');
    controllerUntil(g, '!G.player.move', dt);
    castUp();
    assert.ok(g.run('G.player.vy > 0'), hero + ' repeated cast cannot reverse the fall again');
    controllerUntil(g, 'G.player.onGround', dt);
    assert.equal(g.run('G.player.y'), 864, 'actual floor collision ends the airtime');
    g.run("Input.virt('KeyK', true); updatePlay(1 / 60); Input.endStep();");
    controllerUntil(g, 'G.player.vy >= 0', dt);
    g.run("Input.virt('KeyK', false);");
    castUp();
    assert.ok(g.run('G.player.vy < -50 && !G.player.onGround'), hero + ' a new jump has another aerial lift');
    controllerUntil(g, '!G.player.move', dt);
    g.run("for (let y = 0; y < 54; y++) G.room.set(14, y, 1); Input.virt('ArrowRight', true);");
    controllerUntil(g, 'G.player.wallT > 0', dt);
    assert.equal(g.run('G.player.onGround'), false, 'wall contact happens before landing');
    const wallX = g.run('G.player.x');
    controllerPress(g, 'KeyK', dt);
    assert.ok(g.run('G.player.vy < -300') && g.run('G.player.x') < wallX, 'jump input really jumps away from the wall');
    g.run("Input.virt('ArrowRight', false);");
    controllerUntil(g, 'G.player.vy >= 0', dt);
    castUp();
    assert.ok(g.run('G.player.vy < -50 && !G.player.onGround'), hero + ' wall jump restores the additional lift');
  }
});

test('real U projectile hits grant 40 percent of the mana credited by the same non-U hit', () => {
  const dt = 1 / 60;
  for (const hero of ['rin', 'eve', 'gao']) {
    const g = game();
    begin(g, hero);
    g.run(`
      G.player.mana = 0;
      var victim = fixtureEnemy('soldier', 150);
      var credited = [];
      var originalHit;
      G.player.on('onHit', (p, e, hit, dmg) => { originalHit = hit; credited.push({ mana: p.mana, dmg, wx: hit.wx }); });
    `);
    controllerPress(g, 'KeyU', dt);
    controllerUntil(g, 'credited.length > 0', dt, 60);
    assert.equal(g.run('credited.length'), 1, hero + ' shot has landed once');
    assert.deepEqual(g.json('credited[0].wx'), { fam: 'u', id: `${hero}_u_shot` });
    assert.ok(g.run('credited[0].mana > 0 && victim.hp < victim.maxHp'), 'the actual projectile awards mana and deals damage');
    g.run(`
      G.projs = []; G.zones = []; Combat.clear();
      G.player.mana = 0;
      Combat.area('p', victim.x - 20, victim.y - victim.h - 20, 40, victim.h + 40,
        { ...originalHit, wx: null }, 0.5, { owner: G.player });
    `);
    controllerAdvance(g, dt, dt);
    assert.equal(g.run('credited.length'), 2, 'matching non-U hit uses the real collision pipeline');
    assert.equal(g.run('credited[1].wx'), null, 'neutral hit stays neutral while U is still running');
    close(g.run('credited[0].dmg'), g.run('credited[1].dmg'), hero + ' identical hit damage');
    close(g.run('credited[0].mana'), g.run('credited[1].mana') * 0.4, hero + ' U mana ratio');
  }
});

test('real scorp venom ticks respect defenses, shields, damage accounting and God mode without hit reactions', () => {
  const dt = 1 / 60;
  for (const scenario of ['shields', 'nonlethal', 'god']) {
    const g = game();
    begin(g);
    g.run(`
      G.run.dmgTakenMult = 1.5; G.player.stats.armor = 0.5; G.player.inv = 0;
      var scorp = fixtureEnemy('scorp', 122);
      scorp.dmgMul = 2; scorp.onGround = true; scorp.setState('wind', 'wind'); scorp.stT = 0.38;
      var hurtEvents = [];
      G.player.on('onHurt', (p, dmg) => hurtEvents.push(dmg));
    `);
    controllerUntil(g, '!!G.player.venomZ', dt, 60);
    assert.equal(g.run('G.stats.dmgTaken'), 18, 'real sting passes through armor and the run damage multiplier');
    g.run(`
      G.enemies = []; Combat.clear();
      var stingDmg = G.stats.dmgTaken;
      hurtEvents.length = 0;
      G.player.inv = 3; G.player.ghost = true;
      G.player.combo = 8; G.player.comboT = 10;
      G.player.hp = ${scenario === 'nonlethal' ? 2 : 80};
      G.player.shield = ${scenario === 'nonlethal' ? 0 : 6};
      G.god = ${scenario === 'god'};
    `);
    controllerAdvance(g, 1, dt);
    assert.equal(g.run('G.player.state'), 'normal', 'poison does not stagger the player');
    assert.equal(g.run('G.player.combo'), 8, 'poison preserves the active combo');
    close(g.run('G.player.inv'), 2, 'poison neither grants nor refreshes invulnerability');
    if (scenario === 'shields') {
      assert.equal(g.run('G.player.hp'), 80);
      assert.equal(g.run('G.player.shield'), 2, 'defended tick damage is absorbed by the shield');
      assert.deepEqual(g.json('hurtEvents'), [], 'fully absorbed poison does not report health damage');
      controllerAdvance(g, 0.7, dt);
      assert.equal(g.run('G.player.shield'), 0);
      assert.equal(g.run('G.player.hp'), 78, 'next tick uses the remaining shield before damaging health');
      assert.equal(g.run('G.stats.dmgTaken - stingDmg'), 2);
      assert.deepEqual(g.json('hurtEvents'), [2]);
      assert.ok(g.run('G.player.inv > 1'), 'existing poison still ticks while invulnerable');
    } else if (scenario === 'nonlethal') {
      controllerAdvance(g, 0.7, dt);
      assert.equal(g.run('G.player.hp'), 1);
      assert.equal(g.run('G.player.dead'), false);
      assert.equal(g.run('G.stats.dmgTaken - stingDmg'), 1, 'nonlethal damage records only actual health lost');
      assert.deepEqual(g.json('hurtEvents'), [1], 'ticks at one health do not create false damage events');
    } else {
      assert.equal(g.run('G.player.hp'), 80);
      assert.equal(g.run('G.player.shield'), 6, 'God mode also protects against poison already applied');
      assert.equal(g.run('G.stats.dmgTaken'), g.run('stingDmg'));
      assert.deepEqual(g.json('hurtEvents'), []);
    }
  }
});

test('phase-two toad tongue capture and delayed spit use defenses and actual damage while remaining nonlethal', () => {
  const dt = 1 / 60;
  for (const [hp, shield, expectedDamage, god] of [[80, 11, 13, false], [5, 22, 2, false], [5, 4, 4, false], [80, 11, 0, true]]) {
    const g = game();
    begin(g);
    g.run(`
      G.player.x = 320; G.player.shield = 6; G.player.inv = 0;
      G.run.dmgTakenMult = 1.5; G.player.stats.armor = 0.5;
      var toad = new Boss('toad', 200, 288);
      toad.phase = 2; toad.dmgMul = 2; toad.face = 1; toad.onGround = true;
      toad.setState('tongueW', 'mouth'); toad.stT = 0.43;
      G.enemies = [toad];
      var hurtEvents = [];
      G.player.on('onHurt', (p, dmg) => hurtEvents.push(dmg));
    `);
    controllerUntil(g, 'G.player.hidden', dt, 60);
    assert.equal(g.run('toad.state'), 'swallow', 'the real locked-angle tongue captures the player');
    assert.equal(g.run('G.stats.dmgTaken'), 15, 'tongue strike uses run scaling, armor and the initial shield');
    assert.deepEqual(g.json('hurtEvents'), [15]);
    g.run(`
      G.player.hp = ${hp}; G.player.shield = ${shield}; G.player.inv = 5;
      G.god = ${god};
    `);
    controllerUntil(g, '!G.player.hidden', dt, 90);
    assert.equal(g.run('G.player.hp'), hp - expectedDamage);
    assert.equal(g.run('G.player.shield'), god ? shield : Math.max(0, shield - 24), 'shield is consumed before the nonlethal health clamp');
    assert.equal(g.run('G.stats.dmgTaken'), 15 + expectedDamage);
    assert.deepEqual(g.json('hurtEvents'), expectedDamage ? [15, expectedDamage] : [15]);
    assert.equal(g.run('G.player.dead'), false);
    assert.ok(g.run('G.player.inv > 0'), 'the committed spit resolves despite previously granted invulnerability');
    assert.ok(g.run('G.player.vx > 300 && G.player.vy < -200'), 'spit preserves its authored launch instead of generic knockback');
  }
});

test('Gao full-screen mountain slam cannot damage or attach statuses underground, while existing burn and emerged targets still work', () => {
  const dt = 1 / 60;
  for (const [type, state, windup] of [['scorpqueen', 'dig', 0.6], ['gator', 'dive', 0.35], ['sandworm', 'sink', 0.4]]) {
    const g = game();
    begin(g, 'gao');
    g.run(`
      G.player.x = 300; G.player.inv = 10;
      G.player.secrets.down = { id: 'gao_mountain', lv: 1 };
      var target = ${type === 'scorpqueen' ? "new Boss('scorpqueen', 450, 288)" : `fixtureEnemy('${type}', 450)`};
      target.hp = target.maxHp = 10000; target.onGround = true;
      G.enemies = [target];
      applyStatus(target, 'burn', 3, 0.25);
      target.setState('${state}'); target.stT = ${windup};
      Input.virt('ArrowDown', true);
    `);
    controllerAdvance(g, dt, dt);
    assert.equal(g.run('target.intangible'), true, type + ' enters its actual underground state');
    controllerPress(g, 'KeyI', dt);
    assert.equal(g.run('G.player.move.name'), 'ult2');
    g.run('var buriedHp = target.hp; var existingBurn = target.st.burn; var existingBurnDmg = target.st.burnDmg; G.player.updMove(1.31, 0);');
    assert.equal(g.run('G.player.move.landed'), true, 'real mountain fallback slam runs');
    assert.equal(g.run('target.hp'), g.run('buriedHp'), type + ' ignores the full-screen ground hit');
    assert.equal(g.run('target.st.stun'), 0, 'the blocked slam cannot stun an underground target');
    g.run("applyStatus(target, 'burn', 5, 1);");
    assert.equal(g.run('target.st.burn'), g.run('existingBurn'), 'new attacks cannot refresh an underground burn');
    assert.equal(g.run('target.st.burnDmg'), g.run('existingBurnDmg'));
    g.run('target.update(0.51);');
    assert.ok(g.run('target.hp < buriedHp && target.st.burn > 0'), 'burn attached before hiding still ticks through the actual entity update');
    controllerUntil(g, '!target.intangible && target.onGround && !G.player.move', dt);
    g.run('target.x = 450; target.y = 288; target.onGround = true; G.player.x = 300; G.player.y = 288; G.player.onGround = true; G.player.mana = G.player.stats.maxMana;');
    controllerPress(g, 'KeyI', dt);
    assert.equal(g.run('G.player.move.name'), 'ult2');
    g.run('var emergedHp = target.hp; G.player.updMove(1.31, 0);');
    assert.ok(g.run('target.hp < emergedHp'), type + ' takes the full-screen hit after its actual emergence');
    assert.ok(g.run('target.st.stun > 0'), 'emerged targets receive the landed stun');
    assert.deepEqual(g.errors, []);
  }
});

test('real U upgrades open exactly their ladder stages and fully upgraded U skills leave both reward pools', () => {
  const g = game();
  for (const hero of ['rin', 'eve', 'gao']) {
    for (const slot of ['shot', 'up', 'down', 'dash']) {
      begin(g, hero);
      const id = hero + '_u_' + slot;
      const levels = g.json(`WX_LEVELS['${id}']`);
      for (let level = 1; level <= levels.length; level++) {
        if (level > 1) g.run(`takeArt(G.player, { kind: 'uUp', id: '${id}' });`);
        assert.equal(g.run(`G.player.uskills.${slot}.lv`), level);
        g.run(`G.player.endMove(); G.player.lastU = null; G.time += 1;`);
        assert.equal(g.run(`G.player.trySkill('${slot}')`), true);
        for (let stage = 0; stage < levels[level - 1].n; stage++) {
          assert.equal(g.run('G.player.move.name'), g.run(`USKILLS['${id}'].moves[${stage}]`), id + ' level ' + level);
          g.run('G.player.updMove(0.17, 0);');
          assert.equal(g.run(`G.player.trySkill('${slot}')`), stage + 1 < levels[level - 1].n, id + ' stage gate');
        }
      }
      assert.equal(g.run(`upgradeTargets(G.player).some(card => card.kind === 'uUp' && card.id === '${id}')`), false);
      for (let seed = 1; seed <= 5; seed++) {
        g.run(`Math.random = RNG(${seed}).next;`);
        assert.equal(g.run(`rollArts(G.player, 30).some(card => card.kind === 'uUp' && card.id === '${id}')`), false);
      }
      g.run('Math.random = () => 0.9;');
    }
  }
});

test('every U stage runs its start, events and update through the game loop with real monsters', () => {
  const g = game();
  for (const hero of ['rin', 'eve', 'gao']) {
    const skills = g.json(`Object.values(USKILLS).filter(U => U.hero === '${hero}').map(U => ({ id: U.id, slot: U.slot, moves: U.moves }))`);
    for (const skill of skills) {
      for (let stage = 0; stage < skill.moves.length; stage++) {
        begin(g, hero);
        g.run(`
          G.player.uskills.${skill.slot}.lv = wxMax(USKILLS['${skill.id}']);
          G.player.inv = 10;
          fixtureEnemy('soldier', 135); fixtureEnemy('crawler', 195); fixtureEnemy('drone', 250, 245);
          G.player.startUStage(USKILLS['${skill.id}'], ${stage});
          fixtureAdvance(3.5);
        `);
        assert.deepEqual(g.errors, [], skill.id + ' stage ' + stage + ': delayed callback errors');
        assert.ok(g.run('Number.isFinite(G.player.x) && Number.isFinite(G.player.y) && Number.isFinite(G.player.hp)'));
        assert.equal(g.run('G.player.move'), null, skill.id + ' stage ' + stage + ' completes');
        assert.equal(g.run('G.timers.length'), 0, 'all delayed stage callbacks run');
        assert.ok(g.run('G.enemies.every(e => Number.isFinite(e.x) && Number.isFinite(e.y) && Number.isFinite(e.hp))'));
      }
    }
  }
});

function controllerRoom(g, hero, ice, dt) {
  begin(g, hero);
  g.run(`
    for (const key of ['KeyL', 'KeyJ', 'KeyK', 'KeyU', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) Input.virt(key, false);
    Input.endStep();
    G.player.x = 400;
    G.room.ice = new Set(${ice ? 'Array.from({ length: G.room.w }, (_, x) => x)' : '[]'});
    updatePlay(${dt}); Input.endStep();
    var dashEvents = { start: 0, end: 0, perfect: 0 };
    G.player.on('onDash', () => dashEvents.start++);
    G.player.on('onDashEnd', () => dashEvents.end++);
    G.player.on('onPerfect', () => dashEvents.perfect++);
    var dashOrigin = G.player.x;
  `);
  assert.equal(!!g.run('G.player.onIce()'), ice, 'real floor collision initializes surface friction');
}

function controllerPress(g, key, dt) {
  g.run(`Input.virt('${key}', true); updatePlay(${dt}); Input.endStep(); Input.virt('${key}', false);`);
}

function controllerAdvance(g, seconds, dt) {
  g.run(`for (let frame = 0; frame < ${Math.ceil(seconds / dt - 1e-9)}; frame++) { updatePlay(${dt}); Input.endStep(); }`);
}

function controllerUntil(g, condition, dt, maxFrames = 240) {
  g.run(`for (let frame = 0; frame < ${maxFrames} && !(${condition}); frame++) { updatePlay(${dt}); Input.endStep(); }`);
  assert.equal(!!g.run(condition), true, 'game loop reaches: ' + condition);
}

function controllerDash(g, dt) {
  controllerPress(g, 'KeyL', dt);
  assert.equal(g.run('G.player.state'), 'dash');
}

function controllerFinishDash(g, dt, expectedEnds = 1) {
  g.run(`for (let frame = 0; frame < ${Math.ceil(0.5 / dt)} && G.player.state === 'dash'; frame++) { updatePlay(${dt}); Input.endStep(); }`);
  assert.equal(g.run('G.player.state'), 'normal');
  assert.equal(g.run('dashEvents.end'), expectedEnds);
}

test('natural dash exits stop promptly on floor and ice at 30, 60 and 120 Hz while held input remains responsive', t => {
  const g = game();
  const measured = [];
  for (const hero of ['rin', 'eve', 'gao']) {
    for (const ice of [false, true]) {
      for (const fps of [30, 60, 120]) {
        const dt = 1 / fps;
        controllerRoom(g, hero, ice, dt);
        controllerDash(g, dt);
        controllerFinishDash(g, dt);
        g.run('var exitX = G.player.x;');
        controllerAdvance(g, 0.25, dt);
        const residual = g.run('Math.abs(G.player.x - exitX)');
        measured.push({ hero, ice, fps, residual });
        assert.ok(residual <= 16, `${hero} ${ice ? 'ice' : 'floor'} ${fps}Hz residual ${residual}px`);
        close(g.run('G.player.vx'), 0, 'neutral exit settles');
        assert.deepEqual(g.json('dashEvents'), { start: 1, end: 1, perfect: 0 });
      }
      for (const direction of [1, -1]) {
        const dt = 1 / 60;
        controllerRoom(g, hero, ice, dt);
        controllerDash(g, dt);
        controllerFinishDash(g, dt);
        g.run(`var exitX = G.player.x; Input.virt('${direction > 0 ? 'ArrowRight' : 'ArrowLeft'}', true);`);
        controllerAdvance(g, 0.25, dt);
        close(g.run('G.player.vx'), g.run('G.player.hero.speed * G.player.stats.speedMul') * direction, 'held input reaches walk speed');
        assert.ok(g.run('G.player.x - exitX') * direction > 20, 'held and reverse directions move the player');
      }
      if (ice) {
        controllerRoom(g, hero, true, 1 / 60);
        g.run("Input.virt('ArrowRight', true);");
        controllerAdvance(g, 0.05, 1 / 60);
        close(g.run('G.player.vx'), 21, 'ordinary ice walking retains its original acceleration');
      }
    }
  }
  t.diagnostic('maximum neutral residual over 0.25s: ' + Math.max(...measured.map(row => row.residual)).toFixed(2) + 'px');
});

test('attack, jump and U dash cancellations brake their remaining velocity without removing authored lunges', t => {
  const g = game();
  const measured = [];
  for (const hero of ['rin', 'eve', 'gao']) {
    for (const ice of [false, true]) {
      for (const fps of [30, 60]) {
        const dt = 1 / fps;
        for (const [action, key] of [['attack', 'KeyJ'], ['jump', 'KeyK'], ['u', 'KeyU']]) {
          controllerRoom(g, hero, ice, dt);
          controllerDash(g, dt);
          controllerAdvance(g, 0.05, dt);
          controllerPress(g, key, dt);
          assert.equal(g.run('dashEvents.end'), 1, action + ' exits the dash exactly once');
          if (action === 'attack') {
            assert.equal(g.run('G.player.move.name'), 'dashAtk');
            g.run('var forcedEnd = Math.max(...G.player.move.m.vel.map(v => v[1])); var sawAuthored = false;');
            g.run(`
              while (G.player.move && G.player.move.t < forcedEnd) {
                updatePlay(${dt}); Input.endStep();
                const mv = G.player.move;
                const authored = mv && mv.m.vel.find(v => mv.t >= v[0] && mv.t < v[1]);
                if (authored && G.player.vx === G.player.face * authored[2]) sawAuthored = true;
              }
            `);
            assert.equal(g.run('sawAuthored'), true, hero + ' keeps the authored attack lunge');
          } else if (action === 'jump') {
            assert.ok(g.run('G.player.y < 288 && !G.player.onGround'), 'real jump leaves the floor');
          } else {
            assert.equal(g.run('G.player.move.m.uskill'), hero + '_u_dash');
          }
          g.run('var residualX = G.player.x;');
          controllerAdvance(g, 0.3, dt);
          const residual = g.run('Math.abs(G.player.x - residualX)');
          const total = g.run('Math.abs(G.player.x - dashOrigin)');
          measured.push({ hero, ice, fps, action, residual, total });
          assert.ok(residual <= (action === 'attack' ? 60 : 50), `${hero} ${action} ${fps}Hz residual ${residual}px`);
          assert.ok(total < 200, `${hero} ${action} complete motion ${total}px`);
          close(g.run('G.player.vx'), 0, action + ' settles');
          assert.deepEqual(g.json('dashEvents'), { start: 1, end: 1, perfect: 0 });
        }
      }
    }
  }
  for (const action of ['attack', 'jump', 'u']) {
    const rows = measured.filter(row => row.action === action);
    t.diagnostic(action + ': max residual ' + Math.max(...rows.map(row => row.residual)).toFixed(2) + 'px/0.3s; max complete motion ' + Math.max(...rows.map(row => row.total)).toFixed(2) + 'px');
  }
});

test('late dash attacks after holding direction re-arm braking, and perfect dodge and exit hooks stay single-shot', t => {
  const g = game();
  const measured = [];
  for (const hero of ['rin', 'eve', 'gao']) {
    const dt = 1 / 60;
    controllerRoom(g, hero, true, dt);
    g.run("Input.virt('ArrowRight', true);");
    controllerDash(g, dt);
    controllerFinishDash(g, dt);
    controllerAdvance(g, 0.07, dt);
    assert.ok(g.run('G.player.postDashT > 0'), 'late attack still belongs to the dash attack window');
    close(g.run('G.player.vx'), g.run('G.player.hero.speed * G.player.stats.speedMul'), 'holding resumes ordinary walking');
    controllerPress(g, 'KeyJ', dt);
    assert.equal(g.run('G.player.move.name'), 'dashAtk');
    g.run('var forcedEnd = Math.max(...G.player.move.m.vel.map(v => v[1])); var sawAuthored = false;');
    g.run(`
      while (G.player.move && G.player.move.t < forcedEnd) {
        updatePlay(${dt}); Input.endStep();
        const mv = G.player.move;
        const authored = mv && mv.m.vel.find(v => mv.t >= v[0] && mv.t < v[1]);
        if (authored && G.player.vx === G.player.face * authored[2]) sawAuthored = true;
      }
      Input.virt('ArrowRight', false);
      var tailX = G.player.x;
    `);
    assert.equal(g.run('sawAuthored'), true);
    controllerAdvance(g, 0.3, dt);
    const residual = g.run('Math.abs(G.player.x - tailX)');
    measured.push(residual);
    assert.ok(residual <= 60, hero + ' late ice attack residual ' + residual + 'px');
    close(g.run('G.player.vx'), 0, 'late attack tail settles');
    assert.equal(g.run('dashEvents.end'), 1);

    controllerRoom(g, hero, true, dt);
    g.run("G.run.mode = 'normal'; G.player.recalc(); G.player.on('onPerfect', () => dashEvents.perfect++); G.player.on('onDashEnd', () => dashEvents.end++); G.player.on('onDash', () => dashEvents.start++);");
    controllerDash(g, dt);
    g.run('hurtPlayer(20, G.player.x + 40); hurtPlayer(20, G.player.x + 40);');
    assert.equal(g.run('G.stats.perfects'), 1);
    assert.equal(g.run('dashEvents.perfect'), 1);
    controllerFinishDash(g, dt);
    controllerAdvance(g, 0.25, dt);
    assert.deepEqual(g.json('dashEvents'), { start: 1, end: 1, perfect: 1 });
    assert.equal(g.run('G.player.hp'), g.run('G.player.maxHp'));
    controllerDash(g, dt);
    g.run('hurtPlayer(20, G.player.x + 40);');
    assert.equal(g.run('G.stats.perfects'), 2, 'new dash opens a new perfect-dodge window');
    controllerFinishDash(g, dt, 2);
    assert.deepEqual(g.json('dashEvents'), { start: 2, end: 2, perfect: 2 });
  }
  t.diagnostic('maximum late ice dash-attack residual over 0.3s: ' + Math.max(...measured).toFixed(2) + 'px');
});

test('a late Raiden art keeps braking armed through its stationary windup and original 760-speed lunge on ice', t => {
  const g = game();
  const measured = [];
  for (const fps of [30, 60, 120]) {
    const dt = 1 / fps;
    controllerRoom(g, 'rin', true, dt);
    g.run("G.player.arts.dash = { id: 'rin_raiden', lv: 1 };");
    controllerDash(g, dt);
    controllerFinishDash(g, dt);
    controllerAdvance(g, 0.075, dt);
    close(g.run('G.player.vx'), 0, 'natural dash stops before the late attack');
    assert.ok(g.run('G.player.postDashT > 0'));
    controllerPress(g, 'KeyJ', dt);
    assert.equal(g.run('G.player.move.name'), 'raiden1');
    close(g.run('G.player.vx'), 0, 'stationary windup begins without inherited dash speed');
    g.run('var sawAuthored = false; var forcedEnd = Math.max(...G.player.move.m.vel.map(v => v[1]));');
    g.run(`
      while (G.player.move && G.player.move.t < forcedEnd) {
        updatePlay(${dt}); Input.endStep();
        const mv = G.player.move;
        if (mv && mv.t >= 0.02 && mv.t < 0.16 && G.player.vx === 760) sawAuthored = true;
      }
      var lungeEndX = G.player.x;
    `);
    assert.equal(g.run('sawAuthored'), true, 'authored 760-speed Raiden lunge remains intact');
    controllerAdvance(g, 0.4, dt);
    const residual = g.run('Math.abs(G.player.x - lungeEndX)');
    const total = g.run('Math.abs(G.player.x - dashOrigin)');
    measured.push({ fps, residual, total });
    assert.ok(residual <= 140, fps + 'Hz late Raiden tail ' + residual + 'px');
    assert.ok(total < g.run('W'), fps + 'Hz complete motion ' + total + 'px stays under one screen');
    close(g.run('G.player.vx'), 0, 'Raiden tail settles on ice');
    assert.equal(g.run('G.player.move'), null);
    assert.deepEqual(g.json('dashEvents'), { start: 1, end: 1, perfect: 0 });
    const stoppedX = g.run('G.player.x');
    controllerAdvance(g, 1, dt);
    close(g.run('G.player.x'), stoppedX, 'the player remains stopped after the art ends');
  }
  t.diagnostic('maximum late Raiden residual ' + Math.max(...measured.map(row => row.residual)).toFixed(2) + 'px/0.4s; complete motion ' + Math.max(...measured.map(row => row.total)).toFixed(2) + 'px');
});
