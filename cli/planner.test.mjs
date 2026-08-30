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

test('all three legacy layout files match the 2,000-point Brighton list and are overlap-free', () => {
  for (const plan of variants) {
    const result = validate(army, plan);
    assert.equal(result.points, 2000);
    assert.deepEqual(result.errors, [], `Layout ${plan.layout}: ${result.errors.join(', ')}`);
    assert.equal(result.circles.length, plan.placements['void-dragon'].reserve ? 34 : 35);
  }
});

test('terrain masks decode and every marked line gets a visibility result', () => {
  for (const plan of variants) {
    const page = String(plan.layoutPage).padStart(2, '0');
    const mask = readGrayscalePng(path.join(root, 'public', 'reference', '11th-edition', 'terrain-masks', `layout-${page}.png`));
    assert.equal(mask.width, 522);
    assert.equal(mask.height, 708);
    const lines = analyseSightLines(army, plan, mask);
    assert.equal(lines.length, plan.sightLines.length);
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
  assert.equal(output.markers.filter((marker) => marker.side === 'blue').length, 34);
  assert.equal(output.markers.filter((marker) => marker.side === 'red').length, 0);
  assert.equal(output.deepStrikeMarkers.length, 1);
  assert.equal(output.deepStrikeMarkers[0].unitId, 'void-dragon');
  assert.equal(output.sightLines.length, 0);
});

test('deployment validation rejects a model outside the blue zone', () => {
  const invalid = structuredClone(variants[0]);
  invalid.placements['wraiths-centre'].centres[0] = [12.5, 44];
  const result = validate(army, invalid);
  assert.ok(result.errors.some((error) => error.includes('blue deployment zone')));
});

test('the first bundled suggestion is legal and overlap-free', () => {
  assert.equal(allPlans.length, 1);
  for (const plan of allPlans) assert.deepEqual(validate(army, plan).errors, [], plan.name);
});

test('layout A follows the requested terrain, infiltrator, and reserve doctrine', () => {
  const plan = variants[0];
  const mask = readGrayscalePng(path.join(root, 'public', 'reference', '11th-edition', 'terrain-masks', 'layout-09.png'));
  const unit = (id) => army.units.find((candidate) => candidate.id === id);
  const terrainFraction = (id, centre, margin = 0) => {
    const radius = unit(id).baseMm / 25.4 / 2 + margin;
    let covered = 0;
    let sampled = 0;
    for (let y = centre[1] - radius; y <= centre[1] + radius; y += .08) {
      for (let x = centre[0] - radius; x <= centre[0] + radius; x += .08) {
        if ((x - centre[0]) ** 2 + (y - centre[1]) ** 2 > radius ** 2) continue;
        const px = Math.max(0, Math.min(mask.width - 1, Math.floor(x / 44 * mask.width)));
        const py = Math.max(0, Math.min(mask.height - 1, Math.floor(y / 60 * mask.height)));
        sampled += 1;
        covered += Number(mask.pixels[py * mask.width + px] > 127);
      }
    }
    return covered / sampled;
  };
  const closestEdgeDistance = (leftId, rightId) => {
    const left = plan.placements[leftId].centres[0];
    const radii = (unit(leftId).baseMm + unit(rightId).baseMm) / 25.4 / 2;
    return Math.min(...plan.placements[rightId].centres.map((right) => Math.hypot(left[0] - right[0], left[1] - right[1]) - radii));
  };
  assert.equal(plan.placements['void-dragon'].reserve, true);
  assert.equal(plan.placements['flayed-ones'].infiltrate, true);
  assert.ok(plan.placements['wraiths-left'].centres.every((centre) => terrainFraction('wraiths-left', centre) > .03));
  assert.ok(plan.placements['wraiths-centre'].centres.every((centre) => terrainFraction('wraiths-centre', centre) > .03));
  assert.ok(plan.placements.skorpekhs.centres.filter((centre) => terrainFraction('skorpekhs', centre) > .03).length >= 5);
  assert.equal(terrainFraction('nightbringer', plan.placements.nightbringer.centres[0], .30), 0);
  assert.equal(terrainFraction('reanimator', plan.placements.reanimator.centres[0]), 0);
  assert.ok(plan.placements['flayed-ones'].centres.every((centre) => terrainFraction('flayed-ones', centre) === 0));
  assert.ok(closestEdgeDistance('technomancer-veil', 'wraiths-left') <= 2);
  assert.ok(closestEdgeDistance('technomancer', 'wraiths-centre') <= 2);
  assert.ok(closestEdgeDistance('skorpekh-lord', 'skorpekhs') <= 2);
  assert.ok(closestEdgeDistance('ammentar', 'skorpekhs') <= 3);
  assert.ok(closestEdgeDistance('nightbringer', 'skorpekhs') <= 1);
  assert.ok(closestEdgeDistance('nightbringer', 'ammentar') <= 1);
  assert.ok(plan.placements.nightbringer.centres[0][1] <= 50);
});
