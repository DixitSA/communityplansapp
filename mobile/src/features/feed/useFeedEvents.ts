import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { DayMeta } from '@/design';
import { api, CHARLOTTE_CITY_ID, METERS_PER_MILE, demoFeedRange, type FeedEvent, type FeedRangeParams } from '@/lib/api';
import { toISODate } from '@/lib/dates';
import { isBackendConfigured } from '@/lib/env';

import { dayMetaFrom, groupByDay, type AgendaSection } from './agenda';
import { DISTANCES, matchesTimeOfDay } from './filters';
import { useFiltersStore } from './filtersStore';
import { CHARLOTTE_CENTER, getOrigin } from './origin';

/**
 * Keeps the previous data on screen while a filter change loads, but never across a change of the
 * range's first day (the feed key holds it at index 2), so a new range can't show the old one's events.
 */
export function keepIfSameStart(start: string) {
  return <T,>(prev: T | undefined, prevQuery?: { queryKey: readonly unknown[] }): T | undefined =>
    prevQuery?.queryKey[2] === start ? prev : undefined;
}

/** How many days the agenda loads at once (the server's maximum). */
export const AGENDA_DAYS = 14;

const FIVE_MINUTES = 5 * 60 * 1000;
const WIDEST_RADIUS_M = Math.round(Math.max(...DISTANCES) * METERS_PER_MILE);

/** Everything the Feed, the filters sheet and the map need, derived from the shared filters. */
export function useFeedEvents(): {
  /** Matches the filters, over the whole 14 days, earliest first. */
  filtered: FeedEvent[];
  /** `filtered` grouped by local day (days without events are left out): the agenda's sections. */
  sections: AgendaSection<FeedEvent>[];
  /** Matches the filters on the selected day, earliest first (the map's pins). */
  dayEvents: FeedEvent[];
  /** The 14 days with the filters off: tells "nothing planned" apart from "filters removed it all". */
  total: number;
  dayMeta: Record<string, DayMeta>;
  /** First load, nothing to show yet. */
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const timeOfDay = useFiltersStore((s) => s.timeOfDay);
  const interests = useFiltersStore((s) => s.interests);
  const distanceMi = useFiltersStore((s) => s.distanceMi);
  const price = useFiltersStore((s) => s.price);
  const scope = useFiltersStore((s) => s.scope);
  const selectedDay = useFiltersStore((s) => s.selectedDay);

  // Origin: the device's position if permission was already granted, else Charlotte's center.
  const origin = useQuery({ queryKey: ['origin'], queryFn: getOrigin, staleTime: FIVE_MINUTES, enabled: isBackendConfigured });
  const interestList = useQuery({
    queryKey: ['interests'],
    queryFn: () => api.listInterests(),
    staleTime: Infinity,
    enabled: isBackendConfigured && interests.length > 0,
  });

  const where = origin.data ?? CHARLOTTE_CENTER;
  const interestIds = useMemo(
    () => (interestList.data ?? []).filter((i) => interests.includes(i.slug)).map((i) => i.id),
    [interestList.data, interests],
  );
  const today = toISODate(new Date());
  const params: FeedRangeParams = {
    cityId: CHARLOTTE_CITY_ID,
    start: today,
    days: AGENDA_DAYS,
    lat: where.lat,
    lng: where.lng,
    radiusM: Math.round(distanceMi * METERS_PER_MILE),
    interestIds,
    price,
    mode: scope,
  };
  const ready = !isBackendConfigured || (origin.isFetched && (interests.length === 0 || interestList.isSuccess));

  // The key holds every input, so any filter change is a new query (the old data stays up meanwhile).
  const feed = useQuery({
    queryKey: ['feed', params.cityId, params.start, params.lat, params.lng, params.radiusM, params.interestIds, params.price, params.mode],
    queryFn: () => api.getFeedRange(params),
    enabled: ready,
    placeholderData: keepIfSameStart(params.start),
    // Demo data is local, so it is there on the first frame.
    initialData: isBackendConfigured ? undefined : () => demoFeedRange(params),
  });

  // "Nothing planned" vs "filters removed it" needs the same range with the filters off.
  const baselineParams: FeedRangeParams = {
    ...params,
    radiusM: WIDEST_RADIUS_M,
    interestIds: [],
    price: 'any',
    mode: 'nearby',
  };
  const filtersActive =
    params.radiusM !== WIDEST_RADIUS_M || interestIds.length > 0 || price !== 'any' || scope !== 'nearby';
  const baseline = useQuery({
    queryKey: ['feed', params.cityId, params.start, params.lat, params.lng, baselineParams.radiusM, [], 'any', 'nearby'],
    queryFn: () => api.getFeedRange(baselineParams),
    enabled: ready && filtersActive,
    placeholderData: keepIfSameStart(params.start),
    initialData: isBackendConfigured ? undefined : () => demoFeedRange(baselineParams),
  });

  const data = feed.data;
  const baselineData = baseline.data;
  const selectedISO = toISODate(selectedDay);

  const derived = useMemo(() => {
    const all = data ?? [];
    // The time-of-day chip is applied here, so changing it never refetches.
    const filtered = all.filter((e) => matchesTimeOfDay(e.startsAt, timeOfDay));
    const sections = groupByDay(filtered, today);
    const dayEvents = sections.find((s) => s.day === selectedISO)?.data ?? [];
    const total = (filtersActive ? (baselineData ?? all) : all).length;
    return { filtered, sections, dayEvents, total, dayMeta: dayMetaFrom(filtered) };
  }, [data, baselineData, timeOfDay, selectedISO, filtersActive, today]);

  return {
    ...derived,
    // A failed interests lookup keeps the feed query disabled, so it must end loading too (else: endless spinner).
    isLoading: feed.data === undefined && !feed.isError && !interestList.isError,
    isError: (feed.isError && feed.data === undefined) || interestList.isError,
    refetch: () => {
      void feed.refetch();
      if (interestList.isError) void interestList.refetch();
    },
  };
}
