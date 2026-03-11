import { NextResponse } from 'next/server';
import { readConfig, writeConfig } from '@/lib/config';

export async function GET() {
  const config = await readConfig();
  return NextResponse.json(config);
}

export async function POST(request: Request) {
  const body = await request.json();
  await writeConfig(body);
  return NextResponse.json({ success: true });
}
