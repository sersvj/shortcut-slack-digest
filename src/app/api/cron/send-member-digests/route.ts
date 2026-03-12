import { NextResponse } from 'next/server';
import { WebClient, Block, KnownBlock } from '@slack/web-api';
import { readConfig, writeConfig } from '@/lib/config';
import { getMemberDigests } from '@/lib/memberDigests';
import { buildMemberSlackBlocks } from '@/lib/slack/memberFormatter';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
  // Verify the secret header
  const authHeader = request.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const scToken = process.env.SHORTCUT_API_TOKEN;
  const slackToken = process.env.SLACK_BOT_TOKEN;
  if (!scToken || !slackToken) {
    return NextResponse.json({ error: 'Missing API tokens' }, { status: 500 });
  }

  const [config, digests] = await Promise.all([
    readConfig(),
    getMemberDigests(scToken),
  ]);

  const memberMappings = config.memberMappings ?? {};
  const optedInIds = Object.entries(memberMappings)
    .filter(([, mc]) => mc.optedIn && mc.slackUserId)
    .map(([id]) => id);

  if (optedInIds.length === 0) {
    return NextResponse.json({ message: 'No opted-in members', sent: 0 });
  }

  const slack = new WebClient(slackToken);
  const results: { memberId: string; success: boolean; error?: string }[] = [];

  for (const memberId of optedInIds) {
    const memberConfig = memberMappings[memberId];
    const digest = digests.find((d) => d.id === memberId);
    if (!digest) {
      results.push({ memberId, success: false, error: 'No digest data' });
      continue;
    }

    try {
      const blocks = buildMemberSlackBlocks(digest);
      await slack.chat.postMessage({
        channel: memberConfig.slackUserId,
        text: `${digest.name} — Personal Task Digest`,
        blocks: blocks as (Block | KnownBlock)[],
        unfurl_links: false,
        unfurl_media: false,
      });

      config.memberMappings = {
        ...config.memberMappings,
        [memberId]: { ...memberConfig, lastSentAt: new Date().toISOString() },
      };

      results.push({ memberId, success: true });
    } catch (err: unknown) {
      results.push({ memberId, success: false, error: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  await writeConfig(config);

  const sent = results.filter((r) => r.success).length;
  console.log(`[cron:members] Sent ${sent}/${optedInIds.length} member digests`);
  return NextResponse.json({ sent, total: optedInIds.length, results });
}
