import { categorizeStories } from './categorize';
import { MemberDigest, ShortcutStory, ShortcutMember, ShortcutWorkflow, ShortcutGroup } from './types';

const BASE = 'https://api.app.shortcut.com/api/v3';

/**
 * Shared helper that fetches all stories across all groups and aggregates them
 * per Shortcut member (by owner_ids and requester_id), excluding completed and archived.
 * Used by both the API route and the cron route to avoid code duplication.
 */
export async function getMemberDigests(scToken: string): Promise<MemberDigest[]> {
  const headers = { 'Content-Type': 'application/json', 'Shortcut-Token': scToken };

  const [groupsRes, membersRes, workflowsRes] = await Promise.all([
    fetch(`${BASE}/groups`, { headers, cache: 'no-store' }),
    fetch(`${BASE}/members`, { headers, cache: 'no-store' }),
    fetch(`${BASE}/workflows`, { headers, cache: 'no-store' }),
  ]);

  if (!groupsRes.ok) throw new Error('Failed to fetch groups');

  const memberMap: Record<string, string> = {};
  if (membersRes.ok) {
    const members = (await membersRes.json()) as ShortcutMember[];
    for (const m of members) {
      if (!m.disabled) {
        memberMap[m.id] = m.profile?.name || m.profile?.mention_name || m.id;
      }
    }
  }

  const stateMap: Record<number, string> = {};
  if (workflowsRes.ok) {
    const workflows = (await workflowsRes.json()) as ShortcutWorkflow[];
    for (const wf of workflows) {
      for (const st of wf.states || []) {
        stateMap[st.id] = st.name;
      }
    }
  }

  const groups = (await groupsRes.json()) as ShortcutGroup[];
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

  // Flatten, deduplicate, and filter out completed/archived stories
  const allStories = Array.from(
    new Map(
      storyArrays
        .flat()
        .filter((s) => !s.completed && !s.archived)
        .map((s) => [s.id, s])
    ).values()
  );

  // Pivot by owner and requester
  const ownedByMember: Record<string, ShortcutStory[]> = {};
  const requestedByMember: Record<string, ShortcutStory[]> = {};

  for (const story of allStories) {
    for (const ownerId of story.owner_ids) {
      if (!memberMap[ownerId]) continue;
      (ownedByMember[ownerId] ??= []).push(story);
    }
    const reqId = story.requested_by_id;
    if (reqId && memberMap[reqId]) {
      (requestedByMember[reqId] ??= []).push(story);
    }
  }

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

  return digests.sort((a, b) => a.name.localeCompare(b.name));
}
