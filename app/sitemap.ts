import type { MetadataRoute } from 'next';
import { EUROPA_SUBREGIONS } from '@/lib/region-navigation';
import { hasValidatedAiContent } from '@/lib/news-indexability';
import { buildNewsArticlePath } from '@/lib/news-slug';
import { getPublicSupabaseClient } from '@/lib/supabase-public';
import { loadConcertRegionRows } from '@/lib/ticket-regions';
import { canonicalArtistPath, getArtistIdentityDirectory, isLiveTourDate, resolveArtistIdentity } from '@/lib/tour-profile';

/**
 * The sitemap is regenerated every 30 minutes. Published articles therefore enter
 * it well within the same day, and `lastModified` stays a real value (the article's
 * `created_at`) rather than a build timestamp.
 */
export const revalidate = 1800;

const BASE_URL = 'https://musictop.net';

type ChangeFrequency = NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>;

type SitemapRoute = {
  url: string;
  priority: number;
  changeFrequency: ChangeFrequency;
  /**
   * Only set when the page genuinely has a date. An invented `lastModified` is
   * worse than none: Google discounts unreliable lastmod for the whole file.
   */
  lastModified?: string | Date;
};

const siteStructure: Record<string, string[]> = {
  us: ['rock', 'pop', 'hip-hop', 'rb-soul', 'country', 'dance-electronic'],
  uk: ['rock', 'pop', 'hip-hop', 'rb-soul', 'country', 'dance-electronic'],
  europa: ['rock', 'pop', 'hip-hop', 'rb-soul', 'metal', 'dance-electronic'],
  latino: ['rock', 'pop', 'hip-hop', 'rb-soul', 'country', 'dance-electronic'],
  asia: ['j-pop', 'j-rock-metal', 'k-pop', 'c-pop', 'india', 'other'],
  world: ['rock', 'pop', 'hip-hop', 'rb-soul', 'country', 'dance-electronic'],
  jazz: ['jazz'],
  classical: ['classical'],
};

const SITE_REGIONS = Object.keys(siteStructure);

type NewsSitemapRow = {
  id: string | number;
  region: string | null;
  created_at: string | null;
  /** The article page derives its canonical slug from this field alone. */
  title: string | null;
  ai_content: string | null;
  ai_generated: boolean | null;
  ai_status: string | null;
};

type TicketRouteBundle = {
  /** `/tickets/<region>` hubs for regions found in the concert feed. */
  hubs: SitemapRoute[];
  /** `/tickets/<region>/artist/<slug>` for artists with a date still on sale. */
  artists: SitemapRoute[];
};

/**
 * One pass over `koncerti` produces both the region hubs and the artist profiles.
 * Slugs go through the same identity directory the ticket pages use, so a sitemap
 * URL always matches the canonical page instead of a redirect. Artists whose whole
 * run has played stay out, because those pages are noindex.
 */
async function getTicketRoutes(): Promise<TicketRouteBundle> {
  const rows = await loadConcertRegionRows();
  if (rows.length === 0) return { hubs: [], artists: [] };

  const directory = await getArtistIdentityDirectory();
  const liveRegions = new Set<string>();
  const artists = new Map<string, { url: string; live: boolean }>();

  for (const row of rows) {
    const region = row.region?.trim().toLowerCase();
    const artistName = row.artist_name?.trim();
    if (!region || !artistName) continue;

    const { canonicalSlug } = resolveArtistIdentity(artistName, directory);
    if (!canonicalSlug) continue;

    const live = isLiveTourDate(row.date);
    if (live) liveRegions.add(region);

    const url = canonicalArtistPath(region, canonicalSlug);
    const entry = artists.get(url) ?? { url, live: false };
    if (live) entry.live = true;
    artists.set(url, entry);
  }

  return {
    hubs: Array.from(liveRegions)
      .sort((a, b) => a.localeCompare(b))
      .map((region) => ({
        url: `/tickets/${encodeURIComponent(region)}`,
        priority: 0.9,
        changeFrequency: 'daily' as const,
      })),
    artists: Array.from(artists.values())
      .filter((entry) => entry.live)
      .sort((a, b) => a.url.localeCompare(b.url))
      .map((entry) => ({
        url: entry.url,
        priority: 0.7,
        changeFrequency: 'daily' as const,
      })),
  };
}

const NEWS_COLUMNS = 'id, region, created_at, title, ai_content, ai_generated, ai_status';
const NEWS_PAGE_SIZE = 1000;
/** PostgREST cannot measure word count, so paging has a ceiling rather than being unbounded. */
const NEWS_MAX_ROWS = 50000;
/** Google rejects a sitemap above 50 000 URLs; leave headroom for the other routes. */
const SITEMAP_URL_CAP = 49000;

/**
 * Walks every rewritten article instead of trusting a first-page slice. The two
 * equality filters narrow the scan in Postgres (33k rows → the rewritten subset),
 * and paging then guarantees no valid article is skipped because it sat beyond a
 * single `limit()`. The word-count rule stays in `hasValidatedAiContent` because
 * it is the same rule the article page uses to decide `noindex` — the sitemap must
 * never advertise a URL the page asks Google to skip.
 */
