import { describe, expect, it, vi } from 'vitest';

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
  calculateContentWordJaccardSimilarity,
  calculateWordJaccardSimilarity,
  generateAiNewsArticle,
} from '@/lib/ai-news';

/**
 * The gate used to score unique words including function words, which put an
 * unavoidable ~0.4 floor on any honest English rewrite and rejected everything.
 * These tests pin the two properties that make the fix safe: shared function
 * words are not treated as copying, and a verbatim copy is still caught.
 */

const sourceArticleText = [
  'London promoter Fieldnote Live said on Tuesday that the indie band Marlow Sound will headline three nights at the Brixton Academy in March.',
  'The promoter added that the run follows a sold-out December show at the same venue.',
  'Tickets go on sale on Friday at ten, with a presale for newsletter members on Thursday.',
  'Marlow Sound released their second album in April and have not toured since.',
].join(' ');

/** Same facts, same names and dates, rebuilt sentence by sentence. */
const honestRewrite = [
  'Three March nights at Brixton Academy are lined up for Marlow Sound, according to Fieldnote Live, the London promoter behind the run.',
  'The booking extends a relationship that already produced a December sell-out in the same room.',
  'Presale opens Thursday for newsletter subscribers, with general sale following on Friday.',
  'The band have stayed off the road since their April second record, which makes this the first chance to hear it live.',
].join('\n\n');

describe('rewrite similarity measurement', () => {
  it('ignores shared function words and counts shared content words', () => {
    const first = 'The band will release the album in the city with the producer and the label and the tour.';
    const second = 'The singer may delay the single at the venue without the manager or the crew or the show.';

    expect(calculateContentWordJaccardSimilarity(first, second)).toBe(0);
    expect(calculateWordJaccardSimilarity(first, second)).toBeGreaterThan(0);
  });

  it('still scores a verbatim copy as near-total overlap', () => {
    expect(calculateContentWordJaccardSimilarity(sourceArticleText, sourceArticleText)).toBe(1);
    expect(calculateWordJaccardSimilarity(sourceArticleText, sourceArticleText)).toBe(1);
  });

  it('accepts an honest paraphrase that the all-words gate rejected', async () => {
    process.env.OPENAI_API_KEY = 'test-openai-key';
    mocks.responsesCreate.mockReset();
    mocks.responsesCreate.mockResolvedValue({
      output_text: JSON.stringify({
        seoTitle: 'Marlow Sound line up three March nights at Brixton Academy',
        seoDescription: 'Fieldnote Live has booked the band for a three-night run in March.',
        articleContent: honestRewrite,
      }),
    });

    const result = await generateAiNewsArticle({
      title: 'Marlow Sound announce Brixton Academy residency',
      excerpt: 'The band will play three nights in March.',
      sourceUrl: 'https://example.com/marlow-sound-brixton',
      sourceArticleText,
      sourceName: 'Synthetic Publisher',
    });

    expect(result).toMatchObject({ isAiGenerated: true, similarityCheckPassed: true, retryCount: 0 });
    // The stored score is the content-word metric the gate decided on.
    expect(result.similarityScore).toBeLessThan(0.5);
    // Proof this rewrite would have been thrown away by the old ceiling.
    expect(calculateWordJaccardSimilarity(sourceArticleText, honestRewrite)).toBeGreaterThan(0.35);
  });

  it('tells the model how to restructure instead of only asking for a rewrite', async () => {
    process.env.OPENAI_API_KEY = 'test-openai-key';
    mocks.responsesCreate.mockReset();
    mocks.responsesCreate.mockResolvedValue({
      output_text: JSON.stringify({
        seoTitle: 'Marlow Sound line up three March nights at Brixton Academy',
        seoDescription: 'Fieldnote Live has booked the band for a three-night run in March.',
        articleContent: honestRewrite,
      }),
    });

    await generateAiNewsArticle({
      title: 'Marlow Sound announce Brixton Academy residency',
      excerpt: 'The band will play three nights in March.',
      sourceUrl: 'https://example.com/marlow-sound-brixton',
      sourceArticleText,
      sourceName: 'Synthetic Publisher',
    });

    const prompt = String(mocks.responsesCreate.mock.calls[0][0].input);
    expect(prompt).toContain('Build your own outline');
    expect(prompt).toContain('Never reuse four or more consecutive words');
    expect(prompt).toContain('ORIGINAL COMMENTARY');
    expect(String(mocks.responsesCreate.mock.calls[0][0].temperature)).toBe('0.85');
  });
});
