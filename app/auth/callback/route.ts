import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { ensureProfileForUser } from '@/lib/auth-profile';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const redirectUrl = new URL('/', requestUrl.origin);

  if (!code) {
    return NextResponse.redirect(redirectUrl);
  }

  const response = NextResponse.redirect(redirectUrl);

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
            cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          },
        },
      },
    );

    const { data, error: authError } = await supabase.auth.exchangeCodeForSession(code);

    if (authError) {
      console.error('AUTH_EXCHANGE_ERROR:', authError);
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(authError.message)}`, requestUrl.origin));
    }

    if (data.user) {
      try {
        // Use the service role only on the server so RLS cannot silently block
        // the OAuth user's profile row from being created or repaired.
        await ensureProfileForUser(data.user);
      } catch (profileError) {
        console.error('PROFILE_UPSERT_ERROR:', profileError);
      }
    }

    return response;
  } catch (error: unknown) {
    console.error('CALLBACK_SYSTEM_ERROR:', error);
    const message = error instanceof Error ? error.message : 'Authentication callback failed.';
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, requestUrl.origin));
  }
}
