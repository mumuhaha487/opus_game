'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sourceDir = path.join(__dirname, '..', 'entropy-blade', 'js');
const trial3 = { reinforce: 1 };
const trial12 = { fierce: 3, boss: 2 };
const trial16 = { fierce: 3, edge: 3, barrage: 2 };
const trial30 = { fierce: 3, edge: 3, haste: 2, barrage: 2, elite: 2, reinforce: 1 };
const trial40 = { ...trial30, boss: 2, wither: 2 };

function game(saved) {
  const storage = new Map(saved ? [['entropy_blade_save_v1', JSON.stringify(saved)]] : []);
  const drawn = [];
  const noop = () => {};
  const rendering = new Proxy({}, { get: (target, key) => key in target ? target[key] : noop });
  const context = vm.createContext({
    console, Math: Object.create(Math),
    window: { addEventListener: noop }, navigator: {},
    document: { createElement: () => ({ getContext: () => rendering }) },
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    FX: rendering, Cam: rendering, Light: rendering, Sound: rendering,
    bakeSprite: () => ({}),
    Gfx: { uctx: rendering, artBegin: noop }, TouchUI: { enabled: false },
    Text: { draw: (ctx, text) => drawn.push(String(text)), wrap: text => [text], measure: text => String(text).length * 8 },
  });
  const run = code => vm.runInContext(code, context);
  for (const name of ['core', 'sprites', 'heroes', 'heroes_eve', 'heroes_gao', 'arts', 'upgrades', 'trials', 'combat', 'player', 'world', 'enemies', 'enemies2', 'bosses', 'bosses2', 'game', 'ui']) {
    vm.runInContext(fs.readFileSync(path.join(sourceDir, name + '.js'), 'utf8'), context, { filename: name + '.js' });
  }
  // Replace only expensive raster generation; gameplay and menu handlers are real source.
  run(`
    bakeHero = (id, weapon) => (SPR[id] = { weapon, ox: 0, oy: 0, anims: { idle: { frames: [{}] } } });
    animFrame = () => ({});
    for (const D of Object.values(ENEMY_DEFS)) for (let bi = 0; bi < 4; bi++) SPR[D.spr + bi] = { ox: 0, oy: 0 };
    for (const D of Object.values(BOSS_DEFS)) SPR[D.spr] = { ox: 0, oy: 0 };
    genRoom = (seed, bi) => ({ bi, spawnX: 80, spawnY: 100, pw: 960, ph: 320, base: 18, floorBelow: () => 288 });
    Math.random = () => 0.9;
  `);
  return { run, drawn, storage, json: code => JSON.parse(JSON.stringify(run(code))) };
}

function start(g, mode = 'normal', curses = null, weapon = 'rin_hizakura') {
  g.run(`startRun('rin', ${JSON.stringify(weapon)}, ${JSON.stringify(curses)}, ${JSON.stringify(mode)});`);
}

function finishTimers(g) {
  g.run('for (const timer of G.timers.splice(0).sort((a, b) => a.t - b.t)) timer.fn();');
}

const modes = [
  { id: 'normal', hp: 120, damage: 17, window: 0.238, shield: 18, clear: 30, supply: 62, charge1: 0.315, charge2: 0.7875, kill: 2 },
  { id: 'hard', hp: 110, damage: 19, window: 0.204, shield: 9, clear: 18, supply: 51, charge1: 0.378, charge2: 0.945, kill: 1 },
];

