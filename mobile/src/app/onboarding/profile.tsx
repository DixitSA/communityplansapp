import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, Avatar, PrimaryButton, TextField, useTheme, type FieldStatus } from '@/design';
import { BirthdateField } from '@/features/onboarding/BirthdateField';
import { useSignInFlow } from '@/features/auth/useSignInFlow';
import { useOnboardingDraft } from '@/features/onboarding/draftStore';
import { Scaffold } from '@/features/onboarding/Scaffold';
import { useUsernameAvailability } from '@/features/onboarding/useUsernameAvailability';
import { useOnboardingPhoto } from '@/features/onboarding/useOnboardingPhoto';
import {
  isAtLeast18,
  isValidDisplayName,
  normalizeUsername,
  parseDateOnly,
} from '@/lib/validation';

export default function ProfileBasicsScreen() {
  const { space } = useTheme();
  const router = useRouter();
  const { leaveOnboarding } = useSignInFlow();
  const displayName = useOnboardingDraft((s) => s.displayName);
  const photoUri = useOnboardingDraft((s) => s.photoUri);
  const photo = useOnboardingPhoto();
  const username = useOnboardingDraft((s) => s.username);
  const birthdateText = useOnboardingDraft((s) => s.birthdate);
  const { setDisplayName, setUsername, setBirthdate } = useOnboardingDraft.getState();

  const birthdate = useMemo(() => (birthdateText ? parseDateOnly(birthdateText) : null), [birthdateText]);
  const underage = birthdate !== null && !isAtLeast18(birthdate);
  const usernameStatus = useUsernameAvailability(username);

  let usernameField: FieldStatus | null = null;
  switch (usernameStatus.kind) {
    case 'invalid':
      usernameField = { tone: 'error', text: usernameStatus.message };
      break;
    case 'checking':
      usernameField = { tone: 'checking', text: 'Checking…' };
      break;
    case 'available':
      usernameField = { tone: 'success', text: `@${username} is available` };
      break;
    case 'taken':
      usernameField = { tone: 'error', text: `@${username} is taken. Try another.` };
      break;
    case 'error':
      usernameField = { tone: 'error', text: 'Couldn’t check that right now. Check your connection.' };
      break;
    default:
      usernameField = { tone: 'neutral', text: 'Friends find you by this. 3 to 20 letters, numbers, dots or underscores.' };
  }

  const ready = isValidDisplayName(displayName) && usernameStatus.kind === 'available' && birthdate !== null && !underage;

  return (
    <Scaffold
      step={1}
      back
      onBack={leaveOnboarding}
      title="the basics"
      subtitle="Tell us who you are. You can change your name later."
      footer={<PrimaryButton label="Continue" disabled={!ready || photo.isPicking} onPress={() => router.push('/onboarding/interests')} />}
    >
      <View style={{ gap: space.xl }}>
        <View style={{ alignItems: 'center', gap: space.sm }}>
          <View accessible accessibilityRole="image" accessibilityLabel={photoUri ? 'Selected profile photo' : 'Profile photo initials'}>
            <Avatar name={displayName} uri={photoUri} size={space.xxxl * 3} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.lg }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={photoUri ? 'Change profile photo' : 'Choose profile photo'}
              accessibilityState={{ disabled: photo.isPicking, busy: photo.isPicking }}
              disabled={photo.isPicking}
              onPress={photo.choosePhoto}
              style={{ minHeight: space.xxxl + space.lg, justifyContent: 'center' }}
            >
              <AppText variant="body" color="accent">
                {photo.isPicking ? 'Opening photos…' : photoUri ? 'Change photo' : 'Choose photo'}
              </AppText>
            </Pressable>
            {photoUri ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove profile photo"
                accessibilityState={{ disabled: photo.isPicking }}
                disabled={photo.isPicking}
                onPress={photo.removePhoto}
                style={{ minHeight: space.xxxl + space.lg, justifyContent: 'center' }}
              >
                <AppText variant="body" color="danger">Remove photo</AppText>
              </Pressable>
            ) : null}
          </View>
          <AppText variant="footnote" color="inkSecondary">Optional. You can add one later.</AppText>
          {photo.problem ? (
            <AppText variant="footnote" color="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">
              {photo.problem}
            </AppText>
          ) : null}
        </View>
        <TextField
          label="Name"
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Your name"
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          maxLength={50}
          returnKeyType="next"
        />
        <TextField
          label="Username"
          prefix="@"
          value={username}
          onChangeText={(t) => setUsername(normalizeUsername(t))}
          placeholder="username"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username-new"
          textContentType="username"
          maxLength={21}
          status={usernameField}
        />
        <BirthdateField
          value={birthdate}
          onChange={setBirthdate}
          status={
            underage
              ? { tone: 'error', text: 'yard is for people 18 and older, so we can’t set up an account for you yet. Thanks for understanding.' }
              : null
          }
        />
      </View>
    </Scaffold>
  );
}
