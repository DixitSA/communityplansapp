import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, Button, FieldStatusLine, Icon, useTheme } from '@/design';
import { MONTHS_LONG } from '@/lib/dates';
import { selection } from '@/lib/haptics';

import type { BirthdateFieldProps } from './BirthdateField';

const MIN_DATE = new Date(1900, 0, 1);

function formatLong(d: Date): string {
  return `${MONTHS_LONG[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** Native iOS date wheels (SwiftUI DatePicker via @expo/ui) that open under a tappable row. */
export function BirthdateField({ value, onChange, status }: BirthdateFieldProps) {
  const { colors, space, radius } = useTheme();
  const [open, setOpen] = useState(false);
  const [wheel, setWheel] = useState<Date>(() => {
    const t = new Date();
    return value ?? new Date(t.getFullYear() - 25, t.getMonth(), t.getDate());
  });
  const error = status?.tone === 'error';

  return (
    <View style={{ gap: space.sm }}>
      <AppText variant="footnote" color="inkSecondary" style={{ fontWeight: '500', paddingLeft: space.xs }}>
        Birthday
      </AppText>
      <View
        style={{
          borderRadius: radius.card,
          borderCurve: 'continuous',
          backgroundColor: colors.surface,
          borderWidth: 2,
          borderColor: error ? colors.danger : open ? colors.accent : 'transparent',
          overflow: 'hidden',
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Birthday"
          accessibilityValue={{ text: value ? formatLong(value) : 'Not set' }}
          accessibilityHint="Opens the date picker"
          onPress={() => {
            selection();
            setOpen((o) => !o);
          }}
          style={{
            minHeight: 52,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: space.lg,
          }}
        >
          <AppText variant="body" color={value ? 'ink' : 'inkSecondary'}>
            {value ? formatLong(value) : 'Select your birthday'}
          </AppText>
          <Icon name={open ? 'chevron.down' : 'chevron.right'} size={14} color="inkSecondary" weight="semibold" />
        </Pressable>
        {open ? (
          <View style={{ paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.sm }}>
            <DateTimePicker
              value={wheel}
              mode="date"
              display="spinner"
              minimumDate={MIN_DATE}
              maximumDate={new Date()}
              onChange={(_event, date) => {
                if (!date) return;
                setWheel(date);
                onChange(date);
              }}
            />
            <Button
              label="Done"
              onPress={() => {
                onChange(wheel);
                setOpen(false);
              }}
            />
          </View>
        ) : null}
      </View>
      {status ? (
        <FieldStatusLine status={status} />
      ) : (
        <AppText variant="footnote" color="inkSecondary" style={{ paddingLeft: space.xs }}>
          Only used to check you are 18 or older. Never shown to anyone.
        </AppText>
      )}
    </View>
  );
}