for (const expected of modes) {
  test(expected.id + ': selected assists apply without compounding and reach the damage/dodge/charge paths', () => {
    const g = game();
    start(g, expected.id);
    assert.equal(g.run('G.player.maxHp'), expected.hp);
    g.run('for (let i = 0; i < 5; i++) G.player.recalc(); G.player.inv = 0; hurtPlayer(20, 200, { noStagger: true });');
    assert.equal(g.run('G.player.hp'), expected.hp - expected.damage);
    assert.equal(g.run('G.player.hooks.onKill.length'), 1);
    assert.ok(Math.abs(g.run('G.player.stats.pdWindow') - expected.window) < 1e-9);
    g.run(`G.player.state = 'dash'; G.player.pdDone = false; G.player.dashT0 = 0; G.time = ${expected.window - 0.00001};`);
    assert.equal(g.run('G.player.isPerfectWindow()'), true);
    g.run('G.time += 0.00002;');
    assert.equal(g.run('G.player.isPerfectWindow()'), false);
    g.run("Input.virt('KeyJ', true); Input.endStep(); G.player.onGround = true; G.player.tech.charge2 = true; G.player.enterCharge();");
    g.run(`G.player.updCharge(${expected.charge1 - 0.00001}, 0);`);
    assert.equal(g.run('G.player.chargeLv'), 0);
    g.run('G.player.updCharge(0.00002, 0);');
    assert.equal(g.run('G.player.chargeLv'), 1);
    g.run(`G.player.updCharge(${expected.charge2 - expected.charge1 - 0.00002}, 0);`);
    assert.equal(g.run('G.player.chargeLv'), 1);
    g.run('G.player.updCharge(0.00002, 0);');
    assert.equal(g.run('G.player.chargeLv'), 2);
  });

  test(expected.id + ': combat, elite and both boss outcomes heal once; other rooms do not', () => {
    const g = game();
    start(g, expected.id);
    for (const type of ['combat', 'elite']) {
      g.run(`enterRoom({ type: '${type}' }); G.player.hp = G.player.maxHp - 60; G.player.stats.healMul = 2; roomClear();`);
      assert.equal(g.run('G.player.hp'), expected.hp - 60 + expected.clear);
      g.run('G.player.hp -= 10; roomClear(); healClearedRoom();');
      assert.equal(g.run('G.player.hp'), expected.hp - 70 + expected.clear);
    }
    for (const final of [false, true]) {
      g.run(`G.run.scene = ${final ? 'SCENES.findIndex(scene => scene.final)' : 0}; G.run.biome = SCENES[G.run.scene].bi; enterRoom({ type: 'boss' }); G.player.hp = G.player.maxHp - 60; G.onBossKilled(G.boss);`);
      finishTimers(g);
      assert.equal(g.run('G.player.hp'), expected.hp - 60 + expected.clear);
      g.run('G.player.hp -= 10; healClearedRoom();');
      assert.equal(g.run('G.player.hp'), expected.hp - 70 + expected.clear);
      g.run("G.state = 'play';");
    }
    for (const type of ['start', 'shop', 'rest', 'event']) {
      g.run(`G.run.scene = 0; G.run.biome = SCENES[0].bi; enterRoom({ type: '${type}' }); G.player.hp = G.player.maxHp - 60; healClearedRoom();`);
      assert.equal(g.run('G.player.hp'), expected.hp - 60);
    }
  });

  test(expected.id + ': entry shields do not stack; supply healing stays separate from kill/reward healing', () => {
    const g = game();
    start(g, expected.id);
    for (const type of ['combat', 'elite', 'boss']) {
      g.run(`G.player.shield = 0; enterRoom({ type: '${type}' });`);
      assert.equal(g.run('G.player.shield'), expected.shield);
      g.run(`enterRoom({ type: '${type}' });`);
      assert.equal(g.run('G.player.shield'), expected.shield);
      g.run(`G.player.shield = 40; enterRoom({ type: '${type}' });`);
      assert.equal(g.run('G.player.shield'), 40);
    }
    for (const type of ['start', 'shop', 'rest', 'event']) {
      g.run(`G.player.shield = 0; enterRoom({ type: '${type}' });`);
      assert.equal(g.run('G.player.shield'), 0);
    }
    g.run('G.player.hp = 1; G.run.gold = 100; new Pedestal(0, 0, { kind: "potion", price: 50 }).use();');
    assert.equal(g.run('G.player.hp'), 1 + expected.supply);
    g.run('G.player.hp = 1; new Fountain(0, 0, 0.4).use();');
    assert.equal(g.run('G.player.hp'), 1 + expected.supply);
    g.run('G.player.hp = 1; G.player.heal(10, true);');
    assert.equal(g.run('G.player.hp'), 11);
    g.run('G.player.hp = 1; new Orb(0, 0, "heal").use();');
    assert.equal(g.run('G.player.hp'), expected.id === 'normal' ? 43 : 40);
    g.run('G.player.hp = 1; G.player.stats.healMul = 2; const victim = new Enemy("crawler", 200, 288, { noSpawn: true }); hitEnemy(G.player, victim, { dmg: 999, noCrit: true, noEnergy: true, noCombo: true, dot: true }, 200, 280);');
    assert.equal(g.run('victim.dead'), true);
    assert.equal(g.run('G.player.hp'), 1 + expected.kill);
    g.run('hitEnemy(G.player, victim, { dmg: 999, dot: true }, 200, 280);');
    assert.equal(g.run('G.player.hp'), 1 + expected.kill);
  });
}

