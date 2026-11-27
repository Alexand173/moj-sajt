/**
 * Which desk a review belongs to, and the picture that stands in when its own
 * photograph cannot be loaded.
 *
 * The reviews page publishes only rows that have a stored image, but a stored URL
 * is not a promise: four cards on the first render came back as black rectangles
 * because `static.punknews.org` answers 403 to a hotlink. A single neutral
 * photograph replaced them all, which made a metal record and a jazz club review
 * look identical at a glance.
 *
 * So the fallback is chosen by genre, and the genre is read from the review itself:
 * the headline first, because "MOTÖRHEAD'S CLASSIC 'ORGASMATRON'" names its own
 * world, then the region channel, which is the only signal some rows carry.
 *
 * Photographs: Unsplash, one per genre, credits kept in the alt text.
 */

export type ReviewGenre = 'metal' | 'rock' | 'pop' | 'hiphop' | 'jazz' | 'latin' | 'electronic' | 'world';

type GenreRule = { genre: ReviewGenre; pattern: RegExp };

/**
 * Order is the whole algorithm: the specific vocabulary before the general.
 * "Heavy metal" must not be read as rock by the word "band", and a rap review that
 * mentions a chart position must not be read as pop.
 */
const GENRE_RULES: GenreRule[] = [
  {
    genre: 'metal',
    pattern: /\b(metal|metallic|metallica|slipknot|mot[öo]rhead|megadeth|slayer|anthrax|deathcore|thrash|doom|djent|hardcore punk|screamo|grindcore)\b/i,
  },
  {
    genre: 'hiphop',
    pattern: /\b(hip[- ]?hop|rap|rapper|rapping|trap|drill|grime|mixtape|freestyle|emcee|south london)\b/i,
  },
  {
    genre: 'electronic',
    pattern: /\b(techno|house music|deep house|edm|dj set|dj|electronic|electronica|synth|rave|club night|bassline|drum and bass|dnb|garage)\b/i,
  },
  {
    genre: 'jazz',
    // No "trio", "quartet" or "quintet": a punk trio is a rock band, and the
    // ensemble word would claim it before the rock rule was ever read.
    pattern: /\b(jazz|bebop|hard bop|swing|blues|saxophone|sax|improvisation|standards)\b/i,
  },
  {
    genre: 'latin',
    pattern: /\b(latin|reggaeton|salsa|cumbia|bachata|corrido|banda|mariachi|perreo|urbano|música urbana)\b/i,
  },
  {
    genre: 'pop',
    pattern: /\b(pop|idol|boy band|girl group|chart|charts|hitmaker|superstar|ballad|arena)\b/i,
  },
  {
    genre: 'rock',
    pattern: /\b(rock|indie|punk|grunge|shoegaze|post-punk|alt[- ]rock|guitar band|riffs|bassist|drummer)\b/i,
  },
];

/** The channel is the last resort, and it is reliable for three of them. */
const REGION_GENRES: Record<string, ReviewGenre> = {
  jazz: 'jazz',
  latino: 'latin',
};

type Placeholder = { url: string; alt: string };

/**
 * One photograph per genre. The alt text carries the photographer's credit, which
 * is the only place a credit belongs — never a caption on the card.
 */
const PLACEHOLDERS: Record<ReviewGenre, Placeholder> = {
  metal: {
    url: 'https://images.unsplash.com/photo-1607872863060-fb85bd7229c4?auto=format&fit=crop&w=1200&q=70',
    alt: 'Red-lit drum kit on a dark stage (placeholder photo: Ivan Lom on Unsplash)',
  },
  rock: {
    url: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&w=1200&q=70',
    alt: 'Crowd facing the stage lights at a rock show (placeholder photo: Nainoa Shizuru on Unsplash)',
  },
  pop: {
    url: 'https://images.unsplash.com/photo-1510731491328-7363eecd7b2d?auto=format&fit=crop&w=1200&q=70',
    alt: 'Singer in a spotlight on a pop stage (placeholder photo: Markus Spiske on Unsplash)',
  },
  hiphop: {
    url: 'https://images.unsplash.com/photo-1577648735394-9c41449a1f6f?auto=format&fit=crop&w=1200&q=70',
    alt: 'Performer raising an arm under a purple stage light (placeholder photo: A J. on Unsplash)',
  },
  jazz: {
    url: 'https://images.unsplash.com/photo-1548163111-bc419d75fef4?auto=format&fit=crop&w=1200&q=70',
    alt: 'Warm amber light over a small jazz club stage (placeholder photo: Filip Mishevski on Unsplash)',
  },
  latin: {
    url: 'https://images.unsplash.com/photo-1771980589908-86b23f94f02b?auto=format&fit=crop&w=1200&q=70',
    alt: 'Colourful stage costumes at a Latin music festival (placeholder photo: Zane Bolen on Unsplash)',
  },
  electronic: {
    url: 'https://images.unsplash.com/photo-1618001200181-e341f7949194?auto=format&fit=crop&w=1200&q=70',
    alt: 'Blue and green lit mixing desk in a dark club (placeholder photo: Aleksey Cherenkevich on Unsplash)',
  },
  world: {
    url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=70',
    alt: 'Concert crowd under stage lights (placeholder photo: Anthony Delanoix on Unsplash)',
  },
};

/**
 * The genre, read in order of how much the text says.
 *
 * The headline comes first, then the standfirst, and only then the channel. The
 * excerpt is not a nicety: the four cards that actually fell back were all podcast
 * interviews whose headlines name a person — "INTERVIEWS: TALKING 'ALWAYS WATCHING'
 * WITH SHIV SCOTT" — while their standfirst says "Toronto-based punk rockers". Read
 * from the headline alone, all four got the same generic photograph, which is the
 * problem a genre-specific stand-in exists to solve.
 */
export function detectReviewGenre(input: {
  title?: string | null;
  excerpt?: string | null;
  region?: string | null;
}): ReviewGenre {
  for (const text of [input.title || '', input.excerpt || '']) {
    if (!text) continue;

    for (const rule of GENRE_RULES) {
      if (rule.pattern.test(text)) return rule.genre;
    }
  }

  const region = (input.region || '').trim().toLowerCase();
  return REGION_GENRES[region] ?? 'world';
}

export function reviewPlaceholder(genre: ReviewGenre): Placeholder {
  return PLACEHOLDERS[genre];
}
