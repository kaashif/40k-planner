import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';
import { resolveFilename, getCataloguesDir } from '../catalogues';

interface Characteristic {
  '@_name': string;
  '#text'?: string;
}

interface Profile {
  '@_id'?: string;
  '@_name': string;
  '@_typeName': string;
  '@_typeId': string;
  characteristics?: { characteristic: Characteristic | Characteristic[] };
}

interface InfoLink {
  '@_name': string;
  '@_type': string;
  '@_targetId': string;
}

interface SelectionEntry {
  '@_id'?: string;
  '@_name': string;
  '@_type': string;
  '@_hidden'?: string;
  profiles?: { profile: Profile | Profile[] };
  selectionEntries?: { selectionEntry: SelectionEntry | SelectionEntry[] };
  selectionEntryGroups?: { selectionEntryGroup: SelectionEntry | SelectionEntry[] };
  entryLinks?: { entryLink: EntryLink | EntryLink[] };
  infoLinks?: { infoLink: InfoLink | InfoLink[] };
  costs?: { cost: { '@_name': string; '@_value': string } | { '@_name': string; '@_value': string }[] };
  categoryLinks?: { categoryLink: { '@_name': string; '@_primary'?: string } | { '@_name': string; '@_primary'?: string }[] };
}

interface EntryLink {
  '@_name': string;
  '@_type': string;
  '@_targetId': string;
  '@_hidden'?: string;
}

