import type { MetadataRoute } from 'next';
import { EUROPA_SUBREGIONS } from '@/lib/region-navigation';

export const revalidate = 3600;

const BASE_URL = 'https://musictop.net';

type SitemapRoute = {
  url: string;
  priority: number;
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

export default function sitemap(): MetadataRoute.Sitemap {
  const mainRoutes = [
    { url: '', priority: 1.0 },
    { url: '/about', priority: 0.6 },
    { url: '/contact', priority: 0.5 },
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
  ];
  const lastModified = new Date();

  return routes.map((route) => ({
    url: `${BASE_URL}${route.url}`,
    lastModified,
    changeFrequency: 'daily' as const,
    priority: route.priority,
  }));
}
