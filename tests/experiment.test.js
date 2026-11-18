import assert from 'node:assert/strict';
import test from 'node:test';
import { Experiment, MAX_PRICES, RotationPractice } from '../docs/js/experiment.js';
import { inOrderNodes } from '../docs/js/trees.js';

test('manual insertion keeps the trees in sync and handles duplicates, zero, and undo', () => {
  const lab = new Experiment();
  assert.equal(lab.suggestTarget(), null);
  assert.equal(lab.insertPrice(0).status, 'inserted');
  assert.equal(lab.insertPrice(0).status, 'duplicate');
  const run = [1, 2].map(key => lab.insertPrice(key));
  assert.deepEqual(run[1].bstPath, [0, 1]);
  assert.equal(lab.challenge.pivot, 0);
  assert.equal(lab.suggestTarget(), 2);
  assert.equal(lab.undo(), 2);
  assert.equal(lab.challenge, null);
  assert.equal(lab.search(2).bst.found, false);
  assert.deepEqual(inOrderNodes(lab.bst).map(node => node.key), [0, 1]);
  assert.deepEqual(inOrderNodes(lab.avl).map(node => node.key), [0, 1]);
});

test('steps and replays the saved order, including repeatable shuffle and batch undo', () => {
  const lab = new Experiment();
  lab.setSource([5, 0, 9, 0, 2]);
  lab.setOrder('shuffle', () => 0);
  const shuffled = [...lab.preview];
  assert.equal(lab.startReplay(), true);
  assert.equal(lab.step().entry.key, shuffled[0]);
  assert.equal(lab.step().entry.key, shuffled[1]);
  assert.equal(lab.undo(), shuffled[1]);
  assert.equal(lab.batch.cursor, 1);
  assert.equal(lab.step().entry.key, shuffled[1]);
  assert.equal(lab.startReplay(), true);
  while (lab.step()) { /* drain the sequence */ }
  assert.deepEqual(lab.history.map(entry => entry.key), shuffled);
  lab.clear();
  assert.deepEqual(lab.preview, shuffled);
  assert.deepEqual(lab.source, [5, 0, 9, 2]);
  assert.equal(lab.batch, null);
  assert.equal(lab.bst, null);
});

test('changing the preview preserves the active run and a manual insert ends its queue', () => {
  const lab = new Experiment();
  lab.setSource([4, 1, 7]);
  lab.startReplay();
  lab.step();
  lab.setOrder('descending');
  assert.equal(lab.step().entry.key, 1);
  assert.equal(lab.insertPrice(4).status, 'duplicate');
  assert.equal(lab.batch.cursor, 2);
  lab.insertPrice(3);
  assert.equal(lab.batch, null);
  assert.equal(lab.step(), null);
  assert.deepEqual(lab.history.map(entry => entry.key), [4, 1, 3]);
  assert.deepEqual(lab.preview, [7, 4, 1]);
});

test('reports measured heights and prefix search costs from the actual run', () => {
  const lab = new Experiment();
  for (const key of [10, 20, 30, 40]) lab.insertPrice(key);
  assert.deepEqual(lab.summary(40).map(row => [
    row.bstHeight, row.avlHeight, row.bstSearch, row.avlSearch,
  ]), [[0, 0, 1, 1], [1, 1, 2, 2], [2, 1, 3, 2], [3, 2, 4, 3]]);
  assert.equal(lab.search(40).avl.found, true);
  assert.equal(lab.search(50).avl.found, false);
  assert.equal(lab.history.length, 4);
});

test('enforces the same capacity for manual and batch runs', () => {
  const lab = new Experiment();
  const keys = Array.from({ length: MAX_PRICES + 1 }, (_, key) => key);
  lab.setSource(keys);
  assert.equal(lab.startReplay(), false);
  for (const key of keys.slice(0, -1)) assert.equal(lab.insertPrice(key).status, 'inserted');
  assert.equal(lab.insertPrice(keys.at(-1)).status, 'full');
  assert.equal(lab.history.length, MAX_PRICES);
});

test('practice handles legal and invalid drops, double rotations, undo, and retry independently', () => {
  const lab = new Experiment();
  for (const key of [30, 10, 20]) lab.insertPrice(key);
  const practice = new RotationPractice(lab.challenge.before);
  assert.equal(practice.drop(20, 30), null);
  assert.equal(practice.rotate(30, 'left'), null);
  assert.equal(practice.drop(20, 10).direction, 'left');
  assert.ok(practice.violations().length);
  assert.equal(practice.drop(20, 30).direction, 'right');
  assert.equal(practice.violations().length, 0);
  assert.deepEqual(inOrderNodes(practice.root).map(node => node.key), [10, 20, 30]);
  assert.equal(practice.undo(), true);
  assert.ok(practice.violations().length);
  assert.equal(practice.undo(), true);
  assert.equal(practice.undo(), false);
  practice.rotate(10, 'left');
  practice.retry();
  assert.equal(practice.root.key, 30);
  assert.equal(practice.history.length, 0);
  assert.equal(lab.avl.key, 20);
  assert.equal(lab.challenge.before.left.key, 10);
});
