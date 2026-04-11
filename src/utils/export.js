import { jsPDF } from 'jspdf';
import { deduplicateGongByBeat } from '../engine/patternLogic';

// ─── Page geometry ─────────────────────────────────────────────────────────────
// A4 portrait at ~210 dpi gives a crisp result while keeping file size sane.
const CW = 1754; // canvas width  (px) — A4 short side at 210 dpi
const CH = 2480; // canvas height (px) — A4 long side at 210 dpi
const MARGIN_X = 60;
const MARGIN_Y = 80;
const USABLE_W = CW - 2 * MARGIN_X; // 1634 px
const USABLE_H = CH - 2 * MARGIN_Y; // 2320 px

// ─── Row layout ────────────────────────────────────────────────────────────────
const ROWS_PER_PAGE  = 4;
const TITLE_BLOCK_H  = 120; // reserved height for song title on first page
const ROW_SLOT_H     = Math.floor(USABLE_H / ROWS_PER_PAGE); // 408 px per row slot

const NAME_H        = 28;  // pattern-name label height
const TRACK_H       = 115; // height of each track band (anak or indung)
const SEPARATOR_H   = 32;  // gap between anak and indung bands
// Gap between bottom of music area and next row name:  ROW_SLOT_H - NAME_H - (TRACK_H*2+SEPARATOR_H) = 60 px

// ─── Typography ────────────────────────────────────────────────────────────────
const SYM_SIZE      = 22; // regular symbol font size (px)
const REST_SIZE     = 26; // rest / empty-dot font size (px)
const MAAT_NUM_SIZE = 16;
const NAME_SIZE     = 17;

// ─── Music constants ───────────────────────────────────────────────────────────
const BARS_PER_ROW    = 4;
const SLOTS_PER_BAR   = 48;
const SLOTS_PER_ROW   = BARS_PER_ROW * SLOTS_PER_BAR; // 192
const SLOT_W          = USABLE_W / SLOTS_PER_ROW;      // ~12.1 px

// ─── Helpers ───────────────────────────────────────────────────────────────────

const TRIPLET_OFFSETS  = new Set([0, 4, 8]);
const TRIPLET_16T_OFFS = new Set([0, 2, 4]);

// Returns beam descriptors: { startIdx, span, level, position }
// Synced with TrackRow.jsx beam logic
function calculateBeams(slots) {
  const SYMBOL_REST = '.';
  const results = [];

  // Detect 16T half-beat triplets per hand to suppress beams across both halves
  const has16T = (beatStart, hand) => {
    const check = (offset) => {
      const notes = [];
      for (let i = 0; i < 6; i++) {
        const s = slots[beatStart + offset + i];
        if (!s) continue;
        const v = hand === 'top' ? s.top : s.bottom;
        if (v !== '' && v !== SYMBOL_REST) notes.push(i);
      }
      if (notes.length < 2) return false; // need at least 2 notes for a 16T triplet
      if (!notes.every(n => TRIPLET_16T_OFFS.has(n))) return false;
      return notes.some(n => n === 2 || n === 4);
    };
    return check(0) && check(6);
  };

  for (const position of ['top', 'bottom']) {
    for (let beatStart = 0; beatStart < slots.length; beatStart += 12) {
      const activeIndices = [];
      for (let i = 0; i < 12; i++) {
        const s = slots[beatStart + i];
        if (!s) continue;
        const val = position === 'top' ? s.top : s.bottom;
        if (val !== '' && val !== SYMBOL_REST) activeIndices.push(i);
      }

      if (activeIndices.length === 0) continue;
      // Triplet beats: render a single level-1 beam spanning the group, but no level-2.
      const is8T = activeIndices.every(n => TRIPLET_OFFSETS.has(n)) && activeIndices.some(n => n === 4 || n === 8);
      const is16T = has16T(beatStart, position);
      if (is8T || is16T) {
        // Beam spans the full triplet grid (0–8 for 8T, 0–4 for 16T),
        // including rest positions — they are part of the group.
        const tripletEnd = is8T ? 9 : 4;
        results.push({ startIdx: beatStart, span: tripletEnd + 1, level: 1, position });
        continue;
      }

      const firstNote = activeIndices[0];
      const lastNote  = activeIndices[activeIndices.length - 1];

      // Extend beam back to beat start when pos 0 has a data rest
      const beatStartVal = position === 'top' ? slots[beatStart]?.top : slots[beatStart]?.bottom;
      const hasBeatStartRest = beatStartVal === SYMBOL_REST;
      const l1Start = (hasBeatStartRest && firstNote > 0) ? 0 : firstNote;

      // Extend l1 1 slot if 2nd half has only one note; align with rightmost l2 endpoint.
      const secondHalfNotes = activeIndices.filter(i => i >= 6);
      let l1End = (secondHalfNotes.length === 1) ? Math.min(lastNote + 1, 11) : lastNote;
      const sixteenthsForL1 = activeIndices.filter(i => i % 6 !== 0);
      if (sixteenthsForL1.length > 0) {
        const maxBlock = Math.max(...sixteenthsForL1.map(i => Math.floor(i / 6)));
        const l2RightSlot = maxBlock * 6 + 4;
        if (l2RightSlot > l1End) l1End = Math.min(l2RightSlot, 11);
      }
      const l1Span = l1End - l1Start;
      if (l1Span > 0) {
        results.push({ startIdx: beatStart + l1Start, span: l1Span, level: 1, position });
      }

      // Level 2: only the 8th-block(s) actually containing a 16th note, span=4
      if (sixteenthsForL1.length > 0 && l1Span > 0) {
        const blocks = new Set(sixteenthsForL1.map(i => Math.floor(i / 6)));
        blocks.forEach(blockIdx => {
          results.push({ startIdx: beatStart + blockIdx * 6, span: 4, level: 2, position });
        });
      }
    }
  }
  return results;
}

