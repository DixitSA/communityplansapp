import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { useTheme } from '@/design';
import { useHydrated } from '@/lib/useHydrated';

export default function RootLayout() {
  const { scheme, colors } = useTheme();
  // The server can't know the color scheme, so a hydrating web page waits one render (always true on native).
  const hydrated = useHydrated();
  if (!hydrated) return null;
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }} />
    </>
  );
}
