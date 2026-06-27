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
    labelKey: 'skinModern', // i18n-sleutel (val terug op label als afwezig)
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
    labelKey: 'skinClassic',
    tokens: {
      '--anak-bg': '#ffffff',
      '--anak-color': '#000000',
      '--anak-text': '#000000',
      // Anak-volumeknop zit op de donkere header; zwart zou daar onzichtbaar zijn.
      // (Modern/PUSAMADA zetten dit niet en vallen terug op --anak-color.)
      '--knob-anak': '#e5e7eb',
      '--indung-bg': '#ffffff',
      '--indung-color': '#cc0000',
      '--indung-text': '#cc0000',
    },
  },
  {
    // PUSAMADA — donker kendang-palet: donkergrijze regels, witte anak, rode indung.
    // Maat-/kwartstrepen blijven de donkere default (zichtbaar tegen donkergrijs).
    // (Notatie-fase. Chrome volgt later: donkere panelen + rode knop-glow zijn de
    //  geplande fase-2-uitbreiding; de knoppen blijven voorlopig modern.)
    id: 'pusamada',
    label: 'PUSAMADA',
    tokens: {
      '--anak-bg': '#242424',
      '--anak-color': '#ffffff',
      '--anak-text': '#ffffff',
      '--indung-bg': '#242424',
      '--indung-color': '#ef4444',
      '--indung-text': '#ef4444',
      // Chrome: paneel-/dialoog-/menu-bodies bijna zwart (donkerder dan de regels).
      '--panel-bg': 'linear-gradient(180deg, #1e1e1e 0%, #141414 100%)',
      // Chrome: headers donker met subtiele sheen; accent + glow rood.
      '--header-bg': 'linear-gradient(90deg, #171717 0%, #2a2a2a 50%, #171717 100%)',
      '--app-header-bg': 'linear-gradient(90deg, #141414 0%, #262626 50%, #141414 100%)',
      '--accent': '#ef4444',
      '--accent-rgb': '239, 68, 68',
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
