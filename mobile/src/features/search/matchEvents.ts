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
