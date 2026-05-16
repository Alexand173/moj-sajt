import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    // 1. Običan klijent koji služi da registruje samog korisnika u Authentication tabelu
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Razmenjujemo kod za sesiju pod tim korisnikom
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data?.session?.user) {
      const user = data.session.user;

      // 2. Admin klijent koji služi SAMO da uleti u profiles tabelu i zaobiđe RLS pravilo
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      await supabaseAdmin
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email,
          first_name: user.user_metadata.full_name || user.user_metadata.first_name || 'Korisnik',
        }, { onConflict: 'id' });

      // 3. Pravimo preusmeravanje na početnu stranu
      const response = NextResponse.redirect(new URL('/', request.url));

      // Postavljamo kolačiće kako bi i klijentski deo sajta prepoznao da smo ulogovani
      response.cookies.set('sb-access-token', data.session.access_token, {
        path: '/',
        secure: true,
        sameSite: 'lax',
      });
      response.cookies.set('sb-refresh-token', data.session.refresh_token, {
        path: '/',
        secure: true,
        sameSite: 'lax',
      });

      return response;
    }
  }

  // Ako bilo šta pukne, vrati ga na početnu
  return NextResponse.redirect(new URL('/', request.url));
}