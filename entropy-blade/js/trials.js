'use strict';
const DIFFICULTIES = {
  normal: { name: '普通模式', clearHeal: 0.5, maxHpMul: 1.2, damageTakenMul: 0.85, roomShield: 0.15, pdWindowMul: 1.4, supplyHealMul: 1.3, chargeTimeMul: 0.75, killHeal: 2 },
  hard: { name: '困难模式', clearHeal: 0.3, maxHpMul: 1.1, damageTakenMul: 0.95, roomShield: 0.08, pdWindowMul: 1.2, supplyHealMul: 1.15, chargeTimeMul: 0.9, killHeal: 1 },
};
function difficultyBuffs(id) {
  const d = DIFFICULTIES[id === 'hard' ? 'hard' : 'normal'];
  const pct = n => Math.round(n * 100);
  return [
    `通关回复已损失生命的${pct(d.clearHeal)}%`,
    `最大生命 +${pct(d.maxHpMul - 1)}%`,
    `受到伤害 -${pct(1 - d.damageTakenMul)}%`,
    `战斗关卡入场护盾：最大生命的${pct(d.roomShield)}%`,
    `见切判定窗口 +${pct(d.pdWindowMul - 1)}%`,
    `药水、休憩治疗量 +${pct(d.supplyHealMul - 1)}%`,
    `蓄满耗时 -${pct(1 - d.chargeTimeMul)}%`,
    `每击杀一个怪物回复${d.killHeal}点生命`,
  ];
}
function curDifficulty() {
  if (!G.run || G.run.hard) return null;
  return DIFFICULTIES[G.run.mode === 'hard' ? 'hard' : 'normal'];
}

