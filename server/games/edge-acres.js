// 边角农场：云存档 = 所有地图的农场（gzip），meta 是主页摘要与收获榜用的进度数字。
import { cleanPacked, brief as briefPacked, int, id } from './packed-save.js';
export const brief = briefPacked;
export const MAX = 190000;
const META = { map: id(), maps: int(16), harvested: int(1e12), codex: int(1000), bots: int(100000), playMin: int(1e8) };
export const clean = value => cleanPacked(value, 'edge-acres', META, 185000);
export const plausible = () => ({ ok: true });
export function board(save) {
  const m = save.meta;
  return m.harvested > 0 ? { score: m.harvested, line: `收获 ${m.harvested} · 图鉴 ${m.codex || 0}` } : null;
}
