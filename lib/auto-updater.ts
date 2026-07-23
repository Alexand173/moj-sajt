import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mapiramo željene liste na platformu i kriterijum pretrage
export const TARGET_CHARTS = [
  { region: 'US', genre_id: 2, platform: 'spotify', search: 'United States' },
  { region: 'UK', genre_id: 2, platform: 'spotify', search: 'United Kingdom' },
  { region: 'WORLD', genre_id: 2, platform: 'spotify', search: 'Global' },
  { region: 'US', genre_id: 1, platform: 'shazam', search: 'Rock' },
  { region: 'US', genre_id: 3, platform: 'shazam', search: 'Hip-Hop' },
  { region: 'US', genre_id: 4, platform: 'shazam', search: 'R&B' },
  { region: 'US', genre_id: 5, platform: 'shazam', search: 'Country' },
  { region: 'US', genre_id: 6, platform: 'shazam', search: 'Dance' },
];

async function getValidSlug(platform: string, searchTerm: string): Promise<string | null> {
  try {
    const headers = {
      'x-app-id': process.env.SOUNDCHARTS_APP_ID!,
      'x-app-key': process.env.SOUNDCHARTS_TOKEN || process.env.SOUNDCHARTS_APP_KEY!,
      'x-api-key': process.env.SOUNDCHARTS_TOKEN || process.env.SOUNDCHARTS_APP_KEY!,
      'Accept': 'application/json',
    };

    const res = await fetch(
      `https://customer.api.soundcharts.com/api/v2/chart/song/by-platform/${platform}?limit=100`,
      { headers, cache: 'no-store' }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const items = data.items || [];

    // Tražimo chart koji u svom imenu ili countryName sadrži naš pojam
    const match = items.find((item: any) => 
      item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.countryName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.slug?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return match ? match.slug : (items[0]?.slug || null);
  } catch (err) {
    return null;
  }
}

async function fetch2026WeeklyChart(chartSlug: string) {
  try {
    const appId = process.env.SOUNDCHARTS_APP_ID!;
    const apiKey = process.env.SOUNDCHARTS_TOKEN || process.env.SOUNDCHARTS_APP_KEY!;

    const headers = {
      'x-app-id': appId,
      'x-app-key': apiKey,
      'x-api-key': apiKey,
      'Accept': 'application/json',
    };

    const res = await fetch(
      `https://customer.api.soundcharts.com/api/v2/chart/song/${chartSlug}/ranking/latest`,
      { headers, cache: 'no-store' }
    );

    if (!res.ok) {
      console.error(`⚠️ Soundcharts Status ${res.status} za slug: ${chartSlug}`);
      return [];
    }

    const data = await res.json();
    const rawItems = data.items || [];
    console.log(`📊 Slug: ${chartSlug} -> Ukupno pronađeno pesama: ${rawItems.length}`);

    // Ako u bazi nema tačnih 2026 oznaka na Soundcharts-u, uzećemo top pesme sa liste
    const songs = rawItems.map((item: any, index: number) => {
      const song = item.song || item;
      return {
        position: index + 1,
        title: song.name || song.title,
        artist_name: song.creditName || song.artist?.name || 'Unknown Artist',
        release_date: song.releaseDate ? String(song.releaseDate).split('T')[0] : '2026-01-01',
      };
    });

    return songs;
  } catch (err) {
    console.error(`❌ Greška za chart ${chartSlug}:`, err);
    return [];
  }
}

export async function updateMusicCharts() {
  console.log("--- OSVEŽAVANJE NEDELJNIH TOP LISTI (2026) ---");
  let updatedCount = 0;

  for (const config of TARGET_CHARTS) {
    console.log(`\n🔍 Tražim važeći slug za: ${config.platform} (${config.search})...`);
    
    const slug = await getValidSlug(config.platform, config.search);
    
    if (!slug) {
      console.error(`❌ Nije pronađen slug za ${config.search}`);
      continue;
    }

    console.log(`Obrađujem ${config.region} chart (${slug})...`);
    const chartSongs = await fetch2026WeeklyChart(slug);

    if (chartSongs.length === 0) continue;

    // Uzimamo prvih 10 pesama po chartu
    for (const song of chartSongs.slice(0, 10)) {
      const query = `${song.artist_name} - ${song.title}`;

      // 1. Provera u Supabase-u
      const { data: existingSong } = await supabase
        .from('songs')
        .select('youtube_id, slika_url')
        .eq('title', song.title)
        .eq('artist_name', song.artist_name)
        .maybeSingle();

      let videoId = existingSong?.youtube_id;
      let thumb = existingSong?.slika_url;

      // 2. Tražimo na YouTube-u samo ako je nema
      if (!videoId) {
        try {
          await delay(1200);

          const ytRes = await youtube.search.list({
            part: ['id', 'snippet'],
            q: `${query} official music video`,
            maxResults: 1,
            type: ['video'],
            videoEmbeddable: 'true',
          });

          const item = ytRes.data.items?.[0];
          videoId = item?.id?.videoId || '';
          thumb = item?.snippet?.thumbnails?.high?.url || '';
        } catch (ytErr: any) {
          console.error(`⚠️ YouTube API problem za "${query}":`, ytErr.message);
          continue;
        }
      }

      if (!videoId) continue;

      // 3. Upis u bazu
      const { error } = await supabase
        .from('songs')
        .upsert({
          title: song.title,
          artist_name: song.artist_name,
          release_date: song.release_date,
          slika_url: thumb,
          youtube_id: videoId,
          region: config.region,
          genre_id: config.genre_id,
          year: 2026,
          is_chart: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'title' });

      if (error) {
        console.error(`❌ Greška pri upisu za ${query}:`, error.message);
      } else {
        console.log(`✅ Uspešno ubačeno: ${query}`);
        updatedCount++;
      }
    }
  }

  return updatedCount;
}