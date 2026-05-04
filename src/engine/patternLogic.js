/**
 * 48-Slot Matrix Math Engine
 * - 1 Beat (Tel) = 12 Slots
 * - 1 Bar (Maat) = 4 Beats = 48 Slots
 * - 1 Pattern (Regel) = 4 Bars = 192 Slots Total
 *
 * Slot value-formaat:
 *   ''         leeg
 *   '.'        rust (canonieke sentinel — NotationPack.restGlyph bepaalt de
 *              visuele weergave; toevallig ook '.' in de Sundanese pack)
 *   <soundId>  geluid uit de actieve InstrumentPack (bv. 'tung', 'dong')
 *
 * Tot stap 4 stond hier het **glyph** ('N', 'C', '?', …). Oude patternen worden
 * bij sanitizePattern automatisch gemigreerd naar soundId.
 */

export const SYMBOL_REST = '.';

// ----- Hand-toewijzing (per soundId, niet per glyph) -------------------------
// Rechterhand (top-line in de TrackRow)
export const TOP_HAND_SOUNDS    = ['pling', 'pang', 'ping', 'pong', 'plak', 'pak', 'peung'];
// Linkerhand (bottom-line)
export const BOTTOM_HAND_SOUNDS = ['tung', 'dong', 'ting', 'det', 'dededet'];

export const getHandForSound = (value) => {
  if (value === SYMBOL_REST) return 'both';
  // Sta legacy glyphs toe (auto-migratie tijdens transitie).
  const sound = LEGACY_GLYPH_TO_SOUND[value] || value;
  if (TOP_HAND_SOUNDS.includes(sound))    return 'top';
  if (BOTTOM_HAND_SOUNDS.includes(sound)) return 'bottom';
  return 'top';
};

// ----- Legacy migratie -------------------------------------------------------
// Mapping zoals die VOOR stap 4 in code zat (NeoDamina-glyphs → soundId).
// Wordt door sanitizePattern gebruikt om bestaande pattern-data automatisch
// te migreren naar het nieuwe soundId-formaat.
export const LEGACY_GLYPH_TO_SOUND = {
  'N': 'tung',
  'C': 'dong',
  '?': 'ting',
  'V': 'det',
  'S': 'dededet',
  'A': 'pling',
  'J': 'pang',
  ';': 'ping',
  ':': 'pong',
  'L': 'plak',
  'G': 'pak',
  'F': 'peung',
};

// Set van bekende soundIds (uit de huidige Sunda-pack — tegelijkertijd de
// canonieke set). Wordt gebruikt om bij migratie idempotentie te kunnen
// detecteren: als een waarde al een soundId is, niet dubbelmigreren.
const KNOWN_SOUND_IDS = new Set([
  ...TOP_HAND_SOUNDS,
  ...BOTTOM_HAND_SOUNDS,
]);

/** Migreer een slot-waarde naar het soundId-formaat. Idempotent. */
export const migrateSlotValue = (v) => {
  if (typeof v !== 'string' || v === '') return '';
  if (v === SYMBOL_REST) return SYMBOL_REST;
  if (KNOWN_SOUND_IDS.has(v)) return v;
  if (LEGACY_GLYPH_TO_SOUND[v]) return LEGACY_GLYPH_TO_SOUND[v];
  // Onbekende waarde — laten staan zodat onbekende packs / toekomstige
  // soundIds niet stilletjes verloren gaan.
  return v;
};

/** Migreer een array van slot-objecten naar soundIds. Idempotent. */
export const migrateSlotArray = (arr) => {
  if (!Array.isArray(arr)) return arr;
  return arr.map(s => ({
    ...s,
    top:    migrateSlotValue(typeof s?.top    === 'string' ? s.top    : ''),
    bottom: migrateSlotValue(typeof s?.bottom === 'string' ? s.bottom : ''),
  }));
};

// ----- Glyph-rendering (NotationPack-aware) ----------------------------------
/**
 * Vertaal een slot-waarde naar het glyph dat in de actieve NotationPack hoort.
 *   '' / '.'   → onveranderd doorgegeven (rest = '.', leeg = '').
 *   soundId    → notationPack.soundToGlyph[soundId]
 *   onbekend   → letterlijke waarde (graceful fallback voor mixed data).
 */
export const glyphFor = (value, notationPack) => {
  if (!value) return '';
  if (value === SYMBOL_REST) return notationPack?.restGlyph || SYMBOL_REST;
  const mapped = notationPack?.soundToGlyph?.[value];
  if (mapped) return mapped;
  return value;
};

// ----- Pattern factory -------------------------------------------------------

// Returns an array of exactly length `count` where only quarter notes (every 12th slot) get a rest symbol
export const generateEmptySlots = (count) => {
  return Array.from({ length: count }, (_, i) => {
    return {
      top:    (i % 12 === 0) ? SYMBOL_REST : '',
      bottom: (i % 12 === 0) ? SYMBOL_REST : '',
      accentTop: false,
      accentBottom: false,
    };
  });
};

/** Rounds a slot index down to the nearest beat boundary (every 12 slots). */
export const slotToBeat = (slot) => Math.floor(slot / 12) * 12;

/** Deduplicates a gong array by beat: multiple entries in the same beat → one entry. */
export const deduplicateGongByBeat = (gong) => [...new Set(gong.map(slotToBeat))];

// Generates a complete 4-bar pattern entity (192 slots per track)
export const createEmptyPattern = (name = 'Song 1') => {
  return {
    id: crypto.randomUUID(),
    name,
    anak: generateEmptySlots(192),    // Top track
    indung: generateEmptySlots(192),  // Bottom track
    gong: [],                         // Array of slot indices (multiples of 6) where gong plays
    tempoTrack: [],                   // Array of { slot, bpm } tempo nodes; empty = use global BPM
    tempoTrackEnabled: false,         // When false, automation data is kept but global BPM is used
    annotations: {},                  // { measureIndex: "text" } — per-measure annotations
  };
};

