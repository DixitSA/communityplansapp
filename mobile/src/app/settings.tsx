import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { AppText, Button, Icon, NavRow, useTheme, type SymbolName } from '@/design';
import { DELETE_ACCOUNT_DETAILS } from '@/features/settings/blockedList';
import { useDeleteAccount, useDiscoverableByPhone } from '@/features/settings/useSettings';
import { MySuggestions } from '@/features/submit/MySuggestions';
import { SuggestRow } from '@/features/submit/SuggestRow';
import { api } from '@/lib/api';
import { isBackendConfigured } from '@/lib/env';
import { selection, warning } from '@/lib/haptics';

/** Who can see each thing you do: the privacy rules from DATA_MODEL.md, in plain words. */
const PRIVACY: { symbol: SymbolName; title: string; detail: string }[] = [
  { symbol: 'heart', title: 'Interested and Down if friends go', detail: 'Only you. Your friends never see these.' },
  { symbol: 'checkmark.circle', title: 'Going', detail: 'Your friends, and other people going to the same event.' },
  { symbol: 'location.fill', title: 'Your location', detail: 'Used only to find what’s nearby. Never saved.' },
];

function SectionLabel({ children }: { children: string }) {
  const { space } = useTheme();
  return (
    <AppText variant="overline" color="inkSecondary" accessibilityRole="header" style={{ paddingLeft: space.xs }}>
      {children}
    </AppText>
  );
}

