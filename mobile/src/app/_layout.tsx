import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, EmptyState, useTheme } from '@/design';
import { AuthProvider, useSession } from '@/features/auth/AuthProvider';
import { gateAllows } from '@/features/auth/gate';
import { LoadingScreen } from '@/features/auth/LoadingScreen';
import { useGate } from '@/features/auth/useGate';
import { useHydrated } from '@/lib/useHydrated';

/**
 * Decides which screens exist for the viewer right now. `Stack.Protected` hides a group of routes
 * when its `guard` is false, and Expo Router moves people off a hidden route by itself, so signing
 * in or finishing onboarding needs no manual navigation.
 */
function GatedStack() {
  const { colors, space, radius } = useTheme();
  const { gate, profile } = useGate();
  const session = useSession();

  if (gate === 'unconfigured') {
    // A release build without Supabase keys: say so plainly instead of showing sample data.
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: space.lg, backgroundColor: colors.canvas }}>
        <EmptyState
          symbol="exclamationmark.circle.fill"
          title="yard isn’t configured"
          message="This build is missing its server settings. Please update the app or try again later."
        />
      </View>
    );
  }

  if (gate === 'loading') {
    if (profile.isError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', padding: space.lg, backgroundColor: colors.canvas }}>
          <EmptyState
            symbol="exclamationmark.circle.fill"
            title="Couldn’t load your profile"
            message="Check your connection and try again."
          >
            <View style={{ alignSelf: 'stretch', paddingTop: space.md }}>
              <Button label="Try again" onPress={() => profile.refetch()} />
            </View>
          </EmptyState>
        </View>
      );
    }
    // Reading the saved session or the profile: show the wordmark instead of a blank screen.
    return <LoadingScreen onRetry={() => session && profile.refetch()} />;
  }

  // Sheet presentation is declared here, not inside the screens: native reads it when the screen is
  // pushed, and options set from within a screen arrive too late (the sheet would open full-screen).
  const sheet = (detents: 'fitToContents' | number[]) =>
    ({
      presentation: 'formSheet',
      sheetAllowedDetents: detents,
      sheetGrabberVisible: true,
      sheetCornerRadius: radius.sheet,
      contentStyle: { backgroundColor: colors.canvas },
    }) as const;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
      <Stack.Protected guard={gateAllows(gate, 'app')}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="event/[id]" />
        <Stack.Screen name="event/[id]/going" options={sheet('fitToContents')} />
        <Stack.Screen name="filters" options={sheet([0.6, 1])} />
        <Stack.Screen name="city" options={sheet('fitToContents')} />
        <Stack.Screen name="chat/[eventId]" />
        <Stack.Screen name="activity" />
        <Stack.Screen name="friends" />
        <Stack.Screen name="user/[id]" />
        <Stack.Screen name="settings" options={sheet([0.5, 1])} />
        <Stack.Screen name="(dev)/gallery" />
      </Stack.Protected>
      <Stack.Protected guard={gateAllows(gate, 'onboarding')}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={gateAllows(gate, 'auth')}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const { scheme } = useTheme();
  // The server can't know the color scheme, so a hydrating web page waits one render (always true on native).
  const hydrated = useHydrated();
  // TanStack Query's cache lives in this object, created once per app launch.
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } }),
  );
  if (!hydrated) return null;
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <GatedStack />
      </AuthProvider>
    </QueryClientProvider>
  );
}
