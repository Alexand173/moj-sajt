import { NextResponse } from 'next/server';
import { GET as fetchLatestNews } from '../../fetch-news/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) return process.env.NODE_ENV !== 'production';
  return request.headers.get('authorization') === `Bearer ${cronSecret}`;
}

/**
 * Keep the legacy cron URL on the same implementation as the GitHub Actions
 * entry point. The previous handler used a hard-coded Taylor Swift/Metallica/
 * Drake query and could never produce a reliable UK feed.
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    return await fetchLatestNews();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown news sync error.';
    console.error('News fetch cron failed:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
