import { NextResponse } from 'next/server';

export async function GET() {
  const TM_API_KEY = process.env.TICKETMASTER_API_KEY;

  const URL = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${TM_API_KEY}&keyword=music&size=10`;
  const response = await fetch(URL);
  const data = await response.json();

  if (!data._embedded?.events) {
    return NextResponse.json({ status: "Error", message: "Ticketmaster ne vraća podatke" });
  }

  // Normalizacija podataka
  const allEvents = data._embedded.events.map((e: any) => {
    const artistName = e._embedded?.attractions?.[0]?.name || e.name || "Nepoznat izvođač";
    const imageUrl = e.images && e.images.length > 0 ? e.images[0].url : null;
    const ticketUrl = e.url || e.sales?.public?.url || null;
    const countryCode = e._embedded?.venues?.[0]?.country?.countryCode || 'US';

    return {
      artist_name: artistName,
      event_date: e.dates?.start?.localDate || null,
      city: e._embedded?.venues?.[0]?.city?.name || "Nepoznato",
      ticket_url: ticketUrl,
      image_url: imageUrl,
      region: countryCode, // Ispisi ovo da vidis sta stize
      raw_name: e.name // Da vidimo puno ime
    };
  });

  // Vrati podatke kao JSON umesto upisa u bazu
  return NextResponse.json({ 
    total_found: allEvents.length,
    sample_data: allEvents 
  });
}