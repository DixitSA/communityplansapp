import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { light } from '@/lib/haptics';

import { useTheme } from '../theme';
import { AppText } from './AppText';

export type PrimaryButtonProps = {
  /** Plain text label. Use `children` instead for a label with a rolling number. */
  label?: string;
  children?: ReactNode;
  accessibilityLabel?: string;
  onPress: () => void;
  disabled?: boolean;
};

/** Full-width accent button: the one primary action on a screen (sheet footers, forms). */
export function PrimaryButton({ label, children, accessibilityLabel, onPress, disabled = false }: PrimaryButtonProps) {
  const { colors, space, radius } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        light();
        onPress();
      }}
      style={({ pressed }) => [
        {
          minHeight: 52,
          paddingHorizontal: space.xl,
          borderRadius: radius.pill,
          borderCurve: 'continuous',
          backgroundColor: colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {children ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>{children}</View>
      ) : (
        <AppText variant="headline" color="onAccent">
          {label}
        </AppText>
      )}
    </Pressable>
  );
}
