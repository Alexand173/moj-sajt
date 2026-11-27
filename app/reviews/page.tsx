import type { Metadata } from 'next';
import { getPublicSupabaseClient } from '@/lib/supabase-public';
import { isMusicStory } from '@/lib/news-editorial';
import ReviewCard, { type ReviewCardData } from '@/components/ReviewCard';

const REVIEW_PAGE_SIZE = 40;
/**
 * Over-fetch, because the relevance filter below drops rows. The page selects by
 * title — any story with "review" or "interview" in it — so without the filter a
 * game review or a fixture thread is published here as music criticism.
 *
 * Raised from 80 when the two display rules below were added: of 537 review-titled
 * rows, 183 are classical and 308 have no picture, so a small window would come
 * back nearly empty after filtering.
 */
const REVIEW_FETCH_LIMIT = 300;

/**
 * Genres this desk does not cover.
 *
 * The page is for the popular repertoire — rock, pop, metal, hip-hop, jazz — and a
 * ballet double bill or a La Scala opera review is a different publication's beat.
 * The `classical` channel is excluded wholesale, and the wording catches the rows
 * filed elsewhere whose subject is still the concert hall.
 */
const CLASSICAL_SUBJECT = /\b(ballet|ballet'?s|opera|operatic|opera house|orchestras?|orchestral|symphon(?:y|ies|ic)|philharmonic|recital|concerto|chamber music|string quartet|requiem|lieder|bel canto|classical)\b/i;

/** Nothing on this page is published without a picture. */
function hasPicture(item: ReviewCardData): boolean {
  return Boolean(item.image?.trim());
}

function isPopularGenre(item: ReviewCardData): boolean {
  if (item.region === 'classical') return false;

  return !CLASSICAL_SUBJECT.test(item.title || '');
}

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Reviews & Interviews',
  description: 'Read MusicTop reviews, interviews, and in-depth music industry features.',
  alternates: { canonical: '/reviews' },
};

export default async function ReviewsPage() {
  const supabase = getPublicSupabaseClient();
  let items: ReviewCardData[] = [];

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('news')
        .select('*')
        .or('title.ilike.%review%,title.ilike.%interview%')
        // A row with no source is not published (see `lib/news-publication.ts`),
        // and its article page 404s, so it cannot be a card here.
        .not('url', 'is', null)
        .neq('url', '')
        .order('created_at', { ascending: false })
        .limit(REVIEW_FETCH_LIMIT);
      if (error) console.warn('Could not load reviews:', error.message);

      // Two guards, both needed: `skipped` marks a row the cleanup judged not to
      // be music, and the shared verdict catches anything stored before a subject
      // was named — including rows the cleanup has not reached yet.
      items = ((data || []) as ReviewCardData[])
        .filter((item) => item.ai_status !== 'skipped')
        // Headline plus publisher, never the excerpt: a film review's summary
        // mentions the soundtrack, so reading it rescues the very items this page
        // must not show. The URL is what tells a music outlet from a general feed.
        .filter((item) => isMusicStory({ title: item.title, url: item.url }))
        // Only the popular repertoire, and only where there is a picture to show:
        // a card with no image left a third of the grid as blank paper.
        .filter((item) => isPopularGenre(item) && hasPicture(item))
        .slice(0, REVIEW_PAGE_SIZE);
    } catch (error) {
      console.warn('Could not load reviews:', error);
    }
  }

  return (
    <div className="mt-page mt-page--paper">
      <section className="border-b border-line">
        <div className="mt-container py-14 lg:py-20">
          <p className="mt-kicker">The critics&apos; desk</p>
          <div className="mt-5 flex flex-wrap items-end justify-between gap-6">
            <div><h1 className="mt-display text-[clamp(4rem,12vw,10rem)] text-ink">Reviews</h1><p className="mt-6 max-w-xl text-sm leading-relaxed text-muted sm:text-base">Verdicts on the records, tours, and conversations shaping the global music conversation — filed by critics who were in the room.</p></div>
            <span className="mt-meta text-muted">{items.length} verdicts this week</span>
          </div>
          <div className="mt-10 flex flex-wrap gap-2 border-t border-line pt-5" aria-label="Review categories">
            {['All', 'Albums', 'Live', 'Interviews', 'Metal', 'Jazz', 'UK', 'US', 'World'].map((filter, index) => <span key={filter} className={`rounded-full border px-3.5 py-1.5 text-[9px] font-black tracking-[0.16em] uppercase ${index === 0 ? 'border-ink bg-ink text-white' : 'border-line text-muted'}`}>{filter}</span>)}
          </div>
        </div>
      </section>

      <main className="mt-container py-12 lg:py-16">
        {items.length > 0 ? (
          <div className="grid auto-rows-min grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {items.map((item, index) => <ReviewCard key={item.id} review={item} featured={index === 0} />)}
          </div>
        ) : (
          <div className="border border-line bg-paper-muted px-6 py-32 text-center"><h2 className="text-4xl font-black tracking-[-0.06em] text-ink uppercase sm:text-6xl">Archive is being updated.</h2></div>
        )}
      </main>
    </div>
  );
}
