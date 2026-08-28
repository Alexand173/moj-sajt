import { Fragment } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Plus } from 'lucide-react';
import AddAlbumTrigger from '@/components/AddAlbumTrigger';
import AddCommentTrigger from '@/components/AddCommentTrigger';
import AddPostTrigger from '@/components/AddPostTrigger';
import AlbumGallery from '@/components/AlbumGallery';

export type NewsProfile = {
  first_name?: string | null;
  avatar_url?: string | null;
};

export type NewsEditorialItem = {
  id: string | number;
  title?: string;
  content?: string | null;
  created_at?: string | null;
  region?: string | null;
  post_image?: string | null;
  profiles?: NewsProfile | NewsProfile[] | null;
  album_name?: string;
  images?: string[] | null;
  text?: string | null;
  user_name?: string | null;
  image?: string;
  url?: string | null;
  excerpt?: string | null;
  category?: string | null;
};

export interface NewsEditorialViewProps {
  region: string;
  featuredNews?: NewsEditorialItem;
  latestNews: NewsEditorialItem[];
  communityNews: NewsEditorialItem[];
  officialNews: NewsEditorialItem[];
  communityPosts: NewsEditorialItem[];
  discussions: NewsEditorialItem[];
  concertAlbums: NewsEditorialItem[];
  activeBlog?: NewsEditorialItem | null;
  activeAlbum?: NewsEditorialItem | null;
}

function formatDate(value?: string | null) {
  if (!value) return 'LATEST';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'LATEST';
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
}

function getProfile(item: NewsEditorialItem) {
  return Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
}

