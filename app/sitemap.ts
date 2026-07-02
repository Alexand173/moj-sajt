import { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://musictop.net';

  // 1. Inicijalizacija Supabase-a
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 2. Povlačenje pesama iz baze
  const { data: songs } = await supabase
    .from('songs')
    .select('region, genre_id, title, artist_name, youtube_id')
    .eq('year', 2026)
    .not('youtube_id', 'eq', '');

  // Usklađeno sa tvojom slikom iz baze (image_97febd.png)
  const genreMapping: { [key: number]: string } = {
    1: 'rock',
    2: 'pop',
    3: 'hip-hop',
    4: 'rb-soul',
    5: 'country',
    6: 'dance',
    7: 'j-pop',
    8: 'j-rock-metal',
    9: 'k-pop',
    10: 'c-pop',
    11: 'india',
    12: 'other'
  };

  // 3. Tvoja originalna struktura sajta
  const siteStructure = {
    us: ['rock', 'pop', 'hip-hop', 'rb-soul', 'country', 'dance'],
    uk: ['rock', 'pop', 'hip-hop', 'rb-soul', 'country', 'dance'],
    europa: ['rock', 'pop', 'hip-hop', 'rb-soul', 'country', 'dance'],
    latino: ['rock', 'pop', 'hip-hop', 'rb-soul', 'country', 'dance'],
    asia: ['j-pop', 'j-rock-metal', 'k-pop', 'c-pop', 'india', 'other'],
    world: ['rock', 'pop', 'hip-hop', 'rb-soul', 'country', 'dance'],
    jazz: ['jazz'],
    classical: ['classical']
  };

  const mainRoutes = [
    { url: '', priority: 1.0 },
    { url: '/reviews', priority: 0.8 },
    { url: '/awards', priority: 0.8 },
  ];

  // Generisanje žanrovskih ruta + ubacivanje pesama kroz 'videos' array koji Next.js podržava
  const dynamicRoutes = Object.entries(siteStructure).flatMap(([region, genres]) => {
    return genres.map((genre) => {
      
      // Filtriramo pesme za ovaj region i žanr
      const filterovanePesme = songs?.filter(song => {
        const songRegion = song.region?.toLowerCase();
        const songGenreStr = genreMapping[song.genre_id];
        return songRegion === region && songGenreStr === genre;
      }) || [];

      // Mapiramo pesme u format koji Next.js automatski pretvara u <video:video> tagove
      const videoData = filterovanePesme.map(song => ({
        title: `${song.artist_name} - ${song.title}`,
        description: `Slušajte i glasajte za hit ${song.artist_name} - ${song.title} na MusicTop listi za 2026. godinu.`,
        thumbnailUrl: `https://img.youtube.com/vi/${song.youtube_id}/hqdefault.jpg`,
        playerUrl: `https://www.youtube.com/embed/${song.youtube_id}`,
      }));

      return {
        url: `/region/${region}/${genre}`,
        priority: 0.7,
        ...(videoData.length > 0 ? { videos: videoData } : {})
      };
    });
  });

  const toursRoutes = Object.keys(siteStructure).map((region) => ({
    url: `/tours/${region}`,
    priority: 0.9,
  }));

  const newsByRegionRoutes = Object.keys(siteStructure).map((region) => ({
    url: `/news/${region}`,
    priority: 0.9,
  }));

  const festivalsRoutes = Object.keys(siteStructure).map((region) => ({
    url: `/festivals/${region}`,
    priority: 0.9,
  }));

  // Sastavljanje finalnog niza – tačno tvoja originalna logika mapiranja
  return [...mainRoutes, ...dynamicRoutes, ...newsByRegionRoutes, ...toursRoutes, ...festivalsRoutes].map((route) => ({
    url: `${baseUrl}${route.url}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: route.priority,
    ...('videos' in route ? { videos: (route as any).videos } : {})
  }));
}