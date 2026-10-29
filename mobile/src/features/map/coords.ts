import { unitFrom } from '@/lib/hash';

export type LatLng = { latitude: number; longitude: number };

/** Center of the map: Uptown Charlotte. */
export const CHARLOTTE: LatLng = { latitude: 35.2271, longitude: -80.8431 };

type Neighborhood = { name: string; center: LatLng; keywords: string[] };

// Sample events only have a venue name, so match it to a neighborhood by keyword.
// Once the backend gives real coordinates, this file is only used as a fallback.
export const NEIGHBORHOODS: Neighborhood[] = [
  { name: 'Uptown', center: { latitude: 35.2271, longitude: -80.8431 }, keywords: ['uptown'] },
  { name: 'South End', center: { latitude: 35.2121, longitude: -80.8575 }, keywords: ['south end', 'district'] },
  { name: 'NoDa', center: { latitude: 35.2467, longitude: -80.8092 }, keywords: ['noda', 'haberdish'] },
  { name: 'Plaza Midwood', center: { latitude: 35.2236, longitude: -80.8021 }, keywords: ['plaza midwood'] },
  { name: 'Camp North End', center: { latitude: 35.2393, longitude: -80.8244 }, keywords: ['camp north end'] },
  { name: 'Freedom Park', center: { latitude: 35.2025, longitude: -80.8266 }, keywords: ['freedom park'] },
];

/** Neighborhood for a venue string, falling back to Uptown. */
export function neighborhoodFor(venue: string): Neighborhood {
  const v = venue.toLowerCase();
  return NEIGHBORHOODS.find((n) => n.keywords.some((k) => v.includes(k))) ?? NEIGHBORHOODS[0];
}

/** Largest offset from the neighborhood center, in degrees (about 400 m). */
export const JITTER_DEG = 0.0035;

/**
 * Where to put an event's pin. The neighborhood center plus an offset that depends only on the
 * event id, so pins in the same neighborhood don't stack and never move between renders.
 */
export function coordsForEvent(e: { id: string; venue: string; lat?: number; lng?: number }): LatLng {
  // Real events carry their own coordinates; only sample events need a guess.
  if (e.lat !== undefined && e.lng !== undefined) return { latitude: e.lat, longitude: e.lng };
  const { center } = neighborhoodFor(e.venue);
  return {
    latitude: center.latitude + (unitFrom(e.id, 'lat') - 0.5) * 2 * JITTER_DEG,
    longitude: center.longitude + (unitFrom(e.id, 'lng') - 0.5) * 2 * JITTER_DEG,
  };
}
