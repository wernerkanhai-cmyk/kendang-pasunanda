import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { listSnippets, saveSnippet as saveSnippetRpc, deleteSnippet as deleteSnippetRpc } from '../services/snippetRepo';
import { cacheList, readList, putItem, deleteItem } from '../lib/offlineStore';

export function useSnippets() {
  const { user } = useAuth();
  const [snippets, setSnippets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!user) {
      setSnippets([]);
      return;
    }
    setLoading(true);
    setError(null);
    listSnippets()
      .then(async (rows) => {
        if (!alive) return;
        setSnippets(rows);
        try { await cacheList('snippets', user.id, rows); } catch (_) { /* ignore */ }
      })
      .catch(async (err) => {
        if (!alive) return;
        try {
          const cached = await readList('snippets', user.id);
          if (cached.length > 0) {
            setSnippets(cached);
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
    try {
      const rows = await listSnippets();
      setSnippets(rows);
      return rows;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const save = useCallback(async (snippet) => {
    setError(null);
    try {
      const fresh = await saveSnippetRpc(snippet);
      setSnippets((prev) => {
        const idx = prev.findIndex((s) => s.id === fresh.id);
        if (idx >= 0) {
          const next = prev.slice();
          next[idx] = fresh;
          return next;
        }
        return [...prev, fresh];
      });
      if (user) {
        try { await putItem('snippets', user.id, fresh); } catch (_) { /* ignore */ }
      }
      return fresh;
    } catch (err) {
      setError(err);
      throw err;
    }
  }, [user]);

  const remove = useCallback(async (snippetId) => {
    setError(null);
    const prevState = snippets;
    setSnippets((prev) => prev.filter((s) => s.id !== snippetId));
    try {
      await deleteSnippetRpc(snippetId);
      try { await deleteItem('snippets', snippetId); } catch (_) { /* ignore */ }
    } catch (err) {
      setSnippets(prevState);
      setError(err);
      throw err;
    }
  }, [snippets]);

  return { snippets, loading, error, refresh, save, remove };
}
