import { ArrowUpRight, Star } from 'lucide-react';

export interface ReviewCardData {
  id: string | number;
  title: string;
  excerpt: string | null;
  image: string | null;
  url: string | null;
  category: string | null;
  created_at: string;
  region: string | null;
}

interface ReviewCardProps {
  review: ReviewCardData;
  featured?: boolean;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'LATEST';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
}

function CardContent({ review, featured }: ReviewCardProps) {
  return (
    <>
      {review.image && (
        <div className={`relative overflow-hidden bg-ink ${featured ? 'h-72 sm:h-96' : 'h-52'}`}>
          <img src={review.image} alt={review.title} loading={featured ? 'eager' : 'lazy'} fetchPriority={featured ? 'high' : 'auto'} decoding="async" className="h-full w-full object-cover grayscale transition-all duration-700 group-hover:scale-105 group-hover:grayscale-0" />
          <div className="mt-image-overlay absolute inset-0" />
          <div className="absolute left-4 top-4 flex items-center gap-2"><span className="bg-white px-2.5 py-1 text-[9px] font-black tracking-[0.2em] text-ink uppercase">{review.category || 'Official'}</span><span className="inline-flex items-center gap-1 bg-ink/80 px-2.5 py-1 text-[9px] font-black tracking-widest text-white"><Star aria-hidden="true" className="size-2.5 fill-accent-red text-accent-red" />{featured ? '4.5' : 'Latest'}</span></div>
        </div>
      )}
      <div className={`flex flex-1 flex-col bg-white p-5 ${featured ? 'sm:p-7' : ''}`}>
        <div className="mb-4 flex items-center justify-between gap-3"><span className="mt-meta text-muted">{formatDate(review.created_at)}</span>{!review.image && <span className="border border-ink px-2 py-1 text-[9px] font-black tracking-[0.2em] text-ink uppercase">{review.category || 'Feature'}</span>}</div>
        <h2 className={`font-black leading-[0.96] tracking-[-0.045em] text-ink uppercase ${featured ? 'text-2xl sm:text-4xl' : 'text-lg sm:text-xl'}`}>{review.title}</h2>
        {review.excerpt && <p className="mt-3 line-clamp-3 text-sm font-serif italic leading-relaxed text-muted">&quot;{review.excerpt}&quot;</p>}
        <p className="mt-3 line-clamp-1 text-[9px] font-bold tracking-[0.14em] text-muted uppercase">Source: MusicTop editorial</p>
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-5"><span className="inline-flex items-center gap-1.5 text-[10px] font-black tracking-[0.18em] text-ink uppercase transition-colors group-hover:text-accent-blue">Read more <ArrowUpRight aria-hidden="true" className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></span><span className="bg-paper-muted px-2.5 py-1 text-[9px] font-black tracking-[0.18em] text-ink uppercase">{review.region || 'Global'}</span></div>
      </div>
    </>
  );
}

export default function ReviewCard({ review, featured = false }: ReviewCardProps) {
  const className = `group flex min-w-0 flex-col overflow-hidden border border-line bg-white transition-colors hover:border-ink ${featured ? 'lg:col-span-2 lg:row-span-2' : ''}`;

  if (!review.url) return <article className={className}><CardContent review={review} featured={featured} /></article>;

  return <a href={review.url} target="_blank" rel="noopener noreferrer" className={className}><CardContent review={review} featured={featured} /></a>;
}
