'use strict';
// =====================================================================
//  DATA — every number and name in the game (second edition, TBH-style
//  long flow: 4 difficulties × 9 regions × 10 stages)
// =====================================================================

// ---------- level scaling ----------
const SC = L => Math.pow(1.15, Math.max(0, L - 1));
const pctScale = ilvl => Math.min(3, 1 + (ilvl - 1) / 50);

// ---------- elements ----------
const ELEMENTS = ['phys', 'fire', 'ice', 'light', 'poison', 'holy'];
const ELEM = {
  phys: { name: '物理', color: PAL.mist }, fire: { name: '火焰', color: PAL.orange }, ice: { name: '寒冰', color: PAL.cyan },
  light: { name: '雷电', color: PAL.yellow }, poison: { name: '剧毒', color: PAL.green }, holy: { name: '神圣', color: PAL.cream },
};
const WEAK_MUL = 1.5, RESIST_MUL = 0.6;

// ---------- difficulties ----------
const DIFFS = [
  { id: 'normal', name: '普通', lv: [1, 40], hp: 1, atk: 1, gold: 1, exp: 1, maxGrade: 5, color: PAL.mist },
  { id: 'nightmare', name: '噩梦', lv: [41, 60], hp: 1.6, atk: 1.4, gold: 2, exp: 1.3, maxGrade: 6, color: PAL.magenta },
  { id: 'hell', name: '地狱', lv: [61, 80], hp: 3.5, atk: 2, gold: 4, exp: 1.6, maxGrade: 7, color: PAL.red },
  { id: 'torment', name: '折磨', lv: [81, 100], hp: 5, atk: 2, gold: 8, exp: 2, maxGrade: 8, color: PAL.amber },
];

// ---------- monster families: element weakness / resistance and the crafting part they drop ----------
const FAMILIES = {
  slime: { name: '史莱姆', weak: 'fire', resist: 'poison', part: 'p_slime' },
  rabbit: { name: '野兔', weak: 'poison', part: 'p_rabbit' },
  insect: { name: '虫群', weak: 'fire', resist: 'poison', part: 'p_insect' },
  goblin: { name: '哥布林', weak: 'light', part: 'p_goblin' },
  shroom: { name: '菌菇', weak: 'fire', resist: 'poison', part: 'p_shroom' },
  bat: { name: '蝙蝠', weak: 'light', part: 'p_bat' },
  plant: { name: '植物', weak: 'fire', resist: 'ice', part: 'p_plant' },
  spider: { name: '蜘蛛', weak: 'fire', resist: 'poison', part: 'p_spider' },
  fox: { name: '狐灵', weak: 'ice', resist: 'fire', part: 'p_fox' },
  troll: { name: '巨魔', weak: 'fire', part: 'p_troll' },
  scorpion: { name: '蝎子', weak: 'ice', resist: 'poison', part: 'p_scorpion' },
  snake: { name: '蛇', weak: 'ice', part: 'p_snake' },
  mummy: { name: '木乃伊', weak: 'fire', resist: 'poison', part: 'p_mummy' },
  rat: { name: '鼠人', weak: 'light', part: 'p_rat' },
  wolf: { name: '狼', weak: 'fire', part: 'p_wolf' },
  beast: { name: '巨兽', weak: 'fire', resist: 'ice', part: 'p_beast' },
  frost: { name: '冰灵', weak: 'fire', resist: 'ice', part: 'p_frost' },
  skeleton: { name: '骷髅', weak: 'holy', resist: 'poison', part: 'p_skeleton' },
  penguin: { name: '企鹅', weak: 'light', resist: 'ice', part: 'p_penguin' },
  ghost: { name: '幽魂', weak: 'holy', resist: 'phys', part: 'p_ghost' },
  undead: { name: '亡者', weak: 'holy', resist: 'poison', part: 'p_undead' },
  frog: { name: '蛙人', weak: 'light', part: 'p_frog' },
  golem: { name: '魔像', weak: 'light', resist: 'phys', part: 'p_golem' },
  mole: { name: '鼹鼠', weak: 'poison', part: 'p_mole' },
  crystal: { name: '晶灵', weak: 'phys', resist: 'light', part: 'p_crystal' },
  demon: { name: '恶魔', weak: 'holy', resist: 'fire', part: 'p_demon' },
  lizard: { name: '蜥蜴', weak: 'ice', resist: 'fire', part: 'p_lizard' },
  flame: { name: '火灵', weak: 'ice', resist: 'fire', part: 'p_flame' },
  worm: { name: '蠕虫', weak: 'ice', resist: 'fire', part: 'p_worm' },
  bird: { name: '飞禽', weak: 'light', part: 'p_bird' },
  sky: { name: '天灵', weak: 'poison', resist: 'light', part: 'p_sky' },
  gargoyle: { name: '石像鬼', weak: 'light', resist: 'phys', part: 'p_gargoyle' },
  knight: { name: '骑士', weak: 'light', resist: 'phys', part: 'p_knight' },
  eye: { name: '眼魔', weak: 'holy', part: 'p_eye' },
  drake: { name: '骨龙', weak: 'holy', resist: 'fire', part: 'p_drake' },
  cult: { name: '术士', weak: 'holy', part: 'p_cult' },
};

