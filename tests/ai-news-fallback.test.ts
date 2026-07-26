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

import { generateAiNewsArticle } from '@/lib/ai-news';

const sourcePhrase = 'SYNTHETIC_SOURCE_SENTENCE_DO_NOT_COPY_7F3A';
const sourceArticleText = [
  `A fictional publisher reports that the Harbor Lights Ensemble will release a new studio album in October after completing a summer recording session. ${sourcePhrase}`,
  'The project was recorded with a five-piece lineup and is expected to combine chamber arrangements with electronic production. The publisher says the first single will arrive before the album, although a specific date has not been announced.',
  'According to the supplied report, the musicians began developing the material during rehearsals last winter. They have not announced a supporting tour, guest performers, or a final track list.',
].join('\n\n');

describe('generateAiNewsArticle safe fallback', () => {
  beforeEach(() => {
    mocks.responsesCreate.mockReset();
  });

  it('does not publish source prose when OpenAI reports insufficient quota', async () => {
    mocks.responsesCreate.mockRejectedValue(
      new Error('429 insufficient_quota: You exceeded your current quota.'),
    );

    const result = await generateAiNewsArticle({
      title: 'Harbor Lights Ensemble Announces Fictional October Album',
      excerpt: 'The fictional group is preparing a new studio release after a summer recording session.',
      existingContent: 'The fictional group is preparing a new studio release after a summer recording session.',
      sourceUrl: 'https://example.com/fictional-harbor-lights-album',
      sourceArticleText,
      sourceName: 'Synthetic Publisher',
    });

    expect(mocks.responsesCreate).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      isAiGenerated: false,
      similarityCheckPassed: false,
      similarityScore: 0,
      retryCount: 0,
    });
    expect(result.articleContent).not.toContain(sourcePhrase);
    expect(result.articleContent).toContain('Synthetic Publisher');
    expect(result.articleContent).toContain('intentionally not reproduced here');
  });

  it('retries a timeout twice before returning the safe fallback', async () => {
    mocks.responsesCreate.mockRejectedValue(
      new Error('OpenAI request timed out after 20000ms.'),
    );

    const result = await generateAiNewsArticle({
      title: 'Harbor Lights Ensemble Announces Fictional October Album',
      excerpt: 'The fictional group is preparing a new studio release after a summer recording session.',
      existingContent: 'The fictional group is preparing a new studio release after a summer recording session.',
      sourceUrl: 'https://example.com/fictional-harbor-lights-album',
      sourceArticleText,
      sourceName: 'Synthetic Publisher',
    });

    expect(mocks.responsesCreate).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      isAiGenerated: false,
      similarityCheckPassed: false,
      similarityScore: 0,
      retryCount: 2,
    });
    expect(result.articleContent).not.toContain(sourcePhrase);
    expect(result.articleContent).toContain('Synthetic Publisher');
    expect(result.articleContent).toContain('intentionally not reproduced here');
  });

  it('retries malformed AI JSON twice before returning the safe fallback', async () => {
    mocks.responsesCreate.mockResolvedValue({
      output_text: 'This is not valid JSON from the model.',
    });

    const result = await generateAiNewsArticle({
      title: 'Harbor Lights Ensemble Announces Fictional October Album',
      excerpt: 'The fictional group is preparing a new studio release after a summer recording session.',
      existingContent: 'The fictional group is preparing a new studio release after a summer recording session.',
      sourceUrl: 'https://example.com/fictional-harbor-lights-album',
      sourceArticleText,
      sourceName: 'Synthetic Publisher',
    });

    expect(mocks.responsesCreate).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      isAiGenerated: false,
      similarityCheckPassed: false,
      similarityScore: 0,
      retryCount: 2,
    });
    expect(result.articleContent).not.toContain(sourcePhrase);
    expect(result.articleContent).not.toContain('This is not valid JSON from the model.');
    expect(result.articleContent).toContain('Synthetic Publisher');
    expect(result.articleContent).toContain('intentionally not reproduced here');
  });

  it('rejects source-copying AI output twice before returning the safe fallback', async () => {
    mocks.responsesCreate.mockResolvedValue({
      output_text: JSON.stringify({
        seoTitle: 'Copied fictional headline',
        seoDescription: 'Copied fictional description.',
        articleContent: sourceArticleText,
      }),
    });

    const result = await generateAiNewsArticle({
      title: 'Harbor Lights Ensemble Announces Fictional October Album',
      excerpt: 'The fictional group is preparing a new studio release after a summer recording session.',
      existingContent: 'The fictional group is preparing a new studio release after a summer recording session.',
      sourceUrl: 'https://example.com/fictional-harbor-lights-album',
      sourceArticleText,
      sourceName: 'Synthetic Publisher',
    });

    expect(mocks.responsesCreate).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      isAiGenerated: false,
      similarityCheckPassed: false,
      retryCount: 2,
    });
    expect(result.similarityScore).toBeGreaterThan(0.9);
    expect(result.articleContent).not.toContain(sourcePhrase);
    expect(result.articleContent).not.toContain('Copied fictional headline');
    expect(result.articleContent).toContain('Synthetic Publisher');
    expect(result.articleContent).toContain('intentionally not reproduced here');
  });
});
