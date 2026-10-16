// 铁血防线：云存档 = 战役进度 + 战斗中的步骤记录 + 勋章档案（gzip），meta 是主页摘要与战功榜用的数字。
import { cleanPacked, brief as briefPacked, int, id } from './packed-save.js';
export const brief = briefPacked;
export const MAX = 120000;
const META = { wins: int(1e6), battles: int(1e7), medals: int(100), coins: int(1e9), theater: int(16), difficulty: id() };
export const clean = value => cleanPacked(value, 'iron-line-1917', META, 115000);
export const plausible = () => ({ ok: true });
export function board(save) {
  const m = save.meta;
  if (!(m.battles > 0 || m.wins > 0)) return null;
  return { score: (m.wins || 0) * 1e6 + (m.medals || 0) * 1e4 + Math.min(9999, m.battles || 0), line: `战役胜利 ${m.wins || 0} · 勋章 ${m.medals || 0} · 战斗胜利 ${m.battles || 0}` };
}