// Returns triplet arc descriptors: { start, hand, type }
// Synced with TrackRow.jsx handTriplets logic
function calculateTripletArcs(slots) {
  const SYMBOL_REST = '.';
  const results = [];

  // 16T (6-slot half-beat groups)
  for (let groupStart = 0; groupStart < slots.length; groupStart += 6) {
    for (const hand of ['top', 'bottom']) {
      const notes = [];
      for (let i = 0; i < 6; i++) {
        const s = slots[groupStart + i];
        if (!s) continue;
        const v = s[hand];
        if (v !== '' && v !== SYMBOL_REST) notes.push(i);
      }
      if (notes.length < 2) continue; // need at least 2 notes for a 16T triplet
      if (!notes.every(n => TRIPLET_16T_OFFS.has(n))) continue;
      if (!notes.some(n => n === 2 || n === 4)) continue;
      results.push({ start: groupStart, hand, type: '16T' });
    }
  }

  // 8T (12-slot beat groups), skip if both halves already 16T
  for (let beatStart = 0; beatStart < slots.length; beatStart += 12) {
    for (const hand of ['top', 'bottom']) {
      const notes = [];
      for (let i = 0; i < 12; i++) {
        const s = slots[beatStart + i];
        if (!s) continue;
        const v = s[hand];
        if (v !== '' && v !== SYMBOL_REST) notes.push(i);
      }
      if (notes.length === 0) continue;
      if (!notes.every(n => TRIPLET_OFFSETS.has(n))) continue;
      if (!notes.some(n => n === 4 || n === 8)) continue;
      const both16T = results.some(r => r.type === '16T' && r.start === beatStart && r.hand === hand)
                   && results.some(r => r.type === '16T' && r.start === beatStart + 6 && r.hand === hand);
      if (both16T) continue;
      results.push({ start: beatStart, hand, type: '8T' });
    }
  }
  return results;
}

