'use strict';
// =====================================================================
//  DATA — every number and name in the game (third edition).
//  Structure follows TBH: Task Bar Hero one to one — a party of up to
//  three from six classes, 3 acts × 10 stages × 4 difficulties, three
//  chest types, the cube, a 197-node rune tree, 8 pets. Names, art and
//  the monster roster are this game's own.
// =====================================================================

// ---------- level scaling ----------
const SC = L => Math.pow(1.15, Math.max(0, L - 1));
const pctScale = ilvl => Math.min(3, 1 + (ilvl - 1) / 45);

// ---------- elements (TBH: physical, fire, cold, lightning, chaos) ----------
const ELEMENTS = ['phys', 'fire', 'cold', 'lightning', 'chaos'];
const ELEM = {
  phys: { name: '物理', color: PAL.mist }, fire: { name: '火焰', color: PAL.orange }, cold: { name: '冰霜', color: PAL.cyan },
  lightning: { name: '闪电', color: PAL.yellow }, chaos: { name: '混沌', color: PAL.magenta },
};
const RES_IDS = ['fire', 'cold', 'lightning', 'chaos'];
const RES_CAP = 0.75, WEAK_MUL = 1.5, RESIST_MUL = 0.6;
// status effects
const STATUS = {
  chill: { name: '冰缓', dur: 4, text: '攻击与移动速度 -30%' },
  freeze: { name: '冰冻', dur: 1.5, text: '无法行动' },
  ignite: { name: '点燃', dur: 4, text: '每秒受到火焰伤害' },
  shock: { name: '感电', dur: 6, text: '受到的伤害 +15%' },
  bleed: { name: '流血', dur: 7, text: '每秒受到物理伤害' },
  stun: { name: '眩晕', dur: 2, text: '无法行动，受到的伤害 +10%' },
};

// ---------- difficulties (TBH level bands) ----------
const DIFFS = [
  { id: 'normal', name: '普通', hp: 1, atk: 1, gold: 1, exp: 1, color: PAL.mist },
  { id: 'nightmare', name: '噩梦', hp: 1.25, atk: 1.15, gold: 2, exp: 1.3, color: PAL.magenta },
  { id: 'hell', name: '地狱', hp: 1.5, atk: 1.3, gold: 4, exp: 1.6, color: PAL.red },
  { id: 'torment', name: '折磨', hp: 1.8, atk: 1.45, gold: 8, exp: 2, color: PAL.amber },
];
// monster level of every stage: LEVELS[difficulty][act][stage] (TBH table)
const LEVELS = [
  [[1, 2, 3, 5, 6, 7, 8, 10, 11, 12], [13, 14, 15, 16, 17, 18, 19, 20, 21, 22], [23, 24, 25, 26, 27, 28, 29, 30, 31, 32]],
  [[33, 34, 35, 35, 36, 37, 38, 39, 40, 40], [41, 41, 42, 42, 43, 43, 44, 44, 45, 45], [46, 47, 48, 49, 50, 50, 51, 51, 52, 52]],
  [[53, 54, 55, 56, 57, 58, 59, 59, 60, 60], [61, 62, 63, 64, 65, 66, 67, 68, 69, 69], [70, 71, 72, 73, 74, 75, 76, 76, 77, 77]],
  [[78, 79, 80, 81, 82, 83, 84, 84, 85, 85], [86, 86, 87, 87, 88, 88, 89, 89, 90, 90], [91, 91, 92, 92, 93, 93, 94, 94, 95, 95]],
];
// waves and kills per non-boss stage (TBH: Normal 10/10 → 18/198, Nightmare 20/200 → 23/345, Hell 24/360 → 27/486, Torment 29/522 → 31/651)
const WAVE_SPAN = [[10, 18, 10, 198], [20, 23, 200, 345], [24, 27, 360, 486], [29, 31, 522, 651]];
const ACT_COUNT = 3, STAGES = 10, FULL = ACT_COUNT * STAGES;
const stageIndex = (a, s) => (a - 1) * STAGES + (s - 1); // 0..29
function stageWaves(d, a, s) {
  if (s === STAGES) return { waves: 1, kills: 1 };
  const i = (a - 1) * 9 + (s - 1), k = i / 26, [w0, w1, k0, k1] = WAVE_SPAN[d];
  const kills = Math.round(d === 0 ? k0 * Math.pow(k1 / k0, k) : lerp(k0, k1, k));
  return { waves: Math.round(lerp(w0, w1, k)), kills };
}
const stageLevel = (d, a, s) => LEVELS[d][a - 1][s - 1];
// a few stages hit harder than their level suggests: the last stretch of each act and every act boss
const DANGER = [1, 1, 1, 1.05, 1, 1, 1.1, 1.15, 1.2, 1.1];
const stageDanger = (a, s) => DANGER[s - 1] * (a === 3 && s >= 7 ? 1.05 : 1);

// ---------- monster families: weakness and resistance ----------
const FAMILIES = {
  slime: { name: '史莱姆', weak: 'fire', resist: 'chaos' }, rabbit: { name: '野兔', weak: 'chaos' }, insect: { name: '虫群', weak: 'fire', resist: 'chaos' },
  goblin: { name: '哥布林', weak: 'lightning' }, shroom: { name: '菌菇', weak: 'fire', resist: 'chaos' }, bat: { name: '蝙蝠', weak: 'lightning' },
  plant: { name: '植物', weak: 'fire', resist: 'cold' }, spider: { name: '蜘蛛', weak: 'fire', resist: 'chaos' }, fox: { name: '狐灵', weak: 'cold', resist: 'fire' },
  troll: { name: '巨魔', weak: 'fire' }, scorpion: { name: '蝎子', weak: 'cold', resist: 'chaos' }, snake: { name: '蛇', weak: 'cold' },
  mummy: { name: '木乃伊', weak: 'fire', resist: 'chaos' }, rat: { name: '鼠人', weak: 'lightning' }, wolf: { name: '狼', weak: 'fire' },
  beast: { name: '巨兽', weak: 'fire', resist: 'cold' }, frost: { name: '冰灵', weak: 'fire', resist: 'cold' }, skeleton: { name: '骷髅', weak: 'lightning', resist: 'chaos' },
  penguin: { name: '企鹅', weak: 'lightning', resist: 'cold' }, ghost: { name: '幽魂', weak: 'fire', resist: 'phys' }, undead: { name: '亡者', weak: 'fire', resist: 'chaos' },
  frog: { name: '蛙人', weak: 'lightning' }, golem: { name: '魔像', weak: 'lightning', resist: 'phys' }, mole: { name: '鼹鼠', weak: 'chaos' },
  crystal: { name: '晶灵', weak: 'phys', resist: 'lightning' }, demon: { name: '恶魔', weak: 'cold', resist: 'fire' }, lizard: { name: '蜥蜴', weak: 'cold', resist: 'fire' },
  flame: { name: '火灵', weak: 'cold', resist: 'fire' }, worm: { name: '蠕虫', weak: 'cold', resist: 'fire' }, bird: { name: '飞禽', weak: 'lightning' },
  sky: { name: '天灵', weak: 'chaos', resist: 'lightning' }, gargoyle: { name: '石像鬼', weak: 'lightning', resist: 'phys' }, knight: { name: '骑士', weak: 'lightning', resist: 'phys' },
  eye: { name: '眼魔', weak: 'lightning' }, drake: { name: '骨龙', weak: 'cold', resist: 'fire' }, cult: { name: '术士', weak: 'phys', resist: 'chaos' },
};

