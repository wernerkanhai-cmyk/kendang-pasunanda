import { useMemo, useState, useEffect, useRef } from 'react';
import './TrackRow.css';
import { SYMBOL_REST, TOP_HAND_SYMBOLS, BOTTOM_HAND_SYMBOLS } from '../engine/patternLogic';

const DRUM_MENU = [
  { label: 'Ketipung', sounds: [{ symbol: 'N', name: 'Tung' }] },
  { label: 'Gedug',    sounds: [{ symbol: 'C', name: 'Dong' }, { symbol: '?', name: 'Ting' }, { symbol: 'V', name: 'Det' }] },
  { label: 'Kumpyang', sounds: [{ symbol: 'A', name: 'Pling' }, { symbol: 'J', name: 'Pang' }, { symbol: ';', name: 'Ping' }, { symbol: ':', name: 'Pong' }, { symbol: 'L', name: 'Plak' }] },
  { label: 'Kutiplak', sounds: [{ symbol: 'G', name: 'Pak' }, { symbol: 'F', name: 'Peung' }] },
];

const getVerticalPositionClass = (symbol, hand) => {
  if (symbol === SYMBOL_REST) {
      return hand === 'top' ? 'pos-above' : 'pos-below';
  }
  if (TOP_HAND_SYMBOLS.includes(symbol))    return 'pos-above';
  if (BOTTOM_HAND_SYMBOLS.includes(symbol)) return 'pos-below';
  return 'pos-line';
};

