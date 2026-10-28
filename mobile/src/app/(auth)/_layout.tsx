import { Stack } from 'expo-router';

import { useTheme } from '@/design';

// Files in a folder open alphabetically by default, which would start on /email.
export const unstable_settings = { anchor: 'welcome' };

export default function AuthLayout() {
  const { colors } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }} />;
}
