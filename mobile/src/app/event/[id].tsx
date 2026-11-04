import { Link, Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassContainer } from 'expo-glass-effect';

import {
  AppText,
  Avatar,
  Button,
  Chip,
  EmptyState,
  EventArt,
  Facepile,
  GlassButton,
  HotBadge,
  Icon,
  categoryColors,
  isCategory,
  isPopping,
  scrim,
  tintedCanvas,
  useImageHidden,
  useRevealedImages,
  useTheme,
} from '@/design';
import { openDirections, openEventMenu, shareEvent } from '@/features/event/actions';
import {
  attributionLine,
  eventSummary,
  isTicketSource,
  listingButtonLabel,
  nextStatus,
  othersCount,
  othersRevealed,
  sourceName,
} from '@/features/event/plansLogic';
import type { PlanStatus } from '@/features/event/plansStore';
import { useEvent } from '@/features/event/useEvent';
import { useFirstTimeHint } from '@/features/event/useFirstTimeHint';
import { usePlan, useSetRsvp } from '@/features/event/useRsvp';
import { EndedBar } from '@/features/event/EndedBar';
import { RsvpBar } from '@/features/event/RsvpBar';
import { useUndoStore } from '@/features/event/undoStore';
import { hasEnded } from '@/features/feed/agenda';
import { WhosGoing } from '@/features/event/WhosGoing';
import { UNKNOWN_PRICE_LABEL } from '@/lib/api';
import { WEEKDAYS_LONG, countdownLabel, formatEventTime, formatShortDate, formatTime, isSameDay } from '@/lib/dates';
import { light, selection } from '@/lib/haptics';
import { useHydrated } from '@/lib/useHydrated';
import { useNow } from '@/lib/useNow';
import { linearGradient } from '@/design/components/meshFallback';

/** Size of the glass back / share / more buttons (GlassButton's default). */
const GLASS_BUTTON = 44;

/** Goes back, or to the Feed when the page was opened directly (web, deep link). */
function useGoBack() {
  const router = useRouter();
  return () => (router.canGoBack() ? router.back() : router.replace('/'));
}

