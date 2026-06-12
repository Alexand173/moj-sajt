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
  bottom: string;
}

function generisiAffiliateLink(izvorniLink: string): string {
  if (!izvorniLink) return '#';
  if (izvorniLink.includes('evyy.net')) return izvorniLink;

  const mojImpactId = "7366014"; 
  const proveraLinka = izvorniLink.toLowerCase();

  const affiliateMape: Record<string, { mediaRail: string; campaign: string }> = {
    'moshtix.com.au':       { mediaRail: '1958987', campaign: '23905' },
    'ticketmaster.com':     { mediaRail: '264167',  campaign: '4272'  },
    'ticketmaster.be':      { mediaRail: '1958966', campaign: '23894' },
    'moshtix.co.nz':        { mediaRail: '1958990', campaign: '23906' },
    'quicket.co.za':        { mediaRail: '3003989', campaign: '36141' },
    'ticketmaster.com.au':  { mediaRail: '1965672', campaign: '24024' },
    'ticketmaster.at':      { mediaRail: '1958968', campaign: '23895' },
    'ticketmaster.com.br':  { mediaRail: '2127876', campaign: '27025' },
    'ticketmaster.cl':      { mediaRail: '2127878', campaign: '27026' },
    'ticketmaster.cz':      { mediaRail: '1958979', campaign: '23901' },
    'ticketmaster.dk':      { mediaRail: '1958964', campaign: '23893' },
    'ticketmaster.fi':      { mediaRail: '1958962', campaign: '23892' },
    'ticketmaster.fr':      { mediaRail: '1958960', campaign: '23891' },
    'ticketmaster.de':      { mediaRail: '1958958', campaign: '23890' },
    'ticketmaster.gr':      { mediaRail: 'XXXXX',   campaign: 'YYYYY' },
    'ticketmaster.ie':      { mediaRail: '1958956', campaign: '23889' },
    'ticketmaster.it':      { mediaRail: '1958975', campaign: '23899' },
    'ticketmaster.com.mx':  { mediaRail: '1958981', campaign: '23902' },
    'ticketmaster.nl':      { mediaRail: '1958954', campaign: '23888' },
    'ticketmaster.co.nz':   { mediaRail: '1965674', campaign: '24025' },
    'ticketmaster.no':      { mediaRail: '1958977', campaign: '23900' },
    'ticketmaster.pe':      { mediaRail: '2127881', campaign: '27028' },
    'ticketmaster.pl':      { mediaRail: '1958971', campaign: '23896' },
    'ticketmaster.ch':      { mediaRail: '1958973', campaign: '23898' },
    'ticketmaster.co.za':   { mediaRail: '1958983', campaign: '23903' },
    'ticketmaster.es':      { mediaRail: '1958952', campaign: '23886' },
    'ticketmaster.se':      { mediaRail: '1958950', campaign: '23885' },
    'ticketmaster.com.tr':  { mediaRail: '1958996', campaign: '23908' },
    'ticketmaster.ae':      { mediaRail: '1958985', campaign: '23904' },
    'ticketmaster.co.uk':   { mediaRail: '1965662', campaign: '24023' },
  };

  const sortiraniDomeni = Object.keys(affiliateMape).sort((a, b) => b.length - a.length);

  for (const domen of sortiraniDomeni) {
    if (proveraLinka.includes(domen)) {
      const { mediaRail, campaign } = affiliateMape[domen];
      if (mediaRail === 'XXXXX') return `https://ticketmaster.evyy.net/c/${mojImpactId}/264167/4272?u=${encodeURIComponent(izvorniLink)}`;
      return `https://ticketmaster.evyy.net/c/${mojImpactId}/${mediaRail}/${campaign}?u=${encodeURIComponent(izvorniLink)}`;
    }
  }
  return `https://ticketmaster.evyy.net/c/${mojImpactId}/264167/4272?u=${encodeURIComponent(izvorniLink)}`;
}

