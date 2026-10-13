// PLATFORM §6.5 / 第2b轮：北京时间每日Key1500、账号3000，isolate内累计25次或60秒后CAS合并。
// 同账号队列串行化本地计数；每次读R2加本地增量，冲突重读，失败保持增量并拒绝业务。
// 批次尚未落盘时其它isolate不可见；误差和isolate销毁限制见REPORT-2b。
import { absent } from './store.js';
const states = new WeakMap();
export const usageDay = now => new Date(now + 28800000).toISOString().slice(0, 10);
export function createUsageCounter() {
  const entries = new Map();
  return async (bucket, key, now = Date.now()) => {
    const day = usageDay(now), path = `apikeys/usage/${key.uid}/${day}.json`;
    let entry = entries.get(path);
    if (!entry) {
      entry = { pending: {}, count: 0, flushedAt: now, queue: Promise.resolve() }; entries.set(path, entry);
    }
    const run = async () => {
      let object = await bucket.get(path), stored = object ? await object.json() : { day, total: 0, keys: {} };
      const used = (stored.keys[key.id] || 0) + (entry.pending[key.id] || 0), total = stored.total + entry.count;
      const denied = used >= 1500 || total >= 3000;
      if (!denied) { entry.pending[key.id] = (entry.pending[key.id] || 0) + 1; entry.count++; }
      if (entry.count && (denied || entry.count >= 25 || now - entry.flushedAt >= 60000)) {
        let written = false;
        for (let attempt = 0; attempt < 64; attempt++) {
          const merged = { day, total: stored.total + entry.count, keys: { ...stored.keys } };
          for (const [id, count] of Object.entries(entry.pending)) merged.keys[id] = (merged.keys[id] || 0) + count;
          const onlyIf = object ? { etagMatches: object.etag } : absent();
          if (await bucket.put(path, JSON.stringify(merged), { onlyIf })) {
            stored = merged; entry.pending = {}; entry.count = 0; entry.flushedAt = now; written = true; break;
          }
          object = await bucket.get(path); stored = object ? await object.json() : { day, total: 0, keys: {} };
        }
        if (!written) throw { status: 503, code: 'storage_unavailable', message: '调用额度暂时不可用，请稍后再试' };
      }
      return { denied, keyRemaining: Math.max(0, 1500 - (stored.keys[key.id] || 0) - (entry.pending[key.id] || 0)),
        accountRemaining: Math.max(0, 3000 - stored.total - entry.count),
        retryAfter: Math.ceil((Date.parse(day + 'T00:00:00+08:00') + 86400000 - now) / 1000) };
    };
    const operation = entry.queue.then(run); entry.queue = operation.catch(() => {}); return operation;
  };
}
export function dailyUsage(bucket, key, now) {
  if (!states.has(bucket)) states.set(bucket, createUsageCounter());
  return states.get(bucket)(bucket, key, now);
}
