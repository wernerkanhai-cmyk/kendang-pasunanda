import { useMemo, useState, useEffect, useRef } from 'react';
import './TrackRow.css';
import {
  SYMBOL_REST,
  TOP_HAND_SOUNDS,
  BOTTOM_HAND_SOUNDS,
  LEGACY_GLYPH_TO_SOUND,
  deduplicateGongByBeat,
  glyphFor,
} from '../engine/patternLogic';

// Drum-picker — gegroepeerd per drum-zone, met soundIds als onderliggende waarde.
// De visuele glyph wordt op render-time uit de actieve NotationPack gehaald.
const DRUM_MENU = [
  { label: 'Ketipung', sounds: [{ soundId: 'tung', name: 'Tung' }] },
  { label: 'Gedug',    sounds: [{ soundId: 'dong', name: 'Dong' }, { soundId: 'ting', name: 'Ting' }, { soundId: 'det', name: 'Det' }] },
  { label: 'Kumpyang', sounds: [{ soundId: 'pling', name: 'Pling' }, { soundId: 'pang', name: 'Pang' }, { soundId: 'ping', name: 'Ping' }, { soundId: 'pong', name: 'Pong' }, { soundId: 'plak', name: 'Plak' }] },
  { label: 'Kutiplak', sounds: [{ soundId: 'pak', name: 'Pak' }, { soundId: 'peung', name: 'Peung' }] },
];

const getVerticalPositionClass = (value, hand) => {
  if (value === SYMBOL_REST) {
      return hand === 'top' ? 'pos-above' : 'pos-below';
  }
  // Sta legacy glyph-data toe (auto-migratie tijdens transitie).
  const sound = LEGACY_GLYPH_TO_SOUND[value] || value;
  if (TOP_HAND_SOUNDS.includes(sound))    return 'pos-above';
  if (BOTTOM_HAND_SOUNDS.includes(sound)) return 'pos-below';
  return 'pos-line';
};

