import { promises as fs } from 'fs';
import path from 'path';

const DATASHEETS_DIR = path.join(process.cwd(), 'wh40k-10e');

export interface FactionEntry {
  slug: string;
  name: string;
}

function toSlug(filename: string): string {
  return filename
    .replace('.cat', '')
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

let cachedMap: Map<string, string> | null = null;

async function buildSlugMap(): Promise<Map<string, string>> {
  if (cachedMap) return cachedMap;

  const files = await fs.readdir(DATASHEETS_DIR);
  const map = new Map<string, string>();
  for (const f of files) {
    if (f.endsWith('.cat')) {
      map.set(toSlug(f), f);
    }
  }
  cachedMap = map;
  return map;
}

export async function listFactions(): Promise<FactionEntry[]> {
  const map = await buildSlugMap();
  const factions: FactionEntry[] = [];
  for (const [slug, filename] of map) {
    factions.push({ slug, name: filename.replace('.cat', '') });
  }
  return factions.sort((a, b) => a.name.localeCompare(b.name));
}

export async function resolveFilename(slug: string): Promise<string | null> {
  const map = await buildSlugMap();
  return map.get(slug) ?? null;
}

export function getCataloguesDir(): string {
  return DATASHEETS_DIR;
}
