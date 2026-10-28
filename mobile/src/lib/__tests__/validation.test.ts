import {
  USERNAME_RE,
  ageOn,
  interestsContinueLabel,
  interestsRemaining,
  isAtLeast18,
  isCompleteCode,
  isPlausibleEmail,
  isValidDisplayName,
  isValidUsername,
  normalizeUsername,
  parseDateOnly,
  toDateOnly,
  usernameProblem,
} from '../validation';

describe('username rules (mirror the database check)', () => {
  it('uses the exact server pattern', () => {
    expect(USERNAME_RE.source).toBe('^[a-z0-9][a-z0-9_.]{2,19}$');
  });

  it('accepts 3 to 20 lowercase letters, digits, dots and underscores', () => {
    for (const ok of ['abc', 'maya.c', 'a_b', '9lives', 'a'.repeat(20), 'x.y_z1']) {
      expect(isValidUsername(ok)).toBe(true);
    }
  });

  it('rejects short, long, uppercase, punctuation and bad first characters', () => {
    for (const bad of ['', 'ab', 'a'.repeat(21), 'Maya', 'ma ya', 'ma-ya', '.maya', '_maya', 'maya!', '@maya']) {
      expect(isValidUsername(bad)).toBe(false);
    }
  });

  it('explains the problem in words', () => {
    expect(usernameProblem('')).toBeNull();
    expect(usernameProblem('ab')).toMatch(/at least 3/);
    expect(usernameProblem('a'.repeat(21))).toMatch(/at most 20/);
    expect(usernameProblem('.abc')).toMatch(/Start with/);
    expect(usernameProblem('ab-c')).toMatch(/only letters/);
    expect(usernameProblem('maya.c')).toBeNull();
  });

  it('normalizes typing: lowercase, no @, no spaces', () => {
    expect(normalizeUsername('  @Maya.C ')).toBe('maya.c');
    expect(normalizeUsername('Ma Ya')).toBe('maya');
  });
});

describe('display name', () => {
  it('needs 1 to 50 characters after trimming', () => {
    expect(isValidDisplayName('  ')).toBe(false);
    expect(isValidDisplayName(' Maya ')).toBe(true);
    expect(isValidDisplayName('x'.repeat(50))).toBe(true);
    expect(isValidDisplayName('x'.repeat(51))).toBe(false);
  });
});

describe('age gate', () => {
  const today = new Date(2026, 9, 28);

  it('counts whole years, so the birthday itself makes you older', () => {
    expect(ageOn(new Date(2008, 9, 28), today)).toBe(18);
    expect(ageOn(new Date(2008, 9, 29), today)).toBe(17);
    expect(ageOn(new Date(2008, 10, 1), today)).toBe(17);
    expect(ageOn(new Date(1990, 0, 1), today)).toBe(36);
  });

  it('requires 18 or older', () => {
    expect(isAtLeast18(new Date(2008, 9, 28), today)).toBe(true);
    expect(isAtLeast18(new Date(2008, 9, 29), today)).toBe(false);
    expect(isAtLeast18(new Date(2015, 0, 1), today)).toBe(false);
  });
});

describe('date-only strings', () => {
  it('formats and parses YYYY-MM-DD in local time', () => {
    expect(toDateOnly(new Date(2001, 3, 9))).toBe('2001-04-09');
    const d = parseDateOnly('2001-04-09');
    expect(d && [d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2001, 3, 9]);
  });

  it('rejects things that are not real dates', () => {
    for (const bad of ['', '2001-4-9', '2001-02-30', '2001-13-01', 'abcd-ef-gh', '1899-01-01']) {
      expect(parseDateOnly(bad)).toBeNull();
    }
  });
});

describe('interests minimum', () => {
  it('counts down to three', () => {
    expect(interestsRemaining(0)).toBe(3);
    expect(interestsRemaining(2)).toBe(1);
    expect(interestsRemaining(3)).toBe(0);
    expect(interestsRemaining(9)).toBe(0);
  });

  it('labels the Continue button', () => {
    expect(interestsContinueLabel(0)).toBe('Pick 3 more');
    expect(interestsContinueLabel(2)).toBe('Pick 1 more');
    expect(interestsContinueLabel(3)).toBe('Continue');
    expect(interestsContinueLabel(7)).toBe('Continue');
  });
});

describe('email and code', () => {
  it('checks the email shape loosely', () => {
    expect(isPlausibleEmail('maya@example.com')).toBe(true);
    expect(isPlausibleEmail(' maya@example.com ')).toBe(true);
    expect(isPlausibleEmail('maya@example')).toBe(false);
    expect(isPlausibleEmail('maya example@x.com')).toBe(false);
    expect(isPlausibleEmail('')).toBe(false);
  });

  it('wants exactly six digits', () => {
    expect(isCompleteCode('123456')).toBe(true);
    expect(isCompleteCode('12345')).toBe(false);
    expect(isCompleteCode('1234567')).toBe(false);
    expect(isCompleteCode('12345a')).toBe(false);
  });
});
