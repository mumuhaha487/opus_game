// PLATFORM §5.3：云存档拒绝审计，仅记录时间和原因，不包含客户端存档内容。
// R2 etag 条件写追加；审计故障仍保持拒绝结果和原云端进度。
// 同日同账号同游戏独立文档，冲突重读后合并。
import { absent } from './store.js';
export async function auditSave(bucket, uid, game, reason, now) {
  const date = new Date(now).toISOString().slice(0, 10);
  const path = `audit/${date}/${uid}-${game}.json`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const object = await bucket.get(path), entries = object ? await object.json() : [];
    entries.push({ time: now, reason });
    const onlyIf = object ? { etagMatches: object.etag } : absent();
    if (await bucket.put(path, JSON.stringify(entries), { onlyIf })) return;
  }
}
