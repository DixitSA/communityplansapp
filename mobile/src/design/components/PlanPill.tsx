import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { View } from 'react-native';

import { useTheme } from '../theme';
import { scrim, type ColorToken } from '../tokens';
import type { CardPlan } from './EventCard';
import { useReduceTransparency } from '../useReduceTransparency';
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

function glassAvailable(): boolean {
  try {
    return isLiquidGlassAvailable();
  } catch {
    return false;
  }
}

/**
 * The quick plan button's face: a circle with the plan's symbol. Not interactive by itself (see PlanMenu).
 * `overImage` is for photo cards: Going stays solid accent, the other states are darker glass (a dark
 * translucent circle without glass or with Reduce Transparency) with a white glyph.
 */
export function PlanPill({ plan, overImage = false }: { plan: CardPlan; overImage?: boolean }) {
  const { colors } = useTheme();
  const reduceTransparency = useReduceTransparency();
  const spec = planPillSpec(plan);
  const onPhoto = overImage && plan !== 'going';
  const circle = {
    width: PLAN_BUTTON_SIZE,
    height: PLAN_BUTTON_SIZE,
    borderRadius: PLAN_BUTTON_SIZE / 2,
    borderCurve: 'continuous' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
  const icon = <Icon name={spec.symbol} size={17} color={onPhoto ? 'onImage' : spec.fg} weight="semibold" />;
  if (onPhoto && glassAvailable() && !reduceTransparency) {
    return (
      <GlassView glassEffectStyle="regular" tintColor={scrim.soft} style={circle}>
        {icon}
      </GlassView>
    );
  }
  return <View style={[circle, { backgroundColor: onPhoto ? scrim.glass : colors[spec.bg] }]}>{icon}</View>;
}
