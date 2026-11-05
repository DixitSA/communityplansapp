import { isBackendConfigured } from '@/lib/env';

import { useMyProfile } from '../profile/useMyProfile';
import { useOnboardingDraft } from '../onboarding/draftStore';
import { useSession } from './AuthProvider';
import { resolveGate, type Gate } from './gate';

/** The current routing gate, from the live session and profile. See `resolveGate`. */
export function useGate(): { gate: Gate; profile: ReturnType<typeof useMyProfile> } {
  const session = useSession();
  const profile = useMyProfile();
  const completionPending = useOnboardingDraft((s) => s.completionPending);
  return { gate: resolveGate({ configured: isBackendConfigured, dev: __DEV__, session, profile: profile.data, completionPending }), profile };
}
