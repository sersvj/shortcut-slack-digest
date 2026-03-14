import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCachedLineItems, setCachedLineItems } from '@/lib/cashboardCache';
import { CashboardLineItem } from '@/lib/types';

function cbHeaders() {
  const creds = Buffer.from(
    `${process.env.CASHBOARD_SUBDOMAIN}:${process.env.CASHBOARD_API_KEY}`
  ).toString('base64');
  return {
    Authorization: `Basic ${creds}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.email !== process.env.MY_SLACK_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const forceRefresh = searchParams.get('refresh') === '1';

  const cached = forceRefresh ? null : await getCachedLineItems();
  if (cached) return NextResponse.json(cached);

  const res = await fetch('https://api.cashboardapp.com/line_items.json', {
    headers: cbHeaders(),
    cache: 'no-store',
  });

  if (!res.ok) {
    return NextResponse.json({ error: 'Failed to fetch Cashboard line items' }, { status: 502 });
  }

  const data = await res.json();
  const raw: Array<Record<string, unknown>> = Array.isArray(data) ? data : (data.line_items ?? []);

  const lineItems: CashboardLineItem[] = raw
    .filter((li) => !li.is_complete)
    .map((li) => ({
      id: li.id as number,
      name: li.title as string,   // Cashboard uses "title" not "name"
      project_id: li.project_id as number,
    }));

  await setCachedLineItems(lineItems);
  return NextResponse.json(lineItems);
}