test('trial mode with zero curses removes every selected assist, including after a hard run', () => {
  const g = game();
  start(g, 'hard');
  start(g, 'trial', {});
  assert.equal(g.run('curDifficulty()'), null);
  assert.deepEqual(g.json('[G.run.mode, G.player.maxHp, G.player.stats.armor, G.player.stats.pdWindow, G.player.stats.supplyHealMul, G.player.stats.chargeTimeMul, G.player.hooks.onKill.length]'), ['trial', 100, 0, 0.17, 1, 1, 0]);
  for (const type of ['combat', 'elite', 'boss']) {
    g.run(`enterRoom({ type: '${type}' }); G.player.hp = 40; healClearedRoom();`);
    assert.equal(g.run('G.player.hp'), 40);
    assert.equal(g.run('G.player.shield'), 0);
  }
  g.run('G.player.hp = 100; G.player.inv = 0; hurtPlayer(20, 200, { noStagger: true });');
  assert.equal(g.run('G.player.hp'), 80);
  g.run('G.player.hp = 1; G.player.fire("onKill"); new Fountain(0, 0, 0.4).use();');
  assert.equal(g.run('G.player.hp'), 41);
  start(g, 'normal');
  assert.equal(g.run('G.player.maxHp'), 120);
  assert.equal(g.run('G.player.hooks.onKill.length'), 1);
});

test('the assisted perfect-dodge tail survives dash movement without allowing a second dodge', () => {
  const g = game();
  for (const [mode, time, allowed] of [['normal', 0.21, true], ['hard', 0.21, false], ['hard', 0.20, true], ['trial', 0.20, false]]) {
    start(g, mode, mode === 'trial' ? {} : null);
    g.run(`G.time = 0; G.player.onGround = true; G.player.doDash(); G.player.updDash(0.20); G.time = ${time};`);
    assert.equal(g.run('G.player.state'), 'normal');
    assert.equal(g.run('!!G.player.isPerfectWindow()'), allowed);
    if (allowed) {
      g.run('G.player.inv = 0; hurtPlayer(20, 200);');
      assert.equal(g.run('G.player.hp'), g.run('G.player.maxHp'));
      assert.equal(g.run('G.player.pdDone'), true);
      assert.equal(g.run('!!G.player.isPerfectWindow()'), false);
    }
    g.run('G.player.pdDone = false; G.player.state = "hurt";');
    assert.equal(g.run('!!G.player.isPerfectWindow()'), false);
    g.run('G.player.state = "normal"; G.player.dead = true;');
    assert.equal(g.run('!!G.player.isPerfectWindow()'), false);
    g.run('G.player.dead = false; G.time = -0.01;');
    assert.equal(g.run('!!G.player.isPerfectWindow()'), false);
  }
});

test('maximum-health purchases and rewards display the scaled increase they actually grant', () => {
  const g = game();
  for (const [mode, curses, purchase, reward] of [['normal', null, 24, 18], ['hard', null, 22, 17], ['trial', { frail: 1 }, 15, 11]]) {
    start(g, mode, curses);
    g.run('G.run.gold = 100; var beforePurchase = G.player.maxHp; var bloodJade = new Pedestal(0, 0, { kind: "maxhp", price: 80 });');
    assert.equal(g.run('bloodJade.desc()'), '最大生命 +' + purchase);
    g.run('bloodJade.use();');
    assert.equal(g.run('G.player.maxHp - beforePurchase'), purchase);
    assert.equal(g.run('G.toasts[G.toasts.length - 1].title'), '生命上限 +' + purchase);
    g.run('var beforeReward = G.player.maxHp; new Orb(0, 0, "maxhp").use();');
    assert.equal(g.run('G.player.maxHp - beforeReward'), reward);
    assert.equal(g.run('G.toasts[G.toasts.length - 1].title'), '生命上限 +' + reward);
  }
});

