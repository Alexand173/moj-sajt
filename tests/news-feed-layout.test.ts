import { describe, expect, it } from 'vitest';
import { FEATURE_CARD_CADENCE, getFeedCardLayout } from '@/lib/news-feed-layout';

describe('news feed card layout rhythm', () => {
  it('uses an image-above-text card every fourth editorial story', () => {
    const layouts = Array.from({ length: 9 }, (_, index) => getFeedCardLayout(index, 'editorial'));

    expect(FEATURE_CARD_CADENCE).toBe(4);
    expect(layouts).toEqual([
      'compact',
      'compact',
      'compact',
      'feature',
      'compact',
      'compact',
      'compact',
      'feature',
      'compact',
    ]);
  });

  it('keeps community contributions in their dedicated layout', () => {
    expect(getFeedCardLayout(3, 'community')).toBe('compact');
    expect(getFeedCardLayout(7, 'community')).toBe('compact');
  });
});
