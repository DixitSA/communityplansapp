// Pure rules for the review-inbox auto-approver.

const HOUR = 3_600_000;
const DAY = 86_400_000;
export const PAST_GRACE_MS = 2 * HOUR;
export const MAX_DAYS_OUT = 60;

// Same pattern as ingest-serpapi/mapper.ts.
export const FREE_RE = /\bno cover\b|(?<!-)\bfree\b(?!\s*(?:parking|wi-?fi|drinks?)\b)(?!-)/i;
export const isFree = (title: string, details: string | null) => FREE_RE.test(title) || FREE_RE.test(details ?? "");

export type DateVerdict = "past" | "too_far" | "ok";
export function dateWindow(startsAt: string, now: Date): DateVerdict {
  const ms = Date.parse(startsAt);
  if (Number.isNaN(ms)) return "past";
  if (ms < now.getTime() - PAST_GRACE_MS) return "past";
  if (ms > now.getTime() + MAX_DAYS_OUT * DAY) return "too_far";
  return "ok";
}

const EMOJI_RE = /\p{Extended_Pictographic}/gu;
const URL_RE = /https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|net|org|io|co|me|ly|gl|app|link)\b\/?/i;

/** True when the title looks like a real event name. */
export function titleOk(title: string): boolean {
  const letters = title.match(/\p{L}/gu) ?? [];
  if (letters.length < 3) return false;
  if (title.length > 20 && title === title.toUpperCase() && title !== title.toLowerCase()) return false;
  if (URL_RE.test(title)) return false;
  if ((title.match(EMOJI_RE) ?? []).length > 2) return false;
  return true;
}

export const truncateDescription = (d: string | null) =>
  d ? (d.length > 500 ? d.slice(0, 499) + "…" : d) : null;

export const attributionFor = (handle: string | null) => (handle ? `via ${handle}` : "via yard inbox");
