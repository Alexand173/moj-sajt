import { cache } from 'react';
import { getYouTubeVideoId } from '@/lib/news-media';
import { getPublicSupabaseClient } from '@/lib/supabase-public';
import {
  canonicalArtistPath,
  getSeedArtistIdentityDirectory,
  mergeTicketRows,
  normalizeArtistIdentity,
  resolveArtistIdentity,
  slugifyArtist,
  type ArtistIdentity,
  type ArtistIdentityDirectory,
  type ArtistTicketGroup,
  type TicketSourceRow,
  type TourProfileContent,
} from '@/lib/tour-profile-core';
import { createFallbackTourProfile, getSeededTourProfile } from '@/lib/tour-profile-seeds';

export {
  canonicalArtistPath,
  mergeTicketRows,
  normalizeArtistIdentity,
  resolveArtistIdentity,
  slugifyArtist,
  type ArtistIdentity,
  type ArtistIdentityDirectory,
  type ArtistTicketGroup,
  type TicketSourceRow,
  type TourProfileContent,
};

const TICKET_COLUMNS = 'id, artist_name, image_url, video_url, date, location, city, ticket_link';

type StoredTourProfileRow = {
  canonical_slug: string;
  canonical_name: string;
  profile_data: unknown;
  hero_image_url?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  source_urls?: unknown;
  content_origin?: TourProfileContent['contentOrigin'];
  ai_status?: TourProfileContent['aiStatus'];
  published_at?: string | null;
};

type StoredTourAliasRow = {
  alias_key: string;
  alias_display: string;
  canonical_slug: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isTourProfileContent(value: unknown): value is TourProfileContent {
  if (!isRecord(value)) return false;
  return typeof value.canonicalSlug === 'string'
    && typeof value.canonicalName === 'string'
    && typeof value.tourTitle === 'string'
    && typeof value.seoTitle === 'string'
    && typeof value.seoDescription === 'string'
    && Array.isArray(value.members)
    && Array.isArray(value.venues)
    && Array.isArray(value.events) === false;
}

function mergeProfileRow(row: StoredTourProfileRow): TourProfileContent | null {
  if (!isTourProfileContent(row.profile_data)) return null;

  return {
    ...row.profile_data,
    canonicalSlug: row.canonical_slug || row.profile_data.canonicalSlug,
    canonicalName: row.canonical_name || row.profile_data.canonicalName,
    heroImageUrl: row.hero_image_url || row.profile_data.heroImageUrl,
    seoTitle: row.seo_title || row.profile_data.seoTitle,
    seoDescription: row.seo_description || row.profile_data.seoDescription,
    contentOrigin: row.content_origin || row.profile_data.contentOrigin,
    aiStatus: row.ai_status || row.profile_data.aiStatus,
  };
}

async function loadDirectoryFromSupabase(): Promise<ArtistIdentityDirectory> {
  const directory = getSeedArtistIdentityDirectory();
  const supabase = getPublicSupabaseClient();
  if (!supabase) return directory;

  try {
    const [{ data: profiles }, { data: aliases }] = await Promise.all([
      supabase.from('artist_tour_profiles').select('canonical_slug, canonical_name').not('published_at', 'is', null),
      supabase.from('artist_tour_aliases').select('alias_key, alias_display, canonical_slug'),
    ]);

    const profileBySlug = new Map<string, ArtistIdentity>();
    for (const row of (profiles || []) as Array<Pick<StoredTourProfileRow, 'canonical_slug' | 'canonical_name'>>) {
      const identity = {
        canonicalSlug: row.canonical_slug,
        canonicalName: row.canonical_name,
        aliases: [row.canonical_name],
      } satisfies ArtistIdentity;
      profileBySlug.set(row.canonical_slug, identity);
      directory[normalizeArtistIdentity(row.canonical_name)] = identity;
    }

    for (const alias of (aliases || []) as StoredTourAliasRow[]) {
      const identity = profileBySlug.get(alias.canonical_slug);
      if (identity) {
        identity.aliases.push(alias.alias_display);
        directory[normalizeArtistIdentity(alias.alias_key)] = identity;
      }
    }
  } catch (error) {
    console.warn('Could not load artist tour identity directory:', error);
  }

  return directory;
}

export const getArtistIdentityDirectory = cache(loadDirectoryFromSupabase);

export const getPublishedTourProfileSlugs = cache(async (): Promise<Set<string>> => {
  const slugs = new Set<string>(['metallica']);
  const supabase = getPublicSupabaseClient();
  if (!supabase) return slugs;

  try {
    const { data } = await supabase
      .from('artist_tour_profiles')
      .select('canonical_slug')
      .not('published_at', 'is', null);
    for (const row of (data || []) as Array<{ canonical_slug?: string | null }>) {
      if (row.canonical_slug) slugs.add(row.canonical_slug);
    }
  } catch (error) {
    console.warn('Could not load published tour profile slugs:', error);
  }

  return slugs;
});

export const getTicketGroups = cache(async (regionName: string): Promise<ArtistTicketGroup[]> => {
  const supabase = getPublicSupabaseClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('koncerti')
      .select(TICKET_COLUMNS)
      .ilike('region', regionName);

    if (error || !data) return [];
    const directory = await getArtistIdentityDirectory();
    return mergeTicketRows(data as TicketSourceRow[], directory);
  } catch (error) {
    console.warn(`Could not load ticket profiles for ${regionName}:`, error);
    return [];
  }
});

