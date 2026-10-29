import { Host, Slider } from '@expo/ui';

export type DistanceSliderProps = {
  /** Position 0..max, one step per allowed distance. */
  index: number;
  max: number;
  onIndexChange: (index: number) => void;
};

/** Stepped slider. Web / Android version (universal @expo/ui Slider); iOS uses the SwiftUI one in DistanceSlider.ios.tsx. */
export function DistanceSlider({ index, max, onIndexChange }: DistanceSliderProps) {
  return (
    <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
      <Slider min={0} max={max} step={1} value={index} onValueChange={(v) => onIndexChange(Math.round(v))} />
    </Host>
  );
}
