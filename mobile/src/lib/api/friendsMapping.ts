import type { Database } from '../database.types';
import type {
  FriendEntry,
  FriendRequest,
  Friendship,
  PersonSearchResult,
  PersonSummary,
  ProfileFriendship,
  SharedEvent,
  UserProfile,
} from './friendTypes';

type Fns = Database['public']['Functions'];
export type SearchRow = Fns['search_profiles']['Returns'][number];
export type FriendRow = Fns['list_friends']['Returns'][number];
export type RequestRow = Fns['list_friend_requests']['Returns'][number];
export type ProfileRow = Fns['get_profile']['Returns'][number];

/** Turns an `avatar_path` into a public URL (or null). Remote mode passes Supabase Storage's builder. */
export type AvatarUrl = (path: string | null | undefined) => string | null;

const FRIENDSHIPS: readonly string[] = ['none', 'friends', 'outgoing', 'incoming'];

/** Anything unexpected reads as "not connected": the safest thing to show (an Add button, never Friends). */
export function toFriendship(value: string | null | undefined): Friendship {
  return value && FRIENDSHIPS.includes(value) ? (value as Friendship) : 'none';
}

function toProfileFriendship(value: string | null | undefined): ProfileFriendship {
  return value === 'self' ? 'self' : toFriendship(value);
}

function person(
  row: { id: string; username: string; display_name: string; avatar_path: string | null },
  avatarUrl: AvatarUrl,
): PersonSummary {
  return { id: row.id, username: row.username, displayName: row.display_name, avatarUrl: avatarUrl(row.avatar_path) };
}

export function mapSearchRow(row: SearchRow, avatarUrl: AvatarUrl): PersonSearchResult {
  return { ...person(row, avatarUrl), friendship: toFriendship(row.friendship) };
}

export function mapFriendRow(row: FriendRow, avatarUrl: AvatarUrl): FriendEntry {
  return { ...person(row, avatarUrl), since: new Date(row.since) };
}

export function mapRequestRow(row: RequestRow, avatarUrl: AvatarUrl): FriendRequest {
  return {
    ...person(row, avatarUrl),
    direction: row.direction === 'outgoing' ? 'outgoing' : 'incoming',
    createdAt: new Date(row.created_at),
  };
}

/** `shared_events` arrives as untyped JSON: keep only well-formed entries. */
export function parseSharedEvents(json: unknown): SharedEvent[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((e) => {
    if (typeof e !== 'object' || e === null) return [];
    const { id, title, starts_at } = e as { id?: unknown; title?: unknown; starts_at?: unknown };
    if (typeof id !== 'string' || typeof title !== 'string' || typeof starts_at !== 'string') return [];
    const startsAt = new Date(starts_at);
    return Number.isNaN(startsAt.getTime()) ? [] : [{ id, title, startsAt }];
  });
}

export function mapProfileRow(row: ProfileRow, avatarUrl: AvatarUrl): UserProfile {
  return {
    ...person(row, avatarUrl),
    bio: row.bio?.trim() ? row.bio.trim() : null,
    friendship: toProfileFriendship(row.friendship),
    friendCount: Number(row.friend_count ?? 0),
    mutualFriendCount: Number(row.mutual_friend_count ?? 0),
    sharedEvents: parseSharedEvents(row.shared_events),
  };
}

/** What `search_profiles` does to a query: trim, drop one leading "@". Under 2 characters finds nothing. */
export function normalizeSearchQuery(raw: string): string {
  const trimmed = raw.trim();
  return (trimmed.startsWith('@') ? trimmed.slice(1) : trimmed).trim();
}
