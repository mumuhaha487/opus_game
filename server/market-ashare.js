// Public read-only list fallback. Remote dev: Eastmoney returned 502, Tencent returned usable rows.
import { GateClient } from './trade/gate.js';
import { upstream, cacheIsFresh } from './trade/upstream.js';
const QQ = 'https://proxy.finance.qq.com/cgi/cgi-bin/rank/hs/getBoardRankList';
const rates = new WeakMap();
const globalRates = new WeakMap();
const CACHE_ROOT = 'https://trade-cache.game.inc.re/ashare-list-v2/';
let snapshotPending;
const isStock = code => /^(sh(?:60|68)|sz(?:00|30))\d{4}$/.test(code);
const boards = [isStock, code => /^sh60\d{4}$/.test(code), code => /^sz00\d{4}$/.test(code),
  code => /^sz30\d{4}$/.test(code), code => /^sh68\d{4}$/.test(code)];
export function listParameters(url) {
  const query = url.searchParams;
  for (const name of query.keys()) if (!['board', 'sort', 'page'].includes(name) || query.getAll(name).length !== 1) {
    throw { status: 400, code: 'bad_request' };
  }
  const board = query.get('board') ?? '0', sort = query.get('sort') ?? '0', page = query.get('page') ?? '1';
  if (!/^[0-4]$/.test(board) || !/^[0-2]$/.test(sort) || !/^[1-9]\d{0,2}$/.test(page) || +page > 200) {
    throw { status: 400, code: 'bad_request' };
  }
  return { board: +board, sort: +sort, page: +page };
}
export function parseRank(payload) {
  const data = payload?.data;
  if (payload?.code !== 0 || !Array.isArray(data?.rank_list) || !Number.isSafeInteger(data.total) || data.total <= 0) {
    throw Error('invalid rank');
  }
  const number = value => value !== '' && value != null && Number.isFinite(Number(value)) ? Number(value) : null;
  return { total: data.total, rows: data.rank_list.map(row => [row.code, row.name,
    number(row.zxj), number(row.zdf), number(row.zd),
    // aStock's turnover is in ten-thousand CNY; the public Tencent quote-centre renderer confirms this unit.
    number(row.turnover) == null ? null : number(row.turnover) * 10000, number(row.hsl),
  ]).filter(row => typeof row[0] === 'string' && typeof row[1] === 'string' && row[2] != null && row[3] != null) };
}
async function cached(path) {
  const response = await globalThis.caches?.default?.match(new Request(CACHE_ROOT + path));
  return cacheIsFresh(response, 30) ? response : null;
}
async function store(path, value, fetchedAt) {
  if (globalThis.caches?.default) await caches.default.put(new Request(CACHE_ROOT + path),
    new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=30', 'X-Fetched-At': String(fetchedAt) } }));
}
async function fetchSnapshot(budget) {
  const url = offset => QQ + '?' + new URLSearchParams({ _appver: '11.17.0', board_code: 'aStock',
    sort_type: 'price', direct: 'down', offset, count: 200 });
  // Tencent rejects code/name sorting. Read one price-ordered snapshot shared by every board/sort for 30 seconds.
  const first = await upstream(url(0), 30, async response => parseRank(await response.json()), budget, true);
  if (!first.rows.length) throw Error('empty rank');
  const offsets = Array.from({ length: Math.ceil(first.total / 200) - 1 }, (_, index) => (index + 1) * 200);
  if (offsets.length > (budget.budgetLimit ?? 30) - budget.used) throw { code: 'upstream_budget' };
  const remaining = await Promise.all(offsets.map(offset => upstream(url(offset), 30,
    async next => parseRank(await next.json()), budget, true)));
  if (remaining.some(page => !page.rows.length)) throw Error('incomplete rank');
  return [...new Map([first, ...remaining].flatMap(page => page.rows).filter(row => isStock(row[0]))
    .map(row => [row[0], row])).values()];
}
async function allRows(budget) {
  // Versioned keys cannot mistake old object snapshots for compact arrays.
  const hit = await cached('snapshot');
  if (hit) return { rows: await hit.json(), fetchedAt: Number(hit.headers.get('X-Fetched-At')) };
  if (!snapshotPending) snapshotPending = (async () => {
    const rows = await fetchSnapshot(budget), fetchedAt = Date.now();
    await store('snapshot', rows, fetchedAt); return { rows, fetchedAt };
  })();
  const pending = snapshotPending;
  try { return await pending; } finally { if (snapshotPending === pending) snapshotPending = null; }
}
export function selectRows(snapshot, { board, sort, page }) {
  const field = sort === 2 ? 5 : 3, direction = sort === 1 ? 1 : -1;
  const rows = snapshot.filter(row => boards[board](row[0]))
    .sort((a, b) => direction * ((a[field] ?? 0) - (b[field] ?? 0)) || a[0].localeCompare(b[0]));
  return { total: rows.length, source: 'tencent', rows: rows.slice((page - 1) * 50, page * 50)
    .map(([code, name, last, percent, change, turnover, turnoverRate]) =>
      ({ code, name, last, percent, change, turnover, turnoverRate, high: null, low: null })) };
}
export async function marketRate(env, ip, now = Date.now()) {
  const key = 'market-list:' + ip, retryAfter = 60 - Math.floor(now / 1000) % 60;
  if (env.MARKET_RATE?.limit) {
    try { return (await env.MARKET_RATE.limit({ key })).success ? 0 : retryAfter; } catch { /* local fallback */ }
  }
  if (!rates.has(env)) rates.set(env, new Map());
  const counters = rates.get(env), minute = Math.floor(now / 60000), previous = counters.get(key);
  const count = previous?.minute === minute ? previous.count + 1 : 1;
  counters.set(key, { minute, count });
  if (counters.size > 10000) for (const [name, entry] of counters) if (entry.minute < minute) counters.delete(name);
  return count > 30 ? retryAfter : 0;
}
export async function marketGlobal(env, now = Date.now()) {
  if (env.MARKET_GLOBAL?.limit) {
    try { return (await env.MARKET_GLOBAL.limit({ key: 'all' })).success; } catch { /* local fallback */ }
  }
  const minute = Math.floor(now / 60000), previous = globalRates.get(env);
  const count = previous?.minute === minute ? previous.count + 1 : 1;
  globalRates.set(env, { minute, count }); return count <= 120;
}
// 一页 A 股行情（50 行）：网页列表与 /api/v1/markets 共用同一份 30 秒快照与结果缓存。
export async function ashareRows({ board, sort, page }) {
  const path = 'result/' + [board, sort, page].join('/'), hit = await cached(path);
  if (hit) return hit.json();
  const snapshot = await allRows(new GateClient()), body = selectRows(snapshot.rows, { board, sort, page });
  // Results expire with their snapshot, rather than extending old prices by another 30 seconds.
  await store(path, body, snapshot.fetchedAt);
  return body;
}
export async function ashareList(request, env) {
  if (request.method !== 'GET') return { status: 405, body: { error: 'method_not_allowed' }, headers: { Allow: 'GET' } };
  try {
    const { board, sort, page } = listParameters(new URL(request.url));
    const wait = await marketRate(env, request.headers.get('CF-Connecting-IP') || 'local');
    if (wait) return { status: 429, body: { error: 'rate_limited', retryAfter: wait }, headers: { 'Retry-After': String(wait) } };
    if (!await marketGlobal(env)) return { status: 503, body: { error: 'market_busy' } };
    return { status: 200, body: await ashareRows({ board, sort, page }) };
  } catch (error) {
    return { status: error.status || 503, body: { error: error.code || 'market_unavailable' } };
  }
}
