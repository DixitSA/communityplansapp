import { Link, Stack, router, useLocalSearchParams, type Href } from 'expo-router';
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
  UnreadDot,
  asSymbol,
  useLargeTitleHeader,
  useTheme,
} from '@/design';
import { getActivityItems } from '@/features/activity/fixtures';
import { useDemoPlans } from '@/features/event/demoPlans';
import { SuggestedEvents } from '@/features/feed/SuggestedEvents';
import { useSuggestedEvents } from '@/features/feed/useSuggestedEvents';
import { friendsHref } from '@/features/friends/routes';
import { useFriendRequests, useFriends } from '@/features/friends/useFriends';
import { PlanTicket } from '@/features/profile/PlanTicket';
import { deriveProfileStats, splitMyPlans } from '@/features/profile/stats';
import { useMyPlans } from '@/features/profile/useMyPlans';
import { useMyProfile } from '@/features/profile/useMyProfile';
import { isBackendConfigured } from '@/lib/env';

/** The bell in Profile's header: opens Activity (friend requests, "who did you meet"), with a dot while there is something new. */
function ActivityButton() {
  // With a backend, Activity shows real friend requests; in demo mode it is sample data. Either way "unread" means there are items.
  const requests = useFriendRequests();
  const incoming = (requests.data ?? []).filter((r) => r.direction === 'incoming').length;
  const unread = isBackendConfigured ? incoming > 0 : incoming > 0 || getActivityItems().length > 0;
  return (
    <View>
      <GlassButton
        symbol="bell"
        accessibilityLabel={unread ? 'Activity, new updates' : 'Activity'}
        onPress={() => router.push('/activity')}
      />
      {unread ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: 2, right: 2 }}>
          <UnreadDot />
        </View>
      ) : null}
    </View>
  );
}

function Stat({
  value,
  label,
  href,
  badge = false,
  a11yExtra,
}: {
  value: number;
  label: string;
  /** Makes the stat a link (the Friends stat opens the friends list). */
  href?: Href;
  /** A dot beside the label: something is waiting inside. */
  badge?: boolean;
  a11yExtra?: string;
}) {
  const { space } = useTheme();
  const body = (
    <View
      accessible
      accessibilityLabel={`${value} ${label}${a11yExtra ? `, ${a11yExtra}` : ''}`}
      accessibilityRole={href ? 'link' : undefined}
      accessibilityHint={href ? 'Opens your friends' : undefined}
      style={{ flex: 1, alignItems: 'center', gap: space.xs }}
    >
      <AppText variant="title2" rounded>
        {value}
      </AppText>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
        <AppText variant="footnote" color="inkSecondary">
          {label}
        </AppText>
        {badge ? <UnreadDot size={space.sm} /> : null}
        {href ? <Icon name="chevron.right" size={10} color="inkSecondary" weight="semibold" /> : null}
      </View>
    </View>
  );
  if (!href) return body;
  return (
    <Link href={href} asChild>
      <Pressable style={{ flex: 1 }}>{body}</Pressable>
    </Link>
  );
}

export default function ProfileScreen() {
  const { colors, space, radius } = useTheme();
  const { demoPlans } = useLocalSearchParams<{ demoPlans?: string }>();
  useDemoPlans(demoPlans);
  const profile = useMyProfile();
  const myPlans = useMyPlans();
  const { upcoming: plans, interested } = useMemo(() => splitMyPlans(myPlans.data ?? []), [myPlans.data]);
  const interestedPlans = useMemo(() => interested.map((event) => ({ event, status: 'interested' as const })), [interested]);
  const friends = useFriends();
  const { events: suggested } = useSuggestedEvents(3);
  const incomingRequests = (useFriendRequests().data ?? []).filter((r) => r.direction === 'incoming').length;
  const stats = useMemo(
    () => deriveProfileStats({ upcoming: plans, interested }, friends.data?.length ?? 0),
    [plans, interested, friends.data],
  );
  const { width: windowWidth } = useWindowDimensions();
  // Leave a sliver of the next ticket showing so the row reads as scrollable.
  const ticketWidth = Math.min(windowWidth - space.lg * 2 - space.xxl, 320);
  const ticketGap = space.md;
  const demo = !isBackendConfigured;

  const baseHeader = useLargeTitleHeader('Profile');
  const header = (
    <Stack.Screen
      options={{
        ...baseHeader,
        headerRight: () => (
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <ActivityButton />
            <GlassButton symbol="gearshape" accessibilityLabel="Settings" onPress={() => router.push('/settings')} />
          </View>
        ),
      }}
    />
  );

  if (profile.isPending) {
    return (
      <Screen nativeHeader>
        {header}
        <View style={{ gap: space.lg }} accessibilityLabel="Loading profile">
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
      <Screen nativeHeader>
        {header}
        <EmptyState
          symbol="exclamationmark.circle.fill"
          title="couldn’t load your profile"
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
    <Screen nativeHeader>
      {header}

      <View style={{ gap: space.xl }}>
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

        {me.bio ? <AppText variant="body">{me.bio}</AppText> : null}

        <Button label="Edit profile" onPress={() => router.push('/edit-profile')} accessibilityLabel="Edit profile" />

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
          <Stat
            value={stats.friends}
            label="Friends"
            href={friendsHref}
            badge={incomingRequests > 0}
            a11yExtra={incomingRequests > 0 ? `${incomingRequests} new ${incomingRequests === 1 ? 'request' : 'requests'}` : undefined}
          />
          <Stat value={stats.interested} label="Interested" />
        </View>

        <View style={{ gap: space.md }}>
          <AppText variant="overline" color="inkSecondary" accessibilityRole="header">
            your plans
          </AppText>
          {plans.length === 0 ? (
            <View style={{ gap: space.lg }}>
              <AppText variant="body" color="inkSecondary">
                Nothing on your calendar yet. Tap Going on something and it lands here.
              </AppText>
              <SuggestedEvents events={suggested} />
              <Button label="Find something to do" onPress={() => router.navigate('/')} />
            </View>
          ) : (
            <ScrollView
              horizontal
              accessibilityLabel="your plans"
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

        <View style={{ gap: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <AppText variant="overline" color="inkSecondary" accessibilityRole="header">
              Interested
            </AppText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
              <Icon name="lock.fill" size={12} color="inkSecondary" />
              <AppText variant="caption" color="inkSecondary">
                Only you see this
              </AppText>
            </View>
          </View>
          {interestedPlans.length === 0 ? (
            <AppText variant="body" color="inkSecondary">
              Tap ♡ Interested on an event to stash it here.
            </AppText>
          ) : (
            <ScrollView
              horizontal
              accessibilityLabel="Interested events"
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToOffsets={interestedPlans.map((_, i) => i * (ticketWidth + ticketGap))}
              snapToAlignment="start"
              style={{ marginHorizontal: -space.lg }}
              contentContainerStyle={{ gap: ticketGap, paddingHorizontal: space.lg, paddingVertical: space.sm }}
            >
              {interestedPlans.map((p) => (
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
