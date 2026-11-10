/**
 * Who publishes the news, and where they are.
 *
 * Two things needed the same knowledge and had it in different places:
 *
 * - The OFFICIAL scraper carried its own inline list of ~140 section URLs.
 * - The relevance gate judged every NewsAPI article as if it came from a general
 *   firehose, so a Billboard headline naming only an artist ("Blackpink – Go") had
 *   to prove it was music in English — the same false negative the scraper avoided
 *   by trusting its curated list.
 *
 * Here the list is one registry, and both paths read it: the scraper for what to
 * fetch, the gate for how much to trust, and the region resolver for where a
 * publisher is based.
 *
 * Regions are lowercase channel names, matching `NewsRegion` in
 * `lib/news-regions.ts`: us, uk, latino, asia, europa, jazz, classical, world.
 */

export interface OfficialNewsSource {
  url: string;
  region: string;
}

export const OFFICIAL_NEWS_SOURCES: OfficialNewsSource[] = [
  // --- US ---
  { url: 'https://pitchfork.com/news/', region: 'us' },
  { url: 'https://www.rollingstone.com/music/music-news/', region: 'us' },
  { url: 'https://www.billboard.com/c/music/music-news/', region: 'us' },
  { url: 'https://www.spin.com/category/news/', region: 'us' },
  { url: 'https://hiphopdx.com/news', region: 'us' },
  { url: 'https://www.complex.com/music/', region: 'us' },
  { url: 'https://www.stereogum.com/category/news/', region: 'us' },
  { url: 'https://consequence.net/category/music/news/', region: 'us' },
  { url: 'https://www.hotnewhiphop.com/news/', region: 'us' },
  { url: 'https://www.revolvermag.com/news', region: 'us' },
  { url: 'https://www.vibe.com/c/news/', region: 'us' },
  { url: 'https://www.altpress.com/news/', region: 'us' },
  { url: 'https://www.dancingastronaut.com/news/', region: 'us' },
  { url: 'https://www.relix.com/news/', region: 'us' },
  { url: 'https://variety.com/c/music/news/', region: 'us' },
  { url: 'https://www.thefader.com/category/music', region: 'us' },
  { url: 'https://ultimateclassicrock.com/category/latest-news/', region: 'us' },
  { url: 'https://www.rap-up.com/category/news/', region: 'us' },
  { url: 'https://news.pollstar.com/category/top-stories/', region: 'us' },
  { url: 'https://www.magneticmag.com/category/news/', region: 'us' },

  // --- UK ---
  { url: 'https://www.nme.com/news/music', region: 'uk' },
  { url: 'https://www.clashmusic.com/news/', region: 'uk' },
  { url: 'https://www.thelineofbestfit.com/news', region: 'uk' },
  { url: 'https://diymag.com/news', region: 'uk' },
  { url: 'https://www.gigwise.com/news/', region: 'uk' },
  { url: 'https://mne.com/news/', region: 'uk' },
  { url: 'https://www.loudersound.com/news', region: 'uk' },
  { url: 'https://www.kerrang.com/feed', region: 'uk' },
  { url: 'https://www.residentadvisor.net/news', region: 'uk' },
  { url: 'https://www.mixmag.net/news', region: 'uk' },
  { url: 'https://www.thequietus.com/news/', region: 'uk' },
  { url: 'https://www.musicweek.com/news', region: 'uk' },
  { url: 'https://www.uncut.co.uk/news/', region: 'uk' },
  { url: 'https://www.clashmusic.com/category/news/uk-news/', region: 'uk' },
  { url: 'https://www.rocksins.com/category/news/', region: 'uk' },
  { url: 'https://www.standard.co.uk/culture/music', region: 'uk' },
  { url: 'https://www.theguardian.com/music/music+tone/news', region: 'uk' },
  { url: 'https://www.dorkmag.com/news/', region: 'uk' },
  { url: 'https://www.beatportal.com/news/', region: 'uk' },
  { url: 'https://www.list.co.uk/music/', region: 'uk' },

  // --- LATINO ---
  { url: 'https://www.billboard.com/espanol', region: 'latino' },
  { url: 'https://www.los40.com', region: 'latino' },
  { url: 'https://www.ociolatino.com', region: 'latino' },
  { url: 'https://www.popelera.net', region: 'latino' },
  { url: 'https://www.latin-roll.com', region: 'latino' },
  { url: 'https://www.latinolife.co.uk', region: 'latino' },
  { url: 'https://www.global-pop-magazine.com', region: 'latino' },
  { url: 'https://www.radio-gladyspalmera.com', region: 'latino' },
  { url: 'https://worldmusicviews.com', region: 'latino' },
  { url: 'https://www.billboard.com/c/music/latin/', region: 'latino' },
  { url: 'https://remezcla.com/music/', region: 'latino' },
  { url: 'https://www.rollingstone.com/music/music-latin/', region: 'latino' },
  { url: 'https://www.latido.music/category/news/', region: 'latino' },
  { url: 'https://urbano.nyc/category/noticias/', region: 'latino' },
  { url: 'https://www.efe.com/efe/espana/cultura/latin-music/50000495', region: 'latino' },
  { url: 'https://www.billboard.com/espanol/musica/', region: 'latino' },
  { url: 'https://www.mondosonoro.com/noticias-musica-latina/', region: 'latino' },
  { url: 'https://www.shock.co/musica', region: 'latino' },
  { url: 'https://www.lacoope.net/musica/noticias', region: 'latino' },

  // --- ASIA ---
  { url: 'https://www.soompi.com/category/music', region: 'asia' },
  { url: 'https://www.billboard-japan.com', region: 'asia' },
  { url: 'https://natalie.mu/music', region: 'asia' },
  { url: 'https://rockinon.com', region: 'asia' },
  { url: 'https://www.cdjournal.com', region: 'asia' },
  { url: 'http://www.izm.co.kr', region: 'asia' },
  { url: 'https://www.visla.kr', region: 'asia' },
  { url: 'https://music.bugs.co.kr', region: 'asia' },
  { url: 'https://music.sohu.com', region: 'asia' },
  { url: 'https://music.douban.com', region: 'asia' },
  { url: 'https://y.qq.com', region: 'asia' },
  { url: 'https://www.musicbusinesschina.com', region: 'asia' },
  { url: 'https://www.allkpop.com/category/news', region: 'asia' },
  { url: 'https://www.koreaboo.com/category/news/', region: 'asia' },
  { url: 'https://www.nme.com/en_asia/news/music', region: 'asia' },
  { url: 'https://www.bandwagon.asia/news', region: 'asia' },
  { url: 'https://aramajapan.com/', region: 'asia' },
  { url: 'https://www.tokyohive.com/', region: 'asia' },
  { url: 'https://www.sbs.com.au/popasia/blog', region: 'asia' },
  { url: 'https://koreajoongangdaily.joins.com/section/entertainment', region: 'asia' },
  { url: 'https://www.hellokpop.com/category/news/', region: 'asia' },

  // --- EUROPA ---
  { url: 'https://www.eurovision.tv/news', region: 'europa' },
  { url: 'https://www.europavox.com/news/', region: 'europa' },
  { url: 'https://www.residentadvisor.net/news/europe', region: 'europa' },
  { url: 'https://www.clashmusic.com/category/news/european-news/', region: 'europa' },
  { url: 'https://www.rollingstone.de/news/', region: 'europa' },
  { url: 'https://www.lesinrocks.com/musique/', region: 'europa' },
  { url: 'https://www.rockit.it/news', region: 'europa' },
  { url: 'https://www.jenesaispop.com/', region: 'europa' },
  { url: 'https://www.soundsblog.it/', region: 'europa' },
  { url: 'https://www.muzikalia.com/noticias/', region: 'europa' },
  { url: 'https://www.telerama.fr/musique', region: 'europa' },
  { url: 'https://www.greenroom.fr/', region: 'europa' },
  { url: 'https://www.musikexpress.de/news/', region: 'europa' },
  { url: 'https://www.visions.de/news/', region: 'europa' },

  // --- JAZZ ---
  { url: 'https://jazztimes.com/news/', region: 'jazz' },
  { url: 'https://downbeat.com/news', region: 'jazz' },
  { url: 'https://www.allaboutjazz.com/news/', region: 'jazz' },
  { url: 'https://www.jazziz.com/category/news/', region: 'jazz' },
  { url: 'https://www.jazzwise.com/news', region: 'jazz' },
  { url: 'https://londonjazznews.com/', region: 'jazz' },
  { url: 'https://www.jazz24.org/category/news/', region: 'jazz' },
  { url: 'https://www.musiqology.com/category/jazz/', region: 'jazz' },
  { url: 'https://www.ejazznews.com/', region: 'jazz' },
  { url: 'https://www.nextbop.com/', region: 'jazz' },
  { url: 'https://www.jerryjazzmusician.com/', region: 'jazz' },
  { url: 'https://www.jazzonline.com/news/', region: 'jazz' },
  { url: 'https://www.jazzinamerica.org/', region: 'jazz' },
  { url: 'https://www.jazzstandard.com/', region: 'jazz' },
  { url: 'https://www.thejazzmann.com/news', region: 'jazz' },
  { url: 'https://www.bebopspokenhere.blogspot.com/', region: 'jazz' },
  { url: 'https://www.marlbank.net/', region: 'jazz' },
  { url: 'https://www.jazzfuel.com/blog/', region: 'jazz' },
  { url: 'https://www.bluenote.com/news/', region: 'jazz' },
  { url: 'https://www.jazznews.fr/actu/', region: 'jazz' },

  // --- CLASSICAL ---
  { url: 'https://www.gramophone.co.uk/news', region: 'classical' },
  { url: 'https://www.thestrad.com/news', region: 'classical' },
  { url: 'https://www.classical-music.com/news', region: 'classical' },
  { url: 'https://www.limelightmagazine.com.au/news/', region: 'classical' },
  { url: 'https://www.operanews.com/Opera_News_Magazine/Archive/News.html', region: 'classical' },
  { url: 'https://www.classicfm.com/news/', region: 'classical' },
  { url: 'https://www.ludwig-van.com/toronto/category/news/', region: 'classical' },
  { url: 'https://www.violinist.com/blog/', region: 'classical' },
  { url: 'https://www.classicalmpr.org/category/classical-news', region: 'classical' },
  { url: 'https://www.classical-scene.com/', region: 'classical' },
  { url: 'https://www.pizzicato.lu/', region: 'classical' },
  { url: 'https://www.classicalsource.com/news/', region: 'classical' },
  { url: 'https://www.operawire.com/', region: 'classical' },
  { url: 'https://www.bachtrack.com/news', region: 'classical' },
  { url: 'https://www.wqxr.org/sections/classical-music-news/', region: 'classical' },
  { url: 'https://www.classicalvoiceamerica.org/', region: 'classical' },
  { url: 'https://www.musicalamerica.com/news/', region: 'classical' },
  { url: 'https://www.theviolinchannel.com/category/news/', region: 'classical' },
  { url: 'https://www.slippeidisc.com/', region: 'classical' },
  { url: 'https://www.gramilano.com/', region: 'classical' },

  // --- WORLD ---
  // The previous seven sources all returned nothing: four render their headlines
  // in JavaScript so `h2`/`h3` parsing found no links, and three answered 403 or
  // 404. That is why WORLD had zero OFFICIAL rows for two weeks while every other
  // region had hundreds. These three were verified to yield headlines.
  { url: 'https://www.afropop.org/', region: 'world' },
  { url: 'https://folkradio.co.uk/category/news/', region: 'world' },
  { url: 'https://www.theguardian.com/music/worldmusic', region: 'world' },
];

