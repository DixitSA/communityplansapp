import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText, Avatar, Button, Icon, PrimaryButton, useTheme } from '@/design';
import { inviteFriends } from '@/features/friends/invite';
import { useOnboardingDraft } from '@/features/onboarding/draftStore';
import { finishOnboarding } from '@/features/onboarding/finish';
import { useSession } from '@/features/auth/AuthProvider';
import { Scaffold } from '@/features/onboarding/Scaffold';
import { MY_PROFILE_KEY } from '@/features/profile/useMyProfile';
import { mapOnboardingError, onboardingStepForError } from '@/lib/api';
import { isBackendConfigured } from '@/lib/env';
import { success } from '@/lib/haptics';

// Decorative initials only; these are not real people or suggestions.
const SAMPLE_FACES = ['Maya Chen', 'Jordan Lee', 'Sam Ortiz'];

export default function FindFriendsScreen() {
  const { space, colors, radius } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = useSession();
  const busy = useOnboardingDraft((s) => s.submissionBusy);
  const profileCreated = useOnboardingDraft((s) => s.profileCreated);
  const photoUri = useOnboardingDraft((s) => s.photoUri);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [problem, setProblem] = useState<{ message: string; step: string | null } | null>(null);

  const finish = async (skipPhoto = false) => {
    setProblem(null);
    const result = await finishOnboarding(
      () => queryClient.invalidateQueries({ queryKey: [MY_PROFILE_KEY] }, { throwOnError: true }),
      skipPhoto,
      session?.userId,
    );
    switch (result.kind) {
      case 'incomplete':
        router.navigate(result.step === 'profile' ? '/onboarding/profile' : '/onboarding/interests');
        break;
      case 'photo-error':
        setPhotoFailed(true);
        break;
      case 'error':
        setProblem({ message: mapOnboardingError(result.code), step: onboardingStepForError(result.code) });
        break;
      case 'success':
        success();
        // The backend's refreshed profile flips the guards; demo mode needs an explicit navigation.
        if (!isBackendConfigured) router.replace('/');
        break;
    }
  };

  return (
    <Scaffold
      back={!busy && !profileCreated}
      step={4}
      title="bring your people"
      subtitle="Events hit different with someone you know. Send an invite and see who’s going together."
      footer={
        <>
          {problem ? (
            <View style={{ gap: space.sm }}>
              <AppText variant="footnote" color="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">
                {problem.message}
              </AppText>
              {problem.step ? (
                <Button label="Edit my details" onPress={() => router.navigate(`/onboarding/${problem.step}` as '/onboarding/profile')} />
              ) : null}
            </View>
          ) : null}
          {photoFailed && photoUri ? (
            <>
              <AppText variant="footnote" color="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">
                Your profile is ready, but your photo couldn’t upload. Try again or add it later from your profile.
              </AppText>
              <PrimaryButton label={busy ? 'Setting up…' : 'Retry photo'} disabled={busy} onPress={() => finish()} />
              <Button label="Continue without photo" onPress={() => { if (!busy) void finish(true); }} />
            </>
          ) : (
            <>
              <Button label="Invite friends" onPress={() => { if (!busy) void inviteFriends(); }} />
              <PrimaryButton label={busy ? 'Setting up…' : 'Finish'} disabled={busy} onPress={() => finish()} />
            </>
          )}
        </>
      }
    >
      <View
        style={{
          alignItems: 'center',
          gap: space.lg,
          paddingVertical: space.xxxl,
          paddingHorizontal: space.xl,
          borderRadius: radius.sheet,
          borderCurve: 'continuous',
          backgroundColor: colors.surface,
        }}
      >
        <View style={{ flexDirection: 'row' }}>
          {SAMPLE_FACES.map((name, i) => (
            <View key={name} style={{ marginLeft: i === 0 ? 0 : -space.sm }}>
              <Avatar name={name} size={56} ring />
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Icon name="person.badge.plus" size={18} color="accent" />
          <AppText variant="headline">your crew starts with one invite</AppText>
        </View>
        <AppText variant="subheadline" color="inkSecondary" style={{ textAlign: 'center' }}>
          Finding friends from your contacts is coming soon, and you’ll choose who to match. Skip this for now and add friends whenever.
        </AppText>
      </View>
    </Scaffold>
  );
}
