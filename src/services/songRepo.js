import { supabase } from '../lib/supabaseClient';

const SLOTS_PER_MEASURE = 48;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Returns the value if it looks like a UUID, otherwise null. */
function uuidOrNull(value) {
  if (typeof value !== 'string') return null;
  return UUID_RE.test(value) ? value : null;
}

/**
 * Convert an in-memory song into the JSON shape that the `save_song` Postgres
 * function expects. The in-memory shape is:
 *
 *   {
 *     id, name, folder, bpm,
 *     patterns: [
 *       { id, name, anak: [192 slots], indung: [192 slots],
 *         gong: [...], tempoTrack: [...], tempoTrackEnabled: bool }
 *     ]
 *   }
 *
 * The DB shape splits each pattern into "lines" (one per instrument), and each
 * line into measures of 48 slots.
 */
export function flattenSongForDb(song) {
  return {
    // Old localStorage entries use Date.now() string ids — those are not valid
    // uuids so we send null and let the DB generate one.
    id: uuidOrNull(song?.id),
    title: song?.name ?? 'Untitled',
    folder: song?.folder ?? null,
    bpm: song?.bpm ?? 100,
    patterns: (song?.patterns ?? []).map((p, idx) => ({
      pattern_index: idx,
      name: p?.name ?? `Pattern ${idx + 1}`,
      gong: p?.gong ?? [],
      tempo_track: {
        enabled: p?.tempoTrackEnabled === true,
        points: p?.tempoTrack ?? [],
        annotations: p?.annotations ?? {},
      },
      lines: {
        anak: chunkInstrument(p?.anak ?? []),
        indung: chunkInstrument(p?.indung ?? []),
      },
    })),
  };
}

function chunkInstrument(slots) {
  const out = [];
  const total = Math.ceil(slots.length / SLOTS_PER_MEASURE);
  for (let m = 0; m < total; m++) {
    out.push({
      measure_index: m,
      content: slots.slice(m * SLOTS_PER_MEASURE, (m + 1) * SLOTS_PER_MEASURE),
    });
  }
  return out;
}

/**
 * Convert a row tree returned by `selectSongTree` back into the in-memory shape.
 */
export function rehydrateSongFromDb(row) {
  if (!row) return null;
  const patterns = (row.patterns ?? [])
    .slice()
    .sort((a, b) => (a.pattern_index ?? 0) - (b.pattern_index ?? 0))
    .map((p) => {
      const lineByInstrument = {};
      for (const line of p.song_lines ?? []) {
        const measures = (line.measures ?? [])
          .slice()
          .sort((a, b) => (a.measure_index ?? 0) - (b.measure_index ?? 0));
        const flat = [];
        for (const m of measures) {
          if (Array.isArray(m.content)) flat.push(...m.content);
        }
        lineByInstrument[line.instrument] = flat;
      }
      const tempo = p.tempo_track ?? {};
      return {
        id: p.id,
        name: p.name,
        anak: lineByInstrument.anak ?? [],
        indung: lineByInstrument.indung ?? [],
        gong: p.gong ?? [],
        tempoTrack: tempo.points ?? [],
        tempoTrackEnabled: tempo.enabled === true,
        annotations: tempo.annotations ?? {},
      };
    });
  return {
    id: row.id,
    name: row.title,
    folder: row.folder,
    bpm: row.bpm ?? 100,
    patterns,
    updated_at: row.updated_at,
  };
}

/**
 * Save (insert or upsert) a song via the `save_song` RPC.
 * Returns the song id.
 */
export async function saveSong(song) {
  const payload = flattenSongForDb(song);
  const { data, error } = await supabase.rpc('save_song', { p_song: payload });
  if (error) throw error;
  return data; // uuid
}

/**
 * Fetch all songs for the current user, including the full pattern tree.
 */
export async function listSongs() {
  const { data, error } = await supabase
    .from('songs')
    .select(`
      id, title, folder, bpm, created_at, updated_at,
      patterns (
        id, pattern_index, name, gong, tempo_track,
        song_lines (
          id, instrument,
          measures ( id, measure_index, content )
        )
      )
    `)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rehydrateSongFromDb);
}

/**
 * Fetch a single song by id.
 */
export async function loadSong(songId) {
  const { data, error } = await supabase
    .from('songs')
    .select(`
      id, title, folder, bpm, created_at, updated_at,
      patterns (
        id, pattern_index, name, gong, tempo_track,
        song_lines (
          id, instrument,
          measures ( id, measure_index, content )
        )
      )
    `)
    .eq('id', songId)
    .single();
  if (error) throw error;
  return rehydrateSongFromDb(data);
}

/**
 * Delete a song by id (cascades to patterns, lines, measures via FK).
 */
export async function deleteSong(songId) {
  const { error } = await supabase.from('songs').delete().eq('id', songId);
  if (error) throw error;
}
