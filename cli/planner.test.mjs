import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyseSightLines, plannerImport, readGrayscalePng, readJson, validate } from './planner-lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const army = readJson(path.join(root, 'armies', 'necrons-2000.json'));
const variants = ['a', 'b', 'c'].map((layout) => readJson(path.join(root, 'plans', `take-take-layout-${layout}.json`)));

test('all three bundled layouts are exactly 2,000 points and overlap-free', () => {
  for (const plan of variants) {
    const result = validate(army, plan);
    assert.equal(result.points, 2000);
    assert.deepEqual(result.errors, [], `Layout ${plan.layout}: ${result.errors.join(', ')}`);
    assert.equal(result.circles.length, 31);
  }
});

test('terrain masks decode and every marked line gets a visibility result', () => {
  for (const plan of variants) {
    const page = String(plan.layoutPage).padStart(2, '0');
    const mask = readGrayscalePng(path.join(root, 'public', 'reference', '11th-edition', 'terrain-masks', `layout-${page}.png`));
    assert.equal(mask.width, 522);
    assert.equal(mask.height, 708);
    const lines = analyseSightLines(army, plan, mask);
    assert.equal(lines.length, 4);
    assert.ok(lines.every((line) => typeof line.clear === 'boolean'));
  }
});

test('planner import contains friendly army, mirror army, and sight-line marks', () => {
  const plan = variants[0];
  const mask = readGrayscalePng(path.join(root, 'public', 'reference', '11th-edition', 'terrain-masks', 'layout-09.png'));
  const lines = analyseSightLines(army, plan, mask);
  const output = plannerImport(army, plan, lines);
  assert.equal(output.layoutId, plan.layoutId);
  assert.equal(output.markers.filter((marker) => marker.side === 'blue').length, 31);
  assert.equal(output.markers.filter((marker) => marker.side === 'red').length, 31);
  assert.equal(output.sightLines.length, 4);
});
