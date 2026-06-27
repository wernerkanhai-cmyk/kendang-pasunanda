import { describe, it, expect } from 'vitest';
import { encodeData, decodeData } from './serialize';

describe('serialize (.kendang-bestanden)', () => {
  it('roundtript een song-achtig object', () => {
    const data = [{ name: 'Test', folder: 'Algemeen', bpm: 120, patterns: [{ id: 'a', anak: [], indung: [] }] }];
    expect(decodeData(encodeData(data))).toEqual(data);
  });

  it('roundtript unicode en speciale tekens', () => {
    const data = { name: 'Kendang — Pusanda 🥁', glyph: 'tëung/pëung' };
    expect(decodeData(encodeData(data))).toEqual(data);
  });

  it('decodeData gooit bij onleesbare input (zodat de import-catch grijpt)', () => {
    expect(() => decodeData('@@ niet geldig @@')).toThrow();
  });
});
