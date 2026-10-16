// 边角农场：云存档 = 所有地图的农场（gzip），meta 是主页摘要与收获榜用的进度数字。
import { cleanPacked, brief as briefPacked, int, id, progress } from './packed-save.js';
export const brief = briefPacked;
export const MAX = 190000;
const META = { map: id(), maps: int(16), harvested: int(1e12), codex: int(1000), bots: int(100000), playMin: int(1e8) };
export const clean = value => cleanPacked(value, 'edge-acres', META, 185000);
// 上限取自游戏源码 D:/project/xianzhen/edge-acres（摘要的算法见 client/src/cloud.ts:58-78、105-111）：
// 图鉴 = 当前农场收获过的作物种数：作物共 60 种（shared/engine/data/crops.ts:17-85），只在收获时增长（farm.ts:140）。
// 地图 5 张（data/maps.ts:30-36）。机器人各占一个 1×1 充电桩（data/objects.ts:15-19），
// 五张地图 (160 + 4 × 150) 宽 × 12 高（maps.ts:31-35、types.ts:9）= 9120 格。
const CODEX = 60, MAPS = 5, TILES = (160 + 4 * 150) * 12;
// 每分钟收获的宽松上限：最大的 160 × 12 农场全种最快的小麦（30 秒，crops.ts:19），施肥 ×1.5、蜂箱 ×1.2（farm.ts:33-34）
// → 每分钟 3.6 季；巨型作物 2×2 最多 8 个，每格 2 个（farm.ts:128）；番茄钟「丰收时刻」全部成熟、收获 ×2（actions.ts:257-258）。
// 模拟按真实时间走（types.ts:11），离线追赶不超过离开的时长（sim.ts:41-45），页面速度最高 ×1（client/src/ui/prod.ts:83）。
const HARVEST_PER_MIN = 160 * 12 * (60 * 1.5 * 1.2 / 30) * 2 * 2;
// playMin = 页面开着的累计秒数 / 60（client/src/sim/host.ts:82、cloud.ts:107-111），不会快过真实时间；
// 多给 3 分钟：相隔几秒、跨过整分钟的两次上传，以及上传时文档已打包了一会儿，都不会被拒绝。
export const plausible = progress('farm_', (grown, m, minutes) => {
  if ((m.codex || 0) > CODEX) return 'codex_cap';
  if ((m.maps || 0) > MAPS) return 'maps_cap';
  if ((m.bots || 0) > TILES) return 'bots_cap';
  if (grown('playMin') > minutes + 3) return 'playtime_too_fast';
  if (grown('harvested') > HARVEST_PER_MIN * (minutes + 1)) return 'harvest_too_fast';
  return null;
});
export function board(save) {
  const m = save.meta;
  return m.harvested > 0 ? { score: m.harvested, line: `收获 ${m.harvested} · 图鉴 ${m.codex || 0}` } : null;
}
