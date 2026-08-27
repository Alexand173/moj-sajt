'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import AwardsHero, { type CountdownValues } from '@/components/AwardsHero';
import LeaderCard, { type LeaderEntry } from '@/components/LeaderCard';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
  genre_name?: string;
  genre_slug?: string;
  fetched_artist_image?: string;
}

function getGenreDetails(genreId: number) {
  const genres: Record<number, { name: string; slug: string }> = {
    1: { name: 'Rock', slug: 'rock' },
    2: { name: 'Pop', slug: 'pop' },
    3: { name: 'Hip-Hop', slug: 'hip-hop' },
    4: { name: 'R&B/Soul', slug: 'rb-soul' },
    5: { name: 'Country', slug: 'country' },
    6: { name: 'Dance/Electronic', slug: 'dance-electronic' },
    7: { name: 'J-POP', slug: 'j-pop' },
    8: { name: 'J-ROCK & METAL', slug: 'j-rock-metal' },
    9: { name: 'K-POP', slug: 'k-pop' },
    10: { name: 'C-POP', slug: 'c-pop' },
    11: { name: 'INDIA', slug: 'india' },
    12: { name: 'OTHER', slug: 'other' },
    15: { name: 'Metal', slug: 'metal' },
  };
  return genres[genreId] || { name: 'Music', slug: 'music' };
}

async function fetchArtistImage(artistName: string): Promise<string | null> {
  try {
    const formattedName = encodeURIComponent(artistName.trim());
    const response = await fetch(`https://itunes.apple.com/search?term=${formattedName}&entity=musicArtist&limit=1`);
    const data = await response.json();

    if (data.results && data.results.length > 0 && data.results[0].primaryGenreName) {
      const trackResponse = await fetch(`https://itunes.apple.com/search?term=${formattedName}&entity=musicTrack&limit=1`);
      const trackData = await trackResponse.json();
      if (trackData.results && trackData.results.length > 0 && trackData.results[0].artworkUrl100) {
        return trackData.results[0].artworkUrl100.replace('100x100bb', '600x600bb');
      }
    }
    return null;
  } catch (error) {
    console.error('Greška pri povlačenju slike sa iTunes-a:', error);
    return null;
  }
}

export default function AwardsPage() {
  const [winners, setWinners] = useState<Song[]>([]);
  const [timeLeft, setTimeLeft] = useState<CountdownValues>({ d: 0, h: 0, m: 0, s: 0 });

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

  useEffect(() => {
    async function getWinners() {
      const { data, error } = await supabase.from('songs').select('*').order('votes', { ascending: false });
      if (error || !data) {
        console.error('Greška pri učitavanju pesama:', error);
        return;
      }

      const mapWinners: Record<string, Song> = {};
      data.forEach((rawSong: Song) => {
        const details = getGenreDetails(Number(rawSong.genre_id));
        const song = { ...rawSong, genre_name: details.name, genre_slug: details.slug };
        const region = (song.region || 'unknown').trim().toLowerCase();
        const key = `${region}_${details.slug}`;
        if (!mapWinners[key]) mapWinners[key] = song;
      });

      const winnersArray = Object.values(mapWinners).sort((a, b) => b.votes - a.votes);
      const winnersWithImages = await Promise.all(winnersArray.map(async (song) => {
        if (!song.slika_url) return { ...song, fetched_artist_image: (await fetchArtistImage(song.artist_name)) || undefined };
        return song;
      }));
      setWinners(winnersWithImages);
    }

    getWinners();
  }, []);

  return (
    <div className="mt-page">
      <AwardsHero timeLeft={timeLeft} />
      <main className="mx-auto max-w-[1200px] px-6 py-12 sm:py-16 lg:py-20">
        <div className="mb-10 flex items-center gap-2"><span className="text-awards-gold">♛</span><h2 className="text-xs font-black tracking-[0.25em] text-white uppercase">Current leaders · #1 songs</h2></div>
        {winners.length > 0 ? (
          <div className="space-y-10">
            {winners.map((song) => {
              const genreName = song.genre_name || 'Music';
              const genreSlug = song.genre_slug || 'music';
              const region = song.region || 'Global';
              const dynamicFolderLink = `/region/${encodeURIComponent(region.toLowerCase())}/${encodeURIComponent(genreSlug.toLowerCase())}`;
              const entry: LeaderEntry = { id: song.id, title: song.title, artist_name: song.artist_name, image: song.slika_url || song.fetched_artist_image, votes: song.votes, genre_name: genreName, youtube_id: song.youtube_id, rank: 1 };

              return (
                <section key={song.id}>
                  <h3 className="mb-4 flex items-center gap-3 text-sm font-black tracking-[0.14em] text-white uppercase sm:text-base"><span className="h-px w-7 bg-awards-gold" /><span>Best <Link href={dynamicFolderLink} className="text-awards-gold transition-colors hover:text-white">{genreName}</Link> song in <Link href={dynamicFolderLink} className="text-white transition-colors hover:text-awards-gold">{region}</Link> for 2026 year</span></h3>
                  <LeaderCard entry={entry} />
                </section>
              );
            })}
          </div>
        ) : (
          <div className="border border-white/10 bg-ink-elevated px-6 py-20 text-center text-[10px] font-bold tracking-[0.16em] text-white/45 uppercase">Calculating 2026 category leaders from database...</div>
        )}
        <p className="mx-auto mt-16 max-w-xl text-center text-xs italic leading-relaxed text-white/40">MTA Trophy represents the absolute peak of listener engagement. The artist with the most total votes across all regions is crowned the Global Artist of the Year.</p>
      </main>
    </div>
  );
}
