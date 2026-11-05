import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { api, type AuthSession } from '@/lib/api';

import { useOnboardingDraft } from '../../onboarding/draftStore';
import { AuthProvider, useSession } from '../AuthProvider';

jest.mock('@/lib/env', () => ({ isBackendConfigured: true, backendHost: () => 'test' }));
jest.mock('@/lib/devLog', () => ({ devLog: jest.fn() }));
jest.mock('@/lib/api', () => ({
  CHARLOTTE_CITY_ID: 1,
  api: { getSession: jest.fn(), onSessionChange: jest.fn() },
}));
const mock = api as unknown as Record<'getSession' | 'onSessionChange', jest.Mock>;

it('forgets the previous account’s photo and completion hold on direct account change, but keeps them on token refresh', async () => {
  useOnboardingDraft.getState().reset();
  const first: AuthSession = { userId: 'first-user', email: null };
  let onChange: (session: AuthSession | null) => void = () => {};
  mock.getSession.mockResolvedValue(first);
  mock.onSessionChange.mockImplementation((callback: typeof onChange) => { onChange = callback; return () => {}; });
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}><AuthProvider>{children}</AuthProvider></QueryClientProvider>
  );
  const { result } = await renderHook(() => useSession(), { wrapper });
  await waitFor(() => expect(result.current?.userId).toBe('first-user'));
  useOnboardingDraft.setState({ photoUri: 'file:///first.jpg', completionPending: true, profileCreated: true });
  client.setQueryData(['private-first-user'], { value: 'old' });

  await act(async () => { onChange({ ...first }); });
  expect(useOnboardingDraft.getState().photoUri).toBe('file:///first.jpg');
  expect(useOnboardingDraft.getState().completionPending).toBe(true);

  await act(async () => { onChange({ userId: 'second-user', email: null }); });
  expect(result.current?.userId).toBe('second-user');
  expect(useOnboardingDraft.getState().photoUri).toBeNull();
  expect(useOnboardingDraft.getState().completionPending).toBe(false);
  expect(useOnboardingDraft.getState().profileCreated).toBe(false);
  expect(client.getQueryData(['private-first-user'])).toBeUndefined();
  client.clear();
});
