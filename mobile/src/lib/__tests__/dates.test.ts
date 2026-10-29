import { formatEventTime } from '../dates';

const d = (m: number, day: number, h: number, min = 0) => new Date(2026, m - 1, day, h, min);

describe('formatEventTime (America/New_York)', () => {
  it('gives the start only without a usable end', () => {
    expect(formatEventTime(d(10, 29, 19))).toBe('7:00 PM');
    expect(formatEventTime(d(10, 29, 19), null)).toBe('7:00 PM');
    expect(formatEventTime(d(10, 29, 19), d(10, 29, 19))).toBe('7:00 PM');
    expect(formatEventTime(d(10, 29, 19), d(10, 29, 18))).toBe('7:00 PM');
  });

  it('drops the first AM/PM when both match', () => {
    expect(formatEventTime(d(10, 29, 19), d(10, 29, 22))).toBe('7:00 – 10:00 PM');
    expect(formatEventTime(d(10, 29, 9, 30), d(10, 29, 11))).toBe('9:30 – 11:00 AM');
  });

  it('keeps both when they differ', () => {
    expect(formatEventTime(d(10, 29, 11, 30), d(10, 29, 14))).toBe('11:30 AM – 2:00 PM');
    expect(formatEventTime(d(10, 29, 0, 15), d(10, 29, 13))).toBe('12:15 AM – 1:00 PM');
  });

  it('shows a range for a long same-day event', () => {
    expect(formatEventTime(d(10, 29, 7), d(10, 29, 23, 30))).toBe('7:00 AM – 11:30 PM');
  });

  it('shows a range past midnight within 12 hours', () => {
    expect(formatEventTime(d(10, 29, 22), d(10, 30, 2))).toBe('10:00 PM – 2:00 AM');
    expect(formatEventTime(d(10, 29, 22), d(10, 30, 10))).toBe('10:00 PM – 10:00 AM');
  });

  it('falls back to the start past 12 hours on another date', () => {
    expect(formatEventTime(d(10, 29, 22), d(10, 30, 10, 1))).toBe('10:00 PM');
    expect(formatEventTime(d(10, 30, 19), d(11, 1, 17))).toBe('7:00 PM');
  });

  it('spells out both days on the event page', () => {
    // Fri Oct 30 2026 to Sun Nov 1 2026.
    expect(formatEventTime(d(10, 30, 19), d(11, 1, 17), true)).toBe('Fri 7:00 PM – Sun 5:00 PM');
    expect(formatEventTime(d(10, 29, 22), d(10, 30, 2), true)).toBe('10:00 PM – 2:00 AM');
    expect(formatEventTime(d(10, 29, 19), undefined, true)).toBe('7:00 PM');
  });

  it('measures real elapsed time across DST', () => {
    // Fall back Nov 1 2026: 10 PM Oct 31 to 9 AM Nov 1 is 12h of clock time but 12h real (extra hour at 1 AM => 12h).
    expect(formatEventTime(d(10, 31, 22), d(11, 1, 9))).toBe('10:00 PM – 9:00 AM');
    // 10 PM to 11 AM is 13 clock hours, 14 real hours with the repeated hour.
    expect(formatEventTime(d(10, 31, 22), d(11, 1, 11))).toBe('10:00 PM');
    // Spring forward Mar 8 2026: 10 PM Mar 7 to 10 AM Mar 8 is 11 real hours (12 clock).
    expect(formatEventTime(d(3, 7, 22), d(3, 8, 10))).toBe('10:00 PM – 10:00 AM');
    expect(formatEventTime(d(3, 7, 22), d(3, 8, 11))).toBe('10:00 PM – 11:00 AM');
  });
});