function SafeExternalLink({ item, children, className }: { item: NewsEditorialItem; children: React.ReactNode; className?: string }) {
  if (!item.url) return <span className={className}>{children}</span>;

  return (
    <a href={item.url} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}

function EditorialHero({ region, article }: { region: string; article?: NewsEditorialItem }) {
  if (!article) {
    return (
      <section className="border-b-4 border-accent-red bg-ink">
        <div className="mt-container flex min-h-[25rem] items-end py-12 lg:min-h-[34rem]">
          <div>
            <p className="mt-kicker">{region} editorial desk</p>
            <h1 className="mt-5 max-w-4xl text-[clamp(2rem,5.3vw,5rem)] font-black leading-[0.86] tracking-[-0.08em] text-white uppercase">News in motion</h1>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-white/60">The latest stories from the {region.toUpperCase()} music scene.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative min-h-[36rem] overflow-hidden border-b-4 border-accent-red bg-ink sm:min-h-[42rem] lg:min-h-[calc(78vh-8rem)]">
      {article.image && (
        <img src={article.image} alt={article.title || `${region} featured story`} loading="eager" fetchPriority="high" decoding="async" className="absolute inset-0 h-full w-full object-cover grayscale transition-all duration-700 hover:grayscale-0" />
      )}
      <div className="mt-image-overlay absolute inset-0" />
      <div className="relative z-10 flex min-h-[36rem] items-end sm:min-h-[42rem] lg:min-h-[calc(78vh-8rem)]">
        <div className="mt-container pb-10 sm:pb-14 lg:pb-16">
          <div className="flex flex-wrap items-center gap-3">
            <span className="bg-accent-red px-2.5 py-1 text-[9px] font-black tracking-[0.22em] text-white uppercase">{article.category || 'Featured'}</span>
            <span className="mt-meta text-white/55">Long read · {formatDate(article.created_at)}</span>
          </div>
          <h1 className="mt-5 max-w-5xl text-balance text-[clamp(2rem,5.3vw,5rem)] font-black leading-[0.88] tracking-[-0.08em] text-white uppercase sm:text-[clamp(2.5rem,5.3vw,5rem)]">{article.title}</h1>
          {article.excerpt && <p className="mt-5 max-w-2xl text-sm leading-relaxed text-white/70 sm:text-base">{article.excerpt}</p>}
          <div className="mt-7 flex flex-wrap items-center gap-4">
            <Link href={`/news/${region}/${article.id}`} className="group inline-flex items-center gap-2 bg-white px-5 py-3 text-[10px] font-black tracking-[0.2em] text-ink uppercase transition-colors hover:bg-accent-red hover:text-white">
              Read the story
              <ArrowUpRight aria-hidden="true" className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
            <span className="mt-meta text-white/45">MusicTop Editorial · {formatDate(article.created_at)}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function LiveFeed({ items }: { items: NewsEditorialItem[] }) {
  return (
    <section className="border-t-2 border-ink pt-4">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-xs font-black tracking-[0.25em] text-ink uppercase">Live feed</h2>
        <span className="flex items-center gap-2 text-[9px] font-bold tracking-[0.18em] text-muted uppercase"><span className="mt-status-dot" />Streaming</span>
      </div>
      <div>
        {items.length > 0 ? items.map((item) => (
          <SafeExternalLink key={item.id} item={item} className="group block border-b border-line py-4 transition-colors hover:border-ink">
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <span className={`text-[9px] font-black tracking-[0.2em] uppercase ${item.category === 'BREAKING' ? 'text-accent-red' : item.category === 'UPDATE' ? 'text-accent-blue' : 'text-muted'}`}>{item.category || 'Live feed'}</span>
              <span className="shrink-0 text-[9px] font-bold tracking-widest text-muted uppercase">{formatDate(item.created_at)}</span>
            </div>
            <p className="text-sm font-black leading-snug text-ink transition-colors group-hover:text-accent-blue">{item.title || item.text}</p>
            {item.excerpt && <p className="mt-1.5 line-clamp-2 text-[10px] font-medium leading-relaxed text-muted">{item.excerpt}</p>}
            {item.url && <p className="mt-1.5 text-[9px] font-bold tracking-wide text-muted lowercase">source link ↗</p>}
          </SafeExternalLink>
        )) : (
          <p className="border-b border-line py-6 text-[10px] font-bold tracking-[0.14em] text-muted uppercase">No live stories yet.</p>
        )}
      </div>
    </section>
  );
}

type PublishPostPanelVariant = 'rail' | 'inline';

function PublishPostPanel({ region, variant }: { region: string; variant: PublishPostPanelVariant }) {
  const isRail = variant === 'rail';
  const headingId = `publish-post-${variant}`;

  return (
    <section
      aria-labelledby={headingId}
      className={isRail ? 'border border-ink bg-ink p-5 text-white sm:p-6' : 'border border-ink bg-ink px-4 py-4 text-white sm:px-5'}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-bold tracking-[0.22em] text-white/45 uppercase">Contributor</p>
          <h2 id={headingId} className="mt-1 text-sm font-black tracking-[0.08em] uppercase">{isRail ? 'Publish a new post' : 'Publish a news'}</h2>
        </div>
        <Plus aria-hidden="true" className="size-5 shrink-0 text-accent-red" />
      </div>
      <AddPostTrigger region={region} mode={isRail ? 'post' : 'news'} />
    </section>
  );
}

type LatestNewsCardSource = 'editorial' | 'community';

function LatestNewsCard({ region, item, source = 'editorial' }: { region: string; item: NewsEditorialItem; source?: LatestNewsCardSource }) {
  const title = item.title || item.text || 'Untitled music story';
  const profile = source === 'community' ? getProfile(item) : null;
  const image = source === 'community' ? item.post_image : item.image;
  const articleHref = source === 'community'
    ? `/news/${region}/community/${item.id}`
    : `/news/${region}/${item.id}`;

  return (
    <Link
      href={articleHref}
      className="group grid grid-cols-[clamp(7rem,30%,14rem)_minmax(0,1fr)] gap-4 border-b border-line py-4 transition-colors hover:border-ink sm:gap-5 sm:py-5"
    >
      <div className="aspect-[5/3] min-w-0 overflow-hidden bg-paper-muted">
        {image ? (
          <img
            src={image}
            alt={title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover grayscale transition-all duration-500 group-hover:scale-105 group-hover:grayscale-0"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center px-2 text-center text-[9px] font-black tracking-[0.14em] text-muted uppercase">No image</span>
        )}
      </div>
      <div className="min-w-0 self-center">
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-[9px] font-black tracking-[0.2em] text-accent-red uppercase">{source === 'community' ? 'Community news' : item.category || 'Latest'}</span>
          <span className="text-[9px] font-bold tracking-[0.12em] text-muted uppercase">{formatDate(item.created_at)}</span>
          {profile && <span className="text-[9px] font-bold tracking-[0.12em] text-muted uppercase">By {profile.first_name || 'Anonymous'}</span>}
        </div>
        <h3 className="line-clamp-3 text-base font-black leading-tight tracking-[-0.025em] text-ink transition-colors group-hover:text-accent-blue sm:text-lg">{title}</h3>
        {source === 'community' ? (
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted sm:text-sm">{item.content || 'Read this community news report.'}</p>
        ) : item.excerpt ? (
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted sm:text-sm">{item.excerpt}</p>
        ) : null}
        <span className="mt-3 inline-flex items-center gap-1 text-[9px] font-black tracking-[0.16em] text-ink uppercase transition-colors group-hover:text-accent-blue">Read full news <ArrowUpRight aria-hidden="true" className="size-3.5" /></span>
      </div>
    </Link>
  );
}

type FeedCard = {
  item: NewsEditorialItem;
  source: LatestNewsCardSource;
  key: string;
};

function LatestNewsFeed({ region, items, communityNews }: { region: string; items: NewsEditorialItem[]; communityNews: NewsEditorialItem[] }) {
  const feedItems: FeedCard[] = [
    ...items.map((item) => ({ item, source: 'editorial' as const, key: `editorial-${item.id}` })),
    ...communityNews.map((item) => ({ item, source: 'community' as const, key: `community-${item.id}` })),
  ].sort((left, right) => {
    const leftTime = left.item.created_at ? new Date(left.item.created_at).getTime() : 0;
    const rightTime = right.item.created_at ? new Date(right.item.created_at).getTime() : 0;
    return rightTime - leftTime;
  });
  const insertionIndex = feedItems.length > 0 ? Math.min(3, feedItems.length) : 0;

  return (
    <section aria-labelledby="latest-news-heading" className="border-t-2 border-ink pt-4">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="mt-kicker">Fresh from Supabase</p>
          <h2 id="latest-news-heading" className="mt-2 text-3xl font-black tracking-[-0.06em] text-ink uppercase sm:text-4xl">Latest news</h2>
        </div>
        <span className="shrink-0 text-[9px] font-bold tracking-[0.16em] text-muted uppercase">{feedItems.length} stories</span>
      </div>

      {feedItems.length > 0 ? (
        <div>
          {feedItems.map(({ item, source, key }, index) => (
            <Fragment key={key}>
              {index === insertionIndex && <PublishPostPanel region={region} variant="inline" />}
              <LatestNewsCard region={region} item={item} source={source} />
            </Fragment>
          ))}
          {insertionIndex === feedItems.length && <PublishPostPanel region={region} variant="inline" />}
        </div>
      ) : (
        <div className="border border-line bg-paper-muted px-5 py-10 text-center">
          <p className="text-[10px] font-bold tracking-[0.16em] text-muted uppercase">No latest stories yet.</p>
          <div className="mt-6 text-left"><PublishPostPanel region={region} variant="inline" /></div>
        </div>
      )}
    </section>
  );
}

function CommunityRail({ region, communityPosts, discussions, concertAlbums }: Pick<NewsEditorialViewProps, 'region' | 'communityPosts' | 'discussions' | 'concertAlbums'>) {
  return (
    <aside aria-label="Community hub" className="space-y-8 border-t border-line pt-5 lg:sticky lg:top-36 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
      <PublishPostPanel region={region} variant="rail" />

      <section>
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-xs font-black tracking-[0.25em] text-ink uppercase">Community hub</h2>
          <Plus aria-hidden="true" className="size-4 text-accent-red" />
        </div>
        <div className="border-t-2 border-ink pt-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-[10px] font-black tracking-[0.2em] text-muted uppercase">Reader&apos;s blog</h3>
          </div>
          <div className="space-y-4">
            {communityPosts.map((post) => {
              const profile = getProfile(post);
              const author = profile?.first_name || 'Anonymous';
              return (
                <Link key={post.id} href={`/news/${region}?blogId=${post.id}`} className="group flex gap-3 border-b border-line pb-4">
                  {post.post_image ? <img src={post.post_image} alt="" loading="lazy" decoding="async" className="size-14 shrink-0 object-cover grayscale transition-all group-hover:grayscale-0" /> : <span className="flex size-14 shrink-0 items-center justify-center bg-paper-muted text-xs font-black text-muted">N/A</span>}
                  <span className="min-w-0">
                    <span className="block line-clamp-2 text-xs font-black leading-snug text-ink transition-colors group-hover:text-accent-blue">{post.title}</span>
                    <span className="mt-1 block text-[9px] font-bold tracking-[0.12em] text-muted uppercase">@{author}</span>
                  </span>
                </Link>
              );
            })}
            {communityPosts.length === 0 && <p className="text-[10px] font-bold tracking-[0.14em] text-muted uppercase">No posts yet.</p>}
          </div>
        </div>
      </section>

      <section className="border-t-2 border-ink pt-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-[10px] font-black tracking-[0.2em] text-muted uppercase">Comments</h3>
          <AddCommentTrigger region={region} />
        </div>
        <div className="space-y-4">
          {discussions.map((discussion) => <div key={discussion.id} className="border-l-2 border-accent-red pl-3"><p className="text-xs font-bold leading-snug text-ink">&quot;{discussion.text}&quot;</p><span className="mt-1 block text-[9px] font-bold tracking-[0.12em] text-muted uppercase">{discussion.user_name || 'Anonymous'}</span></div>)}
          {discussions.length === 0 && <p className="text-[10px] font-bold tracking-[0.14em] text-muted uppercase">No discussions yet.</p>}
        </div>
      </section>

      <section className="border-t-2 border-ink pt-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-[10px] font-black tracking-[0.2em] text-muted uppercase">Concert albums</h3>
          <AddAlbumTrigger region={region} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {concertAlbums.map((album) => (
            <Link key={album.id} href={`/news/${region}?albumId=${album.id}`} className="group aspect-square overflow-hidden bg-paper-muted">
              {album.images?.[0] ? <img src={album.images[0]} alt={album.album_name || 'Concert album'} loading="lazy" decoding="async" className="h-full w-full object-cover grayscale transition-all duration-500 group-hover:scale-105 group-hover:grayscale-0" /> : <span className="flex h-full w-full items-center justify-center text-[9px] font-black tracking-[0.12em] text-muted uppercase">No image</span>}
            </Link>
          ))}
        </div>
      </section>
    </aside>
  );
}

export default function NewsEditorialView({
  region,
  featuredNews,
  latestNews,
  communityNews,
  officialNews,
  communityPosts,
  discussions,
  concertAlbums,
  activeBlog,
  activeAlbum,
}: NewsEditorialViewProps) {
  const latestFeedItems = featuredNews ? latestNews.slice(1) : latestNews;

  return (
    <div className="mt-page mt-page--paper">
      <EditorialHero region={region} article={featuredNews} />

      <main className="mt-container py-12 sm:py-16 lg:py-20">
        {activeAlbum ? (
          <section className="border border-line bg-white p-5 sm:p-8">
            <Link href={`/news/${region}`} className="mb-6 inline-flex items-center gap-2 text-[10px] font-black tracking-[0.2em] text-ink uppercase transition-colors hover:text-accent-red">← Back to feed</Link>
            <h1 className="mb-7 text-3xl font-black tracking-[-0.06em] text-ink uppercase sm:text-5xl">{activeAlbum.album_name || 'Concert album'}</h1>
            <AlbumGallery images={activeAlbum.images || []} albumName={activeAlbum.album_name || 'Concert album'} />
          </section>
        ) : activeBlog ? (
          <section className="border border-line bg-white p-5 sm:p-8">
            <Link href={`/news/${region}`} className="mb-6 inline-flex items-center gap-2 text-[10px] font-black tracking-[0.2em] text-ink uppercase transition-colors hover:text-accent-red">← Back to feed</Link>
            <p className="mt-kicker">Reader&apos;s blog</p>
            <h1 className="mt-5 text-3xl font-black tracking-[-0.06em] text-ink uppercase sm:text-5xl">{activeBlog.title}</h1>
            <div className="mt-7 flex flex-col gap-6 sm:flex-row">
              {activeBlog.post_image && <img src={activeBlog.post_image} alt={activeBlog.title || 'Reader post'} loading="lazy" decoding="async" className="size-32 object-cover grayscale" />}
              <p className="max-w-2xl whitespace-pre-line text-base leading-relaxed text-muted">{activeBlog.content}</p>
            </div>
          </section>
        ) : (
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-start lg:gap-10 xl:gap-12">
            <div className="order-2 min-w-0 lg:order-1 lg:col-span-3">
              <LiveFeed items={officialNews} />
            </div>
            <div className="order-1 min-w-0 lg:order-2 lg:col-span-6">
              <LatestNewsFeed region={region} items={latestFeedItems} communityNews={communityNews} />
            </div>
            <div className="order-3 min-w-0 lg:order-3 lg:col-span-3">
              <CommunityRail region={region} communityPosts={communityPosts} discussions={discussions} concertAlbums={concertAlbums} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
