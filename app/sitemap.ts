import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const baseUrl = 'https://musictop.net';

  // Inicijalizacija Supabase klijenta sa tvojim ključevima iz .env
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Povlačimo sve aktivne pesme iz baze za 2026. godinu koje imaju YouTube ID
  const { data: songs } = await supabase
    .from('songs')
    .select('region, genre_id, title, artist_name, youtube_id')
    .eq('year', 2026)
    .not('youtube_id', 'eq', '');

  // 🚀 SADA JE 100% USKLAĐENO SA TVOJOM SLIKOM IZ BAZE (image_97febd.png)
  const genreMapping: { [key: number]: string } = {
    1: 'rock',
    2: 'pop',
    3: 'hip-hop',
    4: 'rb-soul',
    5: 'country',
    6: 'dance', // Mapira ID 6 na tvoj URL slug 'dance'
    7: 'j-pop',
    8: 'j-rock-metal',
    9: 'k-pop',
    10: 'c-pop',
    11: 'india',
    12: 'other'
  };

  // Tvoja originalna struktura URL-ova na sajtu
  const siteStructure = {
    us: ['rock', 'pop', 'hip-hop', 'rb-soul', 'country', 'dance'],
    uk: ['rock', 'pop', 'hip-hop', 'rb-soul', 'country', 'dance'],
    europa: ['rock', 'pop', 'hip-hop', 'rb-soul', 'country', 'dance'],
    latino: ['rock', 'pop', 'hip-hop', 'rb-soul', 'country', 'dance'],
    asia: ['j-pop', 'j-rock-metal', 'k-pop', 'c-pop', 'india', 'other'],
    world: ['rock', 'pop', 'hip-hop', 'rb-soul', 'country', 'dance'],
    jazz: ['jazz'],
    classical: ['classical']
  };

  // Generisanje XML-a sa zvaničnim Google Video namespace-om za pesme
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">`;

  // Glavne rute
  const mainRoutes = ['', '/reviews', '/awards'];
  mainRoutes.forEach(route => {
    xml += `
  <url>
    <loc>${baseUrl}${route}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>${route === '' ? '1.0' : '0.8'}</priority>
  </url>`;
  });

  // Dinamičke rute (Region -> Žanr) i ubacivanje pesama iz baze
  Object.entries(siteStructure).forEach(([region, genres]) => {
    genres.forEach((genre) => {
      xml += `
  <url>
    <loc>${baseUrl}/region/${region}/${genre}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>`;

      // Tražimo pesme koje pripadaju trenutnom regionu i žanru
      const filterovanePesme = songs?.filter(song => {
        const songRegion = song.region?.toLowerCase();
        const songGenreStr = genreMapping[song.genre_id];
        return songRegion === region && songGenreStr === genre;
      }) || [];

      // Za svaku pesmu pravimo video tag koji Google direktno indeksira u pretrazi
      filterovanePesme.forEach(song => {
        // Čišćenje karaktera kako XML ne bi prijavio grešku
        const cistTitle = `${song.artist_name} - ${song.title}`.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        
        xml += `
    <video:video>
      <video:thumbnail_loc>https://img.youtube.com/vi/${song.youtube_id}/hqdefault.jpg</video:thumbnail_loc>
      <video:title>${cistTitle}</video:title>
      <video:description>Slušajte i glasajte za hit ${cistTitle} na MusicTop listi za 2026. godinu.</video:description>
      <video:player_loc>https://www.youtube.com/embed/${song.youtube_id}</video:player_loc>
    </video:video>`;
      });

      xml += `
  </url>`;
    });
  });

  // Sve ostale rute (Tours, News, Festivals)
  const ostaleKategorije = ['tours', 'news', 'festivals'];
  ostaleKategorije.forEach(kat => {
    Object.keys(siteStructure).forEach(region => {
      xml += `
  <url>
    <loc>${baseUrl}/${kat}/${region}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`;
    });
  });

  xml += `\n</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=43200'
    },
  });
}