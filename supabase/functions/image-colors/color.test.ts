import { assertEquals, assertMatch } from "jsr:@std/assert@1";
import { dominantColor } from "./color.ts";

/** A w x h image filled by `paint(x, y)` -> [r, g, b, a?]. */
function image(w: number, h: number, paint: (x: number, y: number) => number[]): Uint8Array {
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a = 255] = paint(x, y);
      out.set([r, g, b, a], (y * w + x) * 4);
    }
  }
  return out;
}

Deno.test("a solid color comes back as itself", () => {
  assertEquals(dominantColor(image(10, 10, () => [200, 60, 40]), 10, 10), "#c83c28");
});

Deno.test("the bigger vivid area wins over a smaller one", () => {
  // Left 70% orange, right 30% blue.
  const px = image(100, 40, (x) => (x < 70 ? [230, 120, 30] : [30, 60, 220]));
  assertEquals(dominantColor(px, 100, 40), "#e6781e");
});

Deno.test("vivid beats a larger muddy or dark background", () => {
  // Mostly near-black poster with a pink title band.
  const px = image(80, 80, (_x, y) => (y > 30 && y < 45 ? [235, 70, 150] : [12, 10, 14]));
  assertEquals(dominantColor(px, 80, 80), "#eb4696");
});

Deno.test("grayscale and transparent images get no tint", () => {
  assertEquals(dominantColor(image(20, 20, (x) => [x * 10, x * 10, x * 10]), 20, 20), null);
  assertEquals(dominantColor(image(20, 20, () => [255, 0, 0, 0]), 20, 20), null);
});

Deno.test("bad dimensions are rejected, big images are sampled", () => {
  assertEquals(dominantColor(new Uint8Array(4), 10, 10), null);
  assertMatch(dominantColor(image(1200, 800, () => [40, 160, 90]), 1200, 800) ?? "", /^#[0-9a-f]{6}$/);
});
