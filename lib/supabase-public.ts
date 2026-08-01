import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_REQUEST_TIMEOUT_MS = 8_000;

let publicClient: SupabaseClient | null | undefined;

function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (init?.signal) return fetch(input, init);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SUPABASE_REQUEST_TIMEOUT_MS);

  return fetch(input, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timeoutId);
  });
}

/**
 * Creates the server-side Supabase client used by public pages.
 *
 * Public reads prefer the service key when it is configured, but fall back to
 * the anon key so a missing optional deployment variable cannot turn the whole
 * site into a server error. A short request timeout keeps crawlers from
 * waiting indefinitely when Supabase is unavailable.
 */
export function getPublicSupabaseClient(): SupabaseClient | null {
  if (publicClient !== undefined) return publicClient;

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    publicClient = null;
    return publicClient;
  }

  try {
    publicClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        fetch: fetchWithTimeout,
      },
    });
  } catch (error) {
    console.error('Public Supabase client could not be initialized:', error);
    publicClient = null;
  }

  return publicClient;
}
