import { createHash } from 'node:crypto';
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { collectCharacters, collectHubCharacters, missingGlyphs } from './tools/font-data.mjs';
import { isDeepStrictEqual } from 'node:util';
import { derive } from './tools/derive-save-data.mjs';
import { SAVE_DATA } from './server/games/plausibility-data.js';
import { QUOTE_FIELDS as serverQuoteFields } from './server/trade/ashare-data.js';
import { QUOTE_FIELDS as clientQuoteFields } from './trade/js/ashare/feed.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(root, 'dist');
const siteFiles = ['index.html', '_headers', 'hub', 'entropy-blade', 'tbmh', 'trade', 'developer'];

// ---------- release checks (no dependencies) ----------
const problems = [];
const check = (ok, message) => { if (!ok) problems.push(message); };
// PLATFORM §5.3 / 第2b轮：游戏数值变化必须重建快照，避免正常存档被过期常量拒绝。
check(isDeepStrictEqual(JSON.parse(JSON.stringify(derive())), SAVE_DATA),
  'save data differs from game data — run node tools/derive-save-data.mjs');
// ASHARE §1.1、§7.12：腾讯解析两端字段表必须逐值相等。
check(isDeepStrictEqual(serverQuoteFields, clientQuoteFields), 'trade: client/server Tencent quote fields differ');
// 模拟交易所发布检查（规格 11.1）。
try {
  const marketContext = {};
  vm.runInNewContext(readFileSync(path.join(root, 'trade/js/markets.js'), 'utf8'), marketContext);
  const markets = marketContext.TRADE_MARKETS;
  check(markets.length === 39, 'trade: expected 39 markets');
  check(new Set(markets.map(market => market.coin)).size === markets.length, 'trade: duplicate coin');
  check(markets.every(market => ['coin', 'name', 'spot', 'perp'].every(field => market[field])), 'trade: missing market field');
  const vendor = readFileSync(path.join(root, 'trade/vendor/lightweight-charts.standalone.production.js'), 'utf8');
  check(vendor.startsWith('/*!') && vendor.includes('@license') && vendor.includes('5.2.1'), 'trade: vendor version/license');
  check(existsSync(path.join(root, 'trade/vendor/LICENSE')), 'trade: missing vendor LICENSE');
  const selfcheck = await import('./server/trade/selfcheck.js');
  console.log('Trade selfcheck: ' + JSON.stringify(selfcheck.runSelfcheck()));
} catch (error) {
  problems.push('trade: ' + error.message);
}
// every game on the hub has a category, a folder that ships, an entry page and its images
const catalogContext = {};
vm.runInNewContext(readFileSync(path.join(root, 'hub/catalog.js'), 'utf8'), catalogContext);
const { categories, games } = catalogContext.HUB_CATALOG;
const categoryIds = new Set(categories.map(c => c.id));
const seen = new Set();
for (const g of games) {
  const where = `catalog "${g.id}"`;
  check(/^[a-z0-9-]{1,32}$/.test(g.id || ''), `${where}: id must be 1-32 lowercase letters, digits or dashes`);
  check(!seen.has(g.id), `${where}: duplicate id`); seen.add(g.id);
  check(categoryIds.has(g.category), `${where}: category "${g.category}" is not in CATEGORIES`);
  check(/^\d{4}-\d{2}-\d{2}$/.test(g.released || ''), `${where}: released must be YYYY-MM-DD`);
  check(siteFiles.includes((g.href || '').split('/')[0]), `${where}: add "${(g.href || '').split('/')[0]}" to siteFiles`);
  for (const file of [g.href, g.cover, ...(g.cast || []).map(c => c.img)]) check(file && existsSync(path.join(root, file)), `${where}: missing ${file}`);
}
// cloud saves only for games that are on the hub
const { GAMES: saveGames } = await import(pathToFileURL(path.join(root, 'server/games/index.js')));
for (const id of Object.keys(saveGames)) check(seen.has(id), `server/games: "${id}" has no catalog entry`);
// the TBMH save cleaner knows every id the game can write
{
  const ctx = {};
  vm.runInNewContext(['core.js', 'data.js'].map(f => readFileSync(path.join(root, 'tbmh/js', f), 'utf8')).join('\n') +
    '\n;globalThis.__d = { CLASS_IDS, TYPES, LEGENDS, SLOT_CAT, AFFIXES, INSCRIBE_POOL, GRADES, SKILLS, ACTIVES, RUNE_SPEC, PETS, MONSTERS, BOSSES, STAGE_DEFS, MAT_IDS, DIFFS, ACT_COUNT, STAGES, HERO_MAX_LEVEL, CUBE_MAX, CHESTS, PARTY_MAX, LEGEND_GRADE };', ctx);
  const d = ctx.__d, srv = await import(pathToFileURL(path.join(root, 'server/games/tbmh.js')));
  const same = (name, a, b) => check(JSON.stringify([...a].sort()) === JSON.stringify([...b].sort()), `server/games/tbmh.js ${name} differs from tbmh/js/data.js`);
  const pairs = o => Object.entries(o).map(([k, v]) => k + ':' + [].concat(v).join('/'));
  same('CLASSES', d.CLASS_IDS, srv.CLASSES);
  same('TYPES', Object.entries(d.TYPES).map(([k, v]) => `${k}:${v.slot}/${v.cls || ''}`), pairs(srv.TYPES));
  same('ELEM_ROLL', Object.entries(d.TYPES).filter(([, v]) => v.elemRoll).map(([k, v]) => k + ':' + v.elemRoll.join('/')), pairs(srv.ELEM_ROLL));
  same('SLOT_CAT', pairs(d.SLOT_CAT), pairs(srv.SLOT_CAT));
  same('LEGENDS', Object.entries(d.LEGENDS).map(([k, v]) => `${k}:${v.cat}/${v.cls || ''}`), pairs(srv.LEGENDS));
  same('AFFIXES', Object.keys(d.AFFIXES), srv.AFFIXES);
  same('INSCRIBE', d.INSCRIBE_POOL, srv.INSCRIBE);
  same('GRADES', d.GRADES.map((g, i) => `${i}:${g.affixes}/${g.sockets.join('/')}`), srv.GRADES.map((g, i) => `${i}:${g.join('/')}`));
  same('MATERIALS', d.MAT_IDS, srv.matIds());
  same('SKILLS', Object.entries(d.SKILLS).map(([k, v]) => `${k}:${v.cls}/${v.max}/${d.ACTIVES[k] ? 1 : 0}`), pairs(srv.SKILLS));
  same('RUNES', d.RUNE_SPEC.map(n => `${n.id}:${n.max}/${n.p || 0}`), pairs(srv.RUNES));
  same('PETS', Object.keys(d.PETS), srv.PETS);
  same('MONSTERS', Object.keys(d.MONSTERS), srv.MONSTERS);
  same('BOSSES', Object.keys(d.BOSSES), srv.BOSSES);
  same('CHAMPS', d.STAGE_DEFS.flat().filter(st => st.boss.kind === 'champ').map(st => st.boss.key), srv.CHAMPS);
  const L = srv.LIMITS;
  check(L.diffs === d.DIFFS.length && L.acts === d.ACT_COUNT && L.stages === d.STAGES && L.heroMax === d.HERO_MAX_LEVEL && L.cubeMax === d.CUBE_MAX && L.chests === d.CHESTS.length && L.party === d.PARTY_MAX, 'server/games/tbmh.js LIMITS differ from tbmh/js/data.js');
}
// pixel fonts cover every character their pages draw
{
  const hubMissing = missingGlyphs(readFileSync(path.join(root, 'hub/fusion-pixel-12.woff2')), collectHubCharacters(root));
  check(!hubMissing.length, `hub font lacks "${hubMissing.join('')}" — run node tools/hub-font.mjs`);
  const ctx = { window: {} };
  vm.runInNewContext(readFileSync(path.join(root, 'tbmh/js/font.js'), 'utf8'), ctx);
  const js = path.join(root, 'tbmh/js');
  const text = collectCharacters([path.join(root, 'tbmh/index.html'), ...readdirSync(js).filter(f => f.endsWith('.js') && f !== 'font.js').map(f => path.join(js, f))]);
  const tbMissing = missingGlyphs(Buffer.from(ctx.window.TBMH_FONT.fp12, 'base64'), text);
  check(!tbMissing.length, `tbmh font lacks "${tbMissing.join('')}" — run node tools/game-font.mjs tbmh`);
}
if (problems.length) {
  console.error('Build checks failed:\n- ' + problems.join('\n- '));
  process.exit(1);
}
// local-only work folders inside the site tree (git-ignored, e.g. the trailer project) never ship
const localOnly = [path.join(root, 'entropy-blade', 'promo')];
const shipped = src => !localOnly.some(dir => src === dir || src.startsWith(dir + path.sep));

