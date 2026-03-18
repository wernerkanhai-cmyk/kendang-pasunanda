/**
 * Factory Presets — standaardpatronen meegeleverd met de app.
 *
 * MAPSTRUCTUUR:
 *   factory/tepak-dua/        → Tepak Dua patronen
 *   factory/tepak-tilu/       → Tepak Tilu patronen
 *   factory/tepak-paleredan/  → Tepak Paleredan patronen
 *   factory/mincid/           → Mincid patronen
 *   factory/padungdung/       → Padungdung patronen
 *
 * HOE EEN PRESET TOEVOEGEN:
 *   1. Maak een nieuw bestand aan in de juiste map, bijv. tepak-dua/basic.js
 *   2. Exporteer een preset-object: { id, name, category, anak, indung, gong }
 *   3. Importeer en voeg toe aan de juiste categorie hieronder
 *
 * SYMBOLEN (NeoDamina lettertype):
 *   Rechterhand / top:    A=dong  J=deng  ;=dung  :=dang  L=ding  G=pak  F=peung
 *   Linkerhand  / bottom: C=dong  ?=deng  V=dung  S=dang  N=ding
 *   Rust: . (beide handen)
 *
 * SLOTS: 1 maat = 48 slots | 1 tel = 12 slots | 1/8 = 6 slots | 1/16 = 3 slots
 */

// ── Tepak Dua ─────────────────────────────────────────────────────────────────
// import tepakDuaBasic from './tepak-dua/basic';

// ── Tepak Tilu ────────────────────────────────────────────────────────────────
// import tepakTiluBasic from './tepak-tilu/basic';

// ── Tepak Paleredan ───────────────────────────────────────────────────────────
// import tepakPaleredanBasic from './tepak-paleredan/basic';

// ── Mincid ────────────────────────────────────────────────────────────────────
// import mincidBasic from './mincid/basic';

// ── Padungdung ────────────────────────────────────────────────────────────────
// import padungdungBasic from './padungdung/basic';

export const FACTORY_PRESETS = [
  // Tepak Dua
  // tepakDuaBasic,

  // Tepak Tilu
  // tepakTiluBasic,

  // Tepak Paleredan
  // tepakPaleredanBasic,

  // Mincid
  // mincidBasic,

  // Padungdung
  // padungdungBasic,
];

// Gegroepeerd voor de UI-dropdown
export const FACTORY_CATEGORIES = [
  { label: 'Tepak Dua',       ids: [] },
  { label: 'Tepak Tilu',      ids: [] },
  { label: 'Tepak Paleredan', ids: [] },
  { label: 'Mincid',          ids: [] },
  { label: 'Padungdung',      ids: [] },
];
