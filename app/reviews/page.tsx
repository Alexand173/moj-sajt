import { createClient } from '@supabase/supabase-js';
import SongCard from '@/components/SongCard';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function HomePage() {
  const { data: songs } = await supabase
    .from('songs')
    .select('*')
    .order('votes', { ascending: false }); // Najviše glasova ide na prvo mesto

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-x-hidden selection:bg-purple-500">
      {/* DINAMIČKA POZADINA */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-900/20 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-pink-900/10 blur-[120px] rounded-full animate-pulse" />
      </div>

      {/* NAVIGACIJA */}
      <nav className="fixed top-6 w-full z-[100] px-6">
        <div className="max-w-5xl mx-auto flex justify-between items-center bg-white/5 backdrop-blur-2xl border border-white/10 rounded-full px-8 py-3 shadow-2xl">
          <div className="text-2xl font-black italic tracking-tighter">M<span className="text-purple-500">T</span></div>
          <div className="hidden md:flex gap-8 text-[10px] font-black tracking-[0.3em] text-zinc-500">
            <a href="#" className="hover:text-purple-400 transition-all">GLOBAL CHARTS</a>
            <a href="#" className="hover:text-purple-400 transition-all">COLLECTIONS</a>
          </div>
          <button className="text-[10px] font-black tracking-widest bg-white text-black px-6 py-2 rounded-full hover:bg-purple-500 hover:text-white transition-all">GET ACCESS</button>
        </div>
      </nav>

      {/* FEATURE SECTION (HERO) */}
      <section className="pt-44 pb-20 px-6 relative">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            <span className="text-[10px] font-black tracking-[0.4em] text-red-500 uppercase">Live Data Feed 2026</span>
          </div>
          <h1 className="text-[12vw] md:text-[8vw] font-black leading-[0.8] tracking-tighter mb-8 bg-gradient-to-b from-white via-white to-white/20 bg-clip-text text-transparent uppercase">
            The Elite 50.
          </h1>
          <p className="text-zinc-500 max-w-lg mx-auto text-xs tracking-[0.2em] uppercase font-bold leading-relaxed">
            Curated selection of global streaming heavyweights. 
          </p>
        </div>
      </section>

      {/* MARQUEE (TRAKA KOJA TEČE) */}
      <div className="py-10 border-y border-white/5 bg-white/[0.02] mb-20 overflow-hidden whitespace-nowrap">
        <div className="flex animate-marquee">
          {[1,2,3,4].map((i) => (
            <span key={i} className="text-4xl font-black italic tracking-tighter mx-10 opacity-20">
              NEW RELEASES • TRENDING NOW • GLOBAL TOP CHARTS • UPCOMING ARTISTS • 
            </span>
          ))}
        </div>
      </div>

      {/* GRID SA PESMAMA */}
      <main className="max-w-[1600px] mx-auto px-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-16 pb-40">
        {songs?.map((song, i) => (
          <SongCard key={song.id} song={song} rank={i + 1} />
        ))}
      </main>
    </div>
  );
}