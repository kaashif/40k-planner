import assert from 'node:assert/strict';
import test from 'node:test';
import { baseEdgeDistance, coherencyIssues, placeUnitLabels, type PlannerMarker } from './planner-utils.ts';

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

test('unit labels are consolidated and choose the side with least overlap', () => {
  const unit = [marker(1, 10), marker(2, 12)];
  const blocker = { ...marker(3, 11, 'blocker'), y: 8.5 / 60, widthMm: 80, heightMm: 80 };
  const labels = placeUnitLabels([...unit, blocker]);
  assert.equal(labels.length, 2);
  assert.notEqual(labels.find(({ key }) => key.endsWith(':unit'))?.side, 'top');
});
