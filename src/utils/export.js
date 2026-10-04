// jsPDF wordt dynamisch geïmporteerd in exportSequencerToPDF (lazy), zodat de
// ~400 kB bibliotheek niet in de hoofdbundle belandt — pas geladen bij export.
import { deduplicateGongByBeat, glyphFor } from '../engine/patternLogic';

// Chrome op Windows rendert de notatie-glyphs met een hogere 'top'-baseline dan
// macOS/iOS, waardoor de onderste regel (anak + indung) te dicht bij de middellijn
// komt. De PDF wordt als canvas-PNG gerasterd, dus de font-rendering van het
// genererende OS wordt ingebakken — we corrigeren daarom op basis van dat OS:
// +8px voor de bottom-symbolen (en de meelopende rust-stippen) op Windows.
const WINDOWS_BOTTOM_SYMBOL_SHIFT = (typeof navigator !== 'undefined'
  && (/Win/i.test(navigator.platform || '') || /Windows/i.test(navigator.userAgent || '')))
  ? 24 : 0;

// ─── Page geometry ─────────────────────────────────────────────────────────────
// A4 portrait at ~210 dpi gives a crisp result while keeping file size sane.
const CW = 1754; // canvas width  (px) — A4 short side at 210 dpi
const CH = 2480; // canvas height (px) — A4 long side at 210 dpi
const MARGIN_X = 48; // 5,75 mm — blijft boven de ~5 mm die printers niet bedrukken
const MARGIN_Y = 80;
const USABLE_W = CW - 2 * MARGIN_X; // 1658 px
const USABLE_H = CH - 2 * MARGIN_Y; // 2320 px

// ─── Schaal van de notatie ────────────────────────────────────────────────────
// Eén knop voor hoe groot de notatie op papier staat. Horizontaal valt er niets
// te halen: de marges zijn al 7,2 mm en de vier maten vullen 195,6 mm van een
// A4 van 210 mm. Verticaal is er juist de helft van elk regelvak ongebruikt, dus
// daar zit alle rek. Schaalt de bandhoogtes, de lettergroottes én de posities van
// beams en symbolen mee, zodat de verhoudingen kloppen blijven.
//
// Niet meegeschaald: de lijndiktes in STROKE. Die zijn geijkt op wat een printer
// betrouwbaar neerzet (~0,25 mm ondergrens), niet op de grootte van de notatie.
const NOTATIE_SCHAAL = 1.35;
const schaal = (px) => Math.round(px * NOTATIE_SCHAAL);

// ─── Row layout ────────────────────────────────────────────────────────────────
const ROWS_PER_PAGE  = 4;
const TITLE_BLOCK_H  = 120; // reserved height for song title on first page
const ROW_SLOT_H     = Math.floor(USABLE_H / ROWS_PER_PAGE); // 580 px per row slot

const NAME_H        = schaal(28);  // pattern-name label height
const TRACK_H       = schaal(115); // height of each track band (anak or indung)
const SEPARATOR_H   = schaal(32);  // gap between anak and indung bands
// Ruimte tussen de onderkant van een regel en de naam van de volgende:
// ROW_SLOT_H - NAME_H - (TRACK_H*2 + SEPARATOR_H) = ~189 px bij NOTATIE_SCHAAL 1,35

// ─── Typography ────────────────────────────────────────────────────────────────
const SYM_SIZE      = schaal(22); // regular symbol font size (px)
const REST_SIZE     = 26; // rest / empty-dot font size (px)
const MAAT_NUM_SIZE = schaal(16);
const NAME_SIZE     = schaal(17);

// ─── Lijndikte & tekstgewicht voor print ──────────────────────────────────────
// De canvas is 1754 px breed voor een A4 van 210 mm, dus 1 px ≈ 0,12 mm op
// papier. Drukwerkvuistregel: onder ~0,25 mm wordt een lijn onbetrouwbaar — hij
// oogt grijs en kan deels wegvallen op een kantoorprinter. De oorspronkelijke
// waarden zaten daar grotendeels onder (beams op 1 px = 0,12 mm), vandaar dat
// het op scherm goed oogde maar op papier te dun uitviel.
//
// Wil je het globaal zwaarder of lichter: pas deze vijf getallen aan, dat is de
// enige plek waar lijndikte wordt bepaald.
const STROKE = {
  staff:    2.5, // null-/middellijn   was 1.5 px (0,18 mm) -> 0,30 mm
  bar:      3,   // maatstrepen        was 2   px (0,24 mm) -> 0,36 mm
  beam:     2.5, // beams              was 1   px (0,12 mm) -> 0,30 mm
  gongBox:  4,   // gong-kader         was 3   px (0,36 mm) -> 0,48 mm
  gongLine: 3,   // gong-middellijn    was 2   px (0,24 mm) -> 0,36 mm
};

