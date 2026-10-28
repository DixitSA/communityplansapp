import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { api, type AuthSession } from '@/lib/api';
import { isBackendConfigured } from '@/lib/env';

import { useOnboardingDraft } from '../onboarding/draftStore';

/** `undefined` while the saved session is being read, `null` when signed out. */
const SessionContext = createContext<AuthSession | null | undefined>(undefined);

/**
 * Keeps the signed-in session in React state. Supabase tells us about sign-in, sign-out and token
 * refreshes through `onAuthStateChange`; this component turns that into context for the whole app.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<AuthSession | null | undefined>(isBackendConfigured ? undefined : null);

  useEffect(() => {
    if (!isBackendConfigured) return;
    let active = true;
    api
      .getSession()
      .then((s) => active && setSession((prev) => (prev === undefined ? s : prev)))
      .catch(() => active && setSession((prev) => (prev === undefined ? null : prev)));
    const unsubscribe = api.onSessionChange((s) => {
      setSession(s);
      if (!s) {
        // Signed out: forget everything that belonged to the last person.
        queryClient.clear();
        useOnboardingDraft.getState().reset();
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [queryClient]);

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession(): AuthSession | null | undefined {
  return useContext(SessionContext);
}
