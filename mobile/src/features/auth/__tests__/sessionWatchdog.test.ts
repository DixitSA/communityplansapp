import type { AuthSession } from '@/lib/api';

import { readSessionWithWatchdog } from '../sessionWatchdog';

const session: AuthSession = { userId: 'u1', email: 'a@b.co' };

describe('readSessionWithWatchdog', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('gives up with null after the timeout, and warns', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const result = readSessionWithWatchdog(() => new Promise(() => {}), 8_000);
    jest.advanceTimersByTime(7_999);
    expect(warn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    await expect(result).resolves.toBeNull();
    expect(warn).toHaveBeenCalledWith('[yard] session read timed out');
  });

  it('returns the session when it arrives in time, with no timer left running', async () => {
    const result = readSessionWithWatchdog(async () => session, 8_000);
    await expect(result).resolves.toBe(session);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('treats a failed read as signed out', async () => {
    const result = readSessionWithWatchdog(() => Promise.reject(new Error('boom')), 8_000);
    await expect(result).resolves.toBeNull();
    expect(jest.getTimerCount()).toBe(0);
  });
});
