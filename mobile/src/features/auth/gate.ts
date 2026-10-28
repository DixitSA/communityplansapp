import type { AuthSession, MyProfile } from '@/lib/api';

/**
 * Which part of the app the viewer may be in.
 * - `demo`: no backend configured, everything is reachable (sample data, screenshots).
 * - `loading`: still reading the saved session or the profile.
 * - `auth`: signed out. `onboarding`: signed in but no profile yet. `app`: the real app.
 */
export type Gate = 'demo' | 'loading' | 'auth' | 'onboarding' | 'app';
export type RouteGroup = 'auth' | 'onboarding' | 'app';

/**
 * `session` and `profile` are `undefined` while still loading and `null` once we know there is none.
 * Pure, so the whole routing rule is unit tested.
 */
export function resolveGate({
  configured,
  session,
  profile,
}: {
  configured: boolean;
  session: AuthSession | null | undefined;
  profile: MyProfile | null | undefined;
}): Gate {
  if (!configured) return 'demo';
  if (session === undefined) return 'loading';
  if (session === null) return 'auth';
  if (profile === undefined) return 'loading';
  if (profile === null) return 'onboarding';
  return 'app';
}

/** Whether a route group is reachable in this gate (the `guard` of each `Stack.Protected`). */
export function gateAllows(gate: Gate, group: RouteGroup): boolean {
  if (gate === 'demo') return true;
  return gate === group;
}
