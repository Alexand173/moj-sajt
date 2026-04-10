import { createClient } from '@supabase/supabase-js';
import { getArtistImage } from '@/lib/spotify'; // Ovo je fajl koji smo napravili

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function RegionalToursPage({ params }: { params: Promise<{ regionName: string }> }) {
  const { regionName } = await params;
  
  // 1. Povuci podatke iz baze
  const { data: tours, error } = await supabase
    .from('koncerti')
    .select('*')
    .eq('region', regionName.toUpperCase())
    .order('event_date', { ascending: true });

  return (
    <div className="min-h-screen bg-[#050505] text-white pt-32 pb-40">
      <div className="max-w-[1200px] mx-auto px-6">
        
        {/* HEADER */}
        <div className="mb-16">
          <h1 className="text-7xl font-black uppercase tracking-tighter italic leading-none">
            {regionName} <span className="text-yellow-500">Events</span>
          </h1>
          <p className="text-zinc-500 font-bold uppercase tracking-[0.3em] mt-4 text-[10px]">
            Official MusicTop.net Partner Program • Powered by Spotify API
          </p>
        </div>

        <div className="grid gap-6">
          {tours && tours.length > 0 ? (
            // Koristimo Promise.all da bismo mogli da koristimo await unutar map funkcije
            await Promise.all(tours.map(async (tour) => {
              
              // AUTOMATIZACIJA SLIKE: Prvo baza, pa Spotify, pa Unsplash kao zadnja nada
              let finalImage = tour.image_url;
              
              if (!finalImage || finalImage === 'NULL' || finalImage.includes('scdn.co')) {
                // Ako je link loš ili ga nema, pitaj Spotify API koristeći tvoj Client ID
                const spotifyImg = await getArtistImage(tour.artist_name);
                finalImage = spotifyImg || `https://images.unsplash.com/featured/?concert,${tour.artist_name.replace(/\s+/g, '')}`;
              }

              const url = tour.ticket_url?.toLowerCase() || '';
              const isTicketmaster = url.includes('ticketmaster') || url.includes('livenation');
              const isViagogo = url.includes('viagogo');
              const isEventim = url.includes('eventim');

              return (
                <div key={tour.id} className="group flex flex-col md:flex-row items-center justify-between p-6 border border-white/5 rounded-[2.5rem] bg-zinc-900/10 backdrop-blur-md hover:border-yellow-500/20 transition-all duration-500">
                  
                  <div className="flex items-center gap-8 flex-1 w-full">
                    {/* SLIKA ARTISTA */}
                    <div className="relative w-28 h-28 flex-shrink-0 overflow-hidden rounded-[1.5rem] bg-zinc-800 shadow-2xl">
                      <img 
                        src={finalImage} 
                        alt={tour.artist_name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                    </div>

                    {/* INFORMACIJE */}
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-3xl font-black uppercase tracking-tighter">{tour.artist_name}</h3>
                        {isTicketmaster && (
                          <span className="text-[7px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-1 rounded-full font-black uppercase">Live Nation Partner</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
                        <span>{new Date(tour.event_date).toLocaleDateString('sr-RS')}</span>
                        <span className="text-zinc-800">•</span>
                        <span>{tour.venue}</span>
                        <span className="text-zinc-800">•</span>
                        <span className="text-white">{tour.city}</span>
                      </div>
                    </div>
                  </div>

                  {/* DUGME ZA KUPOVINU */}
                  <div className="mt-8 md:mt-0 flex flex-col items-end gap-3 w-full md:w-auto">
                    <div className="text-right">
                      <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1">Tickets starting at</p>
                      <p className="text-2xl font-black text-white leading-none">{tour.price}</p>
                    </div>
                    
                    <a 
                      href={tour.ticket_url} 
                      target="_blank"
                      rel="sponsored noopener noreferrer"
                      className={`w-full md:w-64 py-5 rounded-full font-black uppercase text-[11px] tracking-[0.2em] transition-all text-center
                        ${isViagogo ? 'bg-[#ff5722] text-white hover:shadow-[0_0_30px_rgba(255,87,34,0.3)]' : 
                          isTicketmaster ? 'bg-[#026cdf] text-white hover:shadow-[0_0_30px_rgba(2,108,223,0.3)]' : 
                          isEventim ? 'bg-[#002855] text-white hover:bg-sky-600' :
                          'bg-yellow-500 text-black hover:bg-white'}
                      `}
                    >
                      {isViagogo ? 'Resale Tickets' : 'Get Tickets'}
                    </a>
                  </div>

                </div>
              );
            }))
          ) : (
            <div className="py-40 text-center">
              <p className="text-zinc-600 font-black uppercase tracking-[0.5em]">No events scheduled for {regionName}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
  }