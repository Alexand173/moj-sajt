import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { enrichPendingNews } from '../../../lib/news-ai-enrichment';
import { NEWS_REGION_QUERIES, type NewsRegion } from '../../../lib/news-regions';

// Inicijalizacija Supabase klijenta
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
// Koristimo SERVICE_ROLE_KEY za pisanje; ne izlažemo ga klijentu.
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
      },
    })
  : null;

interface NewsApiArticle {
  title?: string | null;
  description?: string | null;
  content?: string | null;
  urlToImage?: string | null;
  url?: string | null;
  publishedAt?: string | null;
  source?: { name?: string | null } | null;
}

interface NewsRecord {
  title: string;
  excerpt: string;
  content: string;
  image: string;
  url: string | null;
  category: string;
  region: NewsRegion;
  created_at: string;
  ai_status: 'pending';
}

interface NewsFetchResult {
  region: NewsRegion;
  articles: NewsRecord[];
  failed: boolean;
}

const NEWS_API_PAGE_SIZE = 100;
const MAX_ARTICLES_PER_REGION = 20;
const IDENTITY_LOOKUP_CHUNK_SIZE = 20;

type NewsIdentityColumn = 'title' | 'url';
type ExistingNewsRow = { id: string | number; title: string; url: string | null };

const MUSIC_KEYWORDS = [
  'music', 'concert', 'album', 'band', 'song', 'artist', 
  'tour', 'festival', 'singer', 'guitarist','drummer','rock band','metal band', 'dj', 'track', 'lyrics', 'kpop', 'jazz', 'reggaeton'
];

function isMusicRelated(title: string, description: string): boolean {
  const text = `${title} ${description}`.toLowerCase();
  return MUSIC_KEYWORDS.some(keyword => text.includes(keyword));
}

async function loadExistingNewsRows(
  client: SupabaseClient,
  column: NewsIdentityColumn,
  values: string[],
): Promise<ExistingNewsRow[]> {
  const rows: ExistingNewsRow[] = [];

  for (let start = 0; start < values.length; start += IDENTITY_LOOKUP_CHUNK_SIZE) {
    const chunk = values.slice(start, start + IDENTITY_LOOKUP_CHUNK_SIZE);
    const { data, error } = await client
      .from('news')
      .select('id, title, url')
      .in(column, chunk);

    if (error) throw new Error(`Could not check existing news ${column}s: ${error.message}`);
    rows.push(...((data || []) as ExistingNewsRow[]));
  }

  return rows;
}

