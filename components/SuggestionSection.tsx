'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import SuggestionList from './SuggestionList';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface SuggestionSectionProps {
  regionName: string;
  genreId: number;
  genreName: string;
}

export default function SuggestionSection({
  regionName,
  genreId,
  genreName,
}: SuggestionSectionProps) {
  const [refreshTrigger, setRefreshTrigger] = useState(false);

  const handleAddSuggestionClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const { data: { session }, error: authError } = await supabase.auth.getSession();

      if (authError) {
        alert("Auth error: " + authError.message);
        return;
      }

      if (!session) {
        alert('🔒 ACCESS DENIED: You must log in or register to submit a suggestion!');
        window.location.href = '/register';
        return;
      }

      const artist = prompt("Enter artist name:");
      if (!artist) return;

      const title = prompt("Enter song title:");
      if (!title) return;

      const ytId = prompt("Enter YouTube Video ID (e.g., dQw4w9WgXcQ):");
      if (!ytId) return;

      const { error: insertError } = await supabase
        .from('suggestions')
        .insert([
          {
            artist_name: artist,
            song_title: title,
            youtube_id: ytId,
            region: regionName.trim().toUpperCase(),
            genre_id: Number(genreId),
            votes: 1
          }
        ]);

      if (insertError) {
        alert("Database insert error: " + insertError.message);
      } else {
        alert("🎉 Suggestion successfully added!");
        setRefreshTrigger(prev => !prev);
      }
    } catch (err) {
      alert("An error occurred.");
      console.error(err);
    }
  };

  return (
    <div className="relative z-50 pointer-events-auto w-full bg-black border-4 border-white rounded-[3rem] p-8 md:p-14 text-white font-sans shadow-[8px_8px_0px_0px_rgba(147,51,234,1)] mt-16">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-10 pb-8 border-b-4 border-white w-full">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-4xl">🔥</span>
            <h2 className="text-4xl font-black uppercase tracking-tighter text-white leading-none">
              USER SUGGESTIONS
            </h2>
          </div>
          <p className="text-sm font-extrabold text-zinc-400 uppercase tracking-[0.2em] mt-3 sm:pl-12">
            VOTE FOR THIS WEEK'S TOP 10 • {genreName} ({regionName})
          </p>
        </div>

        <button 
          onClick={handleAddSuggestionClick}
          className="relative z-50 pointer-events-auto w-full sm:w-auto shrink-0 px-8 py-4 bg-white text-black font-black text-xs tracking-[0.2em] uppercase rounded-2xl hover:bg-purple-600 hover:text-white transition-all active:scale-95 border-2 border-white shadow-[4px_4px_0px_0px_rgba(147,51,234,1)]"
        >
          Add Suggestion
        </button>
      </div>

      {/* RENDER LISTE PREDLOGA */}
      <div className="w-full">
        <SuggestionList
          refreshTrigger={refreshTrigger}
          currentRegion={regionName}
          currentGenreId={genreId}
        />
      </div>

    </div>
  );
}