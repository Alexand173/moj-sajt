import type { MetadataRoute } from 'next';
import { EUROPA_SUBREGIONS } from '@/lib/region-navigation';
import { hasValidatedAiContent } from '@/lib/news-indexability';
import { getPublicSupabaseClient } from '@/lib/supabase-public';

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

type FestivalSitemapRow = {
  id: string | number;
  region: string | null;
  date_start: string | null;
};

function isUpcomingDate(value: string | null): boolean {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return !Number.isNaN(timestamp) && timestamp >= Date.now();
}

async function getContentRoutes(): Promise<SitemapRoute[]> {
  const supabase = getPublicSupabaseClient();
  if (!supabase) return [];

  try {
    const [newsResult, festivalResult] = await Promise.all([
      supabase
        .from('news')
        .select('id, region, created_at, ai_content, ai_generated, ai_status')
        .limit(10000),
      supabase
        .from('festivals')
        .select('id, region, date_start')
        .limit(10000),
    ]);

    if (newsResult.error) console.warn('Could not load news URLs for sitemap:', newsResult.error.message);
    if (festivalResult.error) console.warn('Could not load festival URLs for sitemap:', festivalResult.error.message);

    const newsRoutes = ((newsResult.data || []) as NewsSitemapRow[])
      .filter((article) => Boolean(article.region) && hasValidatedAiContent(article))
      .map((article) => ({
        url: `/news/${encodeURIComponent(article.region!.toLowerCase())}/${encodeURIComponent(String(article.id))}`,
        priority: 0.75,
        lastModified: article.created_at || undefined,
      }));

    const festivalRoutes = ((festivalResult.data || []) as FestivalSitemapRow[])
      .filter((festival) => Boolean(festival.region) && isUpcomingDate(festival.date_start))
      .map((festival) => ({
        url: `/festivals/${encodeURIComponent(festival.region!.toLowerCase())}/${encodeURIComponent(String(festival.id))}`,
        priority: 0.7,
        lastModified: festival.date_start || undefined,
      }));

    return [...newsRoutes, ...festivalRoutes];
  } catch (error) {
    console.warn('Could not load content URLs for sitemap:', error);
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
    { url: '/reviews', priority: 0.8 },
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

  const toursRoutes: SitemapRoute[] = Object.keys(siteStructure).map((region) => ({
    url: `/tours/${region}`,
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
    ...toursRoutes,
    ...festivalsRoutes,
    ...(await getContentRoutes()),
  ];
  const fallbackLastModified = new Date();

  return routes.map((route) => ({
    url: `${BASE_URL}${route.url}`,
    lastModified: route.lastModified || fallbackLastModified,
    changeFrequency: 'daily' as const,
    priority: route.priority,
  }));
}
