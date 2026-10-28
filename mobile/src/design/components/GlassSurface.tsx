import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

import { useTheme } from '../theme';
import { useReduceTransparency } from '../useReduceTransparency';

export type GlassSurfaceProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

function glassAvailable(): boolean {
  try {
    return isLiquidGlassAvailable();
  } catch {
    return false;
  }
}

/**
 * A floating bar (RSVP row, sheet toolbar). Liquid Glass on iOS 26, a solid canvas bar with a
 * hairline on top elsewhere and when Reduce Transparency is on. Never put text-heavy content in it.
 */
export function GlassSurface({ children, style }: GlassSurfaceProps) {
  const { colors } = useTheme();
  const reduceTransparency = useReduceTransparency();
  if (glassAvailable() && !reduceTransparency) {
    return (
      <GlassView glassEffectStyle="regular" style={style}>
        {children}
      </GlassView>
    );
  }
  return (
    <View
      style={[
        { backgroundColor: colors.canvas, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
        style,
      ]}
    >
      {children}
    </View>
  );
}
