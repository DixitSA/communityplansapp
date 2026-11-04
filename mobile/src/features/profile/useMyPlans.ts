import { useQuery } from '@tanstack/react-query';

import { usePlansStore } from '@/features/event/plansStore';
import { api } from '@/lib/api';
import { isBackendConfigured } from '@/lib/env';

import { useSession } from '../auth/AuthProvider';

/**
 * The viewer's own plans (Going, Down if friends go, Interested). It lives under the 'feed' key,
 * so every RSVP change (which refreshes 'feed') refreshes it too. In demo mode the plans live in the
 * local store, so its contents are part of the key and a change refetches.
 */
export function useMyPlans() {
  const session = useSession();
  const statuses = usePlansStore((s) => s.statuses);
  return useQuery({
    queryKey: ['feed', 'my-plans', session?.userId ?? 'demo', isBackendConfigured ? null : statuses],
    queryFn: () => api.getMyPlans(),
    enabled: isBackendConfigured ? Boolean(session) : true,
  });
}
