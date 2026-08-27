'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Flame, Play } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { ChartSong } from '@/lib/chart-types';

interface SongCardProps {
  song: ChartSong;
  rank: number;
  variant?: 'big' | 'medium' | 'standard';
}

const cardHeights = {
  big: 'h-[17rem] sm:h-[22rem] lg:h-[26rem]',
  medium: 'h-[11rem] sm:h-[14rem] lg:h-[15rem]',
  standard: 'h-[11rem] sm:h-[12rem] lg:h-[12.5rem]',
} as const;

const titleSizes = {
  big: 'text-3xl sm:text-5xl lg:text-6xl',
  medium: 'text-2xl sm:text-3xl lg:text-4xl',
  standard: 'text-xl sm:text-2xl',
} as const;

const rankSizes = {
  big: 'text-7xl sm:text-8xl lg:text-9xl',
  medium: 'text-5xl sm:text-6xl lg:text-7xl',
  standard: 'text-4xl sm:text-5xl',
} as const;

export default function SongCard({ song, rank, variant = 'standard' }: SongCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const router = useRouter();
  const rankLabel = String(rank).padStart(2, '0');

  const handleVote = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
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
    <article
      className={`group relative overflow-hidden border bg-ink-elevated transition-colors duration-300 ${variant === 'big' ? 'border-accent-red/80 shadow-[0_0_40px_-8px_rgb(230_57_70_/_0.5)]' : 'border-white/10 hover:border-white/30'} ${cardHeights[variant]}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="absolute inset-0 bg-ink">
        {song.slika_url ? (
          <Image
            src={song.slika_url}
            alt={`${song.title} by ${song.artist_name}`}
            fill
            unoptimized
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 1600px"
            className={`object-cover transition-transform duration-700 ${isHovered ? 'scale-105' : 'scale-100'} ${isHovered && song.youtube_id ? 'opacity-25 blur-sm' : 'opacity-80'}`}
          />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(circle_at_30%_20%,rgb(230_57_70_/_0.3),transparent_42%),linear-gradient(135deg,#121212,#08090a)]" aria-hidden="true" />
        )}
        <div className="mt-image-overlay absolute inset-0" />
      </div>

      {isHovered && song.youtube_id && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-4 sm:p-8">
          <div className="relative h-full w-full overflow-hidden border border-white/20 bg-ink shadow-2xl">
            <iframe
              src={`https://www.youtube.com/embed/${song.youtube_id}?autoplay=1&controls=0&loop=1&playlist=${song.youtube_id}&modestbranding=1`}
              title={`${song.title} preview`}
              className="absolute inset-0 h-full w-full scale-125 object-cover"
              allow="autoplay; encrypted-media"
              loading="lazy"
            />
          </div>
        </div>
      )}

      <div className="absolute right-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-ink/75 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-md sm:right-4 sm:top-4">
        <Flame aria-hidden="true" className={`size-3 ${song.votes ? 'fill-accent-red text-accent-red' : 'text-white/45'}`} />
        <span className="tabular-nums">{song.votes || 0}</span>
      </div>

      <button
        type="button"
        onClick={handleVote}
        disabled={isVoting}
        aria-label={`Vote for ${song.title} by ${song.artist_name}`}
        className="absolute bottom-3 right-3 z-20 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-ink/80 px-2.5 py-1.5 text-[9px] font-black tracking-[0.1em] text-white backdrop-blur-md transition-colors hover:border-accent-red hover:bg-accent-red disabled:cursor-wait disabled:opacity-60 sm:bottom-4 sm:right-4"
      >
        <span aria-hidden="true">{isVoting ? '…' : '↑'}</span>
        <span>{isVoting ? 'Voting' : 'Vote'}</span>
      </button>

      <div className="absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-4 p-4 sm:p-6 lg:p-7">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            {variant === 'big' && <span className="mt-meta text-accent-red">Featured</span>}
            {song.youtube_id && variant !== 'big' && (
              <span className="inline-flex items-center gap-1 text-[9px] font-black tracking-[0.14em] text-white/50 uppercase">
                <Play aria-hidden="true" className="size-2.5 fill-current" />
                Official
              </span>
            )}
          </div>
          <h2 className={`truncate font-black leading-[0.9] tracking-[-0.045em] text-white uppercase transition-colors group-hover:text-white ${titleSizes[variant]}`}>
            {song.title}
          </h2>
          <p className="mt-1.5 truncate text-[10px] font-bold tracking-[0.12em] text-white/60 uppercase sm:text-xs">
            {song.artist_name}
          </p>
        </div>

        <span
          aria-label={`Rank ${rank}`}
          className={`shrink-0 font-black leading-none tabular-nums text-transparent ${rankSizes[variant]}`}
          style={{ WebkitTextStroke: '1.5px rgb(230 57 70 / 0.7)' }}
        >
          {rankLabel}
        </span>
      </div>
    </article>
  );
}
