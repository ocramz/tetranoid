import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expectedBlock, readServiceWorker } from '../tools/precache.mjs';

// Without a fresh VERSION, installed copies of the game would never see a change.
test('src/sw.js precaches the current files (run `npm run precache` after changing src/)', async () => {
  const { block } = await readServiceWorker();
  assert.equal(block, await expectedBlock());
});
