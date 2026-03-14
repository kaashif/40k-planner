import { NextResponse } from 'next/server';
import { listFactions } from './catalogues';

export async function GET() {
  try {
    const factions = await listFactions();
    return NextResponse.json(factions);
  } catch {
    return NextResponse.json([]);
  }
}