// ---------- monsters ----------
// multipliers on the level curve; spd = walk px/s, rng = attack reach (0 melee), fly = hover height
const MONSTERS = {
  // 1 翠风草原
  slime: { name: '史莱姆', spr: 'slime', fam: 'slime', hp: 1, atk: 0.8, def: 0.5, spd: 22, cd: 1.3, hop: 1 },
  bigslime: { name: '巨型史莱姆', spr: 'bigslime', fam: 'slime', hp: 2.6, atk: 1.1, def: 0.8, spd: 16, cd: 1.6, hop: 1, split: 'slime', w: 24 },
  rabbit: { name: '角兔', spr: 'rabbit', fam: 'rabbit', hp: 0.7, atk: 1, def: 0.3, spd: 46, cd: 1, hop: 1 },
  wasp: { name: '毒蜂', spr: 'wasp', fam: 'insect', hp: 0.55, atk: 0.9, def: 0.2, spd: 40, cd: 1.4, rng: 70, fly: 22, shot: 'sting', elem: 'poison' },
  gobthief: { name: '哥布林小偷', spr: 'gobthief', fam: 'goblin', hp: 0.8, atk: 1.1, def: 0.4, spd: 52, cd: 0.8 },
  gobarcher: { name: '哥布林弓手', spr: 'gobarcher', fam: 'goblin', hp: 0.75, atk: 1, def: 0.4, spd: 30, cd: 1.5, rng: 100, shot: 'arrow' },
  gobshaman: { name: '哥布林萨满', spr: 'gobshaman', fam: 'goblin', hp: 0.9, atk: 0.9, def: 0.5, spd: 26, cd: 1.7, rng: 90, shot: 'spark', heal: 0.12, elem: 'light' },
  gobbrute: { name: '哥布林暴徒', spr: 'goblin', fam: 'goblin', hp: 1.8, atk: 1.3, def: 1, spd: 28, cd: 1.3 },
  // 2 蘑菇密林
  shroom: { name: '红菇怪', spr: 'shroom', fam: 'shroom', hp: 1.2, atk: 0.8, def: 0.8, spd: 18, cd: 1.6 },
  toxshroom: { name: '毒菇怪', spr: 'shroom', pal: 'tox', fam: 'shroom', hp: 1, atk: 0.9, def: 0.6, spd: 18, cd: 1.8, rng: 80, shot: 'spore', elem: 'poison' },
  sporebat: { name: '孢子蝠', spr: 'bat', fam: 'bat', hp: 0.6, atk: 1, def: 0.2, spd: 50, cd: 1.1, fly: 26 },
  sapling: { name: '树苗精', spr: 'sapling', fam: 'plant', hp: 1.4, atk: 0.9, def: 1, spd: 20, cd: 1.5 },
  forestspider: { name: '林蛛', spr: 'spiderling', fam: 'spider', hp: 0.8, atk: 1.1, def: 0.5, spd: 48, cd: 1 },
  mossgob: { name: '苔藓哥布林', spr: 'goblin', pal: 'moss', fam: 'goblin', hp: 1.5, atk: 1.2, def: 0.9, spd: 30, cd: 1.3 },
  fox: { name: '狐火', spr: 'fox', fam: 'fox', hp: 0.8, atk: 1.2, def: 0.4, spd: 56, cd: 1, elem: 'fire' },
  mosstroll: { name: '苔藓巨魔', spr: 'troll', fam: 'troll', hp: 3, atk: 1.5, def: 1.4, spd: 14, cd: 2, w: 26 },
  // 3 黄沙遗迹
  scorpion: { name: '沙蝎', spr: 'scorpion', fam: 'scorpion', hp: 1.1, atk: 1.2, def: 1.4, spd: 30, cd: 1.2, elem: 'poison' },
  cobra: { name: '眼镜蛇', spr: 'cobra', fam: 'snake', hp: 0.9, atk: 1.1, def: 0.6, spd: 26, cd: 1.5, rng: 75, shot: 'venom', elem: 'poison' },
  mummy: { name: '木乃伊', spr: 'mummy', fam: 'mummy', hp: 1.8, atk: 1, def: 1, spd: 16, cd: 1.5 },
  mummypriest: { name: '木乃伊祭司', spr: 'mummypriest', fam: 'mummy', hp: 1.3, atk: 1.1, def: 0.8, spd: 18, cd: 1.8, rng: 95, shot: 'curse', heal: 0.1 },
  ratscout: { name: '鼠人斥候', spr: 'rat', fam: 'rat', hp: 0.8, atk: 1.1, def: 0.5, spd: 50, cd: 0.9 },
  ratbomber: { name: '鼠人掷弹兵', spr: 'ratbomber', fam: 'rat', hp: 0.9, atk: 1.4, def: 0.5, spd: 28, cd: 2, rng: 105, shot: 'bomb', elem: 'fire', splash: 1 },
  scarab: { name: '圣甲虫', spr: 'scarab', fam: 'insect', hp: 0.5, atk: 0.8, def: 1.2, spd: 54, cd: 0.9 },
  cactus: { name: '仙人掌怪', spr: 'cactus', fam: 'plant', hp: 1.4, atk: 0.9, def: 1.2, spd: 20, cd: 1.8, rng: 80, shot: 'needle' },
  // 4 霜牙雪原
  wolf: { name: '雪狼', spr: 'wolf', fam: 'wolf', hp: 1, atk: 1.3, def: 0.6, spd: 56, cd: 1, w: 28 },
  frostslime: { name: '冰史莱姆', spr: 'slime', pal: 'ice', fam: 'slime', hp: 1.2, atk: 0.9, def: 0.8, spd: 22, cd: 1.3, hop: 1, elem: 'ice' },
  yeti: { name: '雪人', spr: 'yeti', fam: 'beast', hp: 2.2, atk: 1.3, def: 1, spd: 18, cd: 1.6, w: 26 },
  icewisp: { name: '冰晶精灵', spr: 'wisp', fam: 'frost', hp: 0.6, atk: 1.2, def: 0.2, spd: 34, cd: 1.4, rng: 90, fly: 24, shot: 'wispfire', elem: 'ice' },
  iceskel: { name: '冰霜骷髅', spr: 'skeleton', pal: 'ice', fam: 'skeleton', hp: 1.2, atk: 1.2, def: 1.2, spd: 26, cd: 1.3, elem: 'ice' },
  penguin: { name: '企鹅掷手', spr: 'penguin', fam: 'penguin', hp: 0.9, atk: 1, def: 0.6, spd: 24, cd: 1.6, rng: 95, shot: 'snowball', elem: 'ice' },
  icebear: { name: '冰原熊', spr: 'bear', fam: 'beast', hp: 3.2, atk: 1.5, def: 1.4, spd: 16, cd: 1.9, w: 28 },
  // 5 幽灵沼泽
  ghost: { name: '幽灵', spr: 'ghost', fam: 'ghost', hp: 0.9, atk: 1.2, def: 0.2, spd: 30, cd: 1.2, fly: 14 },
  zombie: { name: '沼泽僵尸', spr: 'zombie', fam: 'undead', hp: 2, atk: 1, def: 0.6, spd: 14, cd: 1.6 },
  wisp: { name: '鬼火', spr: 'wisp', pal: 'marsh', fam: 'ghost', hp: 0.5, atk: 1.2, def: 0.1, spd: 34, cd: 1.4, rng: 90, fly: 24, shot: 'wispfire' },
  ghoul: { name: '食尸鬼', spr: 'ghoul', fam: 'undead', hp: 1.1, atk: 1.3, def: 0.5, spd: 50, cd: 0.9 },
  skelwar: { name: '骷髅战士', spr: 'skeleton', pal: 'war', fam: 'skeleton', hp: 1.5, atk: 1.2, def: 1.4, spd: 24, cd: 1.3, block: 0.2 },
  skelarcher: { name: '骷髅弓手', spr: 'skelarcher', fam: 'skeleton', hp: 0.9, atk: 1.2, def: 0.8, spd: 24, cd: 1.6, rng: 110, shot: 'arrow' },
  frogman: { name: '沼泽蛙人', spr: 'frogman', fam: 'frog', hp: 1.3, atk: 1.2, def: 0.8, spd: 34, cd: 1.2, hop: 1 },
  vampbat: { name: '吸血蝠', spr: 'bat', pal: 'vamp', fam: 'bat', hp: 0.8, atk: 1.2, def: 0.3, spd: 52, cd: 1, fly: 28, drain: 0.5 },
  // 6 水晶矿洞
  golem: { name: '晶石魔像', spr: 'golem', fam: 'golem', hp: 2.4, atk: 1.2, def: 2, spd: 14, cd: 1.7, w: 26 },
  cavebat: { name: '洞穴蝙蝠', spr: 'bat', pal: 'cave', fam: 'bat', hp: 0.6, atk: 1.1, def: 0.2, spd: 54, cd: 1.1, fly: 30 },
  mole: { name: '鼹鼠矿工', spr: 'mole', fam: 'mole', hp: 1.1, atk: 1, def: 1, spd: 32, cd: 1.2 },
  minegob: { name: '矿坑哥布林', spr: 'minegob', fam: 'goblin', hp: 1.3, atk: 1.2, def: 1.1, spd: 32, cd: 1.2 },
  gembeetle: { name: '宝石甲虫', spr: 'scarab', pal: 'gem', fam: 'insect', hp: 0.8, atk: 0.9, def: 2, spd: 40, cd: 1.1, gold: 2 },
  crystalspider: { name: '晶蛛', spr: 'spiderling', pal: 'crystal', fam: 'spider', hp: 1, atk: 1.2, def: 1.2, spd: 46, cd: 1 },
  crystalwisp: { name: '晶灵', spr: 'wisp', pal: 'crystal', fam: 'crystal', hp: 0.7, atk: 1.3, def: 0.6, spd: 34, cd: 1.4, rng: 95, fly: 24, shot: 'shard' },
  // 7 熔岩火山
  imp: { name: '火焰小鬼', spr: 'imp', fam: 'demon', hp: 0.8, atk: 1.1, def: 0.5, spd: 36, cd: 1.5, rng: 90, fly: 20, shot: 'fireball', elem: 'fire' },
  lavaslime: { name: '熔岩史莱姆', spr: 'slime', pal: 'lava', fam: 'slime', hp: 1.3, atk: 1.1, def: 0.9, spd: 22, cd: 1.3, hop: 1, elem: 'fire' },
  salamander: { name: '火蜥蜴', spr: 'salamander', fam: 'lizard', hp: 1.5, atk: 1.2, def: 1.2, spd: 26, cd: 1.3, elem: 'fire', w: 28 },
  hellhound: { name: '地狱犬', spr: 'wolf', pal: 'hell', fam: 'wolf', hp: 1.2, atk: 1.4, def: 0.7, spd: 60, cd: 0.9, elem: 'fire', w: 28 },
  firedemon: { name: '炎魔战士', spr: 'demon', fam: 'demon', hp: 2, atk: 1.5, def: 1.2, spd: 24, cd: 1.4, elem: 'fire', w: 24 },
  fireelem: { name: '火元素', spr: 'wisp', pal: 'fire', fam: 'flame', hp: 0.8, atk: 1.3, def: 0.4, spd: 32, cd: 1.3, rng: 95, fly: 22, shot: 'fireball', elem: 'fire' },
  lavaworm: { name: '熔岩蠕虫', spr: 'worm', fam: 'worm', hp: 2.4, atk: 1.3, def: 1.3, spd: 18, cd: 1.6, elem: 'fire', w: 26 },
  // 8 天空浮岛
  harpy: { name: '鹰身女妖', spr: 'harpy', fam: 'bird', hp: 1, atk: 1.2, def: 0.5, spd: 40, cd: 1.5, rng: 80, fly: 26, shot: 'feather' },
  hawk: { name: '风暴鹰', spr: 'hawk', fam: 'bird', hp: 0.7, atk: 1.3, def: 0.3, spd: 60, cd: 1, fly: 34 },
  cloudling: { name: '云精灵', spr: 'wisp', pal: 'cloud', fam: 'sky', hp: 0.8, atk: 1.1, def: 0.4, spd: 30, cd: 1.4, rng: 90, fly: 28, shot: 'spark', elem: 'light' },
  thunderbird: { name: '雷鸟', spr: 'hawk', pal: 'thunder', fam: 'bird', hp: 0.9, atk: 1.4, def: 0.4, spd: 58, cd: 1.1, fly: 32, elem: 'light' },
  gargoyle: { name: '石像鬼', spr: 'gargoyle', fam: 'gargoyle', hp: 2.4, atk: 1.3, def: 2, spd: 20, cd: 1.6, fly: 10, w: 24 },
  skyknight: { name: '天空骑士', spr: 'knight', fam: 'knight', hp: 2, atk: 1.4, def: 1.6, spd: 26, cd: 1.4, block: 0.25, w: 22 },
  windsprite: { name: '风灵', spr: 'wisp', pal: 'wind', fam: 'sky', hp: 0.6, atk: 1.2, def: 0.3, spd: 62, cd: 1, fly: 26 },
  // 9 深渊王座
  demonling: { name: '深渊小魔', spr: 'imp', pal: 'abyss', fam: 'demon', hp: 0.9, atk: 1.3, def: 0.6, spd: 40, cd: 1.3, rng: 90, fly: 20, shot: 'voidbolt' },
  darkknight: { name: '深渊骑士', spr: 'knight', pal: 'dark', fam: 'knight', hp: 2.6, atk: 1.6, def: 2, spd: 24, cd: 1.4, block: 0.3, w: 22 },
  shade: { name: '暗影', spr: 'ghost', pal: 'shade', fam: 'ghost', hp: 1.1, atk: 1.4, def: 0.3, spd: 38, cd: 1.1, fly: 16 },
  eyebeast: { name: '眼魔', spr: 'eye', fam: 'eye', hp: 1.6, atk: 1.5, def: 0.8, spd: 22, cd: 2, rng: 120, fly: 30, shot: 'beam', w: 22 },
  bonedrake: { name: '骨龙幼体', spr: 'drake', fam: 'drake', hp: 2.6, atk: 1.6, def: 1.4, spd: 30, cd: 1.5, fly: 18, w: 30 },
  abysshound: { name: '深渊犬', spr: 'wolf', pal: 'abyss', fam: 'wolf', hp: 1.3, atk: 1.5, def: 0.8, spd: 60, cd: 0.9, w: 28 },
  cultist: { name: '深渊术士', spr: 'cultist', fam: 'cult', hp: 1.2, atk: 1.5, def: 0.7, spd: 24, cd: 1.8, rng: 100, shot: 'voidbolt', heal: 0.08 },
  voidslime: { name: '虚空史莱姆', spr: 'slime', pal: 'void', fam: 'slime', hp: 1.6, atk: 1.3, def: 1, spd: 24, cd: 1.3, hop: 1, split: 'voidslime' },
  // 贪婪矿井
  goldgob: { name: '宝箱哥布林', spr: 'goldgob', fam: 'goblin', hp: 3, atk: 0, def: 0.5, spd: 26, cd: 9, gold: 10, flee: 1, w: 20 },
  oregolem: { name: '矿石魔像', spr: 'golem', pal: 'ore', fam: 'golem', hp: 7, atk: 0.5, def: 1, spd: 10, cd: 2, gold: 4, ore: 1, w: 26 },
};
for (const id in MONSTERS) { const m = MONSTERS[id]; m.id = id; m.gold ??= m.hp * 0.9 + 0.2; m.exp ??= m.hp * 0.8 + 0.3; m.rng ??= 0; }

// ---------- the 9 regions ----------
const ACTS = [
  { id: 'meadow', name: '翠风草原', mobs: ['slime', 'bigslime', 'rabbit', 'wasp', 'gobthief', 'gobarcher', 'gobshaman', 'gobbrute'], boss: 'slimeking', mote: 'firefly',
    champs: [['gobbrute', '「独眼」哥布林头目', 'rally'], ['wasp', '「蜂后」毒蜂女王', 'swift'], ['bigslime', '「黏糊」史莱姆长老', 'vigor']] },
  { id: 'grove', name: '蘑菇密林', mobs: ['shroom', 'toxshroom', 'sporebat', 'sapling', 'forestspider', 'mossgob', 'fox', 'mosstroll'], boss: 'treant', mote: 'spore',
    champs: [['toxshroom', '「腐菇」菇王', 'arcane'], ['forestspider', '「织网者」林蛛母后', 'swift'], ['mosstroll', '「千年」苔藓巨魔', 'stone']] },
  { id: 'desert', name: '黄沙遗迹', mobs: ['scorpion', 'cobra', 'mummy', 'mummypriest', 'ratscout', 'ratbomber', 'scarab', 'cactus'], boss: 'scorpking', mote: 'sand',
    champs: [['mummypriest', '「法老之手」大祭司', 'ward'], ['scorpion', '「金尾」沙蝎', 'thorny'], ['ratbomber', '「爆破王」鼠人', 'fury']] },
  { id: 'tundra', name: '霜牙雪原', mobs: ['wolf', 'frostslime', 'yeti', 'icewisp', 'iceskel', 'penguin', 'icebear'], boss: 'wolfking', mote: 'snow',
    champs: [['wolf', '「白牙」雪狼首领', 'rally'], ['yeti', '「雪崩」雪人', 'stone'], ['iceskel', '「冰冠」骷髅王', 'arcane']] },
  { id: 'marsh', name: '幽灵沼泽', mobs: ['ghost', 'zombie', 'wisp', 'ghoul', 'skelwar', 'skelarcher', 'frogman', 'vampbat'], boss: 'witch', mote: 'wisp',
    champs: [['frogman', '「腐沼」蛙人酋长', 'vigor'], ['skelwar', '「无名」骷髅将军', 'ward'], ['vampbat', '「血翼」吸血蝠王', 'vampiric']] },
  { id: 'cavern', name: '水晶矿洞', mobs: ['golem', 'cavebat', 'mole', 'minegob', 'gembeetle', 'crystalspider', 'crystalwisp'], boss: 'spider', mote: 'shard',
    champs: [['golem', '「矿脉」魔像守卫', 'stone'], ['minegob', '「金镐」矿坑工头', 'rally'], ['crystalwisp', '「棱光」晶灵', 'arcane']] },
  { id: 'caldera', name: '熔岩火山', mobs: ['imp', 'lavaslime', 'salamander', 'hellhound', 'firedemon', 'fireelem', 'lavaworm'], boss: 'magmagolem', mote: 'ember',
    champs: [['hellhound', '「熔蹄」地狱犬王', 'swift'], ['firedemon', '「炎狱」炎魔队长', 'fury'], ['fireelem', '「灼心」火元素', 'thorny']] },
  { id: 'isles', name: '天空浮岛', mobs: ['harpy', 'hawk', 'cloudling', 'thunderbird', 'gargoyle', 'skyknight', 'windsprite'], boss: 'griffin', mote: 'cloud',
    champs: [['thunderbird', '「风暴之眼」雷鸟', 'swift'], ['skyknight', '「白翼」骑士团长', 'ward'], ['gargoyle', '「守望」石像鬼', 'stone']] },
  { id: 'abyss', name: '深渊王座', mobs: ['demonling', 'darkknight', 'shade', 'eyebeast', 'bonedrake', 'abysshound', 'cultist', 'voidslime'], boss: 'archon', mote: 'ash',
    champs: [['eyebeast', '「凝视」眼魔长老', 'arcane'], ['bonedrake', '「灰烬」骨龙', 'vampiric'], ['darkknight', '「誓约」深渊统领', 'fury']] },
];
const ACT_COUNT = ACTS.length, STAGES = 10;
// every champion carries one aura
const AURAS = {
  rally: { name: '号令', text: '登场时召来 2 只同族随从' },
  swift: { name: '迅捷', text: '攻击与移动速度 +40%' },
  vigor: { name: '再生', text: '每秒回复 2% 生命' },
  arcane: { name: '奥能', text: '每 6 秒释放冲击，造成 2 倍攻击伤害' },
  stone: { name: '石肤', text: '防御 ×3，受到的伤害 -25%' },
  ward: { name: '守护', text: '随从存活时受到的伤害 -50%' },
  thorny: { name: '荆刺', text: '把受到伤害的 5% 反弹给猎人' },
  fury: { name: '狂怒', text: '生命低于一半时攻击 +60%' },
  vampiric: { name: '嗜血', text: '攻击回复造成伤害的 3 倍生命' },
};
const champOf = (a, s) => ACTS[a - 1].champs[Math.min(2, Math.floor((s - 1) / 3))];
const ELITE = { hp: 5, atk: 1.6, gold: 5, exp: 5, chest: 0.15 };
const CHAMP = { hp: 12, atk: 1.8, gold: 10, exp: 10 };
const BOSS_MUL = { hp: 40, atk: 2.5, def: 1.5, gold: 40, exp: 40 };

