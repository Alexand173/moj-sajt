import { describe, expect, it } from 'vitest';
import { createOfficialNewsBrief, getBriefSourceName } from '@/lib/official-news-brief';

const validatedArticleContent = Array.from({ length: 210 }, () => 'word').join(' ');

describe('official news brief payload', () => {
  it('exposes the rewrite only when the AI and similarity gates passed', () => {
    const brief = createOfficialNewsBrief({
      id: 1,
      title: 'A publisher story',
      url: 'https://www.rollingstone.com/music/some-story',
      created_at: '2026-10-15T00:00:00.000Z',
      ai_content: validatedArticleContent,
      ai_generated: true,
      ai_status: 'generated',
      ai_similarity_score: 0.12,
    });

    expect(brief.status).toBe('ready');
    expect(brief.sourceName).toBe('rollingstone.com');
    expect(brief.wordCount).toBe(210);
    expect(brief.similarityScore).toBe(0.12);
  });

  it('never leaks publisher prose for a pending or rejected rewrite', () => {
    const brief = createOfficialNewsBrief({
      id: 2,
      title: 'A publisher story',
      url: 'https://example.com/story',
      ai_content: validatedArticleContent,
      ai_generated: false,
      ai_status: 'fallback',
      ai_similarity_score: 0.91,
    });

    expect(brief.status).toBe('pending');
    expect(brief.articleContent).toBe('');
    expect(brief.wordCount).toBe(0);
  });

  it('falls back to a readable source label for missing or invalid urls', () => {
    expect(getBriefSourceName(null)).toBe('Original publisher');
    expect(getBriefSourceName('not-a-url')).toBe('Original publisher');
  });
});
