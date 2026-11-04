import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { formatEventTime, formatTime } from '@/lib/dates';

import { useTheme } from '../theme';
import { usePressScale } from '../usePressScale';
import { categoryColors, isCategory } from '../tokens';
import { AppText } from './AppText';
import { eventA11yLabel, type CardPlan, type EventCardData } from './EventCard';
import { EventArt } from './EventArt';
import { LiveDot } from './LiveDot';
import { Facepile } from './Facepile';
import { HotBadge, isPopping } from './HotBadge';
import { Icon } from './Icon';
import { PlanMenu } from './PlanMenu';

export const EVENT_ROW_THUMB = 64;
const CATEGORY_DOT = 7;
const CATEGORY_GLYPH = 13;

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
 * An agenda row card: thumbnail, a title of up to two lines, category and time, then place on the left;
 * friends going and the quick plan button on the right.
 */
export function EventRow({ event, plan = null, onSetPlan, onPress, href, menuActions }: EventRowProps) {
  const { colors, space, radius } = useTheme();
  const press = usePressScale();
  const popping = isPopping(event.goingCount) && !event.liveUntil;
  const categoryColor = isCategory(event.interest) ? categoryColors[event.interest].solid : colors.inkSecondary;

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
      <EventArt event={event} symbolSize={36} />
    </View>
  );

  const pressable = (
    <Pressable
      accessible
      accessibilityRole={href ? 'link' : 'button'}
      accessibilityLabel={`${popping ? 'Popping. ' : ''}${eventA11yLabel(event, plan)}`}
      onPress={onPress}
      onPressIn={press.handlers.onPressIn}
      onPressOut={press.handlers.onPressOut}
      // A static style: `Link asChild` merges props onto this element and drops style functions on web.
      style={{ flex: 1, minWidth: 0 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View>
          {href ? <Link.AppleZoom>{thumb}</Link.AppleZoom> : thumb}
          {/* Lots going: a flame on the thumbnail's corner (VoiceOver gets "Popping" in the row's label). */}
          {popping ? (
            <View pointerEvents="none" style={{ position: 'absolute', top: -space.xs, left: -space.xs }}>
              <HotBadge label="Popping" iconOnly />
            </View>
          ) : null}
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <AppText variant="rowTitle" numberOfLines={2}>
            {event.title}
          </AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
            {event.liveUntil ? (
              <LiveDot color={colors.accent} size={CATEGORY_DOT} />
            ) : (
              // The category's own glyph in its color; the art already says the rest, so no chip.
              <Icon name={event.symbol} size={CATEGORY_GLYPH} tintColor={categoryColor} weight="semibold" />
            )}
            <AppText
              variant="footnote"
              color="inkSecondary"
              numberOfLines={1}
              style={{ flexShrink: 1, lineHeight: 16 }}
            >
              {event.liveUntil ? (
                // Only the dot is accent, so a busy night doesn't turn into a wall of green.
                // The category stays in the thumbnail art and the accessibility label, so it isn't repeated (it truncated).
                <AppText variant="footnote" color="ink" style={{ fontWeight: '600', lineHeight: 16 }}>
                  {`Live · until ${formatTime(event.liveUntil, true)}`}
                </AppText>
              ) : (
                `${event.categoryLabel} · ${eventRowTime(event)}`
              )}
            </AppText>
          </View>
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
            >
              {event.venue}
            </AppText>
            <AppText
              variant="footnote"
              color="inkSecondary"
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
    <Animated.View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
          padding: space.sm,
          borderRadius: radius.card,
          borderCurve: 'continuous',
          backgroundColor: colors.surface,
        },
        press.style,
      ]}
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
        <Facepile people={event.friends} total={event.goingCount ?? event.friendsGoing} compact emphasis />
        <PlanMenu plan={plan} title={event.title} onChange={(p) => onSetPlan?.(p)} />
      </View>
    </Animated.View>
  );
}
