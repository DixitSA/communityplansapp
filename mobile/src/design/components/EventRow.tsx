import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { formatEventTime } from '@/lib/dates';

import { useTheme } from '../theme';
import { AppText } from './AppText';
import { Chip } from './Chip';
import { eventA11yLabel, type CardPlan, type EventCardData } from './EventCard';
import { EventImage } from './EventImage';
import { Facepile } from './Facepile';
import { Icon } from './Icon';
import { MeshArt } from './MeshArt';
import { PlanMenu } from './PlanMenu';

export const EVENT_ROW_THUMB = 64;

/** "6:00 – 9:00 PM" (just the start without an end time). */
export function eventRowTime(e: Pick<EventCardData, 'startsAt' | 'endsAt'>): string {
  return formatEventTime(e.startsAt, e.endsAt);
}

/** "0.8 mi", shown after the venue so it never gets truncated with it. */
export function eventRowDistance(e: Pick<EventCardData, 'distanceMi'>): string {
  return `${e.distanceMi.toFixed(1)} mi`;
}

export type EventRowProps = {
  event: EventCardData & { goingCount?: number };
  plan?: CardPlan;
  /** The quick plan menu: Going, Down if friends go, Interested, or `null` to clear. */
  onSetPlan?: (plan: CardPlan) => void;
  onPress?: () => void;
  /** Makes the row a link, with the zoom transition from the thumbnail (iOS 18+). Don't also pass `onPress`. */
  href?: Href;
  /** `Link.MenuAction` items for the long-press menu. iOS only, and only with `href`. */
  menuActions?: ReactNode;
};

/**
 * An agenda row card: thumbnail, category tag, bold title, time range and place on the left;
 * friends going and the quick plan button on the right.
 */
export function EventRow({ event, plan = null, onSetPlan, onPress, href, menuActions }: EventRowProps) {
  const { colors, space, radius } = useTheme();

  const thumb = (
    <View
      style={{
        width: EVENT_ROW_THUMB,
        height: EVENT_ROW_THUMB,
        borderRadius: radius.thumb,
        borderCurve: 'continuous',
        overflow: 'hidden',
      }}
    >
      {event.imageUrl ? (
        <EventImage eventId={event.id} source={event.imageUrl} sensitive={event.imageSensitive} />
      ) : (
        <MeshArt id={event.id} interest={event.interest} symbol={event.symbol} symbolSize={36} />
      )}
    </View>
  );

  const pressable = (
    <Pressable
      accessible
      accessibilityRole={href ? 'link' : 'button'}
      accessibilityLabel={eventA11yLabel(event, plan)}
      onPress={onPress}
      // A static style: `Link asChild` merges props onto this element and drops style functions on web.
      style={{ flex: 1, minWidth: 0 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        {href ? <Link.AppleZoom>{thumb}</Link.AppleZoom> : thumb}
        <View style={{ flex: 1, gap: 1 }}>
          <View style={{ alignSelf: 'flex-start' }}>
            <Chip label={event.categoryLabel} size="small" category={event.interest} />
          </View>
          <AppText variant="headline" numberOfLines={1}>
            {event.title}
          </AppText>
          <AppText
            variant="footnote"
            color="inkSecondary"
            numberOfLines={1}
            maxFontSizeMultiplier={1.4}
            style={{ lineHeight: 16 }}
          >
            {eventRowTime(event)}
          </AppText>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 0,
            }}
          >
            <View style={{ paddingRight: space.xs }}>
              <Icon name="mappin" size={11} color="inkSecondary" />
            </View>
            <AppText
              variant="footnote"
              color="inkSecondary"
              numberOfLines={1}
              style={{ flexShrink: 1, lineHeight: 16 }}
              maxFontSizeMultiplier={1.4}
            >
              {event.venue}
            </AppText>
            <AppText
              variant="footnote"
              color="inkSecondary"
              maxFontSizeMultiplier={1.4}
              style={{ flexShrink: 0, lineHeight: 16 }}
            >
              {event.venue ? ' · ' : ''}
              {eventRowDistance(event)}
            </AppText>
          </View>
        </View>
      </View>
    </Pressable>
  );

  return (
    // The right column is a sibling of the row's Pressable so buttons never nest on web.
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        padding: space.sm,
        borderRadius: radius.card,
        borderCurve: 'continuous',
        backgroundColor: colors.surface,
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
        <Link href={href} asChild>
          {pressable}
        </Link>
      )}
      <View
        style={{
          alignItems: 'flex-end',
          justifyContent: 'center',
          gap: space.sm,
        }}
      >
        {/* Friends' faces only; with no friends going this is just "N going". */}
        <Facepile people={event.friends} total={event.goingCount ?? event.friendsGoing} compact />
        <PlanMenu plan={plan} title={event.title} onChange={(p) => onSetPlan?.(p)} />
      </View>
    </View>
  );
}
