import { NextResponse } from 'next/server';
import { WebClient } from '@slack/web-api';
import { readConfig } from '@/lib/config';
import { buildSlackBlocks } from '@/lib/slack/formatter';
import { categorizeStories } from '@/lib/categorize';
import { ShortcutStory } from '@/lib/types';

// Secret to verify the request is from Vercel Cron (not a public caller)
const CRON_SECRET = process.env.CRON_SECRET;
const SHORTCUT_BASE = 'https://api.app.shortcut.com/api/v3';

export async function GET(request: Request) {
  // Verify the secret header — set CRON_SECRET in Vercel env vars
  const authHeader = request.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const scToken = process.env.SHORTCUT_API_TOKEN;
  const slackToken = process.env.SLACK_BOT_TOKEN;

  if (!scToken || !slackToken) {
    return NextResponse.json({ error: 'Missing API tokens' }, { status: 500 });
  }

  const config = await readConfig();
  const slack = new WebClient(slackToken);

  // Fetch member map for owner name resolution
  const membersRes = await fetch(`${SHORTCUT_BASE}/members`, {
    headers: { 'Content-Type': 'application/json', 'Shortcut-Token': scToken },
    cache: 'no-store',
  });
  const members: any[] = membersRes.ok ? await membersRes.json() : [];
  const memberMap: Record<string, string> = {};
  for (const m of members) {
    if (!m.disabled) memberMap[m.id] = m.profile?.name || m.profile?.mention_name || m.id;
  }

  // Get all active teams with a mapped Slack channel
  const activeTeams = Object.entries(config.mappings).filter(
    ([, tc]) => tc.active && tc.slackChannelId
  );

  if (activeTeams.length === 0) {
    return NextResponse.json({ message: 'No active teams to send', sent: 0 });
  }

  const results: { teamId: string; success: boolean; error?: string }[] = [];

  for (const [teamId, teamConfig] of activeTeams) {
    try {
      // Always fetch FRESH data from Shortcut — never uses cache
      const storiesRes = await fetch(`${SHORTCUT_BASE}/groups/${teamId}/stories`, {
        headers: { 'Content-Type': 'application/json', 'Shortcut-Token': scToken },
        cache: 'no-store',
      });
      if (!storiesRes.ok) throw new Error(`Shortcut API error for team ${teamId}`);

      const stories: ShortcutStory[] = (await storiesRes.json()).filter(
        (s: ShortcutStory) => !s.completed
      );
      const categorized = categorizeStories(stories, memberMap);
      const blocks = buildSlackBlocks(teamConfig.slackChannelName || teamId, categorized);

      await slack.chat.postMessage({
        channel: teamConfig.slackChannelId,
        text: `${teamConfig.slackChannelName || teamId} — Daily Digest`,
        blocks: blocks as any,
        unfurl_links: false,
        unfurl_media: false,
      });

      results.push({ teamId, success: true });
    } catch (err: any) {
      results.push({ teamId, success: false, error: err.message });
    }
  }

  const sent = results.filter((r) => r.success).length;
  console.log(`[cron] Sent ${sent}/${activeTeams.length} digests`);

  return NextResponse.json({ sent, total: activeTeams.length, results });
}
