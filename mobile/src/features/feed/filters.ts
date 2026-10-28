import type { SymbolName } from '@/design';

import { addDays, startOfDay } from '@/lib/dates';

import { deriveDistanceMi, derivePriceUsd } from './derive';

export type TimeOfDay = 'any' | 'morning' | 'afternoon' | 'tonight';
export type DistanceMi = 1 | 5 | 10 | 25 | 50;
export type Price = 'any' | 'free' | 'paid';
export type FeedView = 'list' | 'map';
export type Scope = 'nearby' | 'friends';

/** The part of the filter state that decides which events match. */
export type FilterCriteria = {
  timeOfDay: TimeOfDay;
  /** Interest slugs. Empty means every interest. */
  interests: string[];
  distanceMi: DistanceMi;
  price: Price;
  scope: Scope;
};

export const DEFAULT_CRITERIA: FilterCriteria = {
  timeOfDay: 'any',
  interests: [],
  distanceMi: 10,
  price: 'any',
  scope: 'nearby',
};

export const DISTANCES: readonly DistanceMi[] = [1, 5, 10, 25, 50];

export const TIME_OPTIONS: { value: TimeOfDay; label: string }[] = [
  { value: 'any', label: 'Any time' },
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'tonight', label: 'Tonight' },
];

export const PRICE_OPTIONS: { value: Price; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'free', label: 'Free' },
  { value: 'paid', label: 'Paid' },
];

export const INTEREST_OPTIONS: { slug: string; label: string; symbol: SymbolName }[] = [
  { slug: 'music', label: 'Music', symbol: 'music.note' },
  { slug: 'food_drinks', label: 'Food & Drinks', symbol: 'fork.knife' },
  { slug: 'fitness', label: 'Fitness', symbol: 'figure.run' },
  { slug: 'arts_culture', label: 'Arts & Culture', symbol: 'paintpalette.fill' },
  { slug: 'nightlife', label: 'Nightlife', symbol: 'moon.stars.fill' },
];

/** The least an event needs to be filtered. Price and distance are derived when missing. */
export type FilterableEvent = {
  id: string;
  startsAt: Date;
  interest: string;
  friendsGoing: number;
  distanceMi?: number;
  priceUsd?: number;
};

const TONIGHT_FROM_HOUR = 17;

export function matchesTimeOfDay(startsAt: Date, timeOfDay: TimeOfDay): boolean {
  const h = startsAt.getHours();
  switch (timeOfDay) {
    case 'any':
      return true;
    case 'morning':
      return h < 12;
    case 'afternoon':
      return h >= 12 && h < TONIGHT_FROM_HOUR;
    case 'tonight':
      return h >= TONIGHT_FROM_HOUR;
  }
}

export function eventPriceUsd(e: FilterableEvent): number {
  return e.priceUsd ?? derivePriceUsd(e.id);
}

export function eventDistanceMi(e: FilterableEvent): number {
  return e.distanceMi ?? deriveDistanceMi(e.id);
}

/** Pure: keeps the events that match every active filter. Does not look at the selected day. */
export function applyFilters<T extends FilterableEvent>(events: T[], f: FilterCriteria): T[] {
  return events.filter((e) => {
    if (f.scope === 'friends' && e.friendsGoing <= 0) return false;
    if (!matchesTimeOfDay(e.startsAt, f.timeOfDay)) return false;
    if (f.interests.length > 0 && !f.interests.includes(e.interest)) return false;
    if (eventDistanceMi(e) > f.distanceMi) return false;
    if (f.price !== 'any') {
      const isFree = eventPriceUsd(e) === 0;
      if (f.price === 'free' && !isFree) return false;
      if (f.price === 'paid' && isFree) return false;
    }
    return true;
  });
}

/** True when the filters (not the Nearby/Friends scope) are all at their defaults. */
export function isDefaultFilters(f: FilterCriteria): boolean {
  return (
    f.timeOfDay === DEFAULT_CRITERIA.timeOfDay &&
    f.interests.length === 0 &&
    f.distanceMi === DEFAULT_CRITERIA.distanceMi &&
    f.price === DEFAULT_CRITERIA.price
  );
}

export type ChipState = { label: string; active: boolean };

/** Label and "filled" state for the three filter chips. A chip is active when its filter isn't at the default. */
export function chipStates(f: FilterCriteria): { time: ChipState; interests: ChipState; distance: ChipState } {
  const timeLabel = TIME_OPTIONS.find((o) => o.value === f.timeOfDay)?.label ?? 'Any time';
  let interestsLabel = 'Interests';
  if (f.interests.length === 1) {
    interestsLabel = INTEREST_OPTIONS.find((o) => o.slug === f.interests[0])?.label ?? 'Interests';
  } else if (f.interests.length > 1) {
    interestsLabel = `Interests · ${f.interests.length}`;
  }
  // Price lives only in the sheet, so it lights up the Interests chip (which opens that sheet).
  const interestsActive = f.interests.length > 0 || f.price !== DEFAULT_CRITERIA.price;
  return {
    time: { label: timeLabel, active: f.timeOfDay !== DEFAULT_CRITERIA.timeOfDay },
    interests: { label: interestsLabel, active: interestsActive },
    distance: { label: `${f.distanceMi} mi`, active: f.distanceMi !== DEFAULT_CRITERIA.distanceMi },
  };
}

/**
 * The first day after `from` that has at least one of `events` (pass the already-filtered list),
 * as local midnight. `null` when nothing is coming up. Drives the empty state's "Try Fri, Oct 30".
 */
export function nextDayWithEvents(events: { startsAt: Date }[], from: Date): Date | null {
  const cutoff = addDays(startOfDay(from), 1).getTime();
  let best: number | null = null;
  for (const e of events) {
    const t = e.startsAt.getTime();
    if (t >= cutoff && (best === null || t < best)) best = t;
  }
  return best === null ? null : startOfDay(new Date(best));
}
