import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { View } from 'react-native';

import { AppText, Button, EmptyState, Screen, Skeleton, useLargeTitleHeader, useTheme } from '@/design';
import { ChatList } from '@/features/chat/ChatList';
import { CHATS_KEY, useMyChats } from '@/features/chat/useMyChats';
import { useDemoPlans } from '@/features/event/demoPlans';
import { SuggestedEvents } from '@/features/feed/SuggestedEvents';
import { useSuggestedEvents } from '@/features/feed/useSuggestedEvents';

export default function ChatsScreen() {
  const { space, radius } = useTheme();
  const header = useLargeTitleHeader('Chats');
  const router = useRouter();
  const queryClient = useQueryClient();
  const { demoPlans } = useLocalSearchParams<{ demoPlans?: string }>();
  useDemoPlans(demoPlans);
  const { events: suggested } = useSuggestedEvents(3);

  const { data, isPending, isError, refetch, dataUpdatedAt } = useMyChats();
  // The countdown badges are measured from when the list last loaded.
  const now = useMemo(() => new Date(), [dataUpdatedAt]); // eslint-disable-line react-hooks/exhaustive-deps -- dataUpdatedAt is the trigger on purpose

  // The tab stays mounted, so refresh the unread counts each time it comes back into view.
  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: [CHATS_KEY] }, { cancelRefetch: false });
    }, [queryClient]),
  );

  return (
    <Screen nativeHeader>
      <Stack.Screen options={header} />

      {isPending ? (
        <View style={{ gap: space.md }} accessibilityLabel="Loading chats">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={88} radius={radius.card} />
          ))}
        </View>
      ) : isError ? (
        <EmptyState symbol="wifi.slash" title="Couldn’t load your chats" message="Check your connection and try again.">
          <View style={{ alignSelf: 'stretch', paddingTop: space.md }}>
            <Button label="Try again" onPress={() => void refetch()} />
          </View>
        </EmptyState>
      ) : data.length === 0 ? (
        <View style={{ gap: space.lg }}>
          <AppText variant="body" color="inkSecondary">
            Every event has a group chat for the people going. Pick one and meet them before the night.
          </AppText>
          <SuggestedEvents events={suggested} note="chat opens when you tap Going" />
          <Button variant="primary" symbol="sparkles" label="Browse the Feed" onPress={() => router.navigate('/')} />
        </View>
      ) : (
        <ChatList
          chats={data}
          now={now}
          onOpen={(eventId) => router.push({ pathname: '/chat/[eventId]', params: { eventId } })}
        />
      )}
    </Screen>
  );
}
