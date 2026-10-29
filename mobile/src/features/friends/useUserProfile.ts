import { useQuery } from '@tanstack/react-query';

import { api, type UserProfile } from '@/lib/api';

import { friendKeys } from './friendsCache';

/** Another person's page. `data` is null when they don't exist or you can't see them (blocked looks the same). */
export function useUserProfile(id: string) {
  return useQuery<UserProfile | null>({
    queryKey: friendKeys.profile(id),
    queryFn: () => api.getUserProfile(id),
    staleTime: 30_000,
  });
}
