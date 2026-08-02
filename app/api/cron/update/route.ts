import { NextResponse } from 'next/server';
import { updateMusicCharts } from '@/lib/auto-updater';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) return process.env.NODE_ENV !== 'production';
  return request.headers.get('authorization') === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    await updateMusicCharts();
    return NextResponse.json({ success: true, message: 'Music charts successfully updated.' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown chart sync error.';
    console.error('Chart sync cron failed:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}