/**
 * Publishers that are music publications first and news organisations second.
 *
 * The gate's `music-publication` policy exists for exactly this: a headline like
 * "Blackpink – Go" or "Xiu Xiu – Xiu Mutha Fuckin' Xiu" carries no music
 * vocabulary, and no keyword list will ever rescue it. Trusting the publisher is
 * the only signal that works. This is the OFFICIAL registry's own hosts, plus
 * music-trade and music-press outlets the firehose returns.
 */
/**
 * Music press the firehose returns that the scraper does not itself fetch.
 *
 * Only genuinely additional outlets belong here: the registry's own hosts are
 * derived below, so a name that appears in both lists says nothing and hides
 * which outlets are actually being added.
 */
const ADDITIONAL_MUSIC_PUBLICATION_HOSTS = [
  'musically.com',
  'musicbusinessworldwide.com',
  'completemusicupdate.com',
  'exystence.net',
  'spinmagazine.com',
  'brooklynvegan.com',
  'pastemagazine.com',
  'exclaim.ca',
  'metalinjection.net',
  'lambgoat.com',
  'punknews.org',
  'tinymixtapes.com',
  'undertheradarmag.com',
  'xxlmag.com',
  'revolt.tv',
  'okayplayer.com',
  'djmag.com',
  'edm.com',
  'yourheights.com',
  'runthetrap.com',
  'thisisdig.com',
  'themusic.com.au',
  'recordoftheday.com',
  'mojo4music.com',
  'louderthanwar.com',
  'drownedinsound.com',
  'opera-news.com',
  'slippedisc.com',
  'songlines.co.uk',
  'popmatters.com',
];

