import { loadEnvConfig } from '@next/env';
import * as cheerio from 'cheerio';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { normalizeNewsRegion } from '../../../lib/news-regions';

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

    $('h2, h3').toArray().some((el) => {
      if (countPerSite >= 3) return true;

      const title = $(el).text().trim();
      const link = $(el).find('a').attr('href') || $(el).closest('a').attr('href');

      if (title.length > 25 && link) {
        const fullLink = link.startsWith('http') ? link : new URL(source.url).origin + link;

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

    console.log(`✅ ${domainName} - uspeh (${countPerSite} stavki).`);
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

export async function GET() {
  console.log("🚀 Startujem Official Scraper (100+ sajtova)...");

  try {
    const scrapedData: ScrapedArticle[] = [];

    // DEFINICIJA IZVORA
    const SOURCES: NewsSource[] = [
     { url: 'https://pitchfork.com/news/', region: 'US' },
  { url: 'https://www.rollingstone.com/music/music-news/', region: 'US' },
  { url: 'https://www.billboard.com/c/music/music-news/', region: 'US' },
  { url: 'https://www.spin.com/category/news/', region: 'US' },
  { url: 'https://hiphopdx.com/news', region: 'US' },
  { url: 'https://www.complex.com/music/', region: 'US' },
  { url: 'https://www.stereogum.com/category/news/', region: 'US' },
  { url: 'https://consequence.net/category/music/news/', region: 'US' },
  { url: 'https://www.hotnewhiphop.com/news/', region: 'US' },
  { url: 'https://www.revolvermag.com/news', region: 'US' }, // Metal/Rock
  { url: 'https://www.vibe.com/c/news/', region: 'US' }, // R&B/Hip-Hop
  { url: 'https://www.altpress.com/news/', region: 'US' }, // Alternative
  { url: 'https://www.dancingastronaut.com/news/', region: 'US' }, // EDM
  { url: 'https://www.relix.com/news/', region: 'US' }, // Jam/Rock
  { url: 'https://variety.com/c/music/news/', region: 'US' },
  { url: 'https://www.thefader.com/category/music', region: 'US' },
  { url: 'https://ultimateclassicrock.com/category/latest-news/', region: 'US' },
  { url: 'https://www.rap-up.com/category/news/', region: 'US' },
  { url: 'https://news.pollstar.com/category/top-stories/', region: 'US' }, // Tour news
  { url: 'https://www.magneticmag.com/category/news/', region: 'US' }, // Electronic

  // --- UK SOURCES (20 SAJTOVA) ---
  { url: 'https://www.nme.com/news/music', region: 'uk' },
  { url: 'https://www.clashmusic.com/news/', region: 'uk' },
  { url: 'https://www.thelineofbestfit.com/news', region: 'uk' },
  { url: 'https://diymag.com/news', region: 'uk' },
  { url: 'https://www.gigwise.com/news/', region: 'uk' },
  { url: 'https://mne.com/news/', region: 'UK' },
  { url: 'https://www.loudersound.com/news', region: 'uk' }, // Classic Rock/Metal UK
  { url: 'https://www.kerrang.com/feed', region: 'uk' }, // Rock/Punk
  { url: 'https://www.residentadvisor.net/news', region: 'uk' }, // Electronic (UK based)
  { url: 'https://www.mixmag.net/news', region: 'uk' }, // Dance/Club
  { url: 'https://www.thequietus.com/news/', region: 'uk' }, // Indie/Experimental
  { url: 'https://www.musicweek.com/news', region: 'uk' }, // Industry news
  { url: 'https://www.uncut.co.uk/news/', region: 'uk' }, // Classic Indie
  { url: 'https://www.clashmusic.com/category/news/uk-news/', region: 'uk' },
  { url: 'https://www.rocksins.com/category/news/', region: 'uk' },
  { url: 'https://www.standard.co.uk/culture/music', region: 'uk' }, // London based
  { url: 'https://www.theguardian.com/music/music+tone/news', region: 'uk' },
  { url: 'https://www.dorkmag.com/news/', region: 'uk' }, // Pop/Indie
  { url: 'https://www.beatportal.com/news/', region: 'uk' }, // Beatport UK news
  { url: 'https://www.list.co.uk/music/', region: 'uk' }, // Scottish/UK events
   // --- LATINO (20 SAJTOVA) ---
   { url: 'https://www.billboard.com/espanol', region: 'LATINO' },
{ url: 'https://www.los40.com', region: 'LATINO' },
{ url: 'https://www.ociolatino.com', region: 'LATINO' },
{ url: 'https://www.popelera.net', region: 'LATINO' },
{ url: 'https://www.latin-roll.com', region: 'LATINO' },
{ url: 'https://www.latinolife.co.uk', region: 'LATINO' },
{ url: 'https://www.global-pop-magazine.com', region: 'LATINO' },
{ url: 'https://www.radio-gladyspalmera.com', region: 'LATINO' },
{ url: 'https://worldmusicviews.com', region: 'LATINO' },
  { url: 'https://www.billboard.com/c/music/latin/', region: 'LATINO' },
  { url: 'https://remezcla.com/music/', region: 'LATINO' },
  { url: 'https://www.rollingstone.com/music/music-latin/', region: 'LATINO' },
  { url: 'https://www.latido.music/category/news/', region: 'LATINO' },
  { url: 'https://urbano.nyc/category/noticias/', region: 'LATINO' },
  { url: 'https://www.efe.com/efe/espana/cultura/latin-music/50000495', region: 'LATINO' },
  { url: 'https://www.billboard.com/espanol/musica/', region: 'LATINO' },
  { url: 'https://www.mondosonoro.com/noticias-musica-latina/', region: 'LATINO' },
  { url: 'https://www.shock.co/musica', region: 'LATINO' },
  { url: 'https://www.lacoope.net/musica/noticias', region: 'LATINO' },
  // ... dodaj slične za LATINO do 20

  // --- ASIA (K-POP, J-POP & MORE - 20 SAJTOVA) ---
  { url: 'https://www.soompi.com/category/music', region: 'ASIA' },
{ url: 'https://www.billboard-japan.com', region: 'ASIA' },
{ url: 'https://natalie.mu/music', region: 'ASIA' },
{ url: 'https://rockinon.com', region: 'ASIA' },
{ url: 'https://www.cdjournal.com', region: 'ASIA' },
{ url: 'http://www.izm.co.kr', region: 'ASIA' },
{ url: 'https://www.visla.kr', region: 'ASIA' },
{ url: 'https://music.bugs.co.kr', region: 'ASIA' },  // K-pop vijesti + chartovi
{ url: 'https://music.sohu.com', region: 'ASIA' },
{ url: 'https://music.douban.com', region: 'ASIA' },
{ url: 'https://y.qq.com', region: 'ASIA' },  // QQ Music – vijesti i top liste
{ url: 'https://www.musicbusinesschina.com', region: 'ASIA' },
  { url: 'https://www.soompi.com/category/music', region: 'ASIA' },
  { url: 'https://www.allkpop.com/category/news', region: 'ASIA' },
  { url: 'https://www.koreaboo.com/category/news/', region: 'ASIA' },
  { url: 'https://www.nme.com/en_asia/news/music', region: 'ASIA' },
  { url: 'https://www.bandwagon.asia/news', region: 'ASIA' },
  { url: 'https://aramajapan.com/', region: 'ASIA' },
  { url: 'https://www.tokyohive.com/', region: 'ASIA' },
  { url: 'https://www.sbs.com.au/popasia/blog', region: 'ASIA' },
  { url: 'https://koreajoongangdaily.joins.com/section/entertainment', region: 'ASIA' },
  { url: 'https://www.hellokpop.com/category/news/', region: 'ASIA' },

  // --- EUROPA (20 SAJTOVA - Fokus na EU scenu) ---
  { url: 'https://www.eurovision.tv/news', region: 'EUROPA' },
  { url: 'https://www.europavox.com/news/', region: 'EUROPA' },
  { url: 'https://www.residentadvisor.net/news/europe', region: 'EUROPA' },
  { url: 'https://www.clashmusic.com/category/news/european-news/', region: 'EUROPA' },
  { url: 'https://www.rollingstone.de/news/', region: 'EUROPA' }, // Nemačka
  { url: 'https://www.lesinrocks.com/musique/', region: 'EUROPA' }, // Francuska
  { url: 'https://www.rockit.it/news', region: 'EUROPA' }, // Italija
  { url: 'https://www.jenesaispop.com/', region: 'EUROPA' }, // Španija
  { url: 'https://www.soundsblog.it/', region: 'EUROPA' },
  { url: 'https://www.muzikalia.com/noticias/', region: 'EUROPA' },
  { url: 'https://www.telerama.fr/musique', region: 'EUROPA' },
  { url: 'https://www.greenroom.fr/', region: 'EUROPA' },
  { url: 'https://www.musikexpress.de/news/', region: 'EUROPA' },
  { url: 'https://www.visions.de/news/', region: 'EUROPA' },

  // --- JAZZ (20 SPECIJALIZOVANIH) ---
  { url: 'https://jazztimes.com/news/', region: 'JAZZ' },
  { url: 'https://downbeat.com/news', region: 'JAZZ' },
  { url: 'https://www.allaboutjazz.com/news/', region: 'JAZZ' },
  { url: 'https://www.jazziz.com/category/news/', region: 'JAZZ' },
  { url: 'https://www.jazzwise.com/news', region: 'JAZZ' },
  { url: 'https://londonjazznews.com/', region: 'JAZZ' },
  { url: 'https://www.jazz24.org/category/news/', region: 'JAZZ' },
  { url: 'https://www.musiqology.com/category/jazz/', region: 'JAZZ' },
  { url: 'https://www.ejazznews.com/', region: 'JAZZ' },
  { url: 'https://www.nextbop.com/', region: 'JAZZ' },
  { url: 'https://www.jerryjazzmusician.com/', region: 'JAZZ' },
  { url: 'https://www.jazzonline.com/news/', region: 'JAZZ' },
  { url: 'https://www.jazzinamerica.org/', region: 'JAZZ' },
  { url: 'https://www.jazzstandard.com/', region: 'JAZZ' },
  { url: 'https://www.thejazzmann.com/news', region: 'JAZZ' },
  { url: 'https://www.bebopspokenhere.blogspot.com/', region: 'JAZZ' },
  { url: 'https://www.marlbank.net/', region: 'JAZZ' },
  { url: 'https://www.jazzfuel.com/blog/', region: 'JAZZ' },
  { url: 'https://www.bluenote.com/news/', region: 'JAZZ' },
  { url: 'https://www.jazznews.fr/actu/', region: 'JAZZ' },

  // --- CLASSICAL (20 SPECIJALIZOVANIH) ---
  { url: 'https://www.gramophone.co.uk/news', region: 'CLASSICAL' },
  { url: 'https://www.thestrad.com/news', region: 'CLASSICAL' },
  { url: 'https://www.classical-music.com/news', region: 'CLASSICAL' },
  { url: 'https://www.limelightmagazine.com.au/news/', region: 'CLASSICAL' },
  { url: 'https://www.operanews.com/Opera_News_Magazine/Archive/News.html', region: 'CLASSICAL' },
  { url: 'https://www.classicfm.com/news/', region: 'CLASSICAL' },
  { url: 'https://www.ludwig-van.com/toronto/category/news/', region: 'CLASSICAL' },
  { url: 'https://www.violinist.com/blog/', region: 'CLASSICAL' },
  { url: 'https://www.classicalmpr.org/category/classical-news', region: 'CLASSICAL' },
  { url: 'https://www.classical-scene.com/', region: 'CLASSICAL' },
  { url: 'https://www.pizzicato.lu/', region: 'CLASSICAL' },
  { url: 'https://www.classicalsource.com/news/', region: 'CLASSICAL' },
  { url: 'https://www.operawire.com/', region: 'CLASSICAL' },
  { url: 'https://www.bachtrack.com/news', region: 'CLASSICAL' },
  { url: 'https://www.wqxr.org/sections/classical-music-news/', region: 'CLASSICAL' },
  { url: 'https://www.classicalvoiceamerica.org/', region: 'CLASSICAL' },
  { url: 'https://www.musicalamerica.com/news/', region: 'CLASSICAL' },
  { url: 'https://www.theviolinchannel.com/category/news/', region: 'CLASSICAL' },
  { url: 'https://www.slippeidisc.com/', region: 'CLASSICAL' },
  { url: 'https://www.gramilano.com/', region: 'CLASSICAL' },

  // --- WORLD (Globalni miks) ---
  { url: 'https://www.songlines.co.uk/news', region: 'WORLD' },
  { url: 'https://worldmusiccentral.org/category/news/', region: 'WORLD' },
  { url: 'https://www.rootsworld.com/news.html', region: 'WORLD' },
  { url: 'https://www.rhythm-passport.com/news/', region: 'WORLD' },
  { url: 'https://www.globalmusicnetwork.com/', region: 'WORLD' },
  { url: 'https://www.music-news.com/News', region: 'WORLD' },
  { url: 'https://www.musicradar.com/news', region: 'WORLD' }

      // ... Možeš dopuniti listu po potrebi
    ];

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
    let balancedRegionCounts: Record<string, number> = {};

    if (scrapedData.length > 0) {
      // Keep the same title from different publishers/regions when the source URLs differ.
      const uniqueData = Array.from(new Map(scrapedData.map(item => [item.url, item])).values());
      const mixedData = uniqueData.sort(() => Math.random() - 0.5);
      const regionCounts = new Map<string, number>();
      const balancedData = mixedData.filter((article) => {
        const count = regionCounts.get(article.region) || 0;
        if (count >= MAX_OFFICIAL_ARTICLES_PER_REGION) return false;
        regionCounts.set(article.region, count + 1);
        return true;
      });

      balancedCount = balancedData.length;
      balancedRegionCounts = Object.fromEntries(regionCounts);
      const upsertResult = await upsertInChunks(balancedData);
      insertedCount = upsertResult.inserted;
      failedUpsertChunks = upsertResult.failedChunks;
      failedUpsertRows = upsertResult.failedRows;
      skippedConflicts = upsertResult.skippedConflicts;
      console.log(`🚀 Uspešno uneto ${insertedCount}/${mixedData.length} vesti (${failedUpsertChunks} neuspešnih grupa, ${failedUpsertRows} neuspešnih redova, ${skippedConflicts} postojećih konflikata).`);
    }

    console.log(`ℹ️ Skrejping završen: ${succeededSources}/${SOURCES.length} sajtova uspešno, ${failedSources} neuspešno.`);
    console.log('ℹ️ Official news remains source-link-only; LATEST NewsAPI rows are the only AI-enriched records.');

    // Always resolve with 200 so a partial failure (some sources or one upsert
    // chunk) never fails the GitHub Actions step or blocks the next steps.
    return new Response(JSON.stringify({
      success: true,
      sources: { succeeded: succeededSources, failed: failedSources, total: SOURCES.length },
      count: insertedCount,
      scrapedCount: scrapedData.length,
      balancedCount,
      regionCounts: balancedRegionCounts,
      failedUpsertChunks,
      failedUpsertRows,
      skippedConflicts,
      message: 'Official source links synchronized. AI enrichment applies only to LATEST NewsAPI rows.',
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

// OKIDAČ ZA GITHUB ACTIONS (Van GET funkcije)
if (isDirectScript) {
  console.log("🔔 GitHub Actions detektovan. Ručno pokrećem Official Scraper...");
  GET()
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
