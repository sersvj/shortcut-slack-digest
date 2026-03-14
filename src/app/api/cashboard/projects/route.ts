import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCachedProjects, setCachedProjects } from '@/lib/cashboardCache';
import { CashboardProject } from '@/lib/types';

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

  const cached = forceRefresh ? null : await getCachedProjects();
  if (cached) return NextResponse.json(cached);

  const res = await fetch('https://api.cashboardapp.com/projects.json', {
    headers: cbHeaders(),
    cache: 'no-store',
  });

  if (!res.ok) {
    return NextResponse.json({ error: 'Failed to fetch Cashboard projects' }, { status: 502 });
  }

  const data = await res.json();
  const raw: Array<Record<string, unknown>> = Array.isArray(data) ? data : (data.projects ?? []);

  const projects: CashboardProject[] = raw
    .filter((p) => !p.is_archived && !p.is_complete)
    .map((p) => ({
      id: p.id as number,
      name: (p.name ?? p.title) as string,
      client_name: (p.client_name ?? p.company_name ?? p.company ?? null) as string | null,
    }));

  await setCachedProjects(projects);
  return NextResponse.json(projects);
}
