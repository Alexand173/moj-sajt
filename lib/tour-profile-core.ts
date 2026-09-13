import type { GroupedConcert } from '@/components/ticket-types';

export type TourContentOrigin = 'seeded' | 'supabase' | 'openai-reviewed';
export type TourAiStatus = 'pending' | 'generated' | 'reviewed' | 'rejected';
export type TourImageLicense = 'artist-owned' | 'wikimedia-commons' | 'editorial-source' | 'supabase-source';

export interface TourProfileMember {
  name: string;
  role: string;
  bio: string;
  imageUrl: string;
  imageAlt: string;
  imageSourceUrl: string;
  imageSourceName: string;
  license: TourImageLicense;
}

export interface TourSong {
  title: string;
  note: string;
  year?: number;
  sourceUrl?: string;
}

export interface TourAlbum {
  title: string;
  year: number;
  highlight: string;
  sourceUrl?: string;
}

export interface TourAward {
  title: string;
  year?: number;
  note: string;
  sourceUrl?: string;
}

export interface TourVenue {
  name: string;
  city: string;
  capacity?: string;
  info: string;
  imageUrl?: string;
  imageSourceUrl?: string;
  imageSourceName?: string;
}

export interface TourMerchItem {
  name: string;
  type: string;
  priceLabel: string;
  imageUrl?: string;
  purchaseUrl?: string;
}

export interface TourProfileContent {
  canonicalSlug: string;
  canonicalName: string;
  aliases: string[];
  tourTitle: string;
  tagline: string;
  heroImageUrl: string;
  galleryImageUrls: string[];
  bio: string;
  moreAbout: string[];
  members: TourProfileMember[];
  freshMusicVideoId?: string;
  interviewVideoId?: string;
  interviewSearchUrl: string;
  interviewText: string[];
  popularSongs: TourSong[];
  albums: TourAlbum[];
  awards: TourAward[];
  venues: TourVenue[];
  merch: TourMerchItem[];
  seoTitle: string;
  seoDescription: string;
  sourceUrls: string[];
  contentOrigin: TourContentOrigin;
  aiStatus: TourAiStatus;
}

export interface ArtistIdentity {
  canonicalSlug: string;
  canonicalName: string;
  aliases: string[];
}

export type ArtistIdentityDirectory = Record<string, ArtistIdentity>;

export interface TicketSourceRow {
  id: string;
  artist_name: string;
  image_url: string;
  video_url?: string | null;
  date: string;
  location: string;
  city?: string | null;
  ticket_link?: string | null;
}

export interface ArtistTicketGroup extends GroupedConcert {
  artist_slug: string;
}

const METALLICA_ALIASES = [
  'metallica',
  'metallica life burns faster',
  'metallica life burns faster at sphere in las vegas',
  'metallica 2 day ticket',
  'metallica 2 day ticket cannot split by day',
  'metallica 2 day ticket 2 4 27 2 6 27 cannot split by day',
  'metallica 2 day ticket 2 18 27 2 20 27 cannot split by day',
];

export function normalizeArtistIdentity(value: string | null | undefined): string {
  return (value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function slugifyArtist(value: string): string {
  return normalizeArtistIdentity(value).replace(/\s+/g, '-');
}

export function getSeedArtistIdentityDirectory(): ArtistIdentityDirectory {
  const identity: ArtistIdentity = {
    canonicalSlug: 'metallica',
    canonicalName: 'Metallica',
    aliases: METALLICA_ALIASES,
  };

  return Object.fromEntries(METALLICA_ALIASES.map((alias) => [alias, identity]));
}

export function resolveArtistIdentity(
  rawName: string,
  directory: ArtistIdentityDirectory = getSeedArtistIdentityDirectory(),
): ArtistIdentity {
  const normalized = normalizeArtistIdentity(rawName);
  const directMatch = directory[normalized];
  if (directMatch) return directMatch;

  if (normalized === 'metallica' || normalized.startsWith('metallica ')) {
    const metallica = getSeedArtistIdentityDirectory().metallica;
    return metallica;
  }

  const canonicalName = rawName.trim() || 'Unknown artist';
  return {
    canonicalSlug: slugifyArtist(canonicalName),
    canonicalName,
    aliases: [normalized || canonicalName],
  };
}

export function canonicalArtistPath(regionName: string, artistSlug: string): string {
  return `/tickets/${encodeURIComponent(regionName.toLowerCase())}/artist/${encodeURIComponent(artistSlug)}`;
}

export function mergeTicketRows(
  rows: TicketSourceRow[],
  directory: ArtistIdentityDirectory = getSeedArtistIdentityDirectory(),
): ArtistTicketGroup[] {
  const groups = new Map<string, ArtistTicketGroup>();

  for (const row of rows) {
    const identity = resolveArtistIdentity(row.artist_name, directory);
    const current = groups.get(identity.canonicalSlug);

    if (!current) {
      groups.set(identity.canonicalSlug, {
        artist_key: identity.canonicalSlug,
        artist_name: identity.canonicalName,
        artist_slug: identity.canonicalSlug,
        image_url: row.image_url || '',
        video_url: row.video_url || null,
        events: [{
          id: row.id,
          date: row.date,
          location: row.location,
          city: row.city,
          ticket_link: row.ticket_link,
        }],
      });
      continue;
    }

    if (!current.image_url && row.image_url) current.image_url = row.image_url;
    if (!current.video_url && row.video_url) current.video_url = row.video_url;

    const eventExists = current.events.some((event) => event.id === row.id);
    if (!eventExists) {
      current.events.push({
        id: row.id,
        date: row.date,
        location: row.location,
        city: row.city,
        ticket_link: row.ticket_link,
      });
    }
  }

  return Array.from(groups.values());
}
