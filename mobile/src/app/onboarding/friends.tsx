import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText, Avatar, Button, Icon, PrimaryButton, useTheme } from '@/design';
import { inviteFriends } from '@/features/friends/invite';
import { useOnboardingDraft } from '@/features/onboarding/draftStore';
import { draftToInput } from '@/features/onboarding/finish';
import { Scaffold } from '@/features/onboarding/Scaffold';
import { MY_PROFILE_KEY } from '@/features/profile/useMyProfile';
import { api, errorCode, mapOnboardingError, onboardingStepForError } from '@/lib/api';
import { isBackendConfigured } from '@/lib/env';
import { success } from '@/lib/haptics';

// Decorative initials only; these are not real people or suggestions.
const SAMPLE_FACES = ['Maya Chen', 'Jordan Lee', 'Sam Ortiz'];

export default function FindFriendsScreen() {
  const { space, colors, radius } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ message: string; step: string | null } | null>(null);

  const finish = async () => {
    const result = draftToInput(useOnboardingDraft.getState());
    if (!result.ok) {
      router.navigate(result.step === 'profile' ? '/onboarding/profile' : '/onboarding/interests');
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      await api.completeOnboarding(result.input);
      success();
      useOnboardingDraft.getState().reset();
      // With a backend the profile now exists: refetching flips the root guards and lands on the Feed.
      await queryClient.invalidateQueries({ queryKey: [MY_PROFILE_KEY] });
      // Demo mode has no guards to flip, so walk to the Feed ourselves.
      if (!isBackendConfigured) router.replace('/');
    } catch (err) {
      const code = errorCode(err);
      if (code === 'already_onboarded') {
        await queryClient.invalidateQueries({ queryKey: [MY_PROFILE_KEY] });
      } else {
        setProblem({ message: mapOnboardingError(code), step: onboardingStepForError(code) });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Scaffold
      back
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
          <PrimaryButton label="Invite friends" onPress={inviteFriends} />
          <Button label={busy ? 'Setting up…' : 'Finish'} onPress={busy ? () => {} : finish} />
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
