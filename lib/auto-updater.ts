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
"YOASOBI - Adventure (アドベンチャー)",

"Radwimps - September-san (セプテンバーさん)",

"Ikuta Lilas - Sparkle (スパークル)",

"Kenshi Yonezu - Chikyugi (地球儀)",

"Official HIGE DANdism - Yesterday (イエスタデイ)",

"Yuuri - Dry Flower (ドライフラワー)",

"King Gnu - Chameleon (カメレオン)",

"Yuuri x Hashiguchi Kanaderiya - Merry-Go-Round (メリーゴーランド)",

"MONGOL800 - Chisana Koi no Uta (小さな恋のうた)",

"Sukima Switch - Kanade (奏)",

"SEKAI NO OWARI - Habit",

"Reol - The Sixth Sense (第六感)",

"Tatsuya Kitani - Where Our Blue Is (青のすみか / Utattemita)",

"Uru - Koi (恋)",

"Funky Monkey Babys - Ato Hitotsu (あとひとつ)",
"King Gnu - Hakujitsu (白日)",

"Aimer - Kataomoi (カタオモイ)",

"Uru - Sore o Ai to Yobu nara (それを愛と呼buなら)",

"Ado - Utattemita (歌いました)",

"瑛人 (Eito) - Kousui (香水)",

"Aimer - Zankyou Sanka (残響散歌)",

"Nakajima Miyuki - Ito (糸)",

"Aimyon - Hadaka no Kokoro (裸の心)",

"Yorushika - Tada Kimi ni Hare (ただ君に晴れ)",

"Aimyon - Marigold (マリーゴールド)",

"Ado - Kaze no Yukue (風のゆくえ)",
"Natori - Overdose (なとり)",

"Kenshi Yonezu - M87 (Ｍ八七)",

"Tatsuya Kitani - Ao no Sumika (Jujutsu Kaisen)",

"Mrs. GREEN APPLE - Ao to Natsu (青と夏)"
,
"Yoasobi - Tsubame (ツバメ)",

"Kenshi Yonezu - Lemon",

"Aimyon - Harunohi (ハルノヒ)",

"Masaki Suda - Nijii (虹)",

"Yuuri - Betelgeuse (ベテルギウス)",

"Kenshi Yonezu - Uma to Shika (馬と鹿)",

"DISH - Neko (猫)",

"Ikimonogakari - Sakura"
,
"Yoasobi - Idol (アイドル)",

"Smap - Sekai ni Hitotsu Dake no Hana",

"Yoasobi - Yoru ni Kakeru (夜に駆ける)",
"Sekai No Owari - Rain",

"Masaki Suda - Machigaisagashi (まちがいさがし)",

"Kenshi Yonezu - Flamingo",

"Kazumasa Oda - Tashika na Koto (たしかなこと)",

"Hikaru Utada - One Last Kiss",

"Official HIGE DANdism - I Love...",
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
          region: 'ASIA',       // <--- DODAJ REGION
          genre_id: 7,        // <--- DODAJ ID ŽANRA (npr. 1 za Rock)
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