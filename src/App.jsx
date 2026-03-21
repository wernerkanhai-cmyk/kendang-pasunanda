import React, { useState, useRef, useEffect } from 'react';
import './App.css';
import { createEmptyPattern, writeSymbolToPattern, getHandForSymbol, generateEmptySlots, SYMBOL_REST } from './engine/patternLogic';
import PatternEditor from './components/PatternEditor';
import SongMap from './components/SongMap';
import DrumPad from './components/DrumPad';
import OCRScanner from './components/OCRScanner';
import { exportSequencerToPDF, DEFAULT_PDF_SETTINGS } from './utils/export';
import { FACTORY_PRESETS, FACTORY_CATEGORIES } from './factory/presets';
import { AudioScheduler } from './engine/AudioScheduler';
import { SamplePlayer, DEFAULT_SOUND_SETTINGS } from './engine/SamplePlayer';

function App() {
  const [song, setSong] = useState(() => {
    try {
      const saved = localStorage.getItem('kendangCurrentSong');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [createEmptyPattern('Regel 1')];
  });
  const [activePatternId, setActivePatternId] = useState(() => {
    try {
      return localStorage.getItem('kendangCurrentPatternId') || song[0]?.id;
    } catch {}
    return song[0]?.id;
  });
  // Initialize with a default slot (Anak, slot 0) so the user can immediately start tapping without clicking the grid first.
  const [activeSlot, setActiveSlot] = useState({ patternId: song[0].id, trackId: 'anak', startIndex: 0, endIndex: 0 }); 
  const [clipboard, setClipboard] = useState(null);
  
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  
  // Audio Transport State
  const [bpm, setBpm] = useState(60);
  const [realtimeBpm, setRealtimeBpm] = useState(null); // null = not playing or no automation
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [precount, setPrecount] = useState(0);
  const [loopingPatternId, setLoopingPatternId] = useState(null);
  const loopingPatternIdRef = useRef(null);
  const [soloTrack, setSoloTrack] = useState(null); // null | 'anak' | 'indung'
  const soloTrackRef = useRef(null);
  const [metronomeMode, setMetronomeMode] = useState(''); // '' | '4' | '8' | 'click' | 'precount'
  const schedulerRef = useRef(null);
  const samplerRef = useRef(null);
  
  // Sound settings (volume + pitch per geluid)
  const [soundSettings, setSoundSettings] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('kendangSoundSettings'));
      return saved ? { ...DEFAULT_SOUND_SETTINGS, ...saved } : { ...DEFAULT_SOUND_SETTINGS };
    } catch { return { ...DEFAULT_SOUND_SETTINGS }; }
  });
  const soundSettingsRef = useRef(soundSettings);
  useEffect(() => {
    soundSettingsRef.current = soundSettings;
    localStorage.setItem('kendangSoundSettings', JSON.stringify(soundSettings));
    samplerRef.current?.updateSettings(soundSettings);
  }, [soundSettings]);

  // Track volumes
  const [trackVolumes, setTrackVolumes] = useState({ anak: 1.0, indung: 1.0 });
  const trackVolumesRef = useRef({ anak: 1.0, indung: 1.0 });
  useEffect(() => { trackVolumesRef.current = trackVolumes; }, [trackVolumes]);

  // Grid & Quantize State
  const [gridResolution, setGridResolution] = useState(6); // 1/8 by default
  const [magneticInput, setMagneticInput] = useState(false);
  const [autoQuantize, setAutoQuantize] = useState(false); // Q: snap to grid during live recording
  const [inputEnabled, setInputEnabled] = useState(true); // Invoer op tijdlijn aan/uit

  // My Patterns Snippet Library
  const [savedSnippets, setSavedSnippets] = useState(() => {
    const saved = localStorage.getItem('kendangSnippets');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('kendangSnippets', JSON.stringify(savedSnippets));
  }, [savedSnippets]);

  // Persist current working song so it survives page reloads and deploys
  useEffect(() => {
    localStorage.setItem('kendangCurrentSong', JSON.stringify(song));
  }, [song]);
  useEffect(() => {
    if (activePatternId) localStorage.setItem('kendangCurrentPatternId', activePatternId);
  }, [activePatternId]);

  // Saved Songs Library
  const [savedSongs, setSavedSongs] = useState(() => {
    const saved = localStorage.getItem('kendangSavedSongs');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentSongId, setCurrentSongId] = useState(null);
  const [songName, setSongName] = useState('Song 1');
  const [songFolder, setSongFolder] = useState('Algemeen');
  const [showSongLibrary, setShowSongLibrary] = useState(false);
  const [pdfSettings, setPdfSettings] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('pdfSettings'));
      // Always merge with defaults so new keys (like dotOffset) are always present
      return saved ? { ...DEFAULT_PDF_SETTINGS, ...saved } : { ...DEFAULT_PDF_SETTINGS };
    } catch { return { ...DEFAULT_PDF_SETTINGS }; }
  });
  const [showPdfSettings, setShowPdfSettings] = useState(false);
  const [songSearchQuery, setSongSearchQuery] = useState('');
  const [showSongMap, setShowSongMap] = useState(false);

  // Song pattern drag-to-reorder
  const [dragPatId, setDragPatId] = useState(null);
  const [dragOverPatId, setDragOverPatId] = useState(null);
  const handlePatternDrop = (targetId) => {
    if (!dragPatId || dragPatId === targetId) { setDragPatId(null); setDragOverPatId(null); return; }
    setSong(prev => {
      const from = prev.findIndex(p => p.id === dragPatId);
      const to = prev.findIndex(p => p.id === targetId);
      if (from === -1 || to === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDragPatId(null); setDragOverPatId(null);
  };

  // Floating drum panel — position + size, persisted in localStorage
  const [drumPos, setDrumPos] = useState(() => {
    try { return JSON.parse(localStorage.getItem('drumPos')) || { x: 16, y: 80 }; } catch { return { x: 16, y: 80 }; }
  });
  const [drumSize, setDrumSize] = useState(() => {
    try { return JSON.parse(localStorage.getItem('drumSize')) || { w: 300, h: 520 }; } catch { return { w: 300, h: 520 }; }
  });
  const [drumCollapsed, setDrumCollapsed] = useState(false);
  useEffect(() => { localStorage.setItem('drumPos', JSON.stringify(drumPos)); }, [drumPos]);
  useEffect(() => { localStorage.setItem('drumSize', JSON.stringify(drumSize)); }, [drumSize]);

  const drumInteractRef = useRef(null);
  const startDrumInteract = (type, clientX, clientY) => {
    drumInteractRef.current = {
      type, startX: clientX, startY: clientY,
      origX: drumPos.x, origY: drumPos.y,
      startW: drumSize.w, startH: drumSize.h,
    };
    const onMove = (ev) => {
      const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
      const d = drumInteractRef.current;
      if (!d) return;
      const dx = cx - d.startX, dy = cy - d.startY;
      if (d.type === 'drag') {
        setDrumPos({
          x: Math.max(0, Math.min(window.innerWidth - d.startW - 4, d.origX + dx)),
          y: Math.max(0, Math.min(window.innerHeight - 44, d.origY + dy)),
        });
      } else {
        setDrumSize({ w: Math.max(180, d.startW + dx), h: Math.max(160, d.startH + dy) });
      }
    };
    const onEnd = () => {
      drumInteractRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
  };

  useEffect(() => {
    localStorage.setItem('kendangSavedSongs', JSON.stringify(savedSongs));
  }, [savedSongs]);

  // The global switch dictating which track we are writing to from the DrumPad
  const [inputMode, setInputMode] = useState('anak'); // 'anak' or 'indung'

  // Ref to track tapping speed without stale closures for smart resolution
  const drumTapRef = useRef({ time: 0, slotIndex: 0, trackId: '' });
  const lastRewindTimeRef = useRef(0);
  const currentAudioSlotRef = useRef(0); // Werkelijke afspeelslot (gesynchroniseerd met onTick)
  const playStartWallTimeRef = useRef(0); // Date.now() op moment dat slot 0 klinkt
  const cursorOffsetMsRef = useRef(0);

  const handleSaveSong = () => {
    const name = songName.trim() || 'Naamloos';
    const folder = songFolder.trim() || 'Algemeen';

    // "Save As": if name or folder differs from the currently loaded song, always create a new entry
    const original = currentSongId ? savedSongs.find(s => s.id === currentSongId) : null;
    const isSaveAs = !original || original.name !== name || original.folder !== folder;

    const entry = {
      id: isSaveAs ? Date.now().toString() : currentSongId,
      name,
      folder,
      date: new Date().toLocaleDateString('nl-NL'),
      patterns: JSON.parse(JSON.stringify(song))
    };

    if (!isSaveAs) {
      setSavedSongs(prev => prev.map(s => s.id === currentSongId ? entry : s));
    } else {
      setSavedSongs(prev => [...prev, entry]);
      setCurrentSongId(entry.id);
    }
  };

  const handleNewSong = () => {
    const newSongName = `Song ${savedSongs.length + 2}`;
    const fresh = createEmptyPattern('Regel 1');
    setSong([fresh]);
    setActivePatternId(fresh.id);
    setActiveSlot({ patternId: fresh.id, trackId: 'anak', startIndex: 0, endIndex: 0 });
    setUndoStack([]);
    setRedoStack([]);
    setCurrentSongId(null);
    setSongName(newSongName);
  };

  const handleLoadSong = (savedId) => {
    const toLoad = savedSongs.find(s => s.id === savedId);
    if (!toLoad) return;
    setSong(toLoad.patterns);
    setActivePatternId(toLoad.patterns[0].id);
    setActiveSlot({ patternId: toLoad.patterns[0].id, trackId: 'anak', startIndex: 0, endIndex: 0 });
    setUndoStack([]);
    setRedoStack([]);
    setCurrentSongId(toLoad.id);
    setSongName(toLoad.name);
    setSongFolder(toLoad.folder || 'Algemeen');
    setShowSongLibrary(false);
  };

  const handleDeleteSong = (id) => {
    setSavedSongs(prev => prev.filter(s => s.id !== id));
    if (currentSongId === id) setCurrentSongId(null);
  };

  const handleExportSong = (s) => {
    const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${s.name.replace(/[^a-z0-9]/gi, '_')}.kendang.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSong = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        // Accepteer zowel losse song als array van songs
        const songs = Array.isArray(imported) ? imported : [imported];
        const valid = songs.filter(s => s.name && Array.isArray(s.patterns));
        if (valid.length === 0) throw new Error();
        setSavedSongs(prev => {
          const existingIds = new Set(prev.map(s => s.id));
          return [...prev, ...valid.map(s => ({
            ...s,
            id: existingIds.has(s.id) ? Date.now().toString() + Math.random() : s.id,
          }))];
        });
        alert(`${valid.length} song(s) geïmporteerd.`);
      } catch {
        alert('Ongeldig bestand — verwacht een .kendang.json bestand.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportLibrary = () => {
    const blob = new Blob([JSON.stringify(savedSongs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kendang-bibliotheek-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportLibrary = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        if (!Array.isArray(imported)) throw new Error();
        setSavedSongs(prev => {
          const existingIds = new Set(prev.map(s => s.id));
          const nieuwen = imported.filter(s => s.id && s.name && !existingIds.has(s.id));
          return [...prev, ...nieuwen];
        });
      } catch {
        alert('Ongeldig bestand — verwacht een .json bibliotheek.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleLoadPreset = (presetId) => {
    const preset = FACTORY_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    const block = { ...preset, id: crypto.randomUUID() };
    setSong([block]);
    setActivePatternId(block.id);
    setActiveSlot({ patternId: block.id, trackId: 'anak', startIndex: 0, endIndex: 0 });
    setUndoStack([]);
    setRedoStack([]);
  };

  // Ref to last added song block for auto-scroll
  const lastAddedBlockRef = useRef(null);

  const addSongBlock = () => {
    setUndoStack(prev => [...prev.slice(-49), song]);
    setRedoStack([]);
    const newBlock = createEmptyPattern(`Regel ${song.length + 1}`);
    setSong(prev => [...prev, newBlock]);
    setActivePatternId(newBlock.id);
    setActiveSlot({ patternId: newBlock.id, trackId: 'anak', startIndex: 0, endIndex: 0 });
    lastAddedBlockRef.current = newBlock.id;
  };

  const insertSongBlockAfter = (afterId) => {
    setUndoStack(prev => [...prev.slice(-49), song]);
    setRedoStack([]);
    const newBlock = createEmptyPattern(`Regel ${song.length + 1}`);
    setSong(prev => {
      const idx = prev.findIndex(p => p.id === afterId);
      const next = [...prev];
      next.splice(idx + 1, 0, newBlock);
      return next;
    });
    setActivePatternId(newBlock.id);
    setActiveSlot({ patternId: newBlock.id, trackId: 'anak', startIndex: 0, endIndex: 0 });
    lastAddedBlockRef.current = newBlock.id;
  };

  const duplicateSongBlock = (patternId) => {
    setUndoStack(prev => [...prev.slice(-49), song]);
    setRedoStack([]);
    const src = song.find(p => p.id === patternId);
    if (!src) return;
    const newId = Date.now().toString();
    const newBlock = { ...src, id: newId, name: src.name + ' (kopie)' };
    setSong(prev => {
      const idx = prev.findIndex(p => p.id === patternId);
      const next = [...prev];
      next.splice(idx + 1, 0, newBlock);
      return next;
    });
    setActivePatternId(newId);
    setActiveSlot({ patternId: newId, trackId: 'anak', startIndex: 0, endIndex: 0 });
    lastAddedBlockRef.current = newId;
  };

  const movePatternUp = (patternId) => {
    setSong(prev => {
      const idx = prev.findIndex(p => p.id === patternId);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  };

  const movePatternDown = (patternId) => {
    setSong(prev => {
      const idx = prev.findIndex(p => p.id === patternId);
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
      return next;
    });
  };

  // Auto-scroll to newly added block
  useEffect(() => {
    if (lastAddedBlockRef.current) {
      const el = document.getElementById(`block-${lastAddedBlockRef.current}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      lastAddedBlockRef.current = null;
    }
  }, [song]);

  const updatePattern = (id, updatedPattern) => {
    // Basic history management for pattern updates (Clear, Paste, Typing)
    setUndoStack(prev => [...prev.slice(-49), song]);
    setRedoStack([]);
    
    setSong(song.map(p => p.id === id ? updatedPattern : p));
  };

  const insertMeasure = (patternId, atSlotIndex) => {
    setUndoStack(prev => [...prev.slice(-49), song]);
    setRedoStack([]);

    setSong(prevSong => {
      const pIdx = prevSong.findIndex(p => p.id === patternId);
      if (pIdx === -1) return prevSong;

      const measureStart = Math.floor(atSlotIndex / 48) * 48;
      const newPattern = JSON.parse(JSON.stringify(prevSong[pIdx]));
      
      const emptyAnak = generateEmptySlots(48);
      const emptyIndung = generateEmptySlots(48);
      
      // Insert new blank measure right at the cursor's measure start
      newPattern.anak.splice(measureStart, 0, ...emptyAnak);
      newPattern.indung.splice(measureStart, 0, ...emptyIndung);
      
      const nextSong = [...prevSong];
      nextSong[pIdx] = newPattern;
      return nextSong;
    });
  };

  const deleteMeasure = (patternId, atSlotIndex) => {
    setUndoStack(prev => [...prev.slice(-49), song]);
    setRedoStack([]);
    
    let newLength = 0;

    setSong(prevSong => {
      const pIdx = prevSong.findIndex(p => p.id === patternId);
      if (pIdx === -1) return prevSong;
      
      const measureStart = Math.floor(atSlotIndex / 48) * 48;
      const newPattern = JSON.parse(JSON.stringify(prevSong[pIdx]));
      
      if (newPattern.anak.length <= 48) return prevSong; // don't delete last measure
      
      newPattern.anak.splice(measureStart, 48);
      newPattern.indung.splice(measureStart, 48);
      
      newLength = newPattern.anak.length;
      
      const nextSong = [...prevSong];
      nextSong[pIdx] = newPattern;
      return nextSong;
    });
    
    // Auto-adjust the playhead / cursor if we deleted the measure it was standing on
    setTimeout(() => {
        if (newLength > 0) {
           setActiveSlot(prev => {
              if (!prev || prev.patternId !== patternId) return prev;
              let newStart = prev.startIndex;
              const measureStart = Math.floor(atSlotIndex / 48) * 48;
              if (newStart >= measureStart + 48) newStart -= 48;
              else if (newStart >= measureStart) newStart = measureStart;
              
              if (newStart >= newLength) newStart = newLength - 12; // fallback to start of last beat
              if (newStart < 0) newStart = 0;
              
              return { ...prev, startIndex: newStart, endIndex: newStart };
           });
        }
    }, 0);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previousState = undoStack[undoStack.length - 1];
    setRedoStack(prev => [...prev, song]); // Save current state to redo
    setSong(previousState);
    setUndoStack(prev => prev.slice(0, -1)); // Remove the popped state
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[redoStack.length - 1];
    setUndoStack(prev => [...prev.slice(-49), song]); // Save current state to undo
    setSong(nextState);
    setRedoStack(prev => prev.slice(0, -1)); // Remove the popped state
  };

  // Initialize Web Audio Scheduler + SamplePlayer
  useEffect(() => {
    const sampler = new SamplePlayer();
    samplerRef.current = sampler;
    sampler.updateSettings(soundSettingsRef.current);
    // Maak de gedeelde AudioContext direct aan (voor sampler én scheduler)
    const sharedCtx = sampler.getContext();
    sampler.loadAll();

    // Helper: map global slot → { pattern, localSlot }
    const resolveSlot = (globalSlot) => {
      const currentSong = songRef.current;
      if (!currentSong) return null;
      let remaining = globalSlot;
      for (const p of currentSong) {
        if (remaining < p.anak.length) return { tickPattern: p, localSlot: remaining };
        remaining -= p.anak.length;
      }
      return null;
    };

    schedulerRef.current = new AudioScheduler(
      // onTick — slot tracking voor opname
      (globalSlot) => { currentAudioSlotRef.current = globalSlot; },
      // onPrecount
      (count) => {
        setPrecount(count);
        if (count === 0) {
          if (schedulerRef.current?.isRecording) setIsRecording(true);
          setIsPlaying(true);
          // nextNoteTime wordt pas NA onPrecount(0) gezet in _precount,
          // dus lees het via een microtask zodat we de juiste waarde hebben
          Promise.resolve().then(() => {
            const sched = schedulerRef.current;
            if (sched?.audioCtx) {
              const outputLatencyMs = ((sched.audioCtx.outputLatency || 0) + (sched.audioCtx.baseLatency || 0)) * 1000;
              const msUntilFirstNote = Math.max(0, (sched.nextNoteTime - sched.audioCtx.currentTime) * 1000);
              playStartWallTimeRef.current = Date.now() + msUntilFirstNote + outputLatencyMs;
            }
          });
        }
      },
      // onScheduleAudio — samples schedulen op exact audio-tijdstip (100ms vooruit)
      (globalSlot, audioTime) => {
        const resolved = resolveSlot(globalSlot);
        if (!resolved) return;
        const { tickPattern, localSlot } = resolved;
        ['anak', 'indung'].forEach(track => {
          if (soloTrackRef.current && soloTrackRef.current !== track) return;
          const slot = tickPattern[track][localSlot];
          if (slot) {
            const tvol = trackVolumesRef.current[track] ?? 1.0;
            if (slot.top && slot.top !== '.') sampler.play(slot.top, track, audioTime, tvol);
            if (slot.bottom && slot.bottom !== '.') sampler.play(slot.bottom, track, audioTime, tvol);
          }
        });
        if ((tickPattern.gong || []).includes(localSlot)) sampler.playGong(audioTime);
      }
    );
    // Koppel direct — geen race condition met .then()
    schedulerRef.current.setAudioContext(sharedCtx);
    schedulerRef.current.setBpm(bpm);

    return () => {
      schedulerRef.current.stop();
    };
  }, []); // Run once on mount

  // Cursor: wall-clock interval — onafhankelijk van AudioContext timing
  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => {
      const sched = schedulerRef.current;
      if (!sched?.isPlaying) return;
      const elapsed = Date.now() - playStartWallTimeRef.current + cursorOffsetMsRef.current;
      if (elapsed < 0) return;

      // Use precomputed slot time table when available (variable tempo), fall back to constant BPM
      let globalSlot;
      if (slotTimesRef.current) {
        globalSlot = getSlotAtElapsed(slotTimesRef.current, elapsed);
      } else {
        const spsMs = sched.getSecondsPerSlot() * 1000;
        if (spsMs <= 0) return;
        const loopLen = sched.totalSlots - sched.loopStart;
        if (loopLen <= 0) return;
        globalSlot = sched.loopStart + (Math.floor(elapsed / spsMs) % loopLen);
      }

      const currentSong = songRef.current;
      if (!currentSong) return;

      // Realtime BPM from tempo automation
      const hasAutomation = currentSong.some(p => p.tempoTrack && p.tempoTrack.length > 0);
      if (hasAutomation) {
        const currentBpmRef = bpmRef.current;
        const rt = Math.round(buildTempoAt(currentSong, currentBpmRef)(globalSlot));
        setRealtimeBpm(rt);
      }

      let remaining = globalSlot;
      for (const p of currentSong) {
        if (remaining < p.anak.length) {
          setActiveSlot(prev => (
            prev && prev.patternId === p.id && prev.startIndex === remaining ? prev : {
              patternId: p.id,
              trackId: prev ? prev.trackId : 'anak',
              startIndex: remaining,
              endIndex: remaining,
            }
          ));
          break;
        }
        remaining -= p.anak.length;
      }
    }, 16);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  // Auto-scroll active pattern block into view during playback
  const lastScrolledPatternRef = useRef(null);
  useEffect(() => {
    if (!isPlaying || !activeSlot) return;
    const id = activeSlot.patternId;
    if (id === lastScrolledPatternRef.current) return;
    lastScrolledPatternRef.current = id;
    document.getElementById(`block-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [isPlaying, activeSlot?.patternId]);

  // Reset scroll tracker when playback stops
  useEffect(() => {
    if (!isPlaying) lastScrolledPatternRef.current = null;
  }, [isPlaying]);

  // Keep a ref to song so the scheduler closure can always read the latest version
  const bpmRef = useRef(bpm);
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);

  const songRef = useRef(song);
  useEffect(() => {
    songRef.current = song;
    if (schedulerRef.current && !loopingPatternIdRef.current) {
      const total = song.reduce((sum, p) => sum + p.anak.length, 0);
      schedulerRef.current.setTotalSlots(total);
    }
  }, [song]);

  // Helper: map a global slot index to { patternId, localSlot }
  const globalToLocal = (globalSlot, songArr) => {
    let remaining = globalSlot;
    for (const p of songArr) {
      if (remaining < p.anak.length) return { patternId: p.id, localSlot: remaining };
      remaining -= p.anak.length;
    }
    const last = songArr[songArr.length - 1];
    return { patternId: last.id, localSlot: last.anak.length - 1 };
  };

  // Helper: map { patternId, localSlot } to a global slot index
  const localToGlobal = (patternId, localSlot, songArr) => {
    let offset = 0;
    for (const p of songArr) {
      if (p.id === patternId) return offset + localSlot;
      offset += p.anak.length;
    }
    return localSlot;
  };

  const toggleSolo = (track) => {
    const next = soloTrackRef.current === track ? null : track;
    soloTrackRef.current = next;
    setSoloTrack(next);
  };

  // ── Tempo automation ──────────────────────────────────────────────────────

  // Precomputed slot→cumulative-ms table for variable-tempo cursor sync
  const slotTimesRef = useRef(null);

  /**
   * Build a function globalSlot → bpm using each pattern's tempoTrack.
   * Falls back to defaultBpm when a pattern has no nodes.
   */
  const buildTempoAt = (songArr, defaultBpm) => (globalSlot) => {
    let offset = 0;
    for (const pattern of songArr) {
      const len = pattern.anak.length;
      if (globalSlot < offset + len) {
        const localSlot = globalSlot - offset;
        const track = pattern.tempoTrack;
        if (!track || track.length === 0) return defaultBpm;
        const sorted = [...track].sort((a, b) => a.slot - b.slot);
        if (localSlot <= sorted[0].slot) return sorted[0].bpm;
        if (localSlot >= sorted[sorted.length - 1].slot) return sorted[sorted.length - 1].bpm;
        for (let i = 0; i < sorted.length - 1; i++) {
          if (localSlot >= sorted[i].slot && localSlot <= sorted[i + 1].slot) {
            const t = (localSlot - sorted[i].slot) / (sorted[i + 1].slot - sorted[i].slot);
            return sorted[i].bpm + t * (sorted[i + 1].bpm - sorted[i].bpm);
          }
        }
        return defaultBpm;
      }
      offset += len;
    }
    return defaultBpm;
  };

  /** Precompute cumulative slot start times (ms) from loopStart to totalSlots. */
  const buildSlotTimesMs = (loopStart, totalSlots, getTempoAt) => {
    const n = totalSlots - loopStart;
    const times = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) {
      const bpmAtSlot = getTempoAt(loopStart + i);
      times[i + 1] = times[i] + (60000 / bpmAtSlot) / 12;
    }
    return { loopStart, times };
  };

  /** Binary-search the slot at a given elapsed ms, respecting loop. */
  const getSlotAtElapsed = (timesData, elapsedMs) => {
    if (!timesData) return 0;
    const { loopStart, times } = timesData;
    const loopDuration = times[times.length - 1];
    if (loopDuration <= 0) return loopStart;
    const cyclic = ((elapsedMs % loopDuration) + loopDuration) % loopDuration;
    let lo = 0, hi = times.length - 2;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (times[mid] <= cyclic) lo = mid;
      else hi = mid - 1;
    }
    return loopStart + lo;
  };

  // Keep tempo callback in sync with song + bpm state
  const tempoAtFnRef = useRef(null);
  useEffect(() => {
    tempoAtFnRef.current = buildTempoAt(song, bpm);
    if (schedulerRef.current) {
      schedulerRef.current.setTempoCallback((slot) => tempoAtFnRef.current(slot));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song, bpm]);

  const handleUpdateTempoTrack = (patternId, newTempoTrack) => {
    setSong(prev => prev.map(p => p.id === patternId ? { ...p, tempoTrack: newTempoTrack } : p));
  };

  const handleBpmChange = (delta) => {
    const newBpm = Math.max(20, Math.min(100, bpm + delta));
    setBpm(newBpm);
    if (schedulerRef.current) schedulerRef.current.setBpm(newBpm);
  };


  const togglePlay = async () => {
    // Ensure AudioContext is running — desktop Chrome requires resume() in user-gesture handler
    const ctx = schedulerRef.current?.audioCtx;
    if (ctx?.state === 'suspended') await ctx.resume();

    if (isPlaying && !isRecording) {
      schedulerRef.current.pause();
      setIsPlaying(false);
      setRealtimeBpm(null);
      if (loopingPatternIdRef.current) {
        loopingPatternIdRef.current = null;
        setLoopingPatternId(null);
        const total = song.reduce((sum, p) => sum + p.anak.length, 0);
        schedulerRef.current.setTotalSlots(total);
      }
    } else if (isPlaying && isRecording) {
      schedulerRef.current.pause();
      setIsPlaying(false);
      setIsRecording(false);
    } else {
      // Convert cursor position to a global slot
      const globalStart = activeSlot
        ? localToGlobal(activeSlot.patternId, activeSlot.startIndex - (activeSlot.startIndex % 48), song)
        : 0;
      // Build slot time table for variable-tempo cursor sync
      const totalSlots = song.reduce((sum, p) => sum + p.anak.length, 0);
      slotTimesRef.current = buildSlotTimesMs(globalStart, totalSlots, buildTempoAt(song, bpm));

      if (metronomeMode === '4') {
        schedulerRef.current.clickWhilePlaying = false;
        setIsPlaying(true);
        schedulerRef.current.startPlayPrecount(globalStart, 4);
      } else if (metronomeMode === '8') {
        schedulerRef.current.clickWhilePlaying = false;
        setIsPlaying(true);
        schedulerRef.current.startPlayPrecount(globalStart, 8);
      } else if (metronomeMode === '4+play') {
        schedulerRef.current.clickWhilePlaying = true;
        setIsPlaying(true);
        schedulerRef.current.startPlayPrecount(globalStart, 4);
      } else if (metronomeMode === '8+play') {
        schedulerRef.current.clickWhilePlaying = true;
        setIsPlaying(true);
        schedulerRef.current.startPlayPrecount(globalStart, 8);
      } else {
        schedulerRef.current.clickWhilePlaying = metronomeMode === 'on';
        await schedulerRef.current.play(false, globalStart);
        // Wall-clock starttijd voor cursor — NADAT audioCtx.resume() klaar is
        // Inclusief output latency zodat cursor en geluid gelijk lopen
        const ctx = schedulerRef.current.audioCtx;
        const outputLatencyMs = ctx ? ((ctx.outputLatency || 0) + (ctx.baseLatency || 0)) * 1000 : 0;
        playStartWallTimeRef.current = Date.now() + 50 + outputLatencyMs;
        setIsPlaying(true);
      }
      const { patternId, localSlot } = globalToLocal(globalStart, song);
      setActiveSlot(prev => prev ? { ...prev, patternId, startIndex: localSlot, endIndex: localSlot } : prev);
    }
  };

  const handleLoopPattern = async (patternId) => {
    const ctx = schedulerRef.current?.audioCtx;
    if (ctx?.state === 'suspended') await ctx.resume();

    if (loopingPatternIdRef.current === patternId) {
      // Stop loop — herstel normale song totalSlots
      loopingPatternIdRef.current = null;
      setLoopingPatternId(null);
      schedulerRef.current.pause();
      setIsPlaying(false);
      const total = song.reduce((sum, p) => sum + p.anak.length, 0);
      schedulerRef.current.setTotalSlots(total);
      return;
    }
    // Stop eventuele andere playback
    if (isPlaying) {
      schedulerRef.current.pause();
      setIsPlaying(false);
    }
    const globalStart = localToGlobal(patternId, 0, song);
    const pattern = song.find(p => p.id === patternId);
    if (!pattern) return;
    loopingPatternIdRef.current = patternId;
    setLoopingPatternId(patternId);
    const loopTotal = globalStart + pattern.anak.length;
    schedulerRef.current.setTotalSlots(loopTotal);
    // Build slot time table for this loop range
    slotTimesRef.current = buildSlotTimesMs(globalStart, loopTotal, buildTempoAt(song, bpm));
    await schedulerRef.current.play(false, globalStart);
    const ctx2 = schedulerRef.current.audioCtx;
    const latMs2 = ctx2 ? ((ctx2.outputLatency || 0) + (ctx2.baseLatency || 0)) * 1000 : 0;
    playStartWallTimeRef.current = Date.now() + 50 + latMs2;
    setIsPlaying(true);
    setActiveSlot(prev => prev ? { ...prev, patternId, startIndex: 0, endIndex: 0 } : prev);
  };

  const rewind = () => {
    if (!schedulerRef.current) return;
    const now = Date.now();
    const isDoubleClick = now - lastRewindTimeRef.current < 500;
    lastRewindTimeRef.current = now;

    const globalCurrent = schedulerRef.current.currentSlot;
    let targetGlobal;
    if (isDoubleClick) {
      // 2× klikken → begin van de song
      targetGlobal = 0;
    } else {
      // 1× klikken → 1 maat terug
      targetGlobal = Math.max(0, globalCurrent - 48);
    }

    if (isPlaying) {
      schedulerRef.current.seekTo(targetGlobal);
    } else {
      schedulerRef.current.setCurrentSlot(targetGlobal);
    }
    const { patternId, localSlot } = globalToLocal(targetGlobal, song);
    setActiveSlot(prev => prev ? { ...prev, patternId, startIndex: localSlot, endIndex: localSlot } : prev);
  };

  const handleSeek = (patternId, localSlot) => {
    if (!isPlaying || !schedulerRef.current || !slotTimesRef.current) return;
    const globalSlot = localToGlobal(patternId, localSlot, song);
    const { loopStart, times } = slotTimesRef.current;
    const i = globalSlot - loopStart;
    const offsetMs = (i >= 0 && i < times.length) ? times[i] : 0;
    playStartWallTimeRef.current = Date.now() - offsetMs + cursorOffsetMsRef.current;
    schedulerRef.current.seekTo(globalSlot);
    setActiveSlot(prev => prev ? { ...prev, patternId, startIndex: localSlot, endIndex: localSlot } : prev);
  };

  const stepBack = () => {
    if (!schedulerRef.current) return;
    const now = Date.now();
    const isDoubleClick = now - lastRewindTimeRef.current < 500;
    lastRewindTimeRef.current = now;

    const globalCurrent = schedulerRef.current.currentSlot;
    const targetGlobal = isDoubleClick ? 0 : Math.max(0, globalCurrent - 48);

    if (isPlaying) {
      schedulerRef.current.seekTo(targetGlobal);
    } else {
      schedulerRef.current.setCurrentSlot(targetGlobal);
    }
    const { patternId, localSlot } = globalToLocal(targetGlobal, song);
    setActiveSlot(prev => prev ? { ...prev, patternId, startIndex: localSlot, endIndex: localSlot } : prev);
  };

  const toggleRecord = async () => {
    if (isPlaying || isRecording) {
      schedulerRef.current.pause();
      setIsPlaying(false);
      setIsRecording(false);
      setPrecount(0);
    } else {
      // Start opname vanaf begin van de maat waar de cursor staat
      const globalStart = activeSlot
        ? localToGlobal(activeSlot.patternId, activeSlot.startIndex - (activeSlot.startIndex % 48), song)
        : 0;
      setIsRecording('precount'); // Temporary state to disable UI during countdown
      await schedulerRef.current.startRecordPrecount(globalStart);
      // OnPrecount(0) callback will set the final true state
    }
  };

  const handleGongSample = () => {
    samplerRef.current?.playGong();
  };

  const handleGongFromInstrument = () => {
    samplerRef.current?.playGong();
    if (activeSlot) {
      const blockStart = Math.floor(activeSlot.startIndex / 6) * 6;
      handleGongToggle(activeSlot.patternId, blockStart);
    }
  };

  const handleDrumTrigger = (symbol, naturalTrack) => {
    // Speel altijd het geluid af, ook zonder actieve slot
    if (symbol !== '.') {
      const trackForSound = activeSlot ? activeSlot.trackId : (naturalTrack || 'anak');
      samplerRef.current?.play(symbol, trackForSound);
    }
    if (!inputEnabled) return;
    if (!activeSlot && !isRecording) return;

    const now = Date.now();
    const timeDiff = now - drumTapRef.current.time;

    // THE RULE: You play strictly on ONE set (Anak OR Indung) at a time.
    // The active row is purely dictated by where the cursor is placed (activeSlot.trackId).
    // The drumset symbols themselves naturally float to the top or bottom of that selected line.
    const targetTrack = activeSlot ? activeSlot.trackId : 'anak';

    let targetSlotIndex = activeSlot ? activeSlot.startIndex : 0;
    let targetPatternId = activeSlot ? activeSlot.patternId : song[0]?.id;
    let advanceCursor = false;
    let nextCursorIndex = activeSlot ? activeSlot.startIndex : 0;

    if (isRecording) {
       // Live recording: scheduler loopt ~1 slot voor door lookahead — corrigeer
       const rawSlot = schedulerRef.current.currentSlot;
       const slotsAhead = Math.round((schedulerRef.current.scheduleAheadTime * schedulerRef.current.bpm * 12) / 60);
       const correctedGlobalSlot = Math.max(schedulerRef.current.loopStart, rawSlot - slotsAhead);
       let { patternId: recPatternId, localSlot: recLocal } = globalToLocal(correctedGlobalSlot, song);
       if (autoQuantize) recLocal = Math.round(recLocal / gridResolution) * gridResolution;
       targetSlotIndex = recLocal;
       targetPatternId = recPatternId;
       advanceCursor = false; // AudioScheduler handles visual playhead movement
       
    } else {
       // 'write' mode logic: 
       // User can write to the top line AND bottom line of the ACTIVE ROW simultaneously.
       
       if (timeDiff < 80 && drumTapRef.current.symbolHand !== getHandForSymbol(symbol)) { 
          // Simultaneous hit on DIFFERENT HANDS (top & bottom keys) - place them on the exact same slot
          targetSlotIndex = drumTapRef.current.slotIndex; 
       } else if (drumTapRef.current.trackId === targetTrack && timeDiff < 800) {
          // Rapid tap on the SAME hand/track in sequence (to write 8ths/16ths consecutively)
          if (timeDiff < 300) {
             targetSlotIndex = drumTapRef.current.slotIndex + 3; // 16th note spacing
          } else {
             targetSlotIndex = drumTapRef.current.slotIndex + 6; // 8th note spacing
          }
          if (magneticInput) {
             targetSlotIndex = Math.round(targetSlotIndex / gridResolution) * gridResolution;
          }
          if (targetSlotIndex >= 192) targetSlotIndex = targetSlotIndex % 192;
       } else {
          // EITHER enough time passed to start a new grouping. Write exactly at the cursor!
          targetSlotIndex = activeSlot ? activeSlot.startIndex : 0; 
          if (magneticInput) {
             targetSlotIndex = Math.round(targetSlotIndex / gridResolution) * gridResolution;
          }
          if (targetSlotIndex >= 192) targetSlotIndex = 0;
       }
       
       advanceCursor = true;
       // Advance cursor by the active grid resolution (Q setting).
       nextCursorIndex = activeSlot.startIndex + gridResolution;
       
       // Calculate current dynamic bounds mapping
       const activePatt = song.find(p => p.id === activeSlot?.patternId) || song[0];
       const currentMaxSlots = activePatt.anak.length;
       
       if (targetSlotIndex >= currentMaxSlots) targetSlotIndex = currentMaxSlots - 12;
       if (nextCursorIndex >= currentMaxSlots) nextCursorIndex = 0;
    }

    // Register this tap immediately for the next calculation
    drumTapRef.current = { 
       time: now, 
       slotIndex: targetSlotIndex, 
       trackId: targetTrack,
       symbolHand: getHandForSymbol(symbol)
    };

    setUndoStack(prev => [...prev.slice(-49), song]);
    setRedoStack([]);

    setSong(prevSong => {
      const currentPatternIdx = prevSong.findIndex(p => p.id === targetPatternId);
      if (currentPatternIdx === -1) return prevSong;

      let modifiedPattern;
      
      // If the user hit '.' (Rust) and has a range selected natively, clear the entire range instead of just writing 1 dot.
      if (symbol === '.' && activeSlot && activeSlot.startIndex !== activeSlot.endIndex) {
         const start = Math.min(activeSlot.startIndex, activeSlot.endIndex);
         const end = Math.max(activeSlot.startIndex, activeSlot.endIndex);
         
         modifiedPattern = JSON.parse(JSON.stringify(prevSong[currentPatternIdx]));
         for (let i = start; i <= end; i++) {
            modifiedPattern[targetTrack][i] = { top: (i % 12 === 0) ? '.' : '', bottom: (i % 12 === 0) ? '.' : '' };
         }
      } else {
         modifiedPattern = writeSymbolToPattern(prevSong[currentPatternIdx], targetTrack, targetSlotIndex, symbol);

         // Auto-fill preceding empty grid positions in this beat with rests
         if (symbol !== SYMBOL_REST) {
           const hand = getHandForSymbol(symbol);
           const beatStart = Math.floor(targetSlotIndex / 12) * 12;
           const step = gridResolution;
           for (let g = beatStart; g < targetSlotIndex; g += step) {
             const slot = modifiedPattern[targetTrack][g];
             if (hand === 'top' || hand === 'both') {
               if (!slot.top) slot.top = SYMBOL_REST;
             }
             if (hand === 'bottom' || hand === 'both') {
               if (!slot.bottom) slot.bottom = SYMBOL_REST;
             }
           }
         }
      }

      const nextSong = [...prevSong];
      nextSong[currentPatternIdx] = modifiedPattern;
      return nextSong;
    });

    if (advanceCursor) {
      setActiveSlot(prevSlot => {
        if (!prevSlot) return prevSlot;
        // The cursor itself always visually highlights what inputMode says is active
        return { patternId: prevSlot.patternId, trackId: inputMode, startIndex: nextCursorIndex, endIndex: nextCursorIndex };
      });
    }
  };

  // ---- MY PATTERNS / SNIPPET LIBRARY FLOWS ----
  const handleSaveSnippet = (name, folder, data, replaceId = null) => {
     const newSnippet = {
        id: replaceId || Date.now().toString(),
        name,
        folder: folder || 'Algemeen',
        data: JSON.parse(JSON.stringify(data)) // deep copy: { anak, indung }
     };
     if (replaceId) {
        setSavedSnippets(prev => prev.map(s => s.id === replaceId ? newSnippet : s));
     } else {
        setSavedSnippets(prev => [...prev, newSnippet]);
     }
  };

  const handleDeleteSnippet = (snippetId) => {
     setSavedSnippets(prev => prev.filter(s => s.id !== snippetId));
  };
  
  const handleInsertSnippet = (snippet) => {
     let targetPatternIdx = 0;
     let targetSlotIdx = 0;

     if (activeSlot) {
         targetPatternIdx = song.findIndex(p => p.id === activeSlot.patternId);
         targetSlotIdx = activeSlot.startIndex;
     }
     if (targetPatternIdx === -1) targetPatternIdx = 0;

     // Nieuw formaat: { anak, indung, gong }. Oud formaat: array (backward compat)
     const anakData   = snippet.data.anak   ?? snippet.data;
     const indungData = snippet.data.indung ?? null;
     const gongData   = snippet.data.gong   ?? null;
     const snippetLength = anakData.length;

     const newSong = [...song];
     const newPattern = JSON.parse(JSON.stringify(newSong[targetPatternIdx]));

     // AUTO-EXTEND SEQUENCE IF SNIPPET EXCEEDS CURRENT LENGTH
     const requiredLength = targetSlotIdx + snippetLength;
     if (requiredLength > newPattern.anak.length) {
        const slotsNeeded = requiredLength - newPattern.anak.length;
        const measuresNeeded = Math.ceil(slotsNeeded / 48);
        newPattern.anak.push(...generateEmptySlots(measuresNeeded * 48));
        newPattern.indung.push(...generateEmptySlots(measuresNeeded * 48));
     }

     for (let i = 0; i < snippetLength; i++) {
        const destIdx = targetSlotIdx + i;
        if (destIdx >= newPattern.anak.length) break;
        newPattern.anak[destIdx]   = JSON.parse(JSON.stringify(anakData[i]));
        if (indungData && i < indungData.length)
          newPattern.indung[destIdx] = JSON.parse(JSON.stringify(indungData[i]));
     }
     
     if (gongData && gongData.length > 0) {
       const existingGong = new Set(newPattern.gong || []);
       gongData.forEach(g => existingGong.add(targetSlotIdx + g));
       newPattern.gong = Array.from(existingGong).sort((a, b) => a - b);
     }

     newSong[targetPatternIdx] = newPattern;
     setUndoStack(prev => [...prev.slice(-49), song]);
     setRedoStack([]);
     setSong(newSong);

     // Advance the cursor past the inserted snippet Length if we are using an active tracking slot
     if (activeSlot) {
        let nextCursor = targetSlotIdx + snippetLength;
        if (magneticInput) nextCursor = Math.round(nextCursor / gridResolution) * gridResolution;
        if (nextCursor >= newPattern.anak.length) nextCursor = 0;
        setActiveSlot(prev => ({...prev, startIndex: nextCursor, endIndex: nextCursor}));
     }
  };

  const handleGongToggle = (patternId, blockStart) => {
     setSong(prev => prev.map(p => {
        if (p.id !== patternId) return p;
        const gong = p.gong || [];
        const isActive = gong.includes(blockStart);
        return { ...p, gong: isActive ? gong.filter(s => s !== blockStart) : [...gong, blockStart] };
     }));
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="branding">
          <h1>Kendang Pasunanda</h1>
          <p>Sequencer & OCR Studio (v7.1)</p>
        </div>
        <div className="global-controls" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <OCRScanner onScanResult={(patterns) => {
            if (patterns.length === 0) return;
            setUndoStack(prev => [...prev.slice(-49), song]);
            setRedoStack([]);
            setSong(prev => {
              // Verwijder de standaard lege startregel als die er nog als enige staat
              const isDefault = prev.length === 1 &&
                prev[0].name === 'Regel 1' &&
                prev[0].anak.every(s => s.top === '.' || s.top === '') &&
                prev[0].indung.every(s => s.top === '.' || s.top === '');
              return isDefault ? patterns : [...prev, ...patterns];
            });
            setActivePatternId(patterns[0].id);
            setActiveSlot({ patternId: patterns[0].id, trackId: 'anak', startIndex: 0, endIndex: 0 });
          }} />
          <div style={{ position: 'relative', display: 'inline-flex', gap: '2px' }}>
            <button
              className="btn-secondary"
              style={{ background: 'transparent', color: '#e2e8f0', padding: '0.6rem 1rem', borderRadius: '6px 0 0 6px', border: '1px solid var(--border-focus)' }}
              onClick={() => exportSequencerToPDF(song, songName, pdfSettings)}
            >📄 PDF Export</button>
            <button
              style={{ background: 'transparent', color: '#e2e8f0', padding: '0.6rem 0.5rem', borderRadius: '0 6px 6px 0', border: '1px solid var(--border-focus)', borderLeft: 'none', cursor: 'pointer' }}
              onClick={() => setShowPdfSettings(v => !v)}
              title="PDF layout instellingen"
            >⚙️</button>

            {showPdfSettings && (
              <div style={{
                position: 'absolute', top: '110%', right: 0, zIndex: 200,
                background: '#1e293b', border: '1px solid #334155', borderRadius: '8px',
                padding: '1rem', minWidth: '260px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                color: '#e2e8f0', fontSize: '0.8rem',
              }}>
                <div style={{ fontWeight: 'bold', marginBottom: '0.7rem', color: '#94a3b8' }}>PDF layout instellingen</div>
                {[
                  { key: 'beamTop1',    label: 'Beam boven (8e)' },
                  { key: 'beamTop2',    label: 'Beam boven (16e)' },
                  { key: 'beamBottom1', label: 'Beam onder (8e)' },
                  { key: 'beamBottom2', label: 'Beam onder (16e)' },
                  { key: 'symAbove',    label: 'Symbool afstand boven' },
                  { key: 'symBelow',    label: 'Symbool afstand onder' },
                  { key: 'dotTopOffset',    label: 'Stip boven (offset)' },
                  { key: 'dotBottomOffset', label: 'Stip onder (offset)' },
                ].map(({ key, label }) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem', gap: '0.5rem' }}>
                    <span style={{ flex: 1 }}>{label}</span>
                    <input
                      type="number"
                      value={pdfSettings[key]}
                      onChange={e => {
                        const val = parseInt(e.target.value, 10);
                        if (isNaN(val)) return;
                        const next = { ...pdfSettings, [key]: val };
                        setPdfSettings(next);
                        localStorage.setItem('pdfSettings', JSON.stringify(next));
                      }}
                      style={{ width: '60px', padding: '2px 4px', borderRadius: '4px', border: '1px solid #475569', background: '#0f172a', color: '#e2e8f0', textAlign: 'right' }}
                    />
                  </div>
                ))}
                <button
                  onClick={() => {
                    setPdfSettings({ ...DEFAULT_PDF_SETTINGS });
                    localStorage.setItem('pdfSettings', JSON.stringify(DEFAULT_PDF_SETTINGS));
                  }}
                  style={{ marginTop: '0.5rem', width: '100%', padding: '0.3rem', background: '#334155', border: 'none', borderRadius: '4px', color: '#e2e8f0', cursor: 'pointer', fontSize: '0.75rem' }}
                >↺ Standaard herstellen</button>
              </div>
            )}
          </div>
          
          <div style={{ width: '1px', height: '30px', background: 'var(--border-subtle)', margin: '0 0.5rem' }}></div>

          {/* Track volume knobs */}
          {['anak', 'indung'].map(track => {
            const color = track === 'anak' ? '#222' : '#cc0000';
            const val = trackVolumes[track];
            const angle = -135 + (val / 2) * 270; // -135° = min, +135° = max
            const r = 14, cx = 18, cy = 18;
            const rad = (a) => (a - 90) * Math.PI / 180;
            const arcX = (a) => cx + r * Math.cos(rad(a));
            const arcY = (a) => cy + r * Math.sin(rad(a));
            const startAngle = -135, endAngle = angle;
            const largeArc = endAngle - startAngle > 180 ? 1 : 0;
            return (
              <div key={track} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                <svg
                  width="36" height="36" viewBox="0 0 36 36"
                  style={{ cursor: 'ns-resize', touchAction: 'none' }}
                  title={`${track === 'anak' ? 'Anak' : 'Indung'} volume: ${Math.round(val * 100)}%`}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    const startY = e.clientY, startVal = val;
                    const onMove = (ev) => {
                      const delta = (startY - ev.clientY) / 80;
                      setTrackVolumes(v => ({ ...v, [track]: Math.max(0, Math.min(2, startVal + delta)) }));
                    };
                    const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
                    window.addEventListener('pointermove', onMove);
                    window.addEventListener('pointerup', onUp);
                  }}
                  onDoubleClick={() => setTrackVolumes(v => ({ ...v, [track]: 1.0 }))}
                >
                  {/* Background arc */}
                  <path d={`M${arcX(-135)},${arcY(-135)} A${r},${r} 0 1 1 ${arcX(135)},${arcY(135)}`} fill="none" stroke="#334155" strokeWidth="3" strokeLinecap="round" />
                  {/* Value arc */}
                  <path d={`M${arcX(startAngle)},${arcY(startAngle)} A${r},${r} 0 ${largeArc} 1 ${arcX(endAngle)},${arcY(endAngle)}`} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
                  {/* Knob body */}
                  <circle cx={cx} cy={cy} r="9" fill={color} opacity="0.85" />
                  {/* Indicator line */}
                  <line x1={cx} y1={cy} x2={cx + 7 * Math.cos(rad(angle))} y2={cy + 7 * Math.sin(rad(angle))} stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span style={{ fontSize: '0.55rem', color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{track === 'anak' ? 'A' : 'I'}</span>
              </div>
            );
          })}

          <div style={{ width: '1px', height: '30px', background: 'var(--border-subtle)', margin: '0 0.5rem' }}></div>

          {FACTORY_PRESETS.length > 0 && (
            <select
              defaultValue=""
              onChange={(e) => { if (e.target.value) { handleLoadPreset(e.target.value); e.target.value = ''; } }}
              style={{ background: '#1e293b', color: '#cbd5e1', border: '1px solid var(--border-focus)', borderRadius: '6px', padding: '0.55rem 0.6rem', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              <option value="">🎓 Presets...</option>
              {FACTORY_CATEGORIES.map(cat => {
                const items = FACTORY_PRESETS.filter(p => p.category === cat.label);
                if (items.length === 0) return null;
                return (
                  <optgroup key={cat.label} label={cat.label}>
                    {items.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          )}

          <input
            type="text"
            value={songName}
            onChange={(e) => setSongName(e.target.value)}
            style={{ background: '#1e293b', color: '#e2e8f0', border: '1px solid var(--border-focus)', borderRadius: '6px', padding: '0.55rem 0.6rem', fontSize: '0.85rem', width: '140px' }}
            placeholder="Song naam..."
          />
          <input
            type="text"
            value={songFolder}
            onChange={(e) => setSongFolder(e.target.value)}
            style={{ background: '#1e293b', color: '#e2e8f0', border: '1px solid var(--border-focus)', borderRadius: '6px', padding: '0.55rem 0.6rem', fontSize: '0.85rem', width: '110px' }}
            placeholder="Map..."
          />
          <button
            style={{ background: '#3b82f6', color: '#fff', padding: '0.6rem 1rem', borderRadius: '6px', fontWeight: 'bold', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
            onClick={handleSaveSong}
            title={currentSongId ? 'Overschrijf opgeslagen song' : 'Sla huidige song op'}
          >
            💾 {currentSongId ? 'Bewaar' : 'Sla op'}
          </button>
          <button
            style={{ background: '#475569', color: '#fff', padding: '0.6rem 1rem', borderRadius: '6px', fontWeight: 'bold', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
            onClick={() => setShowSongLibrary(true)}
            title="Open song bibliotheek"
          >
            📚 Bibliotheek
          </button>
          <button
            className="btn-primary"
            style={{ background: '#10b981', color: '#fff', padding: '0.6rem 1rem', borderRadius: '6px', fontWeight: 'bold', border: 'none' }}
            onClick={handleNewSong}
          >
            + New Song
          </button>

          {/* Song Library Modal */}
          {showSongLibrary && (
            <div
              onClick={() => setShowSongLibrary(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1.5rem', width: '520px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: '1rem' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '1rem', color: '#e2e8f0' }}>📚 Song Bibliotheek</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                      onClick={handleExportLibrary}
                      disabled={savedSongs.length === 0}
                      style={{ background: savedSongs.length > 0 ? '#1e293b' : 'transparent', color: savedSongs.length > 0 ? '#38bdf8' : '#475569', border: '1px solid #334155', borderRadius: '5px', padding: '0.25rem 0.6rem', fontSize: '0.78rem', cursor: savedSongs.length > 0 ? 'pointer' : 'default' }}
                      title="Download bibliotheek als .json bestand"
                    >⬇ Exporteer</button>
                    <label
                      style={{ background: '#1e293b', color: '#34d399', border: '1px solid #334155', borderRadius: '5px', padding: '0.25rem 0.6rem', fontSize: '0.78rem', cursor: 'pointer' }}
                      title="Importeer een gedeelde song (.kendang.json)"
                    >
                      ⬆ Song importeren
                      <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportSong} />
                    </label>
                    <label
                      style={{ background: '#1e293b', color: '#a78bfa', border: '1px solid #334155', borderRadius: '5px', padding: '0.25rem 0.6rem', fontSize: '0.78rem', cursor: 'pointer' }}
                      title="Importeer volledige bibliotheek"
                    >
                      ⬆ Bibliotheek
                      <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportLibrary} />
                    </label>
                    <button onClick={() => setShowSongLibrary(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
                  </div>
                </div>
                <input
                  type="text"
                  value={songSearchQuery}
                  onChange={(e) => setSongSearchQuery(e.target.value)}
                  placeholder="Zoek op naam of map..."
                  style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '6px', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                  autoFocus
                />
                <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {savedSongs.length === 0 ? (
                    <p style={{ color: '#64748b', textAlign: 'center', marginTop: '2rem' }}>Geen songs opgeslagen.</p>
                  ) : (() => {
                    const q = songSearchQuery.toLowerCase();
                    const filtered = savedSongs.filter(s =>
                      s.name.toLowerCase().includes(q) || (s.folder || 'Algemeen').toLowerCase().includes(q)
                    );
                    const byFolder = filtered.reduce((acc, s) => {
                      const f = s.folder || 'Algemeen';
                      if (!acc[f]) acc[f] = [];
                      acc[f].push(s);
                      return acc;
                    }, {});
                    const folders = Object.keys(byFolder).sort();
                    if (folders.length === 0) return (
                      <p style={{ color: '#64748b', textAlign: 'center', marginTop: '2rem' }}>Geen resultaten.</p>
                    );
                    return folders.map(folder => (
                      <div key={folder}>
                        <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0.25rem 0', borderBottom: '1px solid #334155', marginBottom: '0.25rem' }}>
                          📁 {folder}
                        </div>
                        {byFolder[folder].map(s => (
                          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.25rem', borderRadius: '6px', background: s.id === currentSongId ? 'rgba(59,130,246,0.15)' : 'transparent' }}>
                            <span style={{ flex: 1, color: s.id === currentSongId ? '#93c5fd' : '#e2e8f0', fontSize: '0.875rem' }}>
                              {s.id === currentSongId ? '▶ ' : ''}{s.name}
                              <span style={{ color: '#64748b', fontSize: '0.75rem', marginLeft: '0.5rem' }}>{s.date}</span>
                            </span>
                            <button
                              onClick={() => handleLoadSong(s.id)}
                              style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.25rem 0.6rem', fontSize: '0.8rem', cursor: 'pointer' }}
                            >Laad</button>
                            <button
                              onClick={() => handleExportSong(s)}
                              style={{ background: 'transparent', color: '#94a3b8', border: '1px solid #475569', borderRadius: '4px', padding: '0.25rem 0.6rem', fontSize: '0.8rem', cursor: 'pointer' }}
                              title="Exporteer als .json"
                            >↓</button>
                            <button
                              onClick={() => handleDeleteSong(s.id)}
                              style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.25rem 0.6rem', fontSize: '0.8rem', cursor: 'pointer' }}
                            >🗑</button>
                          </div>
                        ))}
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      </header>
      
      <div className="main-layout">

        {/* Floating drum panel */}
        <div
          className="drum-section-float glass-panel"
          style={{
            position: 'fixed',
            left: drumPos.x,
            top: drumPos.y,
            width: drumCollapsed ? 'auto' : drumSize.w,
            height: drumCollapsed ? 'auto' : drumSize.h,
            minWidth: drumCollapsed ? 0 : '180px',
            minHeight: drumCollapsed ? 0 : '160px',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Drag handle / title bar */}
          <div
            onMouseDown={(e) => { e.preventDefault(); startDrumInteract('drag', e.clientX, e.clientY); }}
            onTouchStart={(e) => { e.preventDefault(); startDrumInteract('drag', e.touches[0].clientX, e.touches[0].clientY); }}
            onDoubleClick={(e) => { e.preventDefault(); setDrumCollapsed(c => !c); }}
            style={{
              cursor: 'grab',
              background: drumCollapsed ? 'rgba(34,197,94,0.18)' : 'rgba(34,197,94,0.12)',
              borderBottom: '1px solid rgba(34,197,94,0.3)',
              padding: '4px 8px',
              fontSize: '0.65rem',
              color: '#86efac',
              userSelect: 'none',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              touchAction: 'none',
            }}
          >
            <span style={{ letterSpacing: '1px' }}>⠿</span>
            <span style={{ color: '#86efac' }}>Instrument</span>
            <span style={{ marginLeft: 'auto', fontSize: '0.6rem', color: '#4ade80' }}>{drumCollapsed ? '▸' : '▾'}</span>
          </div>

          {/* Content — verborgen wanneer ingeklapt */}
          <div style={{ flex: 1, overflow: 'auto', minHeight: 0, display: drumCollapsed ? 'none' : 'block' }}>
            <DrumPad
              onTrigger={handleDrumTrigger}
              inputMode={inputMode}
              setInputMode={setInputMode}
              onGongTrigger={handleGongFromInstrument}
              gongActive={(() => {
                if (!activeSlot) return false;
                const pat = song.find(p => p.id === activeSlot.patternId);
                if (!pat) return false;
                const blockStart = Math.floor(activeSlot.startIndex / 6) * 6;
                return (pat.gong || []).includes(blockStart);
              })()}
              soundSettings={soundSettings}
              onSoundSettingsChange={setSoundSettings}
            />
          </div>

          {/* Resize handle — bottom-right corner, verborgen wanneer ingeklapt */}
          {!drumCollapsed && <div
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startDrumInteract('resize', e.clientX, e.clientY); }}
            onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); startDrumInteract('resize', e.touches[0].clientX, e.touches[0].clientY); }}
            style={{
              position: 'absolute', bottom: 0, right: 0,
              width: '18px', height: '18px',
              cursor: 'nwse-resize',
              touchAction: 'none',
              display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
              padding: '2px',
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <line x1="9" y1="1" x2="1" y2="9" stroke="#475569" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="9" y1="5" x2="5" y2="9" stroke="#475569" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>}
        </div>

        <main className="sequencer-section">
        <div className="song-timeline">
          <div style={{ display: 'flex', alignItems: 'center', padding: '0.4rem 1rem 0.2rem', gap: '0.5rem' }}>
            <button
              onClick={() => setShowSongMap(true)}
              style={{ background: 'transparent', border: '1px solid #334155', borderRadius: '4px', color: '#64748b', cursor: 'pointer', padding: '0.2rem 0.5rem', fontSize: '0.85rem', lineHeight: 1, flexShrink: 0 }}
              title="Compositie-overzicht"
            >☰</button>
            <div style={{ flex: 1, fontSize: '1.1rem', fontWeight: 'bold', color: '#e2e8f0', letterSpacing: '0.02em', textAlign: 'center' }}>
              {songName}
            </div>
          </div>
          <SongMap
            song={song}
            activePatternId={activePatternId}
            open={showSongMap}
            onClose={() => setShowSongMap(false)}
            onActivate={(id) => {
              setActivePatternId(id);
              setActiveSlot(prev => prev ? { ...prev, patternId: id, startIndex: 0, endIndex: 0 } : { patternId: id, trackId: 'anak', startIndex: 0, endIndex: 0 });
              setTimeout(() => document.getElementById(`block-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250);
            }}
            onMoveUp={movePatternUp}
            onMoveDown={movePatternDown}
          />
          {(() => {
            let offset = 0;
            return song.map((pattern, idx) => {
              const measureOffset = offset;
              offset += Math.ceil(pattern.anak.length / 48);
              return (
                <React.Fragment key={pattern.id}>
                  {idx > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0', padding: '0 1rem' }}>
                      <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.04)' }} />
                      <button
                        onClick={() => insertSongBlockAfter(song[idx - 1].id)}
                        style={{ background: 'transparent', color: '#334155', border: '1px solid #1e293b', borderRadius: '4px', padding: '0.05rem 0.5rem', fontSize: '0.7rem', cursor: 'pointer', lineHeight: 1.4 }}
                        title="Voeg regel in"
                      >+ Regel</button>
                      <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.04)' }} />
                    </div>
                  )}
                  <div
                    id={`block-${pattern.id}`}
                    draggable
                    onDragStart={() => setDragPatId(pattern.id)}
                    onDragOver={(e) => { e.preventDefault(); setDragOverPatId(pattern.id); }}
                    onDragLeave={() => setDragOverPatId(null)}
                    onDrop={() => handlePatternDrop(pattern.id)}
                    style={{ outline: dragOverPatId === pattern.id && dragPatId !== pattern.id ? '2px dashed #3b82f6' : 'none', borderRadius: '8px' }}
                  >
                    <PatternEditor
                      pattern={pattern}
                      isActive={pattern.id === activePatternId}
                      onFocus={() => setActivePatternId(pattern.id)}
                      updatePattern={(newPat) => updatePattern(pattern.id, newPat)}
                      activeSlot={activeSlot}
                      setActiveSlot={setActiveSlot}
                      setInputMode={setInputMode}
                      clipboard={clipboard}
                      setClipboard={setClipboard}
                      handleUndo={handleUndo}
                      handleRedo={handleRedo}
                      undoStack={undoStack}
                      redoStack={redoStack}
                      bpm={bpm}
                      realtimeBpm={realtimeBpm}
                      handleBpmChange={handleBpmChange}
                      isRecording={isRecording}
                      toggleRecord={toggleRecord}
                      isPlaying={isPlaying}
                      togglePlay={togglePlay}
                      rewind={rewind}
                      stepBack={stepBack}
                      precount={precount}
                      gridResolution={gridResolution}
                      magneticInput={magneticInput}
                      setGridResolution={setGridResolution}
                      setMagneticInput={setMagneticInput}
                      autoQuantize={autoQuantize}
                      setAutoQuantize={setAutoQuantize}
                      inputEnabled={inputEnabled}
                      setInputEnabled={setInputEnabled}
                      savedSnippets={savedSnippets}
                      handleSaveSnippet={handleSaveSnippet}
                      handleInsertSnippet={handleInsertSnippet}
                      handleDeleteSnippet={handleDeleteSnippet}
                      insertMeasure={() => insertMeasure(pattern.id, activeSlot ? activeSlot.startIndex : 0)}
                      deleteMeasure={() => deleteMeasure(pattern.id, activeSlot ? activeSlot.startIndex : 0)}
                      onGongToggle={handleGongToggle}
                      measureOffset={measureOffset}
                      loopingPatternId={loopingPatternId}
                      onLoopPattern={handleLoopPattern}
                      soloTrack={soloTrack}
                      onToggleSolo={toggleSolo}
                      metronomeMode={metronomeMode}
                      setMetronomeMode={setMetronomeMode}
                      onUpdateTempoTrack={handleUpdateTempoTrack}
                      onSeek={handleSeek}
                      trackVolumes={trackVolumes}
                      onTrackVolumeChange={(track, val) => setTrackVolumes(v => ({ ...v, [track]: val }))}
                      onDuplicate={() => duplicateSongBlock(pattern.id)}
                      onMoveUp={() => movePatternUp(pattern.id)}
                      onMoveDown={() => movePatternDown(pattern.id)}
                      isFirst={idx === 0}
                      isLast={idx === song.length - 1}
                    />
                  </div>
                </React.Fragment>
              );
            });
          })()}

          {/* Append new block at the bottom */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.5rem 0 1.5rem', padding: '0 1rem' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
            <button
              onClick={addSongBlock}
              style={{ background: 'transparent', color: '#10b981', border: '1px solid #10b981', borderRadius: '4px', padding: '0.25rem 0.8rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 'bold' }}
              title="Voeg nieuwe regel toe aan het einde"
            >+ Voeg Regel Toe</button>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
          </div>
        </div>
        </main>
      </div>

    </div>
  );
}

export default App;
