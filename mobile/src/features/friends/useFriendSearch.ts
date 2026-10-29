import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { SEARCH_MAX_LENGTH, SEARCH_MIN_LENGTH, api, normalizeSearchQuery, type PersonSearchResult } from '@/lib/api';
import { useDebouncedValue } from '@/lib/useDebouncedValue';

import { friendKeys } from './friendsCache';

export const SEARCH_DEBOUNCE_MS = 250;

export type SearchStatus = 'idle' | 'short' | 'loading' | 'error' | 'empty' | 'results';

/** What the search screen should show. Pure, so every state is testable. */
export function searchStatus(input: {
  /** What was typed, normalized. */
  typed: string;
  /** What the last request was for (the typed text, 250 ms late). */
  settledQuery: string;
  data: PersonSearchResult[] | undefined;
  isError: boolean;
  isFetching: boolean;
  isPlaceholderData: boolean;
}): SearchStatus {
  const { typed, settledQuery, data, isError, isFetching, isPlaceholderData } = input;
  if (typed.length === 0) return 'idle';
  if (typed.length < SEARCH_MIN_LENGTH) return 'short';
  const current = settledQuery === typed && !isPlaceholderData;
  if (isError && current && !isFetching) return 'error';
  if (!data) return 'loading';
  // Old results stay up while the next ones load, but an old "nothing" must not flash as "no results".
  if (data.length === 0) return current && !isFetching ? 'empty' : 'loading';
  return 'results';
}

/**
 * People search. Waits 250 ms after typing stops, searches only from 2 characters on, and keeps the
 * previous results on screen while the next ones load so the list doesn't flicker.
 */
export function useFriendSearch(raw: string) {
  const typed = normalizeSearchQuery(raw).slice(0, SEARCH_MAX_LENGTH);
  const settledQuery = useDebouncedValue(typed, SEARCH_DEBOUNCE_MS);
  const enabled = settledQuery.length >= SEARCH_MIN_LENGTH;
  const query = useQuery({
    queryKey: friendKeys.search(settledQuery),
    queryFn: () => api.searchProfiles(settledQuery),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
  const status = searchStatus({
    typed,
    settledQuery,
    data: enabled || typed.length >= SEARCH_MIN_LENGTH ? query.data : undefined,
    isError: query.isError,
    isFetching: query.isFetching,
    isPlaceholderData: query.isPlaceholderData,
  });
  return { status, results: query.data ?? [], typed, refetch: query.refetch };
}
