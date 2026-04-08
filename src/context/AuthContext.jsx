import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  // True between PASSWORD_RECOVERY event and a successful updateUser({ password }).
  // While true the AuthGate forces the user to pick a new password before reaching the app.
  const [recoveryMode, setRecoveryMode] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession ?? null);
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const value = {
    session,
    user: session?.user ?? null,
    loading,
    recoveryMode,
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signUp: (email, password) => supabase.auth.signUp({ email, password }),
    signOut: () => supabase.auth.signOut(),
    resetPassword: (email) => supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    }),
    setNewPassword: async (newPassword) => {
      const result = await supabase.auth.updateUser({ password: newPassword });
      if (!result.error) setRecoveryMode(false);
      return result;
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
