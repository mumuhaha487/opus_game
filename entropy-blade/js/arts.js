'use strict';
// =====================================================================
//  HEROES (4/4) — loadout registries. Arts, skills and secrets are all
//  武学: one reward pool, one Lv1–4 ladder (see WX_* below).
//   ARTS    武技  (↑/↓/冲刺 + 攻击; a 4-move chain 起手 → 派生 → 连段 → 终式)
//   USKILLS 技能  (U / ↑U / ↓U / 冲刺U; free, no cooldown; up to three stages)
//   SKILLS  秘技  (I + direction, costs 灵力 mana; Lv2 派生, Lv3 进化)
//   WEAPONS 武器  (chosen on the character screen)
//   TECHS   招式解锁
//  plus move list, reward offers and sprite baking
// =====================================================================
const pctL = (base, lv) => Math.round(base * 100 * (1 + 0.35 * (lv - 1))) + '%';

// ---------------- input slots ----------------
const SECRET_SLOTS = [
  { id: 'stand', name: '静止', input: '静止 I', long: '地面静止时按 I' },
  { id: 'move', name: '移动', input: '→ I', long: '移动中按 I' },
  { id: 'up', name: '上', input: '↑ I', long: '↑ + I' },
  { id: 'down', name: '下', input: '↓ I', long: '↓ + I（奥义）' },
  { id: 'air', name: '空中', input: '空中 I', long: '空中按 I' },
];
const ART_SLOTS = [
  { id: 'up', name: '上段', input: '↑ 攻击', long: '↑ + 攻击' },
  { id: 'down', name: '下段', input: '↓ 攻击', long: '↓ + 攻击' },
  { id: 'dash', name: '突进', input: '冲刺 攻击', long: '冲刺中按攻击' },
];
const U_SLOTS = [
  { id: 'shot', name: '远程', input: 'U', long: '按 U（远程）' },
  { id: 'up', name: '上', input: '↑ U', long: '↑ + U' },
  { id: 'down', name: '下', input: '↓ U', long: '↓ + U' },
  { id: 'dash', name: '冲刺', input: '冲刺 U', long: '冲刺中按 U' },
];
const slotInfo = (list, id) => list.find(s => s.id === id);

// ---------------- 武学 levels ----------------
// Every 武学 (武技 / 技能 / 秘技) carries its own ladder (WX_LEVELS, below the registries):
// its own number of levels (1–3), its own unlocks per level and, on some levels, a
// signature effect (WX_PERKS) that no other 武学 shares.
const WX_FAM = {
  art: { name: '武技', col: '#ff8a5a' },
  u: { name: '技能', col: '#7fe8a8' },
  sk: { name: '秘技', col: '#5ad8ff' },
};

// =====================================================================
//  秘技 SKILLS
// =====================================================================
const SKILLS = {};
function SK(o) { SKILLS[o.id] = o; }

// ----------------------------- RIN -----------------------------
SK({ id: 'rin_parry', hero: 'rin', slot: 'stand', def: true, name: '燕返架势', icon: 'shield', move: 'sk_parry', cost: 20,
  desc: lv => `架刀 0.6 秒，受到攻击则格挡并发动「燕返」反击（${pctL(3.2, lv)}，必定暴击）并进入子弹时间${lv >= 3 ? '；反击同时向两侧释放冲击波' : ''}`,
  follow: 'f_parry', fname: '残月', fdesc: '架势或燕返中再按 I：挥出贯穿的巨大残月剑气', evo: '子弹时间延长，反击附带双向冲击波' });
SK({ id: 'rin_iai', hero: 'rin', slot: 'stand', name: '居合·断', icon: 'sword', move: 'sk_iai', cost: 35,
  desc: lv => `霸体蓄势 0.45 秒，瞬斩前方 230 像素内所有敌人（${pctL(3.6, lv)}）并穿越至终点${lv >= 3 ? '；追加一记回身斩' : ''}`,
  follow: 'f_iai', fname: '纳刀', fdesc: '居合后再按 I：收刀入鞘，斩痕处再爆发 4 次斩击', evo: '追加一记回身斩' });
SK({ id: 'rin_shadow', hero: 'rin', slot: 'move', def: true, name: '影闪', icon: 'wing', move: 'sk_shadow', cost: 20,
  desc: lv => `瞬身穿过前方敌人（无敌），随后在路径上爆发 ${lv >= 3 ? 5 : 3} 次斩击（各 ${pctL(1.0, lv)}）`,
  follow: 'f_shadow', fname: '影返', fdesc: '影闪后再按 I：折返穿回原位，沿途再斩', evo: '斩击次数提升为 5 次' });
SK({ id: 'rin_flurry', hero: 'rin', slot: 'move', name: '千鸟', icon: 'feather', move: 'sk_flurry', cost: 25,
  desc: lv => `向前连续突刺（每段 ${pctL(0.32, lv)}），最后一记重刺 ${pctL(1.5, lv)}${lv >= 3 ? '；突刺频率提升' : ''}`,
  follow: 'f_flurry', fname: '穿云', fdesc: '千鸟后再按 I：突刺射出三道扇形贯穿剑气', evo: '突刺频率大幅提升' });
SK({ id: 'rin_meteor', hero: 'rin', slot: 'up', def: true, name: '天降一闪', icon: 'meteor', move: 'sk_meteor', cost: 30,
  desc: lv => `跃上高空后俯冲斩向最近的敌人，落地造成 ${pctL(2.8, lv)} 范围伤害，全程无敌${lv >= 3 ? '；落地后两侧升起刀刃柱' : ''}`,
  follow: 'f_meteor', fname: '燕翔', fdesc: '落地后再按 I：拔地而起的升龙斩，挑飞周围敌人', evo: '落地后两侧升起刀刃柱' });
SK({ id: 'rin_whirl', hero: 'rin', slot: 'up', name: '旋风刃', icon: 'ring', move: 'sk_whirl', cost: 30,
  desc: lv => `化作刀刃旋风约 ${lv >= 3 ? 1.4 : 1} 秒，可移动并吸引周围敌人，持续切割（每段 ${pctL(0.42, lv)}）`,
  follow: 'f_whirl', fname: '风卷', fdesc: '旋风中再按 I：卷起龙卷升空斩，挑飞所有被卷入的敌人', evo: '持续时间与范围提升' });
SK({ id: 'rin_wave', hero: 'rin', slot: 'air', def: true, name: '飞燕斩', icon: 'wave', move: 'sk_wave', cost: 20,
  desc: lv => `挥出贯穿的剑气（${pctL(1.6, lv)}，空中时斜向下）${lv >= 2 ? '，并追加第二道剑气' : ''}${lv >= 3 ? '；主剑气分裂为三道扇形' : ''}`,
  follow: 'f_wave', fname: '双燕', fdesc: '飞燕斩后再按 I：交叉挥出 X 形双剑气', evo: '剑气分裂为三道扇形' });
SK({ id: 'rin_petal', hero: 'rin', slot: 'air', name: '樱吹雪', icon: 'flower', move: 'sk_petal', cost: 30,
  desc: lv => `在前方召唤樱花刃风 ${lv >= 2 ? 3.4 : 2.6} 秒，持续造成伤害（每 0.22 秒 ${pctL(0.4, lv)}）并减速敌人${lv >= 3 ? '；刃风跟随自身' : ''}`,
  follow: 'f_petal', fname: '散华', fdesc: '施放后再按 I：令所有刃风爆散（各 ' + '250%）', evo: '刃风跟随自身移动' });
SK({ id: 'rin_ult', hero: 'rin', slot: 'down', def: true, ult: true, name: '月华千斩', icon: 'star', move: 'ult', cost: 70,
  desc: lv => `化身月影，对画面内所有敌人施加 16 次斩击（各 ${pctL(0.65, lv)}），最后一记横断天地（${pctL(3.5, lv)}）${lv >= 3 ? '；终斩后月痕再次爆发' : ''}`,
  evo: '终斩后月痕再次爆发' });
SK({ id: 'rin_sakura', hero: 'rin', slot: 'down', ult: true, name: '八重樱·镇魂', icon: 'flower', move: 'ult2', cost: 75,
  desc: lv => `插刀入地，召唤樱花刃岚席卷前方 2.2 秒（每段 ${pctL(0.5, lv)}，强力吸引），最后万樱齐落（${pctL(3.0, lv)}）${lv >= 3 ? '；刃岚范围覆盖全屏' : ''}`,
  evo: '刃岚范围覆盖全屏' });
// ----------------------------- EVE -----------------------------
SK({ id: 'eve_snipe', hero: 'eve', slot: 'stand', def: true, name: '魔弹狙击', icon: 'eye', move: 'sk_snipe', cost: 30,
  desc: lv => `霸体瞄准 0.5 秒，射出贯穿全屏的魔弹（${pctL(4.0, lv)}，暴击率 +30%）${lv >= 3 ? '；每个命中的敌人处引发爆炸' : ''}`,
  follow: 'f_snipe', fname: '追击狙', fdesc: '狙击后再按 I：瞬间补射第二发魔弹', evo: '命中处引发爆炸' });
SK({ id: 'eve_turret', hero: 'eve', slot: 'stand', name: '浮游炮台', icon: 'clock', move: 'sk_turret', cost: 35,
  desc: lv => `召唤浮游炮台跟随 ${lv >= 3 ? 10 : 7} 秒，自动射击最近的敌人（各 ${pctL(0.5, lv)}）${lv >= 2 ? '，每次双发' : ''}`,
  follow: 'f_turret', fname: '齐射', fdesc: '施放后再按 I：炮台一次射出 8 枚追踪导弹', evo: '射速提升、持续 10 秒' });
