import { View } from 'react-native';

import { useTheme } from '../theme';
import { AppText } from './AppText';
import { Icon, type SymbolName } from './Icon';

/** From this many people going, an event counts as "popping". Only real counts feed it. */
export const POPPING_THRESHOLD = 5;

/** True when enough people are going to call the event popping. `null` (count unknown) never is. */
export function isPopping(goingCount: number | null | undefined): boolean {
  return typeof goingCount === 'number' && goingCount >= POPPING_THRESHOLD;
}

export type HotBadgeProps = {
  label: string;
  symbol?: SymbolName;
  /** `solid` is the loud flame-orange pill; `soft` is the tinted one for tight rows. */
  tone?: 'solid' | 'soft';
  /** Just the flame in a circle, for tight spots like a row thumbnail. The label is not drawn (add it to the parent's VoiceOver label). */
  iconOnly?: boolean;
};

/** A small flame pill for "popping" moments: lots going, or a hot spotlight pick. */
export function HotBadge({ label, symbol = 'flame.fill', tone = 'solid', iconOnly = false }: HotBadgeProps) {
  const { colors, space, radius } = useTheme();
  const solid = tone === 'solid';
  if (iconOnly) {
    return (
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: radius.pill,
          backgroundColor: colors.hot,
          borderWidth: 2,
          borderColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={symbol} size={12} color="onHot" />
      </View>
    );
  }
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: space.xs - 1,
        paddingHorizontal: space.sm,
        paddingVertical: 3,
        borderRadius: radius.pill,
        borderCurve: 'continuous',
        backgroundColor: solid ? colors.hot : colors.hotSoft,
      }}
    >
      <Icon name={symbol} size={11} color={solid ? 'onHot' : 'hot'} />
      <AppText
        variant="caption"
        color={solid ? 'onHot' : 'ink'}
        maxFontSizeMultiplier={1.6}
        style={{ fontWeight: '700', lineHeight: 15 }}
      >
        {label}
      </AppText>
    </View>
  );
}
