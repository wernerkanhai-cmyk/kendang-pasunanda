import { useState, useEffect, useRef, useCallback } from 'react';

// Web Audio API context for stable timing
let audioCtx = null;

export const usePlayback = (bpm = 100) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentBpm, setCurrentBpm] = useState(bpm);
  
  // Playhead position (0 to 191 for a 4-bar pattern)
  const [playhead, setPlayhead] = useState(0); 
  const [precount, setPrecount] = useState(0); // 4, 3, 2, 1, 0 (playing)

  const timerIdRef = useRef(null);
  const nextNoteTimeRef = useRef(0);
  const currentSlotRef = useRef(0);

  const lookahead = 25.0; // ms
  const scheduleAheadTime = 0.1; // s

  // Assuming 48 slots per bar, 12 slots per beat (quarter note), 4 beats per bar.
  // We advance the playhead every 1 slot (1/48th of a bar).
  // Time per beat = 60 / BPM
  // Time per slot = (60 / BPM) / 12
  const getSecondsPerSlot = () => (60.0 / currentBpm) / 12.0;

  const initAudio = () => {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  };

  const scheduleNote = (slotNumber, time) => {
    // Only schedule metronome clicks for now on full beats (every 12 slots)
    if (interactionModeRef.current === 'record' && slotNumber % 12 === 0) {
       // Just a simple beep for the metronome
       const osc = audioCtx.createOscillator();
       osc.connect(audioCtx.destination);
       // High beep for beat 1 (slot 0, 48, 96, 144)
       osc.frequency.value = (slotNumber % 48 === 0) ? 880 : 440;
       osc.start(time);
       osc.stop(time + 0.05);
    }
    
    // Visually update the playhead.
    // We defer to React state so the UI can draw the moving cursor.
    // In a pristine app we'd use requestAnimationFrame to match the audio time,
    // but for 12 slots per beat, state updates often suffice.
    requestAnimationFrame(() => {
        setPlayhead(slotNumber);
    });
  };

  const nextNote = () => {
    const secondsPerSlot = getSecondsPerSlot();
    nextNoteTimeRef.current += secondsPerSlot;
    
    // Advance slot
    currentSlotRef.current++;
    if (currentSlotRef.current >= 192) {
      currentSlotRef.current = 0;
    }
  };

  const scheduler = () => {
    // While there are notes that will need to play before the next interval, schedule them
    while (nextNoteTimeRef.current < audioCtx.currentTime + scheduleAheadTime) {
      scheduleNote(currentSlotRef.current, nextNoteTimeRef.current);
      nextNote();
    }
    timerIdRef.current = setTimeout(scheduler, lookahead);
  };

  const togglePlayback = (mode = 'play') => {
    initAudio();
    
    if (isPlaying) {
      // Stop
      setIsPlaying(false);
      setIsRecording(false);
      clearTimeout(timerIdRef.current);
      setPlayhead(0);
      setPrecount(0);
    } else {
      // Start
      if (mode === 'record') {
         setIsRecording(true);
         setPrecount(4); // Trigger a 4 beat visual pre-count (TODO: implement precount timing)
         // For now, immediately jump in
      }
      setIsPlaying(true);
      currentSlotRef.current = 0;
      nextNoteTimeRef.current = audioCtx.currentTime + 0.05;
      scheduler();
    }
  };
  
  // Exposing a ref to interactionMode to read inside scheduler without dependency loops
  const interactionModeRef = useRef('write');
  
  return {
    isPlaying,
    isRecording,
    currentBpm,
    setCurrentBpm,
    playhead,
    togglePlayback,
    interactionModeRef
  };
};