test('trial thresholds replace the old benefits and frail preserves the earned extra revive', () => {
  const g = game();
  start(g, 'trial', trial3);
  assert.equal(g.run('G.run.hard.pts'), 3);
  assert.equal(g.run('G.player.revives'), 1);
  assert.equal(g.run('G.run.hard.crystalMul'), 1.06);
  g.run('G.player.hp = 0; G.player.die();');
  assert.equal(g.run('G.player.dead'), false);
  assert.equal(g.run('G.player.revives'), 0);
  assert.equal(g.run('G.player.hp'), 40);
  start(g, 'trial', trial12);
  assert.equal(g.run('G.run.hard.pts'), 12);
  assert.equal(g.run('G.run.gold'), 100);
  assert.deepEqual(g.json('G.inters.filter(it => it instanceof Orb).map(it => it.kind)'), ['art', 'sigil']);
  g.run('Save.data.talents.reroll = 1;');
  start(g, 'trial', trial16);
  assert.equal(g.run('G.run.hard.pts'), 16);
  assert.equal(g.run('G.run.rerolls'), 1);
  assert.equal(g.run('G.run.hard.discount'), 0.8);
  start(g, 'trial', trial30);
  assert.equal(g.run('G.run.hard.pts'), 30);
  assert.equal(g.run('G.player.damageMult(null, { src: "light" })'), 1.15);
  assert.equal(g.run('G.run.hard.shopBargainChance'), 0.2);
  g.run('G.player.hp = 40; G.player.fire("onKill");');
  assert.equal(g.run('G.player.hp'), 40);
  g.run('Save.data.talents.revive = 1;');
  start(g, 'trial', { frail: 1 });
  assert.equal(g.run('G.player.maxHp'), 75);
  assert.equal(g.run('G.player.revives'), 1);
  start(g, 'trial', trial3);
  assert.equal(g.run('G.player.revives'), 2);
});

test('shops use eightfold pricing or onefold bargains on a partial subset, and charge the displayed price', () => {
  const g = game();
  start(g, 'trial', trial16);
  g.run('rollSigils = () => []; enterRoom({ type: "shop" });');
  assert.deepEqual(g.json('G.inters.filter(it => it instanceof Pedestal).map(it => [it.item.kind, it.item.price])'), [['potion', 40], ['maxhp', 80], ['upgrade', 88]]);
  start(g, 'trial', trial30);
  g.run('let shopRolls = [0.9, 0.9, 0.19, 0.21, 0.9]; Math.random = () => shopRolls.shift() ?? 0.9; enterRoom({ type: "shop" }); const potion = G.inters.find(it => it instanceof Pedestal);');
  assert.deepEqual(g.json('G.inters.filter(it => it instanceof Pedestal).map(it => [it.item.originalPrice, it.item.discount, it.item.price])'), [[50, 0.1, 5], [100, 0.8, 80], [110, 0.8, 88]]);
  assert.match(g.run('potion.prompt()'), /5/);
  g.drawn.length = 0;
  g.run('potion.draw(Gfx.uctx, Gfx.uctx, 0, 0);');
  assert.ok(g.drawn.includes('5'));
  g.run('G.run.gold = 100; potion.use();');
  assert.equal(g.run('G.run.gold'), 95);
  assert.equal(g.run('potion.sold'), true);
  g.run('Math.random = () => 0; G.inters = []; setupShop();');
  const discounts = g.json('G.inters.filter(it => it instanceof Pedestal).map(it => it.item.discount)');
  assert.ok(discounts.includes(0.1));
  assert.ok(discounts.includes(0.8));
});

