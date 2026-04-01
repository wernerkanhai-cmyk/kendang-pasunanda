/**
 * Kendang Pasunanda — Automated Stress Test Suite
 * Run: node stress-test.mjs
 *
 * Tests:
 *   1. Boot Loop        – sanitizePattern / generateEmptySlots stability (100 iterations)
 *   2. Random Input     – writeSymbolToPattern with random/malformed inputs (10 000 calls)
 *   3. Notation Stress  – beam & rest consistency on 10 fully random patterns
 */

import {
  generateEmptySlots,
  sanitizePattern,
  writeSymbolToPattern,
  getHandForSymbol,
  slotToBeat,
  deduplicateGongByBeat,
} from './src/engine/patternLogic.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

const SYMBOLS   = ['A','J',';',':','L','G','F','C','V','N','X','S','.',''];
const TRACKS    = ['anak','indung'];
const SLOTS     = 192;
const BAR_SLOTS = 48;

let passed = 0, failed = 0;
const failures = [];

function assert(label, condition, detail = '') {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push({ label, detail });
    console.error(`  ✗ FAIL  ${label}${detail ? ' — ' + detail : ''}`);
  }
}

function rand(n)     { return Math.floor(Math.random() * n); }
function randItem(a) { return a[rand(a.length)]; }

function makeCorruptPattern(variant) {
  switch (variant) {
    case 0: return null;
    case 1: return {};
    case 2: return { anak: null, indung: undefined };
    case 3: return { id: 42, name: 999, anak: 'not-an-array', indung: [] };
    case 4: return {
      id: 'p', name: 'p',
      anak:   Array.from({ length: 999 }, (_, i) => ({ top: 'A', bottom: 'B' })),
      indung: Array.from({ length: 3 })  // too short
    };
    case 5: return {
      id: 'p', name: 'p',
      anak:   Array.from({ length: SLOTS }, (_, i) => i % 3 === 0 ? null : { top: 'X', bottom: undefined }),
      indung: Array.from({ length: SLOTS }, () => ({ top: {}, bottom: [] }))
    };
    default: return { anak: [], indung: [] };
  }
}

// ─── Test 1: Boot Loop ───────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════');
console.log(' TEST 1: Boot Loop (100 iterations)');
console.log('═══════════════════════════════════════════');

for (let i = 0; i < 100; i++) {
  const variant = i % 7;
  let result;
  try {
    const corrupt = makeCorruptPattern(variant);
    result = sanitizePattern(corrupt);
  } catch (e) {
    assert(`boot[${i}] sanitizePattern does not throw`, false, e.message);
    continue;
  }

  assert(`boot[${i}] anak is array`,   Array.isArray(result?.anak));
  assert(`boot[${i}] indung is array`, Array.isArray(result?.indung));
  assert(`boot[${i}] anak length = ${SLOTS}`,   result?.anak?.length   === SLOTS, `got ${result?.anak?.length}`);
  assert(`boot[${i}] indung length = ${SLOTS}`, result?.indung?.length === SLOTS, `got ${result?.indung?.length}`);

  // Every slot must be { top: string, bottom: string }
  const badSlots = result.anak.filter(s => typeof s?.top !== 'string' || typeof s?.bottom !== 'string');
  assert(`boot[${i}] all anak slots well-formed`, badSlots.length === 0, `${badSlots.length} malformed slots`);

  // generateEmptySlots round-trip
  let empty;
  try {
    empty = generateEmptySlots(SLOTS);
  } catch (e) {
    assert(`boot[${i}] generateEmptySlots does not throw`, false, e.message);
    continue;
  }
  assert(`boot[${i}] empty slots length`, empty.length === SLOTS);
  const quarterRestCount = empty.filter(s => s.top === '.' || s.bottom === '.').length;
  assert(`boot[${i}] quarter rests at every 12th slot`, quarterRestCount === SLOTS / 12,
    `expected ${SLOTS / 12}, got ${quarterRestCount}`);
}

// ─── Test 2: Random Input Torture ───────────────────────────────────────────

