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

interface TimeEntryPayload {
  line_item_id: number;
  person_id: number;
  minutes: number;
  description: string;
  date: string; // YYYY-MM-DD
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.email !== process.env.MY_SLACK_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body: TimeEntryPayload = await req.json();
  const { line_item_id, person_id, minutes, description, date } = body;

  if (!line_item_id || !person_id || !minutes || !date) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Cashboard accepts "date" as the primary way to set the entry's day.
  // Including both can help ensure it's set correctly.
  const payload = {
    time_entry: {
      line_item_id,
      person_id,
      minutes,
      description,
      date,
      created_on: date,
    },
  };

  const res = await fetch('https://api.cashboardapp.com/time_entries.json', {
    method: 'POST',
    headers: cbHeaders(),
    body: JSON.stringify(payload),
  });

  const responseText = await res.text();

  if (!res.ok) {
    // Try alternate field name "created_on" if first attempt fails
    if (res.status === 400 || res.status === 422) {
      const altPayload = {
        time_entry: {
          line_item_id,
          person_id,
          minutes,
          description,
          created_on: date,
        },
      };
      const altRes = await fetch('https://api.cashboardapp.com/time_entries.json', {
        method: 'POST',
        headers: cbHeaders(),
        body: JSON.stringify(altPayload),
      });
      if (altRes.ok) {
        const altData = await altRes.text();
        try { return NextResponse.json(JSON.parse(altData), { status: 201 }); }
        catch { return NextResponse.json({ ok: true }, { status: 201 }); }
      }
    }
    return NextResponse.json(
      { error: `Cashboard error ${res.status}`, detail: responseText },
      { status: 502 }
    );
  }

  try {
    return NextResponse.json(JSON.parse(responseText), { status: 201 });
  } catch {
    return NextResponse.json({ ok: true }, { status: 201 });
  }
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.email !== process.env.MY_SLACK_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const personId = searchParams.get('person_id');
  
  if (!personId) {
    return NextResponse.json({ error: 'Missing person_id' }, { status: 400 });
  }

  // Fetch entries from the last 14 days by default to keep it snappy
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 14);
  const startDateStr = startDate.toISOString().split('T')[0];

  const url = `https://api.cashboardapp.com/time_entries.json?person_id=${personId}&start_date=${startDateStr}`;
  
  const res = await fetch(url, {
    headers: cbHeaders(),
    cache: 'no-store',
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: `Cashboard error ${res.status}` },
      { status: 502 }
    );
  }

  const data = await res.json();
  return NextResponse.json(data);
}
