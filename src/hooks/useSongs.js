import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { listSongs, saveSong as saveSongRpc, loadSong as loadSongRpc, deleteSong as deleteSongRpc } from '../services/songRepo';

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
      .then((rows) => { if (alive) setSongs(rows); })
      .catch((err) => { if (alive) setError(err); })
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
      // Re-fetch this single song so we get the canonical updated_at + ids back.
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
      return fresh;
    } catch (err) {
      setError(err);
      throw err;
    }
  }, []);

  const remove = useCallback(async (songId) => {
    setError(null);
    // Optimistic: drop from cache first
    const prevState = songs;
    setSongs((prev) => prev.filter((s) => s.id !== songId));
    try {
      await deleteSongRpc(songId);
    } catch (err) {
      // Roll back on failure
      setSongs(prevState);
      setError(err);
      throw err;
    }
  }, [songs]);

  return { songs, loading, error, refresh, save, remove };
}
