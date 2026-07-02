import { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://musictop.net';

  // 1. Initialize Supabase client
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 2. Fetch active songs for 2026 with valid YouTube IDs
  const { data: songs } = await supabase
    .from('songs')
    .select('region, genre_id, title, artist_name, youtube_id')
    .eq('year', 2026)
    .not('youtube_id', 'eq', '');

  // Genre mapping aligned with the database structure
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

  // 3. Define site structure for routing
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

  // Generate dynamic region/genre routes and attach video metadata
  const dynamicRoutes = Object.entries(siteStructure).flatMap(([region, genres]) => {
    return genres.map((genre) => {
      const filterovanePesme = songs?.filter(song => {
        const songRegion = song.region?.toLowerCase();
        const songGenreStr = genreMapping[song.genre_id];
        return songRegion === region && songGenreStr === genre;
      }) || [];

      // Map song data to valid Google Video XML Schema format
      const videoData = filterovanePesme.map(song => {
        // Escape special XML characters to prevent parsing errors
        const cistArtist = (song.artist_name || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const cistTitle = (song.title || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const punNaziv = `${cistArtist} - ${cistTitle}`;

        return {
          title: punNaziv,
          description: `Listen and vote for the hit track ${punNaziv} on the MusicTop charts for 2026.`,
          thumbnail_loc: `https://img.youtube.com/vi/${song.youtube_id}/hqdefault.jpg`,
          player_loc: `https://www.youtube.com/embed/${song.youtube_id}`,
        };
      });

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

  // Combine all routes into the final dynamic sitemap array
  return [...mainRoutes, ...dynamicRoutes, ...newsByRegionRoutes, ...toursRoutes, ...festivalsRoutes].map((route) => ({
    url: `${baseUrl}${route.url}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: route.priority,
    ...( 'videos' in route ? { videos: (route as any).videos } : {} )
  }));
}