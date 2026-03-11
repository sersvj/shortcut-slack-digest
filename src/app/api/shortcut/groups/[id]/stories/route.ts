import { NextResponse } from 'next/server';
import { categorizeStories } from '@/lib/categorize';
import { ShortcutStory } from '@/lib/types';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = process.env.SHORTCUT_API_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'Missing SHORTCUT_API_TOKEN' }, { status: 500 });
  }

  // Fetch stories for this group
  const [storiesRes, membersRes] = await Promise.all([
    fetch(`https://api.app.shortcut.com/api/v3/groups/${id}/stories`, {
      headers: {
        'Content-Type': 'application/json',
        'Shortcut-Token': token,
      },
      cache: 'no-store',
    }),
    fetch('https://api.app.shortcut.com/api/v3/members', {
      headers: {
        'Content-Type': 'application/json',
        'Shortcut-Token': token,
      },
      cache: 'no-store',
    }),
  ]);

  if (!storiesRes.ok) {
    return NextResponse.json({ error: 'Failed to fetch stories' }, { status: 502 });
  }

  const stories: ShortcutStory[] = await storiesRes.json();
  let memberMap: Record<string, string> = {};

  if (membersRes.ok) {
    const members: any[] = await membersRes.json();
    for (const m of members) {
      if (!m.disabled) {
        memberMap[m.id] = m.profile?.name || m.profile?.mention_name || m.id;
      }
    }
  }

  // Filter out completed stories
  const openStories = stories.filter((s) => !s.completed);
  const categorized = categorizeStories(openStories, memberMap);

  return NextResponse.json(categorized);
}
