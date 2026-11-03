import { hasEnded } from '@/features/feed/agenda';

const H = 3_600_000;
const start = new Date('2026-11-03T18:00:00');

describe('event page ended state', () => {
  it('is live until the end time, then ended', () => {
    const e = { startsAt: start, endsAt: new Date(start.getTime() + 2 * H) };
    expect(hasEnded(e, new Date(start.getTime() + 2 * H - 1))).toBe(false);
    expect(hasEnded(e, new Date(start.getTime() + 2 * H))).toBe(true);
  });
  it('assumes three hours when there is no end time', () => {
    const e = { startsAt: start };
    expect(hasEnded(e, new Date(start.getTime() + 3 * H - 1))).toBe(false);
    expect(hasEnded(e, new Date(start.getTime() + 3 * H))).toBe(true);
  });
});
