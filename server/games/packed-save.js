// 大型游戏的云存档文档：{ v: 1, game, at, meta: { 进度数字 / 短标识 }, gz: <gzip 压缩后完整存档的 base64> }
// meta 只收各游戏声明过的字段（主页摘要与排行榜读它）；gz 只检查是不是合法的 base64 和长度，
// 内容由游戏自己的引擎在读档时校验。
export const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
export const int = max => v => Number.isSafeInteger(v) && v >= 0 && v <= max ? v : undefined;
export const id = (pattern = /^[a-z0-9_-]{1,32}$/) => v => typeof v === 'string' && pattern.test(v) ? v : undefined;
export const bool = v => typeof v === 'boolean' ? v : undefined;
// 账号面板列表只需要摘要：去掉压缩存档本体，免得一次列表请求带上几百 KB
export const brief = save => ({ v: save.v, game: save.game, at: save.at, meta: save.meta });
export function cleanPacked(value, game, schema, maxGz) {
  if (!isObject(value) || value.v !== 1 || value.game !== game) return null;
  if (typeof value.gz !== 'string' || !value.gz.length || value.gz.length > maxGz || !/^[A-Za-z0-9+/]+={0,2}$/.test(value.gz)) return null;
  const meta = {};
  const given = isObject(value.meta) ? value.meta : {};
  for (const [key, rule] of Object.entries(schema)) {
    const cleaned = rule(given[key]);
    if (cleaned !== undefined) meta[key] = cleaned;
  }
  return { v: 1, game, at: Number.isSafeInteger(value.at) && value.at > 0 ? value.at : 0, meta, gz: value.gz };
}