test('the level-40 trial title is awarded only on victory and persists with doubled crystals', () => {
  const g = game();
  start(g, 'trial', trial40);
  assert.equal(g.run('G.run.hard.pts'), 40);
  assert.equal(g.run('G.run.hard.crystalMul'), 3.6);
  g.run('endRun(false);');
  assert.deepEqual(g.json('Save.data.titles'), []);
  assert.equal(g.run('UI.endScreen.titleAwarded'), null);
  start(g, 'trial', trial40);
  g.run('endRun(true); Save.load();');
  assert.deepEqual(g.json('Save.data.titles'), ['劫主']);
  assert.equal(g.run('Save.data.crystals'), 144);
  assert.equal(g.run('UI.endScreen.titleAwarded'), '劫主');
  start(g, 'trial', trial40);
  g.run('endRun(true);');
  assert.deepEqual(g.json('Save.data.titles'), ['劫主']);
  assert.equal(g.run('UI.endScreen.titleAwarded'), null);
});

test('old saves migrate and the difficulty screen exposes only normal and hard', () => {
  const g = game({ crystals: 87, talents: { hp: 1 }, lastChar: 0, lastMode: 'easy', stats: { bestTrial: 40 } });
  assert.equal(g.run('Save.data.crystals'), 87);
  assert.equal(g.run('Save.data.talents.hp'), 1);
  assert.equal(g.run('Save.data.lastMode'), 'normal');
  assert.deepEqual(g.json('Save.data.titles'), ['劫主']);
  g.run('UI.titleAction(0);');
  assert.equal(g.run('UI.screen'), 'select');
  g.run('UI.startGame(); UI.drawMode();');
  assert.equal(g.run('UI.screen'), 'mode');
  assert.equal(g.run('G.trans'), null);
  assert.equal(g.run('G.run'), null);
  assert.equal(g.run('UI.newRegions.length'), 2);
  assert.ok(g.drawn.includes('普通模式'));
  assert.ok(g.drawn.includes('困难模式'));
  assert.ok(g.drawn.includes('通关回复已损失生命的50%'));
  assert.ok(g.drawn.includes('通关回复已损失生命的30%'));
  assert.ok(!g.drawn.some(text => text.includes('简单模式')));
});

test('starting a regular run selects hero and weapon before difficulty, with correct back navigation', () => {
  const g = game({ lastMode: 'hard', trialSel: trial3 });
  g.run("G.state = 'title'; UI.titleAction(0);");
  assert.equal(g.run('UI.screen'), 'select');
  assert.equal(g.run('UI.hardMode'), false);
  assert.equal(g.run('G.trans'), null);
  g.run('UI.heroSel = 1; UI.cycleWeapon(1); UI.startGame();');
  assert.equal(g.run('UI.screen'), 'mode');
  assert.equal(g.run('UI.modeSel'), 1);
  assert.equal(g.run('G.trans'), null);
  assert.equal(g.run('Save.data.stats.runs'), 0);
  assert.equal(g.run('UI.selWeapon("eve").id'), 'eve_dragon');
  g.run('Input.virt("Escape", true); UI.updTitle(0); Input.virt("Escape", false); Input.endStep();');
  assert.equal(g.run('UI.screen'), 'select');
  assert.equal(g.run('UI.heroSel'), 1);
  assert.equal(g.run('UI.selWeapon("eve").id'), 'eve_dragon');
  g.run('UI.startGame();');
  assert.equal(g.run('UI.screen'), 'mode');
  assert.equal(g.run('G.trans'), null);
  g.run('Input.virt("Escape", true); UI.updTitle(0); Input.virt("Escape", false); Input.endStep();');
  g.run('Input.virt("Escape", true); UI.updTitle(0); Input.virt("Escape", false); Input.endStep();');
  assert.equal(g.run('UI.screen'), 'title');
  assert.equal(g.run('UI.sel'), 0);
  g.run('UI.titleAction(0); UI.heroSel = 1; UI.startGame(); UI.selectMode(0);');
  assert.equal(g.run('G.run'), null);
  assert.ok(g.run('G.trans'));
  g.run('G.trans.cb(); G.trans = null;');
  assert.deepEqual(g.json('[G.run.mode, G.run.heroId, G.run.weaponId, G.run.hard]'), ['normal', 'eve', 'eve_dragon', null]);
  assert.equal(g.run('Save.data.lastMode'), 'normal');
  assert.equal(g.run('Save.data.stats.runs'), 1);
});