async function loadIndexableNewsRows(): Promise<NewsSitemapRow[]> {
  const supabase = getPublicSupabaseClient();
  if (!supabase) return [];

  const rows: NewsSitemapRow[] = [];

  try {
    for (let from = 0; from < NEWS_MAX_ROWS; from += NEWS_PAGE_SIZE) {
      const { data, error } = await supabase
        .from('news')
        .select(NEWS_COLUMNS)
        .eq('ai_generated', true)
        .eq('ai_status', 'generated')
        .not('ai_content', 'is', null)
        // A stable, unique sort is required for paging to be repeatable.
        .order('id', { ascending: true })
        .range(from, from + NEWS_PAGE_SIZE - 1);

      if (error) {
        console.warn('Could not load news URLs for sitemap:', error.message);
        break;
      }

      const batch = (data || []) as NewsSitemapRow[];
      rows.push(...batch);
      if (batch.length < NEWS_PAGE_SIZE) break;
    }
  } catch (error) {
    console.warn('Could not load news URLs for sitemap:', error);
  }

  if (rows.length >= NEWS_MAX_ROWS) {
    console.warn(`Sitemap news scan hit the ${NEWS_MAX_ROWS}-row ceiling; older articles may be missing.`);
  }

  return rows;
}

async function getNewsRoutes(): Promise<SitemapRoute[]> {
  const rows = await loadIndexableNewsRows();

  const routes = rows
    .filter((article) => Boolean(article.region) && hasValidatedAiContent(article))
    .map((article) => ({
      url: buildNewsArticlePath(article.region!, article.id, article.title),
      priority: 0.75,
      changeFrequency: 'daily' as const,
      lastModified: article.created_at || undefined,
    }));

  if (rows.length > 0) {
    console.info(`Sitemap: ${rows.length} rewritten news rows scanned, ${routes.length} indexable articles listed.`);
  }

  // Newest first, so a future URL cap trims the oldest stories rather than the freshest.
  return Array.from(new Map(routes.map((route) => [route.url, route])).values())
    .sort((a, b) => String(b.lastModified || '').localeCompare(String(a.lastModified || '')));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const ticketRoutes = await getTicketRoutes();

  const mainRoutes: SitemapRoute[] = [
    { url: '', priority: 1.0, changeFrequency: 'daily' },
    { url: '/tickets', priority: 0.9, changeFrequency: 'daily' },
    { url: '/awards', priority: 0.8, changeFrequency: 'weekly' },
    { url: '/about', priority: 0.6, changeFrequency: 'monthly' },
    { url: '/contact', priority: 0.5, changeFrequency: 'monthly' },
    { url: '/newsletter', priority: 0.5, changeFrequency: 'monthly' },
    { url: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
    { url: '/terms', priority: 0.3, changeFrequency: 'yearly' },
  ];

  // Bare regional chart pages (`/region/<region>`) exist and carry content.
  // `/region` itself is deliberately excluded: it renders a hard-coded us/rock
  // chart with a canonical of `/`, so listing it would submit a duplicate.
  const regionRoutes: SitemapRoute[] = SITE_REGIONS.map((region) => ({
    url: `/region/${region}`,
    priority: 0.75,
    changeFrequency: 'daily',
  }));

  const genreRoutes: SitemapRoute[] = Object.entries(siteStructure).flatMap(([region, genres]) =>
    genres.map((genre) => ({
      url: `/region/${region}/${genre}`,
      priority: 0.7,
      changeFrequency: 'daily' as const,
    })),
  );

  const europaSubregionRoutes: SitemapRoute[] = EUROPA_SUBREGIONS.flatMap(({ slug }) =>
    siteStructure.europa.map((genre) => ({
      url: `/region/europa/${slug}/${genre}`,
      priority: 0.65,
      changeFrequency: 'daily' as const,
    })),
  );

  const newsHubRoutes: SitemapRoute[] = SITE_REGIONS.map((region) => ({
    url: `/news/${region}`,
    priority: 0.9,
    changeFrequency: 'hourly',
  }));

  const configuredTicketHubs: SitemapRoute[] = SITE_REGIONS.map((region) => ({
    url: `/tickets/${region}`,
    priority: 0.9,
    changeFrequency: 'daily',
  }));

  const festivalHubRoutes: SitemapRoute[] = SITE_REGIONS.map((region) => ({
    url: `/festivals/${region}`,
    priority: 0.9,
    changeFrequency: 'daily',
  }));

  const routes: SitemapRoute[] = [
    ...mainRoutes,
    ...regionRoutes,
    ...genreRoutes,
    ...europaSubregionRoutes,
    ...newsHubRoutes,
    ...configuredTicketHubs,
    ...ticketRoutes.hubs,
    ...festivalHubRoutes,
    ...ticketRoutes.artists,
    ...(await getNewsRoutes()),
  ];

  // A URL can arrive from several sources (a region in both the configured list
  // and the concert feed, for instance), so keep the first occurrence of each.
  const uniqueRoutes = Array.from(new Map(routes.map((route) => [route.url, route])).values());

  if (uniqueRoutes.length > SITEMAP_URL_CAP) {
    console.warn(`Sitemap has ${uniqueRoutes.length} URLs, above the ${SITEMAP_URL_CAP} cap. Switch to generateSitemaps() to shard it.`);
  }

  return uniqueRoutes.slice(0, SITEMAP_URL_CAP).map((route) => ({
    url: `${BASE_URL}${route.url}`,
    ...(route.lastModified ? { lastModified: route.lastModified } : {}),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