export default function ConcertsList({ dataZaPrikaz, mid1, mid2, mid3, mid4, bottom }: ConcertsListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const concertRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const foundKey = Object.keys(concertRefs.current).find((key) => key.toLowerCase().includes(searchQuery.toLowerCase()));
    if (foundKey && concertRefs.current[foundKey]) {
      concertRefs.current[foundKey]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const element = concertRefs.current[foundKey];
      element?.classList.add('ring-4', 'ring-amber-500', 'transition-all');
      setTimeout(() => { element?.classList.remove('ring-4', 'ring-amber-500'); }, 2000);
    } else {
      alert(`Izvođač "${searchQuery}" nije pronađen.`);
    }
  };

  const ukupno = dataZaPrikaz ? dataZaPrikaz.length : 0;
  let prikaziCetiriSrednje = ukupno > 100;
  let indexMid1 = -1, indexMid2 = -1, indexMid3 = -1, indexMid4 = -1;

  if (prikaziCetiriSrednje) {
    indexMid1 = Math.floor(ukupno * 0.25) - 1;
    indexMid2 = Math.floor(ukupno * 0.50) - 1;
    indexMid3 = Math.floor(ukupno * 0.75) - 1;
    indexMid4 = ukupno - 3;
  } else if (ukupno > 1) {
    indexMid1 = Math.floor(ukupno / 2) - 1;
  }

  return (
    <>
      <div className="max-w-md mx-auto mb-10 px-4">
        <form onSubmit={handleSearchSubmit} className="relative flex items-center">
          <input
            type="text"
            placeholder="Search artist..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-5 py-3 rounded-full border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm"
          />
          <button type="submit" className="absolute right-2 px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-full transition-colors text-sm">
            Search
          </button>
        </form>
      </div>

      {ukupno > 0 ? (
        <div className="space-y-12">
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 px-4">
            {dataZaPrikaz.map((grupa: GroupedConcert, index: number) => (
              <div key={grupa.artist_name} className="contents">
                {/* 🎨 NAŠMINKANA KARTICA */}
                <div
                  ref={(el) => { concertRefs.current[grupa.artist_name] = el; }}
                  className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:border-amber-100"
                >
                  {grupa.image_url && (
                    <div className="h-40 w-full overflow-hidden">
                      <img src={grupa.image_url} alt={grupa.artist_name} className="w-full h-full object-cover transition-transform duration-500 hover:scale-110" />
                    </div>
                  )}

                  <div className="p-4 flex flex-col flex-grow">
                    <h2 className="text-lg font-bold mb-3 text-gray-800">{grupa.artist_name}</h2>
                    <div className="space-y-3">
                      {grupa.events.map((event: Event) => (
                        <div key={event.id} className="border-t pt-2 flex justify-between items-center text-xs text-gray-600">
                          <div>
                            <p>{event.date ? new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}</p>
                            <p className="font-semibold text-gray-800">{event.location}</p>
                          </div>
                          <a
                            href={generisiAffiliateLink(event.ticket_link)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-black text-white px-4 py-2 rounded-lg hover:bg-amber-600 transition-all duration-300 hover:scale-105 font-medium shadow-md"
                          >
                            Tickets
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {index === indexMid1 && <div className="col-span-full py-6"><AdSenseBanner adSlot={mid1} /></div>}
                {prikaziCetiriSrednje && index === indexMid2 && <div className="col-span-full py-6"><AdSenseBanner adSlot={mid2} /></div>}
                {prikaziCetiriSrednje && index === indexMid3 && <div className="col-span-full py-6"><AdSenseBanner adSlot={mid3} /></div>}
                {prikaziCetiriSrednje && index === indexMid4 && <div className="col-span-full py-6"><AdSenseBanner adSlot={mid4} /></div>}
              </div>
            ))}
          </div>
          <div className="pt-8 px-4"><AdSenseBanner adSlot={bottom} /></div>
        </div>
      ) : (
        <div className="text-center text-gray-500 py-20"><p className="text-lg">No concerts found for this region.</p></div>
      )}
    </>
  );
}