import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, GlassSurface, useTheme } from '@/design';
import { useFiltersStore } from '@/features/feed/filtersStore';
import { startOfDay } from '@/lib/dates';

export type EndedBarProps = {
  /** Set when the viewer was Going: the (read-only) chat stays reachable. */
  onOpenChat?: () => void;
  onLayoutHeight?: (height: number) => void;
};

/** Replaces the RSVP bar once an event is over: a calm line and a way back to what's on. */
export function EndedBar({ onOpenChat, onLayoutHeight }: EndedBarProps) {
  const { space } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const seeTonight = () => {
    useFiltersStore.getState().setSelectedDay(startOfDay(new Date()));
    router.navigate('/');
  };

  return (
    <View style={styles.pinned} onLayout={(e) => onLayoutHeight?.(e.nativeEvent.layout.height)}>
      <GlassSurface
        style={{
          paddingHorizontal: space.lg,
          paddingTop: space.md,
          paddingBottom: Math.max(insets.bottom, space.md),
          gap: space.sm,
        }}
      >
        <AppText variant="subheadline" color="inkSecondary" style={{ textAlign: 'center' }} accessibilityRole="text">
          that one’s over
        </AppText>
        <Button
          variant="primary"
          label="see what's on tonight"
          accessibilityLabel="see what's on tonight"
          onPress={seeTonight}
        />
        {onOpenChat ? (
          <Button symbol="message" label="Open chat" accessibilityLabel="Open chat, read only" onPress={onOpenChat} />
        ) : null}
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  pinned: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
