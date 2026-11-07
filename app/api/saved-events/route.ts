import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { readSavedEventIds, writeSavedEventIds } from '@/lib/saved-events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Keeps the star on the "near you" rail in step with the signed-in account.
 * Guests get `authenticated: false` and the rail falls back to this device's
 * localStorage, so the control still works without an account.
 */
async function getUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        // Reads only: a session refresh here would need a response to write to.
        setAll() {},
      },
    },
  );

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  return data.user.id;
}

export async function GET() {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ authenticated: false, ids: [], persisted: false });
  }

  const saved = await readSavedEventIds(userId);
  return NextResponse.json({ authenticated: true, ...saved });
}

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ authenticated: false, error: 'Authentication required.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const saved = await writeSavedEventIds(userId, (body as { ids?: unknown } | null)?.ids);
  return NextResponse.json({ authenticated: true, ...saved });
}
