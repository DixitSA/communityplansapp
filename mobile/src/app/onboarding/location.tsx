import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText, Button, Icon, MeshArt, PrimaryButton, useTheme, type SymbolName } from '@/design';
import { useOnboardingDraft } from '@/features/onboarding/draftStore';
import { requestLocationPermission } from '@/features/onboarding/location';
import { Scaffold } from '@/features/onboarding/Scaffold';
import { CHARLOTTE_CITY_ID } from '@/lib/api';

function Point({ symbol, text }: { symbol: SymbolName; text: string }) {
  const { space } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <Icon name={symbol} size={20} color="accent" />
      <AppText variant="subheadline" color="inkSecondary" style={{ flex: 1 }}>
        {text}
      </AppText>
    </View>
  );
}

export default function LocationScreen() {
  const { space, radius } = useTheme();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const next = () => {
    // Both choices put the feed in Charlotte for now; it is the only city.
    useOnboardingDraft.getState().setHomeCityId(CHARLOTTE_CITY_ID);
    router.push('/onboarding/friends');
  };

  const useMyLocation = async () => {
    setBusy(true);
    // Granted or not, we continue: without permission the feed still works, just without distances.
    await requestLocationPermission();
    setBusy(false);
    next();
  };

  return (
    <Scaffold
      back
      step={3}
      title="See what’s near you"
      subtitle="Share your location to see how far events are. Or skip it and just browse Charlotte."
      footer={
        <>
          <PrimaryButton label={busy ? 'Asking…' : 'Use my location'} disabled={busy} onPress={useMyLocation} />
          <Button label="Just Charlotte" onPress={next} />
        </>
      }
    >
      <View
        style={{ height: 168, borderRadius: radius.hero, borderCurve: 'continuous', overflow: 'hidden' }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <MeshArt id="onboarding-location" interest="fitness" symbol="location.fill" symbolSize={96} />
      </View>
      <View style={{ gap: space.md }}>
        <Point symbol="lock.shield.fill" text="Your location stays on your phone. It’s only used to work out distances." />
        <Point symbol="mappin" text="We never store it or send it to our servers." />
        <Point symbol="checkmark.circle" text="You can change this any time in Settings." />
      </View>
    </Scaffold>
  );
}
