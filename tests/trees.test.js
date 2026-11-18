import assert from 'node:assert/strict';
import test from 'node:test';
import { balance, copyTree, deepestKey, height, inOrderNodes, insert, rotateAt, search } from '../docs/js/trees.js';

function validate(root, requireAvl, low = -Infinity, high = Infinity) {
  if (!root) return -1;
  assert.ok(low < root.key && root.key < high);
  const left = validate(root.left, requireAvl, low, root.key);
  const right = validate(root.right, requireAvl, root.key, high);
  assert.equal(root.height, Math.max(left, right) + 1);
  if (requireAvl) assert.ok(Math.abs(left - right) <= 1);
  return root.height;
}

function build(keys, avl) {
  let result = { root: null };
  for (const key of keys) {
    result = insert(result.root, key, { avl });
    validate(result.root, avl);
  }
  return result;
}

const cases = [
  { keys: [30, 20, 10], directions: ['right'] },
  { keys: [10, 20, 30], directions: ['left'] },
  { keys: [30, 10, 20], directions: ['left', 'right'] },
  { keys: [10, 30, 20], directions: ['right', 'left'] },
];

for (const { keys, directions } of cases) {
  test(`repairs ${keys.join(', ')} at the root and below it`, () => {
    for (const prefix of [[], [50, 70]]) {
      const result = build([...prefix, ...keys], true);
      const rotation = result.rotation;
      assert.equal(rotation.pivot, keys[0]);
      assert.equal(Math.abs(balance(inOrderNodes(rotation.before).find(node => node.key === keys[0]))), 2);
      assert.deepEqual(rotation.steps.map(step => step.direction), directions);
      assert.equal(prefix.length ? result.root.left.key : result.root.key, 20);
      for (const frame of [rotation.before, ...rotation.steps.map(step => step.tree)]) {
        validate(frame, false);
        assert.deepEqual(inOrderNodes(frame).map(node => node.key), [...prefix, ...keys].sort((a, b) => a - b));
      }
      if (directions.length === 2) {
        assert.equal(rotation.steps[0].tree.key, rotation.before.key);
        assert.notDeepEqual(rotation.steps[0].tree, rotation.steps[1].tree);
      }
    }
  });
}

test('ascending and descending BSTs are chains while AVL stays balanced', () => {
  const keys = Array.from({ length: 64 }, (_, index) => index);
  for (const order of [keys, [...keys].reverse()]) {
    const bst = build(order, false).root;
    const avl = build(order, true).root;
    assert.equal(height(bst), keys.length - 1);
    assert.equal(search(bst, deepestKey(bst)).comparisons, keys.length);
    assert.ok(height(avl) < height(bst));
    assert.deepEqual(inOrderNodes(avl).map(node => node.key), keys);
  }
});

test('validates mixed insertion orders including rotations with attached subtrees', () => {
  for (const stride of [3, 11, 37]) {
    const keys = Array.from({ length: 101 }, (_, index) => (index * stride) % 101);
    assert.equal(inOrderNodes(build(keys, true).root).length, keys.length);
  }
});

test('reports exact hit, miss, and empty paths and skips duplicate keys', () => {
  const { root } = build([500, 300, 700, 400], false);
  assert.deepEqual(search(root, 400), { found: true, visited: [500, 300, 400], comparisons: 3 });
  assert.deepEqual(search(root, 350), { found: false, visited: [500, 300, 400], comparisons: 3 });
  assert.deepEqual(search(null, 350), { found: false, visited: [], comparisons: 0 });
  assert.equal(deepestKey(root), 400);
  assert.deepEqual(insert(root, 300), { root, visited: [500, 300], inserted: false, rotation: null });
});

test('manual rotations reconnect internal and root pivots and preserve the original copy', () => {
  const { root } = build([60, 20, 80, 10, 30, 25], false);
  const copy = copyTree(root);
  const internal = rotateAt(copy, 20, 'left');
  assert.equal(internal.root.left.key, 30);
  assert.equal(internal.root.left.left.right.key, 25);
  const newRoot = rotateAt(internal.root, 60, 'right').root;
  assert.equal(newRoot.key, 30);
  assert.equal(root.left.key, 20);
  assert.equal(rotateAt(newRoot, 80, 'left'), null);
  assert.equal(rotateAt(newRoot, 15, 'right'), null);
  validate(newRoot, false);
  assert.deepEqual(inOrderNodes(newRoot).map(node => node.key), inOrderNodes(root).map(node => node.key));
});
