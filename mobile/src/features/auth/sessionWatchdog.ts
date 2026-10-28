import type { AuthSession } from '@/lib/api';

export const SESSION_READ_TIMEOUT_MS = 8_000;

/**
 * Reads the saved session, but gives up after `ms` and answers "signed out" so the person reaches
 * the sign-in screen instead of an endless loading screen. A late real answer still arrives
 * through the auth listener.
 */
export function readSessionWithWatchdog(
  getSession: () => Promise<AuthSession | null>,
  ms: number = SESSION_READ_TIMEOUT_MS,
): Promise<AuthSession | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      console.warn('[yard] session read timed out');
      resolve(null);
    }, ms);
    getSession().then(
      (s) => {
        clearTimeout(timer);
        resolve(s);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}
