import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSongs } from '../hooks/useSongs';

const STORAGE_KEY = 'kendangSavedSongs';
const FLAG_DONE = 'kendangMigrationDone';
const FLAG_DECLINED = 'kendangMigrationDeclined';
const FLAG_KEEP_LOCAL = 'kendangMigrationKeepLocal';

/**
 * One-time migration dialog. When a signed-in user still has legacy songs in
 * localStorage that haven't been uploaded yet, ask them to upload to the
 * cloud. The dialog can be skipped once or dismissed permanently.
 */
export default function MigrationDialog() {
  const { user } = useAuth();
  const { songs: cloudSongs, save: cloudSave, refresh } = useSongs();
  const [localSongs, setLocalSongs] = useState([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!user) { setOpen(false); return; }
    if (localStorage.getItem(FLAG_DECLINED) === 'yes') return;
    if (localStorage.getItem(FLAG_KEEP_LOCAL) === 'yes') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) return;
      setLocalSongs(parsed);
      // If a previous session already uploaded but never cleaned up, jump
      // straight to the cleanup screen instead of asking to upload again.
      if (localStorage.getItem(FLAG_DONE) === 'yes') {
        setSuccess(true);
        setProgress({ done: parsed.length, total: parsed.length });
      }
      setOpen(true);
    } catch (e) {
      // Corrupt blob — nothing to migrate
      // eslint-disable-next-line no-console
      console.warn('Could not read legacy songs:', e);
    }
  }, [user]);

  const handleUpload = async () => {
    setBusy(true);
    setError('');
    setProgress({ done: 0, total: localSongs.length });
    const cloudTitles = new Set(cloudSongs.map(s => s.name));
    let uploaded = 0;
    try {
      for (const s of localSongs) {
        // Skip songs whose name already exists in the cloud (assume same content).
        if (cloudTitles.has(s.name)) {
          uploaded++;
          setProgress({ done: uploaded, total: localSongs.length });
          continue;
        }
        await cloudSave({
          id: null, // force new uuid
          name: s.name,
          folder: s.folder || 'Algemeen',
          bpm: s.bpm ?? 100,
          patterns: s.patterns ?? [],
        });
        uploaded++;
        setProgress({ done: uploaded, total: localSongs.length });
      }
      await refresh();
      localStorage.setItem(FLAG_DONE, 'yes');
      setSuccess(true);
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleCleanupLocal = () => {
    if (!confirm('Lokale kopieën nu definitief verwijderen?')) return;
    localStorage.removeItem(STORAGE_KEY);
    setOpen(false);
  };

  const handleSkip = () => setOpen(false);

  const handleDecline = () => {
    if (!confirm('Weet je het zeker? Dit dialoogvenster komt dan niet meer terug.')) return;
    localStorage.setItem(FLAG_DECLINED, 'yes');
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div style={overlay}>
      <div style={dialog}>
        <div style={title}>☁ Songs migreren naar je account</div>

        {!success ? (
          <>
            <div style={body}>
              Je hebt <strong>{localSongs.length}</strong> song{localSongs.length === 1 ? '' : 's'} in
              dit apparaat staan vanuit een eerdere versie van Kendang Pasunanda.
              Wil je deze nu uploaden naar je account zodat ze beschikbaar zijn op al je apparaten?
            </div>

            {busy && (
              <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                Bezig met uploaden… {progress.done} / {progress.total}
              </div>
            )}
            {error && (
              <div style={{ color: '#ef4444', fontSize: '0.8rem' }}>{error}</div>
            )}

            <div style={buttonRow}>
              <button onClick={handleUpload} disabled={busy} style={primaryBtn}>
                Upload allemaal
              </button>
              <button onClick={handleSkip} disabled={busy} style={secondaryBtn}>
                Niet nu
              </button>
              <button onClick={handleDecline} disabled={busy} style={dangerBtn}>
                Negeer voorgoed
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={body}>
              ✅ Klaar! <strong>{progress.done}</strong> song{progress.done === 1 ? '' : 's'} staan
              nu in de cloud. Je kunt de lokale kopieën nu verwijderen, of nog even bewaren als backup.
            </div>
            <div style={buttonRow}>
              <button onClick={handleCleanupLocal} style={primaryBtn}>
                Verwijder lokale kopieën
              </button>
              <button
                onClick={() => { localStorage.setItem(FLAG_KEEP_LOCAL, 'yes'); setOpen(false); }}
                style={secondaryBtn}
              >
                Bewaar lokale kopieën
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const overlay = {
  position: 'fixed', inset: 0, zIndex: 9500,
  background: 'rgba(0,0,0,0.7)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '1rem',
};
const dialog = {
  background: '#1e293b', border: '1px solid #fbbf24', borderRadius: '12px',
  padding: '1.5rem', maxWidth: '460px', width: '100%',
  display: 'flex', flexDirection: 'column', gap: '1rem',
  boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
  fontFamily: 'system-ui, sans-serif',
};
const title = { color: '#fbbf24', fontSize: '1.05rem', fontWeight: 'bold' };
const body = { color: '#e2e8f0', fontSize: '0.9rem', lineHeight: 1.6 };
const buttonRow = { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' };
const baseBtn = {
  border: 'none', borderRadius: '6px', padding: '0.55rem 0.9rem',
  fontSize: '0.85rem', cursor: 'pointer', fontWeight: 'bold',
};
const primaryBtn = { ...baseBtn, background: '#1d4ed8', color: '#fff', flex: '1 1 auto' };
const secondaryBtn = { ...baseBtn, background: '#334155', color: '#e2e8f0' };
const dangerBtn = { ...baseBtn, background: 'transparent', color: '#94a3b8', fontWeight: 'normal', textDecoration: 'underline' };
