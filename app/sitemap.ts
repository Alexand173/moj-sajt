import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const BASE_URL = 'https://musictop.net';

type SitemapVideo = NonNullable<MetadataRoute.Sitemap[number]['videos']>[number];

type SitemapRoute = {
  url: string;
  priority: number;
  videos?: SitemapVideo[];
};

type SitemapSong = {
  region: string | null;
  genre_id: number | null;
  title: string | null;
  artist_name: string | null;
  youtube_id: string | null;
};

const genreMapping: Record<number, string> = {
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
  12: 'other',
};

const siteStructure: Record<string, string[]> = {
  us: ['rock', 'pop', 'hip-hop', 'rb-soul', 'country', 'dance'],
  uk: ['rock', 'pop', 'hip-hop', 'rb-soul', 'country', 'dance'],
  europa: ['rock', 'pop', 'hip-hop', 'rb-soul', 'country', 'dance'],
  latino: ['rock', 'pop', 'hip-hop', 'rb-soul', 'country', 'dance'],
  asia: ['j-pop', 'j-rock-metal', 'k-pop', 'c-pop', 'india', 'other'],
  world: ['rock', 'pop', 'hip-hop', 'rb-soul', 'country', 'dance'],
  jazz: ['jazz'],
  classical: ['classical'],
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let songs: SitemapSong[] = [];
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Keep the sitemap available even if the database is temporarily unavailable.
  if (supabaseUrl && supabaseKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data } = await supabase
        .from('songs')
        .select('region, genre_id, title, artist_name, youtube_id')
        .eq('year', 2026)
        .not('youtube_id', 'eq', '');

      songs = (data || []) as SitemapSong[];
    } catch {
      songs = [];
    }
  }

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
    genres.map((genre) => {
      const matchingSongs = songs.filter((song) => {
        const songRegion = song.region?.toLowerCase();
        const songGenre = song.genre_id == null ? undefined : genreMapping[song.genre_id];
        return songRegion === region && songGenre === genre;
      });

      const videos: SitemapVideo[] = matchingSongs
        .filter((song) => song.youtube_id)
        .map((song) => {
          const artist = escapeXml(song.artist_name || 'Unknown artist');
          const title = escapeXml(song.title || 'Untitled song');
          const name = `${artist} - ${title}`;

          return {
            title: name,
            description: `Listen and vote for ${name} on the MusicTop charts for 2026.`,
            thumbnail_loc: `https://img.youtube.com/vi/${song.youtube_id}/hqdefault.jpg`,
            player_loc: `https://www.youtube.com/embed/${song.youtube_id}`,
          };
        });

      return {
        url: `/region/${region}/${genre}`,
        priority: 0.7,
        ...(videos.length > 0 ? { videos } : {}),
      };
    }),
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

  const routes: SitemapRoute[] = [...mainRoutes, ...dynamicRoutes, ...newsRoutes, ...toursRoutes, ...festivalsRoutes];
  const lastModified = new Date();

  return routes.map((route) => ({
    url: `${BASE_URL}${route.url}`,
    lastModified,
    changeFrequency: 'daily' as const,
    priority: route.priority,
    ...(route.videos ? { videos: route.videos } : {}),
  }));
}