// Draw one 4-bar row for a single pattern (or a 4-bar chunk of a longer pattern)
function drawRow(ctx, slots_anak, slots_indung, gong, patternName, showName, rowX, rowY, measureOffset, cfg = DEFAULT_PDF_SETTINGS) {
  const trackY_anak   = rowY + NAME_H;
  const nullY_anak    = trackY_anak + Math.floor(TRACK_H / 2);
  const trackY_indung = trackY_anak + TRACK_H + SEPARATOR_H;
  const nullY_indung  = trackY_indung + Math.floor(TRACK_H / 2);

  // ── 1. Pattern name ──────────────────────────────────────────────────────────
  if (showName) {
    ctx.fillStyle = '#1e293b';
    ctx.font = `bold ${NAME_SIZE}px Inter, sans-serif`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(patternName, rowX, rowY + 1);
  }

  // ── 2. Track backgrounds ─────────────────────────────────────────────────────
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(rowX, trackY_anak,   USABLE_W, TRACK_H);
  ctx.fillRect(rowX, trackY_indung, USABLE_W, TRACK_H);

  // 4px white gap between anak and indung (no separator line)

  // ── 3. Null / staff lines (anak=black, indung=red) ───────────────────────────
  ctx.lineWidth = 1.5;

  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.moveTo(rowX, nullY_anak);
  ctx.lineTo(rowX + USABLE_W, nullY_anak);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(204,0,0,0.35)';
  ctx.beginPath();
  ctx.moveTo(rowX, nullY_indung);
  ctx.lineTo(rowX + USABLE_W, nullY_indung);
  ctx.stroke();

  // ── 4. Bar lines + measure numbers ───────────────────────────────────────────
  ctx.lineWidth = 2;
  for (let bar = 0; bar <= BARS_PER_ROW; bar++) {
    const x = rowX + bar * SLOTS_PER_BAR * SLOT_W;

    ctx.strokeStyle = '#000000';
    ctx.beginPath();
    ctx.moveTo(x, trackY_anak);
    ctx.lineTo(x, trackY_anak + TRACK_H);
    ctx.stroke();

    ctx.strokeStyle = '#cc0000';
    ctx.beginPath();
    ctx.moveTo(x, trackY_indung);
    ctx.lineTo(x, trackY_indung + TRACK_H);
    ctx.stroke();

    if (bar < BARS_PER_ROW) {
      ctx.fillStyle = '#475569';
      ctx.font = `${MAAT_NUM_SIZE}px Inter, sans-serif`;
      ctx.textBaseline = 'bottom';
      ctx.fillText(String(bar + 1 + measureOffset), x + 5, trackY_anak - 3);
    }
  }

  // ── 5. Helper: draw symbols + beams + triplet arcs for one track ─────────────
  // symTop / symBottom: distance in px from nullY to symbol baseline (positive = away from line)
  function drawTrack(slots, nullY, baseColor, symTop, symBot, topBeamShift = 0) {
    const SYMBOL_REST = '.';
    const BARS_LOCAL  = BARS_PER_ROW;
    const BAR_SLOTS   = SLOTS_PER_BAR;

    // Per-bar: last real note index (for trailing silence detection)
    const lastNoteInBar = [];
    for (let b = 0; b < BARS_LOCAL; b++) {
      let last = -1;
      for (let i = BAR_SLOTS - 1; i >= 0; i--) {
        const s = slots[b * BAR_SLOTS + i];
        if (!s) continue;
        if ((s.top !== '' && s.top !== SYMBOL_REST) || (s.bottom !== '' && s.bottom !== SYMBOL_REST)) {
          last = i; break;
        }
      }
      lastNoteInBar.push(last);
    }

    // ── Beams ────────────────────────────────────────────────────────────────
    const beams = calculateBeams(slots);
    ctx.lineWidth = 1;
    for (const beam of beams) {
      const beamNudge = (beam.startIdx % 12 === 0) ? SLOT_W * 0.5 : 0;
      const bx = rowX + beam.startIdx * SLOT_W + beamNudge;
      const bw = (beam.span + 1) * SLOT_W - beamNudge;
      const by = nullY + (beam.position === 'top'
        ? (beam.level === 1 ? cfg.beamTop1    : cfg.beamTop2) - topBeamShift
        : (beam.level === 1 ? cfg.beamBottom1 : cfg.beamBottom2));
      ctx.strokeStyle = baseColor;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + bw, by);
      ctx.stroke();
    }


    // ── Pre-compute: per beat, per hand, count real symbols and find the lone one ──
    // If a hand has exactly 1 symbol in a beat, center it (same x as quarter-rest dot).
    // Exception: if the OTHER hand has 2+ symbols (a beam), align the lone symbol
    // with the first symbol of that beam instead of centering — keeps vertical alignment.
    const noteCount = {}; // key: `${beatStart}-${hand}` → number of real symbols
    const loneSymbol = {}; // key: `${beatStart}-${hand}` → slot index, or null
    for (let beatStart = 0; beatStart < SLOTS_PER_ROW; beatStart += 12) {
      for (const hand of ['top', 'bottom']) {
        const indices = [];
        for (let j = 0; j < 12; j++) {
          const s = slots[beatStart + j];
          if (s && s[hand] !== '' && s[hand] !== SYMBOL_REST) indices.push(beatStart + j);
        }
        noteCount[`${beatStart}-${hand}`] = indices.length;
        loneSymbol[`${beatStart}-${hand}`] = indices.length === 1 ? indices[0] : null;
      }
    }
    // Build a set of beats that have a beam per hand (from the pre-calculated beams).
    // A beam means the hand has a visible rhythmic structure (even if only 1 real note
    // plus a rest-dot) — so the other hand's lone symbol should align with it, not center.
    const hasBeam = new Set();
    for (const beam of beams) {
      const beatStart = Math.floor(beam.startIdx / 12) * 12;
      hasBeam.add(`${beatStart}-${beam.position}`);
    }
    // Second pass: don't center a lone symbol if:
    //   - its OWN hand has a beam (rest+note pattern → note should stay at its slot)
    //   - the OTHER hand has a beam or 2+ notes (vertical alignment with beam start)
    for (let beatStart = 0; beatStart < SLOTS_PER_ROW; beatStart += 12) {
      const topLone = loneSymbol[`${beatStart}-top`] !== null;
      const botLone = loneSymbol[`${beatStart}-bottom`] !== null;
      const topHasBeam = hasBeam.has(`${beatStart}-top`) || noteCount[`${beatStart}-top`] >= 2;
      const botHasBeam = hasBeam.has(`${beatStart}-bottom`) || noteCount[`${beatStart}-bottom`] >= 2;
      // Own hand has a beam → the note is part of a rhythmic figure, keep it in place
      if (topLone && topHasBeam) loneSymbol[`${beatStart}-top`] = null;
      if (botLone && botHasBeam) loneSymbol[`${beatStart}-bottom`] = null;
      // Other hand has a beam → align with beam start, not center
      if (topLone && botHasBeam) loneSymbol[`${beatStart}-top`] = null;
      if (botLone && topHasBeam) loneSymbol[`${beatStart}-bottom`] = null;
    }

    // ── Real symbols (data rests skipped — rendered separately below) ─────────
    ctx.font = `${SYM_SIZE}px Kendang, monospace`;
    ctx.fillStyle = baseColor;
    for (let i = 0; i < SLOTS_PER_ROW; i++) {
      const slot = slots[i];
      if (!slot) continue;
      const beatStart = Math.floor(i / 12) * 12;

      for (const hand of ['top', 'bottom']) {
        const sym = slot[hand];
        if (sym === '' || sym === SYMBOL_REST) continue;

        let x;
        if (loneSymbol[`${beatStart}-${hand}`] === i) {
          // Single symbol in beat → center at beat midpoint (same as quarter-rest dot)
          x = rowX + beatStart * SLOT_W + 6 * SLOT_W;
        } else {
          // Multiple symbols → position with graduated nudge.
          // Slot 0 gets the largest nudge to breathe from the bar line,
          // slots 3 and 6 get proportionally less so all three 16th-note
          // positions in the first half of the beat stay evenly spaced.
          const localSlot = i % 12;
          const nudge = localSlot === 0 ? SLOT_W * 0.5
                      : localSlot === 3 ? SLOT_W * 0.33
                      : localSlot === 6 ? SLOT_W * 0.17
                      : 0;
          x = rowX + i * SLOT_W + 2 + nudge;
        }

        ctx.globalAlpha  = 1.0;
        ctx.textBaseline = hand === 'top' ? 'bottom' : 'top';
        ctx.fillText(sym, x, hand === 'top' ? nullY - symTop : nullY + symBot);
      }
      ctx.globalAlpha = 1.0;
    }

    // ── Rest dots: quarter rests + implied rests (same rules as screen) ───────
    ctx.font      = `${SYM_SIZE}px Kendang, monospace`;
    ctx.fillStyle = baseColor;
    ctx.textAlign = 'center';
    const dotY    = { top: nullY - symTop, bottom: nullY + symBot };
    const dotBase = { top: 'bottom',       bottom: 'top' };

    for (let barIdx = 0; barIdx < BARS_LOCAL; barIdx++) {
      const barStart = barIdx * BAR_SLOTS;
      const lastNote = lastNoteInBar[barIdx];

      if (lastNote < 0) continue;
      for (let beatOff = 0; beatOff < BAR_SLOTS; beatOff += 12) {
        const beatStart = barStart + beatOff;
        const slot0 = slots[beatStart];
        const slot6 = slots[beatStart + 6];
        const slot9 = slots[beatStart + 9];

        for (const hand of ['top', 'bottom']) {
          const beatHasNoteForHand = slots.slice(beatStart, beatStart + 12).some(s =>
            s && s[hand] !== '' && s[hand] !== SYMBOL_REST
          );

          ctx.textBaseline = dotBase[hand];
          ctx.globalAlpha  = 1.0;

          if (!beatHasNoteForHand) {
            // Quarter-rest: center in the beat, unless the other hand has a beam —
            // in that case align with the beam start (slot 0 + nudge).
            const other = hand === 'top' ? 'bottom' : 'top';
            const otherHasBeam = hasBeam.has(`${beatStart}-${other}`) || noteCount[`${beatStart}-${other}`] >= 2;
            if (otherHasBeam) {
              ctx.fillText('.', rowX + beatStart * SLOT_W + SLOT_W, dotY[hand]);
            } else {
              ctx.fillText('.', rowX + beatStart * SLOT_W + 6 * SLOT_W, dotY[hand]);
            }
          } else {
            if (slot0 && (slot0[hand] === '' || slot0[hand] === SYMBOL_REST)) {
              // 8th-rest dot at slot 0: if this hand has a beam, use the nudged
              // position; if the other hand has a centered lone symbol, center too.
              const other = hand === 'top' ? 'bottom' : 'top';
              const otherLone = loneSymbol[`${beatStart}-${other}`] !== null;
              const thisHandBeam = hasBeam.has(`${beatStart}-${hand}`);
              if (!thisHandBeam && otherLone) {
                // Align with the other hand's centered symbol
                ctx.fillText('.', rowX + beatStart * SLOT_W + 6 * SLOT_W, dotY[hand]);
              } else {
                ctx.fillText('.', rowX + beatStart * SLOT_W + SLOT_W, dotY[hand]);
              }
            }
            if (slot6 && slot9 &&
                (slot6[hand] === '' || slot6[hand] === SYMBOL_REST) &&
                 slot9[hand] !== '' && slot9[hand] !== SYMBOL_REST) {
              // Place the implied-rest dot at the start of the 2nd 8th-block
              // so there is clear space before the note on slot 9.
              ctx.fillText('.', rowX + (beatStart + 6) * SLOT_W, dotY[hand]);
            }
          }
        }
      }
    }

    ctx.globalAlpha = 1.0;
    ctx.textAlign   = 'left';
  }

  // Per-track symbol offsets — mirrored from TrackRow.css
  // anak:   top=12px above nullY,  bottom uses default
  // indung: top=16px above nullY,  bottom=9px below nullY
  drawTrack(slots_anak,   nullY_anak,   '#000000', cfg.symAboveAnak,   cfg.symBelowAnak,   5);
  drawTrack(slots_indung, nullY_indung, '#cc0000', cfg.symAboveIndung, cfg.symBelowIndung, 7);

  // ── 6. Gong boxes (transparent rect + center line, anak=black, indung=red) ───
  const deduplicatedGong = deduplicateGongByBeat(gong || []);
  for (const beatStart of deduplicatedGong) {
    if (beatStart < 0 || beatStart >= SLOTS_PER_ROW) continue;
    const gx = rowX + beatStart * SLOT_W;
    const gw = 12 * SLOT_W;

    // Anak box
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 3;
    ctx.strokeRect(gx, trackY_anak, gw, TRACK_H);
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(gx, nullY_anak);
    ctx.lineTo(gx + gw, nullY_anak);
    ctx.stroke();

    // Indung box
    ctx.strokeStyle = 'rgba(204,0,0,0.8)';
    ctx.lineWidth = 3;
    ctx.strokeRect(gx, trackY_indung, gw, TRACK_H);
    ctx.strokeStyle = 'rgba(204,0,0,0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(gx, nullY_indung);
    ctx.lineTo(gx + gw, nullY_indung);
    ctx.stroke();
  }
}

