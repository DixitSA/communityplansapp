import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AppText, Icon, MeshArt, useTheme } from '@/design';
import { formatShortDate, formatTime } from '@/lib/dates';

import type { UpcomingPlan } from './stats';

/** Compact upcoming-plan row: art thumbnail, title, when and where, and the plan state glyph. */
export function PlanRow({ plan }: { plan: UpcomingPlan }) {
  const { colors, space, radius } = useTheme();
  const router = useRouter();
  const { event, status } = plan;
  const going = status === 'going';
  const when = `${formatShortDate(event.startsAt)} · ${formatTime(event.startsAt, true)}`;
  const statusLabel = going ? 'Going' : 'Down if friends go';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Opens the event"
      onPress={() => router.push({ pathname: '/event/[id]', params: { id: event.id } })}
      accessibilityLabel={`${event.title}, ${when}, ${event.venue}. ${statusLabel}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        padding: space.md,
        borderRadius: radius.card,
        borderCurve: 'continuous',
        backgroundColor: colors.surface,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ width: 56, height: 56, borderRadius: radius.thumb, borderCurve: 'continuous', overflow: 'hidden' }}>
        <MeshArt id={event.id} interest={event.interest} symbol={event.symbol} symbolSize={36} />
      </View>
      <View style={{ flex: 1, gap: space.xs }}>
        <AppText variant="headline" numberOfLines={1}>
          {event.title}
        </AppText>
        <AppText variant="footnote" color="inkSecondary" numberOfLines={1}>
          {when}
        </AppText>
        <AppText variant="footnote" color="inkSecondary" numberOfLines={1}>
          {event.venue}
        </AppText>
      </View>
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: going ? colors.accent : colors.accentSoft,
        }}
      >
        <Icon name={going ? 'checkmark' : 'person.2.fill'} size={13} color={going ? 'onAccent' : 'accent'} weight="bold" />
      </View>
    </Pressable>
  );
}
