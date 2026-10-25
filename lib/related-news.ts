import type { SupabaseClient } from '@supabase/supabase-js';

export interface RelatedNewsItem {
  id: string | number;
  title: string | null;
  image: string | null;
  region: string | null;
}

const RELATED_NEWS_SELECT = 'id, title, image, region';
const RELATED_NEWS_LIMIT = 3;
const TOPIC_TOKEN_LIMIT = 2;

/** Leading words that are grammar, not part of a name. */
const SKIPPED_LEADING = new Set([
  'a', 'an', 'analysis', 'breaking', 'exclusive', 'here', 'how', 'inside', 'interview', 'listen',
  'now', 'opinion', 'photos', 'read', 'review', 'the', 'these', 'this', 'those', 'that', 'video',
  'watch', 'what', 'when', 'where', 'who', 'why',
]);

/** Words that follow a name in a headline and are never part of it. */
const TOPIC_STOP_WORDS = new Set([
  'adds', 'announce', 'announced', 'announces', 'announcing', 'back', 'brings', 'cancel', 'cancels',
  'celebrate', 'celebrates', 'confirm', 'confirms', 'cover', 'covers', 'debut', 'debuts', 'drops',
  'enters', 'extends', 'faces', 'featured', 'gets', 'heads', 'hits', 'is', 'joins', 'launch',
  'launches', 'leaves', 'makes', 'names', 'opens', 'posthumously', 'postpones', 'pulls', 'quits',
  'reacts', 'releases', 'returns', 'reveals', 'says', 'set', 'sets', 'shares', 'slams', 'takes',
  'teams', 'teases', 'tells', 'unveils', 'urges', 'walks', 'wins',
]);

/**
 * Extracts the artist/topic tokens a headline is about, most specific first.
 * Handles sentence case, all caps, and headlines where the name follows a colon
 * ("Festival recap: Tatiana Huezos takes the top prize").
 */
export function extractNewsTopic(title: string | null | undefined): string[] {
  const cleaned = (title || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];

  const segments = cleaned.includes(':')
    ? [...cleaned.split(':').slice(1), cleaned]
    : [cleaned];

  for (const segment of segments) {
    const tokens = segment.trim().split(' ').filter(Boolean);
    const names: string[] = [];

    for (const rawToken of tokens) {
      const token = rawToken.replace(/^[^A-Za-z0-9]+/, '').replace(/[,;:.]+$/, '');
      if (!token) break;

      const normalized = token.replace(/[.'’-]+$/, '').toLowerCase();

      if (names.length === 0 && SKIPPED_LEADING.has(normalized)) continue;
      if (!/^[A-Z0-9]/.test(token) || TOPIC_STOP_WORDS.has(normalized)) break;

      // "Lily Allen's …" should search for "Lily Allen", not the possessive.
      names.push(token.replace(/['’]s$/u, ''));
      if (names.length === TOPIC_TOKEN_LIMIT) break;
    }

    if (names.length > 0) return names;
  }

  return [];
}

function buildSearchPhrases(topic: string[]): string[] {
  const phrases: string[] = [];
  if (topic.length > 1) phrases.push(topic.join(' '));
  if (topic.length > 0) phrases.push(topic[0]);

  return phrases.filter((phrase, index) => phrases.indexOf(phrase) === index);
}

function tidyRows(rows: Array<Record<string, unknown>> | null): RelatedNewsItem[] {
  return (rows || [])
    .map((row) => ({
      id: row.id as string | number,
      title: (row.title as string | null) ?? null,
      image: (row.image as string | null) ?? null,
      region: (row.region as string | null) ?? null,
    }))
    .filter((item) => Boolean(item.title?.trim()));
}

/**
 * Loads related stories for an article: first other coverage that names the
 * same artist in the headline, then the region feed as a last resort.
 */
export async function getRelatedNews(
  supabase: SupabaseClient | null,
  options: { id: string; title: string | null | undefined; region: string },
): Promise<RelatedNewsItem[]> {
  if (!supabase) return [];

  const phrases = buildSearchPhrases(extractNewsTopic(options.title));
  let best: RelatedNewsItem[] = [];

  for (const phrase of phrases) {
    const { data, error } = await supabase
      .from('news')
      .select(RELATED_NEWS_SELECT)
      .neq('id', options.id)
      .ilike('title', `%${phrase}%`)
      .order('created_at', { ascending: false })
      .limit(RELATED_NEWS_LIMIT);

    if (error) continue;

    const rows = tidyRows(data as Array<Record<string, unknown>> | null);
    if (rows.length >= 2) return rows;
    if (rows.length > best.length) best = rows;
  }

  if (best.length > 0) return best;

  const { data, error } = await supabase
    .from('news')
    .select(RELATED_NEWS_SELECT)
    .neq('id', options.id)
    .eq('region', options.region)
    .order('created_at', { ascending: false })
    .limit(RELATED_NEWS_LIMIT);

  if (error) return [];

  return tidyRows(data as Array<Record<string, unknown>> | null);
}
