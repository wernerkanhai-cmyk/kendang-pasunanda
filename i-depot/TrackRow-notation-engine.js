/**
 * Kendang Pasunanda — Rhythmic Notation Engine
 * © 2026 Werner Kanhai. Alle rechten voorbehouden.
 *
 * This file contains the distinctive notation logic extracted from
 * src/components/TrackRow.jsx: triplet detection, beam calculation,
 * rest display engine, and rhythmic rendering rules specific to
 * Sundanese kendang notation.
 *
 * This is not a standalone runnable file — it is a deposit of the
 * intellectual property contained in the notation algorithms.
 */

  // Per-hand triplet detection for 8T, 16T, and 4T.
  //
  // 8T  (8th-note triplets):    3 notes per beat (12 slots), offsets {0, 4, 8}
  // 16T (16th-note triplets):   3 notes per half-beat (6 slots), offsets {0, 2, 4}
  //
  // Rule: ALL notes for this hand in the group must be at triplet positions,
  //       AND at least one note is NOT at the first position (avoids false positives).
  const TRIPLET_8T  = new Set([0, 4, 8]);
  const TRIPLET_16T = new Set([0, 2, 4]);
  const handTriplets = useMemo(() => {
    const found = [];
    const detect = (groupSize, offsets, type, nonFirstOffsets) => {
      for (let groupStart = 0; groupStart < slots.length; groupStart += groupSize) {
        for (const hand of ['top', 'bottom']) {
          const notes = [];
          let firstSym = null;
          for (let i = 0; i < groupSize && (groupStart + i) < slots.length; i++) {
            const s = slots[groupStart + i];
            if (!s) continue;
            const v = s[hand];
            if (v !== '' && v !== SYMBOL_REST) {
              notes.push(i);
              if (firstSym === null) firstSym = v;
            }
          }
          if (notes.length < 2) continue; // need at least 2 notes for a triplet
          if (!notes.every(n => offsets.has(n))) continue;
          if (!notes.some(n => nonFirstOffsets.includes(n))) continue;
          const below = !TOP_HAND_SYMBOLS.includes(firstSym);
          found.push({ start: groupStart, hand, below, type });
        }
      }
    };
    // Detect 16T first (6-slot groups) — more specific, checked before 8T
    detect(6,  TRIPLET_16T, '16T', [2, 4]);
    // Detect 8T (12-slot groups) — skip beats already claimed by 16T
    for (let beatStart = 0; beatStart < slots.length; beatStart += 12) {
      for (const hand of ['top', 'bottom']) {
        const notes = [];
        let firstSym = null;
        for (let i = 0; i < 12; i++) {
          const s = slots[beatStart + i];
          if (!s) continue;
          const v = s[hand];
          if (v !== '' && v !== SYMBOL_REST) {
            notes.push(i);
            if (firstSym === null) firstSym = v;
          }
        }
        if (notes.length === 0) continue;
        if (!notes.every(n => TRIPLET_8T.has(n))) continue;
        if (!notes.some(n => n === 4 || n === 8)) continue;
        // Skip if both half-beats are already detected as 16T
        const has16T_first  = found.some(t => t.type === '16T' && t.start === beatStart && t.hand === hand);
        const has16T_second = found.some(t => t.type === '16T' && t.start === beatStart + 6 && t.hand === hand);
        if (has16T_first && has16T_second) continue;
        const below = !TOP_HAND_SYMBOLS.includes(firstSym);
        found.push({ start: beatStart, hand, below, type: '8T' });
      }
    }
    return found;
  }, [slots]);


