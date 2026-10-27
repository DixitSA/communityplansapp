import { StyleSheet, View } from 'react-native';

import { gradientBackground } from './meshFallback';
import type { MeshBackgroundProps } from './MeshBackground';

// expo-mesh-gradient has no web support (importing it crashes), so web gets a plain gradient.
export function MeshBackground({ colors }: MeshBackgroundProps) {
  return <View style={[StyleSheet.absoluteFill, gradientBackground(colors)]} />;
}
