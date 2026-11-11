import { loadEnvConfig } from '@next/env';
import * as cheerio from 'cheerio';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import {
  getNewsDailyPerRegion,
  loadRecentCountByRegion,
  remainingQuotaByRegion,
  takeWithinQuota,
} from '../../../lib/news-balance';
import { normalizeNewsRegion } from '../../../lib/news-regions';
import { isMusicNews } from '../../../lib/news-relevance';
import { OFFICIAL_NEWS_SOURCES } from '../../../lib/news-sources';

const isDirectScript = typeof require !== 'undefined' && require.main === module;
if (isDirectScript) {
  loadEnvConfig(process.cwd());
}

// 1. INICIJALIZACIJA (Podržava i lokalni razvoj i GitHub Actions)
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ ERROR: Nedostaju Supabase URL ili KEY!");
}

// A missing key must never crash the whole job — fall back to a null client and
// skip persistence instead of throwing when .from() is eventually called.
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const SOURCE_TIMEOUT_MS = 15_000;
const UPSERT_CHUNK_SIZE = 50;
const MAX_OFFICIAL_ARTICLES_PER_REGION = 30;

type UpsertResult = {
  inserted: number;
  failedChunks: number;
  failedRows: number;
  skippedConflicts: number;
};

function isUniqueConstraintError(error: unknown): boolean {
  const candidate = error as { code?: string; message?: string } | null;
  const message = candidate?.message || String(error);
  return candidate?.code === '23505' || message.includes('duplicate key') || message.includes('unique constraint');
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null) return JSON.stringify(error);
  return String(error);
}

interface ScrapedArticle {
  title: string;
  excerpt: string;
  image: string;
  category: string;
  region: string;
  url: string;
  content: string;
  created_at: string;
}

interface NewsSource {
  url: string;
  region: string;
}

/**
 * Scrapes a single source. Any network, parsing, or unexpected error is caught
 * here so one bad site can never abort the loop or fail the whole job.
 */
async function scrapeSource(source: NewsSource, scrapedData: ScrapedArticle[]): Promise<boolean> {
  try {
    const res = await axios.get(source.url, {
      timeout: SOURCE_TIMEOUT_MS,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    const $ = cheerio.load(res.data);
    const domainName = new URL(source.url).hostname.replace('www.', '');
    let countPerSite = 0;
    let skippedOffTopic = 0;

    $('h2, h3').toArray().some((el) => {
      if (countPerSite >= 3) return true;

      const title = $(el).text().trim();
      const link = $(el).find('a').attr('href') || $(el).closest('a').attr('href');

      if (title.length > 25 && link) {
        // Even a music source carries the occasional off-topic piece. Rewriting
        // one costs an AI call and publishes it under MusicTop's byline, so it is
        // cheaper to drop it here than to fix it later.
        if (!isMusicNews({ title }, 'music-publication')) {
          skippedOffTopic += 1;
          return false;
        }

        // Resolved against the source URL, not concatenated: protocol-relative
        // hrefs ("//host/path") used to become "https://host//host/path", which
        // produced hosts like "www.classical-music.comnews" — rows that can
        // never be fetched, so they could never be rewritten.
        let fullLink: string;
        try {
          fullLink = new URL(link, source.url).toString();
        } catch {
          return false;
        }

        scrapedData.push({
          title,
          excerpt: `SOURCE: ${domainName.toUpperCase()}`,
          image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745',
          category: 'OFFICIAL',
          region: normalizeNewsRegion(source.region),
          url: fullLink,
          content: `Music update from ${domainName}`,
          created_at: new Date().toISOString(),
        });

        countPerSite++;
      }
      return false;
    });

    console.log(`✅ ${domainName} - uspeh (${countPerSite} stavki, ${skippedOffTopic} preskočeno kao ne-muzika).`);
    return true;
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`❌ Greška za ${source.url}: ${message}`);
    return false;
  }
}

/**
 * Upserts scraped articles in small chunks. A malformed row or a transient
 * Supabase error in one chunk is logged and skipped instead of discarding
 * every other successfully scraped article in the batch.
 */
async function upsertInChunks(mixedData: ScrapedArticle[]): Promise<UpsertResult> {
  if (!supabase) {
    console.error('❌ Supabase klijent nije konfigurisan — preskačem upis.');
    return { inserted: 0, failedChunks: 1, failedRows: mixedData.length, skippedConflicts: 0 };
  }

  let inserted = 0;
  let failedChunks = 0;
  let failedRows = 0;
  let skippedConflicts = 0;

  for (let i = 0; i < mixedData.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = mixedData.slice(i, i + UPSERT_CHUNK_SIZE);
    try {
      const { error } = await supabase.from('news').upsert(chunk, {
        onConflict: 'url',
        ignoreDuplicates: true,
      });

      if (error) throw error;
      inserted += chunk.length;
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        let chunkInserted = 0;
        for (const row of chunk) {
          const { error: rowError } = await supabase.from('news').upsert(row, {
            onConflict: 'url',
            ignoreDuplicates: true,
          });

          if (!rowError) {
            chunkInserted += 1;
          } else if (isUniqueConstraintError(rowError)) {
            skippedConflicts += 1;
          } else {
            failedRows += 1;
            console.error(`❌ Neuspešan upis vesti "${row.title}": ${formatError(rowError)}`);
          }
        }
        inserted += chunkInserted;
        continue;
      }

      failedChunks += 1;
      failedRows += chunk.length;
      console.error(`❌ Neuspešan upis grupe (${chunk.length} stavki): ${formatError(error)}`);
    }
  }

  return { inserted, failedChunks, failedRows, skippedConflicts };
}

