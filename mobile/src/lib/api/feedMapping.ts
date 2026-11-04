import type { SymbolName } from '@/design';

import type { Database, Tables } from '../database.types';
import type { FeedEvent, Interest, MyPlan, RsvpStatus } from './types';

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

/** Why a spotlight event is featured: "yard pick", else "{n} going" (the server only picks n >= 3). Never names. */
export function spotlightReason(picked: boolean, goingCount: number | null | undefined): string | undefined {
  if (picked) return 'yard pick';
  return goingCount ? `${goingCount} going` : undefined;
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

/** What the price chip says when the listing has no price; the event page leaves the chip out instead. */
export const UNKNOWN_PRICE_LABEL = 'See listing';

export function priceLabel(e: Pick<Tables<'events'>, 'is_free' | 'price_min' | 'price_max'>): string {
  if (e.is_free) return 'Free';
  const fmt = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
  if (e.price_min == null) return UNKNOWN_PRICE_LABEL;
  if (e.price_max != null && e.price_max > e.price_min) return `${fmt(e.price_min)} to ${fmt(e.price_max)}`;
  return fmt(e.price_min);
}

/** A row of the viewer's own `rsvps` joined to its event (the distance is unknown here, so 0). */
export type PlanRow = {
  status: RsvpStatus;
  events: Pick<
    Tables<'events'>,
    'id' | 'title' | 'starts_at' | 'ends_at' | 'venue_name' | 'neighborhood' | 'image_url' | 'image_sensitive'
  > & { event_interests: { interest_id: number }[] };
};

export function mapPlanRow(row: PlanRow, interests: Interest[]): MyPlan {
  const e = row.events;
  const primary = primaryInterest(
    e.event_interests.map((r) => r.interest_id),
    interests,
  );
  return {
    status: row.status,
    event: {
      id: e.id,
      title: e.title,
      startsAt: new Date(e.starts_at),
      endsAt: e.ends_at ? new Date(e.ends_at) : undefined,
      venue: e.venue_name ?? e.neighborhood ?? '',
      distanceMi: 0,
      imageUrl: e.image_url ?? undefined,
      imageSensitive: e.image_sensitive === true,
      interest: primary?.slug ?? 'community',
      categoryLabel: primary?.label ?? 'Event',
      symbol: (primary?.symbol ?? 'sparkles') as SymbolName,
      friends: [],
      friendsGoing: 0,
    },
  };
}
