import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BOARD,
  INCH_MM,
  checkLineOfSight,
  inBlueDeploymentZone,
  plannerImport,
  readGrayscalePng,
  readJson,
  validate,
  whollyInBlueDeploymentZone,
} from '../cli/planner-lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const brightonDataFile = process.env.BRIGHTON_DATA
  || path.resolve(root, '../../brighton-40k-teams-ii-lists/data/raw-lists.json');
const army = readJson(path.join(root, 'armies/necrons-2000.json'));
const eventLayouts = readJson(path.join(root, 'public/reference/11th-edition/data/event-layouts.json')).layouts
  .filter(({ id }) => id.startsWith('take-and-hold-vs-'));
const rawLists = readJson(brightonDataFile);
const unitById = new Map(army.units.map((unit) => [unit.id, unit]));
const firingPointCache = new Map();
const hiddenModelCache = new Map();
const deploymentCache = new Map();

const sourceByPage = {
  9: 'take-take-layout-a', 10: 'take-take-layout-b', 11: 'take-take-layout-c',
  12: 'take-purge-layout-a', 13: 'take-purge-layout-b', 14: 'take-purge-layout-c',
  15: 'take-purge-layout-a', 16: 'take-purge-layout-b', 17: 'take-purge-layout-c',
  18: 'take-recon-layout-a', 19: 'take-recon-layout-b', 20: 'take-take-layout-c',
  21: 'take-purge-layout-b', 22: 'take-purge-layout-c', 23: 'take-take-layout-b',
};

const dispositionSlug = (faction) => faction.split(' - ').at(-1).toLowerCase().replaceAll(' ', '-');
const slug = (value) => value.toLowerCase().replaceAll('’', '').replaceAll("'", '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const clone = (value) => structuredClone(value);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function circleClear(mask, centre, radius, margin = 0) {
  const sampleRadius = radius + margin;
  for (let radial = 0; radial <= sampleRadius; radial += .16) {
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 12) {
      const x = centre[0] + Math.cos(angle) * radial;
      const y = centre[1] + Math.sin(angle) * radial;
      const px = Math.max(0, Math.min(mask.width - 1, Math.floor(x / BOARD.width * mask.width)));
      const py = Math.max(0, Math.min(mask.height - 1, Math.floor(y / BOARD.height * mask.height)));
      if (mask.pixels[py * mask.width + px] > 127) return false;
    }
  }
  return true;
}

function legalCentre(plan, unit, centre, placed, infiltrate = false) {
  const radius = unit.baseMm / INCH_MM / 2;
  const [x, y] = centre;
  if (x - radius < 0 || x + radius > BOARD.width || y - radius < 0 || y + radius > BOARD.height) return false;
  if (!infiltrate && !whollyInBlueDeploymentZone(plan, x, y, radius)) return false;
  return placed.every((other) => distance(centre, other.centre) + .02 >= radius + other.radius);
}

function repairPlan(plan) {
  const placed = [];
  for (const unit of army.units) {
    const placement = plan.placements[unit.id];
    if (placement.reserve) continue;
    placement.centres = placement.centres.map((original) => {
      if (legalCentre(plan, unit, original, placed, placement.infiltrate)) {
        placed.push({ centre: original, radius: unit.baseMm / INCH_MM / 2 });
        return original;
      }
      const candidates = [];
      for (let y = .75; y < BOARD.height; y += .25) {
        for (let x = .75; x < BOARD.width; x += .25) {
          const candidate = [x, y];
          if (legalCentre(plan, unit, candidate, placed, placement.infiltrate)) candidates.push(candidate);
        }
      }
      candidates.sort((left, right) => distance(left, original) - distance(right, original));
      if (!candidates.length) throw new Error(`Could not repair ${unit.id} on ${plan.layoutId}`);
      const selected = candidates[0];
      placed.push({ centre: selected, radius: unit.baseMm / INCH_MM / 2 });
      return selected.map((value) => Number(value.toFixed(2)));
    });
  }
  return plan;
}

function modelHidden(mask, plan, unit, centre) {
  const cacheKey = `${plan.layoutPage}:${unit.baseMm}:${centre[0].toFixed(2)}:${centre[1].toFixed(2)}`;
  if (hiddenModelCache.has(cacheKey)) return hiddenModelCache.get(cacheKey);
  const radius = unit.baseMm / INCH_MM / 2;
  const targets = [centre];
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
    targets.push([centre[0] + Math.cos(angle) * radius * .9, centre[1] + Math.sin(angle) * radius * .9]);
  }
  const hidden = firingPoints(plan).every((from) => targets.every((to) => !checkLineOfSight(mask, from, to, radius * .05).clear));
  hiddenModelCache.set(cacheKey, hidden);
  return hidden;
}

