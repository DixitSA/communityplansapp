import { Pressable, View } from 'react-native';

import { selection } from '@/lib/haptics';

import { useTheme } from '../theme';
import { AppText } from './AppText';

export type SegmentedControlProps<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

// TODO: @expo/ui — swap for the native SwiftUI Picker (segmented) once we do a device pass.
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const { colors, space, radius } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        padding: space.xs,
        borderRadius: radius.card,
        borderCurve: 'continuous',
        backgroundColor: colors.surfaceMuted,
      }}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{ selected }}
            onPress={() => {
              if (selected) return;
              selection();
              onChange(o.value);
            }}
            style={[
              {
                flex: 1,
                alignItems: 'center',
                paddingVertical: space.sm,
                borderRadius: radius.thumb,
                borderCurve: 'continuous',
              },
              selected && { backgroundColor: colors.accent },
            ]}
          >
            <AppText
              variant="subheadline"
              color={selected ? 'onAccent' : 'inkSecondary'}
              style={{ fontWeight: selected ? '600' : '500' }}
              maxFontSizeMultiplier={1.6}
            >
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
