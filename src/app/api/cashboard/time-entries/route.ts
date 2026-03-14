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

  // Cashboard accepts both "created_on" and "date" — try "date" first per their REST conventions
  const payload = {
    time_entry: {
      line_item_id,
      person_id,
      minutes,
      description,
      date,
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
