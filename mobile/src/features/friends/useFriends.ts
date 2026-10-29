import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';

import { friendKeys } from './friendsCache';

const THIRTY_SECONDS = 30_000;

/** The viewer's friends, A to Z. */
export function useFriends() {
  return useQuery({ queryKey: friendKeys.list, queryFn: () => api.listFriends(), staleTime: THIRTY_SECONDS });
}

/** Pending requests, both directions, newest first. */
export function useFriendRequests() {
  return useQuery({ queryKey: friendKeys.requests, queryFn: () => api.listFriendRequests(), staleTime: THIRTY_SECONDS });
}