// =====================================================================
//  劫难挑战 — opt-in debuffs (劫数) that raise the 劫难值, which in turn
//  unlocks boons (福缘) so skilled players get a richer, stronger run
// =====================================================================
const CURSES = [
  { id: 'fierce', name: '凶煞', icon: 'skull', pts: [2, 4, 6], desc: lv => `敌人生命 +${[25, 50, 80][lv - 1]}%` },
  { id: 'edge', name: '锋芒', icon: 'sword', pts: [2, 4, 6], desc: lv => `敌人伤害 +${[20, 40, 70][lv - 1]}%` },
  { id: 'haste', name: '疾风骤雨', icon: 'wing', pts: [3, 6], desc: lv => `敌人行动速度 +${[15, 30][lv - 1]}%` },
  { id: 'barrage', name: '箭雨', icon: 'star', pts: [2, 4], desc: lv => `敌方弹幕速度 +${[25, 50][lv - 1]}%` },
  { id: 'elite', name: '精英横行', icon: 'crown', pts: [2, 5], desc: lv => (lv === 1 ? '每个战斗房间额外出现一名精英' : '额外出现两名精英，且精英生命 +30%') },
  { id: 'reinforce', name: '增援', icon: 'chain', pts: [3], desc: () => '每个战斗房间多一波敌人' },
  { id: 'boss', name: '首领觉醒', icon: 'flame', pts: [3, 6], desc: lv => (lv === 1 ? '首领生命 +30%，更早进入狂暴' : '首领生命 +60%、行动更快，开场即狂暴') },
  { id: 'wither', name: '枯木', icon: 'drop', pts: [2, 4], desc: lv => `所有治疗效果 -${[40, 75][lv - 1]}%` },
  { id: 'drain', name: '灵涸', icon: 'orb', pts: [2, 4], desc: lv => `灵力恢复 -${[40, 70][lv - 1]}%，命中回灵 -${[25, 50][lv - 1]}%` },
  { id: 'frail', name: '断念', icon: 'heart', pts: [3], desc: () => '最大生命 -25%，且天赋「复苏」失效' },
  { id: 'fog', name: '迷雾', icon: 'eye', pts: [2], desc: () => '看不到门后的奖励' },
  { id: 'poverty', name: '贫者', icon: 'coin', pts: [1], desc: () => '商店价格 +40%' },
];
const TRIAL_START_GOLD = 100;
const TRIAL_SHOP_BARGAIN_CHANCE = 0.2;
const BOONS = [
  { pts: 3, name: '每局额外复活一次', icon: 'phoenix' },
  { pts: 6, name: '金币 +30%', icon: 'coin' },
  { pts: 9, name: '武学机缘：每个场景额外多一次武学', icon: 'scroll' },
  { pts: 12, name: `开局获得额外金币 +${TRIAL_START_GOLD}`, icon: 'coin' },
  { pts: 16, name: '商店打8折', icon: 'ring' },
  { pts: 20, name: '首领额外掉落一枚稀有刻印', icon: 'star' },
  { pts: 25, name: '开局额外参悟一次武学', icon: 'sword' },
  { pts: 30, name: '伤害 +15%，商店有概率在部分商品上打一折', icon: 'fist' },
  { pts: 40, name: '熵晶 ×2 · 通关获得称号「劫主」', icon: 'phoenix' },
];
const TRIAL_RANKS = [[0, '常世', '#c8c0e0'], [1, '小劫', '#7fe8c8'], [10, '中劫', '#5aa8ff'], [20, '大劫', '#c46aff'], [30, '天劫', '#ff8a3a'], [40, '劫主', '#ff3048']];
function trialRank(pts) { let r = TRIAL_RANKS[0]; for (const k of TRIAL_RANKS) if (pts >= k[0]) r = k; return { name: r[1], col: r[2] }; }
function trialPoints(sel) { let pts = 0; for (const c of CURSES) { const lv = sel[c.id] || 0; if (lv) pts += c.pts[lv - 1]; } return pts; }
// fold the chosen curses + earned boons into one modifier table for the run
function trialConfig(sel) {
  sel = sel || {};
  const L = id => Math.min(sel[id] || 0, (CURSES.find(c => c.id === id) || { pts: [] }).pts.length);
  const pts = trialPoints(sel);
  const m = {
    pts, sel: Object.assign({}, sel),
    enemyHp: 1 + [0, 0.25, 0.5, 0.8][L('fierce')], enemyDmg: 1 + [0, 0.2, 0.4, 0.7][L('edge')],
    enemySpeed: 1 + [0, 0.15, 0.3][L('haste')], projSpeed: 1 + [0, 0.25, 0.5][L('barrage')],
    eliteExtra: [0, 1, 2][L('elite')], eliteHp: L('elite') >= 2 ? 1.3 : 1, extraWave: L('reinforce'),
    bossHp: 1 + [0, 0.3, 0.6][L('boss')], bossHaste: L('boss') >= 2 ? 1.15 : 1, bossPhase2: [0.55, 0.75, 1.01][L('boss')],
    healMul: 1 - [0, 0.4, 0.75][L('wither')], manaRegen: 1 - [0, 0.4, 0.7][L('drain')], manaGain: 1 - [0, 0.25, 0.5][L('drain')],
    maxHpMul: L('frail') ? 0.75 : 1, noRevive: !!L('frail'), fog: !!L('fog'), price: L('poverty') ? 1.4 : 1,
    crystalMul: 1 + pts * 0.02, goldMul: 0, artBonus: 0, revives: 0, startGold: 0, rerolls: 0, discount: 1, bossSigil: false, startArt: false, dmgMul: 1, shopBargainChance: 0,
  };
  if (pts >= 3) m.revives = 1;
  if (pts >= 6) m.goldMul += 0.3;
  if (pts >= 9) m.artBonus = 1;
  if (pts >= 12) m.startGold = TRIAL_START_GOLD;
  if (pts >= 16) m.discount = 0.8;
  if (pts >= 20) m.bossSigil = true;
  if (pts >= 25) m.startArt = true;
  if (pts >= 30) { m.dmgMul = 1.15; m.shopBargainChance = TRIAL_SHOP_BARGAIN_CHANCE; }
  if (pts >= 40) m.crystalMul *= 2;
  return m;
}
function curHard() { return (G.run && G.run.hard) || null; }
