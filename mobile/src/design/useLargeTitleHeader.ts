import type { Stack } from 'expo-router';
import type { ComponentProps } from 'react';

import { useTheme } from './theme';

type ScreenOptions = Exclude<NonNullable<ComponentProps<typeof Stack.Screen>['options']>, (...args: never[]) => unknown>;

/** Native large-title header on the canvas, with a chevron-only back button (the Activity screen's look). */
export function useLargeTitleHeader(title: string): ScreenOptions {
  const { colors } = useTheme();
  return {
    headerShown: true,
    title,
    headerLargeTitleEnabled: true,
    headerLargeTitleShadowVisible: false,
    headerShadowVisible: false,
    headerBackButtonDisplayMode: 'minimal',
    headerTintColor: colors.accent,
    headerStyle: { backgroundColor: colors.canvas },
    headerLargeStyle: { backgroundColor: colors.canvas },
    headerTitleStyle: { color: colors.ink },
    contentStyle: { backgroundColor: colors.canvas },
  };
}
