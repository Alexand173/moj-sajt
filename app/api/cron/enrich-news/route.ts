import { NextResponse } from 'next/server';
import { runNewsAiWorker } from '@/lib/news-ai-worker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/**
 * A run now loops batches inside one invocation, so it needs the full ceiling.
 * Vercel allows 300s on Hobby and Pro alike with fluid compute; the worker stops
 * itself at 270s so the summary still has time to leave.
 */
export const maxDuration = 300;

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
    // `?scope=official` spends the whole run on the scraped publisher rows that
    // feed the official brief reader.
    const scope = new URL(request.url).searchParams.get('scope');
    const result = await runNewsAiWorker(undefined, scope === 'official' ? { officialOnly: true } : {});

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