/**
 * Outlets the registry lists because of a music *section*, not because they are
 * music publications.
 *
 * The scraper fetches `theguardian.com/music/...`, which is a music desk on a
 * general newspaper. Deriving publisher trust from the host then trusts the whole
 * newspaper: a Guardian politics story arrives with no music vocabulary, scores
 * zero off-topic, and passes the gate as if it were Pitchfork. Trust is a
 * property of the publisher, and these publishers are general newsrooms — the
 * keyword path still keeps their music coverage, because Guardian music stories
 * say what they are about.
 */
const GENERAL_NEWSROOM_HOSTS: string[] = [
  'theguardian.com',
  'standard.co.uk',
  'variety.com',
  'sbs.com.au',
  'koreajoongangdaily.joins.com',
  'telerama.fr',
  'efe.com',
  'list.co.uk',
  'theartsdesk.com',
];

function normalizeHost(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
}

/** Hosts derived once from the registry, so the two lists cannot drift apart. */
const REGISTRY_HOSTS: string[] = (() => {
  const hosts = new Set<string>();
  for (const source of OFFICIAL_NEWS_SOURCES) {
    try {
      hosts.add(normalizeHost(new URL(source.url).hostname));
    } catch {
      // A malformed registry entry must not break the gate.
    }
  }
  return Array.from(hosts);
})();