async function fetchNews(query: string, region: NewsRegion, apiKey: string): Promise<NewsFetchResult> {
  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&pageSize=${NEWS_API_PAGE_SIZE}&sortBy=publishedAt&apiKey=${apiKey}`;

  try {
    const res = await fetch(url);
    const data = (await res.json()) as {
      status?: string;
      message?: string;
      articles?: NewsApiArticle[];
    };

    if (!res.ok || data.status === 'error') {
      console.error(`❌ News API error for region [${region}]: ${data.message || res.statusText || 'Unknown error'}`);
      return { region, articles: [], failed: true };
    }

    if (!data.articles || data.articles.length === 0) {
      console.log(`⚠️ No News API articles for region: ${region}`);
      return { region, articles: [], failed: false };
    }

    const filteredArticles = data.articles
      .filter((art) => {
        if (region === 'latino') return true;
        return isMusicRelated(art.title || '', art.description || '');
      })
      .slice(0, MAX_ARTICLES_PER_REGION);

    console.log(`📡 Fetched ${data.articles.length}, kept ${filteredArticles.length} music articles for region: ${region}`);

    return {
      region,
      failed: false,
      articles: filteredArticles.map((art) => ({
        title: art.title || 'No Title',
        excerpt: art.description || '',
        content: art.content || '',
        image: art.urlToImage || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745',
        url: art.url || null,
        category: 'LATEST',
        region,
        created_at: new Date(art.publishedAt || Date.now()).toISOString(),
        ai_status: 'pending',
      })),
    };
  } catch (error) {
    console.error(`❌ News API request failed for ${region}:`, error);
    return { region, articles: [], failed: true };
  }
}

export async function GET() {
  console.log("🚀 Startujem punjenje baze...");

  try {
    if (!supabase) {
      return new Response(JSON.stringify({ error: 'Missing Supabase server configuration.' }), { status: 500 });
    }

    const apiKey = process.env.NEWS_API_KEY;
    if (!apiKey) {
      throw new Error("Nedostaje NEWS_API_KEY u environment varijablama!");
    }

    const regionalResults = await Promise.all(
      NEWS_REGION_QUERIES.map(({ query, region }) => fetchNews(query, region, apiKey)),
    );
    const failedRegions = regionalResults.filter((result) => result.failed).map((result) => result.region);
    const allNews = regionalResults
      .flatMap((result) => result.articles)
      .filter((news) => news.title !== 'No Title');
    const regionCounts = Object.fromEntries(
      regionalResults.map((result) => [result.region, result.articles.length]),
    );

    console.log(`📊 Collected ${allNews.length} LATEST articles across ${NEWS_REGION_QUERIES.length} regions.`);
    if (failedRegions.length > 0) {
      console.error(`❌ News API failed for regions: ${failedRegions.join(', ')}`);
    }

    if (allNews.length === 0) {
      const aiSummary = await enrichPendingNews(supabase);
      const success = failedRegions.length === 0;
      return new Response(JSON.stringify({
        success,
        message: success ? 'No new LATEST articles found.' : 'One or more regional News API requests failed.',
        failedRegions,
        regions: regionCounts,
        ai: aiSummary,
      }), { status: success ? 200 : 502 });
    }

    // The news table has unique title and URL constraints. Deduplicate the batch
    // and skip URLs already owned by a different row before the title upsert.
    const seenTitles = new Set<string>();
    const seenUrls = new Set<string>();
    const uniqueNews = allNews.filter((news) => {
      if (seenTitles.has(news.title) || (news.url && seenUrls.has(news.url))) return false;
      seenTitles.add(news.title);
      if (news.url) seenUrls.add(news.url);
      return true;
    });
    const duplicateCount = allNews.length - uniqueNews.length;
    const titles = uniqueNews.map((news) => news.title);
    const urls = uniqueNews.flatMap((news) => news.url ? [news.url] : []);
    let existingTitleRows: ExistingNewsRow[];
    let existingUrlRows: ExistingNewsRow[];

    try {
      existingTitleRows = await loadExistingNewsRows(supabase, 'title', titles);
      existingUrlRows = await loadExistingNewsRows(supabase, 'url', urls);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("❌ Supabase identity lookup failed:", message);
      return new Response(JSON.stringify({ error: message }), { status: 500 });
    }

    const existingByTitle = new Map(
      existingTitleRows.map((row) => [row.title, row]),
    );
    const existingByUrl = new Map(
      existingUrlRows.filter((row) => row.url).map((row) => [row.url, row]),
    );
    const safeNews = uniqueNews.filter((news) => {
      if (!news.url) return true;
      const existingTitleRow = existingByTitle.get(news.title);
      const existingUrlRow = existingByUrl.get(news.url);
      return !existingUrlRow || existingUrlRow.id === existingTitleRow?.id;
    });
    const conflictsSkipped = uniqueNews.length - safeNews.length;

    if (safeNews.length > 0) {
      const { error: upsertError } = await supabase
        .from('news')
        .upsert(safeNews, {
          onConflict: 'title',
          ignoreDuplicates: true,
        });

      if (upsertError) {
        console.error("❌ Supabase Upsert Error:", upsertError.message);
        return new Response(JSON.stringify({ error: upsertError.message }), { status: 500 });
      }
    }

    const aiSummary = await enrichPendingNews(supabase);
    console.log("🤖 AI news enrichment:", aiSummary);
    console.log("✅ Baza je uspešno osvežena!");
    const success = failedRegions.length === 0;
    return new Response(JSON.stringify({
      success,
      count: uniqueNews.length,
      fetched: allNews.length,
      duplicatesSkipped: duplicateCount,
      conflictsSkipped,
      failedRegions,
      regions: regionCounts,
      ai: aiSummary,
      message: success
        ? 'LATEST news database updated.'
        : 'LATEST news partially updated; one or more regional requests failed.',
    }), { status: success ? 200 : 502 });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Nepoznata greška';
    console.error("❌ Kritična greška:", message);
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}

/** * KLJUČNI DEO ZA GITHUB ACTIONS:
 * Ovaj blok omogućava da 'npx tsx' direktno pokrene GET funkciju.
 */
if (typeof require !== 'undefined' && require.main === module) {
  console.log("🔔 Detektovano direktno pokretanje skripte (GitHub Actions)...");
  GET()
    .then(async (res) => {
      const data = await res.json();
      console.log("🏁 Završeno!", data);
      process.exitCode = res.ok ? 0 : 1;
    })
    .catch((err) => {
      console.error("💀 Skripta je pukla:", err);
      process.exitCode = 1;
    });
}