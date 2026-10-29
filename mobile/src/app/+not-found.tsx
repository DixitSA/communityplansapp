import { Redirect } from 'expo-router';

import { useGate } from '@/features/auth/useGate';

/**
 * Landing here usually means the requested route is hidden by a guard (for example "/" while
 * signed out). Send people to where their gate starts instead of showing an error page.
 */
export default function NotFound() {
  const { gate } = useGate();
  if (gate === 'auth') return <Redirect href="/welcome" />;
  if (gate === 'onboarding') return <Redirect href="/onboarding/profile" />;
  return <Redirect href="/" />;
}
