import { PinListFallback } from './PinListFallback';
import type { Pin } from './pins';

export type NativeMapProps = {
  pins: Pin[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDeselect: () => void;
};

/** Web / Android fallback: Apple Maps only exists on iOS, so list the pins in a styled panel instead. */
export function NativeMap({ pins, selectedId, onSelect }: NativeMapProps) {
  return <PinListFallback pins={pins} selectedId={selectedId} onSelect={onSelect} />;
}
