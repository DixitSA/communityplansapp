// Pure geo helpers for the geocoding step.

export const FALLBACK_CENTER = { lat: 35.2271, lng: -80.8431 };
export const MAX_KM_FROM_CENTER = 60;

/** Cache key: lowercased, whitespace-collapsed address. */
export const addressKey = (a: string) => a.toLowerCase().replace(/["\\]/g, "").replace(/\s+/g, " ").trim();

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (x: number) => (x * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

export function withinCity(p: { lat: number; lng: number }, center = FALLBACK_CENTER): boolean {
  return Number.isFinite(p.lat) && Number.isFinite(p.lng) && haversineKm(p, center) <= MAX_KM_FROM_CENTER;
}

/** PostgREST returns geography as hex EWKB ("0101000020E6100000" + x + y, little-endian doubles). */
export function parseEwkbPoint(hex: unknown): { lat: number; lng: number } | null {
  if (typeof hex !== "string" || !/^[0-9a-f]+$/i.test(hex) || hex.length < 50) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  const view = new DataView(bytes.buffer);
  const little = bytes[0] === 1;
  const hasSrid = (view.getUint32(1, little) & 0x20000000) !== 0;
  const off = hasSrid ? 9 : 5;
  const lng = view.getFloat64(off, little), lat = view.getFloat64(off + 8, little);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

/** First match from a Census Geocoder onelineaddress response, or null. */
export function parseCensus(body: unknown): { lat: number; lng: number } | null {
  const m = (body as { result?: { addressMatches?: { coordinates?: { x?: number; y?: number } }[] } })
    ?.result?.addressMatches?.[0]?.coordinates;
  if (typeof m?.x !== "number" || typeof m.y !== "number") return null;
  return { lat: m.y, lng: m.x };
}
