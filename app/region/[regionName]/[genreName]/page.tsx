import { createClient } from '@supabase/supabase-js';
import SongCard from '@/components/SongCard';
import { notFound } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Mapa za povezivanje naziva iz URL-a sa ID-evima u bazi
const GENRE_MAP: Record<string, number> = {
  'rock': 1,
  'pop': 2,
  'hip-hop': 3,
  'rb-soul': 4,
  'country': 5,
  'electronic': 6,
  'j-pop': 7,          // Provereno iz tvoje baze
  'j-rock-metal': 8,  // Proveri tačan ID u Supabase tabeli 'genres'
  'k-pop': 9,         // Proveri tačan ID
  'c-pop': 10,         // Proveri tačan ID
  'india': 11,         // Proveri tačan ID
  'other': 12 ,         // Proveri tačan ID
    'jazz': 13,
  'classical': 14
};

type PageProps = {
  params: Promise<{ regionName: string; genreName: string }>;
};

export default async function FilteredPage({ params }: PageProps) {
  // 1. Razrešavanje parametara iz URL-a (Next.js 15 standard)
  const resolvedParams = await params;
  const regionName = resolvedParams?.regionName;
  const genreName = resolvedParams?.genreName;

  // Bezbednosna provera parametara pre korišćenja
  if (!regionName || !genreName) return notFound();

  const genreId = GENRE_MAP[genreName.toLowerCase()];
  if (!genreId) return notFound();

  // 2. Povlačenje podataka iz Supabase-a sortiranih po glasovima
  const { data: songs } = await supabase
    .from('songs')
    .select('*')
    .eq('region', regionName.toUpperCase())
    .eq('genre_id', genreId)
    .order('votes', { ascending: false })
    .limit(100);

  if (!songs || songs.length === 0) {
    return (
      <div className="min-h-screen bg-[#050505] text-white pt-44 px-10 text-center">
        <div className="py-20 text-zinc-600 uppercase text-sm border border-white/5 rounded-[2.5rem] bg-white/[0.01]">
          No tracks found for {regionName.toUpperCase()} {genreName.toUpperCase()} yet.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-x-hidden selection:bg-purple-500">
      {/* DINAMIČKA POZADINA */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-purple-900/10 blur-[150px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-pink-900/5 blur-[150px] rounded-full animate-pulse" />
      </div>

      {/* HERO SEKCIJA */}
      <section className="pt-44 pb-16 px-10 relative max-w-[1600px] mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
          <span className="text-[10px] font-black tracking-[0.5em] text-zinc-400 uppercase">
            {regionName} {genreName} • Live Chart 2026
          </span>
        </div>
        <h1 className="text-[12vw] md:text-[8vw] font-black leading-[0.8] tracking-tighter mb-8 bg-gradient-to-b from-white via-white to-white/20 bg-clip-text text-transparent uppercase">
          The Top 100.
        </h1>
      </section>

      {/* GLAVNI SADRŽAJ SA TIER SISTEMOM */}
      <main className="max-w-[1600px] mx-auto px-10 pb-40 space-y-20">
        
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

        {/* TIER 3: OSTALE PESME (STANDARDNE) */}
        {songs.length > 3 && (
          <div className="pt-20 border-t border-white/5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-16">
              {songs.slice(3).map((song, i) => (
                <SongCard key={song.id} song={song} rank={i + 4} variant="standard" />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}