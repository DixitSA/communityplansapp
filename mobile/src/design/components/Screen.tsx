import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme';

/** Scrolling page with the canvas background, safe-area top padding and 16pt gutters. */
export function Screen({
  children,
  gutter = true,
  nativeHeader = false,
}: {
  children: ReactNode;
  gutter?: boolean;
  /** A native navigation bar (large title) sits above: let iOS inset the content instead of padding the top by hand. */
  nativeHeader?: boolean;
}) {
  const { colors, space } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      contentContainerStyle={{
        paddingTop: nativeHeader ? space.sm : insets.top + space.lg,
        paddingBottom: space.xxxl * 3,
        paddingHorizontal: gutter ? space.lg : 0,
      }}
      contentInsetAdjustmentBehavior={nativeHeader ? 'automatic' : 'never'}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}
