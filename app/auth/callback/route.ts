import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  const isProduction = process.env.NODE_ENV === 'production';
  const baseUrl = isProduction ? 'https://www.musictop.net' : 'http://localhost:3000';

  if (!code) {
    return NextResponse.redirect(new URL('/', baseUrl));
  }

  const response = NextResponse.redirect(new URL('/', baseUrl));

  try {
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

    // 1. Razmeni kod za aktivnu sesiju
    const { data, error: authError } = await supabase.auth.exchangeCodeForSession(code);

    if (authError) {
      console.error('AUTH_EXCHANGE_ERROR:', authError);
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(authError.message)}`, baseUrl));
    }

    // 2. Ako imamo korisnika, upiši ga DIREKTNO u profiles tabelu sa njegovom sesijom
    if (data?.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: data.user.id,
          email: data.user.email,
          first_name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'User',
        }, { onConflict: 'id' });

      if (profileError) {
        console.error('PROFILE_UPSERT_ERROR:', profileError);
      }
    }

    // 🔥 OVO JE TA LINIJA - Ona stoji ovde na kraju uspešnog procesa:
    return response; 
    
  } catch (err: any) {
    console.error('CALLBACK_SYSTEM_ERROR:', err);
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(err.message)}`, baseUrl));
  }
}