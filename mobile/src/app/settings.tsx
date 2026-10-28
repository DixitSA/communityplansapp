import { Stack, useRouter } from 'expo-router';
import { Alert, Pressable, View } from 'react-native';

import { AppText, Icon, useTheme } from '@/design';
import { api } from '@/lib/api';
import { isBackendConfigured } from '@/lib/env';
import { warning } from '@/lib/haptics';

/** Settings placeholder (DESIGN.md 6 row 17 comes later): sign out, plus the demo-mode note. */
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
      <Stack.Screen
        options={{
          presentation: 'formSheet',
          headerShown: false,
          sheetGrabberVisible: true,
          sheetAllowedDetents: [0.5, 1],
          contentStyle: { backgroundColor: colors.canvas },
        }}
      />
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

      <View style={{ paddingHorizontal: space.lg, paddingTop: space.md, gap: space.xl }}>
        <AppText variant="subheadline" color="inkSecondary">
          Privacy, notifications and blocked users are coming soon.
        </AppText>

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
      </View>
    </View>
  );
}