function safeReposition(plan, mask, unitId, margin, targetIds, ignoredIds = [], accept = null) {
  const unit = unitById.get(unitId);
  const placement = plan.placements[unitId];
  const original = placement.centres[0];
  const occupied = [];
  for (const other of army.units) {
    if (other.id === unitId || ignoredIds.includes(other.id) || plan.placements[other.id].reserve) continue;
    for (const centre of plan.placements[other.id].centres) occupied.push({ centre, radius: other.baseMm / INCH_MM / 2 });
  }
  const targets = targetIds.flatMap((id) => plan.placements[id].reserve ? [] : plan.placements[id].centres);
  const candidates = [];
  for (let y = 1; y < BOARD.height - 1; y += .5) {
    for (let x = 1; x < BOARD.width - 1; x += .5) {
      const centre = [x, y];
      if (!legalCentre(plan, unit, centre, occupied, false)) continue;
      if (!circleClear(mask, centre, unit.baseMm / INCH_MM / 2, margin)) continue;
      const groupDistance = targets.length ? Math.min(...targets.map((target) => distance(centre, target))) : 0;
      candidates.push({ centre, score: distance(centre, [BOARD.width / 2, BOARD.height / 2]) * 2 + groupDistance * 3 + distance(centre, original) * .2 });
    }
  }
  candidates.sort((left, right) => left.score - right.score);
  for (const selected of candidates) {
    if (!modelHidden(mask, plan, unit, selected.centre)) continue;
    placement.centres = [selected.centre.map((value) => Number(value.toFixed(2)))];
    if (!accept || accept()) return;
  }
  throw new Error(`No hidden, terrain-clear position for ${unitId} on ${plan.layoutId}`);
}

function packSkorpekhs(plan, mask) {
  const unit = unitById.get('skorpekhs');
  const nightbringer = plan.placements.nightbringer.centres[0];
  const ignored = new Set(['skorpekhs', 'skorpekh-lord', 'ammentar']);
  const occupied = [];
  for (const other of army.units) {
    if (ignored.has(other.id) || plan.placements[other.id].reserve) continue;
    for (const centre of plan.placements[other.id].centres) occupied.push({ centre, radius: other.baseMm / INCH_MM / 2 });
  }
  const patterns = [
    [-2.1, 0, 2.1].flatMap((dx) => [-1.05, 1.05].map((dy) => [dx, dy])),
    [-2.1, 0, 2.1].flatMap((dy) => [-1.05, 1.05].map((dx) => [dx, dy])),
  ];
  const candidates = [];
  for (let y = 2; y < BOARD.height - 2; y += .5) {
    for (let x = 2; x < BOARD.width - 2; x += .5) {
      if (distance([x, y], nightbringer) > 8) continue;
      for (const pattern of patterns) {
        const centres = pattern.map(([dx, dy]) => [x + dx, y + dy]);
        const groupPlaced = [...occupied];
        let legal = true;
        for (const centre of centres) {
          if (!legalCentre(plan, unit, centre, groupPlaced, false) || !modelHidden(mask, plan, unit, centre)) { legal = false; break; }
          groupPlaced.push({ centre, radius: unit.baseMm / INCH_MM / 2 });
        }
        if (!legal) continue;
        const edgeGap = Math.min(...centres.map((centre) => distance(centre, nightbringer)))
          - (unit.baseMm + unitById.get('nightbringer').baseMm) / INCH_MM / 2;
        if (edgeGap > 2) continue;
        candidates.push({ centres, score: Math.abs(edgeGap - .35) * 8 + distance([x, y], [BOARD.width / 2, BOARD.height / 2]) });
      }
    }
  }
  candidates.sort((left, right) => left.score - right.score);
  if (!candidates.length) return false;
  plan.placements.skorpekhs.centres = candidates[0].centres.map((centre) => centre.map((value) => Number(value.toFixed(2))));
  return true;
}

