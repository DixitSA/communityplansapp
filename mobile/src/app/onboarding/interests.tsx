import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { AppText, Button, EmptyState, InterestTile, PrimaryButton, Skeleton, asSymbol, useTheme } from '@/design';
import { useOnboardingDraft } from '@/features/onboarding/draftStore';
import { Scaffold } from '@/features/onboarding/Scaffold';
import { api, type Interest } from '@/lib/api';
import { MIN_INTERESTS, interestsContinueLabel, interestsRemaining } from '@/lib/validation';

/** Rows of two. */
function pairs<T>(items: T[]): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return rows;
}

export default function InterestsScreen() {
  const { space, radius } = useTheme();
  const router = useRouter();
  const selected = useOnboardingDraft((s) => s.interestIds);
  const toggleInterest = useOnboardingDraft((s) => s.toggleInterest);
  const interests = useQuery({ queryKey: ['interests'], queryFn: () => api.listInterests(), staleTime: Infinity });

  const remaining = interestsRemaining(selected.length);

  return (
    <Scaffold
      back
      step={2}
      title="What are you into?"
      subtitle={`Pick ${MIN_INTERESTS} or more. We’ll use them to put the right events first.`}
      footer={
        <PrimaryButton
          label={interestsContinueLabel(selected.length)}
          disabled={remaining > 0}
          onPress={() => router.push('/onboarding/location')}
        />
      }
    >
      {interests.isPending ? (
        <View style={{ gap: space.md }} accessibilityLabel="Loading interests">
          {[0, 1, 2, 3].map((row) => (
            <View key={row} style={{ flexDirection: 'row', gap: space.md }}>
              <Skeleton height={108} radius={radius.card} style={{ flex: 1, width: undefined }} />
              <Skeleton height={108} radius={radius.card} style={{ flex: 1, width: undefined }} />
            </View>
          ))}
        </View>
      ) : interests.isError ? (
        <EmptyState symbol="exclamationmark.circle.fill" title="Couldn’t load interests" message="Check your connection and try again.">
          <View style={{ alignSelf: 'stretch', paddingTop: space.md }}>
            <Button label="Try again" onPress={() => interests.refetch()} />
          </View>
        </EmptyState>
      ) : (
        <View style={{ gap: space.md }}>
          {pairs<Interest>(interests.data).map((row) => (
            <View key={row[0].id} style={{ flexDirection: 'row', gap: space.md }}>
              {row.map((i) => (
                <InterestTile
                  key={i.id}
                  label={i.label}
                  symbol={asSymbol(i.symbol)}
                  slug={i.slug}
                  selected={selected.includes(i.id)}
                  onPress={() => toggleInterest(i.id)}
                />
              ))}
              {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
            </View>
          ))}
          <AppText variant="footnote" color="inkSecondary" accessibilityLiveRegion="polite" style={{ textAlign: 'center' }}>
            {selected.length} picked
          </AppText>
        </View>
      )}
    </Scaffold>
  );
}
