'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Song {
  id: string;
  title: string;
  artist_name: string;
  slika_url?: string;       
  votes: number;            
  region?: string;          
  youtube_id?: string;      
  genre_id?: number;        
  
  // Naša ručna polja
  genre_name?: string;      
  genre_slug?: string;      
  fetched_artist_image?: string; // Polje gde upisujemo sliku koju povučemo sa interneta
}

export default function AwardsPage() {
  const [winners, setWinners] = useState<Song[]>([]);
  const [timeLeft, setTimeLeft] = useState({ d: 0, h: 0, m: 0, s: 0 });

  // TAJMER
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

  // FUNKCIJA KOJA AUTOMATSKI POVLAČI SLIKU BNDA/ARTISTA SA ITUNES-A
  async function fetchArtistImage(artistName: string): Promise<string | null> {
    try {
      const formattedName = encodeURIComponent(artistName.trim());
      // Pretražujemo iTunes bazu za izvođača
      const response = await fetch(`https://itunes.apple.com/search?term=${formattedName}&entity=musicArtist&limit=1`);
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        // iTunes nekada ne vrati sliku za "musicArtist" entitet, pa ako je nema, tražimo preko najpopularnije pesme tog artista
        if (data.results[0].primaryGenreName) {
          const trackResponse = await fetch(`https://itunes.apple.com/search?term=${formattedName}&entity=musicTrack&limit=1`);
          const trackData = await trackResponse.json();
          if (trackData.results && trackData.results.length > 0) {
            // Vraćamo sliku albuma u visokoj rezoluciji (menjamo 100x100 sa 600x600)
            return trackData.results[0].artworkUrl100.replace('100x100bb', '600x600bb');
          }
        }
      }
      return null;
    } catch (err) {
      console.error("Greška pri povlačenju slike sa iTunes-a:", err);
      return null;
    }
  }

  // DOVLAČENJE PODATAKA
  useEffect(() => {
    async function getWinners() {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .order('votes', { ascending: false }); 

      if (error || !data) {
        console.error("Greška pri učitavanju pesama:", error);
        return;
      }

      const mapWinners: Record<string, Song> = {};

      // Mapiramo žanrove
      data.forEach((song: any) => {
        let name = 'Music';
        let slug = 'music';
        const gId = Number(song.genre_id);

        if (gId === 1) { name = 'Rock'; slug = 'rock'; }
        else if (gId === 2) { name = 'Pop'; slug = 'pop'; }
        else if (gId === 3) { name = 'Hip-Hop'; slug = 'hip-hop'; }
        else if (gId === 4) { name = 'R&B/Soul'; slug = 'rb-soul'; }
        else if (gId === 5) { name = 'Country'; slug = 'country'; }
        else if (gId === 6) { name = 'Dance/Electronic'; slug = 'dance-electronic'; }
        else if (gId === 7) { name = 'J-POP'; slug = 'j-pop'; }
        else if (gId === 8) { name = 'J-ROCK & METAL'; slug = 'j-rock-metal'; }
        else if (gId === 9) { name = 'K-POP'; slug = 'k-pop'; }
        else if (gId === 10) { name = 'C-POP'; slug = 'c-pop'; }
        else if (gId === 11) { name = 'INDIA'; slug = 'india'; }
        else if (gId === 12) { name = 'OTHER'; slug = 'other'; }

        song.genre_name = name;
        song.genre_slug = slug;

        const reg = (song.region || 'unknown').trim().toLowerCase();
        const kljuc = `${reg}_${slug}`;

        if (!mapWinners[kljuc]) {
          mapWinners[kljuc] = song;
        }
      });

      const winnersArray = Object.values(mapWinners).sort((a, b) => b.votes - a.votes);

      // Sada za svakog pobednika povlačimo sliku izvođača ako nema već upisan `slika_url` u bazi
      const winnersWithImages = await Promise.all(
        winnersArray.map(async (song) => {
          if (!song.slika_url) {
            const onlineImage = await fetchArtistImage(song.artist_name);
            return {
              ...song,
              fetched_artist_image: onlineImage || undefined
            };
          }
          return song;
        })
      );

      setWinners(winnersWithImages);
    }

    getWinners();
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-white pt-32 pb-20 px-6">
      
      {/* HEADER */}
      <div className="max-w-5xl mx-auto text-center mb-16">
        <h1 className="text-5xl md:text-7xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-yellow-100 to-yellow-600 mb-6 uppercase">
          Music Top Awards
        </h1>
        
        {/* TAJMER */}
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

      {/* KARTICE POBEDNIKA */}
      <div className="max-w-4xl mx-auto space-y-12">
        
        {winners.length > 0 ? (
          winners.map((song, i) => {
            // Ako postoji slika u bazi, koristi nju. Ako ne, koristi sliku koju smo povukli sa iTunes-a.
            const slikaArtista = song.slika_url || song.fetched_artist_image;
            const youtubeLink = song.youtube_id ? `https://www.youtube.com/watch?v=${song.youtube_id}` : null;

            const genreNameToShow = song.genre_name || 'Music'; 
            const genreSlug = song.genre_slug || 'music';       
            const regionText = song.region || 'Global';

            const dynamicFolderLink = `/region/${encodeURIComponent(regionText.toLowerCase())}/${encodeURIComponent(genreSlug.toLowerCase())}`;

            return (
              <div key={song.id} className="space-y-4">
                
                {/* 🏷️ NASLOV KATEGORIJE - SA RAZMACIMA */}
                <h2 className="text-lg md:text-xl font-bold tracking-tight text-zinc-400 pl-2 border-l-2 border-yellow-500/50 uppercase">
                  <span>Best </span>
                  
                  <Link 
                    href={dynamicFolderLink}
                    className="text-yellow-500 hover:text-yellow-400 transition-colors underline decoration-yellow-500/30 underline-offset-4 font-black inline"
                  >
                    {genreNameToShow}
                  </Link>

                  <span> Song in </span>

                  <Link 
                    href={dynamicFolderLink}
                    className="text-white hover:text-yellow-500 transition-colors underline decoration-white/20 underline-offset-4 font-black inline"
                  >
                    {regionText}
                  </Link>

                  <span> for 2026 Year</span>
                </h2>

                {/* KARTICA TABELE */}
                <div 
                  className={`group relative overflow-hidden rounded-2xl border transition-all duration-500 ${
                    i === 0 ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-white/5 bg-white/[0.02]'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 md:p-8 relative z-10 gap-6">
                    
                    <div className="flex items-center gap-6">
                      
                      <span className={`text-2xl md:text-4xl font-black italic ${i === 0 ? 'text-yellow-500' : 'text-zinc-700'}`}>
                        {String(i + 1).padStart(2, '0')}
                      </span>

                      {/* BOX ZA SLIKU */}
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-zinc-850 border border-white/10 flex-shrink-0 relative shadow-inner">
                        {slikaArtista ? (
                          <img 
                            src={slikaArtista}
                            alt={song.artist_name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-350"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : null}
                        
                        {!slikaArtista && (
                          <div className="absolute inset-0 flex items-center justify-center bg-zinc-800 text-zinc-500 font-bold uppercase text-2xl">
                            {song.artist_name ? song.artist_name.charAt(0) : '?'}
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <h3 className="text-lg md:text-xl font-bold uppercase tracking-tight group-hover:text-yellow-500 transition-colors">
                          {song.title}
                        </h3>
                        <p className="text-zinc-400 text-sm font-medium mb-2">{song.artist_name}</p>

                        {youtubeLink && (
                          <a
                            href={youtubeLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-yellow-500 hover:text-yellow-400 transition-colors bg-yellow-500/10 hover:bg-yellow-500/20 px-3.5 py-1.5 rounded-lg border border-yellow-500/20 mt-1"
                          >
                            <span>▶</span> Play Song
                          </a>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-left sm:text-right flex sm:flex-col justify-between sm:justify-center items-center sm:items-end border-t border-white/5 sm:border-0 pt-4 sm:pt-0">
                      <div>
                        <div className="text-[10px] font-black text-yellow-600 tracking-tighter uppercase mb-0.5">
                          MTA Points
                        </div>
                        <div className="text-xl md:text-2xl font-mono font-black">
                          {song.votes.toLocaleString()}
                        </div>
                      </div>
                      <div className="hidden sm:block text-zinc-600 text-xs italic font-semibold mt-2">
                        ⭐ #1 {genreNameToShow}
                      </div>
                    </div>

                  </div>

                  {i === 0 && (
                    <div className="absolute bottom-0 left-0 h-[2px] bg-yellow-500 w-full shadow-[0_0_15px_#eab308]"></div>
                  )}
                </div>

              </div>
            );
          })
        ) : (
          <div className="text-center py-20 text-zinc-600">
            Calculating 2026 category leaders from database...
          </div>
        )}
      </div>
      
      {/* FOOTER */}
      <div className="max-w-xl mx-auto mt-20 text-center">
        <div className="w-12 h-[1px] bg-yellow-600/30 mx-auto mb-6"></div>
        <p className="text-zinc-600 text-xs leading-relaxed italic">
          MTA Trophy represents the absolute peak of listener engagement. The artist with the most total votes across all regions is crowned the Global Artist of the Year.
        </p>
      </div>
    </div>
  );
}