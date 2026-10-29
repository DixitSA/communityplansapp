// Pure mapping from a SerpApi google_events result to an `events` row (minus `location`,
// which the handler adds after geocoding). No Deno or network APIs except Web Crypto.

export interface SerpEvent {
  title?: string;
  date?: { start_date?: string; when?: string };
  address?: string[];
  link?: string;
  description?: string;
  ticket_info?: { source?: string; link?: string; link_type?: string }[];
  venue?: { name?: string; rating?: number; reviews?: number; link?: string };
  thumbnail?: string;
  image?: string;
  event_location_map?: { image?: string; link?: string; serpapi_link?: string };
}

export interface MapContext {
  cityId: number;
  /** interests.slug -> interests.id, fetched by the handler. */
  interestIds: Record<string, number>;
  now: Date;
  timezone?: string;
  windowDays?: number;
}

export interface SerpRow {
  source: "serpapi";
  external_id: string;
  city_id: number;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  venue_name: string | null;
  venue_address: string | null;
  image_url: string | null;
  is_free: boolean;
  price_min: null;
  ticket_url: string | null;
  attribution: string;
  status: "active";
  /** Not columns: the handler uses these and strips them before the upsert. */
  geocode_query: string;
  geocode_has_street: boolean;
  interest_ids: number[];
}

const DEFAULT_TZ = "America/New_York";
const DAY = 86_400_000;
const MAX_TEXT = 200;
const ASSUMED_DURATION_MS = 3 * 3_600_000; // events with no end time count as over 3 h after the start

// ---------- time zone helpers (same approach as the Ticketmaster mapper) ----------

function tzOffsetMs(instant: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", second: "numeric",
  }).formatToParts(new Date(instant));
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")) -
    Math.floor(instant / 1000) * 1000;
}

/** Wall-clock time in `tz` to a UTC epoch (ms). */
function wallToUtc(y: number, mo: number, d: number, h: number, mi: number, tz: string): number {
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  let utc = wall - tzOffsetMs(wall, tz);
  utc = wall - tzOffsetMs(utc, tz); // second pass handles DST edges
  return utc;
}

interface Day { y: number; m: number; d: number }
const dayMs = (x: Day) => Date.UTC(x.y, x.m - 1, x.d);
const fromMs = (ms: number): Day => {
  const t = new Date(ms);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
};
const addDays = (x: Day, n: number): Day => fromMs(dayMs(x) + n * DAY);
const pad = (n: number) => String(n).padStart(2, "0");
export const dayKey = (x: Day) => `${x.y}-${pad(x.m)}-${pad(x.d)}`;

function localDay(instant: Date, tz: string): Day {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "numeric", day: "numeric" })
    .formatToParts(instant);
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: g("year"), m: g("month"), d: g("day") };
}

/** Earliest real calendar date for month/day on or after `ref`. */
function nearestOnOrAfter(month: number, day: number, ref: Day): Day | null {
  for (let y = ref.y; y <= ref.y + 2; y++) {
    const cand = { y, m: month, d: day };
    const norm = fromMs(dayMs(cand));
    if (norm.m !== month || norm.d !== day) continue; // e.g. Feb 29 in a non-leap year
    if (dayMs(cand) >= dayMs(ref)) return cand;
  }
  return null;
}

// ---------- parsing the free-text `when` ----------

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const WEEKDAY = "(?:(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*\\.?,?\\s*)?";
const DATE_RE = new RegExp(
  `${WEEKDAY}\\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?\\s+(\\d{1,2})\\b(?!:)`,
  "i",
);
const REL_RE = /\b(today|tonight|tomorrow)\b/i;
const TZ_RE = /\b(?:EDT|EST|ET|UTC|GMT)\b/gi;

interface Time { h: number; min: number; mer: "am" | "pm" | null }
interface Part { rel: "today" | "tomorrow" | null; md: { m: number; d: number } | null; time: Time | null }

function parsePart(raw: string): Part {
  let s = raw.replace(TZ_RE, " ");
  let rel: Part["rel"] = null;
  let md: Part["md"] = null;
  const r = REL_RE.exec(s);
  if (r) {
    rel = r[1].toLowerCase() === "tomorrow" ? "tomorrow" : "today";
    s = s.replace(REL_RE, " ");
  } else {
    const m = DATE_RE.exec(s);
    if (m) {
      md = { m: MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1, d: Number(m[2]) };
      s = s.replace(DATE_RE, " ");
    }
  }
  s = s.replace(/[,\s]+/g, " ").trim();
  const t = /^(\d{1,2})(?::(\d{2}))?\s*(?:([ap])\.?m?\.?)?$/i.exec(s);
  let time: Time | null = null;
  if (t) {
    const h = Number(t[1]), min = Number(t[2] ?? 0);
    const mer = t[3] ? (t[3].toLowerCase() === "p" ? "pm" : "am") : null;
    if (min < 60 && (mer ? h >= 1 && h <= 12 : h <= 23)) time = { h, min, mer };
  }
  return { rel, md, time };
}

