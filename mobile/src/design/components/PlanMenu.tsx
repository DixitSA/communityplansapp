import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { selection } from '@/lib/haptics';

import { useTheme } from '../theme';
import { AppText } from './AppText';
import type { CardPlan } from './EventCard';
import { PlanPill, planMenuOptions, planPillSpec } from './PlanPill';

export type PlanMenuProps = {
  plan: CardPlan;
  title: string;
  /** `null` clears the plan. */
  onChange: (plan: CardPlan) => void;
};

/** Web / Android fallback for the native iOS menu (see PlanMenu.ios.tsx): the pill opens a small popover list. */
export function PlanMenu({ plan, title, onChange }: PlanMenuProps) {
  const { colors, space, radius } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ zIndex: open ? 10 : 0 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}: your plan is ${planPillSpec(plan).label}. Change plan`}
        onPress={() => setOpen((o) => !o)}
      >
        <PlanPill plan={plan} />
      </Pressable>
      {open ? (
        <View
          accessibilityRole="menu"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: space.xs,
            minWidth: 170,
            padding: space.xs,
            borderRadius: radius.card,
            borderCurve: 'continuous',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.line,
          }}
        >
          {planMenuOptions(plan).map((o) => (
            <Pressable
              key={o.label}
              accessibilityRole="menuitem"
              accessibilityState={{ selected: o.plan === plan }}
              onPress={() => {
                selection();
                onChange(o.plan);
                setOpen(false);
              }}
              style={{ paddingVertical: space.sm, paddingHorizontal: space.md }}
            >
              <AppText variant="subheadline" color={o.plan === plan ? 'accent' : 'ink'}>
                {o.label}
              </AppText>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
