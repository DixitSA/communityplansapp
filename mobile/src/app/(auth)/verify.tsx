import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, CodeField, FieldStatusLine, useTheme, type FieldStatus } from '@/design';
import { useSignInFlow } from '@/features/auth/useSignInFlow';
import { Scaffold } from '@/features/onboarding/Scaffold';
import { formatCountdown, useCountdown } from '@/features/onboarding/useCountdown';
import { api, errorCode, mapAuthError } from '@/lib/api';
import { light } from '@/lib/haptics';

/** Supabase allows one code per email per minute. */
const RESEND_SECONDS = 60;

export default function VerifyScreen() {
  const { email = '' } = useLocalSearchParams<{ email?: string }>();
  const { space } = useTheme();
  const router = useRouter();
  const { afterSignIn } = useSignInFlow();
  const { remaining, restart } = useCountdown(RESEND_SECONDS);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (value: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api.verifyEmailCode(email, value);
      afterSignIn();
    } catch (err) {
      setError(mapAuthError(errorCode(err)));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (remaining > 0) return;
    light();
    setError(null);
    try {
      await api.sendEmailCode(email);
      setNotice('New code sent.');
      restart();
    } catch (err) {
      setError(mapAuthError(errorCode(err)));
    }
  };

  const status: FieldStatus | null = error
    ? { tone: 'error', text: error }
    : busy
      ? { tone: 'checking', text: 'Checking…' }
      : notice
        ? { tone: 'success', text: notice }
        : null;

  return (
    <Scaffold back title="Check your email" subtitle={email ? `Enter the 6-digit code we sent to ${email}.` : 'Enter the 6-digit code we sent you.'}>
      <View style={{ gap: space.md }}>
        <CodeField
          value={code}
          onChangeText={(t) => {
            setCode(t);
            if (error) setError(null);
          }}
          onComplete={submit}
          editable={!busy}
          error={Boolean(error)}
        />
        <View style={{ minHeight: 20 }}>{status ? <FieldStatusLine status={status} /> : null}</View>
      </View>

      <View style={{ alignItems: 'center', gap: space.lg }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={remaining > 0 ? `Resend code available in ${formatCountdown(remaining)}` : 'Resend code'}
          accessibilityState={{ disabled: remaining > 0 }}
          disabled={remaining > 0}
          onPress={resend}
          hitSlop={space.md}
        >
          <AppText variant="subheadline" color={remaining > 0 ? 'inkSecondary' : 'accent'} rounded={remaining > 0} style={{ fontWeight: '600' }}>
            {remaining > 0 ? `Resend code in ${formatCountdown(remaining)}` : 'Resend code'}
          </AppText>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Use a different email" onPress={() => router.back()} hitSlop={space.md}>
          <AppText variant="subheadline" color="inkSecondary">
            Use a different email
          </AppText>
        </Pressable>
      </View>
    </Scaffold>
  );
}
