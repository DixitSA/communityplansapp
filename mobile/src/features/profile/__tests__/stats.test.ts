import type { EventCardData } from '@/design';

import type { PlanStatus } from '../../event/plansStore';
import { deriveProfileStats, upcomingPlans } from '../stats';

const ev = (id: string, day: number, hour = 20): EventCardData => ({
  id,
  title: `Event ${id}`,
  startsAt: new Date(2026, 9, day, hour),
  venue: 'Somewhere',
  distanceMi: 1,
  interest: 'music',
  categoryLabel: 'Music',
  symbol: 'music.note',
  friends: [],
  friendsGoing: 0,
});

describe('deriveProfileStats', () => {
  const now = new Date(2026, 9, 28, 15);
  const events = [ev('a', 29), ev('b', 30), ev('c', 31), ev('d', 31, 22), ev('past', 20)];

  it('counts Going and Down if as Upcoming (matching the list) and Interested as Saved', () => {
    const statuses: Record<string, PlanStatus> = {
      a: 'going',
      b: 'going',
      c: 'interested',
      d: 'down_if_friends',
    };
    const plans = upcomingPlans(statuses, events, now);
    expect(deriveProfileStats(statuses, plans)).toEqual({ upcoming: 3, friends: 0, saved: 1 });
    expect(deriveProfileStats(statuses, plans).upcoming).toBe(plans.length);
  });

  it('does not count plans that have already passed', () => {
    const statuses: Record<string, PlanStatus> = { past: 'going', a: 'going' };
    expect(deriveProfileStats(statuses, upcomingPlans(statuses, events, now)).upcoming).toBe(1);
  });

  it('is all zeros with no plans, and passes friends through', () => {
    expect(deriveProfileStats({}, [])).toEqual({ upcoming: 0, friends: 0, saved: 0 });
    expect(deriveProfileStats({}, [], 4).friends).toBe(4);
  });

  it('ignores cleared entries', () => {
    expect(deriveProfileStats({ a: undefined }, []).saved).toBe(0);
  });
});

describe('upcomingPlans', () => {
  const now = new Date(2026, 9, 28, 15);
  const events = [ev('past', 26), ev('late', 30), ev('today', 28, 21), ev('soon', 29), ev('none', 29, 22), ev('saved', 29, 23)];

  it('lists Going and Down if plans, soonest first, without Interested or unplanned events', () => {
    const plans = upcomingPlans(
      { late: 'going', today: 'down_if_friends', soon: 'going', saved: 'interested' },
      events,
      now,
    );
    expect(plans.map((p) => [p.event.id, p.status])).toEqual([
      ['today', 'down_if_friends'],
      ['soon', 'going'],
      ['late', 'going'],
    ]);
  });

  it('drops events from earlier days but keeps ones later today', () => {
    expect(upcomingPlans({ past: 'going' }, events, now)).toEqual([]);
    expect(upcomingPlans({ today: 'going' }, events, now)).toHaveLength(1);
  });
});
