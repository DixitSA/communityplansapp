import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { useReduceTransparency } from '../useReduceTransparency';
import { AppText } from './AppText';

export type GlassPillProps = {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
};

function glassAvailable(): boolean {
  try {
    return isLiquidGlassAvailable();
  } catch {
    return false;
  }
}

/** A floating text pill (the agenda's "Today"). Liquid Glass on iOS 26, a solid surface elsewhere or with Reduce Transparency. */
export function GlassPill({ label, onPress, accessibilityLabel }: GlassPillProps) {
  const { colors, space, radius } = useTheme();
  const reduceTransparency = useReduceTransparency();
  const shape = {
    minHeight: 44,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    borderCurve: 'continuous' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
  const text = (
    <AppText variant="headline" maxFontSizeMultiplier={1.4}>
      {label}
    </AppText>
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={({ pressed }) => [{ borderRadius: radius.pill }, pressed && { opacity: 0.7 }]}
    >
      {glassAvailable() && !reduceTransparency ? (
        <GlassView glassEffectStyle="regular" isInteractive style={shape}>
          {text}
        </GlassView>
      ) : (
        <View style={[shape, { backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line }]}>
          {text}
        </View>
      )}
    </Pressable>
  );
}
