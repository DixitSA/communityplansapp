import { Stack, router, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';

import { AppText, Avatar, Chip, EmptyState, useTheme } from '@/design';
import { formatAgo } from '@/features/activity/format';
import { getActivityItems, type ActivityItem, type Person } from '@/features/activity/fixtures';
import { useNow } from '@/features/chat/useNow';
import { userHref } from '@/features/friends/routes';
import { alertFriendFailure, useFriendAction } from '@/features/friends/useFriendAction';
import { useFriendRequests } from '@/features/friends/useFriends';
import { isBackendConfigured } from '@/lib/env';
import { selection } from '@/lib/haptics';

/** A person as the friends mutations want them. Real requests bring their username and photo; sample people don't have any. */
const summaryOf = (p: Person) => ({ id: p.id, username: p.username ?? '', displayName: p.name, avatarUrl: p.avatarUrl ?? null });

function Row({
  person,
  text,
  minutesAgo,
  onPress,
  children,
}: {
  person: Person;
  text: string;
  minutesAgo: number;
  onPress?: () => void;
  children?: React.ReactNode;
}) {
  const { space } = useTheme();
  const text_ = (
    <>
      <AppText variant="subheadline">{text}</AppText>
      {children}
    </>
  );
  return (
    <View style={{ flexDirection: 'row', gap: space.md, paddingVertical: space.md }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${person.name}'s profile`}
        hitSlop={space.xs}
        onPress={() => router.push(userHref(person.id))}
      >
        <Avatar name={person.name} uri={person.avatarUrl} size={44} />
      </Pressable>
      {/* A separate target from the avatar: nesting buttons breaks on web and confuses VoiceOver. */}
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${text}. ${formatAgo(minutesAgo)} ago.`}
          onPress={onPress}
          style={{ flex: 1, gap: space.sm }}
        >
          {text_}
        </Pressable>
      ) : (
        <View style={{ flex: 1, gap: space.sm }}>{text_}</View>
      )}
      <AppText variant="caption" color="inkSecondary" rounded>
        {formatAgo(minutesAgo)}
      </AppText>
    </View>
  );
}

function MetCard({ item, onDismiss }: { item: Extract<ActivityItem, { kind: 'met' }>; onDismiss: () => void }) {
  const { colors, space, radius } = useTheme();
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const { run } = useFriendAction((err, v) => {
    // The request didn't go through: put the button back.
    setAdded((a) => ({ ...a, [v.person.id]: false }));
    alertFriendFailure(err);
  });
  return (
    <View
      style={{
        padding: space.lg,
        gap: space.md,
        borderRadius: radius.sheet,
        borderCurve: 'continuous',
        backgroundColor: colors.accentSoft,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="headline">Who did you meet?</AppText>
          <AppText variant="footnote" color="inkSecondary">
            You were both at {item.eventTitle}.
          </AppText>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" hitSlop={space.md} onPress={onDismiss}>
          <AppText variant="subheadline" color="inkSecondary">
            Not now
          </AppText>
        </Pressable>
      </View>
      {item.people.map((p) => (
        <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Avatar name={p.name} size={36} ring />
          <AppText variant="subheadline" style={{ flex: 1, fontWeight: '500' }}>
            {p.name}
          </AppText>
          <Chip
            label={added[p.id] ? 'Requested' : 'Add friend'}
            selected={!added[p.id]}
            filled
            onPress={() => {
              if (added[p.id]) return;
              setAdded((a) => ({ ...a, [p.id]: true }));
              run({ action: 'send', person: summaryOf(p), from: 'none' });
            }}
          />
        </View>
      ))}
    </View>
  );
}

export default function ActivityScreen() {
  const { colors, space } = useTheme();
  // Friend requests are real (the server's list, or the demo API's). The rest is still sample data
  // until notifications are wired, so a signed-in account sees only the real requests.
  const [items, setItems] = useState<ActivityItem[]>(() =>
    isBackendConfigured ? [] : getActivityItems().filter((i) => i.kind !== 'friend_request'),
  );
  const requests = useFriendRequests();
  const now = useNow();
  const [accepted, setAccepted] = useState<Record<string, ActivityItem & { kind: 'friend_request' }>>({});
  const { run, busyId } = useFriendAction((err, v) => {
    setAccepted((a) => {
      const { [v.person.id]: _undone, ...rest } = a;
      return rest;
    });
    alertFriendFailure(err);
  });
  const requestItems = useMemo(
    () =>
      (requests.data ?? [])
        .filter((r) => r.direction === 'incoming')
        .map(
          (r): ActivityItem & { kind: 'friend_request' } => ({
            kind: 'friend_request',
            id: `req-${r.id}`,
            minutesAgo: Math.max(0, (now.getTime() - r.createdAt.getTime()) / 60_000),
            person: { id: r.id, name: r.displayName, username: r.username, avatarUrl: r.avatarUrl },
          }),
        ),
    [requests.data, now],
  );
  const all: ActivityItem[] = [...requestItems, ...Object.values(accepted).filter((a) => !requestItems.some((r) => r.id === a.id)), ...items];
  const remove = (id: string) => setItems((cur) => cur.filter((i) => i.id !== id));
  const openEvent = (eventId: string) => router.push(`/event/${eventId}` as Href);

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Activity',
          headerLargeTitleEnabled: true,
          headerLargeTitleShadowVisible: false,
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          headerTintColor: colors.accent,
          headerStyle: { backgroundColor: colors.canvas },
          headerLargeStyle: { backgroundColor: colors.canvas },
          headerTitleStyle: { color: colors.ink },
          contentStyle: { backgroundColor: colors.canvas },
          headerRight: () =>
            items.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear all activity"
                hitSlop={space.md}
                // The web header has no inset on the right, so "Clear" would clip.
                style={Platform.OS === 'web' ? { paddingRight: space.lg } : undefined}
                onPress={() => {
                  selection();
                  setItems([]);
                }}
              >
                <AppText variant="body" color="accent" style={{ fontWeight: '600' }}>
                  Clear
                </AppText>
              </Pressable>
            ) : null,
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxxl, flexGrow: 1 }}
      >
        {all.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <EmptyState
              symbol="bell.slash"
              title="You're all caught up"
              message="When friends are going, requests come in, or you meet someone at an event, it shows up here."
            />
          </View>
        ) : (
          all.map((item) => {
            return (
              <View key={item.id}>
                {item.kind === 'met' ? (
                  <View style={{ paddingVertical: space.sm }}>
                    <MetCard item={item} onDismiss={() => remove(item.id)} />
                  </View>
                ) : item.kind === 'friend_going' ? (
                  <Row
                    person={item.person}
                    minutesAgo={item.minutesAgo}
                    text={`${item.person.name} is going to ${item.eventTitle}.`}
                    onPress={() => openEvent(item.eventId)}
                  />
                ) : item.kind === 'request_accepted' ? (
                  <Row
                    person={item.person}
                    minutesAgo={item.minutesAgo}
                    text={`${item.person.name} accepted your friend request.`}
                  />
                ) : (
                  <Row
                    person={item.person}
                    minutesAgo={item.minutesAgo}
                    text={
                      accepted[item.person.id]
                        ? `You and ${item.person.name} are now friends.`
                        : `${item.person.name} sent you a friend request.`
                    }
                  >
                    {accepted[item.person.id] || busyId === item.person.id ? null : (
                      <View style={{ flexDirection: 'row', gap: space.sm }}>
                        <Chip
                          label="Accept"
                          selected
                          filled
                          onPress={() => {
                            setAccepted((a) => ({ ...a, [item.person.id]: item }));
                            run({ action: 'accept', person: summaryOf(item.person), from: 'incoming' });
                          }}
                        />
                        <Chip
                          label="Decline"
                          onPress={() => run({ action: 'decline', person: summaryOf(item.person), from: 'incoming' })}
                        />
                      </View>
                    )}
                  </Row>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
