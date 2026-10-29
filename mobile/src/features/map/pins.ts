import { categoryColors, isCategory, lightColors, type EventCardData, type SymbolName } from '@/design';

import { coordsForEvent, neighborhoodFor, type LatLng } from './coords';

export type Pin = {
  id: string;
  title: string;
  coordinate: LatLng;
  /** Solid category color (DESIGN.md §3). */
  color: string;
  symbol: SymbolName;
  neighborhood: string;
};


export function pinColor(interest: string): string {
  return isCategory(interest) ? categoryColors[interest].solid : lightColors.inkSecondary;
}

/** One pin per event, in the same order. */
export function pinsFor(events: (EventCardData & { lat?: number; lng?: number; neighborhood?: string })[]): Pin[] {
  return events.map((e) => ({
    id: e.id,
    title: e.title,
    coordinate: coordsForEvent(e),
    color: pinColor(e.interest),
    symbol: e.symbol,
    neighborhood: e.neighborhood ?? neighborhoodFor(e.venue).name,
  }));
}
