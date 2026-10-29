export const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Wraps `fetch` so a request that never answers fails after `ms` instead of hanging forever.
 * (`AbortSignal.timeout` is not available in every React Native engine, so this uses a timer.)
 * A caller that passes its own `signal` keeps full control of cancelling.
 */
export function createFetchWithTimeout(
  ms: number = REQUEST_TIMEOUT_MS,
  baseFetch: typeof fetch = (...args) => fetch(...args),
): typeof fetch {
  return async (input, init) => {
    if (init?.signal) return baseFetch(input, init);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      return await baseFetch(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  };
}