// ---------- monsters ----------
// multipliers on the level curve; spd = walk px/s, rng = attack reach (0 melee), fly = hover height
const MONSTERS = {
  slime: { name: '史莱姆', spr: 'slime', fam: 'slime', hp: 1, atk: 0.8, def: 0.5, spd: 22, cd: 1.3, hop: 1 },
  bigslime: { name: '巨型史莱姆', spr: 'bigslime', fam: 'slime', hp: 2.6, atk: 1.1, def: 0.8, spd: 16, cd: 1.6, hop: 1, split: 'slime', w: 24 },
  rabbit: { name: '角兔', spr: 'rabbit', fam: 'rabbit', hp: 0.7, atk: 1, def: 0.3, spd: 46, cd: 1, hop: 1 },
  wasp: { name: '毒蜂', spr: 'wasp', fam: 'insect', hp: 0.55, atk: 0.9, def: 0.2, spd: 40, cd: 1.4, rng: 70, fly: 22, shot: 'sting', elem: 'chaos' },
  gobthief: { name: '哥布林小偷', spr: 'gobthief', fam: 'goblin', hp: 0.8, atk: 1.1, def: 0.4, spd: 52, cd: 0.8 },
  gobarcher: { name: '哥布林弓手', spr: 'gobarcher', fam: 'goblin', hp: 0.75, atk: 1, def: 0.4, spd: 30, cd: 1.5, rng: 100, shot: 'arrow' },
  gobshaman: { name: '哥布林萨满', spr: 'gobshaman', fam: 'goblin', hp: 0.9, atk: 0.9, def: 0.5, spd: 26, cd: 1.7, rng: 90, shot: 'spark', heal: 0.12, elem: 'lightning' },
  gobbrute: { name: '哥布林暴徒', spr: 'goblin', fam: 'goblin', hp: 1.8, atk: 1.3, def: 1, spd: 28, cd: 1.3 },
  shroom: { name: '红菇怪', spr: 'shroom', fam: 'shroom', hp: 1.2, atk: 0.8, def: 0.8, spd: 18, cd: 1.6 },
  toxshroom: { name: '毒菇怪', spr: 'shroom', pal: 'tox', fam: 'shroom', hp: 1, atk: 0.9, def: 0.6, spd: 18, cd: 1.8, rng: 80, shot: 'spore', elem: 'chaos' },
  sporebat: { name: '孢子蝠', spr: 'bat', fam: 'bat', hp: 0.6, atk: 1, def: 0.2, spd: 50, cd: 1.1, fly: 26 },
  sapling: { name: '树苗精', spr: 'sapling', fam: 'plant', hp: 1.4, atk: 0.9, def: 1, spd: 20, cd: 1.5 },
  forestspider: { name: '林蛛', spr: 'spiderling', fam: 'spider', hp: 0.8, atk: 1.1, def: 0.5, spd: 48, cd: 1 },
  mossgob: { name: '苔藓哥布林', spr: 'goblin', pal: 'moss', fam: 'goblin', hp: 1.5, atk: 1.2, def: 0.9, spd: 30, cd: 1.3 },
  fox: { name: '狐火', spr: 'fox', fam: 'fox', hp: 0.8, atk: 1.2, def: 0.4, spd: 56, cd: 1, elem: 'fire' },
  mosstroll: { name: '苔藓巨魔', spr: 'troll', fam: 'troll', hp: 3, atk: 1.5, def: 1.4, spd: 14, cd: 2, w: 26 },
  scorpion: { name: '沙蝎', spr: 'scorpion', fam: 'scorpion', hp: 1.1, atk: 1.2, def: 1.4, spd: 30, cd: 1.2, elem: 'chaos' },
  cobra: { name: '眼镜蛇', spr: 'cobra', fam: 'snake', hp: 0.9, atk: 1.1, def: 0.6, spd: 26, cd: 1.5, rng: 75, shot: 'venom', elem: 'chaos' },
  mummy: { name: '木乃伊', spr: 'mummy', fam: 'mummy', hp: 1.8, atk: 1, def: 1, spd: 16, cd: 1.5 },
  mummypriest: { name: '木乃伊祭司', spr: 'mummypriest', fam: 'mummy', hp: 1.3, atk: 1.1, def: 0.8, spd: 18, cd: 1.8, rng: 95, shot: 'curse', heal: 0.1, elem: 'chaos' },
  ratscout: { name: '鼠人斥候', spr: 'rat', fam: 'rat', hp: 0.8, atk: 1.1, def: 0.5, spd: 50, cd: 0.9 },
  ratbomber: { name: '鼠人掷弹兵', spr: 'ratbomber', fam: 'rat', hp: 0.9, atk: 1.4, def: 0.5, spd: 28, cd: 2, rng: 105, shot: 'bomb', elem: 'fire', aoe: 1 },
  scarab: { name: '圣甲虫', spr: 'scarab', fam: 'insect', hp: 0.5, atk: 0.8, def: 1.2, spd: 54, cd: 0.9 },
  cactus: { name: '仙人掌怪', spr: 'cactus', fam: 'plant', hp: 1.4, atk: 0.9, def: 1.2, spd: 20, cd: 1.8, rng: 80, shot: 'needle' },
  wolf: { name: '雪狼', spr: 'wolf', fam: 'wolf', hp: 1, atk: 1.3, def: 0.6, spd: 56, cd: 1, w: 28 },
  frostslime: { name: '冰史莱姆', spr: 'slime', pal: 'ice', fam: 'slime', hp: 1.2, atk: 0.9, def: 0.8, spd: 22, cd: 1.3, hop: 1, elem: 'cold' },
  yeti: { name: '雪人', spr: 'yeti', fam: 'beast', hp: 2.2, atk: 1.3, def: 1, spd: 18, cd: 1.6, w: 26 },
  icewisp: { name: '冰晶精灵', spr: 'wisp', fam: 'frost', hp: 0.6, atk: 1.2, def: 0.2, spd: 34, cd: 1.4, rng: 90, fly: 24, shot: 'wispfire', elem: 'cold' },
  iceskel: { name: '冰霜骷髅', spr: 'skeleton', pal: 'ice', fam: 'skeleton', hp: 1.2, atk: 1.2, def: 1.2, spd: 26, cd: 1.3, elem: 'cold' },
  penguin: { name: '企鹅掷手', spr: 'penguin', fam: 'penguin', hp: 0.9, atk: 1, def: 0.6, spd: 24, cd: 1.6, rng: 95, shot: 'snowball', elem: 'cold' },
  icebear: { name: '冰原熊', spr: 'bear', fam: 'beast', hp: 3.2, atk: 1.5, def: 1.4, spd: 16, cd: 1.9, w: 28 },
  ghost: { name: '幽灵', spr: 'ghost', fam: 'ghost', hp: 0.9, atk: 1.2, def: 0.2, spd: 30, cd: 1.2, fly: 14, elem: 'chaos' },
  zombie: { name: '沼泽僵尸', spr: 'zombie', fam: 'undead', hp: 2, atk: 1, def: 0.6, spd: 14, cd: 1.6 },
  wisp: { name: '鬼火', spr: 'wisp', pal: 'marsh', fam: 'ghost', hp: 0.5, atk: 1.2, def: 0.1, spd: 34, cd: 1.4, rng: 90, fly: 24, shot: 'wispfire', elem: 'chaos' },
  ghoul: { name: '食尸鬼', spr: 'ghoul', fam: 'undead', hp: 1.1, atk: 1.3, def: 0.5, spd: 50, cd: 0.9 },
  skelwar: { name: '骷髅战士', spr: 'skeleton', pal: 'war', fam: 'skeleton', hp: 1.5, atk: 1.2, def: 1.4, spd: 24, cd: 1.3, block: 0.2 },
  skelarcher: { name: '骷髅弓手', spr: 'skelarcher', fam: 'skeleton', hp: 0.9, atk: 1.2, def: 0.8, spd: 24, cd: 1.6, rng: 110, shot: 'arrow' },
  frogman: { name: '沼泽蛙人', spr: 'frogman', fam: 'frog', hp: 1.3, atk: 1.2, def: 0.8, spd: 34, cd: 1.2, hop: 1 },
  vampbat: { name: '吸血蝠', spr: 'bat', pal: 'vamp', fam: 'bat', hp: 0.8, atk: 1.2, def: 0.3, spd: 52, cd: 1, fly: 28, drain: 0.5 },
  golem: { name: '晶石魔像', spr: 'golem', fam: 'golem', hp: 2.4, atk: 1.2, def: 2, spd: 14, cd: 1.7, w: 26 },
  cavebat: { name: '洞穴蝙蝠', spr: 'bat', pal: 'cave', fam: 'bat', hp: 0.6, atk: 1.1, def: 0.2, spd: 54, cd: 1.1, fly: 30 },
  mole: { name: '鼹鼠矿工', spr: 'mole', fam: 'mole', hp: 1.1, atk: 1, def: 1, spd: 32, cd: 1.2 },
  minegob: { name: '矿坑哥布林', spr: 'minegob', fam: 'goblin', hp: 1.3, atk: 1.2, def: 1.1, spd: 32, cd: 1.2 },
  gembeetle: { name: '宝石甲虫', spr: 'scarab', pal: 'gem', fam: 'insect', hp: 0.8, atk: 0.9, def: 2, spd: 40, cd: 1.1, gold: 2 },
  crystalspider: { name: '晶蛛', spr: 'spiderling', pal: 'crystal', fam: 'spider', hp: 1, atk: 1.2, def: 1.2, spd: 46, cd: 1 },
  crystalwisp: { name: '晶灵', spr: 'wisp', pal: 'crystal', fam: 'crystal', hp: 0.7, atk: 1.3, def: 0.6, spd: 34, cd: 1.4, rng: 95, fly: 24, shot: 'shard', elem: 'lightning' },
  imp: { name: '火焰小鬼', spr: 'imp', fam: 'demon', hp: 0.8, atk: 1.1, def: 0.5, spd: 36, cd: 1.5, rng: 90, fly: 20, shot: 'fireball', elem: 'fire' },
  lavaslime: { name: '熔岩史莱姆', spr: 'slime', pal: 'lava', fam: 'slime', hp: 1.3, atk: 1.1, def: 0.9, spd: 22, cd: 1.3, hop: 1, elem: 'fire' },
  salamander: { name: '火蜥蜴', spr: 'salamander', fam: 'lizard', hp: 1.5, atk: 1.2, def: 1.2, spd: 26, cd: 1.3, elem: 'fire', w: 28 },
  hellhound: { name: '地狱犬', spr: 'wolf', pal: 'hell', fam: 'wolf', hp: 1.2, atk: 1.4, def: 0.7, spd: 60, cd: 0.9, elem: 'fire', w: 28 },
  firedemon: { name: '炎魔战士', spr: 'demon', fam: 'demon', hp: 2, atk: 1.5, def: 1.2, spd: 24, cd: 1.4, elem: 'fire', w: 24 },
  fireelem: { name: '火元素', spr: 'wisp', pal: 'fire', fam: 'flame', hp: 0.8, atk: 1.3, def: 0.4, spd: 32, cd: 1.3, rng: 95, fly: 22, shot: 'fireball', elem: 'fire' },
  lavaworm: { name: '熔岩蠕虫', spr: 'worm', fam: 'worm', hp: 2.4, atk: 1.3, def: 1.3, spd: 18, cd: 1.6, elem: 'fire', w: 26 },
  harpy: { name: '鹰身女妖', spr: 'harpy', fam: 'bird', hp: 1, atk: 1.2, def: 0.5, spd: 40, cd: 1.5, rng: 80, fly: 26, shot: 'feather' },
  hawk: { name: '风暴鹰', spr: 'hawk', fam: 'bird', hp: 0.7, atk: 1.3, def: 0.3, spd: 60, cd: 1, fly: 34 },
  cloudling: { name: '云精灵', spr: 'wisp', pal: 'cloud', fam: 'sky', hp: 0.8, atk: 1.1, def: 0.4, spd: 30, cd: 1.4, rng: 90, fly: 28, shot: 'spark', elem: 'lightning' },
  thunderbird: { name: '雷鸟', spr: 'hawk', pal: 'thunder', fam: 'bird', hp: 0.9, atk: 1.4, def: 0.4, spd: 58, cd: 1.1, fly: 32, elem: 'lightning' },
  gargoyle: { name: '石像鬼', spr: 'gargoyle', fam: 'gargoyle', hp: 2.4, atk: 1.3, def: 2, spd: 20, cd: 1.6, fly: 10, w: 24 },
  skyknight: { name: '天空骑士', spr: 'knight', fam: 'knight', hp: 2, atk: 1.4, def: 1.6, spd: 26, cd: 1.4, block: 0.25, w: 22 },
  windsprite: { name: '风灵', spr: 'wisp', pal: 'wind', fam: 'sky', hp: 0.6, atk: 1.2, def: 0.3, spd: 62, cd: 1, fly: 26 },
  demonling: { name: '深渊小魔', spr: 'imp', pal: 'abyss', fam: 'demon', hp: 0.9, atk: 1.3, def: 0.6, spd: 40, cd: 1.3, rng: 90, fly: 20, shot: 'voidbolt', elem: 'chaos' },
  darkknight: { name: '深渊骑士', spr: 'knight', pal: 'dark', fam: 'knight', hp: 2.6, atk: 1.6, def: 2, spd: 24, cd: 1.4, block: 0.3, w: 22 },
  shade: { name: '暗影', spr: 'ghost', pal: 'shade', fam: 'ghost', hp: 1.1, atk: 1.4, def: 0.3, spd: 38, cd: 1.1, fly: 16, elem: 'chaos' },
  eyebeast: { name: '眼魔', spr: 'eye', fam: 'eye', hp: 1.6, atk: 1.5, def: 0.8, spd: 22, cd: 2, rng: 120, fly: 30, shot: 'beam', w: 22, elem: 'chaos' },
  bonedrake: { name: '骨龙幼体', spr: 'drake', fam: 'drake', hp: 2.6, atk: 1.6, def: 1.4, spd: 30, cd: 1.5, fly: 18, w: 30, elem: 'fire' },
  abysshound: { name: '深渊犬', spr: 'wolf', pal: 'abyss', fam: 'wolf', hp: 1.3, atk: 1.5, def: 0.8, spd: 60, cd: 0.9, w: 28 },
  cultist: { name: '深渊术士', spr: 'cultist', fam: 'cult', hp: 1.2, atk: 1.5, def: 0.7, spd: 24, cd: 1.8, rng: 100, shot: 'voidbolt', heal: 0.08, elem: 'chaos' },
  voidslime: { name: '虚空史莱姆', spr: 'slime', pal: 'void', fam: 'slime', hp: 1.6, atk: 1.3, def: 1, spd: 24, cd: 1.3, hop: 1, split: 'voidslime', elem: 'chaos' },
};
for (const id in MONSTERS) { const m = MONSTERS[id]; m.id = id; m.gold ??= m.hp * 0.9 + 0.2; m.exp ??= m.hp * 0.8 + 0.3; m.rng ??= 0; m.elem ??= 'phys'; }

// ---------- bosses: six stage bosses (X-3, X-6) and three act bosses (X-10) ----------
const BOSSES = {
  slimeking: { name: '史莱姆王', title: '黏糊糊的暴君', spr: 'b_slimeking', fam: 'slime', hp: 1, atk: 1, def: 1, cd: 1.6, skills: ['slam', 'split'] },
  treant: { name: '腐根树妖', title: '吞林之根', spr: 'b_treant', fam: 'plant', hp: 1.3, atk: 0.9, def: 1.4, cd: 1.8, skills: ['roots', 'drain'] },
  witch: { name: '提灯女巫', title: '诅咒之地的引路人', spr: 'b_witch', fam: 'cult', hp: 1, atk: 1.2, def: 0.6, cd: 1.6, time: 60, skills: ['wisps', 'curse', 'slam'] },
  scorpking: { name: '沙暴蝎皇', title: '流沙之冠', spr: 'b_scorpking', fam: 'scorpion', hp: 1, atk: 1.3, def: 1.2, cd: 1.4, skills: ['venom', 'flurry'] },
  spider: { name: '晶背巨蛛', title: '矿脉深处的织网者', spr: 'b_spider', fam: 'spider', hp: 1.1, atk: 1.1, def: 1.6, cd: 1.4, skills: ['spike', 'web'] },
  griffin: { name: '雷鸣狮鹫', title: '浮岛之王', spr: 'b_griffin', fam: 'bird', hp: 1.2, atk: 1.4, def: 0.9, cd: 1.3, time: 60, skills: ['bolt', 'dive', 'howl'] },
  wolfking: { name: '霜牙狼王', title: '雪原的獠牙', spr: 'b_wolfking', fam: 'wolf', hp: 0.9, atk: 1.2, def: 0.8, cd: 0.9, skills: ['howl', 'pack'] },
  magmagolem: { name: '熔核魔像', title: '炉心未熄', spr: 'b_magma', fam: 'golem', hp: 1.4, atk: 1.1, def: 2, cd: 2, skills: ['erupt', 'harden'] },
  archon: { name: '深渊执政官', title: '王座上的无尽之夜', spr: 'b_archon', fam: 'demon', hp: 1.5, atk: 1.5, def: 1.4, cd: 1.5, time: 75, skills: ['rift', 'legion', 'darkbeam'] },
};
const BOSS_IDS = Object.keys(BOSSES);
// stage bosses that are not big bosses carry one aura
const AURAS = {
  rally: { name: '号令', text: '登场时召来 2 只同族随从' },
  swift: { name: '迅捷', text: '攻击与移动速度 +40%' },
  vigor: { name: '再生', text: '每秒回复 1% 生命' },
  arcane: { name: '奥能', text: '每 6 秒释放冲击，造成 2 倍攻击伤害' },
  stone: { name: '石肤', text: '防御 ×3，受到的伤害 -25%' },
  ward: { name: '守护', text: '随从存活时受到的伤害 -50%' },
  thorny: { name: '荆刺', text: '把受到伤害的 5% 反弹给前排' },
  fury: { name: '狂怒', text: '生命低于一半时攻击 +60%' },
  vampiric: { name: '嗜血', text: '攻击回复造成伤害的 3 倍生命' },
};
const ELITE = { hp: 5, atk: 1.6, gold: 5, exp: 5 };
const CHAMP = { hp: 12, atk: 1.7, gold: 12, exp: 12 };
const BOSS_MUL = { hp: 18, atk: 2, def: 1.4, gold: 25, exp: 25 };
const ACT_BOSS_MUL = { hp: 30, atk: 2.4, def: 1.6, gold: 60, exp: 60 };
const ELITE_CHANCE = 0.06;

