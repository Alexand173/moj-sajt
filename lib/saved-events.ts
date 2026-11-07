import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Starred events live on the visitor's `profiles` row so they follow the account
 * across devices. The browser cannot write that row (RLS blocks client writes),
 * so reads and writes go through the service role on the server.
 */

const MAX_SAVED_EVENTS = 200;
const MAX_ID_LENGTH = 64;

function getSupabaseAdmin(): SupabaseClient | null {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) return null;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/** Keeps the stored list bounded and free of blanks or duplicates. */
export function sanitizeSavedEventIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const ids = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== 'string') continue;

    const id = entry.trim().slice(0, MAX_ID_LENGTH);
    if (!id) continue;

    ids.add(id);
    if (ids.size >= MAX_SAVED_EVENTS) break;
  }

  return Array.from(ids);
}

export type SavedEventIds = {
  ids: string[];
  /** False when the `saved_events` migration has not been applied yet. */
  persisted: boolean;
};

export async function readSavedEventIds(userId: string): Promise<SavedEventIds> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ids: [], persisted: false };

  const { data, error } = await supabase
    .from('profiles')
    .select('saved_events')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.warn('Could not read saved events from the profile:', error.message);
    return { ids: [], persisted: false };
  }

  return { ids: sanitizeSavedEventIds(data?.saved_events), persisted: true };
}

export async function writeSavedEventIds(userId: string, value: unknown): Promise<SavedEventIds> {
  const ids = sanitizeSavedEventIds(value);

  const supabase = getSupabaseAdmin();
  if (!supabase) return { ids, persisted: false };

  const { error } = await supabase.from('profiles').update({ saved_events: ids }).eq('id', userId);

  if (error) {
    console.warn('Could not write saved events to the profile:', error.message);
    return { ids, persisted: false };
  }

  return { ids, persisted: true };
}
