import {
  DETAILS_MAX,
  LINK_MAX,
  TITLE_MAX,
  VENUE_MAX,
  isSubmissionValid,
  normalizeLink,
  parseDateTime,
  startsAtProblem,
  validateSubmission,
  type SubmissionDraft,
} from '../submission';

const now = new Date(2026, 10, 1, 12, 0);
const hours = (n: number) => new Date(now.getTime() + n * 3_600_000);
const draft = (over: Partial<SubmissionDraft> = {}): SubmissionDraft => ({
  title: 'Night market',
  link: '',
  startsAt: hours(48),
  venue: '',
  details: '',
  ...over,
});

describe('normalizeLink', () => {
  it('adds https:// to a bare link and trims', () => {
    expect(normalizeLink('  instagram.com/p/abc ')).toBe('https://instagram.com/p/abc');
  });
  it('upgrades http and fixes the scheme case, keeping the rest', () => {
    expect(normalizeLink('http://a.com/X')).toBe('https://a.com/X');
    expect(normalizeLink('HTTPS://a.com/X')).toBe('https://a.com/X');
  });
  it('keeps empty empty', () => {
    expect(normalizeLink('   ')).toBe('');
  });
});

describe('validateSubmission', () => {
  it('accepts the minimum (title and time only)', () => {
    expect(validateSubmission(draft())).toEqual({});
  });
  it('title is 1 to 120 after trimming', () => {
    expect(validateSubmission(draft({ title: '   ' })).title).toBeDefined();
    expect(isSubmissionValid(draft({ title: 'a'.repeat(TITLE_MAX) }), now)).toBe(true);
    expect(validateSubmission(draft({ title: 'a'.repeat(TITLE_MAX + 1) }), now).title).toBeDefined();
  });
  it('link is optional, normalised, no spaces, at most 500', () => {
    expect(validateSubmission(draft({ link: 'instagram.com/p/x' }), now).link).toBeUndefined();
    expect(validateSubmission(draft({ link: 'https://a.com/a b' }), now).link).toBeDefined();
    const long = (n: number) => `https://a.com/${'x'.repeat(n - 14)}`;
    expect(validateSubmission(draft({ link: long(LINK_MAX) }), now).link).toBeUndefined();
    expect(validateSubmission(draft({ link: long(LINK_MAX + 1) }), now).link).toBeDefined();
  });
  it('venue and details have upper bounds', () => {
    expect(validateSubmission(draft({ venue: 'v'.repeat(VENUE_MAX) }), now).venue).toBeUndefined();
    expect(validateSubmission(draft({ venue: 'v'.repeat(VENUE_MAX + 1) }), now).venue).toBeDefined();
    expect(validateSubmission(draft({ details: 'd'.repeat(DETAILS_MAX) }), now).details).toBeUndefined();
    expect(validateSubmission(draft({ details: 'd'.repeat(DETAILS_MAX + 1) }), now).details).toBeDefined();
  });
});

describe('startsAtProblem (window: now - 1h < t < now + 365d)', () => {
  it('needs a date', () => expect(startsAtProblem(null, now)).not.toBeNull());
  it('rejects exactly one hour ago, accepts just inside', () => {
    expect(startsAtProblem(hours(-1), now)).not.toBeNull();
    expect(startsAtProblem(new Date(hours(-1).getTime() + 1), now)).toBeNull();
  });
  it('rejects exactly 365 days out, accepts just inside', () => {
    const limit = now.getTime() + 365 * 24 * 3_600_000;
    expect(startsAtProblem(new Date(limit), now)).not.toBeNull();
    expect(startsAtProblem(new Date(limit - 1), now)).toBeNull();
  });
});

describe('parseDateTime', () => {
  it('parses a real date and time', () => {
    expect(parseDateTime('2026-11-07 19:30')?.getHours()).toBe(19);
  });
  it('rejects nonsense', () => {
    expect(parseDateTime('2026-02-30 10:00')).toBeNull();
    expect(parseDateTime('2026-11-07 25:00')).toBeNull();
    expect(parseDateTime('soon')).toBeNull();
  });
});
