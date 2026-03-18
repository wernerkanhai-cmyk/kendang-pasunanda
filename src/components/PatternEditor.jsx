import React, { useEffect, useState, useRef } from 'react';
import TrackRow from './TrackRow';
import { generateEmptySlots } from '../engine/patternLogic';

const PatternEditor = ({ 
  pattern, 
  isActive, 
  onFocus, 
  updatePattern, 
  activeSlot, 
  setActiveSlot, 
  setInputMode, 
  clipboard, 
  setClipboard, 
  handleUndo, 
  handleRedo, 
  undoStack, 
  redoStack, 
  bpm, 
  handleBpmChange, 
  isRecording, 
  toggleRecord, 
  precount, 
  isPlaying,
  togglePlay,
  rewind,
  stepBack,
  gridResolution,
  magneticInput,
  setGridResolution,
  setMagneticInput,
  autoQuantize,
  setAutoQuantize,
  inputEnabled,
  setInputEnabled,
  savedSnippets, 
  handleSaveSnippet, 
  handleInsertSnippet, 
  handleDeleteSnippet,
  insertMeasure,
  deleteMeasure,
  onGongToggle,
  measureOffset = 0,
  loopingPatternId,
  onLoopPattern,
  soloTrack = null,
  onToggleSolo,
  precountPlay,
  setPrecountPlay,
  cursorOffsetMs = 0,
  adjustCursorOffset,
}) => {
  const [isNamingSnippet, setIsNamingSnippet] = useState(false);
  const [snippetName, setSnippetName] = useState('');
  const [snippetFolder, setSnippetFolder] = useState('Algemeen');
  const [isManagingSnippets, setIsManagingSnippets] = useState(false);
  const [gongMode, setGongMode] = useState(false);
  const timelineRef = useRef(null);
  const pendingSaveRange = useRef(null);
  const selectedRange = useRef(null);
  const [bpmEditing, setBpmEditing] = useState(false);
  const [bpmInput, setBpmInput] = useState('');
  const bpmDragRef = useRef(null); // { startY, moved }

  const totalMeasures = Math.ceil(pattern.anak.length / 48);
  const totalSlots = pattern.anak.length;

  const [slotWidth, setSlotWidth] = useState(12);
  useEffect(() => {
    if (!timelineRef.current) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width;
      setSlotWidth(Math.max(4, w / totalSlots));
    });
    ro.observe(timelineRef.current);
    return () => ro.disconnect();
  }, [totalSlots]);

  // Keep selectedRange ref tracking the LAST MULTI-SLOT selection.
  // Only update it when a genuine range is selected (start !== end).
  // This way, if a single-click accidentally resets activeSlot before clicking
  // a toolbar button, the multi-slot range is still available as fallback.
  useEffect(() => {
    if (!activeSlot || activeSlot.patternId !== pattern.id) return;
    if (activeSlot.startIndex !== undefined && activeSlot.endIndex !== undefined
        && activeSlot.startIndex !== activeSlot.endIndex) {
      selectedRange.current = {
        trackId: activeSlot.trackId,
        start: Math.min(activeSlot.startIndex, activeSlot.endIndex),
        end: Math.max(activeSlot.startIndex, activeSlot.endIndex)
      };
    }
  }, [activeSlot, pattern.id]);

  // 8-Measure Pagination Auto-Scroll during Playback
  useEffect(() => {
    if (isPlaying && isActive && activeSlot && timelineRef.current) {
        const currentSlot = activeSlot.startIndex;
        const measureIndex = Math.floor(currentSlot / 48);
        const pageIndex = Math.floor(measureIndex / 8);
        
        const targetScrollLeft = pageIndex * 8 * 48 * slotWidth;
        
        if (Math.abs(timelineRef.current.scrollLeft - targetScrollLeft) > 5) {
            timelineRef.current.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });
        }
    }
  }, [activeSlot, isPlaying, isActive]);
  
  const handleNameChange = (e) => {
    updatePattern({ ...pattern, name: e.target.value });
  };

  const getActiveRange = () => {
    if (!activeSlot || activeSlot.patternId !== pattern.id) return null;
    if (activeSlot.startIndex === undefined || activeSlot.endIndex === undefined) return null;

    const start = Math.min(activeSlot.startIndex, activeSlot.endIndex);
    const end = Math.max(activeSlot.startIndex, activeSlot.endIndex);
    return { trackId: activeSlot.trackId, start, end };
  };

  const emptySlot = (i) => ({ top: (i % 12 === 0) ? '.' : '', bottom: (i % 12 === 0) ? '.' : '' });

  const handleClear = () => {
    const range = getActiveRange() || selectedRange.current;
    if (!range) return;
    const newTrack = [...pattern[range.trackId]];
    for (let i = range.start; i <= range.end; i++) {
      newTrack[i] = emptySlot(i);
    }
    updatePattern({ ...pattern, [range.trackId]: newTrack });
  };

  const handleNoteMove = ({ fromTrackId, fromSlot, fromHand, toTrackId, toSlot, toHand, symbol }) => {
    const newAnak = [...pattern.anak];
    const newIndung = [...pattern.indung];
    const getTrack = (id) => id === 'anak' ? newAnak : newIndung;
    getTrack(fromTrackId)[fromSlot] = { ...getTrack(fromTrackId)[fromSlot], [fromHand]: '' };
    getTrack(toTrackId)[toSlot] = { ...getTrack(toTrackId)[toSlot], [toHand]: symbol };
    updatePattern({ ...pattern, anak: newAnak, indung: newIndung });
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only handle if this specific pattern editor is the currently active one
      if (!isActive) return;
      if (document.activeElement.tagName === 'INPUT') return; // Don't steal backspace from naming input
      
      if (e.key === 'Backspace' || e.key === 'Delete') {
        const range = getActiveRange();
        if (range) {
           e.preventDefault();
           handleClear();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, activeSlot, pattern]); // Essential dependencies so handleClear gets fresh state!

  const handleCopy = () => {
    const range = getActiveRange() || selectedRange.current;
    if (!range) return;
    setClipboard({
      trackId: range.trackId,
      data: JSON.parse(JSON.stringify(pattern[range.trackId].slice(range.start, range.end + 1))),
    });
  };

  const handleCut = () => {
    const range = getActiveRange() || selectedRange.current;
    if (!range) return;
    setClipboard({
      trackId: range.trackId,
      data: JSON.parse(JSON.stringify(pattern[range.trackId].slice(range.start, range.end + 1))),
    });
    const newTrack = [...pattern[range.trackId]];
    for (let i = range.start; i <= range.end; i++) {
      newTrack[i] = emptySlot(i);
    }
    updatePattern({ ...pattern, [range.trackId]: newTrack });
  };

  const handleSaveLocal = () => {
    const range = getActiveRange() || selectedRange.current;
    if (!range) return;
    // Capture the range NOW so it survives until the user confirms the name
    pendingSaveRange.current = range;
    setIsNamingSnippet(true);
  };

  const confirmSaveSnippet = () => {
    // Use the range captured at save-button-click time, NOT a fresh getActiveRange() call
    const range = pendingSaveRange.current;
    if (!range || !snippetName || snippetName.trim() === '') {
       setIsNamingSnippet(false);
       setSnippetName('');
       pendingSaveRange.current = null;
       return;
    }

    const trimmedName = snippetName.trim();
    const folder = snippetFolder || 'Algemeen';
    const copiedSymbols = {
      anak:   JSON.parse(JSON.stringify(pattern.anak.slice(range.start, range.end + 1))),
      indung: JSON.parse(JSON.stringify(pattern.indung.slice(range.start, range.end + 1))),
      gong:   (pattern.gong || [])
                .filter(g => g >= range.start && g <= range.end)
                .map(g => g - range.start),
    };

    // Check for duplicate name in same folder
    const duplicate = savedSnippets.find(s => s.name === trimmedName && (s.folder || 'Algemeen') === folder);
    if (duplicate) {
      const replace = window.confirm(`Een patroon met de naam "${trimmedName}" bestaat al in "${folder}".\n\nKlik OK om te vervangen, of Annuleren om een nieuw patroon op te slaan met een ander nummer.`);
      if (replace) {
        handleSaveSnippet(trimmedName, folder, copiedSymbols, duplicate.id);
      } else {
        let counter = 2;
        let uniqueName = `${trimmedName} ${counter}`;
        while (savedSnippets.some(s => s.name === uniqueName && (s.folder || 'Algemeen') === folder)) {
          counter++;
          uniqueName = `${trimmedName} ${counter}`;
        }
        handleSaveSnippet(uniqueName, folder, copiedSymbols);
      }
    } else {
      handleSaveSnippet(trimmedName, folder, copiedSymbols);
    }

    setIsNamingSnippet(false);
    setSnippetName('');
    pendingSaveRange.current = null;
  };
  
  const cancelSaveSnippet = () => {
     setIsNamingSnippet(false);
     setSnippetName('');
     pendingSaveRange.current = null;
  };

  const handlePaste = () => {
    const range = getActiveRange() || selectedRange.current;
    if (!clipboard || !range) return;
    // Plak naar de actieve track (clipboard.trackId bepaalt de bron, range.trackId de bestemming)
    const clipData = clipboard.data ?? clipboard; // compat met oud formaat
    const newTrack = [...pattern[range.trackId]];
    for (let i = 0; i < clipData.length; i++) {
      if (range.start + i < newTrack.length)
        newTrack[range.start + i] = JSON.parse(JSON.stringify(clipData[i]));
    }
    updatePattern({ ...pattern, [range.trackId]: newTrack });
  };

  const handleSlotClick = (trackId, slotIndex, isShift) => {
    onFocus();
    if (gongMode) {
      const blockStart = Math.floor(slotIndex / 6) * 6;
      onGongToggle(pattern.id, blockStart);
      return;
    }
    if (setInputMode) setInputMode(trackId);
    if (setActiveSlot) {
      if (isShift && activeSlot && activeSlot.patternId === pattern.id && activeSlot.trackId === trackId) {
        setActiveSlot({ ...activeSlot, endIndex: slotIndex });
      } else {
        setActiveSlot({ patternId: pattern.id, trackId, startIndex: slotIndex, endIndex: slotIndex });
      }
    }
  };

  const activeRangeObj = getActiveRange();

  return (
    <div 
      className={`pattern-container glass-panel ${isActive ? 'active-pattern' : ''}`}
      onClick={onFocus}
      style={{ 
        marginBottom: '2rem', 
        border: isActive ? '1px solid #3b82f6' : '1px solid var(--border-subtle)',
        boxShadow: isActive ? '0 0 20px rgba(59, 130, 246, 0.1)' : 'var(--shadow-lg)'
      }}
    >
      <div className="pattern-header" style={{ display: 'flex', alignItems: 'center' }}>
        <input 
          type="text" 
          value={pattern.name} 
          onChange={handleNameChange}
          className="pattern-name-input"
        />
        
        {/* Snippet Library Controls */}
        <div onClick={(e) => e.stopPropagation()} style={{ marginLeft: '1rem', display: 'flex', alignItems: 'center', gap: '0.3rem', position: 'relative' }}>
           {isNamingSnippet ? (
              <div style={{ display: 'flex', alignItems: 'center', background: '#0f172a', padding: '2px', borderRadius: '4px', gap: '4px' }}>
                <input 
                  autoFocus
                  type="text" 
                  value={snippetName}
                  onChange={(e) => setSnippetName(e.target.value)}
                  onKeyDown={(e) => { e.stopPropagation(); if(e.key === 'Enter') confirmSaveSnippet(); if(e.key === 'Escape') cancelSaveSnippet(); }}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Naam..."
                  style={{ background: 'transparent', color: '#fff', border: 'none', outline: 'none', width: '80px', fontSize: '0.8rem', padding: '0 4px' }}
                />
                <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.2)' }}></div>
                <input 
                  type="text" 
                  value={snippetFolder}
                  onChange={(e) => setSnippetFolder(e.target.value)}
                  onKeyDown={(e) => { e.stopPropagation(); if(e.key === 'Enter') confirmSaveSnippet(); if(e.key === 'Escape') cancelSaveSnippet(); }}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Map..."
                  style={{ background: 'transparent', color: '#cbd5e1', border: 'none', outline: 'none', width: '70px', fontSize: '0.8rem', padding: '0 4px' }}
                />
                <button onClick={(e) => { e.stopPropagation(); confirmSaveSnippet(); }} style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: '2px', padding: '2px 6px', fontSize: '0.7rem', cursor: 'pointer', marginLeft: '2px' }}>✓</button>
                <button onClick={(e) => { e.stopPropagation(); cancelSaveSnippet(); }} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: '2px', padding: '2px 6px', fontSize: '0.7rem', cursor: 'pointer', marginLeft: '2px' }}>✕</button>
              </div>
           ) : (
              <button 
                className="btn-secondary" 
                onClick={(e) => { e.stopPropagation(); handleSaveLocal(); }} 
                disabled={!activeRangeObj}
                style={{ 
                  padding: '0.3rem 0.5rem', 
                  fontSize: '1rem', 
                  background: activeRangeObj ? '#334155' : 'transparent', 
                  border: '1px solid ' + (activeRangeObj ? '#334155' : 'var(--border-subtle)'), 
                  color: activeRangeObj ? '#2dd4bf' : '#64748b', 
                  borderRadius: '4px', 
                  cursor: activeRangeObj ? 'pointer' : 'default' 
                }}
                title="Selectie Opslaan als Snippet"
              >
                💾
              </button>
           )}
           <select 
              value="" 
              onChange={(e) => {
                 if (e.target.value === '') return;
                 const selectedSnippet = savedSnippets.find(s => s.id === e.target.value);
                 if (selectedSnippet) {
                    handleInsertSnippet(selectedSnippet);
                 }
                 e.target.value = ''; // auto-reset
              }}
              style={{ background: '#1e293b', color: '#cbd5e1', border: '1px solid var(--border-focus)', borderRadius: '4px', padding: '0.3rem', fontSize: '0.8rem', cursor: 'pointer', minWidth: '150px' }}
           >
              <option value="">-- Plaatst op cursor --</option>
              {Array.from(new Set(savedSnippets.map(s => s.folder || 'Algemeen'))).sort().map(folderName => (
                 <optgroup key={folderName} label={folderName}>
                    {savedSnippets.filter(s => (s.folder || 'Algemeen') === folderName).map(snip => (
                       <option key={snip.id} value={snip.id}>{snip.name} ({(snip.data.anak ?? snip.data).length} slots)</option>
                    ))}
                 </optgroup>
              ))}
           </select>

           <button 
             onClick={(e) => { e.stopPropagation(); setIsManagingSnippets(!isManagingSnippets); }}
             style={{ background: isManagingSnippets ? '#334155' : 'transparent', color: '#cbd5e1', border: '1px solid var(--border-focus)', borderRadius: '4px', padding: '0.2rem 0.4rem', fontSize: '1rem', cursor: 'pointer' }}
             title="Beheer Snippets"
           >
             ⚙️
           </button>

           {/* Snippet Manager Overlay */}
           {isManagingSnippets && (
             <div style={{ position: 'absolute', top: '100%', left: '0', marginTop: '0.5rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '1rem', zIndex: 100, minWidth: '250px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', cursor: 'default' }} onClick={(e) => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem', borderBottom: '1px solid #334155', paddingBottom: '0.5rem' }}>
                   <h4 style={{ margin: 0, color: '#f8fafc', fontSize: '0.9rem' }}>Snippet Beheer</h4>
                   <button onClick={() => setIsManagingSnippets(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
                </div>
                
                {savedSnippets.length === 0 ? (
                   <div style={{ color: '#64748b', fontSize: '0.8rem', textAlign: 'center', padding: '1rem 0' }}>Geen patronen opgeslagen.</div>
                ) : (
                   <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                      {Array.from(new Set(savedSnippets.map(s => s.folder || 'Algemeen'))).sort().map(folderName => (
                         <div key={folderName} style={{ marginBottom: '1rem' }}>
                            <div style={{ fontSize: '0.75rem', color: '#38bdf8', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px', marginBottom: '0.3rem' }}>{folderName}</div>
                            {savedSnippets.filter(s => (s.folder || 'Algemeen') === folderName).map(snip => (
                               <div key={snip.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', marginBottom: '2px' }}>
                                  <span style={{ fontSize: '0.85rem', color: '#e2e8f0' }}>{snip.name} <span style={{ color: '#64748b', fontSize: '0.7rem' }}>({snip.trackId})</span></span>
                                  <button onClick={() => handleDeleteSnippet(snip.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0 4px', fontSize: '0.9rem' }} title="Verwijderen">🗑️</button>
                               </div>
                            ))}
                         </div>
                      ))}
                   </div>
                )}
             </div>
           )}
        </div>
        <div className="pattern-actions" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
           
           {isActive && (
              <div className="transport-controls" style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', padding: '2px', marginRight: '1rem' }}>
                 <div style={{ display: 'flex', flexDirection: 'column', padding: '0.2rem 0.5rem', background: '#1e293b', borderRadius: '4px' }}>
                    <span style={{ fontSize: '0.6rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Tempo</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <button onClick={(e) => { e.stopPropagation(); handleBpmChange(1); }} style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', padding: '0', fontSize: '0.7rem' }}>▲</button>
                          <button onClick={(e) => { e.stopPropagation(); handleBpmChange(-1); }} style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', padding: '0', fontSize: '0.7rem' }}>▼</button>
                       </div>
                       {bpmEditing ? (
                         <input
                           type="number"
                           value={bpmInput}
                           autoFocus
                           onChange={(e) => setBpmInput(e.target.value)}
                           onBlur={() => {
                             const val = parseInt(bpmInput, 10);
                             if (!isNaN(val)) handleBpmChange(Math.max(40, Math.min(240, val)) - bpm);
                             setBpmEditing(false);
                           }}
                           onKeyDown={(e) => {
                             if (e.key === 'Enter') e.currentTarget.blur();
                             if (e.key === 'Escape') setBpmEditing(false);
                             e.stopPropagation();
                           }}
                           style={{ width: '4ch', fontWeight: 'bold', fontSize: '1.2rem', color: '#fff', background: '#334155', border: '1px solid #60a5fa', borderRadius: '3px', textAlign: 'center', padding: '0.1rem' }}
                         />
                       ) : (
                         <span
                           style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#fff', textAlign: 'center', touchAction: 'none', userSelect: 'none', cursor: 'ns-resize', padding: '0.4rem 0.6rem', display: 'inline-block' }}
                           onPointerDown={(e) => {
                             e.currentTarget.setPointerCapture(e.pointerId);
                             bpmDragRef.current = { startY: e.clientY, moved: false };
                           }}
                           onPointerMove={(e) => {
                             if (!bpmDragRef.current) return;
                             const delta = bpmDragRef.current.startY - e.clientY;
                             if (Math.abs(delta) >= 5) {
                               bpmDragRef.current.moved = true;
                               handleBpmChange(delta > 0 ? 1 : -1);
                               bpmDragRef.current.startY = e.clientY;
                             }
                           }}
                           onPointerUp={() => {
                             if (bpmDragRef.current && !bpmDragRef.current.moved) {
                               setBpmInput(String(bpm));
                               setBpmEditing(true);
                             }
                             bpmDragRef.current = null;
                           }}
                         >{bpm}</span>
                       )}
                    </div>
                 </div>
                 
                 <button
                   onClick={(e) => { e.stopPropagation(); stepBack(); }}
                   style={{
                     background: 'transparent',
                     color: '#94a3b8',
                     border: '1px solid #475569',
                     padding: '0.4rem 0.6rem',
                     borderRadius: '4px',
                     cursor: 'pointer',
                     fontSize: '1rem',
                     marginLeft: '0.5rem'
                   }}
                   title="1 maat terug"
                 >
                   ◀
                 </button>

                 <button
                   onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                   onDoubleClick={(e) => { e.stopPropagation(); rewind(); }}
                   style={{
                     background: isPlaying ? '#22c55e' : 'transparent',
                     color: isPlaying ? '#fff' : '#22c55e',
                     border: isPlaying ? 'none' : '1px solid #22c55e',
                     padding: '0.4rem 0.8rem',
                     borderRadius: '4px',
                     cursor: 'pointer',
                     fontSize: '1rem',
                     fontWeight: 'bold',
                     display: 'flex',
                     alignItems: 'center',
                     height: '2.2rem',
                     boxSizing: 'border-box',
                     marginLeft: '0.5rem'
                   }}
                   title="Play / Pause (Dubbelklik voor begin van de maat)"
                 >
                   {isPlaying ? '⏸' : '▶'}
                 </button>

                 <button
                   onClick={(e) => { e.stopPropagation(); adjustCursorOffset && adjustCursorOffset(-50); }}
                   style={{
                     background: 'transparent',
                     color: '#a78bfa',
                     border: '1px solid #a78bfa',
                     padding: '0.4rem 0.5rem',
                     borderRadius: '4px 0 0 4px',
                     cursor: 'pointer',
                     fontSize: '0.75rem',
                     height: '2.2rem',
                     boxSizing: 'border-box',
                     marginLeft: '0.5rem',
                     borderRight: 'none',
                   }}
                   title="Cursor eerder (−50ms)"
                 >◀</button>
                 <span style={{
                   background: 'transparent',
                   color: '#a78bfa',
                   border: '1px solid #a78bfa',
                   padding: '0 0.4rem',
                   fontSize: '0.7rem',
                   height: '2.2rem',
                   display: 'inline-flex',
                   alignItems: 'center',
                   boxSizing: 'border-box',
                   borderLeft: 'none',
                   borderRight: 'none',
                   minWidth: '3.5rem',
                   justifyContent: 'center',
                 }}>{cursorOffsetMs > 0 ? `+${cursorOffsetMs}` : cursorOffsetMs}ms</span>
                 <button
                   onClick={(e) => { e.stopPropagation(); adjustCursorOffset && adjustCursorOffset(50); }}
                   style={{
                     background: 'transparent',
                     color: '#a78bfa',
                     border: '1px solid #a78bfa',
                     padding: '0.4rem 0.5rem',
                     borderRadius: '0 4px 4px 0',
                     cursor: 'pointer',
                     fontSize: '0.75rem',
                     height: '2.2rem',
                     boxSizing: 'border-box',
                     borderLeft: 'none',
                     marginRight: '0.25rem',
                   }}
                   title="Cursor later (+50ms)"
                 >▶</button>

                 <button
                   onClick={(e) => { e.stopPropagation(); onLoopPattern(pattern.id); }}
                   style={{
                     background: loopingPatternId === pattern.id ? '#f97316' : 'transparent',
                     color: loopingPatternId === pattern.id ? '#fff' : '#f97316',
                     border: loopingPatternId === pattern.id ? 'none' : '1px solid #f97316',
                     padding: '0.4rem 0.8rem',
                     borderRadius: '4px',
                     cursor: 'pointer',
                     fontSize: '1rem',
                     fontWeight: 'bold',
                     display: 'flex',
                     alignItems: 'center',
                     height: '2.2rem',
                     boxSizing: 'border-box',
                     marginLeft: '0.25rem',
                   }}
                   title="Loop deze regel"
                 >
                   ↺
                 </button>

                 <button
                   onClick={(e) => { e.stopPropagation(); toggleRecord(); }}
                   className={isRecording ? 'recording-pulse' : ''}
                   style={{ 
                     background: 'transparent', 
                     color: '#ef4444', 
                     border: isRecording ? '2px solid #ef4444' : '1px solid #64748b', 
                     padding: '0.6rem', 
                     borderRadius: '50%', 
                     cursor: 'pointer', 
                     display: 'flex',
                     alignItems: 'center',
                     justifyContent: 'center',
                     marginLeft: '0.5rem',
                     width: '32px',
                     height: '32px'
                   }}
                   title={isRecording === 'precount' ? `Precount: ${precount}` : "Opnemen"}
                 >
                   <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444' }}></div>
                 </button>
              </div>
           )}
           {isActive && activeRangeObj && (
             <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: '0.5rem', marginRight: '1rem', background: 'rgba(0,0,0,0.2)', padding: '0.3rem 0.5rem', borderRadius: '4px', alignItems: 'center' }}>
                <button
                  onClick={(e) => { e.stopPropagation(); setMagneticInput(!magneticInput); }}
                  style={{ background: magneticInput ? '#3b82f6' : 'transparent', color: magneticInput ? '#fff' : '#64748b', border: magneticInput ? 'none' : '1px solid var(--border-focus)', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                  title="Magneet (Snap to Grid)"
                >
                  🧲
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setPrecountPlay(!precountPlay); }}
                  style={{ background: precountPlay ? '#f97316' : 'transparent', color: precountPlay ? '#fff' : '#64748b', border: precountPlay ? 'none' : '1px solid var(--border-focus)', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                  title="Precount voor play (4 tellen aanloop)"
                >
                  4
                </button>
                <button
                  className="btn-secondary"
                  onClick={(e) => { e.stopPropagation(); setAutoQuantize(!autoQuantize); }}
                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', background: autoQuantize ? '#16a34a' : 'transparent', border: autoQuantize ? 'none' : '1px solid var(--border-focus)', color: autoQuantize ? '#fff' : '#64748b', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                  title="Auto-quantize (snap live opname naar grid)"
                >
                  Q
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setInputEnabled(!inputEnabled); }}
                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', background: inputEnabled ? '#16a34a' : '#64748b', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                  title={inputEnabled ? 'Invoer aan — klik om uit te zetten' : 'Invoer uit — klik om aan te zetten'}
                >
                  ✏️
                </button>
                <select 
                  value={gridResolution} 
                  onChange={(e) => { e.stopPropagation(); setGridResolution(Number(e.target.value)); }}
                  onClick={(e) => e.stopPropagation()}
                  style={{ background: '#1e293b', color: '#cbd5e1', border: '1px solid var(--border-focus)', borderRadius: '4px', padding: '0.2rem', fontSize: '0.8rem', cursor: 'pointer' }}
                  title="Grid Resolutie"
                >
                  <option value="12">1/4</option>
                  <option value="16">1/4T</option>
                  <option value="6">1/8</option>
                  <option value="4">1/8T</option>
                  <option value="3">1/16</option>
                  <option value="2">1/16T</option>
                </select>
                
             </div>
           )}
           <button
             onClick={(e) => { e.stopPropagation(); setGongMode(m => !m); }}
             style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem', fontWeight: 'bold', background: gongMode ? 'rgba(212,175,55,0.25)' : 'transparent', border: `1px solid ${gongMode ? '#d4af37' : 'var(--border-focus)'}`, color: gongMode ? '#d4af37' : '#94a3b8', borderRadius: '4px', cursor: 'pointer' }}
             title="Gong-modus: klik op een blokje om gong aan/uit te zetten"
           >
             ◯ Gong
           </button>
        </div>
      </div>

      {isActive && (
        <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.25rem 1rem', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.15)' }}>
          <button
            onClick={(e) => { e.stopPropagation(); handleUndo(); }}
            disabled={undoStack.length === 0}
            style={{ background: 'transparent', color: undoStack.length > 0 ? '#e2e8f0' : '#475569', padding: '0.15rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border-focus)', cursor: undoStack.length > 0 ? 'pointer' : 'default', fontSize: '0.85rem' }}
            title="Ongedaan maken"
          >↩️ Undo</button>
          <button
            onClick={(e) => { e.stopPropagation(); handleRedo(); }}
            disabled={redoStack.length === 0}
            style={{ background: 'transparent', color: redoStack.length > 0 ? '#e2e8f0' : '#475569', padding: '0.15rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border-focus)', cursor: redoStack.length > 0 ? 'pointer' : 'default', fontSize: '0.85rem' }}
            title="Opnieuw uitvoeren"
          >↪️ Redo</button>

          <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)', margin: '0 0.2rem' }} />

          <button
            onClick={(e) => { e.stopPropagation(); handleCopy(); }}
            disabled={!activeRangeObj}
            style={{ padding: '0.25rem 0.45rem', background: activeRangeObj ? '#334155' : 'transparent', border: '1px solid var(--border-focus)', color: activeRangeObj ? '#e2e8f0' : '#475569', borderRadius: '4px', cursor: activeRangeObj ? 'pointer' : 'default', display: 'flex', alignItems: 'center' }}
            title="Kopiëren"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="1" width="8" height="9" rx="1"/>
              <rect x="1" y="5" width="8" height="9" rx="1" style={{fill:'#334155'}}/>
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleCut(); }}
            disabled={!activeRangeObj}
            style={{ padding: '0.25rem 0.45rem', background: activeRangeObj ? '#334155' : 'transparent', border: '1px solid var(--border-focus)', color: activeRangeObj ? '#e2e8f0' : '#475569', borderRadius: '4px', cursor: activeRangeObj ? 'pointer' : 'default', display: 'flex', alignItems: 'center' }}
            title="Knippen"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="3.5" cy="3.5" r="2"/>
              <circle cx="3.5" cy="11.5" r="2"/>
              <line x1="5.4" y1="4.9" x2="14" y2="10.5"/>
              <line x1="5.4" y1="10.1" x2="14" y2="4.5"/>
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handlePaste(); }}
            disabled={!clipboard || !activeRangeObj}
            style={{ padding: '0.25rem 0.45rem', background: clipboard && activeRangeObj ? '#334155' : 'transparent', border: '1px solid var(--border-focus)', color: clipboard && activeRangeObj ? '#e2e8f0' : '#475569', borderRadius: '4px', cursor: clipboard && activeRangeObj ? 'pointer' : 'default', display: 'flex', alignItems: 'center' }}
            title="Plakken"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="9" height="10" rx="1"/>
              <path d="M5 4V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1"/>
              <line x1="4" y1="8" x2="9" y2="8"/>
              <line x1="4" y1="10.5" x2="9" y2="10.5"/>
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleClear(); }}
            disabled={!activeRangeObj}
            style={{ padding: '0.25rem 0.45rem', background: activeRangeObj ? '#450a0a' : 'transparent', border: '1px solid var(--border-focus)', color: activeRangeObj ? '#fca5a5' : '#475569', borderRadius: '4px', cursor: activeRangeObj ? 'pointer' : 'default', display: 'flex', alignItems: 'center' }}
            title="Wissen"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 13L8.5 4L13 8.5L7 13Z"/>
              <line x1="0.5" y1="13" x2="14.5" y2="13"/>
            </svg>
          </button>
        </div>
      )}

      <div className="timeline-wrapper" ref={timelineRef}>
        {/* Measure Ruler */}
        <div className="measure-ruler" style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '8px', height: '16px', color: '#64748b' }}>
           {Array.from({ length: totalMeasures }).map((_, i) => (
              <div key={i} style={{ width: 48 * slotWidth + 'px', flexShrink: 0, textAlign: 'left', paddingLeft: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                 {i + 1 + measureOffset}
              </div>
           ))}
        </div>

        {/* Track rows with gong overlay */}
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button
              onClick={(e) => { e.stopPropagation(); onToggleSolo('anak'); }}
              style={{
                flexShrink: 0, width: '20px', height: '20px', marginRight: '4px', marginBottom: '70px',
                background: soloTrack === 'anak' ? '#f97316' : 'transparent',
                color: soloTrack === 'anak' ? '#fff' : '#f97316',
                border: '1px solid #f97316', borderRadius: '3px',
                cursor: 'pointer', fontSize: '0.65rem', fontWeight: 'bold',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              title="Solo anak"
            >S</button>
            <div style={{ flex: 1 }}>
              <TrackRow
                trackId="anak"
                slots={pattern.anak}
                theme="anak"
                activeRange={activeRangeObj?.trackId === 'anak' ? activeRangeObj : null}
                onSlotClick={(index, isShift) => handleSlotClick('anak', index, isShift)}
                gridResolution={gridResolution}
                slotWidth={slotWidth}
                onNoteMove={handleNoteMove}
              />
            </div>
          </div>

          {/* The thin central line connecting Anak and Indung visually */}
          <div style={{ height: '2px', background: 'var(--border-subtle)', width: '100%', margin: '4px 0' }}></div>

          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button
              onClick={(e) => { e.stopPropagation(); onToggleSolo('indung'); }}
              style={{
                flexShrink: 0, width: '20px', height: '20px', marginRight: '4px', marginBottom: '70px',
                background: soloTrack === 'indung' ? '#f97316' : 'transparent',
                color: soloTrack === 'indung' ? '#fff' : '#f97316',
                border: '1px solid #f97316', borderRadius: '3px',
                cursor: 'pointer', fontSize: '0.65rem', fontWeight: 'bold',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              title="Solo indung"
            >S</button>
            <div style={{ flex: 1 }}>
              <TrackRow
                trackId="indung"
                slots={pattern.indung}
                theme="indung"
                activeRange={activeRangeObj?.trackId === 'indung' ? activeRangeObj : null}
                onSlotClick={(index, isShift) => handleSlotClick('indung', index, isShift)}
                gridResolution={gridResolution}
                slotWidth={slotWidth}
                onNoteMove={handleNoteMove}
              />
            </div>
          </div>

          {/* Gong markering — anak (zwart) + indung (rood) */}
          {(pattern.gong || []).flatMap(blockStart => [
            <div
              key={`${blockStart}-anak`}
              style={{
                position: 'absolute',
                left: blockStart * slotWidth + 3,
                top: -2,
                height: 82,
                width: 6 * slotWidth,
                border: '3px solid rgba(0,0,0,0.8)',
                borderRadius: '1px',
                pointerEvents: 'none',
                zIndex: 15,
                backgroundImage: 'linear-gradient(to bottom, transparent calc(50% - 1.5px), rgba(0,0,0,0.75) calc(50% - 1.5px), rgba(0,0,0,0.75) calc(50% + 1.5px), transparent calc(50% + 1.5px))',
              }}
            />,
            <div
              key={`${blockStart}-indung`}
              style={{
                position: 'absolute',
                left: blockStart * slotWidth + 3,
                bottom: -2,
                height: 82,
                width: 6 * slotWidth,
                border: '3px solid rgba(204,0,0,0.8)',
                borderRadius: '1px',
                pointerEvents: 'none',
                zIndex: 15,
                backgroundImage: 'linear-gradient(to bottom, transparent calc(50% - 1.5px), rgba(204,0,0,0.75) calc(50% - 1.5px), rgba(204,0,0,0.75) calc(50% + 1.5px), transparent calc(50% + 1.5px))',
              }}
            />,
          ])}
        </div>
      </div>
    </div>
  );
};

export default PatternEditor;
