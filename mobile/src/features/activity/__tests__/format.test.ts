import { formatAgo } from '../format';

describe('formatAgo', () => {
  it('uses the largest whole unit', () => {
    expect(formatAgo(0)).toBe('now');
    expect(formatAgo(5)).toBe('5m');
    expect(formatAgo(59)).toBe('59m');
    expect(formatAgo(60)).toBe('1h');
    expect(formatAgo(60 * 23)).toBe('23h');
    expect(formatAgo(60 * 48)).toBe('2d');
  });
});
