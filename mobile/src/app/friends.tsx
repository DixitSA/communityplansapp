import { Stack, router } from 'expo-router';
import { RefreshControl, SectionList, View } from 'react-native';

import {
  AppText,
  Button,
  EmptyState,
  FriendButton,
  Icon,
  PersonRow,
  Skeleton,
  useLargeTitleHeader,
  useTheme,
} from '@/design';
import { formatAgo } from '@/features/activity/format';
import { useNow } from '@/features/chat/useNow';
import { userHref } from '@/features/friends/routes';
import { useFriendButton } from '@/features/friends/useFriendButton';
import { useFriendRequests, useFriends } from '@/features/friends/useFriends';
import type { FriendEntry, FriendRequest } from '@/lib/api';

type Row =
  | { kind: 'incoming'; request: FriendRequest }
  | { kind: 'outgoing'; request: FriendRequest }
  | { kind: 'friend'; friend: FriendEntry }
  | { kind: 'none' };
type Section = { key: 'incoming' | 'outgoing' | 'friends'; title: string; data: Row[] };

const minutesSince = (d: Date, now: Date) => Math.max(0, (now.getTime() - d.getTime()) / 60_000);

export default function FriendsScreen() {
  const { colors, space } = useTheme();
  const header = useLargeTitleHeader('Friends');
  const friends = useFriends();
  const requests = useFriendRequests();
  const { onAction, busyId } = useFriendButton();
  const now = useNow();

  const incoming = (requests.data ?? []).filter((r) => r.direction === 'incoming');
  const outgoing = (requests.data ?? []).filter((r) => r.direction === 'outgoing');
  const list = friends.data ?? [];

  const sections: Section[] = [
    ...(incoming.length > 0
      ? [{ key: 'incoming' as const, title: 'Requests', data: incoming.map((request): Row => ({ kind: 'incoming', request })) }]
      : []),
    ...(outgoing.length > 0
      ? [{ key: 'outgoing' as const, title: 'Requested', data: outgoing.map((request): Row => ({ kind: 'outgoing', request })) }]
      : []),
    {
      key: 'friends' as const,
      title: list.length > 0 ? `Friends · ${list.length}` : 'Friends',
      data: list.length > 0 ? list.map((friend): Row => ({ kind: 'friend', friend })) : [{ kind: 'none' }],
    },
  ];

  const loading = friends.isPending || requests.isPending;
  const failed = (friends.isError && !friends.data) || (requests.isError && !requests.data);
  const nothingAtAll = !loading && !failed && list.length === 0 && (requests.data ?? []).length === 0;
  const refresh = () => {
    void friends.refetch();
    void requests.refetch();
  };

  let state: React.ReactElement | undefined;
  if (loading) {
    state = (
      <View accessibilityLabel="Loading friends" style={{ gap: space.md, paddingHorizontal: space.lg, paddingTop: space.md }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64 }}>
            <Skeleton width={48} height={48} radius={24} />
            <View style={{ flex: 1, gap: space.sm }}>
              <Skeleton width="45%" height={16} />
              <Skeleton width="30%" height={12} />
            </View>
          </View>
        ))}
      </View>
    );
  } else if (failed) {
    state = (
      <EmptyState symbol="wifi.slash" title="Couldn’t load your friends" message="Check your connection and try again.">
        <View style={{ alignSelf: 'stretch', paddingTop: space.md }}>
          <Button label="Try again" onPress={refresh} />
        </View>
      </EmptyState>
    );
  } else if (nothingAtAll) {
    state = (
      <EmptyState
        symbol="person.2"
        title="No friends yet"
        message="Search for people you know. Once they accept, you’ll see which events they’re going to."
      >
        <View style={{ alignSelf: 'stretch', paddingTop: space.md }}>
          <Button variant="primary" symbol="magnifyingglass" label="Find friends" onPress={() => router.navigate('/search')} />
        </View>
      </EmptyState>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Stack.Screen options={header} />
      <SectionList<Row, Section>
        sections={state ? [] : sections}
        keyExtractor={(row) =>
          row.kind === 'none' ? 'none' : row.kind === 'friend' ? `f-${row.friend.id}` : `${row.kind}-${row.request.id}`
        }
        ListEmptyComponent={state}
        stickySectionHeadersEnabled={false}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={friends.isRefetching || requests.isRefetching} onRefresh={refresh} tintColor={colors.accent} />}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxxl * 2, flexGrow: 1 }}
        renderSectionHeader={({ section }) => (
          <AppText
            variant="overline"
            color="inkSecondary"
            accessibilityRole="header"
            style={{ paddingTop: space.xl, paddingBottom: space.xs }}
          >
            {section.title}
          </AppText>
        )}
        renderItem={({ item }) => {
          if (item.kind === 'none') {
            return (
              <AppText variant="subheadline" color="inkSecondary" style={{ paddingVertical: space.md }}>
                No friends yet. Accept a request, or find people in Search.
              </AppText>
            );
          }
          if (item.kind === 'friend') {
            const f = item.friend;
            return (
              <PersonRow
                name={f.displayName}
                username={f.username}
                avatarUri={f.avatarUrl}
                onPress={() => router.push(userHref(f.id))}
                trailing={<Icon name="chevron.right" size={14} color="inkSecondary" weight="semibold" />}
              />
            );
          }
          const r = item.request;
          if (item.kind === 'outgoing') {
            return (
              <PersonRow
                name={r.displayName}
                username={r.username}
                avatarUri={r.avatarUrl}
                subtitle={`@${r.username} · ${formatAgo(minutesSince(r.createdAt, now))} ago`}
                onPress={() => router.push(userHref(r.id))}
                trailing={
                  <FriendButton
                    size="compact"
                    state="outgoing"
                    name={r.displayName}
                    busy={busyId === r.id}
                    onAction={(action) => onAction(r, 'outgoing', action)}
                  />
                }
              />
            );
          }
          // Incoming: the question gets its own line of buttons, so the name never fights them for room.
          return (
            <View style={{ paddingBottom: space.sm }}>
              <PersonRow
                name={r.displayName}
                username={r.username}
                avatarUri={r.avatarUrl}
                subtitle={`@${r.username} · ${formatAgo(minutesSince(r.createdAt, now))} ago`}
                onPress={() => router.push(userHref(r.id))}
              />
              <View style={{ paddingLeft: 48 + space.md }}>
                <FriendButton
                  size="compact"
                  state="incoming"
                  name={r.displayName}
                  showDecline
                  busy={busyId === r.id}
                  onAction={(action) => onAction(r, 'incoming', action)}
                />
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}