// Hoe ver een beam doorloopt voorbij de slotgrens van zijn laatste noot, in
// slotbreedtes. Een noot staat in het midden van zijn slot, dus bij 1,0 eindigde
// de beam een halve slot ná het symbool — dat deed hem te lang ogen. Op 0,75
// (03-10-2026) hangt het laatste symbool strakker onder het uiteinde. Bij 0,5
// zou de beam precies op het midden van het symbool eindigen, wat te kaal werd
// bevonden.
const BEAM_TAIL = 0.75;

// Telmarkering: om-en-om een lichte achtergrond per tel, zodat je zonder lezen
// ziet op welke tel je zit. Tel 2 en 4 krijgen een tint, 1 en 3 blijven wit —
// op die even tellen vallen in deze traditie de accenten en de gong, dus de
// arcering versterkt waar de klemtoon ligt in plaats van ernaast te liggen.
//
// Bewust erg licht. Donkerder gaat concurreren met de dunne notatielijnen, en
// sommige printers rasteren een lichte tint als zichtbare stippen in plaats van
// vlak grijs — dan wordt het onrustiger in plaats van rustiger.
const BEAT_TINT_ANAK   = 'rgba(0,0,0,0.055)';     // licht grijs
const BEAT_TINT_INDUNG = 'rgba(204,0,0,0.07)';    // licht rood; iets meer dekking dan het
                                                  // grijs, want rood op wit verlaagt de
                                                  // helderheid minder — zo wegen ze visueel gelijk

// Extra omtrek op tekst, in px. Verdikt de letters zónder ze groter te maken of
// te verschuiven — de glyph-metriek blijft identiek, dus de uitlijning van
// symbolen, maatnummers en annotaties verandert niet. Nodig omdat het
// notatie-font (NeoDamina) maar één gewicht heeft en dus geen echte bold kent;
// voor de Inter-teksten houdt het de behandeling consistent.
const TEXT_WEIGHT = {
  symbol: 0.7, // notatie-glyphs en rustpunten
  label:  0.4, // maatnummers, annotaties, regelnaam, paginanummer
};

// Tekent tekst en trekt hem daarna over met een dunne omtrek in dezelfde kleur.
// Alleen de drie betrokken context-eigenschappen worden hersteld; een volledige
// save()/restore() is hier te duur, dit draait per glyph in een lus.
function drawText(ctx, text, x, y, bolden = 0) {
  ctx.fillText(text, x, y);
  if (bolden <= 0) return;
  const prevStroke = ctx.strokeStyle;
  const prevWidth  = ctx.lineWidth;
  const prevJoin   = ctx.lineJoin;
  ctx.strokeStyle = ctx.fillStyle;
  ctx.lineWidth   = bolden;
  ctx.lineJoin    = 'round';
  ctx.strokeText(text, x, y);
  ctx.strokeStyle = prevStroke;
  ctx.lineWidth   = prevWidth;
  ctx.lineJoin    = prevJoin;
}

