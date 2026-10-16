// 叠叠乐大陆：云存档 = 自动存档 + 三个手动存档位（gzip），meta 是主页摘要与任务榜用的进度数字。
import { cleanPacked, brief as briefPacked, int, id, bool } from './packed-save.js';
export const brief = briefPacked;
export const MAX = 190000;
const META = { world: id(), moon: int(1e6), quests: int(1000), ideas: int(1000), villagers: int(10000), ending: bool };
export const clean = value => cleanPacked(value, 'stack-realm', META, 185000);
export const plausible = () => ({ ok: true });
export function board(save) {
  const m = save.meta;
  if (!(m.quests > 0)) return null;
  return { score: m.quests * 1000 + Math.min(999, m.moon || 0), line: `任务 ${m.quests} · 想法 ${m.ideas || 0}${m.ending ? ' · 已通关' : ''}` };
}
