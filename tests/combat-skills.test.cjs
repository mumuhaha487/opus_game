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
    close(g.run('hits[0].dmg'), g.run('G.player.atk') * 2.4 * 1.3, 'blast damage');
    for (const shard of g.json('shards.map(pr => ({ dmg: pr.hit.dmg, wx: pr.hit.wx }))')) {
      assert.deepEqual(shard.wx, { fam: 'u', id: 'eve_u_shot' });
      close(shard.dmg, g.run('G.player.atk') * 0.5 * 1.3, 'fragment damage');
    }
    g.run('shards[0].update(0.1);');
    close(g.run('hits[1].dmg'), g.run('G.player.atk') * 0.5 * 1.3, 'actual fragment collision');
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

test('all heroes start with four mana-free U slots and independent cooldowns selected by real input', () => {
  const g = game();
  for (const hero of ['rin', 'eve', 'gao']) {
    begin(g, hero);
    assert.deepEqual(g.json('Object.keys(G.player.uskills).sort()'), ['dash', 'down', 'shot', 'up']);
    g.run('G.player.mana = 0;');
    for (const slot of ['shot', 'up', 'down', 'dash']) {
      g.run(`
        if (G.player.move) G.player.endMove();
        G.player.lastU = null; G.player.postDashT = ${slot === 'dash' ? 1 : 0};
        Input.virt('ArrowUp', ${slot === 'up'}); Input.virt('ArrowDown', ${slot === 'down'}); Input.endStep();
      `);
      assert.equal(g.run('G.player.uSlot()'), slot);
      assert.equal(g.run('G.player.trySkill()'), true, hero + ' ' + slot);
      assert.equal(g.run('G.player.mana'), 0);
      assert.equal(g.run(`G.player.move.m.uskill`), hero + '_u_' + slot);
      close(g.run(`G.player.ucd.${slot}`), g.run(`uCooldown(USKILLS['${hero}_u_${slot}'])`), slot + ' initial cooldown');
      assert.equal(g.run(`G.player.trySkill('${slot}')`), false, 'same cooldown denies an immediate recast');
    }
    assert.equal(g.run('G.stats.uskills'), 4);
    g.run("Input.virt('ArrowUp', false); Input.virt('ArrowDown', false); Input.endStep(); var before = { ...G.player.ucd }; G.player.update(0.1);");
    for (const slot of ['shot', 'up', 'down', 'dash']) close(g.run(`G.player.ucd.${slot}`), g.run(`before.${slot} - 0.1`), slot + ' cooldown advances');
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
        g.run(`G.player.endMove(); G.player.lastU = null; G.player.ucd.${slot} = 0; G.time += 1;`);
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