// ─── Music constants ───────────────────────────────────────────────────────────
const BARS_PER_ROW    = 4;
const SLOTS_PER_BAR   = 48;
const SLOTS_PER_ROW   = BARS_PER_ROW * SLOTS_PER_BAR; // 192
const SLOT_W          = USABLE_W / SLOTS_PER_ROW;      // ~8,6 px

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
        // Beam loopt tot de LAATSTE trioolpositie (8 bij 8T, 4 bij 16T),
        // rustposities binnen de groep meegerekend. Stond hier eerder
        // tripletEnd + 1 met tripletEnd = 9, waardoor een 8T-beam tot slot 11
        // doorliep terwijl de laatste noot op 8 staat — ruim twee slots te ver.
        const tripletEnd = is8T ? 8 : 4;
        results.push({ startIdx: beatStart, span: tripletEnd, level: 1, position });
        continue;
      }

      const firstNote = activeIndices[0];
      const lastNote  = activeIndices[activeIndices.length - 1];

      // Extend beam back to beat start when pos 0 has a data rest
      const beatStartVal = position === 'top' ? slots[beatStart]?.top : slots[beatStart]?.bottom;
      const hasBeatStartRest = beatStartVal === SYMBOL_REST;
      let l1Start = (hasBeatStartRest && firstNote > 0) ? 0 : firstNote;

      // Extend l1 1 slot if 2nd half has only one note; align with rightmost l2 endpoint.
      const secondHalfNotes = activeIndices.filter(i => i >= 6);
      let l1End = (secondHalfNotes.length === 1) ? Math.min(lastNote + 1, 11) : lastNote;
      const sixteenthsForL1 = activeIndices.filter(i => i % 6 !== 0);
      if (sixteenthsForL1.length > 0) {
        const maxBlock = Math.max(...sixteenthsForL1.map(i => Math.floor(i / 6)));
        const l2RightSlot = maxBlock * 6 + 4;
        if (l2RightSlot > l1End) l1End = Math.min(l2RightSlot, 11);
      }
      // Een beam hoort niet voorbij zijn eigen laatste noot door te lopen. De
      // twee regels hierboven rekken hem op tot de blokgrens: l1End krijgt
      // lastNote + 1 zodra de tweede helft één noot heeft, en l2RightSlot gaat
      // uit van een vol 16e-blok. Staat er dan maar één noot op plek 4 van de
      // tel, dan eindigde de beam ruim een slot voorbij die noot.
      // Alleen afklemmen wanneer er 16en in het spel zijn: dát is het geval
      // waarin de balk tot de blokgrens werd opgerekt. Een losse 8e houdt zijn
      // stompje naar rechts — klem je dat ook af, dan valt de balk samen met de
      // noot en verdwijnt hij volledig.
      if (sixteenthsForL1.length > 0) {
        l1End = Math.min(l1End, lastNote);

        // Is de noot óók het beginpunt, dan zou afklemmen de balk alsnog laten
        // verdwijnen. Laat hem dan naar LINKS lopen vanaf het begin van zijn
        // 16e-blok — over de rust-stip die daar toch al staat — in plaats van
        // naar rechts voorbij de noot uit te steken.
        if (l1End <= l1Start) {
          l1Start = Math.floor(lastNote / 6) * 6;
          l1End   = lastNote;
        }
      }

      const l1Span = l1End - l1Start;
      if (l1Span > 0) {
        results.push({ startIdx: beatStart + l1Start, span: l1Span, level: 1, position });
      }

      // Level 2: only the 8th-block(s) actually containing a 16th note. De span
      // was vast 4 (het hele blok); nu loopt hij tot de laatste noot ín dat blok,
      // zodat ook deze balk bij zijn noot ophoudt.
      if (sixteenthsForL1.length > 0 && l1Span > 0) {
        const blocks = new Set(sixteenthsForL1.map(i => Math.floor(i / 6)));
        blocks.forEach(blockIdx => {
          const blockStart  = blockIdx * 6;
          const lastInBlock = Math.max(...activeIndices.filter(i => Math.floor(i / 6) === blockIdx));
          const span = Math.min(blockStart + 4, lastInBlock) - blockStart;
          if (span > 0) {
            results.push({ startIdx: beatStart + blockStart, span, level: 2, position });
          }
        });
      }
    }
  }
  return results;
}

