import { Redirect, Stack, router, useLocalSearchParams, type Href } from 'expo-router';
import { Platform, Pressable, ScrollView, View } from 'react-native';

import { AppText, Avatar, Button, EmptyState, FriendButton, Icon, Skeleton, useTheme } from '@/design';
import { friendCountLabel, mutualFriendsLabel } from '@/features/friends/format';
import { useFriendButton } from '@/features/friends/useFriendButton';
import { useProfileMenu } from '@/features/friends/useProfileMenu';
import { useUserProfile } from '@/features/friends/useUserProfile';
import { formatShortDate } from '@/lib/dates';

function Count({ value, label }: { value: number; label: string }) {
  const { space } = useTheme();
  return (
    <View accessible accessibilityLabel={`${value} ${label}`} style={{ flex: 1, alignItems: 'center', gap: space.xs }}>
      <AppText variant="title2" rounded maxFontSizeMultiplier={1.4}>
        {value}
      </AppText>
      <AppText variant="footnote" color="inkSecondary" maxFontSizeMultiplier={1.4}>
        {label}
      </AppText>
    </View>
  );
}

/** Another person's profile (DESIGN.md 6, row 14): who they are, what you share, and one clear friend button. */
export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, space, radius } = useTheme();
  const profile = useUserProfile(id);
  const { onAction, busyId } = useFriendButton();
  const openMenu = useProfileMenu(profile.data ?? null, () => router.back());
  const me = profile.data;

  const headerOptions = {
    headerShown: true,
    title: '',
    headerTransparent: false,
    headerShadowVisible: false,
    headerBackButtonDisplayMode: 'minimal',
    headerTintColor: colors.accent,
    headerStyle: { backgroundColor: colors.canvas },
    contentStyle: { backgroundColor: colors.canvas },
    headerRight: () =>
      me && me.friendship !== 'self' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="More options"
          hitSlop={space.md}
          // The web header has no inset on the right, so the dots would clip.
          style={Platform.OS === 'web' ? { paddingRight: space.lg } : undefined}
          onPress={openMenu}
        >
          <Icon name="ellipsis" size={22} color="accent" />
        </Pressable>
      ) : null,
  } as const;

  // Your own page is the Profile tab.
  if (me?.friendship === 'self') return <Redirect href={'/profile' as Href} />;

  let content: React.ReactElement;
  if (profile.isPending) {
    content = (
      <View accessibilityLabel="Loading profile" style={{ alignItems: 'center', gap: space.md, paddingTop: space.xl }}>
        <Skeleton width={112} height={112} radius={56} />
        <Skeleton width={180} height={26} />
        <Skeleton width={110} height={16} />
        <Skeleton height={48} radius={24} />
      </View>
    );
  } else if (profile.isError) {
    content = (
      <EmptyState symbol="wifi.slash" title="Couldn’t load this profile" message="Check your connection and try again.">
        <View style={{ alignSelf: 'stretch', paddingTop: space.md }}>
          <Button label="Try again" onPress={() => void profile.refetch()} />
        </View>
      </EmptyState>
    );
  } else if (!me) {
    // Missing and blocked look the same on purpose.
    content = (
      <EmptyState
        symbol="person.crop.circle.badge.xmark"
        title="This profile isn’t available"
        message="It may have been removed, or you may not be able to see it."
      >
        <View style={{ alignSelf: 'stretch', paddingTop: space.md }}>
          <Button label="Go back" onPress={() => router.back()} />
        </View>
      </EmptyState>
    );
  } else {
    // 'self' was redirected above. Read once here so the closures below keep the narrowed type.
    const state = me.friendship;
    content = (
      <View style={{ gap: space.xl }}>
        <View style={{ alignItems: 'center', gap: space.md, paddingTop: space.md }}>
          <Avatar name={me.displayName} uri={me.avatarUrl} size={112} />
          <View
            accessible
            accessibilityRole="header"
            accessibilityLabel={`${me.displayName}, @${me.username}`}
            style={{ alignItems: 'center', gap: space.xs }}
          >
            <AppText variant="title" style={{ textAlign: 'center' }}>
              {me.displayName}
            </AppText>
            <AppText variant="subheadline" color="inkSecondary">
              @{me.username}
            </AppText>
          </View>
          {me.bio ? (
            <AppText variant="subheadline" style={{ textAlign: 'center' }}>
              {me.bio}
            </AppText>
          ) : null}
        </View>

        <FriendButton
          state={state}
          name={me.displayName}
          busy={busyId === me.id}
          onAction={(action) => onAction(me, state, action)}
        />

        <View
          style={{
            flexDirection: 'row',
            paddingVertical: space.lg,
            borderRadius: radius.card,
            borderCurve: 'continuous',
            backgroundColor: colors.surface,
          }}
          accessibilityLabel={`${friendCountLabel(me.friendCount)}, ${mutualFriendsLabel(me.mutualFriendCount)}`}
          accessible
        >
          <Count value={me.friendCount} label="Friends" />
          <Count value={me.mutualFriendCount} label="Mutual friends" />
        </View>

        {me.sharedEvents.length > 0 ? (
          <View style={{ gap: space.sm }}>
            <AppText variant="overline" color="inkSecondary" accessibilityRole="header">
              You both went to
            </AppText>
            <View style={{ borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.surface, overflow: 'hidden' }}>
              {me.sharedEvents.map((e, i) => (
                <Pressable
                  key={e.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${e.title}, ${formatShortDate(e.startsAt)}`}
                  accessibilityHint="Opens the event"
                  onPress={() => router.push(`/event/${e.id}` as Href)}
                  style={({ pressed }) => ({
                    minHeight: 56,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.md,
                    paddingHorizontal: space.lg,
                    paddingVertical: space.md,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: colors.line,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <View style={{ flex: 1, gap: 1 }}>
                    <AppText variant="headline" numberOfLines={2}>
                      {e.title}
                    </AppText>
                    <AppText variant="footnote" color="inkSecondary">
                      {formatShortDate(e.startsAt)}
                    </AppText>
                  </View>
                  <Icon name="chevron.right" size={14} color="inkSecondary" weight="semibold" />
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Stack.Screen options={headerOptions} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxxl * 2, flexGrow: 1 }}
      >
        {content}
      </ScrollView>
    </View>
  );
}
