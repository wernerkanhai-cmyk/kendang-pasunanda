import { useState, useRef, useEffect, useCallback, Fragment } from 'react';
import './App.css';
import { createEmptyPattern, writeSymbolToPattern, getHandForSymbol, generateEmptySlots, SYMBOL_REST, sanitizePattern } from './engine/patternLogic';
import PatternEditor from './components/PatternEditor';
import SongMap from './components/SongMap';
import DrumPad from './components/DrumPad';
import { exportSequencerToPDF, DEFAULT_PDF_SETTINGS } from './utils/export';
import { useTemplates } from './hooks/useTemplates';
import { AudioScheduler } from './engine/AudioScheduler';
import { SamplePlayer, DEFAULT_SOUND_SETTINGS } from './engine/SamplePlayer';
import { useT, useLanguage, LANGUAGES } from './i18n';
import { useSongs } from './hooks/useSongs';
import { loadSong as loadSongFromCloud } from './services/songRepo';
import { useSnippets } from './hooks/useSnippets';
import { useAuth } from './context/AuthContext';
import MigrationDialog from './components/MigrationDialog';

const encodeData = (data) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(data))));
const decodeData = (text) => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(text), c => c.charCodeAt(0))));

// Inline trash icon — uses currentColor so the parent button's `color` actually applies.
const TrashIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
  </svg>
);

