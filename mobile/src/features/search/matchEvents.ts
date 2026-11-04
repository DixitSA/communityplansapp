import { neighborhoodFor } from '@/features/feed/neighborhoods';

export type SearchMode = 'events' | 'people';

export type SearchableEvent = {
  title: string;
  venue: string;
  neighborhood?: string;
  categoryLabel: string;
  lat?: number;
  lng?: number;
};

/** A query that starts with "@" is a username search, so it belongs to People. */
export function isPeopleQuery(query: string): boolean {
  return query.trimStart().startsWith('@');
}

/** Case-insensitive match on title, venue, neighborhood and category. Keeps the input (feed) order. */
export function matchEvents<T extends SearchableEvent>(events: readonly T[], query: string): T[] {
  // A leading "@" means a person; if someone switches to Events anyway, search the rest.
  const q = query.trim().replace(/^@/, '').toLowerCase();
  if (!q) return [];
  return events.filter((e) =>
    [e.title, e.venue, e.neighborhood, neighborhoodFor(e)?.name, e.categoryLabel].some((f) =>
      f?.toLowerCase().includes(q),
    ),
  );
}

export type SearchShortcuts = { neighborhoods: string[]; categories: string[] };

function topByCount(values: (string | undefined)[], max: number): string[] {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  // Array sort is stable, so ties keep first-seen (feed) order.
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([name]) => name);
}

/** Tap-to-search suggestions from the events on offer: busiest neighborhoods and categories. */
export function searchShortcuts(events: readonly SearchableEvent[], maxNeighborhoods = 3, maxCategories = 6): SearchShortcuts {
  return {
    neighborhoods: topByCount(events.map((e) => neighborhoodFor(e)?.name ?? e.neighborhood), maxNeighborhoods),
    categories: topByCount(events.map((e) => e.categoryLabel), maxCategories),
  };
}
