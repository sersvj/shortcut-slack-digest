import { NextResponse } from 'next/server';

export async function GET() {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'Missing SLACK_BOT_TOKEN' }, { status: 500 });
  }

  // Fetch all non-bot, non-deleted workspace members
  const res = await fetch('https://slack.com/api/users.list', {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!res.ok) {
    return NextResponse.json({ error: 'Failed to fetch Slack users' }, { status: 502 });
  }

  const data = await res.json();
  if (!data.ok) {
    return NextResponse.json({ error: data.error || 'Slack API error' }, { status: 502 });
  }

  const users = (data.members as any[])
    .filter((m) => !m.is_bot && !m.deleted && m.id !== 'USLACKBOT')
    .map((m) => ({
      id: m.id as string,
      name: (m.real_name || m.name) as string,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json(users);
}
