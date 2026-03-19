import { useState } from 'react';

const STORAGE_KEY = 'kendangAuth';

export default function LoginGate({ children }) {
  const [authed, setAuthed] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) === 'yes';
  });
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);

  if (authed) return children;

  const handleSubmit = (e) => {
    e.preventDefault();
    const pw = import.meta.env.VITE_APP_PASSWORD;
    if (pw && input === pw) {
      localStorage.setItem(STORAGE_KEY, 'yes');
      setAuthed(true);
    } else {
      setError(true);
      setInput('');
    }
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100dvh', background: '#0f172a'
    }}>
      <form onSubmit={handleSubmit} style={{
        display: 'flex', flexDirection: 'column', gap: '1rem',
        background: '#1e293b', border: '1px solid #334155',
        borderRadius: '8px', padding: '2rem', minWidth: '260px'
      }}>
        <div style={{ color: '#e2e8f0', fontWeight: 'bold', fontSize: '1.1rem', textAlign: 'center' }}>
          Kendang Pasunanda
        </div>
        <div style={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center' }}>
          Voer het toegangswachtwoord in
        </div>
        <input
          type="password"
          value={input}
          autoFocus
          onChange={e => { setInput(e.target.value); setError(false); }}
          placeholder="Wachtwoord"
          style={{
            background: '#0f172a', border: `1px solid ${error ? '#ef4444' : '#475569'}`,
            borderRadius: '4px', color: '#e2e8f0', padding: '0.5rem 0.75rem',
            fontSize: '1rem', outline: 'none'
          }}
        />
        {error && (
          <div style={{ color: '#ef4444', fontSize: '0.8rem', textAlign: 'center' }}>
            Wachtwoord onjuist
          </div>
        )}
        <button type="submit" style={{
          background: '#1d4ed8', color: '#fff', border: 'none',
          borderRadius: '4px', padding: '0.5rem', fontSize: '1rem',
          cursor: 'pointer', fontWeight: 'bold'
        }}>
          Inloggen
        </button>
      </form>
    </div>
  );
}
