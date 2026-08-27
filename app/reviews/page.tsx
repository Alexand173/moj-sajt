import type { Metadata } from 'next';
import { getPublicSupabaseClient } from '@/lib/supabase-public';
import ReviewCard, { type ReviewCardData } from '@/components/ReviewCard';

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
        .limit(40);
      if (error) console.warn('Could not load reviews:', error.message);
      items = (data || []) as ReviewCardData[];
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
