// 叠叠乐大陆：云存档 = 自动存档 + 三个手动存档位（gzip），meta 是主页摘要与任务榜用的进度数字。
import { cleanPacked, brief as briefPacked, int, id, bool, progress } from './packed-save.js';
export const brief = briefPacked;
export const MAX = 190000;
const META = { world: id(), moon: int(1e6), quests: int(1000), ideas: int(1000), villagers: int(10000), ending: bool };
export const clean = value => cleanPacked(value, 'stack-realm', META, 185000);
// 上限取自游戏源码 D:/project/xianzhen/stack-realm（摘要的算法见 client/src/cloud.ts:124-135）：
// 任务共 75 个（shared/engine/data/packs.ts:78-159），配方共 247 个（data/recipes.ts:31 RECIPES，含 :108-110、:329 起循环生成的）。
const QUESTS = 75, RECIPES = 247;
// 任务增速：引擎自带的机器人（shared/engine/bot.ts）从每个世界开局、月亮 40–120 秒、×2 速（×1 更慢），
// 真实时间任意 60 秒最多完成 9 个任务；按 3 倍放宽、另加 3 个余量。
// 想法不设增速：篇章自由开局一下子送 35–70 个想法（worlds.ts:58-65、95-97），只限总数。
const QUESTS_PER_MIN = 9 * 3;
// 月亮最短 40 秒（设置项 client/src/ui/menus.ts:520），挑战难度再乘 0.85（shared/engine/difficulty.ts），最快 ×2 速
// （client/src/game.ts:75、324），只在页面运行时推进、每帧最多 0.1 秒（game.ts:190-198），所以真实时间每 17 秒最多一个月亮。
const MOON_MIN_S = 40 * 0.85 / 2;
// 通关（sim.ts:437-438）只能靠发射飞船（recipes.ts:308）；飞船要外星核心（:307），核心只掉自外星母舰（data/cards-worlds.ts:111），
// 母舰只能用星际信标召唤（recipes.ts:304-305）：通关前一定完成了「建造星际信标」「击落外星母舰」两个任务（moon.ts:182-183）。
const ENDING_QUESTS = 2;
// 月亮是当前世界那块版图的（cloud.ts:125-129），换世界后不和上一个世界的月亮比较。
export const plausible = progress('stack_', (grown, m, minutes, before) => {
  if ((m.quests || 0) > QUESTS) return 'quests_cap';
  if ((m.ideas || 0) > RECIPES) return 'ideas_cap';
  if (m.ending && (m.quests || 0) < ENDING_QUESTS) return 'ending_quests';
  if (grown('quests') > minutes * QUESTS_PER_MIN + 3) return 'quests_too_fast';
  const sameWorld = !before.world || before.world === m.world;
  if (sameWorld && grown('moon') > minutes * 60 / MOON_MIN_S + 1) return 'moon_too_fast';
  return null;
});
export function board(save) {
  const m = save.meta;
  if (!(m.quests > 0)) return null;
  return { score: m.quests * 1000 + Math.min(999, m.moon || 0), line: `任务 ${m.quests} · 想法 ${m.ideas || 0}${m.ending ? ' · 已通关' : ''}` };
}