function packMissileLeader(plan, mask, unitId, remainingIgnoredIds) {
  const unit = unitById.get(unitId);
  const occupied = [];
  for (const other of army.units) {
    if (other.id === unitId || remainingIgnoredIds.includes(other.id) || plan.placements[other.id].reserve) continue;
    for (const centre of plan.placements[other.id].centres) occupied.push({ centre, radius: other.baseMm / INCH_MM / 2 });
  }
  const skorpekhs = plan.placements.skorpekhs.centres;
  const candidates = [];
  for (let y = 1; y < BOARD.height - 1; y += .5) {
    for (let x = 1; x < BOARD.width - 1; x += .5) {
      const centre = [x, y];
      if (!legalCentre(plan, unit, centre, occupied, false) || !modelHidden(mask, plan, unit, centre)) continue;
      const edgeGap = Math.min(...skorpekhs.map((target) => distance(centre, target)))
        - (unit.baseMm + unitById.get('skorpekhs').baseMm) / INCH_MM / 2;
      const limit = unitId === 'ammentar' ? 3 : 2;
      if (edgeGap > limit) continue;
      candidates.push({ centre, score: Math.abs(edgeGap - .5) * 5 + distance(centre, plan.placements.nightbringer.centres[0]) });
    }
  }
  candidates.sort((left, right) => left.score - right.score);
  if (!candidates.length) return false;
  plan.placements[unitId].centres = [candidates[0].centre.map((value) => Number(value.toFixed(2)))];
  return true;
}

function opponentProfile(list) {
  const text = list.content || '';
  const faction = list.faction.split(' - ')[0];
  const available = text.length > 120 && text.trim().toLowerCase() !== 'suck your mum';
  const explicitScout = /\bscouts?\b|strike swiftly|lord invocatus|zodgrod wortsnagga/i.test(text);
  const fastMelee = /World Eaters|Blood Angels|Emperor's Children|Orks/i.test(faction)
    || /Genestealers|Von Ryan|Hormagaunts|Ravenwing Command Squad|Outrider Squad/i.test(text);
  const scoutFastMelee = new Set([
    'Christian Faustino', 'Andrew Mcbride', 'Jonathan Aylett', 'William Samms', 'Adam Wright',
  ]).has(list.pagePlayer);
  const shootingHeavy = /T'au|Leagues of Votann|Thousand Sons|Adeptus Mechanicus|Chaos Knights/i.test(faction)
    || /Land Raider Redeemer|Vindicator|Forgefiend|Tyrannofex|Land Speeder Vengeance/i.test(text);
  const deepStrikePressure = /Allarus|Venatari|Terminators|Jump Pack|Ophydian|Crisis|Callidus/i.test(text);
  const vehiclePressure = (text.match(/Land Raider|Vindicator|Riptide|Hekaton|War Dog|Forgefiend|Tyrannofex|Stormsurge|Skorpius|Vehicle/gi) || []).length;
  const signals = [];
  if (!available) signals.push('Published list text unavailable');
  if (explicitScout) signals.push('Scout or pre-game move present');
  if (fastMelee) signals.push('Fast melee pressure');
  if (shootingHeavy) signals.push('Long-range/high-volume shooting');
  if (deepStrikePressure) signals.push('Deep-strike or reserve pressure');
  if (vehiclePressure >= 2) signals.push(`${vehiclePressure} major vehicle/monster mentions`);
  return { available, explicitScout, fastMelee, scoutFastMelee, shootingHeavy, deepStrikePressure, vehiclePressure, signals };
}

function forwardFlayedCentres(plan, mask, lane, occupied) {
  const unit = unitById.get('flayed-ones');
  const radius = unit.baseMm / INCH_MM / 2;
  const offsets = [[-1.3, -.65], [0, -.65], [1.3, -.65], [-.65, .65], [.65, .65]];
  const redPoints = [];
  for (let y = .5; y < BOARD.height; y += .5) {
    for (let x = .5; x < BOARD.width; x += .5) {
      if (inBlueDeploymentZone(plan, BOARD.width - x, BOARD.height - y)) redPoints.push([x, y]);
    }
  }
  const vertical = [10, 12, 15, 19, 23].includes(plan.layoutPage);
  const laneTarget = lane === 0 ? (vertical ? 19 : 14) : (vertical ? 41 : 30);
  const candidates = [];
  for (let y = 2; y < BOARD.height - 2; y += .5) {
    for (let x = 2; x < BOARD.width - 2; x += .5) {
      const centres = offsets.map(([dx, dy]) => [x + dx, y + dy]);
      if (!centres.every((centre) => circleClear(mask, centre, radius, .08))) continue;
      if (!centres.every((centre) => occupied.every((other) => distance(centre, other.centre) >= radius + other.radius + .02))) continue;
      const redDistance = Math.min(...centres.flatMap((centre) => redPoints.map((point) => distance(centre, point))));
      if (redDistance < 8.8) continue;
      const laneCoordinate = vertical ? y : x;
      candidates.push({ centres, score: Math.abs(redDistance - 9.2) * 8 + Math.abs(laneCoordinate - laneTarget) });
    }
  }
  candidates.sort((left, right) => left.score - right.score);
  return candidates[0]?.centres.map((centre) => centre.map((value) => Number(value.toFixed(2)))) || null;
}

