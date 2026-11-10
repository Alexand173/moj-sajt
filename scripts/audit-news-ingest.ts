import { loadEnvConfig } from '@next/env';
import { NEWS_REGION_QUERIES } from '../lib/news-regions';
import { assessNewsRelevance } from '../lib/news-relevance';

loadEnvConfig(process.cwd());

/**
 * Replays the LATEST ingest query against the live NewsAPI response and reports
 * what the relevance gate would keep, per region. Read-only: nothing is stored.
 *
 *   npm run news:audit-ingest
 *
 * The table alone cannot answer "is the gate starving the feed?", because rows
 * that were rejected never reached it. This asks the provider directly, so a
 * silent ingest failure and an over-strict gate can be told apart.
 */

const PAGE_SIZE = 100;

interface LiveArticle {
  title?: string | null;
  description?: string | null;
  content?: string | null;
  url?: string | null;
  publishedAt?: string | null;
}

async function main(): Promise<void> {
  const apiKey = process.env.NEWS_API_KEY?.trim();
  if (!apiKey) throw new Error('Missing NEWS_API_KEY.');

  const results = await Promise.all(NEWS_REGION_QUERIES.map(async ({ region, query }) => {
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}`
      + `&language=en&pageSize=${PAGE_SIZE}&sortBy=publishedAt&apiKey=${apiKey}`;

    const response = await fetch(url, { cache: 'no-store' });
    const payload = (await response.json().catch(() => null)) as {
      status?: string;
      code?: string;
      message?: string;
      totalResults?: number;
      articles?: LiveArticle[];
    } | null;

    if (!response.ok || payload?.status === 'error' || !payload?.articles) {
      return {
        region,
        httpStatus: response.status,
        error: payload?.code || payload?.message || `HTTP ${response.status}`,
        fetched: 0,
        kept: 0,
        daysOld: 0,
        rejections: [] as string[],
      };
    }

    const now = Date.now();
    const rejected: string[] = [];
    let kept = 0;
    let freshestAge = 0;

    for (const article of payload.articles) {
      const ageMs = article.publishedAt ? now - new Date(article.publishedAt).getTime() : 0;
      freshestAge = Math.max(freshestAge, ageMs);

      const verdict = assessNewsRelevance({
        title: article.title,
        excerpt: article.description,
        content: article.content,
      }, 'news-api');

      if (verdict.relevant) {
        kept += 1;
      } else {
        rejected.push(
          `${String(article.title || '').slice(0, 70)} <${verdict.hardBlock
            || `${verdict.musicScore}/${verdict.offTopicScore}`}>`,
        );
      }
    }

    return {
      region,
      httpStatus: response.status,
      totalResults: payload.totalResults,
      fetched: payload.articles.length,
      kept,
      freshestAgeHours: Math.round(freshestAge / 3_600_000),
      rejections: rejected.slice(0, 4),
    };
  }));

  console.log(JSON.stringify({ event: 'news_ingest_audit', at: new Date().toISOString(), results }, null, 2));

  const totalFetched = results.reduce((sum, result) => sum + result.fetched, 0);
  const totalKept = results.reduce((sum, result) => sum + result.kept, 0);
  console.log(`\nKept ${totalKept}/${totalFetched} live LATEST articles across ${results.length} regions.`);
}

main().catch((error: unknown) => {
  console.error('Ingest audit failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
