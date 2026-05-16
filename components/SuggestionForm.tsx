'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface SuggestionFormProps {
  region: string;
  genreId?: number;
  genreName?: string;
  onSuccess?: () => void; // Opciona funkcija da zatvori modal i osveži listu zdesna
}

export default function SuggestionForm({ 
  region, 
  genreId, 
  genreName,
  onSuccess 
}: SuggestionFormProps) {
  const [artistName, setArtistName] = useState('');
  const [songTitle, setSongTitle] = useState('');
  const [youtubeId, setYoutubeId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Funkcija za vađenje čistog ID-ja iz YouTube linka
  const extractYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : url;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');

    const cleanYoutubeId = extractYoutubeId(youtubeId.trim());

    if (cleanYoutubeId.length !== 11) {
      setErrorMsg('Nevažeći YouTube link ili ID!');
      setSubmitting(false);
      return;
    }

    // Upisujemo u Supabase 'suggestions' tabelu prema tvojoj šemi sa slike
    const { error } = await supabase
      .from('suggestions')
      .insert([
        {
          artist_name: artistName.trim(),
          song_title: songTitle.trim(),
          youtube_id: cleanYoutubeId,
          region: region.toUpperCase(),
          genre_id: genreId || null, // Ako smo na korenskoj stranici regiona gde nema žanra, biće null
          votes: 1 // Svaki novi predlog kreće sa 1 glasom automatski
        }
      ]);

    if (error) {
      console.error(error);
      setErrorMsg('Greška pri čuvanju: ' + error.message);
      setSubmitting(false);
    } else {
      // Uspešno uneto! Čistimo polja forme
      setArtistName('');
      setSongTitle('');
      setYoutubeId('');
      setSubmitting(false);

      // Javljamo roditelju (sekciji) da zatvori modal i osveži listu predloga
      if (onSuccess) {
        onSuccess();
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h3 className="text-base font-black uppercase text-amber-500 tracking-tight mb-1">
          Predloži novu pesmu
        </h3>
        <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-medium">
          Slanje za: <span className="text-white">{region.toUpperCase()}</span> {genreName && <>• Žanr: <span className="text-white">{genreName.toUpperCase()}</span></>}
        </p>
      </div>

      {errorMsg && (
        <div className="text-[10px] font-bold text-red-500 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg uppercase tracking-wider">
          {errorMsg}
        </div>
      )}

      <div className="space-y-3">
        {/* INPUT: Izvođač */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
            Naziv Izvođača / Grupe
          </label>
          <input 
            type="text" 
            required 
            value={artistName}
            onChange={(e) => setArtistName(e.target.value)}
            placeholder="npr. Linkin Park"
            className="w-full bg-white/[0.02] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>

        {/* INPUT: Naziv pesme */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
            Naziv Pesme
          </label>
          <input 
            type="text" 
            required 
            value={songTitle}
            onChange={(e) => setSongTitle(e.target.value)}
            placeholder="npr. Numb"
            className="w-full bg-white/[0.02] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>

        {/* INPUT: YouTube URL */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
            YouTube Link ili ID videa
          </label>
          <input 
            type="text" 
            required 
            value={youtubeId}
            onChange={(e) => setYoutubeId(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full bg-white/[0.02] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>
      </div>

      {/* SUBMIT BUTTON */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-800 text-black disabled:text-zinc-500 font-black uppercase text-[11px] tracking-widest py-2.5 rounded-xl transition-all shadow-lg"
      >
        {submitting ? 'Slanje u toku...' : 'Pošalji Predlog'}
      </button>
    </form>
  );
}