// ---------- the world: 3 acts × 10 named stages ----------
const SCENE_MOTE = { meadow: 'firefly', grove: 'spore', marsh: 'wisp', desert: 'sand', cavern: 'shard', isles: 'cloud', tundra: 'snow', caldera: 'ember', abyss: 'ash' };
const SCENE_IDS = Object.keys(SCENE_MOTE);
const ACTS = [
  { name: '翠野与诅咒之地', stages: [
    ['牧羊草坡', 'meadow', ['slime', 'rabbit', 'wasp'], ['bigslime', '「黏糊」史莱姆长老', 'vigor']],
    ['风车麦田', 'meadow', ['slime', 'rabbit', 'gobthief', 'gobarcher'], ['gobbrute', '「独眼」哥布林头目', 'rally']],
    ['哥布林营地', 'meadow', ['gobthief', 'gobarcher', 'gobshaman', 'gobbrute', 'bigslime', 'wasp'], 'slimeking'],
    ['菌菇小径', 'grove', ['shroom', 'toxshroom', 'sporebat', 'sapling'], ['toxshroom', '「腐菇」菇王', 'arcane']],
    ['古树林荫', 'grove', ['sapling', 'forestspider', 'mossgob', 'fox', 'sporebat'], ['forestspider', '「织网者」林蛛母后', 'swift']],
    ['腐根深处', 'grove', ['shroom', 'toxshroom', 'forestspider', 'mossgob', 'fox', 'mosstroll'], 'treant'],
    ['雾沼渡口', 'marsh', ['frogman', 'zombie', 'wisp', 'vampbat'], ['frogman', '「腐沼」蛙人酋长', 'vigor']],
    ['骸骨墓园', 'marsh', ['skelwar', 'skelarcher', 'zombie', 'ghoul'], ['skelwar', '「无名」骷髅将军', 'ward']],
    ['诅咒之地', 'marsh', ['ghost', 'ghoul', 'vampbat', 'skelarcher', 'wisp', 'frogman'], ['vampbat', '「血翼」吸血蝠王', 'vampiric']],
    ['提灯小屋', 'marsh', [], 'witch'],
  ] },
  { name: '黄沙、晶窟与浮空岛', stages: [
    ['绿洲古道', 'desert', ['scorpion', 'cobra', 'scarab', 'cactus'], ['scorpion', '「金尾」沙蝎', 'thorny']],
    ['黄沙遗迹', 'desert', ['mummy', 'mummypriest', 'ratscout', 'ratbomber', 'scarab'], ['mummypriest', '「法老之手」大祭司', 'ward']],
    ['法老地宫', 'desert', ['mummy', 'mummypriest', 'scarab', 'cobra', 'ratbomber', 'ratscout'], 'scorpking'],
    ['晶窟入口', 'cavern', ['cavebat', 'mole', 'minegob', 'gembeetle'], ['minegob', '「金镐」矿坑工头', 'rally']],
    ['宝石虫巢', 'cavern', ['gembeetle', 'crystalspider', 'crystalwisp', 'cavebat', 'mole'], ['crystalwisp', '「棱光」晶灵', 'arcane']],
    ['晶脉深处', 'cavern', ['golem', 'crystalspider', 'crystalwisp', 'mole', 'minegob'], 'spider'],
    ['云端栈道', 'isles', ['harpy', 'hawk', 'cloudling', 'windsprite'], ['thunderbird', '「风暴之眼」雷鸟', 'swift']],
    ['雷霆浮岛', 'isles', ['thunderbird', 'cloudling', 'gargoyle', 'hawk'], ['gargoyle', '「守望」石像鬼', 'stone']],
    ['天穹骑士堡', 'isles', ['skyknight', 'gargoyle', 'harpy', 'thunderbird', 'windsprite'], ['skyknight', '「白翼」骑士团长', 'ward']],
    ['狮鹫之巢', 'isles', [], 'griffin'],
  ] },
  { name: '冰原、熔狱与深渊', stages: [
    ['雪原前哨', 'tundra', ['wolf', 'frostslime', 'penguin', 'icewisp'], ['wolf', '「白牙」雪狼首领', 'rally']],
    ['冰封战场', 'tundra', ['iceskel', 'yeti', 'icewisp', 'wolf', 'penguin'], ['iceskel', '「冰冠」骷髅王', 'arcane']],
    ['霜牙冰窟', 'tundra', ['icebear', 'yeti', 'iceskel', 'frostslime', 'penguin', 'wolf'], 'wolfking'],
    ['地狱之门', 'caldera', ['imp', 'lavaslime', 'salamander', 'hellhound'], ['hellhound', '「熔蹄」地狱犬王', 'swift']],
    ['燃烧峡谷', 'caldera', ['firedemon', 'fireelem', 'lavaworm', 'imp', 'salamander'], ['fireelem', '「灼心」火元素', 'thorny']],
    ['熔核炉心', 'caldera', ['firedemon', 'fireelem', 'lavaworm', 'hellhound', 'lavaslime', 'imp'], 'magmagolem'],
    ['苦难平原', 'abyss', ['demonling', 'abysshound', 'shade', 'voidslime'], ['eyebeast', '「凝视」眼魔长老', 'arcane']],
    ['废墟堡垒', 'abyss', ['darkknight', 'cultist', 'shade', 'demonling', 'abysshound'], ['darkknight', '「誓约」深渊统领', 'fury']],
    ['深渊之核', 'abyss', ['bonedrake', 'eyebeast', 'cultist', 'darkknight', 'voidslime', 'shade'], ['bonedrake', '「灰烬」骨龙', 'vampiric']],
    ['王座指挥厅', 'abyss', [], 'archon'],
  ] },
];
// expand into stage records: STAGE_DEFS[a-1][s-1]
const STAGE_DEFS = ACTS.map((A, ai) => A.stages.map(([name, scene, mobs, boss], si) => {
  const s = si + 1, def = { a: ai + 1, s, name, scene, mobs };
  if (typeof boss === 'string') def.boss = { kind: s === STAGES ? 'act' : 'boss', id: boss };
  else def.boss = { kind: 'champ', mob: boss[0], name: boss[1], aura: boss[2], key: `${ai + 1}-${s}` };
  return def;
}));
const stageDef = (a, s) => STAGE_DEFS[a - 1][s - 1];
const stageName = (d, a, s) => `${DIFFS[d].name} ${a}-${s} ${stageDef(a, s).name}`;

// ---------- monster curve ----------
// monsters outgrow item levels a little every level, so deeper stages ask for better grades, sockets and runes;
// the ramp per level eases off band by band (普通 up to 32, 噩梦 52, 地狱 77, then 折磨)
const RAMP_HP = [1.075, 1.065, 1.06, 1.055], RAMP_ATK = [1.03, 1.025, 1.02, 1.02];
const rampTable = steps => { const out = [1, 1]; for (let L = 2; L <= 100; L++) out[L] = out[L - 1] * steps[L <= 32 ? 0 : L <= 52 ? 1 : L <= 77 ? 2 : 3]; return out; };
const RAMP_HP_T = rampTable(RAMP_HP), RAMP_ATK_T = rampTable(RAMP_ATK);
const lvIdx = L => clamp(Math.round(L), 1, 100);
const CURVE = {
  hp: L => 40 * SC(L) * RAMP_HP_T[lvIdx(L)], atk: L => 10 * SC(L) * RAMP_ATK_T[lvIdx(L)], def: L => 4 * SC(L),
  gold: L => 3 * SC(L), exp: L => 4 * SC(L) * Math.pow(1.03, L - 1),
};

// ---------- heroes: six classes (TBH base stats ×6 attack, ×1.25 life) ----------
const HERO_MAX_LEVEL = 100;
const CLASSES = {
  knight: { name: '骑士', hero: '葛雷', sex: 'm', role: '坦克 · 前排', weapon: 'sword', off: 'shield', melee: 1, reach: 34, atk: 2, aspd: 0.9, crit: 0.025, cdmg: 1.4, hp: 130, arm: 45, move: 950, elem: 'phys', line: '铁壁一般的老兵，盾牌上刻满旧伤', unlock: 'start' },
  ranger: { name: '游侠', hero: '希娅', sex: 'f', role: '远程物理输出', weapon: 'bow', off: 'arrow', reach: 165, atk: 1, aspd: 1, crit: 0.04, cdmg: 1.5, hp: 60, arm: 8, move: 850, elem: 'phys', shot: 'arrow', speed: 380, line: '笑起来比赏金还亮', unlock: 'start' },
  sorcerer: { name: '法师', hero: '伊薇', sex: 'f', role: '元素范围输出', weapon: 'staff', off: 'orb', reach: 150, atk: 2, aspd: 0.55, crit: 0.05, cdmg: 1.65, hp: 50, arm: 5, move: 770, elem: 'fire', shot: 'magic', speed: 300, line: '星辰落进她的帽檐', unlock: 'start' },
  priest: { name: '牧师', hero: '茉莉', sex: 'f', role: '治疗 · 增益', weapon: 'scepter', off: 'tome', melee: 1, reach: 38, atk: 1, aspd: 0.9, crit: 0.02, cdmg: 1.4, hp: 95, arm: 30, move: 700, elem: 'phys', line: '温柔的祷词，沉重的权杖', unlock: 'start' },
  hunter: { name: '猎手', hero: '洛恩', sex: 'm', role: '陷阱 · 远程输出', weapon: 'crossbow', off: 'bolt', reach: 175, atk: 2, aspd: 0.7, crit: 0.045, cdmg: 1.55, hp: 70, arm: 15, move: 750, elem: 'phys', shot: 'bolt', speed: 460, line: '宽檐帽下目光如刀', unlock: [0, 1, 10] },
  slayer: { name: '屠戮者', hero: '布兰', sex: 'm', role: '近战爆发 · 吸血', weapon: 'axe', off: 'hatchet', melee: 1, reach: 34, atk: 2, aspd: 0.7, crit: 0.025, cdmg: 1.8, hp: 115, arm: 40, move: 850, elem: 'phys', line: '以血换血的双斧狂战士', unlock: [0, 2, 10] },
};
const CLASS_IDS = Object.keys(CLASSES);
// the first hero is one of three (TBH); the priest joins for free once a second slot opens
const STARTERS = ['knight', 'ranger', 'sorcerer'];
// a wave that drags on this long counts as a failed attempt (seconds; the stage boss wave gets longer)
const WAVE_LIMIT = 150, STAGE_BOSS_LIMIT = 120;
const PARTY_MAX = 3, DEPLOY_COOLDOWN = 60;
const ASPD_CAP = 4, CRIT_CAP = 0.8, DODGE_CAP = 0.4, BLOCK_CAP = 0.6, CDR_CAP = 0.6;
// portrait / sprite look per class
const LOOK = { knight: 'gray', ranger: 'sia', sorcerer: 'ivy', priest: 'molly', hunter: 'loen', slayer: 'bran' };
// hunter experience; heroes six or more levels above the area earn less (TBH)
const expNeed = L => Math.round(80 * Math.pow(1.25, L - 1));
const expPenalty = (hlv, area) => (hlv >= area + 10 ? 0.2 : hlv >= area + 6 ? 0.5 : 1);