// Velden die op een pattern bestaan maar GEEN track-data zijn. Alle overige
// array-velden behandelen we generiek als tracks — zo werkt elk instrument-pack
// (anak/indung, lanang/wadon, …) drop-in.
const PATTERN_META_KEYS = new Set(['id', 'name', 'gong', 'tempoTrack', 'tempoTrackEnabled', 'annotations']);

/**
 * Sanity-check a pattern loaded from localStorage / Supabase / external source.
 * Migrates legacy glyph values to soundIds (via migrateSlotValue). Track-velden
 * worden generiek gedetecteerd: elk array-veld dat geen meta-veld is, geldt als
 * track.
 *
 * Track-lengte: respecteert de bestaande lengte van het patroon zodat
 * verwijderde maten verwijderd blijven na een save/load round-trip. We ronden
 * af op een veelvoud van 48 (één maat) en alle tracks krijgen dezelfde lengte.
 * Een lege/ontbrekende pattern krijgt de default van 192 slots (4 maten).
 */
export const sanitizePattern = (pattern) => {
  const MEASURE = 48;
  const DEFAULT_SLOTS = 192;

  // Bepaal de gewenste lengte uit de bestaande track-arrays.
  let maxLen = 0;
  for (const [key, value] of Object.entries(pattern ?? {})) {
    if (PATTERN_META_KEYS.has(key)) continue;
    if (Array.isArray(value) && value.length > maxLen) maxLen = value.length;
  }
  const targetLen = maxLen > 0 ? Math.ceil(maxLen / MEASURE) * MEASURE : DEFAULT_SLOTS;

  const sanitizeTrack = (track) => {
    if (!Array.isArray(track) || track.length === 0) return generateEmptySlots(targetLen);
    const safe = track.slice(0, targetLen).map(s => ({
      top:    migrateSlotValue(typeof s?.top    === 'string' ? s.top    : ''),
      bottom: migrateSlotValue(typeof s?.bottom === 'string' ? s.bottom : ''),
      accentTop:    s?.accentTop    === true,
      accentBottom: s?.accentBottom === true,
    }));
    while (safe.length < targetLen) safe.push({ top: '', bottom: '', accentTop: false, accentBottom: false });
    return safe;
  };

  const out = {
    id:         typeof pattern?.id   === 'string' ? pattern.id   : crypto.randomUUID(),
    name:       typeof pattern?.name === 'string' ? pattern.name : 'Pattern',
    gong:       Array.isArray(pattern?.gong)       ? pattern.gong.filter(n => typeof n === 'number' && n >= 0 && n < targetLen) : [],
    tempoTrack: Array.isArray(pattern?.tempoTrack) ? pattern.tempoTrack.filter(n => typeof n?.slot !== 'number' || n.slot < targetLen) : [],
    tempoTrackEnabled: pattern?.tempoTrackEnabled === true,
    annotations: (pattern?.annotations && typeof pattern.annotations === 'object') ? pattern.annotations : {},
  };

  for (const [key, value] of Object.entries(pattern ?? {})) {
    if (PATTERN_META_KEYS.has(key)) continue;
    if (Array.isArray(value)) {
      out[key] = sanitizeTrack(value);
    } else if (out[key] === undefined) {
      out[key] = value;
    }
  }
  return out;
};

/**
 * Toggle accent on every note within [startSlot..endSlot] on the given track.
 * If any note in the range is un-accented → accent all notes; otherwise remove all accents.
 */
export const toggleAccentInRange = (pattern, trackId, startSlot, endSlot) => {
  const track = pattern?.[trackId];
  if (!Array.isArray(track)) return pattern;
  const from = Math.max(0, Math.min(startSlot, endSlot));
  const to   = Math.min(track.length - 1, Math.max(startSlot, endSlot));

  let anyUnaccented = false;
  for (let i = from; i <= to; i++) {
    const s = track[i];
    if (!s) continue;
    const topIsNote    = s.top    !== '' && s.top    !== SYMBOL_REST;
    const bottomIsNote = s.bottom !== '' && s.bottom !== SYMBOL_REST;
    if ((topIsNote && !s.accentTop) || (bottomIsNote && !s.accentBottom)) {
      anyUnaccented = true;
      break;
    }
  }
  const target = anyUnaccented;

  const newTrack = track.map((s, i) => {
    if (i < from || i > to) return s;
    const topIsNote    = s.top    !== '' && s.top    !== SYMBOL_REST;
    const bottomIsNote = s.bottom !== '' && s.bottom !== SYMBOL_REST;
    return {
      ...s,
      accentTop:    topIsNote    ? target : false,
      accentBottom: bottomIsNote ? target : false,
    };
  });
  return { ...pattern, [trackId]: newTrack };
};

/**
 * Schrijf een waarde (soundId of '.') in een slot. Hand-toewijzing volgt de
 * actieve mapping in TOP_HAND_SOUNDS / BOTTOM_HAND_SOUNDS.
 */
export const writeSymbolToPattern = (pattern, trackId, slotIndex, value) => {
  const track = pattern?.[trackId];
  if (!Array.isArray(track) || slotIndex < 0 || slotIndex >= track.length) return pattern;
  const newPattern = JSON.parse(JSON.stringify(pattern));
  const hand = getHandForSound(value);
  if (hand === 'both') {
     newPattern[trackId][slotIndex].top    = value;
     newPattern[trackId][slotIndex].bottom = value;
  } else {
     newPattern[trackId][slotIndex][hand] = value;
  }
  return newPattern;
};

