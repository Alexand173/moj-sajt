import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function updateMusicCharts() {
  try {
    console.log("--- START RUČNOG AŽURIRANJA ---");

    // Ovde unesi pesme koje želiš na sajtu (ovo menjaš po želji)
   
   
  const mojePesme = [
"Aterciopelados, Andrea Echeverri - La Teta Pirata",

"Juanes, Conociendo Rusia - Cómo Pudiste",

"Camilo Séptimo - Cierro los Ojos",

"Playa Futura, Oh'laville - Tormenta",

"Mala Gestión - Buenos días Vietnam",

"Alcalá Norte - El Hombre Planeta",

"Funambulista, Dani Fernández - La última canción",

"The Warning - Kerosene",

"Draco Rosa - Montserrat",

"niño viejo - Malos Amigos",

"Sputnik - Clásico Moderno",

"Cosmovision - Psicosomático",

"Da Igual - Voy a Mi Ritmo",

"Modelo de Respuesta Polar - Una ilusión",

"Superlitio - Sal",

"Carrera Blanca - Harakiri",

"Aperol - Aperol",

"Liquits - No No No",

"Mal Pasar, La Vela Puerca, Sebastián Teysera - Música Envasada",

"Cementerio Club - Los años",

"Mancha De Rolando, Coti - Melodia Simple",

"Aterciopelados - MOR",

"Airbag - Nunca Lo Olvides",

"Fito Paez - Superextraño",

"Rubytates, Camilo Séptimo - Despertar",

"Ultraligera - Me Miras Mal",

"El Zar, No Te Va Gustar - Parte de Mi",

"Bunbury - Las chingadas ganas de llorar",

"Rayos Láser, Juan Ingaramo - El Día y La Noche",

"Espejos Rotos - sueños escasos",

"Nuevos Vicios - Cada Vez",

"Joven Dolores - Tu desdén",

"Allison - Orfeo",

"Ella Es Tan Cargosa - La Gente",

"Volcán - Ver Tus Ojos Mirándome",

"Guasones, Santiago Motorizado - Hay Momentos",

"Los Colores - El Nombre De Tu Perro",

"Alther, TOURISTA - Adrenaline",

"ALONG - Nunca Amigos",

"Cepa Funk - Bailemos",

"Siddhartha, Leiva - Nada por Hecho",

"Suerte Campeón - Amor",

"Juan Pablo Rey - Niño Emoción",

"Don Tetto - Miénteme, Prométeme",

"Plutonio de Alto Grado - RELÁMPAGO",

"Luca Bocci - Música de Computadora",

"Nunca Es Tarde - Llévame",

"Juanes - La Versión En Mi Cabeza",

"PRISET - Incendio",

"RAYNA - Un barquito",

"GIRLBONE, Liapsis - MURIENDOME",

"Mundaka - Donde veas más lejos",

"Porter - Mundo Extraño",

"Efelante - Amigos, Música y Vino",

"Las Pelotas - Es Clara",

"Los Tres - Hojas de Té - 2023",

"Revólver Plateado - Mariposa Nocturna",

"Los Bunkers - Bajo Los Árboles",

"Molotov, WOS - Money In The Bank",

"Leiva, Conociendo Rusia - Jaula de Oro",

"REOT - ¿Quién Dice?",

"Efelante - Si Navego Lento",

"Los Romanticos de Zacatecas - Fresno",

"No llores, Juanita - Cuando cruzas esa puerta",

"SERBIA - Nunca Me Olvides",

"No Te Va Gustar, Vetusta Morla - Yo Sabré Qué Hacer",

"Los Bunkers - Rey",

"León Larregui - Holidays",

"DLD - Toda Mi Fe",

"El Mató a un Policía Motorizado - Medalla de Oro",

"Joaquín Sabina - Contra Todo Pronóstico",

"Cuartavenida, Dos Veigas - Veleta",

"Chesca - Mijita",

"Los Telepáticos - Daria",

"Los Mesoneros - Más Tuyo",

"Andrés Belem, Wayo Elguera - Vieja Tierra",

"Cometa Sucre - Cero Normal",

"División Minúscula - Escombros",

"Tenda - El sitio de siempre",

"Silvestre y La Naranja - Tu Veneno",

"Los Cocoa - 1990",

"Usted Señalemelo - Las Flores Sangran",

"Vilma Palma e Vampiros - Flaca",

"Mainake - Se acabó",
];

    for (const query of mojePesme) {
      console.log(`Tražim: ${query}...`);

      const ytRes = await youtube.search.list({
        part: ['id', 'snippet'],
        q: query + " official video",
        maxResults: 1,
        type: ['video'],
      });

      const item = ytRes.data.items?.[0];
      const videoId = item?.id?.videoId;
      const thumb = item?.snippet?.thumbnails?.high?.url;
      const titleParts = query.split(" - ");

      const { error } = await supabase
        .from('songs')
        .upsert({
          title: titleParts[1] || query,
          artist_name: titleParts[0] || "Unknown",
          slika_url: thumb || '',
          youtube_id: videoId || '',
          region: 'LATINO',       // <--- DODAJ REGION
          genre_id: 1,        // <--- DODAJ ID ŽANRA (npr. 1 za Rock)
          year: 2026,         // <--- DODAJ GODINU
          is_chart: true      // <--- DA BUDE AKTIVNA
        }, { onConflict: 'title' });

      if (error) {
        console.error(`❌ Greška za ${query}:`, error.message);
      } else {
        console.log(`✅ Uspešno ubačeno: ${query}`);
      }
    }

    console.log("--- KRAJ ---");

  } catch (err: any) {
    console.error('Kritična greška:', err.message || err);
  }
}