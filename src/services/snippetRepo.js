import { supabase } from '../lib/supabaseClient';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);

/**
 * Snippets store one rhythmic fragment per row. The current in-memory shape
 * carries both anak + indung tracks (and gong), so we serialise the whole
 * thing into the `content` JSONB column and keep `track_id` as 'both' for
 * forward compatibility (a future per-track snippet would set this to
 * 'anak' or 'indung').
 */

function flattenSnippet(snippet) {
  return {
    name: snippet?.name ?? 'Untitled',
    folder: snippet?.folder ?? 'Algemeen',
    track_id: 'both',
    content: snippet?.data ?? {},
  };
}

function rehydrateSnippet(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    folder: row.folder ?? 'Algemeen',
    data: row.content ?? {},
  };
}

export async function listSnippets() {
  const { data, error } = await supabase
    .from('snippets')
    .select('id, name, folder, track_id, content')
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rehydrateSnippet);
}

export async function saveSnippet(snippet) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const payload = { ...flattenSnippet(snippet), user_id: user.id };

  if (isUuid(snippet?.id)) {
    // Update existing row.
    const { data, error } = await supabase
      .from('snippets')
      .update(payload)
      .eq('id', snippet.id)
      .select()
      .single();
    if (error) throw error;
    return rehydrateSnippet(data);
  }

  // Insert new row (let Postgres assign uuid).
  const { data, error } = await supabase
    .from('snippets')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return rehydrateSnippet(data);
}

export async function deleteSnippet(snippetId) {
  const { error } = await supabase.from('snippets').delete().eq('id', snippetId);
  if (error) throw error;
}
