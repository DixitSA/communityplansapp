import { Host } from '@expo/ui';
import { Button, Menu, RNHostView } from '@expo/ui/swift-ui';
import { View } from 'react-native';

import { Chip } from '@/design';
import { selection } from '@/lib/haptics';

import type { FilterMenuChipProps } from './FilterMenuChip';

/**
 * A filter chip that opens a real iOS menu (SwiftUI Menu via @expo/ui). The chip itself is a React
 * Native view shown as the menu's label; `pointerEvents="none"` lets the menu receive the tap.
 */
export function FilterMenuChip<T extends string | number>({
  label,
  active,
  options,
  value,
  onChange,
}: FilterMenuChipProps<T>) {
  return (
    <Host matchContents>
      <Menu
        label={
          <RNHostView matchContents>
            <View pointerEvents="none">
              <Chip label={label} trailingSymbol="chevron.down" selected={active} filled />
            </View>
          </RNHostView>
        }
      >
        {options.map((o) => (
          <Button
            key={String(o.value)}
            label={o.label}
            systemImage={o.value === value ? 'checkmark' : undefined}
            onPress={() => {
              selection();
              onChange(o.value);
            }}
          />
        ))}
      </Menu>
    </Host>
  );
}
