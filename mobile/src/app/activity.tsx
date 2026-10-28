import { Stack, router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { AppText, Avatar, Chip, EmptyState, useTheme } from '@/design';
import { formatAgo } from '@/features/activity/format';
import { getActivityItems, type ActivityItem, type Person } from '@/features/activity/fixtures';
import { selection, success } from '@/lib/haptics';

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
  const body = (
    <View style={{ flexDirection: 'row', gap: space.md, paddingVertical: space.md }}>
      <Avatar name={person.name} size={44} />
      <View style={{ flex: 1, gap: space.sm }}>
        <AppText variant="subheadline">{text}</AppText>
        {children}
      </View>
      <AppText variant="caption" color="inkSecondary" rounded>
        {formatAgo(minutesAgo)}
      </AppText>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${text}. ${formatAgo(minutesAgo)} ago.`} onPress={onPress}>
      {body}
    </Pressable>
  );
}

function MetCard({ item, onDismiss }: { item: Extract<ActivityItem, { kind: 'met' }>; onDismiss: () => void }) {
  const { colors, space, radius } = useTheme();
  const [added, setAdded] = useState<Record<string, boolean>>({});
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
              success();
              setAdded((a) => ({ ...a, [p.id]: true }));
            }}
          />
        </View>
      ))}
    </View>
  );
}

export default function ActivityScreen() {
  const { colors, space } = useTheme();
  const [items, setItems] = useState<ActivityItem[]>(() => getActivityItems());
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
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
        {items.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <EmptyState
              symbol="bell.slash"
              title="You're all caught up"
              message="When friends are going, requests come in, or you meet someone at an event, it shows up here."
            />
          </View>
        ) : (
          items.map((item) => {
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
                      accepted[item.id]
                        ? `You and ${item.person.name} are now friends.`
                        : `${item.person.name} sent you a friend request.`
                    }
                  >
                    {accepted[item.id] ? null : (
                      <View style={{ flexDirection: 'row', gap: space.sm }}>
                        <Chip
                          label="Accept"
                          selected
                          filled
                          onPress={() => {
                            success();
                            setAccepted((a) => ({ ...a, [item.id]: true }));
                          }}
                        />
                        <Chip label="Decline" onPress={() => remove(item.id)} />
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
