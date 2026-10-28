import { createFetchWithTimeout } from '../fetchWithTimeout';

/** A fetch that never answers but rejects when its signal aborts, like the real one. */
const hangingFetch: typeof fetch = (_input, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
  });

describe('createFetchWithTimeout', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('aborts a request that never answers', async () => {
    const wrapped = createFetchWithTimeout(10_000, hangingFetch);
    const result = wrapped('https://example.test');
    const assertion = expect(result).rejects.toThrow('aborted');
    jest.advanceTimersByTime(10_000);
    await assertion;
  });

  it('passes a fast response through and leaves no timer behind', async () => {
    const ok = new Response('ok');
    const wrapped = createFetchWithTimeout(10_000, async () => ok);
    await expect(wrapped('https://example.test')).resolves.toBe(ok);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('leaves a caller-supplied signal alone', async () => {
    const seen: (AbortSignal | null | undefined)[] = [];
    const wrapped = createFetchWithTimeout(10_000, async (_i, init) => {
      seen.push(init?.signal);
      return new Response('ok');
    });
    const own = new AbortController();
    await wrapped('https://example.test', { signal: own.signal });
    expect(seen[0]).toBe(own.signal);
  });
});