const MUSIC_PUBLICATION_HOSTS = new Set<string>([
  ...REGISTRY_HOSTS,
  ...ADDITIONAL_MUSIC_PUBLICATION_HOSTS.map(normalizeHost),
]);

/**
 * Is this publisher a music publication, whatever the headline says?
 *
 * Matched on the host and its subdomains, never on a substring: `nme.com` covers
 * `www.nme.com`, but not `nmex.com`.
 */
export function isMusicPublicationHost(hostname: string | null | undefined): boolean {
  const host = normalizeHost(hostname || '');
  if (!host) return false;

  // A music section on a general newspaper does not make the newspaper a music
  // publication, so the exclusion is checked first.
  for (const candidate of GENERAL_NEWSROOM_HOSTS) {
    if (host === candidate || host.endsWith(`.${candidate}`)) return false;
  }

  for (const candidate of MUSIC_PUBLICATION_HOSTS) {
    if (host === candidate || host.endsWith(`.${candidate}`)) return true;
  }

  return false;
}

/** Convenience for callers holding a URL rather than a parsed host. */
export function isMusicPublicationUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;

  try {
    return isMusicPublicationHost(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * Publishers whose identity places them somewhere even though the host is not in
 * the registry. General news organisations mostly, which is what a firehose
 * returns: NPR does not appear in the scraped music list, but an NPR story filed
 * under `europa` is a misfiling, and that is the case this table exists for.
 */
const PUBLISHER_REGIONS: Record<string, string> = {
  'npr.org': 'us',
  'nytimes.com': 'us',
  'washingtonpost.com': 'us',
  'apnews.com': 'us',
  'reuters.com': 'us',
  'usatoday.com': 'us',
  'latimes.com': 'us',
  'cnn.com': 'us',
  'foxnews.com': 'us',
  'nbcnews.com': 'us',
  'abcnews.go.com': 'us',
  'cbsnews.com': 'us',
  'axios.com': 'us',
  'theatlantic.com': 'us',
  'newyorker.com': 'us',
  'vulture.com': 'us',
  'slate.com': 'us',
  'politico.com': 'us',
  'thehill.com': 'us',
  'variety.com': 'us',
  'deadline.com': 'us',
  'hollywoodreporter.com': 'us',
  'thewrap.com': 'us',
  'avclub.com': 'us',
  'buzzfeed.com': 'us',
  'teenvogue.com': 'us',
  'elle.com': 'us',
  'cosmopolitan.com': 'us',
  'vogue.com': 'us',
  'gq.com': 'us',
  'esquire.com': 'us',
  'bbc.co.uk': 'uk',
  'bbc.com': 'uk',
  'theguardian.com': 'uk',
  'telegraph.co.uk': 'uk',
  'thetimes.co.uk': 'uk',
  'independent.co.uk': 'uk',
  'standard.co.uk': 'uk',
  'mirror.co.uk': 'uk',
  'unilad.co.uk': 'uk',
  'ladbible.com': 'uk',
  'sky.com': 'uk',
  'news.sky.com': 'uk',
  'irishcentral.com': 'uk',
  'irishtimes.com': 'uk',
  'rte.ie': 'uk',
  'lemonde.fr': 'europa',
  'lefigaro.fr': 'europa',
  'france24.com': 'europa',
  'rfi.fr': 'europa',
  'spiegel.de': 'europa',
  'faz.net': 'europa',
  'zeit.de': 'europa',
  'dw.com': 'europa',
  'corriere.it': 'europa',
  'repubblica.it': 'europa',
  'lastampa.it': 'europa',
  'elpais.com': 'europa',
  'elmundo.es': 'europa',
  'abc.es': 'europa',
  'euronews.com': 'europa',
  'eurovision.tv': 'europa',
  'euobserver.com': 'europa',
  'politico.eu': 'europa',
  'japantimes.co.jp': 'asia',
  'japantoday.com': 'asia',
  'scmp.com': 'asia',
  'koreatimes.co.kr': 'asia',
  'koreaherald.com': 'asia',
  'straitstimes.com': 'asia',
  'channelnewsasia.com': 'asia',
  'thehindu.com': 'asia',
  'timesofindia.indiatimes.com': 'asia',
  'economictimes.indiatimes.com': 'asia',
  'clarin.com': 'latino',
  'folha.uol.com.br': 'latino',
  'eltiempo.com': 'latino',
  'eluniversal.com.mx': 'latino',
  'infobae.com': 'latino',
  'cbc.ca': 'world',
  'abc.net.au': 'world',
};

/**
 * Country-code TLDs that place a publisher for us. Deliberately limited to codes
 * where the country sits inside one channel: `.co.uk` is the UK, `.de` is Europe,
 * `.co.jp` is Asia. Generic TLDs place nothing, which is why `.com` publishers
 * need an explicit entry above.
 */
const TLD_REGIONS: Record<string, string> = {
  uk: 'uk',
  ie: 'uk',
  de: 'europa',
  fr: 'europa',
  it: 'europa',
  es: 'europa',
  nl: 'europa',
  be: 'europa',
  at: 'europa',
  ch: 'europa',
  se: 'europa',
  no: 'europa',
  dk: 'europa',
  fi: 'europa',
  pl: 'europa',
  pt: 'europa',
  gr: 'europa',
  cz: 'europa',
  hu: 'europa',
  ro: 'europa',
  jp: 'asia',
  kr: 'asia',
  cn: 'asia',
  hk: 'asia',
  tw: 'asia',
  in: 'asia',
  sg: 'asia',
  th: 'asia',
  id: 'asia',
  ph: 'asia',
  vn: 'asia',
  br: 'latino',
  mx: 'latino',
  ar: 'latino',
  co: 'latino',
  cl: 'latino',
  pe: 'latino',
  uy: 'latino',
  ve: 'latino',
  ec: 'latino',
  bo: 'latino',
  py: 'latino',
  do: 'latino',
  pr: 'latino',
  au: 'world',
  nz: 'world',
  ca: 'world',
  za: 'world',
  ng: 'world',
  ke: 'world',
  gh: 'world',
};

function hostMatches(host: string, candidate: string): boolean {
  return host === candidate || host.endsWith(`.${candidate}`);
}

/**
 * Where does this *publisher* sit, as opposed to what a story is about?
 *
 * Only general newsrooms are placed this way: a named publisher first, then the
 * country-code TLD. `null` means "this URL says nothing", and the caller keeps
 * whatever region the query asked for.
 *
 * Music publications are deliberately excluded, and a dry run is why. Billboard's
 * Latin section publishes from anywhere, so 873 Billboard stories stored under
 * `latino` would have been refiled to `us`; NME's global news runs under
 * `/news/music` while its Asia desk uses `/en-asia`, so 1,092 NME stories would
 * have left the Asia channel. Those channels are partly *topical* — an NME piece
 * about a K-pop group belongs on Asia — so a publisher's postal address is the
 * wrong instrument for them. It is the right instrument for NPR.
 */
export function getPublisherRegion(
  url: string | null | undefined,
  options: { includeTld?: boolean } = {},
): string | null {
  if (!url?.trim()) return null;

  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) return null;

  const host = normalizeHost(parsed.hostname);
  if (isMusicPublicationHost(host)) return null;

  for (const [candidate, region] of Object.entries(PUBLISHER_REGIONS)) {
    if (hostMatches(host, candidate)) return region;
  }

  /**
   * A country code is a decent signal for a new arrival and a weak one for a
   * backfill: `.co.uk` covers the whole British music press, including its desks
   * that write about everywhere. Stored rows are only moved on a named publisher.
   */
  if (options.includeTld === false) return null;

  // `.co.uk` and `.com.au` put the country code last either way, so one lookup
  // covers both; anything else (`.com`, `.net`) places nothing.
  const labels = host.split('.');
  return TLD_REGIONS[labels[labels.length - 1]] ?? null;
}
