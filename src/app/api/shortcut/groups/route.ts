import { NextResponse } from 'next/server';
import { ShortcutGroup } from '@/lib/types';

export async function GET() {
  const token = process.env.SHORTCUT_API_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'Missing SHORTCUT_API_TOKEN' }, { status: 500 });
  }

  const res = await fetch('https://api.app.shortcut.com/api/v3/groups', {
    headers: {
      'Content-Type': 'application/json',
      'Shortcut-Token': token,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    return NextResponse.json({ error: 'Shortcut API error', status: res.status }, { status: 502 });
  }

  const groups: ShortcutGroup[] = await res.json();
  // Filter out archived groups
  const active = groups.filter((g: any) => !g.archived);

  return NextResponse.json(active);
}
