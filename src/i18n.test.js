import { describe, it, expect } from 'vitest';
import { T, LANGUAGES } from './i18n';

// Bewaakt dat élke taal exact dezelfde sleutels heeft. Vergeet iemand een
// vertaling bij het toevoegen van een sleutel, dan faalt deze test met een diff
// die precies de ontbrekende/extra sleutel toont.
describe('i18n key-pariteit (en/nl/id)', () => {
  const codes = LANGUAGES.map((l) => l.code);
  const reference = Object.keys(T.en).sort();

  it('alle talen uit LANGUAGES bestaan in T', () => {
    for (const code of codes) {
      expect(T[code], `taalblok "${code}" ontbreekt in T`).toBeTruthy();
    }
  });

  for (const code of codes) {
    it(`"${code}" heeft exact dezelfde sleutels als "en"`, () => {
      expect(Object.keys(T[code]).sort()).toEqual(reference);
    });
  }

  it('geen lege vertaalwaarden (strings)', () => {
    for (const code of codes) {
      for (const [key, val] of Object.entries(T[code])) {
        if (typeof val === 'string') {
          expect(val.length, `${code}.${key} is leeg`).toBeGreaterThan(0);
        }
      }
    }
  });
});
