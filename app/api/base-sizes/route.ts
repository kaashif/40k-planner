import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const BASE_SIZES_FILE = path.join(process.cwd(), 'base_sizes.json');

export async function GET() {
  try {
    const data = await fs.readFile(BASE_SIZES_FILE, 'utf-8');
    return NextResponse.json(JSON.parse(data));
  } catch (error) {
    // File doesn't exist yet, return empty object
    return NextResponse.json({});
  }
}