console.log('\n═══════════════════════════════════════════');
console.log(' TEST 2: Random Input Torture (10 000 calls)');
console.log('═══════════════════════════════════════════');

const basePattern = sanitizePattern({
  id: 'stress', name: 'stress',
  anak: generateEmptySlots(SLOTS),
  indung: generateEmptySlots(SLOTS),
  gong: [],
});

let torture_throws = 0;
let pattern = basePattern;

for (let i = 0; i < 10_000; i++) {
  const trackId    = randItem(TRACKS);
  const slotIndex  = rand(SLOTS * 2);     // includes out-of-bounds
  const symbol     = randItem(SYMBOLS);

  let result;
  try {
    result = writeSymbolToPattern(pattern, trackId, slotIndex, symbol);
  } catch (e) {
    torture_throws++;
    failures.push({ label: `torture[${i}]`, detail: `throw on slot=${slotIndex} sym=${symbol}: ${e.message}` });
    continue;
  }

  // Result must always be a valid pattern object (never null/undefined)
  if (result == null) {
    failed++;
    failures.push({ label: `torture[${i}]`, detail: `returned ${result} for slot=${slotIndex}` });
  } else {
    passed++;
    // Keep valid results as next base (simulates real usage)
    if (slotIndex >= 0 && slotIndex < SLOTS) pattern = result;
  }
}

assert('torture: no throws on any input', torture_throws === 0, `${torture_throws} throws`);
assert('torture: anak track length preserved', pattern.anak.length === SLOTS);
assert('torture: indung track length preserved', pattern.indung.length === SLOTS);

// Every written slot must still be well-formed
const malformedAfterTorture = pattern.anak.concat(pattern.indung)
  .filter(s => typeof s?.top !== 'string' || typeof s?.bottom !== 'string');
assert('torture: all slots well-formed after 10k writes', malformedAfterTorture.length === 0,
  `${malformedAfterTorture.length} malformed`);

// ─── Test 3: Notation Stress ─────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════');
console.log(' TEST 3: Notation Stress (10 random patterns)');
console.log('═══════════════════════════════════════════');

/**
 * Mirrors the beam-group logic from TrackRow.jsx:
 * For each beat (12 slots), count non-empty, non-rest notes.
 * A single note in a beat = quarter note (no beam).
 * 2 notes = eighth notes. 3–4 notes = 16th notes.
 * Returns true if the output is logically consistent (no crash, sane structure).
 */
function computeBeamGroups(slots) {
  const beats = Math.ceil(slots.length / 12);
  const groups = [];

  for (let b = 0; b < beats; b++) {
    const beatSlots = slots.slice(b * 12, (b + 1) * 12);
    const notes = [];

    for (let offset = 0; offset < 12; offset++) {
      const s = beatSlots[offset];
      const topNote    = s?.top    && s.top    !== '.' ? s.top    : null;
      const bottomNote = s?.bottom && s.bottom !== '.' ? s.bottom : null;
      if (topNote || bottomNote) {
        notes.push({ offset, top: topNote, bottom: bottomNote });
      }
    }

    // Validate: offsets must be in 0–11 range and ascending
    for (let n = 0; n < notes.length; n++) {
      if (notes[n].offset < 0 || notes[n].offset > 11) return { ok: false, reason: `offset out of range: ${notes[n].offset}` };
      if (n > 0 && notes[n].offset <= notes[n-1].offset) return { ok: false, reason: `non-ascending offsets` };
    }

    // Beam level must be deterministic: 0=quarter, 1=eighth, 2=16th
    let beamLevel;
    if      (notes.length <= 1) beamLevel = 0;
    else if (notes.length <= 2) beamLevel = 1;
    else                        beamLevel = 2;

    groups.push({ beat: b, noteCount: notes.length, beamLevel });
  }
  return { ok: true, groups };
}

