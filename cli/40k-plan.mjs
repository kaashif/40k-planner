#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, validate, writeBuild } from './planner-lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const command = args.shift() || 'help';
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? path.resolve(args[index + 1]) : fallback;
};
const armyFile = option('--army', path.join(root, 'armies', 'necrons-2000.json'));
const planFile = option('--plan', path.join(root, 'plans', 'take-take-mirror.json'));

if (command === 'build') {
  const outDir = option('--out', path.join(root, 'plans', 'generated'));
  const appOut = option('--app-out', null);
  const result = writeBuild({ armyFile, planFile, outDir, appOut, root });
  console.log(`Valid ${result.points}-point plan. Wrote planner JSON, SVG, and briefing to ${outDir}`);
} else if (command === 'build-set') {
  const manifest = readJson(planFile);
  const outDir = option('--out', path.join(root, 'plans', 'generated'));
  const appOutDir = option('--app-out-dir', path.join(root, 'public', 'reference', '11th-edition', 'plans'));
  for (const relativePlan of manifest.plans) {
    const variantFile = path.resolve(path.dirname(planFile), relativePlan);
    const plan = readJson(variantFile);
    const appOut = path.join(appOutDir, `necrons-take-take-${plan.layout.toLowerCase()}.json`);
    const result = writeBuild({ armyFile, planFile: variantFile, outDir, appOut, root });
    console.log(`Layout ${plan.layout}: valid ${result.points}-point plan; ${result.sightLines.filter((line) => line.clear).length}/${result.sightLines.length} marked lines visible.`);
  }
} else if (command === 'validate') {
  const army = readJson(armyFile);
  const requestedPlan = readJson(planFile);
  const planFiles = requestedPlan.plans
    ? requestedPlan.plans.map((relativePlan) => path.resolve(path.dirname(planFile), relativePlan))
    : [planFile];
  for (const variantFile of planFiles) {
    const plan = readJson(variantFile);
    const result = validate(army, plan);
    result.warnings.forEach(warning => console.warn(`warning: ${warning}`));
    if (result.errors.length) {
      result.errors.forEach(error => console.error(`error [${plan.layout || plan.name}]: ${error}`));
      process.exitCode = 1;
    } else {
      console.log(`Layout ${plan.layout}: valid ${result.points}-point plan with ${result.circles.length} deployed models.`);
    }
  }
} else if (command === 'bases') {
  const army = readJson(armyFile);
  army.units.forEach(unit => console.log(`${unit.name.padEnd(42)} ${String(unit.baseMm).padStart(5)}mm × ${unit.models}`));
} else {
  console.log(`40k deployment planner CLI

Usage:
  npm run plan -- validate [--army FILE] [--plan FILE]
  npm run plan -- bases [--army FILE]
  npm run plan -- build [--army FILE] [--plan FILE] [--out DIR]
  npm run plan -- build-set [--army FILE] [--plan MANIFEST]

The bundled defaults are the 2,000-point Necron list and three-layout Take/Take plan set.`);
}
