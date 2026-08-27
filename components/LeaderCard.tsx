import { Play, Star, Trophy } from 'lucide-react';

export interface LeaderEntry {
  id: string;
  title: string;
  artist_name: string;
  image?: string;
  votes: number;
  genre_name: string;
  youtube_id?: string;
  rank: number;
}

interface LeaderCardProps {
  entry: LeaderEntry;
}

export default function LeaderCard({ entry }: LeaderCardProps) {
  const playUrl = entry.youtube_id ? `https://www.youtube.com/watch?v=${entry.youtube_id}` : null;

  return (
    <article className="group relative flex min-w-0 flex-col gap-5 overflow-hidden border border-awards-gold bg-ink-elevated p-5 shadow-[0_0_50px_-12px_rgb(255_193_7_/_0.45)] transition-colors sm:flex-row sm:items-center sm:gap-6 sm:p-6">
      <div className="flex shrink-0 items-center gap-3 sm:w-20 sm:flex-col sm:items-center sm:gap-1"><span className="text-5xl font-black italic leading-none tracking-[-0.08em] text-awards-gold tabular-nums">{String(entry.rank).padStart(2, '0')}</span><span className="flex items-center gap-1 text-[8px] font-black tracking-[0.14em] text-awards-gold uppercase"><Trophy aria-hidden="true" className="size-2.5" /> Leading</span></div>
      <div className="size-20 shrink-0 overflow-hidden bg-ink sm:size-24">{entry.image ? <img src={entry.image} alt={entry.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" /> : <span className="flex h-full w-full items-center justify-center text-2xl font-black text-white/25">{entry.artist_name.charAt(0)}</span>}</div>
      <div className="min-w-0 flex-1"><h2 className="truncate text-xl font-black tracking-[-0.04em] text-white sm:text-2xl">{entry.title}</h2><p className="mt-1 truncate text-sm text-white/50">{entry.artist_name}</p>{playUrl && <a href={playUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-full bg-awards-gold px-4 py-2 text-[9px] font-black tracking-[0.14em] text-ink uppercase transition-colors hover:bg-white"><Play aria-hidden="true" className="size-3 fill-current" />Play song</a>}</div>
      <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-4 sm:w-36 sm:flex-col sm:items-end sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0"><div className="text-left sm:text-right"><span className="block text-[8px] font-black tracking-[0.2em] text-white/40 uppercase">MTA points</span><strong className="mt-1 block text-3xl font-black tabular-nums text-white">{entry.votes.toLocaleString()}</strong></div><span className="inline-flex items-center gap-1 rounded-full border border-awards-gold/40 bg-ink px-2.5 py-1 text-[9px] font-black tracking-[0.1em] text-awards-gold uppercase"><Star aria-hidden="true" className="size-2.5 fill-current" /> #{entry.rank} {entry.genre_name}</span></div>
    </article>
  );
}
