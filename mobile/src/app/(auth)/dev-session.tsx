import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { EmptyState, useTheme } from '@/design';
import { api } from '@/lib/api';
import { devSessionLinkEnabled } from '@/lib/env';

/**
 * `yard://dev-session?rt=<refresh token>`: signs the test account in on the cloud iOS Simulator, where Apple
 * sign-in and email codes can't be used (see docs/DEV_SETUP.md). Every other build sends it to the welcome screen.
 */
export default function DevSessionScreen() {
  const { rt } = useLocalSearchParams<{ rt?: string }>();
  const { colors, space } = useTheme();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!devSessionLinkEnabled || !rt) return;
    // Once signed in, the root layout's guards move on to the feed (or onboarding) by themselves.
    api.signInWithRefreshToken(rt).catch(() => setFailed(true));
  }, [rt]);

  if (!devSessionLinkEnabled || !rt) return <Redirect href="/welcome" />;
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: space.lg, backgroundColor: colors.canvas }}>
      <EmptyState
        symbol={failed ? 'exclamationmark.circle.fill' : 'sparkles'}
        title={failed ? 'That sign-in link didn’t work' : 'Signing in…'}
        message={failed ? 'Make a fresh link and open it again.' : 'One moment.'}
      />
    </View>
  );
}
