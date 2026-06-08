import { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

// Inicijalizacija Supabase klijenta sa servisnim ključem za bezbedno čitanje sa servera
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

  // 1. STATIČKE RUTE (Početna, recenzije, nagrade, login, registracija)
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
    priority: 1.0, // Početna i statičke važne stranice imaju najveći prioritet
  }));

  // 2. REGIONALNE TURNEJE (Folder: tours/[regionName])
  // Generiše linkove poput: https://musictop.net/tours/us
  const mainRegionalRoutes = REGIONS.map((region) => {
    const regionLower = region.toLowerCase();
    return {
      url: `${baseUrl}/tours/${regionLower}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    };
  });

  // 3. TOP LISTE PO ŽANROVIMA (Folder: region/[regionName]/[genreName])
  // Generiše linkove poput: https://musictop.net/region/us/rock
  const genreTopListsRoutes = REGIONS.flatMap((region) => {
    const regionLower = region.toLowerCase();
    return GENRES.map((genre) => ({
      url: `${baseUrl}/region/${regionLower}/${genre}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.7,
    }));
  });

  // 4. DINAMIČKE STRANICE VESTI (Povlačenje poslednjih 100 vesti iz baze)
  const { data: news } = await supabase
    .from('news')
    .select('id, region, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  const newsRoutes = (news || []).map((article) => ({
    url: `${baseUrl}/news/${article.region.toLowerCase()}`, 
    lastModified: new Date(article.created_at),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  // Spajanje svih generisanih ruta u jednu veliku mapu sajta koju šaljemo Google-u
  return [...staticRoutes, ...mainRegionalRoutes, ...genreTopListsRoutes, ...newsRoutes];
}