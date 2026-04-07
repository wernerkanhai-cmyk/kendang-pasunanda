import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { listSnippets, saveSnippet as saveSnippetRpc, deleteSnippet as deleteSnippetRpc } from '../services/snippetRepo';

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
      .then((rows) => { if (alive) setSnippets(rows); })
      .catch((err) => { if (alive) setError(err); })
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
      return fresh;
    } catch (err) {
      setError(err);
      throw err;
    }
  }, []);

  const remove = useCallback(async (snippetId) => {
    setError(null);
    const prevState = snippets;
    setSnippets((prev) => prev.filter((s) => s.id !== snippetId));
    try {
      await deleteSnippetRpc(snippetId);
    } catch (err) {
      setSnippets(prevState);
      setError(err);
      throw err;
    }
  }, [snippets]);

  return { snippets, loading, error, refresh, save, remove };
}
