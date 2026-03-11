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

  // Fetch stories, members, and workflows
  const [storiesRes, membersRes, workflowsRes] = await Promise.all([
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
    fetch('https://api.app.shortcut.com/api/v3/workflows', {
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
  let stateMap: Record<number, string> = {};

  if (membersRes.ok) {
    const members: any[] = await membersRes.json();
    for (const m of members) {
      if (!m.disabled) {
        memberMap[m.id] = m.profile?.name || m.profile?.mention_name || m.id;
      }
    }
  }

  if (workflowsRes.ok) {
    const workflows: any[] = await workflowsRes.json();
    for (const wf of workflows) {
      for (const st of wf.states || []) {
        stateMap[st.id] = st.name;
      }
    }
  }

  // Filter out completed and archived stories
  const openStories = stories.filter((s) => !s.completed && !s.archived);
  const categorized = categorizeStories(openStories, memberMap, stateMap);

  return NextResponse.json(categorized);
}
