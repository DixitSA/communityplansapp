import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, Button, FieldStatusLine, Icon, useTheme } from '@/design';
import { formatShortDate, formatTime } from '@/lib/dates';
import { selection } from '@/lib/haptics';
import { startsAtBounds } from '@/lib/submission';

import type { DateTimeFieldProps } from './DateTimeField';

/** Tomorrow evening: a sensible place for the wheels to start. */
function defaultWheel(): Date {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1, 19, 0);
}

/** Native iOS date and time wheels (same approach as the onboarding birthday) under a tappable row. */
export function DateTimeField({ label, value, onChange, status }: DateTimeFieldProps) {
  const { colors, space, radius } = useTheme();
  const [open, setOpen] = useState(false);
  const [wheel, setWheel] = useState<Date>(() => value ?? defaultWheel());
  // Computed once on mount; if the sheet stays open a long time, form validation still catches a stale minimum.
  const [bounds] = useState(() => startsAtBounds());
  const error = status?.tone === 'error';
  const text = value ? `${formatShortDate(value)} · ${formatTime(value)}` : null;

  return (
    <View style={{ gap: space.sm }}>
      <AppText variant="footnote" color="inkSecondary" style={{ fontWeight: '500', paddingLeft: space.xs }}>
        {label}
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
          accessibilityLabel={label}
          accessibilityValue={{ text: text ?? 'Not set' }}
          accessibilityHint="Opens the date and time picker"
          onPress={() => {
            selection();
            if (!open && !value) onChange(wheel);
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
          <AppText variant="body" color={text ? 'ink' : 'inkSecondary'}>
            {text ?? 'Select date and time'}
          </AppText>
          <Icon name={open ? 'chevron.down' : 'chevron.right'} size={14} color="inkSecondary" weight="semibold" />
        </Pressable>
        {open ? (
          <View style={{ paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.sm }}>
            <DateTimePicker
              value={wheel}
              mode="datetime"
              display="spinner"
              minimumDate={bounds.min}
              maximumDate={bounds.max}
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
      {status ? <FieldStatusLine status={status} /> : null}
    </View>
  );
}
