import { getFixtureEvent } from '@/features/feed/fixtures';

import { ApiError } from './errors';
import type {
  FriendEntry,
  FriendRequest,
  Friendship,
  PersonSearchResult,
  PersonSummary,
  SharedEvent,
  UserProfile,
} from './friendTypes';
import { normalizeSearchQuery } from './friendsMapping';
import { SEARCH_LIMIT, SEARCH_MAX_LENGTH, SEARCH_MIN_LENGTH } from './friendTypes';
import type { Api } from './types';

/** The viewer in demo mode (the same id the sample session and chat use). */
const ME = 'demo-user';
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

type DemoPerson = PersonSummary & {
  /** Where the relationship starts. Friends and requests are mutable; the rest of the entry isn't. */
  start: Friendship;
  bio?: string;
  friendCount: number;
  mutualFriendCount: number;
  /** Past fixture events both went to: "ev-005-w-1" is last week's Warehouse Party. */
  shared?: string[];
};

const p = (
  id: string,
  displayName: string,
  username: string,
  start: Friendship,
  friendCount: number,
  mutualFriendCount: number,
  extra: { bio?: string; shared?: string[] } = {},
): DemoPerson => ({ id, displayName, username, avatarUrl: null, start, friendCount, mutualFriendCount, ...extra });

/** Fictional people. The first five are friends (they match the sample events' faces), then requests, then everyone else. */
export const DEMO_PEOPLE: DemoPerson[] = [
  p('u-maya', 'Maya Chen', 'maya.chen', 'friends', 48, 6, { bio: 'Vinyl, patios and trying every taco truck.', shared: ['ev-005-w-1', 'ev-009-w-1'] }),
  p('u-jordan', 'Jordan Lee', 'jordan.lee', 'friends', 31, 5, { shared: ['ev-003-w-1'] }),
  p('u-sam', 'Sam Ortiz', 'sam.ortiz', 'friends', 22, 4, { bio: 'Rooftops over restaurants.', shared: ['ev-007-w-1'] }),
  p('u-theo', 'Theo Brandt', 'theo.brandt', 'friends', 17, 3, { shared: ['ev-005-w-1'] }),
  p('u-priya', 'Priya Nair', 'priya.nair', 'friends', 26, 3, { bio: 'Greenway rides and open mics.' }),
  p('u-noah', 'Noah Kim', 'noah.kim', 'incoming', 14, 2, { bio: 'New in town, looking for a pickup soccer crowd.' }),
  p('u-eli', 'Eli Brooks', 'eli.brooks', 'outgoing', 12, 1),
  p('u-ana', 'Ana Reyes', 'ana.reyes', 'none', 19, 2, { shared: ['ev-005-w-1'] }),
  p('u-lena', 'Lena Park', 'lena.park', 'none', 35, 1),
  p('u-marcus', 'Marcus Bell', 'marcus.bell', 'none', 9, 0),
  p('u-zoe', 'Zoe Alvarez', 'zoe.alvarez', 'none', 41, 4, { bio: 'Climbing gym regular. Always up for a late ramen.' }),
];

type Link = { friendship: Friendship; at: Date };

/**
 * In-memory friends for demo mode, with the same behavior and error codes as the RPCs
 * (supabase/migrations/20261030010000_friends_rpcs.sql). Tests create fresh instances.
 */
export function createDemoFriends({ wait, now = () => new Date() }: {
  wait: (ms?: number) => Promise<void>;
  now?: () => Date;
}): Pick<
  Api,
  | 'searchProfiles'
  | 'sendFriendRequest'
  | 'respondFriendRequest'
  | 'removeFriend'
  | 'listFriends'
  | 'listFriendRequests'
  | 'getUserProfile'