/**
 * The scrape itself, separated from its entry point.
 *
 * Two callers share this work: the HTTP route below, which is guarded, and the
 * GitHub Actions run that executes this file directly (`isDirectScript`). Keeping
 * the body out of `GET` is what lets the guard exist without breaking the
 * workflow — and without the workflow having to send a secret it never needed.
 */
async function runScraper(): Promise<Response> {
  console.log("🚀 Startujem Official Scraper (100+ sajtova)...");

  try {
    const scrapedData: ScrapedArticle[] = [];

    // DEFINICIJA IZVORA
    // One registry, shared with the relevance gate and the region resolver:
    // the scraper decides what to fetch, the gate decides how far to trust it.
    const SOURCES: NewsSource[] = OFFICIAL_NEWS_SOURCES;

    // SKREPING PETLJA — jedan loš sajt se hvata unutar scrapeSource() i nikad ne prekida petlju.
    let succeededSources = 0;
    let failedSources = 0;

    for (const source of SOURCES) {
      const ok = await scrapeSource(source, scrapedData);
      if (ok) succeededSources++;
      else failedSources++;
    }

    let insertedCount = 0;
    let failedUpsertChunks = 0;
    let failedUpsertRows = 0;
    let skippedConflicts = 0;
    let balancedCount = 0;
    let quotaDropped = 0;
    let balancedRegionCounts: Record<string, number> = {};

    if (scrapedData.length > 0) {
      // Keep the same title from different publishers/regions when the source URLs differ.
      const uniqueData = Array.from(new Map(scrapedData.map(item => [item.url, item])).values());
      const mixedData = uniqueData.sort(() => Math.random() - 0.5);

      // Each region spends the same daily allowance the NewsAPI path uses, so the
      // two sources stay balanced instead of the scraper flooding the table with
      // one region's output.
      const regions = [...new Set(mixedData.map((article) => normalizeNewsRegion(article.region)))];
      const dailyTarget = getNewsDailyPerRegion();
      let remaining: Record<string, number>;

      try {
        if (!supabase) throw new Error('Supabase is not configured.');
        const recentCounts = await loadRecentCountByRegion(supabase, 'OFFICIAL');
        remaining = remainingQuotaByRegion(recentCounts, regions, dailyTarget);
      } catch (error) {
        // Losing the count must not lose the scrape: fall back to the per-region
        // cap so the day is still bounded, just less precisely.
        console.warn("Could not read today's OFFICIAL counts; using the per-run cap:", error);
        remaining = Object.fromEntries(regions.map((region) => [region, dailyTarget]));
      }

      // One trimming rule for both ingest paths, so a change to the quota policy
      // cannot apply to LATEST and silently miss the scraper.
      const perRegionAllowance: Record<string, number> = {};
      for (const region of regions) {
        perRegionAllowance[region] = Math.min(MAX_OFFICIAL_ARTICLES_PER_REGION, remaining[region] ?? 0);
      }

      const { kept: balancedData, dropped } = takeWithinQuota(
        mixedData,
        (article) => article.region,
        perRegionAllowance,
      );

      quotaDropped = Object.values(dropped).reduce((total, count) => total + count, 0);
      balancedCount = balancedData.length;
      balancedRegionCounts = balancedData.reduce<Record<string, number>>((counts, article) => {
        const region = normalizeNewsRegion(article.region);
        counts[region] = (counts[region] || 0) + 1;
        return counts;
      }, {});
      const upsertResult = await upsertInChunks(balancedData);
      insertedCount = upsertResult.inserted;
      failedUpsertChunks = upsertResult.failedChunks;
      failedUpsertRows = upsertResult.failedRows;
      skippedConflicts = upsertResult.skippedConflicts;
      console.log(`🚀 Uspešno uneto ${insertedCount}/${mixedData.length} vesti (${failedUpsertChunks} neuspešnih grupa, ${failedUpsertRows} neuspešnih redova, ${skippedConflicts} postojećih konflikata).`);
    }

    console.log(`ℹ️ Skrejping završen: ${succeededSources}/${SOURCES.length} sajtova uspešno, ${failedSources} neuspešno.`);
    console.log('ℹ️ Official source links synchronized. Pending OFFICIAL rows receive the same AI rewrite and similarity gate as LATEST news.');

    // Always resolve with 200 so a partial failure (some sources or one upsert
    // chunk) never fails the GitHub Actions step or blocks the next steps.
    return new Response(JSON.stringify({
      success: true,
      sources: { succeeded: succeededSources, failed: failedSources, total: SOURCES.length },
      count: insertedCount,
      scrapedCount: scrapedData.length,
      balancedCount,
      quotaDropped,
      regionCounts: balancedRegionCounts,
      failedUpsertChunks,
      failedUpsertRows,
      skippedConflicts,
      message: 'Official source links synchronized. Pending OFFICIAL rows receive the same AI rewrite and similarity gate as LATEST news.',
    }), { status: 200 });

  } catch (error: unknown) {
    // Only a truly unexpected error (outside the per-source and per-chunk
    // safety nets above) lands here. Still return 200 with success:false so
    // the CLI wrapper below doesn't mark the whole job as failed.
    const message = error instanceof Error ? error.message : String(error);
    console.error("Scraper Error:", message);
    return new Response(JSON.stringify({ success: false, error: message }), { status: 200 });
  }
}

