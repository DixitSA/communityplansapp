import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useFiltersStore } from '../filtersStore';
import { useFeedEvents } from '../useFeedEvents';

jest.mock('@/lib/env', () => ({ isBackendConfigured: false }));

it('applies the selected interest to the demo agenda count', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }

  useFiltersStore.setState({
    timeOfDay: 'any',
    interests: [],
    distanceMi: 10,
    price: 'any',
    scope: 'nearby',
    neighborhood: null,
  });

  let unmountHook = () => {};
  try {
    const { result, unmount } = await renderHook(() => useFeedEvents(), { wrapper: Wrapper });
    unmountHook = unmount;
    await waitFor(() => expect(result.current.filtered.length).toBeGreaterThan(0));
    const allInterestsCount = result.current.filtered.length;

    await act(async () => useFiltersStore.getState().toggleInterest('nightlife'));

    await waitFor(() => expect(result.current.filtered.length).toBeLessThan(allInterestsCount));
    expect(result.current.filtered.every((event) => event.interest === 'nightlife')).toBe(true);
  } finally {
    unmountHook();
    await act(async () => useFiltersStore.setState({ interests: [] }));
    client.clear();
  }
});
