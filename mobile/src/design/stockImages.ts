// Stock photos for events without their own image: three free Pexels photos per category (license and
// credits in assets/stock/CREDITS.md). They illustrate the kind of event, not the event itself.

import { seededRandom } from './components/MeshArt';

const STOCK: Record<string, number[]> = {
  arts_culture: [
    require('../../assets/stock/arts_culture-1.jpg'),
    require('../../assets/stock/arts_culture-2.jpg'),
    require('../../assets/stock/arts_culture-3.jpg'),
  ],
  comedy: [
    require('../../assets/stock/comedy-1.jpg'),
    require('../../assets/stock/comedy-2.jpg'),
    require('../../assets/stock/comedy-3.jpg'),
  ],
  community: [
    require('../../assets/stock/community-1.jpg'),
    require('../../assets/stock/community-2.jpg'),
    require('../../assets/stock/community-3.jpg'),
  ],
  fashion: [
    require('../../assets/stock/fashion-1.jpg'),
    require('../../assets/stock/fashion-2.jpg'),
    require('../../assets/stock/fashion-3.jpg'),
  ],
  fitness: [
    require('../../assets/stock/fitness-1.jpg'),
    require('../../assets/stock/fitness-2.jpg'),
    require('../../assets/stock/fitness-3.jpg'),
  ],
  food_drinks: [
    require('../../assets/stock/food_drinks-1.jpg'),
    require('../../assets/stock/food_drinks-2.jpg'),
    require('../../assets/stock/food_drinks-3.jpg'),
  ],
  music: [
    require('../../assets/stock/music-1.jpg'),
    require('../../assets/stock/music-2.jpg'),
    require('../../assets/stock/music-3.jpg'),
  ],
  nightlife: [
    require('../../assets/stock/nightlife-1.jpg'),
    require('../../assets/stock/nightlife-2.jpg'),
    require('../../assets/stock/nightlife-3.jpg'),
  ],
  outdoor: [
    require('../../assets/stock/outdoor-1.jpg'),
    require('../../assets/stock/outdoor-2.jpg'),
    require('../../assets/stock/outdoor-3.jpg'),
  ],
  sports: [
    require('../../assets/stock/sports-1.jpg'),
    require('../../assets/stock/sports-2.jpg'),
    require('../../assets/stock/sports-3.jpg'),
  ],
  tech: [
    require('../../assets/stock/tech-1.jpg'),
    require('../../assets/stock/tech-2.jpg'),
    require('../../assets/stock/tech-3.jpg'),
  ],
  wellness: [
    require('../../assets/stock/wellness-1.jpg'),
    require('../../assets/stock/wellness-2.jpg'),
    require('../../assets/stock/wellness-3.jpg'),
  ],
};

/** How many stock photos a category has (0 when it has none). */
export function stockCountFor(interest: string): number {
  return STOCK[interest]?.length ?? 0;
}

/** The event's own (seeded) pick, as an index into its category's photos; -1 when the category has none. */
export function defaultStockIndex(interest: string, eventId: string): number {
  const count = stockCountFor(interest);
  return count === 0 ? -1 : Math.floor(seededRandom(`stock:${eventId}`)() * count);
}

/**
 * A stock photo for the event's category, or undefined if none fits. Without `variant` it is the same one every
 * time for that event; `variant` (an index, wrapped) picks a specific photo so a list can avoid repeats. `null`
 * means "no photo", so the caller falls back to generated art.
 */
export function stockImageFor(interest: string, eventId: string, variant?: number | null): number | undefined {
  const set = STOCK[interest];
  if (!set || set.length === 0 || variant === null) return undefined;
  const index = variant === undefined ? defaultStockIndex(interest, eventId) : ((variant % set.length) + set.length) % set.length;
  return set[index];
}