// ---------- bounty bosses ----------
const BOSSES = {
  slimeking: { name: '史莱姆王', title: '黏糊糊的暴君', spr: 'b_slimeking', fam: 'slime', hp: 1, atk: 1, def: 1, cd: 1.6, time: 40, skills: ['slam', 'split'] },
  treant: { name: '腐根树妖', title: '吞林之根', spr: 'b_treant', fam: 'plant', hp: 1.3, atk: 0.9, def: 1.4, cd: 1.8, time: 50, skills: ['roots', 'drain'] },
  scorpking: { name: '沙暴蝎皇', title: '流沙之冠', spr: 'b_scorpking', fam: 'scorpion', hp: 1, atk: 1.3, def: 1.2, cd: 1.4, time: 45, skills: ['venom', 'flurry'] },
  wolfking: { name: '霜牙狼王', title: '雪原的獠牙', spr: 'b_wolfking', fam: 'wolf', hp: 0.9, atk: 1.2, def: 0.8, cd: 0.9, time: 40, skills: ['howl', 'pack'] },
  witch: { name: '提灯女巫', title: '沼泽的引路人', spr: 'b_witch', fam: 'cult', hp: 0.9, atk: 1.2, def: 0.6, cd: 1.6, time: 45, skills: ['wisps', 'curse'] },
  spider: { name: '晶背巨蛛', title: '矿脉深处的织网者', spr: 'b_spider', fam: 'spider', hp: 1.1, atk: 1.1, def: 1.6, cd: 1.4, time: 50, skills: ['spike', 'web'] },
  magmagolem: { name: '熔核魔像', title: '炉心未熄', spr: 'b_magma', fam: 'golem', hp: 1.4, atk: 1.1, def: 2, cd: 2, time: 60, skills: ['erupt', 'harden'] },
  griffin: { name: '雷鸣狮鹫', title: '浮岛之王', spr: 'b_griffin', fam: 'bird', hp: 1, atk: 1.4, def: 0.9, cd: 1.3, time: 45, skills: ['bolt', 'dive'] },
  archon: { name: '深渊执政官', title: '王座上的无尽之夜', spr: 'b_archon', fam: 'demon', hp: 1.5, atk: 1.5, def: 1.4, cd: 1.5, time: 60, skills: ['rift', 'legion', 'darkbeam'] },
};
const BOSS_IDS = Object.keys(BOSSES);

// ---------- stage math ----------
// global index 0..359 → difficulty, region, stage; monster level spans the difficulty's band
const stageKey = (d, a, s) => `${d}-${a}-${s}`;
const stageIndex = (a, s) => (a - 1) * STAGES + (s - 1); // 0..89 within a difficulty
function stageLevel(d, a, s) {
  const [lo, hi] = DIFFS[d].lv;
  return lo + Math.floor(stageIndex(a, s) * (hi - lo) / (ACT_COUNT * STAGES - 1));
}
const waveCount = (d, a, s) => (s === STAGES ? 1 : 8 + s + Math.floor((a - 1) / 2) + 3 * d);
const waveSize = w => 3 + Math.min(2, Math.floor(w / 4));
const ELITE_CHANCE = 0.08;
const stageName = (d, a, s) => `${DIFFS[d].name} ${a}-${s}`;
// monsters outgrow gear level by level, steepest in 普通 where the hunter grows fastest,
// so every region asks for better grades, sockets and runes. Ramps per difficulty band:
const RAMP_HP = [1.1, 1.09, 1.065, 1.06], RAMP_ATK = [1.035, 1.03, 1.02, 1.015], RAMP_EXP = 1.03;
const rampTable = steps => { const out = [1]; for (let L = 1; L <= 100; L++) out[L] = (out[L - 1] || 1) * (L === 1 ? 1 : steps[L <= 40 ? 0 : L <= 60 ? 1 : L <= 80 ? 2 : 3]); return out; };
const RAMP_HP_T = rampTable(RAMP_HP), RAMP_ATK_T = rampTable(RAMP_ATK);
const lvIdx = L => clamp(Math.round(L), 1, 100);
const CURVE = {
  hp: L => 160 * SC(L) * RAMP_HP_T[lvIdx(L)], atk: L => 20 * SC(L) * RAMP_ATK_T[lvIdx(L)], def: L => 4 * SC(L),
  gold: L => 3 * SC(L), exp: L => 4 * SC(L) * Math.pow(RAMP_EXP, L - 1),
};

// ---------- the hunter ----------
const HERO = { atk: 10, hp: 150, crit: 0.05, critCap: 0.8, cdmg: 1.5, aspdCap: 5, maxLevel: 100 };
const expNeed = L => Math.round(60 * Math.pow(1.22, L - 1));

// ---------- equipment ----------
const SLOTS = ['main', 'off', 'head', 'chest', 'hands', 'feet', 'neck', 'ear', 'ring', 'wrist', 'medal'];
const SLOT_NAME = { main: '主手', off: '副手', head: '头盔', chest: '护甲', hands: '手套', feet: '靴子', neck: '项链', ear: '耳环', ring: '戒指', wrist: '护腕', medal: '勋章' };
const ILVL_TIERS = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100];
const tierOf = ilvl => { let t = 0; for (let i = 0; i < ILVL_TIERS.length; i++) if (ilvl >= ILVL_TIERS[i]) t = i; return t; };
// material groups recolor item icons as the tiers climb
const MATERIAL_GROUP = t => Math.min(6, Math.floor(t / 3));

const FAMS = {
  sword: { name: '剑盾', main: 'sword', off: 'shield', melee: 1, reach: 36, aspd: 1.2, elem: 'phys', color: PAL.mist },
  axe: { name: '双斧', main: 'axe', off: 'hatchet', melee: 1, reach: 34, aspd: 0.95, elem: 'phys', color: PAL.red },
  bow: { name: '长弓', main: 'bow', off: 'quiver', reach: 165, aspd: 1.45, elem: 'phys', shot: 'arrow', speed: 380, color: PAL.green },
  crossbow: { name: '重弩', main: 'crossbow', off: 'bolts', reach: 175, aspd: 0.75, elem: 'phys', shot: 'bolt', speed: 460, color: PAL.amber },
  staff: { name: '法杖', main: 'staff', off: 'orb', reach: 150, aspd: 0.9, elem: 'fire', shot: 'magic', speed: 300, color: PAL.cyan },
  scepter: { name: '权杖', main: 'scepter', off: 'tome', melee: 1, reach: 40, aspd: 1.05, elem: 'holy', color: PAL.yellow },
};
const FAM_IDS = Object.keys(FAMS);

