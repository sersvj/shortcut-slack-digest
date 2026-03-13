import { NextResponse } from 'next/server';
import { ShortcutMember, ShortcutWorkflow, ShortcutStory, CategorizedStory, TeamlessRequester } from '@/lib/types';

const BASE = 'https://api.app.shortcut.com/api/v3';

// Shape returned by GET /api/v3/search/stories
interface SearchPage {
  data: ShortcutStory[];
  next: string | null;
  total: number;
}

export async function GET() {
  const token = process.env.SHORTCUT_API_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'Missing SHORTCUT_API_TOKEN' }, { status: 500 });
  }

  const headers = { 'Content-Type': 'application/json', 'Shortcut-Token': token };

  // Fetch members and workflows in parallel
  const [membersRes, workflowsRes] = await Promise.all([
    fetch(`${BASE}/members`, { headers, cache: 'no-store' }),
    fetch(`${BASE}/workflows`, { headers, cache: 'no-store' }),
  ]);

  // Build member map (id -> name)
  const memberMap: Record<string, string> = {};
  if (membersRes.ok) {
    const members = (await membersRes.json()) as ShortcutMember[];
    for (const m of members) {
      if (!m.disabled && !m.archived) {
        memberMap[m.id] = m.profile?.name || m.profile?.mention_name || m.id;
      }
    }
  }

  // Build workflow state map
  const stateMap: Record<number, string> = {};
  if (workflowsRes.ok) {
    const workflows = (await workflowsRes.json()) as ShortcutWorkflow[];
    for (const wf of workflows) {
      for (const st of wf.states || []) {
        stateMap[st.id] = st.name;
      }
    }
  }

  // Use the text-based search API to fetch all non-archived, non-completed stories.
  // Shortcut's query language supports !is:done and !is:archived reliably.
  const allStories: ShortcutStory[] = [];
  let nextCursor: string | null = null;

  do {
    const params = new URLSearchParams({ query: '!is:done !is:archived', page_size: '25' });
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

  // Keep only stories with no team assigned.
  // Shortcut returns group_id as a UUID string when set, or null/empty/"" when unset.
  const teamlessStories = allStories.filter((s) => {
    if (s.completed || s.archived) return false;
    // Treat null, undefined, and empty string all as "no team"
    return !s.group_id;
  });

  // Group by requester
  const byRequester: Record<string, ShortcutStory[]> = {};
  for (const story of teamlessStories) {
    const reqId = story.requested_by_id;
    if (!reqId) continue;
    if (!byRequester[reqId]) byRequester[reqId] = [];
    byRequester[reqId].push(story);
  }

  // Build requester list with resolved names and flattened story data
  const requesters: TeamlessRequester[] = [];

  for (const [reqId, stories] of Object.entries(byRequester)) {
    const name = memberMap[reqId] || reqId;

    const categorizedStories: CategorizedStory[] = stories.map((story) => ({
      id: story.id,
      name: story.name,
      app_url: story.app_url,
      deadline: story.deadline,
      owners: story.owner_ids.map((id) => memberMap[id]).filter(Boolean),
      state: stateMap[story.workflow_state_id],
    }));

    requesters.push({ id: reqId, name, stories: categorizedStories });
  }

  // Sort alphabetically by requester name
  requesters.sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json(requesters);
}
