import { brotliDecompressSync } from 'node:zlib';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const tags = ['cmap','head','hhea','hmtx','maxp','name','OS/2','post','cvt ','fpgm','glyf','loca','prep','CFF ','VORG','EBDT','EBLC','gasp','hdmx','kern','LTSH','PCLT','VDMX','vhea','vmtx','BASE','GDEF','GPOS','GSUB','EBSC','JSTF','MATH','CBDT','CBLC','COLR','CPAL','SVG ','sbix','acnt','avar','bdat','bloc','bsln','cvar','fdsc','feat','fmtx','fvar','gvar','hsty','just','lcar','mort','morx','opbd','prop','trak','Zapf','Silf','Glat','Gloc','Feat','Sill'];
export function woff2Tables(font) {
  if (font.toString('ascii', 0, 4) !== 'wOF2') throw new Error('Expected WOFF2');
  let cursor = 48, offset = 0;
  const directory = new Map();
  const base128 = () => {
    let value = 0;
    for (let i = 0; i < 5; i++) {
      const byte = font[cursor++];
      if ((i === 0 && byte === 128) || value > 0x1ffffff) throw new Error('Invalid UIntBase128');
      value = value * 128 + (byte & 127);
      if (!(byte & 128)) return value;
    }
    throw new Error('Invalid UIntBase128');
  };
  for (let i = 0; i < font.readUInt16BE(12); i++) {
    const flags = font[cursor++], id = flags & 63, transform = flags >> 6;
    let tag = tags[id];
    if (id === 63) { tag = font.toString('ascii', cursor, cursor + 4); cursor += 4; }
    const length = base128();
    const transformed = tag === 'glyf' || tag === 'loca' ? transform !== 3 : transform !== 0;
    const size = transformed ? base128() : length;
    directory.set(tag, { offset, size, transformed });
    offset += size;
  }
  const data = brotliDecompressSync(font.subarray(cursor, cursor + font.readUInt32BE(20)));
  if (data.length !== offset) throw new Error('Invalid table stream length');
  return tag => {
    const table = directory.get(tag);
    if (!table || table.transformed) throw new Error('Missing or transformed table: ' + tag);
    return data.subarray(table.offset, table.offset + table.size);
  };
}
export function cmapGlyph(cmap, cp) {
  for (let i = 0; i < cmap.readUInt16BE(2); i++) {
    const record = 4 + i * 8, platform = cmap.readUInt16BE(record), encoding = cmap.readUInt16BE(record + 2);
    if (platform !== 0 && !(platform === 3 && (encoding === 1 || encoding === 10))) continue;
    const at = cmap.readUInt32BE(record + 4), format = cmap.readUInt16BE(at);
    if (format === 4 && cp <= 0xffff) {
      const n = cmap.readUInt16BE(at + 6) / 2, end = at + 14, start = end + 2 * n + 2, delta = start + 2 * n, ranges = delta + 2 * n;
      for (let j = 0; j < n; j++) {
        if (cp < cmap.readUInt16BE(start + j * 2) || cp > cmap.readUInt16BE(end + j * 2)) continue;
        const range = cmap.readUInt16BE(ranges + j * 2), d = cmap.readInt16BE(delta + j * 2);
        const raw = range ? cmap.readUInt16BE(ranges + j * 2 + range + 2 * (cp - cmap.readUInt16BE(start + j * 2))) : cp;
        const glyph = range && raw === 0 ? 0 : (raw + d) & 65535;
        if (glyph) return glyph;
      }
    } else if (format === 12) {
      for (let j = 0; j < cmap.readUInt32BE(at + 12); j++) {
        const group = at + 16 + j * 12, lo = cmap.readUInt32BE(group), hi = cmap.readUInt32BE(group + 4);
        if (cp >= lo && cp <= hi) return cmap.readUInt32BE(group + 8) + cp - lo;
      }
    }
  }
  return 0;
}
export function fontInfo(font, sample = '游戏汇总 ABCabc0123') {
  const table = woff2Tables(font), name = table('name'), strings = name.readUInt16BE(4), names = {};
  for (let i = 0; i < name.readUInt16BE(2); i++) {
    const at = 6 + i * 12, platform = name.readUInt16BE(at), language = name.readUInt16BE(at + 4), id = name.readUInt16BE(at + 6);
    if (![1, 2, 5].includes(id) || (platform !== 0 && platform !== 3) || (platform === 3 && language !== 0x409)) continue;
    const bytes = name.subarray(strings + name.readUInt16BE(at + 10), strings + name.readUInt16BE(at + 10) + name.readUInt16BE(at + 8));
    let text = '';
    for (let k = 0; k < bytes.length; k += 2) text += String.fromCharCode(bytes.readUInt16BE(k));
    names[id === 1 ? 'family' : id === 2 ? 'subfamily' : 'version'] = text;
  }
  const cmap = table('cmap'), hmtx = table('hmtx'), metrics = table('hhea').readUInt16BE(34);
  const widths = {};
  for (const char of sample) {
    const glyph = cmapGlyph(cmap, char.codePointAt(0));
    widths[char] = glyph ? hmtx.readUInt16BE(Math.min(glyph, metrics - 1) * 4) : null;
  }
  return { ...names, unitsPerEm: table('head').readUInt16BE(18), widths };
}
export function embeddedFont(root, key = 'fp12') {
  const context = { window: {} };
  vm.runInNewContext(readFileSync(path.join(root, 'entropy-blade/js/fontdata.js'), 'utf8'), context);
  return Buffer.from(context.window.FONT_DATA[key], 'base64');
}
// every visible character in the given files plus printable ASCII, sorted
export function collectCharacters(files) {
  const chars = new Set(Array.from({ length: 95 }, (_, i) => String.fromCodePoint(0x20 + i)));
  for (const file of files) for (const char of readFileSync(file, 'utf8')) {
    // Source formatting and control characters have no visible glyph.
    if (!/[\p{Cc}\p{Cf}]/u.test(char)) chars.add(char);
  }
  return [...chars].sort((a, b) => a.codePointAt(0) - b.codePointAt(0)).join('');
}
export function collectHubCharacters(root) {
  return collectCharacters([path.join(root, 'index.html'), ...readdirSync(path.join(root, 'hub')).filter(name => name.endsWith('.js')).sort().map(name => path.join(root, 'hub', name))]);
}
// characters a font subset is missing (empty when it covers everything)
export function missingGlyphs(font, text) {
  const cmap = woff2Tables(font)('cmap');
  return [...text].filter(char => !cmapGlyph(cmap, char.codePointAt(0)));
}