// ---------- skills: 6 actives + 18 passives per class, 9 tiers ----------
// tier t opens once 10·t points are spent in the tiers below (TBH); 1 point per level
// type: cd (cooldown) · ac (every N attacks) · cont (aura while equipped)
const lv = (a, l) => a[0] + a[1] * (l - 1);
const ACTIVES = {
  // 骑士
  k_thrust: { cls: 'knight', tier: 0, name: '穿刺突击', icon: 's_cleave', type: 'ac', every: 4, mul: [1.6, 0.15], desc: l => `每 4 次攻击，向前突刺，贯穿前方所有敌人，造成 ${pct(lv([1.6, 0.15], l))} 伤害` },
  k_charge: { cls: 'knight', tier: 0, name: '盾牌冲锋', icon: 's_bash', type: 'cd', cd: 8, mul: [2, 0.2], desc: l => `举盾冲锋，对 70 像素内敌人造成 ${pct(lv([2, 0.2], l))} 伤害并眩晕 1 秒` },
  k_retri: { cls: 'knight', tier: 1, name: '惩戒打击', icon: 's_execute', type: 'ac', every: 5, mul: [0.8, 0.08], desc: l => `每 5 次攻击，连斩 3 次，每少 25% 生命多斩 1 次，每次 ${pct(lv([0.8, 0.08], l))}` },
  k_aegis: { cls: 'knight', tier: 2, name: '圣盾领域', icon: 's_bastion', type: 'cd', cd: 15, v: [0.12, 0.015], dur: 8, desc: l => `为全队套上 ${pct(lv([0.12, 0.015], l))} 骑士最大生命的护盾，持续 8 秒` },
  k_blade: { cls: 'knight', tier: 3, name: '圣剑', icon: 's_smite', type: 'cd', cd: 20, v: [0.5, 0.03], dur: 8, desc: l => `8 秒内攻击 +${pct(lv([0.5, 0.03], l))}，每次命中回复 1% 生命` },
  k_will: { cls: 'knight', tier: 4, name: '不屈意志', icon: 's_warcry', type: 'once', v: [0.3, 0.05], desc: l => `每关一次：受到致命伤害时站起来，回复 ${pct(lv([0.3, 0.05], l))} 生命` },
  // 游侠
  r_rapid: { cls: 'ranger', tier: 0, name: '连射', icon: 's_rapid', type: 'ac', every: 3, mul: [0.5, 0.05], desc: l => `每 3 次攻击，连续再射 3 箭，每箭 ${pct(lv([0.5, 0.05], l))}` },
  r_scatter: { cls: 'ranger', tier: 0, name: '散射', icon: 's_flurry', type: 'cd', cd: 6, mul: [1.2, 0.1], desc: l => `向最多 5 个敌人各射出一支追踪箭，造成 ${pct(lv([1.2, 0.1], l))} 伤害` },
  r_rain: { cls: 'ranger', tier: 1, name: '箭雨', icon: 's_arrowrain', type: 'cd', cd: 10, mul: [0.4, 0.04], desc: l => `2.5 秒箭雨覆盖 100 像素，共 10 次，每次 ${pct(lv([0.4, 0.04], l))}` },
  r_swift: { cls: 'ranger', tier: 2, name: '疾风', icon: 's_gale', type: 'cd', cd: 15, v: [0.5, 0.03], dur: 6, desc: l => `6 秒内攻速 +${pct(lv([0.5, 0.03], l))}` },
  r_pierce: { cls: 'ranger', tier: 3, name: '穿透箭', icon: 's_pierceshot', type: 'ac', every: 4, mul: [2, 0.2], desc: l => `每 4 次攻击，射出贯穿所有敌人的一箭，造成 ${pct(lv([2, 0.2], l))} 伤害` },
  r_skewer: { cls: 'ranger', tier: 4, name: '钉刺射击', icon: 's_snipe', type: 'ac', every: 3, mul: [1, 0.1], desc: l => `每 3 次攻击，钉一支箭在目标身上（${pct(lv([1, 0.1], l))}）；每支钉箭使游侠对它的伤害 +10%，3 支起流血` },
  // 法师
  s_fireball: { cls: 'sorcerer', tier: 0, name: '火球术', icon: 's_fireball', type: 'cd', cd: 4, mul: [2.2, 0.2], elem: 'fire', desc: l => `爆炸的火球，对 40 像素内敌人造成 ${pct(lv([2.2, 0.2], l))} 火焰伤害并点燃` },
  s_iceorb: { cls: 'sorcerer', tier: 0, name: '寒冰球', icon: 's_frostnova', type: 'cd', cd: 7, mul: [0.6, 0.06], elem: 'cold', desc: l => `缓缓滚动的冰球，命中 5 次，每次 ${pct(lv([0.6, 0.06], l))} 冰霜伤害并冰缓` },
  s_lightning: { cls: 'sorcerer', tier: 1, name: '闪电', icon: 's_thunder', type: 'cd', cd: 6, mul: [2.6, 0.24], elem: 'lightning', desc: l => `向前方释放闪电，贯穿一条线上的敌人，造成 ${pct(lv([2.6, 0.24], l))} 闪电伤害并感电` },
  s_hydra: { cls: 'sorcerer', tier: 2, name: '火焰九头蛇', icon: 's_hydra', type: 'cd', cd: 16, mul: [0.7, 0.06], elem: 'fire', desc: l => `召唤九头蛇 8 秒，每秒喷 2 发火球，各 ${pct(lv([0.7, 0.06], l))}` },
  s_storm: { cls: 'sorcerer', tier: 3, name: '暴风雪', icon: 's_storm', type: 'cd', cd: 12, mul: [0.9, 0.08], elem: 'cold', desc: l => `5 秒暴风雪，每秒对 120 像素内敌人造成 ${pct(lv([0.9, 0.08], l))} 冰霜伤害并冰缓` },
  s_meteor: { cls: 'sorcerer', tier: 4, name: '陨石术', icon: 's_meteor', type: 'cd', cd: 14, mul: [5, 0.45], elem: 'fire', desc: l => `陨石砸落，对 70 像素内敌人造成 ${pct(lv([5, 0.45], l))} 火焰伤害并点燃` },
  // 牧师
  p_heal: { cls: 'priest', tier: 0, name: '治疗术', icon: 's_regen', type: 'cd', cd: 6, v: [0.15, 0.015], desc: l => `为生命比例最低的队友回复 ${pct(lv([0.15, 0.015], l))} 最大生命` },
  p_might: { cls: 'priest', tier: 0, name: '力量祝福', icon: 's_aura', type: 'cont', v: [0.1, 0.02], desc: l => `装备时全队攻击 +${pct(lv([0.1, 0.02], l))}` },
  p_wrath: { cls: 'priest', tier: 1, name: '天罚', icon: 's_thunder', type: 'cd', cd: 15, mul: [0.6, 0.06], dur: 6, elem: 'lightning', desc: l => `6 秒内牧师每次攻击都在落点降下闪电，对 60 像素内敌人造成 ${pct(lv([0.6, 0.06], l))}` },
  p_sanct: { cls: 'priest', tier: 2, name: '圣域', icon: 's_nova', type: 'cd', cd: 18, v: [0.03, 0.003], dur: 6, desc: l => `6 秒圣域，全队每秒回复 ${pct(lv([0.03, 0.003], l), 1)} 生命` },
  p_ward: { cls: 'priest', tier: 3, name: '守护祝福', icon: 's_bastion', type: 'cont', v: [0.1, 0.02], desc: l => `装备时全队全元素抗性 +${pct(lv([0.1, 0.02], l))}` },
  p_rez: { cls: 'priest', tier: 4, name: '复活术', icon: 's_prayer', type: 'cd', cd: 30, v: [0.4, 0.05], desc: l => `复活一名倒下的队友，回复 ${pct(lv([0.4, 0.05], l))} 生命` },
  // 猎手
  h_blast: { cls: 'hunter', tier: 0, name: '爆裂弩箭', icon: 's_meteor', type: 'ac', every: 3, mul: [1.2, 0.12], elem: 'fire', desc: l => `每 3 次攻击，弩箭命中后爆炸，对 40 像素内敌人造成 ${pct(lv([1.2, 0.12], l))} 火焰伤害` },
  h_frost: { cls: 'hunter', tier: 0, name: '冰霜弩箭', icon: 's_frostnova', type: 'cd', cd: 8, mul: [1.8, 0.16], elem: 'cold', desc: l => `冰霜弩箭爆开，对 50 像素内敌人造成 ${pct(lv([1.8, 0.16], l))} 冰霜伤害并冰冻 1.5 秒` },
  h_quick: { cls: 'hunter', tier: 1, name: '快速装填', icon: 's_repeater', type: 'cd', cd: 15, v: [8, 1], desc: l => `接下来 ${lv([8, 1], l)} 次攻击攻速 +50%` },
  h_trap: { cls: 'hunter', tier: 2, name: '充能陷阱', icon: 's_snare', type: 'cd', cd: 10, mul: [2.5, 0.22], elem: 'lightning', desc: l => `布下 2 个陷阱，敌人踩中时爆炸，造成 ${pct(lv([2.5, 0.22], l))} 闪电伤害` },
  h_turret: { cls: 'hunter', tier: 3, name: '弩炮塔', icon: 's_ap', type: 'cd', cd: 20, mul: [0.6, 0.05], desc: l => `架起弩炮塔 10 秒，每秒射 2 发，各 ${pct(lv([0.6, 0.05], l))}` },
  h_shock: { cls: 'hunter', tier: 4, name: '电击弩箭', icon: 's_thunder', type: 'ac', every: 4, mul: [1, 0.1], elem: 'lightning', desc: l => `每 4 次攻击，弩箭钉在敌人身上，电击附近 3 个敌人，各 ${pct(lv([1, 0.1], l))} 并感电` },
  // 屠戮者
  y_jump: { cls: 'slayer', tier: 0, name: '跃击', icon: 's_crush', type: 'cd', cd: 8, mul: [2.4, 0.22], desc: l => `跃起砸地，对 50 像素内敌人造成 ${pct(lv([2.4, 0.22], l))}；击杀目标时引发 350% 冲击波` },
  y_crush: { cls: 'slayer', tier: 0, name: '粉碎打击', icon: 's_cleaver', type: 'ac', every: 4, mul: [2, 0.18], desc: l => `每 4 次攻击，重击前方目标，造成 ${pct(lv([2, 0.18], l))} 伤害` },
  y_cry: { cls: 'slayer', tier: 1, name: '统帅怒吼', icon: 's_warcry', type: 'cd', cd: 15, v: [0.3, 0.03], dur: 8, desc: l => `眩晕附近敌人 1.5 秒，8 秒内全队暴击伤害 +${pct(lv([0.3, 0.03], l))}` },
  y_quake: { cls: 'slayer', tier: 2, name: '大地猛击', icon: 's_bash', type: 'ac', every: 5, mul: [1.5, 0.14], desc: l => `每 5 次攻击，震裂地面，对 90 像素内敌人造成 ${pct(lv([1.5, 0.14], l))}` },
  y_spin: { cls: 'slayer', tier: 3, name: '旋风斧', icon: 's_whirl', type: 'cd', cd: 12, mul: [0.35, 0.03], desc: l => `旋转 3 秒，每 0.25 秒对 60 像素内敌人造成 ${pct(lv([0.35, 0.03], l))} 并使其流血` },
  y_blood: { cls: 'slayer', tier: 4, name: '嗜血', icon: 's_rage', type: 'cd', cd: 20, v: [0.6, 0.04], dur: 8, desc: l => `付出当前一半生命，8 秒内攻击 +${pct(lv([0.6, 0.04], l))}` },
};
for (const id in ACTIVES) { const k = ACTIVES[id]; k.id = id; k.max = 10; k.active = true; k.elem ??= null; }
// passives: [tier, stat, value per level, max level]
const PASSIVE_ROWS = {
  knight: [[0, 'atkPct', 0.04, 5], [0, 'hpPct', 0.03, 8], [1, 'armPct', 0.04, 8], [1, 'regen', 0.002, 5], [2, 'hpKill', 0.003, 10], [2, 'block', 0.015, 10], [3, 'phys', 0.05, 10], [3, 'hpPct', 0.04, 10], [4, 'cdr', 0.015, 10], [4, 'regen', 0.002, 10], [5, 'hpKill', 0.005, 10], [5, 'block', 0.015, 10], [6, 'aspd', 0.02, 10], [6, 'allRes', 0.025, 10], [7, 'dr', 0.01, 10], [7, 'atkPct', 0.03, 10], [8, 'aoe', 0.04, 10], [8, 'aoeDmg', 0.04, 10]],
  ranger: [[0, 'atkPct', 0.04, 5], [0, 'aspd', 0.02, 8], [1, 'crit', 0.01, 8], [1, 'cdmg', 0.06, 5], [2, 'dodge', 0.015, 10], [2, 'proj', 0.05, 10], [3, 'dodge', 0.015, 10], [3, 'aspd', 0.025, 10], [4, 'dodge', 0.015, 10], [4, 'move', 0.02, 10], [5, 'dodge', 0.015, 10], [5, 'ls', 0.0025, 10], [6, 'aoeDmg', 0.05, 10], [6, 'proj', 0.05, 10], [7, 'dodge', 0.015, 10], [7, 'aspd', 0.03, 10], [8, 'dodgeCap', 0.01, 10], [8, 'move', 0.02, 10]],
  sorcerer: [[0, 'atkPct', 0.05, 5], [0, 'cdr', 0.01, 8], [1, 'aoe', 0.03, 8], [1, 'crit', 0.01, 5], [2, 'fire', 0.05, 10], [2, 'cold', 0.05, 10], [3, 'lightning', 0.05, 10], [3, 'hpPct', 0.02, 10], [4, 'cdr', 0.02, 10], [4, 'atkPct', 0.04, 10], [5, 'cast', 0.03, 10], [5, 'cdmg', 0.08, 10], [6, 'allRes', 0.02, 10], [6, 'aoe', 0.03, 10], [7, 'crit', 0.01, 10], [7, 'cdr', 0.02, 10], [8, 'atkPct', 0.05, 10], [8, 'cast', 0.03, 10]],
  priest: [[0, 'atkPct', 0.04, 5], [0, 'hpPct', 0.03, 8], [1, 'armPct', 0.04, 8], [1, 'absorb', 0.003, 5], [2, 'cdr', 0.02, 10], [2, 'heal', 0.05, 10], [3, 'hpPct', 0.03, 10], [3, 'absorb', 0.003, 10], [4, 'cast', 0.03, 10], [4, 'block', 0.015, 10], [5, 'phys', 0.05, 10], [5, 'allRes', 0.02, 10], [6, 'cdr', 0.02, 10], [6, 'armPct', 0.08, 10], [7, 'aoe', 0.03, 10], [7, 'cast', 0.03, 10], [8, 'hpPct', 0.04, 10], [8, 'heal', 0.05, 10]],
  hunter: [[0, 'atkPct', 0.05, 5], [0, 'crit', 0.01, 8], [1, 'cdmg', 0.05, 8], [1, 'dodge', 0.015, 5], [2, 'fire', 0.06, 10], [2, 'cold', 0.06, 10], [3, 'cdr', 0.01, 10], [3, 'hpPct', 0.03, 10], [4, 'phys', 0.05, 10], [4, 'crit', 0.01, 10], [5, 'atkPct', 0.05, 10], [5, 'aoe', 0.03, 10], [6, 'lightning', 0.06, 10], [6, 'cdmg', 0.06, 10], [7, 'aspd', 0.02, 10], [7, 'hpHit', 0.0005, 10], [8, 'crit', 0.015, 10], [8, 'cdmg', 0.06, 10]],
  slayer: [[0, 'atkPct', 0.05, 5], [0, 'hpPct', 0.03, 8], [1, 'aoe', 0.03, 8], [1, 'hpKill', 0.005, 5], [2, 'phys', 0.05, 10], [2, 'ls', 0.0025, 10], [3, 'atkPct', 0.04, 10], [3, 'hpPct', 0.03, 10], [4, 'cdmg', 0.06, 10], [4, 'phys', 0.05, 10], [5, 'aoeDmg', 0.05, 10], [5, 'aoe', 0.03, 10], [6, 'hpPct', 0.04, 10], [6, 'move', 0.02, 10], [7, 'aoeDmg', 0.05, 10], [7, 'dur', 0.05, 10], [8, 'phys', 0.05, 10], [8, 'aoe', 0.03, 10]],
};
const PASSIVES = {};
for (const cls in PASSIVE_ROWS) PASSIVE_ROWS[cls].forEach(([tier, stat, per, max], i) => { const id = `${cls}_p${i}`; PASSIVES[id] = { id, cls, tier, stat, per, max }; });
const SKILLS = { ...ACTIVES, ...PASSIVES };
const SKILL_IDS = Object.keys(SKILLS);
const TIER_COUNT = 9, TIER_STEP = 10;
const skillTree = cls => SKILL_IDS.filter(id => SKILLS[id].cls === cls);
const ACTIVE_SLOTS_BASE = 1;
// the auto plan slots actives in this order once they are learned
const AUTO_ACTIVE = {
  knight: ['k_blade', 'k_aegis', 'k_thrust', 'k_charge', 'k_retri', 'k_will'],
  ranger: ['r_rain', 'r_pierce', 'r_rapid', 'r_scatter', 'r_swift', 'r_skewer'],
  sorcerer: ['s_meteor', 's_storm', 's_fireball', 's_lightning', 's_hydra', 's_iceorb'],
  priest: ['p_heal', 'p_might', 'p_sanct', 'p_ward', 'p_wrath', 'p_rez'],
  hunter: ['h_turret', 'h_trap', 'h_blast', 'h_frost', 'h_shock', 'h_quick'],
  slayer: ['y_spin', 'y_jump', 'y_crush', 'y_quake', 'y_cry', 'y_blood'],
};
const PASSIVE_ICON = {
  atkPct: 'i_atk', hpPct: 'i_hp', armPct: 'i_arm', regen: 'i_regen', hpKill: 's_soul', hpHit: 's_regen', block: 's_bastion', phys: 's_cleave',
  fire: 's_fireball', cold: 's_frostnova', lightning: 's_thunder', chaos: 's_elem', cdr: 's_surge', aspd: 'i_spd', allRes: 's_aura', dr: 's_riposte',
  aoe: 's_nova', aoeDmg: 's_crush', crit: 'i_crit', cdmg: 'i_cdmg', dodge: 's_gale', proj: 's_pierceshot', move: 'i_spd', ls: 'i_ls',
  dodgeCap: 's_hawkeye', cast: 's_elem', absorb: 's_bastion', heal: 's_prayer', dur: 's_storm',
};
const PASSIVE_NAME = {
  atkPct: '攻击强化', hpPct: '体魄', armPct: '坚甲', regen: '再生', hpKill: '战意', hpHit: '汲取', block: '格挡', phys: '物理精通',
  fire: '火焰精通', cold: '冰霜精通', lightning: '闪电精通', chaos: '混沌精通', cdr: '专注', aspd: '迅捷', allRes: '元素抗性', dr: '坚韧',
  aoe: '扩散', aoeDmg: '范围精通', crit: '精准', cdmg: '致命', dodge: '闪避', proj: '投射精通', move: '轻足', ls: '吸血',
  dodgeCap: '幻影', cast: '咏唱', absorb: '吸收', heal: '治愈', dur: '持久',
};

