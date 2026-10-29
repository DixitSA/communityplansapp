import type { FriendEntry, FriendRequest, PersonSearchResult, UserProfile } from '@/lib/api';

import { friendCountLabel, mutualFriendsLabel } from '../format';
import { friendsAfter, nextFriendship, profileAfter, requestsAfter, searchAfter } from '../friendsCache';

const maya = { id: 'u1', username: 'maya', displayName: 'Maya Chen', avatarUrl: null };
const jordan = { id: 'u2', username: 'jordan', displayName: 'Jordan Lee', avatarUrl: null };
const now = new Date('2026-10-29T12:00:00Z');

describe('nextFriendship', () => {
  it('moves each state the way the server does', () => {
    expect(nextFriendship('send', 'none')).toBe('outgoing');
    expect(nextFriendship('send', 'incoming')).toBe('friends');
    expect(nextFriendship('accept', 'incoming')).toBe('friends');
    expect(nextFriendship('decline', 'incoming')).toBe('none');
    expect(nextFriendship('remove', 'friends')).toBe('none');
    expect(nextFriendship('remove', 'outgoing')).toBe('none');
  });
});

describe('cache updates', () => {
  it('changes only the matching search result', () => {
    const results: PersonSearchResult[] = [
      { ...maya, friendship: 'none' },
      { ...jordan, friendship: 'none' },
    ];
    const next = searchAfter(results, 'u1', 'outgoing');
    expect(next.map((r) => r.friendship)).toEqual(['outgoing', 'none']);
    expect(results[0].friendship).toBe('none');
  });

  const profile: UserProfile = {
    ...maya,
    bio: null,
    friendship: 'none',
    friendCount: 10,
    mutualFriendCount: 2,
    sharedEvents: [],
  };

  it('moves their friend count by one when a friendship starts or ends', () => {
    expect(profileAfter(profile, 'incoming', 'friends')?.friendCount).toBe(11);
    expect(profileAfter({ ...profile, friendship: 'friends' }, 'friends', 'none')?.friendCount).toBe(9);
    expect(profileAfter(profile, 'none', 'outgoing')?.friendCount).toBe(10);
  });

  it('leaves your own profile and a missing one alone', () => {
    expect(profileAfter(null, 'none', 'friends')).toBeNull();
    const self = { ...profile, friendship: 'self' as const };
    expect(profileAfter(self, 'none', 'friends')).toBe(self);
  });

  it('adds an outgoing request on top and drops requests that are settled', () => {
    const existing: FriendRequest[] = [{ ...jordan, direction: 'incoming', createdAt: now }];
    const sent = requestsAfter(existing, maya, 'outgoing', now);
    expect(sent.map((r) => [r.id, r.direction])).toEqual([['u1', 'outgoing'], ['u2', 'incoming']]);
    expect(requestsAfter(existing, jordan, 'friends', now)).toEqual([]);
    expect(requestsAfter(existing, jordan, 'none', now)).toEqual([]);
  });

  it('adds a new friend in name order and removes an ex-friend', () => {
    const friends: FriendEntry[] = [{ ...maya, since: now }];
    const added = friendsAfter(friends, jordan, 'friends', now);
    expect(added.map((f) => f.displayName)).toEqual(['Jordan Lee', 'Maya Chen']);
    expect(friendsAfter(added, maya, 'none', now).map((f) => f.id)).toEqual(['u2']);
    // Accepting twice doesn't duplicate.
    expect(friendsAfter(added, jordan, 'friends', now)).toHaveLength(2);
  });
});

describe('labels', () => {
  it('pluralizes', () => {
    expect(mutualFriendsLabel(1)).toBe('1 mutual friend');
    expect(mutualFriendsLabel(0)).toBe('0 mutual friends');
    expect(friendCountLabel(1)).toBe('1 friend');
    expect(friendCountLabel(12)).toBe('12 friends');
  });
});
