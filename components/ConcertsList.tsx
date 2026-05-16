'use client';

import { useState, useRef } from 'react';
import AdSenseBanner from '@/components/AdSenseBanner';

interface Event {
  id: string;
  date: string;
  location: string;
  ticket_link: string;
}

interface GroupedConcert {
  artist_name: string;
  image_url: string;
  events: Event[];
}

interface ConcertsListProps {
  dataZaPrikaz: GroupedConcert[];
  mid1: string;
  mid2: string;
  mid3: string;
  mid4: string;
  bottom: string; // <-- Prihvatamo bottom slot
}

export default function ConcertsList({ dataZaPrikaz, mid1, mid2, mid3, mid4, bottom }: ConcertsListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const concertRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const foundKey = Object.keys(concertRefs.current).find((key) =>
      key.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (foundKey && concertRefs.current[foundKey]) {
      concertRefs.current[foundKey]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });

      const element = concertRefs.current[foundKey];
      element?.classList.add('ring-4', 'ring-amber-500', 'transition-all');
      setTimeout(() => {
        element?.classList.remove('ring-4', 'ring-amber-500');
      }, 2000);
    } else {
      alert(`Izvođač "${searchQuery}" nije pronađen na ovoj stranici.`);
    }
  };

  const ukupno = dataZaPrikaz ? dataZaPrikaz.length : 0;

  // --- PAMETNA DINAMIČKA LOGIKA ZA REKLAME ---
  let prikaziCetiriSrednje = ukupno > 100;

  let indexMid1 = -1;
  let indexMid2 = -1;
  let indexMid3 = -1;
  let indexMid4 = -1;

  if (prikaziCetiriSrednje) {
    // Ako ima preko 100 koncerata, delimo ih ravnomerno
    indexMid1 = Math.floor(ukupno * 0.25) - 1;
    indexMid2 = Math.floor(ukupno * 0.50) - 1;
    indexMid3 = Math.floor(ukupno * 0.75) - 1;
    indexMid4 = ukupno - 3; // Staviti malo pre samog kraja da se ne sudari sa bottom banerom
  } else if (ukupno > 1) {
    // Ako ima 100 ili manje, samo 1 reklama na polovini liste
    indexMid1 = Math.floor(ukupno / 2) - 1;
  }

  return (
    <>
      {/* 🔍 SEARCH BAR */}
      <div className="max-w-md mx-auto mb-10 px-4">
        <form onSubmit={handleSearchSubmit} className="relative flex items-center">
          <input
            type="text"
            placeholder="Search artist (e.g. Sondergard)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-5 py-3 rounded-full border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm"
          />
          <button
            type="submit"
            className="absolute right-2 px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-full transition-colors text-sm"
          >
            Search
          </button>
        </form>
      </div>

      {/* 🎴 GRID SA KARTICAMA */}
      {ukupno > 0 ? (
        <div className="space-y-12">
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 px-4">
            {dataZaPrikaz.map((grupa: GroupedConcert, index: number) => (
              <div key={grupa.artist_name} className="contents">
                
                {/* KARTICA IZVOĐAČA */}
                <div
                  ref={(el) => {
                    concertRefs.current[grupa.artist_name] = el;
                  }}
                  className="w-full bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col transition-all duration-300"
                >
                  {grupa.image_url && (
                    <div className="h-40 w-full overflow-hidden">
                      <img
                        src={grupa.image_url}
                        alt={grupa.artist_name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <div className="p-4 flex flex-col flex-grow">
                    <h2 className="text-lg font-bold mb-3 text-gray-800">{grupa.artist_name}</h2>

                    <div className="space-y-3">
                      {grupa.events.map((event: Event) => (
                        <div
                          key={event.id}
                          className="border-t pt-2 flex justify-between items-center text-xs text-gray-600"
                        >
                          <div>
                            <p>
                              {event.date
                                ? new Date(event.date).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                  })
                                : 'N/A'}
                            </p>
                            <p className="font-semibold">{event.location}</p>
                          </div>
                          <a
                            href={event.ticket_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-black text-white px-3 py-1 rounded-md hover:bg-gray-800 transition"
                          >
                            Tickets
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* SREDNJE REKLAME */}
                {index === indexMid1 && (
                  <div className="col-span-full py-6">
                    <AdSenseBanner adSlot={mid1} />
                  </div>
                )}

                {prikaziCetiriSrednje && index === indexMid2 && (
                  <div className="col-span-full py-6">
                    <AdSenseBanner adSlot={mid2} />
                  </div>
                )}

                {prikaziCetiriSrednje && index === indexMid3 && (
                  <div className="col-span-full py-6">
                    <AdSenseBanner adSlot={mid3} />
                  </div>
                )}

                {prikaziCetiriSrednje && index === indexMid4 && (
                  <div className="col-span-full py-6">
                    <AdSenseBanner adSlot={mid4} />
                  </div>
                )}

              </div>
            ))}
          </div>

          {/* --- 4. BEZBEDNA REKLAMA NA SAMOM DNU ---
              Nalazi se izvan .map petlje i unutar glavnog div-a, 
              što joj garantuje da se ispisuje tačno jednom na dnu liste bez sudaranja!
          */}
          <div className="pt-8 px-4">
            <AdSenseBanner adSlot={bottom} />
          </div>
        </div>
      ) : (
        <div className="text-center text-gray-500 py-20">
          <p className="text-lg">No concerts found for this region.</p>
        </div>
      )}
    </>
  );
}