SK({ id: 'eve_backflip', hero: 'eve', slot: 'move', def: true, name: '后跃速射', icon: 'wing', move: 'sk_backflip', cost: 15,
  desc: lv => `后空翻拉开距离（短暂无敌），同时向前下方连射（各 ${pctL(0.85, lv)}）${lv >= 2 ? '，弹数增加' : ''}${lv >= 3 ? '；子弹命中时爆炸' : ''}`,
  follow: 'f_backflip', fname: '流星踢', fdesc: '空翻中再按 I：俯冲飞踢，落点爆炸', evo: '子弹命中时爆炸' });
SK({ id: 'eve_grenade', hero: 'eve', slot: 'move', name: '爆裂榴弹', icon: 'burst', move: 'sk_grenade', cost: 20,
  desc: lv => `投掷榴弹，爆炸造成 ${pctL(2.6, lv)} 范围伤害并击飞${lv >= 2 ? '；额外投出两枚子母弹' : ''}${lv >= 3 ? '；爆炸后留下燃烧区域' : ''}`,
  follow: 'f_grenade', fname: '引信', fdesc: '投掷后再按 I：射击引爆空中所有榴弹，爆炸范围 +50%', evo: '爆炸后留下燃烧区域' });
SK({ id: 'eve_rain', hero: 'eve', slot: 'up', def: true, name: '星落弹雨', icon: 'storm', move: 'sk_rain', cost: 30,
  desc: lv => `跃至高空向下倾泻弹雨（各 ${pctL(0.42, lv)}）${lv >= 2 ? '，弹幕更密' : ''}${lv >= 3 ? '；最后射出一枚爆裂魔弹' : ''}`,
  follow: 'f_rain', fname: '坠星', fdesc: '弹雨中再按 I：化作流星直坠地面，引发星爆', evo: '最后射出爆裂魔弹' });
SK({ id: 'eve_missile', hero: 'eve', slot: 'up', name: '追踪弹幕', icon: 'meteor', move: 'sk_missile', cost: 30,
  desc: lv => `向上发射 ${lv >= 2 ? 10 : 6} 枚追踪导弹（各 ${pctL(1.0, lv)}，命中爆炸）${lv >= 3 ? '；爆炸范围扩大' : ''}`,
  follow: 'f_missile', fname: '二次齐射', fdesc: '发射后再按 I：追加一轮 8 枚导弹', evo: '爆炸范围扩大' });
SK({ id: 'eve_kata', hero: 'eve', slot: 'air', def: true, name: '枪舞', icon: 'star', move: 'sk_kata', cost: 30,
  desc: lv => `霸体滞空旋转，向四周倾泻子弹约 ${lv >= 3 ? 1.4 : 1} 秒（各 ${pctL(0.35, lv)}）${lv >= 2 ? '，射速提升' : ''}`,
  follow: 'f_kata', fname: '终幕', fdesc: '枪舞中再按 I：向四周射出 16 枚爆裂魔弹', evo: '持续时间延长' });
SK({ id: 'eve_mine', hero: 'eve', slot: 'air', name: '束缚地雷', icon: 'orb', move: 'sk_mine', cost: 15,
  desc: lv => `向下方布置地雷（最多 ${lv >= 2 ? 3 : 2} 枚），敌人靠近时爆炸造成 ${pctL(2.4, lv)} 伤害并眩晕 1.5 秒${lv >= 3 ? '；爆炸范围扩大' : ''}`,
  follow: 'f_mine', fname: '雷暴', fdesc: '布雷后再按 I：立即引爆场上全部地雷', evo: '爆炸范围扩大' });
SK({ id: 'eve_ult', hero: 'eve', slot: 'down', def: true, ult: true, name: '湮灭光炮', icon: 'star', move: 'ult', cost: 70,
  desc: lv => `展开魔导炮，向前方释放持续 1.6 秒的毁灭光束（每段 ${pctL(0.5, lv)}）${lv >= 3 ? '；光束结束时沿线引发连环爆炸' : ''}`,
  evo: '光束结束时沿线引发连环爆炸' });
SK({ id: 'eve_meteor', hero: 'eve', slot: 'down', ult: true, name: '天狼星陨', icon: 'meteor', move: 'ult2', cost: 75,
  desc: lv => `向天穹射出信号弹，召唤 ${lv >= 3 ? 16 : 12} 颗星陨轰击画面内的敌人（各 ${pctL(1.4, lv)}，范围爆炸）`,
  evo: '星陨数量提升为 16 颗' });
// ----------------------------- GAO -----------------------------
SK({ id: 'gao_iron', hero: 'gao', slot: 'stand', def: true, name: '金刚身', icon: 'shield', move: 'sk_iron', cost: 30,
  desc: lv => `${lv >= 2 ? 4.5 : 3.2} 秒内霸体且受到伤害 -40%，受击时自动震开周围敌人${lv >= 3 ? '；结束时释放金刚爆发' : ''}`,
  follow: 'f_iron', fname: '金刚掌', fdesc: '运功后再按 I：双掌推出，向两侧释放金刚冲击', evo: '结束时释放金刚爆发' });
SK({ id: 'gao_ki', hero: 'gao', slot: 'stand', name: '气功波', icon: 'orb', move: 'sk_ki', cost: 25,
  desc: lv => `凝聚气劲射出贯穿气弹（${pctL(2.6, lv)}），消散时爆炸${lv >= 2 ? '；气弹更大、贯穿更多' : ''}${lv >= 3 ? '；爆炸分裂为三枚气弹' : ''}`,
  follow: 'f_ki', fname: '连环气功', fdesc: '发功后再按 I：左右连推两记气弹', evo: '爆炸分裂为三枚气弹' });
SK({ id: 'gao_charge', hero: 'gao', slot: 'move', def: true, name: '震地冲锋', icon: 'fist', move: 'sk_charge', cost: 20,
  desc: lv => `霸体冲锋拖拽沿途敌人，终结时引发 ${pctL(2.0, lv)} 冲击爆炸${lv >= 2 ? '（范围扩大）' : ''}${lv >= 3 ? '并向前释放冲击波' : ''}`,
  follow: 'f_charge', fname: '顶天', fdesc: '冲锋后再按 I：烈焰顶天拳，挑飞前方敌人', evo: '终结时追加冲击波' });
SK({ id: 'gao_grab', hero: 'gao', slot: 'move', name: '山崩投', icon: 'hand', move: 'sk_grab', cost: 25,
  desc: lv => `抓住前方敌人抡起砸地（${pctL(3.8, lv)}）并震荡周围；对首领改为重击${lv >= 3 ? '；追加一次余震' : ''}`,
  follow: 'f_grab', fname: '追身踏', fdesc: '投掷后再按 I：腾空踏向最近的敌人，落地震裂', evo: '砸地后追加余震' });
SK({ id: 'gao_dragon', hero: 'gao', slot: 'up', def: true, name: '升龙拳', icon: 'flame', move: 'sk_dragon', cost: 30,
  desc: lv => `烈焰升龙连击上挑敌人，最后重击 ${pctL(2.0, lv)}${lv >= 3 ? '；随后坠地引发冲击' : ''}`,
  follow: 'f_dragon', fname: '龙坠', fdesc: '升龙后再按 I：倒转身形俯冲砸拳，引发大地震', evo: '落下时追加坠地冲击' });
SK({ id: 'gao_split', hero: 'gao', slot: 'up', name: '地裂', icon: 'spike', move: 'sk_split', cost: 25,
  desc: lv => `捶击地面，前方依次升起 ${lv >= 2 ? 9 : 6} 根岩刺（各 ${pctL(1.0, lv)}，击飞）${lv >= 3 ? '；前后两侧同时' : ''}`,
  follow: 'f_split', fname: '岩崩', fdesc: '捶地后再按 I：两侧轰出巨型岩柱', evo: '前后两侧同时升起岩刺' });
SK({ id: 'gao_kick', hero: 'gao', slot: 'air', def: true, name: '旋风腿', icon: 'ring', move: 'sk_kick', cost: 25,
  desc: lv => `腾空旋转踢击并向前推进（每段 ${pctL(0.5, lv)}）${lv >= 2 ? '，推进更快' : ''}${lv >= 3 ? '，持续时间延长' : ''}`,
  follow: 'f_kick', fname: '落雷脚', fdesc: '旋风中再按 I：高举脚跟劈落，落地震荡', evo: '持续时间延长' });
SK({ id: 'gao_fists', hero: 'gao', slot: 'air', name: '百裂拳', icon: 'burst', move: 'sk_fists', cost: 30,
  desc: lv => `霸体滞空连续出拳（各 ${pctL(0.28, lv)}），最后一记崩拳 ${pctL(1.9, lv)}${lv >= 2 ? '并打出拳风' : ''}${lv >= 3 ? '；出拳更快' : ''}`,
  follow: 'f_fists', fname: '崩山拳', fdesc: '百裂后再按 I：打出贯穿的巨大拳劲', evo: '出拳速度提升' });
