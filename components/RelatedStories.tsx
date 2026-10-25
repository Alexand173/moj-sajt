import Link from 'next/link';
import type { RelatedNewsItem } from '@/lib/related-news';

export interface RelatedStoriesProps {
  stories: RelatedNewsItem[];
  region: string;
  headingId?: string;
}

/**
 * The in-article "Related stories" block. It sits between body paragraphs and
 * links to other coverage of the artist a headline is about.
 */
export default function RelatedStories({ stories, region, headingId = 'related-stories' }: RelatedStoriesProps) {
  const items = stories.filter((story) => story.title?.trim());
  if (items.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className="my-10 sm:my-12">
      <h2 id={headingId} className="border-b-2 border-ink pb-3 text-xl font-black tracking-[-0.02em] text-ink uppercase sm:text-2xl">
        Related stories
      </h2>
      <ul>
        {items.map((story) => {
          const title = story.title!.trim();
          const href = `/news/${story.region || region}/${story.id}`;

          return (
            <li key={`related-story-${story.id}`} className="border-b border-line">
              <Link
                href={href}
                className="group grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-4 py-4 transition-colors sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-5 sm:py-5"
              >
                <span className="block aspect-[16/10] overflow-hidden bg-paper-muted">
                  {story.image ? (
                    <img
                      src={story.image}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover grayscale transition-all duration-500 group-hover:scale-105 group-hover:grayscale-0"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-[8px] font-black tracking-[0.12em] text-muted uppercase">No image</span>
                  )}
                </span>
                <span className="min-w-0 block text-sm font-black leading-[1.2] tracking-[-0.015em] text-ink transition-colors group-hover:text-accent-blue sm:text-base">
                  {title}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
