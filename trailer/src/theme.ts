/** yard's palette (mobile/src/design/tokens.ts, light). */
export const colors = {
  canvas: '#F6F3EC',
  surface: '#FFFFFF',
  ink: '#16201A',
  inkSecondary: '#5E665F',
  accent: '#2E5B45',
  accentSoft: '#DCE9E0',
  peach: '#F3BC9F',
  mint: '#5E9C86',
  deep: '#352C48',
  hot: '#C2410C',
  night: '#101411',
};

export const font = 'Inter, system-ui, sans-serif';

export const WIDTH = 1080;
export const HEIGHT = 1920;
export const FPS = 30;

/** Scene lengths in frames (30 fps). */
export const SCENES = {
  hook: 75,
  montage: 105,
  feed: 150,
  friends: 150,
  going: 135,
  chat: 105,
  privacy: 105,
  end: 165,
} as const;

export const TOTAL_FRAMES = Object.values(SCENES).reduce((a, b) => a + b, 0);
