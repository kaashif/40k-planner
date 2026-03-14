import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const DATASHEETS_DIR = path.join(process.cwd(), 'wh40k-10e');

export async function GET() {
  try {
    const files = await fs.readdir(DATASHEETS_DIR);
    const factions = files
      .filter(f => f.endsWith('.cat'))
      .map(f => ({
        filename: f,
        name: f.replace('.cat', ''),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(factions);
  } catch {
    return NextResponse.json([]);
  }
}
