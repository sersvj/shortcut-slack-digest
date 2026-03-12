import { NextResponse } from 'next/server';
import { WebClient, Block, KnownBlock } from '@slack/web-api';
import { readConfig, writeConfig } from '@/lib/config';
import { getMemberDigests } from '@/lib/memberDigests';
import { buildMemberSlackBlocks } from '@/lib/slack/memberFormatter';

export async function POST(request: Request) {
  const scToken = process.env.SHORTCUT_API_TOKEN;
  const slackToken = process.env.SLACK_BOT_TOKEN;
  if (!scToken || !slackToken) {
    return NextResponse.json({ error: 'Missing API tokens' }, { status: 500 });
  }

  const body = await request.json();
  const { memberIds } = body as { memberIds: string[] };

  const [config, digests] = await Promise.all([
    readConfig(),
    getMemberDigests(scToken),
  ]);

  const slack = new WebClient(slackToken);
  const results: { memberId: string; success: boolean; error?: string }[] = [];

  for (const memberId of memberIds) {
    const memberConfig = config.memberMappings?.[memberId];
    if (!memberConfig?.slackUserId) {
      results.push({ memberId, success: false, error: 'No Slack user mapped' });
      continue;
    }

    const digest = digests.find((d) => d.id === memberId);
    if (!digest) {
      results.push({ memberId, success: false, error: 'No digest data found' });
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
  return NextResponse.json({ results });
}
