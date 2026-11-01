import type { CategorySlug } from '@/design';

/**
 * Charlotte's launch neighborhoods (PRD), each with a rough center and reach, plus a color borrowed from
 * the category palette so every chip looks different. Events get the closest one they fall inside,
 * measured relative to its reach; events outside all of them simply have no neighborhood.
 */
export type Neighborhood = {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  radiusMi: number;
  tint: CategorySlug;
};

export const NEIGHBORHOODS: readonly Neighborhood[] = [
  { slug: 'uptown', name: 'Uptown', lat: 35.2271, lng: -80.8431, radiusMi: 1.0, tint: 'food_drinks' },
  { slug: 'south-end', name: 'South End', lat: 35.206, lng: -80.862, radiusMi: 1.1, tint: 'music' },
  { slug: 'noda', name: 'NoDa', lat: 35.2475, lng: -80.803, radiusMi: 0.8, tint: 'nightlife' },
  { slug: 'plaza-midwood', name: 'Plaza Midwood', lat: 35.221, lng: -80.81, radiusMi: 0.8, tint: 'arts_culture' },
  { slug: 'camp-north-end', name: 'Camp North End', lat: 35.241, lng: -80.829, radiusMi: 0.8, tint: 'fitness' },
];

const EARTH_RADIUS_MI = 3958.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in miles. */
export function milesBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.sqrt(h));
}

/** A neighborhood name from the listing, like "NoDa" or "Optimist Park", matched to ours. */
function byName(name: string): Neighborhood | null {
  const n = name.trim().toLowerCase();
  if (n === 'optimist park') return NEIGHBORHOODS.find((h) => h.slug === 'camp-north-end') ?? null;
  return NEIGHBORHOODS.find((h) => h.name.toLowerCase() === n) ?? null;
}

/** The event's neighborhood: the listing's own when it names one of ours, else the closest one it falls inside. */
export function neighborhoodFor(e: { lat?: number; lng?: number; neighborhood?: string }): Neighborhood | null {
  const named = e.neighborhood ? byName(e.neighborhood) : null;
  if (named) return named;
  if (e.lat === undefined || e.lng === undefined || !Number.isFinite(e.lat) || !Number.isFinite(e.lng)) return null;
  let best: Neighborhood | null = null;
  let bestReach = Infinity;
  for (const h of NEIGHBORHOODS) {
    // Relative to each neighborhood's size, so a big one doesn't swallow its smaller neighbors.
    const reach = milesBetween(e.lat, e.lng, h.lat, h.lng) / h.radiusMi;
    if (reach <= 1 && reach < bestReach) {
      best = h;
      bestReach = reach;
    }
  }
  return best;
}

/** How many events each neighborhood has, in launch order, leaving out the empty ones. */
export function neighborhoodCounts(
  events: { lat?: number; lng?: number; neighborhood?: string }[],
): { hood: Neighborhood; count: number }[] {
  const counts = new Map<string, number>();
  for (const e of events) {
    const h = neighborhoodFor(e);
    if (h) counts.set(h.slug, (counts.get(h.slug) ?? 0) + 1);
  }
  return NEIGHBORHOODS.filter((h) => counts.has(h.slug)).map((hood) => ({ hood, count: counts.get(hood.slug) ?? 0 }));
}
