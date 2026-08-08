import { describe, expect, it } from 'vitest';
import { NEWS_REGION_QUERIES } from '@/lib/news-regions';

describe('news region queries', () => {
  it('uses a current UK music query instead of a year-pinned search', () => {
    const ukQuery = NEWS_REGION_QUERIES.find(({ region }) => region === 'uk')?.query || '';

    expect(ukQuery).toContain('"UK music"');
    expect(ukQuery).toContain('"British music"');
    expect(ukQuery).toContain('"London music"');
    expect(ukQuery).not.toMatch(/\b20\d{2}\b/);
  });
});
