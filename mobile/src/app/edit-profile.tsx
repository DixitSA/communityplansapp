import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, View } from 'react-native';

import { AppText, Avatar, Button, EmptyState, InterestTile, Skeleton, TextField, asSymbol, useTheme, type FieldStatus } from '@/design';
import { useUsernameAvailability } from '@/features/onboarding/useUsernameAvailability';
import { BIO_MAX, draftFromProfile, isChanged, isDraftValid, toInput, type EditProfileDraft } from '@/features/profile/editProfile';
import { pickProfilePhoto, useMyAvatar } from '@/features/profile/useMyAvatar';
import { useMyProfile } from '@/features/profile/useMyProfile';
import { useUpdateMyProfile } from '@/features/profile/useUpdateMyProfile';
import { api, errorCode, mapEditProfileError, type Interest, type MyProfile } from '@/lib/api';
import { light, selection, success, warning } from '@/lib/haptics';
import { MIN_INTERESTS, normalizeUsername } from '@/lib/validation';

/** Rows of two. */
function pairs<T>(items: T[]): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return rows;
}

/** Show the bio counter once the text gets this close to the limit. */
const COUNTER_FROM = 0.8;

const AVATAR_SIZE = 96;

/** "Edit profile" sheet: name, username, bio and interests. Cancel / Save sit in the header. */
export default function EditProfileSheet() {
  const { colors, space } = useTheme();
  const profile = useMyProfile();

  const header = (onSave?: { enabled: boolean; saving: boolean; press: () => void }) => (
    <SheetHeader onSave={onSave} />
  );

  if (profile.isPending) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.canvas }}>
        {header()}
        <View style={{ padding: space.lg, gap: space.lg }} accessibilityLabel="Loading your profile">
          <Skeleton height={56} />
          <Skeleton height={56} />
          <Skeleton height={96} />
        </View>
      </View>
    );
  }

  if (profile.isError || !profile.data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.canvas }}>
        {header()}
        <EmptyState symbol="exclamationmark.circle.fill" title="Couldn’t load your profile" message="Check your connection and try again.">
          <View style={{ alignSelf: 'stretch', paddingTop: space.md }}>
            <Button label="Try again" onPress={() => profile.refetch()} />
          </View>
        </EmptyState>
      </View>
    );
  }

  return <EditForm me={profile.data} />;
}

function SheetHeader({ onSave }: { onSave?: { enabled: boolean; saving: boolean; press: () => void } }) {
  const { space } = useTheme();
  const router = useRouter();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: space.lg,
        paddingTop: space.xl,
        paddingBottom: space.md,
      }}
    >
      <Pressable accessibilityRole="button" accessibilityLabel="Cancel" hitSlop={space.md} onPress={() => router.back()}>
        <AppText variant="body" color="accent">
          Cancel
        </AppText>
      </Pressable>
      <AppText variant="headline" accessibilityRole="header">
        Edit profile
      </AppText>
      {onSave ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={onSave.saving ? 'Saving your profile' : 'Save'}
          accessibilityState={{ disabled: !onSave.enabled }}
          disabled={!onSave.enabled}
          hitSlop={space.md}
          onPress={onSave.press}
        >
          <AppText variant="body" color={onSave.enabled ? 'accent' : 'inkSecondary'} style={{ fontWeight: '600' }}>
            {onSave.saving ? 'Saving…' : 'Save'}
          </AppText>
        </Pressable>
      ) : (
        <View />
      )}
    </View>
  );
}

