import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { api, type AuthSession } from '@/lib/api';
import { devLog } from '@/lib/devLog';
import { backendHost, isBackendConfigured } from '@/lib/env';

import { useOnboardingDraft } from '../onboarding/draftStore';
import { readSessionWithWatchdog } from './sessionWatchdog';

/** `undefined` while the saved session is being read, `null` when signed out. */
const SessionContext = createContext<AuthSession | null | undefined>(undefined);
const RetryContext = createContext<() => void>(() => {});

/**
 * Keeps the signed-in session in React state. Supabase tells us about sign-in, sign-out and token
 * refreshes through `onAuthStateChange`; this component turns that into context for the whole app.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<AuthSession | null | undefined>(isBackendConfigured ? undefined : null);

  // Reads the saved session. If nothing answers in 8 s the person is treated as signed out.
  const readSession = useCallback(() => {
    devLog('session read start');
    return readSessionWithWatchdog(() => api.getSession()).then((s) => {
      devLog('session read end:', s ? 'signed in' : 'no session');
      setSession((prev) => (prev === undefined ? s : prev));
    });
  }, []);

  useEffect(() => {
    devLog(isBackendConfigured ? `backend configured (${backendHost()})` : 'backend not configured (demo mode)');
    if (!isBackendConfigured) return;
    void readSession();
    const unsubscribe = api.onSessionChange((s) => {
      setSession(s);
      if (!s) {
        // Signed out: forget everything that belonged to the last person.
        queryClient.clear();
        useOnboardingDraft.getState().reset();
      }
    });
    return unsubscribe;
  }, [queryClient, readSession]);

  // The loading screen's Retry: read the session again if it never arrived.
  const retry = useCallback(() => {
    void readSession();
  }, [readSession]);

  return (
    <RetryContext.Provider value={retry}>
      <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
    </RetryContext.Provider>
  );
}

export function useSession(): AuthSession | null | undefined {
  return useContext(SessionContext);
}

/** Re-reads the saved session. Used by the loading screen's Retry button. */
export function useRetrySession(): () => void {
  return useContext(RetryContext);
}
