// ──────────────────────────────────────────────────────────────────────────
// Skin-registry — één bron van waarheid voor alle skins.
//
// Een nieuwe skin toevoegen = ÉÉN object aan de lijst hieronder. De toggle in de
// instellingen en de localStorage-validatie vullen zich automatisch uit deze
// lijst; je hoeft verder nergens iets aan te passen.
//
// Elke skin definieert het NOTATIE-palet: de regel-achtergrond en nootkleuren
// per track (anak/indung). De waarden zijn gewone CSS-waarden (hex, gradient…).
// De chrome (panelen/knoppen) is nog niet getokeniseerd — zie "fase 2" in het
// projectplan; voeg je daar later tokens voor toe, dan kun je ze hier per skin
// meegeven en worden ze automatisch toegepast.
// ──────────────────────────────────────────────────────────────────────────

export const SKINS = [
  {
    id: 'modern',
    label: 'Modern',
    tokens: {
      '--anak-bg': 'linear-gradient(180deg, #2c2f37 0%, #191b21 100%)',
      '--anak-color': '#60a5fa',
      '--anak-text': '#60a5fa',
      '--indung-bg': 'linear-gradient(180deg, #2c2f37 0%, #191b21 100%)',
      '--indung-color': '#d4af37',
      '--indung-text': '#d4af37',
    },
  },
  {
    id: 'classic',
    label: 'Klassiek',
    tokens: {
      '--anak-bg': '#ffffff',
      '--anak-color': '#000000',
      '--anak-text': '#000000',
      '--indung-bg': '#ffffff',
      '--indung-color': '#cc0000',
      '--indung-text': '#cc0000',
    },
  },
  {
    // PUSAMADA — donker kendang-palet: zwarte regels, witte anak, rode indung.
    // (Notatie-fase. Chrome volgt later: zwarte panelen + rode knop-glow zijn de
    //  geplande fase-2-uitbreiding; de knoppen blijven voorlopig modern.)
    id: 'pusamada',
    label: 'PUSAMADA',
    tokens: {
      '--anak-bg': '#0d0d0d',
      '--anak-color': '#ffffff',
      '--anak-text': '#ffffff',
      '--indung-bg': '#0d0d0d',
      '--indung-color': '#ef4444',
      '--indung-text': '#ef4444',
      '--bar-separator': '#e5e7eb', // maatstrepen licht grijs-wit op zwart
    },
  },
];

export const DEFAULT_SKIN = 'modern';
export const SKIN_IDS = SKINS.map((s) => s.id);

// Alle token-sleutels die ergens voorkomen — gebruikt om bij het wisselen eerst
// alles te wissen, zodat een skin die een sleutel weglaat netjes terugvalt op de
// :root-default i.p.v. de waarde van de vorige skin te behouden.
export const ALL_TOKEN_KEYS = Array.from(new Set(SKINS.flatMap((s) => Object.keys(s.tokens))));

export const getSkin = (id) => SKINS.find((s) => s.id === id) || SKINS.find((s) => s.id === DEFAULT_SKIN);
