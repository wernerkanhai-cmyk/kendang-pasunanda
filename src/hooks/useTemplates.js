import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  listTemplates, publishTemplate as publishTemplateRpc, deleteTemplate as deleteTemplateRpc,
  listSnippetTemplates, publishSnippetTemplate as publishSnippetRpc, deleteSnippetTemplate as deleteSnippetRpc,
} from '../services/templateRepo';

export function useTemplates() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [snippetTemplates, setSnippetTemplates] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!user) { setTemplates([]); setSnippetTemplates([]); return; }
    setLoading(true);
    Promise.all([listTemplates(), listSnippetTemplates()])
      .then(([songs, snips]) => { if (alive) { setTemplates(songs); setSnippetTemplates(snips); } })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [user]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [songs, snips] = await Promise.all([listTemplates(), listSnippetTemplates()]);
      setTemplates(songs);
      setSnippetTemplates(snips);
    } finally { setLoading(false); }
  }, []);

  const publishSong = useCallback(async (song) => {
    await publishTemplateRpc(song);
    await refresh();
  }, [refresh]);

  const removeSong = useCallback(async (id) => {
    await deleteTemplateRpc(id);
    setTemplates(prev => prev.filter(t => t.id !== id));
  }, []);

  const publishSnippet = useCallback(async (snippet) => {
    await publishSnippetRpc(snippet);
    await refresh();
  }, [refresh]);

  const removeSnippet = useCallback(async (id) => {
    await deleteSnippetRpc(id);
    setSnippetTemplates(prev => prev.filter(t => t.id !== id));
  }, []);

  return {
    templates, snippetTemplates, loading, refresh,
    publishSong, removeSong,
    publishSnippet, removeSnippet,
  };
}
