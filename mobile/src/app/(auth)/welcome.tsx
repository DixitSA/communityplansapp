import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, useTheme } from '@/design';
import { useSignInFlow } from '@/features/auth/useSignInFlow';
import { AppleSignInButton } from '@/features/onboarding/AppleSignInButton';
import { useOnboardingDraft } from '@/features/onboarding/draftStore';
import { WelcomeBlob } from '@/features/onboarding/WelcomeBlob';
import { api, errorCode, mapAuthError } from '@/lib/api';

export default function WelcomeScreen() {
  const { colors, space } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { afterSignIn } = useSignInFlow();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signInWithApple = async () => {
    setBusy(true);
    setError(null);
    try {
      const { givenName } = await api.signInWithApple();
      useOnboardingDraft.getState().prefillDisplayName(givenName);
      afterSignIn();
    } catch (err) {
      const code = errorCode(err);
      // Closing Apple's sheet is a choice, not an error.
      if (code !== 'cancelled') setError(mapAuthError(code));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.canvas,
        paddingTop: insets.top + space.xxl,
        paddingBottom: Math.max(insets.bottom, space.lg),
        paddingHorizontal: space.lg,
      }}
    >
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xxl }}>
        <WelcomeBlob />
        <View style={{ alignItems: 'center', gap: space.xs }}>
          <AppText variant="display" color="accent" accessibilityRole="header" maxFontSizeMultiplier={1.2}>
            yard.
          </AppText>
          <AppText variant="title2" color="inkSecondary" style={{ textAlign: 'center' }}>
            Find your people.
          </AppText>
        </View>
      </View>

      <View style={{ gap: space.md }}>
        {error ? (
          <AppText
            variant="footnote"
            color="danger"
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={{ textAlign: 'center' }}
          >
            {error}
          </AppText>
        ) : null}
        <AppleSignInButton onPress={signInWithApple} disabled={busy} />
        <Button label="Continue with email" symbol="envelope.fill" onPress={() => router.push('/email')} />
        <AppText variant="caption" color="inkSecondary" style={{ textAlign: 'center', paddingTop: space.xs }}>
          By continuing, you agree to our Terms and Privacy Policy. You must be 18 or older to use yard.
        </AppText>
      </View>
    </View>
  );
}
