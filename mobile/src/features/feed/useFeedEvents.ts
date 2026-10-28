import { useMemo } from 'react';

import type { DayMeta, EventCardData } from '@/design';
import { isSameDay, toISODate } from '@/lib/dates';

import { getFixtureEvents } from './fixtures';
import { applyFilters } from './filters';
import { useFiltersStore } from './filtersStore';

/** Everything the Feed, the filters sheet and the map need, derived from the shared filters. */
export function useFeedEvents(): {
  /** Matches the filters, on any day (drives the date strip dots). */
  filtered: EventCardData[];
  /** Matches the filters on the selected day, earliest first. */
  dayEvents: EventCardData[];
  /** Same day, ignoring the filters: tells "no events today" apart from "filters removed them". */
  dayTotal: number;
  dayMeta: Record<string, DayMeta>;
} {
  const timeOfDay = useFiltersStore((s) => s.timeOfDay);
  const interests = useFiltersStore((s) => s.interests);
  const distanceMi = useFiltersStore((s) => s.distanceMi);
  const price = useFiltersStore((s) => s.price);
  const scope = useFiltersStore((s) => s.scope);
  const selectedDay = useFiltersStore((s) => s.selectedDay);

  const all = useMemo(() => getFixtureEvents(new Date()), []);

  return useMemo(() => {
    const filtered = applyFilters(all, { timeOfDay, interests, distanceMi, price, scope });
    const dayEvents = filtered
      .filter((e) => isSameDay(e.startsAt, selectedDay))
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    const dayTotal = all.filter((e) => isSameDay(e.startsAt, selectedDay)).length;
    const dayMeta: Record<string, DayMeta> = {};
    for (const e of filtered) {
      const key = toISODate(e.startsAt);
      const m = dayMeta[key] ?? { count: 0, friendsGoing: false };
      dayMeta[key] = { count: m.count + 1, friendsGoing: m.friendsGoing || e.friendsGoing > 0 };
    }
    return { filtered, dayEvents, dayTotal, dayMeta };
  }, [all, timeOfDay, interests, distanceMi, price, scope, selectedDay]);
}
