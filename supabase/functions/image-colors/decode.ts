import jpeg from "npm:jpeg-js@0.4.4";
import { PNG } from "npm:pngjs@7.0.0";
import { Buffer } from "node:buffer";
import { sniffImage } from "../agent-inbox/image.ts";

export type Pixels = { data: Uint8Array; width: number; height: number };

/** Caps for untrusted images, so one huge or hostile file can't exhaust memory. */
const MAX_MEGAPIXELS = 6; // plenty for a flyer, and keeps one decode well under the CPU limit
const MAX_DECODE_MB = 128;

/** RGBA pixels for a JPEG or PNG, by its bytes (never by its headers). Null for other formats or bad files. */
export function decodeImage(bytes: Uint8Array): Pixels | null {
  const type = sniffImage(bytes);
  try {
    if (type?.ext === "jpg") {
      const img = jpeg.decode(bytes, {
        useTArray: true,
        formatAsRGBA: true,
        maxResolutionInMP: MAX_MEGAPIXELS,
        maxMemoryUsageInMB: MAX_DECODE_MB,
      });
      return { data: img.data, width: img.width, height: img.height };
    }
    if (type?.ext === "png") {
      // Check the size in the header before inflating anything.
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const w = view.getUint32(16), h = view.getUint32(20);
      if (w * h > MAX_MEGAPIXELS * 1_000_000) return null;
      const img = PNG.sync.read(Buffer.from(bytes));
      return { data: new Uint8Array(img.data.buffer, img.data.byteOffset, img.data.byteLength), width: img.width, height: img.height };
    }
  } catch {
    return null;
  }
  return null; // WebP and GIF: no tint
}
