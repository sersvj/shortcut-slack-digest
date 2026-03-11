import { NextResponse } from 'next/server';
import { categorizeStories } from '@/lib/categorize';
import { MemberDigest, ShortcutStory } from '@/lib/types';

const BASE = 'https://api.app.shortcut.com/api/v3';

export async function GET() {
  const token = process.env.SHORTCUT_API_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'Missing SHORTCUT_API_TOKEN' }, { status: 500 });
  }

  const headers = { 'Content-Type': 'application/json', 'Shortcut-Token': token };

  // Fetch groups, members, and workflows in parallel
  const [groupsRes, membersRes, workflowsRes] = await Promise.all([
    fetch(`${BASE}/groups`, { headers, cache: 'no-store' }),
    fetch(`${BASE}/members`, { headers, cache: 'no-store' }),
    fetch(`${BASE}/workflows`, { headers, cache: 'no-store' }),
  ]);

  if (!groupsRes.ok) {
    return NextResponse.json({ error: 'Failed to fetch groups' }, { status: 502 });
  }

  // Build member map (id -> name)
  const memberMap: Record<string, string> = {};
  if (membersRes.ok) {
    const members: any[] = await membersRes.json();
    for (const m of members) {
      if (!m.disabled) {
        memberMap[m.id] = m.profile?.name || m.profile?.mention_name || m.id;
      }
    }
  }

  // Build workflow state map
  const stateMap: Record<number, string> = {};
  if (workflowsRes.ok) {
    const workflows: any[] = await workflowsRes.json();
    for (const wf of workflows) {
      for (const st of wf.states || []) {
        stateMap[st.id] = st.name;
      }
    }
  }

  // Fetch all stories across all groups in parallel
  const groups: any[] = await groupsRes.json();
  const activeGroups = groups.filter((g) => !g.archived);

  const storyArrays = await Promise.all(
    activeGroups.map(async (g) => {
      try {
        const res = await fetch(`${BASE}/groups/${g.id}/stories`, { headers, cache: 'no-store' });
        if (!res.ok) return [] as ShortcutStory[];
        return (await res.json()) as ShortcutStory[];
      } catch {
        return [] as ShortcutStory[];
      }
    })
  );

  // Flatten and filter — exclude completed and archived stories
  const allStories = storyArrays
    .flat()
    .filter((s) => !s.completed && !s.archived);

  // Deduplicate by story ID (a story may appear in multiple groups)
  const dedupedStories = Array.from(new Map(allStories.map((s) => [s.id, s])).values());

  // Pivot: for each member, collect owned and requested stories
  const ownedByMember: Record<string, ShortcutStory[]> = {};
  const requestedByMember: Record<string, ShortcutStory[]> = {};

  for (const story of dedupedStories) {
    for (const ownerId of story.owner_ids) {
      if (!memberMap[ownerId]) continue;
      if (!ownedByMember[ownerId]) ownedByMember[ownerId] = [];
      ownedByMember[ownerId].push(story);
    }

    const reqId = story.requested_by_id;
    if (reqId && memberMap[reqId]) {
      if (!requestedByMember[reqId]) requestedByMember[reqId] = [];
      requestedByMember[reqId].push(story);
    }
  }

  // Build the final member digests — only include members with at least one story
  const allMemberIds = new Set([
    ...Object.keys(ownedByMember),
    ...Object.keys(requestedByMember),
  ]);

  const digests: MemberDigest[] = [];
  for (const memberId of allMemberIds) {
    const name = memberMap[memberId];
    if (!name) continue;

    digests.push({
      id: memberId,
      name,
      owned: categorizeStories(ownedByMember[memberId] || [], memberMap, stateMap),
      requested: categorizeStories(requestedByMember[memberId] || [], memberMap, stateMap),
    });
  }

  // Sort alphabetically by name
  digests.sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json(digests);
}
