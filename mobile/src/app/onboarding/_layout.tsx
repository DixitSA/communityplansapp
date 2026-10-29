import { Stack } from 'expo-router';

import { useTheme } from '@/design';

export const unstable_settings = { anchor: 'profile' };

// Signed-in people without a profile see only these four steps (see the guards in the root layout).
export default function OnboardingLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
        contentStyle: { backgroundColor: colors.canvas },
      }}
    />
  );
}
