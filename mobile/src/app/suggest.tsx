import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { AppText, Icon, PrimaryButton, TextField, useTheme, type FieldStatus } from '@/design';
import { DateTimeField } from '@/features/submit/DateTimeField';
import { useSubmitEvent } from '@/features/submit/useSubmitEvent';
import { useMyProfile } from '@/features/profile/useMyProfile';
import { CHARLOTTE_CITY_ID, errorCode } from '@/lib/api';
import { success, warning } from '@/lib/haptics';
import {
  DETAILS_MAX,
  LINK_MAX,
  TITLE_MAX,
  VENUE_MAX,
  normalizeLink,
  validateSubmission,
  type SubmissionField,
} from '@/lib/submission';

/** Show a character counter once the text gets this close to the limit. */
const COUNTER_FROM = 0.8;
const SUCCESS_BADGE = 64;
const SUCCESS_ICON = 28;

const err = (text?: string): FieldStatus | null => (text ? { tone: 'error', text } : null);

/** "Suggest an event" sheet: someone saw an event elsewhere and sends it to us for review. */
export default function SuggestSheet() {
  const { colors, space, radius } = useTheme();
  const router = useRouter();
  const profile = useMyProfile();
  const { submit, isPending, isSuccess, errorCode: serverCode, errorMessage, reset } = useSubmitEvent();

  const [title, setTitle] = useState('');
  const [link, setLink] = useState('');
  const [startsAt, setStartsAt] = useState<Date | null>(null);
  const [venue, setVenue] = useState('');
  const [details, setDetails] = useState('');
  const [touched, setTouched] = useState<Partial<Record<SubmissionField, boolean>>>({});
  const touch = (f: SubmissionField) => setTouched((t) => ({ ...t, [f]: true }));

  const draft = { title, link, startsAt, venue, details };
  const problems = validateSubmission(draft);
  const valid = Object.keys(problems).length === 0;
  // A field complains once it was visited (title, link) or has something in it (the rest).
  const shown = (f: SubmissionField, hasText: boolean) => (touched[f] || hasText ? problems[f] : undefined);
  const cityId = profile.data?.homeCityId ?? CHARLOTTE_CITY_ID;

  const send = async () => {
    if (!valid || isPending) return;
    try {
      await submit({
        cityId,
        title: title.trim(),
        link: normalizeLink(link),
        startsAt: startsAt as Date,
        venue: venue.trim(),
        details: details.trim(),
      });
      success();
    } catch (e) {
      warning();
      // Fix the field the server complained about, when we have one.
      const field = FIELD_FOR_CODE[errorCode(e)];
      if (field) touch(field);
    }
  };

  const counter = (value: string, max: number): FieldStatus | null => {
    // Count what will be sent: the server trims, so trailing spaces shouldn't push the counter red.
    const n = value.trim().length;
    return n >= max * COUNTER_FROM ? { tone: n > max ? 'error' : 'neutral', text: `${n}/${max}` } : null;
  };

  const header = (
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
      <AppText variant="title2" accessibilityRole="header">
        Suggest an event
      </AppText>
      {isSuccess ? null : (
        <Pressable accessibilityRole="button" accessibilityLabel="Cancel" hitSlop={space.sm} onPress={() => router.back()}>
          <AppText variant="body" color="accent" style={{ fontWeight: '600' }}>
            Cancel
          </AppText>
        </Pressable>
      )}
    </View>
  );

  if (isSuccess) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.canvas }}>
        {header}
        <View style={{ paddingHorizontal: space.lg, paddingTop: space.xl, gap: space.xl, alignItems: 'center' }}>
          <View
            style={{
              width: SUCCESS_BADGE,
              height: SUCCESS_BADGE,
              borderRadius: radius.pill,
              backgroundColor: colors.accentSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="checkmark" size={SUCCESS_ICON} color="accent" weight="semibold" />
          </View>
          <AppText
            variant="body"
            style={{ textAlign: 'center' }}
            accessibilityLiveRegion="polite"
          >
            Thanks, we’ll take a look. If it’s a fit, it’ll show up in the feed.
          </AppText>
          <View style={{ alignSelf: 'stretch' }}>
            <PrimaryButton label="Done" onPress={() => router.back()} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      {header}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxxl, gap: space.lg }}
      >
        <TextField
          label="Title"
          value={title}
          placeholder="What’s happening?"
          autoCapitalize="sentences"
          returnKeyType="next"
          onChangeText={(t) => {
            setTitle(t);
            reset();
          }}
          onBlur={() => touch('title')}
          status={err(shown('title', false)) ?? counter(title, TITLE_MAX)}
        />
        <TextField
          label="Link"
          value={link}
          placeholder="Instagram, Eventbrite, or any page about it"
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="URL"
          returnKeyType="next"
          onChangeText={(t) => {
            setLink(t);
            reset();
          }}
          onBlur={() => {
            touch('link');
            // Show the https:// we will send, so nothing changes silently.
            setLink((l) => normalizeLink(l));
          }}
          status={err(shown('link', false)) ?? counter(link, LINK_MAX)}
        />
        <DateTimeField
          label="Date & time"
          value={startsAt}
          onChange={(d) => {
            setStartsAt(d);
            touch('startsAt');
            reset();
          }}
          status={err(shown('startsAt', false))}
        />
        <TextField
          label="Venue (optional)"
          value={venue}
          placeholder="Where is it?"
          returnKeyType="next"
          onChangeText={(t) => {
            setVenue(t);
            reset();
          }}
          status={err(shown('venue', true)) ?? counter(venue, VENUE_MAX)}
        />
        <TextField
          label="Details (optional)"
          value={details}
          placeholder="Anything else worth knowing"
          multiline
          textAlignVertical="top"
          onChangeText={(t) => {
            setDetails(t);
            reset();
          }}
          status={err(shown('details', true)) ?? counter(details, DETAILS_MAX)}
        />
        {errorMessage && serverCode ? (
          <View style={{ gap: space.xs }}>
            <AppText variant="footnote" color="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">
              {errorMessage}
            </AppText>
          </View>
        ) : null}
        <PrimaryButton
          label={isPending ? 'Sending…' : 'Send suggestion'}
          accessibilityLabel={isPending ? 'Sending your suggestion' : 'Send suggestion'}
          disabled={!valid || isPending}
          onPress={send}
        />
      </ScrollView>
    </View>
  );
}

/** Which field to flag when the server rejects it. */
const FIELD_FOR_CODE: Record<string, SubmissionField | undefined> = {
  title_invalid: 'title',
  link_invalid: 'link',
  starts_at_invalid: 'startsAt',
  venue_invalid: 'venue',
  details_invalid: 'details',
};
