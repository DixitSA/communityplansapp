import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';

import { AppText, Avatar, Button, EmptyState, Icon, useTheme } from '@/design';
import { shareEvent } from '@/features/event/actions';
import { addToCalendarWithAlert } from '@/features/event/calendar';
import { GoingBurst } from '@/features/event/GoingBurst';
import { goingTogetherLine, othersCount } from '@/features/event/plansLogic';
import { TicketCard } from '@/features/event/TicketCard';
import { useEvent } from '@/features/event/useEvent';
import { countdownLabel } from '@/lib/dates';
import { success } from '@/lib/haptics';
import { useHydrated } from '@/lib/useHydrated';
import { useNow } from '@/lib/useNow';
import { hasEnded } from '@/features/feed/agenda';

const BADGE = 64;

/** The Going moment (DESIGN.md 4.5): a celebratory sheet over the event page, not a new page. */
export default function GoingSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: event } = useEvent(id);
  const { colors, space, radius } = useTheme();
  const router = useRouter();
  const hydrated = useHydrated();
  const now = useNow();
  const ended = !!event && hasEnded(event, now);

  // One success haptic as the sheet appears, in step with the burst.
  useEffect(() => {
    if (!ended) success();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on first appearance
  }, []);

  if (!hydrated) return null;

  // myStatus and goingCount change together in the RSVP cache, so you're never counted among the others.
  const others = !event
    ? 0
    : event.goingCount === null
      ? event.othersGoing
      : othersCount(event.goingCount, event.friendsGoing, event.myStatus === 'going');

  if (ended) {
    return <EmptyState symbol="clock" title="that one's over" message="Close this and see what's on next." />;
  }

  return (
    <>
      {event ? (
        <ScrollView
          style={{ backgroundColor: colors.canvas }}
          contentContainerStyle={{ padding: space.lg, paddingTop: space.xxl, gap: space.xl }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ alignItems: 'center', gap: space.md }}>
            <View style={{ width: BADGE, height: BADGE }}>
              {/* Layout animations follow the system Reduce Motion setting, so the badge just appears there. */}
              <Animated.View
                entering={ZoomIn.springify().damping(12)}
                style={{
                  width: BADGE,
                  height: BADGE,
                  borderRadius: radius.pill,
                  backgroundColor: colors.accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="checkmark" size={30} color="onAccent" weight="bold" />
              </Animated.View>
              <GoingBurst />
            </View>
            <View style={{ alignItems: 'center', gap: space.sm }}>
              <AppText variant="title" accessibilityRole="header">
                You&apos;re going
              </AppText>
              {/* Who you'll see there. Fellow attendees are only counted, never named; friends get faces. */}
              <View accessible style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                {event.friends.length > 0 ? (
                  <View style={{ flexDirection: 'row' }}>
                    {event.friends.slice(0, 3).map((f, i) => (
                      <View key={f.id} style={{ marginLeft: i === 0 ? 0 : -space.sm }}>
                        <Avatar name={f.name} size={28} ring ringColor="canvas" />
                      </View>
                    ))}
                  </View>
                ) : null}
                <AppText variant="subheadline" color="inkSecondary" style={{ flexShrink: 1, textAlign: 'center' }}>
                  {goingTogetherLine(
                    event.friends.map((f) => f.name),
                    event.friendsGoing,
                    others,
                  )}
                </AppText>
              </View>
            </View>
          </View>

          <Animated.View entering={FadeInDown.delay(150).springify().damping(16)}>
            <TicketCard event={event} countdown={countdownLabel(event.startsAt, event.endsAt, new Date())} />
          </Animated.View>

          <View style={{ gap: space.sm }}>
            <Button
              variant="primary"
              symbol="message.fill"
              label="Open chat"
              onPress={() => router.dismissTo({ pathname: '/chat/[eventId]', params: { eventId: event.id } })}
            />
            <Button
              symbol="calendar.badge.plus"
              label="Add to Calendar"
              onPress={() => addToCalendarWithAlert(event)}
            />
            <Button
              symbol="person.badge.plus"
              label="Bring a friend"
              onPress={() => shareEvent(event, 'invite')}
            />
          </View>
        </ScrollView>
      ) : (
        <EmptyState symbol="sparkles" title="can't find that event" message="Close this and pick another plan." />
      )}
    </>
  );
}
