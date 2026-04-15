const { createClient } = require('@supabase/supabase-js');
const RSSParser = require('rss-parser');

const parser = new RSSParser();
// Koristimo SERVICE_ROLE_KEY jer on ima dozvolu da piše u bazu
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const FEEDS = [
  { url: 'https://pitchfork.com/rss/reviews/albums/', cat: 'REVIEW' },
  { url: 'https://www.nme.com/reviews/album/feed', cat: 'REVIEW' },
  { url: 'https://www.rollingstone.com/music/music-news/feed/', cat: 'INTERVIEW' }
];

async function runBot() {
  console.log("Checking for new music content...");
  
  for (const feedInfo of FEEDS) {
    try {
      const feed = await parser.parseURL(feedInfo.url);
      
      for (const item of feed.items) {
        // Osiguravamo da naslov sadrži ključnu reč za tvoj filter
        const lowerTitle = item.title.toLowerCase();
        let finalTitle = item.title;
        
        if (!lowerTitle.includes('review') && !lowerTitle.includes('interview')) {
          finalTitle = `${feedInfo.cat.charAt(0) + feedInfo.cat.slice(1).toLowerCase()}: ${item.title}`;
        }

        const { error } = await supabase
          .from('news')
          .upsert({ 
            title: finalTitle,
            excerpt: item.contentSnippet?.slice(0, 160) + '...',
            url: item.link,
            category: feedInfo.cat,
            region: 'Global',
            created_at: new Date(item.pubDate || new Date())
          }, { onConflict: 'url' }); // Ako link već postoji, preskoči ga (nema dupliranja)

        if (!error) console.log(`Added: ${finalTitle}`);
      }
    } catch (e) {
      console.error(`Error fetching ${feedInfo.url}:`, e.message);
    }
  }
}

runBot();