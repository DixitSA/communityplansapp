import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { api } from '@/lib/api';
import { useDiscoverableByPhone } from '../useSettings';

jest.mock('@/lib/api', () => ({ api: { getDiscoverableByPhone: jest.fn(), setDiscoverableByPhone: jest.fn() } }));
jest.mock('@/features/auth/AuthProvider', () => ({ useSession: () => ({ userId: 'qa-user' }) }));

const get = jest.mocked(api.getDiscoverableByPhone);
const set = jest.mocked(api.setDiscoverableByPhone);
function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
beforeEach(() => { jest.clearAllMocks(); get.mockResolvedValue(false); set.mockResolvedValue(undefined); });

it('exposes a failed read and lets the user retry it', async () => {
  get.mockRejectedValueOnce(new Error('offline'));
  const { result } = await renderHook(useDiscoverableByPhone, { wrapper });
  await waitFor(() => expect(result.current.isReadError).toBe(true));
  expect(result.current.value).toBeUndefined();
  await act(async () => { await result.current.retry(); });
  await waitFor(() => expect(result.current.value).toBe(false));
  expect(result.current.isReadError).toBe(false);
});

it('restores the last saved choice and exposes a failed write', async () => {
  let fail: (error: Error) => void = () => {};
  set.mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { fail = reject; }));
  const { result } = await renderHook(useDiscoverableByPhone, { wrapper });
  await waitFor(() => expect(result.current.value).toBe(false));
  await act(async () => result.current.set(true));
  await waitFor(() => expect(result.current.isPending).toBe(true));
  expect(result.current.value).toBe(true);
  await act(async () => fail(new Error('offline')));
  await waitFor(() => expect(result.current.error).toBe(true));
  expect(result.current.value).toBe(false);
});