SK({ id: 'gao_ult', hero: 'gao', slot: 'down', def: true, ult: true, name: '霸王崩拳', icon: 'star', move: 'ult', cost: 70,
  desc: lv => `凝聚全身气劲，打出贯穿全屏的巨拳（${pctL(6, lv)}）并震撼大地${lv >= 3 ? '；随后追加第二记反向巨拳' : ''}`,
  evo: '追加第二记反向巨拳' });
SK({ id: 'gao_mountain', hero: 'gao', slot: 'down', ult: true, name: '镇岳', icon: 'spike', move: 'ult2', cost: 75,
  desc: lv => `跃起擎举山岳虚影砸向大地：落点造成 ${pctL(5, lv)} 伤害，画面内地面敌人受到 ${pctL(2, lv)} 震荡并眩晕${lv >= 3 ? '；落地后升起环形岩刺' : ''}`,
  evo: '落地后升起环形岩刺' });

// =====================================================================
//  技能 USKILLS — U + direction. Free (no 灵力) and no cooldown: each stage's
//  recovery is what paces it, so damage is tuned per second of commitment.
//  moves[k] is stage k+1; which stages a level opens is set per skill in
//  WX_LEVELS — press U again during or right after a stage for the next one.
//  Moves live in moves_u.js.
// =====================================================================
const USKILLS = {};
function USK(o) { USKILLS[o.id] = o; }
// ----------------------------- RIN -----------------------------
USK({ id: 'rin_u_shot', hero: 'rin', slot: 'shot', name: '飞刃', icon: 'wave', moves: ['u_rin_shot1', 'u_rin_shot2', 'u_rin_shot3'],
  stages: ['甩出贯穿的月牙剑气（100%）', '交叉刃：X 形双剑气（各 65%）', '千刃：五道扇形剑气齐发（各 55%），借势后跃'] });
USK({ id: 'rin_u_up', hero: 'rin', slot: 'up', name: '升月', icon: 'meteor', moves: ['u_rin_up1', 'u_rin_up2', 'u_rin_up3'],
  stages: ['小跃并斜上斩出对空月牙（130%，挑飞）', '月轮：抛出悬停的刃轮，持续切割空中敌人', '坠月：巨大月刃自天而降砸向前方（340%）'] });
USK({ id: 'rin_u_down', hero: 'rin', slot: 'down', name: '地走刃', icon: 'spike', moves: ['u_rin_down1', 'u_rin_down2', 'u_rin_down3'],
  stages: ['刀尖划地，贴地疾走的刃波（110%，挑飞）', '刃林：沿路依次迸出四道刀刃（各 120%）', '断地：前后两侧同时迸出刀刃（各 100%）'] });
USK({ id: 'rin_u_dash', hero: 'rin', slot: 'dash', name: '影刃', icon: 'feather', moves: ['u_rin_dash1', 'u_rin_dash2', 'u_rin_dash3'],
  stages: ['冲刺中掷出三柄影刃（各 60%，贯穿）', '回刃：影刃折返飞回，沿途再斩', '影杀：瞬身穿过前方所有敌人并连斩'] });
// ----------------------------- EVE -----------------------------
USK({ id: 'eve_u_shot', hero: 'eve', slot: 'shot', name: '魔弹', icon: 'eye', moves: ['u_eve_shot1', 'u_eve_shot2', 'u_eve_shot3'],
  stages: ['射出贯穿两名敌人的重魔弹（100%）', '三连魔弹：瞬间补射三发（各 50%）', '星爆弹：爆炸（100%）并迸射 8 枚碎片'] });
USK({ id: 'eve_u_up', hero: 'eve', slot: 'up', name: '照明星', icon: 'star', moves: ['u_eve_up1', 'u_eve_up2', 'u_eve_up3'],
  stages: ['斜上射出照明弹，炸开后落下 7 颗星弹（各 60%）', '双星：再射两枚照明弹覆盖更远', '流星雨：前方倾泻 14 颗流星（各 80%）'] });
USK({ id: 'eve_u_down', hero: 'eve', slot: 'down', name: '跳雷', icon: 'orb', moves: ['u_eve_down1', 'u_eve_down2', 'u_eve_down3'],
  stages: ['贴地抛出弹跳雷，碰到敌人即爆（90%）', '连锁雷：再抛两枚不同弹道的跳雷', '雷阵：身周布下五枚地雷依次引爆（各 70%，短暂眩晕）'] });
USK({ id: 'eve_u_dash', hero: 'eve', slot: 'dash', name: '回旋射击', icon: 'ring', moves: ['u_eve_dash1', 'u_eve_dash2', 'u_eve_dash3'],
  stages: ['冲刺中旋身，向四周射出 8 发子弹（各 50%）', '交叉火力：斜向两道贯穿速射（各 45%）', '幻影齐射：两道幻影连射魔弹（各 35%）'] });
// ----------------------------- GAO -----------------------------
USK({ id: 'gao_u_shot', hero: 'gao', slot: 'shot', name: '气弹', icon: 'orb', moves: ['u_gao_shot1', 'u_gao_shot2', 'u_gao_shot3'],
  stages: ['推掌打出贯穿气弹（110%，击退）', '双掌气弹：上下两记更大的气弹（各 80%）', '气功炮：短距巨型气劲炮（220%）'] });
USK({ id: 'gao_u_up', hero: 'gao', slot: 'up', name: '升龙气', icon: 'flame', moves: ['u_gao_up1', 'u_gao_up2', 'u_gao_up3'],
  stages: ['上勾拳卷起吸人的气旋（挑飞，持续切割）', '双气旋：更远处再卷起两道', '炎龙：三道烈焰龙柱冲天（各 160%）'] });
USK({ id: 'gao_u_down', hero: 'gao', slot: 'down', name: '震地', icon: 'spike', moves: ['u_gao_down1', 'u_gao_down2', 'u_gao_down3'],
  stages: ['重踏地面，向两侧推出冲击波（各 140%）', '岩刺：两侧依次升起岩刺（各 70%）', '地震：周围地面敌人受 160% 伤害并短暂眩晕'] });
USK({ id: 'gao_u_dash', hero: 'gao', slot: 'dash', name: '猛虎掌', icon: 'fist', moves: ['u_gao_dash1', 'u_gao_dash2', 'u_gao_dash3'],
  stages: ['冲刺中推出虎形掌劲（150%，贯穿）', '双虎掌：更大的第二记掌劲（160%），重击破防', '虎啸：震天咆哮，冲击环眩晕周围（180%）'] });

// =====================================================================
//  武技 ARTS — direction + attack. A 4-move chain (起手 → 派生 → 连段 → 终式);
//  how many links each level opens is set per art in WX_LEVELS
// =====================================================================
const ARTS = {};
function ART(o) { ARTS[o.id] = o; }
const ART_LV_TAG = ['起手', '派生', '连段', '终式'];
// ----------------------------- RIN -----------------------------
ART({ id: 'rin_swallow', hero: 'rin', slot: 'up', name: '飞燕连', icon: 'wing', moves: ['swallow1', 'swallow2', 'swallow3', 'swallow4'],
  lv: ['飞身斜上挑斩并放出上弦剑气', '空中回身二连斩，维持滞空', '空中三段旋斩，卷住周围敌人', '燕落·断空：斜劈俯冲落地，两侧放出剑气'] });
ART({ id: 'rin_blossom', hero: 'rin', slot: 'up', name: '昇樱', icon: 'flower', moves: ['blossom1', 'blossom2', 'blossom3', 'blossom4'],
  lv: ['原地斩出冲天的樱刃柱（远距对空）', '踏前双重上挑，挑飞敌人', '跃起连落三道樱花斩', '千本樱：落地后前方依次升起五道樱刃柱'] });
ART({ id: 'rin_sweep', hero: 'rin', slot: 'down', name: '地走', icon: 'wave', moves: ['sweep1', 'sweep2', 'sweep3', 'sweep4'],
  lv: ['低身横扫，放出贴地疾走的刃波', '返身扫斩，同时打击前后', '刃轮：贴地旋斩前进三段', '断地：腾身劈地，前方连续迸出刀刃'] });
ART({ id: 'rin_shade', hero: 'rin', slot: 'down', name: '影缝', icon: 'eye', moves: ['shade1', 'shade2', 'shade3', 'shade4'],
  lv: ['低身突刺，钉住敌人影子（减速并打上影印）', '影踏：后跃留下会爆炸的残影', '影刺：瞬移贯穿最近的影印敌人', '影葬：画面内所有影印敌人同时被斩'] });
ART({ id: 'rin_raiden', hero: 'rin', slot: 'dash', name: '紫电', icon: 'storm', moves: ['raiden1', 'raiden2', 'raiden3', 'raiden4'],
  lv: ['紫电一闪：长距离雷光突刺，迟滞落雷', '回闪：折返再次穿刺', '雷切：上挑雷斩，引落三道雷击', '万雷：落地召唤雷暴轰击周围所有敌人'] });
ART({ id: 'rin_gale', hero: 'rin', slot: 'dash', name: '追风', icon: 'feather', moves: ['gale1', 'dashAtk2', 'gale3', 'gale4'],
  lv: ['追风斩：携带冲刺惯性的三段风斩', '燕返：上挑追击，跃入空中', '旋空：空中回旋斩，范围打击', '风神落：俯冲落地，留下吸附敌人的风暴'] });
