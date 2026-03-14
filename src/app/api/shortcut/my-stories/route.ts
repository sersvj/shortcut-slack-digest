import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ShortcutStory, ShortcutWorkflow, MyStory } from '@/lib/types';

const BASE = 'https://api.app.shortcut.com/api/v3';

interface SearchPage {
  data: ShortcutStory[];
  next: string | null;
  total: number;
}

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.email !== process.env.MY_SLACK_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = process.env.SHORTCUT_API_TOKEN;
  const mentionName = process.env.MY_SHORTCUT_MENTION_NAME;
  if (!token || !mentionName) {
    return NextResponse.json({ error: 'Missing SHORTCUT_API_TOKEN or MY_SHORTCUT_MENTION_NAME' }, { status: 500 });
  }

  const headers = { 'Content-Type': 'application/json', 'Shortcut-Token': token };

  // Fetch workflows in parallel while we kick off the first story page
  const workflowsPromise = fetch(`${BASE}/workflows`, { headers, cache: 'no-store' });

  // Search all non-archived stories owned by this member (active + recently completed)
  const allStories: ShortcutStory[] = [];
  let nextCursor: string | null = null;
  const query = `owner:${mentionName} !is:archived`;

  do {
    const params = new URLSearchParams({ query, page_size: '25' });
    if (nextCursor) params.set('next', nextCursor);

    const res = await fetch(`${BASE}/search/stories?${params.toString()}`, {
      headers,
      cache: 'no-store',
    });

    if (!res.ok) break;

    const page = (await res.json()) as SearchPage;
    allStories.push(...(page.data ?? []));
    nextCursor = page.next ?? null;
  } while (nextCursor);

  // Build workflow state map
  const stateMap: Record<number, string> = {};
  const workflowsRes = await workflowsPromise;
  if (workflowsRes.ok) {
    const workflows = (await workflowsRes.json()) as ShortcutWorkflow[];
    for (const wf of workflows) {
      for (const st of wf.states || []) {
        stateMap[st.id] = st.name;
      }
    }
  }

  // Keep: active stories, OR completed stories where completed_at is in the current calendar month
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  const filtered = allStories.filter((s) => {
    if (!s.completed) return true; // always show active stories
    if (!s.completed_at) return false; // completed with no date — exclude
    const completedDate = new Date(s.completed_at);
    return (
      completedDate.getFullYear() === currentYear &&
      completedDate.getMonth() === currentMonth
    );
  });

  const stories: MyStory[] = filtered.map((s) => ({
    id: s.id,
    name: s.name,
    app_url: s.app_url,
    deadline: s.deadline,
    group_id: s.group_id,
    state: stateMap[s.workflow_state_id],
    completed: s.completed,
    completed_at: s.completed_at,
  }));

  // Sort: active stories first (by deadline soonest → no deadline → by name),
  // then completed stories (most recently completed first)
  stories.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (!a.completed) {
      // Both active: soonest deadline first, then no-deadline by name
      if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      return a.name.localeCompare(b.name);
    }
    // Both completed: most recently completed first
    return (b.completed_at ?? '').localeCompare(a.completed_at ?? '');
  });

  return NextResponse.json(stories);
}
