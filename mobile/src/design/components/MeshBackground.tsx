import { MeshGradientView } from 'expo-mesh-gradient';
import { Platform, StyleSheet, View } from 'react-native';

import { gradientBackground } from './meshFallback';

export type MeshBackgroundProps = { colors: string[]; points: [number, number][] };

/** iOS: a real mesh gradient. Android: plain gradient. (Web uses MeshBackground.web.tsx.) */
export function MeshBackground({ colors, points }: MeshBackgroundProps) {
  if (Platform.OS === 'ios') {
    return (
      <MeshGradientView
        style={StyleSheet.absoluteFill}
        columns={3}
        rows={3}
        colors={colors}
        points={points}
        smoothsColors
      />
    );
  }
  return <View style={[StyleSheet.absoluteFill, gradientBackground(colors)]} />;
}