// ----------------------------- EVE -----------------------------
ART({ id: 'eve_sky', hero: 'eve', slot: 'up', name: '天穹射击', icon: 'star', moves: ['sky1', 'sky2', 'sky3', 'sky4'],
  lv: ['升空踢击并向斜上方三连射', '倒挂射击：空中翻身向下扇形扫射', '星轮：空中旋转射出 12 发环形弹幕', '流星踵：俯冲踵落，落点星爆'] });
ART({ id: 'eve_cannon', hero: 'eve', slot: 'up', name: '魔导升炮', icon: 'burst', moves: ['cannon1', 'cannon2', 'cannon3', 'cannon4'],
  lv: ['向斜上方发射会爆炸的魔导弹（对空）', '追加两发扇形魔导弹', '雷枪：射出贯穿的雷光枪', '星爆：巨型魔导弹，爆炸分裂 10 枚碎片'] });
ART({ id: 'eve_slide', hero: 'eve', slot: 'down', name: '滑铲连击', icon: 'wing', moves: ['slide1', 'slide2', 'slide3', 'slide4'],
  lv: ['滑铲同时贴地速射，结尾挑起', '倒钩踢：上踢挑飞敌人', '旋踢连射：空中回旋踢并四射', '炸裂踵落：踵落并引发爆炸'] });
ART({ id: 'eve_trap', hero: 'eve', slot: 'down', name: '火花雷', icon: 'orb', moves: ['trap1', 'trap2', 'trap3', 'trap4'],
  lv: ['抛出触碰即爆的火花雷', '连锁雷：扇形抛出三枚', '引爆：射击地面，所有火花雷强化引爆并眩晕', '焰狱：引爆后留下燃烧烈焰并追加大爆炸'] });
ART({ id: 'eve_phantom', hero: 'eve', slot: 'dash', name: '幻影步', icon: 'eye', moves: ['phantom1', 'phantom2', 'phantom3', 'phantom4'],
  lv: ['穿过敌人并留下会开枪的幻影', '回身射：转身射出贯穿魔弹', '交叉火力：与幻影一同扫射', '幻影乱舞：四道幻影包围射击'] });
ART({ id: 'eve_buck', hero: 'eve', slot: 'dash', name: '霰弹冲锋', icon: 'burst', moves: ['buck1', 'buck2', 'buck3', 'buck4'],
  lv: ['贴身霰弹：冲入并近距离轰击', '枪托：重击破防，眩晕敌人', '双管齐发：前后同时轰击', '龙息：喷射扇形烈焰并轰出巨响'] });
// ----------------------------- GAO -----------------------------
ART({ id: 'gao_flame', hero: 'gao', slot: 'up', name: '炎龙', icon: 'flame', moves: ['flame1', 'flame2', 'flame3', 'flame4'],
  lv: ['炎升拳：带火焰的升天拳', '空中三连冲拳', '飞燕踢：空中回旋踢', '坠龙击：俯冲砸拳，落点烈焰爆炸'] });
ART({ id: 'gao_pillar', hero: 'gao', slot: 'up', name: '擎天', icon: 'spike', moves: ['pillar1', 'pillar2', 'pillar3', 'pillar4'],
  lv: ['擎天柱：拳震地面，前方升起岩柱', '双柱：更远处再升两柱', '碎岩拳：击碎岩石，碎石向前飞射', '山岳崩：踏地引落巨石'] });
ART({ id: 'gao_whirl', hero: 'gao', slot: 'down', name: '扫堂连环', icon: 'ring', moves: ['whirl1', 'whirl2', 'whirl3', 'whirl4'],
  lv: ['旋扫腿：前后两扫，挑飞敌人', '踏地：重踏震晕周围', '连环踢：前进中连踢三段', '天崩踵：高踵劈地，两侧冲击波'] });
ART({ id: 'gao_bridge', hero: 'gao', slot: 'down', name: '铁桥', icon: 'shield', moves: ['bridge1', 'bridge2', 'bridge3', 'bridge4'],
  lv: ['沉肩：霸体低身撞击，破防', '顶心肘：破防并眩晕', '贴山靠：全力肩撞，远远撞飞', '崩天掌：推出贯穿的气劲掌'] });
ART({ id: 'gao_tiger', hero: 'gao', slot: 'dash', name: '猛虎', icon: 'fist', moves: ['tiger1', 'tiger2', 'tiger3', 'tiger4'],
  lv: ['猛虎硬爬山：霸体双拳突进', '虎抱：抓住敌人摔向身后', '虎尾脚：转身后踢', '虎啸：震天咆哮，冲击环眩晕周围'] });
ART({ id: 'gao_knee', hero: 'gao', slot: 'dash', name: '飞膝', icon: 'wing', moves: ['knee1', 'knee2', 'knee3', 'knee4'],
  lv: ['腾空飞膝，斜向冲上', '双峰贯耳：空中双锤', '落雷踵：俯冲踵落', '地动：落地后前方连环地震'] });

