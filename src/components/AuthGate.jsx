import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function AuthGate({ children }) {
  const { user, loading, signIn, signUp } = useAuth();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
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
      } else {
        const { error: err } = await signUp(email.trim(), password);
        if (err) throw err;
        setInfo('Account aangemaakt. Controleer je e-mail om te bevestigen.');
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
          {mode === 'signin' ? 'Log in op je account' : 'Maak een nieuw account aan'}
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

        {error && <div style={errorBox}>{error}</div>}
        {info && <div style={infoBox}>{info}</div>}

        <button type="submit" disabled={busy} style={submitBtn}>
          {busy ? '…' : mode === 'signin' ? 'Inloggen' : 'Registreren'}
        </button>

        <button
          type="button"
          onClick={() => { setMode(m => m === 'signin' ? 'signup' : 'signin'); setError(''); setInfo(''); }}
          style={switchBtn}
        >
          {mode === 'signin' ? 'Nog geen account? Registreer' : 'Al een account? Log in'}
        </button>
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
