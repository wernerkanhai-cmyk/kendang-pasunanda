import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n';

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
  const t = useT();

  if (loading) {
    return (
      <div style={fullScreen}>
        <div style={{ color: '#94a3b8' }}>{t('authLoading')}</div>
      </div>
    );
  }

  if (recoveryMode) {
    const handleRecoverySubmit = async (e) => {
      e.preventDefault();
      setError('');
      setInfo('');
      if (recoveryPw.length < 6) { setError(t('pwMin6')); return; }
      if (recoveryPw !== recoveryPw2) { setError(t('pwMismatch')); return; }
      setBusy(true);
      try {
        const { error: err } = await setNewPassword(recoveryPw);
        if (err) throw err;
        setInfo(t('pwSavedLoggedIn'));
        setRecoveryPw('');
        setRecoveryPw2('');
      } catch (err) {
        setError(err?.message ?? t('somethingWrong'));
      } finally {
        setBusy(false);
      }
    };
    return (
      <div style={fullScreen}>
        <form onSubmit={handleRecoverySubmit} style={form}>
          <div style={title}>{t('recoveryTitle')}</div>
          <div style={subtitle}>{t('recoverySubtitle')}</div>
          <input type="password" autoComplete="new-password" placeholder={t('newPwPlaceholder')} value={recoveryPw} onChange={(e) => setRecoveryPw(e.target.value)} required minLength={6} style={input} autoFocus />
          <input type="password" autoComplete="new-password" placeholder={t('repeatPwPlaceholder')} value={recoveryPw2} onChange={(e) => setRecoveryPw2(e.target.value)} required minLength={6} style={input} />
          {error && <div style={errorBox}>{error}</div>}
          {info && <div style={infoBox}>{info}</div>}
          <button type="submit" disabled={busy} style={submitBtn}>{busy ? '…' : t('savePwBtn')}</button>
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
        setInfo(t('accountCreated'));
      } else if (mode === 'forgot') {
        const { error: err } = await resetPassword(email.trim());
        if (err) throw err;
        setInfo(t('resetLinkSent'));
      }
    } catch (err) {
      setError(err?.message ?? t('somethingWrong'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={fullScreen}>
      <form onSubmit={handleSubmit} style={form} autoComplete="on">
        <div style={title}>Kendang Pasunanda</div>
        <div style={subtitle}>
          {mode === 'signin' && t('signinSubtitle')}
          {mode === 'signup' && t('signupSubtitle')}
          {mode === 'forgot' && t('forgotSubtitle')}
        </div>

        <input
          type="email"
          name="username"
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
          placeholder={t('emailPlaceholder')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={input}
        />
        {mode !== 'forgot' && (
          <input
            type="password"
            name="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            placeholder={t('pwPlaceholder')}
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
          {busy ? '…' : mode === 'signin' ? t('signinBtn') : mode === 'signup' ? t('signupBtn') : t('sendResetBtn')}
        </button>

        {mode !== 'forgot' && (
          <button
            type="button"
            onClick={() => { setMode(m => m === 'signin' ? 'signup' : 'signin'); setError(''); setInfo(''); }}
            style={switchBtn}
          >
            {mode === 'signin' ? t('toSignup') : t('toSignin')}
          </button>
        )}
        {mode === 'signin' && (
          <button
            type="button"
            onClick={() => { setMode('forgot'); setError(''); setInfo(''); }}
            style={switchBtn}
          >
            {t('forgotPwBtn')}
          </button>
        )}
        {mode === 'forgot' && (
          <button
            type="button"
            onClick={() => { setMode('signin'); setError(''); setInfo(''); }}
            style={switchBtn}
          >
            {t('backToSignin')}
          </button>
        )}
        <div style={copyright}>{t('copyright')(new Date().getFullYear())}</div>
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
const copyright = {
  color: '#475569', fontSize: '0.65rem', textAlign: 'center',
  marginTop: '0.5rem', letterSpacing: '0.02em',
};
