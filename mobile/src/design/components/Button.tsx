import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '../theme';
import { AppText } from './AppText';
import { Icon, type SymbolName } from './Icon';

export type ButtonProps = {
  label: string;
  onPress: () => void;
  /** Primary is the single filled accent action on a screen. Secondary is a surface button. */
  variant?: 'primary' | 'secondary';
  symbol?: SymbolName;
  accessibilityLabel?: string;
};

export function Button({ label, onPress, variant = 'secondary', symbol, accessibilityLabel }: ButtonProps) {
  const { colors, space, radius } = useTheme();
  const primary = variant === 'primary';
  const fg = primary ? 'onAccent' : 'ink';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        {
          minHeight: 52,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space.sm,
          paddingHorizontal: space.lg,
          paddingVertical: space.md,
          borderRadius: radius.pill,
          borderCurve: 'continuous',
          backgroundColor: primary ? colors.accent : colors.surface,
          borderWidth: primary ? 0 : StyleSheet.hairlineWidth,
          borderColor: colors.line,
        },
        pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
      ]}
    >
      {symbol ? <Icon name={symbol} size={18} color={fg} /> : null}
      <AppText variant="headline" color={fg} style={{ flexShrink: 1, textAlign: 'center' }}>
        {label}
      </AppText>
    </Pressable>
  );
}
