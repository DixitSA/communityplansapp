// Helpers for copying remote images into Storage (agent-inbox, and ingest-serpapi's link-preview images).

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/** https only; no IP literals (v4/v6), localhost, .local/.internal, or dotless hosts. */
export function isSafeImageUrl(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.username || u.password || u.port !== "") return false; // default port 443 only
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (host === "" || host.startsWith("[") || host.includes(":")) return false; // IPv6 literal
  if (IPV4.test(host) || /^[\d.]+$/.test(host) || /^0x[0-9a-f]+$/i.test(host)) return false; // IPv4 incl. odd forms
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return false;
  if (!host.includes(".")) return false;
  return true;
}

export type ImageType = { ext: "jpg" | "png" | "webp" | "gif"; contentType: string };

/** Detect the image type from the first bytes. Never trusts headers. */
export function sniffImage(b: Uint8Array): ImageType | null {
  const at = (i: number, s: string) => s.split("").every((c, k) => b[i + k] === c.charCodeAt(0));
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", contentType: "image/jpeg" };
  if (b.length >= 8 && b[0] === 0x89 && at(1, "PNG") && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) {
    return { ext: "png", contentType: "image/png" };
  }
  if (b.length >= 12 && at(0, "RIFF") && at(8, "WEBP")) return { ext: "webp", contentType: "image/webp" };
  if (b.length >= 6 && (at(0, "GIF87a") || at(0, "GIF89a"))) return { ext: "gif", contentType: "image/gif" };
  return null;
}

const MAX_REDIRECTS = 3;

/**
 * GET with manual redirects (every hop re-checked by isSafeImageUrl), a timeout and a streamed byte cap.
 * Null on any failure. Never logs: the URL may carry tokens.
 */
export async function downloadLimited(
  start: string,
  opts: { maxBytes: number; accept: string; timeoutMs: number; truncate?: boolean },
): Promise<Uint8Array | null> {
  const signal = AbortSignal.timeout(opts.timeoutMs);
  let url = start;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!isSafeImageUrl(url)) return null;
      const res = await fetch(url, {
        redirect: "manual",
        signal,
        headers: { Accept: opts.accept, "User-Agent": "Mozilla/5.0 (compatible; yard-link-preview/1.0)" },
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("Location");
        await res.body?.cancel();
        if (!loc) return null;
        url = new URL(loc, url).toString();
        continue;
      }
      if (!res.ok || !res.body) {
        await res.body?.cancel();
        return null;
      }
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (total + value.length > opts.maxBytes) {
          await reader.cancel();
          if (!opts.truncate) return null; // images: too big is a failure
          chunks.push(value.subarray(0, opts.maxBytes - total)); // pages: the head is all we need
          total = opts.maxBytes;
          break;
        }
        total += value.length;
        chunks.push(value);
      }
      const out = new Uint8Array(total);
      let o = 0;
      for (const c of chunks) {
        out.set(c, o);
        o += c.length;
      }
      return out;
    }
  } catch {
    return null;
  }
  return null; // too many redirects
}
