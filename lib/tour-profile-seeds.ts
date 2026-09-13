import type { GroupedConcert } from '@/components/ticket-types';
import type { TourProfileContent } from '@/lib/tour-profile-core';

const WIKIMEDIA = 'https://commons.wikimedia.org/wiki';

const memberImages = {
  james: 'https://upload.wikimedia.org/wikipedia/commons/4/4b/James_Hetfield_2017.jpg',
  kirk: 'https://upload.wikimedia.org/wikipedia/commons/6/6f/Kirk_Hammett_2017.jpg',
  lars: 'https://upload.wikimedia.org/wikipedia/commons/d/d2/Lars_Ulrich_%2826060414430%29.jpg',
  robert: 'https://upload.wikimedia.org/wikipedia/commons/6/6f/Robert_Trujillo_2017.jpg',
};

const venueImages = {
  soldierField: 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Soldier_Field_Chicago_aerial_view.jpg',
  metlife: 'https://upload.wikimedia.org/wikipedia/commons/7/7f/MetLife_Stadium%2C_East_Rutherford_NJ.jpg',
  attStadium: 'https://upload.wikimedia.org/wikipedia/commons/2/2e/AT%26T_Stadium%2C_Arlington%2C_Texas%2C_United_States.jpg',
};

export const METALLICA_PROFILE: TourProfileContent = {
  canonicalSlug: 'metallica',
  canonicalName: 'Metallica',
  aliases: [
    'Metallica',
    'Metallica: Life Burns Faster',
    'Metallica 2-Day Ticket',
    'Metallica 2-Day Ticket (2/4/27 & 2/6/27) Cannot Split By Day',
    'Metallica 2-Day Ticket (2/18/27 & 2/20/27) Cannot Split By Day',
  ],
  tourTitle: 'Life Burns Faster',
  tagline: 'Four cities. Four nights. The heaviest tour of the year.',
  heroImageUrl: 'https://i.ytimg.com/vi/6f5SsjjrSp0/hqdefault.jpg',
  galleryImageUrls: [
    'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1800&q=85',
    'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1800&q=85',
  ],
  bio: 'Metallica is the San Francisco-formed metal band built around James Hetfield and Lars Ulrich, with Kirk Hammett and Robert Trujillo completing the current touring lineup. Their shows are designed as full-scale productions: a deep catalog, a huge sound, and a room that becomes part of the performance.',
  moreAbout: [
    'Beyond the hits, Metallica’s live reputation is built on the nights that do not make the setlist — deep cuts, unexpected turns, and the moments that stay with a room long after the lights come up. The Life Burns Faster run is framed as a production made for large American venues, where the band can stretch the dynamics from a quiet opening to a full-stadium finish.',
    'The group’s strength on the road is contrast. A song can begin with the audience carrying the melody, then open into a wall of guitars and drums. That pacing makes the concert feel less like a playlist and more like a night with a beginning, a release, and a final image that follows you out of the venue.',
    'Expect a setlist that moves across the catalog rather than staying in one era. Bring a friend, arrive early, and leave room for the songs that sound different when tens of thousands of people know every word.',
  ],
  members: [
    {
      name: 'James Hetfield',
      role: 'Vocals · Rhythm guitar',
      bio: 'Hetfield’s rhythm guitar and vocal delivery give Metallica its defining weight. On stage, he moves between clipped precision, open-throated hooks, and the direct connection that turns a large venue into a shared room.',
      imageUrl: memberImages.james,
      imageAlt: 'James Hetfield performing with Metallica, photo by Ralph Arvesen, CC BY 2.0',
      imageSourceUrl: `${WIKIMEDIA}/File:James_Hetfield_2017.jpg`,
      imageSourceName: 'Wikimedia Commons · Ralph Arvesen',
      license: 'wikimedia-commons',
    },
    {
      name: 'Kirk Hammett',
      role: 'Lead guitar',
      bio: 'Hammett supplies the melodic edge: memorable leads, expressive bends, and the flashes of improvisation that keep the live versions moving away from the studio frame.',
      imageUrl: memberImages.kirk,
      imageAlt: 'Kirk Hammett performing with Metallica, photo by Ralph Arvesen, CC BY 2.0',
      imageSourceUrl: `${WIKIMEDIA}/File:Kirk_Hammett_2017.jpg`,
      imageSourceName: 'Wikimedia Commons · Ralph Arvesen',
      license: 'wikimedia-commons',
    },
    {
      name: 'Robert Trujillo',
      role: 'Bass · Backing vocals',
      bio: 'Trujillo brings a physical, elastic bass presence to the stage. His playing locks the low end to the drums while giving the live show a visible sense of motion.',
      imageUrl: memberImages.robert,
      imageAlt: 'Robert Trujillo performing with Metallica, photo by Ralph Arvesen, CC BY 2.0',
      imageSourceUrl: `${WIKIMEDIA}/File:Robert_Trujillo_2017.jpg`,
      imageSourceName: 'Wikimedia Commons · Ralph Arvesen',
      license: 'wikimedia-commons',
    },
    {
      name: 'Lars Ulrich',
      role: 'Drums',
      bio: 'Ulrich is the show’s forward motion: an instinctive sense of arrangement, a direct relationship with the crowd, and the drum architecture that lets the band move from tension to release.',
      imageUrl: memberImages.lars,
      imageAlt: 'Lars Ulrich, photo by Greg2600, CC BY-SA 2.0',
      imageSourceUrl: `${WIKIMEDIA}/File:Lars_Ulrich_(26060414430).jpg`,
      imageSourceName: 'Wikimedia Commons · Greg2600',
      license: 'wikimedia-commons',
    },
  ],
  freshMusicVideoId: '6f5SsjjrSp0',
  interviewVideoId: undefined,
  interviewSearchUrl: 'https://www.youtube.com/results?search_query=Metallica+official+band+interview',
  interviewText: [
    'Before the run, the members describe a production built around scale without losing the details that make the songs work. The useful part of any interview is hearing how the arrangements change once the room becomes part of the instrument.',
    'Read the conversation alongside the current dates: it gives the ticket buyer a better sense of the people, pacing, and intent behind the night rather than presenting the show as a list of songs alone.',
    'Press play before you go, then come back to the date panel when you are ready to choose the city and official Ticketmaster link that works for you.',
  ],
  popularSongs: [
    { title: 'Enter Sandman', year: 1991, note: 'The arena-sized closer that turns a chorus into a shared ritual.' },
    { title: 'Master of Puppets', year: 1986, note: 'A precision-built classic with a live middle section made for a loud room.' },
    { title: 'Nothing Else Matters', year: 1991, note: 'The set’s open-hearted pause before the night accelerates again.' },
    { title: 'One', year: 1988, note: 'A patient build that gives the full production its dramatic center.' },
    { title: 'Fade to Black', year: 1984, note: 'A melodic deep cut that rewards listeners who know the catalog.' },
  ],
  albums: [
    { title: 'Metallica (The Black Album)', year: 1991, highlight: 'A 30× platinum landmark that made the band’s largest rooms possible.' },
    { title: 'Master of Puppets', year: 1986, highlight: 'The thrash masterpiece that remains a central live reference point.' },
    { title: 'Ride the Lightning', year: 1984, highlight: 'The record that widened the band’s vocabulary without losing its speed.' },
    { title: '…And Justice for All', year: 1988, highlight: 'A progressive, ambitious chapter with songs that still stretch the set.' },
  ],
  awards: [
    { title: 'Grammy Awards', year: 2009, note: 'Metallica’s Grammy history includes the Best Metal Performance win for “My Apocalypse”.' },
    { title: 'Rock and Roll Hall of Fame', year: 2009, note: 'Inducted in the first year of eligibility after decades of influence.' },
    { title: 'Library of Congress', year: 2016, note: 'Master of Puppets was added to the National Recording Registry.' },
    { title: 'Polar Music Prize', year: 2018, note: 'Sweden’s award recognized the band’s impact on heavy music worldwide.' },
  ],
  venues: [
    {
      name: 'Soldier Field',
      city: 'Chicago',
      capacity: 'Concert configuration varies',
      info: 'A lakefront stadium with a compact bowl and a distinctive Chicago skyline setting. Plan extra time for transit and the walk through Grant Park.',
      imageUrl: venueImages.soldierField,
      imageSourceUrl: `${WIKIMEDIA}/File:Soldier_Field_Chicago_aerial_view.jpg`,
      imageSourceName: 'Wikimedia Commons · public domain',
    },
    {
      name: 'MetLife Stadium',
      city: 'East Rutherford, New Jersey',
      capacity: 'Concert configuration varies',
      info: 'A major New York metro stadium with large-scale production access. Check the event-day transit plan before leaving for the venue.',
      imageUrl: venueImages.metlife,
      imageSourceUrl: `${WIKIMEDIA}/File:MetLife_Stadium,_East_Rutherford_NJ.jpg`,
      imageSourceName: 'Wikimedia Commons · Kenneth C. Zirkel',
    },
    {
      name: 'AT&T Stadium',
      city: 'Arlington, Texas',
      capacity: 'Concert configuration varies',
      info: 'A climate-controlled Arlington venue built for spectacle, with a retractable roof and a giant center-hung video board.',
      imageUrl: venueImages.attStadium,
      imageSourceUrl: `${WIKIMEDIA}/File:AT%26T_Stadium,_Arlington,_Texas,_United_States.jpg`,
      imageSourceName: 'Wikimedia Commons · Michael Barera',
    },
  ],
  merch: [
    { name: 'Tour T-Shirt', type: 'Apparel', priceLabel: '$35' },
    { name: 'Heavyweight Hoodie', type: 'Apparel', priceLabel: '$65' },
    { name: 'Life Burns Faster Vinyl', type: 'Music', priceLabel: '$30' },
    { name: 'Tour Poster', type: 'Print', priceLabel: '$25' },
    { name: 'Metallica Tote Bag', type: 'Accessory', priceLabel: '$20' },
    { name: 'Snapback Cap', type: 'Apparel', priceLabel: '$28' },
  ],
  seoTitle: 'Metallica: Life Burns Faster Tour Tickets & Dates',
  seoDescription: 'Explore Metallica’s Life Burns Faster tour dates, official Ticketmaster links, member stories, music, venues, and the details worth knowing before you go.',
  sourceUrls: [
    'https://www.metallica.com/',
    'https://www.grammy.com/artists/metallica/12834',
    `${WIKIMEDIA}/File:James_Hetfield_2017.jpg`,
    `${WIKIMEDIA}/File:Kirk_Hammett_2017.jpg`,
    `${WIKIMEDIA}/File:Lars_Ulrich_(26060414430).jpg`,
    `${WIKIMEDIA}/File:Robert_Trujillo_2017.jpg`,
  ],
  contentOrigin: 'seeded',
  aiStatus: 'reviewed',
};