function applyPairing(plan, profile, abandonHome, mask) {
  plan.placements['void-dragon'] = { ...plan.placements['void-dragon'], reserve: true, note: 'Deep strike by default.' };
  const moveBothForward = abandonHome || profile.scoutFastMelee;
  const occupied = [];
  for (const unit of army.units) {
    if (unit.id.startsWith('flayed-ones') || plan.placements[unit.id].reserve) continue;
    for (const centre of plan.placements[unit.id].centres) occupied.push({ centre, radius: unit.baseMm / INCH_MM / 2 });
  }
  if (profile.scoutFastMelee) {
    const first = forwardFlayedCentres(plan, mask, 0, occupied);
    if (first) {
      plan.placements['flayed-ones'] = { centres: first, infiltrate: true, note: 'Forward lane-blocker against Scout and fast melee.' };
      first.forEach((centre) => occupied.push({ centre, radius: unitById.get('flayed-ones').baseMm / INCH_MM / 2 }));
    }
  }
  if (moveBothForward) {
    const second = forwardFlayedCentres(plan, mask, 1, occupied);
    if (second) plan.placements['flayed-ones-2'] = { centres: second, infiltrate: true, note: abandonHome ? 'Second forward unit: Abandon Home.' : 'Second Scout/fast-melee lane-blocker.' };
  }
  repairPlan(plan);
  safeReposition(plan, mask, 'nightbringer', .3, [], ['skorpekhs', 'skorpekh-lord', 'ammentar'], () => (
    packSkorpekhs(plan, mask)
    && packMissileLeader(plan, mask, 'skorpekh-lord', ['ammentar'])
    && packMissileLeader(plan, mask, 'ammentar', [])
  ));
  safeReposition(plan, mask, 'reanimator', .15, ['wraiths-left', 'wraiths-centre']);
  return plan;
}

function firingPoints(plan) {
  if (firingPointCache.has(plan.layoutPage)) return firingPointCache.get(plan.layoutPage);
  const points = [];
  for (let y = .5; y < BOARD.height; y += 2) {
    for (let x = .5; x < BOARD.width; x += 2) {
      if (inBlueDeploymentZone(plan, BOARD.width - x, BOARD.height - y)) points.push([x, y]);
    }
  }
  firingPointCache.set(plan.layoutPage, points);
  return points;
}

function exposedModels(plan, mask) {
  const exposed = [];
  for (const unit of army.units) {
    const placement = plan.placements[unit.id];
    if (placement.reserve) continue;
    placement.centres.forEach((centre, index) => {
      if (!modelHidden(mask, plan, unit, centre)) exposed.push(`${unit.label}${unit.models > 1 ? index + 1 : ''}`);
    });
  }
  return exposed;
}

function audit(plan, mask) {
  const result = validate(army, plan);
  const exposed = exposedModels(plan, mask);
  const nightbringerClear = circleClear(mask, plan.placements.nightbringer.centres[0], unitById.get('nightbringer').baseMm / INCH_MM / 2, .3);
  const reanimatorClear = circleClear(mask, plan.placements.reanimator.centres[0], unitById.get('reanimator').baseMm / INCH_MM / 2, .15);
  const edgeDistance = (leftId, rightId) => {
    const left = plan.placements[leftId].centres[0];
    const radii = (unitById.get(leftId).baseMm + unitById.get(rightId).baseMm) / INCH_MM / 2;
    return Math.min(...plan.placements[rightId].centres.map((right) => distance(left, right) - radii));
  };
  const missileCompact = edgeDistance('nightbringer', 'skorpekhs') <= 2
    && edgeDistance('skorpekh-lord', 'skorpekhs') <= 2
    && edgeDistance('ammentar', 'skorpekhs') <= 3;
  return {
    legal: result.errors.length === 0,
    errors: result.errors,
    nightbringerTerrainClear: nightbringerClear,
    reanimatorTerrainClear: reanimatorClear,
    nightbringerHidden: !exposed.includes('NB'),
    reanimatorHidden: !exposed.includes('R'),
    missileCompact,
    exposedModelCount: exposed.length,
    exposedModels: exposed,
  };
}

