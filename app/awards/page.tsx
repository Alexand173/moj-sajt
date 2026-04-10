'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AwardsPage() {
  // Popravljamo TypeScript grešku dodavanjem <any[]>
  const [winners, setWinners] = useState<any[]>([]);
  const [timeLeft, setTimeLeft] = useState({ d: 0, h: 0, m: 0, s: 0 });

  // TAJMER LOGIKA
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const currentYear = now.getFullYear();
      const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);
      const diff = endOfYear.getTime() - now.getTime();

      if (diff > 0) {
        setTimeLeft({
          d: Math.floor(diff / (1000 * 60 * 60 * 24)),
          h: Math.floor((diff / (1000 * 60 * 60)) % 24),
          m: Math.floor((diff / 1000 / 60) % 60),
          s: Math.floor((diff / 1000) % 60),
        });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // LEADERBOARD LOGIKA
  useEffect(() => {
    async function getTopVoted() {
      const { data } = await supabase
        .from('songs')
        .select('*')
        .order('votes', { ascending: false })
        .limit(10);
      setWinners(data || []);
    }
    getTopVoted();
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-white pt-32 pb-20 px-6">
      {/* --- HEADER SEKCIJA --- */}
      <div className="max-w-5xl mx-auto text-center mb-16">
        <h1 className="text-5xl md:text-7xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-yellow-100 to-yellow-600 mb-6 uppercase">
          Music Top Awards
        </h1>
        
        {/* --- COUNTDOWN BOX --- */}
        <div className="inline-flex gap-4 md:gap-8 bg-white/5 border border-yellow-500/20 p-6 rounded-3xl backdrop-blur-xl shadow-[0_0_50px_rgba(234,179,8,0.05)]">
          <div className="text-center">
            <div className="text-3xl md:text-5xl font-black text-yellow-500">{timeLeft.d}</div>
            <div className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase">Days</div>
          </div>
          <div className="text-3xl md:text-5xl font-light text-zinc-800 self-center">:</div>
          <div className="text-center">
            <div className="text-3xl md:text-5xl font-black text-yellow-500">{timeLeft.h}</div>
            <div className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase">Hours</div>
          </div>
          <div className="text-3xl md:text-5xl font-light text-zinc-800 self-center">:</div>
          <div className="text-center">
            <div className="text-3xl md:text-5xl font-black text-yellow-500">{timeLeft.m}</div>
            <div className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase">Mins</div>
          </div>
          <div className="text-3xl md:text-5xl font-light text-zinc-800 self-center">:</div>
          <div className="text-center">
            <div className="text-3xl md:text-5xl font-black text-white animate-pulse">{timeLeft.s}</div>
            <div className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase">Secs</div>
          </div>
        </div>
        <p className="mt-6 text-zinc-500 text-[10px] tracking-[0.4em] uppercase font-bold">Until Global Winners Announcement</p>
      </div>

      {/* --- LEADERBOARD --- */}
      <div className="max-w-3xl mx-auto space-y-4">
        {winners.map((song, i) => (
          <div 
            key={song.id} 
            className={`group relative overflow-hidden rounded-2xl border transition-all duration-500 ${
              i === 0 ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-white/5 bg-white/[0.02]'
            }`}
          >
            <div className="flex items-center justify-between p-5 md:p-8 relative z-10">
              <div className="flex items-center gap-6">
                <span className={`text-2xl md:text-4xl font-black italic ${i === 0 ? 'text-yellow-500' : 'text-zinc-800'}`}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3 className="text-lg md:text-xl font-bold uppercase tracking-tight group-hover:text-yellow-500 transition-colors">
                    {song.title}
                  </h3>
                  <p className="text-zinc-500 text-sm">{song.artist_name}</p>
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-[10px] font-black text-yellow-600 tracking-tighter uppercase mb-1">MTA Points</div>
                <div className="text-xl md:text-2xl font-mono font-black">{song.votes.toLocaleString()}</div>
              </div>
            </div>

            {/* Zlatni progres bar za prvo mesto */}
            {i === 0 && (
              <div className="absolute bottom-0 left-0 h-[2px] bg-yellow-500 w-full shadow-[0_0_15px_#eab308]"></div>
            )}
          </div>
        ))}
      </div>
      
      {/* --- FOOTER INFO --- */}
      <div className="max-w-xl mx-auto mt-20 text-center">
        <div className="w-12 h-[1px] bg-yellow-600/30 mx-auto mb-6"></div>
        <p className="text-zinc-600 text-xs leading-relaxed italic">
          MTA Trophy represents the absolute peak of listener engagement. The artist with the most total votes across all regions is crowned the Global Artist of the Year.
        </p>
      </div>
    </div>
  );
}