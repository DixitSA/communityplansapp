import { Ionicons } from '@expo/vector-icons';
import { Platform, Pressable } from 'react-native';

import { AppText, useTheme } from '@/design';

export type AppleSignInButtonProps = {
  onPress: () => void;
  disabled?: boolean;
};

/**
 * Non-iOS fallback. Sign in with Apple is iOS-only, so Android shows nothing; the web build shows a
 * look-alike so the screen can be screenshotted and the demo flow clicked through.
 */
export function AppleSignInButton({ onPress, disabled = false }: AppleSignInButtonProps) {
  const { colors, space, radius } = useTheme();
  if (Platform.OS !== 'web') return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Sign in with Apple"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 52,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.sm,
        borderRadius: radius.pill,
        borderCurve: 'continuous',
        backgroundColor: colors.ink,
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
      })}
    >
      <Ionicons name="logo-apple" size={20} color={colors.canvas} />
      <AppText variant="headline" color="canvas">
        Sign in with Apple
      </AppText>
    </Pressable>
  );
}
