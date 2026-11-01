import { Host } from '@expo/ui';
import { Button, Menu, RNHostView } from '@expo/ui/swift-ui';
import { View } from 'react-native';

import { selection } from '@/lib/haptics';

import { PlanPill, planButtonLabel, planMenuOptions } from './PlanPill';
import type { PlanMenuProps } from './PlanMenu';

/**
 * The row's quick plan button as a real iOS menu (SwiftUI Menu via @expo/ui), like the filter chips:
 * the pill is a React Native view shown as the menu's label, and `pointerEvents="none"` lets the menu take the tap.
 */
export function PlanMenu({ plan, title, onChange }: PlanMenuProps) {
  return (
    <Host matchContents>
      <Menu
        label={
          <RNHostView matchContents>
            {/* The face is an icon, so it carries the words VoiceOver reads for the menu button. */}
            <View pointerEvents="none" accessible accessibilityRole="button" accessibilityLabel={planButtonLabel(plan, title)}>
              <PlanPill plan={plan} />
            </View>
          </RNHostView>
        }
      >
        {planMenuOptions(plan).map((o) => (
          <Button
            key={o.label}
            label={o.label}
            systemImage={o.plan === plan ? 'checkmark' : o.symbol}
            onPress={() => {
              selection();
              onChange(o.plan);
            }}
          />
        ))}
      </Menu>
    </Host>
  );
}