/**
 * Header check for the HTTP entry point, identical to the one the cron routes use.
 *
 * The route was the only ingest endpoint anyone could call: a visitor could
 * trigger 140 scrapes, spend the day's per-region quota and write rows. The same
 * `CRON_SECRET` the other cron routes already honour closes it, and an unset
 * secret stays permissive outside production so local runs are unaffected.
 */
function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) return process.env.NODE_ENV !== 'production';
  return request.headers.get('authorization') === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized.' }), { status: 401 });
  }

  return runScraper();
}

// OKIDAČ ZA GITHUB ACTIONS (Van GET funkcije)
if (isDirectScript) {
  console.log("🔔 GitHub Actions detektovan. Ručno pokrećem Official Scraper...");
  runScraper()
    .then(async (res) => {
      const data = await res.json() as {
        success?: boolean;
        failedUpsertChunks?: number;
        failedUpsertRows?: number;
      };
      const hasPersistenceFailures = (data.failedUpsertChunks || 0) > 0 || (data.failedUpsertRows || 0) > 0;

      if (res.ok && data.success !== false && !hasPersistenceFailures) {
        console.log("🏁 Završeno uspešno!", data);
        process.exitCode = 0;
      } else {
        console.error("❌ Završeno sa greškom!", data);
        process.exitCode = 1;
      }
    })
    .catch((err) => {
      console.error("💀 Kritična greška:", err);
      process.exitCode = 1;
    });
}