/** Settings: who sees what, suggesting events, and sign out. Notifications arrive with push. */
export default function SettingsSheet() {
  const { colors, space, radius } = useTheme();
  const router = useRouter();
  const discoverable = useDiscoverableByPhone();
  const deleteAccount = useDeleteAccount();

  const confirmDelete = () => {
    warning();
    if (!isBackendConfigured) {
      Alert.alert('No account to delete', 'You’re in demo mode, so there’s no account here.');
      return;
    }
    Alert.alert('Delete your account?', DELETE_ACCOUNT_DETAILS, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Continue',
        style: 'destructive',
        onPress: () => {
          warning();
          Alert.alert('Delete account for good?', 'Last check: your account and everything in it will be deleted right now.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete my account',
              style: 'destructive',
              onPress: () =>
                // On success the auth listener sends us to the welcome screen.
                deleteAccount.mutate(undefined, {
                  onError: () => Alert.alert('Couldn’t delete your account', 'Nothing was deleted. Check your connection and try again.'),
                }),
            },
          ]);
        },
      },
    ]);
  };

  const confirmSignOut = () => {
    warning();
    Alert.alert('Sign out of yard?', 'You can sign back in any time with your email or Apple.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        // The auth listener notices and the root guards send us back to the welcome screen.
        onPress: () => {
          api.signOut().catch(() => Alert.alert('Couldn’t sign out', 'Check your connection and try again.'));
        },
      },
    ]);
  };

  return (
    <ScrollView
      stickyHeaderIndices={[0]}
      style={{ flex: 1, backgroundColor: colors.canvas }}
      contentContainerStyle={{ paddingBottom: space.xxxl }}
    >
      {/* StickyHeader moves its direct child's style to a wrapper; keep row layout one level inside. */}
      <View style={{ backgroundColor: colors.canvas }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: space.lg,
          paddingTop: space.xl,
          paddingBottom: space.md,
          backgroundColor: colors.canvas,
        }}
      >
        <AppText variant="title2" accessibilityRole="header">
          Settings
        </AppText>
        <Pressable accessibilityRole="button" accessibilityLabel="Done" hitSlop={space.sm} onPress={() => router.back()}>
          <AppText variant="body" color="accent" style={{ fontWeight: '600' }}>
            Done
          </AppText>
        </Pressable>
      </View>
      </View>

      <View style={{ paddingHorizontal: space.lg, paddingTop: space.md, gap: space.xl }}>
        <View style={{ gap: space.sm }}>
          <SectionLabel>Who sees what</SectionLabel>
          <View
            style={{
              borderRadius: radius.card,
              borderCurve: 'continuous',
              backgroundColor: colors.surface,
              paddingHorizontal: space.lg,
            }}
          >
            {PRIVACY.map((row, i) => (
              <View
                key={row.title}
                accessible
                accessibilityLabel={`${row.title}: ${row.detail}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: space.md,
                  paddingVertical: space.md,
                  borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                  borderTopColor: colors.line,
                }}
              >
                <View style={{ paddingTop: 2 }}>
                  <Icon name={row.symbol} size={18} color="accent" />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="body" style={{ fontWeight: '600' }}>
                    {row.title}
                  </AppText>
                  <AppText variant="subheadline" color="inkSecondary">
                    {row.detail}
                  </AppText>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={{ gap: space.sm }}>
          <SectionLabel>Privacy</SectionLabel>
          <View
            style={{
              borderRadius: radius.card,
              borderCurve: 'continuous',
              backgroundColor: colors.surface,
              paddingHorizontal: space.lg,
              minHeight: 52,
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.md,
            }}
          >
            <AppText variant="body" style={{ flex: 1, paddingVertical: space.md }}>
              Let people find me by phone number
            </AppText>
            {discoverable.value !== undefined ? <Switch
              testID="settings-discoverable-by-phone-switch"
              accessibilityLabel="Let people find me by phone number"
              value={discoverable.value}
              disabled={discoverable.isLoading || discoverable.isReadError || discoverable.isPending}
              accessibilityState={{ disabled: discoverable.isLoading || discoverable.isReadError || discoverable.isPending }}
              onValueChange={(v) => discoverable.set(v)}
              trackColor={{ true: colors.accent }}
            /> : null}
          </View>
          {discoverable.isLoading ? (
            <AppText variant="footnote" color="inkSecondary">Loading privacy setting…</AppText>
          ) : discoverable.isReadError ? (
            <View style={{ gap: space.sm }}>
              <AppText variant="footnote" color="danger">Couldn’t load your privacy setting.</AppText>
              <Button label="Try again" accessibilityLabel="Retry privacy setting" onPress={() => discoverable.retry()} />
            </View>
          ) : null}
          {discoverable.error ? (
            <AppText variant="footnote" color="danger" accessibilityRole="alert">
              Couldn’t save your choice. Check your connection and try again.
            </AppText>
          ) : null}
          <AppText variant="footnote" color="inkSecondary" style={{ paddingLeft: space.xs }}>
            phone matching arrives later. this saves your choice now.
          </AppText>
          <NavRow symbol="hand.raised" label="Blocked people" onPress={() => router.push('/blocked')} />
        </View>

        <View style={{ gap: space.sm }}>
          <SectionLabel>Help yard grow</SectionLabel>
          <SuggestRow surface />
          <MySuggestions />
        </View>

        <View style={{ gap: space.sm }}>
          <SectionLabel>Help</SectionLabel>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="How yard works"
            accessibilityHint="Opens a short guide to plans, chats, friends and privacy"
            onPress={() => {
              selection();
              router.push('/help');
            }}
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
            <Icon name="questionmark.circle" size={20} color="accent" />
            <AppText variant="body" style={{ flex: 1 }}>
              How yard works
            </AppText>
            <Icon name="chevron.right" size={14} color="inkSecondary" weight="semibold" />
          </Pressable>
        </View>

        {isBackendConfigured ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            onPress={confirmSignOut}
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
            <Icon name="rectangle.portrait.and.arrow.right" size={20} color="danger" />
            <AppText variant="body" color="danger">
              Sign out
            </AppText>
          </Pressable>
        ) : null}

        <View style={{ gap: space.sm }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete account"
            onPress={confirmDelete}
            disabled={deleteAccount.isPending}
            style={({ pressed }) => ({
              minHeight: 52,
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.md,
              paddingHorizontal: space.lg,
              borderRadius: radius.card,
              borderCurve: 'continuous',
              backgroundColor: colors.surface,
              opacity: pressed || deleteAccount.isPending ? 0.6 : 1,
            })}
          >
            <Icon name="trash" size={20} color="danger" />
            <AppText variant="body" color="danger">
              {deleteAccount.isPending ? 'Deleting…' : 'Delete account'}
            </AppText>
          </Pressable>
          <AppText variant="footnote" color="inkSecondary" style={{ paddingLeft: space.xs }}>
            permanently removes your profile, plans, friends and messages.
          </AppText>
        </View>

        {__DEV__ && !isBackendConfigured ? (
          <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
            <Icon name="lock.shield.fill" size={14} color="inkSecondary" />
            <AppText variant="footnote" color="inkSecondary" style={{ flex: 1 }}>
              Demo mode: there is no account to sign out of. To turn on sign-in, follow docs/SUPABASE_SETUP.md.
            </AppText>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
