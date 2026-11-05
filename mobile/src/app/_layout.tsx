import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';

import { Button, EmptyState, UndoToast, useTheme } from '@/design';
import { useUndoStore } from '@/features/event/undoStore';
import { AuthProvider, useSession } from '@/features/auth/AuthProvider';
import { gateAllows } from '@/features/auth/gate';
import { LoadingScreen } from '@/features/auth/LoadingScreen';
import { useGate } from '@/features/auth/useGate';
import { useHydrated } from '@/lib/useHydrated';

// Give native cold links an explicit home. Protected routes still choose auth/onboarding
// when the tabs are unavailable; demo mode exposes every group and otherwise picks auth.
export const unstable_settings = { anchor: '(tabs)' };

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
            title="couldn’t load your profile"
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
        <Stack.Screen name="filters" options={sheet([1])} />
        <Stack.Screen name="city" options={sheet('fitToContents')} />
        <Stack.Screen name="chat/[eventId]" />
        <Stack.Screen name="activity" />
        <Stack.Screen name="friends" />
        <Stack.Screen name="user/[id]" />
        <Stack.Screen name="suggest" options={sheet([0.9, 1])} />
        <Stack.Screen name="edit-profile" options={sheet([0.9, 1])} />
        <Stack.Screen name="settings" options={sheet([0.5, 1])} />
        <Stack.Screen name="blocked" options={sheet([0.6, 1])} />
        <Stack.Screen name="help" options={sheet([0.7, 1])} />
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

/** Shows the shared undo toast above every screen, so it survives navigation. */
function UndoHost() {
  const toast = useUndoStore((s) => s.toast);
  const dismiss = useUndoStore((s) => s.dismiss);
  const lift = useUndoStore((s) => s.lift);
  const { space } = useTheme();

  // With VoiceOver on the toast has no timeout, so leaving the screen closes it instead.
  const pathname = usePathname();
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (pathname === lastPath.current) return;
    lastPath.current = pathname;
    void AccessibilityInfo.isScreenReaderEnabled().then((on) => {
      if (on) useUndoStore.getState().dismiss();
    });
  }, [pathname]);

  if (!toast) return null;
  return (
    <UndoToast
      key={toast.id}
      bottomOffset={lift === null ? undefined : lift + space.sm}
      message={toast.message}
      onDismiss={dismiss}
      onUndo={() => {
        dismiss();
        toast.onUndo();
      }}
    />
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
        <UndoHost />
      </AuthProvider>
    </QueryClientProvider>
  );
}
