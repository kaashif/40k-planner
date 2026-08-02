import { readFile, writeFile } from 'node:fs/promises';

const input = new URL('../reference/11th-edition/extracted/event-companion.txt', import.meta.url);
const output = new URL('../reference/11th-edition/data/event-layouts.json', import.meta.url);

const text = await readFile(input, 'utf8');
const pages = text.split('\f');

const layouts = pages.flatMap((pageText, zeroBasedPage) => {
  const layoutMatch = pageText.match(/\bLAYOUT\s+([ABC])\b/);
  if (!layoutMatch) return [];

  const lines = pageText.split('\n');
  const versusLineIndex = lines.findIndex((line) => /\sVS\s/.test(line));
  const missionHeadingIndex = lines.findIndex((line) => /MISSION.*MISSION/.test(line));
  if (versusLineIndex < 0 || missionHeadingIndex < 0) {
    throw new Error(`Could not parse layout header on PDF page ${zeroBasedPage + 1}`);
  }

  const dispositionParts = lines[versusLineIndex]
    .trim()
    .split(/\s+VS\s+/)
    .map((value) => value.trim());
  const missionLine = lines
    .slice(missionHeadingIndex + 1)
    .find((line) => line.trim() && !/LAYOUT\s+[ABC]/.test(line));
  const missionParts = missionLine?.trim().split(/\s{2,}/).map((value) => value.trim());

  if (dispositionParts.length !== 2 || missionParts?.length !== 2) {
    throw new Error(`Unexpected layout columns on PDF page ${zeroBasedPage + 1}`);
  }

  const measurementsInches = [
    ...new Set([...pageText.matchAll(/\b(\d+(?:\.\d+)?)\s*"/g)].map((match) => Number(match[1]))),
  ].sort((a, b) => a - b);
  const terrainFeatureGroups = [
    ...new Set([...pageText.matchAll(/\b(AB|CD|EF|GH)\b/g)].map((match) => match[1])),
  ].sort();

  return [{
    id: `${slug(dispositionParts[0])}-vs-${slug(dispositionParts[1])}-${layoutMatch[1].toLowerCase()}`,
    layout: layoutMatch[1],
    pdfPage: zeroBasedPage + 1,
    printedPage: zeroBasedPage + 1,
    attacker: {
      forceDisposition: titleCase(dispositionParts[0]),
      primaryMission: titleCase(missionParts[0]),
    },
    defender: {
      forceDisposition: titleCase(dispositionParts[1]),
      primaryMission: titleCase(missionParts[1]),
    },
    measurementsInches,
    terrainFeatureGroups,
    source: 'official/event-companion.pdf',
  }];
});

if (layouts.length !== 45) {
  throw new Error(`Expected 45 event layouts, found ${layouts.length}`);
}

await writeFile(output, `${JSON.stringify({
  schemaVersion: 1,
  edition: 11,
  season: '2026-27',
  battlefieldInches: { width: 60, height: 44 },
  note: 'Coordinates and visual geometry remain authoritative in the referenced PDF page; measurements here are an index of the labels present on that page.',
  layouts,
}, null, 2)}\n`);

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function titleCase(value) {
  const lowerCaseWords = new Set(['and', 'of', 'the']);
  return value.toLowerCase().replaceAll('’', "'").split(' ').map((word, index) => {
    if (index > 0 && lowerCaseWords.has(word)) return word;
    return word
      .replace(/^\p{L}/u, (letter) => letter.toUpperCase())
      .replace(/-\p{L}/gu, (letter) => letter.toUpperCase());
  }).join(' ');
}
