import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { usernameProblem } from '@/lib/validation';

export const USERNAME_DEBOUNCE_MS = 400;

export type UsernameStatus =
  | { kind: 'idle' }
  | { kind: 'invalid'; message: string }
  | { kind: 'checking' }
  | { kind: 'available' }
  | { kind: 'taken' }
  | { kind: 'error' };

/**
 * Pure rule for what the field shows. Local format problems win without a round trip, then we wait
 * for typing to settle (`username` differs from `settled`) before showing a server answer.
 */
export function deriveUsernameStatus({
  username,
  settled,
  query,
}: {
  username: string;
  settled: string;
  query: { isFetching: boolean; isError: boolean; data: boolean | undefined };
}): UsernameStatus {
  if (username.length === 0) return { kind: 'idle' };
  const problem = usernameProblem(username);
  if (problem) return { kind: 'invalid', message: problem };
  if (username !== settled || query.isFetching) return { kind: 'checking' };
  if (query.isError) return { kind: 'error' };
  if (query.data === undefined) return { kind: 'checking' };
  return query.data ? { kind: 'available' } : { kind: 'taken' };
}

/** Live availability for a normalized username, checked 400 ms after the last keystroke. */
export function useUsernameAvailability(username: string): UsernameStatus {
  const settled = useDebouncedValue(username, USERNAME_DEBOUNCE_MS);
  const query = useQuery({
    queryKey: ['username-available', settled],
    queryFn: () => api.usernameAvailable(settled),
    enabled: settled.length > 0 && usernameProblem(settled) === null,
    staleTime: 30_000,
    retry: false,
  });
  return deriveUsernameStatus({
    username,
    settled,
    query: { isFetching: query.isFetching, isError: query.isError, data: query.data },
  });
}