// =====================================================================
//  武学 signature effects — each one belongs to exactly one 武学.
//  Hooks: pre (adjust the hit before damage), hit (after it lands), kill,
//  during (every frame its move runs), cast (秘技 cast); mods are read by
//  the systems they touch (reach: boxes / shots / blasts, homing, armor).
//  Effects marked "moves" live in that 武学's own move code.
// =====================================================================
const WX_PERKS = {
  // ---------------- 凛：刃、影、樱、血 ----------------
  lingkong: { name: '凌空', desc: '空中命中时恢复一次空中跳跃并短暂滞空', hit(p) { if (!p.onGround) { p.jumpsLeft = Math.max(p.jumpsLeft, 1); p.vy = Math.min(p.vy, -40); } } },
  yingyin: { name: '樱印', desc: '命中留下樱印，敌人 3 秒内受到的伤害提高', hit(p, e) { applyStatus(e, 'vuln', 3); } },
  renchang: { name: '刃长', desc: '斩击判定与刃波射程 +40%', mods: { reach: 1.4 } },
  zangjue: {
    name: '影葬·绝', desc: '命中生命低于 25% 的影印敌人时直接将其斩杀（首领除外）',
    hit(p, e, h) {
      if (e.boss || e.dead || e.hp <= 0 || !(e.st.shade > 0) || e.hp >= e.maxHp * 0.25) return;
      FX.text(e.x, e.y - e.h - 12, '斩', '#c08aff', { size: 12, life: 0.7 });
      FX.slash(e.x, e.cy, { r: 26, a0: -70, a1: 70, th: 8, c: '#c08aff', f: h.dir || 1, dur: 0.2, rot: 30 });
      hitEnemy(p, e, { dmg: e.hp, execute: true, kx: 0, ky: -220, dir: h.dir || 1, noCrit: true, noProc: true, noCombo: true, noEnergy: true, src: 'proc', fxc: '#c08aff', sfx: 'crit' }, e.x, e.cy);
    },
  },
  leihen: { name: '雷痕', desc: '命中使敌人麻痹 0.4 秒', hit(p, e) { applyStatus(e, 'stun', 0.4); FX.bolt(e.x + rand(-6, 6), e.y - e.h - 16, e.x, e.cy, '#c08aff', 0.12, 1, 4); } },
  canxin: { name: '残心', desc: '剑气暴击率 +25%', pre(p, e, h) { h.critBonus = (h.critBonus || 0) + 0.25; } },
  renji: { name: '刃迹', desc: '刃波在地面留下 1.5 秒的刀痕，持续切割踏入的敌人' },            // moves: u_rin_down1
  zhantie: { name: '斩铁', desc: '斩击破防，对首领伤害 +35%', pre(p, e, h) { h.breakGuard = true; if (e.boss) h.dmg *= 1.35; } },
  yinxue: { name: '饮血', desc: '命中回复造成伤害 6% 的生命', hit(p, e, h, dmg) { if (!h.dot) p.heal(dmg * 0.06, true); } },
  juanren: {
    name: '卷刃', desc: '旋风绞碎靠近的敌方飞行道具',
    during(p) {
      for (const pr of G.projs) {
        if (pr.team !== 'e' || pr.dead || dist(pr.x, pr.y, p.x, p.cy) > 46) continue;
        pr.dead = true;
        FX.sparks(pr.x, pr.y, rand(0, TAU), '#ffffff', 4, [60, 140], 0.4);
      }
    },
  },
  // ---------------- 伊芙：弹道、机关、星辰 ----------------
  xinggui: { name: '星轨', desc: '子弹会追踪敌人', mods: { homing: 2.5 } },
  zhongpao: { name: '重炮', desc: '命中把敌人高高轰飞，击退 +60%', pre(p, e, h) { h.kx = (h.kx || 0) * 1.6; h.ky = Math.min(h.ky || 0, -280); h.launch = true; } },
  cilei: { name: '磁雷', desc: '爆炸把敌人吸向爆心', hit(p, e, h) { if (!e.boss) e.vx = -(h.dir || 1) * 150; } },
  huitang: { name: '回膛', desc: '命中加快冲刺次数的恢复', hit(p) { if (p.dashes < p.stats.dashes) p.dashRegen += 0.12; } },
  dijin: { name: '抵近', desc: '对 70 像素内的敌人伤害 +40%', pre(p, e, h) { if (Math.abs(e.x - p.x) < 70) h.dmg *= 1.4; } },
  tiaodan: {
    name: '跳弹', desc: '魔弹命中后弹向附近另一名敌人（50%）',
    hit(p, e, h) {
      if (!h.proj || h._bounce) return;
      const t = nearestEnemy(e.x, e.cy, 170, x => x !== e);
      if (!t) return;
      const a = Math.atan2(t.cy - e.cy, t.x - e.x);
      G.projs.push(new Proj({ team: 'p', x: e.x + Math.cos(a) * 8, y: e.cy + Math.sin(a) * 8, vx: Math.cos(a) * 700, vy: Math.sin(a) * 700, kind: 'bullet', r: 2.4, len: 16, c: '#5ad8ff', c2: '#ffffff', life: 0.4, light: 30, hits: new Set([e.id]), hit: Object.assign({}, h, { dmg: h.dmg * 0.5, _bounce: true }) }));
      Sound.play('clank', { x: e.x, pitch: 2.2 });
    },
  },
  bingjing: { name: '冰晶星', desc: '星弹命中使敌人减速 40%（1.5 秒）', hit(p, e) { applyStatus(e, 'slow', 0.4, 1.5); } },
  liekong: { name: '猎空', desc: '对浮空或飞行中的敌人伤害 +50%', pre(p, e, h) { if (e.flying || !e.onGround) h.dmg *= 1.5; } },
  chuanxin: { name: '穿心', desc: '暴击伤害 +60%', pre(p, e, h) { h.critDmgBonus = (h.critDmgBonus || 0) + 0.6; } },
  cibao: {
    name: '磁暴', desc: '命中时放出电弧，跳向附近一名敌人（40%）',
    hit(p, e, h) {
      if (h._arc || h.dot) return;
      const t = nearestEnemy(e.x, e.cy, 130, x => x !== e);
      if (!t) return;
      FX.bolt(e.x, e.cy, t.x, t.cy, '#7ff7ff', 0.16, 1.5, 6);
      Sound.play('zap', { x: t.x, pitch: 1.4 });
      hitEnemy(p, t, Object.assign({}, h, { dmg: h.dmg * 0.4, _arc: true, sfx: false, noProc: true, hs: 0 }), t.x, t.cy);
    },
  },
  liuhuo: { name: '流火', desc: '星陨使命中的敌人燃烧 2 秒', hit(p, e) { applyStatus(e, 'burn', 2, 0.2); } },
  // ---------------- 罡：气、岩、火、金刚 ----------------
  yanbao: { name: '炎爆', desc: '被这门武技击倒的敌人会爆炸（80%）', kill(p, e) { explodeP(e.x, e.cy, 40, 0.8, { c: '#ff6a2a', c2: '#ffd36a', src: 'proc', shake: 0.2, pitch: 1.4, wx: null }); } },
  yanjia: { name: '岩甲', desc: '命中获得 3 点护盾（最多为最大生命的 25%）', hit(p) { const cap = Math.round(p.maxHp * 0.25); if (p.shield < cap) p.shield = Math.min(cap, p.shield + 3); } },
  yuzhen: {
    name: '余震', desc: '震劲波及目标 40 像素内的其他敌人（50%）',
    hit(p, e, h) {
      if (h._splash || h.dot) return;
      for (const o of enemiesNear(e.x, e.cy, 40)) if (o !== e) hitEnemy(p, o, Object.assign({}, h, { dmg: h.dmg * 0.5, _splash: true, sfx: false, noProc: true, hs: 0 }), o.x, o.cy);
    },
  },
  budong: { name: '不动', desc: '出招全程霸体，不会被打断', mods: { armor: true } },
  huiqi: { name: '回气', desc: '被这门武技击倒的敌人为你回复 6 点生命', kill(p) { p.heal(6); } },
  qixuan: { name: '气旋不散', desc: '气旋持续时间 +60%、范围 +25%' },                                 // moves: twister
  liedi: { name: '裂地', desc: '冲击波划过的地面 0.5 秒后迸裂，再造成一次伤害' },                     // moves: u_gao_down1
  huju: { name: '虎踞', desc: '掌劲命中后 1.5 秒内移动速度 +25%', hit(p) { p.counters.wxSpdT = G.time + 1.5; } },
  jinshen: { name: '金身', desc: '金刚身期间每次受击回复 4 点灵力' },                                 // hurtPlayer
  longwei: { name: '龙威', desc: '施放后 4 秒内攻击力 +20%', cast(p) { p.counters.wxAtkT = G.time + 4; } },
  lianhuan: {
    name: '连环气爆', desc: '每第 5 次命中引爆一团气劲（120%）',
    hit(p, e, h) {
      if (h._boom) return;
      p.counters.fistsN = (p.counters.fistsN || 0) + 1;
      if (p.counters.fistsN % 5) return;
      explodeP(e.x, e.cy, 34, 1.2, { c: '#ffb347', src: 'skill', shake: 0.15, pitch: 1.6, wx: null });
    },
  },
  bawang: { name: '霸王余威', desc: '施放奥义后 5 秒内受到的伤害 -40%', cast(p) { p.counters.wxGuardT = G.time + 5 + (p.move ? p.move.m.dur : 0); } },
};

// =====================================================================
//  武学 ladders. One row per 武学; one object per level (its length is the
//  level cap — 1, 2 or 3 picks). Fields:
//   武技 n: chain links open, pow: damage      技能 n: stages open, pow: damage
//   秘技 t: content tier the moves read (2 强化 / 3 进化), f: 派生 open
//   perk: the signature effect gained at that level (kept from then on)
// =====================================================================
const WX_LEVELS = {
  // ---------------- 凛 ----------------
  rin_swallow: [{ n: 1, pow: 1 }, { n: 2, pow: 1.15 }, { n: 4, pow: 1.35, perk: 'lingkong' }],
  rin_blossom: [{ n: 2, pow: 1 }, { n: 4, pow: 1.3, perk: 'yingyin' }],
  rin_sweep: [{ n: 1, pow: 1 }, { n: 3, pow: 1.2 }, { n: 4, pow: 1.4, perk: 'renchang' }],
  rin_shade: [{ n: 2, pow: 1 }, { n: 3, pow: 1.1 }, { n: 4, pow: 1.25, perk: 'zangjue' }],
  rin_raiden: [{ n: 3, pow: 1 }, { n: 4, pow: 1.3, perk: 'leihen' }],
  rin_gale: [{ n: 4, pow: 1 }],
  rin_u_shot: [{ n: 1, pow: 1 }, { n: 2, pow: 1.2 }, { n: 3, pow: 1.3, perk: 'canxin' }],
  rin_u_up: [{ n: 1, pow: 1 }, { n: 3, pow: 1.25 }],
  rin_u_down: [{ n: 1, pow: 1 }, { n: 2, pow: 1.15 }, { n: 3, pow: 1.3, perk: 'renji' }],
  rin_u_dash: [{ n: 3, pow: 1 }],
  rin_parry: [{ t: 1 }, { t: 3, f: 1 }],
  rin_iai: [{ t: 1 }, { t: 3 }, { t: 3, f: 1, perk: 'zhantie' }],
  rin_shadow: [{ t: 1, f: 1 }],
  rin_flurry: [{ t: 1 }, { t: 2, f: 1 }, { t: 3, f: 1, perk: 'yinxue' }],
  rin_meteor: [{ t: 1 }, { t: 2, f: 1 }, { t: 3, f: 1 }],
  rin_whirl: [{ t: 1 }, { t: 3, f: 1, perk: 'juanren' }],
  rin_wave: [{ t: 1 }, { t: 2, f: 1 }],
  rin_petal: [{ t: 1, f: 1 }, { t: 3, f: 1 }],
  rin_ult: [{ t: 1 }, { t: 3 }],
  rin_sakura: [{ t: 3 }],
  // ---------------- 伊芙 ----------------
  eve_sky: [{ n: 2, pow: 1 }, { n: 4, pow: 1.25, perk: 'xinggui' }],
  eve_cannon: [{ n: 1, pow: 1 }, { n: 3, pow: 1.15 }, { n: 4, pow: 1.35, perk: 'zhongpao' }],
  eve_slide: [{ n: 4, pow: 1 }],
  eve_trap: [{ n: 3, pow: 1 }, { n: 4, pow: 1.3, perk: 'cilei' }],
  eve_phantom: [{ n: 1, pow: 1 }, { n: 2, pow: 1.2 }, { n: 4, pow: 1.35, perk: 'huitang' }],
  eve_buck: [{ n: 1, pow: 1 }, { n: 4, pow: 1.3, perk: 'dijin' }],
  eve_u_shot: [{ n: 1, pow: 1 }, { n: 2, pow: 1.15 }, { n: 3, pow: 1.3, perk: 'tiaodan' }],
  eve_u_up: [{ n: 1, pow: 1 }, { n: 2, pow: 1.2 }, { n: 3, pow: 1.35, perk: 'bingjing' }],
  eve_u_down: [{ n: 1, pow: 1 }, { n: 3, pow: 1.25 }],
  eve_u_dash: [{ n: 1, pow: 1 }, { n: 2, pow: 1.1, perk: 'liekong' }, { n: 3, pow: 1.3 }],
  eve_snipe: [{ t: 1 }, { t: 2, f: 1 }, { t: 3, f: 1, perk: 'chuanxin' }],
  eve_turret: [{ t: 1 }, { t: 3, f: 1 }],
  eve_backflip: [{ t: 2, f: 1 }],
  eve_grenade: [{ t: 1 }, { t: 2 }, { t: 3, f: 1 }],
  eve_rain: [{ t: 2 }, { t: 3, f: 1 }],
  eve_missile: [{ t: 1 }, { t: 2, f: 1 }, { t: 3, f: 1, perk: 'cibao' }],
  eve_kata: [{ t: 2 }, { t: 3, f: 1 }],
  eve_mine: [{ t: 1, f: 1 }, { t: 2, f: 1 }, { t: 3, f: 1 }],
  eve_ult: [{ t: 3 }],
  eve_meteor: [{ t: 1 }, { t: 3, perk: 'liuhuo' }],
  // ---------------- 罡 ----------------
  gao_flame: [{ n: 2, pow: 1 }, { n: 3, pow: 1.2 }, { n: 4, pow: 1.4, perk: 'yanbao' }],
  gao_pillar: [{ n: 1, pow: 1 }, { n: 4, pow: 1.3, perk: 'yanjia' }],
  gao_whirl: [{ n: 1, pow: 1 }, { n: 2, pow: 1.15 }, { n: 4, pow: 1.3, perk: 'yuzhen' }],
  gao_bridge: [{ n: 4, pow: 1, perk: 'budong' }],
  gao_tiger: [{ n: 4, pow: 1 }],
  gao_knee: [{ n: 1, pow: 1 }, { n: 3, pow: 1.2 }, { n: 4, pow: 1.35, perk: 'huiqi' }],
  gao_u_shot: [{ n: 1, pow: 1 }, { n: 3, pow: 1.3 }],
  gao_u_up: [{ n: 1, pow: 1 }, { n: 2, pow: 1.15 }, { n: 3, pow: 1.3, perk: 'qixuan' }],
  gao_u_down: [{ n: 1, pow: 1 }, { n: 2, pow: 1.15, perk: 'liedi' }, { n: 3, pow: 1.3 }],
  gao_u_dash: [{ n: 1, pow: 1 }, { n: 3, pow: 1.25, perk: 'huju' }],
  gao_iron: [{ t: 1 }, { t: 2, f: 1 }, { t: 3, f: 1, perk: 'jinshen' }],
  gao_ki: [{ t: 1 }, { t: 3 }, { t: 3, f: 1 }],
  gao_charge: [{ t: 1 }, { t: 3, f: 1 }],
  gao_grab: [{ t: 1, f: 1 }],
  gao_dragon: [{ t: 1 }, { t: 2, f: 1 }, { t: 3, f: 1, perk: 'longwei' }],
  gao_split: [{ t: 2, f: 1 }, { t: 3, f: 1 }],
  gao_kick: [{ t: 1, f: 1 }, { t: 2, f: 1 }],
  gao_fists: [{ t: 1 }, { t: 3 }, { t: 3, f: 1, perk: 'lianhuan' }],
  gao_ult: [{ t: 1 }, { t: 3 }, { t: 3, perk: 'bawang' }],
  gao_mountain: [{ t: 1 }, { t: 3 }],
};
// what each 秘技's 强化 tier (2) adds, for the cards
const SK_BOOST = {
  rin_wave: '追加第二道剑气', rin_petal: '刃风持续 3.4 秒',
  eve_turret: '炮台每次双发', eve_backflip: '弹数增加', eve_grenade: '额外投出两枚子母弹', eve_rain: '弹幕更密', eve_missile: '导弹增至 10 枚', eve_kata: '射速提升', eve_mine: '最多可布 3 枚',
  gao_iron: '持续 4.5 秒', gao_ki: '气弹更大、贯穿更多', gao_charge: '爆炸范围扩大', gao_split: '岩刺增至 9 根', gao_kick: '推进更快', gao_fists: '最后一拳打出拳风',
};
for (const reg of [ARTS, USKILLS, SKILLS]) for (const id in reg) {
  reg[id].lvs = WX_LEVELS[id];
  if (!reg[id].lvs) console.warn('武学缺少等级表：' + id);
}
const wxMax = E => E.lvs.length;
const wxAt = (E, lv) => E.lvs[clamp(lv, 1, E.lvs.length) - 1];
// signature effects active at level lv (they stay once gained)
function wxPerksAt(E, lv) {
  const out = [];
  for (let i = 0; i < Math.min(lv, E.lvs.length); i++) if (E.lvs[i].perk) out.push(WX_PERKS[E.lvs[i].perk]);
  return out;
}

