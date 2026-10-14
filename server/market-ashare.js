// Public read-only list fallback. Remote dev: Eastmoney returned 502, Tencent returned usable rows.
import { GateClient } from './trade/gate.js';
import { upstream } from './trade/upstream.js';
const QQ = 'https://proxy.finance.qq.com/cgi/cgi-bin/rank/hs/getBoardRankList';
const rates = new WeakMap();
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
  return { total: data.total, rows: data.rank_list.map(row => ({ code: row.code, name: row.name,
    last: number(row.zxj), percent: number(row.zdf), change: number(row.zd), turnoverRate: number(row.hsl),
    // aStock's turnover is in ten-thousand CNY; the public Tencent quote-centre renderer confirms this unit.
    turnover: number(row.turnover) == null ? null : number(row.turnover) * 10000, high: null, low: null,
  })).filter(row => typeof row.code === 'string' && typeof row.name === 'string' && row.last != null && row.percent != null) };
}
async function allRows(budget) {
  const url = offset => QQ + '?' + new URLSearchParams({ _appver: '11.17.0', board_code: 'aStock',
    sort_type: 'price', direct: 'down', offset, count: 200 });
  // Tencent rejects code/name sorting. Read one price-ordered snapshot shared by every board/sort for 30 seconds.
  return upstream(url(0), 30, async response => {
    const first = parseRank(await response.json());
    if (!first.rows.length) throw Error('empty rank');
    const offsets = Array.from({ length: Math.ceil(first.total / 200) - 1 }, (_, index) => (index + 1) * 200);
    if (offsets.length > 30 - budget.used) throw Error('upstream budget');
    const remaining = await Promise.all(offsets.map(offset => upstream(url(offset), 30,
      async next => parseRank(await next.json()), budget, true)));
    if (remaining.some(page => !page.rows.length)) throw Error('incomplete rank');
    return [...new Map([first, ...remaining].flatMap(page => page.rows).filter(row => isStock(row.code))
      .map(row => [row.code, row])).values()];
  }, budget);
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
export async function ashareList(request, env) {
  if (request.method !== 'GET') return { status: 405, body: { error: 'method_not_allowed' }, headers: { Allow: 'GET' } };
  try {
    const { board, sort, page } = listParameters(new URL(request.url));
    const wait = await marketRate(env, request.headers.get('CF-Connecting-IP') || 'local');
    if (wait) return { status: 429, body: { error: 'rate_limited', retryAfter: wait }, headers: { 'Retry-After': String(wait) } };
    const field = sort === 2 ? 'turnover' : 'percent', direction = sort === 1 ? 1 : -1;
    const rows = (await allRows(new GateClient())).filter(row => boards[board](row.code))
      .sort((a, b) => direction * ((a[field] ?? 0) - (b[field] ?? 0)) || a.code.localeCompare(b.code));
    return { status: 200, body: { total: rows.length, rows: rows.slice((page - 1) * 50, page * 50), source: 'tencent' } };
  } catch (error) {
    return { status: error.status || 503, body: { error: error.code || 'market_unavailable' } };
  }
}
