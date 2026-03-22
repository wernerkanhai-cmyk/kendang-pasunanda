import { jsPDF } from 'jspdf';

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
function isEmptyTopBeat(slots, beatStart) {
  for (let i = 0; i < 12; i++) {
    const s = slots[beatStart + i];
    if (s && s.top !== '') return false;
  }
  return true;
}
function isEmptyBottomBeat(slots, beatStart) {
  for (let i = 0; i < 12; i++) {
    const s = slots[beatStart + i];
    if (s && s.bottom !== '') return false;
  }
  return true;
}

// Returns beam descriptors: { startIdx, span, level, position }
// Ported from TrackRow.jsx calculateBeamsForHand
function calculateBeams(slots) {
  const results = [];
  for (const position of ['top', 'bottom']) {
    for (let beatStart = 0; beatStart < slots.length; beatStart += 12) {
      const activeIndices = [];
      for (let i = 0; i < 12; i++) {
        const s = slots[beatStart + i];
        if (!s) continue;
        const hasNote = position === 'top' ? s.top !== '' : s.bottom !== '';
        if (hasNote) activeIndices.push(i);
      }

      if (activeIndices.length < 2) continue;
      // Skip if triplet pattern (0, 4, 8)
      if (
        activeIndices.length === 3 &&
        activeIndices[0] === 0 && activeIndices[1] === 4 && activeIndices[2] === 8
      ) continue;

      const first = activeIndices[0];
      const last  = activeIndices[activeIndices.length - 1];

      // Level 1: 8th-note umbrella beam spanning all notes in beat
      results.push({ startIdx: beatStart + first, span: last - first, level: 1, position });

      // Level 2: 16th-note beams for adjacent notes ≤ 3 slots apart
      let l2Start = -1, prev = -1;
      for (let i = 0; i < activeIndices.length; i++) {
        const curr = activeIndices[i];
        if (l2Start === -1) {
          l2Start = curr;
        } else if (curr - prev > 3) {
          if (prev > l2Start)
            results.push({ startIdx: beatStart + l2Start, span: prev - l2Start, level: 2, position });
          l2Start = curr;
        }
        prev = curr;
      }
      if (l2Start !== -1 && prev > l2Start)
        results.push({ startIdx: beatStart + l2Start, span: prev - l2Start, level: 2, position });
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

  // ── 5. Helper: draw symbols + beams for one track ────────────────────────────
  function drawTrack(slots, nullY, baseColor) {
    // Rhythmic beams (8th = level 1, 16th = level 2)
    const beams = calculateBeams(slots);
    ctx.lineWidth = 1;
    for (const beam of beams) {
      const bx = rowX + beam.startIdx * SLOT_W;
      const bw = (beam.span + 1) * SLOT_W;
      const by = nullY + (beam.position === 'top'
        ? (beam.level === 1 ? cfg.beamTop1    : cfg.beamTop2)
        : (beam.level === 1 ? cfg.beamBottom1 : cfg.beamBottom2));
      ctx.strokeStyle = baseColor;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + bw, by);
      ctx.stroke();
    }

    // Symbols
    for (let i = 0; i < SLOTS_PER_ROW; i++) {
      const slot = slots[i];
      if (!slot) continue;
      const x = rowX + i * SLOT_W + 2;

      if (slot.top !== '') {
        const isRest = slot.top === '.';
        ctx.font = `${isRest ? REST_SIZE : SYM_SIZE}px Kendang, monospace`;
        ctx.fillStyle = baseColor;
        ctx.globalAlpha = isRest ? 0.45 : 1.0;
        ctx.textBaseline = 'bottom';
        ctx.fillText(slot.top, x, nullY - cfg.symAbove);
      }

      if (slot.bottom !== '') {
        const isRest = slot.bottom === '.';
        ctx.font = `${isRest ? REST_SIZE : SYM_SIZE}px Kendang, monospace`;
        ctx.fillStyle = baseColor;
        ctx.globalAlpha = isRest ? 0.45 : 1.0;
        if (isRest) {
          ctx.textBaseline = 'top';
          ctx.fillText(slot.bottom, x, nullY + cfg.symBelow - 16);
        } else {
          ctx.textBaseline = 'top';
          ctx.fillText(slot.bottom, x, nullY + cfg.symBelow);
        }
      }

      ctx.globalAlpha = 1.0;
    }

    // Position-indicator dots — faint, one for top and one for bottom symbol position
    ctx.font = `${REST_SIZE}px Kendang, monospace`;
    ctx.fillStyle = baseColor;
    ctx.globalAlpha = 0.18;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    const topDotY    = nullY + cfg.dotTopOffset;
    const bottomDotY = nullY + cfg.dotBottomOffset;
    for (let beat = 0; beat < SLOTS_PER_ROW / 12; beat++) {
      const cx = rowX + (beat * 12 + 6) * SLOT_W;
      if (isEmptyTopBeat(slots, beat * 12))    ctx.fillText('.', cx, topDotY);
      if (isEmptyBottomBeat(slots, beat * 12)) ctx.fillText('.', cx, bottomDotY);
    }
    ctx.globalAlpha = 1.0;
    ctx.textAlign = 'left';
  }

  drawTrack(slots_anak,   nullY_anak,   '#000000');
  drawTrack(slots_indung, nullY_indung, '#cc0000');

  // ── 6. Gong boxes (transparent rect + center line, anak=black, indung=red) ───
  for (const blockStart of (gong || [])) {
    if (blockStart < 0 || blockStart >= SLOTS_PER_ROW) continue;
    const gx = rowX + blockStart * SLOT_W;
    const gw = 6 * SLOT_W;

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
  symAbove:      6,  // symbol gap above null line
  symBelow:      5,  // symbol gap below null line
  dotTopOffset:    -18,  // empty-beat dot top position (above null line)
  dotBottomOffset:  -5,  // empty-beat dot bottom position (below null line)
};

// ─── Main export function ──────────────────────────────────────────────────────
export const exportSequencerToPDF = async (song, songTitle = '', settings = {}) => {
  if (!song || song.length === 0) return;

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

  const blob = pdf.output('blob');
  const url  = URL.createObjectURL(blob);
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
