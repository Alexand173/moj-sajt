import type { MetadataRoute } from 'next';
import { EUROPA_SUBREGIONS } from '@/lib/region-navigation';
import { hasValidatedAiContent } from '@/lib/news-indexability';
import { getPublicSupabaseClient } from '@/lib/supabase-public';
import { canonicalArtistPath, getArtistIdentityDirectory, resolveArtistIdentity } from '@/lib/tour-profile';

export const revalidate = 3600;

const BASE_URL = 'https://musictop.net';

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

type SitemapRoute = {
  url: string;
  priority: number;
  lastModified?: string | Date;
};

type NewsSitemapRow = {
  id: string | number;
  region: string | null;
  created_at: string | null;
  ai_content: string | null;
  ai_generated: boolean | null;
  ai_status: string | null;
};

type ConcertArtistSitemapRow = {
  region: string | null;
  artist_name: string | null;
};

/**
 * Every artist that has a concert row in `koncerti` gets a ticket profile URL.
 * The slug is resolved through the same identity directory the ticket pages use,
 * so a sitemap URL always matches the canonical `/tickets/<region>/artist/<slug>`
 * the app redirects to (aliases such as the Metallica variants included).
 */
async function getTicketArtistRoutes(): Promise<SitemapRoute[]> {
  const supabase = getPublicSupabaseClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('koncerti')
      .select('region, artist_name')
      .limit(10000);

    if (error) {
      console.warn('Could not load artist ticket URLs for sitemap:', error.message);
      return [];
    }

    const directory = await getArtistIdentityDirectory();
    const routes = new Map<string, SitemapRoute>();

    for (const row of (data || []) as ConcertArtistSitemapRow[]) {
      const region = row.region?.trim().toLowerCase();
      const artistName = row.artist_name?.trim();
      if (!region || !artistName) continue;

      const { canonicalSlug } = resolveArtistIdentity(artistName, directory);
      if (!canonicalSlug) continue;

      const url = canonicalArtistPath(region, canonicalSlug);
      if (!routes.has(url)) routes.set(url, { url, priority: 0.7 });
    }

    return Array.from(routes.values());
  } catch (error) {
    console.warn('Could not load artist ticket URLs for sitemap:', error);
    return [];
  }
}

/**
 * Only the `/festivals/<region>` hubs are listed. Individual festival pages
 * (`/festivals/<region>/<id>`) are intentionally kept out of the sitemap.
 */
async function getNewsRoutes(): Promise<SitemapRoute[]> {
  const supabase = getPublicSupabaseClient();
  if (!supabase) return [];

  try {
    const newsResult = await supabase
      .from('news')
      .select('id, region, created_at, ai_content, ai_generated, ai_status')
      .limit(10000);

    if (newsResult.error) console.warn('Could not load news URLs for sitemap:', newsResult.error.message);

    return ((newsResult.data || []) as NewsSitemapRow[])
      .filter((article) => Boolean(article.region) && hasValidatedAiContent(article))
      .map((article) => ({
        url: `/news/${encodeURIComponent(article.region!.toLowerCase())}/${encodeURIComponent(String(article.id))}`,
        priority: 0.75,
        lastModified: article.created_at || undefined,
      }));
  } catch (error) {
    console.warn('Could not load news URLs for sitemap:', error);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const mainRoutes: SitemapRoute[] = [
    { url: '', priority: 1.0 },
    { url: '/about', priority: 0.6 },
    { url: '/contact', priority: 0.5 },
    { url: '/newsletter', priority: 0.5 },
    { url: '/privacy', priority: 0.3 },
    { url: '/terms', priority: 0.3 },
    { url: '/awards', priority: 0.8 },
  ];

  const dynamicRoutes: SitemapRoute[] = Object.entries(siteStructure).flatMap(([region, genres]) =>
    genres.map((genre) => ({
      url: `/region/${region}/${genre}`,
      priority: 0.7,
    })),
  );

  const europaSubregionRoutes: SitemapRoute[] = EUROPA_SUBREGIONS.flatMap(({ slug }) =>
    siteStructure.europa.map((genre) => ({
      url: `/region/europa/${slug}/${genre}`,
      priority: 0.65,
    })),
  );

  const ticketsRoutes: SitemapRoute[] = Object.keys(siteStructure).map((region) => ({
    url: `/tickets/${region}`,
    priority: 0.9,
  }));

  const newsRoutes: SitemapRoute[] = Object.keys(siteStructure).map((region) => ({
    url: `/news/${region}`,
    priority: 0.9,
  }));

  const festivalsRoutes: SitemapRoute[] = Object.keys(siteStructure).map((region) => ({
    url: `/festivals/${region}`,
    priority: 0.9,
  }));

  const routes: SitemapRoute[] = [
    ...mainRoutes,
    ...dynamicRoutes,
    ...europaSubregionRoutes,
    ...newsRoutes,
    ...ticketsRoutes,
    ...festivalsRoutes,
    ...(await getTicketArtistRoutes()),
    ...(await getNewsRoutes()),
  ];
  // A URL can be reached from several sources (a seeded profile is also a ticket
  // row, for instance), so keep the first occurrence of each.
  const uniqueRoutes = Array.from(new Map(routes.map((route) => [route.url, route])).values());
  const fallbackLastModified = new Date();

  return uniqueRoutes.map((route) => ({
    url: `${BASE_URL}${route.url}`,
    lastModified: route.lastModified || fallbackLastModified,
    changeFrequency: 'daily' as const,
    priority: route.priority,
  }));
}
