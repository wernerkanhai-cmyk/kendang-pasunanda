import { useEffect, useState, useRef, Fragment } from 'react';
import ReactDOM from 'react-dom';
import TrackRow from './TrackRow';
import TempoTrack from './TempoTrack';
import { generateEmptySlots, writeSymbolToPattern, getHandForSound, toggleAccentInRange, SYMBOL_REST } from '../engine/patternLogic';
import { useT } from '../i18n';

const PatternEditor = ({
  pattern,
  notationPack,
  instrumentPack,
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
  inheritedBpm,
  realtimeBpm = null,
  handleBpmChange,
  onDrumTrigger,
  isRecording,
  isPlaying,
  togglePlay,
  rewind,
  stepBack,
  stepBackCount,
  gridResolution,
  magneticInput,
  setGridResolution,
  setMagneticInput,
  autoQuantize,
  setAutoQuantize,
  onSnapToGrid,
  inputEnabled,
  setInputEnabled,
  savedSnippets,
  handleSaveSnippet,
  handleInsertSnippet,
  handleDeleteSnippet,
  handleRenameSnippet,
  handleMoveSnippetToFolder,
  handleRenameSnippetFolder,
  handleDeleteSnippetFolder,
  handleDeleteSnippetSilently,
  factorySnippets = [],
  isAdmin = false,
  onPublishSnippetTemplate,
  onRemoveSnippetTemplate,
  handleExportSnippets,
  handleImportSnippets,
  insertMeasure,
  deleteMeasure,
  deleteMeasuresFromEnd,
  measureOffset = 0,
  loopRange = null,
  soloTrack = null,
  onToggleSolo,
  metronomeMode,
  setMetronomeMode,
  metronomeVolume = 0.7,
  setMetronomeVolume,
  onUpdateTempoTrack,
  onToggleTempoTrack,
  onToggleAllTempoOpen,
  onToggleAllTempoEnabled,
  globalTempoOpenSignal,
  onSeek,
  onDuplicate,
  onDelete,
  canDelete = true,
  trackVolumes = { anak: 1.0, indung: 1.0 },
  onTrackVolumeChange,
  isLocked = false,
  isLooped = false,
  onToggleSectionLoop,
  onRulerLoop,
  onClearRulerLoop,
}) => {
  const t = useT();
  const [isNamingSnippet, setIsNamingSnippet] = useState(false);
  const [snippetName, setSnippetName] = useState('');
  const [snippetFolder, setSnippetFolder] = useState('Algemeen');
  const [isManagingSnippets, setIsManagingSnippets] = useState(false);
  const [snippetSelectKey, setSnippetSelectKey] = useState(0);
  const [renamingSnippetId, setRenamingSnippetId] = useState(null);
  const [renamingSnippetInput, setRenamingSnippetInput] = useState('');
  const [renamingSnippetFolder, setRenamingSnippetFolder] = useState(null);
  const [renamingSnippetFolderInput, setRenamingSnippetFolderInput] = useState('');
  const [moveSnippetTarget, setMoveSnippetTarget] = useState(null); // snippet object
  const [moveSnippetFolderInput, setMoveSnippetFolderInput] = useState('');
  const [collapsedSnippetFolders, setCollapsedSnippetFolders] = useState(() => new Set());
  const [snippetSelection, setSnippetSelection] = useState(() => new Set());
  const [showMetronomeMenu, setShowMetronomeMenu] = useState(false);
  const [metronomeMenuPos, setMetronomeMenuPos] = useState({ top: 0, left: 0 });
  const metronomeBtnRef = useRef(null);
  const metronomeHoldRef = useRef(null); // timeout id voor long-press detectie
  const [touchSelectMode, setTouchSelectMode] = useState(false);
  const [rulerDrag, setRulerDrag] = useState(null); // { start, current } in measure indices
  const [handleDrag, setHandleDrag] = useState(null); // { side: 'start'|'end', start: slot, end: slot }
  const timelineRef = useRef(null);
  const tracksContainerRef = useRef(null);
  const playheadDragRef = useRef(false);
  const pendingSaveRange = useRef(null);
  const selectedRange = useRef(null);
  const [editingName, setEditingName] = useState(false);
  const [blinkBtn, setBlinkBtn] = useState(null); // short flash on toolbar buttons
  const blink = (id, fn) => { fn(); setBlinkBtn(id); setTimeout(() => setBlinkBtn(null), 150); };
  const totalMeasures = Math.ceil(pattern.anak.length / 48);
  const totalSlots = pattern.anak.length;

  const [slotWidth, setSlotWidth] = useState(12);
  const [containerWidth, setContainerWidth] = useState(0);

  // Sluit de snippet-dropdowns zodra deze regel niet meer de actieve is (of bij
  // het wisselen van regel), zodat het beheerpaneel/de laad-dropdown niet open
  // blijft hangen op een regel waar je niet meer werkt.
  useEffect(() => {
    setIsManagingSnippets(false);
    setSnippetSelection(new Set());
    setSnippetSelectKey(k => k + 1); // remount de laad-<select> zodat ook die dichtgaat
  }, [isActive, pattern.id]);
  const baseSlotWidthRef = useRef(12);
  useEffect(() => {
    if (!timelineRef.current) return;
    // Vaste opbouw rond de slots in een track-rij:
    //   solo-knop-cel = 19px + 2px marginRight = 21px (links)
    //   rechter gutter spacer = 24px
    // Trek dat af zodat 4 maten (192 slots) zonder overflow in de viewport
    // passen — anders valt het uiteinde rechts buiten beeld op een iPhone.
    const TRACK_OVERHEAD = 45;
    const ro = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width;
      const usable = Math.max(0, w - TRACK_OVERHEAD);
      baseSlotWidthRef.current = usable / 192;
      setSlotWidth(Math.max(1, baseSlotWidthRef.current));
      setContainerWidth(w);
    });
    ro.observe(timelineRef.current);
    return () => ro.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalSlots]);

  // Overflow alleen toestaan als de content daadwerkelijk breder is dan de container.
  // Zo voorkomt iOS de rubber-band/bounce als er niets te scrollen valt.
  const timelineOverflows = totalSlots * slotWidth > containerWidth + 1;

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

  // Scroll playhead into view after stepBack
  useEffect(() => {
    if (!stepBackCount || !isActive || !activeSlot || !timelineRef.current) return;
    const currentSlot = activeSlot.startIndex;
    const targetScrollLeft = Math.floor(currentSlot / 48) * 48 * slotWidth;
    timelineRef.current.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });
  }, [stepBackCount]);
  
  const handleNameChange = (e) => {
    updatePattern({ ...pattern, name: e.target.value });
  };

  const handleAnnotationChange = (measureIdx, text) => {
    const annotations = { ...(pattern.annotations || {}) };
    if (text.trim()) {
      annotations[measureIdx] = text;
    } else {
      delete annotations[measureIdx];
    }
    updatePattern({ ...pattern, annotations });
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
    if (isLocked) return;
    const range = getActiveRange() || selectedRange.current;
    if (!range) return;
    const newTrack = [...pattern[range.trackId]];
    for (let i = range.start; i < range.end; i++) {
      newTrack[i] = emptySlot(i);
    }
    updatePattern({ ...pattern, [range.trackId]: newTrack });
  };

  // When clearing a single slot, replace with rest if notes exist later in the same beat
  const clearSlotWithRestFill = (trackId, slotIndex) => {
    if (isLocked) return;
    const newTrack = [...pattern[trackId]];
    const beatEnd = Math.floor(slotIndex / 12) * 12 + 12;
    const slot = newTrack[slotIndex];
    const newSlot = { ...slot };
    for (const hand of ['top', 'bottom']) {
      if (slot[hand] && slot[hand] !== '') {
        const hasNotesAfter = newTrack.slice(slotIndex + 1, beatEnd)
          .some(s => s[hand] && s[hand] !== '');
        newSlot[hand] = hasNotesAfter ? SYMBOL_REST : '';
      }
    }
    newTrack[slotIndex] = newSlot;
    updatePattern({ ...pattern, [trackId]: newTrack });
  };

  const handleClearPattern = () => {
    const newAnak = pattern.anak.map((_, i) => emptySlot(i));
    const newIndung = pattern.indung.map((_, i) => emptySlot(i));
    updatePattern({ ...pattern, anak: newAnak, indung: newIndung });
  };

  const handleNoteMove = ({ fromTrackId, fromSlot, fromHand, toTrackId, toSlot, toHand, symbol }) => {
    if (isLocked) return;
    const newAnak = [...pattern.anak];
    const newIndung = [...pattern.indung];
    const getTrack = (id) => id === 'anak' ? newAnak : newIndung;

    // Remember source accent so it follows the note
    const fromAccentKey = fromHand === 'top' ? 'accentTop' : 'accentBottom';
    const toAccentKey   = toHand   === 'top' ? 'accentTop' : 'accentBottom';
    const sourceAccent  = getTrack(fromTrackId)[fromSlot]?.[fromAccentKey] === true;

    // Clear source slot (symbol + its accent)
    getTrack(fromTrackId)[fromSlot] = { ...getTrack(fromTrackId)[fromSlot], [fromHand]: '', [fromAccentKey]: false };

    // If there are notes AFTER the source in the same beat on the same hand,
    // replace source with a rest (to preserve the beat gap in notation)
    const fromBeatEnd = Math.floor(fromSlot / 12) * 12 + 12;
    const fromTrack = getTrack(fromTrackId);
    const hasNotesAfterFrom = fromTrack.slice(fromSlot + 1, fromBeatEnd)
      .some(s => { const v = s[fromHand]; return v !== '' && v !== SYMBOL_REST; });
    if (hasNotesAfterFrom) {
      fromTrack[fromSlot] = { ...fromTrack[fromSlot], [fromHand]: SYMBOL_REST };
    }

    // Place note at destination (carrying the source accent)
    getTrack(toTrackId)[toSlot] = { ...getTrack(toTrackId)[toSlot], [toHand]: symbol, [toAccentKey]: sourceAccent };

    // Auto-fill rests before destination in its beat (same as handleInsertSymbol)
    if (symbol !== SYMBOL_REST) {
      const toBeatStart = Math.floor(toSlot / 12) * 12;
      const toTrack = getTrack(toTrackId);
      for (let g = toBeatStart; g < toSlot; g += gridResolution) {
        if (!toTrack[g][toHand]) toTrack[g] = { ...toTrack[g], [toHand]: SYMBOL_REST };
      }
    }

    updatePattern({ ...pattern, anak: newAnak, indung: newIndung });
  };

  const handleToggleAccent = () => {
    if (isLocked) return;
    if (!activeSlot || activeSlot.patternId !== pattern.id) return;
    const start = Math.min(activeSlot.startIndex, activeSlot.endIndex ?? activeSlot.startIndex);
    const end   = Math.max(activeSlot.startIndex, activeSlot.endIndex ?? activeSlot.startIndex);
    const updated = toggleAccentInRange(pattern, activeSlot.trackId, start, end);
    updatePattern(updated);
  };

  const handleInsertSymbol = (trackId, slotIndex, symbol) => {
    if (isLocked) return;
    let updated = writeSymbolToPattern(pattern, trackId, slotIndex, symbol);
    if (symbol !== SYMBOL_REST) {
      const hand = getHandForSound(symbol);
      const beatStart = Math.floor(slotIndex / 12) * 12;
      for (let g = beatStart; g < slotIndex; g += gridResolution) {
        const slot = updated[trackId][g];
        if (hand === 'top' || hand === 'both') {
          if (!slot.top) slot.top = SYMBOL_REST;
        }
        if (hand === 'bottom' || hand === 'both') {
          if (!slot.bottom) slot.bottom = SYMBOL_REST;
        }
      }
    }
    updatePattern(updated);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only handle if this specific pattern editor is the currently active one
      if (!isActive) return;
      if (document.activeElement.tagName === 'INPUT') return; // Don't steal backspace from naming input

      if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        handleUndo?.();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        handleRedo?.();
        return;
      }

      if (e.key === 'Backspace' || e.key === 'Delete') {
        const range = getActiveRange();
        if (range) {
           e.preventDefault();
           handleClear();
        }
        return;
      }

      // '>' (Shift+.) toggles accent on every note in the active selection
      if (e.key === '>') {
        const range = getActiveRange();
        if (range) {
          e.preventDefault();
          handleToggleAccent();
        }
        return;
      }

      // Keyboard input: typ het glyph van het geluid dat je wilt spelen.
      // De mapping volgt de actieve NotationPack (soundToGlyph), zodat een
      // gebruiker met een andere notatie zijn eigen glyph-toetsen krijgt.
      // De rest is universeel '.'.
      const keyToSound = {};
      keyToSound['.'] = '.';
      const map = notationPack?.soundToGlyph || {};
      for (const [sound, glyph] of Object.entries(map)) {
        keyToSound[glyph] = sound;
        if (/^[A-Z]$/.test(glyph)) keyToSound[glyph.toLowerCase()] = sound;
      }
      const sound = keyToSound[e.key];
      if (sound && onDrumTrigger) {
        e.preventDefault();
        onDrumTrigger(sound, activeSlot?.trackId || 'anak');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, activeSlot, pattern, isPlaying, isLocked, notationPack]); // isLocked ensures handleClear sees latest lock state

  const handleCopy = () => {
    const range = getActiveRange() || selectedRange.current;
    if (!range) return;
    setClipboard({
      trackId: range.trackId,
      data: JSON.parse(JSON.stringify(pattern[range.trackId].slice(range.start, range.end))),
    });
  };

  const handleCut = () => {
    if (isLocked) return;
    const range = getActiveRange() || selectedRange.current;
    if (!range) return;
    setClipboard({
      trackId: range.trackId,
      data: JSON.parse(JSON.stringify(pattern[range.trackId].slice(range.start, range.end))),
    });
    const newTrack = [...pattern[range.trackId]];
    for (let i = range.start; i < range.end; i++) {
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
      anak:   JSON.parse(JSON.stringify(pattern.anak.slice(range.start, range.end))),
      indung: JSON.parse(JSON.stringify(pattern.indung.slice(range.start, range.end))),
      gong:   (pattern.gong || [])
                .filter(g => g >= range.start && g < range.end)
                .map(g => g - range.start),
    };

    // Duplicaat-afhandeling zit centraal in App.handleSaveSnippet: bij een al
    // bestaande naam toont die de 3-keuze (overschrijven / nummeren / annuleren),
    // net zoals bij songs.
    handleSaveSnippet(trimmedName, folder, copiedSymbols);

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
    if (isLocked) return;
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
    // Zet de playhead aan het eind van het geplakte fragment (geklemd binnen de track),
    // zodat je direct vanaf daar verder kunt — consistent met snippet-invoegen.
    if (setActiveSlot) {
      const endSlot = Math.min(newTrack.length - 1, range.start + clipData.length);
      setActiveSlot({ patternId: pattern.id, trackId: range.trackId, startIndex: endSlot, endIndex: endSlot });
    }
  };

  const snapSlot = (slot) => magneticInput
    ? Math.round(slot / gridResolution) * gridResolution
    : slot;

  const handleSlotClick = (trackId, slotIndex, isShift) => {
    onFocus();
    if (setInputMode) setInputMode(trackId);
    const snapped = snapSlot(slotIndex);
    if (isPlaying && onSeek) {
      onSeek(pattern.id, snapped);
      return;
    }
    if (setActiveSlot) {
      if (isShift && activeSlot && activeSlot.patternId === pattern.id && activeSlot.trackId === trackId) {
        setActiveSlot({ ...activeSlot, endIndex: snapped });
      } else {
        setActiveSlot({ patternId: pattern.id, trackId, startIndex: snapped, endIndex: snapped });
      }
    }
  };

  const handleRulerDoubleClick = (measureIdx) => {
    if (!loopRangeObj) {
      // Geen loop actief → stel in op 1 maat
      onRulerLoop?.(measureIdx * 48, (measureIdx + 1) * 48);
      return;
    }
    // Loop actief → dubbelklik op elke willekeurige maat deactiveert de loop
    onClearRulerLoop?.();
  };

  const handleRulerPointerDown = (e, measureIdx) => {
    e.preventDefault();
    setRulerDrag({ start: measureIdx, current: measureIdx });
    const onMove = (ev) => {
      const ruler = e.currentTarget?.closest('.measure-ruler');
      if (!ruler) return;
      const rect = ruler.getBoundingClientRect();
      const x = ev.clientX - rect.left - SOLO_BTN_W;
      const mw = 48 * slotWidth;
      const m = Math.max(0, Math.min(totalMeasures - 1, Math.floor(x / mw)));
      setRulerDrag(prev => prev ? { ...prev, current: m } : null);
    };
    const onUp = () => {
      setRulerDrag(prev => {
        if (!prev) return null;
        // Only create a loop if the user actually dragged across multiple measures.
        // A single click (start === current) should do nothing — the double-click
        // handler takes care of toggling 1-measure loops.
        if (prev.start !== prev.current) {
          const startM = Math.min(prev.start, prev.current);
          const endM = Math.max(prev.start, prev.current);
          const startSlot = startM * 48;
          const endSlot = (endM + 1) * 48;
          onRulerLoop?.(startSlot, endSlot);
        }
        return null;
      });
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handleLoopHandlePointerDown = (e, side) => {
    e.preventDefault();
    e.stopPropagation();
    if (!loopRangeObj) return;
    const rulerEl = e.currentTarget.parentElement; // direct parent = .measure-ruler
    const initialStart = loopRangeObj.start;
    const initialEnd = loopRangeObj.end;
    const mw = 48 * slotWidth;
    let dragStart = initialStart;
    let dragEnd = initialEnd;
    setHandleDrag({ side, start: initialStart, end: initialEnd });
    const onMove = (ev) => {
      if (!rulerEl) return;
      const rect = rulerEl.getBoundingClientRect();
      const x = Math.max(0, ev.clientX - rect.left - SOLO_BTN_W);
      const snappedMeasure = Math.max(0, Math.min(totalMeasures, Math.round(x / mw)));
      const newSlot = snappedMeasure * 48;
      if (side === 'start') {
        dragStart = Math.min(newSlot, dragEnd - 48);
      } else {
        dragEnd = Math.max(newSlot, dragStart + 48);
      }
      setHandleDrag({ side, start: dragStart, end: dragEnd });
    };
    const onUp = () => {
      onRulerLoop?.(dragStart, dragEnd);
      setHandleDrag(null);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const activeRangeObj = getActiveRange();

  // Loop range for this pattern (voor grid highlight):
  // — ruler-selectie heeft voorrang; anders: hele section als isLooped actief is
  const loopRangeObj = (loopRange?.patternId === pattern.id)
    ? { start: loopRange.startSlot, end: loopRange.endSlot }
    : isLooped
      ? { start: 0, end: pattern.anak.length }
      : null;

  const SOLO_BTN_W = 24; // 20px button + 4px margin
  const playheadSlot = (activeSlot?.patternId === pattern.id && activeSlot?.startIndex !== undefined)
    ? activeSlot.startIndex : null;

  const handlePlayheadPointerDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Pointer capture: alle volgende pointer events komen naar dit element,
    // ook als de vinger/muis snel buiten het driehoekje beweegt.
    e.currentTarget.setPointerCapture(e.pointerId);
    const onMove = (ev) => {
      if (!tracksContainerRef.current) return;
      const rect = tracksContainerRef.current.getBoundingClientRect();
      const x = ev.clientX - rect.left - SOLO_BTN_W;
      const raw = Math.max(0, Math.min(totalSlots - 1, Math.round(x / slotWidth)));
      const slot = snapSlot(raw);
      if (isPlaying) {
        onSeek?.(pattern.id, slot);
      } else {
        setActiveSlot({ patternId: pattern.id, trackId: activeSlot?.trackId || 'anak', startIndex: slot, endIndex: slot });
      }
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

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
      <div className="pattern-header" style={{ display: isLocked ? 'none' : 'flex', alignItems: 'center' }}>
        <input
          type="text"
          value={pattern.name}
          onChange={handleNameChange}
          onFocus={(e) => {
            setEditingName(true);
            setTimeout(() => e.target.scrollIntoView({ block: 'nearest', behavior: 'instant' }), 50);
          }}
          onBlur={(e) => {
            // Check if the focus is moving to an annotation input — if so, keep editing open.
            setTimeout(() => {
              const active = document.activeElement;
              if (active && active.dataset?.annotationField) return;
              setEditingName(false);
            }, 50);
          }}
          className="pattern-name-input"
          style={{ fontSize: '16px' }}
        />

        {/* Snippet Library Controls */}
        <div onClick={(e) => e.stopPropagation()} style={{ marginLeft: '0.5rem', display: !isLocked ? 'flex' : 'none', alignItems: 'center', gap: '0.3rem', position: 'relative' }}>
           {isNamingSnippet ? (
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', background: '#0f172a', padding: '2px', borderRadius: '4px', gap: '4px' }}>
                  <input
                    autoFocus
                    type="text"
                    value={snippetName}
                    onChange={(e) => setSnippetName(e.target.value)}
                    onKeyDown={(e) => { e.stopPropagation(); if(e.key === 'Enter') confirmSaveSnippet(); if(e.key === 'Escape') cancelSaveSnippet(); }}
                    onClick={(e) => e.stopPropagation()}
                    onFocus={(e) => e.target.scrollIntoView({ block: 'nearest', behavior: 'instant' })}
                    placeholder={t('snippetNamePlaceholder')}
                    style={{ background: 'transparent', color: '#fff', border: 'none', outline: 'none', width: '80px', fontSize: '16px', padding: '0 4px' }}
                  />
                  <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.2)' }} />
                  {(() => {
                    const existingFolders = Array.from(new Set(savedSnippets.map(s => s.folder || 'Algemeen'))).sort();
                    const isCustom = snippetFolder && !existingFolders.includes(snippetFolder);
                    return isCustom ? (
                      <input
                        type="text"
                        autoFocus
                        value={snippetFolder}
                        onChange={(e) => setSnippetFolder(e.target.value)}
                        onKeyDown={(e) => { e.stopPropagation(); if(e.key === 'Enter') confirmSaveSnippet(); if(e.key === 'Escape') { setSnippetFolder('Algemeen'); } }}
                        onClick={(e) => e.stopPropagation()}
                        onFocus={(e) => e.target.scrollIntoView({ block: 'nearest', behavior: 'instant' })}
                        placeholder={t('snippetFolderPlaceholder')}
                        style={{ background: 'transparent', color: '#cbd5e1', border: 'none', outline: 'none', width: '90px', fontSize: '16px', padding: '0 4px' }}
                      />
                    ) : (
                      <select
                        value={snippetFolder || 'Algemeen'}
                        onChange={(e) => {
                          if (e.target.value === '__NEW__') {
                            setSnippetFolder('');
                          } else {
                            setSnippetFolder(e.target.value);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        style={{ background: '#0f172a', color: '#cbd5e1', border: 'none', outline: 'none', fontSize: '14px', padding: '0 2px', cursor: 'pointer', maxWidth: '110px' }}
                      >
                        {existingFolders.map(f => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                        <option value="__NEW__">+ Nieuwe map...</option>
                      </select>
                    );
                  })()}
                  <button onClick={(e) => { e.stopPropagation(); confirmSaveSnippet(); }} style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: '2px', padding: '2px 6px', fontSize: '0.7rem', cursor: 'pointer', marginLeft: '2px' }}>✓</button>
                  <button onClick={(e) => { e.stopPropagation(); cancelSaveSnippet(); }} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: '2px', padding: '2px 6px', fontSize: '0.7rem', cursor: 'pointer', marginLeft: '2px' }}>✕</button>
                </div>
                {savedSnippets.length > 0 && (() => {
                  const byFolder = savedSnippets.reduce((acc, s) => {
                    const f = s.folder || 'Algemeen';
                    if (!acc[f]) acc[f] = [];
                    acc[f].push(s);
                    return acc;
                  }, {});
                  return (
                    <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', zIndex: 200, minWidth: '200px', maxHeight: '200px', overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }} onClick={(e) => e.stopPropagation()}>
                      {Object.keys(byFolder).sort().map(f => (
                        <div key={f}>
                          <div style={{ color: '#475569', fontSize: '0.65rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0.25rem 0.5rem 0.1rem' }}>📁 {f}</div>
                          {byFolder[f].map(snip => (
                            <button key={snip.id}
                              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setSnippetName(snip.name); setSnippetFolder(snip.folder || 'Algemeen'); }}
                              style={{ display: 'block', width: '100%', textAlign: 'left', background: snip.name === snippetName && (snip.folder || 'Algemeen') === snippetFolder ? 'rgba(59,130,246,0.2)' : 'none', color: '#94a3b8', border: 'none', padding: '0.2rem 0.75rem', fontSize: '0.78rem', cursor: 'pointer' }}
                            >{snip.name}</button>
                          ))}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
           ) : (
              <button
                className="btn-secondary"
                onPointerDown={(e) => { e.stopPropagation(); if (activeRangeObj) handleSaveLocal(); }}
                style={{ 
                  padding: '0.3rem 0.5rem', 
                  fontSize: '1rem', 
                  background: activeRangeObj ? 'rgba(96,165,250,0.22)' : 'transparent',
                  border: '1px solid #60a5fa',
                  color: '#60a5fa',
                  borderRadius: '4px',
                  boxShadow: '0 0 6px rgba(45,212,191,0.55)',
                  cursor: activeRangeObj ? 'pointer' : 'default' 
                }}
                title={t('saveSnippetTooltip')}
              >
                💾
              </button>
           )}
           <select
              key={snippetSelectKey}
              defaultValue=""
              onChange={(e) => {
                 if (e.target.value === '') return;
                 const selectedSnippet = savedSnippets.find(s => s.id === e.target.value);
                 if (selectedSnippet) {
                    handleInsertSnippet(selectedSnippet);
                 }
                 // Force remount so the same snippet can be picked again immediately
                 setSnippetSelectKey(k => k + 1);
              }}
              style={{ background: 'transparent', color: '#60a5fa', border: '1px solid #60a5fa', borderRadius: '4px', padding: '0.3rem', fontSize: '0.8rem', cursor: 'pointer', minWidth: '150px', boxShadow: '0 0 6px rgba(96,165,250,0.45)' }}
           >
              <option value="">{t('placedAtCursor')}</option>
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
             style={{ background: isManagingSnippets ? 'rgba(96,165,250,0.22)' : 'transparent', color: '#60a5fa', border: '1px solid #60a5fa', borderRadius: '4px', padding: '0.2rem 0.4rem', fontSize: '1rem', cursor: 'pointer', boxShadow: '0 0 6px rgba(34,211,238,0.55)' }}
             title={t('manageSnippetsTooltip')}
           >
             ⚙️
           </button>

           <button
             onClick={(e) => { e.stopPropagation(); onDuplicate?.(); }}
             style={{ background: 'transparent', color: '#60a5fa', border: '1px solid #60a5fa', borderRadius: '4px', padding: '0.2rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer', boxShadow: '0 0 6px rgba(34,197,94,0.55)' }}
             title={t('duplicatePattern')}
           >⧉</button>

           {!isLocked && (
             <button
               onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
               disabled={!canDelete}
               style={{ background: 'transparent', color: '#60a5fa', border: '1px solid #60a5fa', borderRadius: '4px', padding: '0.2rem 0.5rem', fontSize: '0.75rem', cursor: canDelete ? 'pointer' : 'default', opacity: canDelete ? 1 : 0.35, boxShadow: '0 0 6px rgba(239,68,68,0.55)' }}
               title="Delete section"
             >🗑</button>
           )}

           {!isLocked && (() => {
             const canDel = totalMeasures > 1;
             return (
               <button
                 onClick={(e) => { e.stopPropagation(); if (canDel) deleteMeasuresFromEnd?.(1); }}
                 disabled={!canDel}
                 style={{ background: 'transparent', color: '#60a5fa', border: '1px solid #60a5fa', borderRadius: '4px', padding: '0.2rem 0.4rem', fontSize: '0.7rem', cursor: canDel ? 'pointer' : 'default', opacity: canDel ? 1 : 0.35, boxShadow: '0 0 6px rgba(251,146,60,0.55)' }}
                 title="Verwijder laatste maat"
               >−1⊣</button>
             );
           })()}

           {/* Snippet Manager Overlay */}
           {isManagingSnippets && (() => {
             const toggleSnippetSelection = (id) => {
               setSnippetSelection(prev => {
                 const next = new Set(prev);
                 if (next.has(id)) next.delete(id); else next.add(id);
                 return next;
               });
             };
             const toggleSnippetFolderSelection = (snipsInFolder) => {
               setSnippetSelection(prev => {
                 const next = new Set(prev);
                 const allOn = snipsInFolder.every(s => next.has(s.id));
                 if (allOn) snipsInFolder.forEach(s => next.delete(s.id));
                 else snipsInFolder.forEach(s => next.add(s.id));
                 return next;
               });
             };
             const toggleSnippetFolderCollapsed = (folder) => {
               setCollapsedSnippetFolders(prev => {
                 const next = new Set(prev);
                 if (next.has(folder)) next.delete(folder); else next.add(folder);
                 return next;
               });
             };
             const handleBulkDeleteSnippets = async () => {
               if (snippetSelection.size === 0) return;
               const ids = Array.from(snippetSelection);
               if (!window.confirm(`Weet je zeker dat je ${ids.length} patroon${ids.length === 1 ? '' : 'en'} wilt verwijderen?\n\nDeze actie kan niet ongedaan worden gemaakt.`)) return;
               for (const id of ids) {
                 // eslint-disable-next-line no-await-in-loop
                 try { await handleDeleteSnippetSilently?.(id); } catch (_) { /* ignore */ }
               }
               setSnippetSelection(new Set());
             };
             return (
             <div style={{ position: 'absolute', top: '100%', left: '0', marginTop: '0.5rem', background: '#161f30', border: '1px solid #2b3650', borderRadius: '14px', padding: '1rem 1.1rem', zIndex: 100, minWidth: '320px', boxShadow: '0 18px 44px rgba(0,0,0,0.55)', cursor: 'default' }} onClick={(e) => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem', borderBottom: '1px solid #334155', paddingBottom: '0.5rem' }}>
                   <h4 style={{ margin: 0, color: '#f8fafc', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><span>🧩</span>{t('snippetManagement')}</h4>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                     {snippetSelection.size > 0 && (
                       <button
                         onClick={handleBulkDeleteSnippets}
                         style={{ background: 'transparent', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '999px', padding: '0.3rem 0.8rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                         title="Verwijder geselecteerde patronen"
                       >Delete ({snippetSelection.size})</button>
                     )}
                     <button onClick={handleExportSnippets} style={{ background: 'transparent', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.4)', borderRadius: '999px', padding: '0.3rem 0.8rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }} title={t('exportSnippets')}>{t('exportSnippets')}</button>
                     {isAdmin && snippetSelection.size > 0 && (
                       <button
                         onClick={async () => {
                           const selected = savedSnippets.filter(s => snippetSelection.has(s.id));
                           for (const s of selected) {
                             try { await onPublishSnippetTemplate?.(s); } catch (err) { console.error('Publish failed:', err); }
                           }
                           setSnippetSelection(new Set());
                         }}
                         style={{ background: 'transparent', color: '#d4af37', border: '1px solid rgba(212,175,55,0.4)', borderRadius: '999px', padding: '0.3rem 0.8rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                         title="Publiceer geselecteerde snippets als templates"
                       >📦 Publiceer ({snippetSelection.size})</button>
                     )}
                     <label style={{ background: 'transparent', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.4)', borderRadius: '999px', padding: '0.3rem 0.8rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }} title={t('importSnippetsTooltip')}>
                       {t('importSnippets')}
                       <input type="file" accept=".kendang" style={{ display: 'none' }} onChange={handleImportSnippets} />
                     </label>
                     <button onClick={() => { setIsManagingSnippets(false); setSnippetSelection(new Set()); }} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
                   </div>
                </div>

                {/* Factory snippet templates — read-only, always at top */}
                {(() => {
                  const tplFolderName = '__SNIPPET_TEMPLATES__';
                  const isCollapsed = collapsedSnippetFolders.has(tplFolderName);
                  return factorySnippets.length > 0 || true ? ( // always show, even when empty
                    <div style={{ marginBottom: '0.6rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem', borderBottom: '1px solid #d4af37', paddingBottom: '0.2rem' }}>
                        <button
                          onClick={() => toggleSnippetFolderCollapsed(tplFolderName)}
                          style={{ background: 'none', border: 'none', color: '#d4af37', cursor: 'pointer', fontSize: '0.7rem', padding: '0 0.15rem', lineHeight: 1 }}
                        >{isCollapsed ? '▶' : '▼'}</button>
                        <span
                          onClick={() => toggleSnippetFolderCollapsed(tplFolderName)}
                          style={{ flex: 1, color: '#d4af37', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer' }}
                        >📦 Templates <span style={{ color: '#a37f1e', fontWeight: 'normal' }}>({factorySnippets.length})</span></span>
                      </div>
                      {!isCollapsed && (factorySnippets.length === 0 ? (
                        <div style={{ color: '#64748b', fontSize: '0.75rem', fontStyle: 'italic', padding: '0.3rem 0.5rem' }}>
                          Nog geen snippet templates beschikbaar.
                        </div>
                      ) : (() => {
                        const byCategory = factorySnippets.reduce((acc, s) => {
                          const cat = s.category || 'Algemeen';
                          if (!acc[cat]) acc[cat] = [];
                          acc[cat].push(s);
                          return acc;
                        }, {});
                        Object.values(byCategory).forEach(arr => arr.sort((a, b) => a.name.localeCompare(b.name)));
                        return Object.keys(byCategory).sort().map(cat => {
                          const subKey = `__SNIPPET_TEMPLATES__/${cat}`;
                          const subCollapsed = collapsedSnippetFolders.has(subKey);
                          const items = byCategory[cat];
                          return (
                            <div key={cat} style={{ marginLeft: '0.5rem', marginBottom: '0.25rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.15rem 0', borderBottom: '1px dashed #3f2e10', marginBottom: '0.15rem' }}>
                                <button
                                  onClick={() => toggleSnippetFolderCollapsed(subKey)}
                                  style={{ background: 'none', border: 'none', color: '#a37f1e', cursor: 'pointer', fontSize: '0.65rem', padding: '0 0.1rem', lineHeight: 1 }}
                                  title={subCollapsed ? 'Map openklappen' : 'Map dichtklappen'}
                                >{subCollapsed ? '▶' : '▼'}</button>
                                <span
                                  onClick={() => toggleSnippetFolderCollapsed(subKey)}
                                  style={{ flex: 1, color: '#a37f1e', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer' }}
                                >{cat} <span style={{ color: '#7a5e16', fontWeight: 'normal' }}>({items.length})</span></span>
                              </div>
                              {!subCollapsed && items.map(tpl => (
                                <div key={tpl.id} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.5rem 0.3rem 1rem', background: 'rgba(212,175,55,0.05)', borderRadius: '4px', marginBottom: '2px' }}>
                                  <span style={{ flex: 1, fontSize: '0.85rem', color: '#fcd34d' }}>{tpl.name}</span>
                                  <button
                                    onClick={() => handleInsertSnippet?.(tpl)}
                                    style={{ background: '#d4af37', color: '#1e293b', border: 'none', borderRadius: '4px', padding: '0.2rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 'bold' }}
                                  >Insert</button>
                                  {isAdmin && (
                                    <button
                                      onClick={async () => {
                                        if (!window.confirm(`Snippet template "${tpl.name}" verwijderen?`)) return;
                                        try { await onRemoveSnippetTemplate?.(tpl.id); } catch (err) { alert(err?.message ?? 'Verwijderen mislukt'); }
                                      }}
                                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0 4px', display: 'flex', alignItems: 'center' }}
                                      title="Template verwijderen"
                                    >
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                                      </svg>
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          );
                        });
                      })())}
                    </div>
                  ) : null;
                })()}

                {savedSnippets.length === 0 ? (
                   <div style={{ color: '#64748b', fontSize: '0.8rem', textAlign: 'center', padding: '1rem 0' }}>{t('noPatternsStored')}</div>
                ) : (
                   <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                      {Array.from(new Set(savedSnippets.map(s => s.folder || 'Algemeen'))).sort().map(folderName => {
                         const snipsInFolder = savedSnippets.filter(s => (s.folder || 'Algemeen') === folderName);
                         const isCollapsed = collapsedSnippetFolders.has(folderName);
                         const allChecked = snipsInFolder.length > 0 && snipsInFolder.every(s => snippetSelection.has(s.id));
                         const someChecked = !allChecked && snipsInFolder.some(s => snippetSelection.has(s.id));
                         return (
                         <div key={folderName} style={{ marginBottom: '0.6rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem', borderBottom: '1px solid #1e293b', paddingBottom: '0.2rem' }}>
                              <input
                                type="checkbox"
                                checked={allChecked}
                                ref={(el) => { if (el) el.indeterminate = someChecked; }}
                                onChange={() => toggleSnippetFolderSelection(snipsInFolder)}
                                style={{ accentColor: '#a78bfa', cursor: 'pointer' }}
                                title="Selecteer hele map"
                              />
                              {renamingSnippetFolder === folderName ? (
                                <input
                                  autoFocus
                                  value={renamingSnippetFolderInput}
                                  onChange={(e) => setRenamingSnippetFolderInput(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') { handleRenameSnippetFolder?.(folderName, renamingSnippetFolderInput); setRenamingSnippetFolder(null); }
                                    if (e.key === 'Escape') setRenamingSnippetFolder(null);
                                  }}
                                  onBlur={() => { handleRenameSnippetFolder?.(folderName, renamingSnippetFolderInput); setRenamingSnippetFolder(null); }}
                                  style={{ flex: 1, background: '#0f172a', color: '#e2e8f0', border: '1px solid #38bdf8', borderRadius: '3px', padding: '0.1rem 0.3rem', fontSize: '0.75rem', fontWeight: 'bold' }}
                                />
                              ) : (
                                <>
                                  <button
                                    onClick={() => toggleSnippetFolderCollapsed(folderName)}
                                    style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', fontSize: '0.7rem', padding: '0 0.15rem', lineHeight: 1 }}
                                    title={isCollapsed ? 'Map openklappen' : 'Map dichtklappen'}
                                  >{isCollapsed ? '▶' : '▼'}</button>
                                  <span
                                    onClick={() => toggleSnippetFolderCollapsed(folderName)}
                                    style={{ flex: 1, fontSize: '0.75rem', color: '#38bdf8', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px', cursor: 'pointer' }}
                                  >📁 {folderName} <span style={{ color: '#475569', fontWeight: 'normal' }}>({snipsInFolder.length})</span></span>
                                  <button
                                    onClick={() => { setRenamingSnippetFolder(folderName); setRenamingSnippetFolderInput(folderName); }}
                                    style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '0.7rem', padding: '0 0.2rem' }}
                                    title="Mapnaam wijzigen"
                                  >✏</button>
                                  <button
                                    onClick={() => handleDeleteSnippetFolder?.(folderName)}
                                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0 0.2rem', display: 'flex', alignItems: 'center' }}
                                    title="Hele map verwijderen"
                                  >
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                                    </svg>
                                  </button>
                                </>
                              )}
                            </div>
                            {!isCollapsed && snipsInFolder.map(snip => (
                               <div key={snip.id} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', marginBottom: '2px' }}>
                                  <input
                                    type="checkbox"
                                    checked={snippetSelection.has(snip.id)}
                                    onChange={() => toggleSnippetSelection(snip.id)}
                                    style={{ accentColor: '#a78bfa', cursor: 'pointer' }}
                                  />
                                  {renamingSnippetId === snip.id ? (
                                    <input
                                      autoFocus
                                      value={renamingSnippetInput}
                                      onChange={(e) => setRenamingSnippetInput(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') { handleRenameSnippet?.(snip, renamingSnippetInput); setRenamingSnippetId(null); }
                                        if (e.key === 'Escape') setRenamingSnippetId(null);
                                      }}
                                      onBlur={() => { handleRenameSnippet?.(snip, renamingSnippetInput); setRenamingSnippetId(null); }}
                                      style={{ flex: 1, background: '#0f172a', color: '#e2e8f0', border: '1px solid #3b82f6', borderRadius: '3px', padding: '0.15rem 0.4rem', fontSize: '0.85rem' }}
                                    />
                                  ) : (
                                    <span style={{ flex: 1, fontSize: '0.85rem', color: '#e2e8f0' }}>{snip.name}</span>
                                  )}
                                  <button
                                    onClick={() => { setRenamingSnippetId(snip.id); setRenamingSnippetInput(snip.name); }}
                                    style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '0.75rem', padding: '0 4px' }}
                                    title="Hernoemen"
                                  >✏</button>
                                  <button
                                    onClick={() => { setMoveSnippetTarget(snip); setMoveSnippetFolderInput(''); }}
                                    style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '0.85rem', padding: '0 4px' }}
                                    title="Verplaats naar andere map"
                                  >📁</button>
                               </div>
                            ))}
                         </div>
                       );
                      })}
                   </div>
                )}
             </div>
             );
           })()}
        </div>
        <div style={{ flex: '0 0 4.5rem' }} />
        <div className="pattern-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>


           {/* Move snippet to folder dialog */}
           {moveSnippetTarget && ReactDOM.createPortal((() => {
             const existingFolders = Array.from(new Set(savedSnippets.map(s => s.folder || 'Algemeen'))).sort();
             const closeDialog = () => { setMoveSnippetTarget(null); setMoveSnippetFolderInput(''); };
             const moveTo = (target) => {
               const folder = (target || '').trim() || 'Algemeen';
               if ((moveSnippetTarget.folder || 'Algemeen') === folder) { closeDialog(); return; }
               handleMoveSnippetToFolder?.(moveSnippetTarget, folder);
               closeDialog();
             };
             return (
               <div onClick={closeDialog} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <div onClick={(e) => e.stopPropagation()} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1.5rem', width: '340px', display: 'flex', flexDirection: 'column', gap: '0.8rem', fontFamily: 'system-ui, sans-serif' }}>
                   <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#e2e8f0' }}>Verplaats "{moveSnippetTarget.name}"</div>
                   <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Huidige map: <strong>{moveSnippetTarget.folder || 'Algemeen'}</strong></div>
                   <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginBottom: '-0.4rem' }}>Bestaande mappen:</div>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', maxHeight: '180px', overflowY: 'auto' }}>
                     {existingFolders.map(f => (
                       <button
                         key={f}
                         onClick={() => moveTo(f)}
                         disabled={f === (moveSnippetTarget.folder || 'Algemeen')}
                         style={{
                           textAlign: 'left', background: '#0f172a',
                           color: f === (moveSnippetTarget.folder || 'Algemeen') ? '#475569' : '#e2e8f0',
                           border: '1px solid #334155', borderRadius: '6px',
                           padding: '0.45rem 0.75rem', fontSize: '0.85rem',
                           cursor: f === (moveSnippetTarget.folder || 'Algemeen') ? 'default' : 'pointer',
                         }}
                       >📁 {f}{f === (moveSnippetTarget.folder || 'Algemeen') ? '  (huidige)' : ''}</button>
                     ))}
                   </div>
                   <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginBottom: '-0.4rem' }}>Of nieuwe map:</div>
                   <input
                     type="text" value={moveSnippetFolderInput}
                     onChange={(e) => setMoveSnippetFolderInput(e.target.value)}
                     onKeyDown={(e) => { if (e.key === 'Enter' && moveSnippetFolderInput.trim()) moveTo(moveSnippetFolderInput); }}
                     placeholder="bv. Tepak Dua, Mincid, ..."
                     style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #475569', borderRadius: '6px', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                   />
                   <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                     <button onClick={closeDialog} style={{ background: 'transparent', border: '1px solid #475569', borderRadius: '6px', color: '#94a3b8', padding: '0.4rem 0.9rem', cursor: 'pointer', fontSize: '0.85rem' }}>Annuleer</button>
                     <button
                       onClick={() => moveTo(moveSnippetFolderInput)}
                       disabled={!moveSnippetFolderInput.trim()}
                       style={{
                         background: moveSnippetFolderInput.trim() ? '#3b82f6' : '#1e293b',
                         color: moveSnippetFolderInput.trim() ? '#fff' : '#475569',
                         border: 'none', borderRadius: '6px',
                         padding: '0.4rem 0.9rem',
                         cursor: moveSnippetFolderInput.trim() ? 'pointer' : 'default',
                         fontSize: '0.85rem', fontWeight: 'bold',
                       }}
                     >Verplaats</button>
                   </div>
                 </div>
               </div>
             );
           })(), document.body)}

        </div>
      </div>

      {isActive && !isLocked && (
        <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '0.2rem 1rem', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.15)', overflowX: 'auto', flexWrap: 'nowrap' }}>
          <button
            onClick={(e) => { e.stopPropagation(); blink('clear-all', handleClearPattern); }}
            style={{ background: blinkBtn === 'clear-all' ? '#3b82f6' : 'transparent', color: blinkBtn === 'clear-all' ? '#fff' : '#60a5fa', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #60a5fa', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 0 6px rgba(239,68,68,0.55)', transition: 'background 0.1s' }}
            title={t('clearSection')}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="2" y1="2" x2="11" y2="11"/><line x1="11" y1="2" x2="2" y2="11"/></svg>
            Clear
          </button>
          <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.1)', margin: '0 2px' }} />
          <button
            onClick={(e) => { e.stopPropagation(); blink('undo', handleUndo); }}
            disabled={undoStack.length === 0}
            style={{ background: blinkBtn === 'undo' ? '#3b82f6' : 'transparent', color: blinkBtn === 'undo' ? '#fff' : '#60a5fa', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #60a5fa', cursor: undoStack.length > 0 ? 'pointer' : 'default', fontSize: '0.8rem', opacity: undoStack.length > 0 ? 1 : 0.35, display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 0 6px rgba(34,211,238,0.55)', transition: 'background 0.1s' }}
            title={t('undo')}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6.5A4.5 4.5 0 1 1 6.5 2"/><polyline points="2,2 2,6.5 6.5,6.5"/></svg>
            Undo
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); blink('redo', handleRedo); }}
            disabled={redoStack.length === 0}
            style={{ background: blinkBtn === 'redo' ? '#3b82f6' : 'transparent', color: blinkBtn === 'redo' ? '#fff' : '#60a5fa', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #60a5fa', cursor: redoStack.length > 0 ? 'pointer' : 'default', fontSize: '0.8rem', opacity: redoStack.length > 0 ? 1 : 0.35, display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 0 6px rgba(45,212,191,0.55)', transition: 'background 0.1s' }}
            title={t('redo')}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 6.5A4.5 4.5 0 1 0 6.5 2"/><polyline points="11,2 11,6.5 6.5,6.5"/></svg>
            Redo
          </button>

          <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.1)', margin: '0 2px' }} />

          <button
            onClick={(e) => { e.stopPropagation(); setTouchSelectMode(v => !v); }}
            style={{ background: touchSelectMode ? 'rgba(96,165,250,0.22)' : 'transparent', color: '#60a5fa', padding: '0.25rem 0.45rem', borderRadius: '4px', border: '1px solid #60a5fa', cursor: 'pointer', display: 'flex', alignItems: 'center', boxShadow: '0 0 6px rgba(251,146,60,0.55)' }}
            title={touchSelectMode ? 'Selectie-tool aan — sleep over de tijdlijn (noten verschuiven niet). Klik om uit te zetten.' : 'Selectie-tool — sleep over de tijdlijn om een bereik te selecteren'}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="7.5" y1="1" x2="7.5" y2="14"/><line x1="1" y1="7.5" x2="14" y2="7.5"/>
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); blink('copy', handleCopy); }}
            disabled={!activeRangeObj}
            style={{ background: blinkBtn === 'copy' ? '#3b82f6' : 'transparent', color: blinkBtn === 'copy' ? '#fff' : '#60a5fa', padding: '0.25rem 0.45rem', borderRadius: '4px', border: '1px solid #60a5fa', cursor: activeRangeObj ? 'pointer' : 'default', opacity: activeRangeObj ? 1 : 0.35, display: 'flex', alignItems: 'center', boxShadow: '0 0 6px rgba(34,197,94,0.55)', transition: 'background 0.1s' }}
            title={t('copy')}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="1" width="8" height="9" rx="1"/><rect x="1" y="5" width="8" height="9" rx="1" fill="#1e293b"/>
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); blink('cut', handleCut); }}
            disabled={!activeRangeObj}
            style={{ background: blinkBtn === 'cut' ? '#3b82f6' : 'transparent', color: blinkBtn === 'cut' ? '#fff' : '#60a5fa', padding: '0.25rem 0.45rem', borderRadius: '4px', border: '1px solid #60a5fa', cursor: activeRangeObj ? 'pointer' : 'default', opacity: activeRangeObj ? 1 : 0.35, display: 'flex', alignItems: 'center', boxShadow: '0 0 6px rgba(251,146,60,0.55)', transition: 'background 0.1s' }}
            title={t('cut')}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="3.5" cy="3.5" r="2"/><circle cx="3.5" cy="11.5" r="2"/>
              <line x1="5.4" y1="4.9" x2="14" y2="10.5"/><line x1="5.4" y1="10.1" x2="14" y2="4.5"/>
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); blink('paste', handlePaste); }}
            disabled={!clipboard || !activeRangeObj}
            style={{ background: blinkBtn === 'paste' ? '#3b82f6' : 'transparent', color: blinkBtn === 'paste' ? '#fff' : '#60a5fa', padding: '0.25rem 0.45rem', borderRadius: '4px', border: '1px solid #60a5fa', cursor: clipboard && activeRangeObj ? 'pointer' : 'default', opacity: clipboard && activeRangeObj ? 1 : 0.35, display: 'flex', alignItems: 'center', boxShadow: '0 0 6px rgba(167,139,250,0.55)', transition: 'background 0.1s' }}
            title={t('paste')}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="9" height="10" rx="1"/><path d="M5 4V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1"/>
              <line x1="4" y1="8" x2="9" y2="8"/><line x1="4" y1="10.5" x2="9" y2="10.5"/>
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); blink('del', handleClear); }}
            disabled={!activeRangeObj}
            style={{ background: blinkBtn === 'del' ? '#3b82f6' : 'transparent', color: blinkBtn === 'del' ? '#fff' : '#60a5fa', padding: '0.25rem 0.45rem', borderRadius: '4px', border: '1px solid #60a5fa', cursor: activeRangeObj ? 'pointer' : 'default', opacity: activeRangeObj ? 1 : 0.35, display: 'flex', alignItems: 'center', boxShadow: '0 0 6px rgba(244,63,94,0.55)', transition: 'background 0.1s' }}
            title={t('deleteSelection')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/>
              <path d="M22 21H7"/>
              <path d="m5 11 9 9"/>
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setInputEnabled(!inputEnabled); }}
            style={{ background: inputEnabled ? 'rgba(96,165,250,0.22)' : 'transparent', color: '#60a5fa', border: '1px solid #60a5fa', padding: '0.2rem 0.45rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', height: '1.7rem', display: 'flex', alignItems: 'center', boxSizing: 'border-box', boxShadow: '0 0 6px rgba(74,222,128,0.55)' }}
            title={inputEnabled ? t('inputOn') : t('inputOff')}
          >✏️</button>
          <select
            value={gridResolution}
            onChange={(e) => { e.stopPropagation(); setGridResolution(Number(e.target.value)); }}
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #475569', borderRadius: '4px', padding: '0.2rem 0.5rem', fontSize: '0.8rem', cursor: 'pointer', height: '1.7rem', boxSizing: 'border-box', width: '4.5rem' }}
            title={t('gridResolution')}
          >
            <option value="12">1/4</option>
            <option value="16">1/4T</option>
            <option value="6">1/8</option>
            <option value="4">1/8T</option>
            <option value="3">1/16</option>
            <option value="2">1/16T</option>
          </select>
          <button
            onClick={(e) => { e.stopPropagation(); setMagneticInput(!magneticInput); }}
            style={{ background: magneticInput ? 'rgba(96,165,250,0.22)' : 'transparent', color: '#60a5fa', border: '1px solid #60a5fa', padding: '0.2rem 0.45rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', height: '1.7rem', display: 'flex', alignItems: 'center', boxSizing: 'border-box', boxShadow: '0 0 6px rgba(239,68,68,0.55)' }}
            title={t('snapToGrid')}
          >🧲</button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isPlaying || isRecording) {
                setAutoQuantize(!autoQuantize);
              } else {
                onSnapToGrid?.();
              }
            }}
            style={{ background: autoQuantize ? 'rgba(96,165,250,0.22)' : 'transparent', color: '#60a5fa', border: '1px solid #60a5fa', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold', height: '1.7rem', boxSizing: 'border-box', boxShadow: '0 0 6px rgba(167,139,250,0.55)' }}
            title={isPlaying || isRecording ? t('autoQuantize') : 'Snap selection to grid'}
          >Q</button>
          <button
            onClick={(e) => { e.stopPropagation(); handleToggleAccent(); }}
            disabled={!activeRangeObj}
            style={{ background: 'transparent', color: '#60a5fa', border: '1px solid #60a5fa', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: activeRangeObj ? 'pointer' : 'default', fontSize: '0.95rem', fontWeight: 'bold', height: '1.7rem', lineHeight: 1, boxSizing: 'border-box', boxShadow: '0 0 6px rgba(212,175,55,0.55)' }}
            title="Toggle accent op selectie (›)"
          >›</button>
        </div>
      )}


      {/* Tempo Track — outside horizontal scroll so it's always visible */}
      {onUpdateTempoTrack && !isLocked && (
        <div style={{ padding: '4px 1rem 0' }}>
          <TempoTrack
            pattern={pattern}
            defaultBpm={inheritedBpm ?? bpm}
            onUpdate={onUpdateTempoTrack}
            onToggleEnabled={onToggleTempoTrack}
            slotWidth={slotWidth}
            isActive={isActive}
            isPlaying={isPlaying}
            onToggleAllOpen={onToggleAllTempoOpen}
            onToggleAllEnabled={onToggleAllTempoEnabled}
            globalOpenSignal={globalTempoOpenSignal}
          />
        </div>
      )}

      <div id={`timeline-${pattern.id}`} className="timeline-wrapper" ref={timelineRef} style={{ overflowX: timelineOverflows ? 'auto' : 'hidden', overscrollBehaviorX: 'contain', WebkitOverflowScrolling: 'auto', ...(isLocked ? { boxShadow: '0 0 16px rgba(212,175,55,0.15)', borderTop: '1px solid rgba(212,175,55,0.2)' } : {}) }}>
        {/* Measure Ruler */}
        {(() => {
          const displayLoop = handleDrag ?? loopRangeObj;
          const mw = 48 * slotWidth;
          return (
            <div className="measure-ruler" style={{ position: 'relative', display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '8px', minHeight: '22px', userSelect: 'none' }}>
              {/* Spacer om uit te lijnen met de grid (solo-knop breedte) */}
              <div style={{ flexShrink: 0, width: SOLO_BTN_W + 'px' }} />
              {Array.from({ length: totalMeasures }).map((_, i) => {
                const isDragging = rulerDrag && i >= Math.min(rulerDrag.start, rulerDrag.current) && i <= Math.max(rulerDrag.start, rulerDrag.current);
                const annotation = pattern.annotations?.[i] || '';
                return (
                  <div key={i}
                    style={{ width: mw + 'px', flexShrink: 0, paddingLeft: '4px', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'crosshair', color: isDragging ? '#d4af37' : '#64748b', background: isDragging ? 'rgba(212,175,55,0.2)' : 'transparent', display: 'flex', flexDirection: 'column', justifyContent: 'center', overflow: 'hidden' }}
                    onPointerDown={(e) => handleRulerPointerDown(e, i)}
                    onDoubleClick={() => handleRulerDoubleClick(i)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      {i + 1 + measureOffset}
                      {isLocked && i === 0 && (
                        <span style={{ color: '#d4af37', fontWeight: 'bold', fontSize: '0.65rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pattern.name}</span>
                      )}
                      {annotation && (isLocked || !editingName) && (
                        <span style={{ color: isLocked ? '#d4af37' : '#94a3b8', fontSize: '0.55rem', fontWeight: 'normal', fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{annotation}</span>
                      )}
                    </div>
                    {!isLocked && editingName && (
                      <input
                        type="text"
                        data-annotation-field="true"
                        value={annotation}
                        onChange={(e) => handleAnnotationChange(i, e.target.value)}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.stopPropagation()}
                        onFocus={(e) => { e.stopPropagation(); setEditingName(true); }}
                        onBlur={(e) => {
                          setTimeout(() => {
                            const active = document.activeElement;
                            if (active && (active.dataset?.annotationField || active.classList?.contains('pattern-name-input'))) return;
                            setEditingName(false);
                          }, 50);
                        }}
                        placeholder="..."
                        style={{ background: 'rgba(255,255,255,0.08)', color: '#e2e8f0', border: 'none', borderBottom: '1px solid #475569', borderRadius: 0, fontSize: '16px', padding: '1px 2px', width: '90%', outline: 'none', fontStyle: 'italic' }}
                      />
                    )}
                  </div>
                );
              })}
              {/* Loop bar fill — uitgelijd met grid (+ SOLO_BTN_W offset) */}
              {displayLoop && (
                <div style={{ position: 'absolute', top: 1, bottom: 1, left: SOLO_BTN_W + displayLoop.start * slotWidth, width: Math.max(0, (displayLoop.end - displayLoop.start) * slotWidth), background: handleDrag ? 'rgba(212,175,55,0.22)' : 'rgba(245,158,11,0.18)', border: '1px solid rgba(245,158,11,0.65)', borderRadius: 2, pointerEvents: 'none', boxSizing: 'border-box' }} />
              )}
              {/* Left handle */}
              {displayLoop && (
                <div
                  style={{ position: 'absolute', top: 0, bottom: 0, left: SOLO_BTN_W + displayLoop.start * slotWidth - 5, width: 12, cursor: 'ew-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, touchAction: 'none' }}
                  onPointerDown={(e) => handleLoopHandlePointerDown(e, 'start')}
                >
                  <div style={{ width: 3, height: 14, background: '#f59e0b', borderRadius: 2, pointerEvents: 'none' }} />
                </div>
              )}
              {/* Right handle */}
              {displayLoop && (
                <div
                  style={{ position: 'absolute', top: 0, bottom: 0, left: SOLO_BTN_W + displayLoop.end * slotWidth - 7, width: 12, cursor: 'ew-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, touchAction: 'none' }}
                  onPointerDown={(e) => handleLoopHandlePointerDown(e, 'end')}
                >
                  <div style={{ width: 3, height: 14, background: '#f59e0b', borderRadius: 2, pointerEvents: 'none' }} />
                </div>
              )}
            </div>
          );
        })()}

        {/* Track rows with gong overlay */}
        <div
          style={{ position: 'relative' }}
          ref={tracksContainerRef}
        >
          {/* Tracks worden in een loop gerenderd zodat een instrumentPack met
              andere track-IDs (bv. lanang/wadon) drop-in werkt. Tussen track 0
              en track 1 verschijnt de separator met metronoom + loop-knop. */}
          {(instrumentPack?.tracks || []).map((track, trackIdx) => (
            <Fragment key={track.id}>
              <div style={{ display: 'flex', alignItems: 'center', position: trackIdx > 0 ? 'relative' : undefined }}>
                {trackIdx > 0 && (
                  <span style={{ position: 'absolute', top: 2, left: SOLO_BTN_W + 4, fontSize: '0.6rem', fontWeight: 'bold', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', opacity: 0.7, zIndex: 5, userSelect: 'none', pointerEvents: 'none' }}>{track.label}</span>
                )}
                {trackIdx === 0 && (
                  <span style={{ position: 'absolute', top: 2, left: SOLO_BTN_W + 4, fontSize: '0.6rem', fontWeight: 'bold', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', opacity: 0.7, zIndex: 5, userSelect: 'none', pointerEvents: 'none' }}>{track.label}</span>
                )}
                <button
                  onPointerDown={(e) => { e.stopPropagation(); onToggleSolo(track.id); }}
                  style={{ flexShrink: 0, width: '19px', height: '19px', marginRight: '2px', padding: 0, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title={soloTrack === track.id ? `${track.label} gedempt — klik om aan te zetten` : `${track.label} aan — klik om te dempen`}
                >
                  <div style={{ width: '5px', height: '5px', borderRadius: '50%', pointerEvents: 'none', background: soloTrack === track.id ? '#475569' : '#22c55e', boxShadow: soloTrack === track.id ? 'inset 0 1px 2px rgba(0,0,0,0.5)' : '0 0 3px 1px rgba(34,197,94,0.8), 0 0 7px 2px rgba(34,197,94,0.35)' }} />
                </button>
                <div style={{ flex: 1 }}>
                  <TrackRow
                    trackId={track.id}
                    slots={pattern[track.id] || []}
                    notationPack={notationPack}
                    theme={track.id}
                    activeRange={activeRangeObj?.trackId === track.id ? activeRangeObj : null}
                    loopRange={loopRangeObj}
                    onSlotClick={(index, isShift) => handleSlotClick(track.id, index, isShift)}
                    selectMode={touchSelectMode}
                    onRangeSelect={(a, b) => setActiveSlot && setActiveSlot({ patternId: pattern.id, trackId: track.id, startIndex: Math.min(a, b), endIndex: Math.max(a, b) + 1 })}
                    gridResolution={gridResolution}
                    slotWidth={slotWidth}
                    onNoteMove={handleNoteMove}
                    gong={pattern.gong || []}
                    onInsertSymbol={(slotIndex, symbol) => handleInsertSymbol(track.id, slotIndex, symbol)}
                    onClearSlot={(slotIndex) => clearSlotWithRestFill(track.id, slotIndex)}
                    isLocked={isLocked}
                  />
                </div>
                {/* Rechter gutter spacer — spiegelt solo-knop breedte */}
                <div style={{ flexShrink: 0, width: '24px' }} />
              </div>
              {trackIdx === 0 && (instrumentPack?.tracks?.length ?? 0) > 1 && (
                <div style={{ height: '14px', width: '100%', margin: '4px 0', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '3px' }}>
                  <div ref={metronomeBtnRef} style={{ position: 'relative', flexShrink: 0, lineHeight: 0 }}>
                    <button
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        metronomeHoldRef.current = setTimeout(() => {
                          metronomeHoldRef.current = null;
                          if (metronomeBtnRef.current) {
                            const r = metronomeBtnRef.current.getBoundingClientRect();
                            setMetronomeMenuPos({ top: r.bottom + 4, left: Math.max(4, r.right - 150) });
                          }
                          setShowMetronomeMenu(true);
                        }, 400);
                      }}
                      onPointerUp={(e) => {
                        e.stopPropagation();
                        if (metronomeHoldRef.current) {
                          clearTimeout(metronomeHoldRef.current);
                          metronomeHoldRef.current = null;
                          setMetronomeMode(v => v ? '' : 'on');
                        }
                      }}
                      onPointerLeave={() => {
                        if (metronomeHoldRef.current) { clearTimeout(metronomeHoldRef.current); metronomeHoldRef.current = null; }
                      }}
                      style={{
                        flexShrink: 0, width: '20px', height: '20px',
                        background: metronomeMode ? 'rgba(96,165,250,0.18)' : 'transparent',
                        color: '#60a5fa',
                        border: '1px solid #60a5fa',
                        borderRadius: '3px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        pointerEvents: 'auto',
                        boxShadow: metronomeMode ? '0 0 9px rgba(96,165,250,0.7)' : '0 0 5px rgba(96,165,250,0.4)',
                      }}
                      title={`${t('metronome')} — houd ingedrukt voor opties`}
                    >
                      <svg width="10" height="12" viewBox="0 0 11 13" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="1,12 10,12 7.5,1 3.5,1" fill="none"/>
                        <line x1="5.5" y1="2.5" x2="8.5" y2="10"/>
                        <circle cx="8.5" cy="10" r="1" fill="currentColor" stroke="none"/>
                      </svg>
                    </button>
                    {showMetronomeMenu && ReactDOM.createPortal(
                      <>
                        <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
                          onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); setShowMetronomeMenu(false); }}
                        />
                        <div
                          onPointerDown={(e) => e.stopPropagation()}
                          style={{ position: 'fixed', top: metronomeMenuPos.top, left: metronomeMenuPos.left, zIndex: 9999, background: '#1e293b', border: '1px solid #475569', borderRadius: '4px', minWidth: '140px', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
                          {[['', 'off'], ['4', '4'], ['8', '8'], ['4+play', '4 + play'], ['8+play', '8 + play'], ['on', 'on']].map(([val, label]) => (
                            <button key={val} onPointerDown={(e) => { e.stopPropagation(); setMetronomeMode(val); setShowMetronomeMenu(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem', cursor: 'pointer', color: metronomeMode === val ? '#a78bfa' : '#94a3b8', background: metronomeMode === val ? 'rgba(167,139,250,0.1)' : 'transparent', border: 'none', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                              {label}
                            </button>
                          ))}
                          <div style={{ padding: '0.4rem 0.75rem 0.5rem', borderTop: '1px solid #334155' }} onPointerDown={(e) => e.stopPropagation()}>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.3rem' }}>volume</div>
                            <input
                              type="range" min="0" max="1" step="0.05"
                              value={metronomeVolume}
                              onChange={(e) => setMetronomeVolume?.(parseFloat(e.target.value))}
                              style={{ width: '100%', accentColor: '#a78bfa', cursor: 'pointer' }}
                            />
                          </div>
                        </div>
                      </>,
                      document.body
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleSectionLoop?.(); }}
                    style={{
                      flexShrink: 0, width: '20px', height: '20px',
                      background: isLooped ? 'rgba(96,165,250,0.18)' : 'transparent',
                      color: '#60a5fa',
                      border: '1px solid #60a5fa',
                      borderRadius: '3px', cursor: 'pointer',
                      fontSize: '0.75rem', fontWeight: 'bold',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      pointerEvents: 'auto',
                      boxShadow: isLooped ? '0 0 9px rgba(96,165,250,0.7)' : '0 0 5px rgba(96,165,250,0.4)',
                    }}
                    title="Loop deze section"
                  >⟳</button>
                </div>
              )}
            </Fragment>
          ))}

        {/* Playhead */}
        {playheadSlot !== null && (
          <div style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: SOLO_BTN_W + playheadSlot * slotWidth,
            width: isLocked ? 4 : 2,
            background: isLocked ? 'rgba(212,175,55,0.9)' : 'rgba(59,130,246,0.85)',
            zIndex: 30,
            pointerEvents: 'none',
            boxShadow: isLocked ? '0 0 6px rgba(212,175,55,0.6)' : 'none',
          }}>
            {/* Draggable triangle handle */}
            <div
              style={{
                position: 'absolute',
                top: -18,
                left: isLocked ? -14 : -13,
                width: isLocked ? 28 : 26,
                height: 20,
                cursor: 'ew-resize',
                pointerEvents: 'all',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                touchAction: 'none',
              }}
              onPointerDown={handlePlayheadPointerDown}
            >
              <div style={{
                width: 0, height: 0,
                borderLeft: `${isLocked ? 7 : 6}px solid transparent`,
                borderRight: `${isLocked ? 7 : 6}px solid transparent`,
                borderTop: `10px solid ${isLocked ? '#d4af37' : '#3b82f6'}`,
                pointerEvents: 'none',
              }} />
            </div>
          </div>
        )}

        </div>
      </div>
    </div>
  );
};

export default PatternEditor;
