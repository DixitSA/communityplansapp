import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ART_PALETTES, DEFAULT_PALETTE } from '../artPalettes';
import { Icon, type SymbolName } from './Icon';
import { MeshBackground } from './MeshBackground';

/** Tiny seeded PRNG so the same event id always yields the same art. */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Builds a 3x3 mesh (9 colors + 9 points) from a seed and palette. Pure. */
export function buildMesh(id: string, palette: string[]) {
  const rand = seededRandom(id);
  const jitter = (amount: number) => (rand() - 0.5) * 2 * amount;
  const points: [number, number][] = [
    [0, 0],
    [0.5 + jitter(0.15), 0],
    [1, 0],
    [0, 0.5 + jitter(0.15)],
    [0.5 + jitter(0.15), 0.5 + jitter(0.15)],
    [1, 0.5 + jitter(0.15)],
    [0, 1],
    [0.5 + jitter(0.15), 1],
    [1, 1],
  ];
  const colors = points.map(() => palette[Math.floor(rand() * palette.length)]);
  return { points, colors };
}

export type MeshArtProps = {
  id: string;
  /** Interest slug, picks the palette. */
  interest?: string;
  symbol?: SymbolName;
  /** Size of the big background symbol. */
  symbolSize?: number;
  style?: StyleProp<ViewStyle>;
};

export function MeshArt({ id, interest, symbol, symbolSize = 120, style }: MeshArtProps) {
  const palette = (interest && ART_PALETTES[interest]) || DEFAULT_PALETTE;
  const { points, colors } = buildMesh(id, palette);

  return (
    <View
      style={[styles.fill, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <MeshBackground colors={colors} points={points} />
      {symbol ? (
        <Icon
          name={symbol}
          size={symbolSize}
          tintColor="rgba(255, 255, 255, 0.35)"
          weight="light"
          style={styles.symbol}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, overflow: 'hidden' },
  // Offset in percent so it scales with the art and stays clear of the category tag (bottom-right).
  symbol: { position: 'absolute', right: '15%', bottom: '15%' },
});
