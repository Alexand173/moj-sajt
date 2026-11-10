import { NextResponse } from 'next/server';
import { createOfficialNewsBrief } from '@/lib/official-news-brief';
import { hasRecordedSource } from '@/lib/news-publication';
import { getPublicSupabaseClient } from '@/lib/supabase-public';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BRIEF_COLUMNS = 'id, title, excerpt, url, category, created_at, ai_content, ai_generated, ai_status, ai_similarity_score';

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id')?.trim();

  if (!id) return jsonError('A news id is required.', 400);

  const supabase = getPublicSupabaseClient();
  if (!supabase) return jsonError('News is unavailable right now.', 503);

  try {
    const { data, error } = await supabase
      .from('news')
      .select(BRIEF_COLUMNS)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.warn(`Could not load the official news brief ${id}:`, error.message);
      return jsonError('Could not load this story.', 502);
    }

    if (!data) return jsonError('Story not found.', 404);

    /**
     * The inline reader must refuse exactly what the feed refuses. Without this,
     * a source-less row is invisible in every list yet still readable by anyone
     * holding its id — which is how 985 unattributed stories stayed reachable
     * after their pages started returning 404.
     */
    if (!hasRecordedSource(data) || data.ai_status === 'skipped') {
      return jsonError('Story not found.', 404);
    }

    return NextResponse.json(createOfficialNewsBrief(data), {
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.warn(`Official news brief ${id} failed:`, error);
    return jsonError('Could not load this story.', 502);
  }
}