// =====================================================================
//  武器 WEAPONS
// =====================================================================
const WEAPONS = {};
function WP(o) { WEAPONS[o.id] = o; }
// ----------------------------- RIN -----------------------------
WP({ id: 'rin_hizakura', hero: 'rin', name: '绯樱', type: '打刀', icon: 'sword', col: '#ff3b5c',
  desc: '凛的佩刀，刃纹如落樱。暴击率 +6%；终结技命中回复 3 点灵力。', look: {},
  apply(p, s) { s.crit += 0.06; p.on('onFinisher', p => p.gainMana(3)); } });
WP({ id: 'rin_yasha', hero: 'rin', name: '夜叉', type: '大太刀', icon: 'sword', col: '#b46cff',
  desc: '沉重的妖刀。攻击 +20%，攻速 -10%；终结技追加一道贯穿剑气（90% 攻击力）。',
  look: { col: { blade: '#4a3060', bladeE: '#c886ff', guard: '#6a6a80', hilt: '#1c1424' }, bladeLen: 21 },
  apply(p, s) {
    s.atkMul += 0.2; s.atkSpeed *= 0.9;
    p.on('onFinisher', p => { if (G.time - (p.counters.yashaT || 0) < 0.3) return; p.counters.yashaT = G.time; waveProj(p, { dmg: 0.9, sp: 440, c: '#c886ff', hh: 16, src: 'proc', life: 0.6, skill: false }); Sound.play('swoosh', { x: p.x, pitch: 0.7 }); });
  } });
WP({ id: 'rin_shimo', hero: 'rin', name: '霜月', type: '小太刀', icon: 'feather', col: '#9fe6ff',
  desc: '轻灵的短刃。攻速 +12%；极限闪避判定 +40%；见切反击命中回复 15 点灵力。',
  look: { col: { blade: '#e6fbff', bladeE: '#7fd8ff', guard: '#b8c8d8', hilt: '#2a3448' }, bladeLen: 14 },
  apply(p, s) {
    s.atkSpeed *= 1.12; s.pdWindow *= 1.4;
    p.on('onHit', (p, e, h) => { if (h.src === 'counter' && G.time - (p.counters.shimoT || 0) > 0.5) { p.counters.shimoT = G.time; p.gainMana(15); } });
  } });
// ----------------------------- EVE -----------------------------
WP({ id: 'eve_star', hero: 'eve', name: '星辉', type: '双枪', icon: 'star', col: '#ffd84a',
  desc: '星银铸造的双枪。子弹穿透 +1；秘技灵力消耗 -10%。', look: {},
  apply(p, s) { s.pierce += 1; s.costMul *= 0.9; } });
WP({ id: 'eve_dragon', hero: 'eve', name: '龙息', type: '霰弹枪', icon: 'burst', col: '#ff8a3a',
  desc: '普通射击变为三连散射（每发 55%），射程缩短；对近身敌人伤害 +30%。',
  look: { col: { gun: '#8a5a3a', gunD: '#3a2418', gold: '#ff8a3a' }, bigGun: true },
  apply(p, s) { p.flags.buck = true; p.on('modDmg', (p, e) => (e && Math.abs(e.x - p.x) < 70 ? 1.3 : 1)); } });
WP({ id: 'eve_frost', hero: 'eve', name: '寒星', type: '长铳', icon: 'eye', col: '#7ff0ff',
  desc: '冰晶长铳。子弹速度 +40%，暴击伤害 +40%，攻速 -8%；普通射击命中使敌人减速。',
  look: { col: { gun: '#d8f4ff', gunD: '#4a7a9a', gold: '#7ff0ff' }, bigGun: true },
  apply(p, s) { p.flags.frost = true; s.critDmg += 0.4; s.atkSpeed *= 0.92; } });
// ----------------------------- GAO -----------------------------
WP({ id: 'gao_gaku', hero: 'gao', name: '镇岳', type: '拳套', icon: 'fist', col: '#ffb347',
  desc: '玄铁拳套。受到的伤害 -12%，最大生命 +15。', look: {},
  apply(p, s) { s.armor = 1 - (1 - s.armor) * 0.88; s.maxHp += 15; } });
WP({ id: 'gao_thunder', hero: 'gao', name: '雷鸣', type: '臂铠', icon: 'storm', col: '#ffe14a',
  desc: '封有雷神之力的臂铠。每第 6 次命中引下落雷（150% 攻击力，眩晕 0.6 秒）。',
  look: { gauntlet: '#5a6a9a', gauntletGlow: '#ffe14a' },
  apply(p) {
    p.on('onHit', (p, e, h) => {
      if (h.src === 'proc' || h.dot) return;
      p.counters.thunderN = (p.counters.thunderN || 0) + 1;
      if (p.counters.thunderN < 6) return;
      p.counters.thunderN = 0;
      later(0.05, () => {
        if (e.dead) return;
        FX.bolt(e.x + rand(-6, 6), e.y - 120, e.x, e.cy, '#ffe14a', 0.22, 2, 9);
        FX.flash(e.x, e.cy, 14, '#fff6a0', 0.12);
        Sound.play('zap', { x: e.x });
        hitEnemy(p, e, { dmg: p.atk * 1.5, kx: 0, ky: -120, stun: 0.4, dir: 1, src: 'proc', noProc: true, fxc: '#ffe14a', sfx: false });
        applyStatus(e, 'stun', 0.6);
      });
    });
  } });