function EditForm({ me }: { me: MyProfile }) {
  const { colors, space, radius } = useTheme();
  const router = useRouter();
  const [draft, setDraft] = useState<EditProfileDraft>(() => draftFromProfile(me));
  const update = useUpdateMyProfile();
  const avatar = useMyAvatar();
  const interests = useQuery({ queryKey: ['interests'], queryFn: () => api.listInterests(), staleTime: Infinity });

  const set = (patch: Partial<EditProfileDraft>) => {
    update.reset();
    setDraft((d) => ({ ...d, ...patch }));
  };

  // The username you already have is never "taken"; only check a new one.
  const usernameStatus = useUsernameAvailability(draft.username);
  const keepingUsername = draft.username === me.username;
  let usernameField: FieldStatus;
  if (keepingUsername) {
    usernameField = { tone: 'neutral', text: 'this is how friends find you' };
  } else {
    switch (usernameStatus.kind) {
      case 'invalid':
        usernameField = { tone: 'error', text: usernameStatus.message };
        break;
      case 'checking':
        usernameField = { tone: 'checking', text: 'Checking…' };
        break;
      case 'available':
        usernameField = { tone: 'success', text: `@${draft.username} is available` };
        break;
      case 'taken':
        usernameField = { tone: 'error', text: `@${draft.username} is taken. Try another.` };
        break;
      case 'error':
        usernameField = { tone: 'error', text: 'Couldn’t check that right now. Check your connection.' };
        break;
      default:
        usernameField = { tone: 'neutral', text: 'this is how friends find you' };
    }
  }

  const bioLength = draft.bio.trim().length;
  const bioStatus: FieldStatus | null =
    bioLength >= BIO_MAX * COUNTER_FROM ? { tone: bioLength > BIO_MAX ? 'error' : 'neutral', text: `${bioLength}/${BIO_MAX}` } : null;

  const usernameOk = keepingUsername || usernameStatus.kind === 'available';
  const canSave = isDraftValid(draft) && usernameOk && isChanged(draft, me) && !update.isPending;

  const save = async () => {
    if (!canSave) return;
    try {
      await update.mutateAsync(toInput(draft));
      success();
      router.back();
    } catch {
      warning();
    }
  };

  // Photo changes save straight away (they don't wait for the Save button).
  const choosePhoto = async () => {
    avatar.reset();
    try {
      const uri = await pickProfilePhoto();
      if (!uri) return;
      await avatar.change(uri);
      success();
    } catch {
      warning();
    }
  };
  const removePhoto = async () => {
    light();
    try {
      await avatar.remove();
    } catch {
      warning();
    }
  };

  const toggleInterest = (id: number) => {
    selection();
    set({ interestIds: draft.interestIds.includes(id) ? draft.interestIds.filter((x) => x !== id) : [...draft.interestIds, id] });
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.canvas }}>
      <SheetHeader onSave={{ enabled: canSave, saving: update.isPending, press: save }} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxxl, gap: space.xl }}
      >
        <View style={{ alignItems: 'center', gap: space.sm }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
            disabled={avatar.isPending}
            onPress={choosePhoto}
            style={{ opacity: avatar.isPending ? 0.5 : 1 }}
          >
            <Avatar name={me.displayName} uri={me.avatarUrl} size={AVATAR_SIZE} />
          </Pressable>
          <View style={{ flexDirection: 'row', gap: space.xl }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={me.avatarUrl ? 'Change profile photo' : 'Add a profile photo'}
              disabled={avatar.isPending}
              hitSlop={space.md}
              onPress={choosePhoto}
            >
              <AppText variant="body" color="accent">
                {avatar.isPending ? 'Saving…' : me.avatarUrl ? 'Choose photo' : 'Add a pic'}
              </AppText>
            </Pressable>
            {me.avatarUrl ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove profile photo"
                disabled={avatar.isPending}
                hitSlop={space.md}
                onPress={removePhoto}
              >
                <AppText variant="body" color="danger">
                  Remove photo
                </AppText>
              </Pressable>
            ) : null}
          </View>
          {avatar.isError ? (
            <AppText variant="footnote" color="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">
              Couldn’t update your photo. Try again.
            </AppText>
          ) : null}
        </View>
        <TextField
          label="Name"
          value={draft.displayName}
          onChangeText={(t) => set({ displayName: t })}
          placeholder="your name"
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          maxLength={50}
          returnKeyType="next"
        />
        <TextField
          label="Username"
          prefix="@"
          value={draft.username}
          onChangeText={(t) => set({ username: normalizeUsername(t) })}
          placeholder="username"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="username"
          maxLength={21}
          status={usernameField}
        />
        <TextField
          label="Bio"
          value={draft.bio}
          onChangeText={(t) => set({ bio: t })}
          placeholder="say something about you"
          multiline
          textAlignVertical="top"
          autoCapitalize="sentences"
          status={bioStatus}
        />

        <View style={{ gap: space.md }}>
          <AppText variant="overline" color="inkSecondary" accessibilityRole="header">
            Interests
          </AppText>
          <AppText variant="footnote" color="inkSecondary">
            {`pick at least ${MIN_INTERESTS}. we use them to put the right events first.`}
          </AppText>
          {interests.isPending ? (
            <View style={{ gap: space.md }} accessibilityLabel="Loading interests">
              {[0, 1].map((row) => (
                <View key={row} style={{ flexDirection: 'row', gap: space.md }}>
                  <Skeleton height={108} radius={radius.card} style={{ flex: 1, width: undefined }} />
                  <Skeleton height={108} radius={radius.card} style={{ flex: 1, width: undefined }} />
                </View>
              ))}
            </View>
          ) : interests.isError ? (
            <Button label="Couldn’t load interests. Try again" onPress={() => interests.refetch()} />
          ) : (
            pairs<Interest>(interests.data).map((row) => (
              <View key={row[0].id} style={{ flexDirection: 'row', gap: space.md }}>
                {row.map((i) => (
                  <InterestTile
                    key={i.id}
                    label={i.label}
                    symbol={asSymbol(i.symbol)}
                    slug={i.slug}
                    selected={draft.interestIds.includes(i.id)}
                    onPress={() => toggleInterest(i.id)}
                  />
                ))}
                {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
              </View>
            ))
          )}
          <AppText variant="footnote" color="inkSecondary" accessibilityLiveRegion="polite" style={{ textAlign: 'center' }}>
            {draft.interestIds.length} picked
          </AppText>
        </View>

        {update.isError ? (
          <AppText variant="footnote" color="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">
            {mapEditProfileError(errorCode(update.error))}
          </AppText>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
