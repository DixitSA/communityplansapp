import { Image } from 'expo-image';
import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
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
  /**
   * Makes the card a link to this route, with the native iOS zoom transition (iOS 18+; a plain
   * push elsewhere). Don't also pass `onPress`.
   */
  href?: Href;
  /** `Link.MenuAction` items for the long-press menu (with a live preview). iOS only, and only with `href`. */
  menuActions?: ReactNode;
};

export function EventCard({ event, saved = false, onPress, onToggleSave, href, menuActions }: EventCardProps) {
  const { space, radius, colors, scheme } = useTheme();
  const [dateLine, venueLine] = eventMetaLines(event);

  const cardContent = (
    <View style={{ minHeight: 170, justifyContent: 'flex-end' }}>
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
    </View>
  );

  const pressable = (
    <Pressable
      accessible
      accessibilityRole={href ? 'link' : 'button'}
      accessibilityLabel={eventA11yLabel(event, saved)}
      accessibilityActions={[{ name: 'save', label: saved ? 'Remove from saved' : 'Save' }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'save') onToggleSave?.();
      }}
      onPress={onPress}
      style={({ pressed }) => [{ minHeight: 170 }, pressed && { opacity: 0.92 }]}
    >
      {href ? <Link.AppleZoom>{cardContent}</Link.AppleZoom> : cardContent}
    </Pressable>
  );

  return (
    // The heart is a sibling of the card Pressable (not a child) so buttons never nest on web.
    <View
      style={{
        minHeight: 170,
        borderRadius: radius.card,
        borderCurve: 'continuous',
        overflow: 'hidden',
        // Light mode has a soft shadow. In dark mode a hairline keeps dark art from melting into the canvas.
        ...(scheme === 'dark' ? { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line } : null),
      }}
    >
      {!href ? (
        pressable
      ) : process.env.EXPO_OS === 'ios' ? (
        // Link looks for Link.Trigger / Link.Preview / Link.Menu as its direct children.
        <Link href={href} asChild>
          <Link.Trigger>{pressable}</Link.Trigger>
          <Link.Preview />
          {menuActions ? <Link.Menu>{menuActions}</Link.Menu> : null}
        </Link>
      ) : (
        // Preview and menu are iOS-only, and the web Link wants exactly one child.
        <Link href={href} asChild>
          {pressable}
        </Link>
      )}

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
