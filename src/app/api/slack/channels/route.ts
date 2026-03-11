import { NextResponse } from 'next/server';
import { WebClient } from '@slack/web-api';

export async function GET() {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'Missing SLACK_BOT_TOKEN' }, { status: 500 });
  }

  const client = new WebClient(token);
  const channels: { id: string; name: string }[] = [];

  try {
    // Fetch public channels
    let cursor: string | undefined;
    do {
      const result = await client.conversations.list({
        types: 'public_channel,private_channel',
        limit: 200,
        cursor,
        exclude_archived: true,
      });

      for (const ch of result.channels || []) {
        if (ch.id && ch.name) {
          channels.push({ id: ch.id, name: `#${ch.name}` });
        }
      }

      cursor = result.response_metadata?.next_cursor || undefined;
    } while (cursor);

    channels.sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json(channels);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Slack API error' }, { status: 502 });
  }
}
