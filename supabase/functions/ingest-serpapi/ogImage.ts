// The picture a page shows when its link is shared (og:image / twitter:image). Pure, so it can be tested.

const META = /<meta\b[^>]*>/gi;
const ATTR = (name: string) => new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
const KEYS = ["og:image:secure_url", "og:image:url", "og:image", "twitter:image", "twitter:image:src"];

function attr(tag: string, name: string): string | null {
  const m = ATTR(name).exec(tag);
  return m ? (m[2] ?? m[3] ?? m[4] ?? null) : null;
}

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&#x2F;/gi, "/").replace(/&#47;/g, "/").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

/** The page's share image as an absolute https URL, or null. og:image wins over twitter:image. */
export function ogImageUrl(html: string, pageUrl: string): string | null {
  const found = new Map<string, string>();
  for (const tag of html.match(META) ?? []) {
    const key = (attr(tag, "property") ?? attr(tag, "name"))?.toLowerCase();
    const content = attr(tag, "content");
    if (key && content && KEYS.includes(key) && !found.has(key)) found.set(key, decode(content.trim()));
  }
  for (const key of KEYS) {
    const v = found.get(key);
    if (!v) continue;
    try {
      const u = new URL(v, pageUrl);
      if (u.protocol === "https:") return u.toString();
    } catch {
      // try the next key
    }
  }
  return null;
}

/** Pages that never give a share image to a server (login walls). Skipping them saves the time budget. */
export function skipsPreview(pageUrl: string): boolean {
  try {
    const host = new URL(pageUrl).hostname.toLowerCase();
    return /(^|\.)(facebook\.com|instagram\.com|fb\.me)$/.test(host);
  } catch {
    return true;
  }
}
