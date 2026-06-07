import { createClient } from '@supabase/supabase-js';
import SongCard from '@/components/SongCard';
import { notFound } from 'next/navigation';
import SuggestionSection from '@/components/SuggestionSection';
import AdSenseBanner from '@/components/AdSenseBanner';
import SuggestionScrollBadge from '@/components/SuggestionScrollBadge';

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

type PageProps = {
  params: Promise<{ regionName: string; genreName: string }>;
};

export default async function FilteredPage({ params }: PageProps) {
  // Razrešavanje parametara iz URL-a (Next.js 15 standard)
  const resolvedParams = await params;
  const regionName = resolvedParams?.regionName;
  const genreName = resolvedParams?.genreName;

  // Bezbednosna provera parametara pre korišćenja
  if (!regionName || !genreName) return notFound();

  const genreId = GENRE_MAP[genreName.toLowerCase()];
  if (!genreId) return notFound();

  // Povlačenje podataka iz Supabase-a
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

  // MAPIRANJE REKLAMA PO REGIONU I ŽANRU
  const region = regionName.toUpperCase();
  const genre = genreName.toLowerCase().replace('-', ''); 
  const adKey = `${region}_${genre}`;

  const adSlots: Record<string, { top: string; mid1: string; mid2: string; mid3: string; bottom: string }> = {
    "US_rock": {
      top: "5000000001",
      mid1: "5000000002",
      mid2: "5000000003",
      mid3: "5000000004",
      bottom: "5000000005"
    },
    "US_pop": {
      top: "5100000001",
      mid1: "5100000002",
      mid2: "5100000003",
      mid3: "5100000004",
      bottom: "5100000005"
    },
    "EUROPA_rock": {
      top: "6000000001",
      mid1: "6000000002",
      mid2: "6000000003",
      mid3: "6000000004",
      bottom: "6000000005"
    },
    "DEFAULT": {
      top: "0000000001",
      mid1: "0000000002",
      mid2: "0000000003",
      mid3: "0000000004",
      bottom: "0000000005"
    }
  };

  const trenutniSlotovi = adSlots[adKey] || adSlots.DEFAULT;

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-x-hidden selection:bg-purple-500">
      {/* DINAMIČKA POZADINA */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-purple-900/10 blur-[150px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-pink-900/5 blur-[150px] rounded-full animate-pulse" />
      </div>

 {/* REORGANIZOVANA HERO SEKCIJA */}
<section className="pt-44 pb-8 px-10 relative max-w-[1600px] mx-auto">
  {/* Na desktopu delimo na dve prostrane kolone: Levo naslov (flex-1), Desno predlozi (flex-[2] - duplo širi) */}
  <div className="flex flex-col lg:flex-row items-start justify-between gap-10 w-full">
    
    {/* LEVA STRANA: NASLOV (Zadržava svoju prirodnu širinu na PC-ju) */}
    <div className="w-full lg:max-w-[350px] shrink-0">
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
        The Top {songs.length}.
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

        {/* --- 1. REKLAMA: IZMEĐU 3. I 4. MESTA --- */}
        <div className="py-8">
          <AdSenseBanner adSlot={trenutniSlotovi.top} />
        </div>
        
        {/* TIER 3: OSTALE PESME (STANDARDNE SA REKLAMAMA IZMEĐU) */}
        {songs.length > 3 && (
          <div className="pt-20 border-t border-white/5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-16">
              {songs.slice(3).map((song, i) => {
                const trenutniRank = i + 4;

                return (
                  <div key={song.id} className="contents">
                    {/* Kartica pesme */}
                    <SongCard song={song} rank={trenutniRank} variant="standard" />

                    {/* --- 2. REKLAMA: Posle 25. mesta --- */}
                    {trenutniRank === 25 && (
                      <div className="col-span-full py-4">
                        <AdSenseBanner adSlot={trenutniSlotovi.mid1} />
                      </div>
                    )}

                    {/* --- 3. REKLAMA: Posle 50. mesta --- */}
                    {trenutniRank === 50 && (
                      <div className="col-span-full py-4">
                        <AdSenseBanner adSlot={trenutniSlotovi.mid2} />
                      </div>
                    )}

                    {/* --- 4. REKLAMA: Posle 75. mesta --- */}
                    {trenutniRank === 75 && (
                      <div className="col-span-full py-4">
                        <AdSenseBanner adSlot={trenutniSlotovi.mid3} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* --- 5. REKLAMA: NA SAMOM DNU STRANICE --- */}
        <div className="pt-12">
          <AdSenseBanner adSlot={trenutniSlotovi.bottom} />
        </div>


{/* PREDLOZI (Sada su spušteni na dno, dobijaju ID i rastežu se preko celog ekrana) */}
      {/* PREDLOZI: DODATA MINIMALNA VISINA I ŠIRINA */}
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