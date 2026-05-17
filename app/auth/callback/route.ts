import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  
  // Ako koda uopšte nema, vrati ga na početnu
  if (!code) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Inicijalizujemo response objekat na koji kačimo kolačiće
  const response = NextResponse.redirect(new URL('/', request.url));

  try {
    // Kreiramo standardni server klijent za razmenu sesije
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll().map(({ name, value }) => ({ name, value }));
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    // Menjamo privremeni Google kod za pravu sesiju korisnika
    const { data, error: authError } = await supabase.auth.exchangeCodeForSession(code);

    if (authError) {
      console.error('AUTH_EXCHANGE_ERROR:', authError.message);
      // Ako pukne razmena, šaljemo ga na login stranicu i ispisujemo tačnu grešku u URL-u
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(authError.message)}`, request.url));
    }

    // Ako je sesija uspešno napravljena, upisujemo profil u bazu preko Admin klijenta
    if (data?.session?.user) {
      const user = data.session.user;

      // Direktno uvozimo osnovni supabase-js klijent za zaobilaženje RLS-a sa SERVICE_ROLE ključem
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Upisujemo ili ažuriramo profil korisnika u tabeli 'profiles'
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email,
          first_name: user.user_metadata.full_name || user.user_metadata.first_name || 'Korisnik',
        }, { onConflict: 'id' });

      if (profileError) {
        console.error('PROFIL_UPSERT_ERROR:', profileError.message);
        // Čak i ako upis profila ne uspe, ne prekidamo login, pustićemo korisnika unutra
      }
    }

    return response;

  } catch (globalError: any) {
    console.error('SISTEMSKI_CALLBACK_ERROR:', globalError);
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(globalError.message || 'Sistemska greska')}`, request.url));
  }
}