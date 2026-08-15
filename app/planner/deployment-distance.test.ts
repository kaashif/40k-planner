import test from 'node:test';
import assert from 'node:assert/strict';
import { retainLargeConnectedComponents, squaredDistanceFromMask } from './deployment-distance.ts';

test('deployment distance is Euclidean and respects board-axis scales', () => {
  const mask = new Uint8Array(9);
  mask[4] = 1;
  const distance = squaredDistanceFromMask(mask, 3, 3, 6, 3);
  assert.deepEqual(Array.from(distance), [5, 1, 5, 4, 0, 4, 5, 1, 5]);
});

test('small colour islands are removed from deployment-zone masks', () => {
  const mask = new Uint8Array([
    1, 1, 0, 0,
    1, 1, 0, 1,
  ]);
  assert.deepEqual(Array.from(retainLargeConnectedComponents(mask, 4, 2, 3)), [1, 1, 0, 0, 1, 1, 0, 0]);
});
