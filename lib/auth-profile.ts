import { createClient, type User } from '@supabase/supabase-js';

/**
 * The `profiles` row for a signed-in member.
 *
 * Every provider writes the same row, which is why the metadata reading below is
 * deliberately generous: Google and Facebook return `given_name`/`name` and an
 * email, while the custom providers return a handle (`username`) and a picture,
 * and TikTok's default scope carries no email at all. A provider that returns
 * less must not produce a blank profile — the fallback chain walks down to the
 * handle, then the email local part, and only then "User".
 */

type ExistingProfile = {
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

export type ProfileRecord = {
  id: string;
  email?: string | null;
  first_name: string;
  last_name: string | null;
  avatar_url: string | null;
};

/** What the mapper needs from a Supabase user; `User` satisfies it as-is. */
export type ProfileSource = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

/** A handle is split into name parts only when the pieces look like names. */
const MIN_HANDLE_PART_LENGTH = 2;

function getNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** First non-empty string among the candidates, so each field reads in one line. */
function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    const found = getNonEmptyString(value);
    if (found) return found;
  }

  return null;
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

/**
 * Instagram returns `profile_picture_url`, TikTok `avatar_url`, Google
 * `avatar_url`/`picture`, and a custom OIDC provider may nest the URL under
 * `picture.data.url`. None of them may be a non-http URL.
 */
function getProviderAvatarUrl(metadata: Record<string, unknown>): string | null {
  const directAvatar = getSafeHttpUrl(metadata.avatar_url)
    || getSafeHttpUrl(metadata.picture)
    || getSafeHttpUrl(metadata.avatar_url_path)
    || getSafeHttpUrl(metadata.profile_picture_url)
    || getSafeHttpUrl(metadata.avatar)
    || getSafeHttpUrl(metadata.profile_image_url);
  if (directAvatar) return directAvatar;

  if (metadata.picture && typeof metadata.picture === 'object') {
    const pictureData = (metadata.picture as { data?: { url?: unknown } }).data;
    return getSafeHttpUrl(pictureData?.url);
  }

  return null;
}

/** `sloven.klucic` → ["sloven", "klucic"]; `vlajko973` stays one part. */
function splitHandle(handle: string | null): string[] {
  if (!handle) return [];

  const parts = handle.split(/[._\-\s]+/).map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 && parts.every((part) => part.length >= MIN_HANDLE_PART_LENGTH) ? parts : [handle];
}

/**
 * Maps whatever the provider returned onto a `profiles` row. Existing values win,
 * so a member who edited their name keeps it after signing in through a second
 * provider.
 */
export function getProfileFromUser(user: ProfileSource, existing: ExistingProfile | null): ProfileRecord {
  const metadata = user.user_metadata ?? {};

  const givenName = firstString(metadata.first_name, metadata.given_name);
  const familyName = firstString(metadata.last_name, metadata.family_name);
  const fullName = firstString(metadata.full_name, metadata.name, metadata.display_name);
  const handle = firstString(
    metadata.user_name,
    metadata.username,
    metadata.preferred_username,
    metadata.nickname,
  );

  // Custom providers may place the address in metadata instead of on the user.
  const email = firstString(user.email, metadata.email, existing?.email);
  const emailName = email?.split('@')[0] || null;

  const nameParts = fullName?.split(/\s+/).filter(Boolean) ?? [];
  const handleParts = splitHandle(handle);

  const derivedFirstName = givenName
    || nameParts[0]
    || handleParts[0]
    || emailName
    || 'User';
  const derivedLastName = familyName
    || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : null)
    || (handleParts.length > 1 ? handleParts.slice(1).join(' ') : null);

  return {
    id: user.id,
    ...(email ? { email } : {}),
    first_name: getNonEmptyString(existing?.first_name) || derivedFirstName,
    last_name: getNonEmptyString(existing?.last_name) || derivedLastName,
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