// Draw one 4-bar row for a single pattern (or a 4-bar chunk of a longer pattern)
function drawRow(ctx, slots_anak, slots_indung, gong, patternName, showName, rowX, rowY, measureOffset, cfg = DEFAULT_PDF_SETTINGS, annotations = {}, notationPack = null) {
  const trackY_anak   = rowY + NAME_H;
  const nullY_anak    = trackY_anak + Math.floor(TRACK_H / 2);
  const trackY_indung = trackY_anak + TRACK_H + SEPARATOR_H;
  const nullY_indung  = trackY_indung + Math.floor(TRACK_H / 2);

  // ── 1. Pattern name ──────────────────────────────────────────────────────────
  if (showName) {
    ctx.fillStyle = '#1e293b';
    ctx.font = `bold ${NAME_SIZE}px Inter, sans-serif`;
    ctx.textBaseline = 'alphabetic';
    drawText(ctx, patternName, rowX, rowY + 1, TEXT_WEIGHT.label);
  }

  // ── 2. Track backgrounds ─────────────────────────────────────────────────────
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(rowX, trackY_anak,   USABLE_W, TRACK_H);
  ctx.fillRect(rowX, trackY_indung, USABLE_W, TRACK_H);

  // ── 2b. Telmarkering (optioneel) ─────────────────────────────────────────────
  // Om-en-om een tint per tel van 12 slots. Een maat telt vier tellen, dus de
  // afwisseling blijft vanzelf in fase over de maatstrepen heen. Hier getekend —
  // ná de witte vlakken, vóór de lijnen — zodat notatie, beams en lijnen er
  // bovenop komen en niets verbleekt.
  if (cfg.beatShading) {
    const beatW = 12 * SLOT_W;
    for (let beat = 0; beat * 12 < SLOTS_PER_ROW; beat++) {
      // beat is nul-geïndexeerd: beat 1 en 3 zijn tel 2 en 4.
      if (beat % 2 === 0) continue; // tel 1 en 3 blijven wit
      const bx = rowX + beat * beatW;
      ctx.fillStyle = BEAT_TINT_ANAK;
      ctx.fillRect(bx, trackY_anak, beatW, TRACK_H);
      ctx.fillStyle = BEAT_TINT_INDUNG;
      ctx.fillRect(bx, trackY_indung, beatW, TRACK_H);
    }
  }

  // 4px white gap between anak and indung (no separator line)

  // ── 3. Null / staff lines (anak=black, indung=red) ───────────────────────────
  ctx.lineWidth = STROKE.staff;

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
  ctx.lineWidth = STROKE.bar;
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
      drawText(ctx, String(bar + 1 + measureOffset), x + 5, trackY_anak - 3, TEXT_WEIGHT.label);

      // Annotation text next to measure number
      const annoKey = measureOffset + bar; // global measure index
      const annoText = annotations[annoKey] || annotations[bar];
      if (annoText) {
        ctx.fillStyle = '#64748b';
        ctx.font = `italic ${Math.round(MAAT_NUM_SIZE * 0.75)}px Inter, sans-serif`;
        const numWidth = ctx.measureText(String(bar + 1 + measureOffset)).width;
        drawText(ctx, annoText, x + 8 + numWidth, trackY_anak - 3, TEXT_WEIGHT.label);
      }
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
    ctx.lineWidth = STROKE.beam;
    for (const beam of beams) {
      const beamNudge = (beam.startIdx % 12 === 0) ? SLOT_W * 0.5 : 0;
      const bx = rowX + beam.startIdx * SLOT_W + beamNudge;
      const bw = (beam.span + BEAM_TAIL) * SLOT_W - beamNudge;
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
    // Horizontale uitstrekking van de beam(s) per tel en hand, berekend met
    // exact dezelfde formule als waarmee ze verderop getekend worden — anders
    // ligt "het midden" net naast de streep die je ziet. Meerdere beams in één
    // tel (niveau 1 en 2) worden samengenomen tot één buitenmaat.
    const beamSpanX = {}; // key: `${beatStart}-${position}` → { left, right }
    for (const beam of beams) {
      const beatStart = Math.floor(beam.startIdx / 12) * 12;
      const key = `${beatStart}-${beam.position}`;
      hasBeam.add(key);
      const nudge = (beam.startIdx % 12 === 0) ? SLOT_W * 0.5 : 0;
      const left  = beam.startIdx * SLOT_W + nudge;
      const right = (beam.startIdx + beam.span + BEAM_TAIL) * SLOT_W;
      const prev  = beamSpanX[key];
      beamSpanX[key] = prev
        ? { left: Math.min(prev.left, left), right: Math.max(prev.right, right) }
        : { left, right };
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
    ctx.textAlign = 'center';
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
          // Multiple symbols → center each symbol in its slot, with a graduated
          // nudge so beat-start slots breathe from the bar line.
          const localSlot = i % 12;
          const nudge = localSlot === 0 ? SLOT_W * 0.5
                      : localSlot === 3 ? SLOT_W * 0.33
                      : localSlot === 6 ? SLOT_W * 0.17
                      : 0;
          x = rowX + i * SLOT_W + SLOT_W / 2 + nudge;
        }

        ctx.globalAlpha  = 1.0;
        ctx.textBaseline = hand === 'top' ? 'bottom' : 'top';
        // sym is een soundId; vertaal naar het glyph van de actieve NotationPack.
        drawText(ctx, glyphFor(sym, notationPack), x, hand === 'top' ? nullY - symTop : nullY + symBot, TEXT_WEIGHT.symbol);
      }
      ctx.globalAlpha = 1.0;
    }
    ctx.textAlign = 'left'; // reset for other drawing

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
            // Deze hand heeft geen enkele slag in de tel en krijgt dus één
            // kwartrust-stip. Staat daar aan de andere kant van de basislijn een
            // beam tegenover, dan hoort die ene stip in het MIDDEN van die beam
            // te staan — hij verbeeldt immers de hele tel, niet het beginpunt
            // ervan. Stond hij eerder tegen de beamstart aan, waardoor hij
            // scheef oogde onder een beam die verderop lag.
            //
            // Zonder beam aan de overkant blijft hij in het midden van de tel.
            const other = hand === 'top' ? 'bottom' : 'top';
            const otherHasBeam = hasBeam.has(`${beatStart}-${other}`) || noteCount[`${beatStart}-${other}`] >= 2;
            const span = beamSpanX[`${beatStart}-${other}`];
            if (otherHasBeam && span) {
              drawText(ctx, '.', rowX + (span.left + span.right) / 2, dotY[hand], TEXT_WEIGHT.symbol);
            } else if (otherHasBeam) {
              // Twee of meer slagen maar geen beam: val terug op het oude gedrag.
              drawText(ctx, '.', rowX + beatStart * SLOT_W + SLOT_W, dotY[hand], TEXT_WEIGHT.symbol);
            } else {
              drawText(ctx, '.', rowX + beatStart * SLOT_W + 6 * SLOT_W, dotY[hand], TEXT_WEIGHT.symbol);
            }
          } else {
            // Stip op positie 6: de 16e-rust vlak vóór een noot op positie 9.
            const dotAtSix = slot6 && slot9 &&
              (slot6[hand] === '' || slot6[hand] === SYMBOL_REST) &&
               slot9[hand] !== '' && slot9[hand] !== SYMBOL_REST;

            // Staat er maar één slag in de tel, dan hoort daar hooguit één
            // rust-stip bij. Valt die slag op positie 9, dan vuren beide regels:
            // een stip onder de enkele balk (8e) én een onder de dubbele (16e).
            // De eerste is dan overbodig — de stip het dichtst bij de noot zegt
            // al wat er gebeurt. Bij twee of meer slagen blijven ze allebei
            // staan, want dan hoort elke stip bij een eigen noot.
            const soloSlag = noteCount[`${beatStart}-${hand}`] === 1;

            if (slot0 && (slot0[hand] === '' || slot0[hand] === SYMBOL_REST)
                && !(soloSlag && dotAtSix)) {
              // 8th-rest dot at slot 0: if this hand has a beam, use the nudged
              // position; if the other hand has a centered lone symbol, center too.
              const other = hand === 'top' ? 'bottom' : 'top';
              const otherLone = loneSymbol[`${beatStart}-${other}`] !== null;
              const thisHandBeam = hasBeam.has(`${beatStart}-${hand}`);
              if (!thisHandBeam && otherLone) {
                // Align with the other hand's centered symbol
                drawText(ctx, '.', rowX + beatStart * SLOT_W + 6 * SLOT_W, dotY[hand], TEXT_WEIGHT.symbol);
              } else {
                drawText(ctx, '.', rowX + beatStart * SLOT_W + SLOT_W, dotY[hand], TEXT_WEIGHT.symbol);
              }
            }
            if (dotAtSix) {
              // Place the implied-rest dot at the start of the 2nd 8th-block
              // so there is clear space before the note on slot 9.
              drawText(ctx, '.', rowX + (beatStart + 6) * SLOT_W, dotY[hand], TEXT_WEIGHT.symbol);
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
  // De laatste parameter is de extra beam-verschuiving per track; die hoort bij
  // de beam-offsets en schaalt dus mee.
  drawTrack(slots_anak,   nullY_anak,   '#000000', cfg.symAboveAnak,   cfg.symBelowAnak   + WINDOWS_BOTTOM_SYMBOL_SHIFT, schaal(5));
  drawTrack(slots_indung, nullY_indung, '#cc0000', cfg.symAboveIndung, cfg.symBelowIndung + WINDOWS_BOTTOM_SYMBOL_SHIFT, schaal(7));

  // ── 6. Gong boxes (transparent rect + center line, anak=black, indung=red) ───
  const deduplicatedGong = deduplicateGongByBeat(gong || []);
  for (const beatStart of deduplicatedGong) {
    if (beatStart < 0 || beatStart >= SLOTS_PER_ROW) continue;
    const gx = rowX + beatStart * SLOT_W;
    const gw = 12 * SLOT_W;

    // Anak box
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = STROKE.gongBox;
    ctx.strokeRect(gx, trackY_anak, gw, TRACK_H);
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.lineWidth = STROKE.gongLine;
    ctx.beginPath();
    ctx.moveTo(gx, nullY_anak);
    ctx.lineTo(gx + gw, nullY_anak);
    ctx.stroke();

    // Indung box
    ctx.strokeStyle = 'rgba(204,0,0,0.8)';
    ctx.lineWidth = STROKE.gongBox;
    ctx.strokeRect(gx, trackY_indung, gw, TRACK_H);
    ctx.strokeStyle = 'rgba(204,0,0,0.75)';
    ctx.lineWidth = STROKE.gongLine;
    ctx.beginPath();
    ctx.moveTo(gx, nullY_indung);
    ctx.lineTo(gx + gw, nullY_indung);
    ctx.stroke();
  }
}

// ─── Default PDF layout settings (overridable via settings param) ──────────────
export const DEFAULT_PDF_SETTINGS = {
  // Alle afstanden hieronder zijn px vanaf de middellijn en schalen mee met
  // NOTATIE_SCHAAL. Dat moet: de symbolen zijn aan die lijn verankerd en groeien
  // er dus vanaf. Bleven de beams staan, dan zouden de grotere glyphs ertegenaan
  // lopen — precies wat er misging toen de letters eerder groter werden.
  beamTop1:    schaal(-46),  // beam level 1 above null line
  beamTop2:    schaal(-40),  // beam level 2 above null line
  beamBottom1: schaal(12),   // beam level 1 below null line
  beamBottom2: schaal(18),   // beam level 2 below null line
  // Per-track symbol offsets (px from null line) — mirrored from TrackRow.css
  symAboveAnak:   schaal(12),  // anak top symbols (.theme-anak .pos-above: margin-bottom: 12px)
  symBelowAnak:   schaal(5),   // anak bottom symbols (default)
  symAboveIndung: schaal(11),  // indung top symbols — shifted 5px down vs CSS for visual alignment
  symBelowIndung: schaal(9),   // indung bottom symbols (.theme-indung .pos-below: margin-top: 9px)
  // Telmarkering staat standaard uit: wie al afdrukken maakt krijgt niet
  // ongevraagd een gestreepte pagina. Aan te zetten in het PDF-instellingenpaneel.
  beatShading: false,
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
        annotations:   pattern.annotations ?? {},
      });
    }

    measureOffset += totalBars;
  }

  // Render pages
  const canvas = document.createElement('canvas');
  canvas.width  = CW;
  canvas.height = CH;
  const ctx = canvas.getContext('2d');

  const { jsPDF } = await import('jspdf');
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
        row.annotations,
        cfg.notationPack || null,
      );
    });

    // Page number, bottom center
    ctx.fillStyle = '#94a3b8';
    ctx.font = `22px Inter, sans-serif`;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'center';
    drawText(ctx, `${pageNum} / ${totalPages}`, CW / 2, CH - 28, TEXT_WEIGHT.label);
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
