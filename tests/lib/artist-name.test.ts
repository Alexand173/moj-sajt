import { describe, expect, it } from 'vitest';
import { cleanArtistName, pickArtistName } from '@/lib/artist-name';

describe('pickArtistName', () => {
  it('prefers the attraction over the event name', () => {
    expect(pickArtistName('Metallica: Life Burns Faster', 'Metallica')).toBe('Metallica');
  });

  it('falls back to the event name when no attraction is given', () => {
    expect(pickArtistName('Aitana', null)).toBe('Aitana');
    expect(pickArtistName('Aitana', '')).toBe('Aitana');
  });

  it('strips a tour suffix from the fallback only', () => {
    expect(pickArtistName('Classically Kate Bush: Full Band Plus Live Orchestra', null))
      .toBe('Classically Kate Bush');
  });

  it('keeps a hyphenated artist intact', () => {
    expect(pickArtistName('Jay-Z', null)).toBe('Jay-Z');
  });

  it('returns Unknown when nothing usable is supplied', () => {
    expect(pickArtistName(undefined, undefined)).toBe('Unknown');
    expect(pickArtistName('   ', null)).toBe('Unknown');
  });
});

describe('cleanArtistName', () => {
  it('leaves a plain name untouched', () => {
    expect(cleanArtistName('Koncert przy świecach')).toBe('Koncert przy świecach');
  });

  it('splits on dash and pipe separators', () => {
    expect(cleanArtistName('Nick Cave - European Summer Run')).toBe('Nick Cave');
    expect(cleanArtistName('OMD | Architecture & More')).toBe('OMD');
  });

  it('keeps the original when the head is too short to be a name', () => {
    expect(cleanArtistName(': Life Burns Faster')).toBe(': Life Burns Faster');
  });

  it('normalises spacing', () => {
    expect(cleanArtistName('  Aitana   Live  ')).toBe('Aitana Live');
  });
});
