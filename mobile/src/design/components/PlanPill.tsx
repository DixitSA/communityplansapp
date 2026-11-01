import { View } from 'react-native';

import { useTheme } from '../theme';
import type { ColorToken } from '../tokens';
import type { CardPlan } from './EventCard';
import { Icon, type SymbolName } from './Icon';

/** Size of the round quick plan button: Apple's minimum touch target. */
export const PLAN_BUTTON_SIZE = 44;

/** What the round plan button shows for each plan. `label` is what VoiceOver says. */
export function planPillSpec(plan: CardPlan): { label: string; symbol: SymbolName; bg: ColorToken; fg: ColorToken } {
  switch (plan) {
    case 'going':
      return { label: 'Going', symbol: 'checkmark', bg: 'accent', fg: 'onAccent' };
    case 'down_if_friends':
      return { label: 'Down if friends go', symbol: 'person.2.fill', bg: 'accentSoft', fg: 'accent' };
    case 'interested':
      return { label: 'Interested', symbol: 'heart.fill', bg: 'accentSoft', fg: 'accent' };
    default:
      return { label: 'No plan yet', symbol: 'plus', bg: 'surfaceMuted', fg: 'ink' };
  }
}

/** The quick plan button's spoken label, e.g. "Trivia Night: Going. Change plan". */
export function planButtonLabel(plan: CardPlan, title: string): string {
  return plan ? `${title}: ${planPillSpec(plan).label}. Change plan` : `Make a plan for ${title}`;
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

/** The quick plan button's face: a circle with the plan's symbol. Not interactive by itself (see PlanMenu). */
export function PlanPill({ plan }: { plan: CardPlan }) {
  const { colors } = useTheme();
  const spec = planPillSpec(plan);
  return (
    <View
      style={{
        width: PLAN_BUTTON_SIZE,
        height: PLAN_BUTTON_SIZE,
        borderRadius: PLAN_BUTTON_SIZE / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors[spec.bg],
      }}
    >
      <Icon name={spec.symbol} size={17} color={spec.fg} weight="semibold" />
    </View>
  );
}
