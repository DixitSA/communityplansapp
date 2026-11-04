import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Icon, useTheme, type SymbolName } from '@/design';
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

/** Settings: who sees what, suggesting events, and sign out. Notifications and blocking arrive with their features. */
export default function SettingsSheet() {
  const { colors, space, radius } = useTheme();
  const router = useRouter();

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
          Settings
        </AppText>
        <Pressable accessibilityRole="button" accessibilityLabel="Done" hitSlop={space.sm} onPress={() => router.back()}>
          <AppText variant="body" color="accent" style={{ fontWeight: '600' }}>
            Done
          </AppText>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.xxxl, gap: space.xl }}>
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

        {__DEV__ && !isBackendConfigured ? (
          <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
            <Icon name="lock.shield.fill" size={14} color="inkSecondary" />
            <AppText variant="footnote" color="inkSecondary" style={{ flex: 1 }}>
              Demo mode: there is no account to sign out of. To turn on sign-in, follow docs/SUPABASE_SETUP.md.
            </AppText>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