export function getSeededTourProfile(slug: string): TourProfileContent | null {
  return slug === METALLICA_PROFILE.canonicalSlug ? METALLICA_PROFILE : null;
}

export function createFallbackTourProfile(group: GroupedConcert): TourProfileContent {
  const eventLocations = group.events.map((event) => event.location).filter(Boolean).join(' · ');
  return {
    canonicalSlug: group.artist_slug || group.artist_name.toLowerCase().replace(/\s+/g, '-'),
    canonicalName: group.artist_name,
    aliases: [group.artist_name],
    tourTitle: `${group.artist_name} live dates`,
    tagline: `Verified concert dates, official tickets, and what to know before the show in ${eventLocations || 'your city'}.`,
    heroImageUrl: group.image_url || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1800&q=85',
    galleryImageUrls: [],
    bio: `${group.artist_name} is bringing a live production to the cities listed below. Explore the current schedule, choose an official ticket link, and check back as the promoter updates the run.`,
    moreAbout: [`MusicTop is building a richer profile for ${group.artist_name}. This page keeps the verified dates and official ticket links live while the editorial profile is being reviewed.`],
    members: [],
    interviewSearchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${group.artist_name} interview`)}`,
    interviewText: [`Watch the latest official ${group.artist_name} interview and listen before you choose your date.`],
    popularSongs: [],
    albums: [],
    awards: [],
    venues: [],
    merch: [],
    seoTitle: `${group.artist_name} Tour Tickets & Dates | MusicTop`,
    seoDescription: `Find current ${group.artist_name} concert dates, official ticket links, venue information, and live music coverage from MusicTop.`,
    sourceUrls: [],
    contentOrigin: 'supabase',
    aiStatus: 'pending',
  };
}
