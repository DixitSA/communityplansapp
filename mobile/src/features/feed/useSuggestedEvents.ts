import { useMemo } from 'react';

import type { FeedEvent } from '@/lib/api';
import { useNow } from '@/lib/useNow';

import { useFeedEvents } from './useFeedEvents';
import { useSpotlight } from './useSpotlight';

/**
 * Real upcoming events to point newcomers at from empty screens. Uses the spotlight ("popping this
 * week") and falls back to the feed. `peopleGoing` is a count only: never names.
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
    const events = (fromSpotlight.length > 0 ? fromSpotlight : fromFeed).slice(0, limit);
    const peopleGoing = fromFeed.reduce((sum, e) => sum + e.goingCount, 0);
    return { events, peopleGoing };
  }, [spotlight.data, feed.filtered, limit, nowDate]);
}
