// 零运行时依赖的站点发布检查与静态资源构建。
// 游戏目录、字形、交易市场与纯函数自检全部通过后才复制资源。
// 内容哈希覆盖交易所页面，输出仅包含公开站点文件（规格 11.1）。
import { createHash } from 'node:crypto';
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { collectCharacters, collectHubCharacters, missingGlyphs } from './tools/font-data.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(root, 'dist');
const siteFiles = ['index.html', '_headers', 'hub', 'entropy-blade', 'tbmh', 'trade'];

// ---------- release checks (no dependencies) ----------
const problems = [];
const check = (ok, message) => {
  if (!ok) problems.push(message);
};
// 模拟交易所发布检查（规格 11.1）。
try {
  const marketContext = {};
  vm.runInNewContext(readFileSync(path.join(root, 'trade/js/markets.js'), 'utf8'), marketContext);
  const markets = marketContext.TRADE_MARKETS;
  check(markets.length === 39, 'trade: expected 39 markets');
  check(new Set(markets.map((market) => market.coin)).size === markets.length, 'trade: duplicate coin');
  check(
    markets.every((market) => ['coin', 'name', 'spot', 'perp'].every((field) => market[field])),
    'trade: missing market field',
  );
  const vendor = readFileSync(path.join(root, 'trade/vendor/lightweight-charts.standalone.production.js'), 'utf8');
  check(
    vendor.startsWith('/*!') && vendor.includes('@license') && vendor.includes('5.2.1'),
    'trade: vendor version/license',
  );
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
const categoryIds = new Set(categories.map((entry) => entry.id));
const seen = new Set();
for (const game of games) {
  const where = `catalog "${game.id}"`;
  check(/^[a-z0-9-]{1,32}$/.test(game.id || ''), `${where}: id must be 1-32 lowercase letters, digits or dashes`);
  check(!seen.has(game.id), `${where}: duplicate id`);
  seen.add(game.id);
  check(categoryIds.has(game.category), `${where}: category "${game.category}" is not in CATEGORIES`);
  check(/^\d{4}-\d{2}-\d{2}$/.test(game.released || ''), `${where}: released must be YYYY-MM-DD`);
  check(
    siteFiles.includes((game.href || '').split('/')[0]),
    `${where}: add "${(game.href || '').split('/')[0]}" to siteFiles`,
  );
  for (const file of [game.href, game.cover, ...(game.cast || []).map((entry) => entry.img)])
    check(file && existsSync(path.join(root, file)), `${where}: missing ${file}`);
}
// cloud saves only for games that are on the hub
const { GAMES: saveGames } = await import(pathToFileURL(path.join(root, 'server/games/index.js')));
for (const id of Object.keys(saveGames)) check(seen.has(id), `server/games: "${id}" has no catalog entry`);
// the TBMH save cleaner knows every id the game can write
{
  const ctx = {};
  vm.runInNewContext(
    ['core.js', 'data.js'].map((filename) => readFileSync(path.join(root, 'tbmh/js', filename), 'utf8')).join('\n') +
      '\n;globalThis.__d = { CLASS_IDS, TYPES, LEGENDS, SLOT_CAT, AFFIXES, INSCRIBE_POOL, GRADES, SKILLS, ACTIVES, ' +
      'RUNE_SPEC, PETS, MONSTERS, BOSSES, STAGE_DEFS, MAT_IDS, DIFFS, ACT_COUNT, STAGES, HERO_MAX_LEVEL, CUBE_MAX, ' +
      'CHESTS, PARTY_MAX, LEGEND_GRADE };',
    ctx,
  );
  const data = ctx.__d,
    srv = await import(pathToFileURL(path.join(root, 'server/games/tbmh.js')));
  const same = (name, left, right) =>
    check(
      JSON.stringify([...left].sort()) === JSON.stringify([...right].sort()),
      `server/games/tbmh.js ${name} differs from tbmh/js/data.js`,
    );
  const pairs = (record) => Object.entries(record).map(([field, value]) => field + ':' + [].concat(value).join('/'));
  same('CLASSES', data.CLASS_IDS, srv.CLASSES);
  same(
    'TYPES',
    Object.entries(data.TYPES).map(([field, value]) => `${field}:${value.slot}/${value.cls || ''}`),
    pairs(srv.TYPES),
  );
  same(
    'ELEM_ROLL',
    Object.entries(data.TYPES)
      .filter(([, value]) => value.elemRoll)
      .map(([field, value]) => field + ':' + value.elemRoll.join('/')),
    pairs(srv.ELEM_ROLL),
  );
  same('SLOT_CAT', pairs(data.SLOT_CAT), pairs(srv.SLOT_CAT));
  same(
    'LEGENDS',
    Object.entries(data.LEGENDS).map(([field, value]) => `${field}:${value.cat}/${value.cls || ''}`),
    pairs(srv.LEGENDS),
  );
  same('AFFIXES', Object.keys(data.AFFIXES), srv.AFFIXES);
  same('INSCRIBE', data.INSCRIBE_POOL, srv.INSCRIBE);
  same(
    'GRADES',
    data.GRADES.map((game, gradeIndex) => `${gradeIndex}:${game.affixes}/${game.sockets.join('/')}`),
    srv.GRADES.map((game, gradeIndex) => `${gradeIndex}:${game.join('/')}`),
  );
  same('MATERIALS', data.MAT_IDS, srv.matIds());
  same(
    'SKILLS',
    Object.entries(data.SKILLS).map(
      ([field, value]) => `${field}:${value.cls}/${value.max}/${data.ACTIVES[field] ? 1 : 0}`,
    ),
    pairs(srv.SKILLS),
  );
  same(
    'RUNES',
    data.RUNE_SPEC.map((amount) => `${amount.id}:${amount.max}/${amount.p || 0}`),
    pairs(srv.RUNES),
  );
  same('PETS', Object.keys(data.PETS), srv.PETS);
  same('MONSTERS', Object.keys(data.MONSTERS), srv.MONSTERS);
  same('BOSSES', Object.keys(data.BOSSES), srv.BOSSES);
  same(
    'CHAMPS',
    data.STAGE_DEFS.flat()
      .filter((st) => st.boss.kind === 'champ')
      .map((st) => st.boss.key),
    srv.CHAMPS,
  );
  const limits = srv.LIMITS;
  check(
    limits.diffs === data.DIFFS.length &&
      limits.acts === data.ACT_COUNT &&
      limits.stages === data.STAGES &&
      limits.heroMax === data.HERO_MAX_LEVEL &&
      limits.cubeMax === data.CUBE_MAX &&
      limits.chests === data.CHESTS.length &&
      limits.party === data.PARTY_MAX,
    'server/games/tbmh.js LIMITS differ from tbmh/js/data.js',
  );
}
// pixel fonts cover every character their pages draw
{
  const hubMissing = missingGlyphs(
    readFileSync(path.join(root, 'hub/fusion-pixel-12.woff2')),
    collectHubCharacters(root),
  );
  check(!hubMissing.length, `hub font lacks "${hubMissing.join('')}" — run node tools/hub-font.mjs`);
  const ctx = { window: {} };
  vm.runInNewContext(readFileSync(path.join(root, 'tbmh/js/font.js'), 'utf8'), ctx);
  const js = path.join(root, 'tbmh/js');
  const text = collectCharacters([
    path.join(root, 'tbmh/index.html'),
    ...readdirSync(js)
      .filter((filename) => filename.endsWith('.js') && filename !== 'font.js')
      .map((filename) => path.join(js, filename)),
  ]);
  const tbMissing = missingGlyphs(Buffer.from(ctx.window.TBMH_FONT.fp12, 'base64'), text);
  check(!tbMissing.length, `tbmh font lacks "${tbMissing.join('')}" — run node tools/game-font.mjs tbmh`);
}
if (problems.length) {
  console.error('Build checks failed:\n- ' + problems.join('\n- '));
  process.exit(1);
}
// local-only work folders inside the site tree (git-ignored, e.g. the trailer project) never ship
const localOnly = [path.join(root, 'entropy-blade', 'promo')];
const shipped = (src) => !localOnly.some((dir) => src === dir || src.startsWith(dir + path.sep));

function filesIn(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const file = path.join(dir, entry.name);
      return entry.isDirectory() ? filesIn(file) : [file];
    })
    .sort();
}

rmSync(out, { recursive: true, force: true });
for (const name of siteFiles) {
  cpSync(path.join(root, name), path.join(out, name), { recursive: true, filter: shipped });
}

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

for (const file of stagedFiles.filter((file) => file.endsWith('.html'))) {
  let html = readFileSync(file, 'utf8');
  html = html.replace(
    /\b(src|href)=(['"])([^'"\n]+)\2/gi,
    (matchedAttribute, attr, quote, url) => `${attr}=${quote}${versionUrl(url)}${quote}`,
  );
  html = html.replace(/url\((['"]?)([^)'"\s]+)\1\)/gi,
    (matchedUrl, quote, url) => `url(${quote}${versionUrl(url)}${quote})`);
  html = html.replace('</head>', `<script>window.BUILD='${version}';</script>\n</head>`);
  writeFileSync(file, html, 'utf8');
}

console.log(
  `Checked ${games.length} catalog games in ${categoryIds.size} categories; built ${stagedFiles.length} files in dist (assets ${version}).`,
);
