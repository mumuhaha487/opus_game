// 铁血防线：云存档 = 战役进度 + 战斗中的步骤记录 + 勋章档案（gzip），meta 是主页摘要与战功榜用的数字。
import { cleanPacked, brief as briefPacked, int, id, progress } from './packed-save.js';
export const brief = briefPacked;
export const MAX = 120000;
const META = { wins: int(1e6), battles: int(1e7), medals: int(100), coins: int(1e9), theater: int(16), difficulty: id() };
export const clean = value => cleanPacked(value, 'iron-line-1917', META, 115000);
// 上限取自游戏源码 D:/project/xianzhen/iron-line-1917（摘要的算法见 shared/campaign.ts:987-998）：
// 勋章 12 枚，各奖 1–2 枚荣誉金币（campaign.ts:758-771）；金币只在第一次拿到某枚勋章时发放（:800-806），
// 解锁连队、驾驶员会花掉（:872、:882）。所以金币不超过“勋章数”枚奖励最高的勋章之和。
const MEDAL_COINS = [1, 1, 2, 2, 1, 1, 2, 2, 1, 1, 2, 1].sort((a, b) => b - a);
const coinCap = medals => MEDAL_COINS.slice(0, medals).reduce((sum, coins) => sum + coins, 0);
// battles = 战役里打完的每一场（client/src/main.ts:289-294），开打后立即撤出也算（client/src/game/controller.ts:1136-1148），
// 最短按 10 秒一场；胜利要撑满 5 回合（shared/engine/state.ts:74、engine/turn.ts:412-413），按 30 秒一场。
// 一次战役胜利（wins，campaign.ts:851-854）至少要解放 2 个战区才能发起终局（:315-316），每个战区先收复 4 个防区
// 才开放指挥部（:652-659），即至少 2 × (4 + 1) + 1 = 11 场胜仗。
const BATTLE_S = 10, CAMPAIGN_S = 11 * 30;
export const plausible = progress('ironline_', (grown, m, minutes) => {
  if ((m.medals || 0) > MEDAL_COINS.length) return 'medals_cap';
  if ((m.coins || 0) > coinCap(m.medals || 0)) return 'coins_cap';
  if (grown('battles') > minutes * 60 / BATTLE_S + 3) return 'battles_too_fast';
  if (grown('wins') > minutes * 60 / CAMPAIGN_S + 1) return 'wins_too_fast';
  return null;
});
export function board(save) {
  const m = save.meta;
  if (!(m.battles > 0 || m.wins > 0)) return null;
  return { score: (m.wins || 0) * 1e6 + (m.medals || 0) * 1e4 + Math.min(9999, m.battles || 0), line: `战役胜利 ${m.wins || 0} · 勋章 ${m.medals || 0} · 战斗胜利 ${m.battles || 0}` };
}
