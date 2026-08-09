import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

export const INCH_MM = 25.4;
export const BOARD = { width: 44, height: 60 };

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function validate(army, plan) {
  const errors = [];
  const warnings = [];
  const points = army.units.reduce((sum, unit) => sum + unit.points, 0);
  if (points !== army.pointsLimit) errors.push(`Army is ${points} points, expected ${army.pointsLimit}.`);
  const circles = [];

  for (const unit of army.units) {
    const placement = plan.placements[unit.id];
    if (!placement) {
      errors.push(`Missing placement for ${unit.id}.`);
      continue;
    }
    if (!unit.baseMm || unit.baseMm <= 0) errors.push(`Missing base size for ${unit.id}.`);
    if (placement.reserve) continue;
    if (!Array.isArray(placement.centres) || placement.centres.length !== unit.models) {
      errors.push(`${unit.id} needs ${unit.models} model centre(s).`);
      continue;
    }
    const radius = unit.baseMm / INCH_MM / 2;
    placement.centres.forEach(([x, y], index) => {
      if (x - radius < 0 || x + radius > BOARD.width || y - radius < 0 || y + radius > BOARD.height) {
        errors.push(`${unit.id} model ${index + 1} is not wholly on the 44×60in battlefield.`);
      }
      circles.push({ unit: unit.id, index, x, y, radius });
    });
  }

  for (let i = 0; i < circles.length; i += 1) {
    for (let j = i + 1; j < circles.length; j += 1) {
      const a = circles[i];
      const b = circles[j];
      if (Math.hypot(a.x - b.x, a.y - b.y) + 0.02 < a.radius + b.radius) {
        errors.push(`${a.unit} model ${a.index + 1} overlaps ${b.unit} model ${b.index + 1}.`);
      }
    }
  }
  for (const id of Object.keys(plan.placements)) {
    if (!army.units.some((unit) => unit.id === id)) warnings.push(`Plan contains unknown unit ${id}.`);
  }
  return { errors, warnings, points, circles };
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

export function readGrayscalePng(file) {
  const png = fs.readFileSync(file);
  if (!png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error(`Not a PNG: ${file}`);
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colourType = 0;
  const idat = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colourType = data[9];
    } else if (type === 'IDAT') idat.push(data);
    offset += length + 12;
    if (type === 'IEND') break;
  }
  if (bitDepth !== 8 || colourType !== 0) throw new Error(`Expected 8-bit grayscale terrain mask: ${file}`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const pixels = Buffer.alloc(width * height);
  const stride = width;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < width; x += 1) {
      const source = raw[y * (stride + 1) + 1 + x];
      const left = x > 0 ? pixels[y * stride + x - 1] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upperLeft = x > 0 && y > 0 ? pixels[(y - 1) * stride + x - 1] : 0;
      const value = filter === 0 ? source
        : filter === 1 ? source + left
        : filter === 2 ? source + up
        : filter === 3 ? source + Math.floor((left + up) / 2)
        : filter === 4 ? source + paeth(left, up, upperLeft)
        : NaN;
      if (!Number.isFinite(value)) throw new Error(`Unsupported PNG filter ${filter}.`);
      pixels[y * stride + x] = value & 255;
    }
  }
  return { width, height, pixels };
}

function isBlocked(mask, xInches, yInches) {
  const x = Math.max(0, Math.min(mask.width - 1, Math.floor(xInches / BOARD.width * mask.width)));
  const y = Math.max(0, Math.min(mask.height - 1, Math.floor(yInches / BOARD.height * mask.height)));
  return mask.pixels[y * mask.width + x] > 127;
}

export function checkLineOfSight(mask, from, to, targetRadius = 0) {
  const distance = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const steps = Math.max(1, Math.ceil(distance / 0.04));
  const startsBlocked = isBlocked(mask, from[0], from[1]);
  let leftStartingTerrain = !startsBlocked;
  for (let index = 1; index < steps; index += 1) {
    const travelled = distance * index / steps;
    if (distance - travelled <= targetRadius) break;
    const point = [from[0] + (to[0] - from[0]) * index / steps, from[1] + (to[1] - from[1]) * index / steps];
    const blocked = isBlocked(mask, point[0], point[1]);
    if (!leftStartingTerrain) {
      if (!blocked) leftStartingTerrain = true;
    } else if (blocked) {
      return { clear: false, blockedAt: point };
    }
  }
  return { clear: true, blockedAt: null };
}

