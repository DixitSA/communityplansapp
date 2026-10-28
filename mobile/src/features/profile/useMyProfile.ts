import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { isBackendConfigured } from '@/lib/env';

import { useSession } from '../auth/AuthProvider';

export const MY_PROFILE_KEY = 'my-profile';

/**
 * The viewer's own profile. TanStack Query keeps it cached and refetches when we ask
 * (`invalidateQueries`). `data` is `null` when the person has not finished onboarding.
 * Demo mode returns a sample profile.
 */
export function useMyProfile() {
  const session = useSession();
  const userId = session?.userId ?? 'demo';
  return useQuery({
    queryKey: [MY_PROFILE_KEY, userId],
    queryFn: () => api.getMyProfile(),
    enabled: isBackendConfigured ? Boolean(session) : true,
  });
}
