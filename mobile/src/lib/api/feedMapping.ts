import type { SymbolName } from '@/design';

import type { Database, Tables } from '../database.types';
import type { FeedEvent, Interest, RsvpStatus } from './types';

export type FeedRow = Database['public']['Functions']['get_feed']['Returns'][number];
export type FeedRangeRow = Database['public']['Functions']['get_feed_range']['Returns'][number];
export type SpotlightRow = Database['public']['Functions']['get_spotlight']['Returns'][number];

export const METERS_PER_MILE = 1609.344;

/** A friend as `get_feed` / `get_event_social` return them inside `friends_going`. */
export function parseFriends(json: unknown): { id: string; name: string }[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((p) => {
    if (typeof p !== 'object' || p === null) return [];
    const { id, display_name } = p as { id?: unknown; display_name?: unknown };
    return typeof id === 'string' && typeof display_name === 'string' ? [{ id, name: display_name }] : [];
  });
}

/** The first of the interests (in their display order) that the event has, used for art and tag color. */
export function primaryInterest(ids: number[], interests: Interest[]): Interest | undefined {
  return interests.find((i) => ids.includes(i.id));
}

export function mapFeedRow(row: FeedRow | FeedRangeRow | SpotlightRow, interests: Interest[]): FeedEvent {
  const primary = primaryInterest(row.interest_ids ?? [], interests);
  const friends = parseFriends(row.friends_going);
  return {
    id: row.id,
    title: row.title,
    startsAt: new Date(row.starts_at),
    endsAt: row.ends_at ? new Date(row.ends_at) : undefined,
    venue: row.venue_name ?? row.neighborhood ?? '',
    distanceMi: row.distance_m / METERS_PER_MILE,
    imageUrl: row.image_url ?? undefined,
    imageSensitive: row.image_sensitive === true,
    interest: primary?.slug ?? 'community',
    categoryLabel: primary?.label ?? 'Event',
    // The symbol column holds an SF Symbol name; the database can't prove it exists in our symbol list.
    symbol: (primary?.symbol ?? 'sparkles') as SymbolName,
    friends,
    friendsGoing: friends.length,
    lat: row.lat,
    lng: row.lng,
    neighborhood: row.neighborhood ?? undefined,
    goingCount: Number(row.going_count),
    myStatus: (row.my_status as RsvpStatus | null) ?? null,
    ...('day' in row ? { day: row.day } : null),
  };
}

export function priceLabel(e: Pick<Tables<'events'>, 'is_free' | 'price_min' | 'price_max'>): string {
  if (e.is_free) return 'Free';
  const fmt = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
  if (e.price_min == null) return 'See listing';
  if (e.price_max != null && e.price_max > e.price_min) return `${fmt(e.price_min)} to ${fmt(e.price_max)}`;
  return fmt(e.price_min);
}
