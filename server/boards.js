// 排行榜：游戏模块从清洗后的云存档里算出成绩（GAMES[id].board(save) → { score, line }），
// 每个账号保留最好的一次，按分数排序存前 50 名；成绩只来自存档本身，没有单独的提交接口。
import { absent } from './store.js';
const KEY = game => `boards/${game}.json`;
const LIMIT = 50;
export async function updateBoard(bucket, game, name, entry, now = Date.now()) {
  if (!entry || typeof entry.score !== 'number' || !Number.isFinite(entry.score) || entry.score <= 0) return false;
  const score = Math.round(entry.score), line = String(entry.line || '').slice(0, 60), who = name.toLowerCase();
  for (let attempt = 0; attempt < 4; attempt++) {
    const object = await bucket.get(KEY(game));
    const current = object ? await object.json() : { rows: [] };
    const rows = Array.isArray(current.rows) ? current.rows : [];
    const mine = rows.find(row => row.name.toLowerCase() === who);
    if (mine && (mine.score > score || (mine.score === score && mine.line === line))) return false;
    // a full board only takes a score that beats its last row
    if (!mine && rows.length >= LIMIT && rows[rows.length - 1].score >= score) return false;
    const next = rows.filter(row => row.name.toLowerCase() !== who);
    next.push({ name, score, line, t: now });
    next.sort((a, b) => b.score - a.score || a.t - b.t);
    const written = await bucket.put(KEY(game), JSON.stringify({ rows: next.slice(0, LIMIT), updated: now }),
      { onlyIf: object ? { etagMatches: object.etag } : absent(), httpMetadata: { contentType: 'application/json' } });
    if (written) return true;
  }
  return false;
}
export async function readBoard(bucket, game, limit = 20) {
  const object = await bucket.get(KEY(game));
  if (!object) return [];
  const rows = (await object.json()).rows;
  return Array.isArray(rows) ? rows.slice(0, limit).map(({ name, score, line }) => ({ name, score, line })) : [];
}
