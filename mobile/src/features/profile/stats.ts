import type { EventCardData } from '@/design';
import { startOfDay } from '@/lib/dates';

import type { PlanStatus } from '../event/plansStore';

export type ProfileStats = { upcoming: number; friends: number; saved: number };

/**
 * Upcoming is the length of the plans the Profile lists (Going plus Down if friends go, not yet
 * past), so the number always matches the list. Saved = Interested (private).
 * Friends is 0 until the friends list exists.
 */
export function deriveProfileStats(
  statuses: Record<string, PlanStatus | undefined>,
  plans: readonly UpcomingPlan[],
  friendsCount = 0,
): ProfileStats {
  let saved = 0;
  for (const status of Object.values(statuses)) {
    if (status === 'interested') saved += 1;
  }
  return { upcoming: plans.length, friends: friendsCount, saved };
}

export type UpcomingPlan = { event: EventCardData; status: 'going' | 'down_if_friends' };

/**
 * The viewer's committed plans (Going, and Down if friends go) that have not passed, soonest first.
 * Interested events are bookmarks, so they stay in Saved instead.
 */
export function upcomingPlans(
  statuses: Record<string, PlanStatus | undefined>,
  events: EventCardData[],
  now: Date = new Date(),
): UpcomingPlan[] {
  const since = startOfDay(now).getTime();
  const plans: UpcomingPlan[] = [];
  for (const event of events) {
    const status = statuses[event.id];
    if ((status === 'going' || status === 'down_if_friends') && event.startsAt.getTime() >= since) {
      plans.push({ event, status });
    }
  }
  return plans.sort((a, b) => a.event.startsAt.getTime() - b.event.startsAt.getTime());
}