// ---------- equipment (TBH: 20 types, 10 slots per hero) ----------
const SLOTS = ['weapon', 'offhand', 'helm', 'armor', 'gloves', 'boots', 'amulet', 'earring', 'ring', 'bracer'];
const SLOT_NAME = { weapon: '武器', offhand: '副手', helm: '头盔', armor: '护甲', gloves: '手套', boots: '靴子', amulet: '项链', earring: '耳环', ring: '戒指', bracer: '护腕' };
const ILVL_TIERS = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 100];
const ACC_TIERS = ILVL_TIERS.slice(0, 19);
const isAcc = slot => slot === 'amulet' || slot === 'earring' || slot === 'ring' || slot === 'bracer';
const tiersFor = type => (isAcc(TYPES[type].slot) ? ACC_TIERS : ILVL_TIERS);
const tierOf = (ilvl, tiers = ILVL_TIERS) => { let t = 0; for (let i = 0; i < tiers.length; i++) if (ilvl >= tiers[i]) t = i; return t; };
const tierFloor = L => ILVL_TIERS[tierOf(L)];
const MATERIAL_GROUP = t => Math.min(6, Math.floor(t / 3));

const N = s => s.split(' ');
// drop the old 95 name (20 tiers) or keep the first 19 (accessories end at 90)
const T20 = s => { const a = N(s); a.splice(19, 1); return a; };
const T19 = s => N(s).slice(0, 19);
const TYPES = {
  sword: { slot: 'weapon', cls: 'knight', name: '剑', icon: 'w_sword', main: { atk: 9 }, imp: { crit: 0.05 }, impText: '暴击率 +5%',
    names: T20('短剑 弯刀 细剑 阔剑 巨剑 重刃 骑士剑 统帅之剑 符文剑 传说之剑 命运之剑 英雄之剑 风暴之剑 复仇之剑 虚空之刃 水晶之刃 次元之剑 暗影之刃 永恒之剑 光辉之剑 创世之剑') },
  bow: { slot: 'weapon', cls: 'ranger', name: '弓', icon: 'w_bow', main: { atk: 7 }, imp: { aspd: 0.1 }, impText: '攻速 +10%',
    names: T20('短弓 猎弓 长弓 复合弓 战弓 绯红弓 暮光弓 翡翠弓 精英弓 符文弓 秘法弓 迅捷弓 远古弓 无尽之弓 混沌之弓 风暴之弓 暗影之弓 狂风之弓 永恒之弓 光辉之弓 创世之弓') },
  staff: { slot: 'weapon', cls: 'sorcerer', name: '法杖', icon: 'w_staff', main: { atk: 10 }, imp: { aoe: 0.15, skill: 0.1 }, impText: '范围 +15%，技能伤害 +10%',
    names: T20('木杖 先驱法杖 长杖 女巫法杖 蔚蓝法杖 长老法杖 贤者法杖 秘法杖 彗星法杖 水晶法杖 虚空法杖 征服者法杖 远古法杖 神圣法杖 深渊法杖 混沌法杖 狂风法杖 新星法杖 永恒法杖 光辉法杖 创世法杖') },
  scepter: { slot: 'weapon', cls: 'priest', name: '权杖', icon: 'w_scepter', main: { atk: 8.5 }, imp: { heal: 0.15 }, impText: '治疗效果 +15%',
    names: T20('见习权杖 铁权杖 祝福权杖 钢权杖 神圣权杖 主教权杖 虔诚权杖 重权杖 符文权杖 传说权杖 命运权杖 英雄权杖 风暴权杖 无尽权杖 混沌权杖 力量权杖 次元权杖 暗影权杖 永恒权杖 光辉权杖 创世权杖') },
  crossbow: { slot: 'weapon', cls: 'hunter', name: '弩', icon: 'w_crossbow', main: { atk: 13 }, imp: { crit: 0.08 }, impText: '暴击率 +8%',
    names: T20('短弩 皮弦弩 长弩 完备弩 精工弩 强化弩 铁弩 翼弩 精英弩 巨弩 秘法弩 迅捷弩 远古弩 无尽之弩 混沌之弩 力量之弩 次元之弩 暗影之弩 永恒之弩 光辉之弩 创世之弩') },
  axe: { slot: 'weapon', cls: 'slayer', name: '斧', icon: 'w_axe', main: { atk: 11 }, imp: { aoeDmg: 0.15 }, impText: '范围伤害 +15%',
    names: T20('木斧 铁斧 战斧 钢斧 征战斧 骑士斧 巨斧 重斧 符文斧 传说之斧 命运之斧 英雄之斧 风暴之斧 无尽之斧 混沌之斧 力量之斧 次元之斧 暗影之斧 永恒之斧 光辉之斧 创世之斧') },
  shield: { slot: 'offhand', cls: 'knight', name: '盾', icon: 'o_shield', main: { arm: 2, hp: 15 }, imp: { block: 0.12 }, impText: '格挡率 +12%',
    names: T20('小圆盾 木盾 铁盾 鸢盾 重盾 森林之盾 战盾 屏障之盾 精英之盾 绯红之盾 秘法之盾 宏伟之盾 远古之盾 光辉之盾 虚空之盾 神圣之盾 次元之盾 暗影之盾 永恒之盾 巨龙之盾 创世之盾') },
  arrow: { slot: 'offhand', cls: 'ranger', name: '箭矢', icon: 'o_quiver', main: { atk: 2.5 }, imp: { proj: 0.1 }, impText: '投射物伤害 +10%',
    names: T20('木箭 铁箭 猎人箭 倒钩箭 蔚蓝箭 残暴箭 疾风箭 蛇牙箭 符文箭 部族箭 命运箭 风暴箭 黑曜石箭 迅捷箭 虚空箭 剧毒箭 次元箭 暗影箭 远古箭 至高箭 创世箭') },
  orb: { slot: 'offhand', cls: 'sorcerer', name: '法球', icon: 'o_orb', main: { atk: 2 }, imp: { elemPct: 0.1 }, impText: '决定法师的元素，元素伤害 +10%', elemRoll: ['fire', 'cold', 'lightning'],
    names: T20('魔法球 长老法球 闪耀法球 冰封法球 预言法球 黑暗法球 符文法球 光耀法球 奥术法球 命运法球 秘法法球 天空法球 灵魂法球 远古法球 深渊法球 虚空法球 次元法球 暗影法球 永恒法球 金辉法球 创世法球') },
  tome: { slot: 'offhand', cls: 'priest', name: '圣典', icon: 'o_tome', main: { hp: 15 }, imp: { cdr: 0.05 }, impText: '冷却缩减 5%',
    names: T20('祈祷书 帝国圣典 铁皮圣典 骑士圣典 祝福圣典 统帅圣典 战争圣典 帝王圣典 符文圣典 绯红圣典 命运圣典 宏伟圣典 风暴圣典 勇者圣典 虚空圣典 水晶圣典 次元圣典 暗影圣典 永恒圣典 天穹圣典 创世圣典') },
  bolt: { slot: 'offhand', cls: 'hunter', name: '弩矢', icon: 'o_bolts', main: { atk: 3 }, imp: { cdmg: 0.15 }, impText: '暴击伤害 +15%',
    names: T20('短弩矢 恐惧弩矢 猎人弩矢 倒钩弩矢 野兽弩矢 迅捷弩矢 铁弩矢 重弩矢 符文弩矢 英雄弩矢 命运弩矢 风暴弩矢 雷霆弩矢 疾速弩矢 虚空弩矢 剧毒弩矢 次元弩矢 暗影弩矢 远古弩矢 圣化弩矢 创世弩矢') },
  hatchet: { slot: 'offhand', cls: 'slayer', name: '飞斧', icon: 'o_hatchet', main: { atk: 3 }, imp: { ls: 0.01 }, impText: '吸血 +1%',
    names: T20('短柄飞斧 皮柄飞斧 长柄飞斧 钢飞斧 征战飞斧 复合飞斧 战斗飞斧 翼飞斧 精英飞斧 巨飞斧 秘法飞斧 迅捷飞斧 远古飞斧 无尽飞斧 混沌飞斧 力量飞斧 次元飞斧 暗影飞斧 永恒飞斧 至高飞斧 创世飞斧') },
  helm: { slot: 'helm', name: '头盔', icon: 'a_helm', main: { hp: 25, arm: 1.5 },
    names: T20('木盔 帝国头盔 铁盔 骑士头盔 锁链头盔 中型头盔 战盔 帝王头盔 符文头盔 赤红头盔 命运头盔 巨盔 风暴头盔 斗士头盔 虚空头盔 水晶头盔 次元头盔 暗影头盔 永恒头盔 光辉头盔 创世头盔') },
  armor: { slot: 'armor', name: '护甲', icon: 'a_chest', main: { hp: 50, arm: 3 },
    names: T20('布衣 帝国护甲 铁板甲 锁子甲 骑士铠甲 命运铠甲 战争铠甲 重铠 符文板甲 龙鳞甲 秘法铠甲 宏伟铠甲 远古铠甲 闪耀铠甲 虚空铠甲 巨龙铠甲 次元铠甲 暗影铠甲 永恒铠甲 光辉铠甲 创世铠甲') },
  gloves: { slot: 'gloves', name: '手套', icon: 'a_gloves', main: { atk: 1.5 }, mainPct: { aspd: 0.03 },
    names: T20('皮手套 帝国手套 铁手套 骑士手套 锁链手套 命运手套 战争手套 重手套 符文手套 板甲手套 秘法手套 宏伟手套 远古手套 闪耀手套 虚空手套 巨龙手套 次元手套 暗影手套 永恒手套 光辉手套 创世手套') },
  boots: { slot: 'boots', name: '靴子', icon: 'a_boots', main: { hp: 18, arm: 1.2 }, mainPct: { move: 0.05 },
    names: T20('草鞋 帝国长靴 铁靴 骑士战靴 锁链靴 命运之靴 战争之靴 重靴 符文之靴 板甲战靴 秘法之靴 宏伟之靴 远古之靴 闪耀之靴 虚空之靴 水晶之靴 次元之靴 暗影之靴 永恒之靴 光辉之靴 创世之靴') },
  amulet: { slot: 'amulet', name: '项链', icon: 'c_amulet', main: { hp: 10 }, mainPct: { atkPct: 0.06 },
    names: T19('铜项链 青铜项链 银项链 金项链 铂金项链 水晶项链 月光石吊坠 琥珀吊坠 红宝石吊坠 紫晶吊坠 翡翠项链 钻石项链 星尘项链 日蚀项链 天界项链 星界项链 以太项链 虚空项链 深渊项链 永恒项链 创世项链') },
  earring: { slot: 'earring', name: '耳环', icon: 'c_earring', main: { atk: 1 }, mainPct: { skill: 0.05 },
    names: T19('铜耳环 青铜耳环 银耳环 金耳环 铂金耳环 水晶耳环 翡翠耳环 玉石耳环 虎眼耳环 石榴石耳环 蓝宝石耳环 钻石耳环 月光石耳环 天界耳环 日蚀耳环 星界耳环 以太耳环 虚空耳环 深渊耳环 永恒耳环 创世耳环') },
  ring: { slot: 'ring', name: '戒指', icon: 'c_ring', main: { atk: 1.5 }, mainPct: { crit: 0.015 },
    names: T19('铜戒指 青铜戒指 银戒指 金戒指 铂金戒指 水晶戒指 琥珀戒指 黄玉戒指 紫晶戒指 石榴石戒指 翡翠戒指 钻石戒指 月光石戒指 日蚀戒指 天界戒指 星界戒指 以太戒指 虚空戒指 深渊戒指 永恒戒指 创世戒指') },
  bracer: { slot: 'bracer', name: '护腕', icon: 'c_bracer', main: { arm: 1 }, mainPct: { allRes: 0.04 },
    names: T19('铜护腕 青铜护腕 银护腕 金护腕 铂金护腕 水晶护腕 黑曜石护腕 暗影护腕 赤红护腕 血石护腕 翡翠护腕 钻石护腕 星尘护腕 日蚀护腕 天界护腕 星界护腕 以太护腕 虚空护腕 深渊护腕 永恒护腕 创世护腕') },
};
for (const id in TYPES) TYPES[id].id = id;
const TYPE_IDS = Object.keys(TYPES);
const TYPES_BY_SLOT = SLOTS.reduce((o, s) => (o[s] = TYPE_IDS.filter(k => TYPES[k].slot === s), o), {});
const itemTypeName = (type, ilvl) => TYPES[type].names[tierOf(ilvl, tiersFor(type))];
// which slots a class can fill with a type
const canWear = (cls, type) => { const T = TYPES[type]; return !T.cls || T.cls === cls; };

// ---------- 10 grades (TBH: sockets, alchemy gold, cube XP) ----------
const GRADES = [
  { name: '普通', color: '#c0cbdc', dark: '#5a6988', deep: '#3a4466', glow: '#ffffff', mul: 1.0, affixes: 1, sockets: [0, 0, 0], alch: 10, xp: 2 },
  { name: '优秀', color: '#63c74d', dark: '#3e8948', deep: '#265c42', glow: '#b8f0a0', mul: 1.12, affixes: 2, sockets: [1, 0, 0], alch: 30, xp: 6 },
  { name: '稀有', color: '#0099db', dark: '#124e89', deep: '#262b44', glow: '#2ce8f5', mul: 1.28, affixes: 3, sockets: [1, 1, 0], alch: 90, xp: 18 },
  { name: '传说', color: '#feae34', dark: '#733e39', deep: '#3e2731', glow: '#fee761', mul: 1.5, affixes: 3, sockets: [2, 2, 0], alch: 270, xp: 54 },
  { name: '不朽', color: '#e43b44', dark: '#a22633', deep: '#3e2731', glow: '#f6757a', mul: 1.75, affixes: 4, sockets: [2, 2, 1], alch: 810, xp: 162 },
  { name: '至宝', color: '#c45bd6', dark: '#68386c', deep: '#2e1a35', glow: '#f6757a', mul: 2.05, affixes: 4, sockets: [3, 2, 1], alch: 2592, xp: 518 },
  { name: '超凡', color: '#ff0044', dark: '#a22633', deep: '#3e2731', glow: '#f6757a', mul: 2.4, affixes: 5, sockets: [3, 2, 2], alch: 8294, xp: 1658 },
  { name: '天界', color: '#2ce8f5', dark: '#0099db', deep: '#124e89', glow: '#ffffff', mul: 2.8, affixes: 5, sockets: [3, 2, 2], alch: 29029, xp: 5803 },
  { name: '神圣', color: '#fee761', dark: '#feae34', deep: '#733e39', glow: '#ffffff', mul: 3.25, affixes: 6, sockets: [3, 2, 2], alch: 101602, xp: 20311 },
  { name: '宇宙', color: '#ffffff', dark: '#8b9bb4', deep: '#262b44', glow: '#fee761', mul: 3.8, affixes: 6, sockets: [3, 2, 2], alch: 355607, xp: 71089 },
];
const GRADE_MAX = GRADES.length - 1, LEGEND_GRADE = 3;
const RARITY = GRADES;
const alchGoldOf = (g, l) => Math.round(GRADES[g].alch * Math.pow(SC(l), 0.6));
const cubeXpOf = (g, l) => Math.round(GRADES[g].xp * (1 + l / 20));

