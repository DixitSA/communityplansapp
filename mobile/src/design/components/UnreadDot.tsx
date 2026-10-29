import { View } from 'react-native';

import { useTheme } from '../theme';

/** Diameter of the dot. */
export const UNREAD_DOT = 10;

/** An accent dot: "something new is inside". Decorative; the parent's label says so for VoiceOver. */
export function UnreadDot({ size = UNREAD_DOT }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.accent }}
    />
  );
}
