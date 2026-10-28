import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Icon, MeshArt, useTheme } from '@/design';
import { formatShortDate, formatTime } from '@/lib/dates';

import type { UpcomingPlan } from './stats';

const ART_HEIGHT = 96;
const NOTCH = 16;
const DASHES = 16;

/** One upcoming plan as a ticket: art with the plan state on top, a perforation, then when and where. */
export function PlanTicket({ plan, width }: { plan: UpcomingPlan; width: number }) {
  const { colors, space, radius, shadow } = useTheme();
  const router = useRouter();
  const { event, status } = plan;
  const going = status === 'going';
  const when = `${formatShortDate(event.startsAt)} · ${formatTime(event.startsAt, true)}`;
  const statusLabel = going ? 'Going' : 'Down if friends go';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Opens the event"
      accessibilityLabel={`${event.title}, ${when}, ${event.venue}. ${statusLabel}`}
      onPress={() => router.push({ pathname: '/event/[id]', params: { id: event.id } })}
      style={({ pressed }) => [
        {
          width,
          backgroundColor: colors.surface,
          borderRadius: radius.sheet,
          borderCurve: 'continuous',
          overflow: 'hidden',
          opacity: pressed ? 0.88 : 1,
        },
        shadow,
      ]}
    >
      <View style={{ height: ART_HEIGHT }}>
        <MeshArt id={event.id} interest={event.interest} symbol={event.symbol} symbolSize={64} />
        <View
          style={{
            position: 'absolute',
            top: space.md,
            right: space.md,
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.xs,
            paddingVertical: space.xs,
            paddingHorizontal: space.sm,
            borderRadius: radius.pill,
            backgroundColor: going ? colors.accent : colors.surface,
          }}
        >
          <Icon
            name={going ? 'checkmark' : 'person.2.fill'}
            size={12}
            color={going ? 'onAccent' : 'accent'}
            weight="bold"
          />
          <AppText variant="caption" color={going ? 'onAccent' : 'accent'} style={{ fontWeight: '600' }}>
            {statusLabel}
          </AppText>
        </View>
      </View>

      <View style={{ height: NOTCH, justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: NOTCH }}>
          {Array.from({ length: DASHES }, (_, i) => (
            <View key={i} style={{ width: 6, height: 2, borderRadius: 1, backgroundColor: colors.line }} />
          ))}
        </View>
        <View style={[styles.notch, { left: -NOTCH / 2, backgroundColor: colors.canvas }]} />
        <View style={[styles.notch, { right: -NOTCH / 2, backgroundColor: colors.canvas }]} />
      </View>

      <View style={{ gap: space.xs, paddingHorizontal: space.md, paddingBottom: space.md }}>
        <AppText variant="headline" numberOfLines={2}>
          {event.title}
        </AppText>
        <AppText variant="footnote" color="inkSecondary" numberOfLines={1}>
          {when}
        </AppText>
        <AppText variant="footnote" color="inkSecondary" numberOfLines={1}>
          {event.venue}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  notch: { position: 'absolute', width: NOTCH, height: NOTCH, borderRadius: NOTCH / 2 },
});