export function analyseSightLines(army, plan, mask) {
  const units = new Map(army.units.map((unit) => [unit.id, unit]));
  return (plan.sightLines || []).map((line) => {
    const unit = units.get(line.targetUnit);
    const placement = plan.placements[line.targetUnit];
    const target = placement.centres[line.targetModel || 0];
    const radius = unit.baseMm / INCH_MM / 2;
    const targetPoints = [
      target,
      [target[0] - radius * .82, target[1]], [target[0] + radius * .82, target[1]],
      [target[0], target[1] - radius * .82], [target[0], target[1] + radius * .82],
    ];
    const results = targetPoints.map((point) => ({ point, result: checkLineOfSight(mask, line.from, point, radius * .1) }));
    const visible = results.find(({ result }) => result.clear);
    const centreResult = results[0].result;
    return {
      ...line,
      to: visible?.point || target,
      clear: Boolean(visible),
      blockedAt: visible ? null : centreResult.blockedAt,
      raysChecked: targetPoints.length,
    };
  });
}

export function plannerImport(army, plan, sightLines) {
  let nextId = 1;
  const markers = [];
  for (const unit of army.units) {
    const placement = plan.placements[unit.id];
    if (placement.reserve) continue;
    placement.centres.forEach(([x, y], modelIndex) => markers.push({
      id: nextId++, x, y, widthMm: unit.baseMm, heightMm: unit.baseMm,
      label: `${unit.label}${unit.models > 1 ? modelIndex + 1 : ''}`, side: 'blue', unitId: unit.id,
    }));
  }
  if (plan.mirrorOpponentInRender) {
    for (const marker of [...markers]) markers.push({ ...marker, id: nextId++, x: BOARD.width - marker.x, y: BOARD.height - marker.y, side: 'red', label: `M-${marker.label}` });
  }
  return {
    schemaVersion: 1, edition: 11, name: plan.name, layoutId: plan.layoutId,
    battlefieldInches: BOARD, markers, sightLines,
    reserves: army.units.filter((unit) => plan.placements[unit.id]?.reserve).map((unit) => unit.id),
  };
}

