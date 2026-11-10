import type { Metadata } from 'next';
import { getPublicSupabaseClient } from '@/lib/supabase-public';
import { isOffTopicJunk } from '@/lib/news-relevance';
import ReviewCard, { type ReviewCardData } from '@/components/ReviewCard';

const REVIEW_PAGE_SIZE = 40;
/**
 * Over-fetch, because the relevance filter below drops rows. The page selects by
 * title — any story with "review" or "interview" in it — so without the filter a
 * game review or a fixture thread is published here as music criticism.
 */
const REVIEW_FETCH_LIMIT = 80;

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
        .order('created_at', { ascending: false })
        .limit(REVIEW_FETCH_LIMIT);
      if (error) console.warn('Could not load reviews:', error.message);

      // Two guards, both needed: `skipped` marks a row the cleanup judged not to
      // be music, and the junk rule catches anything stored before that existed —
      // including rows the cleanup has not reached yet. The rule is deliberately
      // narrow, so a review of a dance piece or a songwriter profile stays.
      items = ((data || []) as ReviewCardData[])
        .filter((item) => item.ai_status !== 'skipped')
        // Headline only: a film review's summary mentions the soundtrack, so
        // reading the excerpt rescues the very items this page must not show.
        .filter((item) => !isOffTopicJunk({ title: item.title }))
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
            {['All', 'Albums', 'Live', 'Interviews', 'Classical', 'UK', 'US', 'World'].map((filter, index) => <span key={filter} className={`rounded-full border px-3.5 py-1.5 text-[9px] font-black tracking-[0.16em] uppercase ${index === 0 ? 'border-ink bg-ink text-white' : 'border-line text-muted'}`}>{filter}</span>)}
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