// ─── Rest Display Engine ───────────────────────────────────────

  // Hierarchy:
  //   1/4 Rust  – entire beat empty, not in trailing silence → data rest at pos 0
  //   1/8 Rust  – first half empty, note in second half     → beam only, no dot
  //   1/16 rule – pos 6 (plek 3) empty, pos 9 (plek 4) has note → dot at pos 6
  //
  // Trailing Silence: empty beats AFTER the last note in a bar → no dots, no beams.
  //
  // Helper: last note index (relative to bar start) in a 48-slot bar.
  const lastNoteInBar = useMemo(() => {
    const result = new Array(Math.ceil(slots.length / 48)).fill(-1);
    for (let b = 0; b < result.length; b++) {
      for (let i = 47; i >= 0; i--) {
        const s = slots[b * 48 + i];
        if (!s) continue;
        if ((s.top !== '' && s.top !== SYMBOL_REST) || (s.bottom !== '' && s.bottom !== SYMBOL_REST)) {
          result[b] = i;
          break;
        }
      }
    }
    return result;
  }, [slots]);

  // quarterRests: beat-start slots where the beat is empty and not in trailing silence.
  // Rendered as explicit top+bottom dots — independent of SYMBOL_REST data state.
  // quarterRests: per hand — maat heeft noten maar deze hand heeft niets in dit tel
  const quarterRests = useMemo(() => {
    const result = new Set(); // sleutels: `${beatStart}-top` / `${beatStart}-bottom`
    for (let barIdx = 0; barIdx < lastNoteInBar.length; barIdx++) {
      const barStart = barIdx * 48;
      const lastNote = lastNoteInBar[barIdx];
      if (lastNote < 0) continue; // volledig lege maat → geen stippen
      for (let beatOff = 0; beatOff < 48; beatOff += 12) {
        const beatStart = barStart + beatOff;
        for (const hand of ['top', 'bottom']) {
          const handHasNote = slots.slice(beatStart, beatStart + 12).some(s =>
            s[hand] !== '' && s[hand] !== SYMBOL_REST
          );
          if (!handHasNote) result.add(`${beatStart}-${hand}`);
        }
      }
    }
    return result;
  }, [slots, lastNoteInBar]);

  // impliedRests:
  //   1. Beat-start dot: beat has a note for a hand but pos 0 for that hand is empty.
  //   2. Pos 6 dot: pos 6 empty, pos 9 has a note (plek 3 → plek 4 lead-in).
  const impliedRests = useMemo(() => {
    const result = new Set();
    for (let barIdx = 0; barIdx < lastNoteInBar.length; barIdx++) {
      const barStart = barIdx * 48;
      const lastNote = lastNoteInBar[barIdx];
      for (let beatOff = 0; beatOff < 48; beatOff += 12) {
        if (lastNote < 0) continue; // lege maat
        const beatStart = barStart + beatOff;
        const beatSlots = slots.slice(beatStart, beatStart + 12);
        const slot0 = slots[beatStart];
        const slot6 = slots[beatStart + 6];
        const slot9 = slots[beatStart + 9];
        for (const hand of ['top', 'bottom']) {
          const beatHasNoteForHand = beatSlots.some(s =>
            s[hand] !== '' && s[hand] !== SYMBOL_REST
          );
          if (!beatHasNoteForHand) continue;
          // Rule 1: dot at beat-start when pos 0 is empty for this hand
          if (slot0 && (slot0[hand] === '' || slot0[hand] === SYMBOL_REST)) {
            result.add(`${beatStart}-${hand}`);
          }
          // Rule 2: dot at pos 6 when pos 9 has a note (plek 3→4 lead-in)
          if (slot6 && slot9 &&
              (slot6[hand] === '' || slot6[hand] === SYMBOL_REST) &&
               slot9[hand] !== '' && slot9[hand] !== SYMBOL_REST) {
            result.add(`${beatStart + 6}-${hand}`);
          }
        }
      }
    }
    return result;
  }, [slots, lastNoteInBar]);

  // collapsedRests: collapse ALL SYMBOL_REST everywhere.
  // Quarter rests are rendered via quarterRests (independent of data state).
  // Implied rests (pos 6) are rendered via impliedRests.
  const collapsedRests = useMemo(() => {
    const result = new Set();
    slots.forEach((s, i) => {
      if (s.top    === SYMBOL_REST) result.add(`${i}-top`);

// ─── Beam Rendering Logic ──────────────────────────────────────


  // Beam Rendering Logic for 8ths (1 line) and 16ths (2 lines)
  const beams = useMemo(() => {
    const calculateBeamsForHand = (position) => {
       const handResults = [];
       for (let beatStart = 0; beatStart < slots.length; beatStart += 12) {
         const activeIndices = [];
         const l2Indices = []; // Non-collapsed only
         for (let i = 0; i < 12; i++) {
           const slot = slots[beatStart + i];
           const hasNote = (position === 'top')
            ? (slot.top !== '' && slot.top !== SYMBOL_REST)
            : (slot.bottom !== '' && slot.bottom !== SYMBOL_REST);
           if (hasNote) {
             activeIndices.push(i);
             if (!collapsedRests.has(`${beatStart + i}-${position}`)) {
               l2Indices.push(i);
             }
           }
         }

         if (activeIndices.length === 0) continue;
         // Triplet beats: render only a single level-1 beam spanning the group, no level-2.
         const hand = position;
         const is8T = handTriplets.some(t => t.hand === hand && t.start === beatStart && t.type === '8T');
         const is16T = handTriplets.some(t => t.hand === hand && t.start === beatStart && t.type === '16T')
                    && handTriplets.some(t => t.hand === hand && t.start === beatStart + 6 && t.type === '16T');
         if (is8T || is16T) {
           // Beam spans the full triplet grid (0–8 for 8T, 0–4 for 16T),
           // including rest positions — they are part of the group.
           const tripletEnd = is8T ? 8 : 4;
           handResults.push({ startIdx: beatStart, span: tripletEnd + 1, level: 1, position });
           continue;
         }

         const firstNote = activeIndices[0];
         const lastNote  = activeIndices[activeIndices.length - 1];

         // If there is a rest at beat position 0 (data or implied) and the first
         // actual note is later, extend the level-1 beam back to beat start so the
         // rest shows its rhythmic value (and single notes at offset 6 still get a beam).
         const beatStartVal = position === 'top' ? slots[beatStart].top : slots[beatStart].bottom;
         const hasBeatStartRest = beatStartVal === SYMBOL_REST || impliedRests.has(`${beatStart}-${position}`);
         const l1Start = (hasBeatStartRest && firstNote > 0) ? 0 : firstNote;
         // Extend l1 1 slot further if the second 8th-block has only one note,
         // and align l1 with the rightmost level-2 beam endpoint so single + double end together.
         const secondHalfNotes = activeIndices.filter(i => i >= 6);
         let l1End = (secondHalfNotes.length === 1) ? Math.min(lastNote + 1, 11) : lastNote;
         const sixteenthsForL1 = activeIndices.filter(i => i % 6 !== 0);
         if (sixteenthsForL1.length > 0) {
           const maxBlock = Math.max(...sixteenthsForL1.map(i => Math.floor(i / 6)));
           const l2RightSlot = maxBlock * 6 + 4; // matches level-2 span=4
           if (l2RightSlot > l1End) l1End = Math.min(l2RightSlot, 11);
         }
         const l1Span  = l1End - l1Start;
         if (l1Span > 0) {
           handResults.push({ startIdx: beatStart + l1Start, span: l1Span, level: 1, position });
         }

         // Level 2 Beams: draw when any note is at a 16th-note position (offset % 6 ≠ 0).
         // The double beam starts at the beginning of the 8th-block that contains the
         // first 16th note: Math.floor(firstSixteenth / 6) * 6
         //   · · t  (rest@0, rest@6, note@9) → single: 0→9, double: 6→9
         //   · t t  (rest@0, note@6, note@9) → single: 0→9, double: 6→9  [if 6 is 16th]
         //   P P    (note@0, note@3)          → single: 0→3, double: 0→3
         // Level 2 only covers 8th-blocks that actually contain a 16th note.
         // An 8th-aligned note (offset 0 or 6) after/before a 16th keeps only the single beam.
         const sixteenths = activeIndices.filter(i => i % 6 !== 0);
         if (sixteenths.length > 0 && l1Span > 0) {
           const blocks = new Set(sixteenths.map(i => Math.floor(i / 6)));
           blocks.forEach(blockIdx => {
             handResults.push({ startIdx: beatStart + blockIdx * 6, span: 4, level: 2, position });
           });
         }
       }
       return handResults;