const N = s => s.split(' ');
const TYPES = {
  // main hand: atk main stat, family weapon traits
  sword: { slot: 'main', fam: 'sword', name: '剑', icon: 'w_sword', main: { atk: 9 }, imp: { crit: 0.05 }, impText: '暴击率 +5%',
    names: N('短剑 弯刀 细剑 阔剑 巨剑 重刃 骑士剑 统帅之剑 符文剑 传说之剑 命运之剑 英雄之剑 风暴之剑 复仇之剑 虚空之刃 水晶之刃 次元之剑 暗影之刃 永恒之剑 光辉之剑 创世之剑') },
  axe: { slot: 'main', fam: 'axe', name: '斧', icon: 'w_axe', main: { atk: 11 }, imp: { cleave: 0.35 }, impText: '劈中身后目标，造成 35% 伤害',
    names: N('木斧 铁斧 战斧 钢斧 征战斧 骑士斧 巨斧 重斧 符文斧 传说之斧 命运之斧 英雄之斧 风暴之斧 无尽之斧 混沌之斧 力量之斧 次元之斧 暗影之斧 永恒之斧 光辉之斧 创世之斧') },
  bow: { slot: 'main', fam: 'bow', name: '弓', icon: 'w_bow', main: { atk: 7 }, imp: { aspd: 0.1 }, impText: '攻速 +10%',
    names: N('短弓 猎弓 长弓 复合弓 战弓 绯红弓 暮光弓 翡翠弓 精英弓 符文弓 秘法弓 迅捷弓 远古弓 无尽之弓 混沌之弓 风暴之弓 暗影之弓 狂风之弓 永恒之弓 光辉之弓 创世之弓') },
  crossbow: { slot: 'main', fam: 'crossbow', name: '弩', icon: 'w_crossbow', main: { atk: 13 }, imp: { crit: 0.1, pierce: 1 }, impText: '暴击率 +10%，弩矢贯穿 1 个目标',
    names: N('短弩 皮弦弩 长弩 完备弩 精工弩 强化弩 铁弩 翼弩 精英弩 巨弩 秘法弩 迅捷弩 远古弩 无尽之弩 混沌之弩 力量之弩 次元之弩 暗影之弩 永恒之弩 光辉之弩 创世之弩') },
  staff: { slot: 'main', fam: 'staff', name: '法杖', icon: 'w_staff', main: { atk: 10 }, imp: { splash: 0.3, skill: 0.1 }, impText: '法弹溅射 30%，技能伤害 +10%',
    names: N('木杖 先驱法杖 长杖 女巫法杖 蔚蓝法杖 长老法杖 贤者法杖 秘法杖 彗星法杖 水晶法杖 虚空法杖 征服者法杖 远古法杖 神圣法杖 深渊法杖 混沌法杖 狂风法杖 新星法杖 永恒法杖 光辉法杖 创世法杖') },
  scepter: { slot: 'main', fam: 'scepter', name: '权杖', icon: 'w_scepter', main: { atk: 8.5 }, imp: { hitHeal: 0.01 }, impText: '每次命中回复 1% 生命',
    names: N('见习权杖 铁权杖 祝福权杖 钢权杖 神圣权杖 主教权杖 虔诚权杖 重权杖 符文权杖 传说权杖 命运权杖 英雄权杖 风暴权杖 无尽权杖 混沌权杖 力量权杖 次元权杖 暗影权杖 永恒权杖 光辉权杖 创世权杖') },
  // off hand
  shield: { slot: 'off', fam: 'sword', name: '盾', icon: 'o_shield', main: { arm: 2, hp: 15 }, imp: { block: 0.12 }, impText: '格挡率 +12%（格挡时伤害 -60%）',
    names: N('小圆盾 木盾 铁盾 鸢盾 重盾 森林之盾 战盾 屏障之盾 精英之盾 绯红之盾 秘法之盾 宏伟之盾 远古之盾 光辉之盾 虚空之盾 神圣之盾 次元之盾 暗影之盾 永恒之盾 巨龙之盾 创世之盾') },
  hatchet: { slot: 'off', fam: 'axe', name: '飞斧', icon: 'o_hatchet', main: { atk: 3 }, imp: { toss: 0.15 }, impText: '15% 几率额外掷出飞斧，造成 60% 伤害',
    names: N('短柄飞斧 皮柄飞斧 长柄飞斧 钢飞斧 征战飞斧 复合飞斧 战斗飞斧 翼飞斧 精英飞斧 巨飞斧 秘法飞斧 迅捷飞斧 远古飞斧 无尽飞斧 混沌飞斧 力量飞斧 次元飞斧 暗影飞斧 永恒飞斧 至高飞斧 创世飞斧') },
  quiver: { slot: 'off', fam: 'bow', name: '箭袋', icon: 'o_quiver', main: { atk: 2.5 }, imp: { aspd: 0.06 }, impText: '攻速 +6%',
    names: N('木箭袋 铁箭袋 猎人箭袋 倒钩箭袋 蔚蓝箭袋 残暴箭袋 疾风箭袋 蛇牙箭袋 符文箭袋 部族箭袋 命运箭袋 风暴箭袋 黑曜石箭袋 迅捷箭袋 虚空箭袋 剧毒箭袋 次元箭袋 暗影箭袋 远古箭袋 至高箭袋 创世箭袋') },
  bolts: { slot: 'off', fam: 'crossbow', name: '弩矢', icon: 'o_bolts', main: { atk: 3 }, imp: { cdmg: 0.15 }, impText: '暴击伤害 +15%',
    names: N('短弩矢 恐惧弩矢 猎人弩矢 倒钩弩矢 野兽弩矢 迅捷弩矢 铁弩矢 重弩矢 符文弩矢 英雄弩矢 命运弩矢 风暴弩矢 雷霆弩矢 疾速弩矢 虚空弩矢 剧毒弩矢 次元弩矢 暗影弩矢 远古弩矢 圣化弩矢 创世弩矢') },
  orb: { slot: 'off', fam: 'staff', name: '法球', icon: 'o_orb', main: { atk: 2 }, imp: { elemPct: 0.1 }, impText: '决定法杖元素，元素伤害 +10%', elemRoll: ['fire', 'ice', 'light'],
    names: N('魔法球 长老法球 闪耀法球 冰封法球 预言法球 黑暗法球 符文法球 光耀法球 奥术法球 命运法球 秘法法球 天空法球 灵魂法球 远古法球 深渊法球 虚空法球 次元法球 暗影法球 永恒法球 金辉法球 创世法球') },
  tome: { slot: 'off', fam: 'scepter', name: '圣典', icon: 'o_tome', main: { hp: 15 }, imp: { cdr: 0.05 }, impText: '冷却缩减 5%',
    names: N('祈祷书 帝国圣典 铁皮圣典 骑士圣典 祝福圣典 统帅圣典 战争圣典 帝王圣典 符文圣典 绯红圣典 命运圣典 宏伟圣典 风暴圣典 勇者圣典 虚空圣典 水晶圣典 次元圣典 暗影圣典 永恒圣典 天穹圣典 创世圣典') },
  // armor
  head: { slot: 'head', name: '头盔', icon: 'a_helm', main: { hp: 25, arm: 1.5 },
    names: N('木盔 帝国头盔 铁盔 骑士头盔 锁链头盔 中型头盔 战盔 帝王头盔 符文头盔 赤红头盔 命运头盔 巨盔 风暴头盔 斗士头盔 虚空头盔 水晶头盔 次元头盔 暗影头盔 永恒头盔 光辉头盔 创世头盔') },
  chest: { slot: 'chest', name: '护甲', icon: 'a_chest', main: { hp: 50, arm: 3 },
    names: N('布衣 帝国护甲 铁板甲 锁子甲 骑士铠甲 命运铠甲 战争铠甲 重铠 符文板甲 龙鳞甲 秘法铠甲 宏伟铠甲 远古铠甲 闪耀铠甲 虚空铠甲 巨龙铠甲 次元铠甲 暗影铠甲 永恒铠甲 光辉铠甲 创世铠甲') },
  hands: { slot: 'hands', name: '手套', icon: 'a_gloves', main: { atk: 1.5 }, mainPct: { aspd: 0.03 },
    names: N('皮手套 帝国手套 铁手套 骑士手套 锁链手套 命运手套 战争手套 重手套 符文手套 板甲手套 秘法手套 宏伟手套 远古手套 闪耀手套 虚空手套 巨龙手套 次元手套 暗影手套 永恒手套 光辉手套 创世手套') },
  feet: { slot: 'feet', name: '靴子', icon: 'a_boots', main: { hp: 18, arm: 1.2 }, mainPct: { move: 0.05 },
    names: N('草鞋 帝国长靴 铁靴 骑士战靴 锁链靴 命运之靴 战争之靴 重靴 符文之靴 板甲战靴 秘法之靴 宏伟之靴 远古之靴 闪耀之靴 虚空之靴 水晶之靴 次元之靴 暗影之靴 永恒之靴 光辉之靴 创世之靴') },
  // accessories: a small flat stat plus a percentage that grows with item level
  neck: { slot: 'neck', name: '项链', icon: 'c_amulet', main: { hp: 10 }, mainPct: { atkPct: 0.06 },
    names: N('铜项链 青铜项链 银项链 金项链 铂金项链 水晶项链 月光石吊坠 琥珀吊坠 红宝石吊坠 紫晶吊坠 翡翠项链 钻石项链 星尘项链 日蚀项链 天界项链 星界项链 以太项链 虚空项链 深渊项链 永恒项链 创世项链') },
  ear: { slot: 'ear', name: '耳环', icon: 'c_earring', main: { atk: 1 }, mainPct: { skill: 0.05 },
    names: N('铜耳环 青铜耳环 银耳环 金耳环 铂金耳环 水晶耳环 翡翠耳环 玉石耳环 虎眼耳环 石榴石耳环 蓝宝石耳环 钻石耳环 月光石耳环 天界耳环 日蚀耳环 星界耳环 以太耳环 虚空耳环 深渊耳环 永恒耳环 创世耳环') },
  ring: { slot: 'ring', name: '戒指', icon: 'c_ring', main: { atk: 1.5 }, mainPct: { crit: 0.015 },
    names: N('铜戒指 青铜戒指 银戒指 金戒指 铂金戒指 水晶戒指 琥珀戒指 黄玉戒指 紫晶戒指 石榴石戒指 翡翠戒指 钻石戒指 月光石戒指 日蚀戒指 天界戒指 星界戒指 以太戒指 虚空戒指 深渊戒指 永恒戒指 创世戒指') },
  wrist: { slot: 'wrist', name: '护腕', icon: 'c_bracer', main: { arm: 1 }, mainPct: { aspd: 0.03 },
    names: N('铜护腕 青铜护腕 银护腕 金护腕 铂金护腕 水晶护腕 黑曜石护腕 暗影护腕 赤红护腕 血石护腕 翡翠护腕 钻石护腕 星尘护腕 日蚀护腕 天界护腕 星界护腕 以太护腕 虚空护腕 深渊护腕 永恒护腕 创世护腕') },
  // medals: the bounty hunter's badges
  m_hunter: { slot: 'medal', name: '猎人勋章', icon: 'm_hunter', main: { hp: 10 }, mainPct: { gold: 0.1 } },
  m_seeker: { slot: 'medal', name: '寻宝勋章', icon: 'm_seeker', main: { hp: 10 }, mainPct: { chest: 0.08 } },
  m_honor: { slot: 'medal', name: '荣誉勋章', icon: 'm_honor', main: { hp: 10 }, mainPct: { boss: 0.1 } },
};
const MEDAL_TIER = N('铜 青铜 铁 银 金 铂金 水晶 符文 秘银 星尘 日蚀 天界 星界 以太 虚空 深渊 永恒 光辉 混沌 至高 创世');
for (const id of ['m_hunter', 'm_seeker', 'm_honor']) TYPES[id].names = MEDAL_TIER.map(t => t + TYPES[id].name);
for (const id in TYPES) TYPES[id].id = id;
const TYPE_IDS = Object.keys(TYPES);
const TYPES_BY_SLOT = SLOTS.reduce((o, s) => (o[s] = TYPE_IDS.filter(k => TYPES[k].slot === s), o), {});
const itemTypeName = (type, ilvl) => TYPES[type].names[tierOf(ilvl)];

// ---------- 10 grades ----------
const GRADES = [
  { name: '普通', color: '#c0cbdc', dark: '#5a6988', deep: '#3a4466', glow: '#ffffff', mul: 1.0, affixes: 1, sockets: [0, 0, 0], alch: 10 },
  { name: '优秀', color: '#63c74d', dark: '#3e8948', deep: '#265c42', glow: '#b8f0a0', mul: 1.12, affixes: 2, sockets: [1, 0, 0], alch: 30 },
  { name: '稀有', color: '#0099db', dark: '#124e89', deep: '#262b44', glow: '#2ce8f5', mul: 1.28, affixes: 3, sockets: [1, 0, 0], alch: 90 },
  { name: '史诗', color: '#b55088', dark: '#68386c', deep: '#2e1a35', glow: '#f6757a', mul: 1.48, affixes: 3, sockets: [1, 1, 0], alch: 270 },
  { name: '传说', color: '#feae34', dark: '#733e39', deep: '#3e2731', glow: '#fee761', mul: 1.72, affixes: 4, sockets: [2, 1, 0], alch: 810 },
  { name: '不朽', color: '#e43b44', dark: '#a22633', deep: '#3e2731', glow: '#f6757a', mul: 2.0, affixes: 4, sockets: [2, 1, 1], alch: 2592 },
  { name: '至宝', color: '#c45bd6', dark: '#68386c', deep: '#2e1a35', glow: '#f6757a', mul: 2.35, affixes: 5, sockets: [2, 1, 1], alch: 8294 },
  { name: '超凡', color: '#ff0044', dark: '#a22633', deep: '#3e2731', glow: '#f6757a', mul: 2.75, affixes: 5, sockets: [3, 1, 1], alch: 29029 },
  { name: '天界', color: '#2ce8f5', dark: '#0099db', deep: '#124e89', glow: '#ffffff', mul: 3.2, affixes: 6, sockets: [3, 2, 1], alch: 101602 },
  { name: '宇宙', color: '#ffffff', dark: '#8b9bb4', deep: '#262b44', glow: '#fee761', mul: 3.8, affixes: 6, sockets: [3, 2, 1], alch: 355607 },
];
const GRADE_MAX = GRADES.length - 1;
const RARITY = GRADES; // frames and loot beams read colors from here
// drop weights per difficulty (grade index); higher grades come from the cube and boss chests
const DROP_WEIGHTS = [
  [600, 280, 95, 20, 4.5, 0.5, 0, 0, 0, 0],
  [500, 300, 140, 45, 12, 2.5, 0.4, 0, 0, 0],
  [400, 300, 190, 75, 25, 7, 1.6, 0.3, 0, 0],
  [300, 300, 220, 110, 45, 15, 5, 1.2, 0.25, 0],
];
const alchValue = (grade, ilvl) => Math.round(GRADES[grade].alch * Math.sqrt(SC(ilvl)));

