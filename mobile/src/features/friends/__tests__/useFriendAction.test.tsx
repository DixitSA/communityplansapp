import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { FriendRequest, PersonSearchResult, UserProfile } from '@/lib/api';
import { api } from '@/lib/api';
import { success } from '@/lib/haptics';

import { friendKeys } from '../friendsCache';
import { useFriendAction } from '../useFriendAction';

jest.mock('@/lib/haptics', () => ({ success: jest.fn() }));
jest.mock('@/lib/api', () => ({
  ...jest.requireActual('@/lib/api/errors'),
  api: { sendFriendRequest: jest.fn(), respondFriendRequest: jest.fn(), removeFriend: jest.fn() },
}));
jest.mock('../../profile/useMyProfile', () => ({ MY_PROFILE_KEY: 'my-profile' }));

const person = { id: 'u1', username: 'maya', displayName: 'Maya', avatarUrl: null };
const mock = api as unknown as Record<'sendFriendRequest' | 'respondFriendRequest' | 'removeFriend', jest.Mock>;

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  client.setQueryData<PersonSearchResult[]>(friendKeys.search('may'), [{ ...person, friendship: 'incoming' }]);
  client.setQueryData<FriendRequest[]>(friendKeys.requests, [{ ...person, direction: 'incoming', createdAt: new Date() }]);
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

describe('useFriendAction', () => {
  beforeEach(() => jest.clearAllMocks());

  it('moves the search row and request list before the server answers, and celebrates an accept', async () => {
    const { client, wrapper } = setup();
    let finish: (v: 'friends') => void = () => {};
    mock.respondFriendRequest.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { result } = await renderHook(() => useFriendAction(), { wrapper });

    await act(async () => {
      result.current.run({ action: 'accept', person, from: 'incoming' });
    });
    await waitFor(() => expect(client.getQueryData<PersonSearchResult[]>(friendKeys.search('may'))?.[0].friendship).toBe('friends'));
    expect(client.getQueryData<FriendRequest[]>(friendKeys.requests)).toEqual([]);
    expect(result.current.busyId).toBe('u1');
    expect(success).not.toHaveBeenCalled();

    await act(async () => finish('friends'));
    await waitFor(() => expect(success).toHaveBeenCalledTimes(1));
    expect(mock.respondFriendRequest).toHaveBeenCalledWith('u1', true);
  });

  it('puts everything back and reports the error when the server says no', async () => {
    const { client, wrapper } = setup();
    const profile: UserProfile = {
      ...person,
      bio: null,
      friendship: 'incoming' as const,
      friendCount: 4,
      mutualFriendCount: 0,
      sharedEvents: [],
    };
    client.setQueryData(friendKeys.profile('u1'), profile);
    mock.respondFriendRequest.mockRejectedValue({ code: 'P0001', message: 'request_not_found' });
    const onError = jest.fn();
    const { result } = await renderHook(() => useFriendAction(onError), { wrapper });

    await act(async () => {
      result.current.run({ action: 'accept', person, from: 'incoming' });
    });
    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(client.getQueryData<PersonSearchResult[]>(friendKeys.search('may'))?.[0].friendship).toBe('incoming');
    expect(client.getQueryData<UserProfile>(friendKeys.profile('u1'))?.friendship).toBe('incoming');
    expect(client.getQueryData<FriendRequest[]>(friendKeys.requests)).toHaveLength(1);
    expect(success).not.toHaveBeenCalled();
  });

  it('sends and removes through the right calls', async () => {
    const { wrapper } = setup();
    mock.sendFriendRequest.mockResolvedValue('outgoing');
    mock.removeFriend.mockResolvedValue(undefined);
    const { result } = await renderHook(() => useFriendAction(), { wrapper });
    await act(async () => {
      result.current.run({ action: 'send', person, from: 'none' });
    });
    await waitFor(() => expect(mock.sendFriendRequest).toHaveBeenCalledWith('u1'));
    await act(async () => {
      result.current.run({ action: 'remove', person, from: 'outgoing' });
    });
    await waitFor(() => expect(mock.removeFriend).toHaveBeenCalledWith('u1'));
    expect(success).not.toHaveBeenCalled();
  });
});
