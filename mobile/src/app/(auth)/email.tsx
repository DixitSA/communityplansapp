import { useRouter } from 'expo-router';
import { useState } from 'react';

import { PrimaryButton, TextField } from '@/design';
import { Scaffold } from '@/features/onboarding/Scaffold';
import { api, errorCode, mapAuthError } from '@/lib/api';
import { isPlausibleEmail } from '@/lib/validation';

export default function EmailScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = isPlausibleEmail(email);

  const send = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.sendEmailCode(email);
      router.push({ pathname: '/verify', params: { email: email.trim().toLowerCase() } });
    } catch (err) {
      setError(mapAuthError(errorCode(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Scaffold
      back
      title="What’s your email?"
      subtitle="We’ll send you a 6-digit code. No password needed."
      footer={<PrimaryButton label={busy ? 'Sending…' : 'Send code'} disabled={!valid || busy} onPress={send} />}
    >
      <TextField
        label="Email"
        value={email}
        onChangeText={(t) => {
          setEmail(t);
          setError(null);
        }}
        placeholder="you@example.com"
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        keyboardType="email-address"
        returnKeyType="send"
        onSubmitEditing={send}
        status={error ? { tone: 'error', text: error } : null}
      />
    </Scaffold>
  );
}
