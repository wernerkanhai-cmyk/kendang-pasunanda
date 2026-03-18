import { readFileSync } from 'fs';

// Let's just create a dummy pattern data structure
const pattern = {
  id: 'pat-1',
  anak: Array.from({length: 192}, (_, i) => ({ top: 'A', bottom: 'B' }))
};

const activeSlot = {
  patternId: 'pat-1',
  trackId: 'anak',
  startIndex: 20,
  endIndex: 25
};

const getActiveRange = () => {
    if (!activeSlot || activeSlot.patternId !== pattern.id) return null;
    const start = Math.min(activeSlot.startIndex, activeSlot.endIndex);
    const end = Math.max(activeSlot.startIndex, activeSlot.endIndex);
    return { trackId: activeSlot.trackId, start, end };
};

const handleClear = () => {
    const range = getActiveRange();
    if (!range) return;
    
    const newTrack = [...pattern[range.trackId]];
    for (let i = range.start; i <= range.end; i++) {
        newTrack[i] = { top: (i % 12 === 0) ? '.' : '', bottom: '' };
    }
    return { ...pattern, [range.trackId]: newTrack };
};

const updated = handleClear();
console.log(updated.anak.slice(19, 27));
