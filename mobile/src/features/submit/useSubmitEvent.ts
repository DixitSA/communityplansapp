import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, errorCode, mapSubmissionError, type SubmitEventInput } from '@/lib/api';
import { isBackendConfigured } from '@/lib/env';

import { useSession } from '../auth/AuthProvider';

const SUBMISSIONS_KEY = 'my-submissions';

/**
 * Sends a suggestion. A mutation is TanStack Query's wrapper for "do something on the server": it tracks
 * `isPending`, and `error` holds the friendly message to show under the form.
 */
export function useSubmitEvent() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (input: SubmitEventInput) => api.submitEvent(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [SUBMISSIONS_KEY] }),
  });
  return {
    submit: mutation.mutateAsync,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    errorCode: mutation.error ? errorCode(mutation.error) : null,
    errorMessage: mutation.error ? mapSubmissionError(errorCode(mutation.error)) : null,
    reset: mutation.reset,
  };
}

/** The viewer's own suggestions, newest first. */
export function useMySubmissions() {
  const session = useSession();
  return useQuery({
    queryKey: [SUBMISSIONS_KEY, session?.userId ?? 'demo'],
    queryFn: () => api.getMySubmissions(),
    enabled: isBackendConfigured ? Boolean(session) : true,
  });
}
