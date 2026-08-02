import { NextResponse } from 'next/server';
import { runNewsAiWorker } from '@/lib/news-ai-worker';

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
    const result = await runNewsAiWorker();

    if (!result.configured) {
      return NextResponse.json(
        {
          success: false,
          error: 'News AI worker is not configured.',
          missing: result.missing,
          ai: result,
        },
        { status: 503 },
      );
    }

    return NextResponse.json({ success: true, ai: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown news AI worker error.';
    console.error('News AI worker route failed:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
