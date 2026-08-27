const SITE_URL = 'https://musictop.net';

export type BreadcrumbSchemaItem = {
  name: string;
  url: string;
};

type MusicEventSchemaInput = {
  name: string;
  description?: string | null;
  startDate: string;
  endDate?: string | null;
  location: string;
  url: string;
  image?: string[];
  lineup?: string[] | null;
  ticketsUrl?: string | null;
};

type VideoObjectSchemaInput = {
  name: string;
  description?: string | null;
  videoId: string;
  pageUrl: string;
  thumbnailUrl?: string | null;
};

export function toAbsoluteSiteUrl(value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  return `${SITE_URL}${value.startsWith('/') ? value : `/${value}`}`;
}

export function createBreadcrumbListSchema(items: BreadcrumbSchemaItem[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: toAbsoluteSiteUrl(item.url),
    })),
  };
}

export function createMusicEventSchema(input: MusicEventSchemaInput): Record<string, unknown> {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'MusicEvent',
    '@id': `${toAbsoluteSiteUrl(input.url)}#music-event`,
    name: input.name,
    description: input.description || `Live music festival event: ${input.name}.`,
    startDate: input.startDate,
    location: {
      '@type': 'Place',
      name: input.location,
    },
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    organizer: {
      '@type': 'Organization',
      name: 'MUSIC TOP',
      url: SITE_URL,
    },
    url: toAbsoluteSiteUrl(input.url),
  };

  if (input.endDate) schema.endDate = input.endDate;
  if (input.image && input.image.length > 0) schema.image = input.image;
  if (input.ticketsUrl) {
    schema.offers = {
      '@type': 'Offer',
      url: input.ticketsUrl,
    };
  }
  if (input.lineup && input.lineup.length > 0) {
    schema.performer = input.lineup.map((artist) => ({
      '@type': 'MusicGroup',
      name: artist,
    }));
  }

  return schema;
}

export function createVideoObjectSchema(input: VideoObjectSchemaInput): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    '@id': `${toAbsoluteSiteUrl(input.pageUrl)}#video`,
    name: input.name,
    description: input.description || `${input.name} official video.`,
    thumbnailUrl: input.thumbnailUrl || `https://i.ytimg.com/vi/${encodeURIComponent(input.videoId)}/hqdefault.jpg`,
    embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(input.videoId)}`,
    contentUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(input.videoId)}`,
    mainEntityOfPage: toAbsoluteSiteUrl(input.pageUrl),
    publisher: {
      '@type': 'Organization',
      name: 'MUSIC TOP',
      url: SITE_URL,
    },
  };
}
