import { Link, router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';

import {
  AppText,
  Avatar,
  Button,
  Chip,
  EmptyState,
  GlassButton,
  Icon,
  Screen,
  Skeleton,
  asSymbol,
  useTheme,
} from '@/design';
import { getActivityItems } from '@/features/activity/fixtures';
import { useDemoPlans } from '@/features/event/demoPlans';
import { usePlansStore } from '@/features/event/plansStore';
import { getFixtureEvents } from '@/features/feed/fixtures';
import { PlanTicket } from '@/features/profile/PlanTicket';
import { deriveProfileStats, upcomingPlans } from '@/features/profile/stats';
import { useMyProfile } from '@/features/profile/useMyProfile';
import { isBackendConfigured } from '@/lib/env';

/** The top row of Profile: opens Activity (friend requests, "who did you meet"), with a dot while there is something new. */
function ActivityRow() {
  const { colors, space, radius } = useTheme();
  // Activity is sample data for now, so "unread" means there are items.
  const unread = getActivityItems().length > 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unread ? 'Activity, new updates' : 'Activity'}
      onPress={() => router.push('/activity')}
      style={({ pressed }) => ({
        minHeight: 52,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingHorizontal: space.lg,
        borderRadius: radius.card,
        borderCurve: 'continuous',
        backgroundColor: colors.surface,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Icon name="bell" size={20} />
      <AppText variant="body" style={{ flex: 1 }}>
        Activity
      </AppText>
      {unread ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent }} /> : null}
      <Icon name="chevron.right" size={14} color="inkSecondary" weight="semibold" />
    </Pressable>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  const { space } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${value} ${label}`}
      style={{ flex: 1, alignItems: 'center', gap: space.xs }}
    >
      <AppText variant="title2" rounded maxFontSizeMultiplier={1.4}>
        {value}
      </AppText>
      <AppText variant="footnote" color="inkSecondary" maxFontSizeMultiplier={1.4}>
        {label}
      </AppText>
    </View>
  );
}

export default function ProfileScreen() {
  const { colors, space, radius } = useTheme();
  const { demoPlans } = useLocalSearchParams<{ demoPlans?: string }>();
  useDemoPlans(demoPlans);
  const profile = useMyProfile();
  const statuses = usePlansStore((s) => s.statuses);
  const plans = useMemo(() => upcomingPlans(statuses, getFixtureEvents(new Date())), [statuses]);
  const stats = useMemo(() => deriveProfileStats(statuses, plans), [statuses, plans]);
  const { width: windowWidth } = useWindowDimensions();
  // Leave a sliver of the next ticket showing so the row reads as scrollable.
  const ticketWidth = Math.min(windowWidth - space.lg * 2 - space.xxl, 320);
  const ticketGap = space.md;
  const demo = !isBackendConfigured;

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <AppText variant="largeTitle" accessibilityRole="header">
        Profile
      </AppText>
      <GlassButton symbol="gearshape" accessibilityLabel="Settings" onPress={() => router.push('/settings')} />
    </View>
  );

  if (profile.isPending) {
    return (
      <Screen>
        {header}
        <View style={{ gap: space.lg, paddingTop: space.xl }} accessibilityLabel="Loading profile">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
            <Skeleton width={72} height={72} radius={36} />
            <View style={{ flex: 1, gap: space.sm }}>
              <Skeleton width="55%" height={22} />
              <Skeleton width="35%" />
            </View>
          </View>
          <Skeleton height={84} radius={radius.card} />
          <Skeleton height={72} radius={radius.card} />
        </View>
      </Screen>
    );
  }

  if (profile.isError || !profile.data) {
    return (
      <Screen>
        {header}
        <EmptyState
          symbol="exclamationmark.circle.fill"
          title="Couldn’t load your profile"
          message="Check your connection and try again."
        >
          <View style={{ alignSelf: 'stretch', paddingTop: space.md }}>
            <Button label="Try again" onPress={() => profile.refetch()} />
          </View>
        </EmptyState>
      </Screen>
    );
  }

  const me = profile.data;
  return (
    <Screen>
      {header}

      <View style={{ gap: space.xl, paddingTop: space.xl }}>
        <ActivityRow />
        <View
          accessible
          accessibilityLabel={`${me.displayName}, @${me.username}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}
        >
          <Avatar name={me.displayName} size={72} />
          <View style={{ flex: 1, gap: space.xs }}>
            <AppText variant="title2" numberOfLines={2}>
              {me.displayName}
            </AppText>
            <AppText variant="subheadline" color="inkSecondary" numberOfLines={1}>
              @{me.username}
            </AppText>
          </View>
        </View>

        {me.interests.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {me.interests.map((i) => (
              <Chip key={i.id} label={i.label} symbol={asSymbol(i.symbol)} category={i.slug} />
            ))}
          </View>
        ) : null}

        <View
          style={{
            flexDirection: 'row',
            paddingVertical: space.lg,
            borderRadius: radius.card,
            borderCurve: 'continuous',
            backgroundColor: colors.surface,
          }}
        >
          <Stat value={stats.upcoming} label="Upcoming" />
          <Stat value={stats.friends} label="Friends" />
          <Stat value={stats.saved} label="Saved" />
        </View>

        <View style={{ gap: space.md }}>
          <AppText variant="overline" color="inkSecondary" accessibilityRole="header">
            Upcoming plans
          </AppText>
          {plans.length === 0 ? (
            <EmptyState symbol="sparkles" title="No plans yet" message="Tap Going on an event and it will show up here.">
              <View style={{ alignSelf: 'stretch', paddingTop: space.md }}>
                <Button label="Find something to do" onPress={() => router.navigate('/')} />
              </View>
            </EmptyState>
          ) : (
            <ScrollView
              horizontal
              accessibilityLabel="Upcoming plans"
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToOffsets={plans.map((_, i) => i * (ticketWidth + ticketGap))}
              snapToAlignment="start"
              // Bleed to the screen edges, keeping the first ticket aligned with the page gutter.
              style={{ marginHorizontal: -space.lg }}
              contentContainerStyle={{ gap: ticketGap, paddingHorizontal: space.lg, paddingVertical: space.sm }}
            >
              {plans.map((p) => (
                <PlanTicket key={p.event.id} plan={p} width={ticketWidth} />
              ))}
            </ScrollView>
          )}
        </View>

        {__DEV__ && demo ? (
          <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start', paddingTop: space.sm }}>
            <Icon name="lock.shield.fill" size={14} color="inkSecondary" />
            <AppText variant="footnote" color="inkSecondary" style={{ flex: 1 }}>
              Demo mode: sample profile and data. To turn on sign-in, follow docs/SUPABASE_SETUP.md.
            </AppText>
          </View>
        ) : null}

        {__DEV__ ? (
          <Link href="/gallery" accessibilityRole="link" style={{ textAlign: 'center' }}>
            <AppText variant="subheadline" color="accent">
              Open design gallery
            </AppText>
          </Link>
        ) : null}
      </View>
    </Screen>
  );
}
