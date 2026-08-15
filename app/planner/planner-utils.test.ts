import assert from 'node:assert/strict';
import test from 'node:test';
import { baseEdgeDistance, coherencyIssues, coherencyMeasurements, constrainMove, moveSelectedUnitsToDeepStrike, placeUnitLabels, type PlannerMarker } from './planner-utils.ts';

const marker = (id: number, xInches: number, unitId = 'unit'): PlannerMarker => ({
  id, x: xInches / 44, y: 10 / 60, widthMm: 25.4, heightMm: 25.4,
  label: 'Test unit', side: 'blue', unitId,
});

test('base distance is measured edge to edge, not wholly within', () => {
  assert.ok(Math.abs(baseEdgeDistance(marker(1, 10), marker(2, 13)) - 2) < 1e-9);
});

test('coherency requires a neighbour within 2 inches', () => {
  const issues = coherencyIssues([marker(1, 10), marker(2, 13.1)]);
  assert.match(issues.get(1)?.join(' ') ?? '', /within 2/);
  assert.match(issues.get(2)?.join(' ') ?? '', /within 2/);
});

test('coherency requires every pair to be within 9 inches', () => {
  const issues = coherencyIssues([marker(1, 10), marker(2, 12), marker(3, 21)]);
  assert.match(issues.get(1)?.join(' ') ?? '', /more than 9/);
  assert.match(issues.get(3)?.join(' ') ?? '', /more than 9/);
});

test('coherency measurements identify the failed limit and distance', () => {
  const measurements = coherencyMeasurements([marker(1, 10), marker(2, 22)]);
  assert.deepEqual(measurements.map(({ limit }) => limit).sort(), [2, 9]);
  assert.ok(measurements.every(({ distance }) => Math.abs(distance - 11) < 1e-9));
});

test('unit labels are consolidated and choose the side with least overlap', () => {
  const unit = [marker(1, 10), marker(2, 12)];
  const blocker = { ...marker(3, 11, 'blocker'), y: 8.5 / 60, widthMm: 80, heightMm: 80 };
  const labels = placeUnitLabels([...unit, blocker]);
  assert.equal(labels.length, 2);
  assert.deepEqual(labels.find(({ key }) => key.endsWith(':unit'))?.markerIds, [1, 2]);
  assert.notEqual(labels.find(({ key }) => key.endsWith(':unit'))?.side, 'top');
});

test('bounded movement caps a drag at the Movement characteristic', () => {
  const destination = constrainMove({ x: 10 / 44, y: 10 / 60 }, { x: 30 / 44, y: 10 / 60 }, 8);
  assert.ok(Math.abs(destination.x * 44 - 18) < 1e-9);
  assert.ok(Math.abs(destination.y * 60 - 10) < 1e-9);
});

test('deep strike moves the complete selected unit and preserves other units', () => {
  const markers = [marker(1, 10, 'wraiths'), marker(2, 12, 'wraiths'), marker(3, 16, 'ctan')];
  const result = moveSelectedUnitsToDeepStrike(markers, [], [1]);
  assert.deepEqual(result.markers.map(({ id }) => id), [3]);
  assert.deepEqual(result.deepStrikeMarkers.map(({ id }) => id), [1, 2]);
});
