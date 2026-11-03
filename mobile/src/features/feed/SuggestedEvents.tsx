import { View } from 'react-native';

import { AppText, useTheme } from '@/design';
import { EventRowLink } from '@/features/event/EventCardLink';
import type { FeedEvent } from '@/lib/api';

/** A short list of real events for empty screens, each with its Going count (a number, never names). */
export function SuggestedEvents({ events, note }: { events: FeedEvent[]; note?: string }) {
  const { space } = useTheme();
  if (events.length === 0) return null;
  return (
    <View style={{ gap: space.sm }}>
      {events.map((event) => (
        <View key={event.id} style={{ gap: space.xs }}>
          <EventRowLink event={event} />
          <AppText variant="caption" color="inkSecondary" style={{ paddingHorizontal: space.sm }}>
            {/* A zero reads as "nobody wants this"; invite them to be first instead. */}
            {event.goingCount > 0 ? `${event.goingCount} going${note ? ` · ${note}` : ''}` : 'Be the first one going'}
          </AppText>
        </View>
      ))}
    </View>
  );
}
