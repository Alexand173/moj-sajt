import type { ChartSong } from '@/lib/chart-types';
import ChartMasthead from '@/components/ChartMasthead';
import SongCard from '@/components/SongCard';
import SuggestionSection from '@/components/SuggestionSection';
import SuggestionScrollBadge from '@/components/SuggestionScrollBadge';

export interface ChartPageViewProps {
  songs: ChartSong[];
  regionName: string;
  genreName: string;
  genreId: number;
  canonicalPath?: string;
  showSuggestions?: boolean;
}

export default function ChartPageView({
  songs,
  regionName,
  genreName,
  genreId,
  canonicalPath,
  showSuggestions = songs.length > 0,
}: ChartPageViewProps) {
  return (
    <div className="mt-page">
      <ChartMasthead
        regionName={regionName}
        genreName={genreName}
        songCount={Math.min(songs.length, 100) || 100}
        canonicalPath={canonicalPath}
      />

      <main className="mt-container pb-24 pt-7 sm:pt-10 lg:pb-36">
        {songs.length > 0 ? (
          <div className="space-y-2 sm:space-y-3">
            {songs[0] && <SongCard song={songs[0]} rank={1} variant="big" />}

            {(songs[1] || songs[2]) && (
              <div className="space-y-2 sm:space-y-3">
                {songs.slice(1, 3).map((song, index) => (
                  <SongCard key={song.id} song={song} rank={index + 2} variant="medium" />
                ))}
              </div>
            )}

            {songs.length > 3 && (
              <section aria-labelledby="remaining-chart-heading" className="border-t border-white/10 pt-7 sm:pt-10">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <h2 id="remaining-chart-heading" className="mt-meta text-white/45">Ranks 04–{songs.length}</h2>
                  <span className="hidden text-[9px] font-bold tracking-[0.18em] text-white/35 uppercase sm:inline">Streaming now</span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {songs.slice(3).map((song, index) => (
                    <SongCard key={song.id} song={song} rank={index + 4} variant="standard" />
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <div className="border border-white/10 bg-ink-elevated px-6 py-24 text-center">
            <p className="mt-meta text-white/45">No tracks found for {regionName.toUpperCase()} {genreName.toUpperCase()} yet.</p>
          </div>
        )}

        {showSuggestions && (
          <section id="suggestions-section" className="border-t border-white/10 pt-16 sm:pt-20">
            <SuggestionSection regionName={regionName} genreId={genreId} genreName={genreName} />
          </section>
        )}
      </main>

      <SuggestionScrollBadge />
    </div>
  );
}
