import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, View } from 'react-native';

import { AppText, Button, EmptyState, Icon, useTheme } from '@/design';
import { shareEvent } from '@/features/event/actions';
import { addToCalendarWithAlert } from '@/features/event/calendar';
import { GoingBurst } from '@/features/event/GoingBurst';
import { TicketCard } from '@/features/event/TicketCard';
import { useEvent } from '@/features/event/useEvent';
import { success } from '@/lib/haptics';
import { useHydrated } from '@/lib/useHydrated';

/** The Going moment (DESIGN.md 4.5): a celebratory sheet over the event page, not a new page. */
export default function GoingSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: event } = useEvent(id);
  const { colors, space, radius } = useTheme();
  const router = useRouter();
  const hydrated = useHydrated();

  // One success haptic as the sheet appears, in step with the burst.
  useEffect(() => {
    success();
  }, []);

  if (!hydrated) return null;

  return (
    <>
      {event ? (
        <ScrollView
          style={{ backgroundColor: colors.canvas }}
          contentContainerStyle={{ padding: space.lg, paddingTop: space.xxl, gap: space.xl }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ alignItems: 'center', gap: space.md }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: radius.pill,
                backgroundColor: colors.accent,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="checkmark" size={30} color="onAccent" weight="bold" />
              <GoingBurst />
            </View>
            <View style={{ alignItems: 'center', gap: space.xs }}>
              <AppText variant="title" accessibilityRole="header">
                You&apos;re going
              </AppText>
              <AppText variant="subheadline" color="inkSecondary" style={{ textAlign: 'center' }}>
                A good plan just became a real plan.
              </AppText>
            </View>
          </View>

          <TicketCard event={event} />

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
              label="Invite a friend"
              onPress={() => shareEvent(event, 'invite')}
            />
          </View>
        </ScrollView>
      ) : (
        <EmptyState symbol="sparkles" title="We can't find that event" message="Close this and pick another plan." />
      )}
    </>
  );
}
