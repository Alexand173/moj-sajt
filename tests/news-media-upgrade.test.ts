import { describe, expect, it } from 'vitest';
import { upgradePublisherImageUrl } from '@/lib/news-media';

/**
 * The hero fills the full content width, so the size of the image behind it is
 * visible quality: a 1024px feed thumbnail drawn across 1545px is a 1.51x upscale,
 * and it is what the world feed's lead story looked soft for.
 *
 * The rewrite is deliberately narrow. Only width *parameters* change, because the
 * CDNs in play honour them. Filename suffixes (`-1024x682.jpg`) are left alone:
 * WordPress serves the sizes it generated, so a guessed larger suffix 404s.
 */

describe('publisher image upgrade', () => {
  it('raises a width parameter to the target', () => {
    expect(upgradePublisherImageUrl('https://wp.example.com/uploads/Danny-Yoon.jpg?w=1024'))
      .toBe('https://wp.example.com/uploads/Danny-Yoon.jpg?w=2000');
    expect(upgradePublisherImageUrl('https://cdn.example.com/a.jpg?width=620&quality=80'))
      .toBe('https://cdn.example.com/a.jpg?width=2000&quality=80');
    expect(upgradePublisherImageUrl('https://img.example.com/a.jpg?imwidth=320'))
      .toBe('https://img.example.com/a.jpg?imwidth=2000');
  });

  it('keeps the aspect ratio on a resize parameter', () => {
    // 620x413 is 3:2; asking for a wider original must not stretch it. Asserted on
    // the parsed value because URLSearchParams percent-encodes the comma, which
    // CDNs decode back to the same request.
    const upgraded = upgradePublisherImageUrl('https://img.example.com/a.jpg?resize=620,413');
    expect(upgraded).not.toBeNull();
    expect(new URL(upgraded as string).searchParams.get('resize')).toBe('2000,1332');
  });

  it('rewrites a Cloudinary path transform', () => {
    expect(upgradePublisherImageUrl('https://res.cloudinary.com/demo/image/upload/w_800,c_fill/hero.jpg'))
      .toBe('https://res.cloudinary.com/demo/image/upload/w_2000,c_fill/hero.jpg');
  });

  it('leaves a large or unparameterised URL untouched', () => {
    const already = 'https://cdn.example.com/a.jpg?w=2400';
    expect(upgradePublisherImageUrl(already)).toBe(already);
    const noParam = 'https://cdn.example.com/a.jpg';
    expect(upgradePublisherImageUrl(noParam)).toBe(noParam);
    // The suffix is not a parameter: guessing a bigger one would 404.
    const wordpress = 'https://cdn.example.com/a-1024x682.jpg';
    expect(upgradePublisherImageUrl(wordpress)).toBe(wordpress);
  });

  it('refuses anything that is not a usable image URL', () => {
    expect(upgradePublisherImageUrl(null)).toBeNull();
    expect(upgradePublisherImageUrl('')).toBeNull();
    expect(upgradePublisherImageUrl('not a url')).toBeNull();
    // Only https is accepted, matching `getSafeMediaUrl`.
    expect(upgradePublisherImageUrl('http://cdn.example.com/a.jpg?w=100')).toBeNull();
  });
});