// ---------- affixes ----------
// [min, max] at grade 0, ilvl 1; × (1 + 0.12 grade) × (1 + ilvl / 150)
const AFFIXES = {
  atkPct: { r: [0.04, 0.1], pre: '锋利的', text: v => `攻击 +${pct(v)}` },
  aspd: { r: [0.03, 0.07], pre: '迅捷的', text: v => `攻速 +${pct(v, 1)}` },
  crit: { r: [0.015, 0.04], pre: '精准的', text: v => `暴击率 +${pct(v, 1)}` },
  cdmg: { r: [0.08, 0.2], pre: '致命的', text: v => `暴击伤害 +${pct(v)}` },
  hpPct: { r: [0.05, 0.12], pre: '坚韧的', text: v => `生命 +${pct(v)}` },
  armPct: { r: [0.06, 0.14], pre: '厚重的', text: v => `护甲 +${pct(v)}` },
  ls: { r: [0.004, 0.012], pre: '嗜血的', text: v => `吸血 +${pct(v, 1)}` },
  regen: { r: [0.0015, 0.005], pre: '复苏的', text: v => `每秒回复 ${pct(v, 2)} 生命` },
  skill: { r: [0.04, 0.1], pre: '奥术', text: v => `技能伤害 +${pct(v)}` },
  cdr: { r: [0.02, 0.05], pre: '迅思', text: v => `冷却缩减 ${pct(v, 1)}` },
  boss: { r: [0.06, 0.15], pre: '猎首', text: v => `首领伤害 +${pct(v)}` },
  elite: { r: [0.06, 0.15], pre: '斩将', text: v => `精英与头目伤害 +${pct(v)}` },
  thorns: { r: [0.08, 0.2], pre: '荆棘', text: v => `荆棘 +${pct(v)}` },
  block: { r: [0.02, 0.05], pre: '坚守', text: v => `格挡率 +${pct(v, 1)}` },
  gold: { r: [0.05, 0.12], pre: '贪婪的', text: v => `金币 +${pct(v)}` },
  chest: { r: [0.03, 0.08], pre: '幸运的', text: v => `宝箱掉率 +${pct(v)}` },
  exp: { r: [0.04, 0.1], pre: '博学的', text: v => `经验 +${pct(v)}` },
  phys: { r: [0.06, 0.15], pre: '锋锐的', text: v => `物理伤害 +${pct(v)}` },
  fire: { r: [0.06, 0.15], pre: '炽热的', text: v => `火焰伤害 +${pct(v)}` },
  ice: { r: [0.06, 0.15], pre: '冰封的', text: v => `寒冰伤害 +${pct(v)}` },
  light: { r: [0.06, 0.15], pre: '雷鸣的', text: v => `雷电伤害 +${pct(v)}` },
  poison: { r: [0.06, 0.15], pre: '剧毒的', text: v => `剧毒伤害 +${pct(v)}` },
  holy: { r: [0.06, 0.15], pre: '圣洁的', text: v => `神圣伤害 +${pct(v)}` },
  move: { r: [0.03, 0.08], pre: '轻盈的', text: v => `行军速度 +${pct(v)}` },
};
const AFFIX_IDS = Object.keys(AFFIXES);
// stat text for everything that can show up on an item, rune, gem or pet
const STAT_TEXT = {
  ...Object.fromEntries(AFFIX_IDS.map(k => [k, AFFIXES[k].text])),
  dmg: v => `全伤害 +${pct(v)}`, elemAll: v => `全属性伤害 +${pct(v)}`, elemPct: v => `元素伤害 +${pct(v)}`, pen: v => `护甲穿透 ${pct(v)}`,
  bossGold: v => `首领金币 +${pct(v)}`, alchGold: v => `炼金金币 +${pct(v)}`, cubeExp: v => `魔方经验 +${pct(v)}`, gradeUp: v => `高品质几率 +${pct(v)}`,
  cleave: v => `劈中身后目标 ${pct(v)}`, splash: v => `溅射 ${pct(v)}`, pierce: v => `贯穿 ${v} 个目标`, toss: v => `额外掷斧几率 ${pct(v)}`, hitHeal: v => `命中回复 ${pct(v, 1)} 生命`,
  tAtk: v => `攻击 ×(1+${pct(v)})`, runSpeed: v => `行军速度 +${pct(v)}`,
};
const statText = (k, v) => (STAT_TEXT[k] ? STAT_TEXT[k](v) : k + ' ' + v);

// ---------- legend effects ----------
// cat: which slots can roll it; fam: only that weapon family's main / off hand
const LEGENDS = {
  chain: { cat: 'weapon', name: '连珠', item: '风语者', text: '每第 4 次普攻连击 3 次' },
  pierce: { cat: 'weapon', name: '穿云', item: '裂空', text: '普攻额外贯穿 2 个目标，造成 50% 伤害' },
  sunder: { cat: 'weapon', name: '破甲', item: '碎骨者', text: '无视 60% 防御' },
  ember: { cat: 'weapon', name: '余烬', item: '烬灭', text: '击杀时爆炸，对附近敌人造成目标最大生命 40% 的伤害' },
  verdict: { cat: 'weapon', name: '审判', item: '审判者', text: '对悬赏首领伤害 +60%，首领倒计时 +8 秒' },
  crown: { cat: 'armor', name: '棘冠', item: '荆棘王冠', text: '荆棘伤害可以暴击，并触发吸血' },
  undying: { cat: 'armor', name: '不屈', item: '不屈战袍', text: '每波一次：致命伤害保留 1 点生命并无敌 2 秒' },
  pact: { cat: 'armor', name: '血契', item: '血誓', text: '溢出的治疗转为护盾，最多 30% 最大生命' },
  bulwark: { cat: 'armor', name: '磐石', item: '磐石之心', text: '格挡时获得 5% 最大生命的护盾' },
  phoenix: { cat: 'armor', name: '涅槃', item: '凤凰之羽', text: '每关一次：倒下时以 40% 生命复活' },
  sand: { cat: 'acc', name: '时之砂', item: '时之沙漏', text: '每次暴击使所有技能冷却减少 0.25 秒' },
  echo: { cat: 'acc', name: '回响', item: '回响之戒', text: '技能有 30% 几率再释放一次' },
  gale: { cat: 'acc', name: '风行', item: '风行者', text: '攻速 +15%，攻速上限 +1' },
  prism: { cat: 'acc', name: '棱镜', item: '七彩棱镜', text: '每命中一种新元素，全伤害 +6%（持续 5 秒，最多 5 层）' },
  focus: { cat: 'acc', name: '专注', item: '猎人之眼', text: '对每个目标的第一次命中必定暴击' },
  midas: { cat: 'medal', name: '黄金律', item: '黄金律', text: '金币 +40%，每拾取一枚金币回复 0.5% 生命' },
  seeker: { cat: 'medal', name: '寻宝者', item: '寻宝者之证', text: '宝箱里的装备有 15% 几率品质提升一级' },
  bounty: { cat: 'medal', name: '赏金令', item: '赏金令', text: '首领赏金 ×2，并额外掉落一个首领宝箱' },
  collector: { cat: 'medal', name: '收藏家', item: '收藏家徽记', text: '宝箱掉率 +30%' },
  scholar: { cat: 'medal', name: '学者', item: '学者勋章', text: '经验 +40%' },
  swordwave: { cat: 'weapon', fam: 'sword', name: '剑气', item: '斩浪', text: '每次普攻射出剑气，命中身后 2 个目标造成 60% 伤害' },
  kingshield: { cat: 'weapon', fam: 'sword', name: '王者之盾', item: '王者之盾', text: '格挡率 +15%，格挡时反击 100%' },
  tempest: { cat: 'weapon', fam: 'axe', name: '风暴之刃', item: '风暴之刃', text: '旋风斧持续时间 +2 秒，范围 +50%' },
  bloodaxe: { cat: 'weapon', fam: 'axe', name: '血斧', item: '饮血者', text: '劈中身后目标时回复造成伤害的 10%' },
  splitarrow: { cat: 'weapon', fam: 'bow', name: '分裂箭', item: '千羽', text: '每支箭命中后分裂成 2 支，造成 40% 伤害' },
  falcon: { cat: 'weapon', fam: 'bow', name: '猎鹰', item: '猎鹰之翼', text: '速射触发时射出 2 支箭' },
  sunpierce: { cat: 'weapon', fam: 'crossbow', name: '贯日', item: '贯日', text: '弩矢贯穿所有目标' },
  thunderclap: { cat: 'weapon', fam: 'crossbow', name: '爆鸣', item: '雷鸣', text: '暴击时爆炸，对附近敌人造成 50% 伤害' },
  elemchain: { cat: 'weapon', fam: 'staff', name: '元素连锁', item: '三相之杖', text: '法弹命中后弹射 2 个目标，造成 50% 伤害' },
  hydraking: { cat: 'weapon', fam: 'staff', name: '九头蛇之王', item: '蛇王之瞳', text: '九头蛇多 2 个头，持续时间 +4 秒' },
  sainthood: { cat: 'weapon', fam: 'scepter', name: '圣愈', item: '圣者之心', text: '命中回复效果 ×3' },
  judgement: { cat: 'weapon', fam: 'scepter', name: '审判之光', item: '晨曦', text: '神圣伤害 +50%，圣光审判附带 1 秒眩晕' },
};
const LEGEND_IDS = Object.keys(LEGENDS);
const SLOT_CAT = { main: 'weapon', off: 'weapon', head: 'armor', chest: 'armor', hands: 'armor', feet: 'armor', neck: 'acc', ear: 'acc', ring: 'acc', wrist: 'acc', medal: 'medal' };
const legendsFor = type => {
  const T = TYPES[type], cat = SLOT_CAT[T.slot];
  return LEGEND_IDS.filter(id => LEGENDS[id].cat === cat && (!LEGENDS[id].fam || LEGENDS[id].fam === T.fam));
};

