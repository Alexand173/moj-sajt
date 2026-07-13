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
  

"Sam Hunt - This Land Is Your Land",
"Lee Greenwood - God Bless the U.S.A.",
"Toby Keith - Courtesy of the Red, White and Blue (The Angry American)",
"Jordan Davis - Buy Dirt (feat. Luke Bryan)",
"Riley Green - Different 'Round Here (feat. Luke Combs)",
"Cody Johnson - Travelin' Soldier",
"Zac Brown Band - Homegrown",
"Justin Moore - The Ones That Didn’t Make It Back Home",
"Brooks & Dunn - Only In America",
"Scotty McCreery - Bottle Rockets (feat. Hootie & The Blowfish)",
"Luke Combs - Middle of Somewhere",
"Carrie Underwood - All-American Girl",
"Riley Green - Should've Been A Cowboy (Apple Music Sessions)",
"Dierks Bentley - Home",
"Cody Johnson - Made In The USA",
"Anne Wilson - God & Country",
"Montgomery Gentry - My Town",
"Zach Top - Dirt Turns to Gold",
"HARDY - GIVE HEAVEN SOME HELL",
"Toby Keith - Made In America",
"Zac Brown Band - Chicken Fried",
"Tucker Wetmore - As Good As I Once Was (Apple Music Sessions)",
"Randy Houser - How Country Feels",
"John Michael Montgomery - Letters from Home",
"LOCASH - One Big Country Song",
"Florida Georgia Line - U.S. Stronger",
"Cody Johnson, Luke Combs - Shoot The Bull",
"Blake Shelton - God's Country",
"Brantley Gilbert - Real American",
"Larry Fleet - American Made",
"Eric Church - Hell of a View",
"Buddy Jewell - Sweet Southern Comfort",
"Jake Owen - Homemade",
"Chris Janson - This Flag",
"Riley Green - Way Out Here",
"Toby Keith - American Soldier",
"Ashley McBryde, Brothers Osborne - Play Ball",
"Darius Rucker - Wagon Wheel",
"Trisha Yearwood - XXX's and OOO's (An American Girl)",
"Cody Johnson - 'Til You Can't",
"Zach Bryan - American Nights",
"Tyler Hubbard - I Love This Bar (Apple Music Sessions)",
"Jason Aldean - Fly over States",
"Scotty Hasting - Fortunate Son",
"Trace Adkins - American Made",
"Brooks & Dunn - Red Dirt Road",
"Steven Curtis Chapman, Chris Janson - America the Beautiful",
"Lady A - American Honey",
"Trace Adkins - Arlington",
"Luke Bryan - Born Here Live Here Die Here",
"Toby Keith - American Ride",
"RaeLynn, Rhett Akins - We’re American Made",
"Bailey Zimmerman - New To Country",
"Justin Moore - Small Town USA",
"Emily Ann Roberts - Red Solo Cup (Apple Music Sessions)",
"Aaron Tippin - Where the Stars and Stripes and the Eagle Fly",
"Martina McBride - Independence Day",
"Luke Combs - Even Though I'm Leaving",
"Will Kimbrough, SongwritingWith:Soldiers - At Ease",
"Cody Johnson - Human",
"The Chicks - Travelin' Soldier",
"Kenny Chesney - Freedom",
"Dierks Bentley - American Girl",
"Rodney Atkins - It's America",
"Payton Smith - Camouflage Town",
"Matt Stell - One of Us",
"Miranda Lambert - Strange",
"Luke Bryan - Most People Are Good",
"Lainey Wilson - Live Off",
"Alan Jackson - Where I Come From",
"Megan Moroney - Who's Your Daddy? (Apple Music Sessions)",
"Florida Georgia Line - May We All (feat. Tim McGraw)",
"Kenny Chesney - Back Where I Come From",
"Jackson Dean - I Wanna Talk About Me (Apple Music Sessions)",
"HARDY - red (feat. Morgan Wallen)",
"Toby Keith - Beers Ago",
"Zach Bryan - Highway Boys",
"Alabama - Born Country",
"Lee Brice - I Drive Your Truck",
"Kameron Marlowe - How Do You Like Me Now?! (Apple Music Sessions)",
"Kip Moore - Red White Blue Jean American Dream",
"Justin Moore - Love Your Hometown",
"Phil Vassar - American Child",
"The Castellows - Miss America",
"Zach Bryan - Heading South",
"Muscadine Bloodline - Peter From Picayune",
"Kacey Musgraves - Dime Store Cowgirl",
"Brantley Gilbert - Gone But Not Forgotten",
"Scotty Hasting - I'm America",
"Tyler Hubbard - Heroes",
"Alan Jackson - Gone Country",
"Aaron Watson - American Soul",
"Taylor Austin Dye - Little Green Men",
"Brian Kelley - American Spirit",
"Brad Paisley - American Saturday Night",
"Jason Aldean - Small Town Small",
"Ashley McBryde - A Little Less Talk And A Lot More Action (Apple Music Sessions)",
"Dillon Carmichael - Red, White, Camo And Blue",
"The Swon Brothers - Rifle Left Behind",
"Ashley McBryde - Bible and a .44",
"Corey Kent - Once or Twice",
"Jason Aldean - Tough Crowd",
"Zach Bryan - The Great American Bar Scene",
"Cody Hibbard - We Speak Country",
"Keith Urban - For You",
"Alan Jackson - Where Were You (When the World Stopped Turning)",
"Thomas Rhett - American Spirit",
"Logan Mize - American Dream",
"Luke Bryan - Country On",
"Tyler Farr - Rednecks Like Me",
"Cole Swindell - You Should Be Here",
"Mitch Rossell - A Soldier's Memoir",
"Tim McGraw - If You're Reading This (Recorded Live at the 2007 Academy of Country Music Awards)",
"Mickey Guyton - All American",
"Chapel Hart - American Pride",
"Florida Georgia Line - I Love My Country",
"Jamey Johnson - 21 Guns",
"Lonestar - I'm Already There",
"Craig Morgan - Hearts I Leave Behind (feat. Mac Powell)",
"Jerrod Niemann - Old Glory",
"Caitlyn Smith - Dreamin's Free",
"Zac Brown Band - Dress Blues",
"Darryl Worley - Have You Forgotten?",
"Craig Morgan - Soldier",
"LOCASH - Brothers",
"Creed Fisher - Stars and Stripes",
"Merle Haggard - The Fightin' Side of Me",
"Scooter Brown Band - American Son (feat. Charlie Daniels)",
"Trace Adkins - Empty Chair",
"Lonestar - Somebody's Someone",
 
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
          region: 'US',       // <--- DODAJ REGION
          genre_id: 5 ,        // <--- DODAJ ID ŽANRA (npr. 1 za Rock)
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

