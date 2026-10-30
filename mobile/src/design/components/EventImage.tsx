import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { create } from 'zustand';

import { useTheme } from '../theme';
import { AppText } from './AppText';
import { Icon } from './Icon';

/** Strong enough that nothing in a flagged image is recognizable, even on the full-width hero. */
export const SENSITIVE_BLUR_RADIUS = 40;

type RevealedState = {
  revealed: Record<string, true>;
  reveal: (eventId: string) => void;
};

// Zustand store (shared UI state): once you tap to view a flagged image on the event page, the
// feed cards show it too. It lives in memory only, so images blur again after the app restarts.
export const useRevealedImages = create<RevealedState>()((set) => ({
  revealed: {},
  reveal: (eventId) => set((s) => ({ revealed: { ...s.revealed, [eventId]: true } })),
}));

/** Blurred until revealed, but only when the event's image is flagged. */
export function useImageHidden(eventId: string, sensitive: boolean | undefined): boolean {
  const revealed = useRevealedImages((s) => s.revealed[eventId] === true);
  return sensitive === true && !revealed;
}

export type EventImageProps = {
  eventId: string;
  /** A URL, or a bundled image (`require(...)`). */
  source: string | number;
  /** The event's image is flagged as sensitive: show it blurred until the viewer reveals it. */
  sensitive?: boolean;
  /**
   * What sits on a hidden image: `label` ("Sensitive image · Tap to view", the event page, which owns the tap),
   * `badge` (a small eye-slash, cards), or `none` (tiny thumbnails).
   */
  overlay?: 'label' | 'badge' | 'none';
};

/** An event's photo or flyer. Flagged images render blurred with a marker; it never handles taps itself. */
export function EventImage({ eventId, source, sensitive, overlay = 'badge' }: EventImageProps) {
  const { space, radius, colors } = useTheme();
  const hidden = useImageHidden(eventId, sensitive);

  return (
    <View style={{ flex: 1 }}>
      <Image
        source={source}
        contentFit="cover"
        style={{ flex: 1 }}
        blurRadius={hidden ? SENSITIVE_BLUR_RADIUS : 0}
        accessibilityIgnoresInvertColors
      />
      {hidden && overlay !== 'none' ? (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}
          // Decoration only: the card, or the event page's tap target, carries the spoken label.
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.sm,
              paddingHorizontal: overlay === 'label' ? space.lg : space.sm,
              paddingVertical: space.sm,
              borderRadius: radius.pill,
              borderCurve: 'continuous',
              backgroundColor: 'rgba(0,0,0,0.45)',
            }}
          >
            <Icon name="eye.slash" size={overlay === 'label' ? 17 : 15} color="onImage" />
            {overlay === 'label' ? (
              <AppText variant="subheadline" style={{ color: colors.onImage, fontWeight: '600' }}>
                Sensitive image · Tap to view
              </AppText>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}