WP({ id: 'gao_ember', hero: 'gao', name: '赤焰', type: '手甲', icon: 'flame', col: '#ff6a2a',
  desc: '燃着业火的手甲。攻击 +8%；终结技、蓄力技与秘技命中时使敌人燃烧（3 秒共 150% 攻击力）。',
  look: { gauntlet: '#8a3a2a', gauntletGlow: '#ff6a2a' },
  apply(p, s) {
    s.atkMul += 0.08;
    p.on('onHit', (p, e, h) => { if (h.finisher || h.src === 'charge' || h.src === 'skill' || h.src === 'ult') applyStatus(e, 'burn', 3, 0.25); });
  } });
const heroWeapons = id => Object.values(WEAPONS).filter(w => w.hero === id);

// ---------------- 招式 techniques ----------------
const TECHS = {
  combo5: {
    name: '终式', icon: 'crown',
    desc: h => {
      let k = h.combo;
      for (let i = 0; i < 6 && k; i++) { const m = h.moves[k]; if (m.nextReq === 'combo5') return `普攻连段追加第五段「${h.moves[m.next].label}」`; k = m.next; }
      return '普攻连段追加第五段终结技';
    },
  },
  charge2: { name: '蓄力·极', icon: 'burst', desc: h => `长按攻击可蓄至第二段，释放「${h.moves.charge2.label}」` },
  airRise2: { name: '云阶', icon: 'feather', desc: () => '空中挑斩每次滞空可用两次；空中攻击命中时恢复 1 次冲刺（每次滞空一次）' },
  counterPlus: { name: '见切·极', icon: 'eye', desc: () => '极限闪避判定时间延长 60%，子弹时间更久，见切反击伤害 +50%' },
  recover: { name: '受身', icon: 'shield', desc: () => '受击硬直时按冲刺可立即受身脱离并获得短暂无敌（消耗 1 次冲刺）' },
  wallRun: { name: '壁走', icon: 'feather', desc: () => '蹬墙跳后恢复全部空中跳跃与空中连段次数，蹬墙跳更高' },
  manaFlow: { name: '灵脉', icon: 'orb', desc: () => '灵力上限 +30，灵力自然恢复速度 +50%' },
};

// ---------------- helpers ----------------
function artChainNames(h, a, lv) {
  return a.moves.slice(0, wxAt(a, lv).n).map(mn => h.moves[mn].label).join(' → ');
}
function skillCost(p, S) { return Math.max(1, Math.round(S.cost * p.stats.costMul)); }
// 技能 helpers
const uLabel = (U, k) => (k === 0 ? U.name : U.stages[k].split('：')[0]);
const skTierMul = t => 1 + 0.35 * (t - 1);
// what level lv of a 武学 adds over the level below it (its own unlocks, its signature effect, damage)
function wxText(fam, E, lv, h) {
  const cur = wxAt(E, lv), prev = lv > 1 ? wxAt(E, lv - 1) : null, out = [];
  if (fam === 'art') {
    const names = E.moves.map(mn => `「${(h.moves[mn] || {}).label || mn}」`), from = prev ? prev.n : 0;
    if (cur.n > from) out.push((from ? '解锁 ' : '习得 ') + names.slice(from, cur.n).join(' → '));
  } else if (fam === 'u') {
    const from = prev ? prev.n : 0;
    if (cur.n > from) out.push(from ? E.stages.slice(from, cur.n).map((s, k) => `开启第${['', '二', '三'][from + k]}段 ${s}`).join('；') + '（施放后再按 U）' : E.stages.slice(0, cur.n).join('，再按 U：'));
  } else {
    const pt = prev ? prev.t : 0;
    if (cur.t >= 2 && pt < 2 && SK_BOOST[E.id]) out.push('强化：' + SK_BOOST[E.id]);
    if (cur.t >= 3 && pt < 3 && E.evo) out.push('进化：' + E.evo);
    if (cur.f && !(prev && prev.f) && E.follow) out.push(`派生「${E.fname}」：${E.fdesc}`);
  }
  if (cur.perk) { const pk = WX_PERKS[cur.perk]; out.push(`「${pk.name}」${pk.desc}`); }
  const was = !prev ? 1 : fam === 'sk' ? skTierMul(prev.t) : prev.pow, now = fam === 'sk' ? skTierMul(cur.t) : cur.pow;
  if (prev && now > was) out.push(`伤害 +${Math.round((now / was - 1) * 100)}%`);
  return out;
}

// ---------------- move list (招式表) ----------------
function heroMoveList(h, p) {
  const M = h.moves, t = (p && p.tech) || {};
  const chain = [];
  let k = h.combo;
  while (k && chain.length < 6) { const m = M[k]; chain.push(m.label); k = m.next && (!m.nextReq || t[m.nextReq]) ? m.next : null; }
  const second = M[M[h.combo].next];
  const br = second.delay ? [M[second.delay].label, M[second.delay].next ? M[M[second.delay].next].label : null].filter(Boolean) : [];
  const air = [];
  k = h.air;
  while (k && air.length < 4) { air.push(M[k].label); k = M[k].next; }
  const artRow = (slot, def) => {
    const s = p && p.arts[slot];
    if (!s) return M[def].label + '（未习得武技）';
    const a = ARTS[s.id];
    return `${a.name} Lv${s.lv}/${wxMax(a)}：${artChainNames(h, a, s.lv)}`;
  };
  const rows = [
    ['攻击 连按', chain.join(' → ')],
    ['攻击×2 →停顿→ 攻击', br.join(' → ')],
    ['↑ + 攻击', artRow('up', 'rise')],
    ['↓ + 攻击', artRow('down', 'low')],
    ['冲刺中 攻击', artRow('dash', 'dashAtk')],
    ['长按 攻击', M.charge1.label + (t.charge2 || (p && p.stats.charge2) ? ' / ' + M.charge2.label : '')],
    ['空中 攻击 连按', air.join(' → ')],
    ['空中 ↑ / ↓ + 攻击', M.airRise.label + ' / ' + M.plunge.label],
    ['极限闪避 → 攻击', M.counter.label],
  ];
  if (p) for (const sl of U_SLOTS) {
    const s = p.uskills[sl.id];
    if (!s) continue;
    const U = USKILLS[s.id];
    rows.push([sl.long, `${U.name} Lv${s.lv}/${wxMax(U)}：${U.moves.slice(0, wxAt(U, s.lv).n).map((mn, k) => uLabel(U, k)).join(' → ')}（再按 U 接段）`]);
  }
  if (p) for (const sl of SECRET_SLOTS) {
    const s = p.secrets[sl.id];
    if (!s) continue;
    const S = SKILLS[s.id];
    rows.push([sl.long, `${S.name} Lv${s.lv}/${wxMax(S)}（灵力 ${skillCost(p, S)}）${wxAt(S, s.lv).f && S.follow ? ' → 再按 I：' + S.fname : ''}`]);
  }
  return rows;
}

