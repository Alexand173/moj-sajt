'use client';

import { ArrowUpRight, Check, RotateCw, Sparkles, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { getBriefSourceName, type OfficialNewsBrief } from '@/lib/official-news-brief';

export interface OfficialNewsBriefItem {
  id: string | number;
  title?: string | null;
  text?: string | null;
  url?: string | null;
}

export type OfficialBriefState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; brief: OfficialNewsBrief };

export type OfficialBriefController = OfficialBriefState & { reload: () => void };

const briefCache = new Map<string, OfficialNewsBrief>();
const MAX_CACHED_BRIEFS = 24;

function cacheBrief(id: string, brief: OfficialNewsBrief) {
  if (briefCache.size >= MAX_CACHED_BRIEFS) {
    const oldestKey = briefCache.keys().next().value;
    if (oldestKey) briefCache.delete(oldestKey);
  }

  briefCache.set(id, brief);
}

/**
 * Loads a single official-news brief on demand so the landing page never ships
 * the long AI text for every row it renders.
 */
export function useOfficialBrief(newsId: string | null): OfficialBriefController {
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState<OfficialBriefState>({ status: 'idle' });

  useEffect(() => {
    if (!newsId) {
      setState({ status: 'idle' });
      return undefined;
    }

    const cached = briefCache.get(newsId);
    if (cached) {
      setState({ status: 'loaded', brief: cached });
      return undefined;
    }

    const controller = new AbortController();
    setState({ status: 'loading' });

    const load = async () => {
      try {
        const response = await fetch(`/api/news/official-content?id=${encodeURIComponent(newsId)}`, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });

        if (!response.ok) throw new Error(`Brief request failed with ${response.status}.`);

        const brief = (await response.json()) as OfficialNewsBrief;
        cacheBrief(newsId, brief);
        setState({ status: 'loaded', brief });
      } catch (error) {
        if (controller.signal.aborted) return;
        console.warn(`Could not load the official news brief ${newsId}:`, error);
        setState({ status: 'error' });
      }
    };

    void load();
    return () => controller.abort();
  }, [newsId, reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  return { ...state, reload };
}

const LOADING_LINE_WIDTHS = ['w-full', 'w-11/12', 'w-10/12', 'w-9/12'];

function BriefLoading({ title }: { title: string }) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading the MusicTop brief for {title}.</span>
      <div aria-hidden="true" className="space-y-2.5">
        {LOADING_LINE_WIDTHS.map((width) => (
          <span key={width} className={`block h-3 animate-pulse bg-line ${width}`} />
        ))}
      </div>
    </div>
  );
}

function BriefError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="status">
      <p className="text-sm leading-relaxed text-muted">
        The brief did not load. Retry, or read the publisher&apos;s report below.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 inline-flex items-center gap-1.5 border border-line px-3 py-2 text-[9px] font-black tracking-[0.14em] text-ink uppercase transition-colors hover:border-accent-red hover:text-accent-red"
      >
        <RotateCw aria-hidden="true" className="size-3.5" />
        Try again
      </button>
    </div>
  );
}

function BriefPending() {
  return (
    <p className="flex gap-2 text-sm leading-relaxed text-muted">
      <Sparkles aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-accent-blue" />
      <span>
        MusicTop is still preparing the independent brief for this story. The publisher&apos;s report is available now.
      </span>
    </p>
  );
}

