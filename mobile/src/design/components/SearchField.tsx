import { Pressable, TextInput, View, type TextInputProps } from 'react-native';

import { selection } from '@/lib/haptics';

import { useTheme } from '../theme';
import { Icon } from './Icon';

export type SearchFieldProps = Omit<TextInputProps, 'style' | 'placeholderTextColor' | 'value' | 'onChangeText'> & {
  value: string;
  onChangeText: (text: string) => void;
  /** Also the VoiceOver label. */
  placeholder: string;
};

/** A capsule search field with a magnifier and a clear button, in the style of iOS's own search bar. */
export function SearchField({ value, onChangeText, placeholder, ...input }: SearchFieldProps) {
  const { colors, space, radius, type } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        minHeight: 44,
        paddingHorizontal: space.md,
        borderRadius: radius.pill,
        borderCurve: 'continuous',
        backgroundColor: colors.surfaceMuted,
      }}
    >
      <Icon name="magnifyingglass" size={16} color="inkSecondary" weight="semibold" />
      <TextInput
        {...input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkSecondary}
        selectionColor={colors.accent}
        accessibilityLabel={input.accessibilityLabel ?? placeholder}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="never"
        // Our own clear button replaces the system one so it looks the same on every platform.
        style={[type.body, { flex: 1, color: colors.ink, paddingVertical: space.sm, outlineWidth: 0, outlineStyle: 'solid', outlineColor: 'transparent' }]}
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={space.md}
          onPress={() => {
            selection();
            onChangeText('');
          }}
        >
          <Icon name="xmark.circle.fill" size={18} color="inkSecondary" />
        </Pressable>
      ) : null}
    </View>
  );
}
