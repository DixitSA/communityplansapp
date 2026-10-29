import { Pressable } from 'react-native';

import { useTheme } from '../theme';
import { AppText } from './AppText';
import { Icon, type SymbolName } from './Icon';
import { UnreadDot } from './UnreadDot';

export type NavRowProps = {
  symbol: SymbolName;
  label: string;
  /** Shows the accent dot. */
  unread?: boolean;
  /** Replaces the label for VoiceOver, e.g. "Activity, new updates". */
  accessibilityLabel?: string;
  onPress: () => void;
};

/** A full-width card row that opens another screen: icon, label, optional unread dot, chevron. */
export function NavRow({ symbol, label, unread = false, accessibilityLabel, onPress }: NavRowProps) {
  const { colors, space, radius } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 52,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingHorizontal: space.lg,
        borderRadius: radius.card,
        borderCurve: 'continuous',
        backgroundColor: colors.surface,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Icon name={symbol} size={20} />
      <AppText variant="body" style={{ flex: 1 }}>
        {label}
      </AppText>
      {unread ? <UnreadDot /> : null}
      <Icon name="chevron.right" size={14} color="inkSecondary" weight="semibold" />
    </Pressable>
  );
}
