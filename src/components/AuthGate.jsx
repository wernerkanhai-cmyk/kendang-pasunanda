import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function AuthGate({ children }) {
  const { user, loading, recoveryMode, signIn, signUp, resetPassword, setNewPassword } = useAuth();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup' | 'forgot'
  const [recoveryPw, setRecoveryPw] = useState('');
  const [recoveryPw2, setRecoveryPw2] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading) {
    return (
      <div style={fullScreen}>
        <div style={{ color: '#94a3b8' }}>Laden…</div>
      </div>
    );
  }

  if (recoveryMode) {
    const handleRecoverySubmit = async (e) => {
      e.preventDefault();
      setError('');
      setInfo('');
      if (recoveryPw.length < 6) { setError('Wachtwoord moet minimaal 6 tekens zijn'); return; }
      if (recoveryPw !== recoveryPw2) { setError('De wachtwoorden komen niet overeen'); return; }
      setBusy(true);
      try {
        const { error: err } = await setNewPassword(recoveryPw);
        if (err) throw err;
        setInfo('Wachtwoord opgeslagen. Je bent nu ingelogd.');
        setRecoveryPw('');
        setRecoveryPw2('');
      } catch (err) {
        setError(err?.message ?? 'Er ging iets mis');
      } finally {
        setBusy(false);
      }
    };
    return (
      <div style={fullScreen}>
        <form onSubmit={handleRecoverySubmit} style={form}>
          <div style={title}>Stel een nieuw wachtwoord in</div>
          <div style={subtitle}>Voer hieronder je nieuwe wachtwoord in om je account te herstellen.</div>
          <input type="password" autoComplete="new-password" placeholder="Nieuw wachtwoord" value={recoveryPw} onChange={(e) => setRecoveryPw(e.target.value)} required minLength={6} style={input} autoFocus />
          <input type="password" autoComplete="new-password" placeholder="Herhaal nieuw wachtwoord" value={recoveryPw2} onChange={(e) => setRecoveryPw2(e.target.value)} required minLength={6} style={input} />
          {error && <div style={errorBox}>{error}</div>}
          {info && <div style={infoBox}>{info}</div>}
          <button type="submit" disabled={busy} style={submitBtn}>{busy ? '…' : 'Wachtwoord opslaan'}</button>
        </form>
      </div>
    );
  }

  if (user) return children;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setBusy(true);
    try {
      if (mode === 'signin') {
        const { error: err } = await signIn(email.trim(), password);
        if (err) throw err;
      } else if (mode === 'signup') {
        const { error: err } = await signUp(email.trim(), password);
        if (err) throw err;
        setInfo('Account aangemaakt. Controleer je e-mail om te bevestigen.');
      } else if (mode === 'forgot') {
        const { error: err } = await resetPassword(email.trim());
        if (err) throw err;
        setInfo('Reset-link verstuurd. Controleer je e-mail.');
      }
    } catch (err) {
      setError(err?.message ?? 'Er ging iets mis');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={fullScreen}>
      <form onSubmit={handleSubmit} style={form}>
        <div style={title}>Kendang Pasunanda</div>
        <div style={subtitle}>
          {mode === 'signin' && 'Log in op je account'}
          {mode === 'signup' && 'Maak een nieuw account aan'}
          {mode === 'forgot' && 'Wachtwoord vergeten — vul je e-mail in'}
        </div>

        <input
          type="email"
          autoComplete="email"
          placeholder="E-mailadres"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={input}
        />
        {mode !== 'forgot' && (
          <input
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            placeholder="Wachtwoord"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={input}
          />
        )}

        {error && <div style={errorBox}>{error}</div>}
        {info && <div style={infoBox}>{info}</div>}

        <button type="submit" disabled={busy} style={submitBtn}>
          {busy ? '…' : mode === 'signin' ? 'Inloggen' : mode === 'signup' ? 'Registreren' : 'Stuur reset-link'}
        </button>

        {mode !== 'forgot' && (
          <button
            type="button"
            onClick={() => { setMode(m => m === 'signin' ? 'signup' : 'signin'); setError(''); setInfo(''); }}
            style={switchBtn}
          >
            {mode === 'signin' ? 'Nog geen account? Registreer' : 'Al een account? Log in'}
          </button>
        )}
        {mode === 'signin' && (
          <button
            type="button"
            onClick={() => { setMode('forgot'); setError(''); setInfo(''); }}
            style={switchBtn}
          >
            Wachtwoord vergeten?
          </button>
        )}
        {mode === 'forgot' && (
          <button
            type="button"
            onClick={() => { setMode('signin'); setError(''); setInfo(''); }}
            style={switchBtn}
          >
            Terug naar inloggen
          </button>
        )}
      </form>
    </div>
  );
}

const fullScreen = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  height: '100dvh', background: '#0f172a',
};
const form = {
  display: 'flex', flexDirection: 'column', gap: '0.75rem',
  background: '#1e293b', border: '1px solid #334155',
  borderRadius: '8px', padding: '2rem', minWidth: '280px',
};
const title = { color: '#e2e8f0', fontWeight: 'bold', fontSize: '1.1rem', textAlign: 'center' };
const subtitle = { color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', marginBottom: '0.5rem' };
const input = {
  background: '#0f172a', border: '1px solid #475569',
  borderRadius: '4px', color: '#e2e8f0', padding: '0.5rem 0.75rem',
  fontSize: '1rem', outline: 'none',
};
const errorBox = { color: '#ef4444', fontSize: '0.8rem', textAlign: 'center' };
const infoBox = { color: '#22c55e', fontSize: '0.8rem', textAlign: 'center' };
const submitBtn = {
  background: '#1d4ed8', color: '#fff', border: 'none',
  borderRadius: '4px', padding: '0.6rem', fontSize: '1rem',
  cursor: 'pointer', fontWeight: 'bold',
};
const switchBtn = {
  background: 'transparent', color: '#94a3b8', border: 'none',
  fontSize: '0.8rem', cursor: 'pointer', padding: '0.25rem',
};
