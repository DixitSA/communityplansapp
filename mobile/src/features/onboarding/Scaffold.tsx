import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, GlassButton, StepProgress, useTheme } from '@/design';

export type ScaffoldProps = {
  /** 1-based onboarding step. Omit on the sign-in screens. */
  step?: number;
  title: string;
  subtitle?: string;
  children?: ReactNode;
  /** Pinned above the keyboard / home indicator: the screen's actions. */
  footer?: ReactNode;
  /** Show a back button. Off by default: the first screen of a flow has nowhere to go back to. */
  back?: boolean;
};

/** Shared frame for sign-in and onboarding screens: top bar, big title, scrolling body, pinned actions. */
export function Scaffold({ step, title, subtitle, children, footer, back = false }: ScaffoldProps) {
  const { colors, space } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.canvas, paddingTop: insets.top }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.lg,
          minHeight: 44 + space.lg,
          paddingHorizontal: space.lg,
          paddingTop: space.sm,
        }}
      >
        {back ? (
          <GlassButton symbol="chevron.left" accessibilityLabel="Back" onPress={() => router.back()} />
        ) : null}
        {step ? <StepProgress step={step} /> : null}
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: space.xl, paddingBottom: space.xl, gap: space.xxl }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: space.sm }}>
          <AppText variant="largeTitle" accessibilityRole="header">
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="body" color="inkSecondary">
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {children}
      </ScrollView>
      {footer ? (
        <View style={{ paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: Math.max(insets.bottom, space.lg), gap: space.md }}>
          {footer}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
