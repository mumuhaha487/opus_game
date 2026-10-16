// 白线以内：云存档白名单清洗。存档文档 { v, meta, auto, slots[3], updated, deleted? }：
// meta 为图鉴与解法记录（跨存档常驻），auto / slots 为“幕 + 剧情标记 + 已完成目标 + 剪贴板”的快照。
// deleted { auto, slots[3] } 为自动存档与各存档位的删除时间（毫秒，0 为没删过），客户端合并时与快照的 time 比较；
// 没有删除记录的旧文档清洗结果与原来相同。
// 单机解谜，没有经济系统：只保证结构、类型、长度与数值范围，不做进度推演。
const ID = /^[A-Za-z0-9_.:+-]{1,48}$/;
const SHORT = /^[A-Za-z0-9_.:+-]{0,32}$/;
const forbidden = new Set(['__proto__', 'constructor', 'prototype']);
const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const int = (v, min, max) => Number.isInteger(v) && v >= min && v <= max ? v : undefined;
function map(value, limit, clean) {
  const out = {};
  if (!isObject(value)) return out;
  for (const [key, item] of Object.entries(value)) {
    if (Object.keys(out).length >= limit) break;
    if (forbidden.has(key) || !ID.test(key)) continue;
    const cleaned = clean(item);
    if (cleaned !== undefined) out[key] = cleaned;
  }
  return out;
}
const one = v => (v === true || v === 1 ? 1 : undefined);
const count = v => int(v, 0, 1e6);
const id = v => (typeof v === 'string' && ID.test(v) ? v : undefined);
// 剧情标记：布尔、null、小整数、短标识、短标识列表（如剪线顺序）、标识→真 的小表（如书签）
function flag(v) {
  if (v === null || typeof v === 'boolean') return v;
  if (typeof v === 'number') return int(v, -1e6, 1e6);
  if (typeof v === 'string') return SHORT.test(v) ? v : undefined;
  if (Array.isArray(v)) return v.length <= 8 && v.every(x => typeof x === 'string' && ID.test(x)) ? v.slice() : undefined;
  if (isObject(v)) return map(v, 32, x => (typeof x === 'boolean' ? x : undefined));
  return undefined;
}
function snapshot(value) {
  if (!isObject(value)) return null;
  const act = int(value.act, 1, 4);
  if (act === undefined) return null;
  const out = { v: 1, act, loopNo: int(value.loopNo, 0, 1e7) ?? 4096, fails: int(value.fails, 0, 1e7) ?? 4095,
    cap: int(value.cap, 1, 9) ?? 3, time: int(value.time, 0, 9e15) ?? 0,
    flags: map(value.flags, 64, flag), done: map(value.done, 64, x => (x === true || x === 1 ? true : undefined)),
    used: map(value.used, 32, id),
    clip: Array.isArray(value.clip) ? value.clip.slice(0, 9).flatMap(item => isObject(item) && id(item.t)
      && (item.o === null || item.o === undefined || id(item.o)) ? [{ t: item.t, o: item.o ?? null }] : []) : [] };
  const obj = id(value.obj);
  if (obj) out.obj = obj;
  return out;
}
function meta(value) {
  const m = isObject(value) ? value : {};
  return {
    dex: map(m.dex, 1024, count), combos: map(m.combos, 2048, one), tagsSeen: map(m.tagsSeen, 512, one),
    endings: map(m.endings, 16, one), secrets: map(m.secrets, 32, one),
    solutions: map(m.solutions, 32, node => map(node, 64, one)),
    cleared: m.cleared === true, sandbox: m.sandbox === true,
  };
}
// 删除记录：非法的时间按 0（没删过）处理；全部为 0 时不写这个字段
function deleted(value) {
  if (!isObject(value)) return undefined;
  const slots = Array.isArray(value.slots) ? value.slots : [];
  const out = { auto: int(value.auto, 0, 9e15) ?? 0, slots: [0, 1, 2].map(i => int(slots[i], 0, 9e15) ?? 0) };
  return out.auto || out.slots.some(Boolean) ? out : undefined;
}
export function clean(value) {
  if (!isObject(value)) return null;
  const slots = Array.isArray(value.slots) ? value.slots : [];
  const out = { v: 1, meta: meta(value.meta), auto: snapshot(value.auto),
    slots: [0, 1, 2].map(i => snapshot(slots[i])), updated: int(value.updated, 0, 9e15) ?? 0 };
  const gone = deleted(value.deleted);
  if (gone) out.deleted = gone;
  return out;
}
export function plausible() { return { ok: true }; }
