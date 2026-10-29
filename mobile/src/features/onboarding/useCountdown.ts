import { useCallback, useEffect, useState } from 'react';

/** "0:42". */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Counts down once a second from `seconds`. `restart` begins again (the resend button). */
export function useCountdown(seconds: number): { remaining: number; restart: () => void } {
  const [remaining, setRemaining] = useState(seconds);
  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);
  const restart = useCallback(() => setRemaining(seconds), [seconds]);
  return { remaining, restart };
}
