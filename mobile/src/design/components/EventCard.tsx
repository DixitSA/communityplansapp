import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatShortDate, formatTime, WEEKDAYS_LONG } from '@/lib/dates';
import { light } from '@/lib/haptics';

import { useTheme } from '../theme';
import { AppText } from './AppText';
import { Chip } from './Chip';
import { Facepile, formatFriendsLabel } from './Facepile';
import { GlassButton } from './GlassButton';
import type { SymbolName } from './Icon';
import { MeshArt } from './MeshArt';
import { linearGradient } from './meshFallback';

export type EventCardData = {
  id: string;
  title: string;
  startsAt: Date;
  venue: string;
  distanceMi: number;
  imageUrl?: string;
  /** Category slug (music, food_drinks, fitness, arts_culture, nightlife): picks art palette and tag colors. */
  interest: string;
  /** Tag text, e.g. "Music". */
  categoryLabel: string;
  /** SF Symbol for the placeholder art. */
  symbol: SymbolName;
  /** Friends we can show by name. Only people who are Going, never "interested" (private). */
  friends: { id: string; name: string }[];
  /** All friends going (>= friends.length). */
  friendsGoing: number;
};

/** "Wed, Oct 28 · 8:00 PM" and "The Music Yard · 2.1 mi". */
export function eventMetaLines(e: EventCardData): [string, string] {
  return [
    `${formatShortDate(e.startsAt)} · ${formatTime(e.startsAt)}`,
    `${e.venue} · ${e.distanceMi.toFixed(1)} mi`,
  ];
}

/** VoiceOver label: "Warehouse Party, Wednesday 9 PM, The District, 2.1 miles. Maya is going." */
export function eventA11yLabel(e: EventCardData, saved = false): string {
  const day = WEEKDAYS_LONG[e.startsAt.getDay()];
  const miles = `${e.distanceMi.toFixed(1)} ${e.distanceMi === 1 ? 'mile' : 'miles'}`;
  const friends = formatFriendsLabel(
    e.friends.map((f) => f.name),
    e.friendsGoing,
  );
  return [
    `${e.title}, ${day} ${formatTime(e.startsAt, true)}, ${e.venue}, ${miles}.`,
    friends ? `${friends}.` : '',
    saved ? 'Saved.' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export type EventCardProps = {
  event: EventCardData;
  saved?: boolean;
  onPress?: () => void;
  onToggleSave?: () => void;
};

export function EventCard({ event, saved = false, onPress, onToggleSave }: EventCardProps) {
  const { space, radius } = useTheme();
  const [dateLine, venueLine] = eventMetaLines(event);

  return (
    // The heart is a sibling of the card Pressable (not a child) so buttons never nest on web.
    <View
      style={{
        minHeight: 170,
        borderRadius: radius.card,
        borderCurve: 'continuous',
        overflow: 'hidden',
      }}
    >
      <Pressable
        accessible
        accessibilityRole="button"
        accessibilityLabel={eventA11yLabel(event, saved)}
        accessibilityActions={[{ name: 'save', label: saved ? 'Remove from saved' : 'Save' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'save') onToggleSave?.();
        }}
        onPress={onPress}
        style={({ pressed }) => [{ flex: 1, minHeight: 170, justifyContent: 'flex-end' }, pressed && { opacity: 0.92 }]}
      >
        <View style={StyleSheet.absoluteFill}>
          {event.imageUrl ? (
            <Image
              source={{ uri: event.imageUrl }}
              contentFit="cover"
              style={{ flex: 1 }}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <MeshArt id={event.id} interest={event.interest} symbol={event.symbol} />
          )}
        </View>
        {/* Bottom scrim so white text stays readable on any image. */}
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            linearGradient('linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.35) 40%, rgba(0,0,0,0.75) 100%)'),
          ]}
        />
        <View style={{ gap: space.xs, padding: space.md, paddingTop: space.xxxl * 2 }}>
          <AppText variant="title2" color="onImage">
            {event.title}
          </AppText>
          <View>
            <AppText variant="subheadline" color="onImage">
              {dateLine}
            </AppText>
            <AppText variant="subheadline" color="onImage">
              {venueLine}
            </AppText>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, paddingTop: space.xs }}>
            <View style={{ flexShrink: 1 }}>
              {event.friendsGoing > 0 ? (
                <Facepile people={event.friends} total={event.friendsGoing} labelColor="onImage" />
              ) : null}
            </View>
            <Chip label={event.categoryLabel} size="small" category={event.interest} />
          </View>
        </View>
      </Pressable>

      <View style={{ position: 'absolute', top: space.sm, right: space.sm }}>
        <GlassButton
          symbol={saved ? 'heart.fill' : 'heart'}
          iconColor="onImage"
          overImage
          accessibilityLabel={saved ? `Unsave ${event.title}` : `Save ${event.title}`}
          onPress={() => {
            light();
            onToggleSave?.();
          }}
        />
      </View>
    </View>
  );
}
