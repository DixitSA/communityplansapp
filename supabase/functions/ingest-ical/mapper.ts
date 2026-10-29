// Pure mapping from a parsed VEVENT to an `events` row.
import { toUtcIso, type VEvent } from "./ics.ts";

export interface IcalSource {
  id: string;
  name: string;
  city_id: number;
  default_interest_slugs: string[] | null;
  default_lat: number | null;
  default_lng: number | null;
  default_venue_name: string | null;
}

export interface MapContext {
  /** interests.slug -> interests.id, fetched by the handler. */
  interestIds: Record<string, number>;
  now: Date;
  timezone?: string;
  windowDays?: number;
}

export interface EventRow {
  source: "ical";
  external_id: string;
  city_id: number;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  venue_name: string | null;
  location: string;
  image_url: null;
  ticket_url: string | null;
  attribution: string;
  status: "active" | "cancelled";
  /** Not a column: the handler strips this and writes event_interests. */
  interest_ids: number[];
}

const DEFAULT_TZ = "America/New_York";
const DAY = 86_400_000;

const validPoint = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);

function httpsOnly(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/** Returns null when the event is skipped (recurring, all-day, no time/location, outside the window). */
export function mapIcalEvent(ev: VEvent, source: IcalSource, ctx: MapContext): EventRow | null {
  if (!ev.uid || !ev.summary || ev.recurring) return null;
  const tz = ctx.timezone ?? DEFAULT_TZ;
  const starts_at = toUtcIso(ev.dtstart, tz);
  if (!starts_at) return null; // missing, unparseable or all-day
  const startMs = Date.parse(starts_at);
  const now = ctx.now.getTime();
  if (startMs < now || startMs > now + (ctx.windowDays ?? 30) * DAY) return null;
  const endIso = toUtcIso(ev.dtend, tz);
  const ends_at = endIso && Date.parse(endIso) > startMs ? endIso : null;

  let lat: number, lng: number;
  if (ev.geo && validPoint(ev.geo.lat, ev.geo.lng)) {
    ({ lat, lng } = ev.geo);
  } else if (source.default_lat != null && source.default_lng != null && validPoint(source.default_lat, source.default_lng)) {
    lat = source.default_lat;
    lng = source.default_lng;
  } else {
    return null;
  }

  const venue = ev.location?.split(",")[0].trim() || source.default_venue_name || null;
  const desc = (ev.description ?? "").trim();
  const interest_ids = [...new Set(source.default_interest_slugs ?? [])]
    .map((s) => ctx.interestIds[s])
    .filter((id): id is number => typeof id === "number");

  return {
    source: "ical",
    external_id: `${source.id}:${ev.uid}`,
    city_id: source.city_id,
    title: ev.summary,
    description: desc ? (desc.length > 500 ? desc.slice(0, 499) + "…" : desc) : null,
    starts_at,
    ends_at,
    venue_name: venue,
    location: `SRID=4326;POINT(${lng} ${lat})`,
    image_url: null,
    ticket_url: httpsOnly(ev.url),
    attribution: source.name,
    status: ev.status === "CANCELLED" ? "cancelled" : "active",
    interest_ids,
  };
}