// ---------- materials ----------
const GEM_KINDS = {
  ruby: { name: '红宝石', stat: 'atkPct', per: 0.012, color: PAL.red },
  sapphire: { name: '蓝宝石', stat: 'hpPct', per: 0.016, color: PAL.blue },
  topaz: { name: '黄玉', stat: 'aspd', per: 0.006, color: PAL.amber },
  emerald: { name: '翡翠', stat: 'cdmg', per: 0.025, color: PAL.green },
  amethyst: { name: '紫晶', stat: 'skill', per: 0.01, color: PAL.magenta },
};
const GEM_IDS = Object.keys(GEM_KINDS);
const GEM_PREFIX = ['碎裂的', '粗糙的', '', '精致的', '无瑕的', '完美的', '璀璨的', '星辉', '天界', '宇宙'];
const PART_DEFS = {
  p_slime: ['史莱姆凝胶', 'hpPct'], p_rabbit: ['兔角', 'crit'], p_insect: ['甲壳碎片', 'armPct'], p_goblin: ['哥布林皮', 'gold'],
  p_shroom: ['孢子粉', 'skill'], p_bat: ['蝙蝠翼膜', 'ls'], p_plant: ['树精汁液', 'regen'], p_spider: ['蛛丝', 'aspd'],
  p_fox: ['狐火结晶', 'fire'], p_troll: ['巨魔獠牙', 'atkPct'], p_scorpion: ['蝎尾针', 'poison'], p_snake: ['蛇鳞', 'armPct'],
  p_mummy: ['古老绷带', 'thorns'], p_rat: ['鼠人火药', 'elite'], p_wolf: ['狼牙', 'cdmg'], p_beast: ['厚兽皮', 'hpPct'],
  p_frost: ['冰晶核', 'ice'], p_skeleton: ['骷髅骨', 'block'], p_penguin: ['企鹅羽毛', 'chest'], p_ghost: ['灵魂残响', 'cdr'],
  p_undead: ['腐爪', 'atkPct'], p_frog: ['蛙舌', 'aspd'], p_golem: ['魔像核心', 'armPct'], p_mole: ['矿工油灯', 'gold'],
  p_crystal: ['晶簇', 'skill'], p_demon: ['恶魔角', 'crit'], p_lizard: ['火蜥鳞', 'fire'], p_flame: ['熔火之心', 'fire'],
  p_worm: ['熔岩甲片', 'thorns'], p_bird: ['天空羽', 'exp'], p_sky: ['云絮', 'move'], p_gargoyle: ['石像鬼之眼', 'boss'],
  p_knight: ['骑士徽记', 'elite'], p_eye: ['眼魔晶体', 'cdmg'], p_drake: ['龙骨', 'phys'], p_cult: ['禁忌书页', 'skill'],
};
const ORE_NAMES = N('木材 铜块 铁锭 银锭 金锭 星尘锭 秘银 暗钢 山铜 精金');
const MATS = {};
(function buildMats() {
  for (const k in GEM_KINDS) for (let g = 0; g < 10; g++) MATS[`gem_${k}_${g}`] = { kind: 'gem', gem: k, grade: g, name: GEM_PREFIX[g] + GEM_KINDS[k].name, icon: 'i_gem' };
  for (const id in PART_DEFS) for (let g = 0; g < 10; g++) MATS[`${id}_${g}`] = { kind: 'part', part: id, grade: g, name: PART_DEFS[id][0], stat: PART_DEFS[id][1], icon: 'i_part' };
  for (let g = 0; g < 10; g++) MATS[`scroll_${g}`] = { kind: 'scroll', grade: g, name: `${GRADES[g].name}铭文卷轴`, icon: 'i_scroll' };
  for (let t = 0; t < 10; t++) MATS[`ore_${t}`] = { kind: 'ore', tier: t, grade: Math.min(9, t), name: ORE_NAMES[t], icon: 'i_ore' };
  MATS.chaos = { kind: 'ore', grade: 5, name: '混沌碎片', icon: 'i_chaos' };
  for (let g = 0; g < 10; g++) MATS[`coin_${g}`] = { kind: 'coin', grade: g, name: `${GRADES[g].name}纪念币`, icon: 'i_coin' };
  for (let d = 0; d < DIFFS.length; d++) MATS[`wanted_${d}`] = { kind: 'wanted', diff: d, grade: 4 + d, name: `${DIFFS[d].name}通缉令`, icon: 'i_wanted' };
})();
const MAT_IDS = Object.keys(MATS);
// stat value of a gem / part / scroll by its grade
const gemStats = (kind, g) => ({ [GEM_KINDS[kind].stat]: GEM_KINDS[kind].per * (g + 1) });
const partValue = (stat, g) => AFFIXES[stat].r[1] * (0.3 + 0.1 * g);
const INSCRIPTIONS = {
  dmg: { name: '毁灭', v: g => 0.02 * (g + 1) }, boss: { name: '弑君', v: g => 0.04 * (g + 1) }, cdmg: { name: '致命', v: g => 0.05 * (g + 1) },
  aspd: { name: '疾风', v: g => 0.012 * (g + 1) }, hpPct: { name: '磐石', v: g => 0.03 * (g + 1) }, gold: { name: '贪婪', v: g => 0.05 * (g + 1) },
  exp: { name: '求知', v: g => 0.04 * (g + 1) }, skill: { name: '秘法', v: g => 0.025 * (g + 1) },
};
const INSCRIPTION_IDS = Object.keys(INSCRIPTIONS);

// ---------- chests ----------
const CHESTS = [
  { id: 'monster', name: '怪物宝箱', grade: 0, items: 1, floor: 0, boost: 1, mats: [0.5, 1], wanted: 0, coin: 0, gold: 10 },
  { id: 'boss', name: '首领宝箱', grade: 2, items: 2, floor: 1, boost: 2, mats: [1, 2], wanted: 0.15, coin: 0.03, gold: 40 },
  { id: 'act', name: '地域宝箱', grade: 4, items: 3, floor: 2, boost: 4, mats: [2, 3], wanted: 0.35, coin: 0.15, gold: 150 },
];
const CHEST_DROP = { mob: 0.03 };
const TRAY_BASE = 30, BAG_BASE = 40;

// ---------- the cube ----------
const CUBE_FUNCS = [
  { id: 'synth', name: '合成', lv: 1, text: '9 件同品质装备合成 1 件高一品质装备，5% 几率再跳一级' },
  { id: 'alch', name: '炼金', lv: 1, text: '装备与材料换成金币和魔方经验' },
  { id: 'craft', name: '制作', lv: 5, text: '矿石与金币制作指定部位、指定等级段的随机装备' },
  { id: 'gem', name: '镶嵌', lv: 8, text: '把宝石放进装备的宝石孔' },
  { id: 'remove', name: '拆除', lv: 10, text: '取下插槽里的东西，取下的材料会碎掉' },
  { id: 'engrave', name: '铭刻', lv: 15, text: '把怪物素材刻进装备的铭刻孔' },
  { id: 'offer', name: '供奉', lv: 20, text: '献上纪念币，换一件对应品质的随机装备' },
  { id: 'inscribe', name: '铭文', lv: 25, text: '把铭文卷轴写进装备的铭文孔' },
  { id: 'reroll', name: '重铸', lv: 30, text: '花金币与混沌碎片，重新随机一条词条' },
];
const CUBE_MAX = 100;
const cubeNeed = lv => Math.round(40 * Math.pow(1.13, lv - 1));
const SYNTH_REQ = [0, 1, 1, 5, 10, 20, 30, 40, 55, 70]; // cube level needed to synthesize INTO each grade
const ENH_BONUS = 0.06, ENH_MAX = 50;
const enhCost = n => ({ gold: Math.ceil(80 * Math.pow(1.28, n)), ore: Math.min(9, Math.floor(n / 5)), oreN: 1 + Math.floor(n / 10) });

// ---------- rune tree (gold, permanent) ----------
// cost of the next level = c[0] × c[1]^level; a node opens once its parent has a level
const RUNE_NODES = [
  { id: 'heart', name: '猎人之心', x: 0, y: 0, max: 1, c: [0, 1], eff: { dmg: 0.05, hpPct: 0.05 }, color: PAL.yellow },
  { id: 'aw1', name: '觉醒之路', x: 0, y: 1, p: 'heart', max: 5, c: [2000, 1.8], eff: { dmg: 0.03 }, color: PAL.cyan },
  { id: 'slot2', name: '觉醒符文·二', x: 0, y: 2, p: 'aw1', max: 1, c: [50000, 1], eff: { skillSlot: 1 }, text: '解锁第 2 个技能槽', color: PAL.cyan },
  { id: 'petres', name: '宠物共鸣', x: 1, y: 2, p: 'aw1', max: 5, c: [30000, 2], eff: { petBonus: 0.2 }, text: '宠物加成 +20%', color: PAL.cyan },
  { id: 'skillmast', name: '技能精通', x: -1, y: 2, p: 'aw1', max: 10, c: [20000, 1.6], eff: { skill: 0.03 }, color: PAL.cyan },
  { id: 'slot3', name: '觉醒符文·三', x: 0, y: 3, p: 'slot2', max: 1, c: [3e6, 1], eff: { skillSlot: 1 }, text: '解锁第 3 个技能槽', color: PAL.cyan },
  { id: 'slot4', name: '觉醒符文·四', x: 0, y: 4, p: 'slot3', max: 1, c: [2e8, 1], eff: { skillSlot: 1 }, text: '解锁第 4 个技能槽', color: PAL.cyan },
  { id: 'blade', name: '锋刃', x: 1, y: 1, p: 'heart', max: 30, c: [100, 1.35], eff: { tAtk: 0.03 }, color: PAL.red },
  { id: 'haste', name: '疾速', x: 2, y: 1, p: 'blade', max: 20, c: [800, 1.4], eff: { aspd: 0.02 }, color: PAL.red },
  { id: 'precise', name: '精准', x: 2, y: 2, p: 'blade', max: 20, c: [1500, 1.4], eff: { crit: 0.006 }, color: PAL.red },
  { id: 'lethal', name: '致命', x: 3, y: 2, p: 'precise', max: 20, c: [6000, 1.42], eff: { cdmg: 0.06 }, color: PAL.red },
  { id: 'rend', name: '破甲', x: 3, y: 1, p: 'haste', max: 20, c: [6000, 1.42], eff: { pen: 0.01 }, color: PAL.red },
  { id: 'berserk', name: '狂战', x: 4, y: 2, p: 'lethal', max: 10, c: [1.5e6, 1.6], eff: { dmg: 0.08 }, color: PAL.red },
  { id: 'body', name: '体魄', x: -1, y: 1, p: 'heart', max: 30, c: [100, 1.35], eff: { tHp: 0.04 }, color: PAL.green },
  { id: 'iron', name: '铁壁', x: -2, y: 1, p: 'body', max: 20, c: [800, 1.4], eff: { armPct: 0.04 }, color: PAL.green },
  { id: 'leech', name: '吸血', x: -2, y: 2, p: 'body', max: 20, c: [2000, 1.4], eff: { ls: 0.003 }, color: PAL.green },
  { id: 'mend', name: '回复', x: -3, y: 2, p: 'leech', max: 20, c: [6000, 1.42], eff: { regen: 0.001 }, color: PAL.green },
  { id: 'thorn', name: '荆棘', x: -3, y: 1, p: 'iron', max: 20, c: [6000, 1.42], eff: { thorns: 0.06 }, color: PAL.green },
  { id: 'unbroken', name: '不屈', x: -4, y: 2, p: 'mend', max: 10, c: [1.5e6, 1.6], eff: { hpPct: 0.1, armPct: 0.05 }, color: PAL.green },
  { id: 'bounty', name: '赏金', x: -1, y: -1, p: 'heart', max: 30, c: [150, 1.36], eff: { gold: 0.05 }, color: PAL.amber },
  { id: 'bossgold', name: '首领赏金', x: -2, y: -1, p: 'bounty', max: 20, c: [1200, 1.4], eff: { bossGold: 0.1 }, color: PAL.amber },
  { id: 'alchemy', name: '炼金术', x: -2, y: -2, p: 'bounty', max: 20, c: [2000, 1.4], eff: { alchGold: 0.06 }, color: PAL.amber },
  { id: 'cubeexp', name: '魔方学徒', x: -3, y: -2, p: 'alchemy', max: 20, c: [5000, 1.42], eff: { cubeExp: 0.06 }, color: PAL.amber },
  { id: 'wisdom', name: '阅历', x: -3, y: -1, p: 'bossgold', max: 30, c: [3000, 1.38], eff: { exp: 0.05 }, color: PAL.amber },
  { id: 'goldtouch', name: '点金手', x: -4, y: -2, p: 'cubeexp', max: 10, c: [2e6, 1.6], eff: { gold: 0.15 }, color: PAL.amber },
  { id: 'seek', name: '寻宝', x: 1, y: -1, p: 'heart', max: 20, c: [300, 1.4], eff: { chest: 0.04 }, color: PAL.magenta },
  { id: 'tray', name: '托盘扩容', x: 2, y: -1, p: 'seek', max: 10, c: [2000, 1.6], eff: { tray: 5 }, text: '宝箱托盘 +5 格', color: PAL.magenta },
  { id: 'autoN', name: '自动开箱·怪物', x: 2, y: -2, p: 'seek', max: 1, c: [20000, 1], eff: { autoN: 1 }, text: '自动打开怪物宝箱', color: PAL.magenta },
  { id: 'autoB', name: '自动开箱·首领', x: 3, y: -2, p: 'autoN', max: 1, c: [250000, 1], eff: { autoB: 1 }, text: '自动打开首领宝箱与地域宝箱', color: PAL.magenta },
  { id: 'appraise', name: '鉴宝', x: 3, y: -1, p: 'tray', max: 20, c: [8000, 1.45], eff: { gradeUp: 0.03 }, color: PAL.magenta },
  { id: 'hoard', name: '宝箱猎人', x: 4, y: -2, p: 'autoB', max: 10, c: [3e6, 1.6], eff: { chest: 0.08 }, color: PAL.magenta },
  { id: 'pack', name: '行囊', x: 0, y: -1, p: 'heart', max: 10, c: [500, 1.7], eff: { bag: 5 }, text: '背包 +5 格', color: PAL.steel },
  { id: 'sleep', name: '长眠', x: 0, y: -2, p: 'pack', max: 8, c: [5000, 1.8], eff: { offline: 1 }, text: '离线时长 +1 小时', color: PAL.steel },
  { id: 'dream', name: '梦中狩猎', x: -1, y: -3, p: 'sleep', max: 10, c: [20000, 1.6], eff: { offlineGain: 0.1 }, text: '离线收益 +10%', color: PAL.steel },
  { id: 'autoalch', name: '自动炼金', x: 1, y: -3, p: 'sleep', max: 1, c: [60000, 1], eff: { autoAlch: 1 }, text: '开箱时按过滤器自动炼金', color: PAL.steel },
  { id: 'vault', name: '无尽行囊', x: 0, y: -3, p: 'sleep', max: 5, c: [5e6, 3], eff: { bag: 20 }, text: '背包 +20 格', color: PAL.steel },
  { id: 'elem', name: '属性亲和', x: 1, y: 0, p: 'heart', max: 20, c: [1000, 1.4], eff: { elemAll: 0.02 }, color: PAL.blue },
  { id: 'r_phys', name: '锋锐', x: 2, y: 0, p: 'elem', max: 20, c: [3000, 1.42], eff: { phys: 0.04 }, color: PAL.mist },
  { id: 'r_fire', name: '烈焰', x: 3, y: 0, p: 'r_phys', max: 20, c: [9000, 1.42], eff: { fire: 0.04 }, color: PAL.orange },
  { id: 'r_ice', name: '寒冰', x: 4, y: 0, p: 'r_fire', max: 20, c: [27000, 1.42], eff: { ice: 0.04 }, color: PAL.cyan },
  { id: 'r_light', name: '雷霆', x: 5, y: 0, p: 'r_ice', max: 20, c: [81000, 1.42], eff: { light: 0.04 }, color: PAL.yellow },
  { id: 'r_poison', name: '剧毒', x: 6, y: 0, p: 'r_light', max: 20, c: [2.4e5, 1.42], eff: { poison: 0.04 }, color: PAL.green },
  { id: 'r_holy', name: '圣光', x: 7, y: 0, p: 'r_poison', max: 20, c: [7e5, 1.42], eff: { holy: 0.04 }, color: PAL.cream },
  { id: 'hunt', name: '猎杀', x: -1, y: 0, p: 'heart', max: 20, c: [1000, 1.4], eff: { elite: 0.06 }, color: PAL.pink },
  { id: 'slayer', name: '屠首', x: -2, y: 0, p: 'hunt', max: 20, c: [4000, 1.42], eff: { boss: 0.06 }, color: PAL.pink },
  { id: 'march', name: '急行军', x: -3, y: 0, p: 'slayer', max: 5, c: [15000, 2], eff: { runSpeed: 0.12 }, color: PAL.pink },
  { id: 'wanted', name: '通缉令猎手', x: -4, y: 0, p: 'march', max: 10, c: [50000, 1.6], eff: { wantedDrop: 0.1 }, text: '通缉令掉率 +10%', color: PAL.pink },
  { id: 'kingslayer', name: '赏金之王', x: -5, y: 0, p: 'wanted', max: 10, c: [4e6, 1.6], eff: { boss: 0.12 }, color: PAL.pink },
];
const RUNE = Object.fromEntries(RUNE_NODES.map(n => [n.id, n]));
const runeCost = (n, lv) => Math.ceil(n.c[0] * Math.pow(n.c[1], lv));

