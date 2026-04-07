import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSongs } from '../hooks/useSongs';

/**
 * TEMPORARY test panel — will be removed once cloud sync is wired into the
 * real save buttons. Lets you save the current song to Supabase and see what
 * is in the cloud.
 */
export default function CloudTestPanel({ song, songName, songFolder, bpm }) {
  const { user, signOut } = useAuth();
  const { songs, loading, error, refresh, save, remove } = useSongs();
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState('');

  if (!user) return null;

  const handleSave = async () => {
    setBusy(true);
    setLastResult('');
    try {
      const fresh = await save({
        // No id → insert new each time. We'll wire up "update existing" later.
        name: songName || 'Test song',
        folder: songFolder || 'Algemeen',
        bpm,
        patterns: song,
      });
      setLastResult(`✅ Opgeslagen als ${fresh.id}`);
    } catch (err) {
      setLastResult(`❌ ${err.message ?? err}`);
    } finally {
      setBusy(false);
    }
  };

  const handleRefresh = async () => {
    setBusy(true);
    setLastResult('');
    try {
      await refresh();
      setLastResult('✅ Lijst ververst');
    } catch (err) {
      setLastResult(`❌ ${err.message ?? err}`);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Verwijderen?')) return;
    try { await remove(id); } catch (err) { alert(err.message ?? err); }
  };

  return (
    <div style={panel}>
      <div style={header}>
        <strong style={{ color: '#fbbf24' }}>☁ Cloud test panel (tijdelijk)</strong>
        <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{user.email}</span>
        <button onClick={signOut} style={smallBtn}>Log uit</button>
      </div>

      <div style={row}>
        <button onClick={handleSave} disabled={busy} style={btn}>
          💾 Sla huidige song op naar cloud
        </button>
        <button onClick={handleRefresh} disabled={busy} style={btn}>
          🔄 Ververs cloudlijst
        </button>
      </div>

      {lastResult && <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{lastResult}</div>}
      {loading && <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Laden…</div>}
      {error && <div style={{ color: '#ef4444', fontSize: '0.8rem' }}>{error.message ?? String(error)}</div>}

      <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.5rem' }}>
        {songs.length} song(s) in cloud:
      </div>
      <ul style={list}>
        {songs.map((s) => (
          <li key={s.id} style={listItem}>
            <span style={{ color: '#e2e8f0', fontSize: '0.8rem' }}>
              {s.name} <span style={{ color: '#64748b' }}>({s.patterns?.length ?? 0} patterns)</span>
            </span>
            <button onClick={() => handleDelete(s.id)} style={deleteBtn}>🗑</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const panel = {
  position: 'fixed', bottom: 12, right: 12, zIndex: 9000,
  background: 'rgba(30,41,59,0.95)', border: '1px solid #fbbf24',
  borderRadius: '8px', padding: '0.75rem', minWidth: '280px', maxWidth: '320px',
  boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
  display: 'flex', flexDirection: 'column', gap: '0.5rem',
  fontFamily: 'system-ui, sans-serif',
};
const header = { display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between' };
const row = { display: 'flex', gap: '0.4rem', flexWrap: 'wrap' };
const btn = {
  background: '#1d4ed8', color: '#fff', border: 'none',
  borderRadius: '4px', padding: '0.4rem 0.6rem', fontSize: '0.8rem',
  cursor: 'pointer', flex: 1,
};
const smallBtn = {
  background: 'transparent', color: '#94a3b8', border: '1px solid #475569',
  borderRadius: '4px', padding: '0.2rem 0.5rem', fontSize: '0.7rem', cursor: 'pointer',
};
const list = { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.2rem', maxHeight: '180px', overflowY: 'auto' };
const listItem = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.2rem 0.3rem', background: 'rgba(0,0,0,0.2)', borderRadius: '3px' };
const deleteBtn = { background: 'transparent', color: '#ef4444', border: 'none', cursor: 'pointer', fontSize: '0.9rem' };
