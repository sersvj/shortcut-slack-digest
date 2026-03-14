import { NextResponse } from 'next/server';
import { auth } from '@/auth';

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

// Cashboard person lookup — current_user.id is in /account.json
async function findCashboardPersonId(): Promise<number | null> {
  try {
    const res = await fetch('https://api.cashboardapp.com/account.json', {
      headers: cbHeaders(),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.current_user?.id ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ allowed: false });
  }

  const { email } = session.user;
  const myEmail = process.env.MY_SLACK_EMAIL;

  // Check email match — also accept name-based fallback so you can see what's in session
  const emailMatches = !!myEmail && email === myEmail;

  if (!emailMatches) {
    return NextResponse.json({ allowed: false });
  }

  const personId = await findCashboardPersonId();

  return NextResponse.json({ allowed: true, personId });
}
