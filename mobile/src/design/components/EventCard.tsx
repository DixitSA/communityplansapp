import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatShortDate, formatTime, WEEKDAYS_LONG } from '@/lib/dates';

import { useTheme } from '../theme';
import { scrim } from '../tokens';
import { AppText } from './AppText';
import { Chip } from './Chip';
import { EventArt } from './EventArt';
import { LiveDot } from './LiveDot';
import { Facepile, formatFriendsLabel } from './Facepile';
import { PlanMenu } from './PlanMenu';
import type { SymbolName } from './Icon';
import { linearGradient } from './meshFallback';

export type EventCardData = {
  id: string;
  title: string;
  startsAt: Date;
  /** Happening right now (the feed works this out from the clock). */
  /** Set while the event is happening: when it ends (its end time, or three hours after the start). */
  liveUntil?: Date;
  /** When known; rows fall back to the start time without it. */
  endsAt?: Date;
  venue: string;
  distanceMi: number;
  imageUrl?: string;
  /** Stock photo variant the feed picked so a day's rows don't repeat a photo (see assignStockVariants). Unset: the event's own pick. */
  stockVariant?: number | null;
  /** The image is flagged as sensitive: it shows blurred until the viewer taps to view it on the event page. */
  imageSensitive?: boolean;
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

/** The viewer's own plan for an event. `null` means no plan. Mirrors the plans store. */
export type CardPlan = 'interested' | 'down_if_friends' | 'going' | null;

const PLAN_A11Y: Record<Exclude<CardPlan, null>, string> = {
  interested: 'Interested.',
  down_if_friends: 'Down if friends go.',
  going: "You're going.",
};

/** "Wed, Oct 28 · 8:00 PM" and "The Music Yard · 2.1 mi". */
export function eventMetaLines(e: EventCardData): [string, string] {
  return [
    `${formatShortDate(e.startsAt)} · ${formatTime(e.startsAt)}`,
    `${e.venue} · ${e.distanceMi.toFixed(1)} mi`,
  ];
}

/** VoiceOver label: "Warehouse Party, Wednesday 9 PM, The District, 2.1 miles. Maya is going." */
export function eventA11yLabel(e: EventCardData, plan: CardPlan = null): string {
  const day = WEEKDAYS_LONG[e.startsAt.getDay()];
  const miles = `${e.distanceMi.toFixed(1)} ${e.distanceMi === 1 ? 'mile' : 'miles'}`;
  const friends = formatFriendsLabel(
    e.friends.map((f) => f.name),
    e.friendsGoing,
  );
  return [
    e.liveUntil ? 'Happening now.' : '',
    `${e.title}, ${day} ${formatTime(e.startsAt, true)}, ${e.venue}, ${miles}.`,
    friends ? `${friends}.` : '',
    plan ? PLAN_A11Y[plan] : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export type EventCardProps = {
  event: EventCardData;
  /** The viewer's plan. Drives the corner plan button (same as the agenda rows). */
  plan?: CardPlan;
  onPress?: () => void;
  /** The corner plan menu (Going / Down if friends go / Interested / Clear). `null` clears the plan. */
  onSetPlan?: (plan: CardPlan) => void;
  /**
   * Makes the card a link to this route, with the native iOS zoom transition (iOS 18+; a plain
   * push elsewhere). Don't also pass `onPress`.
   */
  href?: Href;
  /** `Link.MenuAction` items for the long-press menu (with a live preview). iOS only, and only with `href`. */
  menuActions?: ReactNode;
};

export function EventCard({ event, plan = null, onPress, onSetPlan, href, menuActions }: EventCardProps) {
  const { space, radius, colors, scheme } = useTheme();
  const [dateLine, venueLine] = eventMetaLines(event);

  const cardContent = (
    // The art clips here rather than on the outer card, so the plan menu's web popover can hang below the card.
    <View
      style={{ minHeight: 170, justifyContent: 'flex-end', borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden' }}
    >
      <View style={StyleSheet.absoluteFill}>
        <EventArt event={event} />
      </View>
      {/* Bottom scrim so white text stays readable on any image. */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          linearGradient(scrim.cardGradient),
        ]}
      />
      {event.liveUntil ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: space.md,
            left: space.md,
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.xs,
            paddingHorizontal: space.sm,
            paddingVertical: space.xs,
            borderRadius: radius.pill,
            backgroundColor: scrim.medium,
          }}
        >
          <LiveDot color={colors.onImage} />
          <AppText variant="footnote" color="onImage" style={{ fontWeight: '600' }}>
            Live now
          </AppText>
        </View>
      ) : null}
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
      accessibilityLabel={eventA11yLabel(event, plan)}
      onPress={onPress}
      style={({ pressed }) => [{ minHeight: 170 }, pressed && { opacity: 0.92 }]}
    >
      {href ? <Link.AppleZoom>{cardContent}</Link.AppleZoom> : cardContent}
    </Pressable>
  );

  return (
    // The plan button is a sibling of the card Pressable (not a child) so buttons never nest on web.
    <View
      style={{
        minHeight: 170,
        borderRadius: radius.card,
        borderCurve: 'continuous',
        // iOS uses a native menu, so the card can clip; the web popover needs to overflow it.
        overflow: process.env.EXPO_OS === 'ios' ? 'hidden' : 'visible',
        zIndex: 1,
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
        <PlanMenu plan={plan} title={event.title} onChange={(p) => onSetPlan?.(p)} overImage />
      </View>
    </View>
  );
}
