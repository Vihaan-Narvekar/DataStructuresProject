import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRallyExample, RALLY_PRICES, RALLY_SUBTREE_TRANSFER } from '../docs/js/rally.js';
import { layoutRotationTree, rotationProjection } from '../docs/js/rotation-scene.js';

test('the rotation scene uses spatial coordinates and follows the transferred branch', () => {
  const { rows, transfer } = buildRallyExample();
  assert.deepEqual(rows.map(({ key }) => key), RALLY_PRICES);
  assert.deepEqual([rows.at(-1).bstHeight, rows.at(-1).avlHeight], [7, 3]);
  assert.equal(transfer.key, RALLY_SUBTREE_TRANSFER);
  const before = layoutRotationTree(transfer.before);
  const after = layoutRotationTree(transfer.steps[0].tree);
  assert.equal(before.get(10200).parent, 10300);
  assert.equal(after.get(10200).parent, 10100);
  assert.equal(before.get(10200).center[0], after.get(10200).center[0]);
  assert.ok(before.get(10200).center[2] < before.get(10300).center[2]);
  assert.ok(after.get(10200).center[2] > after.get(10100).center[2]);
  assert.ok(after.get(10100).center[1] < after.get(10300).center[1]);
  assert.deepEqual([...before.keys()].sort(), [...after.keys()].sort());
});

test('orbit projection responds to yaw, pitch, zoom, and point depth', () => {
  const front = rotationProjection({ yaw: 0, pitch: 0, zoom: 1 });
  const rear = rotationProjection({ yaw: Math.PI, pitch: 0, zoom: 1 });
  const fullTurn = rotationProjection({ yaw: 2 * Math.PI, pitch: 0, zoom: 1 });
  const raised = rotationProjection({ yaw: 0, pitch: 0.5, zoom: 1 });
  const zoomed = rotationProjection({ yaw: 0, pitch: 0, zoom: 1.3 });
  const point = [60, 20, 110];
  assert.ok(front(point).x > 250 && rear(point).x < 250);
  assert.ok(Math.abs(front(point).x - fullTurn(point).x) < 1e-9);
  assert.ok(raised(point).y > front(point).y);
  assert.ok(zoomed(point).x > front(point).x);
  assert.ok(front(point).x > front([60, 20, -110]).x);
});
