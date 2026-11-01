import { useEffect, useState } from 'react';

/** The current time, refreshed every `intervalMs` (a minute by default), for labels like "Live now". */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
