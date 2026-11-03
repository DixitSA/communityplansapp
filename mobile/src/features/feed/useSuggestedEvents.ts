import { useMemo } from 'react';

import type { FeedEvent } from '@/lib/api';
import { useNow } from '@/lib/useNow';

import { useFeedEvents } from './useFeedEvents';
import { useSpotlight } from './useSpotlight';

const WEEK_MS = 7 * 86_400_000;

/**
 * Real upcoming events to point newcomers at from empty screens. Uses the spotlight ("popping this
 * week") and falls back to the feed. `peopleGoing` adds up the Going counts of the next 7 days' events
 * in the feed (someone going to two events counts twice), so copy must say "events have N going", not
 * "N people". A count only: never names.
 */
export function useSuggestedEvents(limit = 3): { events: FeedEvent[]; peopleGoing: number } {
  const spotlight = useSpotlight();
  const feed = useFeedEvents();
  const nowDate = useNow();
  return useMemo(() => {
    const now = nowDate.getTime();
    const upcoming = (list: FeedEvent[]) => list.filter((e) => e.startsAt.getTime() > now);
    const fromSpotlight = upcoming(spotlight.data ?? []);
    const fromFeed = upcoming(feed.filtered);
    const allUpcoming = upcoming(feed.upcoming);
    const events = (fromSpotlight.length > 0 ? fromSpotlight : fromFeed).slice(0, limit);
    const peopleGoing = allUpcoming
      .filter((e) => e.startsAt.getTime() < now + WEEK_MS)
      .reduce((sum, e) => sum + e.goingCount, 0);
    return { events, peopleGoing };
  }, [spotlight.data, feed.filtered, feed.upcoming, limit, nowDate]);
}
