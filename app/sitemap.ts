import { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const REGIONS = ['US', 'EUROPA', 'ASIA', 'LATINO', 'WORLD', 'UK'];
const GENRES = [
  'rock', 'pop', 'hip-hop', 'rb-soul', 'country', 
  'dance-electronic', 'j-pop', 'j-rock-metal', 'k-pop', 
  'c-pop', 'india', 'other', 'jazz', 'classical'
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://musictop.net';

  // 1. Static routes
  const staticRoutes = [
    '',
    '/reviews',
    '/awards',
    '/login',
    '/register',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 1.0,
  }));

  // 2. Regional routes
  const regionalRoutes = REGIONS.flatMap((region) => {
    const regionLower = region.toLowerCase();
    return [
      {
        url: `${baseUrl}/region/${regionLower}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.8,
      },
      ...GENRES.map((genre) => ({
        url: `${baseUrl}/region/${regionLower}/${genre}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.7,
      })),
    ];
  });

  // 3. News routes (fetch latest 100)
  const { data: news } = await supabase
    .from('news')
    .select('id, region, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  const newsRoutes = (news || []).map((article) => ({
    url: `${baseUrl}/news/${article.region.toLowerCase()}`, // Simplified based on current news structure
    lastModified: new Date(article.created_at),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  return [...staticRoutes, ...regionalRoutes, ...newsRoutes];
}
