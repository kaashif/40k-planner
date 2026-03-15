import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';
import { listFactions, getCataloguesDir, resolveFilename } from '../catalogues';

interface UnitEntry {
  name: string;
  factionSlug: string;
  factionName: string;
}

interface SelectionEntry {
  '@_name': string;
  '@_type': string;
  '@_hidden'?: string;
  selectionEntries?: { selectionEntry: SelectionEntry | SelectionEntry[] };
  profiles?: unknown;
}

function toArray<T>(val: T | T[] | undefined): T[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

// Build eagerly at module load time so first request is instant
const allUnitsPromise: Promise<UnitEntry[]> = (async () => {
  const factions = await listFactions();
  const cataloguesDir = getCataloguesDir();
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    isArray: () => false,
  });

  const results = await Promise.all(
    factions.map(async (faction) => {
      const filename = await resolveFilename(faction.slug);
      if (!filename) return [];

      try {
        const xml = await fs.readFile(path.join(cataloguesDir, filename), 'utf-8');
        const parsed = parser.parse(xml);
        const catalogue = parsed.catalogue;
        if (!catalogue) return [];

        const units: UnitEntry[] = [];
        const seen = new Set<string>();

        function collectUnits(entries: SelectionEntry[]) {
          for (const entry of entries) {
            if (entry['@_hidden'] === 'true') continue;
            const type = entry['@_type'];
            if ((type === 'unit' || type === 'model') && !seen.has(entry['@_name'])) {
              seen.add(entry['@_name']);
              units.push({
                name: entry['@_name'],
                factionSlug: faction.slug,
                factionName: faction.name,
              });
            }
          }
        }

        collectUnits(toArray(catalogue.sharedSelectionEntries?.selectionEntry));
        collectUnits(toArray(catalogue.selectionEntries?.selectionEntry));

        return units;
      } catch {
        return [];
      }
    })
  );

  return results.flat().filter(u => !u.name.includes('[Legends]'));
})();

export async function GET() {
  try {
    const units = await allUnitsPromise;
    return NextResponse.json(units);
  } catch {
    return NextResponse.json([]);
  }
}
