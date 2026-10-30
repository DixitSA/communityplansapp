import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  AppText,
  EventImage,
  Facepile,
  Icon,
  MeshArt,
  eventA11yLabel,
  useTheme,
  type EventCardData,
} from '@/design';
import { WEEKDAYS_LONG, formatTime } from '@/lib/dates';

const THUMB = 72;

/** The card that rises over the map when a pin is tapped. Opens the event page. */
export function MapEventCard({ event }: { event: EventCardData }) {
  const { colors, space, radius, shadow } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={eventA11yLabel(event)}
      accessibilityHint="Opens the event"
      onPress={() => router.push(`/event/${event.id}` as Href)}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          padding: space.md,
          borderRadius: radius.sheet,
          borderCurve: 'continuous',
          backgroundColor: colors.surface,
          opacity: pressed ? 0.9 : 1,
        },
        shadow,
      ]}
    >
      <View
        style={{
          width: THUMB,
          height: THUMB,
          borderRadius: radius.thumb,
          borderCurve: 'continuous',
          overflow: 'hidden',
        }}
      >
        {event.imageUrl ? (
          <View style={StyleSheet.absoluteFill}>
            <EventImage eventId={event.id} source={event.imageUrl} sensitive={event.imageSensitive} />
          </View>
        ) : (
          <MeshArt id={event.id} interest={event.interest} symbol={event.symbol} style={StyleSheet.absoluteFill} />
        )}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="headline" numberOfLines={2}>
          {event.title}
        </AppText>
        <AppText variant="footnote" style={{ fontWeight: '600' }} color="accent" numberOfLines={1}>
          {`${WEEKDAYS_LONG[event.startsAt.getDay()].slice(0, 3)} · ${formatTime(event.startsAt)}`}
        </AppText>
        <AppText variant="footnote" color="inkSecondary" numberOfLines={1}>
          {event.venue}
        </AppText>
        {event.friendsGoing > 0 ? (
          <View style={{ paddingTop: space.xs }}>
            <Facepile people={event.friends} total={event.friendsGoing} avatarSize={22} labelLines={1} />
          </View>
        ) : null}
      </View>
      <Icon name="chevron.right" size={14} color="inkSecondary" weight="semibold" />
    </Pressable>
  );
}