// ---------- skills ----------
// tier: hero level needed; max: level cap; v / mul arrays are [level 1, per extra level]
const lv = (a, l) => a[0] + a[1] * (l - 1);
const SKILLS = {
  // 剑盾
  cleave: { fam: 'sword', name: '裂地斩', icon: 's_cleave', cd: 6, req: 1, mul: [2.2, 0.2], range: 90, desc: l => `对前方 90 像素内所有敌人造成 ${pct(lv(SKILLS.cleave.mul, l))} 伤害` },
  bash: { fam: 'sword', name: '盾击', icon: 's_bash', cd: 9, req: 10, mul: [3.5, 0.3], desc: l => `${pct(lv(SKILLS.bash.mul, l))} 伤害并眩晕 1.5 秒，装备盾牌时伤害 +50%` },
  bladestorm: { fam: 'sword', name: '剑刃风暴', icon: 's_bladestorm', cd: 14, req: 20, mul: [0.6, 0.05], desc: l => `2 秒内旋斩 8 次，每次对 70 像素内敌人造成 ${pct(lv(SKILLS.bladestorm.mul, l))} 伤害` },
  execute: { fam: 'sword', name: '审判之刃', icon: 's_execute', cd: 16, req: 30, mul: [9, 0.8], desc: l => `造成 ${pct(lv(SKILLS.execute.mul, l))} 伤害，目标生命低于 30% 时伤害 ×3` },
  guard: { fam: 'sword', name: '坚盾', icon: 's_bastion', passive: 1, req: 5, max: 5, eff: { block: 0.03, armPct: 0.06 }, desc: l => `格挡率 +${pct(0.03 * l)}，护甲 +${pct(0.06 * l)}` },
  riposte: { fam: 'sword', name: '反击', icon: 's_riposte', passive: 1, req: 15, max: 5, eff: { riposte: 0.3 }, desc: l => `格挡后反击，造成 ${pct(0.9 + 0.3 * l)} 伤害` },
  // 双斧
  whirl: { fam: 'axe', name: '旋风斧', icon: 's_whirl', cd: 8, req: 1, mul: [0.55, 0.05], desc: l => `旋转 3 秒，每 0.25 秒对 60 像素内敌人造成 ${pct(lv(SKILLS.whirl.mul, l))} 伤害` },
  throwaxe: { fam: 'axe', name: '回旋飞斧', icon: 's_throwaxe', cd: 7, req: 10, mul: [1.8, 0.15], desc: l => `掷出飞斧往返，命中最多 4 个目标，各 ${pct(lv(SKILLS.throwaxe.mul, l))} 伤害` },
  crush: { fam: 'axe', name: '碎颅重击', icon: 's_crush', cd: 12, req: 20, mul: [7, 0.6], desc: l => `对前方目标造成 ${pct(lv(SKILLS.crush.mul, l))} 伤害并眩晕 1 秒` },
  rage: { fam: 'axe', name: '狂暴', icon: 's_rage', cd: 20, req: 30, v: [0.4, 0.04], dur: 8, desc: l => `8 秒内攻速 +${pct(lv(SKILLS.rage.v, l))}，吸血 +3%` },
  bloodlust: { fam: 'axe', name: '嗜血', icon: 's_soul', passive: 1, req: 5, max: 5, eff: { ls: 0.006 }, desc: l => `吸血 +${pct(0.006 * l, 1)}` },
  cleaver: { fam: 'axe', name: '劈山', icon: 's_cleaver', passive: 1, req: 15, max: 5, eff: { cleave: 0.1 }, desc: l => `劈中身后目标的伤害 +${pct(0.1 * l)}${l >= 5 ? '，并多劈中 1 个目标' : ''}` },
  // 长弓
  multishot: { fam: 'bow', name: '多重射击', icon: 's_flurry', cd: 6, req: 1, mul: [1.4, 0.12], desc: l => `向最多 5 个目标各射出一箭，造成 ${pct(lv(SKILLS.multishot.mul, l))} 伤害` },
  pierceshot: { fam: 'bow', name: '穿云箭', icon: 's_pierceshot', cd: 9, req: 10, mul: [3, 0.25], desc: l => `射出贯穿所有敌人的一箭，造成 ${pct(lv(SKILLS.pierceshot.mul, l))} 伤害` },
  arrowrain: { fam: 'bow', name: '箭雨', icon: 's_arrowrain', cd: 13, req: 20, mul: [0.45, 0.04], desc: l => `2.5 秒箭雨，每次对 100 像素区域造成 ${pct(lv(SKILLS.arrowrain.mul, l))} 伤害，共 10 次` },
  gale: { fam: 'bow', name: '疾风步', icon: 's_gale', cd: 14, req: 30, v: [12, 1], desc: l => `接下来 ${lv(SKILLS.gale.v, l)} 次攻击各射出两支箭` },
  rapid: { fam: 'bow', name: '速射', icon: 's_rapid', passive: 1, req: 5, max: 5, eff: { rapid: 0.04 }, desc: l => `${pct(0.04 * l)} 几率多射出一支箭` },
  hawkeye: { fam: 'bow', name: '鹰眼', icon: 's_hawkeye', passive: 1, req: 15, max: 5, eff: { crit: 0.02, cdmg: 0.06 }, desc: l => `暴击率 +${pct(0.02 * l)}，暴击伤害 +${pct(0.06 * l)}` },
  // 重弩
  blastbolt: { fam: 'crossbow', name: '爆裂弩矢', icon: 's_meteor', cd: 7, req: 1, mul: [2.6, 0.22], desc: l => `弩矢命中后爆炸，对 45 像素内敌人造成 ${pct(lv(SKILLS.blastbolt.mul, l))} 伤害` },
  snipe: { fam: 'crossbow', name: '狙杀', icon: 's_snipe', cd: 14, req: 10, mul: [12, 1], desc: l => `瞄准生命最高的敌人，造成 ${pct(lv(SKILLS.snipe.mul, l))} 伤害，暴击率 +50%` },
  snare: { fam: 'crossbow', name: '猎人陷阱', icon: 's_snare', cd: 9, req: 20, mul: [5, 0.4], desc: l => `布下陷阱，触发 3 次，每次 ${pct(lv(SKILLS.snare.mul, l))} 伤害并定身 2 秒` },
  repeater: { fam: 'crossbow', name: '连弩', icon: 's_repeater', cd: 10, req: 30, mul: [1.1, 0.1], desc: l => `连射 6 支贯穿弩矢，每支 ${pct(lv(SKILLS.repeater.mul, l))} 伤害` },
  weakspot: { fam: 'crossbow', name: '致命弱点', icon: 's_execute', passive: 1, req: 5, max: 5, eff: { cdmg: 0.1 }, desc: l => `暴击伤害 +${pct(0.1 * l)}` },
  armorpierce: { fam: 'crossbow', name: '破甲', icon: 's_ap', passive: 1, req: 15, max: 5, eff: { pen: 0.08 }, desc: l => `无视 ${pct(0.08 * l)} 防御` },
  // 法杖
  fireball: { fam: 'staff', name: '火球术', icon: 's_fireball', cd: 5, req: 1, mul: [2.4, 0.2], elem: 'fire', desc: l => `火球对 40 像素内敌人造成 ${pct(lv(SKILLS.fireball.mul, l))} 火焰伤害并点燃 3 秒` },
  chainlight: { fam: 'staff', name: '闪电链', icon: 's_thunder', cd: 7, req: 10, mul: [2, 0.16], elem: 'light', desc: l => `闪电在 5 个敌人间弹射，首个目标 ${pct(lv(SKILLS.chainlight.mul, l))} 雷电伤害，每次弹射 -10%` },
  frostnova: { fam: 'staff', name: '冰霜新星', icon: 's_frostnova', cd: 11, req: 20, mul: [2.2, 0.18], elem: 'ice', desc: l => `对 120 像素内所有敌人造成 ${pct(lv(SKILLS.frostnova.mul, l))} 寒冰伤害并冻结 1.5 秒` },
  hydra: { fam: 'staff', name: '九头蛇', icon: 's_hydra', cd: 16, req: 30, mul: [0.8, 0.08], elem: 'fire', desc: l => `召唤九头蛇 8 秒，每秒喷出 2 发火焰，各 ${pct(lv(SKILLS.hydra.mul, l))} 伤害` },
  elemmastery: { fam: 'staff', name: '元素精通', icon: 's_elem', passive: 1, req: 5, max: 5, eff: { elemAll: 0.08 }, desc: l => `元素伤害 +${pct(0.08 * l)}` },
  surge: { fam: 'staff', name: '法力涌动', icon: 's_surge', passive: 1, req: 15, max: 5, eff: { cdr: 0.04 }, desc: l => `冷却缩减 ${pct(0.04 * l)}` },
  // 权杖
  smite: { fam: 'scepter', name: '圣光审判', icon: 's_smite', cd: 6, req: 1, mul: [2.6, 0.22], elem: 'holy', desc: l => `圣光重击 ${pct(lv(SKILLS.smite.mul, l))} 神圣伤害，回复 4% 生命` },
  prayer: { fam: 'scepter', name: '治疗祷言', icon: 's_prayer', cd: 12, req: 10, v: [0.25, 0.02], dur: 4, desc: l => `4 秒内回复 ${pct(lv(SKILLS.prayer.v, l))} 生命，期间护甲 +30%` },
  aegis: { fam: 'scepter', name: '神圣护盾', icon: 's_bastion', cd: 18, req: 20, v: [0.3, 0.02], dur: 6, desc: l => `获得 ${pct(lv(SKILLS.aegis.v, l))} 最大生命的护盾，6 秒内荆棘 ×2` },
  holynova: { fam: 'scepter', name: '圣光新星', icon: 's_nova', cd: 12, req: 30, mul: [3.2, 0.28], elem: 'holy', desc: l => `对所有敌人造成 ${pct(lv(SKILLS.holynova.mul, l))} 神圣伤害并回复 6% 生命` },
  aura: { fam: 'scepter', name: '祝福光环', icon: 's_aura', passive: 1, req: 5, max: 5, eff: { tAtk: 0.05, dmg: 0.02 }, desc: l => `攻击 +${pct(0.05 * l)}，全伤害 +${pct(0.02 * l)}` },
  devotion: { fam: 'scepter', name: '虔诚', icon: 's_regen', passive: 1, req: 15, max: 5, eff: { regen: 0.003, thorns: 0.08 }, desc: l => `每秒回复 ${pct(0.003 * l, 1)} 生命，荆棘 +${pct(0.08 * l)}` },
  // 通用
  warcry: { fam: 'any', name: '战吼', icon: 's_warcry', cd: 18, req: 5, v: [0.4, 0.04], dur: 6, desc: l => `6 秒内攻速 +${pct(lv(SKILLS.warcry.v, l))}，暴击伤害 +15%` },
  storm: { fam: 'any', name: '赏金风暴', icon: 's_storm', cd: 40, req: 25, v: [0.3, 0.03], dur: 8, desc: l => `8 秒内击杀金币 ×2、宝箱掉率 ×2，攻速 +${pct(lv(SKILLS.storm.v, l))}` },
  soul: { fam: 'any', name: '噬魂', icon: 's_soul', cd: 10, req: 40, mul: [3, 0.25], desc: l => `对前方目标造成 ${pct(lv(SKILLS.soul.mul, l))} 伤害，回复 8% 最大生命` },
};
for (const id in SKILLS) { SKILLS[id].id = id; SKILLS[id].max ??= SKILLS[id].passive ? 5 : 10; SKILLS[id].elem ??= null; }
const SKILL_IDS = Object.keys(SKILLS);
const skillsOfFam = fam => SKILL_IDS.filter(id => SKILLS[id].fam === fam);
const SKILL_SLOT_BASE = 1;

