import { NextResponse } from 'next/server';
import { categorizeStories } from '@/lib/categorize';
import { ShortcutStory, ShortcutMember, ShortcutWorkflow } from '@/lib/types';

const BASE = 'https://api.app.shortcut.com/api/v3';

interface ShortcutCustomField {
  id: string;
  name: string;
  enabled: boolean;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = process.env.SHORTCUT_API_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'Missing SHORTCUT_API_TOKEN' }, { status: 500 });
  }

  const headers = { 'Content-Type': 'application/json', 'Shortcut-Token': token };

  // Fetch stories, members, workflows, and custom fields in parallel
  const [storiesRes, membersRes, workflowsRes, customFieldsRes] = await Promise.all([
    fetch(`${BASE}/groups/${id}/stories`, { headers, cache: 'no-store' }),
    fetch(`${BASE}/members`, { headers, cache: 'no-store' }),
    fetch(`${BASE}/workflows`, { headers, cache: 'no-store' }),
    fetch(`${BASE}/custom-fields`, { headers, cache: 'no-store' }),
  ]);

  if (!storiesRes.ok) {
    return NextResponse.json({ error: 'Failed to fetch stories' }, { status: 502 });
  }

  const stories: ShortcutStory[] = await storiesRes.json();
  const memberMap: Record<string, string> = {};
  const stateMap: Record<number, string> = {};

  if (membersRes.ok) {
    const members = (await membersRes.json()) as ShortcutMember[];
    for (const m of members) {
      if (!m.disabled) {
        memberMap[m.id] = m.profile?.name || m.profile?.mention_name || m.id;
      }
    }
  }

  if (workflowsRes.ok) {
    const workflows = (await workflowsRes.json()) as ShortcutWorkflow[];
    for (const wf of workflows) {
      for (const st of wf.states || []) {
        stateMap[st.id] = st.name;
      }
    }
  }

  // Find the Priority custom field ID (case-insensitive name match)
  let priorityFieldId: string | undefined;
  if (customFieldsRes.ok) {
    const customFields = (await customFieldsRes.json()) as ShortcutCustomField[];
    const priorityField = customFields.find(
      (f) => f.enabled && f.name.toLowerCase() === 'priority'
    );
    if (priorityField) priorityFieldId = priorityField.id;
  }

  const openStories = stories.filter((s) => !s.completed && !s.archived);
  const categorized = categorizeStories(openStories, memberMap, stateMap, priorityFieldId);

  return NextResponse.json(categorized);
}
