'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

interface Song {
  id: string;
  title: string;
  artist_name: string;
  slika_url: string;
  youtube_id: string;
  votes: number;
}

interface SongCardProps {
  song: Song;
  rank: number;
  variant?: 'big' | 'medium' | 'standard';
}

export default function SongCard({ song, rank, variant = 'standard' }: SongCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const router = useRouter();

  // KORIGOVANI STILOVI (Smanjen naslov pesme, zadržan jak artist i rank)
  const cardSpecs = {
    big: {
      container: "h-[500px] md:h-[650px] border-purple-500/40 shadow-[0_0_50px_rgba(147,51,234,0.2)]",
      title: "text-3xl md:text-5xl", // Smanjeno sa 4xl/7xl
      artist: "text-sm md:text-lg tracking-[0.2em]",
      rankText: "text-7xl md:text-9xl text-purple-400/40 drop-shadow-[0_0_20px_rgba(168,85,247,0.4)]",
      padding: "p-8 md:p-12"
    },
    medium: {
      container: "h-[350px] md:h-[450px] border-white/10 shadow-xl",
      title: "text-xl md:text-3xl", // Smanjeno sa 2xl/4xl
      artist: "text-[12px] md:text-sm tracking-[0.15em]",
      rankText: "text-6xl md:text-7xl text-white/20 drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]",
      padding: "p-6 md:p-8"
    },
    standard: {
      container: "h-[300px] md:h-[380px] border-white/5",
      title: "text-lg md:text-xl", // Smanjeno sa xl/2xl
      artist: "text-[11px] md:text-[13px] tracking-[0.1em]",
      rankText: "text-4xl md:text-5xl text-white/15",
      padding: "p-5 md:p-6"
    }
  };

  const currentStyle = cardSpecs[variant];

  const handleVote = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isVoting) return;
    setIsVoting(true);
    try {
      const response = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songId: song.id }),
      });
      if (response.ok) router.refresh();
    } catch (error) {
      console.error('Greška:', error);
    } finally {
      setIsVoting(false);
    }
  };

  return (
    <div
      className="relative transition-all duration-500 ease-out"
      style={{ transform: isHovered ? 'scale(1.01)' : 'scale(1)' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`relative bg-[#080808] rounded-[2.5rem] md:rounded-[3.5rem] overflow-hidden border transition-all duration-700 group ${currentStyle.container}`}>
        
        {/* MEDIA AREA */}
        <div className="absolute inset-0 w-full h-full">
          <Image
            src={song.slika_url || '/placeholder.png'}
            alt={song.title}
            fill
            className={`object-cover transition-all duration-1000 ${isHovered ? 'scale-110 blur-2xl opacity-30' : 'scale-100 opacity-60'}`}
          />

          {isHovered && song.youtube_id && (
            <div className="absolute inset-0 flex items-center justify-center p-4 md:p-8 animate-in zoom-in-110 fade-in duration-500">
              <div className="w-full h-full rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl bg-black relative">
                <iframe
                  src={`https://www.youtube.com/embed/${song.youtube_id}?autoplay=1&controls=0&mute=0&loop=1&playlist=${song.youtube_id}&modestbranding=1`}
                  className="absolute inset-0 w-full h-full object-cover scale-[1.5]"
                  allow="autoplay; encrypted-media"
                />
              </div>
            </div>
          )}
        </div>

        {/* INFO OVERLAY */}
        <div className={`absolute inset-x-0 bottom-0 ${currentStyle.padding} bg-gradient-to-t from-black via-black/95 to-transparent`}>
          <div className="flex items-end justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className={`font-black uppercase tracking-tighter leading-[0.9] truncate group-hover:text-purple-400 transition-colors ${currentStyle.title}`}>
                {song.title}
              </h3>
              {/* IME ARTISTA - Povećan font i promenjena boja u zinc-400 za bolji kontrast */}
              <p className={`font-black uppercase text-zinc-400 mt-4 ${currentStyle.artist}`}>
                {song.artist_name}
              </p>
            </div>

            {/* REDNI BROJ - Dodat drop-shadow i jači opacity */}
            <div className={`font-black italic leading-none select-none transition-all duration-500 group-hover:text-purple-500/50 ${currentStyle.rankText}`}>
              {rank < 10 ? `0${rank}` : rank}
            </div>
          </div>

          <div className="mt-8 h-[2px] w-full bg-white/5 rounded-full overflow-hidden">
            <div className={`h-full bg-purple-500 transition-all duration-[7000ms] ease-linear ${isHovered ? 'w-full' : 'w-0'}`} />
          </div>
        </div>

        {/* VOTE BUTTON */}
        <button 
          onClick={handleVote}
          disabled={isVoting}
          className={`absolute top-6 right-6 z-30 px-5 py-2.5 rounded-full border backdrop-blur-2xl flex items-center gap-2 transition-all active:scale-90 ${
            variant === 'big' 
              ? 'bg-purple-600 border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.4)]' 
              : 'bg-white/10 border-white/20 hover:bg-purple-600 hover:border-purple-400'
          }`}
        >
          <span className={isVoting ? 'animate-bounce' : ''}>🔥</span>
          <span className="font-black text-sm md:text-base text-white">{song.votes || 0}</span>
        </button>
      </div>
    </div>
  );
}