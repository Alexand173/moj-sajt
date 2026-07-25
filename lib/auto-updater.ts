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

    const mojePesme = 




[
  "eñau • Ari Lesmana - Sesi Potret",
  "Raim Laode - Iqro'",
  "Ben&Ben - Lifetime (Reimagined)",
  "Adrian Khalif - 2001x",
  "Bảo Anh • Hngle - Tìm Em (feat. Bảo Anh)",
  "Bernadya - Rabun Jauh",
  "Cup of Joe - Multo (Stripped Down)",
  "Bernadya - Kita Buat Menyenangkan",
  "HIEUTHUHAI - Người Im Lặng Gặp Người Hay Nói",
  "Juicy Luicy - Gurun Hujan",
  "Baby Dolls - Oohh Lala Baby",
  "Akbar Chalay • Mingse - Astaga Bercanda",
  "Bernadya - Laut yang Tenang",
  "BINI - Blush",
  "Ben&Ben - Autumn (Reimagined)",
  "Silentia Dua - Drifting",
  "Keisya Levronka - Pelarian",
  "Rony Parulian • Vanessa Zee - Takkan Terulang",
  "Angela Ken - baka bukas",
  "Salma Salsabil - Hatchu!!",
  "Lomba Sihir - Melompat Lebih Tinggi",
  "Reza Artamevia - Keabadian",
  "Adira Suhaimi - Sayang Orang Sama",
  "La Tasya • Rei Vania - Tanpo Hubungan",
  "SB19 - Wakas",
  "Arthur Nery - Desperado",
  "Rony Parulian - Wals Akhir Zaman",
  "BINI - Step Back",
  "Amy Shark - The Biggest Dick",
  "SB19 • BE:FIRST - Toyfriend",
  "Bernadya • Perunggu - Peluk Aku Sekarang!",
  "BINI - Tic Tac Toe",
  "Hoàng Tôn • HIEUTHUHAI - Chờ Tới Khi Anh Về",
  "SB19 • JOLIN - Emoji",
  "La Tasya - Negoro Angin",
  "BINI - Sugar Rush",
  "Lyodra - Pura Pura",
  "Ecko Show • Verry Klau - Lu Kenal Veronica Ko",
  "GREY D - toidaidot",
  "SB19 - Memories",
  "XONARA - TABI",
  "HIEUTHUHAI - Dạo Gần Đây Anh Thấy Anh Khôn...",
  "Arthur Nery - Far Away",
  "UPRIZE - #4",
  "Min • GREY D - đôi mắt kẻ tình si",
  "Lola Amour - Lambing",
  "GREY D - mới hôm qua",
  "GREY D - yêu em như...",
  "GREY D - hoá ra...",
  "BINI - Unang Kilig"
    ];

    for (const [index, query] of mojePesme.entries()) {
      console.log(`Tražim: ${query}...`);

      let videoId = '';
      let thumb = '';

      try {
        const ytRes = await youtube.search.list({
          part: ['id', 'snippet'],
          q: query + " official video",
          maxResults: 1,
          type: ['video'],
        });

        const item = ytRes.data.items?.[0];
        videoId = item?.id?.videoId || '';
        thumb = item?.snippet?.thumbnails?.high?.url || '';
      } catch (ytErr: any) {
        console.warn(`⚠️ YouTube API nedostupan/kvota prekoracena.`);
      }

      // Ako je YouTube zakazao, pravimo privremeni ID da baza ne odbije unos
     if (!videoId) {
  console.log(`⏭️ Preskačem "${query}" jer nema validan YouTube ID (kvota istekla).`);
  continue; // Skaci na sledecu pesmu
}

      const titleParts = query.split(" - ");

      const { error } = await supabase
        .from('songs')
        .upsert({
          title: titleParts[1] || query,
          artist_name: titleParts[0] || "Unknown",
          slika_url: thumb,
          youtube_id: videoId, // Sigurno nije prazno!
          region: 'ASIA',
          genre_id: 12, // C-Pop
          year: 2026,
          is_chart: true
        }, { 
          onConflict: 'title,artist_name,region,genre_id' 
        });

      if (error) {
        console.error(`❌ Greška za ${query}:`, error.message);
      } else {
        console.log(`✅ Uspešno ubačeno: ${query} (ID: ${videoId})`);
      }
    }

    console.log("--- KRAJ ---");

  } catch (err: any) {
    console.error('Kritična greška:', err.message || err);
  }
}