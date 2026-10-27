import { View } from 'react-native';

import { useTheme } from '../theme';
import { AppText } from './AppText';
import { Icon, type SymbolName } from './Icon';

export type EmptyStateProps = { symbol: SymbolName; title: string; message: string };

export function EmptyState({ symbol, title, message }: EmptyStateProps) {
  const { colors, space, radius } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.xxxl, paddingHorizontal: space.xl }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: radius.pill,
          borderCurve: 'continuous',
          backgroundColor: colors.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: space.sm,
        }}
      >
        <Icon name={symbol} size={28} color="accent" />
      </View>
      <AppText variant="headline" style={{ textAlign: 'center' }}>
        {title}
      </AppText>
      <AppText variant="subheadline" color="inkSecondary" style={{ textAlign: 'center' }}>
        {message}
      </AppText>
    </View>
  );
}
