import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    // Koristimo SERVICE_ROLE_KEY da zaobiđemo RLS restrikcije tokom same registracije
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Razmeni kod za sesiju
    const { data, error } = await supabaseAdmin.auth.exchangeCodeForSession(code);

    if (!error && data?.session?.user) {
      const user = data.session.user;

      // 2. Upisujemo profil koristeći admin privilegije (Ruter prolazi RLS)
      await supabaseAdmin
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email,
          first_name: user.user_metadata.full_name || user.user_metadata.first_name || 'Korisnik',
        }, { onConflict: 'id' });

      // 3. Pravimo odgovor i ručno ubacujemo kolačiće u brauzer
      const response = NextResponse.redirect(new URL('/', request.url));

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

  // Ako bilo šta omane, bezbedno vrati korisnika na početnu stranu
  return NextResponse.redirect(new URL('/', request.url));
}