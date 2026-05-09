'use client';
import { useState } from 'react';
import { submitSuggestions } from '../app/actions';

export default function SuggestionForm() {
  const [songs, setSongs] = useState<string[]>(Array(10).fill(''));

  const handleChange = (index: number, value: string) => {
    const newSongs = [...songs];
    newSongs[index] = value;
    setSongs(newSongs);
  };

  return (
    <form 
  action={async (formData) => {
    await submitSuggestions(formData);
    alert("Suggestions submitted!"); // Optional: Feedback to user
  }} 
  className="max-w-xl mx-auto p-6 bg-zinc-900 text-white rounded-xl"
>

      <div className="space-y-2 mb-6">
        {songs.map((_, i) => (
          <input
            key={i}
            placeholder={`#${i + 1} Artist - Song`}
            className="w-full p-2 bg-black border border-zinc-700 rounded text-sm"
            onChange={(e) => handleChange(i, e.target.value)}
          />
        ))}
      </div>

      {/* Skriveno polje za niz pesama */}
      <input type="hidden" name="songs" value={JSON.stringify(songs)} />

      <button 
        type="submit" 
        className="w-full bg-purple-600 py-4 font-black tracking-widest hover:bg-purple-500 transition-colors"
      >
        SUBMIT LIST
      </button>
    </form>
  );
}