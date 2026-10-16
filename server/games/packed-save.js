// 大型游戏的云存档文档：{ v: 1, game, at, meta: { 进度数字 / 短标识 }, gz: <gzip 压缩后完整存档的 base64> }
// meta 只收各游戏声明过的字段（主页摘要与排行榜读它），由各游戏的 plausible() 按游戏数据检查；
// gz 检查 base64、长度和 gzip 头尾，不解压，内容由游戏自己的引擎在读档时校验。
export const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
export const int = max => v => Number.isSafeInteger(v) && v >= 0 && v <= max ? v : undefined;
export const id = (pattern = /^[a-z0-9_-]{1,32}$/) => v => typeof v === 'string' && pattern.test(v) ? v : undefined;
export const bool = v => typeof v === 'boolean' ? v : undefined;
// 账号面板列表只需要摘要：去掉压缩存档本体，免得一次列表请求带上几百 KB
export const brief = save => ({ v: save.v, game: save.game, at: save.at, meta: save.meta });
// gzip 只看头尾（Worker 每次请求只有 10 ms CPU，不解压）：解出的字节以 1f 8b 08（gzip + deflate）开头，
// 末尾 4 字节 ISIZE（解压后长度，小端）在 1 字节到 8 MB 之间。最短的 gzip 也有 20 字节，即 28 个 base64 字符。
const UNPACKED_MAX = 8 * 1024 * 1024;
export function gzipped(gz) {
  if (gz.length % 4 || gz.length < 28) return false;
  try {
    const head = atob(gz.slice(0, 4)), tail = atob(gz.slice(-8)).slice(-4);
    if (head.charCodeAt(0) !== 0x1f || head.charCodeAt(1) !== 0x8b || head.charCodeAt(2) !== 0x08) return false;
    const size = (tail.charCodeAt(0) | tail.charCodeAt(1) << 8 | tail.charCodeAt(2) << 16 | tail.charCodeAt(3) << 24) >>> 0;
    return size >= 1 && size <= UNPACKED_MAX;
  } catch { return false; }
}
// 摘要进度检查（PLATFORM §5.3）：数字变小照常接受（选择存档时可以留下本机较旧的一份，排行榜本来就保留每个账号最好的成绩）；
// 比上一份云存档多出的部分逐项按增速检查，所以先传一份较低的、马上再跳回更高的一份仍会被拒绝。
// check(grown, meta, minutes, before, previous) 返回拒绝原因或 null；grown(key) 是这一项比上一份多出多少，变小记 0；
// previous 是服务端锚点 { meta, t, worlds }（首次上传为 null）。
export function progress(prefix, check) {
  return (previous, next, elapsedMs) => {
    const before = isObject(previous?.meta) ? previous.meta : {}, minutes = Math.max(0, elapsedMs) / 60000;
    const grown = key => Math.max(0, (next.meta[key] || 0) - (before[key] || 0));
    const reason = check(grown, next.meta, minutes, before, previous);
    return reason ? { ok: false, reason: prefix + reason } : { ok: true };
  };
}
export function cleanPacked(value, game, schema, maxGz) {
  if (!isObject(value) || value.v !== 1 || value.game !== game) return null;
  if (typeof value.gz !== 'string' || !value.gz.length || value.gz.length > maxGz || !/^[A-Za-z0-9+/]+={0,2}$/.test(value.gz)) return null;
  if (!gzipped(value.gz)) return null;
  const meta = {};
  const given = isObject(value.meta) ? value.meta : {};
  for (const [key, rule] of Object.entries(schema)) {
    const cleaned = rule(given[key]);
    if (cleaned !== undefined) meta[key] = cleaned;
  }
  return { v: 1, game, at: Number.isSafeInteger(value.at) && value.at > 0 ? value.at : 0, meta, gz: value.gz };
}
