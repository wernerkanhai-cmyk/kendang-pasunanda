import React, { useMemo, useState, useEffect, useRef } from 'react';
import './TrackRow.css';
import { SYMBOL_REST } from '../engine/patternLogic';

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
  if (['A', 'J', ';', ':', 'L', 'G', 'F'].includes(symbol)) return 'pos-above';
  if (['C', '?', 'V', 'S', 'N'].includes(symbol)) return 'pos-below';
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
  const emptyBeats = useMemo(() => {
    const found = [];
    for (let beatStart = 0; beatStart < slots.length; beatStart += 12) {
      const hasAny = slots.slice(beatStart, beatStart + 12).some(s => s.top !== '' || s.bottom !== '');
      if (!hasAny) found.push(beatStart);
    }
    return found;
  }, [slots]);

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

  // Beam Rendering Logic for 8ths (1 line) and 16ths (2 lines)
  const beams = useMemo(() => {
    const calculateBeamsForHand = (position) => {
       const handResults = [];
       for (let beatStart = 0; beatStart < slots.length; beatStart += 12) {
         const activeIndices = [];
         for (let i = 0; i < 12; i++) {
           const slot = slots[beatStart + i];
           const hasNote = (position === 'top') ? (slot.top !== '') : (slot.bottom !== '');
           if (hasNote) activeIndices.push(i);
         }
         
         if (activeIndices.length < 2) {
           // Special case: lone rest at beat start — if there are notes later in this beat
           // (in either hand), draw a level-1 beam so the rest shows its rhythmic value.
           if (activeIndices.length === 1 && activeIndices[0] === 0) {
             const thisSlot = slots[beatStart];
             const isRest = position === 'top' ? thisSlot.top === SYMBOL_REST : thisSlot.bottom === SYMBOL_REST;
             if (isRest) {
               let lastNoteIdx = 0;
               for (let i = 1; i < 12; i++) {
                 const s = slots[beatStart + i];
                 if (s.top !== '' || s.bottom !== '') lastNoteIdx = i;
               }
               if (lastNoteIdx > 0) {
                 handResults.push({ startIdx: beatStart, span: lastNoteIdx, level: 1, position });
               }
             }
           }
           continue;
         }
         if (activeIndices.length === 3 && activeIndices[0] === 0 && activeIndices[1] === 4 && activeIndices[2] === 8) continue; // Triplet overrides this

         // Level 1 Beam (8th note spacing umbrella) spans all notes in the beat
         const first = activeIndices[0];
         const last = activeIndices[activeIndices.length - 1];
         handResults.push({ startIdx: beatStart + first, span: last - first, level: 1, position });

         // Level 2 Beams (16th note spacing) span adjacent notes <= 3 slots apart
         let l2Start = -1;
         let prev = -1;
         for (let i = 0; i < activeIndices.length; i++) {
           const curr = activeIndices[i];
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
  }, [slots]);

  return (
    <div className={`track-row theme-${theme}`}>
      <div className="track-label">
        {trackId === 'anak' ? 'Anak' : 'Indung'}
      </div>
      
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

        {emptyBeats.map(beatStart => (
          <span
            key={`empty-${beatStart}`}
            className="kendang-font slot-empty-dot"
            style={{ left: (beatStart + 9) * slotWidth - 4 }}
          >.</span>
        ))}

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

              {slot.top !== '' && (
                <span
                  draggable
                  onDragStart={(e) => handleDragStart(e, index, 'top', slot.top)}
                  onDragEnd={() => setDragOverSlot(null)}
                  className={`kendang-font ${isRestTop ? 'slot-rest' : 'slot-symbol'} ${posClassTop} color-${trackId} draggable-note`}
                >
                  {slot.top}
                </span>
              )}
              {slot.bottom !== '' && (
                <span
                  draggable
                  onDragStart={(e) => handleDragStart(e, index, 'bottom', slot.bottom)}
                  onDragEnd={() => setDragOverSlot(null)}
                  className={`kendang-font ${isRestBottom ? 'slot-rest' : 'slot-symbol'} ${posClassBottom} color-${trackId} draggable-note`}
                >
                  {slot.bottom}
                </span>
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
