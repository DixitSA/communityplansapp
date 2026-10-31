import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { api } from '@/lib/api';

import { useFiltersStore } from '../filtersStore';
import { useFeedEvents } from '../useFeedEvents';

jest.mock('@/lib/env', () => ({ isBackendConfigured: true }));
jest.mock('../origin', () => ({
  CHARLOTTE_CENTER: { lat: 35.2271, lng: -80.8431 },
  getOrigin: jest.fn().mockResolvedValue({ lat: 35.2271, lng: -80.8431 }),
}));
jest.mock('@/lib/api', () => ({
  ...jest.requireActual('@/lib/api/feedMapping'),
  CHARLOTTE_CITY_ID: 1,
  METERS_PER_MILE: 1609.344,
  demoFeed: jest.fn(() => []),
  api: { listInterests: jest.fn(), getFeedRange: jest.fn() },
}));

const listInterests = api.listInterests as jest.Mock;
const getFeed = api.getFeedRange as jest.Mock;

function wrapper({ children }: { children: ReactNode }) {
  // gcTime Infinity: no 5-minute cache-cleanup timers left running after the test (they kept Jest workers alive).
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useFeedEvents when the interests lookup fails', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // An interest filter makes the feed wait for the interests list.
    useFiltersStore.setState({ interests: ['music'] });
    listInterests.mockRejectedValue(new Error('network down'));
    getFeed.mockResolvedValue([]);
  });

  it('stops loading and shows the error instead of spinning forever', async () => {
    const { result } = await renderHook(() => useFeedEvents(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.isLoading).toBe(false);
    expect(getFeed).not.toHaveBeenCalled();
  });

  it('retries the interests lookup on refetch', async () => {
    const { result } = await renderHook(() => useFeedEvents(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    listInterests.mockResolvedValue([{ id: 2, slug: 'music', label: 'Music', symbol: 'music.note' }]);
    await act(async () => result.current.refetch());
    await waitFor(() => expect(getFeed).toHaveBeenCalled());
    expect(listInterests).toHaveBeenCalledTimes(2);
  });
});

describe('useFeedEvents scope', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useFiltersStore.setState({ interests: [], scope: 'nearby' });
    getFeed.mockResolvedValue([]);
  });
  afterEach(() => useFiltersStore.setState({ scope: 'nearby' }));

  it('asks the server for p_mode = friends when the Friends segment is selected', async () => {
    const { result } = await renderHook(() => useFeedEvents(), { wrapper });
    await waitFor(() => expect(getFeed).toHaveBeenCalled());
    expect(getFeed.mock.calls[0][0]).toMatchObject({ mode: 'nearby' });

    // Awaited: Testing Library's act is async, and an un-awaited one left the hook subscribed after the test.
    await act(async () => useFiltersStore.getState().setScope('friends'));
    await waitFor(() => expect(getFeed.mock.calls.some(([p]) => p.mode === 'friends')).toBe(true));
    expect(result.current.isError).toBe(false);
  });
});