// ---------- affixes ----------
// [min, max] at grade 0, ilvl 1; × (1 + 0.12 grade) × (1 + ilvl / 150)
const AFFIXES = {
  atkPct: { r: [0.04, 0.1], text: v => `攻击 +${pct(v)}` },
  aspd: { r: [0.03, 0.07], text: v => `攻速 +${pct(v, 1)}` },
  crit: { r: [0.015, 0.04], text: v => `暴击率 +${pct(v, 1)}` },
  cdmg: { r: [0.08, 0.2], text: v => `暴击伤害 +${pct(v)}` },
  hpPct: { r: [0.05, 0.12], text: v => `生命 +${pct(v)}` },
  armPct: { r: [0.06, 0.14], text: v => `护甲 +${pct(v)}` },
  regen: { r: [0.0015, 0.005], text: v => `每秒回复 ${pct(v, 2)} 生命` },
  ls: { r: [0.004, 0.012], text: v => `吸血 +${pct(v, 1)}` },
  hpKill: { r: [0.003, 0.01], text: v => `击杀回复 ${pct(v, 1)} 生命` },
  hpHit: { r: [0.0003, 0.001], text: v => `命中回复 ${pct(v, 2)} 生命` },
  block: { r: [0.02, 0.05], text: v => `格挡率 +${pct(v, 1)}` },
  dodge: { r: [0.015, 0.04], text: v => `闪避 +${pct(v, 1)}` },
  dr: { r: [0.01, 0.03], text: v => `伤害减免 +${pct(v, 1)}` },
  allRes: { r: [0.03, 0.07], text: v => `全元素抗性 +${pct(v)}` },
  fireRes: { r: [0.05, 0.12], text: v => `火焰抗性 +${pct(v)}` },
  coldRes: { r: [0.05, 0.12], text: v => `冰霜抗性 +${pct(v)}` },
  lightningRes: { r: [0.05, 0.12], text: v => `闪电抗性 +${pct(v)}` },
  chaosRes: { r: [0.05, 0.12], text: v => `混沌抗性 +${pct(v)}` },
  phys: { r: [0.06, 0.15], text: v => `物理伤害 +${pct(v)}` },
  fire: { r: [0.06, 0.15], text: v => `火焰伤害 +${pct(v)}` },
  cold: { r: [0.06, 0.15], text: v => `冰霜伤害 +${pct(v)}` },
  lightning: { r: [0.06, 0.15], text: v => `闪电伤害 +${pct(v)}` },
  chaos: { r: [0.06, 0.15], text: v => `混沌伤害 +${pct(v)}` },
  proj: { r: [0.05, 0.12], text: v => `投射物伤害 +${pct(v)}` },
  aoeDmg: { r: [0.05, 0.12], text: v => `范围伤害 +${pct(v)}` },
  aoe: { r: [0.03, 0.08], text: v => `范围 +${pct(v)}` },
  skill: { r: [0.04, 0.1], text: v => `技能伤害 +${pct(v)}` },
  cdr: { r: [0.02, 0.05], text: v => `冷却缩减 ${pct(v, 1)}` },
  cast: { r: [0.03, 0.07], text: v => `施法速度 +${pct(v)}` },
  move: { r: [0.03, 0.08], text: v => `移动速度 +${pct(v)}` },
  gold: { r: [0.05, 0.12], text: v => `金币 +${pct(v)}` },
  exp: { r: [0.04, 0.1], text: v => `经验 +${pct(v)}` },
  chestN: { r: [0.03, 0.08], text: v => `普通宝箱几率 +${pct(v)}` },
  chestB: { r: [0.03, 0.08], text: v => `首领宝箱几率 +${pct(v)}` },
};
const AFFIX_IDS = Object.keys(AFFIXES);
const STAT_TEXT = {
  ...Object.fromEntries(AFFIX_IDS.map(k => [k, AFFIXES[k].text])),
  dmg: v => `全伤害 +${pct(v)}`, elemPct: v => `元素伤害 +${pct(v)}`, heal: v => `治疗效果 +${pct(v)}`, absorb: v => `每次受击吸收 ${pct(v, 1)} 最大生命`,
  dodgeCap: v => `闪避上限 +${pct(v)}`, dur: v => `技能持续时间 +${pct(v)}`, bossGold: v => `首领金币 +${pct(v)}`, bossExp: v => `首领经验 +${pct(v)}`,
  alchGold: v => `炼金金币 +${pct(v)}`, cubeExp: v => `魔方经验 +${pct(v)}`, atkFlat: v => `攻击 +${fmt(v)}`,
  offGold: v => `离线金币 +${pct(v)}`, offExp: v => `离线经验 +${pct(v)}`, chestGold: v => `开箱金币 +${pct(v)}`,
};
const statText = (k, v) => (STAT_TEXT[k] ? STAT_TEXT[k](v) : k + ' ' + v);

// ---------- legend effects (from 传说 on; 至宝 and above ×1.5) ----------
const LEGENDS = {
  chain: { cat: 'weapon', name: '连珠', item: '风语者', text: '每第 4 次普攻连击 3 次' },
  pierce: { cat: 'weapon', name: '穿云', item: '裂空', text: '普攻额外贯穿 2 个目标，造成 50% 伤害' },
  sunder: { cat: 'weapon', name: '破甲', item: '碎骨者', text: '无视 60% 防御' },
  ember: { cat: 'weapon', name: '余烬', item: '烬灭', text: '击杀时爆炸，对附近敌人造成目标最大生命 40% 的伤害' },
  verdict: { cat: 'weapon', name: '审判', item: '审判者', text: '对首领伤害 +60%，首领倒计时 +8 秒' },
  crown: { cat: 'armor', name: '棘冠', item: '荆棘王冠', text: '被攻击时反击 100% 攻击，可以暴击' },
  undying: { cat: 'armor', name: '不屈', item: '不屈战袍', text: '每波一次：致命伤害保留 1 点生命并无敌 2 秒' },
  pact: { cat: 'armor', name: '血契', item: '血誓', text: '溢出的治疗转为护盾，最多 30% 最大生命' },
  bulwark: { cat: 'armor', name: '磐石', item: '磐石之心', text: '格挡时获得 5% 最大生命的护盾' },
  phoenix: { cat: 'armor', name: '涅槃', item: '凤凰之羽', text: '每关一次：倒下时以 40% 生命复活' },
  sand: { cat: 'acc', name: '时之砂', item: '时之沙漏', text: '每次暴击使所有技能冷却减少 0.25 秒' },
  echo: { cat: 'acc', name: '回响', item: '回响之戒', text: '技能有 30% 几率再释放一次' },
  gale: { cat: 'acc', name: '风行', item: '风行者', text: '攻速 +15%' },
  prism: { cat: 'acc', name: '棱镜', item: '七彩棱镜', text: '每命中一种新元素，全伤害 +6%（持续 5 秒，最多 5 层）' },
  focus: { cat: 'acc', name: '专注', item: '猎人之眼', text: '对每个目标的第一次命中必定暴击' },
  midas: { cat: 'acc', name: '黄金律', item: '黄金律', text: '金币 +40%，每拾取一枚金币回复 0.5% 生命' },
  seeker: { cat: 'acc', name: '寻宝者', item: '寻宝者之证', text: '宝箱里的装备有 15% 几率品质提升一级' },
  bounty: { cat: 'acc', name: '赏金令', item: '赏金令', text: '首领金币 ×2，悬赏首领额外掉落一个首领宝箱' },
  collector: { cat: 'acc', name: '收藏家', item: '收藏家徽记', text: '普通宝箱与首领宝箱几率 +30%' },
  scholar: { cat: 'acc', name: '学者', item: '学者护符', text: '经验 +40%' },
  swordwave: { cat: 'weapon', cls: 'knight', name: '剑气', item: '斩浪', text: '每次普攻射出剑气，命中身后 2 个目标造成 60% 伤害' },
  kingshield: { cat: 'weapon', cls: 'knight', name: '王者之盾', item: '王者之盾', text: '格挡率 +15%，格挡时反击 100%' },
  tempest: { cat: 'weapon', cls: 'slayer', name: '风暴之刃', item: '风暴之刃', text: '旋风斧持续时间 +2 秒，范围 +50%' },
  bloodaxe: { cat: 'weapon', cls: 'slayer', name: '血斧', item: '饮血者', text: '范围伤害的 10% 转为生命' },
  splitarrow: { cat: 'weapon', cls: 'ranger', name: '分裂箭', item: '千羽', text: '每支箭命中后分裂成 2 支，造成 40% 伤害' },
  falcon: { cat: 'weapon', cls: 'ranger', name: '猎鹰', item: '猎鹰之翼', text: '连射多射 2 支箭' },
  sunpierce: { cat: 'weapon', cls: 'hunter', name: '贯日', item: '贯日', text: '弩矢贯穿所有目标' },
  thunderclap: { cat: 'weapon', cls: 'hunter', name: '爆鸣', item: '雷鸣', text: '暴击时爆炸，对附近敌人造成 50% 伤害' },
  elemchain: { cat: 'weapon', cls: 'sorcerer', name: '元素连锁', item: '三相之杖', text: '法弹命中后弹射 2 个目标，造成 50% 伤害' },
  hydraking: { cat: 'weapon', cls: 'sorcerer', name: '九头蛇之王', item: '蛇王之瞳', text: '九头蛇多 2 个头，持续时间 +4 秒' },
  sainthood: { cat: 'weapon', cls: 'priest', name: '圣愈', item: '圣者之心', text: '治疗效果 ×2' },
  judgement: { cat: 'weapon', cls: 'priest', name: '审判之光', item: '晨曦', text: '天罚的闪电伤害 +50%，并附带 1 秒眩晕' },
};
const LEGEND_IDS = Object.keys(LEGENDS);
const SLOT_CAT = { weapon: 'weapon', offhand: 'weapon', helm: 'armor', armor: 'armor', gloves: 'armor', boots: 'armor', amulet: 'acc', earring: 'acc', ring: 'acc', bracer: 'acc' };
const legendsFor = type => {
  const T = TYPES[type], cat = SLOT_CAT[T.slot];
  return LEGEND_IDS.filter(id => LEGENDS[id].cat === cat && (!LEGENDS[id].cls || LEGENDS[id].cls === T.cls));
};

