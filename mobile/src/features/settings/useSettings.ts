import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, type BlockedPerson } from '@/lib/api';

import { useSession } from '../auth/AuthProvider';
import { withoutBlocked } from './blockedList';

const DISCOVERABLE_KEY = 'discoverable-by-phone';
const BLOCKED_KEY = 'blocked-users';

/** "Let people find me by phone number": the saved choice. TanStack Query caches it between visits. */
export function useDiscoverableByPhone() {
  const userId = useSession()?.userId ?? 'demo';
  const qc = useQueryClient();
  const key = [DISCOVERABLE_KEY, userId];
  const query = useQuery({ queryKey: key, queryFn: () => api.getDiscoverableByPhone() });
  const mutation = useMutation({
    mutationFn: (value: boolean) => api.setDiscoverableByPhone(value),
    // Flip the switch right away; put it back if saving fails.
    onMutate: async (value) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<boolean>(key);
      qc.setQueryData(key, value);
      return { previous };
    },
    onError: (_err, _value, ctx) => qc.setQueryData(key, ctx?.previous),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
  return { value: query.data, isLoading: query.isLoading, set: mutation.mutate, error: mutation.isError };
}

export function useBlockedUsers() {
  const userId = useSession()?.userId ?? 'demo';
  return useQuery({ queryKey: [BLOCKED_KEY, userId], queryFn: () => api.listBlockedUsers() });
}

export function useUnblock() {
  const userId = useSession()?.userId ?? 'demo';
  const qc = useQueryClient();
  const key = [BLOCKED_KEY, userId];
  return useMutation({
    mutationFn: (id: string) => api.unblockUser(id),
    onSuccess: (_data, id) => {
      qc.setQueryData<BlockedPerson[]>(key, (list) => (list ? withoutBlocked(list, id) : list));
      // People you unblocked can show up in search, friends and feeds again.
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ['friends'] });
    },
  });
}

/** Deletes the account on the server; the auth listener then sends the app back to the welcome screen. */
export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.deleteAccount(),
    onSuccess: () => qc.clear(),
  });
}
