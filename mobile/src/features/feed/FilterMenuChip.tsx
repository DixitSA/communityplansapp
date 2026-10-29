import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, Chip, useTheme, type SymbolName } from '@/design';
import { selection } from '@/lib/haptics';

export type MenuOption<T extends string | number> = { value: T; label: string };

export type FilterMenuChipProps<T extends string | number> = {
  /** Chip text: the current choice. */
  label: string;
  /** Leading SF Symbol. */
  symbol?: SymbolName;
  /** Filled green when the filter isn't at its default. */
  active: boolean;
  options: MenuOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

/**
 * Web / Android fallback for the native iOS menu (see FilterMenuChip.ios.tsx):
 * a chip that opens a small popover list.
 */
export function FilterMenuChip<T extends string | number>({
  label,
  symbol,
  active,
  options,
  value,
  onChange,
}: FilterMenuChipProps<T>) {
  const { colors, space, radius } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ zIndex: open ? 10 : 0 }}>
      <Chip label={label} symbol={symbol} selected={active} filled onPress={() => setOpen((o) => !o)} />
      {open ? (
        <View
          accessibilityRole="menu"
          style={{
            position: 'absolute',
            top: '100%',
            marginTop: space.xs,
            minWidth: 150,
            padding: space.xs,
            borderRadius: radius.card,
            borderCurve: 'continuous',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.line,
          }}
        >
          {options.map((o) => (
            <Pressable
              key={String(o.value)}
              accessibilityRole="menuitem"
              accessibilityState={{ selected: o.value === value }}
              onPress={() => {
                selection();
                onChange(o.value);
                setOpen(false);
              }}
              style={{ paddingVertical: space.sm, paddingHorizontal: space.md }}
            >
              <AppText variant="subheadline" color={o.value === value ? 'accent' : 'ink'} style={{ fontWeight: o.value === value ? '600' : '400' }}>
                {o.label}
              </AppText>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