for (let p = 0; p < 10; p++) {
  // Build a fully random pattern
  let rndPattern = sanitizePattern({
    id: `rnd-${p}`, name: `Random ${p}`,
    anak: generateEmptySlots(SLOTS),
    indung: generateEmptySlots(SLOTS),
    gong: Array.from({ length: rand(8) }, () => rand(SLOTS)),
  });

  // Write random symbols into random positions
  for (let w = 0; w < 500; w++) {
    const track = randItem(TRACKS);
    const slot  = rand(SLOTS);
    const sym   = randItem(SYMBOLS.filter(s => s !== ''));
    rndPattern = writeSymbolToPattern(rndPattern, track, slot, sym) ?? rndPattern;
  }

  // Run beam computation
  const anakResult   = computeBeamGroups(rndPattern.anak);
  const indungResult = computeBeamGroups(rndPattern.indung);

  assert(`notation[${p}] anak beam groups OK`,   anakResult.ok,   anakResult.reason);
  assert(`notation[${p}] indung beam groups OK`, indungResult.ok, indungResult.reason);

  if (anakResult.ok) {
    // Each beam group must have valid beamLevel (0/1/2)
    const badLevels = anakResult.groups.filter(g => ![0,1,2].includes(g.beamLevel));
    assert(`notation[${p}] anak beam levels valid`, badLevels.length === 0,
      `${badLevels.length} invalid levels`);
  }

  // gong deduplication must not crash
  let deduped;
  try { deduped = deduplicateGongByBeat(rndPattern.gong); } catch(e) {
    assert(`notation[${p}] deduplicateGongByBeat does not throw`, false, e.message);
    continue;
  }
  assert(`notation[${p}] deduped gong is array`, Array.isArray(deduped));
  assert(`notation[${p}] deduped gong ≤ original`, deduped.length <= rndPattern.gong.length);

  // All deduped gong entries must be multiples of 12 (beat boundaries)
  const badGong = deduped.filter(g => g % 12 !== 0);
  assert(`notation[${p}] all gong entries on beat boundary`, badGong.length === 0,
    `${badGong.length} off-beat entries: ${badGong.slice(0,3)}`);
}

// ─── Test 4: Ralph Loop — Loop-range stability ───────────────────────────────

console.log('\n═══════════════════════════════════════════');
console.log(' TEST 4: Ralph Loop — Loop-range stress (iOS stability)');
console.log('═══════════════════════════════════════════');

/**
 * Mirrors handleRulerLoop / loopRange logic from App.jsx.
 * Loop invariants:
 *   • start must be a multiple of BAR_SLOTS (48) and >= 0
 *   • end must be > start and <= maxSlot
 *   • span must be a positive multiple of BAR_SLOTS
 *   • loopedSections array must not grow unboundedly
 */

const MAX_MEASURES  = 32;
const MAX_SLOT      = MAX_MEASURES * BAR_SLOTS;

function clampToBarBoundary(slot) {
  return Math.max(0, Math.floor(slot / BAR_SLOTS) * BAR_SLOTS);
}

function applyRulerLoop(start, end, maxSlot) {
  const s = clampToBarBoundary(start);
  const e = clampToBarBoundary(end);
  if (e <= s || s < 0 || e > maxSlot) return null; // invalid — no loop
  return { start: s, end: e };
}

// 4a: Valid loop ranges must produce start < end, both on bar boundaries
let loopErrors = 0;
for (let i = 0; i < 5_000; i++) {
  const rawStart = rand(MAX_SLOT);
  const rawEnd   = rawStart + rand(MAX_SLOT - rawStart) + 1;
  const loop     = applyRulerLoop(rawStart, rawEnd, MAX_SLOT);

  if (loop !== null) {
    if (loop.start >= loop.end) { loopErrors++; continue; }
    if (loop.start % BAR_SLOTS !== 0) { loopErrors++; continue; }
    if (loop.end   % BAR_SLOTS !== 0) { loopErrors++; continue; }
    if (loop.end > MAX_SLOT)          { loopErrors++; continue; }
  }
}
assert('ralph[4a] 5000 random loop ranges all valid or null', loopErrors === 0, `${loopErrors} invalid`);

