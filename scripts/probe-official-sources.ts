import { loadEnvConfig } from '@next/env';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { isMusicNews } from '../lib/news-relevance';

loadEnvConfig(process.cwd());

/**
 * Checks whether a list of publisher pages still yields scrapeable headlines.
 *
 *   npm run news:probe-sources -- https://example.com/news/ https://other.com/
 *
 * The scraper asks each page for `h2`/`h3` blocks with a link and a headline over
 * 25 characters, then applies the trusted-publication relevance policy. A source
 * that returns zero items is dead weight: WORLD had seven of them and received no
 * OFFICIAL rows at all for two weeks.
 */

const TIMEOUT_MS = 15_000;

async function probe(url: string): Promise<Record<string, unknown>> {
  try {
    const response = await axios.get(url, {
      timeout: TIMEOUT_MS,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    const $ = cheerio.load(response.data);
    const headlines: string[] = [];
    let offTopic = 0;

    $('h2, h3').toArray().forEach((element) => {
      if (headlines.length >= 3) return;

      const title = $(element).text().trim();
      const link = $(element).find('a').attr('href') || $(element).closest('a').attr('href');
      if (title.length <= 25 || !link) return;

      if (!isMusicNews({ title }, 'music-publication')) {
        offTopic += 1;
        return;
      }

      headlines.push(title.slice(0, 70));
    });

    return {
      url,
      ok: true,
      status: response.status,
      usable: headlines.length + offTopic,
      kept: headlines.length,
      offTopic,
      sample: headlines,
    };
  } catch (error) {
    return {
      url,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main(): Promise<void> {
  const urls = process.argv.slice(2).filter((value) => value.startsWith('http'));
  if (urls.length === 0) throw new Error('Pass one or more publisher URLs to probe.');

  const results: Array<Record<string, unknown>> = [];
  for (const url of urls) {
    results.push(await probe(url));
  }

  console.log(JSON.stringify({ event: 'official_source_probe', results }, null, 2));
}

main().catch((error: unknown) => {
  console.error('Source probe failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
