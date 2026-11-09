import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  responsesCreate: vi.fn(),
}));

vi.mock('openai', () => ({
  default: class MockOpenAI {
    responses = {
      create: mocks.responsesCreate,
    };
  },
}));

import {
  generateAiNewsArticle,
  inspectDraft,
  stripSummaryBookends,
} from '@/lib/ai-news';

/**
 * The first real batch closed nearly every article with "In conclusion" and
 * leaned on frames like "From an industry perspective", even after the brief
 * banned them. These tests pin the enforcement that does not depend on the model
 * obeying instructions: bookends are stripped, problems are detected, and the
 * retry carries the exact violations back to the model.
 */

const paragraphsOf = (prefix: string, count: number, wordsEach: number): string =>
  Array.from({ length: count }, (_, paragraph) =>
    Array.from({ length: wordsEach }, (_, word) => `${prefix}${paragraph}x${word}`).join(' '),
  ).join('\n\n');

describe('editorial bookends', () => {
  it('drops a closing summary paragraph', () => {
    const body = `${paragraphsOf('body', 10, 40)}\n\nIn conclusion, the artist remains a defining figure.`;

    const cleaned = stripSummaryBookends(body);

    expect(cleaned).not.toContain('In conclusion');
    expect(cleaned.split('\n\n')).toHaveLength(10);
  });

  it('strips a summary word from the opening sentence', () => {
    const cleaned = stripSummaryBookends('Overall, the album arrives in March after two years of sessions.');

    expect(cleaned).toBe('The album arrives in March after two years of sessions.');
  });

  it('flags stock frames and a short draft', () => {
    const draft = `From an industry perspective this matters.\n\n${paragraphsOf('short', 4, 30)}`;

    const inspection = inspectDraft(draft);

    expect(inspection.problems).toContain('stock-frame');
    expect(inspection.problems).toContain('short-draft');
    expect(inspection.notes.join(' ')).toContain('perspective');
  });
});

describe('violation-specific retry', () => {
  beforeEach(() => {
    mocks.responsesCreate.mockReset();
    process.env.OPENAI_API_KEY = 'test-openai-key';
  });

  it('quotes the editorial problems back to the model and keeps the repaired draft', async () => {
    const sourceArticleText = Array.from({ length: 500 }, (_, index) => `sourceword${index}`).join(' ');
    const firstDraft = `${paragraphsOf('draftone', 8, 50)}\n\nIn conclusion, this draft restates the whole story.`;
    const repairedDraft = paragraphsOf('drafttwo', 10, 80);

    mocks.responsesCreate
      .mockResolvedValueOnce({
        output_text: JSON.stringify({
          seoTitle: 'First attempt',
          seoDescription: 'First attempt lead.',
          articleContent: firstDraft,
        }),
      })
      .mockResolvedValueOnce({
        output_text: JSON.stringify({
          seoTitle: 'Harbor Lights album update',
          seoDescription: 'The album arrives after two years of sessions.',
          articleContent: repairedDraft,
        }),
      });

    const result = await generateAiNewsArticle({
      title: 'Harbor Lights Ensemble Announces Fictional October Album',
      excerpt: 'The group is preparing a new studio release.',
      sourceUrl: 'https://example.com/fictional-harbor-lights-album',
      sourceArticleText,
      sourceName: 'Synthetic Publisher',
    });

    expect(mocks.responsesCreate).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ isAiGenerated: true, similarityCheckPassed: true, retryCount: 1 });
    expect(result.articleContent).not.toContain('In conclusion');

    const firstPrompt = String(mocks.responsesCreate.mock.calls[0][0].input);
    const retryPrompt = String(mocks.responsesCreate.mock.calls[1][0].input);
    expect(firstPrompt).not.toContain('REPAIR NOTES');
    expect(retryPrompt).toContain('REPAIR NOTES');
    expect(retryPrompt).toContain('summary paragraph');
    expect(retryPrompt).toContain('words');
  });
});