// ---------- pets ----------
const PETS = {
  slimepet: { name: '史莱姆宝宝', spr: 'pet_slime', mob: 'slime', kills: 1000, eff: { gold: 0.1 } },
  batpet: { name: '蝙蝠宝宝', spr: 'pet_bat', mob: 'sporebat', kills: 800, eff: { aspd: 0.05 } },
  foxpet: { name: '小狐火', spr: 'pet_fox', mob: 'fox', kills: 600, eff: { fire: 0.15 } },
  beetlepet: { name: '甲虫宝宝', spr: 'pet_beetle', mob: 'scarab', kills: 1500, eff: { chest: 0.1 } },
  snowpet: { name: '雪团', spr: 'pet_snow', mob: 'penguin', kills: 800, eff: { ice: 0.15 } },
  wisppet: { name: '小鬼火', spr: 'pet_wisp', mob: 'wisp', kills: 1200, eff: { skill: 0.08 } },
  crystalpet: { name: '晶灵宝宝', spr: 'pet_crystal', mob: 'crystalwisp', kills: 1000, eff: { cubeExp: 0.15 } },
  lizardpet: { name: '小火蜥', spr: 'pet_lizard', mob: 'salamander', kills: 1000, eff: { cdmg: 0.15 } },
  cloudpet: { name: '云朵', spr: 'pet_cloud', mob: 'cloudling', kills: 1000, eff: { exp: 0.12 } },
  eyepet: { name: '小眼魔', spr: 'pet_eye', mob: 'eyebeast', kills: 1500, eff: { crit: 0.03 } },
  gobpet: { name: '小宝箱怪', spr: 'pet_gob', mob: 'goldgob', kills: 60, eff: { gold: 0.15 } },
  dragonpet: { name: '骨龙宝宝', spr: 'pet_drake', mob: 'bonedrake', kills: 2000, eff: { dmg: 0.08 } },
};
const PET_IDS = Object.keys(PETS);

// ---------- achievements ----------
const ACHIEVEMENTS = [];
(function buildAch() {
  const add = (id, name, text, test, reward) => ACHIEVEMENTS.push({ id, name, text, test, reward });
  [[100, '初出茅庐'], [1000, '小有名气'], [10000, '百战老手'], [100000, '万人斩'], [1000000, '传奇猎人']].forEach(([n, name], i) => add('kill' + i, name, `击杀 ${fmt(n)} 只怪物`, s => s.stats.kills >= n, { chest: 'boss', n: i + 1 }));
  [[1, '第一张通缉令'], [10, '悬赏专家'], [100, '首领克星'], [1000, '赏金之王']].forEach(([n, name], i) => add('boss' + i, name, `击败 ${n} 个悬赏首领`, s => s.stats.bosses >= n, { chest: 'act', n: 1 + i }));
  DIFFS.forEach((D, d) => [3, 6, 9].forEach(a => add(`clear${d}_${a}`, `${D.name}·${ACTS[a - 1].name}`, `通关${D.name}难度第 ${a} 地域`, s => s.prog.best[d] >= a * STAGES, { chest: a === 9 ? 'act' : 'boss', n: a === 9 ? 2 : 1 })));
  [10, 25, 50, 75, 100].forEach((L, i) => add('lv' + i, `${L} 级猎人`, `猎人达到 ${L} 级`, s => s.hero.lv >= L, { gold: 200 * SC(L) }));
  [4, 5, 6, 7, 8, 9].forEach(g => add('grade' + g, `${GRADES[g].name}之光`, `获得一件${GRADES[g].name}装备`, s => (s.stats.bestGrade || 0) >= g, { chest: 'act', n: 1 }));
  [10, 25, 50, 100].forEach((L, i) => add('cube' + i, `魔方 ${L} 级`, `魔方达到 ${L} 级`, s => s.cube.lv >= L, { gold: 500 * SC(L) }));
  [[10, '符文学徒'], [30, '符文大师'], [RUNE_NODES.length, '符文之主']].forEach(([n, name], i) => add('rune' + i, name, `点亮 ${n} 个符文节点`, s => Object.keys(s.runes).length >= n, { gold: [5e3, 5e6, 1e9][i] }));
  [[1, '第一只宠物'], [6, '宠物乐园'], [12, '宠物大师']].forEach(([n, name], i) => add('pet' + i, name, `收集 ${n} 只宠物`, s => Object.keys(s.pets.own).length >= n, { chest: 'boss', n: 2 + i * 2 }));
  [[10, '开箱新手'], [500, '开箱达人'], [10000, '开箱狂人']].forEach(([n, name], i) => add('open' + i, name, `打开 ${fmt(n)} 个宝箱`, s => s.stats.opened >= n, { chest: 'boss', n: 1 + i * 2 }));
  [[1e6, '小富'], [1e9, '巨富'], [1e12, '富可敌国']].forEach(([n, name], i) => add('gold' + i, name, `累计获得 ${fmt(n)} 金币`, s => s.stats.gold >= n, { chest: 'act', n: 1 + i }));
  [[1, '第一次合成'], [100, '合成工匠']].forEach(([n, name], i) => add('synth' + i, name, `合成 ${n} 次`, s => s.stats.synth >= n, { gold: [2e3, 2e6][i] }));
})();

// ---------- side modes ----------
const MODES = {
  board: { name: '公会告示板', unlock: [0, 1, 10], refreshH: 4, icon: 'i_board' },
  mine: { name: '贪婪矿井', unlock: [0, 2, 10], tickets: 3, regenH: 1, dur: 60, icon: 'i_mine' },
  rush: { name: '首领连战', unlock: [0, 4, 10], tickets: 3, regenH: 2, time: 45, icon: 'i_rush' },
  trial: { name: '突变试炼', unlock: [1, 1, 1], tickets: 2, regenH: 12, icon: 'i_trial' },
};
const MUTATORS = {
  frenzy: { name: '狂暴', text: '怪物攻击 +60%', bonus: 0.4 },
  plated: { name: '坚甲', text: '怪物防御 ×3', bonus: 0.4 },
  quick: { name: '迅捷', text: '怪物移动与攻击速度 +50%', bonus: 0.3 },
  frail: { name: '虚弱', text: '猎人的吸血与生命回复归零', bonus: 0.5 },
  hurry: { name: '速战', text: '首领倒计时 -40%', bonus: 0.4 },
  giant: { name: '巨像', text: '首领生命 +150%', bonus: 0.5 },
};
const MUTATOR_IDS = Object.keys(MUTATORS);
const CONTRACTS = {
  hunt: { text: c => `击杀 ${c.goal} 只${MONSTERS[c.mob].name}`, goal: r => 60 + r.int(0, 8) * 10 },
  elite: { text: c => `击杀 ${c.goal} 只精英怪`, goal: r => 6 + r.int(0, 5) },
  champ: { text: c => `击败 ${c.goal} 个头目`, goal: r => 4 + r.int(0, 4) },
  boss: { text: c => `击败 ${c.goal} 个悬赏首领`, goal: r => 2 + r.int(0, 2) },
  open: { text: c => `打开 ${c.goal} 个宝箱`, goal: r => 15 + r.int(0, 3) * 5 },
  alch: { text: c => `炼金 ${c.goal} 件装备`, goal: r => 20 + r.int(0, 3) * 10 },
  crit: { text: c => `打出 ${c.goal} 次暴击`, goal: r => 300 + r.int(0, 5) * 100 },
  stage: { text: c => `通关 ${c.goal} 个关卡`, goal: r => 5 + r.int(0, 5) },
};
const CONTRACT_IDS = Object.keys(CONTRACTS);
const OFFLINE_BASE_H = 8;
