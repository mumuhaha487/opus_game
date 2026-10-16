// PLATFORM §6.5 / 第2b轮：北京时间每日Key1500、账号3000；isolate内累计10次或30秒后CAS合并，有ctx时在响应之后写。
// 同账号队列串行化本地计数；每次读R2加本地增量，冲突重读，失败保持增量并拒绝业务（响应之后的写失败时，下一次调用先补写）。
// 任一额度剩余100次以内时每次调用都在条件写里判断并落盘，末尾额度准确；isolate被回收时最多丢失一批未落盘的计数。
import { absent } from './store.js';
const KEY_LIMIT = 1500, ACCOUNT_LIMIT = 3000, BATCH = 10, BATCH_MS = 30000, NEAR = 100;
const states = new WeakMap();
export const usageDay = now => new Date(now + 28800000).toISOString().slice(0, 10);
export function createUsageCounter() {
  const entries = new Map();
  return async (bucket, key, now = Date.now(), ctx) => {
    const day = usageDay(now), path = `apikeys/usage/${key.uid}/${day}.json`;
    let entry = entries.get(path);
    if (!entry) {
      entry = { pending: {}, count: 0, flushedAt: now, queue: Promise.resolve(), writing: null, failed: false }; entries.set(path, entry);
    }
    const read = async () => {
      const object = await bucket.get(path);
      return { object, stored: object ? await object.json() : { day, total: 0, keys: {} } };
    };
    const unavailable = () => { throw { status: 503, code: 'storage_unavailable', message: '调用额度暂时不可用，请稍后再试' }; };
    // 本地增量（extra=1 时再加上本次调用）合并进R2文档；条件写成功才清空增量，返回写入后的文档，写入出错按 503
    const write = async (doc, extra) => {
      const merged = { day, total: doc.stored.total + entry.count + extra, keys: { ...doc.stored.keys } };
      for (const [id, count] of Object.entries(entry.pending)) merged.keys[id] = (merged.keys[id] || 0) + count;
      if (extra) merged.keys[key.id] = (merged.keys[key.id] || 0) + extra;
      let object;
      try { object = await bucket.put(path, JSON.stringify(merged), { onlyIf: doc.object ? { etagMatches: doc.object.etag } : absent() }); }
      catch { unavailable(); }
      if (!object) return null;
      entry.pending = {}; entry.count = 0; entry.flushedAt = now; entry.failed = false;
      return { object, stored: merged };
    };
    const flush = async doc => {
      for (let attempt = 0; attempt < 64; attempt++) {
        const written = await write(doc, 0);
        if (written) return written;
        doc = await read();
      }
      unavailable();
    };
    const result = (stored, denied) => ({ denied,
      keyRemaining: Math.max(0, KEY_LIMIT - (stored.keys[key.id] || 0) - (entry.pending[key.id] || 0)),
      accountRemaining: Math.max(0, ACCOUNT_LIMIT - stored.total - entry.count),
      retryAfter: Math.ceil((Date.parse(day + 'T00:00:00+08:00') + 86400000 - now) / 1000) });
    const run = async () => {
      // 上一次放到响应之后的批量写先结束，本地增量不会被并发改动；它失败了，这次调用要先把增量写进R2，写不进就 503
      if (entry.writing) await entry.writing;
      let doc = await read();
      if (entry.failed) { if (entry.count) doc = await flush(doc); else entry.failed = false; }
      for (let attempt = 0; attempt < 64; attempt++) {
        const used = (doc.stored.keys[key.id] || 0) + (entry.pending[key.id] || 0), total = doc.stored.total + entry.count;
        if (used < KEY_LIMIT - NEAR && total < ACCOUNT_LIMIT - NEAR) {
          entry.pending[key.id] = (entry.pending[key.id] || 0) + 1; entry.count++;
          if (entry.count < BATCH && now - entry.flushedAt < BATCH_MS) return result(doc.stored, false);
          if (!ctx?.waitUntil) return result((await flush(doc)).stored, false);
          // 响应先返回，批量写交给 waitUntil；失败时增量留在本地并记下，下一次调用先补写
          const writing = flush(doc).then(() => {}, () => { entry.failed = true; });
          entry.writing = writing;
          ctx.waitUntil(writing.then(() => { if (entry.writing === writing) entry.writing = null; }));
          return result(doc.stored, false);
        }
        // 剩余100次以内：判断和记入在同一次条件写里完成，多个isolate同时调用也不会超出
        const denied = used >= KEY_LIMIT || total >= ACCOUNT_LIMIT;
        if (denied && !entry.count) return result(doc.stored, true);
        const written = await write(doc, denied ? 0 : 1);
        if (written) return result(written.stored, denied);
        doc = await read();
      }
      unavailable();
    };
    const operation = entry.queue.then(run); entry.queue = operation.catch(() => {}); return operation;
  };
}
export function dailyUsage(bucket, key, now, ctx) {
  if (!states.has(bucket)) states.set(bucket, createUsageCounter());
  return states.get(bucket)(bucket, key, now, ctx);
}