// ---------------- 武学 offers: one pool for 武技 / 技能 / 秘技 / 招式 ----------------
// level-ups are weighted up (each 武学 stops appearing once it hits its own cap)
function rollArts(p, n = 3) {
  const h = p.hero;
  const cands = [];
  for (const id in ARTS) {
    const A = ARTS[id];
    if (A.hero !== h.id) continue;
    const cur = p.arts[A.slot];
    if (!cur) cands.push({ w: 3.0, v: { kind: 'art', id } });
    else if (cur.id === id && cur.lv < wxMax(A)) cands.push({ w: 3.4, v: { kind: 'artUp', id } });
    else if (cur.id !== id) cands.push({ w: 0.6, v: { kind: 'artSwap', id } });
  }
  for (const id in USKILLS) {
    const U = USKILLS[id];
    if (U.hero !== h.id) continue;
    const cur = p.uskills[U.slot];
    if (cur && cur.id === id && cur.lv < wxMax(U)) cands.push({ w: 2.8, v: { kind: 'uUp', id } });
  }
  for (const id in SKILLS) {
    const S = SKILLS[id];
    if (S.hero !== h.id) continue;
    const cur = p.secrets[S.slot];
    if (cur && cur.id === id && cur.lv < wxMax(S)) cands.push({ w: 2.2, v: { kind: 'skillUp', id } });
    else if (!cur || cur.id !== id) cands.push({ w: 0.7, v: { kind: 'skillSwap', id } });
  }
  for (const id in TECHS) if (!p.tech[id]) cands.push({ w: 0.9, v: { kind: 'tech', id } });
  const out = [];
  let guard = 0;
  while (out.length < n && cands.length && guard++ < 60) {
    let tot = 0; for (const c of cands) tot += c.w;
    let r = Math.random() * tot, idx = 0;
    for (let i = 0; i < cands.length; i++) { r -= cands[i].w; if (r <= 0) { idx = i; break; } }
    const v = cands.splice(idx, 1)[0].v;
    // never offer two cards for the same input slot
    const slotKey = v.kind.startsWith('art') ? 'a' + ARTS[v.id].slot : v.kind === 'uUp' ? 'u' + USKILLS[v.id].slot : v.kind.startsWith('skill') ? 's' + SKILLS[v.id].slot : 't' + v.id;
    if (out.some(o => o._slot === slotKey)) continue;
    v._slot = slotKey;
    out.push(v);
  }
  return out;
}
function artView(a, p) {
  const h = p.hero;
  if (a.kind === 'tech') {
    const T = TECHS[a.id];
    return { tag: '武学 · 招式解锁', name: T.name, icon: T.icon, col: '#ffd23f', frame: '#ffd23f', lvText: '新招式', desc: T.desc(h), sub: '永久改变你的出招方式' };
  }
  // the rest of a ladder in one line: what each later level brings
  const path = (fam, E, from) => {
    const steps = [];
    for (let l = from + 1; l <= wxMax(E); l++) {
      const pk = wxAt(E, l).perk;
      steps.push(`Lv${l} ${wxText(fam, E, l, h)[0].replace(/（.*?）/g, '').replace(/^(解锁|开启|强化|进化)\s*/, '')}${pk && !wxText(fam, E, l, h)[0].includes(WX_PERKS[pk].name) ? ' +「' + WX_PERKS[pk].name + '」' : ''}`);
    }
    return steps.length ? steps.join(' · ') : '';
  };
  const lvBadge = (lv, E) => `Lv${lv - 1} → ${lv} / ${wxMax(E)}`;
  if (a.kind.startsWith('art')) {
    const A = ARTS[a.id], sl = slotInfo(ART_SLOTS, A.slot), col = WX_FAM.art.col, tag = `武学 · 武技 · ${sl.long}`;
    const cur = p.arts[A.slot];
    const names = A.moves.map(mn => (h.moves[mn] || {}).label || mn);
    const lvDesc = i => A.lv[i].replace(/^[^：，]{1,6}：/, '');
    if (a.kind === 'art') {
      const n = wxAt(A, 1).n, pk = wxAt(A, 1).perk && WX_PERKS[wxAt(A, 1).perk];
      const desc = (n >= A.moves.length ? `一次习得整套连段：${names.join(' → ')}` : `「${names[0]}」${lvDesc(0)}${n > 1 ? '；接「' + names[1] + '」' : ''}`) + (pk ? `；「${pk.name}」${pk.desc}` : '');
      return { tag, name: A.name, icon: A.icon, col, frame: col, lvText: `新 · 共 ${wxMax(A)} 级`, desc, sub: path('art', A, 1) || '只有一级：习得即大成' };
    }
    if (a.kind === 'artUp') {
      const lv = cur.lv + 1;
      return { tag, name: A.name, icon: A.icon, col, frame: '#7ff7ff', lvText: lvBadge(lv, A), desc: wxText('art', A, lv, h).join('；'), sub: `${sl.long}：${names.slice(0, wxAt(A, lv).n).join(' → ')}` };
    }
    const lv = Math.min(cur.lv, wxMax(A));
    return { tag, name: A.name, icon: A.icon, col, frame: '#c46aff', lvText: `转修 Lv${lv} / ${wxMax(A)}`, desc: `以「${A.name}」取代「${ARTS[cur.id].name}」，等级 Lv${lv}：${names.slice(0, wxAt(A, lv).n).join(' → ')}`, sub: `「${names[0]}」${lvDesc(0)}` };
  }
  if (a.kind === 'uUp') {
    const U = USKILLS[a.id], sl = slotInfo(U_SLOTS, U.slot), col = WX_FAM.u.col;
    const lv = p.uskills[U.slot].lv + 1;
    return { tag: `武学 · 技能 · ${sl.long}`, name: U.name, icon: U.icon, col, frame: '#7ff7ff', lvText: lvBadge(lv, U), desc: wxText('u', U, lv, h).join('；'), sub: `再按 U 接段 · ${U.moves.slice(0, wxAt(U, lv).n).map((mn, k) => uLabel(U, k)).join(' → ')}` };
  }
  const S = SKILLS[a.id], sl = slotInfo(SECRET_SLOTS, S.slot), col = WX_FAM.sk.col, tag = `武学 · 秘技 · ${sl.long}`;
  const cur = p.secrets[S.slot];
  const cost = skillCost(p, S);
  if (a.kind === 'skillUp') {
    const lv = cur.lv + 1;
    return { tag, name: S.name, icon: S.icon, col, frame: '#7ff7ff', lvText: lvBadge(lv, S), desc: wxText('sk', S, lv, h).join('；') + '。' + S.desc(wxAt(S, lv).t), sub: `灵力消耗 ${cost}${lv < wxMax(S) ? ' · 之后：' + path('sk', S, lv) : ' · 已是最高级'}` };
  }
  const lv = cur ? Math.min(cur.lv, wxMax(S)) : 1;
  return { tag, name: S.name, icon: S.icon, col, frame: '#c46aff', lvText: `转修 Lv${lv} / ${wxMax(S)}`, desc: S.desc(wxAt(S, lv).t), sub: `取代「${cur ? SKILLS[cur.id].name : '—'}」· 灵力 ${cost}${path('sk', S, lv) ? ' · ' + path('sk', S, lv) : ''}` };
}
function takeArt(p, a, done) {
  const h = p.hero;
  if (a.kind === 'tech') {
    p.tech[a.id] = true;
    p.recalc();
    G.toast(`招式解锁：${TECHS[a.id].name}`, '#ffd23f', TECHS[a.id].desc(h));
  } else if (a.kind === 'art' || a.kind === 'artSwap') {
    const A = ARTS[a.id], sl = slotInfo(ART_SLOTS, A.slot);
    const lv = a.kind === 'artSwap' && p.arts[A.slot] ? Math.min(p.arts[A.slot].lv, wxMax(A)) : 1;
    p.arts[A.slot] = { id: a.id, lv };
    G.toast(`习得武技：${A.name}`, WX_FAM.art.col, `${sl.long} 发动「${h.moves[A.moves[0]].label}」`);
  } else if (a.kind === 'artUp') {
    const A = ARTS[a.id], cur = p.arts[A.slot];
    cur.lv = Math.min(wxMax(A), cur.lv + 1);
    G.toast(`武技精进：${A.name} Lv${cur.lv}/${wxMax(A)}`, WX_FAM.art.col, wxText('art', A, cur.lv, h).slice(0, 2).join(' · '));
  } else if (a.kind === 'uUp') {
    const U = USKILLS[a.id], cur = p.uskills[U.slot];
    cur.lv = Math.min(wxMax(U), cur.lv + 1);
    G.toast(`技能精进：${U.name} Lv${cur.lv}/${wxMax(U)}`, WX_FAM.u.col, wxText('u', U, cur.lv, h)[0].split('（')[0]);
  } else if (a.kind === 'skillUp') {
    const S = SKILLS[a.id], cur = p.secrets[S.slot];
    cur.lv = Math.min(wxMax(S), cur.lv + 1);
    G.toast(`秘技精进：${S.name} Lv${cur.lv}/${wxMax(S)}`, WX_FAM.sk.col, wxText('sk', S, cur.lv, h)[0]);
  } else if (a.kind === 'skillSwap') {
    const S = SKILLS[a.id], sl = slotInfo(SECRET_SLOTS, S.slot);
    const lv = p.secrets[S.slot] ? Math.min(p.secrets[S.slot].lv, wxMax(S)) : 1;
    p.secrets[S.slot] = { id: a.id, lv };
    G.toast(`转修秘技：${S.name}`, '#5ad8ff', `${sl.long} · 灵力 ${skillCost(p, S)}`);
  }
  Sound.play('upgrade');
  if (done) done();
}

// ---------------- bake every hero's sprite frames ----------------
const HERO_ORDER = ['rin', 'eve', 'gao'];
function heroLook(h, weaponId) {
  const base = LOOKS[h.look];
  const W = WEAPONS[weaponId];
  if (!W || !W.look || !Object.keys(W.look).length) return base;
  const L = Object.assign(Object.create(Object.getPrototypeOf(base)), base, W.look);
  L.col = Object.assign({}, base.col, W.look.col || {});
  return L;
}
function bakeHero(id, weaponId) {
  const h = HEROES[id];
  const L = heroLook(h, weaponId);
  const defs = {
    idle: { n: 8, gen: 'idle', loop: true, fps: 8 },
    run: { n: 8, gen: 'run', loop: true, fps: 14 },
    jump: { n: 2, gen: 'jump', fps: 6 },
    fall: { n: 2, gen: 'fall', fps: 6, loop: true },
    dash: { n: 2, gen: 'dash', fps: 12, loop: true },
    hurt: { n: 2, gen: 'hurt', fps: 8 },
    dead: { n: 5, gen: 'dead', fps: 8 },
    land: { n: 1, gen: 'land' },
    hold: { n: 4, loop: true, fps: 16, gen: (Lk, t) => fullPose(Lk, Object.assign({ wave: t }, h.holdPose(Math.sin(t * TAU) * 1.5))) },
    wall: { n: 2, loop: true, fps: 6, gen: (Lk, t) => fullPose(Lk, Object.assign({ wave: t }, h.wallPose)) },
  };
  // moves with `anim` reuse another move's frames instead of baking their own
  for (const mn in h.moves) if (!h.moves[mn].anim) defs[mn] = { keys: h.moves[mn].keys, dur: h.moves[mn].dur };
  const spr = bakeRig(id, L, defs);
  for (const mn in h.moves) { const al = h.moves[mn].anim; if (al && spr.anims[al]) spr.anims[mn] = spr.anims[al]; }
  spr.weapon = weaponId || null;
  return spr;
}
function bakeHeroes() { for (const id of HERO_ORDER) bakeHero(id, heroWeapons(id)[0].id); }
