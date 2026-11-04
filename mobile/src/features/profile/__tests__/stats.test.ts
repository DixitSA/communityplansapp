import type { EventCardData } from '@/design';
import type { MyPlan } from '@/lib/api/types';

import { deriveProfileStats, splitMyPlans } from '../stats';

const ev = (id: string, day: number, hour = 20, endDay?: number): EventCardData => ({
  id,
  title: `Event ${id}`,
  startsAt: new Date(2026, 9, day, hour),
  endsAt: endDay ? new Date(2026, 9, endDay, 22) : undefined,
  venue: 'Somewhere',
  distanceMi: 1,
  interest: 'music',
  categoryLabel: 'Music',
  symbol: 'music.note',
  friends: [],
  friendsGoing: 0,
});

const now = new Date(2026, 9, 28, 15);

describe('splitMyPlans', () => {
  const plans: MyPlan[] = [
    { event: ev('late', 30), status: 'going' },
    { event: ev('today', 28, 21), status: 'down_if_friends' },
    { event: ev('saved2', 31), status: 'interested' },
    { event: ev('saved1', 29), status: 'interested' },
    { event: ev('past', 26), status: 'going' },
    { event: ev('pastSaved', 20), status: 'interested' },
  ];

  it('separates committed plans from Interested, soonest first, dropping past events', () => {
    const { upcoming, interested } = splitMyPlans(plans, now);
    expect(upcoming.map((p) => [p.event.id, p.status])).toEqual([
      ['today', 'down_if_friends'],
      ['late', 'going'],
    ]);
    expect(interested.map((e) => e.id)).toEqual(['saved1', 'saved2']);
  });

  it('keeps an event that started earlier but has not ended', () => {
    const { upcoming } = splitMyPlans([{ event: ev('multi', 26, 10, 29), status: 'going' }], now);
    expect(upcoming).toHaveLength(1);
  });

  it('is empty with no plans', () => {
    expect(splitMyPlans([], now)).toEqual({ upcoming: [], interested: [] });
  });
});

describe('deriveProfileStats', () => {
  it('counts from the split lists and passes friends through', () => {
    const split = splitMyPlans(
      [
        { event: ev('a', 29), status: 'going' },
        { event: ev('b', 30), status: 'interested' },
        { event: ev('c', 31), status: 'interested' },
      ],
      now,
    );
    expect(deriveProfileStats(split, 4)).toEqual({ upcoming: 1, friends: 4, interested: 2 });
    expect(deriveProfileStats({ upcoming: [], interested: [] })).toEqual({ upcoming: 0, friends: 0, interested: 0 });
  });
});
