import { ExternalLink, MapPin } from 'lucide-react';

export interface FestivalCardData {
  id: string;
  name: string;
  date_start: string | Date;
  location: string;
  image_url: string;
  tickets_url: string;
}

interface FestivalCardProps {
  festival: FestivalCardData;
  screenshotUrl: string;
  featured?: boolean;
}

export default function FestivalCard({ festival, screenshotUrl, featured = false }: FestivalCardProps) {
  const date = new Date(festival.date_start);
  const month = Number.isNaN(date.getTime()) ? 'TBA' : date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const day = Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-US', { day: 'numeric' });

  return (
    <article className={`group relative overflow-hidden border border-line bg-ink ${featured ? 'md:col-span-2 lg:col-span-3' : ''}`}>
      <a href={festival.tickets_url} target="_blank" rel="noopener noreferrer" className="block">
        <div className={`relative overflow-hidden bg-[radial-gradient(circle_at_30%_20%,rgb(230_57_70_/_0.22),transparent_45%),linear-gradient(135deg,#121212,#08090a)] ${featured ? 'h-[22rem] sm:h-[28rem]' : 'h-64 sm:h-72'}`}>
          <img src={festival.image_url || screenshotUrl} alt={festival.name} loading={featured ? 'eager' : 'lazy'} fetchPriority={featured ? 'high' : 'auto'} decoding="async" className="h-full w-full object-cover grayscale transition-all duration-700 group-hover:scale-105 group-hover:grayscale-0" />
          <div className="mt-image-overlay absolute inset-0" />
          <div className="absolute left-3 top-3 flex size-12 flex-col items-center justify-center bg-white text-ink sm:left-4 sm:top-4 sm:size-14"><span className="text-[9px] font-black tracking-widest text-accent-red">{month}</span><span className="text-2xl font-black leading-none tabular-nums">{day}</span></div>
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 border border-white/20 bg-ink/75 px-2.5 py-1 text-[9px] font-black tracking-[0.12em] text-white uppercase backdrop-blur-md sm:right-4 sm:top-4"><ExternalLink aria-hidden="true" className="size-3" />Official</span>
          <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6 lg:p-7">
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-ink/85 px-3 py-1 text-[9px] font-black tracking-[0.1em] text-white uppercase"><MapPin aria-hidden="true" className="size-3 shrink-0 text-accent-blue" /><span className="truncate">{festival.location}</span></span>
            <h2 className={`mt-3 line-clamp-2 font-black leading-[0.9] tracking-[-0.05em] text-white uppercase ${featured ? 'text-4xl sm:text-6xl' : 'text-2xl sm:text-3xl'}`}>{festival.name}</h2>
            <span className="mt-4 inline-flex items-center gap-2 text-[10px] font-black tracking-[0.18em] text-white uppercase">Visit official site <span className="text-accent-red">↗</span></span>
          </div>
        </div>
      </a>
    </article>
  );
}
