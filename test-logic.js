const getHandForSymbol = (symbol) => {
  if (['A', 'J', ';', ':', 'L', 'G', 'F'].includes(symbol)) return 'top';
  if (['C', '?', 'V', 'S', 'N'].includes(symbol)) return 'bottom';
  return 'top';
};

let drumTapRef = { time: 0, slotIndex: 0, trackId: '', symbolHand: '' };
let activeSlot = { trackId: 'anak', startIndex: 96 };
let advanceCursor = false;
const symbol = 'C'; 
const now = Date.now();
const timeDiff = now - drumTapRef.time;
const targetTrack = activeSlot ? activeSlot.trackId : 'anak';
let targetSlotIndex = activeSlot ? activeSlot.startIndex : 0;
let nextCursorIndex = activeSlot.startIndex;

if (timeDiff < 80 && drumTapRef.symbolHand !== getHandForSymbol(symbol)) { 
   targetSlotIndex = drumTapRef.slotIndex; 
} else if (drumTapRef.trackId === targetTrack && timeDiff < 800) {
   targetSlotIndex = drumTapRef.slotIndex + 6;
} else {
   targetSlotIndex = activeSlot ? activeSlot.startIndex : 0; 
}

advanceCursor = true;
nextCursorIndex = targetSlotIndex + 12 - (targetSlotIndex % 12);

console.log({
  targetSlotIndex,
  nextCursorIndex,
  targetTrack,
  advanceCursor
});

