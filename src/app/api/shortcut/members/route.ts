import { NextResponse } from 'next/server';
import { ShortcutMember } from '@/lib/types';

export async function GET() {
  const token = process.env.SHORTCUT_API_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'Missing SHORTCUT_API_TOKEN' }, { status: 500 });
  }

  const res = await fetch('https://api.app.shortcut.com/api/v3/members', {
    headers: {
      'Content-Type': 'application/json',
      'Shortcut-Token': token,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    return NextResponse.json({ error: 'Shortcut API error' }, { status: 502 });
  }

  const members: any[] = await res.json();

  // Return a flat map: { id -> display name }
  const memberMap: Record<string, string> = {};
  for (const m of members) {
    if (!m.disabled && !m.archived) {
      memberMap[m.id] = m.profile?.name || m.profile?.mention_name || m.id;
    }
  }

  return NextResponse.json(memberMap);
}