function toArray<T>(val: T | T[] | undefined): T[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

function extractCharacteristics(profile: Profile): Record<string, string> {
  const chars: Record<string, string> = {};
  for (const c of toArray(profile.characteristics?.characteristic)) {
    chars[c['@_name']] = c['#text']?.toString() || '';
  }
  return chars;
}

interface ParsedUnit {
  name: string;
  points: number;
  keywords: string[];
  stats: { name: string; M: string; T: string; SV: string; W: string; LD: string; OC: string }[];
  rangedWeapons: { name: string; range: string; A: string; BS: string; S: string; AP: string; D: string; keywords: string }[];
  meleeWeapons: { name: string; range: string; A: string; WS: string; S: string; AP: string; D: string; keywords: string }[];
  abilities: { name: string; description: string }[];
  invulnSave: string | null;
  fnp: string | null;
}

function parseInvulnAndFnp(abilities: { name: string; description: string }[]): { invulnSave: string | null; fnp: string | null } {
  let invulnSave: string | null = null;
  let fnp: string | null = null;

  for (const ability of abilities) {
    // Invulnerable Save: look for "N+ invulnerable save"
    if (ability.name === 'Invulnerable Save') {
      const match = ability.description.match(/(\d)\+\s*invulnerable save/i);
      if (match) invulnSave = match[1] + '+';
    }
    // Feel No Pain: look for "Feel No Pain N+" in description (unconditional ones)
    // Skip conditional ones like "while within range of..." or "against mortal wounds"
    const fnpMatch = ability.description.match(/Feel No Pain (\d)\+/i);
    if (fnpMatch) {
      const isConditional = /while|against|if|when/i.test(ability.description);
      if (!isConditional) {
        fnp = fnpMatch[1] + '+';
      }
    }
  }

  return { invulnSave, fnp };
}

function extractFromEntry(
  entry: SelectionEntry,
  sharedProfiles: Map<string, Profile>,
  sharedEntries: Map<string, SelectionEntry>,
): ParsedUnit | null {
  if (entry['@_hidden'] === 'true') return null;
  const type = entry['@_type'];
  if (type !== 'unit' && type !== 'model') return null;

  const unit: ParsedUnit = {
    name: entry['@_name'],
    points: 0,
    keywords: [],
    stats: [],
    rangedWeapons: [],
    meleeWeapons: [],
    abilities: [],
    invulnSave: null,
    fnp: null,
  };

  // Extract points
  for (const cost of toArray(entry.costs?.cost)) {
    if (cost['@_name'] === 'pts') {
      unit.points = parseInt(cost['@_value']) || 0;
    }
  }

  // Extract keywords from categoryLinks
  for (const cl of toArray(entry.categoryLinks?.categoryLink)) {
    unit.keywords.push(cl['@_name']);
  }

  // Process all profiles recursively
  function processProfiles(profiles: Profile[]) {
    for (const profile of profiles) {
      const chars = extractCharacteristics(profile);
      switch (profile['@_typeName']) {
        case 'Unit':
          unit.stats.push({
            name: profile['@_name'],
            M: chars['M'] || '',
            T: chars['T'] || '',
            SV: chars['SV'] || '',
            W: chars['W'] || '',
            LD: chars['LD'] || '',
            OC: chars['OC'] || '',
          });
          break;
        case 'Ranged Weapons':
          unit.rangedWeapons.push({
            name: profile['@_name'],
            range: chars['Range'] || '',
            A: chars['A'] || '',
            BS: chars['BS'] || '',
            S: chars['S'] || '',
            AP: chars['AP'] || '',
            D: chars['D'] || '',
            keywords: chars['Keywords'] || '',
          });
          break;
        case 'Melee Weapons':
          unit.meleeWeapons.push({
            name: profile['@_name'],
            range: chars['Range'] || 'Melee',
            A: chars['A'] || '',
            WS: chars['WS'] || '',
            S: chars['S'] || '',
            AP: chars['AP'] || '',
            D: chars['D'] || '',
            keywords: chars['Keywords'] || '',
          });
          break;
        case 'Abilities':
          unit.abilities.push({
            name: profile['@_name'],
            description: chars['Description'] || '',
          });
          break;
      }
    }
  }

  // Process top-level profiles
  processProfiles(toArray(entry.profiles?.profile));

  // Resolve infoLinks to shared profiles
  function resolveInfoLinks(e: SelectionEntry) {
    for (const link of toArray(e.infoLinks?.infoLink)) {
      if (link['@_type'] === 'profile') {
        const profile = sharedProfiles.get(link['@_targetId']);
        if (profile) processProfiles([profile]);
      }
    }
  }

  // Process nested selectionEntries (weapons, models)
  function processEntries(entries: SelectionEntry[]) {
    for (const sub of entries) {
      processProfiles(toArray(sub.profiles?.profile));
      resolveInfoLinks(sub);
      processEntries(toArray(sub.selectionEntries?.selectionEntry));
      // Resolve entryLinks to shared entries
      for (const link of toArray(sub.entryLinks?.entryLink)) {
        if (link['@_hidden'] === 'true') continue;
        const target = sharedEntries.get(link['@_targetId']);
        if (target) {
          processProfiles(toArray(target.profiles?.profile));
          resolveInfoLinks(target);
          processEntries(toArray(target.selectionEntries?.selectionEntry));
        }
      }
      // Also process selectionEntryGroups
      for (const group of toArray(sub.selectionEntryGroups?.selectionEntryGroup)) {
        processEntries(toArray(group.selectionEntries?.selectionEntry));
        for (const link of toArray(group.entryLinks?.entryLink)) {
          if (link['@_hidden'] === 'true') continue;
          const target = sharedEntries.get(link['@_targetId']);
          if (target) {
            processProfiles(toArray(target.profiles?.profile));
            resolveInfoLinks(target);
          }
        }
      }
    }
  }

  // Resolve top-level infoLinks
  resolveInfoLinks(entry);

  // Process nested entries
  processEntries(toArray(entry.selectionEntries?.selectionEntry));

  // Resolve top-level entryLinks
  for (const link of toArray(entry.entryLinks?.entryLink)) {
    if (link['@_hidden'] === 'true') continue;
    const target = sharedEntries.get(link['@_targetId']);
    if (target) {
      processProfiles(toArray(target.profiles?.profile));
      resolveInfoLinks(target);
      processEntries(toArray(target.selectionEntries?.selectionEntry));
    }
  }

  // Process selectionEntryGroups at top level
  for (const group of toArray(entry.selectionEntryGroups?.selectionEntryGroup)) {
    processEntries(toArray(group.selectionEntries?.selectionEntry));
    for (const link of toArray(group.entryLinks?.entryLink)) {
      if (link['@_hidden'] === 'true') continue;
      const target = sharedEntries.get(link['@_targetId']);
      if (target) {
        processProfiles(toArray(target.profiles?.profile));
        resolveInfoLinks(target);
      }
    }
  }

  // Only return if we found stats
  if (unit.stats.length === 0 && unit.rangedWeapons.length === 0 && unit.meleeWeapons.length === 0) {
    return null;
  }

  // Parse invuln and FNP from abilities
  const { invulnSave, fnp } = parseInvulnAndFnp(unit.abilities);
  unit.invulnSave = invulnSave;
  unit.fnp = fnp;

  return unit;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ faction: string }> },
) {
  const { faction } = await params;
  const filename = await resolveFilename(faction);
  if (!filename) {
    return NextResponse.json({ error: 'Unknown faction' }, { status: 404 });
  }

  const filePath = path.join(getCataloguesDir(), filename);

  try {
    const xml = await fs.readFile(filePath, 'utf-8');

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      isArray: () => false,
    });

    const parsed = parser.parse(xml);
    const catalogue = parsed.catalogue;
    if (!catalogue) {
      return NextResponse.json({ error: 'Invalid catalogue file' }, { status: 400 });
    }

    // Build shared profile map (id -> profile)
    const sharedProfiles = new Map<string, Profile>();
    for (const profile of toArray(catalogue.sharedProfiles?.profile)) {
      if (profile['@_id']) sharedProfiles.set(profile['@_id'], profile);
    }

    // Build shared selection entry map (id -> entry)
    const sharedEntries = new Map<string, SelectionEntry>();
    function indexEntries(entries: SelectionEntry[]) {
      for (const entry of entries) {
        if (entry['@_id']) sharedEntries.set(entry['@_id'], entry);
        indexEntries(toArray(entry.selectionEntries?.selectionEntry));
      }
    }
    indexEntries(toArray(catalogue.sharedSelectionEntries?.selectionEntry));

    const units: ParsedUnit[] = [];

    // Extract from sharedSelectionEntries
    for (const entry of toArray(catalogue.sharedSelectionEntries?.selectionEntry)) {
      const unit = extractFromEntry(entry, sharedProfiles, sharedEntries);
      if (unit) units.push(unit);
    }

    // Extract from top-level selectionEntries
    for (const entry of toArray(catalogue.selectionEntries?.selectionEntry)) {
      const unit = extractFromEntry(entry, sharedProfiles, sharedEntries);
      if (unit) units.push(unit);
    }

    // Sort by name
    units.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      name: catalogue['@_name'] || filename.replace('.cat', ''),
      library: catalogue['@_library'] === 'true',
      unitCount: units.length,
      units,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to parse file' }, { status: 500 });
  }
}
