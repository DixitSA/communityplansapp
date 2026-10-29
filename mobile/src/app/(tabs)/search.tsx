import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppText,
  Button,
  EmptyState,
  FriendButton,
  Icon,
  PersonRow,
  SearchField,
  Skeleton,
  useTheme,
} from '@/design';
import { SEARCH_MAX_LENGTH, SEARCH_MIN_LENGTH, type PersonSearchResult } from '@/lib/api';
import { useFriendButton } from '@/features/friends/useFriendButton';
import { useFriendRequests } from '@/features/friends/useFriends';
import { useFriendSearch } from '@/features/friends/useFriendSearch';
import { friendsHref, userHref } from '@/features/friends/routes';

/** Under the search field while it's empty: the way to your friends and requests. */
function FriendsShortcut() {
  const { colors, space, radius } = useTheme();
  const incoming = (useFriendRequests().data ?? []).filter((r) => r.direction === 'incoming').length;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={incoming > 0 ? `Friends and requests, ${incoming} new` : 'Friends and requests'}
      onPress={() => router.push(friendsHref)}
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
      <Icon name="person.2" size={20} />
      <AppText variant="body" style={{ flex: 1 }}>
        Friends and requests
      </AppText>
      {incoming > 0 ? (
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent }} />
      ) : null}
      <Icon name="chevron.right" size={14} color="inkSecondary" weight="semibold" />
    </Pressable>
  );
}

function ResultRow({ person }: { person: PersonSearchResult }) {
  const { onAction, busyId } = useFriendButton();
  return (
    <PersonRow
      name={person.displayName}
      username={person.username}
      avatarUri={person.avatarUrl}
      onPress={() => router.push(userHref(person.id))}
      trailing={
        <FriendButton
          size="compact"
          state={person.friendship}
          name={person.displayName}
          busy={busyId === person.id}
          onAction={(action) => onAction(person, person.friendship, action)}
        />
      }
    />
  );
}

export default function SearchScreen() {
  const { colors, space } = useTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const { status, results, typed, refetch } = useFriendSearch(text);

  const header = (
    <View style={{ gap: space.md, paddingHorizontal: space.lg, paddingBottom: space.sm }}>
      <AppText variant="largeTitle" accessibilityRole="header">
        Search
      </AppText>
      <SearchField
        value={text}
        onChangeText={setText}
        placeholder="Search people"
        maxLength={SEARCH_MAX_LENGTH + 1}
        accessibilityHint="Search by name or username"
      />
      {status === 'short' ? (
        <AppText variant="footnote" color="inkSecondary" accessibilityLiveRegion="polite" style={{ paddingLeft: space.xs }}>
          Type at least {SEARCH_MIN_LENGTH} characters to search.
        </AppText>
      ) : null}
    </View>
  );

  const body =
    status === 'idle' || status === 'short' ? (
      <View style={{ gap: space.lg }}>
        {status === 'idle' ? <FriendsShortcut /> : null}
        <EmptyState
          symbol="magnifyingglass"
          title="Find your people"
          message="Search by name or @username to add friends and see what they’re up to."
        />
      </View>
    ) : status === 'loading' ? (
      <View accessibilityLabel="Searching" style={{ gap: space.md }}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64 }}>
            <Skeleton width={48} height={48} radius={24} />
            <View style={{ flex: 1, gap: space.sm }}>
              <Skeleton width="45%" height={16} />
              <Skeleton width="30%" height={12} />
            </View>
          </View>
        ))}
      </View>
    ) : status === 'error' ? (
      <EmptyState symbol="wifi.slash" title="Couldn’t search" message="Check your connection and try again.">
        <View style={{ alignSelf: 'stretch', paddingTop: space.md }}>
          <Button label="Try again" onPress={() => void refetch()} />
        </View>
      </EmptyState>
    ) : status === 'empty' ? (
      <EmptyState
        symbol="person.crop.circle.badge.questionmark"
        title="No one found"
        message={`Nobody matches “${typed}”. Check the spelling, or try their @username.`}
      />
    ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas, paddingTop: insets.top + space.lg }}>
      {header}
      <FlatList<PersonSearchResult>
        data={status === 'results' ? results : []}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <ResultRow person={item} />}
        ListEmptyComponent={body ?? undefined}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        accessibilityLabel={status === 'results' ? `${results.length} people found` : undefined}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxxl * 3, paddingTop: space.sm }}
      />
    </View>
  );
}
