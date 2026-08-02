import SongCard from '@/components/SongCard';
import { getPublicSupabaseClient } from '@/lib/supabase-public';
import type { ChartSong } from '@/lib/chart-types';
import { notFound } from 'next/navigation';
import SuggestionSection from '@/components/SuggestionSection';
import SuggestionScrollBadge from '@/components/SuggestionScrollBadge';
import StructuredData from '@/components/StructuredData';
import { Metadata } from 'next';

// Mapa za povezivanje naziva iz URL-a sa ID-evima u bazi
const GENRE_MAP: Record<string, number> = {
  'rock': 1,
  'pop': 2,
  'hip-hop': 3,
  'rb-soul': 4,
  'country': 5,
  'dance-electronic': 6,
  'j-pop': 7,
  'j-rock-metal': 8,
  'k-pop': 9,
  'c-pop': 10,
  'india': 11,
  'other': 12,
  'jazz': 13,
  'classical': 14
};

// MOĆNA I TAČNA SEO FUNKCIJA SA UPITOM U BAZU
export async function generateMetadata(): Promise<Metadata> {
  const regionName = 'us';
  const genreName = 'rock';

  // Metadata must not depend on a database request. Crawlers should receive
  // a complete title even while Supabase is unavailable.
  const genreNameFormatted = genreName.charAt(0).toUpperCase() + genreName.slice(1);

  // 3. Formatiranje regiona (npr. 'us' -> 'US', 'europa' -> 'Europa')
  const regionRaw = regionName.toUpperCase();
  const region = regionRaw === 'US' || regionRaw === 'UK'
    ? regionRaw
    : regionRaw.charAt(0).toUpperCase() + regionRaw.slice(1).toLowerCase();

  const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });
  const currentYear = new Date().getFullYear();

  const title = `Best ${genreNameFormatted} Songs in ${region} - Top 100 Chart ${currentMonth} ${currentYear}`;
  const description = `Discover the best ${genreNameFormatted} music in ${region}. Official audience-ranked top 100 chart featuring the most popular ${genreNameFormatted} tracks. Updated daily for ${currentMonth} ${currentYear}.`;

  return {
    title,
    description,
    alternates: {
      canonical: `https://musictop.net`,
    },
    openGraph: {
      title: `${region} ${genreNameFormatted} Top 100 | MUSIC TOP`,
      description: `Vote and follow the official ${genreNameFormatted} music chart in ${region}.`,
      url: `https://musictop.net`,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    }
  };
}

export default async function HomePage() {
  // Hardkodovani parametri za Home Page (us/rock)
  const regionName = 'us';
  const genreName = 'rock';

  const genreId = GENRE_MAP[genreName.toLowerCase()];
  if (!genreId) return notFound();

  // Povlačenje podataka iz Supabase-a. A database outage should still
  // produce a crawlable page with the useful empty-state HTML.
  const supabase = getPublicSupabaseClient();
  let songs: ChartSong[] | null = null;

  if (supabase) {
    try {
      const { data } = await supabase
        .from('songs')
        .select('*')
        .eq('region', regionName.toUpperCase())
        .eq('genre_id', genreId)
        .order('viewers', { ascending: false })
        .limit(200);
      songs = (data || []) as ChartSong[];
    } catch (error) {
      console.warn('Could not load the homepage chart:', error);
    }
  }

  if (!songs || songs.length === 0) {
    return (
      <div className="min-h-screen bg-[#050505] text-white pt-44 px-10 text-center">
        <div className="py-20 text-zinc-600 uppercase text-sm border border-white/5 rounded-[2.5rem] bg-white/[0.01]">
          No tracks found for {regionName.toUpperCase()} {genreName.toUpperCase()} yet.
        </div>
      </div>
    );
  }

  const region = regionName.toUpperCase();
  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": `${region} ${genreName.toUpperCase()} Top 100`,
    "description": `Top 100 ${genreName} songs in ${region}`,
    "itemListElement": songs.slice(0, 10).map((song, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": song.title,
      "url": `https://musictop.net`
    }))
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-x-hidden selection:bg-purple-500">
      <StructuredData data={itemListSchema} />
      {/* DINAMIČKA POZADINA */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-purple-900/10 blur-[150px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-pink-900/5 blur-[150px] rounded-full animate-pulse" />
      </div>

      {/* REORGANIZOVANA HERO SEKCIJA */}
      <section className="pt-44 pb-8 px-10 relative max-w-[1600px] mx-auto">
        <div className="flex flex-col lg:flex-row items-start justify-between gap-10 w-full">
          {/* LEVA STRANA: NASLOV */}
          <div className="w-full lg:max-w-[500px] shrink-0">
            <div className="flex items-center gap-3 mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              <span className="text-[10px] font-black tracking-[0.5em] text-zinc-400 uppercase">
                {regionName} {genreName} • Live Chart 2026
              </span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-black leading-[0.9] tracking-tighter bg-gradient-to-b from-white via-white to-white/20 bg-clip-text text-transparent uppercase select-none">
              {regionName} {genreName} <br/> 
              <span className="text-purple-500">Top {songs.length}</span>
            </h1>
          </div>
        </div>
      </section>

      {/* GLAVNI SADRŽAJ SA TIER SISTEMOM */}
      <main className="max-w-[1600px] mx-auto px-10 pb-40 space-y-16">

        {/* TIER 1: PESMA BROJ 1 (NAJVEĆA) */}
        {songs[0] && (
          <div className="w-full">
             <SongCard song={songs[0]} rank={1} variant="big" />
          </div>
        )}

        {/* TIER 2: PESME BROJ 2 I 3 (SREDNJE) */}
        {(songs[1] || songs[2]) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {songs.slice(1, 3).map((song, i) => (
              <SongCard key={song.id} song={song} rank={i + 2} variant="medium" />
            ))}
          </div>
        )}

        {/* TIER 3: OSTALE PESME */}
        {songs.length > 3 && (
          <div className="pt-20 border-t border-white/5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-16">
              {songs.slice(3).map((song, i) => {
                const trenutniRank = i + 4;

                return (
                  <div key={song.id} className="contents">
                    {/* Kartica pesme */}
                    <SongCard song={song} rank={trenutniRank} variant="standard" />

                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PREDLOZI */}
        <div id="suggestions-section" className="w-full pt-20 pb-20 border-t border-white/10">
          <div className="max-w-4xl mx-auto"> 
            <SuggestionSection 
              regionName={regionName} 
              genreId={genreId} 
              genreName={genreName}
            />
          </div>
        </div>

      </main>

      {/* BEDŽ - VAN MAIN-A */}
      <SuggestionScrollBadge />

    </div>
  );
}
