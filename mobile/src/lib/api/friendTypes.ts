/** How the viewer and another person are connected (`friendship` in the friends RPCs). */
export type Friendship = 'none' | 'friends' | 'outgoing' | 'incoming';
/** `get_profile` also reports 'self' when you open your own profile. */
export type ProfileFriendship = Friendship | 'self';

/** The part of a profile every friends screen needs. `avatarUrl` is a public URL, or null for initials. */
export type PersonSummary = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

/** One row of `search_profiles`. */
export type PersonSearchResult = PersonSummary & { friendship: Friendship };

/** One row of `list_friends`. */
export type FriendEntry = PersonSummary & { since: Date };

/** One row of `list_friend_requests`. `incoming` asks you; `outgoing` is yours, still waiting. */
export type FriendRequest = PersonSummary & {
  direction: 'incoming' | 'outgoing';
  createdAt: Date;
};

/** A past event you and the other person were both Going to. */
export type SharedEvent = { id: string; title: string; startsAt: Date };

/** `get_profile`: another person's page. Friend lists are never sent, only counts. */
export type UserProfile = PersonSummary & {
  bio: string | null;
  friendship: ProfileFriendship;
  friendCount: number;
  mutualFriendCount: number;
  sharedEvents: SharedEvent[];
};

/** Most people `search_profiles` returns. */
export const SEARCH_LIMIT = 20;
/** The server rejects longer searches (`query_invalid`) and answers nothing under 2 characters. */
export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_LENGTH = 30;