// ---------- materials (TBH: 36 gems, 33 parts, 10 scrolls, 22 ores, 10 coins, 4 soul stones = 115) ----------
const MATS = {};
const addMat = (id, def) => { MATS[id] = { id, ...def }; };
// decoration gems: one stat each, by grade 5/4/5/4/4/4/4/2/2/2
const GEM_ROWS = [
  [['碎红宝石', 'atkPct'], ['碎蓝宝石', 'hpPct'], ['碎黄玉', 'aspd'], ['碎翡翠', 'crit'], ['碎紫晶', 'cdmg']],
  [['黑曜石碎片', 'armPct'], ['珊瑚', 'regen'], ['玉石', 'allRes'], ['琥珀', 'gold']],
  [['红宝石', 'atkPct'], ['蓝宝石', 'hpPct'], ['黄玉', 'aspd'], ['翡翠', 'crit'], ['紫晶', 'cdmg']],
  [['石榴石', 'phys'], ['海蓝宝石', 'cold'], ['火蛋白石', 'fire'], ['雷光石', 'lightning']],
  [['钻石', 'atkPct'], ['蛋白石', 'skill'], ['月光石', 'dodge'], ['血玉', 'ls']],
  [['奥术水晶', 'skill'], ['星辰石', 'crit'], ['黑钻', 'cdmg'], ['龙眼石', 'hpPct']],
  [['虚空蛋白石', 'chaos'], ['混沌晶核', 'atkPct'], ['天青石', 'cdr'], ['圣光石', 'block']],
  [['天界珍珠', 'allRes'], ['极光石', 'aspd']],
  [['深渊珍珠', 'cdmg'], ['神谕之石', 'atkPct']],
  [['以太宝石', 'skill'], ['混沌钻石', 'cdmg']],
];
const GEM_BASE = { atkPct: 0.03, hpPct: 0.04, aspd: 0.015, crit: 0.008, cdmg: 0.05, armPct: 0.05, regen: 0.002, allRes: 0.03, gold: 0.04, phys: 0.05, fire: 0.05, cold: 0.05, lightning: 0.05, chaos: 0.05, skill: 0.04, dodge: 0.01, ls: 0.003, cdr: 0.012, block: 0.012 };
GEM_ROWS.forEach((row, g) => row.forEach(([name, stat], i) => addMat(`gem${g}_${i}`, { kind: 'gem', grade: g, name, stat, value: GEM_BASE[stat] * (1 + 0.6 * g), color: ['red', 'blue', 'gold', 'green', 'purple'][i % 5] })));
// engraving parts: two stats each, by grade 3/4/4/4/4/4/4/2/2/2 (go into 不朽+ gear)
const PART_ROWS = [
  [['哥布林皮', 'atkPct', 'gold', 'part_hide', 'green'], ['骷髅骨', 'armPct', 'block', 'part_bone', 'bone'], ['史莱姆凝胶', 'hpPct', 'regen', 'part_goo', 'green']],
  [['蝙蝠翼膜', 'ls', 'aspd', 'part_wing', 'purple'], ['蛛丝', 'aspd', 'crit', 'part_wing', 'cloud'], ['狼牙', 'cdmg', 'atkPct', 'part_fang', 'cloud'], ['蛇鳞', 'armPct', 'allRes', 'part_hide', 'teal']],
  [['孢子粉', 'skill', 'cdr', 'part_goo', 'red'], ['木乃伊绷带', 'hpPct', 'block', 'part_hide', 'bone'], ['蝎尾针', 'chaos', 'crit', 'part_fang', 'fire'], ['火蜥鳞', 'fire', 'armPct', 'part_hide', 'fire']],
  [['冰晶核', 'cold', 'hpPct', 'part_core', 'ice'], ['魔像核心', 'armPct', 'dr', 'part_core', 'steel'], ['晶簇', 'skill', 'crit', 'part_core', 'purple'], ['雷鸟羽', 'lightning', 'aspd', 'part_wing', 'gold']],
  [['石像鬼之眼', 'cdmg', 'crit', 'part_core', 'red'], ['骑士徽记', 'block', 'armPct', 'part_hide', 'silver'], ['熔火之心', 'fire', 'atkPct', 'part_core', 'lava'], ['灵魂残响', 'cdr', 'skill', 'part_core', 'ghost']],
  [['恶魔角', 'chaos', 'cdmg', 'part_fang', 'red'], ['眼魔晶体', 'crit', 'cdmg', 'part_core', 'red'], ['狮鹫羽', 'aspd', 'move', 'part_wing', 'sand'], ['蛙王舌', 'ls', 'hpPct', 'part_goo', 'moss']],
  [['龙骨', 'phys', 'atkPct', 'part_bone', 'bone'], ['禁忌书页', 'skill', 'chaos', 'part_hide', 'purple'], ['凤凰灰', 'regen', 'fire', 'part_goo', 'fire'], ['海妖墨', 'cold', 'cdr', 'part_goo', 'ink']],
  [['虚空触须', 'chaos', 'aspd', 'part_fang', 'purple'], ['星界棱镜', 'allRes', 'skill', 'part_core', 'ice']],
  [['王冠碎片', 'atkPct', 'cdmg', 'part_core', 'gold'], ['天界羽翼', 'aspd', 'crit', 'part_wing', 'cloud']],
  [['混沌骰子', 'cdmg', 'atkPct', 'part_core', 'purple'], ['永恒之心', 'hpPct', 'allRes', 'part_core', 'red']],
];
PART_ROWS.forEach((row, g) => row.forEach(([name, s1, s2, shape, ramp], i) => addMat(`part${g}_${i}`, { kind: 'part', grade: g, name, stats: [s1, s2], shape, ramp })));
const partValue = (stat, g) => AFFIXES[stat] ? AFFIXES[stat].r[1] * (0.35 + 0.12 * g) : 0.03 * (g + 1);
// inscription scrolls: a random strong stat (go into 至宝+ gear)
for (let g = 0; g < 10; g++) addMat(`scroll${g}`, { kind: 'scroll', grade: g, name: `${GRADES[g].name}铭文卷轴` });
const INSCRIBE_POOL = ['atkPct', 'aspd', 'crit', 'cdmg', 'hpPct', 'skill', 'cdr', 'allRes', 'phys', 'fire', 'cold', 'lightning', 'chaos', 'aoeDmg', 'proj', 'gold', 'exp'];
// crafting ores (4 commons, then two per grade)
const ORE_ROWS = [['木材', '石料', '皮革', '铜块'], ['青铜锭', '铁锭'], ['银锭', '金锭'], ['星尘', '虚铁'], ['血石', '雷石'], ['混沌碎片', '奥术矿'], ['暗钢', '山铜'], ['月石', '日石'], ['秘银', '以太锭'], ['精金矿', '永恒锭']];
ORE_ROWS.forEach((row, g) => row.forEach((name, i) => addMat(`ore${g}_${i}`, { kind: 'ore', grade: g, name })));
// offering coins: coin + gold fee → one random item (TBH odds)
const COINS = [
  ['公会一周年纪念币', 10, [2.4, 12, 28, 35, 21]],
  ['王都一周年纪念币', 110, [0, 9.5, 23, 31, 23, 12, 0, 0.7]],
  ['公会十周年纪念币', 210, [0, 2.7, 14, 28, 28, 17, 6.6, 2.7]],
  ['王都十周年纪念币', 310, [0, 1.7, 0, 17, 31, 27, 14, 9.4]],
  ['公会五十周年纪念币', 410, [0, 0, 0, 0, 21, 30, 26, 20, 3.1]],
  ['王都五十周年纪念币', 510, [0, 0, 0, 0, 0, 42, 25, 29, 3.3, 0.6]],
  ['公会百年纪念币', 610, [0, 0, 0, 0, 0, 0, 51, 40, 8.4, 1.1]],
  ['王都百年纪念币', 710, [0, 0, 0, 0, 0, 0, 0, 80, 17, 2.9]],
  ['圣公会千年纪念币', 810, [0, 0, 0, 0, 0, 0, 0, 15, 79, 5.8]],
  ['永恒王都千年纪念币', 910, [0, 0, 0, 0, 0, 0, 0, 18, 0, 82]],
];
COINS.forEach(([name, fee, odds], g) => addMat(`coin${g}`, { kind: 'coin', grade: g, name, fee: fee * 100, odds }));
// soul stones: our wanted posters (TBH: Normal Immortal · Nightmare Arcana · Hell Beyond · Torment Celestial)
DIFFS.forEach((D, d) => addMat(`stone${d}`, { kind: 'stone', grade: 4 + d, diff: d, name: `${D.name}通缉令` }));
const MAT_IDS = Object.keys(MATS);
const matsOf = (kind, g) => MAT_IDS.filter(id => MATS[id].kind === kind && (g === undefined || MATS[id].grade === g));

// ---------- chests (TBH: white normal box, blue stage-boss box, red act-boss box) ----------
const CHESTS = [
  { id: 'normal', name: '普通宝箱', color: 'white', items: 1, mats: [0.5, 1], stone: 0, coin: 0, gold: 10, cap: 10,
    weights: [62, 28, 9, 0.8, 0.2] },
  { id: 'boss', name: '首领宝箱', color: 'blue', items: 2, mats: [1, 2], stone: 0.15, coin: 0.03, gold: 40, cap: 5,
    weights: [0, 30, 55, 11, 3, 0.8, 0.2] },
  { id: 'act', name: '悬赏宝箱', color: 'red', items: 3, mats: [2, 3], stone: 0.4, coin: 0.12, gold: 150, cap: 3,
    weights: [0, 0, 40, 32, 17, 7, 2.5, 1.5] },
];
const CHEST_N_BASE = 0.008;                 // per normal monster (elites ×5)
const CHEST_B_BASE = [0.35, 0.3, 0.25, 0.2]; // per stage boss, by difficulty
const CHEST_CAP = [10, 5, 3];
// the best grade each difficulty's chests can hold; 宇宙 comes from the cube
const DIFF_MAX_GRADE = [5, 6, 7, 8];
const BAG_BASE = 30, STASH_PAGE = 40;
const AUTO_OPEN_EVERY = 4; // seconds per chest, shortened by 润滑

// ---------- the cube (TBH) ----------
const CUBE_UNLOCK_LEVEL = 4, RUNE_UNLOCK_LEVEL = 3, CUBE_MAX = 100;
const CUBE_FUNCS = [
  { id: 'alch', name: '炼金', lv: 1, text: '装备换成金币和魔方经验' },
  { id: 'synth', name: '合成', lv: 1, text: '9 件同品质装备合成 1 件高一品质；不朽起可能失败，偶尔大成功连升两级' },
  { id: 'craft', name: '制作', lv: 5, text: '用矿石与金币，在选定的等级段制作一件随机装备或饰品' },
  { id: 'deco', name: '镶嵌', lv: 8, text: '宝石放进装饰孔，每孔 1 条属性' },
  { id: 'remove', name: '拆除', lv: 10, text: '花一点金币取下插槽内容，材料会碎掉（装备需先卸下）' },
  { id: 'engrave', name: '雕刻', lv: 15, text: '怪物素材刻进雕刻孔，每孔 2 条属性' },
  { id: 'offer', name: '供奉', lv: 20, text: '纪念币加一笔金币，换一件随机装备' },
  { id: 'inscribe', name: '铭文', lv: 25, text: '铭文卷轴写进铭文孔，随机一条强力属性' },
];
const cubeNeed = l => Math.round(30 * Math.pow(1.12, l - 1));
// synthesis odds by input grade: [stay, up one, up two] (TBH)
const SYNTH_ODDS = [[0, 95.2, 4.8], [0, 96.2, 3.8], [0, 97.6, 2.4], [0, 99.01, 0.99], [50, 49.75, 0.25], [67, 32.83, 0.17], [77, 22.92, 0.08], [83, 16.98, 0.02], [91, 9.1, 0]];
// synthesis recipes: output item level range, cube level, gold (TBH)
const SYNTH_RECIPES = [[1, 10, 1, 0], [10, 20, 10, 100], [15, 30, 20, 500], [20, 40, 30, 1000], [30, 50, 40, 3000], [40, 65, 50, 5000], [50, 65, 60, 7000], [65, 100, 70, 10000]];
// crafting odds per material tier: grade weights (TBH), level range, ore grade
const CRAFT_TIERS = [
  { lo: 1, hi: 10, ore: 0, odds: [0, 50, 40, 8, 2] },
  { lo: 10, hi: 20, ore: 1, odds: [0, 30, 52, 13, 4.5, 0.5] },
  { lo: 20, hi: 30, ore: 2, odds: [0, 18.01, 56.01, 18.01, 7, 0.9, 0.07] },
  { lo: 30, hi: 40, ore: 3, odds: [0, 11, 55, 23, 9, 1.8, 0.2] },
  { lo: 40, hi: 50, ore: 4, odds: [0, 7, 53, 26, 11, 2.8, 0.2] },
  { lo: 50, hi: 65, ore: 5, odds: [0, 1.5, 51.5, 29, 14, 3.8, 0.2] },
  { lo: 65, hi: 80, ore: 6, odds: [0, 0, 49.5, 30, 16.5, 3.8, 0.2] },
  { lo: 80, hi: 100, ore: 8, odds: [0, 0, 48, 30, 18, 3.8, 0.2] },
];
// removal gold per socket by item tier band (decoration ×1, engraving ×2, inscription ×4)
const REMOVE_COST = [100, 200, 400, 800, 1500, 3000, 6000, 12000, 25000, 50000];

// ---------- pets (TBH: 5 by 5,000 online kills, 3 more) ----------
const PETS = {
  bat: { name: '小蝙蝠', spr: 'pet_bat', kill: ['cavebat', 'sporebat', 'vampbat'], need: 5000, eff: { chestN: 0.1, exp: 0.15 } },
  watcher: { name: '守望者', spr: 'pet_eye', kill: ['wasp'], need: 5000, eff: { gold: 0.15 } },
  burnskull: { name: '燃烧骷髅', spr: 'pet_skull', kill: ['fireelem'], need: 5000, eff: { chestB: 0.1 } },
  bluegolem: { name: '蓝色魔像', spr: 'pet_golem', kill: ['golem'], need: 5000, eff: { chestN: 0.15 } },
  darkspirit: { name: '暗影之灵', spr: 'pet_wisp', kill: ['ghost', 'shade'], need: 5000, eff: { chestB: 0.15 } },
  sword: { name: '圣剑精灵', spr: 'pet_sword', clear: [0, 3], eff: { exp: 0.15 } },
  butterfly: { name: '光蝶', spr: 'pet_butterfly', clear: [1, 3], eff: { gold: 0.1 } },
  dragon: { name: '幼龙', spr: 'pet_drake', clear: [2, 3], eff: { chestN: 0.2, gold: 0.15, exp: 0.2 } },
};
const PET_IDS = Object.keys(PETS);

