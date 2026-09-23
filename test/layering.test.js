// The rules must stay pure: game/ modules may import only each other plus a few
// DOM-free helpers, and everything they pull in has to load outside a browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const GAME = new URL('../src/js/game/', import.meta.url);
const ALLOWED = /^(\.\/[\w-]+\.js|\.\.\/(config|util|events)\.js)$/;
const importsOf = src => [...src.matchAll(/(?:\bfrom\s*|\bimport\s*)['"]([^'"]+)['"]/g)].map(m => m[1]);

test('config, util and device load without a DOM', async () => {
  const { isCoarse } = await import('../src/js/device.js');
  assert.equal(isCoarse, false);
  const { PADDLE_HW } = await import('../src/js/config.js');
  assert.equal(PADDLE_HW, 1.45);
  const { clamp } = await import('../src/js/util.js');
  assert.equal(clamp(5, 0, 3), 3);
});

test('game/ imports only game/, config, util and events', async () => {
  const files = (await readdir(GAME)).filter(f => f.endsWith('.js'));
  assert.ok(files.length >= 5, `expected the rule modules, found ${files}`);
  for (const f of files) {
    for (const spec of importsOf(await readFile(new URL(f, GAME), 'utf8')))
      assert.match(spec, ALLOWED, `game/${f} imports ${spec}`);
  }
});

test('every game/ module loads in Node', async () => {
  for (const f of (await readdir(GAME)).filter(f => f.endsWith('.js')))
    await import(new URL(f, GAME));
});
