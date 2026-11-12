import { describe, expect, it } from 'vitest';
import {
  OFFICIAL_NEWS_SOURCES,
  getPublisherRegion,
  getPublisherTrust,
  isMusicPublicationHost,
  isMusicPublicationUrl,
  isRefusedPublisherUrl,
} from '@/lib/news-sources';

/**
 * The registry answers two questions that used to be answered in two places, and
 * got both wrong in the same direction: it judged a Billboard headline as if it
 * came from a general news wire, and it filed an NPR story under `europa` because
 * that is the query which happened to find it.
 */

describe('music publication trust', () => {
  it('trusts a music outlet by host and subdomain', () => {
    expect(isMusicPublicationUrl('https://www.billboard.com/music/rock/story/')).toBe(true);
    expect(isMusicPublicationUrl('https://pitchfork.com/news/x/')).toBe(true);
    expect(isMusicPublicationHost('sub.stereogum.com')).toBe(true);
    expect(isMusicPublicationUrl('https://www.nme.com/news/music/x')).toBe(true);
  });

  it('does not mistake a lookalike domain or a general news site for one', () => {
    expect(isMusicPublicationHost('nmex.com')).toBe(false);
    expect(isMusicPublicationHost('fake-pitchfork.example')).toBe(false);
    expect(isMusicPublicationUrl('https://www.bbc.com/news/world')).toBe(false);
    expect(isMusicPublicationUrl('https://timesofindia.indiatimes.com/city/x')).toBe(false);
    expect(isMusicPublicationUrl(null)).toBe(false);
  });

  it('does not trust a newspaper because the registry lists its music section', () => {
    // The scraper fetches `theguardian.com/music/...`, which put the Guardian in
    // the derived host set and made every Guardian story a trusted music
    // publication: a politics headline with no music words scored zero off-topic
    // and passed the gate. Trust belongs to the publisher, not to a section path.
    expect(isMusicPublicationUrl('https://www.theguardian.com/music/2026/nov/07/story')).toBe(false);
    expect(isMusicPublicationUrl('https://www.standard.co.uk/culture/music/story')).toBe(false);
    expect(isMusicPublicationUrl('https://variety.com/2026/music/news/story')).toBe(false);
    expect(isMusicPublicationUrl('https://www.sbs.com.au/popasia/blog/story')).toBe(false);
  });

  it('still trusts the music desks that are music publications', () => {
    expect(isMusicPublicationUrl('https://www.nme.com/news/music/story')).toBe(true);
    expect(isMusicPublicationUrl('https://diymag.com/news/story')).toBe(true);
    expect(isMusicPublicationUrl('https://www.gramophone.co.uk/news/story')).toBe(true);
  });
});

describe('publisher region', () => {
  it('places the general newsroom that was misfiled', () => {
    // The row that started this: an NPR politics newsletter published under the
    // Europe channel because its copy mentions a European tour.
    expect(getPublisherRegion('https://www.npr.org/2026/08/26/g-s1-140207/up-first-newsletter')).toBe('us');
  });

  it('does not refile a music publication by its postal address', () => {
    // A dry run made this non-negotiable: Billboard's Latin section publishes from
    // anywhere (873 rows would have left `latino`) and NME's global news sits under
    // `/news/music` while its Asia desk uses `/en-asia` (1,092 rows would have left
    // `asia`). Those channels are partly topical, so the publisher's address is the
    // wrong instrument — the query stays in charge.
    expect(getPublisherRegion('https://www.billboard.com/espanol/musica/story/')).toBeNull();
    expect(getPublisherRegion('https://www.nme.com/news/music/k-pop-story')).toBeNull();
    expect(getPublisherRegion('https://pitchfork.com/news/story/')).toBeNull();
  });

  it('places a general newspaper whose music section is in the registry', () => {
    // These entries used to be unreachable: the host was treated as a music
    // publication first, so the resolver returned null before reading this table.
    expect(getPublisherRegion('https://www.theguardian.com/music/2026/nov/07/story')).toBe('uk');
    expect(getPublisherRegion('https://www.standard.co.uk/culture/music/story')).toBe('uk');
    expect(getPublisherRegion('https://variety.com/2026/music/news/story')).toBe('us');
  });

  it('uses the country-code TLD when the publisher is unknown', () => {
    expect(getPublisherRegion('https://www.lemonde.fr/musique/article/1')).toBe('europa');
    expect(getPublisherRegion('https://www.japantimes.co.jp/culture/1')).toBe('asia');
    expect(getPublisherRegion('https://www.rte.ie/entertainment/1')).toBe('uk');
  });

  it('says nothing when the URL says nothing', () => {
    // `.com` places nobody: guessing would refile US publishers into the channel
    // that happened to find them, which is the bug being fixed.
    expect(getPublisherRegion('https://example.com/story')).toBeNull();
    expect(getPublisherRegion(null)).toBeNull();
    expect(getPublisherRegion('not a url')).toBeNull();
  });
});

describe('registry integrity', () => {
  it('has no duplicate section and only known channels', () => {
    const known = new Set(['us', 'uk', 'latino', 'asia', 'europa', 'jazz', 'classical', 'world']);
    const urls = OFFICIAL_NEWS_SOURCES.map((source) => source.url);

    expect(new Set(urls).size).toBe(urls.length);

    for (const source of OFFICIAL_NEWS_SOURCES) {
      expect(known.has(source.region), `${source.url} has region ${source.region}`).toBe(true);
      expect(() => new URL(source.url)).not.toThrow();
    }
  });
});

/**
 * The refuse list is a strictness decision, not a ban: a host on it keeps
 * publishing, but its stories must prove they are music. What it must never do is
 * demote a real music publication, so both halves are pinned.
 */
describe('refuse list', () => {
  it('makes a refused publisher a general newsroom, whatever its music section', () => {
    expect(getPublisherTrust('https://variety.com/2026/music/news/story')).toBe('general');
    expect(getPublisherTrust('https://deadline.com/2026/11/story')).toBe('general');
    expect(getPublisherTrust('https://www.hollywoodreporter.com/news/general-news/story')).toBe('general');
    expect(getPublisherTrust('https://wwd.com/business-news/story')).toBe('general');
    expect(getPublisherTrust('https://nypost.com/2026/11/12/story')).toBe('general');
    expect(getPublisherTrust('https://www.usatoday.com/story/entertainment/music/x')).toBe('general');
    expect(getPublisherTrust('https://www.timeout.com/london/music/x')).toBe('general');
  });

  it('leaves the actual music publications trusted', () => {
    expect(getPublisherTrust('https://www.nme.com/news/music/story')).toBe('music');
    expect(getPublisherTrust('https://pitchfork.com/news/x')).toBe('music');
    expect(getPublisherTrust('https://www.clashmusic.com/news/x')).toBe('music');
  });

  it('matches host and subdomains, never a substring', () => {
    expect(isRefusedPublisherUrl('https://edition.usatoday.com/story/x')).toBe(true);
    expect(isRefusedPublisherUrl('https://varietyexample.com/x')).toBe(false);
    expect(isRefusedPublisherUrl('https://blogs.usatodayexample.com/x')).toBe(false);
    expect(isRefusedPublisherUrl(null)).toBe(false);
    expect(isRefusedPublisherUrl('not a url')).toBe(false);
  });
});
