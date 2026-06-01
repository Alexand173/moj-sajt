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
  


"Rvssian, Rauw Alejandro, Wizkid - PONGO",
"Omar Courtz - KOKO",
"Ovy On The Drums, Quevedo, Beéle - YO y TÚ",
"Romeo Santos, Prince Royce - Dardos",
"ARIA VEGA, Ryan Castro - CHÉVERE (premium_remix)",
"Shakira, Beéle - ALGO TÚ",
"Kali Uchis - Muévelo",
"Young Cister, Kreamly - QLOO*",
"De La Rose - Yo te conozco :):",
"Vale Pintos, KEVVO - La Vision",
"Tainy, Rauw Alejandro, JHAYCO - ROSITA",
"El Bogueto, Anuel AA, Fuerza Regida, Yung Beef - Cuando No Era Cantante - Remix",
"Quevedo - SCANDIC",
"Álvaro Díaz, LATIN MAFIA - MALASNOTICIAS.",
"Carlos Vives - Tuyo y Nada Más",
"Tito Double P - PASE Y PASE",
"Eladio Carrión - Ricky Bobby",
"Cazzu - Perdón si no te llamé",
"Carlos Vives - Te Dedico",
"Joaquina - torpe",
"SAIKO - Dios los Bendiga (feat. Tito El Bambino)",
"Manuel Turizo - Por un Pendejo no se Llora (Salud mi Reina)",
"Yandel, LATIN MAFIA - Cómo Es Que Se Hace",
"Alejandro Sanz - Las guapas",
"Maria Becerra, El Alfa, XROSS - HACE CALOR",
"Manuel Turizo - Cosas de Enamorao (Salud mi Reina)",
"Manuel Turizo - Mírame Ahora",
"Rels B - TU VAS SIN (fav)",
"Xavi, Kapo - Bien Pedos",
"Danny Ocean, Aitana - Anoche",
"Lali, Duki - PLÁSTICO",
"Danny Ocean, Sech - Priti",
"Lali, Miranda! - MEJOR QUE VOS",
"Rauw Alejandro - Carita Linda",
"Cazzu - Mala Suerte",
"Ariza, Morat - Ciudad Amurallada",
"Sebastián Yatra - La Pelirroja",
"Morat, Camilo - Me Toca A Mí",
"Alleh, Yorghaki - una noche",
"Manuel Turizo - Sigueme Besando Así",
"Morat - La Policía",
"Rusherking, KHEA - MONTECARLO",
"Sebastián Yatra - Los Domingos",
"Manuel Turizo, Elder Dayán Díaz - La Ex de mi Amigo",
"Lali - NO ME IMPORTA",
"Leo Rizzi, Lasso - QUEBRANTO",
"Danny Ocean, Kapo - Imagínate",
"Aitana - SUPERESTRELLA",
"David Bisbal - Vivir Así Es Morir De Amor",
"Luis Fonsi, Feid - CAMBIARÉ (Desde La Sanse)",
"Juanes - Hagamos Que (Visualizer)",
"Greeicy, Cultura Profética - Mantis (Official Video)",
"Ela Taubert - La Gente Cambia (Lyric Video)",
"TIMØ - Palabras (Official Video)",
"Danna - YOU COULD BE THAT BOY",
"FABIAN - GOLPE (Official Video)",
"Cali Y El Dandee - Último Primer Beso (Official Video)",
"Sebastián Yatra, Lucho RK, Belinda, Gente De Zona - CANCIÓN PARA REGRESAR",
"KURT - Por Si Te Quieres Quedar",
"Annasofia, Andrés Cepeda - Estamos a Paz (Official Video)",
"TIMØ - No Hay Que Llorar (Lyric Video)",
"Sebastián Yatra, Jay Kabalan - CUCARACHEO (Lyric Video)",
"Kendall Peña - 506",
"Ela Taubert, Jay Wheeler - NO SUPISTE CUIDARNOS (Respuesta #2)",
"Joaquina - amarillo (Official Video)",
"Bratty - la estrella que quería brillar",
"Belanova - Rosa Pastel",
"Kalimba - Vida (Visualizer)",
"Aitana - 6 DE FEBRERO (Video Oficial)",
"Daniela Spalla - Bar de corazones rotos (Lyric Video)",
"Annasofia - Déjame Intentar (Official Video)",
"Esteman - Piensa en mí (Lyric Video)",
"Vanesa Martin Oficial - Maldita Mudanza (Video Oficial)",
"Joaquina - pelinegra (Visualizer)",
"Juanes - Cuando Estamos Tú y Yo (Official Video)",
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
          genre_id: 2 ,        // <--- DODAJ ID ŽANRA (npr. 1 za Rock)
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