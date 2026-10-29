import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Share, View } from 'react-native';

import { AppText, Avatar, Button, Icon, PrimaryButton, useTheme } from '@/design';
import { useOnboardingDraft } from '@/features/onboarding/draftStore';
import { draftToInput } from '@/features/onboarding/finish';
import { Scaffold } from '@/features/onboarding/Scaffold';
import { MY_PROFILE_KEY } from '@/features/profile/useMyProfile';
import { api, errorCode, mapOnboardingError, onboardingStepForError } from '@/lib/api';
import { isBackendConfigured } from '@/lib/env';
import { success } from '@/lib/haptics';

const INVITE_MESSAGE = 'I’m using yard to find events in Charlotte and see who’s going. Come find your people with me.';
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

  const invite = () => {
    Share.share({ message: INVITE_MESSAGE }).catch(() => {
      // Closing the share sheet can reject on some platforms; nothing to do.
    });
  };

  return (
    <Scaffold
      back
      step={4}
      title="Friends make it better"
      subtitle="Finding friends from your contacts is coming soon. For now, invite them and see who’s going together."
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
          <Button label="Invite friends" symbol="square.and.arrow.up" onPress={invite} />
          <PrimaryButton label={busy ? 'Setting up…' : 'Finish'} disabled={busy} onPress={finish} />
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
          <AppText variant="headline">Contact matching, soon</AppText>
        </View>
        <AppText variant="subheadline" color="inkSecondary" style={{ textAlign: 'center' }}>
          You’ll choose who to match, and we’ll never message anyone for you. You can skip this and add friends later.
        </AppText>
      </View>
    </Scaffold>
  );
}
