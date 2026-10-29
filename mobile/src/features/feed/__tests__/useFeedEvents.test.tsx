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
  api: { listInterests: jest.fn(), getFeed: jest.fn() },
}));

const listInterests = api.listInterests as jest.Mock;
const getFeed = api.getFeed as jest.Mock;

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
