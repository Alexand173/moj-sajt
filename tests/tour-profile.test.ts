import { describe, expect, it } from 'vitest';
import { mergeTicketRows, normalizeArtistIdentity, resolveArtistIdentity, slugifyArtist } from '@/lib/tour-profile';

describe('tour profile identity resolution', () => {
  it('normalizes punctuation and ampersands consistently', () => {
    expect(normalizeArtistIdentity('Metallica: Life Burns Faster')).toBe('metallica life burns faster');
    expect(normalizeArtistIdentity('AC/DC & Friends')).toBe('ac dc and friends');
    expect(slugifyArtist('The Weeknd')).toBe('the-weeknd');
  });

  it('resolves Metallica tour-title variants to one canonical artist', () => {
    const identity = resolveArtistIdentity('Metallica 2-Day Ticket (2/4/27 & 2/6/27) Cannot Split By Day');
    expect(identity.canonicalSlug).toBe('metallica');
    expect(identity.canonicalName).toBe('Metallica');
  });

  it('merges duplicate artist labels without losing event rows', () => {
    const groups = mergeTicketRows([
      { id: 'one', artist_name: 'Metallica: Life Burns Faster', image_url: 'hero.jpg', video_url: null, date: '2027-02-04', location: 'Soldier Field, Chicago', city: 'Chicago', ticket_link: 'https://ticketmaster.com/one' },
      { id: 'two', artist_name: 'Metallica 2-Day Ticket', image_url: '', video_url: 'https://youtu.be/AAAAAAAAAAA', date: '2027-02-06', location: 'Soldier Field, Chicago', city: 'Chicago', ticket_link: 'https://ticketmaster.com/two' },
      { id: 'two', artist_name: 'Metallica', image_url: '', video_url: null, date: '2027-02-06', location: 'Soldier Field, Chicago', city: 'Chicago', ticket_link: 'https://ticketmaster.com/two' },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].artist_slug).toBe('metallica');
    expect(groups[0].events).toHaveLength(2);
    expect(groups[0].image_url).toBe('hero.jpg');
    expect(groups[0].video_url).toBe('https://youtu.be/AAAAAAAAAAA');
  });
});