// ---------- the rune tree (TBH: 197 nodes, account-wide, opens at hero level 3) ----------
// [id, rune, max, parent] — the rune name decides the effect; layout comes from the branch it sits on
const RUNE_KINDS = {
  war: { name: '战争', eff: { atkPct: 0.02 }, color: PAL.red }, warRoot: { name: '战争', eff: { atkPct: 0.05 }, color: PAL.red },
  wealth: { name: '财富', eff: { gold: 0.03 }, color: PAL.amber }, growth: { name: '成长', eff: { exp: 0.03 }, color: PAL.cyan },
  goldFlat: { name: '财富', eff: { gold: 0.05 }, color: PAL.amber }, goldBoss: { name: '财富', eff: { bossGold: 0.1 }, color: PAL.amber },
  expFlat: { name: '成长', eff: { exp: 0.05 }, color: PAL.cyan }, expBoss: { name: '成长', eff: { bossExp: 0.1 }, color: PAL.cyan },
  command: { name: '统率', eff: { party: 1 }, color: PAL.yellow }, awakening: { name: '觉醒', eff: { skillSlot: 1 }, color: PAL.yellow },
  expansion: { name: '扩容', eff: { bag: 2 }, color: PAL.steel }, expansionS: { name: '扩容', eff: { bag: 4 }, color: PAL.steel },
  repose: { name: '安眠', eff: { offline: 1 }, color: PAL.blue }, hoarding: { name: '囤积', eff: { offGold: 0.05 }, color: PAL.amber }, training: { name: '修炼', eff: { offExp: 0.05 }, color: PAL.cyan },
  containment: { name: '收纳', eff: { capN: 5 }, color: PAL.mist }, vault: { name: '宝库', eff: { capB: 3 }, color: PAL.blue }, infinity: { name: '无限', eff: { capA: 2 }, color: PAL.red },
  capNx: { name: '扩容', eff: { capN: 2 }, color: PAL.mist },
  storage: { name: '仓储', eff: { stash: 1 }, color: PAL.steel },
  springN: { name: '发条', eff: { autoN: 1 }, color: PAL.mist }, springB: { name: '发条', eff: { autoB: 1 }, color: PAL.blue }, springA: { name: '发条', eff: { autoA: 1 }, color: PAL.red },
  lube: { name: '润滑', eff: { openSpeed: 0.08 }, color: PAL.slate },
  explore: { name: '探索', eff: { chestN: 0.05 }, color: PAL.mist }, conquest: { name: '征服', eff: { chestB: 0.05 }, color: PAL.blue },
  opening: { name: '开启', eff: { chestGold: 0.25 }, color: PAL.yellow }, brevity: { name: '简短', eff: { brevity: 1 }, color: PAL.green },
  alchemy: { name: '炼金', eff: { alchGold: 0.05 }, color: PAL.amber }, forging: { name: '锻造', eff: { cubeExp: 0.05 }, color: PAL.magenta },
  shield: { name: '坚盾', eff: { armPct: 0.02 }, color: PAL.steel }, shieldPct: { name: '坚盾', eff: { armPct: 0.03 }, color: PAL.steel },
  gale: { name: '疾风', eff: { move: 0.02 }, color: PAL.green }, frenzy: { name: '狂热', eff: { aspd: 0.02 }, color: PAL.orange }, warFlat: { name: '战争', eff: { atkPct: 0.03 }, color: PAL.red },
};
// runes whose effect reads better as a sentence
const RUNE_TEXT = {
  party: () => '队伍 +1 名英雄', skillSlot: () => '每名英雄的主动技能槽 +1', bag: v => `背包 +${v} 格`, offline: () => '离线时继续狩猎（最多 8 小时，金币与经验）',
  capN: v => `普通宝箱容量 +${v}`, capB: v => `首领宝箱容量 +${v}`, capA: v => `悬赏宝箱容量 +${v}`, stash: () => `背包 +${STASH_PAGE} 格（仓库页）`,
  autoN: () => '自动打开普通宝箱', autoB: () => '自动打开首领宝箱', autoA: () => '自动打开悬赏宝箱', openSpeed: v => `自动开箱速度 +${pct(v)}`,
  brevity: v => `每关少 ${v} 波`, bossExp: v => `首领经验 +${pct(v)}`,
};
const RUNE_SPEC = [];
(function buildRunes() {
  const R = (id, kind, max, p, branch) => RUNE_SPEC.push({ id, kind, max, p, branch });
  R(1, 'warRoot', 1, 0, 'root'); R(10, 'wealth', 3, 1, 'root'); R(20, 'growth', 3, 1, 'root');
  // south: formation
  R(21, 'command', 1, 20, 'S'); R(22, 'expansionS', 3, 21, 'S'); R(23, 'expansionS', 5, 22, 'S'); R(24, 'command', 1, 23, 'S');
  R(25, 'wealth', 3, 21, 'S2'); R(26, 'growth', 3, 25, 'S2'); R(27, 'awakening', 1, 26, 'S2');
  // north: bag, offline, capacities, auto-open, stash
  for (let i = 11; i <= 16; i++) R(i, 'expansion', 3, i === 11 ? 10 : i - 1, 'N');
  R(11001, 'repose', 1, 11, 'Nw'); R(110011, 'hoarding', 3, 11001, 'Nw'); R(110012, 'training', 3, 11001, 'Nw');
  R(11002, 'containment', 1, 11, 'Ne'); R(11003, 'vault', 1, 11002, 'Ne'); R(11004, 'infinity', 1, 11003, 'Ne');
  R(13001, 'storage', 1, 13, 'Nw'); R(13002, 'springN', 1, 13, 'Ne'); R(130021, 'lube', 3, 13002, 'Ne');
  R(15001, 'springB', 1, 15, 'Ne'); R(150011, 'lube', 3, 15001, 'Ne'); R(15002, 'hoarding', 3, 15, 'Nw'); R(150021, 'training', 3, 15002, 'Nw');
  for (let i = 1801; i <= 1808; i++) R(i, 'expansion', 3, i === 1801 ? 16 : i - 1, 'NW');
  [[180201, 'hoarding'], [180301, 'training'], [180401, 'hoarding'], [180501, 'training'], [180601, 'hoarding'], [180701, 'training']].forEach(([id, k]) => R(id, k, 5, Math.floor(id / 100), 'NWs'));
  for (let i = 1901; i <= 1908; i++) R(i, 'expansion', 3, i === 1901 ? 16 : i - 1, 'NE');
  R(1902001, 'springA', 1, 1902, 'NEs'); R(19020011, 'lube', 3, 1902001, 'NEs');
  R(190301, 'lube', 5, 1903, 'NEs'); R(190302, 'lube', 5, 1903, 'NEs'); R(190401, 'lube', 3, 1904, 'NEs');
  R(190501, 'lube', 5, 1905, 'NEs'); R(1905011, 'lube', 5, 190501, 'NEs'); R(190502, 'lube', 5, 1905, 'NEs'); R(1905021, 'lube', 5, 190502, 'NEs');
  R(16001, 'storage', 1, 16, 'N'); R(160011, 'storage', 1, 16001, 'N');
  // north-east: chests
  for (let i = 101; i <= 128; i++) R(i, i % 2 ? 'explore' : 'conquest', i <= 102 ? 3 : 5, i === 101 ? 10 : i - 1, 'CH');
  const side = [[1021, 'opening', 102], [1031, 'containment', 103], [1051, 'capNx', 105, 5], [1052, 'containment', 1051], [1054, 'capNx', 1052, 5], [1053, 'explore', 1051, 3], [1055, 'opening', 1051], [1056, 'infinity', 1051],
    [1061, 'containment', 106], [1071, 'vault', 107], [1072, 'containment', 107], [1091, 'containment', 109], [1101, 'containment', 110], [1102, 'vault', 110], [1111, 'vault', 111], [1121, 'containment', 112],
    [1131, 'containment', 113], [1132, 'vault', 113], [1133, 'infinity', 113], [1141, 'vault', 114], [1142, 'containment', 114], [1161, 'containment', 116], [11611, 'containment', 1161],
    [1171, 'brevity', 117], [1172, 'vault', 117], [1181, 'vault', 118], [1182, 'infinity', 118], [1191, 'containment', 119], [1201, 'containment', 120], [1202, 'vault', 120], [1203, 'infinity', 120],
    [1221, 'vault', 122], [1222, 'infinity', 122], [1241, 'containment', 124], [1251, 'vault', 125], [1252, 'infinity', 125], [1261, 'vault', 126], [1262, 'infinity', 126], [1281, 'vault', 128], [1282, 'infinity', 128], [12821, 'infinity', 1282]];
  for (const [id, k, p, max] of side) R(id, k, max || 1, p, 'CHs');
  // north-west: gold
  const goldMain = { 201: ['goldFlat', 1], 202: ['wealth', 5], 203: ['goldBoss', 5], 204: ['goldFlat', 1], 205: ['goldBoss', 5] };
  for (let i = 201; i <= 215; i++) { const [k, m] = goldMain[i] || [i % 2 ? 'goldBoss' : 'wealth', 5]; R(i, k, m, i === 201 ? 10 : i - 1, 'G'); }
  [[2031, 'alchemy', 203, 1], [2032, 'forging', 2031, 5], [2071, 'wealth', 207, 1], [2091, 'wealth', 209, 5], [2111, 'wealth', 211, 5], [2131, 'alchemy', 213, 3], [2132, 'forging', 213, 5], [2151, 'wealth', 215, 2], [2152, 'wealth', 2151, 5]]
    .forEach(([id, k, p, m]) => R(id, k, m, p, 'Gs'));
  // south-west: experience
  const expMain = { 301: ['expFlat', 1], 302: ['growth', 5], 303: ['expBoss', 5], 304: ['expFlat', 1], 305: ['expBoss', 3] };
  for (let i = 301; i <= 315; i++) { const [k, m] = expMain[i] || [i % 2 ? 'expBoss' : 'growth', 5]; R(i, k, m, i === 301 ? 20 : i - 1, 'X'); }
  [[3031, 'forging', 302, 1], [3032, 'alchemy', 3031, 5], [3061, 'growth', 306, 5], [3091, 'growth', 309, 1], [3121, 'forging', 312, 5], [3122, 'alchemy', 3121, 5], [3151, 'growth', 315, 5], [3152, 'growth', 315, 5]]
    .forEach(([id, k, p, m]) => R(id, k, m, p, 'Xs'));
  // south-east: combat
  const cmb = [[401, 'shield', 3], [402, 'gale', 3], [403, 'shield', 10], [404, 'gale', 5], [405, 'war', 10], [406, 'gale', 5], [407, 'shieldPct', 5], [408, 'war', 5], [409, 'frenzy', 5], [410, 'shield', 5], [411, 'warFlat', 5], [412, 'shieldPct', 5], [413, 'war', 5], [414, 'frenzy', 5]];
  cmb.forEach(([id, k, m], i) => R(id, k, m, i ? id - 1 : 20, 'C'));
  [[4031, 'warFlat', 403, 1], [4061, 'frenzy', 406, 3], [4081, 'war', 408, 5], [4082, 'gale', 4081, 1], [4101, 'gale', 410, 5]].forEach(([id, k, p, m]) => R(id, k, m, p, 'Cs'));
})();
const RUNE = Object.fromEntries(RUNE_SPEC.map(n => [n.id, n]));
// depth from the root sets the price; the special unlocks have TBH's prices
(function runeDepth() {
  for (const n of RUNE_SPEC) { let d = 0, p = n.p; while (p) { d++; p = RUNE[p].p; } n.depth = d; }
})();
const RUNE_PRICE = { 1: 100, 21: 50000, 24: 150000, 27: 50000, 11001: 20000, 13002: 80000, 15001: 400000, 1902001: 2500000, 13001: 1000000, 16001: 3000000, 160011: 50000000 };
const runeCost = (n, l) => Math.round((RUNE_PRICE[n.id] || 150 * Math.pow(1.75, n.depth)) * Math.pow(1.45, l));
// grid layout: main chains walk away from the root in their branch's direction, side nodes
// hang off sideways; every node takes the first free cell from its preference list
(function runeLayout() {
  const MAIN = { S: [0, 1], S2: [1, 1], N: [0, -1], NW: [-1, -1], NE: [1, -1], CH: [1, 0], G: [-1, 0], X: [-1, 0], C: [1, 0] };
  const SIDE = { Nw: [-1, 0], Ne: [1, 0], NWs: [-1, 1], NEs: [1, 1], CHs: [0, -1], Gs: [0, -1], Xs: [0, 1], Cs: [0, 1] };
  const used = new Set(), key = (x, y) => x + ',' + y;
  const place = (n, x, y) => { n.x = x; n.y = y; used.add(key(x, y)); };
  const rot = ([x, y], s) => [Math.sign(x - s * y), Math.sign(y + s * x)]; // 45° turns on the grid
  for (const n of RUNE_SPEC) {
    if (!n.p) { place(n, 0, 0); continue; }
    const P = RUNE[n.p];
    let dirs;
    if (n.branch === 'root') dirs = [n.id === 10 ? [0, -1] : [0, 1]];
    else if (MAIN[n.branch]) { const d = MAIN[n.branch]; dirs = [d, rot(d, 1), rot(d, -1), rot(rot(d, 1), 1), rot(rot(d, -1), -1)]; }
    else {
      const s = SIDE[n.branch], G = P.p ? RUNE[P.p] : null;
      const keep = !MAIN[P.branch] && G ? [Math.sign(P.x - G.x), Math.sign(P.y - G.y)] : null;
      const flip = [-s[0], -s[1]];
      dirs = [keep, s, flip, rot(s, 1), rot(s, -1), rot(flip, 1), rot(flip, -1)].filter(Boolean);
    }
    let done = false;
    for (let k = 1; k <= 4 && !done; k++) for (const [dx, dy] of dirs) {
      const x = P.x + dx * k, y = P.y + dy * k;
      if (!used.has(key(x, y))) { place(n, x, y); done = true; break; }
    }
    if (!done) { let x = P.x, y = P.y - 1; while (used.has(key(x, y))) y--; place(n, x, y); }
  }
})();
const RUNE_IDS = RUNE_SPEC.map(n => n.id);

// ---------- achievements ----------
const ACHIEVEMENTS = [];
(function buildAch() {
  const add = (id, name, text, test, reward) => ACHIEVEMENTS.push({ id, name, text, test, reward });
  [[100, '初出茅庐'], [1000, '小有名气'], [10000, '百战老手'], [100000, '万人斩'], [1000000, '传奇猎人']].forEach(([n, name], i) => add('kill' + i, name, `击杀 ${fmt(n)} 只怪物`, s => s.stats.kills >= n, { gold: 300 * Math.pow(12, i) }));
  DIFFS.forEach((D, d) => [1, 2, 3].forEach(a => add(`act${d}_${a}`, `${D.name}·第 ${a} 幕`, `通关${D.name} ${a}-10`, s => s.prog.best[d] >= a * STAGES, { chest: 2, n: 1 })));
  [10, 30, 50, 70, 90, 100].forEach((L, i) => add('lv' + i, `${L} 级英雄`, `任意英雄达到 ${L} 级`, s => Object.values(s.heroes).some(h => h.lv >= L), { gold: 200 * SC(L) }));
  [3, 4, 5, 6, 7, 8, 9].forEach(g => add('grade' + g, `${GRADES[g].name}之光`, `获得一件${GRADES[g].name}装备`, s => (s.stats.bestGrade || 0) >= g, { chest: 2, n: 1 }));
  [2, 3].forEach(n => add('party' + n, `${n} 人小队`, `队伍里有 ${n} 名英雄`, s => s.party.filter(Boolean).length >= n, { chest: 1, n: 2 }));
  add('allhero', '全员集结', '解锁全部六名英雄', s => CLASS_IDS.every(c => s.heroes[c]), { chest: 2, n: 2 });
  [[10, '开箱新手'], [500, '开箱达人'], [10000, '开箱狂人']].forEach(([n, name], i) => add('open' + i, name, `打开 ${fmt(n)} 个宝箱`, s => s.stats.opened >= n, { chest: 1, n: 1 + i * 2 }));
  [[1, '第一次合成'], [100, '合成工匠'], [1000, '合成大师']].forEach(([n, name], i) => add('synth' + i, name, `合成 ${n} 次`, s => s.stats.synth >= n, { gold: [2e3, 2e6, 2e9][i] }));
  [[10, '魔方学徒'], [40, '魔方行家'], [70, '魔方宗师']].forEach(([L, name], i) => add('cube' + i, name, `魔方达到 ${L} 级`, s => s.cube.lv >= L, { gold: 500 * SC(L) }));
  [[20, '符文学徒'], [80, '符文大师'], [197, '符文之主']].forEach(([n, name], i) => add('rune' + i, name, `点亮 ${n} 个符文`, s => Object.keys(s.runes).length >= n, { gold: [5e3, 5e6, 1e9][i] }));
  [[1, '第一只宠物'], [8, '宠物大师']].forEach(([n, name], i) => add('pet' + i, name, `收集 ${n} 只宠物`, s => Object.keys(s.pets.own).length >= n, { chest: 1, n: 2 + i * 4 }));
})();

// ---------- offline (TBH: needs 安眠, 8 hours, gold + experience only) ----------
const OFFLINE_H = 8, OFFLINE_RATE = 0.5;
