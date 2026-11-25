/** yard's palette (mobile/src/design/tokens.ts, light). */
export const colors = {
  canvas: '#F6F3EC',
  surface: '#FFFFFF',
  ink: '#16201A',
  inkSecondary: '#5E665F',
  accent: '#2E5B45',
  accentSoft: '#DCE9E0',
  peach: '#F3BC9F',
  hot: '#C2410C',
  night: '#101411',
};

/** A generic iOS-style messages look (not Apple's assets). */
export const imsg = {
  bg: '#FFFFFF',
  sent: '#1D8CFF',
  received: '#E9E9EB',
  meta: '#8E8E93',
};

export const font = 'Inter, system-ui, sans-serif';

export const WIDTH = 1080;
export const HEIGHT = 1920;
export const FPS = 30;

/** 120 BPM: one beat is 15 frames, one bar is 60. Scenes cut on the music (scripts/make_audio.py). */
export const BEAT = 15;
export const BAR = 60;

export const SCENES = {
  texts: 4 * BAR, // bars 1-4: the group chat, quiet intro
  feed: 2 * BAR, // drop on "say less"
  event: 2 * BAR,
  going: 1.5 * BAR,
  chat: 1.5 * BAR,
  callback: 1 * BAR, // filtered bar: back in the texts
  end: 4.25 * BAR, // last bar of beat, then the pad tail
} as const;

export const TOTAL_FRAMES = Object.values(SCENES).reduce((a, b) => a + b, 0);

/** App screens are 393 pt wide captures at 2x; full-bleed they're 1080 px wide. */
export const PT = WIDTH / 393;
export const STATUS_BAR = Math.round(54 * PT);
