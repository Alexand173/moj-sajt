import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Prepare response (redirect on success)
  const response = NextResponse.redirect(new URL('/feed', request.url));

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

    // Exchange the code for a session
    const { error: authError } = await supabase.auth.exchangeCodeForSession(code);

    if (authError) {
      console.error('AUTH_EXCHANGE_ERROR:', authError);
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(authError.message)}`, request.url));
    }

    // Optionally upsert profile using service_role
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      await supabaseAdmin
        .from('profiles')
        .upsert({
          id: session.user.id,
          email: session.user.email,
          first_name: session.user.user_metadata?.full_name || 'User',
        }, { onConflict: 'id' });
    }

    return response;
  } catch (err: any) {
    console.error('CALLBACK_SYSTEM_ERROR:', err);
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(err.message)}`, request.url));
  }
}