// components/SuggestionList.tsx
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default async function SuggestionList() {
  const { data: suggestions } = await supabase.from('suggestions').select('*').order('created_at', { ascending: false });

  return (
    <div className="mt-20 p-8 bg-zinc-900 rounded-3xl border border-white/5">
      <h2 className="text-3xl font-black uppercase mb-8">Community Top 10 Picks</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {suggestions?.map((item) => (
          <div key={item.id} className="p-4 border border-white/5 rounded-xl bg-black">
            <h3 className="text-purple-400 font-bold mb-2">{item.user_name}</h3>
            <ul className="text-sm text-zinc-400 space-y-1">
              {item.songs.map((song: string, i: number) => (
                <li key={i}>{i + 1}. {song}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}