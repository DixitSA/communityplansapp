import { Host } from '@expo/ui';
import { Slider } from '@expo/ui/swift-ui';
import { tint } from '@expo/ui/swift-ui/modifiers';

import { useTheme } from '@/design';

import type { DistanceSliderProps } from './DistanceSlider';

/** The real iOS slider (SwiftUI), tinted with the yard accent so it matches the rest of the app. */
export function DistanceSlider({ index, max, onIndexChange }: DistanceSliderProps) {
  const { colors } = useTheme();
  return (
    <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
      <Slider
        min={0}
        max={max}
        step={1}
        value={index}
        onValueChange={(v) => onIndexChange(Math.round(v))}
        modifiers={[tint(colors.accent)]}
      />
    </Host>
  );
}