async function loadStoredProfile(slug: string): Promise<TourProfileContent | null> {
  const supabase = getPublicSupabaseClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('artist_tour_profiles')
      .select('canonical_slug, canonical_name, profile_data, hero_image_url, seo_title, seo_description, source_urls, content_origin, ai_status, published_at')
      .eq('canonical_slug', slug)
      .not('published_at', 'is', null)
      .maybeSingle();

    if (error || !data) return null;
    return mergeProfileRow(data as StoredTourProfileRow);
  } catch (error) {
    // The migration is intentionally optional during rollout; seeded profiles still render if the table is absent.
    console.warn(`Could not load stored tour profile ${slug}:`, error);
    return null;
  }
}

export interface TourPageData {
  regionName: string;
  requestedSlug: string;
  canonicalSlug: string;
  profile: TourProfileContent;
  group: ArtistTicketGroup;
  pageUrl: string;
}

export const getTourPageData = cache(async (
  regionName: string,
  requestedSlug: string,
): Promise<TourPageData | null> => {
  const groups = await getTicketGroups(regionName);
  const directory = await getArtistIdentityDirectory();
  const normalizedSlug = normalizeArtistIdentity(requestedSlug.replace(/-/g, ' '));
  const identity = directory[normalizedSlug]
    || resolveArtistIdentity(requestedSlug.replace(/-/g, ' '), directory);

  const canonicalSlug = identity.canonicalSlug || slugifyArtist(requestedSlug);
  const group = groups.find((candidate) => candidate.artist_slug === canonicalSlug)
    || groups.find((candidate) => normalizeArtistIdentity(candidate.artist_name) === normalizedSlug);

  const storedProfile = await loadStoredProfile(canonicalSlug);
  const seededProfile = getSeededTourProfile(canonicalSlug);
  const profile = storedProfile || seededProfile || (group ? createFallbackTourProfile(group) : null);
  if (!profile || !group) return null;
  const resolvedProfile = group.image_url
    ? { ...profile, heroImageUrl: group.image_url }
    : profile;

  return {
    regionName,
    requestedSlug,
    canonicalSlug: resolvedProfile.canonicalSlug,
    profile: resolvedProfile,
    group,
    pageUrl: canonicalArtistPath(regionName, profile.canonicalSlug),
  };
});

export function getProfileVideoId(profile: TourProfileContent): string | null {
  return getYouTubeVideoId(profile.freshMusicVideoId ? `https://youtu.be/${profile.freshMusicVideoId}` : null);
}
