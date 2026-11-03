import { View } from 'react-native';

import { AppText, useTheme } from '@/design';
import { EventRowLink } from '@/features/event/EventCardLink';
import type { FeedEvent } from '@/lib/api';

/** A short list of real events for empty screens, each with its Going count (a number, never names). */
export function SuggestedEvents({ events, note }: { events: FeedEvent[]; note?: string }) {
  const { space } = useTheme();
  if (events.length === 0) return null;
  const nobodyYet = events.every((e) => e.goingCount === 0);
  return (
    <View style={{ gap: space.sm }}>
      {events.map((event) => (
        <View key={event.id} style={{ gap: space.xs }}>
          <EventRowLink event={event} />
          {/* A zero reads as "nobody wants this", so rows with nobody going yet carry no caption. */}
          {event.goingCount > 0 ? (
            <AppText variant="caption" color="inkSecondary" style={{ paddingHorizontal: space.sm }}>
              {`${event.goingCount} going${note ? ` · ${note}` : ''}`}
            </AppText>
          ) : null}
        </View>
      ))}
      {nobodyYet ? (
        <AppText variant="footnote" color="inkSecondary" style={{ paddingHorizontal: space.sm }}>
          Nobody’s claimed these yet. Be the first one in.
        </AppText>
      ) : null}
    </View>
  );
}
