import { createHash } from 'node:crypto';
import { cpSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(root, 'dist');
const siteFiles = ['index.html', '_headers', '_routes.json', 'hub', 'entropy-blade'];
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

console.log(`Built ${stagedFiles.length} files in dist (assets ${version}).`);
