import { describe, it, expect } from 'vitest';
import { sanitizePattern, deduplicateGongByBeat, slotToBeat } from './patternLogic';

describe('slotToBeat', () => {
  it('rondt af op de beat-grens (elke 12 slots)', () => {
    expect(slotToBeat(0)).toBe(0);
    expect(slotToBeat(11)).toBe(0);
    expect(slotToBeat(12)).toBe(12);
    expect(slotToBeat(25)).toBe(24);
  });
});

describe('deduplicateGongByBeat', () => {
  it('voegt gong-hits in dezelfde beat samen tot één', () => {
    expect(deduplicateGongByBeat([0, 3, 6, 12, 15])).toEqual([0, 12]);
  });
  it('lege array → lege array', () => {
    expect(deduplicateGongByBeat([])).toEqual([]);
  });
});

describe('sanitizePattern', () => {
  it('vult ontbrekende meta-velden met defaults', () => {
    const p = sanitizePattern({ id: 'x' });
    expect(p.id).toBe('x');
    expect(p.name).toBe('Pattern');
    expect(p.gong).toEqual([]);
  });

  it('sanitiseert een bestaande array-track (lengte 0 → default-slots)', () => {
    const p = sanitizePattern({ id: 'x', anak: [] });
    expect(Array.isArray(p.anak)).toBe(true);
    expect(p.anak.length).toBe(192); // lege array → DEFAULT_SLOTS
  });

  it('vult een korte track aan tot een hele maat (48)', () => {
    const p = sanitizePattern({ id: 'x', anak: [{ top: 'dong', bottom: '' }] });
    expect(p.anak.length).toBe(48);
  });

  it('filtert gong-indices buiten bereik', () => {
    const anak = Array.from({ length: 48 }, () => ({ top: '', bottom: '' }));
    const p = sanitizePattern({ id: 'x', anak, gong: [0, 5, 999, -1] });
    expect(p.gong).toEqual([0, 5]);
  });

  it('behoudt accent-vlaggen', () => {
    const p = sanitizePattern({ id: 'x', anak: [{ top: 'dong', bottom: '', accentTop: true, accentBottom: false }] });
    expect(p.anak[0].accentTop).toBe(true);
    expect(p.anak[0].accentBottom).toBe(false);
  });
});
