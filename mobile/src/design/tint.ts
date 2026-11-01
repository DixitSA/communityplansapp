import type { Scheme } from './tokens';

const HEX = /^#[0-9a-f]{6}$/i;

function channels(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** `a` blended over `b`: `amount` 0 gives `b`, 1 gives `a`. Both "#rrggbb". */
export function mixHex(a: string, b: string, amount: number): string {
  const [ar, ag, ab] = channels(a);
  const [br, bg, bb] = channels(b);
  const t = Math.min(1, Math.max(0, amount));
  const mix = (x: number, y: number) => Math.round(y + (x - y) * t).toString(16).padStart(2, '0');
  return `#${mix(ar, br)}${mix(ag, bg)}${mix(ab, bb)}`;
}

/** How much of the flyer's color goes into the page. Low enough that ink and cards keep their contrast. */
const TINT_AMOUNT: Record<Scheme, number> = { light: 0.12, dark: 0.16 };

/**
 * The event page's background: the canvas with a soft wash of the flyer's color (Apple Invites style).
 * Falls back to the plain canvas without a valid color.
 */
export function tintedCanvas(imageColor: string | undefined, canvas: string, scheme: Scheme): string {
  if (!imageColor || !HEX.test(imageColor) || !HEX.test(canvas)) return canvas;
  return mixHex(imageColor, canvas, TINT_AMOUNT[scheme]);
}
