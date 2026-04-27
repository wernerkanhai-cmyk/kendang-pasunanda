/**
 * notationFont — installeert het @font-face van een NotationPack runtime,
 * en houdt één actieve injection bij. Bij wisselen wordt de vorige verwijderd.
 *
 * Alle NotationPacks declareren bewust dezelfde font-family ('Kendang') zodat
 * bestaande CSS-regels (DrumPad, TrackRow) drop-in blijven werken — alleen het
 * font-bestand verandert.
 */

import { packRegistry } from './PackRegistry.js';

let _activeStyleId = null;
let _activeNotationId = null;

export const loadNotationFont = (notationPack) => {
  if (!notationPack || !notationPack.font?.url || !notationPack.font?.family) return;
  if (_activeNotationId === notationPack.id) return; // al actief

  // Verwijder de vorige injection
  if (_activeStyleId) {
    const existing = document.getElementById(_activeStyleId);
    if (existing) existing.remove();
  }

  const id = `notation-font-${notationPack.id}`;
  const fontUrl = packRegistry.resolveUrl(notationPack.font.url);
  const format = notationPack.font.format || 'truetype';
  const family = notationPack.font.family;

  const style = document.createElement('style');
  style.id = id;
  style.textContent =
    `@font-face {\n` +
    `  font-family: '${family}';\n` +
    `  src: url('${fontUrl}') format('${format}');\n` +
    `  font-display: swap;\n` +
    `}\n`;
  document.head.appendChild(style);

  _activeStyleId = id;
  _activeNotationId = notationPack.id;
};

export const getActiveNotationId = () => _activeNotationId;