test('the drawn touch back button immediately leaves difficulty and releases its virtual cancel key', () => {
  const g = game();
  g.run('G.state = "title"; TouchUI.enabled = true; UI.titleAction(0); UI.heroSel = 1; UI.cycleWeapon(1); UI.cycleWeapon(1); UI.startGame();');
  for (let attempt = 0; attempt < 2; attempt++) {
    g.run('UI.newRegions = []; UI.draw(); var touchBack = UI.newRegions.find(r => r.x === 6 && r.y === 4 && r.w === 52 && r.h === 40);');
    assert.equal(g.run('UI.screen'), 'mode');
    assert.ok(g.run('touchBack && typeof touchBack.onClick === "function"'));
    g.run('touchBack.onClick(); Input.endStep();');
    assert.equal(g.run('UI.screen'), 'select');
    assert.equal(g.run('UI.heroSel'), 1);
    assert.equal(g.run('UI.selWeapon("eve").id'), 'eve_frost');
    assert.equal(g.run('Input.down("cancel")'), false);
    assert.equal(g.run('Input.hit("cancel")'), false);
    assert.equal(g.run('G.trans'), null);
    assert.equal(g.run('Save.data.stats.runs'), 0);
    if (attempt === 0) g.run('UI.startGame();');
  }
});

test('regular replay returns to difficulty, preserves the run loadout and can switch modes', () => {
  for (const mode of ['normal', 'hard']) {
    const g = game();
    g.run(`startRun('eve', 'eve_frost', null, '${mode}'); endRun(false); UI.heroSel = 0; UI.weaponSel = { eve: 0 }; UI.hardMode = true; UI.endAction(0);`);
    assert.equal(g.run('Save.data.stats.runs'), 1);
    g.run('G.trans.cb(); G.trans = null;');
    assert.equal(g.run('G.state'), 'title');
    assert.equal(g.run('UI.screen'), 'mode');
    assert.equal(g.run('UI.hardMode'), false);
    assert.equal(g.run('UI.modeSel'), mode === 'hard' ? 1 : 0);
    assert.equal(g.run('UI.heroSel'), 1);
    assert.equal(g.run('UI.selWeapon("eve").id'), 'eve_frost');
    assert.equal(g.run('Save.data.stats.runs'), 1);
    g.run(`UI.selectMode(${mode === 'normal' ? 1 : 0});`);
    assert.equal(g.run('Save.data.stats.runs'), 1);
    assert.ok(g.run('G.trans'));
    g.run('G.trans.cb(); G.trans = null;');
    assert.deepEqual(g.json('[G.run.mode, G.run.heroId, G.run.weaponId, G.run.hard]'), [mode === 'normal' ? 'hard' : 'normal', 'eve', 'eve_frost', null]);
    assert.equal(g.run('Save.data.stats.runs'), 2);
  }
});

test('trial starts and replays keep curses while regular starts remain isolated', () => {
  const g = game({ lastMode: 'hard', trialSel: trial3 });
  g.run('UI.titleAction(0); UI.cycleWeapon(1); UI.startGame(); UI.selectMode(1); G.trans.cb(); G.trans = null;');
  assert.equal(g.run('G.run.mode'), 'hard');
  assert.equal(g.run('G.run.hard'), null);
  assert.equal(g.run('G.run.weaponId'), 'rin_yasha');
  g.run('UI.titleAction(1); UI.startGame();');
  assert.equal(g.run('UI.screen'), 'trial');
  assert.equal(g.run('G.trans'), null);
  g.run('UI.startGame(); G.trans.cb(); G.trans = null; Save.data.trialSel = {}; UI.endAction(0); G.trans.cb();');
  assert.equal(g.run('G.state'), 'play');
  assert.equal(g.run('G.run.mode'), 'trial');
  assert.deepEqual(g.json('G.run.hard.sel'), trial3);
  assert.equal(g.run('G.run.weaponId'), 'rin_yasha');
  assert.equal(g.run('Save.data.lastMode'), 'hard');
  g.run('G.trans = null; UI.titleAction(0);');
  assert.equal(g.run('UI.screen'), 'select');
  assert.equal(g.run('UI.hardMode'), false);
  g.run('UI.startGame();');
  assert.equal(g.run('UI.screen'), 'mode');
  assert.equal(g.run('G.trans'), null);
});
