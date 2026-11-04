import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { AppText, EmptyState, PersonRow, PersonRowSkeleton, useTheme } from '@/design';
import { useBlockedUsers, useUnblock } from '@/features/settings/useSettings';
import { warning } from '@/lib/haptics';

/** People you've blocked, with an Unblock button on each. */
export default function BlockedScreen() {
  const { colors, space, radius } = useTheme();
  const router = useRouter();
  const blocked = useBlockedUsers();
  const unblock = useUnblock();

  const confirmUnblock = (id: string, name: string) => {
    warning();
    Alert.alert(`Unblock ${name}?`, 'They’ll be able to find you, see your profile and send you friend requests again. They won’t be told.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unblock',
        onPress: () => unblock.mutate(id, { onError: () => Alert.alert('Couldn’t unblock', 'Check your connection and try again.') }),
      },
    ]);
  };

  const people = blocked.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: space.lg,
          paddingTop: space.xl,
          paddingBottom: space.md,
        }}
      >
        <AppText variant="title2" accessibilityRole="header">
          Blocked people
        </AppText>
        <Pressable accessibilityRole="button" accessibilityLabel="Done" hitSlop={space.sm} onPress={() => router.back()}>
          <AppText variant="body" color="accent" style={{ fontWeight: '600' }}>
            Done
          </AppText>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.xxxl, gap: space.md }}>
        {blocked.isLoading ? (
          <PersonRowSkeleton />
        ) : blocked.isError ? (
          <EmptyState symbol="wifi.slash" title="Couldn’t load this" message="check your connection and try again." />
        ) : people.length === 0 ? (
          <EmptyState symbol="hand.raised" title="No one blocked" message="no one blocked. love that for you." />
        ) : (
          <View style={{ borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.surface, paddingHorizontal: space.lg }}>
            {people.map((p) => (
              <PersonRow
                key={p.id}
                name={p.displayName}
                username={p.username}
                avatarUri={p.avatarUrl}
                trailing={
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Unblock ${p.displayName}`}
                    hitSlop={space.sm}
                    onPress={() => confirmUnblock(p.id, p.displayName)}
                  >
                    <AppText variant="body" color="accent" style={{ fontWeight: '600' }}>
                      Unblock
                    </AppText>
                  </Pressable>
                }
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
