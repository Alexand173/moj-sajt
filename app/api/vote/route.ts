import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Inicijalizacija Admin klijenta (Ovo se izvršava samo na serveru)
// Koristimo tvoj tajni SERVICE_ROLE_KEY iz .env (linija 9)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    // Uzimamo songId koji šalje SongCard komponenta
    const { songId } = await request.json();

    if (!songId) {
      return NextResponse.json(
        { error: 'Song ID is required' }, 
        { status: 400 }
      );
    }

    // Pozivamo tvoju SQL funkciju u bazi
    // Prosleđujemo 'song_id' jer smo ga tako definisali u SQL Editoru
    const { error } = await supabaseAdmin.rpc('increment_vote', { 
      song_id: songId 
    });

    // Ako RPC iz nekog razloga baci grešku, šaljemo je u catch blok
    if (error) throw error;

    return NextResponse.json({ 
      success: true, 
      message: 'Vote registered successfully' 
    });

  } catch (error: any) {
    // Logujemo grešku na serveru da bismo znali šta se desilo
    console.error('SERVER_VOTE_ERROR:', error.message);

    return NextResponse.json(
      { error: 'Database access denied or function missing' }, 
      { status: 500 }
    );
  }
}