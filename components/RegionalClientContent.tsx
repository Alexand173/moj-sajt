'use client';

import { useEffect, useState } from 'react';
import { Play, X } from 'lucide-react';
import SuggestionForm from '@/components/SuggestionForm';

export interface RegionalSong {
  id: string;
  title: string;
  artist_name: string;
  slika_url?: string | null;
  youtube_id?: string | null;
  votes?: number | null;
  genre?: string | null;
}

interface RegionalClientContentProps {
  initialSongs: RegionalSong[];
  region: string;
}

export default function RegionalClientContent({ initialSongs, region }: RegionalClientContentProps) {
  const [songs] = useState(initialSongs);
  const [selectedSong, setSelectedSong] = useState<RegionalSong | null>(null);

  useEffect(() => {
    if (!selectedSong) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedSong(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSong]);

  const getVideoSrc = (id?: string | null) => id ? `https://www.youtube.com/embed/${id}` : null;

  return (
    <div className="mt-page mt-page--paper pb-20">
      <section className="border-b border-line">
        <div className="mt-container py-14 lg:py-20">
          <p className="mt-kicker">{region} regional chart</p>
          <h1 className="mt-display mt-5 text-[clamp(3.75rem,11vw,9rem)] text-ink">{region} top 100</h1>
          <p className="mt-6 max-w-xl text-sm leading-relaxed text-muted">The official {region} chart, ranked by audience engagement and updated from the MUSIC TOP database.</p>
        </div>
      </section>

      <main className="mt-container py-10 lg:py-14">
        {songs.length > 0 ? (
          <>
            {songs[0] && (
              <article className="group overflow-hidden border border-accent-red bg-ink shadow-[0_0_40px_-8px_rgb(230_57_70_/_0.45)]">
                <div className="aspect-video w-full bg-ink">
                  {getVideoSrc(songs[0].youtube_id) ? <iframe src={getVideoSrc(songs[0].youtube_id) || ''} title={`${songs[0].title} preview`} className="h-full w-full" allow="autoplay; encrypted-media" allowFullScreen /> : <div className="flex h-full items-center justify-center text-xs font-bold tracking-[0.16em] text-white/45 uppercase">Video unavailable</div>}
                </div>
                <div className="flex flex-col gap-6 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7"><div className="min-w-0"><div className="mb-2 flex items-center gap-3"><span className="text-5xl font-black italic leading-none text-accent-red">01</span><span className="mt-meta text-white/45">Featured entry</span></div><h2 className="truncate text-3xl font-black leading-none tracking-[-0.05em] text-white uppercase sm:text-5xl">{songs[0].title}</h2><p className="mt-2 text-sm font-bold tracking-[0.12em] text-white/55 uppercase">{songs[0].artist_name}</p></div><button type="button" onClick={() => setSelectedSong(songs[0])} className="shrink-0 border border-white/30 px-5 py-3 text-[10px] font-black tracking-[0.18em] text-white uppercase transition-colors hover:border-accent-red hover:bg-accent-red">View details</button></div>
              </article>
            )}

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              {songs.slice(1, 3).map((song, index) => (
                <article key={song.id} className="group overflow-hidden border border-line bg-ink transition-colors hover:border-accent-red">
                  <div className="aspect-video bg-ink">{getVideoSrc(song.youtube_id) ? <iframe src={getVideoSrc(song.youtube_id) || ''} title={`${song.title} preview`} className="h-full w-full" allowFullScreen /> : <div className="flex h-full items-center justify-center text-xs text-white/45">Video unavailable</div>}</div>
                  <div className="flex items-center justify-between gap-4 p-5"><div className="min-w-0"><span className="text-3xl font-black italic text-white/25">{String(index + 2).padStart(2, '0')}</span><h2 className="mt-2 truncate text-xl font-black leading-none tracking-[-0.04em] text-white uppercase">{song.title}</h2><p className="mt-1 truncate text-[10px] font-bold tracking-[0.12em] text-white/50 uppercase">{song.artist_name}</p></div><button type="button" onClick={() => setSelectedSong(song)} className="shrink-0 border border-white/20 px-3 py-2 text-[9px] font-black tracking-[0.14em] text-white uppercase transition-colors hover:border-accent-red hover:bg-accent-red">Info</button></div>
                </article>
              ))}
            </div>

            <section className="mt-12 border-t border-line pt-7" aria-labelledby="regional-song-list">
              <div className="mb-3 flex items-center justify-between px-2"><h2 id="regional-song-list" className="mt-meta text-muted">Rank & artist</h2><span className="mt-meta text-muted">MTA points</span></div>
              <div className="space-y-1">
                {songs.slice(3).map((song, index) => <button key={song.id} type="button" onClick={() => setSelectedSong(song)} className="group flex w-full items-center justify-between gap-4 border-b border-line bg-white px-4 py-4 text-left transition-colors hover:bg-paper-hover sm:px-5"><span className="flex min-w-0 items-center gap-4 sm:gap-7"><span className="w-7 shrink-0 text-lg font-black italic text-line-strong tabular-nums">{String(index + 4).padStart(2, '0')}</span><span className="min-w-0"><span className="block truncate text-sm font-black tracking-[-0.02em] text-ink uppercase transition-colors group-hover:text-accent-red">{song.title}</span><span className="mt-1 block truncate text-[10px] font-bold tracking-[0.1em] text-muted uppercase">{song.artist_name}</span></span></span><span className="flex shrink-0 items-center gap-3"><span className="hidden rounded-full bg-paper-muted px-2.5 py-1 text-[9px] font-black tracking-[0.1em] text-muted uppercase sm:inline">{song.genre || 'Music'}</span><span className="text-sm font-black tabular-nums text-ink">{(song.votes || 0).toLocaleString()}</span><span className="flex size-8 items-center justify-center rounded-full border border-line text-accent-red transition-colors group-hover:border-accent-red group-hover:bg-accent-red group-hover:text-white"><Play aria-hidden="true" className="size-3 fill-current" /></span></span></button>)}
              </div>
            </section>
          </>
        ) : (
          <div className="border border-line bg-paper-muted px-6 py-24 text-center text-sm font-bold tracking-[0.14em] text-muted uppercase">No tracks found for this region yet.</div>
        )}

        <section className="mt-16 grid grid-cols-1 gap-8 border-t border-line pt-12 lg:grid-cols-3 lg:gap-12"><div><h2 className="text-3xl font-black tracking-[-0.06em] text-ink uppercase">Suggest a song</h2><p className="mt-3 text-sm leading-relaxed text-muted">Is your favorite song missing? Suggest it now.</p></div><div className="lg:col-span-2"><SuggestionForm region={region} /></div></section>
      </main>

      {selectedSong && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-ink/95 p-4 backdrop-blur-md sm:p-8" role="dialog" aria-modal="true" aria-labelledby="selected-song-title" onClick={() => setSelectedSong(null)}>
          <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto border border-white/15 bg-ink-elevated p-5 sm:p-8" onClick={(event) => event.stopPropagation()}>
            <button type="button" aria-label="Close song details" onClick={() => setSelectedSong(null)} className="absolute right-4 top-4 flex size-9 items-center justify-center border border-white/20 text-white transition-colors hover:border-accent-red hover:bg-accent-red sm:right-6 sm:top-6"><X aria-hidden="true" className="size-4" /></button>
            <div className="grid gap-8 pt-8 md:grid-cols-2 md:items-center"><div className="aspect-video overflow-hidden bg-black">{getVideoSrc(selectedSong.youtube_id) ? <iframe src={`${getVideoSrc(selectedSong.youtube_id)}?autoplay=1`} title={`${selectedSong.title} player`} className="h-full w-full" allow="autoplay; encrypted-media" allowFullScreen /> : <div className="flex h-full items-center justify-center text-xs text-white/45">Video unavailable</div>}</div><div><p className="mt-meta text-accent-red">Official entry · {selectedSong.genre || 'Music'}</p><h2 id="selected-song-title" className="mt-4 text-4xl font-black leading-[0.9] tracking-[-0.06em] text-white uppercase sm:text-5xl">{selectedSong.title}</h2><p className="mt-2 text-lg text-white/55">{selectedSong.artist_name}</p><div className="mt-7 grid grid-cols-2 gap-3"><div className="border border-white/10 bg-white/5 p-4"><span className="mt-meta text-white/45">Genre</span><strong className="mt-2 block text-sm font-black text-white uppercase">{selectedSong.genre || 'Music'}</strong></div><div className="border border-white/10 bg-white/5 p-4"><span className="mt-meta text-white/45">MTA points</span><strong className="mt-2 block text-2xl font-black text-accent-red">{(selectedSong.votes || 0).toLocaleString()}</strong></div></div><button type="button" onClick={() => setSelectedSong(null)} className="mt-7 w-full bg-white px-5 py-3 text-[10px] font-black tracking-[0.18em] text-ink uppercase transition-colors hover:bg-accent-red hover:text-white">Close details</button></div></div>
          </div>
        </div>
      )}
    </div>
  );
}
