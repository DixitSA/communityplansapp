import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api, type EditProfileInput } from '@/lib/api';

import { MY_PROFILE_KEY } from './useMyProfile';

/**
 * Saves edits to the viewer's own profile. A TanStack Query "mutation" is a write: it tracks
 * pending/error state for us, and on success we mark the cached profile stale so it refetches.
 */
export function useUpdateMyProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EditProfileInput) => api.updateMyProfile(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [MY_PROFILE_KEY] }),
  });
}
