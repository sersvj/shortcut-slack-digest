import { NextResponse } from 'next/server';
import { WebClient } from '@slack/web-api';
import { readConfig, writeConfig } from '@/lib/config';
import { buildSlackBlocks } from '@/lib/slack/formatter';
import { categorizeStories } from '@/lib/categorize';
import { ShortcutStory } from '@/lib/types';

const SHORTCUT_BASE = 'https://api.app.shortcut.com/api/v3';

async function fetchGroupStories(groupId: string, scToken: string): Promise<ShortcutStory[]> {
  const res = await fetch(`${SHORTCUT_BASE}/groups/${groupId}/stories`, {
    headers: { 'Content-Type': 'application/json', 'Shortcut-Token': scToken },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Failed to fetch stories for group ${groupId}`);
  const stories: ShortcutStory[] = await res.json();
  return stories.filter((s) => !s.completed && !s.archived);
}

async function fetchMemberMap(scToken: string): Promise<Record<string, string>> {
  const res = await fetch(`${SHORTCUT_BASE}/members`, {
    headers: { 'Content-Type': 'application/json', 'Shortcut-Token': scToken },
    cache: 'no-store',
  });
  if (!res.ok) return {};
  const members: any[] = await res.json();
  const map: Record<string, string> = {};
  for (const m of members) {
    if (!m.disabled) map[m.id] = m.profile?.name || m.profile?.mention_name || m.id;
  }
  return map;
}

async function fetchWorkflowMap(scToken: string): Promise<Record<number, string>> {
  const res = await fetch(`${SHORTCUT_BASE}/workflows`, {
    headers: { 'Content-Type': 'application/json', 'Shortcut-Token': scToken },
    cache: 'no-store',
  });
  if (!res.ok) return {};
  const workflows: any[] = await res.json();
  const map: Record<number, string> = {};
  for (const wf of workflows) {
    for (const st of wf.states || []) {
      map[st.id] = st.name;
    }
  }
  return map;
}

export async function POST(request: Request) {
  const scToken = process.env.SHORTCUT_API_TOKEN;
  const slackToken = process.env.SLACK_BOT_TOKEN;

  if (!scToken || !slackToken) {
    return NextResponse.json({ error: 'Missing API tokens' }, { status: 500 });
  }

  const body = await request.json();
  // teamIds: string[] — list of group IDs to send, or "active" to send all active ones
  const { teamIds, teamNames } = body as { teamIds: string[]; teamNames: Record<string, string> };

  const config = await readConfig();
  const slack = new WebClient(slackToken);
  const [memberMap, stateMap] = await Promise.all([
    fetchMemberMap(scToken),
    fetchWorkflowMap(scToken),
  ]);

  const results: { teamId: string; success: boolean; error?: string; channel?: string }[] = [];

  for (const teamId of teamIds) {
    const teamConfig = config.mappings[teamId];

    if (!teamConfig?.slackChannelId) {
      results.push({ teamId, success: false, error: 'No Slack channel mapped' });
      continue;
    }

    try {
      const stories = await fetchGroupStories(teamId, scToken);
      const categorized = categorizeStories(stories, memberMap, stateMap);
      const teamName = teamNames[teamId] || 'Unknown Team';
      const blocks = buildSlackBlocks(teamName, categorized);

      await slack.chat.postMessage({
        channel: teamConfig.slackChannelId,
        text: `${teamName} — Daily Digest`,
        blocks: blocks as any,
        unfurl_links: false,
        unfurl_media: false,
      });

      // Update lastSentAt
      config.mappings[teamId] = {
        ...teamConfig,
        lastSentAt: new Date().toISOString(),
      };

      results.push({ teamId, success: true, channel: teamConfig.slackChannelName });
    } catch (err: any) {
      results.push({ teamId, success: false, error: err.message || 'Unknown error' });
    }
  }

  // Persist updated lastSentAt timestamps
  await writeConfig(config);

  return NextResponse.json({ results });
}
