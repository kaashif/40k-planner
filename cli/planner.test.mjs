import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyseSightLines, checkLineOfSight, plannerImport, readGrayscalePng, readJson, validate } from './planner-lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const army = readJson(path.join(root, 'armies', 'necrons-2000.json'));
const variants = ['a', 'b', 'c'].map((layout) => readJson(path.join(root, 'plans', `take-take-layout-${layout}.json`)));
const planManifest = readJson(path.join(root, 'plans', 'take-take-mirror.json'));
const allPlans = planManifest.plans.map((file) => readJson(path.join(root, 'plans', file)));
const layoutIndex = readJson(path.join(root, 'public', 'reference', '11th-edition', 'data', 'event-layouts.json'));
const brightonReviews = readJson(path.join(root, 'public', 'reference', '11th-edition', 'plans', 'brighton-reviews.json'));

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
  assert.ok(plan.placements['wraiths-left'].centres.every((centre) => terrainFraction('wraiths-left', centre, .15) === 0));
  assert.ok(plan.placements['wraiths-centre'].centres.every((centre) => terrainFraction('wraiths-centre', centre) > .03));
  assert.equal(terrainFraction('nightbringer', plan.placements.nightbringer.centres[0], .30), 0);
  assert.equal(terrainFraction('reanimator', plan.placements.reanimator.centres[0], .15), 0);
  assert.ok(plan.placements['flayed-ones'].centres.every((centre) => terrainFraction('flayed-ones', centre) === 0));
  assert.ok(closestEdgeDistance('technomancer-veil', 'wraiths-left') <= 2);
  assert.ok(closestEdgeDistance('technomancer', 'wraiths-centre') <= 2);
  assert.ok(closestEdgeDistance('skorpekh-lord', 'skorpekhs') <= 2);
  assert.ok(closestEdgeDistance('ammentar', 'skorpekhs') <= 3);
  assert.ok(closestEdgeDistance('nightbringer', 'skorpekhs') <= 1);
  assert.ok(closestEdgeDistance('nightbringer', 'ammentar') <= 2);
  assert.ok(plan.placements.nightbringer.centres[0][1] <= 50);
  assert.ok(plan.placements.reanimator.centres[0][1] <= 54);

  const opposingDeploymentZone = (x, y) => y <= 12 || (x >= 11 && x <= 22 && y <= 20);
  const firingPoints = [];
  for (let y = .25; y <= 20; y += .5) {
    for (let x = .25; x <= 43.75; x += .5) {
      if (opposingDeploymentZone(x, y)) firingPoints.push([x, y]);
    }
  }
  const modelIsHidden = (id, centre) => {
    const radius = unit(id).baseMm / 25.4 / 2;
    const targetPoints = [centre];
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
      targetPoints.push([centre[0] + Math.cos(angle) * radius * .92, centre[1] + Math.sin(angle) * radius * .92]);
    }
    return firingPoints.every((from) => targetPoints.every((to) => !checkLineOfSight(mask, from, to, radius * .04).clear));
  };
  for (const [id, placement] of Object.entries(plan.placements)) {
    if (placement.reserve) continue;
    assert.ok(placement.centres.every((centre) => modelIsHidden(id, centre)), `${id} has a clear sight line from the opposing deployment zone`);
  }
});

test('all Brighton opponent reviews have stable IDs and pass the hard deployment checks', () => {
  assert.equal(brightonReviews.opponentCount, 28);
  assert.equal(brightonReviews.reviewCount, 84);
  assert.equal(new Set(brightonReviews.reviews.map(({ id }) => id)).size, 84);
  assert.deepEqual(brightonReviews.reviews.map(({ id }) => id), Array.from({ length: 84 }, (_, index) => `D-${String(index + 1).padStart(3, '0')}`));
  for (const review of brightonReviews.reviews) {
    assert.equal(review.audit.legal, true, review.id);
    assert.equal(review.audit.nightbringerTerrainClear, true, review.id);
    assert.equal(review.audit.reanimatorTerrainClear, true, review.id);
    assert.equal(review.audit.nightbringerHidden, true, review.id);
    assert.equal(review.audit.reanimatorHidden, true, review.id);
    assert.equal(review.audit.missileCompact, true, review.id);
    assert.ok(review.reserves.includes('void-dragon'), review.id);
    if (review.abandonHome) assert.equal(review.flayedPolicy, 'two-forward-abandon-home', review.id);
  }
  const scoutMeleeNames = new Set(['Christian Faustino', 'Andrew Mcbride', 'Jonathan Aylett', 'William Samms', 'Adam Wright']);
  for (const review of brightonReviews.reviews.filter(({ opponent }) => scoutMeleeNames.has(opponent))) {
    assert.equal(review.flayedPolicy, 'two-forward-lane-blockers', review.id);
  }
  assert.deepEqual([...new Set(brightonReviews.reviews.filter(({ listAvailable }) => !listAvailable).map(({ opponent }) => opponent))], ['Brando McCready']);
});
