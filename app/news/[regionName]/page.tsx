import { createClient } from '@supabase/supabase-js';
import { unstable_noStore as noStore } from 'next/cache';
import Link from 'next/link';
import AddPostTrigger from '@/components/AddPostTrigger';
import AddCommentTrigger from '@/components/AddCommentTrigger';
import AddAlbumTrigger from '@/components/AddAlbumTrigger';
// Uvozimo AlbumGallery za prelistavanje i lightbox efekat
import AlbumGallery from '@/components/AlbumGallery';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function BillboardNewsPage({
  params,
  searchParams
}: {
  params: Promise<{ regionName: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  noStore();
  const { regionName } = await params;
  const { blogId, albumId } = await searchParams;
 
  const region = regionName.toLowerCase();

  const [officialRes, latestRes, blogRes, discRes, concertRes] = await Promise.all([
    supabase.from('news').select('*').eq('region', region).eq('category', 'OFFICIAL').order('created_at', { ascending: false }).limit(50),
    supabase.from('news').select('*').eq('region', region).eq('category', 'LATEST').order('created_at', { ascending: false }).limit(50),
    supabase
  .from('community_posts')
  .select(`
    id,
    title,
    content,
    created_at,
    region,
    post_image,
    author_id,
    profiles (
      first_name,
      avatar_url
    )
  `)
  .eq('region', region)
  .order('created_at', { ascending: false })
  .limit(3),
    supabase.from('discussions').select('*').eq('region', region).order('created_at', { ascending: false }).limit(3),
    supabase.from('concert_albums').select(`
        id,
        album_name,
        created_at,
        region,
        images,
        author_id,
        profiles (
          first_name,
          avatar_url
        )
      `)
      .eq('region', region)
      .order('created_at', { ascending: false })
      .limit(4)
  ]);

  const officialNews = officialRes.data || [];
  const latestNews = latestRes.data || [];
  const communityPosts = blogRes.data || [];
  const discussions = discRes.data || [];
  const concertAlbums = concertRes.data || [];

  const activeBlog = blogId ? communityPosts.find(p => p.id.toString() === blogId) : null;
  const activeAlbum = albumId ? concertAlbums.find(a => a.id.toString() === albumId) : null;

  const featuredNews = latestNews[0];
  const otherNews = latestNews.slice(1);

  return (
    <div className="min-h-screen bg-white text-black pt-2 pb-5 font-sans uppercase font-black">
      <div className="max-w-[1700px] mx-auto px-6">
       
        <div className="border-b-[4px] border-black mt-4 mb-6 pb-2 flex justify-between items-end">
          <Link href={`/news/${region}`}>
            <h1 className="text-5xl font-bold leading-none tracking-tighter uppercase">
              {region}<span className="text-purple-600">.</span>FEED
            </h1>
          </Link>
          <span className="text-sm font-bold pb-1 uppercase tracking-widest text-gray-400">EST. 2026</span>
        </div>

        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-12">
         
          {/* LEVA KOLONA */}
          <aside className="order-3 lg:order-none lg:col-span-3 border-t-4 lg:border-t-0 lg:border-r-4 border-black pt-10 lg:pt-0 lg:pr-8 mt-10 lg:mt-0">
            <h2 className="text-2xl bg-black text-white px-3 py-1 inline-block mb-10 tracking-widest uppercase">
              OFFICIAL {region}
            </h2>
            <div className="flex flex-col gap-6">
              {officialNews.map((news) => (
                <a key={news.id} href={news.url} target="_blank" rel="noopener noreferrer" className="block group border-b border-black/5 pb-4 hover:opacity-70 transition">
                  <span className="text-purple-600 font-bold text-[10px] tracking-widest mb-1 uppercase">LIVE FEED</span>
                  <h3 className="font-black text-sm leading-tight uppercase line-clamp-2 group-hover:underline">{news.title}</h3>
                  <p className="italic text-gray-400 text-[10px] mt-1 normal-case font-medium">{news.excerpt}</p>
                </a>
              ))}
            </div>
          </aside>

          {/* CENTRALNI DEO */}
          <main className="order-1 lg:order-none lg:col-span-6">
            {activeAlbum ? (
              <div className="bg-white p-6 border-4 border-black">
                <Link href={`/news/${region}`} className="mb-6 inline-block font-bold hover:text-purple-600 border-b-2 border-black transition-colors">
                  &larr; BACK TO FEED
                </Link>
                <h1 className="text-4xl font-black uppercase mb-6">{activeAlbum.album_name}</h1>
                
                {/* OVDE JE UBACEN ALBUM GALLERY SA MEHANIZMOM KLIK-ZA-FULLSIZE I DESNIM SKROLOVANJEM */}
                <AlbumGallery images={activeAlbum.images || []} albumName={activeAlbum.album_name} />
              </div>
            ) : activeBlog ? (
              <div className="bg-white p-6 border-4 border-black">
                <Link href={`/news/${region}`} className="mb-6 inline-block font-bold hover:text-purple-600 border-b-2 border-black transition-colors">
                  &larr; BACK TO FEED
                </Link>
                <h1 className="text-4xl font-black uppercase mb-6">{activeBlog.title}</h1>
                <div className="flex flex-col md:flex-row gap-6 items-start">
                  {activeBlog.post_image && (
                    <img src={activeBlog.post_image} alt={activeBlog.title} className="w-24 h-24 object-cover border-2 border-black shrink-0" />
                  )}
                  <div className="text-lg leading-relaxed normal-case font-medium">
                    {activeBlog.content}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {featuredNews && (
                  <Link href={`/news/${region}/${featuredNews.id}`} className="group block mb-20 border-b-[6px] border-black pb-12">
                    <div className="aspect-video mb-8 overflow-hidden border-4 border-black shadow-[12px_12px_0px_0px_rgba(147,51,234,1)]">
                      <img src={featuredNews.image} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" alt={featuredNews.title} />
                    </div>
                    <h2 className="text-4xl md:text-5xl leading-[0.9] tracking-tighter group-hover:text-purple-600 transition-colors uppercase">{featuredNews.title}</h2>
                    <p className="mt-6 text-sm text-zinc-600 font-medium normal-case leading-relaxed">{featuredNews.excerpt}</p>
                  </Link>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-12">
                  {otherNews.map((item) => (
                    <Link key={item.id} href={`/news/${region}/${item.id}`} className="group block">
                      <div className="aspect-video overflow-hidden border-2 border-black mb-4 group-hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all">
                        <img src={item.image} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" alt="" />
                      </div>
                      <h3 className="text-lg leading-tight group-hover:text-purple-600 transition-colors uppercase">{item.title}</h3>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </main>

          {/* DESNA KOLONA */}
          <aside className="order-2 lg:order-none lg:col-span-3">
            <div className="border-l-4 border-black pl-8 space-y-12">
              <h2 className="text-xl font-black uppercase tracking-widest italic">Community.Hub</h2>

              <div className="border-b-4 border-black pb-8">
                <h4 className="text-[10px] font-bold uppercase text-zinc-400 mb-4">Reader's Blog</h4>
                <AddPostTrigger region={region} />
                <div className="space-y-6 mt-6">
                  {communityPosts.map((post) => {
                    const profile = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles;
                    const authorName = profile?.first_name || 'ANONYMOUS';
                    const authorAvatar = profile?.avatar_url;
                    const initials = authorName.charAt(0).toUpperCase() || '?';

                    return (
                      <Link key={post.id} href={`/news/${region}?blogId=${post.id}`} className="group block">
                        <div className="flex gap-3 items-start">
                          {post.post_image ? (
                            <img src={post.post_image} className="w-16 h-16 object-cover border-2 border-black" alt="" />
                          ) : (
                            <div className="w-16 h-16 bg-zinc-100 border-2 border-black flex items-center justify-center text-xs font-bold">N/A</div>
                          )}
                          <div className="flex-1">
                            <p className="font-bold text-sm leading-tight group-hover:text-purple-600 transition underline decoration-2">"{post.title}"</p>
                            <div className="flex items-center gap-2 mt-1">
                              {authorAvatar ? (
                                <img 
                                  src={authorAvatar} 
                                  alt={authorName} 
                                  className="w-4 h-4 rounded-full border border-black object-cover"
                                />
                              ) : (
                                <div className="w-4 h-4 bg-black rounded-full flex items-center justify-center text-[8px] text-white font-bold">
                                  {initials}
                                </div>
                              )}
                              <p className="text-[10px] text-zinc-500 uppercase font-medium">@{authorName.toLowerCase()}</p>
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>

              <div className="w-full h-[300px] border-4 border-black bg-zinc-50 flex flex-col items-center justify-center p-4">
                <span className="text-[9px] text-zinc-400 font-black mb-4 vertical-text rotate-180 uppercase tracking-widest">Advertisement</span>
                <div className="italic text-zinc-200 text-xs">AD_SLOT_02</div>
              </div>

              <div className="border-b-4 border-black pb-8">
                <h4 className="text-[10px] font-bold uppercase text-zinc-400 mb-4">Comments</h4>
                <AddCommentTrigger region={region} />
                <div className="space-y-4 mt-4">
                  {discussions.map((d) => (
                    <div key={d.id} className="border-l-2 border-purple-600 pl-3">
                      <p className="text-xs font-bold leading-tight">"{d.text}"</p>
                      <span className="text-[9px] text-zinc-400 uppercase">{d.user_name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="w-full h-[300px] border-4 border-black bg-zinc-50 flex flex-col items-center justify-center p-4">
                <span className="text-[9px] text-zinc-400 font-black mb-4 vertical-text rotate-180 uppercase tracking-widest">Advertisement</span>
                <div className="italic text-zinc-200 text-xs">AD_SLOT_02</div>
              </div>

              <div className="border-b-4 border-black pb-8">
                <h4 className="text-[10px] font-bold uppercase text-zinc-400 mb-4">Concert Albums</h4>
                <AddAlbumTrigger region={region} />
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {concertAlbums.map((c) => (
                    <Link key={c.id} href={`/news/${region}?albumId=${c.id}`}>
                      {c.images && c.images.length > 0 ? (
                        <img src={c.images[0]} alt={c.album_name} className="aspect-square bg-zinc-200 object-cover border-2 border-black" />
                      ) : (
                        <div className="aspect-square bg-zinc-100 border-2 border-dashed border-zinc-300" />
                      )}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="w-full h-[300px] border-4 border-black bg-zinc-50 flex flex-col items-center justify-center p-4">
                <span className="text-[9px] text-zinc-400 font-black mb-4 vertical-text rotate-180 uppercase tracking-widest">Advertisement</span>
                <div className="italic text-zinc-200 text-xs">AD_SLOT_02</div>
              </div>

            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}