function filesIn(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? filesIn(file) : [file];
  }).sort();
}

rmSync(out, { recursive: true, force: true });
for (const name of siteFiles) {
  cpSync(path.join(root, name), path.join(out, name), { recursive: true, filter: shipped });
}
// PLATFORM §5.4、ASHARE §6：JSONP搜索只放行明确的东方财富主机；CSP输出必须单行。
// 源文件使用标记，构建展开，避免新增源代码行超过140字符。
const beaconScript = 'https://static.cloudflareinsights.com', beaconConnect = 'https://cloudflareinsights.com';
const connectHosts = 'https://api.gateio.ws wss://api.gateio.ws wss://fx-ws.gateio.ws https://qt.gtimg.cn'
    + ' https://fx-api.gateio.ws https://sqt.gtimg.cn https://push2delay.eastmoney.com'
    + ' https://data-api.binance.vision wss://data-stream.binance.vision'
    + ' https://web.ifzq.gtimg.cn https://ifzq.gtimg.cn https://push2.eastmoney.com'
    + ' https://push2his.eastmoney.com https://searchapi.eastmoney.com ' + beaconConnect;
const pagePolicy = trade => [
  "default-src 'self'", "script-src 'self' 'unsafe-inline' " + beaconScript
    + (trade ? ' https://searchapi.eastmoney.com' : ''),
  "connect-src 'self' " + connectHosts,
  "img-src 'self' data:", "style-src 'self' 'unsafe-inline'", "font-src 'self'", "frame-ancestors 'none'",
].join('; ');
const headersPath = path.join(out, '_headers');
writeFileSync(headersPath, readFileSync(headersPath, 'utf8').replace('# BUILD_TRADE_CSP',
  '  Content-Security-Policy: ' + pagePolicy(true)).replace('# BUILD_DEVELOPER_CSP',
  '  Content-Security-Policy: ' + pagePolicy(false)));
