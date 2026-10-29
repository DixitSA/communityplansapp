import { unitFrom } from '@/lib/hash';

// The sample events carry distance but no price, and real API events may lack either.
// These helpers fill the gaps the same way every time for the same event id.

/** Price in dollars; 0 means free. About 4 in 10 events are free. */
export function derivePriceUsd(id: string): number {
  if (unitFrom(id, 'free') < 0.4) return 0;
  return 8 + Math.round(unitFrom(id, 'price') * 7) * 5; // 8 + 0..35 in steps of 5
}

/** Distance in miles from the user, 0.5 to 12. */
export function deriveDistanceMi(id: string): number {
  return Math.round((0.5 + unitFrom(id, 'dist') * 11.5) * 10) / 10;
}
