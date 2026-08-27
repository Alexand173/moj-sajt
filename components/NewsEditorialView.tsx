import Link from 'next/link';
import { ArrowUpRight, Plus, TrendingUp } from 'lucide-react';
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
            <h1 className="mt-5 max-w-4xl text-[clamp(3rem,8vw,7.5rem)] font-black leading-[0.86] tracking-[-0.08em] text-white uppercase">News in motion</h1>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-white/60">The latest stories from the {region.toUpperCase()} music scene.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative min-h-[36rem] overflow-hidden border-b-4 border-accent-red bg-ink sm:min-h-[42rem] lg:min-h-[calc(78vh-8rem)]">
      {article.image && (
        <img src={article.image} alt={article.title || `${region} featured story`} className="absolute inset-0 h-full w-full object-cover grayscale transition-all duration-700 hover:grayscale-0" />
      )}
      <div className="mt-image-overlay absolute inset-0" />
      <div className="relative z-10 flex min-h-[36rem] items-end sm:min-h-[42rem] lg:min-h-[calc(78vh-8rem)]">
        <div className="mt-container pb-10 sm:pb-14 lg:pb-16">
          <div className="flex flex-wrap items-center gap-3">
            <span className="bg-accent-red px-2.5 py-1 text-[9px] font-black tracking-[0.22em] text-white uppercase">{article.category || 'Featured'}</span>
            <span className="mt-meta text-white/55">Long read · {formatDate(article.created_at)}</span>
          </div>
          <h1 className="mt-5 max-w-5xl text-balance text-[clamp(3rem,8vw,7.5rem)] font-black leading-[0.88] tracking-[-0.08em] text-white uppercase">{article.title}</h1>
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

function MostReadList({ items }: { items: NewsEditorialItem[] }) {
  return (
    <section className="border border-line bg-white p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-2">
        <TrendingUp aria-hidden="true" className="size-4 text-accent-red" />
        <h2 className="text-xs font-black tracking-[0.25em] text-ink uppercase">Most read</h2>
      </div>
      {items.length > 0 ? (
        <ol>
          {items.slice(0, 4).map((item, index) => (
            <li key={item.id} className="border-b border-line last:border-0">
              <Link href={`/news/${item.region || 'us'}/${item.id}`} className="group flex items-start gap-3 py-4">
                <span className="text-2xl font-black leading-none text-line transition-colors group-hover:text-accent-red">{String(index + 1).padStart(2, '0')}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black leading-snug text-ink transition-colors group-hover:text-accent-blue">{item.title || item.text}</span>
                  <span className="mt-1 block text-[9px] font-bold tracking-[0.14em] text-muted uppercase">{formatDate(item.created_at)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <p className="py-6 text-[10px] font-bold tracking-[0.14em] text-muted uppercase">The reading list is updating.</p>
      )}
    </section>
  );
}

function StoryGrid({ region, items }: { region: string; items: NewsEditorialItem[] }) {
  return (
    <section className="mt-16 border-t border-line pt-10 sm:mt-20">
      <div className="mb-7 flex items-end justify-between gap-6">
        <div>
          <p className="mt-kicker">The intelligence feed</p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.06em] text-ink uppercase sm:text-5xl">Stories by mass</h2>
        </div>
        <Link href={`/news/${region}`} className="group hidden items-center gap-1.5 text-[10px] font-black tracking-[0.2em] text-ink uppercase transition-colors hover:text-accent-blue sm:inline-flex">View all <ArrowUpRight aria-hidden="true" className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></Link>
      </div>

      {items.length > 0 ? (
        <div className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
          {items.slice(0, 6).map((item, index) => (
            <Link key={item.id} href={`/news/${region}/${item.id}`} className={`group relative min-h-[16rem] overflow-hidden bg-ink ${index === 0 ? 'sm:col-span-2 lg:min-h-[24rem]' : index === 3 ? 'sm:col-span-2' : ''}`}>
              {item.image && <img src={item.image} alt={item.title || 'MusicTop story'} className="absolute inset-0 h-full w-full object-cover grayscale transition-all duration-700 group-hover:scale-105 group-hover:grayscale-0" />}
              <div className="mt-image-overlay absolute inset-0" />
              <div className="relative z-10 flex min-h-[16rem] flex-col justify-end p-5 sm:min-h-[18rem] lg:p-7">
                <div className="mb-3 flex items-center gap-3">
                  <span className="bg-accent-red px-2 py-1 text-[9px] font-black tracking-[0.2em] text-white uppercase">{item.category || 'Story'}</span>
                  <span className="mt-meta text-white/50">{formatDate(item.created_at)}</span>
                </div>
                <h3 className={`font-black leading-[0.95] tracking-[-0.04em] text-white uppercase ${index === 0 ? 'text-2xl sm:text-4xl' : 'text-xl sm:text-2xl'}`}>{item.title || item.text}</h3>
                {item.excerpt && <p className="mt-3 line-clamp-2 max-w-lg text-xs leading-relaxed text-white/65">{item.excerpt}</p>}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="border border-line bg-paper-muted px-6 py-20 text-center text-[10px] font-bold tracking-[0.18em] text-muted uppercase">The editorial archive is updating.</div>
      )}
    </section>
  );
}

function CommunitySidebar({ region, communityPosts, discussions, concertAlbums }: Pick<NewsEditorialViewProps, 'region' | 'communityPosts' | 'discussions' | 'concertAlbums'>) {
  return (
    <aside className="space-y-8 border-l border-line pl-5 sm:pl-7">
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
                  {post.post_image ? <img src={post.post_image} alt="" className="size-14 shrink-0 object-cover grayscale transition-all group-hover:grayscale-0" /> : <span className="flex size-14 shrink-0 items-center justify-center bg-paper-muted text-xs font-black text-muted">N/A</span>}
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
              {album.images?.[0] ? <img src={album.images[0]} alt={album.album_name || 'Concert album'} className="h-full w-full object-cover grayscale transition-all duration-500 group-hover:scale-105 group-hover:grayscale-0" /> : <span className="flex h-full w-full items-center justify-center text-[9px] font-black tracking-[0.12em] text-muted uppercase">No image</span>}
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
  officialNews,
  communityPosts,
  discussions,
  concertAlbums,
  activeBlog,
  activeAlbum,
}: NewsEditorialViewProps) {
  const storyItems = latestNews.slice(1);

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
              {activeBlog.post_image && <img src={activeBlog.post_image} alt={activeBlog.title || 'Reader post'} className="size-32 object-cover grayscale" />}
              <p className="max-w-2xl whitespace-pre-line text-base leading-relaxed text-muted">{activeBlog.content}</p>
            </div>
          </section>
        ) : (
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-4 xl:col-span-3"><LiveFeed items={officialNews} /></div>
            <div className="space-y-8 lg:col-span-8 xl:col-span-9">
              <section className="flex items-center justify-between gap-4 bg-ink px-5 py-5 text-white sm:px-6">
                <span><span className="block text-[9px] font-bold tracking-[0.22em] text-white/45 uppercase">Contributor</span><span className="mt-1 block text-sm font-black tracking-[0.12em] uppercase">Publish a new post</span></span>
                <Plus aria-hidden="true" className="size-5 text-white" />
                <AddPostTrigger region={region} />
              </section>
              <MostReadList items={latestNews} />
              <CommunitySidebar region={region} communityPosts={communityPosts} discussions={discussions} concertAlbums={concertAlbums} />
            </div>
          </div>
        )}

        {!activeAlbum && !activeBlog && <StoryGrid region={region} items={storyItems} />}
      </main>
    </div>
  );
}
