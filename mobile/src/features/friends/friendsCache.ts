import type {
  FriendEntry,
  FriendRequest,
  Friendship,
  PersonSearchResult,
  PersonSummary,
  UserProfile,
} from '@/lib/api';

/** Every friends query starts with this key, so one invalidate refreshes search, lists and profiles. */
export const FRIENDS_KEY = 'friends';
export const friendKeys = {
  list: [FRIENDS_KEY, 'list'] as const,
  requests: [FRIENDS_KEY, 'requests'] as const,
  search: (query: string) => [FRIENDS_KEY, 'search', query] as const,
  searchAll: [FRIENDS_KEY, 'search'] as const,
  profile: (id: string) => [FRIENDS_KEY, 'profile', id] as const,
};

/** What a person can do to a relationship. `remove` unfriends, or cancels a request you sent. */
export type FriendAction = 'send' | 'accept' | 'decline' | 'remove';

/** Where a relationship ends up after an action, assuming the server agrees (used before it answers). */
export function nextFriendship(action: FriendAction, from: Friendship): Friendship {
  switch (action) {
    case 'send':
      // They had already asked: sending is accepting.
      return from === 'incoming' || from === 'friends' ? 'friends' : 'outgoing';
    case 'accept':
      return 'friends';
    case 'decline':
    case 'remove':
      return 'none';
  }
}

export function searchAfter(results: PersonSearchResult[], id: string, friendship: Friendship): PersonSearchResult[] {
  return results.map((r) => (r.id === id ? { ...r, friendship } : r));
}

export function profileAfter(profile: UserProfile | null, from: Friendship, to: Friendship): UserProfile | null {
  if (!profile || profile.friendship === 'self') return profile;
  // Their friend count includes you.
  const delta = (to === 'friends' ? 1 : 0) - (from === 'friends' ? 1 : 0);
  return { ...profile, friendship: to, friendCount: Math.max(profile.friendCount + delta, 0) };
}

export function requestsAfter(
  requests: FriendRequest[],
  person: PersonSummary,
  to: Friendship,
  now: Date,
): FriendRequest[] {
  const rest = requests.filter((r) => r.id !== person.id);
  return to === 'outgoing' ? [{ ...person, direction: 'outgoing', createdAt: now }, ...rest] : rest;
}

export function friendsAfter(friends: FriendEntry[], person: PersonSummary, to: Friendship, now: Date): FriendEntry[] {
  const rest = friends.filter((f) => f.id !== person.id);
  if (to !== 'friends') return rest;
  return [...rest, { ...person, since: now }].sort((a, b) => a.displayName.localeCompare(b.displayName));
}
