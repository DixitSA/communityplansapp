import { Link } from 'expo-router';

import { AppText, EmptyState, Screen } from '@/design';

export default function ProfileScreen() {
  return (
    <Screen>
      <AppText variant="largeTitle">Profile</AppText>
      <EmptyState
        symbol="person.crop.circle"
        title="Make it yours"
        message="Your name, photo and interests will live here."
      />
      {__DEV__ ? (
        <Link href="/gallery" accessibilityRole="link" style={{ textAlign: 'center' }}>
          <AppText variant="subheadline" color="accent">
            Open design gallery
          </AppText>
        </Link>
      ) : null}
    </Screen>
  );
}