const layoutsByDisposition = new Map();
for (const layout of eventLayouts) {
  const disposition = slug(layout.defender.forceDisposition);
  if (!layoutsByDisposition.has(disposition)) layoutsByDisposition.set(disposition, []);
  layoutsByDisposition.get(disposition).push(layout);
}

const opponents = rawLists.lists
  .filter(({ pagePlayer }) => pagePlayer !== 'Kaashif Hymabaccus')
  .sort((left, right) => left.team.localeCompare(right.team) || left.pagePlayer.localeCompare(right.pagePlayer));
const reviews = [];
let sequence = 1;
for (const opponent of opponents) {
  const profile = opponentProfile(opponent);
  const disposition = dispositionSlug(opponent.faction);
  const layouts = layoutsByDisposition.get(disposition);
  if (!layouts) throw new Error(`No layouts for ${opponent.faction}`);
  for (const layout of layouts.sort((left, right) => left.layout.localeCompare(right.layout))) {
    const base = readJson(path.join(root, 'plans', `${sourceByPage[layout.pdfPage]}.json`));
    const plan = clone(base);
    plan.name = `${opponent.pagePlayer} — Layout ${layout.layout}`;
    plan.slug = `brighton-${slug(opponent.pagePlayer)}-${layout.layout.toLowerCase()}`;
    plan.layoutId = layout.id;
    plan.layout = layout.layout;
    plan.layoutPage = layout.pdfPage;
    const abandonHome = disposition === 'purge-the-foe';
    const flayedPolicy = profile.scoutFastMelee ? 'two-forward-lane-blockers' : abandonHome ? 'two-forward-abandon-home' : 'one-forward-one-rear';
    const mask = readGrayscalePng(path.join(root, 'public/reference/11th-edition/terrain-masks', `layout-${String(layout.pdfPage).padStart(2, '0')}.png`));
    const deploymentKey = `${layout.pdfPage}:${flayedPolicy}`;
    let checks;
    if (deploymentCache.has(deploymentKey)) {
      const cached = deploymentCache.get(deploymentKey);
      plan.placements = clone(cached.placements);
      checks = clone(cached.audit);
    } else {
      applyPairing(plan, profile, abandonHome, mask);
      checks = audit(plan, mask);
      deploymentCache.set(deploymentKey, { placements: clone(plan.placements), audit: clone(checks) });
    }
    if (!checks.legal) throw new Error(`${plan.name}: ${checks.errors.join('; ')}`);
    const id = `D-${String(sequence).padStart(3, '0')}`;
    const primary = layout.attacker.primaryMission;
    const rationale = [
      abandonHome ? 'Abandon Home: both Flayed One units are committed forward.' : 'Retain a rear screen unless the matchup override moves it forward.',
      profile.scoutFastMelee ? 'Scout + fast melee override: two separated forward move-blocking lanes.' : profile.fastMelee ? 'Fast melee: preserve a sacrificial screen without giving a consolidation bridge.' : 'No fast-melee Scout override detected.',
      profile.shootingHeavy ? 'Shooting threat: prioritize complete terrain screening over a shorter first move.' : 'Normal sight-line discipline.',
      profile.deepStrikePressure && !abandonHome ? 'Reserve pressure: keep the second Flayed unit available to screen the rear.' : 'No additional rear-screen override.',
    ];
    const importData = plannerImport(army, plan, []);
    reviews.push({
      id,
      opponent: opponent.pagePlayer,
      team: opponent.team,
      faction: opponent.faction.split(' - ')[0],
      opponentDisposition: layout.defender.forceDisposition,
      objective: primary,
      abandonHome,
      flayedPolicy,
      layout: layout.layout,
      layoutId: layout.id,
      layoutPage: layout.pdfPage,
      listId: opponent.listId,
      listAvailable: profile.available,
      threatSignals: profile.signals,
      rationale,
      audit: checks,
      markers: importData.markers,
      reserves: importData.reserves,
    });
    sequence += 1;
  }
}

const output = {
  schemaVersion: 1,
  event: rawLists.event,
  generatedAt: new Date().toISOString(),
  doctrine: 'docs/kaashif-deployment-principles.md',
  reviewCount: reviews.length,
  opponentCount: opponents.length,
  usableListCount: opponents.filter((opponent) => opponentProfile(opponent).available).length,
  reviews,
};
const outputFile = path.join(root, 'public/reference/11th-edition/plans/brighton-reviews.json');
fs.writeFileSync(outputFile, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Wrote ${reviews.length} numbered deployments to ${path.relative(root, outputFile)}.`);
