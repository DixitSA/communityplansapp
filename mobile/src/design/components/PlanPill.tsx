import { View } from 'react-native';

import { useTheme } from '../theme';
import type { ColorToken } from '../tokens';
import { AppText } from './AppText';
import type { CardPlan } from './EventCard';
import { Icon } from './Icon';

/** What the row's quick plan button says and looks like for each plan. A pure function so it can be tested. */
export function planPillSpec(plan: CardPlan): { label: string; bg: ColorToken; fg: ColorToken; check: boolean } {
  switch (plan) {
    case 'going':
      return { label: 'Going', bg: 'accent', fg: 'onAccent', check: true };
    case 'down_if_friends':
      return { label: 'Down if', bg: 'accentSoft', fg: 'accent', check: false };
    case 'interested':
      return { label: 'Interested', bg: 'surfaceMuted', fg: 'ink', check: false };
    default:
      return { label: 'Join', bg: 'accent', fg: 'onAccent', check: false };
  }
}

export type PlanMenuOption = { plan: Exclude<CardPlan, null> | null; label: string; symbol: 'checkmark.circle' | 'person.2' | 'heart' | 'xmark' };

/** The menu behind the pill: the three plans, plus Clear once there is one. */
export function planMenuOptions(plan: CardPlan): PlanMenuOption[] {
  const options: PlanMenuOption[] = [
    { plan: 'going', label: 'Going', symbol: 'checkmark.circle' },
    { plan: 'down_if_friends', label: 'Down if friends go', symbol: 'person.2' },
    { plan: 'interested', label: 'Interested', symbol: 'heart' },
  ];
  if (plan) options.push({ plan: null, label: 'Clear', symbol: 'xmark' });
  return options;
}

/** The quick plan button's face. Not interactive by itself: wrap it in a menu (see PlanMenu). */
export function PlanPill({ plan }: { plan: CardPlan }) {
  const { colors, space, radius } = useTheme();
  const spec = planPillSpec(plan);
  return (
    <View
      style={{
        minWidth: 72,
        height: 34,
        paddingHorizontal: space.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.xs,
        borderRadius: radius.pill,
        borderCurve: 'continuous',
        backgroundColor: colors[spec.bg],
      }}
    >
      <AppText variant="footnote" color={spec.fg} maxFontSizeMultiplier={1.3} style={{ fontWeight: '600' }}>
        {spec.label}
      </AppText>
      {spec.check ? <Icon name="checkmark" size={12} color={spec.fg} weight="bold" /> : null}
    </View>
  );
}
