// The rules must stay pure, so everything they depend on has to load outside a browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('config, util and device load without a DOM', async () => {
  const { isCoarse } = await import('../src/js/device.js');
  assert.equal(isCoarse, false);
  const { PADDLE_HW } = await import('../src/js/config.js');
  assert.equal(PADDLE_HW, 1.45);
  const { clamp } = await import('../src/js/util.js');
  assert.equal(clamp(5, 0, 3), 3);
});
