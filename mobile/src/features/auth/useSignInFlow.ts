import { useRouter } from 'expo-router';
import { Alert } from 'react-native';

import { api } from '@/lib/api';
import { isBackendConfigured } from '@/lib/env';

/**
 * What to do once sign-in succeeded. With a backend, the root layout's guards notice the new
 * session and move on by themselves. In demo mode every route is open, so we walk forward ourselves.
 */
export function useSignInFlow() {
  const router = useRouter();
  return {
    afterSignIn: () => {
      if (!isBackendConfigured) router.replace('/onboarding/profile');
    },
    /** Step 1's back button: signs out so the person can use another account. The guards then show the welcome screen. */
    leaveOnboarding: () => {
      api.signOut().then(
        () => {
          if (!isBackendConfigured) router.replace('/welcome');
        },
        () => Alert.alert('Couldn’t go back', 'Check your connection and try again.'),
      );
    },
  };
}
