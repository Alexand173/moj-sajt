import { createClient, type User } from '@supabase/supabase-js';

type ExistingProfile = {
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

type ProfileRecord = {
  id: string;
  email?: string | null;
  first_name: string;
  last_name?: string | null;
  avatar_url?: string | null;
};

function getNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getSafeHttpUrl(value: unknown): string | null {
  const candidate = getNonEmptyString(value);
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function getProviderAvatarUrl(metadata: Record<string, unknown>): string | null {
  const directAvatar = getSafeHttpUrl(metadata.avatar_url)
    || getSafeHttpUrl(metadata.picture)
    || getSafeHttpUrl(metadata.avatar_url_path);
  if (directAvatar) return directAvatar;

  if (metadata.picture && typeof metadata.picture === 'object') {
    const pictureData = (metadata.picture as { data?: { url?: unknown } }).data;
    return getSafeHttpUrl(pictureData?.url);
  }

  return null;
}

function getProfileFromUser(user: User, existing: ExistingProfile | null): ProfileRecord {
  const metadata = user.user_metadata ?? {};
  const givenName = getNonEmptyString(metadata.first_name)
    || getNonEmptyString(metadata.given_name);
  const familyName = getNonEmptyString(metadata.last_name)
    || getNonEmptyString(metadata.family_name);
  const fullName = getNonEmptyString(metadata.full_name)
    || getNonEmptyString(metadata.name)
    || getNonEmptyString(metadata.user_name);
  const nameParts = fullName?.split(/\s+/) ?? [];
  const emailName = getNonEmptyString(user.email)?.split('@')[0] || null;

  return {
    id: user.id,
    ...(getNonEmptyString(user.email) || existing?.email
      ? { email: getNonEmptyString(user.email) || existing?.email }
      : {}),
    first_name: getNonEmptyString(existing?.first_name)
      || givenName
      || nameParts[0]
      || emailName
      || 'User',
    last_name: getNonEmptyString(existing?.last_name)
      || familyName
      || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : null),
    avatar_url: getSafeHttpUrl(existing?.avatar_url) || getProviderAvatarUrl(metadata),
  };
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase service-role configuration for profile synchronization.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Creates or repairs the public profile row for an authenticated Supabase user.
 * Existing profile values are preserved; provider metadata only fills blanks.
 */
export async function ensureProfileForUser(user: User): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: existing, error: lookupError } = await supabaseAdmin
    .from('profiles')
    .select('email, first_name, last_name, avatar_url')
    .eq('id', user.id)
    .maybeSingle();

  if (lookupError) throw lookupError;

  const { error: upsertError } = await supabaseAdmin
    .from('profiles')
    .upsert(getProfileFromUser(user, existing as ExistingProfile | null), { onConflict: 'id' });

  if (upsertError) throw upsertError;
}
