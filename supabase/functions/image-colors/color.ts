// Picks one color to tint an event page with: the flyer's most prominent vivid color.
// Pure, so it's tested without decoding real images.

const HUE_BUCKETS = 12;
const MAX_SAMPLES_PER_SIDE = 64;
/** Below this share of colorful pixels the image is basically gray, and gets no tint. */
const MIN_CHROMA_SHARE = 0.04;

function toHex(r: number, g: number, b: number): string {
  const h = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/**
 * The most prominent vivid color in RGBA pixels, as "#rrggbb", or null for grayscale-ish images.
 * Samples a grid of at most 64 x 64 pixels, groups them by hue, weights each by how colorful it is
 * (saturated, neither near black nor near white), and averages the heaviest hue group.
 */
export function dominantColor(rgba: Uint8Array, width: number, height: number): string | null {
  if (width <= 0 || height <= 0 || rgba.length < width * height * 4) return null;
  const stepX = Math.max(1, Math.floor(width / MAX_SAMPLES_PER_SIDE));
  const stepY = Math.max(1, Math.floor(height / MAX_SAMPLES_PER_SIDE));
  const weight = new Array<number>(HUE_BUCKETS).fill(0);
  const sums = Array.from({ length: HUE_BUCKETS }, () => [0, 0, 0]);
  let samples = 0;
  let colorful = 0;

  for (let y = Math.floor(stepY / 2); y < height; y += stepY) {
    for (let x = Math.floor(stepX / 2); x < width; x += stepX) {
      const i = (y * width + x) * 4;
      if (rgba[i + 3] < 128) continue; // transparent
      samples++;
      const r = rgba[i] / 255, g = rgba[i + 1] / 255, b = rgba[i + 2] / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const chroma = max - min;
      const light = (max + min) / 2;
      if (chroma < 0.15 || light < 0.12 || light > 0.92) continue;
      colorful++;
      let hue: number;
      if (max === r) hue = ((g - b) / chroma + 6) % 6;
      else if (max === g) hue = (b - r) / chroma + 2;
      else hue = (r - g) / chroma + 4;
      const bucket = Math.floor((hue / 6) * HUE_BUCKETS) % HUE_BUCKETS;
      // Favor vivid, mid-light pixels over muddy or washed-out ones.
      const w = chroma * (1 - Math.abs(light - 0.5));
      weight[bucket] += w;
      sums[bucket][0] += rgba[i] * w;
      sums[bucket][1] += rgba[i + 1] * w;
      sums[bucket][2] += rgba[i + 2] * w;
    }
  }
  if (samples === 0 || colorful / samples < MIN_CHROMA_SHARE) return null;
  let best = 0;
  for (let k = 1; k < HUE_BUCKETS; k++) if (weight[k] > weight[best]) best = k;
  const w = weight[best];
  return toHex(sums[best][0] / w, sums[best][1] / w, sums[best][2] / w);
}
