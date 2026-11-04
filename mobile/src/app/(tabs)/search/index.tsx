import { Stack, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';

import {
  AppText,
  Button,
  Chip,
  EmptyState,
  FriendButton,
  NavRow,
  PersonRow,
  PersonRowSkeleton,
  SearchField,
  SegmentedControl,
  useLargeTitleHeader,
  useTheme,
} from '@/design';
import { SEARCH_MAX_LENGTH, SEARCH_MIN_LENGTH, type FeedEvent, type PersonSearchResult } from '@/lib/api';
import { EventRowLink } from '@/features/event/EventCardLink';
import { useFeedEvents } from '@/features/feed/useFeedEvents';
import {
  isPeopleQuery,
  matchEvents,
  searchShortcuts,
  type SearchMode,
  type SearchScope,
} from '@/features/search/matchEvents';
import { useFriendButton } from '@/features/friends/useFriendButton';
import { useFriendRequests } from '@/features/friends/useFriends';
import { useFriendSearch } from '@/features/friends/useFriendSearch';
import { friendsHref, userHref } from '@/features/friends/routes';
import { selection } from '@/lib/haptics';
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

function ShortcutGroup({ label, items, onPick }: { label: string; items: string[]; onPick: (q: string) => void }) {
  const { space } = useTheme();
  if (items.length === 0) return null;
  return (
    <View style={{ gap: space.sm }}>
      <AppText variant="overline" color="inkSecondary" accessibilityRole="header" style={{ paddingLeft: space.xs }}>
        {label}
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {items.map((item) => (
          <Chip
            key={item}
            label={item}
            accessibilityLabel={`Search ${item}`}
            onPress={() => {
              selection();
              onPick(item);
            }}
          />
        ))}
      </View>
    </View>
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
  // Set by a shortcut chip; typing goes back to searching every field.
  const [scope, setScope] = useState<SearchScope | undefined>(undefined);
  const [mode, setMode] = useState<SearchMode>('events');
  const people = mode === 'people';
  const { status, results, typed, refetch } = useFriendSearch(people ? text : '');
  const { upcoming } = useFeedEvents();
  const eventQuery = text.trim();
  const eventResults = useMemo(() => (people ? [] : matchEvents(upcoming, eventQuery, scope)), [people, upcoming, eventQuery, scope]);

  const shortcuts = useMemo(() => searchShortcuts(upcoming), [upcoming]);

  const onChangeText = (next: string) => {
    setText(next);
    setScope(undefined);
    if (isPeopleQuery(next)) setMode('people');
  };

  const pickShortcut = (q: string, chipScope: SearchScope) => {
    setText(q);
    setScope(chipScope);
  };

  const header = (
    <View style={{ gap: space.md, paddingBottom: space.sm }}>
      <SearchField
        value={text}
        onChangeText={onChangeText}
        placeholder={people ? 'Search people' : 'Search events'}
        maxLength={SEARCH_MAX_LENGTH + 1}
        accessibilityHint={people ? 'Search by name or username' : 'Search by title, venue, neighborhood or category'}
      />
      <SegmentedControl
        options={[
          { value: 'events', label: 'Events' },
          { value: 'people', label: 'People' },
        ]}
        value={mode}
        onChange={setMode}
      />
      {people && status === 'short' ? (
        <AppText variant="footnote" color="inkSecondary" accessibilityLiveRegion="polite" style={{ paddingLeft: space.xs }}>
          Type at least {SEARCH_MIN_LENGTH} characters to search.
        </AppText>
      ) : null}
    </View>
  );

  const eventsBody =
    eventQuery.length === 0 ? (
      <View style={{ gap: space.lg }}>
        <EmptyState
          symbol="magnifyingglass"
          title="Find an event"
          message="Search the next 2 weeks by title, venue, neighborhood or category."
        />
        <ShortcutGroup label="Neighborhoods" items={shortcuts.neighborhoods} onPick={(q) => pickShortcut(q, 'neighborhood')} />
        <ShortcutGroup label="Categories" items={shortcuts.categories} onPick={(q) => pickShortcut(q, 'category')} />
      </View>
    ) : eventResults.length === 0 ? (
      <EmptyState
        symbol="calendar.badge.exclamationmark"
        title="No events found"
        message={`No events match “${eventQuery}” in the next 2 weeks.`}
      />
    ) : undefined;

  const body =
    !people ? null : status === 'idle' || status === 'short' ? (
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
      <FlatList<PersonSearchResult | FeedEvent>
        style={{ flex: 1, backgroundColor: colors.canvas }}
        data={people ? (status === 'results' ? results : []) : eventResults}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => ('displayName' in item ? <ResultRow person={item} /> : <EventRowLink event={item} />)}
        ListHeaderComponent={header}
        ListEmptyComponent={(people ? body : eventsBody) ?? undefined}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        accessibilityLabel={
          people
            ? status === 'results'
              ? `${results.length} people found`
              : undefined
            : eventResults.length > 0
              ? `${eventResults.length} events found`
              : undefined
        }
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxxl * 3, paddingTop: space.sm }}
      />
    </>
  );
}
