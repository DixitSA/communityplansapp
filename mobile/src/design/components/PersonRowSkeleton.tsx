import { View } from 'react-native';

import { useTheme } from '../theme';
import { PERSON_ROW_AVATAR, PERSON_ROW_MIN_HEIGHT } from './PersonRow';
import { Skeleton } from './Skeleton';

/** Placeholder rows shaped like `PersonRow`, for Search and Friends while they load. */
export function PersonRowSkeleton({ count = 4 }: { count?: number }) {
  const { space, type } = useTheme();
  return (
    <View accessibilityLabel="Loading people" style={{ gap: space.md }}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: PERSON_ROW_MIN_HEIGHT }}>
          <Skeleton width={PERSON_ROW_AVATAR} height={PERSON_ROW_AVATAR} radius={PERSON_ROW_AVATAR / 2} />
          <View style={{ flex: 1, gap: space.sm }}>
            <Skeleton width="45%" height={type.headline.lineHeight} />
            <Skeleton width="30%" height={type.footnote.lineHeight} />
          </View>
        </View>
      ))}
    </View>
  );
}
