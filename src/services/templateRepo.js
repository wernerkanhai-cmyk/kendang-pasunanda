import { supabase } from '../lib/supabaseClient';
import { sanitizePattern, migrateSlotArray } from '../engine/patternLogic';

const migrateSnippetData = (data) => {
  if (!data) return data;
  if (Array.isArray(data)) return migrateSlotArray(data);
  return {
    ...data,
    ...(Array.isArray(data.anak)   ? { anak:   migrateSlotArray(data.anak)   } : {}),
    ...(Array.isArray(data.indung) ? { indung: migrateSlotArray(data.indung) } : {}),
  };
};

/**
 * Song templates — stored in the `templates` table, readable by all
 * signed-in users, writable only by the author (admin).
 *
 * Each template stores the full patterns array in the `content` JSONB
 * column, so no joins with patterns/song_lines/measures are needed.
 */

export async function listTemplates() {
  const { data, error } = await supabase
    .from('templates')
    .select('id, name, category, bpm, content, created_at, updated_at')
    .order('category', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(row => ({
    id: row.id,
    name: row.name,
    category: row.category || 'Algemeen',
    bpm: row.bpm ?? 100,
    // Migreer legacy glyph-patronen naar het soundId-formaat van stap 4.
    patterns: Array.isArray(row.content) ? row.content.map(sanitizePattern) : [],
    created_at: row.created_at,
  }));
}

export async function publishTemplate(song) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await supabase
    .from('templates')
    .insert({
      author_id: user.id,
      name: song.name || 'Untitled',
      category: song.folder || song.category || 'Algemeen',
      bpm: song.bpm ?? 100,
      content: song.patterns ?? [],
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTemplate(id) {
  const { error } = await supabase.from('templates').delete().eq('id', id);
  if (error) throw error;
}

// ── Snippet templates ──────────────────────────────────────────────────

export async function listSnippetTemplates() {
  const { data, error } = await supabase
    .from('snippet_templates')
    .select('id, name, category, content, created_at, updated_at')
    .order('category', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(row => ({
    id: row.id,
    name: row.name,
    category: row.category || 'Algemeen',
    data: migrateSnippetData(row.content ?? {}),
    created_at: row.created_at,
  }));
}

export async function publishSnippetTemplate(snippet) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await supabase
    .from('snippet_templates')
    .insert({
      author_id: user.id,
      name: snippet.name || 'Untitled',
      category: snippet.folder || snippet.category || 'Algemeen',
      content: snippet.data ?? {},
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSnippetTemplate(id) {
  const { error } = await supabase.from('snippet_templates').delete().eq('id', id);
  if (error) throw error;
}
