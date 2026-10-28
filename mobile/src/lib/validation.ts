// Pure input rules for sign-up. They mirror the server's checks in
// supabase/migrations/20261028110000_onboarding_hardening.sql so the app can give feedback
// before a round trip. The server stays the authority.

/** Mirrors `^[a-z0-9][a-z0-9_.]{2,19}$` from the database. */
export const USERNAME_RE = /^[a-z0-9][a-z0-9_.]{2,19}$/;
export const MIN_INTERESTS = 3;
export const MIN_AGE = 18;
export const DISPLAY_NAME_MAX = 50;

/** Lowercases and drops a leading "@" and spaces, so "@Maya.C " becomes "maya.c". */
export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@+/, '').replace(/\s+/g, '').toLowerCase();
}

export function isValidUsername(username: string): boolean {
  return USERNAME_RE.test(username);
}

/** Explains why a username is not allowed, or null when it is fine. */
export function usernameProblem(username: string): string | null {
  if (username.length === 0) return null;
  if (username.length < 3) return 'Use at least 3 characters.';
  if (username.length > 20) return 'Use at most 20 characters.';
  if (!/^[a-z0-9]/.test(username)) return 'Start with a letter or number.';
  if (!USERNAME_RE.test(username)) return 'Use only letters, numbers, dots and underscores.';
  return null;
}

export function isValidDisplayName(name: string): boolean {
  const n = name.trim();
  return n.length >= 1 && n.length <= DISPLAY_NAME_MAX;
}

/** Whole years between `birthdate` and `today` (local calendar days). */
export function ageOn(birthdate: Date, today: Date): number {
  let age = today.getFullYear() - birthdate.getFullYear();
  const beforeBirthday =
    today.getMonth() < birthdate.getMonth() ||
    (today.getMonth() === birthdate.getMonth() && today.getDate() < birthdate.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export function isAtLeast18(birthdate: Date, today: Date = new Date()): boolean {
  return ageOn(birthdate, today) >= MIN_AGE;
}

/** "2001-04-09", the format the database's `date` column takes. */
export function toDateOnly(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Parses "YYYY-MM-DD" (the web fallback field). Null when it is not a real calendar date. */
export function parseDateOnly(text: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 1900) return null;
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date;
}

export function interestsRemaining(count: number): number {
  return Math.max(0, MIN_INTERESTS - count);
}

/** The Continue button: "Pick 2 more" until enough are chosen. */
export function interestsContinueLabel(count: number): string {
  const left = interestsRemaining(count);
  return left === 0 ? 'Continue' : `Pick ${left} more`;
}

/** A 6-digit email code. */
export function isCompleteCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

export function isPlausibleEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}
