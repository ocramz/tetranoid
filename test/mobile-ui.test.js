import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('buttons opt into touch-action manipulation to avoid double-tap zoom', async () => {
  const css = await readFile(new URL('../src/css/base.css', import.meta.url), 'utf8');
  assert.match(css, /\bbutton\s*\{[^}]*touch-action\s*:\s*manipulation\s*;?/s);
});