function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.line }} />;
}

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: event, isPending, isError, refetch } = useEvent(id);
  const { colors, space, radius, type, scheme } = useTheme();
  // Ticks every minute so the countdown chip stays current.
  const now = useNow();
  const router = useRouter();
  const goBack = useGoBack();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const status = usePlan(id, event?.myStatus);
  const imageHidden = useImageHidden(id, event?.imageSensitive);
  const revealImage = useRevealedImages((s) => s.reveal);
  const { setStatus, changePlan } = useSetRsvp();
  const showDownHint = useFirstTimeHint('down_if_friends');

  const heroHeight = Math.round(Math.min(height * 0.42, width * 1.05));
  const [barHeight, setBarHeight] = useState(0);

  // The undo toast floats just above the RSVP bar here instead of its tab-bar spot.
  // The bar's height already includes the bottom safe area, which the toast adds itself.
  // useFocusEffect re-applies it when returning to this page and clears it when another screen covers it.
  useFocusEffect(
    useCallback(() => {
      useUndoStore.getState().setLift(barHeight > 0 ? Math.max(barHeight - insets.bottom, 0) : null);
      return () => useUndoStore.getState().setLift(null);
    }, [barHeight, insets.bottom]),
  );

  // Scrolling: the hero stretches when you pull down and drifts up slower than the sheet.
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
  });
  const heroStyle = useAnimatedStyle(() => {
    const y = scrollY.get();
    const stretch = Math.max(-y, 0);
    return {
      transform: [{ translateY: y < 0 ? stretch / 2 : -y * 0.4 }, { scale: 1 + stretch / heroHeight }],
    };
  });

  // Once the sheet reaches the top, a canvas strip with the title fades in behind the floating buttons.
  const stripHeight = insets.top + space.sm * 2 + GLASS_BUTTON;
  const stripStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [heroHeight - stripHeight - 40, heroHeight - stripHeight], [0, 1], 'clamp'),
  }));

  const scrollRef = useRef<Animated.ScrollView>(null);
  const whosGoingY = useRef(0);
  const hydrated = useHydrated();

  if (!hydrated) return <View style={{ flex: 1 }} />;

  if (!event) {
    const failed = !isPending && isError;
    return (
      <View style={{ flex: 1, backgroundColor: colors.canvas, paddingTop: insets.top + space.sm }}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ paddingHorizontal: space.lg }}>
          <GlassButton symbol="chevron.left" accessibilityLabel="Back" onPress={goBack} />
        </View>
        {isPending ? null : (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            {failed ? (
              <EmptyState symbol="wifi.slash" title="couldn't load this event" message="Check your connection and try again.">
                <View style={{ alignSelf: 'stretch', paddingTop: space.md }}>
                  <Button label="Retry" onPress={() => void refetch()} />
                </View>
              </EmptyState>
            ) : (
              <EmptyState
                symbol="sparkles"
                title="can't find that event"
                message="It may have ended or been taken down. Head back to the feed to see what else is on."
              />
            )}
          </View>
        )}
      </View>
    );
  }

  const choose = (choice: Exclude<PlanStatus, 'going'>) => {
    light();
    const next = nextStatus(status, choice);
    changePlan(event.id, status, next, event.title);
    if (next === 'down_if_friends') void showDownHint();
  };
  const onGoing = () => {
    if (status === 'going') {
      router.push({ pathname: '/chat/[eventId]', params: { eventId: event.id } });
      return;
    }
    // The Going sheet plays the success haptic and the burst as it appears.
    setStatus(event.id, 'going');
    router.push({ pathname: '/event/[id]/going', params: { id: event.id } });
  };

  const revealed = othersRevealed(status);
  const hostLabel = event.host.kind === 'venue' ? 'Venue' : 'Hosted by';
  // Online, the server only tells us how many are going; "others" is everyone who isn't a friend or you.
  const othersGoing =
    event.goingCount === null ? event.othersGoing : othersCount(event.goingCount, event.friendsGoing, status === 'going');
  const hasDistance = event.distanceMi > 0;
  // A soft wash of the flyer's own color, so every event page looks like its event.
  const pageBg = tintedCanvas(event.imageColor, colors.canvas, scheme);
  const ended = hasEnded(event, now);
  // Only real web links get a button or link.
  const listingUrl = event.source.url && /^https?:\/\//i.test(event.source.url) ? event.source.url : undefined;
  // Curated and ended events keep the quiet footnote link; everything else gets a real button.
  const showListingButton = Boolean(listingUrl) && !event.source.curated && !ended;
  const knownPrice = event.priceLabel !== UNKNOWN_PRICE_LABEL ? event.priceLabel : null;
  const listingLabel = listingButtonLabel(event.source.name, listingUrl);
  const description =
    event.description.trim() ||
    eventSummary({
      category: event.tags[0]?.label,
      venue: event.venue,
      // An end on a later day names the day ("Sun 5:00 PM"), so it never reads as the same evening.
      endText: event.endsAt
        ? isSameDay(event.startsAt, event.endsAt)
          ? formatTime(event.endsAt)
          : `${WEEKDAYS_LONG[event.endsAt.getDay()].slice(0, 3)} ${formatTime(event.endsAt)}`
        : null,
    });
  const tagInterest = event.tags[0]?.interest;
  const categoryColor = isCategory(tagInterest) ? categoryColors[tagInterest].solid : colors.accent;
  // Everyone going, from whichever count the data has (the server's, or the demo's friends + others).
  const popping = isPopping(event.goingCount ?? event.friendsGoing + event.othersGoing);
  const countdown = countdownLabel(event.startsAt, event.endsAt, now);
  const timeText = formatEventTime(event.startsAt, event.endsAt, true);
  // A multi-day event reads "Fri 7:00 PM – Sun 5:00 PM", which already says the days.
  const dateLine = /^[A-Z][a-z]{2} \d/.test(timeText) ? timeText : `${formatShortDate(event.startsAt)} · ${timeText}`;

  return (
    <View style={{ flex: 1, backgroundColor: pageBg }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Full-bleed hero. It sits behind the scroll view, which starts below it. */}
      <Animated.View style={[styles.hero, { height: heroHeight }, heroStyle]}>
        <Link.AppleZoomTarget>
          <View style={{ height: heroHeight }}>
            <EventArt event={event} symbolSize={170} overlay="label" />
          </View>
        </Link.AppleZoomTarget>
      </Animated.View>
      {/* Top scrim keeps the glass buttons readable on any image. */}
      <View
        pointerEvents="none"
        style={[
          styles.hero,
          { height: insets.top + space.xxxl * 2 },
          linearGradient(scrim.heroTopGradient),
        ]}
      />

      <Animated.ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingTop: heroHeight - radius.hero }}
      >
        {/* The hero sits under the scroll view, so the tap target for a hidden image lives here, over it. */}
        {imageHidden ? (
          <Pressable
            onPress={() => {
              light();
              revealImage(event.id);
            }}
            accessibilityRole="button"
            accessibilityLabel="Sensitive image. Show image"
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: heroHeight - radius.hero }}
          />
        ) : null}
        <View
          style={{
            backgroundColor: pageBg,
            borderTopLeftRadius: radius.hero,
            borderTopRightRadius: radius.hero,
            borderCurve: 'continuous',
            minHeight: height - heroHeight + radius.hero,
            paddingHorizontal: space.lg,
            paddingTop: space.xl,
            paddingBottom: barHeight + space.xxl,
            gap: space.lg,
          }}
        >
          <View style={{ gap: space.sm }}>
            {countdown || popping ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                {countdown ? <Chip label={countdown} symbol="clock" tone="accent" selected size="small" /> : null}
                {popping ? <HotBadge label="Popping" /> : null}
              </View>
            ) : null}
            <AppText variant="largeTitle" accessibilityRole="header" selectable style={{ letterSpacing: -0.9, fontWeight: '800' }}>
              {event.title}
            </AppText>
            <AppText variant="headline" rounded style={{ fontWeight: '700' }}>
              {dateLine}
            </AppText>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
              <View style={{ paddingTop: 2 }}>
                <Icon name="mappin" size={17} tintColor={categoryColor} />
              </View>
              <View style={{ flexShrink: 1 }}>
                <AppText variant="body">
                  {hasDistance ? `${event.venue} · ${event.distanceMi.toFixed(1)} mi away` : event.venue}
                </AppText>
                <AppText variant="footnote" color="inkSecondary">
                  {event.address}
                </AppText>
              </View>
            </View>
            <View style={{ flexDirection: 'row' }}>
              <Button
                label="Directions"
                symbol="location.fill"
                accessibilityLabel={`Get directions to ${event.venue}`}
                onPress={() => openDirections(event)}
              />
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingTop: space.xs }}>
              {event.tags.map((t) => (
                <Chip key={t.label} label={t.label} category={t.interest} />
              ))}
              {/* With no price known the chip would only say "See listing"; the listing link below covers that. */}
              {knownPrice && !showListingButton ? <Chip label={event.priceLabel} symbol="ticket.fill" /> : null}
            </View>
            {showListingButton ? (
              <View style={{ paddingTop: space.sm, gap: space.xs }}>
                <Button
                  label={listingLabel}
                  symbol={isTicketSource(event.source.name) ? 'ticket.fill' : 'arrow.up.right'}
                  onPress={() => Linking.openURL(listingUrl as string).catch(() => {})}
                  accessibilityLabel={`${listingLabel}${knownPrice ? `, ${knownPrice}` : ''}. Opens ${sourceName(event.source.name)}`}
                />
                {knownPrice ? (
                  <AppText variant="footnote" color="inkSecondary" style={{ textAlign: 'center' }}>
                    {knownPrice}
                  </AppText>
                ) : null}
              </View>
            ) : null}
          </View>

          {/* Social proof up front: friends' faces and a bold line, right under the title block. */}
          {event.friendsGoing > 0 ? (
            <Pressable
              onPress={() => {
                selection();
                scrollRef.current?.scrollTo({ y: whosGoingY.current - space.lg, animated: true });
              }}
              accessibilityRole="button"
              accessibilityHint="Scrolls to who's going"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: space.md,
                padding: space.md,
                borderRadius: radius.card,
                borderCurve: 'continuous',
                backgroundColor: colors.accentSoft,
              }}
            >
              <View style={{ flexShrink: 1 }}>
                <Facepile
                  people={event.friends}
                  total={event.friendsGoing}
                  avatarSize={36}
                  labelColor="accent"
                  emphasis
                />
              </View>
              <Icon name="chevron.right" size={13} color="accent" weight="semibold" />
            </Pressable>
          ) : null}

          {/* For a venue this row would only repeat the location line above; it earns its place for a real host. */}
          {event.host.kind !== 'venue' ? (
            <>
              <Divider />
              <View
                accessible
                accessibilityLabel={`${hostLabel} ${event.host.name}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}
              >
                <Avatar name={event.host.name} size={44} />
                <View style={{ flexShrink: 1 }}>
                  <AppText variant="footnote" color="inkSecondary">
                    {hostLabel}
                  </AppText>
                  <AppText variant="headline">{event.host.name}</AppText>
                </View>
              </View>
            </>
          ) : null}

          <Divider />

          <View onLayout={(e) => (whosGoingY.current = e.nativeEvent.layout.y + heroHeight - radius.hero)}>
            <WhosGoing
              friends={event.friends}
              friendsGoing={event.friendsGoing}
              others={revealed ? event.otherAttendees : []}
              othersGoing={othersGoing}
              revealed={revealed}
              ended={hasEnded(event, now)}
            />
          </View>

          <Divider />

          <AppText variant="body" selectable style={{ lineHeight: 24 }}>
            {description}
          </AppText>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs }}>
            <AppText variant="footnote" color="inkSecondary">
              {attributionLine(event.source)}
            </AppText>
            {listingUrl && !showListingButton ? (
              <Pressable
                onPress={() => Linking.openURL(listingUrl).catch(() => {})}
                accessibilityRole="link"
                accessibilityLabel={`View original listing on ${sourceName(event.source.name)}`}
                hitSlop={{ top: space.lg, bottom: space.lg, left: space.sm, right: space.sm }}
              >
                <AppText variant="footnote" color="accent" style={{ fontWeight: '600' }}>
                  · View original
                </AppText>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Animated.ScrollView>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.hero,
          {
            height: stripHeight,
            backgroundColor: pageBg,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.line,
            justifyContent: 'flex-end',
            alignItems: 'center',
            paddingBottom: space.sm + (GLASS_BUTTON - type.headline.lineHeight) / 2,
            paddingHorizontal: GLASS_BUTTON + space.lg + space.sm,
          },
          stripStyle,
        ]}
      >
        <AppText variant="headline" numberOfLines={1}>
          {event.title}
        </AppText>
      </Animated.View>

      {/* Floating controls sit above everything. The two on the right merge as one glass group. */}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: insets.top + space.sm,
          left: space.lg,
          right: space.lg,
          flexDirection: 'row',
          justifyContent: 'space-between',
        }}
      >
        <GlassButton symbol="chevron.left" overImage iconColor="onImage" accessibilityLabel="Back" onPress={goBack} />
        <GlassContainer spacing={space.sm} style={{ flexDirection: 'row', gap: space.sm }}>
          <GlassButton
            symbol="square.and.arrow.up"
            overImage
            iconColor="onImage"
            accessibilityLabel={`Share ${event.title}`}
            onPress={() => shareEvent(event, 'share')}
          />
          <GlassButton
            symbol="ellipsis"
            overImage
            iconColor="onImage"
            accessibilityLabel="More options"
            onPress={() => openEventMenu(event)}
          />
        </GlassContainer>
      </View>

      {/* Soft fade so the description doesn't hard-cut behind the RSVP bar. */}
      <View
        pointerEvents="none"
        style={[
          styles.fade,
          { bottom: barHeight, height: space.xxl },
          linearGradient(`linear-gradient(to bottom, ${pageBg}00 0%, ${pageBg} 100%)`),
        ]}
      />
      {hasEnded(event, now) ? (
        <EndedBar onOpenChat={status === 'going' ? onGoing : undefined} onLayoutHeight={setBarHeight} />
      ) : (
        <RsvpBar status={status} onChoose={choose} onGoing={onGoing} onLayoutHeight={setBarHeight} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fade: { position: 'absolute', left: 0, right: 0 },
  hero: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
});
