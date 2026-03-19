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

// Generates a complete 4-bar pattern entity (192 slots per track)
export const createEmptyPattern = (name = 'Song 1') => {
  return {
    id: crypto.randomUUID(),
    name,
    anak: generateEmptySlots(192),    // Top track
    indung: generateEmptySlots(192),  // Bottom track
    gong: [],                         // Array of slot indices (multiples of 6) where gong plays
    tempoTrack: []                    // Array of { slot, bpm } tempo nodes; empty = use global BPM
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
export const getHandForSymbol = (symbol) => {
  if (symbol === SYMBOL_REST) return 'both';
  // Rechterhand (Boven/Top)
  if (['A', 'J', ';', ':', 'L', 'G', 'F'].includes(symbol)) return 'top';
  // Linkerhand (Onder/Bottom)
  if (['C', '?', 'V', 'S', 'N'].includes(symbol)) return 'bottom';
  
  return 'top';
};

export const writeSymbolToPattern = (pattern, trackId, slotIndex, symbol) => {
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
