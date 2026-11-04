import type { EventCardData } from '@/design';
import { startOfDay } from '@/lib/dates';

import type { MyPlan } from '@/lib/api/types';

export type ProfileStats = { upcoming: number; friends: number; interested: number };

export type UpcomingPlan = { event: EventCardData; status: 'going' | 'down_if_friends' };

/** The viewer's plans, split the way Profile shows them. */
export type SplitPlans = { upcoming: UpcomingPlan[]; interested: EventCardData[] };

/**
 * Splits the viewer's plans into committed ones (Going, and Down if friends go) and Interested
 * bookmarks. Events that ended before today are dropped; both lists are soonest first.
 */
export function splitMyPlans(plans: readonly MyPlan[], now: Date = new Date()): SplitPlans {
  const since = startOfDay(now).getTime();
  const live = plans
    .filter((p) => (p.event.endsAt ?? p.event.startsAt).getTime() >= since)
    .sort((a, b) => a.event.startsAt.getTime() - b.event.startsAt.getTime());
  const upcoming: UpcomingPlan[] = [];
  const interested: EventCardData[] = [];
  for (const { event, status } of live) {
    if (status === 'interested') interested.push(event);
    else upcoming.push({ event, status });
  }
  return { upcoming, interested };
}

/** Counts come from the same lists Profile shows, so the numbers always match. Interested is private. */
export function deriveProfileStats(split: SplitPlans, friendsCount = 0): ProfileStats {
  return { upcoming: split.upcoming.length, friends: friendsCount, interested: split.interested.length };
}
