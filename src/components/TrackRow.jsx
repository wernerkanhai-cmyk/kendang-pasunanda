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
  const touchDragRef = useRef(null); // { slotIndex, hand, symbol, offsetX, offsetY }
  const ghostRef = useRef(null);
  const touchMovedRef = useRef(false);

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

  // Touch drag-and-drop (iOS/iPad — HTML5 drag API not supported)
  const handleTouchStart = (e, slotIndex, hand, symbol) => {
    e.stopPropagation();
    touchMovedRef.current = false;
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

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
    return () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onNoteMove, trackId]);
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

  // quarterRests: beat-start slots where the beat is empty and not in trailing silence.
  // Rendered as explicit top+bottom dots — independent of SYMBOL_REST data state.
  const quarterRests = useMemo(() => {
    const result = new Set();
    for (let barIdx = 0; barIdx < lastNoteInBar.length; barIdx++) {
      const barStart = barIdx * 48;
      const lastNote = lastNoteInBar[barIdx];
      for (let beatOff = 0; beatOff < 48; beatOff += 12) {
        if (lastNote >= 0 && beatOff > lastNote) continue; // trailing silence
        const beatStart = barStart + beatOff;
        const beatHasNote = slots.slice(beatStart, beatStart + 12).some(s =>
          (s.top !== '' && s.top !== SYMBOL_REST) || (s.bottom !== '' && s.bottom !== SYMBOL_REST)
        );
        if (!beatHasNote) result.add(beatStart);
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
        if (lastNote >= 0 && beatOff > lastNote) continue;
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
         if (activeIndices.length === 3 && activeIndices[0] === 0 && activeIndices[1] === 4 && activeIndices[2] === 8) continue; // Triplet overrides this

         const firstNote = activeIndices[0];
         const lastNote  = activeIndices[activeIndices.length - 1];

         // If there is a rest at beat position 0 (data or implied) and the first
         // actual note is later, extend the level-1 beam back to beat start so the
         // rest shows its rhythmic value (and single notes at offset 6 still get a beam).
         const beatStartVal = position === 'top' ? slots[beatStart].top : slots[beatStart].bottom;
         const hasBeatStartRest = beatStartVal === SYMBOL_REST || impliedRests.has(`${beatStart}-${position}`);
         const l1Start = (hasBeatStartRest && firstNote > 0) ? 0 : firstNote;
         const l1Span  = lastNote - l1Start;
         if (l1Span > 0) {
           handResults.push({ startIdx: beatStart + l1Start, span: l1Span, level: 1, position });
         }

         // Level 2 Beams: draw when any note is at a 16th-note position (offset % 6 ≠ 0).
         // Same span as the level-1 beam so single 16th notes also get a double beam.
         const has16th = activeIndices.some(i => i % 6 !== 0);
         if (has16th && l1Span > 0) {
           handResults.push({ startIdx: beatStart + l1Start, span: l1Span, level: 2, position });
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

        {/* Gong block overlays — 4px naar links verschoven t.o.v. het grid */}
        {gong.map(blockStart => {
          const gongColor = trackId === 'anak' ? 'rgba(0,0,0,0.9)' : 'rgba(204,0,0,0.9)';
          return (
            <div
              key={`gong-${blockStart}`}
              style={{
                position: 'absolute',
                top: 0,
                height: '100%',
                left: blockStart * slotWidth - 4,
                width: 6 * slotWidth,
                border: `2px solid ${gongColor}`,
                pointerEvents: 'none',
                zIndex: 5,
                boxSizing: 'border-box',
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

          const isActive = activeRange && index >= activeRange.start && index <= activeRange.end;
          const isTripletStart = triplets.includes(index);
          
          const isRestTop = slot.top === SYMBOL_REST;
          const posClassTop = getVerticalPositionClass(slot.top, 'top');

          const isRestBottom = slot.bottom === SYMBOL_REST;
          const posClassBottom = getVerticalPositionClass(slot.bottom, 'bottom');

          return (
            <div
              key={index}
              data-slot-index={index}
              className={`slot-cell ${borderClasses} ${isActive ? 'active-slot' : ''} ${dragOverSlot === index ? 'drop-target' : ''}`}
              onClick={(e) => { e.stopPropagation(); onSlotClick(index, e.shiftKey); }}
              onContextMenu={(e) => openPopup(e, index)}
              onTouchEnd={(e) => {
                // Suppress double-tap if a touch drag just completed
                if (touchMovedRef.current) return;
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
                  onTouchStart={(e) => handleTouchStart(e, index, 'top', slot.top)}
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
                  onTouchStart={(e) => handleTouchStart(e, index, 'bottom', slot.bottom)}
                  className={`kendang-font ${isRestBottom ? 'slot-rest' : 'slot-symbol'} ${posClassBottom} color-${trackId} draggable-note`}
                >
                  {slot.bottom}
                </span>
              )}
              {/* Quarter rest: empty beat, not trailing silence → dot on both lines */}
              {index % 12 === 0 && quarterRests.has(index) && (
                <span className={`kendang-font slot-rest pos-above color-${trackId}`}>{SYMBOL_REST}</span>
              )}
              {index % 12 === 0 && quarterRests.has(index) && (
                <span className={`kendang-font slot-rest pos-below color-${trackId}`}>{SYMBOL_REST}</span>
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
