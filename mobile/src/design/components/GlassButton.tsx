import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import type { ColorToken } from '../tokens';
import { useReduceTransparency } from '../useReduceTransparency';
import { Icon, type SymbolName } from './Icon';

export type GlassButtonProps = {
  symbol: SymbolName;
  onPress?: () => void;
  accessibilityLabel: string;
  size?: number;
  iconColor?: ColorToken;
  /** Sits on a photo/art: darker glass (and a dark translucent fallback) so white glyphs stay legible. */
  overImage?: boolean;
  /** Solid color fill instead of glass (e.g. the Going check on a card). */
  fill?: ColorToken;
};

function glassAvailable(): boolean {
  try {
    return isLiquidGlassAvailable();
  } catch {
    return false;
  }
}

/** Circular floating control (back, share, bell). Glass on iOS 26, solid surface elsewhere. */
export function GlassButton({
  symbol,
  onPress,
  accessibilityLabel,
  size = 44,
  iconColor = 'ink',
  overImage = false,
  fill,
}: GlassButtonProps) {
  const { colors } = useTheme();
  const reduceTransparency = useReduceTransparency();
  const useGlass = !fill && glassAvailable() && !reduceTransparency;
  const circle = { width: size, height: size, borderRadius: size / 2, borderCurve: 'continuous' as const };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [circle, pressed && { opacity: 0.7 }]}
    >
      {useGlass ? (
        <GlassView
          glassEffectStyle="regular"
          tintColor={overImage ? 'rgba(0, 0, 0, 0.3)' : undefined}
          isInteractive
          style={[circle, styles.center]}>
          <Icon name={symbol} size={size * 0.45} color={iconColor} />
        </GlassView>
      ) : (
        <View
          style={[
            circle,
            styles.center,
            {
              backgroundColor: fill ? colors[fill] : overImage ? 'rgba(0, 0, 0, 0.4)' : colors.surface,
              borderWidth: overImage || fill ? 0 : StyleSheet.hairlineWidth,
              borderColor: colors.line,
            },
          ]}
        >
          <Icon name={symbol} size={size * 0.45} color={iconColor} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
