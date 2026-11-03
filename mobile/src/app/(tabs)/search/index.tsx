import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { FlatList, View } from 'react-native';

import {
  AppText,
  Button,
  EmptyState,
  FriendButton,
  NavRow,
  PersonRow,
  PersonRowSkeleton,
  SearchField,
  useLargeTitleHeader,
  useTheme,
} from '@/design';
import { SEARCH_MAX_LENGTH, SEARCH_MIN_LENGTH, type PersonSearchResult } from '@/lib/api';
import { useFriendButton } from '@/features/friends/useFriendButton';
import { useFriendRequests } from '@/features/friends/useFriends';
import { useFriendSearch } from '@/features/friends/useFriendSearch';
import { friendsHref, userHref } from '@/features/friends/routes';
import { inviteFriends } from '@/features/friends/invite';

/** Under the search field while it's empty: the way to your friends and requests. */
function FriendsShortcut() {
  const incoming = (useFriendRequests().data ?? []).filter((r) => r.direction === 'incoming').length;
  return (
    <NavRow
      symbol="person.2"
      label="Friends and requests"
      unread={incoming > 0}
      accessibilityLabel={incoming > 0 ? `Friends and requests, ${incoming} new` : 'Friends and requests'}
      onPress={() => router.push(friendsHref)}
    />
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
  const navHeader = useLargeTitleHeader('Search');
  const [text, setText] = useState('');
  const { status, results, typed, refetch } = useFriendSearch(text);

  const header = (
    <View style={{ gap: space.md, paddingBottom: space.sm }}>
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
          message="Search by name or @username. Friends see each other’s Going plans, never your Interested ones."
        >
          <View style={{ alignSelf: 'stretch', paddingTop: space.md }}>
            <Button
              variant="primary"
              symbol="square.and.arrow.up"
              label="Invite a friend"
              accessibilityLabel="Invite a friend to yard"
              onPress={inviteFriends}
            />
          </View>
        </EmptyState>
      </View>
    ) : status === 'loading' ? (
      <PersonRowSkeleton />
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
    <>
      <Stack.Screen options={navHeader} />
      {/* The list is the screen's root scroll view, so the native large title collapses as it scrolls. */}
      <FlatList<PersonSearchResult>
        style={{ flex: 1, backgroundColor: colors.canvas }}
        data={status === 'results' ? results : []}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <ResultRow person={item} />}
        ListHeaderComponent={header}
        ListEmptyComponent={body ?? undefined}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        accessibilityLabel={status === 'results' ? `${results.length} people found` : undefined}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxxl * 3, paddingTop: space.sm }}
      />
    </>
  );
}
