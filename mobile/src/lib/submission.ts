// Pure input rules for "Suggest an event". They mirror `submit_event` in
// supabase/migrations/20261030020000_event_submissions.sql so the form can show errors before a round
// trip. The server stays the authority.

export const TITLE_MAX = 120;
export const LINK_MAX = 500;
export const VENUE_MAX = 120;
export const DETAILS_MAX = 1000;
/** Suggestions allowed per rolling 24 hours. */
export const SUBMISSIONS_PER_DAY = 5;
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export type SubmissionField = 'title' | 'link' | 'startsAt' | 'venue' | 'details';
export type SubmissionErrors = Partial<Record<SubmissionField, string>>;

export type SubmissionDraft = {
  title: string;
  link: string;
  startsAt: Date | null;
  venue: string;
  details: string;
};

/**
 * Trims a pasted link and adds the scheme: "instagram.com/p/x" becomes "https://instagram.com/p/x",
 * and "http://" is upgraded because the server only accepts https. Empty stays empty (the link is optional).
 */
export function normalizeLink(raw: string): string {
  const t = raw.trim();
  if (t === '') return '';
  if (/^https:\/\//i.test(t)) return `https://${t.slice(8)}`;
  if (/^http:\/\//i.test(t)) return `https://${t.slice(7)}`;
  return `https://${t.replace(/^\/+/, '')}`;
}

/** The earliest start the server accepts is one hour ago (events already under way), the latest is a year out. */
export function startsAtProblem(d: Date | null, now: Date = new Date()): string | null {
  if (!d) return 'Pick when it starts.';
  const t = d.getTime();
  if (Number.isNaN(t) || t <= now.getTime() - HOUR_MS) return 'Pick a time that hasn’t already passed.';
  if (t >= now.getTime() + 365 * DAY_MS) return 'Pick a date within the next year.';
  return null;
}

/** Field by field problems (empty object means valid). Optional fields only complain when they are too long or malformed. */
export function validateSubmission(draft: SubmissionDraft, now: Date = new Date()): SubmissionErrors {
  const errors: SubmissionErrors = {};
  const title = draft.title.trim();
  if (title.length < 1) errors.title = 'Add a title.';
  else if (title.length > TITLE_MAX) errors.title = `Keep the title under ${TITLE_MAX} characters.`;

  const link = normalizeLink(draft.link);
  if (link !== '') {
    if (/\s/.test(link)) errors.link = 'That link has spaces in it.';
    else if (link.length > LINK_MAX) errors.link = `That link is too long (${LINK_MAX} characters at most).`;
    else if (!/^https:\/\/[^\s]+$/.test(link)) errors.link = 'That doesn’t look like a link.';
  }

  const when = startsAtProblem(draft.startsAt, now);
  if (when) errors.startsAt = when;

  if (draft.venue.trim().length > VENUE_MAX) errors.venue = `Keep the venue under ${VENUE_MAX} characters.`;
  if (draft.details.trim().length > DETAILS_MAX) errors.details = `Keep the details under ${DETAILS_MAX} characters.`;
  return errors;
}

export function isSubmissionValid(draft: SubmissionDraft, now: Date = new Date()): boolean {
  return Object.keys(validateSubmission(draft, now)).length === 0;
}

/** Parses "YYYY-MM-DD HH:mm" (the web fallback field), in local time. Null when it is not a real date and time. */
export function parseDateTime(text: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const date = new Date(y, mo - 1, d, h, mi);
  const real = date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d && h < 24 && mi < 60;
  return real ? date : null;
}
