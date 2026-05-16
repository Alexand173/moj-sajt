'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Suggestion {
  id: string;
  artist_name: string;
  song_title: string;
  youtube_id: string;
  votes: number;
}

interface SuggestionListProps {
  refreshTrigger: boolean;
  currentRegion: string;
  currentGenreId?: number | string;
}

export default function SuggestionList({ 
  refreshTrigger, 
  currentRegion, 
  currentGenreId 
}: SuggestionListProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [votingId, setVotingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchSuggestions = async () => {
      setLoading(true);
      setErrorMessage(null);

      const cleanRegion = currentRegion ? currentRegion.trim().toUpperCase() : 'US';
      let finalGenreId = 2; // Default na POP (id: 2)

      if (currentGenreId !== undefined && currentGenreId !== null) {
        const genreStr = String(currentGenreId).toLowerCase().trim();

        switch (genreStr) {
          case 'rock':
            finalGenreId = 1;
            break;
          case 'pop':
          case '2':
            finalGenreId = 2;
            break;
          case 'hip-hop':
          case 'hiphop':
            finalGenreId = 3;
            break;
          case 'r&b/soul':
          case 'rb-soul':
          case 'r&b':
            finalGenreId = 4;
            break;
          case 'country':
            finalGenreId = 5;
            break;
          case 'dance/electronic':
          case 'dance':
            finalGenreId = 6;
            break;
          default:
            const parsed = Number(currentGenreId);
            if (!isNaN(parsed) && parsed > 0) {
              finalGenreId = parsed;
            }
            break;
        }
      }

      const { data, error } = await supabase
        .from('suggestions')
        .select('id, artist_name, song_title, youtube_id, votes')
        .eq('region', cleanRegion)
        .eq('genre_id', finalGenreId)
        .order('votes', { ascending: false });

      if (error) {
        setErrorMessage(error.message);
      } else if (data) {
        setSuggestions(data);
      }
      setLoading(false);
    };

    fetchSuggestions();
  }, [refreshTrigger, currentRegion, currentGenreId]);

  const handleVote = async (id: string, currentVotes: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setVotingId(id);

    const { error } = await supabase
      .from('suggestions')
      .update({ votes: currentVotes + 1 })
      .eq('id', id);

    if (error) {
      alert('Voting error: ' + error.message);
    } else {
      setSuggestions(prev => 
        prev.map(item => item.id === id ? { ...item, votes: currentVotes + 1 } : item)
            .sort((a, b) => b.votes - a.votes)
      );
    }
    setVotingId(null);
  };

  if (loading) {
    return (
      <div className="text-xl text-white uppercase tracking-widest text-center py-12 font-black animate-pulse bg-zinc-950 border-4 border-dashed border-zinc-800 rounded-3xl0">
        ⏳ LOADING SUGGESTIONS FROM DATABASE...
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="text-base text-red-500 uppercase text-center py-16 border-4 border-dashed border-red-500 rounded-3xl bg-zinc-950 font-black p-4">
        ❌ Database Error: {errorMessage}
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="text-base text-zinc-400 uppercase text-center py-16 border-4 border-dashed border-zinc-800 rounded-3xl bg-zinc-950 font-black">
        No suggestions for this genre yet. Be the first!
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full text-white">
      {suggestions.map((item, index) => {
        const isTopTen = index < 10;
        const rankColor = isTopTen ? 'text-purple-500' : 'text-zinc-600';

        return (
          <div 
            key={item.id} 
            className="flex items-center justify-between bg-zinc-950 border-4 border-white rounded-2xl p-6 hover:bg-zinc-900 transition-all gap-6 w-full shadow-[4px_4px_0px_0px_rgba(147,51,234,1)]"
          >
            {/* RANK & VOTES */}
            <div className="flex items-center gap-4 shrink-0">
              <span className={`text-xl font-mono font-black min-w-[35px] ${rankColor}`}>
                #{index + 1}
              </span>
              <div className="bg-white text-black px-4 py-2 rounded-xl text-center min-w-[85px] border-2 border-white">
                <span className="block text-2xl font-black font-mono leading-none">
                  {item.votes || 0}
                </span>
                <span className="text-[10px] uppercase font-black tracking-wider block mt-0.5">
                  votes
                </span>
              </div>
            </div>

            {/* DETAILS */}
            <div className="flex-1 min-w-0">
              <h3 className="text-2xl font-black text-white uppercase truncate tracking-tight leading-none">
                {item.artist_name}
              </h3>
              <p className="text-lg font-bold text-zinc-400 truncate mt-1 normal-case">
                {item.song_title}
              </p>
            </div>

            {/* ACTIONS */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                disabled={votingId === item.id}
                onClick={(e) => handleVote(item.id, item.votes, e)}
                className="px-5 py-3 rounded-xl flex items-center gap-2 border-2 border-white font-black uppercase text-sm transition-all active:translate-y-1 active:shadow-none shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] bg-purple-600 text-white hover:bg-purple-500"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={4} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
                </svg>
                <span>Vote</span>
              </button>

              <a 
                href={`https://www.youtube.com/watch?v=${item.youtube_id}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-14 h-12 bg-red-600 hover:bg-red-500 text-white border-2 border-white rounded-xl flex items-center justify-center transition-all shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] active:translate-y-1 active:shadow-none"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                  <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
                </svg>
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}