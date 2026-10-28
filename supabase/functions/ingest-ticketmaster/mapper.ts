// Pure mapping from a Ticketmaster Discovery v2 event to an `events` row.
// No Deno or network APIs here so it stays easy to test.

export interface TmImage { url: string; ratio?: string; width?: number; height?: number }
export interface TmEvent {
  id: string;
  name?: string;
  url?: string;
  info?: string;
  pleaseNote?: string;
  images?: TmImage[];
  dates?: {
    start?: { localDate?: string; localTime?: string; dateTime?: string; dateTBD?: boolean; dateTBA?: boolean; timeTBA?: boolean };
    status?: { code?: string };
  };
  priceRanges?: { type?: string; currency?: string; min?: number; max?: number }[];
  classifications?: { segment?: { name?: string }; genre?: { name?: string } }[];
  _embedded?: {
    venues?: {
      name?: string;
      address?: { line1?: string };
      city?: { name?: string };
      state?: { stateCode?: string };
      location?: { latitude?: string; longitude?: string };
    }[];
  };
}

export interface MapContext {
  cityId: number;
  /** interests.slug -> interests.id, fetched by the handler. */
  interestIds: Record<string, number>;
  timezone?: string;
}

export interface EventRow {
  source: "ticketmaster";
  external_id: string;
  city_id: number;
  title: string;
  description: string | null;
  starts_at: string;
  venue_name: string | null;
  venue_address: string | null;
  location: string;
  image_url: string | null;
  is_free: boolean;
  price_min: number | null;
  price_max: number | null;
  currency: string;
  ticket_url: string | null;
  attribution: string;
  status: "active" | "cancelled";
  /** Not a column: the handler strips this and writes event_interests. */
  interest_ids: number[];
}

const DEFAULT_TZ = "America/New_York";

/** Offset (ms) of `tz` from UTC at the given instant. */
function tzOffsetMs(instant: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", second: "numeric",
  }).formatToParts(new Date(instant));
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** Convert a wall-clock date/time in `tz` to a UTC ISO string. */
export function localToUtcIso(localDate: string, localTime: string, tz: string): string | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  const t = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(localTime);
  if (!d || !t) return null;
  const wall = Date.UTC(+d[1], +d[2] - 1, +d[3], +t[1], +t[2], +(t[3] ?? 0));
  let utc = wall - tzOffsetMs(wall, tz);
  utc = wall - tzOffsetMs(utc, tz); // second pass handles DST edges
  return new Date(utc).toISOString();
}

function startsAt(raw: TmEvent, tz: string): string | null {
  const s = raw.dates?.start;
  if (!s || s.dateTBA || s.dateTBD) return null;
  if (s.dateTime) {
    const ms = Date.parse(s.dateTime);
    return Number.isNaN(ms) ? null : new Date(ms).toISOString();
  }
  if (!s.localDate) return null;
  return localToUtcIso(s.localDate, s.localTime ?? "00:00:00", tz);
}

function pickImage(images: TmImage[] | undefined): string | null {
  const wide = (images ?? []).filter((i) => i.ratio === "16_9" && i.url);
  if (wide.length === 0) return null;
  return wide.reduce((a, b) => ((b.width ?? 0) > (a.width ?? 0) ? b : a)).url;
}

export function interestSlugs(raw: TmEvent): string[] {
  const c = raw.classifications?.[0];
  const segment = c?.segment?.name?.toLowerCase() ?? "";
  const genre = c?.genre?.name ?? "";
  const slugs: string[] = [];
  if (segment === "music") slugs.push("music");
  else if (segment === "sports") slugs.push("sports");
  else if (segment === "arts & theatre") slugs.push(genre.toLowerCase() === "comedy" ? "comedy" : "arts_culture");
  else if (segment === "film") slugs.push("arts_culture");
  else if (segment === "miscellaneous") slugs.push("community");
  if (/club|dance\/electronic/i.test(genre)) slugs.push("nightlife");
  return slugs;
}

export function mapTicketmasterEvent(raw: TmEvent, ctx: MapContext): EventRow | null {
  if (!raw?.id || !raw.name) return null;
  const starts_at = startsAt(raw, ctx.timezone ?? DEFAULT_TZ);
  if (!starts_at) return null;

  const venue = raw._embedded?.venues?.[0];
  const lat = Number(venue?.location?.latitude);
  const lng = Number(venue?.location?.longitude);
  if (!venue?.location?.latitude || !venue.location.longitude || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  const prices = raw.priceRanges ?? [];
  const mins = prices.map((p) => p.min).filter((n): n is number => typeof n === "number");
  const maxs = prices.map((p) => p.max).filter((n): n is number => typeof n === "number");
  const price_min = mins.length ? Math.min(...mins) : null;
  const price_max = maxs.length ? Math.max(...maxs) : null;
  const is_free = prices.length > 0 && price_max === 0 && price_min === 0;

  const addr = [venue.address?.line1, venue.city?.name, venue.state?.stateCode].filter(Boolean).join(", ");
  const desc = (raw.info ?? raw.pleaseNote ?? "").trim();
  const code = raw.dates?.status?.code?.toLowerCase();

  const interest_ids = [...new Set(interestSlugs(raw))]
    .map((s) => ctx.interestIds[s])
    .filter((id): id is number => typeof id === "number");

  return {
    source: "ticketmaster",
    external_id: raw.id,
    city_id: ctx.cityId,
    title: raw.name,
    description: desc ? desc.slice(0, 500) : null,
    starts_at,
    venue_name: venue.name ?? null,
    venue_address: addr || null,
    location: `SRID=4326;POINT(${lng} ${lat})`,
    image_url: pickImage(raw.images),
    is_free,
    price_min,
    price_max,
    currency: prices[0]?.currency ?? "USD",
    ticket_url: raw.url ?? null,
    attribution: "Tickets on Ticketmaster",
    status: code === "cancelled" || code === "canceled" ? "cancelled" : "active",
    interest_ids,
  };
}
