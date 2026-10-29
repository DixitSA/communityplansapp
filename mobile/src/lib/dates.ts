// Small pure date helpers. All local time, no Intl, so output is deterministic.
export const WEEKDAYS_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;
export const WEEKDAYS_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
export const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** "Wed, Oct 28" */
export function formatShortDate(d: Date): string {
  return `${WEEKDAYS_LONG[d.getDay()].slice(0, 3)}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
}

/** Monday of the week containing `d`, at local midnight. */
export function startOfWeekMonday(d: Date): Date {
  const offset = (d.getDay() + 6) % 7;
  return addDays(startOfDay(d), -offset);
}

export function toISODate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return toISODate(a) === toISODate(b);
}

/** "9:00 PM" (or "9 PM" when `short` and on the hour). */
export function formatTime(d: Date, short = false): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const suffix = h < 12 ? 'AM' : 'PM';
  if (short && m === 0) return `${h12} ${suffix}`;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

const MAX_RANGE_MS = 12 * 3_600_000;
/** From this long on, "Fri" could mean two different days, so ranges show dates. */
const MIN_DATED_RANGE_MS = 6 * 24 * 3_600_000;

function meridiem(d: Date): string {
  return d.getHours() < 12 ? 'AM' : 'PM';
}

/**
 * The time line for an event, in device-local time (v1 assumes the phone is in the city's zone).
 * - Same calendar day, or ending within 12 hours (even past midnight): "7:00 – 10:00 PM", "10:00 PM – 2:00 AM".
 *   The first AM/PM is dropped when both match.
 * - Anything longer on another date, no end, or an end that isn't after the start: just the start, "7:00 PM". With `long`
 *   (the event page) a longer event shows both ends: "Fri 7:00 PM – Sun 5:00 PM".
 */
export function formatEventTime(start: Date, end?: Date | null, long = false): string {
  const startText = formatTime(start);
  if (!end) return startText;
  const span = end.getTime() - start.getTime();
  if (!(span > 0)) return startText;
  if (span > MAX_RANGE_MS && !isSameDay(start, end)) {
    if (!long) return startText;
    const day = (d: Date) => (span >= MIN_DATED_RANGE_MS ? formatShortDate(d) : WEEKDAYS_LONG[d.getDay()].slice(0, 3));
    return `${day(start)} ${startText} – ${day(end)} ${formatTime(end)}`;
  }
  const first = meridiem(start) === meridiem(end) ? formatTime(start).replace(/ [AP]M$/, '') : startText;
  return `${first} – ${formatTime(end)}`;
}