function App() {
  const t = useT();
  const { language, setLanguage } = useLanguage();

  const [song, setSong] = useState(() => {
    try {
      const saved = localStorage.getItem('kendangCurrentSong');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed.map(sanitizePattern);
      }
    } catch {}
    return [createEmptyPattern(t('defaultSectionName'))];
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
  const [bpm, setBpm] = useState(() => {
    const saved = localStorage.getItem('kendangBpm');
    return saved ? parseInt(saved, 10) || 60 : 60;
  });
  useEffect(() => { localStorage.setItem('kendangBpm', String(bpm)); }, [bpm]);
  const [realtimeBpm, setRealtimeBpm] = useState(null); // null = not playing or no automation
  const [isPlaying, setIsPlaying] = useState(false);
  const [stepBackCount, setStepBackCount] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const loopingPatternIdRef = useRef(null);
  const [loopRange, setLoopRange] = useState(null); // { patternId, startSlot, endSlot } local slots
  const loopRangeRef = useRef(null);
  const [loopedSections, setLoopedSections] = useState([]); // patternIds die in de section-loop zitten
  const [mutedTrack, setMutedTrack] = useState(null); // null | 'anak' | 'indung'
  const mutedTrackRef = useRef(null);
  const [metronomeMode, setMetronomeMode] = useState(''); // '' | '4' | '8' | 'click' | 'precount'
  const [metronomeVolume, setMetronomeVolume] = useState(0.7);
  const [isLocked, setIsLocked] = useState(true);
  const [isPulsing, setIsPulsing] = useState(false);
  const schedulerRef = useRef(null);
  const samplerRef = useRef(null);

  // Sample set: 'kendang' of 'vox'
  const [sampleSet, setSampleSet] = useState(() => localStorage.getItem('kendangSampleSet') || 'kendang');
  const sampleSetRef = useRef(sampleSet);
  useEffect(() => {
    sampleSetRef.current = sampleSet;
    localStorage.setItem('kendangSampleSet', sampleSet);
    samplerRef.current?.setSampleSet(sampleSet);
  }, [sampleSet]);


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

  // Vox volume (afzonderlijk van track volumes)
  const [voxVolume, setVoxVolume] = useState(0.5);
  const voxVolumeRef = useRef(0.5);
  useEffect(() => { voxVolumeRef.current = voxVolume; }, [voxVolume]);

  // Grid & Quantize State
  const [gridResolution, setGridResolution] = useState(6); // 1/8 by default
  const [magneticInput, setMagneticInput] = useState(false);
  const [autoQuantize, setAutoQuantize] = useState(false); // Q: snap to grid during live recording
  const [inputEnabled, setInputEnabled] = useState(true); // Invoer op tijdlijn aan/uit


  // Persist current working song so it survives page reloads and deploys
  useEffect(() => {
    localStorage.setItem('kendangCurrentSong', JSON.stringify(song));
    // If activePatternId points to a pattern that no longer exists in the song,
    // reset to the first pattern so the transport bar stays visible.
    if (song.length > 0 && !song.some(p => p.id === activePatternId)) {
      setActivePatternId(song[0].id);
      setActiveSlot({ patternId: song[0].id, trackId: 'anak', startIndex: 0, endIndex: 0 });
    }
  }, [song]);
  useEffect(() => {
    if (activePatternId) localStorage.setItem('kendangCurrentPatternId', activePatternId);
  }, [activePatternId]);

  // Scroll active pattern timeline into view on rewind
  useEffect(() => {
    if (!stepBackCount) return;
    document.getElementById(`timeline-${activePatternId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [stepBackCount]);

  // When switching between edit and practice mode, scroll the playhead into view
  useEffect(() => {
    const id = setTimeout(() => {
      document.getElementById(`timeline-${activePatternId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
    return () => clearTimeout(id);
  }, [isLocked]);

  // Cloud sync — single source of truth for saved songs is Supabase.
  // localStorage acts as a one-time fallback during migration (phase 6 cleans it up).
  const { user, signOut, setNewPassword } = useAuth();
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  useEffect(() => {
    const onUp = () => setIsOnline(true);
    const onDown = () => setIsOnline(false);
    window.addEventListener('online', onUp);
    window.addEventListener('offline', onDown);
    return () => { window.removeEventListener('online', onUp); window.removeEventListener('offline', onDown); };
  }, []);
  const { songs: cloudSongs, save: cloudSave, remove: cloudRemove } = useSongs();
  const { snippets: cloudSnippets, save: cloudSnippetSave, remove: cloudSnippetRemove } = useSnippets();
  const { templates: dbTemplates, snippetTemplates: dbSnippetTemplates, publishSong: publishTemplate, removeSong: removeTemplate, publishSnippet: publishSnippetTemplate, removeSnippet: removeSnippetTemplate } = useTemplates();
  const isAdmin = user?.email === 'wernerkanhai@mac.com';

  // Snippet library — cloud when signed in, localStorage otherwise
  const [localSavedSnippets, setLocalSavedSnippets] = useState(() => {
    const saved = localStorage.getItem('kendangSnippets');
    return saved ? JSON.parse(saved) : [];
  });
  const savedSnippets = user ? cloudSnippets : localSavedSnippets;
  useEffect(() => {
    if (user) return;
    localStorage.setItem('kendangSnippets', JSON.stringify(localSavedSnippets));
  }, [localSavedSnippets, user]);

  // Saved Songs Library — derived from cloud once available, falls back to localStorage.
  const [localSavedSongs, setLocalSavedSongs] = useState(() => {
    const saved = localStorage.getItem('kendangSavedSongs');
    return saved ? JSON.parse(saved) : [];
  });
  const savedSongs = user ? cloudSongs : localSavedSongs;
  const [currentSongId, setCurrentSongId] = useState(() => localStorage.getItem('kendangCurrentSongId') || null);
  const [songName, setSongName] = useState(() => localStorage.getItem('kendangSongName') || 'Song 1');
  const [songFolder, setSongFolder] = useState(() => localStorage.getItem('kendangSongFolder') || 'Algemeen');
  useEffect(() => {
    if (currentSongId) localStorage.setItem('kendangCurrentSongId', currentSongId);
    else localStorage.removeItem('kendangCurrentSongId');
  }, [currentSongId]);
  useEffect(() => { localStorage.setItem('kendangSongName', songName); }, [songName]);
  useEffect(() => { localStorage.setItem('kendangSongFolder', songFolder); }, [songFolder]);

  // On mount: if there's a currentSongId and the user is online, silently
  // check if the cloud version is newer and replace local data if so.
  useEffect(() => {
    if (!currentSongId || !user || !isOnline) return;
    let alive = true;
    loadSongFromCloud(currentSongId)
      .then((cloud) => {
        if (!alive || !cloud) return;
        // Compare the cloud patterns with what we have locally. If they
        // differ the cloud version wins (it was saved from another device
        // or an auto-save that didn't make it into this localStorage).
        const cloudJson = JSON.stringify(cloud.patterns);
        const localJson = JSON.stringify(song);
        if (cloudJson !== localJson) {
          setSong(cloud.patterns);
          lastSavedSnapshotRef.current = cloudJson;
        }
        if (cloud.name && cloud.name !== songName) setSongName(cloud.name);
        if (cloud.folder && cloud.folder !== songFolder) setSongFolder(cloud.folder);
        if (cloud.bpm && cloud.bpm !== bpm) {
          setBpm(cloud.bpm);
          if (schedulerRef.current) schedulerRef.current.setBpm(cloud.bpm);
        }
      })
      .catch(() => { /* offline or deleted — keep local */ });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const [showSongLibrary, setShowSongLibrary] = useState(false);
  const [newSongFolderMode, setNewSongFolderMode] = useState(false);
  const [renamingFolder, setRenamingFolder] = useState(null); // folder name being renamed
  const [renameFolderInput, setRenameFolderInput] = useState('');
  const [moveSongTarget, setMoveSongTarget] = useState(null); // { id, name, currentFolder } for move dialog
  const [moveSongFolderInput, setMoveSongFolderInput] = useState('');
  const [renamingSongId, setRenamingSongId] = useState(null);
  const [renameSongInput, setRenameSongInput] = useState('');
  const [exportSelection, setExportSelection] = useState(() => new Set()); // song ids checked for selective export
  const [collapsedFolders, setCollapsedFolders] = useState(() => new Set()); // folder names that are collapsed in the library
  const [librarySort, setLibrarySort] = useState(() => {
    return localStorage.getItem('kendangLibrarySort') || 'name';
  }); // 'name' | 'recent'
  useEffect(() => {
    localStorage.setItem('kendangLibrarySort', librarySort);
  }, [librarySort]);
  const [pendingDelete, setPendingDelete] = useState(null); // { type: 'song'|'folder', key } — highlights the active delete button
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [changePasswordValue, setChangePasswordValue] = useState('');
  const [changePasswordValue2, setChangePasswordValue2] = useState('');
  const [changePasswordBusy, setChangePasswordBusy] = useState(false);
  const [toast, setToast] = useState(null); // { message, kind: 'info'|'success'|'error' } — auto-dismisses after a short delay
  const toastTimerRef = useRef(null);
  const showToast = (message, kind = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, kind });
    toastTimerRef.current = setTimeout(() => setToast(null), 2200);
  };
  const lastSavedSnapshotRef = useRef(null); // serialized snapshot of the last save/load — used to flag unsaved changes
  const isModifiedSinceSave = !!currentSongId && lastSavedSnapshotRef.current !== null && JSON.stringify(song) !== lastSavedSnapshotRef.current;
  const toggleFolderCollapsed = (folder) => {
    setCollapsedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folder)) next.delete(folder); else next.add(folder);
      return next;
    });
  };
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [showSongMenu, setShowSongMenu] = useState(false);
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
  const [songMapTop, setSongMapTop] = useState(0);

  const handleOpenSongMap = () => {
    const activeBlock = document.getElementById(`block-${activePatternId}`);
    if (activeBlock) {
      const rect = activeBlock.getBoundingClientRect();
      // Clamp so the panel always stays on screen
      setSongMapTop(Math.max(0, Math.min(rect.top, window.innerHeight - 200)));
    } else {
      setSongMapTop(0);
    }
    setShowSongMap(v => !v); // toggle instead of always open
  };

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
    try {
      const s = JSON.parse(localStorage.getItem('drumSize'));
      // Reset legacy fixed height (520) to auto
      if (s?.h === 520) return { w: s.w ?? 300, h: null };
      return s || { w: 300, h: null };
    } catch { return { w: 300, h: null }; }
  });
  const drumPanelRef = useRef(null);
  const [drumCollapsed, setDrumCollapsed] = useState(false);
  useEffect(() => { localStorage.setItem('drumPos', JSON.stringify(drumPos)); }, [drumPos]);
  useEffect(() => { localStorage.setItem('drumSize', JSON.stringify(drumSize)); }, [drumSize]);

  const drumInteractRef = useRef(null);
  const startDrumInteract = (type, clientX, clientY) => {
    const currentH = drumSize.h ?? (drumPanelRef.current?.offsetHeight ?? 300);
    drumInteractRef.current = {
      type, startX: clientX, startY: clientY,
      origX: drumPos.x, origY: drumPos.y,
      startW: drumSize.w, startH: currentH,
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
    // Only mirror to localStorage when there is no logged-in user. When the
    // user is signed in the cloud is the source of truth and we leave the
    // legacy localStorage blob untouched until the migration dialog runs.
    if (user) return;
    localStorage.setItem('kendangSavedSongs', JSON.stringify(localSavedSongs));
  }, [localSavedSongs, user]);

  // Import library dialog
  const [pendingImport, setPendingImport] = useState(null); // { songs: [] } wacht op mapkeuze
  const [importFolderName, setImportFolderName] = useState('');

  // The global switch dictating which track we are writing to from the DrumPad
  const [inputMode, setInputMode] = useState('anak'); // 'anak' or 'indung'



  // Ref to track tapping speed without stale closures for smart resolution
  const drumTapRef = useRef({ time: 0, slotIndex: 0, trackId: '' });
  const lastRewindTimeRef = useRef(0);
  const currentAudioSlotRef = useRef(0); // Werkelijke afspeelslot (gesynchroniseerd met onTick)
  const playStartWallTimeRef = useRef(0); // Date.now() op moment dat slot 0 klinkt

  // Cursor-audio offset: negatief = cursor volgt later (compenseert AirPlay/Bluetooth latency)
  const [cursorOffsetMs, setCursorOffsetMs] = useState(() => {
    return parseInt(localStorage.getItem('kendangCursorOffsetMs') || '0', 10);
  });
  const cursorOffsetMsRef = useRef(cursorOffsetMs);
  useEffect(() => {
    cursorOffsetMsRef.current = cursorOffsetMs;
    localStorage.setItem('kendangCursorOffsetMs', String(cursorOffsetMs));
  }, [cursorOffsetMs]);

  // ── SAVE FLOWS — three explicit actions ──────────────────────────────────
  // saveCurrent: overwrite the currently loaded song (Update). No-ops if there
  //   is no loaded song; the UI hides the button in that case.
  // saveAsNew: create a new song row with the current name + folder. Used when
  //   nothing is loaded yet, or when the user explicitly wants a fresh entry.
  // saveAsCopy: duplicate the current state into a new row, appending '(kopie)'
  //   to the title so it's findable in the library.

  const _persist = async (payload) => {
    let result;
    if (user) {
      try {
        result = await cloudSave(payload);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Cloud save failed, falling back to localStorage:', err);
        alert('Opslaan in cloud mislukt — opgeslagen alleen lokaal.');
      }
    }
    if (!result) {
      // Fallback: legacy localStorage path
      const entry = {
        id: payload.id || Date.now().toString(),
        name: payload.name,
        folder: payload.folder,
        date: new Date().toLocaleDateString('nl-NL'),
        patterns: payload.patterns,
      };
      if (payload.id) {
        setLocalSavedSongs(prev => prev.map(s => s.id === payload.id ? entry : s));
      } else {
        setLocalSavedSongs(prev => [...prev, entry]);
      }
      result = entry;
    }
    // Snapshot the patterns we just persisted so the unsaved-changes indicator resets.
    lastSavedSnapshotRef.current = JSON.stringify(payload.patterns);
    return result;
  };

  const handleUpdateSong = async () => {
    if (!currentSongId) return;
    const fresh = await _persist({
      id: currentSongId,
      name: songName.trim() || 'Naamloos',
      folder: songFolder.trim() || 'Algemeen',
      bpm,
      patterns: JSON.parse(JSON.stringify(song)),
    });
    if (fresh) {
      setCurrentSongId(fresh.id);
      showToast('Opgeslagen ✓');
    }
  };

  const handleSaveAsNew = async () => {
    const fresh = await _persist({
      id: null,
      name: songName.trim() || 'Naamloos',
      folder: songFolder.trim() || 'Algemeen',
      bpm,
      patterns: JSON.parse(JSON.stringify(song)),
    });
    if (fresh) {
      setCurrentSongId(fresh.id);
      showToast('Nieuwe song opgeslagen ✓');
    }
  };

  const handleSaveAsCopy = async () => {
    const baseName = songName.trim() || 'Naamloos';
    const copyName = `${baseName} (kopie)`;
    await _persist({
      id: null,
      name: copyName,
      folder: songFolder.trim() || 'Algemeen',
      bpm,
      patterns: JSON.parse(JSON.stringify(song)),
    });
    // Stay on the original song — the copy is a snapshot in the library.
    // User can load it from there if they want to work on it.
    showToast(`"${copyName}" opgeslagen in library`);
  };

  // ── Auto-save ────────────────────────────────────────────────────────────
  // When a cloud song is loaded and the user makes changes:
  //   1. Debounce 5 seconds after the last edit and silently save.
  //   2. Also flush the latest state when the tab is hidden or the page is
  //      about to unload, so a refresh or app-switch never loses work.
  // Auto-save is silent (no toast spam). If it fails the unsaved-changes dot
  // stays visible so the user knows.
  const autoSaveStateRef = useRef({ song, songName, songFolder, bpm, currentSongId, isModified: false, user: null });
  useEffect(() => {
    autoSaveStateRef.current = { song, songName, songFolder, bpm, currentSongId, isModified: isModifiedSinceSave, user };
  }, [song, songName, songFolder, bpm, currentSongId, isModifiedSinceSave, user]);

  const flushAutoSave = useCallback(() => {
    const s = autoSaveStateRef.current;
    if (!s.user || !s.currentSongId || !s.isModified) return;
    _persist({
      id: s.currentSongId,
      name: (s.songName || '').trim() || 'Naamloos',
      folder: (s.songFolder || '').trim() || 'Algemeen',
      bpm: s.bpm,
      patterns: JSON.parse(JSON.stringify(s.song)),
    }).catch(err => console.warn('Auto-save failed (will retry):', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced auto-save: 5s after the last edit
  useEffect(() => {
    if (!user || !currentSongId || !isOnline || !isModifiedSinceSave) return;
    const id = setTimeout(flushAutoSave, 5000);
    return () => clearTimeout(id);
  }, [song, currentSongId, isOnline, user, isModifiedSinceSave, flushAutoSave]);

  // Flush on tab hide / page unload
  useEffect(() => {
    const onVisibility = () => { if (document.visibilityState === 'hidden') flushAutoSave(); };
    const onPageHide = () => flushAutoSave();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onPageHide);
    };
  }, [flushAutoSave]);

  // Rename a saved song. Reuses _persist so cloud + localStorage stay aligned.
  const handleRenameSong = async (song, newName) => {
    const trimmed = (newName || '').trim();
    if (!trimmed || trimmed === song.name) { setRenamingSongId(null); return; }
    const fresh = await _persist({
      id: song.id,
      name: trimmed,
      folder: song.folder || 'Algemeen',
      bpm: song.bpm ?? bpm,
      patterns: song.patterns ?? [],
    });
    if (fresh && song.id === currentSongId) setSongName(trimmed);
    setRenamingSongId(null);
    setRenameSongInput('');
    if (fresh) showToast(`Hernoemd naar "${trimmed}"`);
  };

  // Move a saved song to a different folder. Reuses _persist so the cloud
  // path stays in one place.
  const handleMoveSongToFolder = async (song, targetFolder) => {
    const folder = (targetFolder || '').trim() || 'Algemeen';
    if ((song.folder || 'Algemeen') === folder) { setMoveSongTarget(null); return; }
    const fresh = await _persist({
      id: song.id,
      name: song.name,
      folder,
      bpm: song.bpm ?? bpm,
      patterns: song.patterns ?? [],
    });
    if (fresh && song.id === currentSongId) setSongFolder(folder);
    setMoveSongTarget(null);
    setMoveSongFolderInput('');
    if (fresh) showToast(`Verplaatst naar "${folder}"`);
  };

  const handleNewSong = () => {
    const newSongName = `Song ${savedSongs.length + 2}`;
    const fresh = createEmptyPattern(t('defaultSectionName'));
    setSong([fresh]);
    lastSavedSnapshotRef.current = null;
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
    lastSavedSnapshotRef.current = JSON.stringify(toLoad.patterns);
    setActivePatternId(toLoad.patterns[0].id);
    setActiveSlot({ patternId: toLoad.patterns[0].id, trackId: 'anak', startIndex: 0, endIndex: 0 });
    setUndoStack([]);
    setRedoStack([]);
    setCurrentSongId(toLoad.id);
    setSongName(toLoad.name);
    setSongFolder(toLoad.folder || 'Algemeen');
    setShowSongLibrary(false);
    setExportSelection(new Set());
  };

  const handleDeleteSong = async (id) => {
    const target = savedSongs.find(s => s.id === id);
    const name = target?.name || 'deze song';
    setPendingDelete({ type: 'song', key: id });
    // Yield to the browser so the red highlight paints before the blocking confirm.
    await new Promise(r => setTimeout(r, 50));
    const ok = window.confirm(`Weet je zeker dat je "${name}" wilt verwijderen?\n\nDeze actie kan niet ongedaan worden gemaakt.`);
    setPendingDelete(null);
    if (!ok) return;
    if (user) {
      try {
        await cloudRemove(id);
        if (currentSongId === id) setCurrentSongId(null);
        showToast(`"${name}" verwijderd`);
        return;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Cloud delete failed, falling back to localStorage:', err);
        alert('Verwijderen in cloud mislukt.');
        return;
      }
    }
    setLocalSavedSongs(prev => prev.filter(s => s.id !== id));
    if (currentSongId === id) setCurrentSongId(null);
    showToast(`"${name}" verwijderd`);
  };

  const handleDeleteFolder = async (folderName) => {
    const inFolder = savedSongs.filter(s => (s.folder || 'Algemeen') === folderName);
    if (inFolder.length === 0) return;
    setPendingDelete({ type: 'folder', key: folderName });
    await new Promise(r => setTimeout(r, 50));
    const msg = `Weet je zeker dat je de map "${folderName}" wilt verwijderen?\n\nDit verwijdert ${inFolder.length} song${inFolder.length === 1 ? '' : 's'} permanent.\n\nDeze actie kan niet ongedaan worden gemaakt.`;
    const ok = window.confirm(msg);
    setPendingDelete(null);
    if (!ok) return;
    if (user) {
      for (const s of inFolder) {
        try { await cloudRemove(s.id); }
        catch (err) { console.error('Folder delete failed for', s.name, err); }
      }
    } else {
      setLocalSavedSongs(prev => prev.filter(s => (s.folder || 'Algemeen') !== folderName));
    }
    if (inFolder.some(s => s.id === currentSongId)) setCurrentSongId(null);
    setCollapsedFolders(prev => {
      const next = new Set(prev); next.delete(folderName); return next;
    });
    showToast(`Map "${folderName}" verwijderd (${inFolder.length} song${inFolder.length === 1 ? '' : 's'})`);
  };

  const handleRenameFolder = async (oldName, newName) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) { setRenamingFolder(null); return; }
    if (user) {
      // Cloud path: re-save every song in this folder with the new folder name.
      const inFolder = savedSongs.filter(s => (s.folder || 'Algemeen') === oldName);
      for (const s of inFolder) {
        try {
          await _persist({
            id: s.id,
            name: s.name,
            folder: trimmed,
            bpm: s.bpm ?? bpm,
            patterns: s.patterns ?? [],
          });
        } catch (err) { console.error('Folder rename failed for', s.name, err); }
      }
    } else {
      setLocalSavedSongs(prev => prev.map(s => s.folder === oldName ? { ...s, folder: trimmed } : s));
    }
    if (songFolder === oldName) setSongFolder(trimmed);
    setRenamingFolder(null);
  };

  const handleExportSong = (s) => {
    const encoded = encodeData(s);
    const blob = new Blob([encoded], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${s.name.replace(/[^a-z0-9]/gi, '_')}.kendang`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteSelection = async () => {
    const picked = savedSongs.filter(s => exportSelection.has(s.id));
    if (picked.length === 0) return;
    setPendingDelete({ type: 'bulk', key: 'selection' });
    await new Promise(r => setTimeout(r, 50));
    const ok = window.confirm(`Weet je zeker dat je ${picked.length} song${picked.length === 1 ? '' : 's'} wilt verwijderen?\n\nDeze actie kan niet ongedaan worden gemaakt.`);
    setPendingDelete(null);
    if (!ok) return;
    let removed = 0;
    if (user) {
      for (const s of picked) {
        try { await cloudRemove(s.id); removed++; }
        catch (err) { console.error('Bulk delete failed for', s.name, err); }
      }
    } else {
      const ids = new Set(picked.map(s => s.id));
      setLocalSavedSongs(prev => prev.filter(s => !ids.has(s.id)));
      removed = picked.length;
    }
    if (picked.some(s => s.id === currentSongId)) setCurrentSongId(null);
    setExportSelection(new Set());
    showToast(`${removed} song${removed === 1 ? '' : 's'} verwijderd`);
  };

  const handleExportSelection = () => {
    const picked = savedSongs.filter(s => exportSelection.has(s.id));
    if (picked.length === 0) return;
    const encoded = encodeData(picked);
    const blob = new Blob([encoded], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kendang-selectie-${picked.length}-${new Date().toISOString().slice(0, 10)}.kendang-lib`;
    a.click();
    URL.revokeObjectURL(url);
    setExportSelection(new Set());
  };

  const toggleExportSong = (id) => {
    setExportSelection(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleExportFolder = (songsInFolder) => {
    setExportSelection(prev => {
      const next = new Set(prev);
      const allChecked = songsInFolder.every(s => next.has(s.id));
      if (allChecked) {
        for (const s of songsInFolder) next.delete(s.id);
      } else {
        for (const s of songsInFolder) next.add(s.id);
      }
      return next;
    });
  };

  // Single import flow: accepts both .kendang (one song) and .kendang-lib
  // (array of songs). For single songs we re-use handleImportSong directly.
  // For arrays we open the folder-picker dialog.
  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = decodeData(ev.target.result);
        if (Array.isArray(imported)) {
          const valid = imported.filter(s => s.name && Array.isArray(s.patterns));
          if (valid.length === 0) throw new Error();
          const suggested = file.name.replace(/\.(kendang-lib|kendang)$/i, '').replace(/[_-]/g, ' ');
          setImportFolderName(suggested);
          setPendingImport({ songs: valid });
        } else if (imported && imported.name && Array.isArray(imported.patterns)) {
          // Reuse the song-import path by faking the file event shape
          // (handleImportSong reads the file again from e.target.files[0],
          // so we just call its inner logic inline).
          (async () => {
            const valid = [imported];
            if (user) {
              let ok = 0;
              for (const s of valid) {
                try {
                  await cloudSave({ id: null, name: s.name, folder: s.folder || 'Algemeen', bpm: s.bpm ?? 100, patterns: s.patterns });
                  ok++;
                } catch (err) { console.error('Import failed for', s.name, err); }
              }
              alert(t('importedSongs')(ok));
            } else {
              setLocalSavedSongs(prev => [...prev, ...valid.map(s => ({ ...s, id: s.id || Date.now().toString() + Math.random() }))]);
              alert(t('importedSongs')(valid.length));
            }
          })();
        } else {
          throw new Error('Unrecognised file');
        }
      } catch {
        alert(t('invalidFile') || t('invalidLibrary'));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const confirmImportLibrary = async (folderOverride) => {
    if (!pendingImport) return;
    const songs = pendingImport.songs;
    if (user) {
      let ok = 0;
      for (const s of songs) {
        try {
          await cloudSave({
            id: null,
            name: s.name,
            folder: folderOverride || s.folder || 'Algemeen',
            bpm: s.bpm ?? 100,
            patterns: s.patterns ?? [],
          });
          ok++;
        } catch (err) { console.error('Library import failed for', s.name, err); }
      }
      alert(t('importedSongs')(ok));
    } else {
      setLocalSavedSongs(prev => {
        const existingIds = new Set(prev.map(s => s.id));
        const nieuwen = songs.map(s => ({
          ...s,
          id: existingIds.has(s.id) ? Date.now().toString() + Math.random() : s.id,
          folder: folderOverride || s.folder || 'Algemeen',
        }));
        return [...prev, ...nieuwen];
      });
    }
    setPendingImport(null);
    setImportFolderName('');
  };

  // Load a factory template into the editor as a brand-new editable song.
  // The template itself stays untouched in src/factory/presets.js. The user
  // is asked for a name + folder via a small dialog (state below).
  const handleUseTemplate = async (template, targetName, targetFolder) => {
    const name = (targetName || template.name || 'Naamloos').trim();
    const folder = (targetFolder || 'Algemeen').trim() || 'Algemeen';
    const patternsCopy = JSON.parse(JSON.stringify(template.patterns ?? [])).map(p => ({
      ...p,
      id: p.id || crypto.randomUUID(),
    }));
    const fresh = await _persist({
      id: null,
      name,
      folder,
      bpm: template.bpm ?? bpm,
      patterns: patternsCopy,
    });
    if (fresh) {
      setSong(patternsCopy);
      setActivePatternId(patternsCopy[0]?.id);
      setActiveSlot({ patternId: patternsCopy[0]?.id, trackId: 'anak', startIndex: 0, endIndex: 0 });
      setUndoStack([]);
      setRedoStack([]);
      setCurrentSongId(fresh.id);
      setSongName(name);
      setSongFolder(folder);
    }
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

  const handleDeleteSongBlock = (patternId) => {
    setSong(prev => {
      if (prev.length <= 1) return prev; // keep at least one section
      const next = prev.filter(p => p.id !== patternId);
      if (activePatternId === patternId) setActivePatternId(next[0]?.id ?? null);
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

  const snapSelectionToGrid = () => {
    if (!activeSlot) return;
    const { patternId, trackId } = activeSlot;
    const start = Math.min(activeSlot.startIndex, activeSlot.endIndex ?? activeSlot.startIndex);
    const end   = Math.max(activeSlot.startIndex, activeSlot.endIndex ?? activeSlot.startIndex);

    const pattern = song.find(p => p.id === patternId);
    if (!pattern) return;

    const track = pattern[trackId].map(s => ({ ...s }));

    // Verzamel alle noten in de selectie die niet op het grid staan
    const notes = [];
    for (let i = start; i <= end; i++) {
      const slot = track[i];
      if (!slot) continue;
      if (slot.top    && slot.top    !== '') notes.push({ from: i, hand: 'top',    symbol: slot.top });
      if (slot.bottom && slot.bottom !== '') notes.push({ from: i, hand: 'bottom', symbol: slot.bottom });
    }
    if (notes.every(n => n.from % gridResolution === 0)) return; // al op grid

    // Wis originele posities in selectie
    for (let i = start; i <= end; i++) {
      track[i] = { ...track[i], top: '', bottom: '' };
    }

    // Zet noten op dichtstbijzijnde gridpunt + auto-fill één voorgaand ruspunt
    for (const note of notes) {
      const snapped  = Math.round(note.from / gridResolution) * gridResolution;
      const clamped  = Math.max(0, Math.min(track.length - 1, snapped));
      track[clamped] = { ...track[clamped], [note.hand]: note.symbol };
      // Auto-fill: place rest at the single preceding grid position if empty
      const prevPos = Math.floor((clamped - 1) / gridResolution) * gridResolution;
      if (prevPos >= 0 && prevPos < clamped) {
        const prevSlot = track[prevPos];
        if (!prevSlot[note.hand]) {
          track[prevPos] = { ...prevSlot, [note.hand]: SYMBOL_REST };
        }
      }
    }

    updatePattern(patternId, { ...pattern, [trackId]: track });
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

  const deleteMeasuresFromEnd = (patternId, count) => {
    setUndoStack(prev => [...prev.slice(-49), song]);
    setRedoStack([]);

    let newLength = 0;

    setSong(prevSong => {
      const pIdx = prevSong.findIndex(p => p.id === patternId);
      if (pIdx === -1) return prevSong;

      const p = prevSong[pIdx];
      const slotsToRemove = count * 48;
      const clampedLength = Math.max(48, p.anak.length - slotsToRemove);
      if (clampedLength === p.anak.length) return prevSong;

      const newPattern = JSON.parse(JSON.stringify(p));
      newPattern.anak   = newPattern.anak.slice(0, clampedLength);
      newPattern.indung = newPattern.indung.slice(0, clampedLength);
      if (newPattern.gong) newPattern.gong = newPattern.gong.filter(g => g < clampedLength);

      newLength = clampedLength;
      const nextSong = [...prevSong];
      nextSong[pIdx] = newPattern;
      return nextSong;
    });

    setTimeout(() => {
      if (newLength > 0) {
        setActiveSlot(prev => {
          if (!prev || prev.patternId !== patternId) return prev;
          const clamped = Math.min(prev.startIndex, newLength - 1);
          return { ...prev, startIndex: clamped, endIndex: clamped };
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
    sampler.setSampleSet(sampleSetRef.current);
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
          if (mutedTrackRef.current === track) return;
          const slot = tickPattern[track][localSlot];
          if (slot) {
            const tvol = (trackVolumesRef.current[track] ?? 1.0) * (sampleSetRef.current === 'vox' ? voxVolumeRef.current : 1.0);
            sampler.playSlot(slot.top, slot.bottom, track, audioTime, tvol);
          }
        });
        if ((tickPattern.gong || []).includes(localSlot)) sampler.playGong(audioTime);
      }
    );
    // Koppel direct — geen race condition met .then()
    schedulerRef.current.setAudioContext(sharedCtx);
    schedulerRef.current.setDestinationGetter(() => samplerRef.current?.getMasterDestination());
    schedulerRef.current.setBpm(bpm);

    // Safari/iOS vereist dat het eerste audio-node synchroon binnen de gesture handler wordt gestart.
    // resume().then(...) is niet voldoende — start de silent buffer VOOR de await/then.
    const unlockAudio = () => {
      const ctx = samplerRef.current?.audioCtx;
      if (!ctx || ctx.state === 'running') return;
      try {
        const silent = ctx.createBuffer(1, 1, ctx.sampleRate);
        const src = ctx.createBufferSource();
        src.buffer = silent;
        src.connect(ctx.destination);
        src.start(0); // synchroon binnen gesture — ontgrendelt Safari/iOS
      } catch (_) {}
      ctx.resume();
    };
    // touchstart vuurt vroeg in het gebaar (iOS); pointerdown dekt muis + stylus; keydown dekt toetsenbord
    const UNLOCK_EVENTS = [
      ['touchstart', { passive: true }],
      ['pointerdown', undefined],
      ['keydown',    undefined],
    ];
    UNLOCK_EVENTS.forEach(([type, opts]) => window.addEventListener(type, unlockAudio, opts));

    // bfcache-fix: als de browser de pagina herstelt uit de back-forward cache
    // loopt de scheduler-timer gewoon door. Stop alles zodra dat gedetecteerd wordt.
    const resetPlayback = () => {
      schedulerRef.current?.pause();
      // Cut off any audio that was queued in the AudioContext before suspend.
      samplerRef.current?.silenceAll();
      setIsPlaying(false);
      setIsRecording(false);
      loopingPatternIdRef.current = null;
      loopRangeRef.current = null;
      setLoopRange(null);
      slotTimesRef.current = null; // force rebuild on next play
    };

    // bfcache + iPad PWA standalone reopens — always reset, not only when persisted
    const onPageShow = () => resetPlayback();
    window.addEventListener('pageshow', onPageShow);

    // iOS PWA suspend/resume — when the app becomes visible again, kill any stale
    // scheduler and recover the AudioContext if it's in a broken state.
    const onVisibility = async () => {
      if (document.visibilityState === 'visible') {
        resetPlayback();
        // Check if AudioContext is dead — if so, fully recreate it
        const ctx = samplerRef.current?.audioCtx;
        if (!ctx || ctx.state === 'closed' || ctx.state === 'suspended') {
          try {
            const newCtx = await samplerRef.current.resetAudioContext();
            if (schedulerRef.current && newCtx) {
              schedulerRef.current.setAudioContext(newCtx);
            }
          } catch (_) {}
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    // First mount: ensure scheduler isn't carrying over state from a previous session
    resetPlayback();

    return () => {
      schedulerRef.current.stop();
      UNLOCK_EVENTS.forEach(([type]) => window.removeEventListener(type, unlockAudio));
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []); // Run once on mount

  // Cursor: AudioContext-clock interval — exact dezelfde klok als de audio scheduler
  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => {
      const sched = schedulerRef.current;
      if (!sched?.isPlaying || !sched.audioCtx) return;
      const ctx = sched.audioCtx;
      // Safari rapporteert outputLatency als negatief getal (omgekeerd teken) — gebruik Math.abs
      const outputLatencyS = Math.abs(ctx.outputLatency || 0) + Math.abs(ctx.baseLatency || 0);
      const elapsed = (ctx.currentTime - sched.playStartAudioTime - outputLatencyS) * 1000 + cursorOffsetMsRef.current;
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
      const hasAutomation = currentSong.some(p => p.tempoTrack && p.tempoTrack.length > 0 && p.tempoTrackEnabled !== false);
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

  // Auto-scroll: zet de actieve sectie bovenaan zodra het afspelen er naartoe gaat
  const lastScrolledPatternRef = useRef(null);
  useEffect(() => {
    if (!isPlaying || !activeSlot) return;
    const id = activeSlot.patternId;
    if (id === lastScrolledPatternRef.current) return;
    lastScrolledPatternRef.current = id;
    document.getElementById(`block-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [isPlaying, activeSlot?.patternId]);

  // Lookahead-scroll: als de cursor de laatste maat ingaat, maak de volgende sectie alvast zichtbaar
  const lastPreScrolledRef = useRef(null);
  useEffect(() => {
    if (!isPlaying || !activeSlot) return;
    const currentIdx = song.findIndex(p => p.id === activeSlot.patternId);
    if (currentIdx < 0 || currentIdx >= song.length - 1) return;
    const currentPattern = song[currentIdx];
    if (activeSlot.startIndex < currentPattern.anak.length - 48) return; // nog niet in laatste maat
    const nextId = song[currentIdx + 1].id;
    if (lastPreScrolledRef.current === nextId) return;
    lastPreScrolledRef.current = nextId;
    document.getElementById(`block-${nextId}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [isPlaying, activeSlot?.patternId, activeSlot?.startIndex]);

  // Reset scroll trackers when playback stops
  useEffect(() => {
    if (!isPlaying) {
      lastScrolledPatternRef.current = null;
      lastPreScrolledRef.current = null;
    }
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
    const next = mutedTrackRef.current === track ? null : track;
    mutedTrackRef.current = next;
    setMutedTrack(next);
  };

  // Sync metronoomvolume live naar de scheduler
  useEffect(() => {
    if (schedulerRef.current) schedulerRef.current.clickVolume = metronomeVolume;
  }, [metronomeVolume]);

  // Sync clickWhilePlaying live bij wisselen van metronoommode tijdens playback
  useEffect(() => {
    const sched = schedulerRef.current;
    if (!sched || !isPlaying) return;
    const enabled = metronomeMode === 'on' || metronomeMode === '4+play' || metronomeMode === '8+play';
    sched.clickWhilePlaying = enabled;
    if (enabled) sched.playClickNow(); // directe klik bij inschakelen
  }, [metronomeMode, isPlaying]);

  // ── Tempo automation ──────────────────────────────────────────────────────

  // Precomputed slot→cumulative-ms table for variable-tempo cursor sync
  const slotTimesRef = useRef(null);

  /**
   * Build a function globalSlot → bpm using each pattern's tempoTrack.
   * Falls back to defaultBpm when a pattern has no nodes.
   */
  const buildTempoAt = (songArr, defaultBpm) => {
    // Pre-compute the carry-over BPM for each pattern: the last tempo point
    // of the most recent pattern that had an active tempoTrack. This way a
    // pattern without its own tempo nodes inherits the end-tempo of the
    // preceding pattern instead of snapping back to the global BPM.
    const carryOver = new Array(songArr.length).fill(defaultBpm);
    let running = defaultBpm;
    for (let p = 0; p < songArr.length; p++) {
      const pat = songArr[p];
      const track = pat.tempoTrack;
      if (track && track.length > 0 && pat.tempoTrackEnabled !== false) {
        const sorted = [...track].sort((a, b) => a.slot - b.slot);
        running = sorted[sorted.length - 1].bpm;
      }
      carryOver[p] = running;
    }

    return (globalSlot) => {
      let offset = 0;
      for (let p = 0; p < songArr.length; p++) {
        const pattern = songArr[p];
        const len = pattern.anak.length;
        if (globalSlot < offset + len) {
          const localSlot = globalSlot - offset;
          const track = pattern.tempoTrack;
          // Use the carry-over BPM from the previous pattern (or defaultBpm for the first)
          const fallback = p > 0 ? carryOver[p - 1] : defaultBpm;
          if (!track || track.length === 0 || pattern.tempoTrackEnabled === false) return fallback;
          const sorted = [...track].sort((a, b) => a.slot - b.slot);
          if (localSlot <= sorted[0].slot) return sorted[0].bpm;
          if (localSlot >= sorted[sorted.length - 1].slot) return sorted[sorted.length - 1].bpm;
          for (let i = 0; i < sorted.length - 1; i++) {
            if (localSlot >= sorted[i].slot && localSlot <= sorted[i + 1].slot) {
              const t = (localSlot - sorted[i].slot) / (sorted[i + 1].slot - sorted[i].slot);
              return sorted[i].bpm + t * (sorted[i + 1].bpm - sorted[i].bpm);
            }
          }
          return fallback;
        }
        offset += len;
      }
      return running; // past the last pattern — use the last known tempo
    };
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

  const handleToggleTempoTrack = (patternId) => {
    setSong(prev => prev.map(p => p.id === patternId ? { ...p, tempoTrackEnabled: p.tempoTrackEnabled === false } : p));
  };

  // Global tempo panel open/close — incremented to signal all TempoTracks
  const [globalTempoOpenSignal, setGlobalTempoOpenSignal] = useState(0); // odd = open all, even = close all
  const handleToggleAllTempoOpen = () => setGlobalTempoOpenSignal(s => s + 1);

  const handleToggleAllTempoEnabled = () => {
    setSong(prev => {
      const anyEnabled = prev.some(p => p.tempoTrackEnabled !== false);
      return prev.map(p => ({ ...p, tempoTrackEnabled: !anyEnabled }));
    });
  };

  const handleBpmChange = (delta) => {
    const newBpm = Math.max(20, Math.min(140, bpm + delta));
    setBpm(newBpm);
    if (schedulerRef.current) {
      schedulerRef.current.setBpm(newBpm);
      // If playing, rebuild the slot-times table so the tempo change takes
      // effect immediately (not just after the next play/seek).
      if (isPlaying && slotTimesRef.current) {
        const sched = schedulerRef.current;
        const tempoFn = buildTempoAt(songRef.current, newBpm);
        slotTimesRef.current = buildSlotTimesMs(sched.loopStart, sched.totalSlots, tempoFn);
        // Resync wall clock so the cursor doesn't jump
        const spsMs = sched.getSecondsPerSlot() * 1000;
        playStartWallTimeRef.current = Date.now() - (sched.currentSlot - sched.loopStart) * spsMs + cursorOffsetMsRef.current;
      }
    }
  };


  const togglePlay = async () => {
    // Ensure AudioContext is running — desktop Chrome requires resume() in user-gesture handler
    const ctx = schedulerRef.current?.audioCtx;
    if (ctx?.state === 'suspended') await ctx.resume();

    // Als vox-modus actief is, wacht tot samples geladen zijn
    if (sampleSetRef.current === 'vox') {
      await samplerRef.current?.waitForVox();
    }

    if (isPlaying && !isRecording) {
      schedulerRef.current.pause();
      setIsPlaying(false);
      setRealtimeBpm(null);
    } else if (isPlaying && isRecording) {
      schedulerRef.current.pause();
      setIsPlaying(false);
      setIsRecording(false);
    } else {
      // Bepaal loop-start en -einde: section-loop heeft prioriteit boven ruler-loop
      const lr = loopRangeRef.current;
      const activeSections = loopedSections.length > 0
        ? song.filter(p => loopedSections.includes(p.id))
        : null;
      const globalStart = activeSections
        ? localToGlobal(activeSections[0].id, 0, song)
        : lr
          ? localToGlobal(lr.patternId, lr.startSlot, song)
          : activeSlot
            ? localToGlobal(activeSlot.patternId, activeSlot.startIndex - (activeSlot.startIndex % 48), song)
            : 0;
      const loopEnd = activeSections
        ? localToGlobal(activeSections[activeSections.length - 1].id, 0, song) + activeSections[activeSections.length - 1].anak.length
        : lr
          ? localToGlobal(lr.patternId, lr.endSlot, song)
          : song.reduce((sum, p) => sum + p.anak.length, 0);
      // Zorg dat de scheduler ook de juiste loopStart+totalSlots heeft
      const hasExplicitLoop = !!(activeSections || lr);
      if (hasExplicitLoop) schedulerRef.current.setLoopBounds(globalStart, loopEnd);
      schedulerRef.current.stopAtEnd = !hasExplicitLoop;
      schedulerRef.current.onStopAtEnd = () => {
        setIsPlaying(false);
        setRealtimeBpm(null);
      };
      slotTimesRef.current = buildSlotTimesMs(globalStart, loopEnd, buildTempoAt(song, bpm));

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
        // Wall-clock starttijd voor cursor — gebruik exact geplande audiotijd (zoals precount-pad)
        const ctx = schedulerRef.current.audioCtx;
        const outputLatencyMs = ctx ? ((ctx.outputLatency || 0) + (ctx.baseLatency || 0)) * 1000 : 0;
        const msUntilFirstNote = Math.max(0, (schedulerRef.current.playStartAudioTime - ctx.currentTime) * 1000);
        playStartWallTimeRef.current = Date.now() + msUntilFirstNote + outputLatencyMs;
        setIsPlaying(true);
      }
      const { patternId, localSlot } = globalToLocal(globalStart, song);
      setActiveSlot(prev => prev ? { ...prev, patternId, startIndex: localSlot, endIndex: localSlot } : prev);
    }
  };


  const handleClearRulerLoop = () => {
    loopRangeRef.current = null;
    setLoopRange(null);
    loopingPatternIdRef.current = null;
    setLoopedSections([]);
    if (schedulerRef.current) {
      const total = song.reduce((sum, p) => sum + p.anak.length, 0);
      schedulerRef.current.setLoopBounds(0, total);
      schedulerRef.current.stopAtEnd = true;
      // Resync the visual cursor to the new loop bounds so it doesn't drift.
      if (isPlaying) {
        const sched = schedulerRef.current;
        const spsMs = sched.getSecondsPerSlot() * 1000;
        playStartWallTimeRef.current = Date.now() - (sched.currentSlot - 0) * spsMs + cursorOffsetMsRef.current;
        slotTimesRef.current = null; // force constant-BPM fallback
      }
    }
  };

  const handleToggleSectionLoop = (patternId) => {
    setLoopedSections(prev => {
      const next = prev.includes(patternId)
        ? prev.filter(id => id !== patternId)
        : [...prev, patternId];

      if (next.length === 0) {
        // Alle sections gedeactiveerd → volledige song
        loopRangeRef.current = null;
        setLoopRange(null);
        loopingPatternIdRef.current = null;
          if (schedulerRef.current) {
          const total = songRef.current.reduce((sum, p) => sum + p.anak.length, 0);
          schedulerRef.current.stopAtEnd = true;
          if (isPlaying) {
            // Maak huidige loop af tot het einde van de regel, dan door met de rest van de song
            const currentLoopEnd = schedulerRef.current.totalSlots;
            schedulerRef.current.setPendingLoopAfterCurrentLoop(currentLoopEnd, total);
            schedulerRef.current.onLoopSwitch = (start, end) => {
              slotTimesRef.current = buildSlotTimesMs(start, end, buildTempoAt(songRef.current, bpmRef.current));
              // Resync wall clock so the visual cursor aligns with the new loop origin
              const sched = schedulerRef.current;
              if (sched) {
                const spsMs = sched.getSecondsPerSlot() * 1000;
                playStartWallTimeRef.current = Date.now() - (sched.currentSlot - start) * spsMs + cursorOffsetMsRef.current;
              }
            };
          } else {
            schedulerRef.current.setLoopBounds(0, total);
          }
        }
      } else {
        // Bepaal globale range: van begin eerste geloopte section t/m einde laatste
        const ordered = songRef.current.filter(p => next.includes(p.id));
        const firstId = ordered[0].id;
        const lastPattern = ordered[ordered.length - 1];
        const globalStart = localToGlobal(firstId, 0, songRef.current);
        const globalEnd = localToGlobal(lastPattern.id, 0, songRef.current) + lastPattern.anak.length;
        // Wis ruler-loopRange zodat section-loop voorrang heeft
        loopRangeRef.current = null;
        setLoopRange(null);
        loopingPatternIdRef.current = null;
          if (schedulerRef.current) {
          schedulerRef.current.stopAtEnd = false;
          if (isPlaying) {
            schedulerRef.current.setPendingLoopAfterCurrentMeasure(globalStart, globalEnd);
            schedulerRef.current.onLoopSwitch = (start, end) => {
              slotTimesRef.current = buildSlotTimesMs(start, end, buildTempoAt(songRef.current, bpmRef.current));
              const sched = schedulerRef.current;
              if (sched) {
                const spsMs = sched.getSecondsPerSlot() * 1000;
                playStartWallTimeRef.current = Date.now() - (sched.currentSlot - start) * spsMs + cursorOffsetMsRef.current;
              }
            };
          } else {
            schedulerRef.current.setLoopBounds(globalStart, globalEnd);
            schedulerRef.current.setCurrentSlot(globalStart);
            slotTimesRef.current = buildSlotTimesMs(globalStart, globalEnd, buildTempoAt(songRef.current, bpm));
          }
        }
      }
      return next;
    });
  };

  const handleRulerLoop = (patternId, startSlot, endSlot) => {
    if (!schedulerRef.current) return;
    const globalStart = localToGlobal(patternId, 0, song);
    const pattern = song.find(p => p.id === patternId);
    if (!pattern) return;
    const clampedEnd = Math.min(pattern.anak.length, endSlot);
    const loopStartGlobal = globalStart + startSlot;
    const loopEndGlobal = globalStart + clampedEnd;
    const newLoopRange = { patternId, startSlot, endSlot: clampedEnd };
    // UI direct updaten zodat de loopbar al zichtbaar is
    loopRangeRef.current = newLoopRange;
    setLoopRange(newLoopRange);
    loopingPatternIdRef.current = patternId;
    if (schedulerRef.current) schedulerRef.current.stopAtEnd = false;
    if (isPlaying) {
      // Zet pending loop — scheduler wisselt na einde huidige maat (max 1 maat wachten)
      schedulerRef.current.setPendingLoopAfterCurrentMeasure(loopStartGlobal, loopEndGlobal);
      // Wanneer de scheduler de wissel uitvoert, herbouw slotTimesRef
      schedulerRef.current.onLoopSwitch = (start, end) => {
        slotTimesRef.current = buildSlotTimesMs(start, end, buildTempoAt(songRef.current, bpmRef.current));
        const sched = schedulerRef.current;
        if (sched) {
          const spsMs = sched.getSecondsPerSlot() * 1000;
          playStartWallTimeRef.current = Date.now() - (sched.currentSlot - start) * spsMs + cursorOffsetMsRef.current;
        }
      };
    } else {
      schedulerRef.current.setLoopBounds(loopStartGlobal, loopEndGlobal);
      schedulerRef.current.setCurrentSlot(loopStartGlobal);
      slotTimesRef.current = buildSlotTimesMs(loopStartGlobal, loopEndGlobal, buildTempoAt(song, bpm));
    }
  };

  const rewind = () => {
    if (!schedulerRef.current) return;
    const now = Date.now();
    const isDoubleClick = now - lastRewindTimeRef.current < 500;
    lastRewindTimeRef.current = now;

    const globalCurrent = schedulerRef.current.currentSlot;
    let targetGlobal;
    if (isDoubleClick) {
      // 2× klikken → begin van de huidige loop (of slot 0 als geen loop actief)
      targetGlobal = schedulerRef.current.loopStart;
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
    if (!isPlaying || !schedulerRef.current) return;
    const globalSlot = localToGlobal(patternId, localSlot, song);
    const sched = schedulerRef.current;
    const ctx = sched.audioCtx;
    if (!ctx) return;

    // Bepaal loopEnd (zelfde logica als togglePlay)
    const lr = loopRangeRef.current;
    const activeSecs = loopedSections.length > 0 ? song.filter(p => loopedSections.includes(p.id)) : null;
    const loopEnd = activeSecs
      ? localToGlobal(activeSecs[activeSecs.length - 1].id, 0, song) + activeSecs[activeSecs.length - 1].anak.length
      : lr
        ? localToGlobal(lr.patternId, lr.endSlot, song)
        : song.reduce((sum, p) => sum + p.anak.length, 0);

    // Reset loopStart naar de nieuwe positie zodat cursor elapsed=0 correct mapt
    sched.loopStart = globalSlot;
    sched.totalSlots = loopEnd;
    slotTimesRef.current = buildSlotTimesMs(globalSlot, loopEnd, buildTempoAt(song, bpm));

    const delay = 0.02;
    const nextNoteTime = ctx.currentTime + delay;
    sched.playStartAudioTime = nextNoteTime; // elapsed=0 = globalSlot
    clearTimeout(sched.timerID);
    sched.currentSlot = globalSlot;
    sched.nextNoteTime = nextNoteTime;
    sched.scheduler();
    // slotTimesRef was just rebuilt with globalSlot as loopStart, so elapsed=0
    // maps to globalSlot. Sync the wall clock to match.
    const outputLatencyMs = ctx ? ((Math.abs(ctx.outputLatency || 0) + Math.abs(ctx.baseLatency || 0)) * 1000) : 0;
    playStartWallTimeRef.current = Date.now() + outputLatencyMs + cursorOffsetMsRef.current;
    setActiveSlot(prev => prev ? { ...prev, patternId, startIndex: localSlot, endIndex: localSlot } : prev);
  };

  const stepBack = () => {
    if (!schedulerRef.current) return;
    let globalCurrent;
    if (isPlaying) {
      globalCurrent = schedulerRef.current.currentSlot;
    } else if (activeSlot) {
      globalCurrent = localToGlobal(activeSlot.patternId, activeSlot.startIndex, song);
    } else {
      globalCurrent = schedulerRef.current.currentSlot;
    }
    const measureStart = Math.floor(globalCurrent / 48) * 48;
    const targetGlobal = Math.max(0, globalCurrent === measureStart ? measureStart - 48 : measureStart);

    if (isPlaying) {
      schedulerRef.current.seekTo(targetGlobal);
      // Update wall-clock reference so the cursor interval snaps to the new position
      if (slotTimesRef.current) {
        const { loopStart, times } = slotTimesRef.current;
        const i = targetGlobal - loopStart;
        const offsetMs = (i >= 0 && i < times.length) ? times[i] : 0;
        playStartWallTimeRef.current = Date.now() - offsetMs + cursorOffsetMsRef.current;
      } else {
        const spsMs = schedulerRef.current.getSecondsPerSlot() * 1000;
        const loopStart = schedulerRef.current.loopStart;
        playStartWallTimeRef.current = Date.now() - (targetGlobal - loopStart) * spsMs + cursorOffsetMsRef.current;
      }
    } else {
      schedulerRef.current.setCurrentSlot(targetGlobal);
    }
    const { patternId, localSlot } = globalToLocal(targetGlobal, song);
    setActiveSlot(prev => prev ? { ...prev, patternId, startIndex: localSlot, endIndex: localSlot } : prev);
    setActivePatternId(patternId);
    setStepBackCount(c => c + 1);
  };

  const handleGongFromInstrument = () => {
    if (isLocked) return;
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
    if (isLocked) return;
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

         // Auto-fill: place rest only at the single preceding grid position.
         // Starting from beatStart caused multiple consecutive dots — now we only
         // fill the one slot immediately before the new note.
         if (symbol !== SYMBOL_REST) {
           const hand = getHandForSymbol(symbol);
           const step = gridResolution;
           const prevPos = Math.floor((targetSlotIndex - 1) / step) * step;
           if (prevPos >= 0 && prevPos < targetSlotIndex) {
             const slot = modifiedPattern[targetTrack][prevPos];
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
  const handleSaveSnippet = async (name, folder, data, replaceId = null) => {
    const payload = {
      // Old localStorage entries use Date.now() string ids; only forward valid uuids.
      id: typeof replaceId === 'string' && /^[0-9a-f-]{36}$/i.test(replaceId) ? replaceId : null,
      name,
      folder: folder || 'Algemeen',
      data: JSON.parse(JSON.stringify(data)),
    };
    if (user) {
      try {
        await cloudSnippetSave(payload);
        return;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Cloud snippet save failed:', err);
        alert('Patroon opslaan in cloud mislukt — opgeslagen alleen lokaal.');
      }
    }
    const newSnippet = {
      id: replaceId || Date.now().toString(),
      name, folder: payload.folder, data: payload.data,
    };
    if (replaceId) {
      setLocalSavedSnippets(prev => prev.map(s => s.id === replaceId ? newSnippet : s));
    } else {
      setLocalSavedSnippets(prev => [...prev, newSnippet]);
    }
  };

  const handleDeleteSnippet = async (snippetId) => {
    const target = savedSnippets.find(s => s.id === snippetId);
    const name = target?.name || 'dit patroon';
    if (!window.confirm(`Weet je zeker dat je "${name}" wilt verwijderen?\n\nDeze actie kan niet ongedaan worden gemaakt.`)) return;
    if (user) {
      try {
        await cloudSnippetRemove(snippetId);
        showToast(`Patroon "${name}" verwijderd`);
        return;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Cloud snippet delete failed:', err);
        alert('Patroon verwijderen in cloud mislukt.');
        return;
      }
    }
    setLocalSavedSnippets(prev => prev.filter(s => s.id !== snippetId));
    showToast(`Patroon "${name}" verwijderd`);
  };

  // Silent delete (no confirm) — used by bulk-delete which prompts once up front.
  const handleDeleteSnippetSilently = async (snippetId) => {
    if (user) {
      try { await cloudSnippetRemove(snippetId); }
      catch (err) { console.error('Snippet bulk delete failed:', err); }
    } else {
      setLocalSavedSnippets(prev => prev.filter(s => s.id !== snippetId));
    }
  };

  const handleRenameSnippet = async (snippet, newName) => {
    const trimmed = (newName || '').trim();
    if (!trimmed || trimmed === snippet.name) return;
    if (user) {
      try {
        await cloudSnippetSave({ id: snippet.id, name: trimmed, folder: snippet.folder || 'Algemeen', data: snippet.data });
        showToast(`Hernoemd naar "${trimmed}"`);
      } catch (err) { console.error('Snippet rename failed:', err); alert('Hernoemen mislukt.'); }
    } else {
      setLocalSavedSnippets(prev => prev.map(s => s.id === snippet.id ? { ...s, name: trimmed } : s));
      showToast(`Hernoemd naar "${trimmed}"`);
    }
  };

  const handleMoveSnippetToFolder = async (snippet, targetFolder) => {
    const folder = (targetFolder || '').trim() || 'Algemeen';
    if ((snippet.folder || 'Algemeen') === folder) return;
    if (user) {
      try {
        await cloudSnippetSave({ id: snippet.id, name: snippet.name, folder, data: snippet.data });
        showToast(`Verplaatst naar "${folder}"`);
      } catch (err) { console.error('Snippet move failed:', err); alert('Verplaatsen mislukt.'); }
    } else {
      setLocalSavedSnippets(prev => prev.map(s => s.id === snippet.id ? { ...s, folder } : s));
      showToast(`Verplaatst naar "${folder}"`);
    }
  };

  const handleRenameSnippetFolder = async (oldName, newName) => {
    const trimmed = (newName || '').trim();
    if (!trimmed || trimmed === oldName) return;
    const inFolder = savedSnippets.filter(s => (s.folder || 'Algemeen') === oldName);
    if (user) {
      for (const s of inFolder) {
        try { await cloudSnippetSave({ id: s.id, name: s.name, folder: trimmed, data: s.data }); }
        catch (err) { console.error('Snippet folder rename failed for', s.name, err); }
      }
    } else {
      setLocalSavedSnippets(prev => prev.map(s => (s.folder || 'Algemeen') === oldName ? { ...s, folder: trimmed } : s));
    }
    showToast(`Map "${oldName}" → "${trimmed}"`);
  };

  const handleDeleteSnippetFolder = async (folderName) => {
    const inFolder = savedSnippets.filter(s => (s.folder || 'Algemeen') === folderName);
    if (inFolder.length === 0) return;
    const msg = `Weet je zeker dat je de map "${folderName}" wilt verwijderen?\n\nDit verwijdert ${inFolder.length} patroon${inFolder.length === 1 ? '' : 'en'} permanent.\n\nDeze actie kan niet ongedaan worden gemaakt.`;
    if (!window.confirm(msg)) return;
    if (user) {
      for (const s of inFolder) {
        try { await cloudSnippetRemove(s.id); }
        catch (err) { console.error('Snippet folder delete failed for', s.name, err); }
      }
    } else {
      setLocalSavedSnippets(prev => prev.filter(s => (s.folder || 'Algemeen') !== folderName));
    }
    showToast(`Map "${folderName}" verwijderd`);
  };

  const handleExportSnippets = () => {
    const encoded = encodeData(savedSnippets);
    const blob = new Blob([encoded], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kendang-snippets-${new Date().toISOString().slice(0, 10)}.kendang`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSnippets = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const imported = decodeData(ev.target.result);
        if (!Array.isArray(imported)) throw new Error();
        const existingNames = new Set(savedSnippets.map(s => `${s.folder || 'Algemeen'}::${s.name}`));
        const nieuwen = imported.filter(s => s.name && !existingNames.has(`${s.folder || 'Algemeen'}::${s.name}`));
        if (user) {
          for (const s of nieuwen) {
            try { await cloudSnippetSave({ id: null, name: s.name, folder: s.folder, data: s.data }); }
            catch (err) { console.error('Snippet import failed for', s.name, err); }
          }
        } else {
          setLocalSavedSnippets(prev => [...prev, ...nieuwen.map(s => ({ ...s, id: s.id || Date.now().toString() + Math.random() }))]);
        }
      } catch {
        alert(t('invalidLibrary'));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
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
     // WRITE SNIPPET ACROSS FIXED 4-BAR PATTERNS (192 slots each), overflow to next pattern
     const BARS = 192;
     let snippetOffset = 0;
     let patIdx = targetPatternIdx;
     let patSlot = targetSlotIdx;
     let lastWrittenPatIdx = targetPatternIdx;
     let lastWrittenSlot = targetSlotIdx;

     while (snippetOffset < snippetLength) {
       if (patIdx >= newSong.length) {
         newSong.push(createEmptyPattern(`Regel ${newSong.length + 1}`));
       } else {
         // Create new array references so React's useMemo sees the change
         newSong[patIdx] = { ...newSong[patIdx], anak: [...newSong[patIdx].anak], indung: [...newSong[patIdx].indung] };
       }
       const pat = newSong[patIdx];
       const slotsToWrite = Math.min(snippetLength - snippetOffset, BARS - patSlot);

       for (let i = 0; i < slotsToWrite; i++) {
         const src = snippetOffset + i;
         const dst = patSlot + i;
         pat.anak[dst] = JSON.parse(JSON.stringify(anakData[src]));
         if (indungData && src < indungData.length)
           pat.indung[dst] = JSON.parse(JSON.stringify(indungData[src]));
       }

       if (gongData && gongData.length > 0) {
         const gongSet = new Set(pat.gong || []);
         for (const g of gongData) {
           if (g >= snippetOffset && g < snippetOffset + slotsToWrite)
             gongSet.add(patSlot + (g - snippetOffset));
         }
         pat.gong = Array.from(gongSet).sort((a, b) => a - b);
       }

       lastWrittenPatIdx = patIdx;
       lastWrittenSlot = patSlot + slotsToWrite;
       snippetOffset += slotsToWrite;
       patIdx++;
       patSlot = 0;
     }

     setUndoStack(prev => [...prev.slice(-49), song]);
     setRedoStack([]);
     setSong(newSong);

     if (activeSlot) {
        let nextCursor = lastWrittenSlot >= BARS ? 0 : lastWrittenSlot;
        if (magneticInput) nextCursor = Math.round(nextCursor / gridResolution) * gridResolution;
        setActiveSlot(prev => ({
          ...prev,
          patternId: newSong[lastWrittenPatIdx].id,
          startIndex: nextCursor,
          endIndex: nextCursor,
        }));
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="branding">
            <h1>Kendang Pasunanda</h1>
            <p>{t('appSubtitle')}</p>
          </div>

          {/* ── Song dropdown — naast de app naam ─────────────────────────── */}
          <div style={{ position: 'relative' }}>
            <button
              id="song-save-btn"
              onClick={() => setShowSongMenu(v => !v)}
              style={{ background: showSongMenu ? '#334155' : '#1e293b', color: '#e2e8f0', padding: '0.6rem 1rem', borderRadius: '6px', fontWeight: 'bold', border: '1px solid var(--border-focus)', cursor: 'pointer', whiteSpace: 'nowrap' }}
              title={isModifiedSinceSave ? `${t('manageSong')} — niet opgeslagen wijzigingen` : t('manageSong')}
            >🎵 {songName || 'Song'}{isModifiedSinceSave && <span style={{ color: '#fbbf24', marginLeft: 4 }}>•</span>}</button>

            {showSongMenu && (
              <>
                <div onClick={() => setShowSongMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 190 }} />
                <div style={{
                  position: 'fixed', top: '3.5rem', left: '0.5rem', zIndex: 200,
                  background: '#1e293b', border: '1px solid #334155', borderRadius: '10px',
                  padding: '0.75rem', minWidth: '240px', maxWidth: 'calc(100vw - 1rem)',
                  maxHeight: 'calc(100dvh - 4.5rem)', overflowY: 'auto',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  display: 'flex', flexDirection: 'column', gap: '0.5rem',
                }}>
                  <input type="text" value={songName} onChange={(e) => setSongName(e.target.value)}
                    onFocus={(e) => e.target.scrollIntoView({ block: 'nearest', behavior: 'instant' })}
                    style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '6px', padding: '0.5rem 0.7rem', fontSize: '16px' }}
                    placeholder={t('songNamePlaceholder')} />
                  {(() => {
                    const existingFolders = Array.from(new Set(savedSongs.map(s => s.folder || 'Algemeen'))).sort();
                    const isCustom = newSongFolderMode || (songFolder && !existingFolders.includes(songFolder));
                    return isCustom ? (
                      <input type="text" autoFocus value={songFolder}
                        onChange={(e) => setSongFolder(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Escape') { setSongFolder('Algemeen'); setNewSongFolderMode(false); } }}
                        onFocus={(e) => e.target.scrollIntoView({ block: 'nearest', behavior: 'instant' })}
                        onBlur={() => { if (!songFolder) setSongFolder('Algemeen'); setNewSongFolderMode(false); }}
                        style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '6px', padding: '0.5rem 0.7rem', fontSize: '16px' }}
                        placeholder={t('folderPlaceholder')} />
                    ) : (
                      <select
                        value={songFolder || 'Algemeen'}
                        onChange={(e) => {
                          if (e.target.value === '__NEW__') { setSongFolder(''); setNewSongFolderMode(true); }
                          else setSongFolder(e.target.value);
                        }}
                        style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '6px', padding: '0.5rem 0.7rem', fontSize: '16px', cursor: 'pointer' }}
                      >
                        {existingFolders.map(f => <option key={f} value={f}>{f}</option>)}
                        <option value="__NEW__">+ Nieuwe map...</option>
                      </select>
                    );
                  })()}

                  {/* Three explicit save actions */}
                  <button
                    onClick={() => { handleUpdateSong(); setShowSongMenu(false); }}
                    disabled={!currentSongId}
                    style={{
                      background: currentSongId ? '#3b82f6' : '#1e293b',
                      color: currentSongId ? '#fff' : '#475569',
                      padding: '0.55rem', borderRadius: '6px', fontWeight: 'bold',
                      border: '1px solid', borderColor: currentSongId ? '#3b82f6' : '#334155',
                      cursor: currentSongId ? 'pointer' : 'default', fontSize: '0.85rem',
                    }}
                    title={currentSongId ? 'Overschrijf de geladen song' : 'Geen song geladen'}
                  >💾 Update</button>

                  <button
                    onClick={() => { handleSaveAsNew(); setShowSongMenu(false); }}
                    style={{ background: '#10b981', color: '#fff', padding: '0.55rem', borderRadius: '6px', fontWeight: 'bold', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}
                    title="Maak een nieuwe song met de huidige naam + folder"
                  >➕ Save as new</button>

                  <button
                    onClick={() => { handleSaveAsCopy(); setShowSongMenu(false); }}
                    disabled={!currentSongId}
                    style={{
                      background: currentSongId ? '#0f172a' : '#1e293b',
                      color: currentSongId ? '#e2e8f0' : '#475569',
                      padding: '0.55rem', borderRadius: '6px',
                      border: '1px solid #334155',
                      cursor: currentSongId ? 'pointer' : 'default', fontSize: '0.85rem',
                    }}
                    title={currentSongId ? 'Kopieer naar nieuwe entry met "(kopie)" achter de naam' : 'Geen song geladen'}
                  >📋 Save copy</button>

                  <div style={{ height: '1px', background: '#334155', margin: '0.2rem 0' }} />

                  <button onClick={() => { handleNewSong(); setShowSongMenu(false); }}
                    style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '6px', padding: '0.5rem 0.8rem', textAlign: 'left', cursor: 'pointer', fontSize: '0.85rem' }}
                    title="Begin met een lege song"
                  >✨ {t('newBtn')}</button>

                  <button onClick={() => { setShowSongLibrary(true); setShowSongMenu(false); }}
                    style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '6px', padding: '0.5rem 0.8rem', textAlign: 'left', cursor: 'pointer', fontSize: '0.85rem' }}
                    title="Open de bibliotheek om een song te laden of te verwijderen"
                  >📚 {t('libraryBtn')}</button>

                  {isAdmin && <>
                    <div style={{ height: '1px', background: '#334155', margin: '0.2rem 0' }} />
                    <button
                      onClick={async () => {
                        try {
                          await publishTemplate({
                            name: songName || 'Naamloos',
                            folder: songFolder || 'Algemeen',
                            bpm,
                            patterns: song.map(p => ({
                              name: p.name,
                              anak: p.anak,
                              indung: p.indung,
                              gong: p.gong || [],
                              tempoTrackEnabled: p.tempoTrackEnabled || false,
                              tempoTrack: p.tempoTrack || [],
                            })),
                          });
                          showToast('Template gepubliceerd ✓');
                        } catch (err) { alert(err?.message ?? 'Publiceren mislukt'); }
                        setShowSongMenu(false);
                      }}
                      style={{ background: '#0f172a', color: '#d4af37', border: '1px solid #334155', borderRadius: '6px', padding: '0.5rem 0.8rem', textAlign: 'left', cursor: 'pointer', fontSize: '0.85rem' }}
                      title="Publiceer deze song als template voor alle gebruikers"
                    >📦 Publiceer als template</button>
                  </>}
                </div>
              </>
            )}
          </div>

          {/* ── Songbuilder (☰) — direct rechts naast song save knop ──── */}
          <button
            id="songbuilder-btn"
            onClick={handleOpenSongMap}
            style={{ background: 'transparent', border: '1px solid #334155', borderRadius: '6px', color: '#64748b', cursor: 'pointer', padding: '0.6rem 0.75rem', fontSize: '1rem', lineHeight: 1, flexShrink: 0 }}
            title="Compositie-overzicht"
          >☰</button>
        </div>

        {/* ── Gecentreerd: volume knobs + schakelaar ───────────────────── */}
        <div className="header-center" style={{ opacity: isLocked ? 0.4 : 1, transition: 'opacity 0.3s' }}>
          {/* Track volume knobs A + I */}
          {['anak', 'indung'].map(track => {
            const color = track === 'anak' ? '#222' : '#cc0000';
            const val = trackVolumes[track];
            const angle = -135 + (val / 2) * 270;
            const r = 14, cx = 18, cy = 18;
            const rad = (a) => (a - 90) * Math.PI / 180;
            const arcX = (a) => cx + r * Math.cos(rad(a));
            const arcY = (a) => cy + r * Math.sin(rad(a));
            const startAngle = -135, endAngle = angle;
            const largeArc = endAngle - startAngle > 180 ? 1 : 0;
            return (
              <div key={track} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                <svg width="36" height="36" viewBox="0 0 36 36"
                  style={{ cursor: 'ns-resize', touchAction: 'none' }}
                  title={`${track === 'anak' ? 'Anak' : 'Indung'} volume: ${Math.round(val * 100)}%`}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    const startY = e.clientY, startVal = val;
                    const onMove = (ev) => { const delta = (startY - ev.clientY) / 80; setTrackVolumes(v => ({ ...v, [track]: Math.max(0, Math.min(2, startVal + delta)) })); };
                    const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
                    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
                  }}
                  onDoubleClick={() => setTrackVolumes(v => ({ ...v, [track]: 1.0 }))}
                >
                  <path d={`M${arcX(-135)},${arcY(-135)} A${r},${r} 0 1 1 ${arcX(135)},${arcY(135)}`} fill="none" stroke="#334155" strokeWidth="3" strokeLinecap="round" />
                  <path d={`M${arcX(startAngle)},${arcY(startAngle)} A${r},${r} 0 ${largeArc} 1 ${arcX(endAngle)},${arcY(endAngle)}`} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
                  <circle cx={cx} cy={cy} r="9" fill={color} opacity="0.85" />
                  <line x1={cx} y1={cy} x2={cx + 7 * Math.cos(rad(angle))} y2={cy + 7 * Math.sin(rad(angle))} stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span style={{ fontSize: '0.55rem', color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{track === 'anak' ? 'A' : 'I'}</span>
              </div>
            );
          })}

          {/* Vox volume knob V — alleen in vox-modus */}
          {sampleSet === 'vox' && (() => {
            const val = voxVolume, color = '#7c3aed';
            const angle = -135 + (val / 2) * 270;
            const r = 14, cx = 18, cy = 18;
            const rad = (a) => (a - 90) * Math.PI / 180;
            const arcX = (a) => cx + r * Math.cos(rad(a));
            const arcY = (a) => cy + r * Math.sin(rad(a));
            const startAngle = -135, endAngle = angle;
            const largeArc = endAngle - startAngle > 180 ? 1 : 0;
            return (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                <svg width="36" height="36" viewBox="0 0 36 36"
                  style={{ cursor: 'ns-resize', touchAction: 'none' }}
                  title={`Vox volume: ${Math.round(val * 100)}%`}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    const startY = e.clientY, startVal = val;
                    const onMove = (ev) => { const delta = (startY - ev.clientY) / 80; setVoxVolume(Math.max(0, Math.min(2, startVal + delta))); };
                    const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
                    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
                  }}
                  onDoubleClick={() => setVoxVolume(1.0)}
                >
                  <path d={`M${arcX(-135)},${arcY(-135)} A${r},${r} 0 1 1 ${arcX(135)},${arcY(135)}`} fill="none" stroke="#334155" strokeWidth="3" strokeLinecap="round" />
                  <path d={`M${arcX(startAngle)},${arcY(startAngle)} A${r},${r} 0 ${largeArc} 1 ${arcX(endAngle)},${arcY(endAngle)}`} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
                  <circle cx={cx} cy={cy} r="9" fill={color} opacity="0.85" />
                  <line x1={cx} y1={cy} x2={cx + 7 * Math.cos(rad(angle))} y2={cy + 7 * Math.sin(rad(angle))} stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span style={{ fontSize: '0.55rem', color: '#7c3aed', letterSpacing: '0.05em', textTransform: 'uppercase' }}>V</span>
              </div>
            );
          })()}

          {/* Kendang / Vox ronde schakelaar */}
          <div
            onClick={() => setSampleSet(s => s === 'kendang' ? 'vox' : 'kendang')}
            title={t('switchTooltip')(sampleSet === 'kendang' ? 'Kendang' : 'Vox')}
            style={{
              width: '68px', height: '68px', borderRadius: '50%', flexShrink: 0,
              background: 'radial-gradient(circle at 38% 32%, #4a4e58, #1c2030)',
              border: '4px solid #6b7280',
              boxShadow: '0 4px 16px rgba(0,0,0,0.7), inset 0 1px 4px rgba(255,255,255,0.12), inset 0 -2px 4px rgba(0,0,0,0.4)',
              cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', overflow: 'hidden',
            }}
          >
            <div style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', opacity: sampleSet === 'kendang' ? 1 : 0.25, transition: 'opacity 0.3s', filter: sampleSet === 'kendang' ? 'drop-shadow(0 0 4px rgba(255,255,255,0.5))' : 'none' }}>🥁</div>
            <div style={{ width: '4px', height: '68%', background: '#2a2e3a', borderRadius: '2px', flexShrink: 0, position: 'relative', boxShadow: '1px 0 2px rgba(255,255,255,0.05), -1px 0 2px rgba(0,0,0,0.3)' }}>
              <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: '6px', height: '18px', borderRadius: '2px', background: sampleSet === 'kendang' ? '#60a5fa' : '#a78bfa', boxShadow: sampleSet === 'kendang' ? '0 0 6px 2px rgba(96,165,250,0.7)' : '0 0 6px 2px rgba(167,139,250,0.7)', transition: 'background 0.3s, box-shadow 0.3s' }} />
            </div>
            <div style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', opacity: sampleSet === 'vox' ? 1 : 0.25, transition: 'opacity 0.3s', filter: sampleSet === 'vox' ? 'drop-shadow(0 0 4px rgba(167,139,250,0.8))' : 'none' }}>🎤</div>
          </div>
        </div>

        <div className="global-controls" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>

          {/* ── Practice Mode lock ─────────────────────────────────────── */}
          <button
            className={`practice-mode-btn${isPulsing ? ' pulsing' : ''}`}
            onClick={() => {
              setIsLocked(l => {
                const next = !l;
                if (next) {
                  // Show a one-time hint when first entering practice mode.
                  if (localStorage.getItem('kendangPracticeTipSeen') !== 'yes') {
                    showToast('Practice mode aan — invoer is uitgeschakeld');
                    localStorage.setItem('kendangPracticeTipSeen', 'yes');
                  }
                }
                return next;
              });
              setIsPulsing(true);
            }}
            onAnimationEnd={() => setIsPulsing(false)}
            style={{
              background: isLocked ? 'rgba(212,175,55,0.15)' : 'transparent',
              color: isLocked ? '#d4af37' : '#888888',
              border: `1px solid ${isLocked ? '#d4af37' : '#475569'}`,
              borderRadius: '6px', padding: '0.55rem 0.7rem', cursor: 'pointer',
              boxShadow: isLocked ? '0 0 8px rgba(212,175,55,0.4)' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 0,
            }}
            title={isLocked ? 'Practice Mode aan — klik om te bewerken' : 'Enter Practice Mode'}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg"
              style={{ filter: isLocked ? 'drop-shadow(0 0 5px rgba(255,215,0,0.6))' : 'none', transition: 'filter 0.25s' }}>
              <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth={isLocked ? 2.5 : 1.5} />
              <circle cx="9" cy="9" r="2.5" fill="currentColor" />
            </svg>
          </button>

          {/* ── Tempo toggle — only visible in practice mode ──────────── */}
          {isLocked && (
            <button
              onClick={handleToggleAllTempoEnabled}
              style={{
                background: song.some(p => p.tempoTrackEnabled !== false) ? 'rgba(212,175,55,0.15)' : 'transparent',
                color: song.some(p => p.tempoTrackEnabled !== false) ? '#d4af37' : '#888888',
                border: `1px solid ${song.some(p => p.tempoTrackEnabled !== false) ? '#d4af37' : '#475569'}`,
                borderRadius: '6px', padding: '0.4rem 0.6rem', cursor: 'pointer',
                fontSize: '0.65rem', fontWeight: 'bold', letterSpacing: '0.03em',
                boxShadow: song.some(p => p.tempoTrackEnabled !== false) ? '0 0 6px rgba(212,175,55,0.3)' : 'none',
              }}
              title={song.some(p => p.tempoTrackEnabled !== false) ? 'Tempo-automatisering uit — oefen op globaal BPM' : 'Tempo-automatisering aan'}
            >{song.some(p => p.tempoTrackEnabled !== false) ? '♩ TEMPO' : '♩ GLOBAL'}</button>
          )}

          {/* ── Tools dropdown: Scan / PDF / Handleiding ─────────────────── */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowToolsMenu(v => !v)}
              style={{ background: showToolsMenu ? '#334155' : 'transparent', color: '#e2e8f0', padding: '0.6rem 0.9rem', borderRadius: '6px', border: '1px solid var(--border-focus)', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}
              title={t('toolsMenu')}
            >⋯</button>

            {showToolsMenu && (
              <>
                {/* overlay to close on outside click */}
                <div onClick={() => setShowToolsMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 190 }} />
                <div style={{
                  position: 'fixed', top: 'auto', right: '0.5rem', zIndex: 200,
                  background: '#1e293b', border: '1px solid #334155', borderRadius: '10px',
                  padding: '0.75rem', minWidth: '220px', maxWidth: '92vw',
                  maxHeight: 'calc(100vh - 80px)', overflowY: 'auto',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  display: 'flex', flexDirection: 'column', gap: '0.4rem',
                }}>
                  <div style={{ height: '1px', background: '#334155', margin: '0.3rem 0' }} />

                  {/* PDF */}
                  <div style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.2rem' }}>{t('pdfSection')}</div>
                  <button
                    onClick={() => { exportSequencerToPDF(song, songName, pdfSettings); setShowToolsMenu(false); }}
                    style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '6px', padding: '0.5rem 0.8rem', textAlign: 'left', cursor: 'pointer', fontSize: '0.85rem' }}
                  >{t('exportPdf')}</button>
                  <button
                    onClick={() => setShowPdfSettings(v => !v)}
                    style={{ background: '#0f172a', color: '#94a3b8', border: '1px solid #334155', borderRadius: '6px', padding: '0.5rem 0.8rem', textAlign: 'left', cursor: 'pointer', fontSize: '0.85rem' }}
                  >{t('pdfLayoutSettings')}</button>

                  {showPdfSettings && (
                    <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', padding: '0.7rem', fontSize: '0.8rem', color: '#e2e8f0' }}>
                      {[
                        { key: 'beamTop1',        labelKey: 'beamTop1' },
                        { key: 'beamTop2',        labelKey: 'beamTop2' },
                        { key: 'beamBottom1',     labelKey: 'beamBottom1' },
                        { key: 'beamBottom2',     labelKey: 'beamBottom2' },
                        { key: 'symAbove',        labelKey: 'symAbove' },
                        { key: 'symBelow',        labelKey: 'symBelow' },
                        { key: 'dotTopOffset',    labelKey: 'dotTopOffset' },
                        { key: 'dotBottomOffset', labelKey: 'dotBottomOffset' },
                      ].map(({ key, labelKey }) => {
                        const label = t(labelKey);
                        return (
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
                            style={{ width: '60px', padding: '2px 4px', borderRadius: '4px', border: '1px solid #475569', background: '#1e293b', color: '#e2e8f0', textAlign: 'right' }}
                          />
                        </div>
                      );
                      })}
                      <button
                        onClick={() => { setPdfSettings({ ...DEFAULT_PDF_SETTINGS }); localStorage.setItem('pdfSettings', JSON.stringify(DEFAULT_PDF_SETTINGS)); }}
                        style={{ marginTop: '0.3rem', width: '100%', padding: '0.3rem', background: '#334155', border: 'none', borderRadius: '4px', color: '#e2e8f0', cursor: 'pointer', fontSize: '0.75rem' }}
                      >{t('restoreDefaults')}</button>
                    </div>
                  )}

                  <div style={{ height: '1px', background: '#334155', margin: '0.3rem 0' }} />

                  {/* Manual */}
                  <button
                    onClick={() => { setShowManual(true); setShowToolsMenu(false); }}
                    style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '6px', padding: '0.5rem 0.8rem', textAlign: 'left', cursor: 'pointer', fontSize: '0.85rem' }}
                  >{t('manual')}</button>

                  <div style={{ height: '1px', background: '#334155', margin: '0.3rem 0' }} />
                  <div style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.2rem' }}>{t('languageLabel')}</div>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    {LANGUAGES.map(lang => (
                      <button key={lang.code} onClick={() => setLanguage(lang.code)} style={{ flex: 1, background: language === lang.code ? '#3b82f6' : '#0f172a', color: language === lang.code ? '#fff' : '#94a3b8', border: '1px solid #334155', borderRadius: '5px', padding: '0.3rem 0.4rem', fontSize: '0.75rem', cursor: 'pointer' }}>{lang.label}</button>
                    ))}
                  </div>

                  {user && (
                    <>
                      <div style={{ height: '1px', background: '#334155', margin: '0.3rem 0' }} />
                      <div style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.2rem' }}>Account</div>
                      <div style={{ color: '#cbd5e1', fontSize: '0.75rem', marginBottom: '0.2rem', wordBreak: 'break-all' }}>{user.email}</div>
                      <div style={{ color: isOnline ? '#22c55e' : '#f87171', fontSize: '0.7rem', marginBottom: '0.3rem' }}>
                        {isOnline ? '● Online' : '● Offline (cache modus)'}
                      </div>
                      {!changePasswordOpen ? (
                        <button
                          onClick={() => setChangePasswordOpen(true)}
                          style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '6px', padding: '0.5rem 0.8rem', textAlign: 'left', cursor: 'pointer', fontSize: '0.85rem' }}
                        >Wachtwoord wijzigen</button>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          <input
                            type="password"
                            autoComplete="new-password"
                            placeholder="Nieuw wachtwoord"
                            value={changePasswordValue}
                            onChange={(e) => setChangePasswordValue(e.target.value)}
                            style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #475569', borderRadius: '4px', padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                          />
                          <input
                            type="password"
                            autoComplete="new-password"
                            placeholder="Herhaal nieuw wachtwoord"
                            value={changePasswordValue2}
                            onChange={(e) => setChangePasswordValue2(e.target.value)}
                            style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #475569', borderRadius: '4px', padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                          />
                          <div style={{ display: 'flex', gap: '0.3rem' }}>
                            <button
                              disabled={changePasswordBusy || changePasswordValue.length < 6 || changePasswordValue !== changePasswordValue2}
                              onClick={async () => {
                                setChangePasswordBusy(true);
                                try {
                                  const { error } = await setNewPassword(changePasswordValue);
                                  if (error) throw error;
                                  showToast('Wachtwoord gewijzigd ✓');
                                  setChangePasswordOpen(false);
                                  setChangePasswordValue('');
                                  setChangePasswordValue2('');
                                } catch (err) {
                                  alert(err?.message ?? 'Wachtwoord wijzigen mislukt.');
                                } finally {
                                  setChangePasswordBusy(false);
                                }
                              }}
                              style={{
                                flex: 1,
                                background: changePasswordValue.length >= 6 && changePasswordValue === changePasswordValue2 ? '#1d4ed8' : '#1e293b',
                                color: changePasswordValue.length >= 6 && changePasswordValue === changePasswordValue2 ? '#fff' : '#475569',
                                border: 'none', borderRadius: '4px', padding: '0.4rem', fontSize: '0.8rem',
                                cursor: changePasswordValue.length >= 6 && changePasswordValue === changePasswordValue2 ? 'pointer' : 'default',
                              }}
                            >{changePasswordBusy ? '…' : 'Opslaan'}</button>
                            <button
                              onClick={() => { setChangePasswordOpen(false); setChangePasswordValue(''); setChangePasswordValue2(''); }}
                              style={{ background: 'transparent', color: '#94a3b8', border: '1px solid #475569', borderRadius: '4px', padding: '0.4rem 0.6rem', fontSize: '0.8rem', cursor: 'pointer' }}
                            >Annuleer</button>
                          </div>
                          {changePasswordValue.length > 0 && changePasswordValue.length < 6 && (
                            <div style={{ color: '#f87171', fontSize: '0.7rem' }}>Minimaal 6 tekens</div>
                          )}
                          {changePasswordValue2.length > 0 && changePasswordValue !== changePasswordValue2 && (
                            <div style={{ color: '#f87171', fontSize: '0.7rem' }}>Wachtwoorden komen niet overeen</div>
                          )}
                        </div>
                      )}
                      <button
                        onClick={() => { signOut(); setShowToolsMenu(false); }}
                        style={{ background: '#0f172a', color: '#f87171', border: '1px solid #334155', borderRadius: '6px', padding: '0.5rem 0.8rem', textAlign: 'left', cursor: 'pointer', fontSize: '0.85rem' }}
                      >Log uit</button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Cursor sync offset — altijd zichtbaar in header */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: '#f59e0b', fontSize: '0.6rem', whiteSpace: 'nowrap' }}>⏱ {cursorOffsetMs} ms</span>
              <button
                onClick={() => setCursorOffsetMs(0)}
                disabled={cursorOffsetMs === 0}
                title={t('resetSyncOffset')}
                style={{ background: 'transparent', border: 'none', color: cursorOffsetMs === 0 ? '#1e3a5f' : '#64748b', cursor: cursorOffsetMs === 0 ? 'default' : 'pointer', fontSize: '0.85rem', padding: 0, lineHeight: 1 }}
              >↺</button>
            </div>
            <input
              type="range" min="-3000" max="500" step="25" value={cursorOffsetMs}
              onChange={e => setCursorOffsetMs(parseInt(e.target.value, 10))}
              style={{ width: '90px', accentColor: '#f59e0b' }}
              title={`${t('cursorSyncOffsetTitle')}: ${cursorOffsetMs} ms`}
            />
          </div>

          {/* Import Library — mapkeuze dialoog */}
          {pendingImport && (
            <div
              onClick={() => { setPendingImport(null); setImportFolderName(''); }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1.5rem', width: '340px', display: 'flex', flexDirection: 'column', gap: '1rem' }}
              >
                <span style={{ fontWeight: 'bold', fontSize: '1rem', color: '#e2e8f0' }}>
                  Bibliotheek importeren ({pendingImport.songs.length} songs)
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                    Importeer in map (leeg = originele mappen bewaren):
                  </label>
                  <input
                    type="text"
                    value={importFolderName}
                    onChange={(e) => setImportFolderName(e.target.value)}
                    placeholder="bijv. Werner, Gapur, ..."
                    autoFocus
                    style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #475569', borderRadius: '6px', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => { setPendingImport(null); setImportFolderName(''); }}
                    style={{ background: 'transparent', border: '1px solid #475569', borderRadius: '6px', color: '#94a3b8', padding: '0.4rem 0.9rem', cursor: 'pointer', fontSize: '0.85rem' }}
                  >Annuleer</button>
                  <button
                    onClick={() => confirmImportLibrary(importFolderName.trim() || null)}
                    style={{ background: '#3b82f6', border: 'none', borderRadius: '6px', color: '#fff', padding: '0.4rem 0.9rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}
                  >Importeer</button>
                </div>
              </div>
            </div>
          )}

          {/* Move song to folder dialog */}
          {moveSongTarget && (() => {
            const existingFolders = Array.from(new Set(savedSongs.map(s => s.folder || 'Algemeen'))).sort();
            return (
              <div
                onClick={() => { setMoveSongTarget(null); setMoveSongFolderInput(''); }}
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1.5rem', width: '340px', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}
                >
                  <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#e2e8f0' }}>
                    Verplaats "{moveSongTarget.name}"
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                    Huidige map: <strong>{moveSongTarget.folder}</strong>
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginBottom: '-0.4rem' }}>
                    Bestaande mappen:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', maxHeight: '180px', overflowY: 'auto' }}>
                    {existingFolders.map(f => (
                      <button
                        key={f}
                        onClick={() => handleMoveSongToFolder(moveSongTarget, f)}
                        disabled={f === moveSongTarget.folder}
                        style={{
                          textAlign: 'left',
                          background: f === moveSongTarget.folder ? '#0f172a' : '#0f172a',
                          color: f === moveSongTarget.folder ? '#475569' : '#e2e8f0',
                          border: '1px solid #334155',
                          borderRadius: '6px',
                          padding: '0.45rem 0.75rem',
                          fontSize: '0.85rem',
                          cursor: f === moveSongTarget.folder ? 'default' : 'pointer',
                        }}
                      >
                        📁 {f}{f === moveSongTarget.folder ? '  (huidige)' : ''}
                      </button>
                    ))}
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginBottom: '-0.4rem' }}>
                    Of nieuwe map:
                  </div>
                  <input
                    type="text"
                    value={moveSongFolderInput}
                    onChange={(e) => setMoveSongFolderInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && moveSongFolderInput.trim()) handleMoveSongToFolder(moveSongTarget, moveSongFolderInput); }}
                    placeholder="bv. Buka'an, Pangjadi, ..."
                    style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #475569', borderRadius: '6px', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                  />
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => { setMoveSongTarget(null); setMoveSongFolderInput(''); }}
                      style={{ background: 'transparent', border: '1px solid #475569', borderRadius: '6px', color: '#94a3b8', padding: '0.4rem 0.9rem', cursor: 'pointer', fontSize: '0.85rem' }}
                    >Annuleer</button>
                    <button
                      onClick={() => handleMoveSongToFolder(moveSongTarget, moveSongFolderInput)}
                      disabled={!moveSongFolderInput.trim()}
                      style={{
                        background: moveSongFolderInput.trim() ? '#3b82f6' : '#1e293b',
                        color: moveSongFolderInput.trim() ? '#fff' : '#475569',
                        border: 'none', borderRadius: '6px',
                        padding: '0.4rem 0.9rem',
                        cursor: moveSongFolderInput.trim() ? 'pointer' : 'default',
                        fontSize: '0.85rem', fontWeight: 'bold',
                      }}
                    >Verplaats</button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Song Library Modal */}
          {showSongLibrary && (
            <div
              onClick={() => { setShowSongLibrary(false); setExportSelection(new Set()); }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1.5rem', width: '520px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: '1rem' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '1rem', color: '#e2e8f0' }}>{t('songLibraryTitle')}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>

                    {/* Export selectie button — only enabled when something is selected */}
                    <button
                      onClick={handleExportSelection}
                      disabled={exportSelection.size === 0}
                      style={{
                        background: '#1e293b',
                        color: exportSelection.size > 0 ? '#fbbf24' : '#475569',
                        border: '1px solid #334155',
                        borderRadius: '5px', padding: '0.25rem 0.6rem', fontSize: '0.78rem',
                        cursor: exportSelection.size > 0 ? 'pointer' : 'default',
                      }}
                      title="Exporteer geselecteerde songs"
                    >Export ({exportSelection.size})</button>

                    {/* Verwijder selectie button — directly visible, no dropdown */}
                    <button
                      onClick={handleDeleteSelection}
                      disabled={exportSelection.size === 0}
                      style={{
                        background: '#1e293b',
                        color: exportSelection.size > 0 ? '#ef4444' : '#475569',
                        border: '1px solid #334155',
                        borderRadius: '5px', padding: '0.25rem 0.6rem', fontSize: '0.78rem',
                        cursor: exportSelection.size > 0 ? 'pointer' : 'default',
                      }}
                      title="Verwijder geselecteerde songs"
                    >Delete ({exportSelection.size})</button>

                    {/* Import — single button, accepts both song and group files */}
                    <label style={{ background: '#1e293b', color: '#34d399', border: '1px solid #334155', borderRadius: '5px', padding: '0.25rem 0.6rem', fontSize: '0.78rem', cursor: 'pointer' }}>
                      Import
                      <input type="file" accept=".kendang,.kendang-lib" style={{ display: 'none' }} onChange={handleImport} />
                    </label>

                    <button onClick={() => { setShowSongLibrary(false); setExportSelection(new Set()); }} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={songSearchQuery}
                    onChange={(e) => setSongSearchQuery(e.target.value)}
                    placeholder={t('searchPlaceholder')}
                    style={{ flex: 1, background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '6px', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                    autoFocus
                  />
                  <select
                    value={librarySort}
                    onChange={(e) => setLibrarySort(e.target.value)}
                    style={{ background: '#0f172a', color: '#cbd5e1', border: '1px solid #334155', borderRadius: '6px', padding: '0.5rem 0.5rem', fontSize: '0.78rem', cursor: 'pointer' }}
                    title="Sorteren"
                  >
                    <option value="name">Naam A-Z</option>
                    <option value="recent">Laatst bewerkt</option>
                  </select>
                </div>
                <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {/* Templates folder — from database, readable by all, writable by admin */}
                  {(() => {
                    const q = songSearchQuery.toLowerCase();
                    const matches = dbTemplates.filter(p =>
                      !q || p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q)
                    );
                    if (q && matches.length === 0) return null;
                    const folderName = '__TEMPLATES__';
                    const isCollapsed = collapsedFolders.has(folderName);
                    return (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.25rem 0', borderBottom: '1px solid #d4af37', marginBottom: '0.25rem' }}>
                          <button
                            onClick={() => toggleFolderCollapsed(folderName)}
                            style={{ background: 'none', border: 'none', color: '#d4af37', cursor: 'pointer', fontSize: '0.7rem', padding: '0 0.15rem', lineHeight: 1 }}
                            title={isCollapsed ? 'Map openklappen' : 'Map dichtklappen'}
                          >{isCollapsed ? '▶' : '▼'}</button>
                          <span
                            onClick={() => toggleFolderCollapsed(folderName)}
                            style={{ flex: 1, color: '#d4af37', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'pointer' }}
                          >📦 Templates <span style={{ color: '#a37f1e', fontWeight: 'normal' }}>({matches.length})</span></span>
                        </div>
                        {!isCollapsed && (matches.length === 0 ? (
                          <div style={{ color: '#64748b', fontSize: '0.75rem', fontStyle: 'italic', padding: '0.4rem 0.5rem' }}>
                            Nog geen templates beschikbaar.
                          </div>
                        ) : matches.map((tpl) => (
                          <div key={tpl.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.25rem', borderRadius: '6px' }}>
                            <span style={{ flex: 1, color: '#fcd34d', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              {tpl.name}
                              {tpl.category && <span style={{ color: '#a37f1e', fontSize: '0.7rem' }}>· {tpl.category}</span>}
                            </span>
                            <button
                              onClick={async () => {
                                setShowSongLibrary(false);
                                await handleUseTemplate(tpl, tpl.name, tpl.category || 'Templates');
                                showToast(`"${tpl.name}" geladen`);
                              }}
                              style={{ background: '#d4af37', color: '#1e293b', border: 'none', borderRadius: '4px', padding: '0.25rem 0.6rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 'bold' }}
                            >Gebruik</button>
                            {isAdmin && (
                              <button
                                onClick={async () => {
                                  if (!window.confirm(`Template "${tpl.name}" verwijderen?`)) return;
                                  try { await removeTemplate(tpl.id); showToast('Template verwijderd'); }
                                  catch (err) { alert(err?.message ?? 'Verwijderen mislukt'); }
                                }}
                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0 4px', display: 'flex', alignItems: 'center' }}
                                title="Template verwijderen"
                              ><TrashIcon size={12} /></button>
                            )}
                          </div>
                        )))}
                      </div>
                    );
                  })()}

                  {savedSongs.length === 0 ? (
                    <p style={{ color: '#64748b', textAlign: 'center', marginTop: '2rem' }}>{t('noSongsStored')}</p>
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
                    // Sort songs within each folder according to the chosen order.
                    const sortFn = librarySort === 'recent'
                      ? (a, b) => (b.updated_at || '').localeCompare(a.updated_at || '')
                      : (a, b) => a.name.localeCompare(b.name);
                    Object.values(byFolder).forEach(arr => arr.sort(sortFn));
                    // When sorting by recent, also reorder the folder list itself by the
                    // newest song each folder contains. Otherwise stay alphabetical.
                    let folders;
                    if (librarySort === 'recent') {
                      const folderRecency = (f) => byFolder[f][0]?.updated_at || '';
                      folders = Object.keys(byFolder).sort((a, b) => folderRecency(b).localeCompare(folderRecency(a)));
                    } else {
                      folders = Object.keys(byFolder).sort();
                    }
                    if (folders.length === 0) return (
                      <p style={{ color: '#64748b', textAlign: 'center', marginTop: '2rem' }}>Geen resultaten.</p>
                    );
                    return folders.map(folder => (
                      <div key={folder}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.25rem 0', borderBottom: '1px solid #334155', marginBottom: '0.25rem' }}>
                          <input
                            type="checkbox"
                            checked={byFolder[folder].length > 0 && byFolder[folder].every(s => exportSelection.has(s.id))}
                            ref={(el) => { if (el) el.indeterminate = byFolder[folder].some(s => exportSelection.has(s.id)) && !byFolder[folder].every(s => exportSelection.has(s.id)); }}
                            onChange={() => toggleExportFolder(byFolder[folder])}
                            title="Selecteer hele map voor export"
                            style={{ accentColor: '#fbbf24', cursor: 'pointer' }}
                          />
                          {renamingFolder === folder ? (
                            <input
                              autoFocus
                              value={renameFolderInput}
                              onChange={e => setRenameFolderInput(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleRenameFolder(folder, renameFolderInput); if (e.key === 'Escape') setRenamingFolder(null); }}
                              onBlur={() => handleRenameFolder(folder, renameFolderInput)}
                              style={{ flex: 1, background: '#0f172a', color: '#e2e8f0', border: '1px solid #3b82f6', borderRadius: '4px', padding: '0.1rem 0.4rem', fontSize: '0.75rem', fontWeight: 'bold' }}
                            />
                          ) : (
                            <>
                              <button
                                onClick={() => toggleFolderCollapsed(folder)}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.7rem', padding: '0 0.15rem', lineHeight: 1 }}
                                title={collapsedFolders.has(folder) ? 'Map openklappen' : 'Map dichtklappen'}
                              >{collapsedFolders.has(folder) ? '▶' : '▼'}</button>
                              <span
                                onClick={() => toggleFolderCollapsed(folder)}
                                style={{ flex: 1, color: '#94a3b8', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'pointer' }}
                              >📁 {folder} <span style={{ color: '#475569', fontWeight: 'normal' }}>({byFolder[folder].length})</span></span>
                              <button
                                onClick={() => { setRenamingFolder(folder); setRenameFolderInput(folder); }}
                                style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '0.75rem', padding: '0 0.2rem', lineHeight: 1 }}
                                title="Mapnaam wijzigen"
                              >✏</button>
                              {(() => {
                                const folderSongs = byFolder[folder];
                                const selectedInFolder = folderSongs.filter(s => exportSelection.has(s.id));
                                const allSelected = selectedInFolder.length === folderSongs.length;
                                const hasSelection = selectedInFolder.length > 0;
                                return (
                                  <button
                                    onClick={async () => {
                                      if (allSelected) {
                                        await handleDeleteFolder(folder);
                                      } else if (hasSelection) {
                                        await handleDeleteSelection();
                                      }
                                    }}
                                    disabled={!hasSelection}
                                    style={{
                                      background: 'transparent',
                                      border: '1px solid transparent',
                                      borderRadius: '4px',
                                      color: hasSelection ? '#ef4444' : '#334155',
                                      cursor: hasSelection ? 'pointer' : 'default',
                                      padding: '0.15rem 0.3rem',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}
                                    title={allSelected ? 'Hele map verwijderen' : hasSelection ? `Verwijder ${selectedInFolder.length} geselecteerde song${selectedInFolder.length === 1 ? '' : 's'}` : 'Selecteer eerst songs om te verwijderen'}
                                  ><TrashIcon size={13} /></button>
                                );
                              })()}
                            </>
                          )}
                        </div>
                        {!collapsedFolders.has(folder) && byFolder[folder].map(s => (
                          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.25rem', borderRadius: '6px', background: s.id === currentSongId ? 'rgba(59,130,246,0.15)' : 'transparent' }}>
                            <input
                              type="checkbox"
                              checked={exportSelection.has(s.id)}
                              onChange={() => toggleExportSong(s.id)}
                              title="Selecteer voor export"
                              style={{ accentColor: '#fbbf24', cursor: 'pointer' }}
                            />
                            {renamingSongId === s.id ? (
                              <input
                                autoFocus
                                value={renameSongInput}
                                onChange={(e) => setRenameSongInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleRenameSong(s, renameSongInput);
                                  if (e.key === 'Escape') { setRenamingSongId(null); setRenameSongInput(''); }
                                }}
                                onBlur={() => handleRenameSong(s, renameSongInput)}
                                style={{ flex: 1, background: '#0f172a', color: '#e2e8f0', border: '1px solid #3b82f6', borderRadius: '4px', padding: '0.2rem 0.5rem', fontSize: '0.875rem' }}
                              />
                            ) : (
                              <span style={{ flex: 1, color: s.id === currentSongId ? '#93c5fd' : '#e2e8f0', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span>{s.id === currentSongId ? '▶ ' : ''}{s.name}</span>
                                <button
                                  onClick={() => { setRenamingSongId(s.id); setRenameSongInput(s.name); }}
                                  style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '0.75rem', padding: '0 0.2rem', lineHeight: 1 }}
                                  title="Naam wijzigen"
                                >✏</button>
                                <span style={{ color: '#64748b', fontSize: '0.75rem' }}>{s.date}</span>
                              </span>
                            )}
                            <button
                              onClick={() => handleLoadSong(s.id)}
                              style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.25rem 0.6rem', fontSize: '0.8rem', cursor: 'pointer' }}
                            >{t('loadBtn')}</button>
                            <button
                              onClick={() => { setMoveSongTarget({ id: s.id, name: s.name, folder: s.folder || 'Algemeen', patterns: s.patterns, bpm: s.bpm }); setMoveSongFolderInput(''); }}
                              style={{ background: 'transparent', color: '#94a3b8', border: '1px solid #475569', borderRadius: '4px', padding: '0.25rem 0.6rem', fontSize: '0.8rem', cursor: 'pointer' }}
                              title="Verplaats naar andere map"
                            >📁</button>
                            <button
                              onClick={() => handleExportSong(s)}
                              style={{ background: 'transparent', color: '#94a3b8', border: '1px solid #475569', borderRadius: '4px', padding: '0.25rem 0.6rem', fontSize: '0.8rem', cursor: 'pointer' }}
                              title={t('exportSongTitle')}
                            >↑</button>
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
          ref={drumPanelRef}
          className="drum-section-float glass-panel"
          style={{
            position: 'fixed',
            left: drumPos.x,
            top: drumPos.y,
            width: drumCollapsed ? 'auto' : drumSize.w,
            height: drumCollapsed ? 'auto' : (drumSize.h ?? 'auto'),
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
            <span style={{ color: '#86efac' }}>{t('instrument')}</span>
            <span
              onClick={(e) => { e.stopPropagation(); setDrumCollapsed(c => !c); }}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#4ade80', cursor: 'pointer', padding: '0 6px' }}
            >{drumCollapsed ? '▸' : '▾'}</span>
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
              cursorOffsetMs={cursorOffsetMs}
              onCursorOffsetChange={setCursorOffsetMs}
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
          <div style={{ padding: '0.4rem 1rem 0.2rem', fontSize: '1.1rem', fontWeight: 'bold', color: '#e2e8f0', letterSpacing: '0.02em', textAlign: 'center' }}>
            {songName}{isModifiedSinceSave && <span style={{ color: '#fbbf24', marginLeft: 6 }} title="Niet opgeslagen wijzigingen">•</span>}
          </div>
          <SongMap
            song={song}
            activePatternId={activePatternId}
            open={showSongMap}
            topOffset={songMapTop}
            onClose={() => setShowSongMap(false)}
            onActivate={(id) => {
              setActivePatternId(id);
              setActiveSlot(prev => prev ? { ...prev, patternId: id, startIndex: 0, endIndex: 0 } : { patternId: id, trackId: 'anak', startIndex: 0, endIndex: 0 });
              setTimeout(() => document.getElementById(`block-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250);
            }}
            onMoveUp={movePatternUp}
            onMoveDown={movePatternDown}
            isLocked={isLocked}
          />
          {(() => {
            let offset = 0;
            let inheritedBpm = bpm;
            return song.map((pattern, idx) => {
              const patternInheritedBpm = inheritedBpm;
              // Update inheritedBpm for the next pattern: if this pattern has
              // an active tempoTrack, use its last point; otherwise carry over.
              const tt = pattern.tempoTrack;
              if (tt && tt.length > 0 && pattern.tempoTrackEnabled !== false) {
                const sorted = [...tt].sort((a, b) => a.slot - b.slot);
                inheritedBpm = sorted[sorted.length - 1].bpm;
              }
              const measureOffset = offset;
              offset += Math.ceil(pattern.anak.length / 48);
              return (
                <Fragment key={pattern.id}>
                  {idx > 0 && !isLocked && (
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
                      inheritedBpm={patternInheritedBpm}
                      realtimeBpm={realtimeBpm}
                      handleBpmChange={handleBpmChange}
                      onDrumTrigger={handleDrumTrigger}
                      isRecording={isRecording}
                      isPlaying={isPlaying}
                      togglePlay={togglePlay}
                      rewind={rewind}
                      stepBack={stepBack}
                      stepBackCount={stepBackCount}
                      gridResolution={gridResolution}
                      magneticInput={magneticInput}
                      setGridResolution={setGridResolution}
                      setMagneticInput={setMagneticInput}
                      autoQuantize={autoQuantize}
                      setAutoQuantize={setAutoQuantize}
                      onSnapToGrid={snapSelectionToGrid}
                      inputEnabled={inputEnabled}
                      setInputEnabled={setInputEnabled}
                      savedSnippets={savedSnippets}
                      handleSaveSnippet={handleSaveSnippet}
                      handleInsertSnippet={handleInsertSnippet}
                      handleDeleteSnippet={handleDeleteSnippet}
                      handleRenameSnippet={handleRenameSnippet}
                      handleMoveSnippetToFolder={handleMoveSnippetToFolder}
                      handleRenameSnippetFolder={handleRenameSnippetFolder}
                      handleDeleteSnippetFolder={handleDeleteSnippetFolder}
                      handleDeleteSnippetSilently={handleDeleteSnippetSilently}
                      factorySnippets={dbSnippetTemplates}
                      isAdmin={isAdmin}
                      onPublishSnippetTemplate={publishSnippetTemplate}
                      onRemoveSnippetTemplate={removeSnippetTemplate}
                      handleExportSnippets={handleExportSnippets}
                      handleImportSnippets={handleImportSnippets}
                      insertMeasure={() => insertMeasure(pattern.id, activeSlot ? activeSlot.startIndex : 0)}
                      deleteMeasure={() => deleteMeasure(pattern.id, activeSlot ? activeSlot.startIndex : 0)}
                      deleteMeasuresFromEnd={(count) => deleteMeasuresFromEnd(pattern.id, count)}
                      measureOffset={measureOffset}
                      loopRange={loopRange}
                      soloTrack={mutedTrack}
                      onToggleSolo={toggleSolo}
                      metronomeMode={metronomeMode}
                      setMetronomeMode={setMetronomeMode}
                      metronomeVolume={metronomeVolume}
                      setMetronomeVolume={setMetronomeVolume}
                      onUpdateTempoTrack={handleUpdateTempoTrack}
                      onToggleTempoTrack={handleToggleTempoTrack}
                      onToggleAllTempoOpen={handleToggleAllTempoOpen}
                      onToggleAllTempoEnabled={handleToggleAllTempoEnabled}
                      globalTempoOpenSignal={globalTempoOpenSignal}
                      onSeek={handleSeek}
                      trackVolumes={trackVolumes}
                      onTrackVolumeChange={(track, val) => setTrackVolumes(v => ({ ...v, [track]: val }))}
                      onDuplicate={() => duplicateSongBlock(pattern.id)}
                      onDelete={() => handleDeleteSongBlock(pattern.id)}
                      canDelete={song.length > 1}
                      isLocked={isLocked}
                      isLooped={loopedSections.includes(pattern.id)}
                      onToggleSectionLoop={() => handleToggleSectionLoop(pattern.id)}
                      onRulerLoop={(startSlot, endSlot) => handleRulerLoop(pattern.id, startSlot, endSlot)}
                      onClearRulerLoop={handleClearRulerLoop}
                    />
                  </div>
                </Fragment>
              );
            });
          })()}

          {/* Append new block at the bottom — sticky zodat altijd bereikbaar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.5rem 0 0', padding: '0.4rem 1rem', position: 'sticky', bottom: 0, background: 'var(--bg-primary, #0f172a)', borderTop: '1px solid var(--border-subtle)', zIndex: 10 }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
            <button
              onClick={addSongBlock}
              style={{ background: 'transparent', color: '#10b981', border: '1px solid #10b981', borderRadius: '4px', padding: '0.25rem 0.8rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 'bold' }}
              title={t('addBlockTooltip')}
            >{t('addBlock')}</button>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
          </div>
        </div>
        </main>
      </div>

      {/* ── Toast (auto-dismiss feedback) ─────────────────────────────── */}
      {toast && (
        <div
          role="status"
          style={{
            position: 'fixed', bottom: '4.5rem', left: '50%', transform: 'translateX(-50%)',
            background: toast.kind === 'error' ? '#7f1d1d' : '#1d4ed8',
            color: '#fff', padding: '0.55rem 1.1rem', borderRadius: '8px',
            fontSize: '0.85rem', fontWeight: 'bold',
            boxShadow: '0 6px 24px rgba(0,0,0,0.45)',
            zIndex: 9500, pointerEvents: 'none',
            animation: 'fadein 0.18s ease-out',
          }}
        >{toast.message}</div>
      )}

      {/* ── Migration dialog (one-time, when legacy localStorage songs exist) ── */}
      <MigrationDialog />

      {/* ── Handleiding Modal ──────────────────────────────────────────── */}
      {showManual && (
        <div
          onClick={() => setShowManual(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', width: '100%', maxWidth: '680px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.2rem', borderBottom: '1px solid #334155' }}>
              <span style={{ fontWeight: 'bold', fontSize: '1rem', color: '#e2e8f0' }}>{t('manualTitle')}</span>
              <button onClick={() => setShowManual(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.3rem', cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ overflowY: 'auto', padding: '1.2rem', color: '#cbd5e1', fontSize: '0.85rem', lineHeight: 1.7 }}>
              {t('manualSections').map(({ title, body }) => (
                <div key={title} style={{ marginBottom: '1rem' }}>
                  <div style={{ fontWeight: 'bold', color: '#f1f5f9', marginBottom: '0.3rem' }}>{title}</div>
                  <div style={{ color: '#94a3b8' }}>{body}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
