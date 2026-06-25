/**
 * EditionContext — stelt de huidige editie + capabilities beschikbaar via React.
 *
 * Gebruik in een component:
 *   const { canEdit, unlockFull } = useEdition();
 *
 * `unlockFull()` is nu de dev-/test-ontgrendeling; straks koppel je hier de
 * StoreKit in-app aankoopflow aan (na een geslaagde aankoop → unlockFull()).
 */

import { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { resolveEdition, persistEdition, capsFor } from './entitlements.js';

const EditionContext = createContext(null);

export function EditionProvider({ children }) {
  const [edition, setEditionState] = useState(resolveEdition);

  const setEdition = useCallback((next) => {
    persistEdition(next);
    setEditionState(next);
  }, []);

  const value = useMemo(() => ({
    ...capsFor(edition),
    setEdition,
    unlockFull: () => setEdition('full'),     // ← haak hier later StoreKit aan
    lockToPerformance: () => setEdition('performance'),
  }), [edition, setEdition]);

  return <EditionContext.Provider value={value}>{children}</EditionContext.Provider>;
}

export function useEdition() {
  const ctx = useContext(EditionContext);
  if (!ctx) throw new Error('useEdition moet binnen <EditionProvider> gebruikt worden');
  return ctx;
}
