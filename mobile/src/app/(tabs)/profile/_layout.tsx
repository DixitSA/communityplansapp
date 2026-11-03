import { Stack } from 'expo-router';

// A Stack per tab gives the tab root a native navigation bar (large title); the screen sets its own options.
export default function Layout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
