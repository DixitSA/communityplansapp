import { useRouter } from 'expo-router';

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
  };
}