function BriefParagraphs({ articleId, paragraphs, isPanel }: { articleId: string; paragraphs: string[]; isPanel: boolean }) {
  if (isPanel) {
    return (
      <div className="space-y-5">
        {paragraphs.map((paragraph, index) => (
          <p
            key={`${articleId}-paragraph-${index}`}
            className={index === 0
              ? 'text-base leading-[1.6] text-ink sm:text-lg'
              : 'text-[15px] leading-[1.75] text-ink/80'}
          >
            {paragraph}
          </p>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3.5 text-sm leading-relaxed text-ink">
      {paragraphs.map((paragraph, index) => (
        <p key={`${articleId}-paragraph-${index}`}>{paragraph}</p>
      ))}
    </div>
  );
}

interface BriefFooterProps {
  url?: string | null;
  sourceName: string;
  isReady: boolean;
  similarityScore: number | null;
  isPanel: boolean;
}

function BriefFooter({ url, sourceName, isReady, similarityScore, isPanel }: BriefFooterProps) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 border-t border-line ${isPanel ? 'mt-8 pt-5' : 'mt-4 pt-3.5'}`}>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[9px] font-black tracking-[0.14em] text-ink uppercase underline decoration-accent-red decoration-2 underline-offset-4 transition-colors hover:text-accent-red"
        >
          Original report: {sourceName}
          <ArrowUpRight aria-hidden="true" className="size-3.5" />
        </a>
      ) : (
        <span className="text-[9px] font-bold tracking-[0.14em] text-muted uppercase">Original link unavailable</span>
      )}

      {isReady && similarityScore !== null && (
        <span className="inline-flex items-center gap-1.5 text-[8px] font-bold tracking-[0.12em] text-muted uppercase">
          <Check aria-hidden="true" className="size-3 text-ticket-green" />
          Independent rewrite · {Math.round(similarityScore * 100)}% source overlap
        </span>
      )}
    </div>
  );
}

interface OfficialNewsReaderProps {
  articleId: string;
  item: OfficialNewsBriefItem;
  briefState: OfficialBriefController;
  publishedLabel: string;
  variant: 'panel' | 'inline';
  onClose: () => void;
}

/**
 * `panel` replaces the whole middle column on desktop, so it renders as a full
 * read surface. `inline` is the mobile-only block that opens underneath the
 * tapped headline and shows nothing but the brief itself.
 */
export default function OfficialNewsReader({
  articleId,
  item,
  briefState,
  publishedLabel,
  variant,
  onClose,
}: OfficialNewsReaderProps) {
  const isPanel = variant === 'panel';
  const headingId = `${articleId}-heading`;
  const title = item.title?.trim() || item.text?.trim() || 'Official music news';
  const sourceName = getBriefSourceName(item.url);
  const brief = briefState.status === 'loaded' ? briefState.brief : null;
  const paragraphs = brief?.status === 'ready'
    ? brief.articleContent.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean)
    : [];
  const isReady = brief?.status === 'ready';

  const body = (
    <>
      {briefState.status === 'loading' && <BriefLoading title={title} />}
      {briefState.status === 'error' && <BriefError onRetry={briefState.reload} />}
      {brief?.status === 'pending' && <BriefPending />}
      {isReady && <BriefParagraphs articleId={articleId} paragraphs={paragraphs} isPanel={isPanel} />}
      <BriefFooter
        url={item.url}
        sourceName={sourceName}
        isReady={isReady}
        similarityScore={brief?.status === 'ready' ? brief.similarityScore : null}
        isPanel={isPanel}
      />
    </>
  );

  if (!isPanel) {
    return (
      <article id={articleId} aria-labelledby={headingId} className="mt-3 border-t-2 border-ink bg-paper-muted px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[9px] font-black tracking-[0.22em] text-accent-red uppercase">
              <Sparkles aria-hidden="true" className="size-3" />
              MusicTop brief
            </p>
            <h3 id={headingId} className="sr-only">{title}</h3>
            <p className="mt-1.5 text-[9px] font-bold tracking-[0.14em] text-muted uppercase">{sourceName} · {publishedLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close the MusicTop brief"
            className="flex size-7 shrink-0 items-center justify-center border border-line bg-white text-muted transition-colors hover:border-accent-red hover:text-accent-red"
          >
            <X aria-hidden="true" className="size-3.5" />
          </button>
        </div>
        <div className="mt-4">{body}</div>
      </article>
    );
  }

  return (
    <article id={articleId} aria-labelledby={headingId} className="border-t-2 border-ink pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <p className="flex items-center gap-2 text-[9px] font-black tracking-[0.22em] text-accent-red uppercase">
          <span aria-hidden="true" className="h-px w-5 bg-current" />
          MusicTop brief
        </p>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 border border-line px-3 py-2 text-[9px] font-black tracking-[0.14em] text-ink uppercase transition-colors hover:border-ink hover:bg-ink hover:text-white"
        >
          <X aria-hidden="true" className="size-3" />
          Back to the feed
        </button>
      </div>

      <h3
        id={headingId}
        className="mt-6 text-balance text-[clamp(1.6rem,2.6vw,2.6rem)] font-black leading-[1.02] tracking-[-0.03em] text-ink uppercase"
      >
        {title}
      </h3>
      <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] font-bold tracking-[0.16em] text-muted uppercase">
        <span className="text-accent-blue">Official source · {sourceName}</span>
        <span aria-hidden="true" className="text-line-strong">/</span>
        <span>{publishedLabel}</span>
      </p>

      <div className="mt-7">{body}</div>
    </article>
  );
}