> & { hide: (userId: string) => void } {
  const links = new Map<string, Link>();
  DEMO_PEOPLE.forEach((d, i) => {
    // Requests are recent; friendships are older, oldest first in the list order.
    const age = d.start === 'incoming' ? 3 * HOUR_MS : d.start === 'outgoing' ? 2 * DAY_MS : (i + 1) * 9 * DAY_MS;
    if (d.start !== 'none') links.set(d.id, { friendship: d.start, at: new Date(now().getTime() - age) });
  });
  const hidden = new Set<string>();

  const known = (id: string): DemoPerson => {
    const found = DEMO_PEOPLE.find((d) => d.id === id);
    if (!found || hidden.has(id)) throw new ApiError('user_not_found');
    return found;
  };
  const friendshipOf = (id: string): Friendship => links.get(id)?.friendship ?? 'none';
  const summary = ({ id, username, displayName, avatarUrl }: DemoPerson): PersonSummary => ({ id, username, displayName, avatarUrl });
  const visible = () => DEMO_PEOPLE.filter((d) => !hidden.has(d.id));

  return {
    hide: (userId) => {
      hidden.add(userId);
      links.delete(userId);
    },

    async searchProfiles(query, limit = SEARCH_LIMIT) {
      await wait();
      const q = normalizeSearchQuery(query);
      if (q.length > SEARCH_MAX_LENGTH) throw new ApiError('query_invalid');
      if (q.length < SEARCH_MIN_LENGTH) return [];
      const needle = q.toLowerCase();
      const rank = (d: DemoPerson) => (d.username === needle ? 0 : friendshipOf(d.id) === 'friends' ? 1 : 2);
      const results: PersonSearchResult[] = visible()
        .filter((d) => d.username.startsWith(needle) || d.displayName.toLowerCase().includes(needle))
        .sort((a, b) => rank(a) - rank(b) || a.username.localeCompare(b.username))
        .slice(0, Math.max(1, Math.min(limit, SEARCH_LIMIT)))
        .map((d) => ({ ...summary(d), friendship: friendshipOf(d.id) }));
      return results;
    },

    async sendFriendRequest(userId) {
      await wait();
      if (userId === ME) throw new ApiError('cannot_friend_self');
      known(userId);
      const current = friendshipOf(userId);
      if (current === 'friends') throw new ApiError('already_friends');
      if (current === 'outgoing') throw new ApiError('request_pending');
      // They already asked us: accepting is the obvious intent.
      const next: Friendship = current === 'incoming' ? 'friends' : 'outgoing';
      links.set(userId, { friendship: next, at: now() });
      return next === 'friends' ? 'friends' : 'outgoing';
    },

    async respondFriendRequest(userId, accept) {
      await wait();
      if (friendshipOf(userId) !== 'incoming') throw new ApiError('request_not_found');
      if (accept) {
        links.set(userId, { friendship: 'friends', at: now() });
        return 'friends';
      }
      links.delete(userId);
      return 'none';
    },

    async removeFriend(userId) {
      await wait();
      links.delete(userId);
    },

    async listFriends() {
      await wait();
      const out: FriendEntry[] = visible()
        .filter((d) => friendshipOf(d.id) === 'friends')
        .map((d) => ({ ...summary(d), since: links.get(d.id)?.at ?? now() }));
      return out.sort((a, b) => a.displayName.localeCompare(b.displayName));
    },

    async listFriendRequests() {
      await wait();
      const out: FriendRequest[] = visible().flatMap((d) => {
        const f = friendshipOf(d.id);
        return f === 'incoming' || f === 'outgoing' ? [{ ...summary(d), direction: f, createdAt: links.get(d.id)?.at ?? now() }] : [];
      });
      return out.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },

    async getUserProfile(userId) {
      await wait();
      if (userId === ME) {
        return {
          id: ME,
          username: 'taylor.morgan',
          displayName: 'Taylor Morgan',
          avatarUrl: null,
          bio: null,
          friendship: 'self',
          friendCount: visible().filter((d) => friendshipOf(d.id) === 'friends').length,
          mutualFriendCount: 0,
          sharedEvents: [],
        };
      }
      const d = DEMO_PEOPLE.find((x) => x.id === userId);
      if (!d || hidden.has(userId)) return null;
      const sharedEvents: SharedEvent[] = (d.shared ?? []).flatMap((id) => {
        const e = getFixtureEvent(id, now());
        return e ? [{ id, title: e.title, startsAt: e.startsAt }] : [];
      });
      const profile: UserProfile = {
        ...summary(d),
        bio: d.bio ?? null,
        friendship: friendshipOf(userId),
        // Their friend count includes you, so it moves by one when you friend or unfriend them.
        friendCount: d.friendCount + (friendshipOf(userId) === 'friends' ? 1 : 0) - (d.start === 'friends' ? 1 : 0),
        mutualFriendCount: d.mutualFriendCount,
        sharedEvents: sharedEvents.sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime()),
      };
      return profile;
    },
  };
}
