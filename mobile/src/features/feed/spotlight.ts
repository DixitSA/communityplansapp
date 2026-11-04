import { applyFilters, type FilterCriteria, type FilterableEvent } from './filters';
import { neighborhoodFor } from './neighborhoods';

type SpotlightFilterable = FilterableEvent & { lat?: number; lng?: number; neighborhood?: string };

/** Pure: the "Popping this week" rail follows the same filters as the agenda (scope, time, interests, distance, price, neighborhood). */
export function filterSpotlight<T extends SpotlightFilterable>(
  events: T[],
  criteria: FilterCriteria,
  neighborhood: string | null | undefined,
): T[] {
  const filtered = applyFilters(events, criteria);
  return neighborhood ? filtered.filter((e) => neighborhoodFor(e)?.slug === neighborhood) : filtered;
}
