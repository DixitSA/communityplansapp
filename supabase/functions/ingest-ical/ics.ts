// Small, pure iCalendar (RFC 5545) VEVENT parser. No Deno or network APIs.

export type IcsDate =
  | { kind: "utc"; iso: string }
  | { kind: "local"; date: string; time: string; tzid: string | null }
  | { kind: "date"; date: string };

export interface VEvent {
  uid: string | null;
  summary: string | null;
  description: string | null;
  location: string | null;
  url: string | null;
  geo: { lat: number; lng: number } | null;
  dtstart: IcsDate | null;
  dtend: IcsDate | null;
  status: string | null;
  /** RRULE, RDATE or RECURRENCE-ID present: v1 skips these. */
  recurring: boolean;
}

/** RFC 5545 3.1: a line starting with a space or tab continues the previous one. */
export function unfold(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split(/\r\n|\n|\r/)) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length) out[out.length - 1] += line.slice(1);
    else out.push(line);
  }
  return out;
}

export function unescapeText(v: string): string {
  return v.replace(/\\([nN,;\\])/g, (_, c: string) => (c === "n" || c === "N" ? "\n" : c));
}

interface Prop { name: string; params: Record<string, string>; value: string }

/** Split `NAME;P=V;P2="a;b":value`, honoring quoted parameter values. */
export function parseLine(line: string): Prop | null {
  let inQuote = false, colon = -1;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuote = !inQuote;
    else if (c === ":" && !inQuote) { colon = i; break; }
  }
  if (colon < 1) return null;
  const head = line.slice(0, colon), value = line.slice(colon + 1);
  const parts: string[] = [];
  let cur = "";
  inQuote = false;
  for (const c of head) {
    if (c === '"') inQuote = !inQuote;
    if (c === ";" && !inQuote) { parts.push(cur); cur = ""; } else cur += c;
  }
  parts.push(cur);
  const params: Record<string, string> = {};
  for (const p of parts.slice(1)) {
    const eq = p.indexOf("=");
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: parts[0].toUpperCase(), params, value };
}

export function parseDate(p: Prop): IcsDate | null {
  const v = p.value.trim();
  if (p.params["VALUE"]?.toUpperCase() === "DATE" || /^\d{8}$/.test(v)) {
    const m = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
    return m ? { kind: "date", date: `${m[1]}-${m[2]}-${m[3]}` } : null;
  }
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(v);
  if (!m) return null;
  const date = `${m[1]}-${m[2]}-${m[3]}`, time = `${m[4]}:${m[5]}:${m[6]}`;
  if (m[7]) return { kind: "utc", iso: `${date}T${time}.000Z` };
  return { kind: "local", date, time, tzid: p.params["TZID"] ?? null };
}

function parseGeo(v: string): { lat: number; lng: number } | null {
  const [a, b] = v.split(";");
  const lat = Number(a), lng = Number(b);
  if (!a || !b || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export function parseIcs(text: string): VEvent[] {
  const events: VEvent[] = [];
  let cur: VEvent | null = null;
  let depth = 0; // nested components inside a VEVENT (VALARM)
  for (const line of unfold(text)) {
    const p = parseLine(line);
    if (!p) continue;
    if (p.name === "BEGIN") {
      if (cur) depth++;
      else if (p.value.trim().toUpperCase() === "VEVENT") {
        cur = { uid: null, summary: null, description: null, location: null, url: null, geo: null,
                dtstart: null, dtend: null, status: null, recurring: false };
      }
      continue;
    }
    if (p.name === "END") {
      if (!cur) continue;
      if (depth > 0) depth--;
      else { events.push(cur); cur = null; }
      continue;
    }
    if (!cur || depth > 0) continue;
    switch (p.name) {
      case "UID": cur.uid = p.value.trim() || null; break;
      case "SUMMARY": cur.summary = unescapeText(p.value).trim() || null; break;
      case "DESCRIPTION": cur.description = unescapeText(p.value).trim() || null; break;
      case "LOCATION": cur.location = unescapeText(p.value).trim() || null; break;
      case "URL": cur.url = p.value.trim() || null; break;
      case "GEO": cur.geo = parseGeo(p.value.trim()); break;
      case "DTSTART": cur.dtstart = parseDate(p); break;
      case "DTEND": cur.dtend = parseDate(p); break;
      case "STATUS": cur.status = p.value.trim().toUpperCase(); break;
      case "RRULE": case "RDATE": case "RECURRENCE-ID": cur.recurring = true; break;
    }
  }
  return events;
}

const WINDOWS_ZONES: Record<string, string> = {
  "eastern standard time": "America/New_York",
  "central standard time": "America/Chicago",
  "mountain standard time": "America/Denver",
  "pacific standard time": "America/Los_Angeles",
  "utc": "UTC",
};

/** Clean a TZID: strip `/mozilla.org/20050126_1/` style prefixes and map common Windows names. */
export function normalizeTzid(tzid: string): string {
  const t = tzid.trim().replace(/^\/[^/]+\/[^/]+\//, "").replace(/^\//, "");
  return WINDOWS_ZONES[t.toLowerCase()] ?? t;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatterFor(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric",
      hour: "numeric", minute: "numeric", second: "numeric",
    });
    formatters.set(tz, f);
  }
  return f;
}

/** Offset (ms) of `tz` from UTC at the given instant. Throws RangeError for unknown zones. */
function tzOffsetMs(instant: number, tz: string): number {
  const parts = formatterFor(tz).formatToParts(new Date(instant));
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")) -
    Math.floor(instant / 1000) * 1000;
}

/** Resolve to a UTC ISO string. All-day dates and unknown time zones give null. */
export function toUtcIso(d: IcsDate | null, fallbackTz: string): string | null {
  if (!d || d.kind === "date") return null;
  if (d.kind === "utc") return d.iso;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d.date), t = /^(\d{2}):(\d{2}):(\d{2})$/.exec(d.time);
  if (!m || !t) return null;
  try {
    const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +t[1], +t[2], +t[3]);
    const tz = d.tzid ? normalizeTzid(d.tzid) : fallbackTz;
    let utc = wall - tzOffsetMs(wall, tz);
    utc = wall - tzOffsetMs(utc, tz); // second pass handles DST edges
    return new Date(utc).toISOString();
  } catch {
    return null;
  }
}