function hour24(t: Time, mer: "am" | "pm" | null): number {
  if (mer === "pm") return (t.h % 12) + 12;
  if (mer === "am") return t.h % 12;
  return t.h; // 24-hour clock
}

export interface ParsedWhen { startMs: number; endMs: number | null; startDay: Day }

/**
 * Parses Google's `when` text. Returns null for anything without a clear start time
 * (date only, date range without times, missing text, ambiguous AM/PM).
 */
export function parseWhen(when: string | undefined | null, now: Date, tz = DEFAULT_TZ): ParsedWhen | null {
  if (!when) return null;
  const parts = when.replace(/[–—]/g, "–").split(/\s*–\s*|\s+-\s+|\s+to\s+/i);
  if (parts.length > 2) return null;
  const left = parsePart(parts[0]);
  const right = parts[1] !== undefined ? parsePart(parts[1]) : null;
  if (!left.time) return null; // date only, or "Nov 1 – 3"
  if (!left.rel && !left.md) return null;

  const today = localDay(now, tz);
  let startDay: Day | null;
  if (left.rel) startDay = left.rel === "tomorrow" ? addDays(today, 1) : today;
  else startDay = nearestOnOrAfter(left.md!.m, left.md!.d, addDays(today, -1));
  if (!startDay) return null;

  let endDay: Day | null = startDay;
  let explicitEndDay = false;
  if (right?.rel) {
    endDay = right.rel === "tomorrow" ? addDays(today, 1) : today;
    explicitEndDay = true;
  } else if (right?.md) {
    endDay = nearestOnOrAfter(right.md.m, right.md.d, startDay);
    explicitEndDay = true;
  }

  // Resolve AM/PM. "8 – 11 PM": the start borrows from the end; pick the reading that doesn't end before it starts.
  const rt = right?.time ?? null;
  let startMer = left.time.mer;
  let endMer = rt?.mer ?? null;
  if (!startMer) {
    if (left.time.h > 12) startMer = null; // 24-hour
    else if (endMer) {
      const sameDay = !explicitEndDay || (endDay && dayMs(endDay) === dayMs(startDay));
      const other = endMer === "am" ? "pm" : "am";
      const endH = rt ? hour24(rt, endMer) * 60 + rt.min : 0;
      const fits = (m: "am" | "pm") => hour24(left.time!, m) * 60 + left.time!.min <= endH;
      startMer = !sameDay || fits(endMer) ? endMer : fits(other) ? other : endMer === "am" ? "pm" : endMer;
    } else if (left.time.h <= 12) {
      return null; // "Fri, Nov 1, 8" is ambiguous
    }
  }
  if (rt && !endMer && startMer && rt.h <= 12) endMer = startMer;

  const startMs = wallToUtc(startDay.y, startDay.m, startDay.d, hour24(left.time, startMer), left.time.min, tz);

  let endMs: number | null = null;
  if (rt && endDay) {
    let e = wallToUtc(endDay.y, endDay.m, endDay.d, hour24(rt, endMer), rt.min, tz);
    if (e <= startMs && !explicitEndDay) {
      const next = addDays(endDay, 1); // overnight: "7:30 PM – 12 AM"
      e = wallToUtc(next.y, next.m, next.d, hour24(rt, endMer), rt.min, tz);
    }
    if (e > startMs) endMs = e;
  }
  return { startMs, endMs, startDay };
}

// ---------- other field helpers ----------

