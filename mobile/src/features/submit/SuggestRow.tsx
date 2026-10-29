import { router } from 'expo-router';
import { Pressable } from 'react-native';

import { AppText, Icon, useTheme } from '@/design';
import { selection } from '@/lib/haptics';

/** A quiet "Suggest an event" row. It opens the suggest sheet. */
export function SuggestRow({ surface = false }: { surface?: boolean }) {
  const { colors, space, radius } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Suggest an event"
      accessibilityHint="Opens a form to send us an event you saw elsewhere"
      onPress={() => {
        selection();
        router.push('/suggest');
      }}
      style={({ pressed }) => ({
        minHeight: 52,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingHorizontal: space.lg,
        borderRadius: radius.card,
        borderCurve: 'continuous',
        backgroundColor: surface ? colors.surface : 'transparent',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Icon name="plus.bubble" size={20} color="accent" />
      <AppText variant="body" color={surface ? 'ink' : 'accent'} style={{ flex: 1 }}>
        Suggest an event
      </AppText>
      {surface ? <Icon name="chevron.right" size={14} color="inkSecondary" weight="semibold" /> : null}
    </Pressable>
  );
}