// 第五轮收尾：两页必须同时允许自动注入的 Web Analytics 脚本和信标，CSP 保持单行。
const policies = [...readFileSync(headersPath, 'utf8').matchAll(/^  Content-Security-Policy: (.+)$/gm)];
check(policies.length === 2 && policies.every(([, policy]) => policy.includes(beaconScript) && policy.includes(beaconConnect)),
  'trade/developer CSP must allow Cloudflare Web Analytics script and beacon');
if (problems.length) { console.error('Build checks failed:\n- ' + problems.join('\n- ')); process.exit(1); }

// Hash the staged site so unchanged builds keep the same asset URLs.
const stagedFiles = filesIn(out);
const hash = createHash('sha256');
for (const file of stagedFiles) {
  hash.update(path.relative(out, file).split(path.sep).join('/'));
  hash.update('\0');
  hash.update(readFileSync(file));
  hash.update('\0');
}
const version = hash.digest('hex').slice(0, 16);
const asset = /\.(?:js|css|png|webp|jpe?g|svg|ico|woff2?)(?:[?#]|$)/i;

function versionUrl(url) {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(url) || !asset.test(url)) return url;
  const fragment = url.indexOf('#');
  const base = fragment < 0 ? url : url.slice(0, fragment);
  const suffix = fragment < 0 ? '' : url.slice(fragment);
  return base + (base.includes('?') ? '&' : '?') + 'v=' + version + suffix;
}

for (const file of stagedFiles.filter(file => file.endsWith('.html'))) {
  let html = readFileSync(file, 'utf8');
  html = html.replace(/\b(src|href)=(['"])([^'"\n]+)\2/gi,
    (_, attr, quote, url) => `${attr}=${quote}${versionUrl(url)}${quote}`);
  html = html.replace(/url\((['"]?)([^)'"\s]+)\1\)/gi,
    (_, quote, url) => `url(${quote}${versionUrl(url)}${quote})`);
  html = html.replace('</head>', `<script>window.BUILD='${version}';</script>\n</head>`);
  writeFileSync(file, html, 'utf8');
}

console.log(`Checked ${games.length} catalog games in ${categoryIds.size} categories; built ${stagedFiles.length} files in dist (assets ${version}).`);