function httpsOnly(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

const GOOGLE_HOST = /(^|\.)(gstatic|googleusercontent|ggpht|google|googleapis|serpapi)\.[a-z.]+$/i;
/** https image that is not Google-hosted (we never hotlink Google thumbnails). */
export function pickImage(image: string | undefined): string | null {
  const url = httpsOnly(image);
  if (!url) return null;
  return GOOGLE_HOST.test(new URL(url).hostname) ? null : url;
}

const normText = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Stable id: SHA-256(normalized title | local start date | normalized venue), 32 hex chars. */
export async function externalId(title: string, startDay: Day, venue: string | null): Promise<string> {
  const data = new TextEncoder().encode(`${normText(title)}|${dayKey(startDay)}|${normText(venue ?? "")}`);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return [...hash].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

const KEYWORDS: [string, RegExp][] = [
  ["comedy", /\b(comedy|comedian|stand-?up|improv|open mic)\b/i],
  ["music", /\b(concerts?|live music|band|symphony|orchestra|jazz|dj|singer|tour|album|acoustic|choir)\b/i],
  ["nightlife", /\b(nightlife|night ?club|club night|dance party|karaoke|bar crawl|after ?party|drag)\b/i],
  ["arts_culture", /\b(art|arts|gallery|museum|theat(?:er|re)|exhibit(?:ion)?|film|movie|ballet|opera|dance|poetry|culture)\b/i],
  ["food_drinks", /\b(food|beer|brewery|brewing|wine|tasting|dinner|brunch|cocktails?|restaurant|taco|bbq|coffee)\b/i],
  ["sports", /\b(game|match|hockey|football|basketball|baseball|soccer|fc|nascar|racing|marathon|rugby|golf)\b/i],
  ["fitness", /\b(5k|10k|run club|fitness|workout|cycling|crossfit|pilates|bootcamp)\b/i],
  ["wellness", /\b(yoga|meditation|wellness|mindfulness|sound bath|breathwork)\b/i],
  ["outdoor", /\b(hike|hiking|trail|kayak|park|outdoor|garden|camping|paddle)\b/i],
  ["tech", /\b(tech|startup|hackathon|coding|developer|ai|software)\b/i],
  ["fashion", /\b(fashion|runway|boutique|vintage|thrift)\b/i],
  ["community", /\b(community|volunteer|meetup|market|festival|charity|fundraiser|networking|trivia|kids|family)\b/i],
];
const DEFAULT_SLUG = "community";

export function interestSlugs(title: string, description: string): string[] {
  const text = `${title} ${description}`;
  const hits = KEYWORDS.filter(([, re]) => re.test(text)).map(([slug]) => slug);
  return hits.length ? hits : [DEFAULT_SLUG];
}

const FREE_RE = /\bno cover\b|(?<!-)\bfree\b(?!\s*(?:parking|wi-?fi|drinks?)\b)(?!-)/i;

/**
 * Geocoder query from Google's address lines. Starts at the first comma segment that begins with a
 * digit ("333 E Trade St, Charlotte, NC"); with no street number it is the venue plus the city line.
 */
export function geocodeQuery(address: string[]): { query: string; hasStreet: boolean } {
  const segs = address.flatMap((l) => l.split(",")).map((s) => s.trim()).filter(Boolean);
  const idx = segs.findIndex((s) => /^\d/.test(s));
  return idx >= 0 ? { query: segs.slice(idx).join(", "), hasStreet: true } : { query: segs.join(", "), hasStreet: false };
}

/** Returns null when the event is skipped (no clear time, no address, outside the window, over). */
export async function mapSerpapiEvent(raw: SerpEvent, ctx: MapContext): Promise<SerpRow | null> {
  const title = raw?.title?.trim();
  if (!title) return null;
  const tz = ctx.timezone ?? DEFAULT_TZ;
  const when = parseWhen(raw.date?.when, ctx.now, tz);
  if (!when) return null;
  const now = ctx.now.getTime();
  if (when.startMs > now + (ctx.windowDays ?? 30) * DAY) return null;
  if ((when.endMs ?? when.startMs + ASSUMED_DURATION_MS) < now) return null;

  const address = (raw.address ?? []).map((s) => s.trim()).filter(Boolean);
  if (address.length === 0) return null; // nothing to geocode

  const q = geocodeQuery(address);
  const venue = (raw.venue?.name?.trim() || address[0].split(",")[0].trim() || "").slice(0, MAX_TEXT) || null;
  const desc = (raw.description ?? "").trim();
  const ticket = raw.ticket_info?.find((t) => t.link_type === "tickets" && httpsOnly(t.link));
  const source = (ticket ?? raw.ticket_info?.[0])?.source?.trim();
  const interest_ids = interestSlugs(title, desc)
    .map((s) => ctx.interestIds[s])
    .filter((id): id is number => typeof id === "number");

  return {
    source: "serpapi",
    external_id: await externalId(title, when.startDay, venue),
    city_id: ctx.cityId,
    title: title.slice(0, MAX_TEXT),
    description: desc ? (desc.length > 500 ? desc.slice(0, 499) + "…" : desc) : null,
    starts_at: new Date(when.startMs).toISOString(),
    ends_at: when.endMs ? new Date(when.endMs).toISOString() : null,
    venue_name: venue,
    venue_address: address.join(", ").slice(0, MAX_TEXT * 2),
    image_url: pickImage(raw.image),
    is_free: FREE_RE.test(title) || FREE_RE.test(desc),
    price_min: null,
    ticket_url: httpsOnly(ticket?.link) ?? httpsOnly(raw.link),
    attribution: source ? `via ${source}` : "via Google Events",
    status: "active",
    geocode_query: q.query,
    geocode_has_street: q.hasStreet,
    interest_ids,
  };
}
