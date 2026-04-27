import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { listSongs, saveSong as saveSongRpc, loadSong as loadSongRpc, deleteSong as deleteSongRpc } from '../services/songRepo';
import { cacheList, readList, putItem, deleteItem } from '../lib/offlineStore';
import { sanitizePattern } from '../engine/patternLogic';

// Migreer een offline-gecachte song (legacy glyph-data → soundIds).
const migrateCachedSong = (s) => {
  if (!s?.patterns || !Array.isArray(s.patterns)) return s;
  return { ...s, patterns: s.patterns.map(sanitizePattern) };
};

/**
 * Reactive cache + sync hook for songs stored in Supabase.
 *
 * - On mount (and on user change) fetches the full list once.
 * - Exposes save/load/delete that update the cache optimistically.
 * - Errors are surfaced via the `error` field; callers may also await the
 *   returned promises to handle them locally.
 */
export function useSongs() {
  const { user } = useAuth();
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initial fetch when a user becomes available.
  useEffect(() => {
    let alive = true;
    if (!user) {
      setSongs([]);
      return;
    }
    setLoading(true);
    setError(null);
    listSongs()
      .then(async (rows) => {
        if (!alive) return;
        setSongs(rows);
        // Mirror to IndexedDB so a later offline boot still works.
        try { await cacheList('songs', user.id, rows); } catch (e) { /* ignore */ }
      })
      .catch(async (err) => {
        if (!alive) return;
        // Network error → fall back to last known IndexedDB snapshot.
        try {
          const cached = await readList('songs', user.id);
          if (cached.length > 0) {
            setSongs(cached.map(migrateCachedSong));
            return;
          }
        } catch (_) { /* ignore */ }
        setError(err);
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [user]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listSongs();
      setSongs(rows);
      return rows;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const save = useCallback(async (song) => {
    setError(null);
    try {
      const id = await saveSongRpc(song);
      const fresh = await loadSongRpc(id);
      setSongs((prev) => {
        const idx = prev.findIndex((s) => s.id === id);
        if (idx >= 0) {
          const next = prev.slice();
          next[idx] = fresh;
          return next;
        }
        return [fresh, ...prev];
      });
      if (user) {
        try { await putItem('songs', user.id, fresh); } catch (_) { /* ignore */ }
      }
      return fresh;
    } catch (err) {
      setError(err);
      throw err;
    }
  }, [user]);

  const remove = useCallback(async (songId) => {
    setError(null);
    const prevState = songs;
    setSongs((prev) => prev.filter((s) => s.id !== songId));
    try {
      await deleteSongRpc(songId);
      try { await deleteItem('songs', songId); } catch (_) { /* ignore */ }
    } catch (err) {
      setSongs(prevState);
      setError(err);
      throw err;
    }
  }, [songs]);

  return { songs, loading, error, refresh, save, remove };
}
