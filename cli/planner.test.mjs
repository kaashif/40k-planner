import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyseSightLines, plannerImport, readGrayscalePng, readJson, validate } from './planner-lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const army = readJson(path.join(root, 'armies', 'necrons-2000.json'));
const variants = ['a', 'b', 'c'].map((layout) => readJson(path.join(root, 'plans', `take-take-layout-${layout}.json`)));
const planManifest = readJson(path.join(root, 'plans', 'take-take-mirror.json'));
const allPlans = planManifest.plans.map((file) => readJson(path.join(root, 'plans', file)));
const layoutIndex = readJson(path.join(root, 'public', 'reference', '11th-edition', 'data', 'event-layouts.json'));

test('all three bundled layouts match the 1,995-point list and are overlap-free', () => {
  for (const plan of variants) {
    const result = validate(army, plan);
    assert.equal(result.points, 1995);
    assert.deepEqual(result.errors, [], `Layout ${plan.layout}: ${result.errors.join(', ')}`);
    assert.equal(result.circles.length, 35);
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

test('all 45 current layout geometry masks are populated at board resolution', () => {
  assert.equal(layoutIndex.layouts.length, 45);
  assert.equal(new Set(layoutIndex.layouts.map(({ pdfPage }) => pdfPage)).size, 45);
  for (const { id, pdfPage } of layoutIndex.layouts) {
    const page = String(pdfPage).padStart(2, '0');
    const mask = readGrayscalePng(path.join(root, 'public', 'reference', '11th-edition', 'terrain-masks', `layout-${page}.png`));
    assert.equal(mask.width, 522, id);
    assert.equal(mask.height, 708, id);
    const blockingPixels = mask.pixels.reduce((count, pixel) => count + Number(pixel > 127), 0);
    assert.ok(blockingPixels > 10_000 && blockingPixels < 200_000, `${id}: implausible terrain area ${blockingPixels}`);
  }
});

test('planner import contains one friendly army and sight-line marks', () => {
  const plan = variants[0];
  const mask = readGrayscalePng(path.join(root, 'public', 'reference', '11th-edition', 'terrain-masks', 'layout-09.png'));
  const lines = analyseSightLines(army, plan, mask);
  const output = plannerImport(army, plan, lines);
  assert.equal(output.layoutId, plan.layoutId);
  assert.equal(output.markers.filter((marker) => marker.side === 'blue').length, 35);
  assert.equal(output.markers.filter((marker) => marker.side === 'red').length, 0);
  assert.equal(output.sightLines.length, 4);
});

test('deployment validation rejects a model outside the blue zone', () => {
  const invalid = structuredClone(variants[0]);
  invalid.placements['wraiths-centre'].centres[0] = [12.5, 44];
  const result = validate(army, invalid);
  assert.ok(result.errors.some((error) => error.includes('blue deployment zone')));
});

test('all eight bundled plans are legal and overlap-free', () => {
  assert.equal(allPlans.length, 8);
  for (const plan of allPlans) assert.deepEqual(validate(army, plan).errors, [], plan.name);
});
