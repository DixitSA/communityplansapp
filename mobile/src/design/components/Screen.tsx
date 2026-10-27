import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme';

/** Scrolling page with the canvas background, safe-area top padding and 16pt gutters. */
export function Screen({ children, gutter = true }: { children: ReactNode; gutter?: boolean }) {
  const { colors, space } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      contentContainerStyle={{
        paddingTop: insets.top + space.lg,
        paddingBottom: space.xxxl * 3,
        paddingHorizontal: gutter ? space.lg : 0,
      }}
      contentInsetAdjustmentBehavior="never"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}
