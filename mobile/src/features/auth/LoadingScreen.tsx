import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AppText, Button, useTheme } from '@/design';

import { useRetrySession } from './AuthProvider';

export const SLOW_LOADING_MS = 6_000;

/** Shown while the saved session and profile load. After 6 s it admits it is slow and offers Retry. */
export function LoadingScreen({ onRetry }: { onRetry: () => void }) {
  const { colors, space } = useTheme();
  const retrySession = useRetrySession();
  const [slow, setSlow] = useState(false);
  // Bumped by Retry so the 6 s countdown starts over.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_LOADING_MS);
    return () => clearTimeout(timer);
  }, [attempt]);

  return (
    <View
      accessibilityLabel="Loading yard"
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xl, backgroundColor: colors.canvas }}
    >
      <AppText variant="display" color="accent" maxFontSizeMultiplier={1.2}>
        yard.
      </AppText>
      <ActivityIndicator color={colors.inkSecondary} accessibilityLabel="Loading" />
      {slow ? (
        <View style={{ alignItems: 'center', gap: space.md, paddingHorizontal: space.xxxl }}>
          <AppText variant="subheadline" color="inkSecondary" accessibilityLiveRegion="polite">
            Taking longer than usual…
          </AppText>
          <Button
            label="Retry"
            onPress={() => {
              retrySession();
              onRetry();
              setSlow(false);
              setAttempt((n) => n + 1);
            }}
          />
        </View>
      ) : null}
    </View>
  );
}
