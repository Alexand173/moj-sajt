'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function USPage() {
  // Rešena TypeScript greška dodavanjem <any[]>
  const [songs, setSongs] = useState<any[]>([]);
  const [selectedSong, setSelectedSong] = useState<any>(null);

  useEffect(() => {
    async function fetchUSCharts() {
      const { data } = await supabase
        .from('songs')
        .select('*')
        .eq('region', 'US')
        .order('votes', { ascending: false })
        .limit(100);
      setSongs(data || []);
    }
    fetchUSCharts();
  }, []);

  // Funkcija koja pravi embed link koristeći tvoj youtube_id iz baze
  const getVideoSrc = (id: string) => {
    if (!id) return null;
    return `https://www.youtube.com/embed/${id}`;
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white pt-32 pb-20 px-4 md:px-10">
      <div className="max-w-7xl mx-auto">
        
        {/* NASLOV STRANICE */}
        <div className="mb-12 border-l-4 border-red-600 pl-6">
          <h1 className="text-6xl font-black italic tracking-tighter uppercase">US TOP 100</h1>
          <p className="text-zinc-500 tracking-[0.5em] text-[10px] font-bold uppercase">Official United States Chart</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* --- BROJ 1: NAJVEĆI PROZOR (Zauzima ceo red) --- */}
          {songs[0] && (
            <div className="md:col-span-2 group bg-zinc-900/40 rounded-[3rem] overflow-hidden border border-white/10 hover:border-red-600/50 transition-all shadow-2xl">
              <div className="aspect-video w-full bg-black">
                <iframe 
                  src={getVideoSrc(songs[0].youtube_id) || ''}
                  className="w-full h-full"
                  allowFullScreen
                />
              </div>
              <div className="p-8 flex justify-between items-center bg-gradient-to-t from-black to-transparent">
                <div>
                  <span className="text-red-600 font-black italic text-5xl mr-4">#01</span>
                  <h2 className="inline text-4xl md:text-5xl font-black uppercase tracking-tighter">{songs[0].title}</h2>
                  <p className="text-zinc-400 text-lg mt-1 font-medium">{songs[0].artist_name}</p>
                </div>
                <button 
                  onClick={() => setSelectedSong(songs[0])}
                  className="bg-white text-black px-10 py-4 rounded-full font-black hover:bg-red-600 hover:text-white transition-all shadow-lg"
                >
                  VIEW DETAILS
                </button>
              </div>
            </div>
          )}

          {/* --- BROJ 2 I 3: SREDNJI PROZORI (Jedan pored drugog) --- */}
          {songs.slice(1, 3).map((song, i) => (
            <div key={song.id} className="bg-zinc-900/30 rounded-[2.5rem] overflow-hidden border border-white/5 hover:border-zinc-500 transition-all shadow-xl">
              <div className="aspect-video bg-black">
                <iframe 
                  src={getVideoSrc(song.youtube_id) || ''}
                  className="w-full h-full"
                  allowFullScreen
                />
              </div>
              <div className="p-6 flex justify-between items-center">
                <div>
                  <span className="text-zinc-600 font-black italic text-3xl mr-3">#0{i + 2}</span>
                  <h3 className="inline text-xl font-bold uppercase tracking-tight">{song.title}</h3>
                  <p className="text-zinc-500 text-xs mt-1">{song.artist_name}</p>
                </div>
                <button 
                  onClick={() => setSelectedSong(song)}
                  className="text-[10px] font-black border border-white/20 px-5 py-2 rounded-full hover:bg-white hover:text-black transition-all"
                >
                  INFO
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* --- OSTALIH 97: STANDARDNA LISTA --- */}
        <div className="mt-16 space-y-3">
          <div className="px-8 py-2 text-[10px] font-bold text-zinc-600 tracking-[0.3em] flex justify-between uppercase">
            <span>Rank & Artist</span>
            <span>MTA Points</span>
          </div>
          {songs.slice(3).map((song, i) => (
            <div 
              key={song.id} 
              onClick={() => setSelectedSong(song)}
              className="flex items-center justify-between p-5 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-zinc-900 transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-8">
                <span className="text-zinc-800 font-black italic text-lg w-8">{(i + 4).toString().padStart(2, '0')}</span>
                <div>
                  <h4 className="font-bold uppercase group-hover:text-red-500 transition-colors tracking-tight">{song.title}</h4>
                  <p className="text-[10px] text-zinc-500 uppercase font-medium">{song.artist_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-10">
                <span className="text-[10px] font-bold text-zinc-700 bg-white/5 px-3 py-1 rounded-md uppercase">{song.genre}</span>
                <span className="text-lg font-mono font-black text-zinc-400 group-hover:text-white">{song.votes.toLocaleString()}</span>
                <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center group-hover:bg-red-600 group-hover:border-red-600 transition-all">
                  <span className="text-[10px]">▶</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* --- POP-UP MODAL PROZOR --- */}
      {selectedSong && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10 bg-black/95 backdrop-blur-md">
          <div className="bg-[#0a0a0a] border border-white/10 p-8 md:p-12 rounded-[3rem] max-w-4xl w-full relative overflow-y-auto max-h-[90vh]">
            <button 
              onClick={() => setSelectedSong(null)}
              className="absolute top-8 right-10 text-4xl font-light text-zinc-500 hover:text-white transition-colors"
            >
              ×
            </button>
            
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div className="aspect-video md:aspect-square rounded-3xl overflow-hidden border border-white/5 shadow-2xl">
                <iframe 
                  src={`${getVideoSrc(selectedSong.youtube_id)}?autoplay=1`}
                  className="w-full h-full"
                  allow="autoplay"
                  allowFullScreen
                />
              </div>
              
              <div className="text-left">
                <span className="text-red-600 font-black tracking-widest text-xs uppercase bg-red-600/10 px-3 py-1 rounded-full">Official Entry</span>
                <h2 className="text-5xl font-black uppercase mt-4 leading-none tracking-tighter">{selectedSong.title}</h2>
                <p className="text-2xl text-zinc-400 font-medium mt-2 mb-8">{selectedSong.artist_name}</p>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-white/5 rounded-2xl">
                    <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Genre</p>
                    <p className="font-bold text-white uppercase">{selectedSong.genre}</p>
                  </div>
                  <div className="p-4 bg-white/5 rounded-2xl">
                    <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">MTA Points</p>
                    <p className="text-2xl font-black text-yellow-500">{selectedSong.votes}</p>
                  </div>
                </div>

                <button className="w-full mt-8 bg-white text-black font-black py-4 rounded-2xl hover:bg-red-600 hover:text-white transition-all uppercase tracking-widest">
                  Vote for this artist
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}