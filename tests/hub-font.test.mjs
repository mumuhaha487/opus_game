import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { collectHubCharacters, woff2Tables, cmapGlyph } from '../tools/font-data.mjs';

test('hub WOFF2 cmap covers all source characters and printable ASCII', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const cmap = woff2Tables(readFileSync(new URL('../hub/fusion-pixel-12.woff2', import.meta.url)))('cmap');
  const missing = [...collectHubCharacters(root)].filter(char => !cmapGlyph(cmap, char.codePointAt(0)));
  assert.deepEqual(missing, []);
});