const TrackRow = ({ trackId, slots, notationPack, theme, activeRange, loopRange = null, onSlotClick, slotWidth = 12, onNoteMove, gridResolution = 6, gong = [], onInsertSymbol, onClearSlot, isLocked = false }) => {
  const [dragOverSlot, setDragOverSlot] = useState(null);
  const [popup, setPopup] = useState(null); // { slotIndex, x, y }
  const lastTapRef = useRef({ slotIndex: -1, time: 0 });
  const touchDragRef = useRef(null); // { slotIndex, hand, symbol, offsetX, offsetY }
  const ghostRef = useRef(null);
  const touchMovedRef = useRef(false);
  // Pinch-zoom detectie: tijdstip waarop 2+ vingers tegelijk het scherm raakten
  const pinchTimeRef = useRef(0);

  useEffect(() => {
    if (!popup) return;
    const close = () => setPopup(null);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [popup]);

  // Detecteer pinch-zoom: bij 2+ gelijktijdige touches, sla het tijdstip op.
  // Zo kan onClick de gesynthetiseerde click na een pinch onderdrukken.
  useEffect(() => {
    const onTouchStart = (e) => {
      if (e.touches.length >= 2) pinchTimeRef.current = Date.now();
    };
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    return () => document.removeEventListener('touchstart', onTouchStart);
  }, []);

  const openPopup = (e, slotIndex) => {
    if (isLocked) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(rect.left, window.innerWidth - 224);
    const y = rect.bottom + 6;
    setPopup({ slotIndex, x, y });
  };

  const handleDragStart = (e, slotIndex, hand, symbol) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ slotIndex, hand, symbol, trackId }));
  };

  const handleDragOver = (e, slotIndex) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverSlot !== slotIndex) setDragOverSlot(slotIndex);
  };

  const handleDrop = (e, toSlot) => {
    e.preventDefault();
    setDragOverSlot(null);
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (data.trackId === trackId && data.slotIndex === toSlot) return;
      onNoteMove && onNoteMove({
        fromTrackId: data.trackId,
        fromSlot: data.slotIndex,
        fromHand: data.hand,
        toTrackId: trackId,
        toSlot,
        toHand: data.hand,
        symbol: data.symbol,
      });
    } catch {}
  };

  // Touch drag-and-drop (iOS/iPad — HTML5 drag API not supported)
  const handleTouchStart = (e, slotIndex, hand, symbol) => {
    e.stopPropagation();
    touchMovedRef.current = false;
    // Clean up any lingering ghost from a previous touch cycle
    if (ghostRef.current) {
      ghostRef.current.remove();
      ghostRef.current = null;
    }
    const touch = e.touches[0];
    const span = e.currentTarget;
    const rect = span.getBoundingClientRect();
    const ghost = span.cloneNode(true);
    ghost.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;opacity:0.7;pointer-events:none;z-index:9999;font-size:${getComputedStyle(span).fontSize};`;
    document.body.appendChild(ghost);
    ghostRef.current = ghost;
    touchDragRef.current = {
      slotIndex, hand, symbol,
      offsetX: touch.clientX - rect.left,
      offsetY: touch.clientY - rect.top,
    };
  };

  useEffect(() => {
    const handleTouchMove = (e) => {
      if (!touchDragRef.current) return;
      e.preventDefault();
      touchMovedRef.current = true;
      const touch = e.touches[0];
      if (ghostRef.current) {
        const { offsetX, offsetY } = touchDragRef.current;
        ghostRef.current.style.left = `${touch.clientX - offsetX}px`;
        ghostRef.current.style.top  = `${touch.clientY - offsetY}px`;
      }
      // Find slot under finger (hide ghost so elementFromPoint hits the slot)
      if (ghostRef.current) ghostRef.current.style.display = 'none';
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      if (ghostRef.current) ghostRef.current.style.display = '';
      const slotEl = el?.closest('[data-slot-index]');
      const idx = slotEl ? parseInt(slotEl.dataset.slotIndex, 10) : null;
      setDragOverSlot(idx);
    };

    const handleTouchEnd = (e) => {
      if (!touchDragRef.current) return;
      const touch = e.changedTouches[0];
      if (ghostRef.current) {
        document.body.removeChild(ghostRef.current);
        ghostRef.current = null;
      }
      if (touchMovedRef.current) {
        const el = document.elementFromPoint(touch.clientX, touch.clientY);
        const slotEl = el?.closest('[data-slot-index]');
        if (slotEl) {
          const toSlot = parseInt(slotEl.dataset.slotIndex, 10);
          const { slotIndex, hand, symbol } = touchDragRef.current;
          if (slotIndex !== toSlot) {
            onNoteMove && onNoteMove({
              fromTrackId: trackId, fromSlot: slotIndex, fromHand: hand,
              toTrackId: trackId,   toSlot,               toHand: hand,
              symbol,
            });
          }
        }
      }
      touchDragRef.current = null;
      setDragOverSlot(null);
    };

    const handleTouchCancel = () => {
      if (ghostRef.current) {
        ghostRef.current.remove();
        ghostRef.current = null;
      }
      touchDragRef.current = null;
      setDragOverSlot(null);
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
    document.addEventListener('touchcancel', handleTouchCancel);
    return () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchCancel);
      // Clean up any ghost left over when component unmounts
      if (ghostRef.current) {
        ghostRef.current.remove();
        ghostRef.current = null;
      }
    };
  }, [onNoteMove, trackId]);
  // A standard bar is 48 slots. A beat is 12 slots. A 16th note step is 3 slots.

  const gongBeats = useMemo(() => deduplicateGongByBeat(gong), [gong]);

  // Triplet detection is handled entirely by handTriplets below (per-hand, per-track).
  // This combined-hands version is kept as an empty stub to avoid breaking any future refs.
  const triplets = [];

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
          const sound = LEGACY_GLYPH_TO_SOUND[firstSym] || firstSym;
          const below = !TOP_HAND_SOUNDS.includes(sound);
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
        const sound = LEGACY_GLYPH_TO_SOUND[firstSym] || firstSym;
        const below = !TOP_HAND_SOUNDS.includes(sound);
        found.push({ start: beatStart, hand, below, type: '8T' });
      }
    }
    return found;
  }, [slots]);

  // ─── Rest Display Engine (per Master Prompt) ───────────────────────────────
  //
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
      if (s.bottom === SYMBOL_REST) result.add(`${i}-bottom`);
    });
    return result;
  }, [slots]);

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
    };

    const topBeams = calculateBeamsForHand('top');
    const bottomBeams = calculateBeamsForHand('bottom');
    return [...topBeams, ...bottomBeams];
  }, [slots, collapsedRests, impliedRests]);

  return (
    <div className={`track-row theme-${theme}`}>

      <div className="slots-container" style={{ '--sw': slotWidth + 'px' }} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverSlot(null); }}>
        {/* Render the calculated horizontal rhythmic beams */}
        {beams.map((beam, i) => {
          const leftPos = beam.startIdx * slotWidth;
          const width = (beam.span + 1) * slotWidth;
          
          return (
            <div 
              key={`beam-${i}`}
              className={`rhythmic-beam beam-level-${beam.level} pos-${beam.position} color-${trackId}`}
              style={{ left: leftPos, width: Math.max(width, 1) }} // fallback width
            />
          );
        })}

        {/* Gong block overlays — 1 beat (12 slots) breed, uitgelijnd op beatgrens, 1px naar links */}
        {gongBeats.map(beatStart => {
          const gongColor = trackId === 'anak' ? 'rgba(0,0,0,0.9)' : 'rgba(204,0,0,0.9)';
          return (
            <div
              key={`gong-${beatStart}`}
              style={{
                position: 'absolute',
                top: 0,
                height: '100%',
                left: beatStart * slotWidth - 1,
                width: 12 * slotWidth,
                border: `2px solid ${gongColor}`,
                pointerEvents: 'none',
                zIndex: 5,
                boxSizing: 'border-box',
                cursor: 'default',
              }}
            >
              {/* Horizontale middenlijn op de nullijn */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: 0,
                right: 0,
                height: 2,
                background: gongColor,
                transform: 'translateY(-50%)',
              }} />
            </div>
          );
        })}

        {slots.map((slot, index) => {
          const isBarStart = index % 48 === 0;
          const isBeatStart = index % 12 === 0;
          const isSubStepStart = index % 3 === 0;
          const gridStep = Math.max(1, gridResolution);
          const isGridLine = !isBarStart && !isBeatStart && index % gridStep === 0;

          let borderClasses = '';
          if (isBarStart) borderClasses += ' bar-start';
          else if (isBeatStart) borderClasses += ' beat-start';
          else if (isGridLine) borderClasses += ' grid-line';
          else if (isSubStepStart) borderClasses += ' substep-start';

          const isActive = activeRange && index >= activeRange.start && index < activeRange.end;
          const isLoopRange = loopRange && index >= loopRange.start && index < loopRange.end;
          const isTripletStart = triplets.includes(index);
          const handTripletsHere = handTriplets.filter(t => t.start === index);
          
          const isRestTop = slot.top === SYMBOL_REST;
          const posClassTop = getVerticalPositionClass(slot.top, 'top');

          const isRestBottom = slot.bottom === SYMBOL_REST;
          const posClassBottom = getVerticalPositionClass(slot.bottom, 'bottom');

          return (
            <div
              key={index}
              data-slot-index={index}
              className={`slot-cell ${borderClasses} ${isLoopRange ? 'loop-range' : ''} ${isActive ? 'active-slot' : ''} ${dragOverSlot === index ? 'drop-target' : ''}`}
              onClick={(e) => { e.stopPropagation(); if (Date.now() - pinchTimeRef.current < 600) return; onSlotClick(index, e.shiftKey); }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (isLocked) return;
                const hasSymbol = slot.top !== '' || slot.bottom !== '';
                if (hasSymbol && onClearSlot) {
                  onClearSlot(index);
                } else {
                  openPopup(e, index);
                }
              }}
              onContextMenu={(e) => openPopup(e, index)}
              onTouchEnd={(e) => {
                // Suppress if a touch drag or pinch-zoom just completed
                if (touchMovedRef.current) return;
                if (Date.now() - pinchTimeRef.current < 600) return;
                if (isLocked) return;
                const now = Date.now();
                const last = lastTapRef.current;
                if (last.slotIndex === index && now - last.time < 350) {
                  lastTapRef.current = { slotIndex: -1, time: 0 };
                  const hasSymbol = slot.top !== '' || slot.bottom !== '';
                  if (hasSymbol && onClearSlot) {
                    e.preventDefault();
                    e.stopPropagation();
                    onClearSlot(index);
                  } else {
                    openPopup(e, index);
                  }
                } else {
                  lastTapRef.current = { slotIndex: index, time: now };
                }
              }}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
            >
              {/* Data symbols (notes and data rests) — soundId → glyph via NotationPack */}
              {slot.top !== '' && !collapsedRests.has(`${index}-top`) && (
                <span
                  draggable
                  onDragStart={(e) => handleDragStart(e, index, 'top', slot.top)}
                  onDragEnd={() => setDragOverSlot(null)}
                  onTouchStart={(e) => handleTouchStart(e, index, 'top', slot.top)}
                  className={`kendang-font ${isRestTop ? 'slot-rest' : 'slot-symbol'} ${posClassTop} color-${trackId} draggable-note`}
                >
                  {glyphFor(slot.top, notationPack)}
                </span>
              )}
              {slot.bottom !== '' && !collapsedRests.has(`${index}-bottom`) && (
                <span
                  draggable
                  onDragStart={(e) => handleDragStart(e, index, 'bottom', slot.bottom)}
                  onDragEnd={() => setDragOverSlot(null)}
                  onTouchStart={(e) => handleTouchStart(e, index, 'bottom', slot.bottom)}
                  className={`kendang-font ${isRestBottom ? 'slot-rest' : 'slot-symbol'} ${posClassBottom} color-${trackId} draggable-note`}
                >
                  {glyphFor(slot.bottom, notationPack)}
                </span>
              )}
              {slot.accentTop && slot.top !== '' && slot.top !== SYMBOL_REST && (
                <span className="accent-marker accent-top">›</span>
              )}
              {slot.accentBottom && slot.bottom !== '' && slot.bottom !== SYMBOL_REST && (
                <span className="accent-marker accent-bottom">›</span>
              )}
              {/* Quarter rest per hand: centered in the beat (6 slots offset) */}
              {index % 12 === 0 && quarterRests.has(`${index}-top`) && (
                <span className={`kendang-font slot-rest pos-above color-${trackId}`} style={{ transform: `translateX(${5.5 * slotWidth}px)` }}>{SYMBOL_REST}</span>
              )}
              {index % 12 === 0 && quarterRests.has(`${index}-bottom`) && (
                <span className={`kendang-font slot-rest pos-below color-${trackId}`} style={{ transform: `translateX(${5.5 * slotWidth}px)` }}>{SYMBOL_REST}</span>
              )}
              {/* Implied rests: pos 6 lead-in dot when pos 9 has a note (plek 3→4 rule) */}
              {(slot.top === '' || collapsedRests.has(`${index}-top`)) && impliedRests.has(`${index}-top`) && (
                <span className={`kendang-font slot-rest pos-above color-${trackId}`}>{SYMBOL_REST}</span>
              )}
              {(slot.bottom === '' || collapsedRests.has(`${index}-bottom`)) && impliedRests.has(`${index}-bottom`) && (
                <span className={`kendang-font slot-rest pos-below color-${trackId}`}>{SYMBOL_REST}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Sound insert popup */}
      {popup && onInsertSymbol && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: 'fixed', left: popup.x, top: Math.min(popup.y, window.innerHeight - 320),
            zIndex: 500, background: '#1e293b', border: '1px solid #334155',
            borderRadius: '8px', padding: '0.5rem 0.6rem',
            boxShadow: '0 8px 28px rgba(0,0,0,0.6)', minWidth: '200px',
          }}
        >
          {DRUM_MENU.map(drum => (
            <div key={drum.label} style={{ marginBottom: '0.45rem' }}>
              <div style={{ fontSize: '0.6rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 'bold', marginBottom: '3px' }}>{drum.label}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                {drum.sounds.map(({ soundId, name }) => (
                  <button
                    key={soundId}
                    onClick={(e) => { e.stopPropagation(); onInsertSymbol(popup.slotIndex, soundId); setPopup(null); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#0f172a', border: '1px solid #334155', borderRadius: '4px', padding: '3px 7px', cursor: 'pointer' }}
                    title={name}
                  >
                    <span className="kendang-font" style={{ fontSize: '1.1rem', color: trackId === 'anak' ? '#111' : '#cc0000', lineHeight: 1 }}>{glyphFor(soundId, notationPack)}</span>
                    <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{name}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div style={{ borderTop: '1px solid #1e293b', paddingTop: '4px', marginTop: '2px' }}>
            <button
              onClick={(e) => { e.stopPropagation(); onInsertSymbol(popup.slotIndex, '.'); setPopup(null); }}
              style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '4px', padding: '3px 10px', cursor: 'pointer', color: '#64748b', fontSize: '0.75rem' }}
            >· Rust</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrackRow;
