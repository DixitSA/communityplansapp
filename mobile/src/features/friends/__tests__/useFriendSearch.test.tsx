import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { api } from '@/lib/api';

import { searchStatus, useFriendSearch, SEARCH_DEBOUNCE_MS } from '../useFriendSearch';

jest.mock('@/lib/api', () => ({
  ...jest.requireActual('@/lib/api/friendsMapping'),
  SEARCH_MAX_LENGTH: 30,
  SEARCH_MIN_LENGTH: 2,
  api: { searchProfiles: jest.fn() },
}));

const searchProfiles = api.searchProfiles as jest.Mock;

function wrapper({ children }: { children: ReactNode }) {
  // gcTime Infinity: no 5-minute cache-cleanup timers left running after the test (they kept Jest workers alive).
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const maya = { id: 'u1', username: 'maya', displayName: 'Maya', avatarUrl: null, friendship: 'none' as const };

describe('useFriendSearch', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    searchProfiles.mockReset();
    searchProfiles.mockResolvedValue([maya]);
  });
  afterEach(() => jest.useRealTimers());

  it('does nothing until 2 characters are typed', async () => {
    const { result, rerender } = await renderHook(({ q }: { q: string }) => useFriendSearch(q), { wrapper, initialProps: { q: '' } });
    expect(result.current.status).toBe('idle');
    await rerender({ q: 'm' });
    expect(result.current.status).toBe('short');
    await act(async () => jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS * 2));
    expect(searchProfiles).not.toHaveBeenCalled();
  });

  it('waits for typing to pause, then searches once with the cleaned-up text', async () => {
    const { result, rerender } = await renderHook(({ q }: { q: string }) => useFriendSearch(q), { wrapper, initialProps: { q: '' } });
    await rerender({ q: '@ma' });
    await act(async () => jest.advanceTimersByTime(100));
    await rerender({ q: '@may' });
    await act(async () => jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 50));
    expect(searchProfiles).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(100));
    await waitFor(() => expect(result.current.status).toBe('results'));
    expect(searchProfiles).toHaveBeenCalledTimes(1);
    expect(searchProfiles).toHaveBeenCalledWith('may');
    expect(result.current.results).toEqual([maya]);
  });

  it('reports empty and error', async () => {
    searchProfiles.mockResolvedValueOnce([]);
    const { result } = await renderHook(() => useFriendSearch('zzz'), { wrapper });
    await act(async () => jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS + 10));
    await waitFor(() => expect(result.current.status).toBe('empty'));

    searchProfiles.mockRejectedValueOnce(new Error('boom'));
    const failing = await renderHook(() => useFriendSearch('qqq'), { wrapper });
    await act(async () => jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS + 10));
    await waitFor(() => expect(failing.result.current.status).toBe('error'));
  });
});

describe('searchStatus', () => {
  const base = { typed: 'maya', settledQuery: 'maya', data: [maya], isError: false, isFetching: false, isPlaceholderData: false };

  it('keeps old results up while the next ones load', () => {
    expect(searchStatus({ ...base, settledQuery: 'may', isFetching: true, isPlaceholderData: true })).toBe('results');
  });
  it('never flashes "no results" for a stale empty list', () => {
    expect(searchStatus({ ...base, data: [], settledQuery: 'ma' })).toBe('loading');
    expect(searchStatus({ ...base, data: [] })).toBe('empty');
  });
  it('shows loading with no data yet', () => {
    expect(searchStatus({ ...base, data: undefined })).toBe('loading');
  });
});
