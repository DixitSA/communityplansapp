import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

import { useTheme } from '../theme';
import { useReduceTransparency } from '../useReduceTransparency';

export type GlassSurfaceProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Which edge touches content and gets the hairline in the solid fallback. A bottom bar uses 'top' (default), a header 'bottom'. */
  edge?: 'top' | 'bottom';
  /** A translucent color (e.g. an event's category color at low alpha) that tints the glass, or the solid fallback. */
  tint?: string;
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
export function GlassSurface({ children, style, edge = 'top', tint }: GlassSurfaceProps) {
  const { colors } = useTheme();
  const reduceTransparency = useReduceTransparency();
  if (glassAvailable() && !reduceTransparency) {
    return (
      <GlassView glassEffectStyle="regular" tintColor={tint} style={style}>
        {children}
      </GlassView>
    );
  }
  return (
    <View
      style={[
        {
          backgroundColor: colors.canvas,
          ...(edge === 'top'
            ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line }
            : { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line }),
        },
        style,
      ]}
    >
      {tint ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} /> : null}
      {children}
    </View>
  );
}
