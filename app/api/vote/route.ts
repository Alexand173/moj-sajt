import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  const { songId } = await request.json();

  // RPC poziv ili direktan update (povećavamo za 1)
  const { data, error } = await supabase
    .rpc('increment_vote', { row_id: songId });

  if (error) {
    // Ako RPC nije podešen, koristimo običan update (manje precizno ali radi)
    const { data: currentSong } = await supabase.from('songs').select('votes').eq('id', songId).single();
    await supabase.from('songs').update({ votes: (currentSong?.votes || 0) + 1 }).eq('id', songId);
  }

  return NextResponse.json({ success: true });
}