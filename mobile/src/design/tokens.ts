import type { TextStyle } from 'react-native';

export type Scheme = 'light' | 'dark';

/** DESIGN.md §3 color table. */
export const lightColors = {
  canvas: '#F6F3EC',
  surface: '#FFFFFF',
  surfaceMuted: '#ECE8DF',
  ink: '#16201A',
  inkSecondary: '#5E665F',
  line: '#E4E0D6',
  accent: '#2E5B45',
  accentSoft: '#DCE9E0',
  /** Errors and destructive actions. 5.4:1 on canvas. */
  danger: '#B3382C',
  peach: '#F3BC9F',
  peachSoft: '#FFF1E9',
  mint: '#5E9C86',
  mintSoft: '#D9EAE3',
  deep: '#352C48',
  onAccent: '#FFFFFF',
  onImage: '#FFFFFF',
} as const;

export type Colors = { [K in keyof typeof lightColors]: string };
export type ColorToken = keyof Colors;

export const darkColors: Colors = {
  canvas: '#101411',
  surface: '#1A1F1B',
  surfaceMuted: '#232A25',
  ink: '#EEF2EE',
  inkSecondary: '#A3ADA5',
  line: '#2C342E',
  accent: '#7FC3A0',
  accentSoft: '#1F3328',
  danger: '#F08A7E',
  peach: '#E9A784',
  peachSoft: '#3A2A22',
  mint: '#7CC3A8',
  mintSoft: '#1E3029',
  deep: '#E8E1F5',
  onAccent: '#101411',
  onImage: '#FFFFFF',
};

/**
 * Category colors: `solid` for pins and glyphs, `soft` for tag backgrounds (ink text on soft is >= 4.5:1).
 * Keyed by interest slug.
 */
export const categoryColors = {
  music: { solid: '#D9722A', soft: { light: '#FDE7D6', dark: '#3A2A1E' } },
  food_drinks: { solid: '#8E6FD1', soft: { light: '#ECE5FA', dark: '#2D2840' } },
  fitness: { solid: '#3F8F5F', soft: { light: '#DDF0E3', dark: '#1F3328' } },
  arts_culture: { solid: '#B87A30', soft: { light: '#FBEBD6', dark: '#3A2E1E' } },
  nightlife: { solid: '#C9567A', soft: { light: '#FBE1EA', dark: '#3A2230' } },
} as const;

/**
 * Solid tile colors for every seeded interest (white glyphs on these are >= 3:1). The five
 * categories reuse their pin colors; the rest extend the same family.
 */
export const interestColors: Record<string, string> = {
  nightlife: categoryColors.nightlife.solid,
  music: categoryColors.music.solid,
  food_drinks: categoryColors.food_drinks.solid,
  fitness: categoryColors.fitness.solid,
  arts_culture: categoryColors.arts_culture.solid,
  sports: '#2F7DA8',
  wellness: '#3C8C7E',
  outdoor: '#6E8F2E',
  community: '#5B6FC4',
  tech: '#4F6D7A',
  fashion: '#B05A9C',
  comedy: '#B07A12',
};

export type CategorySlug = keyof typeof categoryColors;

export function isCategory(slug: string | undefined): slug is CategorySlug {
  return slug !== undefined && slug in categoryColors;
}

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  thumb: 12,
  card: 16,
  sheet: 22,
  hero: 28,
  pill: 999,
} as const;

export const type = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700', letterSpacing: -0.4 },
  /** The yard. wordmark on the welcome screen. */
  display: { fontSize: 56, lineHeight: 60, fontWeight: '800', letterSpacing: -2 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.4 },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.4 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400' },
  subheadline: { fontSize: 15, lineHeight: 20, fontWeight: '400' },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  overline: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
} as const satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;

/** The one soft card shadow. Light mode only (DESIGN.md §3). */
export const cardShadow: Record<Scheme, { boxShadow?: string }> = {
  light: { boxShadow: '0 4px 14px rgba(29, 27, 34, 0.08)' },
  dark: {},
};
