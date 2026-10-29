import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';

import {
  api,
  errorCode,
  mapFriendError,
  type FriendEntry,
  type FriendRequest,
  type Friendship,
  type PersonSearchResult,
  type PersonSummary,
  type UserProfile,
} from '@/lib/api';
import { success } from '@/lib/haptics';

import { MY_PROFILE_KEY } from '../profile/useMyProfile';
import {
  FRIENDS_KEY,
  friendKeys,
  friendsAfter,
  nextFriendship,
  profileAfter,
  requestsAfter,
  searchAfter,
  type FriendAction,
} from './friendsCache';

export type FriendVars = {
  action: FriendAction;
  person: PersonSummary;
  /** Where the relationship is right now (the screen knows), so the UI can move before the server answers. */
  from: Friendship;
};

type Snapshot = [readonly unknown[], unknown][];

/** Runs the right RPC and answers where the relationship ended up. */
export async function runFriendAction({ action, person }: FriendVars): Promise<Friendship> {
  switch (action) {
    case 'send':
      return api.sendFriendRequest(person.id);
    case 'accept':
      return api.respondFriendRequest(person.id, true);
    case 'decline':
      return api.respondFriendRequest(person.id, false);
    case 'remove':
      await api.removeFriend(person.id);
      return 'none';
  }
}

/** Writes the expected result into every cached friends query. */
export function applyOptimistic(client: QueryClient, v: FriendVars, now = new Date()): void {
  const to = nextFriendship(v.action, v.from);
  client.setQueriesData<PersonSearchResult[]>({ queryKey: friendKeys.searchAll }, (old) =>
    old ? searchAfter(old, v.person.id, to) : old,
  );
  client.setQueryData<UserProfile | null>(friendKeys.profile(v.person.id), (old) =>
    old ? profileAfter(old, v.from, to) : old,
  );
  client.setQueryData<FriendRequest[]>(friendKeys.requests, (old) => (old ? requestsAfter(old, v.person, to, now) : old));
  client.setQueryData<FriendEntry[]>(friendKeys.list, (old) => (old ? friendsAfter(old, v.person, to, now) : old));
}

/** The default way to tell someone an action failed. */
export function alertFriendFailure(err: unknown) {
  Alert.alert('That didn’t work', mapFriendError(errorCode(err)));
}

/**
 * Add, accept, decline, cancel or unfriend. "Optimistic" means the screens change the moment you tap,
 * before the server answers; if it says no, the old data comes back and we say why. Afterwards every
 * friends query (and the things that depend on friendships) refetches, so the server has the last word.
 */
export function useFriendAction(onError: (err: unknown, vars: FriendVars) => void = alertFriendFailure) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: runFriendAction,
    onMutate: async (v: FriendVars): Promise<Snapshot> => {
      await client.cancelQueries({ queryKey: [FRIENDS_KEY] });
      const snapshot = client.getQueriesData({ queryKey: [FRIENDS_KEY] });
      applyOptimistic(client, v);
      return snapshot;
    },
    onSuccess: (to, v) => {
      // The celebration moment (DESIGN.md 4): only when a friendship actually begins.
      if (to === 'friends' && v.from !== 'friends') success();
    },
    onError: (err, v, snapshot) => {
      if (snapshot) for (const [key, data] of snapshot) client.setQueryData(key, data);
      onError(err, v);
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: [FRIENDS_KEY] });
      void client.invalidateQueries({ queryKey: [MY_PROFILE_KEY] });
      // Who is going to what depends on who your friends are.
      void client.invalidateQueries({ queryKey: ['feed'] });
      void client.invalidateQueries({ queryKey: ['event'] });
    },
  });
  return {
    run: (v: FriendVars) => mutation.mutate(v),
    /** The person an action is running for, to show a busy state on their row. */
    busyId: mutation.isPending ? mutation.variables.person.id : null,
  };
}