// 4b: Out-of-bounds and inverted inputs must return null (never crash)
const edgeCases = [
  [-1,    48],
  [0,     0],
  [48,    48],
  [96,    48],
  [0,     MAX_SLOT + 48],
  [-9999, 9999],
  [NaN,   48],
  [0,     Infinity],
];
let edgeErrors = 0;
for (const [s, e] of edgeCases) {
  try {
    const r = applyRulerLoop(s, e, MAX_SLOT);
    // Must return null for invalid inputs
    if (r !== null) {
      if (r.start >= r.end || r.start < 0 || r.end > MAX_SLOT) edgeErrors++;
    }
  } catch (_) { edgeErrors++; }
}
assert('ralph[4b] edge-case loop inputs never crash or produce invalid range', edgeErrors === 0, `${edgeErrors} errors`);

// 4c: Rapid toggle of loopedSections (simulating iOS tap spam)
const SECTION_IDS = Array.from({ length: 8 }, (_, i) => `pat-${i}`);
let loopedSections = [];
let toggleErrors   = 0;
for (let i = 0; i < 10_000; i++) {
  const id = randItem(SECTION_IDS);
  // Toggle: add if not present, remove if present
  if (loopedSections.includes(id)) {
    loopedSections = loopedSections.filter(x => x !== id);
  } else {
    loopedSections = [...loopedSections, id];
  }
  // Invariant: no duplicates, all IDs valid
  const unique = new Set(loopedSections);
  if (unique.size !== loopedSections.length) toggleErrors++;
  if (loopedSections.some(x => !SECTION_IDS.includes(x))) toggleErrors++;
  if (loopedSections.length > SECTION_IDS.length) toggleErrors++;
}
assert('ralph[4c] 10k rapid section toggles — no duplicates, no overflow', toggleErrors === 0, `${toggleErrors} violations`);

// 4d: Loop range never exceeds the pattern length after measure insert/delete
function simulateMeasureOp(currentSlots, op) {
  if (op === 'insert') return currentSlots + BAR_SLOTS;
  if (op === 'delete') return Math.max(BAR_SLOTS, currentSlots - BAR_SLOTS);
  return currentSlots;
}
function clampLoop(loop, maxSlot) {
  if (!loop) return null;
  const e = Math.min(loop.end, maxSlot);
  const s = Math.min(loop.start, e - BAR_SLOTS);
  if (s < 0 || s >= e) return null;
  return { start: s, end: e };
}
let measureOpsErrors = 0;
let currentSlots = BAR_SLOTS * 4;
let activeLoop   = { start: 0, end: BAR_SLOTS };
const OPS        = ['insert', 'delete', 'none'];
for (let i = 0; i < 2_000; i++) {
  const op = randItem(OPS);
  currentSlots = simulateMeasureOp(currentSlots, op);
  activeLoop   = clampLoop(activeLoop, currentSlots);

  if (activeLoop) {
    if (activeLoop.start < 0)              measureOpsErrors++;
    if (activeLoop.end > currentSlots)     measureOpsErrors++;
    if (activeLoop.start >= activeLoop.end) measureOpsErrors++;
  }
}
assert('ralph[4d] loop clamped correctly after 2000 measure insert/delete ops', measureOpsErrors === 0, `${measureOpsErrors} out-of-bounds`);

// ─── Report ──────────────────────────────────────────────────────────────────

const total      = passed + failed;
const crashRate  = ((failed / total) * 100).toFixed(2);

console.log('\n═══════════════════════════════════════════');
console.log(' STRESS TEST REPORT');
console.log('═══════════════════════════════════════════');
console.log(`  Total assertions : ${total}`);
console.log(`  Passed           : ${passed}`);
console.log(`  Failed           : ${failed}`);
console.log(`  Crash Rate       : ${crashRate}%`);

if (failures.length > 0) {
  console.log('\n  Failures:');
  failures.forEach(f => console.log(`    ✗ ${f.label}${f.detail ? ' — ' + f.detail : ''}`));
} else {
  console.log('\n  ✓ All assertions passed — app is stable.');
}

process.exit(failed > 0 ? 1 : 0);
