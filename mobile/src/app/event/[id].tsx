import { Image } from 'expo-image';
import { Link, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
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
  Chip,
  EmptyState,
  Facepile,
  GlassButton,
  Icon,
  MeshArt,
  useTheme,
} from '@/design';
import { openDirections, openEventMenu, shareEvent } from '@/features/event/actions';
import { attributionLine, nextStatus, othersRevealed } from '@/features/event/plansLogic';
import { usePlanStatus, usePlansStore, type PlanStatus } from '@/features/event/plansStore';
import { RsvpBar } from '@/features/event/RsvpBar';
import { WhosGoing } from '@/features/event/WhosGoing';
import { getFixtureEvent } from '@/features/feed/fixtures';
import { formatShortDate, formatTime } from '@/lib/dates';
import { light } from '@/lib/haptics';
import { useHydrated } from '@/lib/useHydrated';
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
  const event = useMemo(() => getFixtureEvent(id), [id]);
  const { colors, space, radius, type } = useTheme();
  const router = useRouter();
  const goBack = useGoBack();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const status = usePlanStatus(id);
  const setStatus = usePlansStore((s) => s.setStatus);

  const heroHeight = Math.round(Math.min(height * 0.42, width * 1.05));
  const [barHeight, setBarHeight] = useState(0);

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
    return (
      <View style={{ flex: 1, backgroundColor: colors.canvas, paddingTop: insets.top + space.sm }}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ paddingHorizontal: space.lg }}>
          <GlassButton symbol="chevron.left" accessibilityLabel="Back" onPress={goBack} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            symbol="sparkles"
            title="We can't find that event"
            message="It may have ended or been taken down. Head back to the feed to see what's on."
          />
        </View>
      </View>
    );
  }

  const choose = (choice: Exclude<PlanStatus, 'going'>) => {
    light();
    setStatus(event.id, nextStatus(status, choice));
  };
  const onGoing = () => {
    if (status === 'going') {
      router.dismissTo('/chats');
      return;
    }
    // The Going sheet plays the success haptic and the burst as it appears.
    setStatus(event.id, 'going');
    router.push({ pathname: '/event/[id]/going', params: { id: event.id } });
  };

  const revealed = othersRevealed(status);
  const hostLabel = event.host.kind === 'venue' ? 'Venue' : 'Hosted by';
  const dateLine = `${formatShortDate(event.startsAt)} · ${formatTime(event.startsAt)}`;

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Full-bleed hero. It sits behind the scroll view, which starts below it. */}
      <Animated.View style={[styles.hero, { height: heroHeight }, heroStyle]}>
        <Link.AppleZoomTarget>
          <View style={{ height: heroHeight }}>
            {event.imageUrl ? (
              <Image
                source={{ uri: event.imageUrl }}
                contentFit="cover"
                style={{ flex: 1 }}
                accessibilityIgnoresInvertColors
              />
            ) : (
              <MeshArt id={event.id} interest={event.interest} symbol={event.symbol} symbolSize={170} />
            )}
          </View>
        </Link.AppleZoomTarget>
      </Animated.View>
      {/* Top scrim keeps the glass buttons readable on any image. */}
      <View
        pointerEvents="none"
        style={[
          styles.hero,
          { height: insets.top + space.xxxl * 2 },
          linearGradient('linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0) 100%)'),
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
        <View
          style={{
            backgroundColor: colors.canvas,
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
            <AppText variant="title" accessibilityRole="header" selectable style={{ letterSpacing: -0.6 }}>
              {event.title}
            </AppText>
            <AppText variant="headline" rounded>
              {dateLine}
            </AppText>
            <Pressable
              onPress={() => openDirections(event)}
              accessibilityRole="link"
              accessibilityLabel={`${event.venue}, ${event.distanceMi.toFixed(1)} miles away. Open directions.`}
              style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}
            >
              <View style={{ paddingTop: 2 }}>
                <Icon name="mappin" size={17} color="accent" />
              </View>
              <View style={{ flexShrink: 1 }}>
                <AppText variant="body">
                  {event.venue} · {event.distanceMi.toFixed(1)} mi away
                </AppText>
                <AppText variant="footnote" color="inkSecondary">
                  {event.address}
                </AppText>
              </View>
            </Pressable>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingTop: space.xs }}>
              {event.tags.map((t) => (
                <Chip key={t.label} label={t.label} category={t.interest} />
              ))}
              <Chip label={event.priceLabel} symbol="ticket.fill" />
            </View>
          </View>

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

          {event.friendsGoing > 0 ? (
            <>
              <Divider />
              <Pressable
                onPress={() => scrollRef.current?.scrollTo({ y: whosGoingY.current - space.lg, animated: true })}
                accessibilityRole="button"
                accessibilityHint="Scrolls to who's going"
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }}
              >
                <Facepile people={event.friends} total={event.friendsGoing} avatarSize={32} labelColor="ink" />
                <Icon name="chevron.right" size={13} color="inkSecondary" weight="semibold" />
              </Pressable>
            </>
          ) : null}

          <Divider />

          <AppText variant="body" selectable style={{ lineHeight: 24 }}>
            {event.description}
          </AppText>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs }}>
            <AppText variant="footnote" color="inkSecondary">
              {attributionLine(event.source)}
            </AppText>
            {event.source.url ? (
              <Pressable
                onPress={() => Linking.openURL(event.source.url as string).catch(() => {})}
                accessibilityRole="link"
                accessibilityLabel={`View original listing on ${event.source.name}`}
                hitSlop={space.sm}
              >
                <AppText variant="footnote" color="accent" style={{ fontWeight: '600' }}>
                  · View original
                </AppText>
              </Pressable>
            ) : null}
          </View>

          <Divider />

          <View onLayout={(e) => (whosGoingY.current = e.nativeEvent.layout.y + heroHeight - radius.hero)}>
            <WhosGoing
              friends={event.friends}
              friendsGoing={event.friendsGoing}
              others={revealed ? event.otherAttendees : []}
              othersGoing={event.othersGoing}
              revealed={revealed}
            />
          </View>
        </View>
      </Animated.ScrollView>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.hero,
          {
            height: stripHeight,
            backgroundColor: colors.canvas,
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

      <RsvpBar status={status} onChoose={choose} onGoing={onGoing} onLayoutHeight={setBarHeight} />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
});
