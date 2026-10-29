import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { DayMeta } from '@/design';
import { api, CHARLOTTE_CITY_ID, METERS_PER_MILE, demoFeed, type FeedEvent, type FeedParams } from '@/lib/api';
import { isSameDay, toISODate } from '@/lib/dates';
import { isBackendConfigured } from '@/lib/env';

import { DISTANCES, matchesTimeOfDay } from './filters';
import { useFiltersStore } from './filtersStore';
import { CHARLOTTE_CENTER, getOrigin } from './origin';

/**
 * Keeps the previous data on screen while a filter change loads, but never across a day change
 * (the feed key holds the day at index 2), so switching days can't show the old day's events.
 */
export function keepIfSameDay(day: string) {
  return <T,>(prev: T | undefined, prevQuery?: { queryKey: readonly unknown[] }): T | undefined =>
    prevQuery?.queryKey[2] === day ? prev : undefined;
}

const FIVE_MINUTES = 5 * 60 * 1000;
const WIDEST_RADIUS_M = Math.round(Math.max(...DISTANCES) * METERS_PER_MILE);

/** Everything the Feed, the filters sheet and the map need, derived from the shared filters. */
export function useFeedEvents(): {
  /** Matches the filters, on any day the data covers (drives the date strip dots). */
  filtered: FeedEvent[];
  /** Matches the filters on the selected day, earliest first. */
  dayEvents: FeedEvent[];
  /** Same day, ignoring the filters: tells "no events today" apart from "filters removed them". */
  dayTotal: number;
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
  const params: FeedParams = {
    cityId: CHARLOTTE_CITY_ID,
    day: toISODate(selectedDay),
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
    queryKey: ['feed', params.cityId, params.day, params.lat, params.lng, params.radiusM, params.interestIds, params.price, params.mode],
    queryFn: () => api.getFeed(params),
    enabled: ready,
    placeholderData: keepIfSameDay(params.day),
    // Demo data is local, so it is there on the first frame.
    initialData: isBackendConfigured ? undefined : () => demoFeed(params),
  });

  // "No events today" vs "filters removed them" needs the same day with the filters off.
  const baselineParams: FeedParams = {
    ...params,
    radiusM: WIDEST_RADIUS_M,
    interestIds: [],
    price: 'any',
    mode: 'nearby',
  };
  const filtersActive =
    params.radiusM !== WIDEST_RADIUS_M || interestIds.length > 0 || price !== 'any' || scope !== 'nearby';
  const baseline = useQuery({
    queryKey: ['feed', params.cityId, params.day, params.lat, params.lng, baselineParams.radiusM, [], 'any', 'nearby'],
    queryFn: () => api.getFeed(baselineParams),
    enabled: ready && filtersActive,
    placeholderData: keepIfSameDay(params.day),
    initialData: isBackendConfigured ? undefined : () => demoFeed(baselineParams),
  });

  const data = feed.data;
  const isPlaceholder = feed.isPlaceholderData;
  const baselineData = baseline.data;

  const derived = useMemo(() => {
    const all = data ?? [];
    const filtered = all.filter((e) => matchesTimeOfDay(e.startsAt, timeOfDay));
    // Real data is already one day (in the city's time zone), and placeholder data is the previous day's.
    const onDay = (e: FeedEvent) => isBackendConfigured || (!isPlaceholder && isSameDay(e.startsAt, selectedDay));
    const dayEvents = filtered.filter(onDay).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    const totalSource = filtersActive ? (baselineData ?? all) : all;
    const dayTotal = totalSource.filter(onDay).length;
    const dayMeta: Record<string, DayMeta> = {};
    // Online, the data covers one day, so dots for other days would mislead.
    for (const e of isBackendConfigured ? [] : filtered) {
      const key = toISODate(e.startsAt);
      const m = dayMeta[key] ?? { count: 0, friendsGoing: false };
      dayMeta[key] = { count: m.count + 1, friendsGoing: m.friendsGoing || e.friendsGoing > 0 };
    }
    return { filtered, dayEvents, dayTotal, dayMeta };
  }, [data, baselineData, isPlaceholder, timeOfDay, selectedDay, filtersActive]);

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
