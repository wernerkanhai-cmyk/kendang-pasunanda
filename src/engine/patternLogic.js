/**
 * 48-Slot Matrix Math Engine
 * - 1 Beat (Tel) = 12 Slots
 * - 1 Bar (Maat) = 4 Beats = 48 Slots
 * - 1 Pattern (Regel) = 4 Bars = 192 Slots Total
 */

// A REST is represented by a '.' in NeoDamina.ttf, and is silent in the Audio context.
// However, the symbol is literally drawn in Red/Black depending on its track.
export const SYMBOL_REST = '.';

// Returns an array of exactly length `count` where only quarter notes (every 12th slot) get a rest symbol
export const generateEmptySlots = (count) => {
  return Array.from({ length: count }, (_, i) => {
    // 12 slots per quarter note. Place a '.' on the downbeat on BOTH lines.
    return {
      top: (i % 12 === 0) ? SYMBOL_REST : '',
      bottom: (i % 12 === 0) ? SYMBOL_REST : ''
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
    tempoTrackEnabled: false          // When false, automation data is kept but global BPM is used
  };
};

/**
 * Inserts a Note symbol into the sequence at a specific slot.
 * Ensures that if a user places a long note, we might theoretically overwrite 
 * adjacent slots, but for now every single slot of the 48 can independently 
 * hold a symbol. The phrasing and triplets are handled by the renderer.
 * 
 * @param {Object} pattern - The pattern object to modify
 * @param {string} trackId - 'anak' or 'indung'
 * @param {number} slotIndex - 0 to 191
 * @param {string} symbol - The Kendang.ttf character (e.g. 'P', 'D', '.')
 */
// Rechterhand (Boven/Top) — single source of truth for all symbol routing
export const TOP_HAND_SYMBOLS    = ['A', 'J', ';', ':', 'L', 'G', 'F'];
// Linkerhand (Onder/Bottom)
export const BOTTOM_HAND_SYMBOLS = ['C', '?', 'V', 'S', 'N'];

export const getHandForSymbol = (symbol) => {
  if (symbol === SYMBOL_REST) return 'both';
  if (TOP_HAND_SYMBOLS.includes(symbol))    return 'top';
  if (BOTTOM_HAND_SYMBOLS.includes(symbol)) return 'bottom';
  return 'top';
};

/**
 * Sanity-check a pattern loaded from localStorage or external source.
 * Truncates to 192 slots, ensures slot shape { top, bottom }, fills missing slots.
 */
export const sanitizePattern = (pattern) => {
  const SLOTS = 192;
  const sanitizeTrack = (track) => {
    if (!Array.isArray(track) || track.length === 0) return generateEmptySlots(SLOTS);
    const safe = track.slice(0, SLOTS).map(s => ({
      top:    typeof s?.top    === 'string' ? s.top    : '',
      bottom: typeof s?.bottom === 'string' ? s.bottom : '',
    }));
    // Pad to full length if shorter than expected
    while (safe.length < SLOTS) safe.push({ top: '', bottom: '' });
    return safe;
  };
  return {
    ...pattern,
    id:         typeof pattern?.id   === 'string' ? pattern.id   : crypto.randomUUID(),
    name:       typeof pattern?.name === 'string' ? pattern.name : 'Pattern',
    anak:       sanitizeTrack(pattern?.anak),
    indung:     sanitizeTrack(pattern?.indung),
    gong:       Array.isArray(pattern?.gong)       ? pattern.gong.filter(n => typeof n === 'number' && n >= 0) : [],
    tempoTrack: Array.isArray(pattern?.tempoTrack) ? pattern.tempoTrack : [],
    tempoTrackEnabled: pattern?.tempoTrackEnabled === true,  // default false for existing data
  };
};

export const writeSymbolToPattern = (pattern, trackId, slotIndex, symbol) => {
  const track = pattern?.[trackId];
  if (!Array.isArray(track) || slotIndex < 0 || slotIndex >= track.length) return pattern;
  const newPattern = JSON.parse(JSON.stringify(pattern));
  const hand = getHandForSymbol(symbol);
  if (hand === 'both') {
     newPattern[trackId][slotIndex].top = symbol;
     newPattern[trackId][slotIndex].bottom = symbol;
  } else {
     newPattern[trackId][slotIndex][hand] = symbol;
  }
  return newPattern;
};
