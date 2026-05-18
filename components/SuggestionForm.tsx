'use client';

import { useState } from 'react';
// 🚨 POPRAVLJENO: Koristimo createBrowserClient iz SSR paketa umesto običnog createClient
import { createBrowserClient } from '@supabase/ssr';

interface SuggestionFormProps {
  region: string;
  genreId?: number;
  genreName?: string;
  onSuccess?: () => void;
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

  // 🚨 Inicijalizacija klijenta koji deli iste kolačiće sa HeaderAuth komponentom
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const extractYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : url;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');

    // 🚨 1. PROVERA: Vučemo svežu sesiju iz browsera direktno na klik!
    const { data: { session } } = await supabase.auth.getSession();

    // 🚨 2. PROVERA: Ako sesije nema, odmah izbacujemo poruku i prekidamo funkciju
    if (!session?.user) {
      alert("🔒 ACCESS DENIED: You must log in or register to submit a suggestion!");
      setSubmitting(false);
      return;
    }

    const cleanYoutubeId = extractYoutubeId(youtubeId.trim());

    if (cleanYoutubeId.length !== 11) {
      setErrorMsg('Nevažeći YouTube link ili ID!');
      setSubmitting(false);
      return;
    }

    // Upisujemo u Supabase 'suggestions' tabelu
    const { error } = await supabase
      .from('suggestions')
      .insert([
        {
          artist_name: artistName.trim(),
          song_title: songTitle.trim(),
          youtube_id: cleanYoutubeId,
          region: region.toUpperCase(),
          genre_id: genreId || null, 
          votes: 1,
          user_id: session.user.id // 💡 Bonus dobra praksa: beležiš ko je poslao predlog
        }
      ]);

    if (error) {
      console.error(error);
      setErrorMsg('Greška pri čuvanju: ' + error.message);
      setSubmitting(false);
    } else {
      setArtistName('');
      setSongTitle('');
      setYoutubeId('');
      setSubmitting(false);

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