// ─── Default PDF layout settings (overridable via settings param) ──────────────
export const DEFAULT_PDF_SETTINGS = {
  beamTop1:    -46,  // beam level 1 above null line
  beamTop2:    -40,  // beam level 2 above null line
  beamBottom1:  12,  // beam level 1 below null line
  beamBottom2:  18,  // beam level 2 below null line
  // Per-track symbol offsets (px from null line) — mirrored from TrackRow.css
  symAboveAnak:   12,  // anak top symbols (.theme-anak .pos-above: margin-bottom: 12px)
  symBelowAnak:    5,  // anak bottom symbols (default)
  symAboveIndung: 11,  // indung top symbols — shifted 5px down vs CSS for visual alignment
  symBelowIndung:  9,  // indung bottom symbols (.theme-indung .pos-below: margin-top: 9px)
  // Legacy keys kept for backwards compat with any stored settings
  symAbove:      6,
  symBelow:      5,
  dotTopOffset:    -18,
  dotBottomOffset:  -5,
};

// ─── Main export function ──────────────────────────────────────────────────────
export const exportSequencerToPDF = async (song, songTitle = '', settings = {}) => {
  if (!song || song.length === 0) {
    throw new Error('PDF-export mislukt: geen patronen beschikbaar.');
  }

  const cfg = { ...DEFAULT_PDF_SETTINGS, ...settings };

  // Open preview window NOW — must be synchronous (before any await) to avoid popup blockers
  const previewWindow = window.open('', '_blank');
  if (previewWindow) {
    previewWindow.document.write(
      '<html><head><title>PDF wordt gegenereerd…</title></head>' +
      '<body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#475569">' +
      '<p>PDF wordt gegenereerd…</p></body></html>'
    );
  }

  // Ensure the Kendang font is available in the canvas context
  await document.fonts.load(`${SYM_SIZE}px Kendang`);

  // Flatten all patterns into a list of 4-bar rows
  const rows = [];
  let measureOffset = 0;

  for (const pattern of song) {
    const totalSlots = pattern.anak.length;
    const totalBars  = Math.ceil(totalSlots / SLOTS_PER_BAR);
    const chunks     = Math.ceil(totalBars / BARS_PER_ROW);

    for (let chunk = 0; chunk < chunks; chunk++) {
      const slotStart = chunk * SLOTS_PER_ROW;
      const localGong = (pattern.gong || [])
        .filter(b => b >= slotStart && b < slotStart + SLOTS_PER_ROW)
        .map(b => b - slotStart);
      rows.push({
        name:          pattern.name,
        showName:      chunk === 0,
        anak:          pattern.anak.slice(slotStart, slotStart + SLOTS_PER_ROW),
        indung:        pattern.indung.slice(slotStart, slotStart + SLOTS_PER_ROW),
        gong:          localGong,
        measureOffset: measureOffset + chunk * BARS_PER_ROW,
      });
    }

    measureOffset += totalBars;
  }

  // Render pages
  const canvas = document.createElement('canvas');
  canvas.width  = CW;
  canvas.height = CH;
  const ctx = canvas.getContext('2d');

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = pdf.internal.pageSize.getHeight();

  const totalPages = Math.ceil(rows.length / ROWS_PER_PAGE);
  let isFirstPage = true;

  for (let pageStart = 0; pageStart < rows.length; pageStart += ROWS_PER_PAGE) {
    const pageNum = pageStart / ROWS_PER_PAGE + 1;
    if (!isFirstPage) pdf.addPage();

    // White page background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CW, CH);

    // Song title on first page, centered
    const titleOffset = isFirstPage && songTitle ? TITLE_BLOCK_H : 0;
    if (isFirstPage && songTitle) {
      ctx.fillStyle = '#1e293b';
      ctx.font = `bold 42px Inter, sans-serif`;
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'center';
      ctx.fillText(songTitle, CW / 2, MARGIN_Y + 56);
      ctx.textAlign = 'left';
    }

    const pageRows = rows.slice(pageStart, pageStart + ROWS_PER_PAGE);
    pageRows.forEach((row, rowIndex) => {
      const rowY = MARGIN_Y + titleOffset + rowIndex * ROW_SLOT_H;
      drawRow(
        ctx,
        row.anak,
        row.indung,
        row.gong,
        row.name,
        row.showName,
        MARGIN_X,
        rowY,
        row.measureOffset,
        cfg,
      );
    });

    // Page number, bottom center
    ctx.fillStyle = '#94a3b8';
    ctx.font = `22px Inter, sans-serif`;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'center';
    ctx.fillText(`${pageNum} / ${totalPages}`, CW / 2, CH - 28);
    ctx.textAlign = 'left';

    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH);

    isFirstPage = false;
  }

  let blob;
  try {
    blob = pdf.output('blob');
  } catch (err) {
    if (previewWindow) previewWindow.close();
    throw new Error(`PDF-generatie mislukt: ${err.message}`);
  }

  const url = URL.createObjectURL(blob);
  if (previewWindow) {
    previewWindow.location.href = url;
  } else {
    // Fallback: popup was blocked → download directly
    const a = document.createElement('a');
    a.href = url; a.download = `${songTitle || 'kendang'}.pdf`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};
