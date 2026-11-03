import { stockImageFor } from '../stockImages';
import { EventImage, type EventImageProps } from './EventImage';
import type { SymbolName } from './Icon';
import { MeshArt } from './MeshArt';

export type EventArtProps = {
  event: { id: string; imageUrl?: string | null; imageSensitive?: boolean; interest: string; symbol: SymbolName;
    /** Which stock photo to show (see stockImageFor); `null` skips stock for generated art. Unset: the event's own pick. */
    stockVariant?: number | null;
  };
  /** Size of the symbol on the generated art (only used when there's no photo at all). */
  symbolSize?: number;
  /** How a flagged image is marked (see EventImage). Stock photos are never flagged. */
  overlay?: EventImageProps['overlay'];
};

/**
 * An event's picture: its own image; without one, a stock photo for its category (the same one every time for
 * that event); for a category with no stock photos, the generated art.
 */
export function EventArt({ event, symbolSize, overlay }: EventArtProps) {
  if (event.imageUrl) {
    return <EventImage eventId={event.id} source={event.imageUrl} sensitive={event.imageSensitive} overlay={overlay} />;
  }
  const stock = stockImageFor(event.interest, event.id, event.stockVariant);
  if (stock !== undefined) return <EventImage eventId={event.id} source={stock} />;
  return <MeshArt id={event.id} interest={event.interest} symbol={event.symbol} symbolSize={symbolSize} />;
}