const TrackRow = ({ trackId, slots, theme, activeRange, onSlotClick, slotWidth = 12, onNoteMove, gridResolution = 6, gong = [], onInsertSymbol, onClearSlot }) => {
  const [dragOverSlot, setDragOverSlot] = useState(null);
  const [popup, setPopup] = useState(null); // { slotIndex, x, y }
  const lastTapRef = useRef({ slotIndex: -1, time: 0 });

  useEffect(() => {
    if (!popup) return;
    const close = () => setPopup(null);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [popup]);

  const openPopup = (e, slotIndex) => {
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
  // A standard bar is 48 slots. A beat is 12 slots. A 16th note step is 3 slots.

  // Triplet Detection Logic
  // A beat has 12 slots (indices 0 to 11).
  // A standard triplet sits at intervals of 4 slots: 0, 4, 8.
  // We scan every 12-slot chunk. If there are exactly three non-empty symbols
  // at relative indices 0, 4, 8, and the rest are empty, we mark it as a triplet.
  const triplets = useMemo(() => {
    const found = [];
    for (let beatStart = 0; beatStart < slots.length; beatStart += 12) {
      let notesInBeat = [];
      for (let i = 0; i < 12; i++) {
        const slot = slots[beatStart + i];
        const hasTop = slot.top !== '' && slot.top !== SYMBOL_REST;
        const hasBottom = slot.bottom !== '' && slot.bottom !== SYMBOL_REST;
        if (hasTop || hasBottom) {
          notesInBeat.push(i);
        }
      }
      
      if (notesInBeat.length === 3 && 
          notesInBeat[0] === 0 && notesInBeat[1] === 4 && notesInBeat[2] === 8) {
        found.push(beatStart); 
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

  // impliedRests: only pos 6 when pos 9 has a note (plek 3 → plek 4 lead-in).
  // Quarter rests (empty beat) are displayed via the data rest at pos 0 — no entry here.
  const impliedRests = useMemo(() => {
    const result = new Set();
    for (let barIdx = 0; barIdx < lastNoteInBar.length; barIdx++) {
      const barStart = barIdx * 48;
      const lastNote = lastNoteInBar[barIdx]; // -1 if bar is empty
      for (let beatOff = 0; beatOff < 48; beatOff += 12) {
        // Trailing silence: beats starting beyond the last note in a non-empty bar
        if (lastNote >= 0 && beatOff > lastNote) continue;
        const beatStart = barStart + beatOff;
        const beatHasNote = slots.slice(beatStart, beatStart + 12).some(s =>
          (s.top !== '' && s.top !== SYMBOL_REST) || (s.bottom !== '' && s.bottom !== SYMBOL_REST)
        );
        if (!beatHasNote) continue; // Empty beat: quarter rest via data rest, no implied rest
        const slot6 = slots[beatStart + 6];
        const slot9 = slots[beatStart + 9];
        if (!slot6 || !slot9) continue;
        for (const hand of ['top', 'bottom']) {
          if ((slot6[hand] === '' || slot6[hand] === SYMBOL_REST) &&
               slot9[hand] !== '' && slot9[hand] !== SYMBOL_REST) {
            result.add(`${beatStart + 6}-${hand}`);
          }
        }
      }
    }
    return result;
  }, [slots, lastNoteInBar]);

  // collapsedRests: suppress SYMBOL_REST dots per the hierarchy above.
  //   • Beat has notes → collapse ALL SYMBOL_REST in that beat (beam shows; no dots at
  //     pos 0/3 per spec). pos 6 is re-shown via impliedRests when pos 9 has a note.
  //   • Empty beat in trailing silence → collapse the quarter rest at pos 0.
  //   • Empty beat not in trailing silence → keep pos 0 data rest (quarter rest ✓).
  const collapsedRests = useMemo(() => {
    const result = new Set();
    for (let barIdx = 0; barIdx < lastNoteInBar.length; barIdx++) {
      const barStart = barIdx * 48;
      const lastNote = lastNoteInBar[barIdx];
      for (let beatOff = 0; beatOff < 48; beatOff += 12) {
        const beatStart = barStart + beatOff;
        const beatHasNote = slots.slice(beatStart, beatStart + 12).some(s =>
          (s.top !== '' && s.top !== SYMBOL_REST) || (s.bottom !== '' && s.bottom !== SYMBOL_REST)
        );
        if (beatHasNote) {
          // Collapse every SYMBOL_REST in the beat — beats with notes use beams, not dots
          for (let i = 0; i < 12; i++) {
            const s = slots[beatStart + i];
            if (!s) continue;
            if (s.top    === SYMBOL_REST) result.add(`${beatStart + i}-top`);
            if (s.bottom === SYMBOL_REST) result.add(`${beatStart + i}-bottom`);
          }
        } else {
          // Empty beat: collapse every SYMBOL_REST except pos 0.
          // Trailing silence → also collapse pos 0 (no quarter rest shown).
          const inTrailingSilence = lastNote >= 0 && beatOff > lastNote;
          for (let i = 0; i < 12; i++) {
            if (i === 0 && !inTrailingSilence) continue; // keep quarter rest at pos 0
            const s = slots[beatStart + i];
            if (!s) continue;
            if (s.top    === SYMBOL_REST) result.add(`${beatStart + i}-top`);
            if (s.bottom === SYMBOL_REST) result.add(`${beatStart + i}-bottom`);
          }
        }
      }
    }
    return result;
  }, [slots, lastNoteInBar]);

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
         if (activeIndices.length === 3 && activeIndices[0] === 0 && activeIndices[1] === 4 && activeIndices[2] === 8) continue; // Triplet overrides this

         const firstNote = activeIndices[0];
         const lastNote  = activeIndices[activeIndices.length - 1];

         // If there is a data rest at beat position 0 and the first actual note is
         // later, extend the level-1 beam back to beat start so the rest shows its
         // rhythmic value (and single notes at offset 6 still get a beam).
         const beatStartVal = position === 'top' ? slots[beatStart].top : slots[beatStart].bottom;
         const hasBeatStartRest = beatStartVal === SYMBOL_REST;
         const l1Start = (hasBeatStartRest && firstNote > 0) ? 0 : firstNote;
         const l1Span  = lastNote - l1Start;
         if (l1Span > 0) {
           handResults.push({ startIdx: beatStart + l1Start, span: l1Span, level: 1, position });
         }

         // Level 2 Beams (16th note spacing) — only for non-collapsed positions
         let l2Start = -1;
         let prev = -1;
         for (let i = 0; i < l2Indices.length; i++) {
           const curr = l2Indices[i];
           if (l2Start === -1) {
             l2Start = curr;
           } else {
             if (curr - prev > 3) {
                if (prev > l2Start) {
                   handResults.push({ startIdx: beatStart + l2Start, span: prev - l2Start, level: 2, position });
                }
                l2Start = curr;
             }
           }
           prev = curr;
         }
         if (l2Start !== -1 && prev > l2Start) {
            handResults.push({ startIdx: beatStart + l2Start, span: prev - l2Start, level: 2, position });
         }
       }
       return handResults;
    };

    const topBeams = calculateBeamsForHand('top');
    const bottomBeams = calculateBeamsForHand('bottom');
    return [...topBeams, ...bottomBeams];
  }, [slots, collapsedRests]);

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

          const isActive = activeRange && index >= activeRange.start && index <= activeRange.end;
          const isTripletStart = triplets.includes(index);

          // Gong block border via box-shadow (doesn't affect layout)
          const gongBlockStart = Math.floor(index / 6) * 6;
          const isInGong = gong.includes(gongBlockStart);
          const gongColor = trackId === 'anak' ? 'rgba(0,0,0,0.9)' : 'rgba(204,0,0,0.9)';
          let gongShadow = '';
          if (isInGong) {
            const s = [`inset 0 2px 0 0 ${gongColor}`, `inset 0 -2px 0 0 ${gongColor}`];
            if (index === gongBlockStart) s.push(`inset 2px 0 0 0 ${gongColor}`);
            if (index === gongBlockStart + 5) s.push(`inset -2px 0 0 0 ${gongColor}`);
            gongShadow = s.join(', ');
          }
          
          const isRestTop = slot.top === SYMBOL_REST;
          const posClassTop = getVerticalPositionClass(slot.top, 'top');
          
          const isRestBottom = slot.bottom === SYMBOL_REST;
          const posClassBottom = getVerticalPositionClass(slot.bottom, 'bottom');

          return (
            <div
              key={index}
              className={`slot-cell ${borderClasses} ${isActive ? 'active-slot' : ''} ${dragOverSlot === index ? 'drop-target' : ''}`}
              style={gongShadow ? { boxShadow: gongShadow } : undefined}
              onClick={(e) => { e.stopPropagation(); onSlotClick(index, e.shiftKey); }}
              onContextMenu={(e) => openPopup(e, index)}
              onTouchEnd={(e) => {
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
              {isTripletStart && (
                <div className={`triplet-slur color-${trackId} ${trackId === 'anak' ? 'pos-above' : 'pos-below'}`}>
                  <svg width="108" height="24" viewBox="0 0 108 24">
                    {trackId === 'anak' ? (
                      <path d="M 6 18 Q 54 2 102 18" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    ) : (
                      <path d="M 6 6 Q 54 22 102 6" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    )}
                    <text x="54" y={trackId === 'anak' ? "10" : "20"} textAnchor="middle" fontSize="10" fill="currentColor">3</text>
                  </svg>
                </div>
              )}

              {/* Data symbols (notes and data rests) */}
              {slot.top !== '' && !collapsedRests.has(`${index}-top`) && (
                <span
                  draggable
                  onDragStart={(e) => handleDragStart(e, index, 'top', slot.top)}
                  onDragEnd={() => setDragOverSlot(null)}
                  className={`kendang-font ${isRestTop ? 'slot-rest' : 'slot-symbol'} ${posClassTop} color-${trackId} draggable-note`}
                >
                  {slot.top}
                </span>
              )}
              {slot.bottom !== '' && !collapsedRests.has(`${index}-bottom`) && (
                <span
                  draggable
                  onDragStart={(e) => handleDragStart(e, index, 'bottom', slot.bottom)}
                  onDragEnd={() => setDragOverSlot(null)}
                  className={`kendang-font ${isRestBottom ? 'slot-rest' : 'slot-symbol'} ${posClassBottom} color-${trackId} draggable-note`}
                >
                  {slot.bottom}
                </span>
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
                {drum.sounds.map(({ symbol, name }) => (
                  <button
                    key={symbol}
                    onClick={(e) => { e.stopPropagation(); onInsertSymbol(popup.slotIndex, symbol); setPopup(null); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#0f172a', border: '1px solid #334155', borderRadius: '4px', padding: '3px 7px', cursor: 'pointer' }}
                    title={name}
                  >
                    <span className="kendang-font" style={{ fontSize: '1.1rem', color: trackId === 'anak' ? '#111' : '#cc0000', lineHeight: 1 }}>{symbol}</span>
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