function esc(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function colour(role) {
  if (role.includes('holder')) return '#39d98a';
  if (role.includes('support')) return '#ffd166';
  if (role.includes('counter')) return '#a78bfa';
  if (role === 'screen') return '#67e8f9';
  return '#f97316';
}

export function renderSvg(army, plan, mapDataUri, sightLines) {
  const scale = 18;
  const boardWidth = BOARD.width * scale;
  const boardHeight = BOARD.height * scale;
  const totalWidth = 1220;
  const unitById = new Map(army.units.map((unit) => [unit.id, unit]));
  const modelSvg = (unit, x, y, opponent = false) => {
    const radius = unit.baseMm / INCH_MM / 2 * scale;
    const cx = x * scale;
    const cy = y * scale;
    const fontSize = Math.max(9, Math.min(15, radius * 0.72));
    return `<g opacity="${opponent ? 0.55 : 0.92}"><circle cx="${cx}" cy="${cy}" r="${radius}" fill="${opponent ? '#7f1d1d' : colour(unit.role)}" stroke="${opponent ? '#fecaca' : '#101018'}" stroke-width="2.5" ${opponent ? 'stroke-dasharray="7 5"' : ''}/><text x="${cx}" y="${cy + fontSize * .35}" text-anchor="middle" fill="${opponent ? '#fee2e2' : '#101018'}" font-family="sans-serif" font-size="${fontSize}" font-weight="bold">${esc(unit.label)}</text></g>`;
  };
  const models = [];
  for (const [id, placement] of Object.entries(plan.placements)) {
    if (placement.reserve) continue;
    const unit = unitById.get(id);
    placement.centres.forEach(([x, y]) => {
      models.push(modelSvg(unit, x, y));
      if (plan.mirrorOpponentInRender) models.push(modelSvg(unit, BOARD.width - x, BOARD.height - y, true));
    });
  }
  const lines = sightLines.map((line, index) => {
    const colourValue = line.clear ? '#ef4444' : '#22c55e';
    const block = line.blockedAt ? `<g stroke="#22c55e" stroke-width="3"><line x1="${line.blockedAt[0] * scale - 7}" y1="${line.blockedAt[1] * scale - 7}" x2="${line.blockedAt[0] * scale + 7}" y2="${line.blockedAt[1] * scale + 7}"/><line x1="${line.blockedAt[0] * scale + 7}" y1="${line.blockedAt[1] * scale - 7}" x2="${line.blockedAt[0] * scale - 7}" y2="${line.blockedAt[1] * scale + 7}"/></g>` : '';
    return `<g><line x1="${line.from[0] * scale}" y1="${line.from[1] * scale}" x2="${line.to[0] * scale}" y2="${line.to[1] * scale}" stroke="${colourValue}" stroke-width="3" ${line.clear ? '' : 'stroke-dasharray="9 6"'}/>${block}<circle cx="${line.from[0] * scale}" cy="${line.from[1] * scale}" r="7" fill="${colourValue}"/><text x="${812}" y="${180 + index * 52}" fill="${colourValue}" font-family="sans-serif" font-size="15" font-weight="bold">${esc(line.clear ? 'VISIBLE' : 'BLOCKED')}</text><text x="${812}" y="${200 + index * 52}" fill="#e5e7eb" font-family="sans-serif" font-size="14">${esc(line.label)}</text></g>`;
  }).join('\n');
  const legend = army.units.map((unit, i) => `<g transform="translate(812,${455 + i * 31})"><circle r="7" fill="${colour(unit.role)}"/><text x="13" y="5" fill="#e5e7eb" font-family="sans-serif" font-size="13">${esc(unit.label)} = ${esc(unit.name)} (${unit.baseMm}mm)</text></g>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${boardHeight}" viewBox="0 0 ${totalWidth} ${boardHeight}"><rect width="${totalWidth}" height="${boardHeight}" fill="#0a0a14"/><image href="${mapDataUri}" width="${boardWidth}" height="${boardHeight}" preserveAspectRatio="none"/>${models.join('\n')}${lines}<text x="812" y="42" fill="#C5A33E" font-family="sans-serif" font-size="23" font-weight="bold">${esc(plan.name)}</text><text x="812" y="77" fill="#d1d5db" font-family="sans-serif" font-size="15">Red solid = clear sight line</text><text x="812" y="101" fill="#d1d5db" font-family="sans-serif" font-size="15">Green dashed + X = terrain blocked</text><text x="812" y="145" fill="#C5A33E" font-family="sans-serif" font-size="18" font-weight="bold">Sight-line checks</text><text x="812" y="425" fill="#C5A33E" font-family="sans-serif" font-size="18" font-weight="bold">Bases</text>${legend}</svg>`;
}

export function reportMarkdown(army, plan, sightLines) {
  const lines = [`# ${plan.name}`, '', `Army: ${army.name} (${army.pointsLimit} points)`, '', plan.intent, '', '## Sight-line checks', ''];
  sightLines.forEach((line) => lines.push(`- **${line.clear ? 'VISIBLE' : 'BLOCKED'}** — ${line.label}${line.blockedAt ? ` (terrain at ${line.blockedAt[0].toFixed(1)}\", ${line.blockedAt[1].toFixed(1)}\")` : ''}`));
  lines.push('', 'The checker samples the target centre and four points around its base edge; **VISIBLE** means at least one sampled ray is clear.', '', '## Unit placements', '');
  for (const unit of army.units) {
    const placement = plan.placements[unit.id];
    const where = placement.reserve ? 'Reserve' : placement.centres.map(([x, y]) => `(${x}\", ${y}\")`).join(', ');
    lines.push(`- **${unit.name}** — ${where}${placement.note ? `. ${placement.note}` : ''}`);
  }
  lines.push('', '## Turn plan', '', '- Turn 1: Wraiths establish centre and the blue natural. Both C’tan advance together along their marked flank. The Destroyer package remains staged.', '- Turn 2: the C’tan pressure or hit the red natural as a pair. Hold both Wraith scoring lanes until the far natural is actually broken.', '- Turn 2/3 switch: rotate the natural Wraith brick across (Veil if walking costs a scoring turn), roll the centre brick into the vacated lane, and bring the Destroyers through the middle.', '- Endgame: C’tan occupy the red-natural quarter, Wraiths rotate across centre/naturals, Destroyers protect the exposed scorer, and the Lokhust never leaves blue home.', '', 'Coordinates are model-centre positions from the map’s top-left corner. Sight lines are sampled against the repository terrain mask; red is unobstructed and green dashed is terrain-blocked.');
  return `${lines.join('\n')}\n`;
}

export function writeBuild({ armyFile, planFile, outDir, appOut, root }) {
  const army = readJson(armyFile);
  const plan = readJson(planFile);
  const result = validate(army, plan);
  if (result.errors.length) throw new Error(result.errors.join('\n'));
  const page = String(plan.layoutPage).padStart(2, '0');
  const mask = readGrayscalePng(path.join(root, 'public', 'reference', '11th-edition', 'terrain-masks', `layout-${page}.png`));
  const sightLines = analyseSightLines(army, plan, mask);
  fs.mkdirSync(outDir, { recursive: true });
  const stem = `necrons-take-take-${plan.layout.toLowerCase()}`;
  const importData = plannerImport(army, plan, sightLines);
  if (!appOut) fs.writeFileSync(path.join(outDir, `${stem}-planner.json`), `${JSON.stringify(importData, null, 2)}\n`);
  const map = fs.readFileSync(path.join(root, 'public', 'reference', '11th-edition', 'maps', `layout-${page}.jpg`)).toString('base64');
  fs.writeFileSync(path.join(outDir, `${stem}.svg`), renderSvg(army, plan, `data:image/jpeg;base64,${map}`, sightLines));
  fs.writeFileSync(path.join(outDir, `${stem}.md`), reportMarkdown(army, plan, sightLines));
  if (appOut) {
    fs.mkdirSync(path.dirname(appOut), { recursive: true });
    fs.writeFileSync(appOut, `${JSON.stringify(importData, null, 2)}\n`);
  }
  return { ...result, sightLines, outDir };
}
