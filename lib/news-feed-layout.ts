export type NewsFeedCardLayout = 'compact' | 'feature';
export type NewsFeedCardSource = 'editorial' | 'community';

/**
 * Every fourth editorial story switches to the image-above-text feature card.
 * The rhythm keeps a long feed readable instead of repeating one card shape
 * fifty times, while community contributions keep their own dedicated layout.
 */
export const FEATURE_CARD_CADENCE = 4;

export function getFeedCardLayout(index: number, source: NewsFeedCardSource): NewsFeedCardLayout {
  if (source !== 'editorial') return 'compact';
  if (index <= 0) return 'compact';

  return (index + 1) % FEATURE_CARD_CADENCE === 0 ? 'feature' : 'compact';
}
